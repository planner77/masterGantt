import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import {
  EmptySummaryNotAllowedError,
  InvalidParentTaskError,
  ParentConversionRequiredError,
  ProjectService,
  SummaryScheduleReadonlyError,
  SummaryTaskDeleteUnsupportedError,
  TaskNotFoundError,
} from "../../../src/server/projects/project-service-core";

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

async function fixture() {
  const database = openDatabase({
    filename: ":memory:",
    migrationsDirectory,
  }).database;
  const service = new ProjectService(database, {
    clock: () => now,
    hashPassword: async () => fixedPasswordHash(),
  });
  const created = await service.create({
    name: "Hierarchy",
    description: "",
    editPassword: "Pass123456!",
  });
  const authorization = service.authorize(
    created.response.data.project.publicId,
    created.rawSessionToken,
  );
  if (authorization.kind !== "authorized") throw new Error("Expected authorization.");
  return {
    database,
    service,
    publicId: created.response.data.project.publicId,
    rawToken: created.rawSessionToken,
    authorization: authorization.authorization,
  };
}

function taskInput(externalId: string, start = "2026-09-14", duration = 1) {
  return {
    externalId,
    name: externalId,
    type: "task" as const,
    start,
    duration,
    progress: 0,
  };
}

describe("ProjectService task hierarchy mutations", () => {
  it("requires explicit confirmation, then converts a leaf parent and creates its child atomically", async () => {
    const value = await fixture();
    try {
      const root = value.service.createTask(
        value.authorization,
        1,
        taskInput("ROOT", "2026-09-14", 2),
      ).data.tasks[0];

      expect(() => value.service.createTask(value.authorization, 2, {
        ...taskInput("CHILD", "2026-09-16", 3),
        parentTaskId: root.taskId,
      })).toThrow(ParentConversionRequiredError);
      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(1);
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(2);

      const created = value.service.createTask(value.authorization, 2, {
        ...taskInput("CHILD", "2026-09-16", 3),
        parentTaskId: root.taskId,
        convertParentToSummary: true,
      });
      expect(created.data.project.revision).toBe(3);
      expect(created.data.tasks).toMatchObject([
        {
          taskId: root.taskId,
          externalId: "ROOT",
          type: "summary",
          requestedStart: null,
          start: "2026-09-16",
          end: "2026-09-18",
          duration: 3,
          progress: 0,
          parentExternalId: null,
        },
        {
          externalId: "CHILD",
          parentExternalId: "ROOT",
          siblingOrder: 0,
        },
      ]);
      expect(created.data.operation.changedTaskExternalIds)
        .toEqual(["CHILD", "ROOT"]);
    } finally {
      value.database.close();
    }
  });

  it("rolls back the child and parent conversion when revision persistence fails", async () => {
    const value = await fixture();
    try {
      const root = value.service.createTask(
        value.authorization,
        1,
        taskInput("ROOT"),
      ).data.tasks[0];
      value.database.exec(
        `CREATE TRIGGER reject_hierarchy_revision
         BEFORE UPDATE OF revision ON projects
         WHEN NEW.revision > OLD.revision
         BEGIN SELECT RAISE(ABORT, 'hierarchy revision failure'); END`,
      );

      expect(() => value.service.createTask(value.authorization, 2, {
        ...taskInput("CHILD"),
        parentTaskId: root.taskId,
        convertParentToSummary: true,
      })).toThrowError(/hierarchy revision failure/);
      expect(value.database.prepare(
        "SELECT external_id, type, parent_id FROM tasks ORDER BY id",
      ).all()).toEqual([{ external_id: "ROOT", type: "task", parent_id: null }]);
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get())
        .toBe(2);
    } finally {
      value.database.close();
    }
  });

  it("recalculates ancestors after nested leaf update and deletion", async () => {
    const value = await fixture();
    try {
      const root = value.service.createTask(
        value.authorization,
        1,
        taskInput("ROOT"),
      ).data.tasks[0];
      const first = value.service.createTask(value.authorization, 2, {
        ...taskInput("FIRST", "2026-09-14", 2),
        progress: 50,
        parentTaskId: root.taskId,
        convertParentToSummary: true,
      }).data.tasks.find((task) => task.externalId === "FIRST")!;
      const withSecond = value.service.createTask(value.authorization, 3, {
        ...taskInput("SECOND", "2026-09-18", 1),
        progress: 100,
        parentTaskId: root.taskId,
      });
      const second = withSecond.data.tasks.find(
        (task) => task.externalId === "SECOND",
      )!;
      expect(withSecond.data.tasks.find((task) => task.externalId === "ROOT"))
        .toMatchObject({
          start: "2026-09-14",
          end: "2026-09-18",
          duration: 5,
          progress: 200 / 3,
        });

      const updated = value.service.updateTask(
        value.authorization,
        4,
        first.taskId,
        { start: "2026-09-16", duration: 1, progress: 0 },
      );
      expect(updated.data.tasks.find((task) => task.externalId === "ROOT"))
        .toMatchObject({
          start: "2026-09-16",
          end: "2026-09-18",
          duration: 3,
          progress: 50,
        });
      expect(updated.data.operation.changedTaskExternalIds)
        .toEqual(["FIRST", "ROOT"]);

      const deleted = value.service.deleteTask(
        value.authorization,
        5,
        second.taskId,
      );
      expect(deleted.data.tasks.find((task) => task.externalId === "ROOT"))
        .toMatchObject({ start: "2026-09-16", end: "2026-09-16", duration: 1 });
      expect(deleted.data.operation).toMatchObject({
        changedTaskExternalIds: ["ROOT"],
        deletedTaskExternalIds: ["SECOND"],
      });
      expect(() => value.service.deleteTask(
        value.authorization,
        6,
        first.taskId,
      )).toThrow(EmptySummaryNotAllowedError);
      expect(() => value.service.deleteTask(
        value.authorization,
        6,
        root.taskId,
      )).toThrow(SummaryTaskDeleteUnsupportedError);
      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(6);
    } finally {
      value.database.close();
    }
  });

  it("supports nested summary aggregation and keeps summary schedule fields readonly", async () => {
    const value = await fixture();
    try {
      const root = value.service.createTask(
        value.authorization,
        1,
        taskInput("ROOT"),
      ).data.tasks[0];
      const child = value.service.createTask(value.authorization, 2, {
        ...taskInput("CHILD"),
        parentTaskId: root.taskId,
        convertParentToSummary: true,
      }).data.tasks.find((task) => task.externalId === "CHILD")!;
      const nested = value.service.createTask(value.authorization, 3, {
        ...taskInput("GRANDCHILD", "2026-09-21", 2),
        parentTaskId: child.taskId,
        convertParentToSummary: true,
      });
      expect(nested.data.tasks.find((task) => task.externalId === "ROOT"))
        .toMatchObject({ type: "summary", start: "2026-09-21", end: "2026-09-22" });
      expect(nested.data.tasks.find((task) => task.externalId === "CHILD"))
        .toMatchObject({
          type: "summary",
          parentExternalId: "ROOT",
          start: "2026-09-21",
          end: "2026-09-22",
        });
      expect(nested.data.tasks.find((task) => task.externalId === "GRANDCHILD"))
        .toMatchObject({ parentExternalId: "CHILD" });

      expect(() => value.service.updateTask(
        value.authorization,
        4,
        root.taskId,
        { progress: 75 },
      )).toThrow(SummaryScheduleReadonlyError);
      const renamed = value.service.updateTask(
        value.authorization,
        4,
        root.taskId,
        { name: "Renamed summary" },
      );
      expect(renamed.data.tasks.find((task) => task.externalId === "ROOT")?.name)
        .toBe("Renamed summary");
    } finally {
      value.database.close();
    }
  });

  it("rejects milestone and cross-project parents without changing either aggregate", async () => {
    const value = await fixture();
    try {
      const milestone = value.service.createTask(value.authorization, 1, {
        externalId: "MILESTONE",
        name: "Milestone",
        type: "milestone",
        start: "2026-09-14",
        duration: 0,
        progress: 0,
      }).data.tasks[0];
      expect(() => value.service.createTask(value.authorization, 2, {
        ...taskInput("NOPE"),
        parentTaskId: milestone.taskId,
      })).toThrow(InvalidParentTaskError);

      const other = await value.service.create({
        name: "Other",
        description: "",
        editPassword: "Pass123456!",
      });
      const otherAuthorization = value.service.authorize(
        other.response.data.project.publicId,
        other.rawSessionToken,
      );
      if (otherAuthorization.kind !== "authorized") throw new Error("Expected auth.");
      const otherTask = value.service.createTask(
        otherAuthorization.authorization,
        1,
        taskInput("OTHER"),
      ).data.tasks[0];
      expect(() => value.service.createTask(value.authorization, 2, {
        ...taskInput("CROSS"),
        parentTaskId: otherTask.taskId,
      })).toThrow(TaskNotFoundError);
      expect(value.database.prepare("SELECT revision FROM projects ORDER BY id").pluck().all())
        .toEqual([2, 2]);
      expect(value.database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
    } finally {
      value.database.close();
    }
  });
});
