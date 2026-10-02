import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { handleDeleteCatalogTarget } from "../../../src/server/resources/resource-catalog-handlers-core";
import {
  ResourceCatalogRevisionMismatchError,
  ResourceCatalogService,
  ResourceCatalogTargetInUseError,
} from "../../../src/server/resources/resource-catalog-service-core";
import { resourceCatalogAdminCookieName } from "../../../src/server/security/resource-catalog-cookie-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-09-15T12:00:00.000Z";
const BASE = "http://localhost:3000";

function fixture() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
  const projects = new ProjectRepository(database);
  const schedules = new ScheduleRepository(database);
  const project = projects.insert({
    publicId: randomUUID(),
    name: "Issue 329 fixture",
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
  const task = schedules.insertTask({
    projectId: project.id,
    externalId: randomUUID(),
    publicId: randomUUID(),
    name: "Task",
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
  const service = new ResourceCatalogService(database, { clock: () => new Date(NOW) });
  const admin = service.unlockAdmin("Admin123456!", "Admin123456!");
  if (!admin) throw new Error("admin session not created");
  return { database, project, task, service, admin };
}

type Fixture = ReturnType<typeof fixture>;

function resourceId(database: Fixture["database"], publicId: string): number {
  return (database.prepare("SELECT id FROM resources WHERE public_id = ?").get(publicId) as { id: number }).id;
}

function groupId(database: Fixture["database"], publicId: string): number {
  return (database.prepare("SELECT id FROM resource_groups WHERE public_id = ?").get(publicId) as { id: number }).id;
}

function insertCalendarRule(
  database: Fixture["database"],
  projectId: number,
  targetType: "RESOURCE" | "RESOURCE_GROUP",
  targetPublicId: string,
) {
  database.prepare(`
    INSERT INTO work_calendar_rules
      (public_id, project_id, kind, name, country_code, target_type, target_public_id, scope,
       effective_from, effective_to, source_version, created_at, updated_at)
    VALUES (?, ?, 'CUSTOM', ?, NULL, ?, ?, 'FULL_PROJECT', NULL, NULL, NULL, ?, ?)
  `).run(randomUUID(), projectId, "Issue 329 usage", targetType, targetPublicId, NOW, NOW);
}

function insertLogisticsParents(database: Fixture["database"], projectId: number) {
  const processId = Number(database.prepare(`
    INSERT INTO project_processes
      (public_id, project_id, code, name, parent_id, sort_order, active, created_at, updated_at)
    VALUES (?, ?, 'PROC-329', 'Process', NULL, 0, 1, ?, ?)
  `).run(randomUUID(), projectId, NOW, NOW).lastInsertRowid);
  const equipmentId = Number(database.prepare(`
    INSERT INTO project_equipment
      (public_id, project_id, process_id, code, name, equipment_type, management_unit, quantity,
       manufacturer, model, description, active, created_at, updated_at)
    VALUES (?, ?, ?, 'EQ-329', 'Equipment', 'stocker', 'unit', 1, '', '', '', 1, ?, ?)
  `).run(randomUUID(), projectId, processId, NOW, NOW).lastInsertRowid);
  const systemId = Number(database.prepare(`
    INSERT INTO project_logistics_systems
      (public_id, project_id, code, name, system_type, layer, scope, vendor, description, active, created_at, updated_at)
    VALUES (?, ?, 'SYS-329', 'System', 'mcs', 'coordinator', 'project', '', '', 1, ?, ?)
  `).run(randomUUID(), projectId, NOW, NOW).lastInsertRowid);
  return { equipmentId, systemId };
}

describe("Issue #329 guarded resource catalog deletion", () => {
  it("counts every Resource project reference and blocks deletion", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("resource", f.admin.rawToken, 1, { name: "Task resource" });
      const taskResource = catalog.data.resources.find((resource) => resource.name === "Task resource")!;
      catalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, { name: "Equipment resource" });
      const equipmentResource = catalog.data.resources.find((resource) => resource.name === "Equipment resource")!;
      catalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, { name: "System resource" });
      const systemResource = catalog.data.resources.find((resource) => resource.name === "System resource")!;
      catalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, { name: "Calendar resource" });
      const calendarResource = catalog.data.resources.find((resource) => resource.name === "Calendar resource")!;

      f.database.prepare(`
        INSERT INTO task_assignments
          (public_id, project_id, task_id, resource_id, group_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?)
      `).run(randomUUID(), f.project.id, f.task.id, resourceId(f.database, taskResource.id), NOW, NOW);

      const { equipmentId, systemId } = insertLogisticsParents(f.database, f.project.id);
      f.database.prepare(`
        INSERT INTO project_equipment_resource_roles
          (project_id, equipment_id, resource_id, role, is_primary, created_at, updated_at)
        VALUES (?, ?, ?, 'owner', 1, ?, ?)
      `).run(f.project.id, equipmentId, resourceId(f.database, equipmentResource.id), NOW, NOW);
      f.database.prepare(`
        INSERT INTO project_system_resource_roles
          (project_id, system_id, resource_id, role, is_primary, created_at, updated_at)
        VALUES (?, ?, ?, 'pi', 1, ?, ?)
      `).run(f.project.id, systemId, resourceId(f.database, systemResource.id), NOW, NOW);
      insertCalendarRule(f.database, f.project.id, "RESOURCE", calendarResource.id);

      const current = f.service.getCatalog(f.admin.rawToken);
      for (const name of ["Task resource", "Equipment resource", "System resource", "Calendar resource"]) {
        expect(current.data.resources.find((resource) => resource.name === name))
          .toMatchObject({ projectUsageCount: 1, deletable: false });
      }

      const revision = current.data.revision;
      for (const resource of [taskResource, equipmentResource, systemResource, calendarResource]) {
        expect(() => f.service.deleteTarget("resource", resource.id, f.admin.rawToken, revision))
          .toThrow(ResourceCatalogTargetInUseError);
      }
      expect(f.service.getCatalog(f.admin.rawToken).data.revision).toBe(revision);
      expect(f.service.getCatalog(f.admin.rawToken).data.resources).toHaveLength(4);
    } finally {
      f.database.close();
    }
  });

  it("counts Task and Calendar usage for Resource Groups", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("group", f.admin.rawToken, 1, { name: "Task group" });
      const taskGroup = catalog.data.groups.find((group) => group.name === "Task group")!;
      catalog = f.service.createTarget("group", f.admin.rawToken, catalog.data.revision, { name: "Calendar group" });
      const calendarGroup = catalog.data.groups.find((group) => group.name === "Calendar group")!;

      f.database.prepare(`
        INSERT INTO task_assignments
          (public_id, project_id, task_id, resource_id, group_id, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?, ?)
      `).run(randomUUID(), f.project.id, f.task.id, groupId(f.database, taskGroup.id), NOW, NOW);
      insertCalendarRule(f.database, f.project.id, "RESOURCE_GROUP", calendarGroup.id);

      const current = f.service.getCatalog(f.admin.rawToken);
      expect(current.data.groups).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "Task group", projectUsageCount: 1, deletable: false }),
        expect.objectContaining({ name: "Calendar group", projectUsageCount: 1, deletable: false }),
      ]));
      expect(() => f.service.deleteTarget("group", taskGroup.id, f.admin.rawToken, current.data.revision))
        .toThrow(ResourceCatalogTargetInUseError);
      expect(() => f.service.deleteTarget("group", calendarGroup.id, f.admin.rawToken, current.data.revision))
        .toThrow(ResourceCatalogTargetInUseError);
    } finally {
      f.database.close();
    }
  });

  it("deletes unused targets, cleans membership only, and advances revision once per delete", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("resource", f.admin.rawToken, 1, { name: "Resource A" });
      const resourceA = catalog.data.resources.find((resource) => resource.name === "Resource A")!;
      catalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, { name: "Resource B" });
      const resourceB = catalog.data.resources.find((resource) => resource.name === "Resource B")!;
      catalog = f.service.createTarget("group", f.admin.rawToken, catalog.data.revision, { name: "Group A" });
      const group = catalog.data.groups[0];
      catalog = f.service.replaceGroupMembers(group.id, f.admin.rawToken, catalog.data.revision, {
        resourceIds: [resourceA.id, resourceB.id],
      });

      expect(catalog.data.resources.find((resource) => resource.id === resourceA.id))
        .toMatchObject({ projectUsageCount: 0, deletable: true });
      expect(catalog.data.groups[0]).toMatchObject({ projectUsageCount: 0, deletable: true });

      const beforeResourceDelete = catalog.data.revision;
      catalog = f.service.deleteTarget("resource", resourceA.id, f.admin.rawToken, beforeResourceDelete);
      expect(catalog.data.revision).toBe(beforeResourceDelete + 1);
      expect(catalog.data.resources.map((resource) => resource.id)).toEqual([resourceB.id]);
      expect(catalog.data.groups[0].memberResourceIds).toEqual([resourceB.id]);

      const beforeGroupDelete = catalog.data.revision;
      catalog = f.service.deleteTarget("group", group.id, f.admin.rawToken, beforeGroupDelete);
      expect(catalog.data.revision).toBe(beforeGroupDelete + 1);
      expect(catalog.data.groups).toHaveLength(0);
      expect(catalog.data.resources.map((resource) => resource.id)).toEqual([resourceB.id]);
    } finally {
      f.database.close();
    }
  });

  it("rejects stale catalog revisions without deleting the target", () => {
    const f = fixture();
    try {
      const catalog = f.service.createTarget("resource", f.admin.rawToken, 1, { name: "Free resource" });
      const resource = catalog.data.resources[0];
      expect(() => f.service.deleteTarget("resource", resource.id, f.admin.rawToken, 1))
        .toThrow(ResourceCatalogRevisionMismatchError);
      expect(f.service.getCatalog(f.admin.rawToken).data.resources).toHaveLength(1);
      expect(f.service.getCatalog(f.admin.rawToken).data.revision).toBe(catalog.data.revision);

    } finally {
      f.database.close();
    }
  });

  it("enforces DELETE Origin/admin/If-Match and maps project usage to 409", async () => {
    const f = fixture();
    try {
      const catalog = f.service.createTarget("resource", f.admin.rawToken, 1, { name: "Used resource" });
      const resource = catalog.data.resources[0];
      f.database.prepare(`
        INSERT INTO task_assignments
          (public_id, project_id, task_id, resource_id, group_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?)
      `).run(randomUUID(), f.project.id, f.task.id, resourceId(f.database, resource.id), NOW, NOW);

      const cookieName = resourceCatalogAdminCookieName("development", new URL(BASE));
      const dependencies = {
        resourceService: f.service,
        applicationBaseUrl: BASE,
        environment: "development",
        requestId: () => "issue-329-request",
      };
      const request = (headers: HeadersInit) => new Request(`${BASE}/api/resources/${resource.id}`, {
        method: "DELETE",
        headers,
      });

      const forbidden = await handleDeleteCatalogTarget(request({
        Origin: "http://evil.example",
        "If-Match": `"${catalog.data.revision}"`,
        Cookie: `${cookieName}=${f.admin.rawToken}`,
      }), "resource", resource.id, dependencies);
      expect(forbidden.status).toBe(403);

      const unauthorized = await handleDeleteCatalogTarget(request({
        Origin: BASE,
        "If-Match": `"${catalog.data.revision}"`,
      }), "resource", resource.id, dependencies);
      expect(unauthorized.status).toBe(401);

      const stale = await handleDeleteCatalogTarget(request({
        Origin: BASE,
        "If-Match": '"1"',
        Cookie: `${cookieName}=${f.admin.rawToken}`,
      }), "resource", resource.id, dependencies);
      expect(stale.status).toBe(412);

      const inUse = await handleDeleteCatalogTarget(request({
        Origin: BASE,
        "If-Match": `"${catalog.data.revision}"`,
        Cookie: `${cookieName}=${f.admin.rawToken}`,
      }), "resource", resource.id, dependencies);
      expect(inUse.status).toBe(409);
      await expect(inUse.json()).resolves.toMatchObject({
        error: {
          code: "RESOURCE_IN_USE",
          details: expect.arrayContaining([
            expect.objectContaining({ code: "PROJECT_USAGE_COUNT", message: "projectUsageCount=1" }),
            expect.objectContaining({ code: "TASK_ASSIGNMENT_PROJECT_COUNT", message: "taskAssignmentProjectCount=1" }),
          ]),
        },
      });
      expect(f.service.getCatalog(f.admin.rawToken).data.revision).toBe(catalog.data.revision);

      const freeCatalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, {
        name: "Free handler resource",
      });
      const freeResource = freeCatalog.data.resources.find((entry) => entry.name === "Free handler resource")!;
      const success = await handleDeleteCatalogTarget(new Request(`${BASE}/api/resources/${freeResource.id}`, {
        method: "DELETE",
        headers: {
          Origin: BASE,
          "If-Match": `"${freeCatalog.data.revision}"`,
          Cookie: `${cookieName}=${f.admin.rawToken}`,
        },
      }), "resource", freeResource.id, dependencies);
      expect(success.status).toBe(200);
      expect(success.headers.get("etag")).toBe(`"${freeCatalog.data.revision + 1}"`);
      await expect(success.json()).resolves.toMatchObject({
        data: {
          revision: freeCatalog.data.revision + 1,
          resources: expect.not.arrayContaining([
            expect.objectContaining({ id: freeResource.id }),
          ]),
        },
      });
    } finally {
      f.database.close();
    }
  });
});
