import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import {
  ResourceCatalogAssignmentRoleInvalidError,
  ResourceCatalogRoleInUseError,
  ResourceCatalogService,
} from "../../../src/server/resources/resource-catalog-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-10-04T12:00:00.000Z";

describe("Issue #413 task assignment roles", () => {
  it("persists a per-task role, rejects roles the Resource does not hold, and blocks removal while in use", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const projects = new ProjectRepository(database);
      const sessions = new EditSessionRepository(database);
      const schedules = new ScheduleRepository(database);
      const project = projects.insert({
        publicId: randomUUID(),
        name: "Assignment role fixture",
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
        expiresAt: "2026-11-01T00:00:00.000Z",
      });
      const makeTask = (name: string, order: number) => schedules.insertTask({
        projectId: project.id,
        externalId: randomUUID(),
        publicId: randomUUID(),
        name,
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-10-05",
        startDate: "2026-10-05",
        endDate: "2026-10-09",
        duration: 5,
        progress: 0,
        parentId: null,
        sortOrder: order,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const piTask = makeTask("PI task", 0);
      const devTask = makeTask("Developer task", 1);
      const authorization = {
        projectId: project.id,
        projectPublicId: project.publicId,
        projectRevision: 1,
        projectAuthVersion: project.authVersion,
        sessionId,
        tokenHash: token.tokenHash,
        expiresAt: "2026-11-01T00:00:00.000Z",
      };

      const service = new ResourceCatalogService(database, { clock: () => new Date(NOW) });
      const admin = service.unlockAdmin("Admin123456!", "Admin123456!");
      if (!admin) throw new Error("admin session not created");
      const catalog = service.createTarget("resource", admin.rawToken, 1, {
        name: "Multi role",
        roles: ["PI", "DEVELOPER"],
      });
      const resource = catalog.data.resources[0];

      const first = service.replaceTaskAssignments(authorization, 1, piTask.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, role: "PI" }],
      });
      const second = service.replaceTaskAssignments({ ...authorization, projectRevision: 2 }, 2, devTask.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, role: "DEVELOPER" }],
      });
      expect(second.data.assignments).toEqual(expect.arrayContaining([
        expect.objectContaining({ taskId: piTask.publicId, role: "PI" }),
        expect.objectContaining({ taskId: devTask.publicId, role: "DEVELOPER" }),
      ]));

      expect(() => service.replaceTaskAssignments({ ...authorization, projectRevision: 3 }, 3, devTask.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, role: "EQUIPMENT_OWNER" }],
      })).toThrow(ResourceCatalogAssignmentRoleInvalidError);

      const expanded = service.updateTarget("resource", resource.id, admin.rawToken, catalog.data.revision, {
        roles: ["PI", "DEVELOPER", "EQUIPMENT_OWNER"],
      });
      expect(expanded.data.resources[0].roles).toEqual(["PI", "DEVELOPER", "EQUIPMENT_OWNER"]);

      expect(() => service.updateTarget("resource", resource.id, admin.rawToken, expanded.data.revision, {
        roles: ["DEVELOPER", "EQUIPMENT_OWNER"],
      })).toThrow(ResourceCatalogRoleInUseError);
      expect(service.getCatalog(admin.rawToken).data.resources[0].roles).toEqual(["PI", "DEVELOPER", "EQUIPMENT_OWNER"]);
      expect(first.data.assignments[0].role).toBe("PI");

      const insertResource = database.prepare(
        "INSERT INTO resources(public_id,name,code,description,developer_grade,active,created_at,updated_at) VALUES(?,?,NULL,'',NULL,1,?,?)",
      );
      for (let index = 0; index < 105; index += 1) {
        insertResource.run(randomUUID(), `A filler ${String(index).padStart(3, "0")}`, NOW, NOW);
      }
      const latePublicId = randomUUID();
      const lateResult = insertResource.run(latePublicId, "Z role target", NOW, NOW);
      database.prepare("INSERT INTO resource_roles(resource_id,role,created_at) VALUES(?,'EQUIPMENT_OWNER',?)")
        .run(Number(lateResult.lastInsertRowid), NOW);

      expect(service.searchTargets(authorization, "resource", undefined).data.targets.some((target) => target.id === latePublicId)).toBe(false);
      expect(service.searchTargets(authorization, "resource", undefined, "EQUIPMENT_OWNER").data.targets)
        .toEqual(expect.arrayContaining([expect.objectContaining({ id: latePublicId, roles: ["EQUIPMENT_OWNER"] })]));
    } finally {
      database.close();
    }
  });

  it("keeps legacy NULL roles and rejects group role persistence at the database boundary", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const columns = database.prepare("SELECT assignment_role FROM task_assignments LIMIT 0").columns();
      expect(columns.some((column) => column.name === "assignment_role")).toBe(true);

      expect(() => database.prepare(`
        INSERT INTO task_assignments
          (public_id, project_id, task_id, group_id, assignment_role, created_at, updated_at)
        VALUES (?, 999, 999, 999, 'PI', ?, ?)
      `).run(randomUUID(), NOW, NOW)).toThrow();
    } finally {
      database.close();
    }
  });
});
