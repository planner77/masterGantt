import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import type { ReplaceProjectWorkCalendarRequest } from "../../../src/contracts/work-calendar";
import {
  WorkCalendarManualConflictError,
  WorkCalendarService,
} from "../../../src/server/calendars/work-calendar-service-core";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const now = new Date("2026-09-19T01:00:00.000Z");

function fixedPasswordHash(): PasswordHashRecord {
  return {
    algorithm: "scrypt",
    salt: Buffer.alloc(16, 1),
    hash: Buffer.alloc(32, 2),
    n: 32_768,
    r: 8,
    p: 3,
    keyLength: 32,
  };
}

async function fixture() {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  const projectService = new ProjectService(database, {
    clock: () => now,
    hashPassword: async () => fixedPasswordHash(),
  });
  const created = await projectService.create({
    name: "Calendar dependency",
    description: "",
    editPassword: "Pass123456!",
  });
  const result = projectService.authorize(
    created.response.data.project.publicId,
    created.rawSessionToken,
  );
  if (result.kind !== "authorized") throw new Error("Expected edit authorization.");
  const projectId = database.prepare("SELECT id FROM projects WHERE public_id = ?")
    .pluck().get(created.response.data.project.publicId) as number;
  return {
    database,
    projectId,
    projectPublicId: created.response.data.project.publicId,
    authorization: result.authorization,
    calendarService: new WorkCalendarService(database, { clock: () => now }),
  };
}

interface TaskSeed {
  externalId: string;
  type?: "task" | "summary" | "milestone";
  scheduleMode?: "auto" | "manual";
  requestedStart?: string | null;
  start: string;
  end: string;
  duration: number;
  progress?: number;
  parentId?: number | null;
  sortOrder?: number;
}

function insertTask(database: Database.Database, projectId: number, seed: TaskSeed): number {
  const type = seed.type ?? "task";
  const scheduleMode = seed.scheduleMode ?? "auto";
  const requestedStart = type === "summary" ? null : (seed.requestedStart ?? seed.start);
  const result = database.prepare(
    `INSERT INTO tasks (
      project_id, external_id, public_id, name, type, schedule_mode,
      requested_start, start_date, end_date, duration, progress,
      parent_id, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    projectId,
    seed.externalId,
    randomUUID(),
    seed.externalId,
    type,
    scheduleMode,
    requestedStart,
    seed.start,
    seed.end,
    seed.duration,
    seed.progress ?? 0,
    seed.parentId ?? null,
    seed.sortOrder ?? 0,
    now.toISOString(),
    now.toISOString(),
  );
  return Number(result.lastInsertRowid);
}

function insertLink(
  database: Database.Database,
  projectId: number,
  predecessorTaskId: number,
  successorTaskId: number,
): void {
  database.prepare(
    `INSERT INTO links (
      public_id, project_id, predecessor_task_id, successor_task_id,
      type, lag, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'FS', 0, ?, ?)`,
  ).run(
    randomUUID(),
    projectId,
    predecessorTaskId,
    successorTaskId,
    now.toISOString(),
    now.toISOString(),
  );
}

const candidate = {
  countryRules: [],
  customDates: [{
    name: "Plant holiday",
    date: "2026-09-08",
    targetType: "PROJECT",
    targetId: null,
  }],
} satisfies ReplaceProjectWorkCalendarRequest;

function byExternalId<T extends { externalId: string }>(items: readonly T[], id: string): T {
  const match = items.find((item) => item.externalId === id);
  if (!match) throw new Error(`Missing fixture item ${id}`);
  return match;
}

describe("Issue #68 calendar + dependency recalculation", () => {
  it("previews and atomically persists Calendar -> FS -> Summary with explicit reasons", async () => {
    const { database, projectId, projectPublicId, authorization, calendarService } = await fixture();
    try {
      const summary = insertTask(database, projectId, {
        externalId: "S",
        type: "summary",
        requestedStart: null,
        start: "2026-09-07",
        end: "2026-09-09",
        duration: 3,
        progress: 200 / 3,
      });
      const predecessor = insertTask(database, projectId, {
        externalId: "A",
        requestedStart: "2026-09-07",
        start: "2026-09-07",
        end: "2026-09-08",
        duration: 2,
        progress: 100,
        parentId: summary,
        sortOrder: 0,
      });
      const successor = insertTask(database, projectId, {
        externalId: "B",
        requestedStart: "2026-09-07",
        start: "2026-09-09",
        end: "2026-09-09",
        duration: 1,
        progress: 0,
        parentId: summary,
        sortOrder: 1,
      });
      insertLink(database, projectId, predecessor, successor);

      const preview = calendarService.preview(projectPublicId, candidate);
      expect(byExternalId(preview.data.changedTasks, "A")).toMatchObject({
        beforeEnd: "2026-09-08",
        afterEnd: "2026-09-09",
        reasons: ["CALENDAR"],
        dependencyPredecessorExternalIds: [],
      });
      expect(byExternalId(preview.data.changedTasks, "B")).toMatchObject({
        beforeStart: "2026-09-09",
        afterStart: "2026-09-10",
        reasons: ["DEPENDENCY"],
        dependencyPredecessorExternalIds: ["A"],
      });
      expect(byExternalId(preview.data.changedTasks, "S")).toMatchObject({
        afterStart: "2026-09-07",
        afterEnd: "2026-09-10",
        reasons: ["SUMMARY"],
      });
      expect(preview.data.manualConflicts).toEqual([]);
      expect(database.prepare("SELECT revision FROM projects WHERE id = ?").pluck().get(projectId)).toBe(1);

      const saved = calendarService.replace(authorization, 1, candidate);
      expect(saved.data.projectRevision).toBe(2);
      expect(database.prepare("SELECT revision FROM projects WHERE id = ?").pluck().get(projectId)).toBe(2);
      const rows = database.prepare(
        "SELECT external_id, start_date, end_date, duration FROM tasks WHERE project_id = ? ORDER BY id",
      ).all(projectId) as Array<{ external_id: string; start_date: string; end_date: string; duration: number }>;
      expect(rows).toEqual([
        { external_id: "S", start_date: "2026-09-07", end_date: "2026-09-10", duration: 3 },
        { external_id: "A", start_date: "2026-09-07", end_date: "2026-09-09", duration: 2 },
        { external_id: "B", start_date: "2026-09-10", end_date: "2026-09-10", duration: 1 },
      ]);
      expect(calendarService.get(projectPublicId)?.data.projectDates).toEqual([
        expect.objectContaining({ date: "2026-09-08", dayType: "NON_WORKING" }),
      ]);
    } finally {
      database.close();
    }
  });

  it("returns a dependency-specific Manual conflict and rolls the complete mutation back", async () => {
    const { database, projectId, projectPublicId, authorization, calendarService } = await fixture();
    try {
      const predecessor = insertTask(database, projectId, {
        externalId: "A",
        requestedStart: "2026-09-07",
        start: "2026-09-07",
        end: "2026-09-08",
        duration: 2,
      });
      const successor = insertTask(database, projectId, {
        externalId: "B",
        scheduleMode: "manual",
        requestedStart: "2026-09-09",
        start: "2026-09-09",
        end: "2026-09-09",
        duration: 1,
      });
      insertLink(database, projectId, predecessor, successor);
      const beforeCalendar = calendarService.get(projectPublicId);

      const preview = calendarService.preview(projectPublicId, candidate);
      expect(preview.data.manualConflicts).toEqual([expect.objectContaining({
        externalId: "B",
        reason: "DEPENDENCY",
        date: "2026-09-10",
        predecessorExternalIds: ["A"],
      })]);

      expect(() => calendarService.replace(authorization, 1, candidate))
        .toThrow(WorkCalendarManualConflictError);
      expect(database.prepare("SELECT revision FROM projects WHERE id = ?").pluck().get(projectId)).toBe(1);
      expect(database.prepare(
        "SELECT start_date, end_date FROM tasks WHERE external_id = 'B'",
      ).get()).toEqual({ start_date: "2026-09-09", end_date: "2026-09-09" });
      expect(calendarService.get(projectPublicId)).toEqual(beforeCalendar);
    } finally {
      database.close();
    }
  });
});
