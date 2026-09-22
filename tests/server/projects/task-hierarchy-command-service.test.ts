import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import {
  TaskHierarchyNoopError,
  TaskHierarchyService,
} from "../../../src/server/projects/task-hierarchy-service-core";

const migrations = join(process.cwd(), "db", "migrations");
const now = new Date("2026-09-21T01:00:00.000Z");

function hash() {
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
  const projects = new ProjectService(database, {
    clock: () => now,
    hashPassword: async () => hash(),
  });
  const hierarchy = new TaskHierarchyService(database, { clock: () => now });
  const created = await projects.create({
    name: "Hierarchy command",
    description: "",
    editPassword: "Pass123456!",
  });
  const result = projects.authorize(created.response.data.project.publicId, created.rawSessionToken);
  if (result.kind !== "authorized") throw new Error("expected authorization");
  return { database, projects, hierarchy, authorization: result.authorization };
}

function input(externalId: string) {
  return {
    externalId,
    name: externalId,
    type: "task" as const,
    start: "2026-09-21",
    duration: 1,
    progress: 0,
  };
}

describe("TaskHierarchyService", () => {
  it("moves siblings and increments revision exactly once", async () => {
    const value = await fixture();
    try {
      const first = value.projects.createTask(value.authorization, 1, input("A")).data.tasks[0];
      value.projects.createTask(value.authorization, 2, input("B"));
      const third = value.projects.createTask(value.authorization, 3, input("C")).data.tasks.find((task) => task.externalId === "C")!;

      const moved = value.hierarchy.execute(value.authorization, 4, {
        kind: "move",
        taskId: third.taskId,
        direction: "up",
      });

      expect(moved.data.project.revision).toBe(5);
      expect(moved.data.operation).toMatchObject({ kind: "taskHierarchy", command: "move" });
      expect(moved.data.tasks
        .filter((task) => task.parentExternalId === null)
        .sort((a, b) => a.siblingOrder - b.siblingOrder)
        .map((task) => task.externalId)).toEqual(["A", "C", "B"]);
      expect(first.externalId).toBe("A");
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(5);
    } finally {
      value.database.close();
    }
  });

  it("indents under the previous sibling, converting that leaf to a summary atomically", async () => {
    const value = await fixture();
    try {
      const first = value.projects.createTask(value.authorization, 1, input("A")).data.tasks[0];
      const second = value.projects.createTask(value.authorization, 2, input("B")).data.tasks.find((task) => task.externalId === "B")!;

      const indented = value.hierarchy.execute(value.authorization, 3, {
        kind: "indent",
        taskId: second.taskId,
      });

      expect(indented.data.project.revision).toBe(4);
      expect(indented.data.tasks.find((task) => task.taskId === first.taskId)).toMatchObject({
        type: "summary",
        requestedStart: null,
      });
      expect(indented.data.tasks.find((task) => task.taskId === second.taskId)).toMatchObject({
        parentExternalId: "A",
        siblingOrder: 0,
      });
    } finally {
      value.database.close();
    }
  });

  it("copies a subtree with new identities while preserving its shape", async () => {
    const value = await fixture();
    try {
      const root = value.projects.createTask(value.authorization, 1, input("A")).data.tasks[0];
      value.projects.createTask(value.authorization, 2, {
        ...input("A1"),
        parentTaskId: root.taskId,
        convertParentToSummary: true,
      });
      const other = value.projects.createTask(value.authorization, 3, input("B")).data.tasks.find((task) => task.externalId === "B")!;

      const copied = value.hierarchy.execute(value.authorization, 4, {
        kind: "copy",
        taskId: root.taskId,
        anchorTaskId: other.taskId,
        placement: "after",
      });

      expect(copied.data.project.revision).toBe(5);
      expect(copied.data.tasks).toHaveLength(5);
      const roots = copied.data.tasks.filter((task) => task.parentExternalId === null);
      expect(roots).toHaveLength(3);
      const copiedRoot = roots.find((task) => task.externalId !== "A" && task.externalId !== "B");
      expect(copiedRoot).toBeDefined();
      expect(copied.data.tasks.filter((task) => task.parentExternalId === copiedRoot!.externalId)).toHaveLength(1);
    } finally {
      value.database.close();
    }
  });

  it("rejects unavailable boundary moves without revision changes", async () => {
    const value = await fixture();
    try {
      const first = value.projects.createTask(value.authorization, 1, input("A")).data.tasks[0];
      expect(() => value.hierarchy.execute(value.authorization, 2, {
        kind: "move",
        taskId: first.taskId,
        direction: "up",
      })).toThrow(TaskHierarchyNoopError);
      expect(value.database.prepare("SELECT revision FROM projects").pluck().get()).toBe(2);
    } finally {
      value.database.close();
    }
  });
});
