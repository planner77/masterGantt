import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import {
  DuplicateExternalIdError,
  EditSessionInvalidError,
  InvalidTaskInputError,
  ProjectService,
  RevisionMismatchError,
  TaskNotFoundError,
  TaskLimitExceededError,
  PersistedScheduleInvalidError,
  UnsupportedScheduleStructureError,
  type AuthorizedEditSession,
} from "../../../src/server/projects/project-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrations = join(process.cwd(), "db", "migrations");
const now = new Date("2026-09-11T01:00:00.000Z");

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

function authorized(
  service: ProjectService,
  publicId: string,
  rawToken: string,
): AuthorizedEditSession {
  const result = service.authorize(publicId, rawToken);
  if (result.kind !== "authorized") throw new Error("expected authorization");
  return result.authorization;
}

async function fixture(options: ConstructorParameters<typeof ProjectService>[1] = {}) {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
  const projectPublicId = randomUUID();
  const session = createSessionToken();
  const service = new ProjectService(database, {
    clock: () => now,
    generatePublicId: () => projectPublicId,
    generateSessionToken: () => session,
    hashPassword: async () => fixedPasswordHash(),
    ...options,
  });
  const created = await service.create({ name: "Project", description: "", editPassword: "password phrase" });
  return {
    database,
    service,
    projectPublicId,
    rawToken: created.rawSessionToken,
    authorization: authorized(service, projectPublicId, created.rawSessionToken),
  };
}

const createInput = {
  externalId: "ACT-100",
  name: "Foundation",
  type: "task" as const,
  scheduleMode: "auto" as const,
  start: "2026-09-12",
  end: "2026-09-16",
  duration: 3,
  progress: 25,
};

describe("W07 ProjectService task mutations", () => {
  it("creates, updates, deletes, and returns a canonical persisted snapshot", async () => {
    const { database, service, authorization } = await fixture({
      generateTaskPublicId: () => "f6760712-5649-4edc-9781-5df172e27e88",
    });
    try {
      database.prepare(
        "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (1, '2026-09-14', 'Holiday', ?)",
      ).run(now.toISOString());
      const created = service.createTask(authorization, 1, {
        ...createInput,
        end: "2026-09-17",
      });
      expect(created.data).toMatchObject({
        project: { revision: 2 },
        tasks: [{
          taskId: "f6760712-5649-4edc-9781-5df172e27e88",
          externalId: "ACT-100",
          requestedStart: "2026-09-12",
          start: "2026-09-15",
          end: "2026-09-17",
          siblingOrder: 0,
        }],
        warnings: [{
          code: "NON_WORKING_START_SHIFTED",
          path: "start",
          requestedStart: "2026-09-12",
          start: "2026-09-15",
        }],
        operation: { kind: "taskCreate", changedTaskExternalIds: ["ACT-100"] },
      });
      expect(created.data).not.toHaveProperty("permission");

      const updated = service.updateTask(
        authorization,
        2,
        created.data.tasks[0].taskId,
        { name: "Updated", start: "2026-09-15", duration: 2, progress: 50 },
      );
      expect(updated.data).toMatchObject({
        project: { revision: 3 },
        tasks: [{ name: "Updated", start: "2026-09-15", end: "2026-09-16", progress: 50 }],
        warnings: [],
        operation: { kind: "taskUpdate", changedTaskExternalIds: ["ACT-100"] },
      });

      const deleted = service.deleteTask(
        authorization,
        3,
        created.data.tasks[0].taskId,
      );
      expect(deleted.data).toMatchObject({
        project: { revision: 4 },
        tasks: [],
        links: [],
        operation: {
          kind: "taskDelete",
          changedTaskExternalIds: [],
          deletedTaskExternalIds: ["ACT-100"],
          deletedLinkIds: [],
        },
      });
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(0);
    } finally {
      database.close();
    }
  });

  it("keeps generated taskId and externalId distinct and retries collisions three times", async () => {
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ];
    const externals = [ids[0], ids[1], "00000000-0000-4000-8000-000000000004"];
    const { database, service, authorization } = await fixture({
      generateTaskPublicId: () => ids.shift() ?? randomUUID(),
      generateTaskExternalId: () => externals.shift() ?? randomUUID(),
    });
    try {
      const response = service.createTask(authorization, 1, {
        name: "Generated",
        type: "milestone",
        start: "2026-09-11",
        duration: 0,
        progress: 0,
      });
      expect(response.data.tasks[0]).toMatchObject({
        taskId: "00000000-0000-4000-8000-000000000003",
        externalId: "00000000-0000-4000-8000-000000000004",
        start: "2026-09-11",
        end: "2026-09-11",
      });
    } finally {
      database.close();
    }
  });

  it("rejects duplicate IDs, stale revisions, missing tasks, and invalid sessions without writes", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const created = service.createTask(authorization, 1, createInput);
      expect(() => service.createTask(authorization, 2, createInput))
        .toThrow(DuplicateExternalIdError);
      expect(() => service.updateTask(authorization, 1, created.data.tasks[0].taskId, { name: "Stale" }))
        .toThrow(RevisionMismatchError);
      expect(() => service.updateTask(authorization, 2, randomUUID(), { name: "Missing" }))
        .toThrow(TaskNotFoundError);

      database.prepare("UPDATE edit_sessions SET revoked_at = ?").run(now.toISOString());
      database.prepare("UPDATE projects SET revision = 3").run();
      expect(() => service.deleteTask(authorization, 2, created.data.tasks[0].taskId))
        .toThrow(EditSessionInvalidError);
      expect(database.prepare("SELECT name FROM tasks").pluck().get()).toBe("Foundation");
    } finally {
      database.close();
    }
  });

  it("fails closed when a summary, parent, or link exists", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const first = service.createTask(authorization, 1, createInput);
      const firstId = first.data.tasks[0].taskId;
      const second = service.createTask(authorization, 2, {
        ...createInput,
        externalId: "ACT-200",
        name: "Second",
      });
      const internal = database.prepare("SELECT id FROM tasks ORDER BY id").pluck().all() as number[];
      database.prepare(
        `INSERT INTO links (public_id, project_id, predecessor_task_id, successor_task_id,
          type, lag, created_at, updated_at) VALUES (?, 1, ?, ?, 'FS', 0, ?, ?)`,
      ).run(randomUUID(), internal[0], internal[1], now.toISOString(), now.toISOString());

      expect(() => service.updateTask(authorization, 3, firstId, { name: "No" }))
        .toThrow(UnsupportedScheduleStructureError);
      expect(() => service.deleteTask(authorization, 3, second.data.tasks[1].taskId))
        .toThrow(UnsupportedScheduleStructureError);
      expect(database.prepare("SELECT revision FROM projects").pluck().get()).toBe(3);
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
      expect(database.prepare("SELECT count(*) FROM links").pluck().get()).toBe(1);
    } finally {
      database.close();
    }
  });

  it("rolls task insertion back when revision persistence fails", async () => {
    const { database, service, authorization } = await fixture();
    try {
      database.exec(`CREATE TRIGGER reject_task_revision BEFORE UPDATE ON projects
        WHEN NEW.revision > OLD.revision BEGIN SELECT RAISE(ABORT, 'fault'); END`);
      expect(() => service.createTask(authorization, 1, createInput)).toThrow();
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(0);
      expect(database.prepare("SELECT revision FROM projects").pluck().get()).toBe(1);
    } finally {
      database.close();
    }
  });

  it("rolls Task update back when revision advance fails", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const task = service.createTask(authorization, 1, createInput).data.tasks[0];
      database.exec(`CREATE TRIGGER reject_update_revision BEFORE UPDATE ON projects
        WHEN NEW.revision > OLD.revision BEGIN SELECT RAISE(ABORT, 'fault'); END`);
      expect(() => service.updateTask(authorization, 2, task.taskId, {
        name: "Must rollback",
        progress: 90,
      })).toThrow(/fault/);
      expect(database.prepare(
        "SELECT tasks.name AS name, tasks.progress AS progress, projects.revision AS revision FROM tasks JOIN projects ON projects.id = tasks.project_id",
      ).get()).toEqual({ name: "Foundation", progress: 25, revision: 2 });
    } finally {
      database.close();
    }
  });

  it("rolls Task deletion and revision back when project readback fails", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const task = service.createTask(authorization, 1, createInput).data.tasks[0];
      database.exec(`CREATE TRIGGER remove_project_after_revision AFTER UPDATE OF revision ON projects
        WHEN NEW.revision > OLD.revision BEGIN DELETE FROM projects WHERE id = NEW.id; END`);
      expect(() => service.deleteTask(authorization, 2, task.taskId))
        .toThrow(RevisionMismatchError);
      expect(database.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(1);
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(1);
      expect(database.prepare("SELECT revision FROM projects").pluck().get()).toBe(2);
    } finally {
      database.close();
    }
  });

  it("rolls back Manual non-working starts and end assertions rejected by the Domain", async () => {
    const { database, service, authorization } = await fixture();
    try {
      expect(() => service.createTask(authorization, 1, {
        ...createInput,
        scheduleMode: "manual",
      })).toThrowError(expect.objectContaining({
        code: "NON_WORKING_MANUAL_START",
      }));
      expect(() => service.createTask(authorization, 1, {
        ...createInput,
        end: "2026-09-15",
      })).toThrowError(expect.objectContaining({
        code: "END_DURATION_MISMATCH",
      }));
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(0);
      expect(database.prepare("SELECT revision FROM projects").pluck().get()).toBe(1);
    } finally {
      database.close();
    }
  });

  it("allows exactly one sequential contender for the same aggregate revision", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const first = service.createTask(authorization, 1, createInput);
      expect(() => service.updateTask(authorization, 1, first.data.tasks[0].taskId, { name: "Lost" }))
        .toThrow(RevisionMismatchError);
      expect(database.prepare("SELECT tasks.name AS name, projects.revision AS revision FROM tasks JOIN projects ON projects.id = tasks.project_id").get())
        .toEqual({ name: "Foundation", revision: 2 });
    } finally {
      database.close();
    }
  });

  it("hides malformed persisted calendar/task state behind a server invariant error", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const created = service.createTask(authorization, 1, createInput);
      database.prepare("UPDATE tasks SET requested_start = '2026-02-30'").run();
      expect(() => service.updateTask(authorization, 2, created.data.tasks[0].taskId, { name: "No" }))
        .toThrow(PersistedScheduleInvalidError);
      expect(database.prepare("SELECT tasks.name AS name, projects.revision AS revision FROM tasks JOIN projects ON projects.id = tasks.project_id").get())
        .toMatchObject({ name: "Foundation", revision: 2 });
    } finally {
      database.close();
    }
  });

  it("enforces the 5000-task aggregate limit before generating identifiers", async () => {
    const generateTaskPublicId = () => {
      throw new Error("identifier generation must not run");
    };
    const { database, service, authorization } = await fixture({ generateTaskPublicId });
    try {
      const insert = database.prepare(
        `INSERT INTO tasks (
          project_id, external_id, public_id, name, type, schedule_mode,
          requested_start, start_date, end_date, duration, progress,
          parent_id, sort_order, created_at, updated_at
        ) VALUES (1, ?, ?, 'Task', 'task', 'auto', '2026-09-11',
          '2026-09-11', '2026-09-11', 1, 0, NULL, ?, ?, ?)`,
      );
      database.transaction(() => {
        for (let index = 0; index < 5_000; index += 1) {
          insert.run(`E-${index}`, `P-${index}`, index, now.toISOString(), now.toISOString());
        }
      }).immediate();
      expect(() => service.createTask(authorization, 1, createInput))
        .toThrow(TaskLimitExceededError);
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(5_000);
      expect(database.prepare("SELECT revision FROM projects").pluck().get()).toBe(1);
    } finally {
      database.close();
    }
  });

  it("does not resolve a Task UUID through a different Project authorization", async () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
    const projectIds = [randomUUID(), randomUUID()];
    const sessions = [createSessionToken(), createSessionToken()];
    const service = new ProjectService(database, {
      clock: () => now,
      generatePublicId: () => projectIds.shift() ?? randomUUID(),
      generateSessionToken: () => sessions.shift() ?? createSessionToken(),
      hashPassword: async () => fixedPasswordHash(),
    });
    try {
      const first = await service.create({ name: "First", description: "", editPassword: "password phrase" });
      const second = await service.create({ name: "Second", description: "", editPassword: "password phrase" });
      const firstAuth = authorized(service, first.response.data.project.publicId, first.rawSessionToken);
      const secondAuth = authorized(service, second.response.data.project.publicId, second.rawSessionToken);
      const task = service.createTask(firstAuth, 1, createInput).data.tasks[0];
      expect(() => service.updateTask(secondAuth, 1, task.taskId, { name: "Cross Project" }))
        .toThrow(TaskNotFoundError);
      expect(service.getReadonlySnapshot(first.response.data.project.publicId)?.data.project.revision).toBe(2);
      expect(service.getReadonlySnapshot(second.response.data.project.publicId)?.data.project.revision).toBe(1);
    } finally {
      database.close();
    }
  });

  it("revalidates expiry and auth-version inside the Task transaction", async () => {
    let current = new Date("2026-09-11T01:00:00.000Z");
    const expired = await fixture({ clock: () => current });
    try {
      const task = expired.service.createTask(expired.authorization, 1, createInput).data.tasks[0];
      current = new Date("2026-09-11T09:00:00.000Z");
      expect(() => expired.service.updateTask(expired.authorization, 2, task.taskId, { name: "Expired" }))
        .toThrow(EditSessionInvalidError);
      expect(expired.database.prepare("SELECT name FROM tasks").pluck().get()).toBe("Foundation");
      expect(expired.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(2);
    } finally {
      expired.database.close();
    }

    const mismatched = await fixture();
    try {
      const task = mismatched.service.createTask(mismatched.authorization, 1, createInput).data.tasks[0];
      mismatched.database.prepare("UPDATE edit_sessions SET auth_version = auth_version + 1").run();
      expect(() => mismatched.service.deleteTask(mismatched.authorization, 2, task.taskId))
        .toThrow(EditSessionInvalidError);
      expect(mismatched.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(1);
      expect(mismatched.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(2);
    } finally {
      mismatched.database.close();
    }
  });

  it("rejects an old Task authorization after password rotation", async () => {
    const tokens = [createSessionToken(), createSessionToken()];
    const value = await fixture({
      generateSessionToken: () => tokens.shift() ?? createSessionToken(),
    });
    try {
      const task = value.service.createTask(value.authorization, 1, createInput).data.tasks[0];
      const currentAuthorization = authorized(
        value.service,
        value.projectPublicId,
        value.rawToken,
      );
      await value.service.rotatePassword(currentAuthorization, 2, "new password phrase");
      expect(() => value.service.updateTask(currentAuthorization, 3, task.taskId, { name: "Old session" }))
        .toThrow(EditSessionInvalidError);
      expect(value.database.prepare("SELECT name FROM tasks").pluck().get()).toBe("Foundation");
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(3);
    } finally {
      value.database.close();
    }
  });

  it("persists requested/effective dates, progress, and revision across close/reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mastergantt-w07-task-"));
    const filename = join(directory, "application.sqlite3");
    const firstDatabase = openDatabase({ filename, migrationsDirectory: migrations }).database;
    const service = new ProjectService(firstDatabase, {
      clock: () => now,
      hashPassword: async () => fixedPasswordHash(),
    });
    try {
      const project = await service.create({ name: "Persistent", description: "", editPassword: "password phrase" });
      firstDatabase.prepare(
        "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (1, '2026-09-14', 'Holiday', ?)",
      ).run(now.toISOString());
      service.createTask(
        authorized(service, project.response.data.project.publicId, project.rawSessionToken),
        1,
        { ...createInput, end: "2026-09-17", progress: 100 / 3 },
      );
      firstDatabase.close();

      const secondDatabase = openDatabase({ filename, migrationsDirectory: migrations }).database;
      try {
        const snapshot = new ProjectService(secondDatabase, { clock: () => now })
          .getReadonlySnapshot(project.response.data.project.publicId);
        expect(snapshot?.data).toMatchObject({
          project: { revision: 2 },
          tasks: [{
            externalId: "ACT-100",
            requestedStart: "2026-09-12",
            start: "2026-09-15",
            end: "2026-09-17",
            duration: 3,
            progress: 100 / 3,
          }],
        });
      } finally {
        secondDatabase.close();
      }
    } finally {
      if (firstDatabase.open) firstDatabase.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects noncanonical direct create callers before SQL or revision changes", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const invalidInputs: unknown[] = [
        null,
        { ...createInput, name: " Foundation " },
        { ...createInput, name: "" },
        { ...createInput, name: "x".repeat(201) },
        { ...createInput, name: "bad\ud800" },
        { ...createInput, externalId: " ACT-100" },
        { ...createInput, externalId: "ACT-100\u00a0" },
        { ...createInput, externalId: "A\u0000B" },
        { ...createInput, externalId: "A\u200bB" },
        { ...createInput, externalId: "x".repeat(129) },
        { ...createInput, progress: Number.NaN },
        { ...createInput, progress: Number.POSITIVE_INFINITY },
        { ...createInput, progress: -1 },
        { ...createInput, progress: 101 },
        { ...createInput, parentExternalId: "SUM-1" },
        { ...createInput, unknown: true },
      ];
      for (const input of invalidInputs) {
        expect(() => service.createTask(authorization, 1, input as never))
          .toThrow(InvalidTaskInputError);
      }
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(0);
      expect(database.prepare("SELECT revision FROM projects").pluck().get()).toBe(1);
    } finally {
      database.close();
    }
  });

  it("rejects noncanonical direct update callers without touching the Task aggregate", async () => {
    const { database, service, authorization } = await fixture();
    try {
      const task = service.createTask(authorization, 1, createInput).data.tasks[0];
      const invalidUpdates: unknown[] = [
        null,
        {},
        { name: " Updated " },
        { name: "x".repeat(201) },
        { name: "bad\ud800" },
        { progress: Number.NaN },
        { progress: Number.NEGATIVE_INFINITY },
        { progress: -1 },
        { progress: 101 },
        { end: "2026-09-15" },
        { externalId: "NEW" },
        { type: "milestone" },
        { parentExternalId: null },
        { siblingOrder: 1 },
      ];
      for (const input of invalidUpdates) {
        expect(() => service.updateTask(authorization, 2, task.taskId, input as never))
          .toThrow(InvalidTaskInputError);
      }
      expect(database.prepare(
        "SELECT tasks.name AS name, tasks.progress AS progress, projects.revision AS revision FROM tasks JOIN projects ON projects.id = tasks.project_id",
      ).get()).toEqual({ name: "Foundation", progress: 25, revision: 2 });
    } finally {
      database.close();
    }
  });
});
