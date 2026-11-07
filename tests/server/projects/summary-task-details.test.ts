import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import type { UpdateTaskRequest } from "../../../src/contracts/projects";
import { InvalidTaskInputError, SummaryScheduleReadonlyError } from "../../../src/server/projects/project-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const now = new Date("2026-10-06T12:00:00.000Z");

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

describe("Issue #493 Summary task details", () => {
  it.each(["plain", "markdown"] as const)("persists %s Description/URL across derived schedule changes and SQLite reopen while schedule fields stay readonly", async (format) => {
    const directory = mkdtempSync(join(tmpdir(), "summary-task-details-"));
    const filename = join(directory, "summary.sqlite3");
    const database = openDatabase({ filename, migrationsDirectory }).database;
    try {
      const service = new TaskFieldProjectService(database, {
        clock: () => now,
        hashPassword: async () => fixedPasswordHash(),
      });
      const created = await service.create({
        name: "Summary details",
        description: "",
        ownerName: "owner",
        editPassword: "EditPwd1234!",
      });
      const authorized = service.authorize(created.response.data.project.publicId, created.rawSessionToken);
      if (authorized.kind !== "authorized") throw new Error("Expected authorized edit session.");
      const authorization = authorized.authorization;

      const summaryCreated = service.createTask(authorization, 1, {
        name: "Summary",
        externalId: "SUMMARY",
        type: "summary",
      });
      const summary = summaryCreated.data.tasks.find((task) => task.externalId === "SUMMARY")!;

      const detailed = service.updateTask(authorization, 2, summary.taskId, {
        description: "첫 줄\n둘째 줄",
        ...(format === "markdown" ? { descriptionFormat: format } : {}),
        url: "https://example.test/summary",
      });
      expect(detailed.data.project.revision).toBe(3);
      expect(detailed.data.tasks.find((task) => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄",
        descriptionFormat: format,
        url: "https://example.test/summary",
        requestedStart: null,
        start: null,
        end: null,
        duration: null,
        progress: null,
      });

      const withChild = service.createTask(authorization, 3, {
        name: "Child",
        externalId: "CHILD",
        type: "task",
        parentTaskId: summary.taskId,
        start: "2026-10-06",
        duration: 2,
        progress: 25,
      });
      const child = withChild.data.tasks.find((task) => task.externalId === "CHILD")!;
      expect(withChild.data.tasks.find((task) => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄",
        descriptionFormat: format,
        url: "https://example.test/summary",
        requestedStart: null,
        start: "2026-10-06",
        end: "2026-10-07",
        duration: 2,
        progress: 25,
      });

      const emptied = service.deleteTask(authorization, 4, child.taskId);
      expect(emptied.data.tasks.find((task) => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄",
        descriptionFormat: format,
        url: "https://example.test/summary",
        requestedStart: null,
        start: null,
        end: null,
        duration: null,
        progress: null,
      });
      expect(service.getReadonlySnapshot(created.response.data.project.publicId)?.data.tasks.find((task) => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄",
        descriptionFormat: format,
        url: "https://example.test/summary",
      });

      expect(() => service.updateTask(authorization, 5, summary.taskId, { progress: 50 }))
        .toThrow(SummaryScheduleReadonlyError);
      expect(service.getReadonlySnapshot(created.response.data.project.publicId)?.data.project.revision).toBe(5);

      const originalRow = database.prepare("SELECT * FROM tasks WHERE public_id = ?").get(summary.taskId);
      const blocked: UpdateTaskRequest[] = [
        { start: "2026-10-06" }, { duration: 2 }, { scheduleMode: "manual" },
        { status: "completed" }, { baseline: null }, { baselineStart: null },
        { baselineDuration: null }, { baselineEnd: null },
        { start: "2026-10-06", description: "**차단**", descriptionFormat: "markdown" },
      ];
      for (const patch of blocked) {
        expect(() => service.updateTask(authorization, 5, summary.taskId, patch))
          .toThrow(SummaryScheduleReadonlyError);
        expect(database.prepare("SELECT * FROM tasks WHERE public_id = ?").get(summary.taskId)).toEqual(originalRow);
        expect(service.getReadonlySnapshot(created.response.data.project.publicId)?.data.project.revision).toBe(5);
      }
      for (const patch of [
        { descriptionFormat: "markdown" as const },
        { description: "<script>unsafe</script>", descriptionFormat: "markdown" as const },
      ]) {
        expect(() => service.updateTask(authorization, 5, summary.taskId, patch)).toThrow(InvalidTaskInputError);
        expect(database.prepare("SELECT * FROM tasks WHERE public_id = ?").get(summary.taskId)).toEqual(originalRow);
        expect(service.getReadonlySnapshot(created.response.data.project.publicId)?.data.project.revision).toBe(5);
      }

      // An older caller resubmitting unchanged text must not downgrade Markdown.
      const unchanged = service.updateTask(authorization, 5, summary.taskId, { description: "첫 줄\n둘째 줄" });
      expect(unchanged.data.project.revision).toBe(6);
      expect(unchanged.data.tasks.find(task => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄", descriptionFormat: format,
      });
      const plain = service.updateTask(authorization, 6, summary.taskId, {
        description: "첫 줄\n둘째 줄", descriptionFormat: "plain",
      });
      expect(plain.data.project.revision).toBe(7);
      expect(plain.data.tasks.find(task => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄", descriptionFormat: "plain", url: "https://example.test/summary",
        requestedStart: null, start: null, end: null, duration: null, progress: null,
      });
      let finalRevision = 7;
      if (format === "markdown") {
        const restored = service.updateTask(authorization, 7, summary.taskId, {
          description: "첫 줄\n둘째 줄", descriptionFormat: "markdown",
        });
        finalRevision = 8;
        expect(restored.data.project.revision).toBe(finalRevision);
        expect(restored.data.tasks.find(task => task.taskId === summary.taskId)?.descriptionFormat).toBe(format);
      }
      database.close();
      const reopened = openDatabase({ filename, migrationsDirectory }).database;
      try {
        const reloaded = new TaskFieldProjectService(reopened).getReadonlySnapshot(created.response.data.project.publicId);
        expect(reloaded?.data.project.revision).toBe(finalRevision);
        expect(reloaded?.data.tasks.find(task => task.taskId === summary.taskId)).toMatchObject({
          description: "첫 줄\n둘째 줄", descriptionFormat: format, url: "https://example.test/summary",
          requestedStart: null, start: null, end: null, duration: null, progress: null,
        });
        expect(reopened.pragma("foreign_key_check")).toEqual([]);
      } finally { reopened.close(); }
    } finally {
      if (database.open) database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
