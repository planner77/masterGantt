import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { InvalidTaskInputError } from "../../../src/server/projects/project-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogInvalidInputError, ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-09-15T12:00:00.000Z";

describe("resource workload integrity", () => {
  it("rejects impossible dates and rolls back task reschedules that invalidate explicit allocation bounds", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const projectsRepo = new ProjectRepository(database);
      const sessions = new EditSessionRepository(database);
      const schedules = new ScheduleRepository(database);
      const project = projectsRepo.insert({
        publicId: randomUUID(),
        name: "Integrity fixture",
        description: "",
        passwordKdf: "scrypt",
        passwordSalt: Buffer.alloc(16, 1),
        passwordHash: Buffer.alloc(32, 2),
        scryptN: 32768,
        scryptR: 8,
        scryptP: 3,
        scryptKeyLength: 32,
        calendarTimezone: "Asia/Seoul",
        createdAt: NOW,
        updatedAt: NOW,
      });
      const token = createSessionToken();
      const sessionId = sessions.insert({
        projectId: project.id,
        tokenHash: token.tokenHash,
        authVersion: project.authVersion,
        createdAt: NOW,
        expiresAt: "2026-10-01T00:00:00.000Z",
      });
      const task = schedules.insertTask({
        projectId: project.id,
        externalId: randomUUID(),
        publicId: randomUUID(),
        name: "Long task",
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-02-02",
        startDate: "2026-02-02",
        endDate: "2026-03-06",
        duration: 25,
        progress: 0,
        parentId: null,
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const authorization = {
        projectId: project.id,
        projectPublicId: project.publicId,
        projectRevision: 1,
        projectAuthVersion: project.authVersion,
        sessionId,
        tokenHash: token.tokenHash,
        expiresAt: "2026-10-01T00:00:00.000Z",
      };

      const resources = new ResourceCatalogService(database, { clock: () => new Date(NOW) });
      const admin = resources.unlockAdmin("Admin123456!", "Admin123456!");
      if (!admin) throw new Error("admin session not created");
      const catalog = resources.createTarget("resource", admin.rawToken, 1, { name: "Resource" });
      const resource = catalog.data.resources[0];

      expect(() => resources.replaceTaskAssignments(authorization, 1, task.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, allocation: { start: "2026-02-30", end: "2026-03-02", percent: 50 } }],
      })).toThrow(ResourceCatalogInvalidInputError);

      const assigned = resources.replaceTaskAssignments(authorization, 1, task.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, allocation: { start: "2026-02-10", end: "2026-02-20", percent: 50 } }],
      });
      expect(assigned.data.projectRevision).toBe(2);

      const projects = new TaskFieldProjectService(database, { clock: () => new Date(NOW) });
      expect(() => projects.updateTask({ ...authorization, projectRevision: 2 }, 2, task.publicId, {
        start: "2026-02-23",
        duration: 5,
      })).toThrow(InvalidTaskInputError);

      const snapshot = projects.getReadonlySnapshot(project.publicId)!;
      expect(snapshot.data.project.revision).toBe(2);
      expect(snapshot.data.tasks[0]).toMatchObject({ start: "2026-02-02", end: "2026-03-06", duration: 25 });
      expect(snapshot.data.assignments?.[0]).toMatchObject({
        taskId: task.publicId,
        allocation: { start: "2026-02-10", end: "2026-02-20", percent: 50 },
      });
    } finally {
      database.close();
    }
  });
});
