import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import {
  ResourceCatalogInvalidInputError,
  ResourceCatalogRevisionMismatchError,
  ResourceCatalogService,
} from "../../../src/server/resources/resource-catalog-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-10-04T00:00:00.000Z";

function fixture(filename = ":memory:") {
  const opened = openDatabase({ filename, migrationsDirectory });
  const service = new ResourceCatalogService(opened.database, { clock: () => new Date(NOW) });
  const admin = service.unlockAdmin("Admin123456!", "Admin123456!");
  if (!admin) throw new Error("resource admin session not created");
  return { ...opened, service, admin };
}

describe("Issue #412 global Resource roles", () => {
  it("stores canonical multi roles, allows no role, and rejects duplicates at API/domain and DB boundaries", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("resource", f.admin.rawToken, 1, {
        name: "R1",
        developerGrade: "ADVANCED",
        roles: ["DEVELOPER", "PI"],
      });
      catalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, {
        name: "R2",
        roles: ["EQUIPMENT_OWNER"],
      });
      catalog = f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, {
        name: "R3",
      });

      expect(catalog.data.resources.find((resource) => resource.name === "R1"))
        .toMatchObject({ developerGrade: "ADVANCED", roles: ["PI", "DEVELOPER"] });
      expect(catalog.data.resources.find((resource) => resource.name === "R2"))
        .toMatchObject({ developerGrade: null, roles: ["EQUIPMENT_OWNER"] });
      expect(catalog.data.resources.find((resource) => resource.name === "R3"))
        .toMatchObject({ developerGrade: null, roles: [] });

      expect(() => f.service.createTarget("resource", f.admin.rawToken, catalog.data.revision, {
        name: "Duplicate request",
        roles: ["PI", "PI"],
      })).toThrow(ResourceCatalogInvalidInputError);
      expect(f.service.getCatalog(f.admin.rawToken).data.revision).toBe(catalog.data.revision);

      const r1 = catalog.data.resources.find((resource) => resource.name === "R1")!;
      const internal = f.database.prepare("SELECT id FROM resources WHERE public_id = ?").get(r1.id) as { id: number };
      expect(() => f.database.prepare(
        "INSERT INTO resource_roles (resource_id, role, created_at) VALUES (?, 'PI', ?)",
      ).run(internal.id, NOW)).toThrow(/UNIQUE constraint failed|PRIMARY KEY/);
    } finally {
      f.database.close();
    }
  });

  it("keeps roles independent from developer grade and Resource Group membership", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("resource", f.admin.rawToken, 1, {
        name: "Mixed",
        developerGrade: "EXPERT",
        roles: ["DEVELOPER", "PI"],
      });
      const resource = catalog.data.resources[0];
      catalog = f.service.createTarget("group", f.admin.rawToken, catalog.data.revision, { name: "Mixed team" });
      const group = catalog.data.groups[0];
      catalog = f.service.replaceGroupMembers(group.id, f.admin.rawToken, catalog.data.revision, { resourceIds: [resource.id] });

      catalog = f.service.updateTarget("resource", resource.id, f.admin.rawToken, catalog.data.revision, {
        roles: ["EQUIPMENT_OWNER"],
      });
      expect(catalog.data.resources[0]).toMatchObject({
        developerGrade: "EXPERT",
        roles: ["EQUIPMENT_OWNER"],
      });
      expect(catalog.data.groups[0].memberResourceIds).toEqual([resource.id]);

      catalog = f.service.replaceGroupMembers(group.id, f.admin.rawToken, catalog.data.revision, { resourceIds: [] });
      expect(catalog.data.resources[0].roles).toEqual(["EQUIPMENT_OWNER"]);
      expect(catalog.data.resources[0].developerGrade).toBe("EXPERT");

      catalog = f.service.updateTarget("resource", resource.id, f.admin.rawToken, catalog.data.revision, {
        developerGrade: null,
      });
      expect(catalog.data.resources[0].roles).toEqual(["EQUIPMENT_OWNER"]);
      expect(catalog.data.resources[0].developerGrade).toBeNull();
    } finally {
      f.database.close();
    }
  });

  it("does not rewrite project equipment/system roles and preserves roles while inactive", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("resource", f.admin.rawToken, 1, {
        name: "Project role resource",
        developerGrade: "INTERMEDIATE",
        roles: ["PI", "DEVELOPER", "EQUIPMENT_OWNER"],
      });
      const resource = catalog.data.resources[0];
      const resourceRow = f.database.prepare("SELECT id FROM resources WHERE public_id = ?").get(resource.id) as { id: number };

      const projects = new ProjectRepository(f.database);
      const project = projects.insert({
        publicId: randomUUID(),
        name: "Issue 412",
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
      const processId = Number(f.database.prepare(`
        INSERT INTO project_processes
          (public_id, project_id, code, name, parent_id, sort_order, active, created_at, updated_at)
        VALUES (?, ?, 'P412', 'Process', NULL, 0, 1, ?, ?)
      `).run(randomUUID(), project.id, NOW, NOW).lastInsertRowid);
      const equipmentId = Number(f.database.prepare(`
        INSERT INTO project_equipment
          (public_id, project_id, process_id, code, name, equipment_type, management_unit, quantity,
           manufacturer, model, description, active, created_at, updated_at)
        VALUES (?, ?, ?, 'E412', 'Equipment', 'stocker', 'unit', 1, '', '', '', 1, ?, ?)
      `).run(randomUUID(), project.id, processId, NOW, NOW).lastInsertRowid);
      const systemId = Number(f.database.prepare(`
        INSERT INTO project_logistics_systems
          (public_id, project_id, code, name, system_type, layer, scope, vendor, description, active, created_at, updated_at)
        VALUES (?, ?, 'S412', 'System', 'mcs', 'coordinator', 'project', '', '', 1, ?, ?)
      `).run(randomUUID(), project.id, NOW, NOW).lastInsertRowid);
      f.database.prepare(`
        INSERT INTO project_equipment_resource_roles
          (project_id, equipment_id, resource_id, role, is_primary, created_at, updated_at)
        VALUES (?, ?, ?, 'owner', 1, ?, ?)
      `).run(project.id, equipmentId, resourceRow.id, NOW, NOW);
      f.database.prepare(`
        INSERT INTO project_system_resource_roles
          (project_id, system_id, resource_id, role, is_primary, created_at, updated_at)
        VALUES (?, ?, ?, 'developer', 0, ?, ?)
      `).run(project.id, systemId, resourceRow.id, NOW, NOW);

      catalog = f.service.updateTarget("resource", resource.id, f.admin.rawToken, catalog.data.revision, {
        roles: ["PI"],
        active: false,
      });
      expect(catalog.data.resources[0]).toMatchObject({ active: false, roles: ["PI"], developerGrade: "INTERMEDIATE" });
      expect(f.database.prepare(
        "SELECT role FROM project_equipment_resource_roles WHERE resource_id = ?",
      ).pluck().all(resourceRow.id)).toEqual(["owner"]);
      expect(f.database.prepare(
        "SELECT role FROM project_system_resource_roles WHERE resource_id = ?",
      ).pluck().all(resourceRow.id)).toEqual(["developer"]);
    } finally {
      f.database.close();
    }
  });

  it("guards stale role edits and cascades role rows only when an unused Resource is deleted", () => {
    const f = fixture();
    try {
      let catalog = f.service.createTarget("resource", f.admin.rawToken, 1, {
        name: "Disposable",
        roles: ["PI", "DEVELOPER"],
      });
      const resource = catalog.data.resources[0];
      expect(() => f.service.updateTarget("resource", resource.id, f.admin.rawToken, 1, {
        roles: ["EQUIPMENT_OWNER"],
      })).toThrow(ResourceCatalogRevisionMismatchError);
      expect(f.service.getCatalog(f.admin.rawToken).data.resources[0].roles).toEqual(["PI", "DEVELOPER"]);

      catalog = f.service.deleteTarget("resource", resource.id, f.admin.rawToken, catalog.data.revision);
      expect(catalog.data.resources).toHaveLength(0);
      expect(f.database.prepare("SELECT count(*) FROM resource_roles").pluck().get()).toBe(0);
    } finally {
      f.database.close();
    }
  });

  it("persists Resource roles across a file database reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "mastergantt-issue-412-"));
    const filename = join(directory, "roles.sqlite3");
    try {
      const first = fixture(filename);
      const catalog = first.service.createTarget("resource", first.admin.rawToken, 1, {
        name: "Persistent",
        roles: ["PI", "EQUIPMENT_OWNER"],
      });
      expect(catalog.data.resources[0].roles).toEqual(["PI", "EQUIPMENT_OWNER"]);
      first.database.close();

      const reopened = openDatabase({ filename, migrationsDirectory });
      try {
        expect(new ResourceCatalogRepository(reopened.database).listResources()[0].roles)
          .toEqual(["PI", "EQUIPMENT_OWNER"]);
      } finally {
        reopened.database.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
