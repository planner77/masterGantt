import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import {
  ResourceCatalogInvalidInputError,
  ResourceCatalogService,
} from "../../../src/server/resources/resource-catalog-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-10-06T12:00:00.000Z";

describe("Issue #485 Global Resource Role source of truth", () => {
  it("stores Task assignment without a performed role, rejects non-null role input, and allows Global Role changes", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const projects = new ProjectRepository(database);
      const sessions = new EditSessionRepository(database);
      const schedules = new ScheduleRepository(database);
      const project = projects.insert({
        publicId: randomUUID(),
        name: "Global role fixture",
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
      const task = schedules.insertTask({
        projectId: project.id,
        externalId: randomUUID(),
        publicId: randomUUID(),
        name: "Assignment",
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-10-07",
        startDate: "2026-10-07",
        endDate: "2026-10-09",
        duration: 3,
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

      const assigned = service.replaceTaskAssignments(authorization, 1, task.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, allocation: { percent: 80 } }],
      });
      expect(assigned.data.assignments).toEqual([
        expect.objectContaining({ taskId: task.publicId, role: null, target: { kind: "resource", id: resource.id } }),
      ]);

      expect(() => service.replaceTaskAssignments({ ...authorization, projectRevision: 2 }, 2, task.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resource.id, role: "PI", allocation: { percent: 80 } }],
      })).toThrow(ResourceCatalogInvalidInputError);

      const changed = service.updateTarget("resource", resource.id, admin.rawToken, catalog.data.revision, {
        roles: ["DEVELOPER"],
      });
      expect(changed.data.resources[0].roles).toEqual(["DEVELOPER"]);
      expect(service.getAssignedTargets(project.publicId)!.data.assignments[0].role).toBeNull();

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

  it("keeps the compatibility column but removes Task-role guards and indexes", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const columns = database.prepare("SELECT name FROM pragma_table_info('task_assignments')").pluck().all() as string[];
      expect(columns).toContain("assignment_role");
      const schemaNames = database.prepare(
        "SELECT name FROM sqlite_schema WHERE name IN ('task_assignments_resource_role_idx','task_assignments_role_insert_guard','task_assignments_role_update_guard','resource_roles_assignment_delete_guard')",
      ).pluck().all();
      expect(schemaNames).toEqual([]);
    } finally {
      database.close();
    }
  });
});
