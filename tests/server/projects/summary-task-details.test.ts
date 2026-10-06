import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { SummaryScheduleReadonlyError } from "../../../src/server/projects/project-service-core";
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
  it("persists Description/URL across derived schedule changes while schedule fields stay readonly", async () => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
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
        url: "https://example.test/summary",
      });
      expect(detailed.data.project.revision).toBe(3);
      expect(detailed.data.tasks.find((task) => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄",
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
        url: "https://example.test/summary",
        requestedStart: null,
        start: null,
        end: null,
        duration: null,
        progress: null,
      });
      expect(service.getReadonlySnapshot(created.response.data.project.publicId)?.data.tasks.find((task) => task.taskId === summary.taskId)).toMatchObject({
        description: "첫 줄\n둘째 줄",
        url: "https://example.test/summary",
      });

      expect(() => service.updateTask(authorization, 5, summary.taskId, { progress: 50 }))
        .toThrow(SummaryScheduleReadonlyError);
      expect(service.getReadonlySnapshot(created.response.data.project.publicId)?.data.project.revision).toBe(5);
    } finally {
      database.close();
    }
  });
});
