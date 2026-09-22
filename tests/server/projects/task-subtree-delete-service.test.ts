import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import {
  EmptySummaryNotAllowedError,
  PersistedScheduleInvalidError,
  ProjectService,
} from "../../../src/server/projects/project-service-core";
import { TaskSubtreeDeleteService } from "../../../src/server/projects/task-subtree-delete-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const now = new Date("2026-09-14T01:00:00.000Z");

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

function input(externalId: string, start = "2026-09-14", duration = 1) {
  return {
    externalId,
    name: externalId,
    type: "task" as const,
    start,
    duration,
    progress: 0,
  };
}

async function fixture() {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  const service = new ProjectService(database, {
    clock: () => now,
    hashPassword: async () => fixedPasswordHash(),
  });
  const subtree = new TaskSubtreeDeleteService(database, { clock: () => now });
  const created = await service.create({ name: "Delete subtree", description: "", editPassword: "password phrase" });
  const result = service.authorize(created.response.data.project.publicId, created.rawSessionToken);
  if (result.kind !== "authorized") throw new Error("Expected authorization.");
  return { database, service, subtree, authorization: result.authorization };
}

describe("TaskSubtreeDeleteService", () => {
  it("deletes a nested subtree atomically and recalculates the surviving parent summary", async () => {
    const value = await fixture();
    try {
      const root = value.service.createTask(value.authorization, 1, input("ROOT", "2026-09-14", 1)).data.tasks[0];
      const first = value.service.createTask(value.authorization, 2, {
        ...input("FIRST", "2026-09-15", 1), parentTaskId: root.taskId, convertParentToSummary: true,
      }).data.tasks.find((task) => task.externalId === "FIRST")!;
      value.service.createTask(value.authorization, 3, {
        ...input("SECOND", "2026-09-18", 1), parentTaskId: root.taskId,
      });
      value.service.createTask(value.authorization, 4, {
        ...input("GRANDCHILD", "2026-09-16", 1), parentTaskId: first.taskId, convertParentToSummary: true,
      });

      const deleted = value.subtree.deleteTaskSubtree(value.authorization, 5, first.taskId);
      expect(deleted.data.project.revision).toBe(6);
      expect(deleted.data.operation.deletedTaskExternalIds).toEqual(["GRANDCHILD", "FIRST"]);
      expect(deleted.data.tasks.map((task) => task.externalId).sort()).toEqual(["ROOT", "SECOND"]);
      expect(deleted.data.tasks.find((task) => task.externalId === "ROOT"))
        .toMatchObject({ type: "summary", start: "2026-09-18", end: "2026-09-18", duration: 1 });
      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
    } finally {
      value.database.close();
    }
  });

  it("allows deleting an unlinked task while preserving unrelated dependency links", async () => {
    const value = await fixture();
    try {
      value.service.createTask(value.authorization, 1, input("A"));
      value.service.createTask(value.authorization, 2, input("B"));
      const third = value.service.createTask(value.authorization, 3, input("C")).data.tasks.find((task) => task.externalId === "C")!;
      const ids = value.database.prepare("SELECT id FROM tasks WHERE external_id IN ('A','B') ORDER BY external_id").pluck().all() as number[];
      value.database.prepare(
        "INSERT INTO links(public_id,project_id,predecessor_task_id,successor_task_id,type,lag,created_at,updated_at) VALUES('link-ab',1,?,?,'FS',0,?,?)",
      ).run(ids[0], ids[1], now.toISOString(), now.toISOString());
      value.database.prepare(
        "UPDATE tasks SET start_date='2026-09-22', end_date='2026-09-22' WHERE external_id='B'",
      ).run();

      const deleted = value.subtree.deleteTaskSubtree(value.authorization, 4, third.taskId);
      expect(deleted.data.project.revision).toBe(5);
      expect(deleted.data.tasks.map((task) => task.externalId).sort()).toEqual(["A", "B"]);
      expect(deleted.data.links).toHaveLength(1);
      expect(deleted.data.links[0]).toMatchObject({ predecessorExternalId: "A", successorExternalId: "B" });
    } finally {
      value.database.close();
    }
  });

  it("rejects deletion before mutation when the persisted subtree schedule is already invalid", async () => {
    const value = await fixture();
    try {
      const root = value.service.createTask(value.authorization, 1, input("ROOT")).data.tasks[0];
      const child = value.service.createTask(value.authorization, 2, {
        ...input("CHILD", "2026-09-15", 1), parentTaskId: root.taskId, convertParentToSummary: true,
      }).data.tasks.find((task) => task.externalId === "CHILD")!;
      value.database.prepare("UPDATE tasks SET start_date = ? WHERE public_id = ?")
        .run("2026-09-17", child.taskId);

      expect(() => value.subtree.deleteTaskSubtree(value.authorization, 3, root.taskId))
        .toThrow(PersistedScheduleInvalidError);
      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(3);
    } finally {
      value.database.close();
    }
  });

  it("allows deleting a whole root subtree but rejects a subtree that would leave an outside summary empty", async () => {
    const first = await fixture();
    try {
      const root = first.service.createTask(first.authorization, 1, input("ROOT")).data.tasks[0];
      first.service.createTask(first.authorization, 2, {
        ...input("CHILD"), parentTaskId: root.taskId, convertParentToSummary: true,
      });
      const deleted = first.subtree.deleteTaskSubtree(first.authorization, 3, root.taskId);
      expect(deleted.data.tasks).toEqual([]);
      expect(deleted.data.operation.deletedTaskExternalIds).toEqual(["CHILD", "ROOT"]);
      expect(deleted.data.project.revision).toBe(4);
    } finally {
      first.database.close();
    }

    const second = await fixture();
    try {
      const root = second.service.createTask(second.authorization, 1, input("ROOT")).data.tasks[0];
      const child = second.service.createTask(second.authorization, 2, {
        ...input("ONLY"), parentTaskId: root.taskId, convertParentToSummary: true,
      }).data.tasks.find((task) => task.externalId === "ONLY")!;
      expect(() => second.subtree.deleteTaskSubtree(second.authorization, 3, child.taskId))
        .toThrow(EmptySummaryNotAllowedError);
      expect(second.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
      expect(second.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(3);
    } finally {
      second.database.close();
    }
  });
});
