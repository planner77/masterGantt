import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";

const migrations = join(process.cwd(), "db", "migrations");
const timestamp = "2026-09-11T01:00:00.000Z";

function insertProject(projects: ProjectRepository, name: string): number {
  return projects.insert({
    publicId: randomUUID(),
    name,
    description: "",
    passwordKdf: "scrypt",
    passwordSalt: Buffer.alloc(16, 1),
    passwordHash: Buffer.alloc(32, 2),
    scryptN: 32_768,
    scryptR: 8,
    scryptP: 3,
    scryptKeyLength: 32,
    calendarTimezone: "Asia/Seoul",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).id;
}

function insertTask(schedule: ScheduleRepository, projectId: number, externalId: string) {
  return schedule.insertTask({
    projectId,
    externalId,
    publicId: randomUUID(),
    name: externalId,
    type: "task",
    scheduleMode: "auto",
    requestedStart: "2026-09-11",
    startDate: "2026-09-11",
    endDate: "2026-09-11",
    duration: 1,
    progress: 0,
    parentId: null,
    sortOrder: schedule.nextRootSortOrder(projectId),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

describe("W07 ScheduleRepository writes", () => {
  it("keeps Task CRUD parameter-bound and scoped to a Project", () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
    try {
      const projects = new ProjectRepository(database);
      const schedule = new ScheduleRepository(database);
      const firstProject = insertProject(projects, "First");
      const secondProject = insertProject(projects, "Second");
      const task = insertTask(schedule, firstProject, "A'); DELETE FROM tasks; --");
      const other = insertTask(schedule, secondProject, "OTHER");

      expect(schedule.countTasks(firstProject)).toBe(1);
      expect(schedule.findTaskByExternalId(firstProject, task.externalId)?.id).toBe(task.id);
      expect(schedule.findTaskByPublicId(firstProject, other.publicId)).toBeUndefined();
      expect(schedule.updateTask(secondProject, task.publicId, {
        name: "No",
        type: "task",
        scheduleMode: "manual",
        requestedStart: "2026-09-12",
        startDate: "2026-09-12",
        endDate: "2026-09-12",
        duration: 1,
        progress: 10,
        updatedAt: timestamp,
      })).toBeUndefined();
      expect(schedule.deleteTask(secondProject, task.publicId)).toBe(false);
      expect(schedule.findTaskByPublicId(firstProject, task.publicId)?.name).toBe(task.name);
      expect(database.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(2);
    } finally {
      database.close();
    }
  });

  it("provides scoped Link CRUD while DB constraints reject cross-project, self, and duplicate edges", () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
    try {
      const projects = new ProjectRepository(database);
      const schedule = new ScheduleRepository(database);
      const firstProject = insertProject(projects, "First");
      const secondProject = insertProject(projects, "Second");
      const predecessor = insertTask(schedule, firstProject, "A");
      const successor = insertTask(schedule, firstProject, "B");
      const foreign = insertTask(schedule, secondProject, "C");
      const link = schedule.insertLink({
        publicId: randomUUID(),
        projectId: firstProject,
        predecessorTaskId: predecessor.id,
        successorTaskId: successor.id,
        type: "FS",
        lag: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      expect(schedule.findLinkByPublicId(firstProject, link.publicId)?.id).toBe(link.id);
      expect(schedule.findLinkByPublicId(secondProject, link.publicId)).toBeUndefined();
      expect(schedule.listIncidentLinks(firstProject, predecessor.id)).toEqual([link]);
      expect(() => schedule.insertLink({
        publicId: randomUUID(),
        projectId: firstProject,
        predecessorTaskId: predecessor.id,
        successorTaskId: successor.id,
        type: "FS",
        lag: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }))
        .toThrow(/UNIQUE constraint/);
      expect(() => schedule.insertLink({
        ...link,
        publicId: randomUUID(),
        predecessorTaskId: predecessor.id,
        successorTaskId: predecessor.id,
      })).toThrow(/CHECK constraint/);
      expect(() => schedule.insertLink({
        ...link,
        publicId: randomUUID(),
        successorTaskId: foreign.id,
      })).toThrow(/FOREIGN KEY constraint/);
      expect(schedule.deleteLink(secondProject, link.publicId)).toBe(false);
      expect(schedule.deleteLink(firstProject, link.publicId)).toBe(true);
    } finally {
      database.close();
    }
  });

  it("rolls Link writes back with their enclosing aggregate transaction", () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
    try {
      const projects = new ProjectRepository(database);
      const schedule = new ScheduleRepository(database);
      const projectId = insertProject(projects, "Project");
      const predecessor = insertTask(schedule, projectId, "A");
      const successor = insertTask(schedule, projectId, "B");
      const write = database.transaction(() => {
        schedule.insertLink({
          publicId: randomUUID(),
          projectId,
          predecessorTaskId: predecessor.id,
          successorTaskId: successor.id,
          type: "FS",
          lag: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        throw new Error("fault");
      });
      expect(() => write.immediate()).toThrow("fault");
      expect(schedule.listLinks(projectId)).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("updates Links only within Project scope and reports missing rows", () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
    try {
      const projects = new ProjectRepository(database);
      const schedule = new ScheduleRepository(database);
      const firstProject = insertProject(projects, "First");
      const secondProject = insertProject(projects, "Second");
      const first = insertTask(schedule, firstProject, "A");
      const second = insertTask(schedule, firstProject, "B");
      const third = insertTask(schedule, firstProject, "C");
      const link = schedule.insertLink({
        publicId: randomUUID(),
        projectId: firstProject,
        predecessorTaskId: first.id,
        successorTaskId: second.id,
        type: "FS",
        lag: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const updatedAt = "2026-09-11T02:00:00.000Z";
      expect(schedule.updateLink(firstProject, link.publicId, {
        predecessorTaskId: first.id,
        successorTaskId: third.id,
        type: "FS",
        lag: 0,
        updatedAt,
      })).toMatchObject({
        id: link.id,
        projectId: firstProject,
        predecessorTaskId: first.id,
        successorTaskId: third.id,
        updatedAt,
      });
      expect(schedule.updateLink(secondProject, link.publicId, {
        predecessorTaskId: first.id,
        successorTaskId: second.id,
        type: "FS",
        lag: 0,
        updatedAt,
      })).toBeUndefined();
      expect(schedule.updateLink(firstProject, randomUUID(), {
        predecessorTaskId: first.id,
        successorTaskId: second.id,
        type: "FS",
        lag: 0,
        updatedAt,
      })).toBeUndefined();
    } finally {
      database.close();
    }
  });

  it("rolls an enclosing transaction back when a Link update violates a constraint", () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: migrations }).database;
    try {
      const projects = new ProjectRepository(database);
      const schedule = new ScheduleRepository(database);
      const projectId = insertProject(projects, "Project");
      const first = insertTask(schedule, projectId, "A");
      const second = insertTask(schedule, projectId, "B");
      const link = schedule.insertLink({
        publicId: randomUUID(),
        projectId,
        predecessorTaskId: first.id,
        successorTaskId: second.id,
        type: "FS",
        lag: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const update = database.transaction(() => {
        database.prepare("UPDATE tasks SET name = 'Must rollback' WHERE id = ?").run(first.id);
        schedule.updateLink(projectId, link.publicId, {
          predecessorTaskId: first.id,
          successorTaskId: first.id,
          type: "FS",
          lag: 0,
          updatedAt: "2026-09-11T03:00:00.000Z",
        });
      });
      expect(() => update.immediate()).toThrow(/CHECK constraint/);
      expect(schedule.findTaskByPublicId(projectId, first.publicId)?.name).toBe("A");
      expect(schedule.findLinkByPublicId(projectId, link.publicId)).toEqual(link);
    } finally {
      database.close();
    }
  });
});
