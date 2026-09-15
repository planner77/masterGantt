import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-09-15T12:00:00.000Z";
const EXPIRES_AT = "2026-09-16T00:00:00.000Z";

function createFixture() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
  const projects = new ProjectRepository(database);
  const sessions = new EditSessionRepository(database);
  const schedules = new ScheduleRepository(database);
  const project = projects.insert({
    publicId: randomUUID(),
    name: "Canonical assignment fixture",
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
    expiresAt: EXPIRES_AT,
  });
  const task = schedules.insertTask({
    projectId: project.id,
    externalId: randomUUID(),
    publicId: randomUUID(),
    name: "Assigned task",
    type: "task",
    scheduleMode: "auto",
    requestedStart: "2026-09-15",
    startDate: "2026-09-15",
    endDate: "2026-09-15",
    duration: 1,
    progress: 0,
    parentId: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const authorization = {
    projectId: project.id,
    projectPublicId: project.publicId,
    projectRevision: project.revision,
    projectAuthVersion: project.authVersion,
    sessionId,
    tokenHash: token.tokenHash,
    expiresAt: EXPIRES_AT,
  };
  return { database, project, task, authorization };
}

describe("resource assignment canonical Project aggregate", () => {
  it("keeps assignment references in readonly and later task mutation snapshots", () => {
    const fixture = createFixture();
    try {
      const clock = () => new Date(NOW);
      const resources = new ResourceCatalogService(fixture.database, { clock });
      const projects = new TaskFieldProjectService(fixture.database, { clock });
      const admin = resources.unlockAdmin(
        "correct-resource-admin-password",
        "correct-resource-admin-password",
      );
      if (!admin) throw new Error("admin session not created");

      const catalog = resources.createTarget("resource", admin.rawToken, 1, {
        name: "담당자 A",
        code: "R-001",
      });
      const resource = catalog.data.resources[0];
      expect(resource).toBeDefined();

      const mutation = resources.replaceTaskAssignments(
        fixture.authorization,
        1,
        fixture.task.publicId,
        {
          catalogRevision: catalog.data.revision,
          targets: [{ kind: "resource", id: resource.id }],
        },
      );
      expect(mutation.data.projectRevision).toBe(2);

      const snapshot = projects.getReadonlySnapshot(fixture.project.publicId);
      expect(snapshot?.data.project.revision).toBe(2);
      expect(snapshot?.data.assignments).toEqual([
        expect.objectContaining({
          taskId: fixture.task.publicId,
          target: { kind: "resource", id: resource.id },
        }),
      ]);

      const taskMutation = projects.updateTask(
        { ...fixture.authorization, projectRevision: 2 },
        2,
        fixture.task.publicId,
        { name: "Renamed assigned task" },
      );
      expect(taskMutation.data.project.revision).toBe(3);
      expect(taskMutation.data.assignments).toEqual(snapshot?.data.assignments);
      expect(taskMutation.data.tasks).toEqual([
        expect.objectContaining({
          taskId: fixture.task.publicId,
          name: "Renamed assigned task",
        }),
      ]);
    } finally {
      fixture.database.close();
    }
  });
});
