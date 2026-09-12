import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { handleDeleteProject } from "../../../src/server/projects/project-handlers-core";
import { ProjectService } from "../../../src/server/projects/project-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const now = new Date("2026-09-12T01:00:00.000Z");

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

function request(
  publicId: string,
  rawToken: string | undefined,
  ifMatch: string | null = '"1"',
): Request {
  const headers = new Headers({ Origin: "https://gantt.example.com" });
  if (rawToken !== undefined) {
    headers.set("Cookie", `__Host-mastergantt_edit=${rawToken}`);
  }
  if (ifMatch !== null) headers.set("If-Match", ifMatch);
  return new Request(`https://gantt.example.com/api/projects/${publicId}`, {
    method: "DELETE",
    headers,
  });
}

async function fixture() {
  const database = openDatabase({
    filename: ":memory:",
    migrationsDirectory,
  }).database;
  const service = new ProjectService(database, {
    clock: () => now,
    hashPassword: async () => fixedPasswordHash(),
  });
  const target = await service.create({
    name: "Target",
    description: "",
    editPassword: "password phrase",
  });
  return { database, service, target };
}

const dependencies = {
  applicationBaseUrl: "https://gantt.example.com",
  environment: "production",
  requestId: () => "request-id",
};

describe("Project DELETE Handler-Service-SQLite integration", () => {
  it("persists deletion and expires the authorized target cookie", async () => {
    const value = await fixture();
    try {
      const response = handleDeleteProject(
        request(
          value.target.response.data.project.publicId,
          value.target.rawSessionToken,
        ),
        value.target.response.data.project.publicId,
        { ...dependencies, service: value.service },
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
      expect(value.database.prepare("SELECT count(*) FROM projects").pluck().get())
        .toBe(0);
      expect(value.database.prepare("SELECT count(*) FROM edit_sessions").pluck().get())
        .toBe(0);
    } finally {
      value.database.close();
    }
  });

  it.each(["absent", "other-project", "expired"])(
    "rejects a %s edit session without deleting either project",
    async (state) => {
      const value = await fixture();
      try {
        const other = await value.service.create({
          name: "Other",
          description: "",
          editPassword: "password phrase",
        });
        if (state === "expired") {
          value.database.prepare(
            "UPDATE edit_sessions SET expires_at = ? WHERE token_hash <> (SELECT token_hash FROM edit_sessions ORDER BY id DESC LIMIT 1)",
          ).run(now.toISOString());
        }
        const token = state === "absent"
          ? undefined
          : state === "other-project"
            ? other.rawSessionToken
            : value.target.rawSessionToken;
        const response = handleDeleteProject(
          request(value.target.response.data.project.publicId, token),
          value.target.response.data.project.publicId,
          { ...dependencies, service: value.service },
        );
        expect(response.status).toBe(401);
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(value.database.prepare("SELECT count(*) FROM projects").pluck().get())
          .toBe(2);
        expect(value.database.prepare("SELECT count(*) FROM edit_sessions").pluck().get())
          .toBe(2);
      } finally {
        value.database.close();
      }
    },
  );

  it("rejects missing and stale revisions without deleting the project", async () => {
    const value = await fixture();
    try {
      const missing = handleDeleteProject(
        request(
          value.target.response.data.project.publicId,
          value.target.rawSessionToken,
          null,
        ),
        value.target.response.data.project.publicId,
        { ...dependencies, service: value.service },
      );
      expect(missing.status).toBe(428);

      value.database.prepare(
        "UPDATE projects SET revision = revision + 1",
      ).run();
      const stale = handleDeleteProject(
        request(
          value.target.response.data.project.publicId,
          value.target.rawSessionToken,
        ),
        value.target.response.data.project.publicId,
        { ...dependencies, service: value.service },
      );
      expect(stale.status).toBe(412);
      expect(value.database.prepare("SELECT count(*) FROM projects").pluck().get())
        .toBe(1);
      expect(value.database.prepare("SELECT count(*) FROM edit_sessions").pluck().get())
        .toBe(1);
    } finally {
      value.database.close();
    }
  });
});
