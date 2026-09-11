import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import {
  ProjectService,
  type AuthorizedEditSession,
} from "../../../src/server/projects/project-service-core";
import {
  handleCreateTask,
  handleUpdateTask,
} from "../../../src/server/projects/task-handlers-core";

const migrations = join(process.cwd(), "db", "migrations");
const clock = () => new Date("2026-09-11T01:00:00.000Z");

function fixedPasswordHash() {
  return {
    algorithm: "scrypt" as const,
    salt: Buffer.alloc(16, 1),
    hash: Buffer.alloc(32, 2),
    n: 32_768,
    r: 8,
    p: 3,
    keyLength: 32,
  };
}

async function fixture() {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
  const service = new ProjectService(database, {
    clock,
    hashPassword: async () => fixedPasswordHash(),
  });
  const created = await service.create({ name: "Project", description: "", editPassword: "password phrase" });
  return {
    database,
    service,
    publicId: created.response.data.project.publicId,
    rawToken: created.rawSessionToken,
  };
}

function authorization(service: ProjectService, publicId: string, rawToken: string): AuthorizedEditSession {
  const result = service.authorize(publicId, rawToken);
  if (result.kind !== "authorized") throw new Error("expected authorization");
  return result.authorization;
}

function request(
  publicId: string,
  method: "POST" | "PATCH",
  body: unknown,
  options: { taskId?: string; cookie?: string; ifMatch?: string | null } = {},
) {
  const path = options.taskId
    ? `/api/projects/${publicId}/tasks/${options.taskId}`
    : `/api/projects/${publicId}/tasks`;
  const headers = new Headers({
    Origin: "https://gantt.example.com",
    "Content-Type": "application/json",
  });
  if (options.cookie !== undefined) headers.set("Cookie", options.cookie);
  if (options.ifMatch !== null) headers.set("If-Match", options.ifMatch ?? '"1"');
  return new Request(`https://gantt.example.com${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function cookie(rawToken: string): string {
  return `__Host-mastergantt_edit=${rawToken}`;
}

const input = {
  externalId: "ACT-100",
  name: "Task",
  type: "task" as const,
  start: "2026-09-11",
  duration: 1,
  progress: 25,
};

const dependencies = {
  applicationBaseUrl: "https://gantt.example.com",
  environment: "production",
  requestId: () => "request-id",
};

describe("W07 real task Handler-Service-SQLite integration", () => {
  it("persists a successful protected create through the real stack", async () => {
    const value = await fixture();
    try {
      const response = await handleCreateTask(
        request(value.publicId, "POST", input, { cookie: cookie(value.rawToken) }),
        value.publicId,
        { ...dependencies, service: value.service },
      );
      expect(response.status).toBe(201);
      expect(response.headers.get("etag")).toBe('"2"');
      expect(await response.json()).toMatchObject({
        data: {
          project: { revision: 2 },
          tasks: [{ externalId: "ACT-100", requestedStart: "2026-09-11", start: "2026-09-11" }],
        },
      });
      expect(value.database.prepare("SELECT external_id, revision FROM tasks JOIN projects ON projects.id = tasks.project_id").get())
        .toEqual({ external_id: "ACT-100", revision: 2 });
    } finally {
      value.database.close();
    }
  });

  it.each(["missing", "malformed", "expired", "revoked", "auth-version"])(
    "rejects a %s Cookie state without changing the aggregate",
    async (state) => {
      const value = await fixture();
      try {
        if (state === "expired") {
          value.database.prepare("UPDATE edit_sessions SET expires_at = ?").run(clock().toISOString());
        } else if (state === "revoked") {
          value.database.prepare("UPDATE edit_sessions SET revoked_at = ?").run(clock().toISOString());
        } else if (state === "auth-version") {
          value.database.prepare("UPDATE edit_sessions SET auth_version = auth_version + 1").run();
        }
        const header = state === "missing"
          ? undefined
          : state === "malformed" ? "__Host-mastergantt_edit=bad" : cookie(value.rawToken);
        const response = await handleCreateTask(
          request(value.publicId, "POST", input, { cookie: header }),
          value.publicId,
          { ...dependencies, service: value.service },
        );
        expect(response.status).toBe(401);
        expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(0);
        expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(1);
      } finally {
        value.database.close();
      }
    },
  );

  it("rejects a valid Cookie owned by another Project", async () => {
    const value = await fixture();
    try {
      const other = await value.service.create({ name: "Other", description: "", editPassword: "password phrase" });
      const response = await handleCreateTask(
        request(value.publicId, "POST", input, { cookie: cookie(other.rawSessionToken) }),
        value.publicId,
        { ...dependencies, service: value.service },
      );
      expect(response.status).toBe(401);
      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(0);
      expect(value.database.prepare("SELECT revision FROM projects ORDER BY id").pluck().all()).toEqual([1, 1]);
    } finally {
      value.database.close();
    }
  });

  it("returns scoped TASK_NOT_FOUND for a Task UUID owned by another Project", async () => {
    const value = await fixture();
    try {
      const other = await value.service.create({ name: "Other", description: "", editPassword: "password phrase" });
      const firstTask = value.service.createTask(
        authorization(value.service, value.publicId, value.rawToken),
        1,
        input,
      ).data.tasks[0];
      const response = await handleUpdateTask(
        request(other.response.data.project.publicId, "PATCH", { name: "Cross" }, {
          taskId: firstTask.taskId,
          cookie: cookie(other.rawSessionToken),
        }),
        other.response.data.project.publicId,
        firstTask.taskId,
        { ...dependencies, service: value.service },
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: "TASK_NOT_FOUND" } });
      expect(value.database.prepare("SELECT revision FROM projects ORDER BY id").pluck().all()).toEqual([2, 1]);
      expect(value.database.prepare("SELECT name FROM tasks").pluck().get()).toBe("Task");
    } finally {
      value.database.close();
    }
  });

  it("rejects missing and stale If-Match without changing Task or revision", async () => {
    const value = await fixture();
    try {
      const auth = authorization(value.service, value.publicId, value.rawToken);
      const task = value.service.createTask(auth, 1, input).data.tasks[0];
      const missing = await handleUpdateTask(
        request(value.publicId, "PATCH", { name: "Missing" }, {
          taskId: task.taskId,
          cookie: cookie(value.rawToken),
          ifMatch: null,
        }),
        value.publicId,
        task.taskId,
        { ...dependencies, service: value.service },
      );
      const stale = await handleUpdateTask(
        request(value.publicId, "PATCH", { name: "Stale" }, {
          taskId: task.taskId,
          cookie: cookie(value.rawToken),
          ifMatch: '"1"',
        }),
        value.publicId,
        task.taskId,
        { ...dependencies, service: value.service },
      );
      expect([missing.status, stale.status]).toEqual([428, 412]);
      expect(value.database.prepare(
        "SELECT tasks.name AS name, projects.revision AS revision FROM tasks JOIN projects ON projects.id = tasks.project_id",
      ).get()).toEqual({ name: "Task", revision: 2 });
    } finally {
      value.database.close();
    }
  });
});
