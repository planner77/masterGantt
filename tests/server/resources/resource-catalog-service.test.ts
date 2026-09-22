import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository, EditSessionRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogService, ResourceCatalogRevisionMismatchError } from "../../../src/server/resources/resource-catalog-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");

function createProjectFixture() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
  const now = "2026-09-15T12:00:00.000Z";
  const projects = new ProjectRepository(database);
  const sessions = new EditSessionRepository(database);
  const schedules = new ScheduleRepository(database);
  const project = projects.insert({
    publicId: randomUUID(),
    name: "Resource fixture",
    description: "",
    passwordKdf: "scrypt",
    passwordSalt: Buffer.alloc(16, 1),
    passwordHash: Buffer.alloc(32, 2),
    scryptN: 32768,
    scryptR: 8,
    scryptP: 3,
    scryptKeyLength: 32,
    calendarTimezone: "Asia/Seoul",
    createdAt: now,
    updatedAt: now,
  });
  const token = createSessionToken();
  const sessionId = sessions.insert({
    projectId: project.id,
    tokenHash: token.tokenHash,
    authVersion: project.authVersion,
    createdAt: now,
    expiresAt: "2026-09-16T00:00:00.000Z",
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
    createdAt: now,
    updatedAt: now,
  });
  return {
    database,
    project,
    task,
    authorization: {
      projectId: project.id,
      projectPublicId: project.publicId,
      projectRevision: project.revision,
      projectAuthVersion: project.authVersion,
      sessionId,
      tokenHash: token.tokenHash,
      expiresAt: "2026-09-16T00:00:00.000Z",
    },
  };
}

describe("ResourceCatalogService", () => {
  it("keeps global administration separate from project edit authorization", () => {
    const fixture = createProjectFixture();
    try {
      const service = new ResourceCatalogService(fixture.database, {
        clock: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      expect(service.unlockAdmin("Wrong123456!", "Admin123456!")).toBeUndefined();
      const admin = service.unlockAdmin("Admin123456!", "Admin123456!");
      expect(admin).toBeDefined();
      expect(service.authorizeAdmin(admin?.rawToken)).toMatchObject({ expiresAt: "2026-09-15T20:00:00.000Z" });
    } finally {
      fixture.database.close();
    }
  });

  it("creates resources/groups, replaces members and assigns both kinds atomically", () => {
    const fixture = createProjectFixture();
    try {
      const service = new ResourceCatalogService(fixture.database, {
        clock: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      const admin = service.unlockAdmin("Admin123456!", "Admin123456!");
      if (!admin) throw new Error("admin session not created");

      let catalog = service.createTarget("resource", admin.rawToken, 1, { name: "홍길동", code: "R-001" });
      expect(catalog.data.revision).toBe(2);
      const resource = catalog.data.resources[0];
      catalog = service.createTarget("group", admin.rawToken, 2, { name: "설비제어팀", code: "G-001" });
      const group = catalog.data.groups[0];
      catalog = service.replaceGroupMembers(group.id, admin.rawToken, 3, { resourceIds: [resource.id] });
      expect(catalog.data.revision).toBe(4);
      expect(catalog.data.groups[0].memberResourceIds).toEqual([resource.id]);

      const candidates = service.searchTargets(fixture.authorization, undefined, undefined);
      expect(candidates.data.catalogRevision).toBe(4);
      expect(candidates.data.targets.map((target) => target.kind).sort()).toEqual(["group", "resource"]);

      const changed = service.replaceTaskAssignments(fixture.authorization, 1, fixture.task.publicId, {
        catalogRevision: 4,
        targets: [
          { kind: "resource", id: resource.id },
          { kind: "group", id: group.id },
        ],
      });
      expect(changed.data.projectRevision).toBe(2);
      expect(changed.data.assignments).toHaveLength(2);
      expect(changed.data.operation.changed).toBe(true);

      const currentAuthorization = { ...fixture.authorization, projectRevision: 2 };
      const noOp = service.replaceTaskAssignments(currentAuthorization, 2, fixture.task.publicId, {
        catalogRevision: 4,
        targets: [
          { kind: "group", id: group.id },
          { kind: "resource", id: resource.id },
        ],
      });
      expect(noOp.data.projectRevision).toBe(2);
      expect(noOp.data.operation.changed).toBe(false);

      const display = service.getAssignedTargets(fixture.project.publicId);
      expect(display?.data.targets).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "resource", name: "홍길동" }),
        expect.objectContaining({ kind: "group", name: "설비제어팀" }),
      ]));
    } finally {
      fixture.database.close();
    }
  });

  it("rejects stale catalog revisions", () => {
    const fixture = createProjectFixture();
    try {
      const service = new ResourceCatalogService(fixture.database, {
        clock: () => new Date("2026-09-15T12:00:00.000Z"),
      });
      const admin = service.unlockAdmin("Admin123456!", "Admin123456!");
      if (!admin) throw new Error("admin session not created");
      service.createTarget("resource", admin.rawToken, 1, { name: "Resource A" });
      expect(() => service.createTarget("group", admin.rawToken, 1, { name: "Stale group" }))
        .toThrow(ResourceCatalogRevisionMismatchError);
    } finally {
      fixture.database.close();
    }
  });
});
