import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { runMigrations } from "../../../src/server/db/migrations";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { handleUpdateEquipment } from "../../../src/server/logistics/logistics-handlers-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";

const migrationDir = join(process.cwd(), "db/migrations");
const stamp = "2026-11-13T01:00:00.000Z";
const dirs: string[] = [], connections: Database.Database[] = [];
afterEach(() => {
  connections.splice(0).forEach(db => { if (db.open) db.close(); });
  dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true }));
});
function directory() { const dir = mkdtempSync(join(tmpdir(), "issue-917-db-")); dirs.push(dir); return dir; }
function migrations(dir: string, max: number) {
  mkdirSync(dir);
  for (const name of readdirSync(migrationDir).filter(name => name.endsWith(".sql") && Number(name.slice(0, 4)) <= max)) copyFileSync(join(migrationDir, name), join(dir, name));
  return dir;
}
function open(filename: string, migrationsDirectory = migrationDir) {
  const result = openDatabase({ filename, migrationsDirectory }); connections.push(result.database); return result.database;
}
function snapshot(db: Database.Database) {
  return (db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").pluck().all() as string[])
    .map(table => ({ table, rows: db.prepare(`SELECT * FROM ${table}`).all().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }));
}
function seed(db: Database.Database) {
  const project = new ProjectRepository(db).insert({ publicId: randomUUID(), name: "Synthetic migration", description: "", status: "planned", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: stamp, updatedAt: stamp });
  const repo = new LogisticsRepository(db);
  const parent = repo.insertProcess({ projectId: project.id, publicId: randomUUID(), code: "PARENT", name: "Parent", parentId: null, now: stamp });
  const process = repo.insertProcess({ projectId: project.id, publicId: randomUUID(), code: "P", name: "Process", parentId: parent.id, now: stamp });
  const equipment = repo.insertEquipment({ projectId: project.id, publicId: randomUUID(), processId: process.id, code: "E", name: "Fleet", equipmentType: "amr", managementUnit: "fleet", quantity: 9, active: 0, now: stamp });
  const system = repo.insertSystem({ projectId: project.id, publicId: randomUUID(), code: "S", name: "Controller", systemType: "acs", layer: "controller", scope: "project", now: stamp });
  repo.setEquipmentSystems(project.id, equipment.id, [{ systemId: system.id, controlRole: "primary" }], stamp);
  const resource = new ResourceCatalogRepository(db).insertResource({ publicId: randomUUID(), code: "R", name: "Owner", description: "", now: stamp });
  repo.replaceEquipmentResourceRoles(project.id, equipment.id, [{ resourceId: resource.id, role: "owner", isPrimary: 1 }], stamp);
  const task = new ScheduleRepository(db).insertTask({ projectId: project.id, publicId: randomUUID(), externalId: "TASK", name: "Task", type: "task", parentId: null, scheduleMode: "auto", requestedStart: "2026-11-13", startDate: "2026-11-13", endDate: "2026-11-13", duration: 1, progress: 0, sortOrder: 0, createdAt: stamp, updatedAt: stamp });
  repo.replaceTaskEquipmentLinks(project.id, task.id, [{ equipmentId: equipment.id, scope: "self" }], stamp);
  const areaId = Number(db.prepare("INSERT INTO project_work_areas(public_id,project_id,process_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(randomUUID(), project.id, parent.id, "AREA", "Independent area", stamp, stamp).lastInsertRowid);
  db.prepare("INSERT INTO equipment_project_work_areas VALUES(?,?,?,?)").run(project.id, equipment.id, parent.id, areaId);
  db.prepare("INSERT INTO project_equipment_translations VALUES(?,?,?)").run(equipment.id, "en", "Fleet translation");
  // A real catalog-backed legacy process Target with coverage exercises every
  // inbound equipment reference without using production data or disabling guards.
  const item = (category: string, code: string) => Number(db.prepare("INSERT INTO project_master_items(public_id,category,code,name,active,sort_order,created_at,updated_at) VALUES(?,?,?,?,1,0,?,?)").run(randomUUID(), category, code, code, stamp, stamp).lastInsertRowid);
  const bu = item("BUSINESS_UNIT", "BU"), product = item("PRODUCT", "PRODUCT"), site = item("SITE_ENTITY", "SITE");
  db.prepare("INSERT INTO business_unit_products VALUES(?,?)").run(bu, product);
  db.prepare("INSERT INTO business_unit_product_sites VALUES(?,?,?)").run(bu, product, site);
  db.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?").run(bu, product, site, project.id);
  const type = Number(db.prepare("INSERT INTO process_types(public_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?)").run(randomUUID(), "TYPE", "Type", stamp, stamp).lastInsertRowid);
  const occurrence = Number(db.prepare("INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(randomUUID(), bu, product, site, type, "OCC", "Occurrence", stamp, stamp).lastInsertRowid);
  db.prepare("INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,work_area_id,created_at,updated_at) VALUES(?,?,?,?,?,?,NULL,?,?)").run(project.id, process.id, occurrence, bu, product, site, stamp, stamp);
  const legacyArea = Number(db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), occurrence, "LEGACY", "Legacy area", stamp, stamp).lastInsertRowid);
  db.prepare("INSERT INTO equipment_work_areas VALUES(?,?,?,?,?)").run(project.id, equipment.id, process.id, occurrence, legacyArea);
  db.transaction(() => {
    const target = Number(db.prepare("INSERT INTO logistics_targets(public_id,project_id,code,name,scope,project_process_id,occurrence_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(randomUUID(), project.id, "T", "Legacy Target", "process", process.id, occurrence, stamp, stamp).lastInsertRowid);
    const member = Number(db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,created_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), project.id, target, "equipment", equipment.id, stamp).lastInsertRowid);
    db.prepare("UPDATE logistics_targets SET anchor_member_id=? WHERE id=?").run(member, target);
    const binding = Number(db.prepare("INSERT INTO task_target_bindings(public_id,project_id,task_id,target_id,scope,selection,anchor_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(randomUUID(), project.id, task.id, target, "self", "subset", member, stamp, stamp).lastInsertRowid);
    db.prepare("INSERT INTO task_target_binding_members(project_id,binding_id,target_id,member_id,coverage) VALUES(?,?,?,?,?)").run(project.id, binding, target, member, 6);
  })();
  return { project, equipment, process, parent, repo };
}

describe("Issue #917 migration 0039", () => {
  it("upgrades populated 0038 without changing any row/PK/FK and preserves backup, restart and SQL guards", async () => {
    const dir = directory(), oldDir = migrations(join(dir, "old"), 38), filename = join(dir, "source.sqlite3");
    const db = open(filename, oldDir), f = seed(db), before = snapshot(db);
    const previousSchema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('index','trigger') ORDER BY name").all() as Array<{ name: string; sql: string }>;
    const backup = join(dir, "before.sqlite3"); await db.backup(backup);
    expect(runMigrations(db, migrationDir).applied).toEqual(["0039_optional_equipment_process.sql"]);
    expect(snapshot(db)).toEqual(before);
    const afterSchema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('index','trigger') ORDER BY name").all() as typeof previousSchema;
    expect(afterSchema.map(row => row.name)).toEqual(previousSchema.map(row => row.name));
    expect(afterSchema.filter(row => row.name !== "equipment_target_process_guard")).toEqual(previousSchema.filter(row => row.name !== "equipment_target_process_guard"));
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(() => db.prepare("UPDATE project_equipment SET process_id=NULL WHERE id=?").run(f.equipment.id)).toThrow("TARGET_EQUIPMENT_PROCESS_MISMATCH");
    expect(() => db.prepare("UPDATE project_equipment SET process_id=? WHERE id=?").run(f.parent.id, f.equipment.id)).toThrow("TARGET_EQUIPMENT_PROCESS_MISMATCH");
    expect(() => db.prepare("UPDATE project_equipment SET quantity=5 WHERE id=?").run(f.equipment.id)).toThrow("TARGET_COVERAGE_EXCEEDS_QUANTITY");
    const unassigned = f.repo.insertEquipment({ projectId: f.project.id, publicId: randomUUID(), processId: null, code: "UNASSIGNED", name: "Unit", equipmentType: "amr", managementUnit: "unit", quantity: 1, now: stamp });
    const after = snapshot(db); db.close();
    const restarted = open(filename);
    expect(snapshot(restarted)).toEqual(after);
    expect(new LogisticsRepository(restarted).findEquipmentById(f.project.id, unassigned.id)?.processId).toBeNull();
    expect(restarted.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(() => openDatabase({ filename, migrationsDirectory: oldDir })).toThrow("missing from disk");
    const restoredPath = join(dir, "isolated-restored.sqlite3"); copyFileSync(backup, restoredPath);
    const restored = open(restoredPath, oldDir);
    expect(snapshot(restored)).toEqual(before);
    expect(restored.prepare("SELECT MAX(version) FROM schema_migrations").pluck().get()).toBe(38);
    expect(restored.pragma("foreign_key_check")).toEqual([]);
    expect(runMigrations(restored, migrationDir).applied).toEqual(["0039_optional_equipment_process.sql"]);
    expect(snapshot(restored)).toEqual(before);
  });

  it.each(["sql", "foreign-key"] as const)("rolls back rebuilt rows, schema and ledger on late %s failure and restores FK enforcement", failure => {
    const dir = directory(), oldDir = migrations(join(dir, "old"), 38), badDir = migrations(join(dir, "bad"), 39);
    const db = open(join(dir, "failure.sqlite3"), oldDir); seed(db);
    const before = snapshot(db), schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name").all();
    const path = join(badDir, "0039_optional_equipment_process.sql");
    writeFileSync(path, readFileSync(path, "utf8") + (failure === "sql" ? "\nINSERT INTO deliberately_missing_table VALUES(1);\n" : "\nUPDATE project_equipment SET equipment_type='nonexistent-type';\n"));
    expect(() => runMigrations(db, badDir)).toThrow(/rolled back/);
    expect(snapshot(db)).toEqual(before);
    expect(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name").all()).toEqual(schema);
    expect(db.prepare("SELECT MAX(version) FROM schema_migrations").pluck().get()).toBe(38);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(runMigrations(db, migrationDir).applied).toEqual(["0039_optional_equipment_process.sql"]);
    expect(snapshot(db)).toEqual(before);
  });

  it("creates a fresh nullable schema with project FK, quantity and type checks intact", () => {
    const db = open(":memory:"), f = seed(db);
    const input = { projectId: f.project.id, publicId: randomUUID(), processId: null, code: "NEW", name: "New", equipmentType: "amr", managementUnit: "unit" as const, quantity: 1, now: stamp };
    const unassigned = f.repo.insertEquipment(input);
    expect(unassigned.processId).toBeNull();
    const targetId = db.prepare("SELECT id FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id);
    expect(() => db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,created_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), f.project.id, targetId, "equipment", unassigned.id, stamp)).toThrow("TARGET_EQUIPMENT_PROCESS_MISMATCH");
    expect(() => f.repo.insertEquipment({ ...input, publicId: randomUUID(), code: "BAD", quantity: 2 })).toThrow();
    expect(() => f.repo.insertEquipment({ ...input, publicId: randomUUID(), code: "BAD", processId: 999999 })).toThrow();
    expect(db.pragma("foreign_key_check")).toEqual([]);
  });
});

describe("Issue #917 legacy Target HTTP conflict", () => {
  it("returns 409 for changing/clearing process, atomically preserving name, quantity, coverage, memberships and revision", async () => {
    const db = open(":memory:"), f = seed(db), now = new Date(stamp), token = createSessionToken();
    new EditSessionRepository(db).insert({ projectId: f.project.id, tokenHash: token.tokenHash, authVersion: f.project.authVersion, createdAt: stamp, expiresAt: sessionExpiry(now).toISOString() });
    const base = "https://gantt.example.test", deps = { logisticsService: new LogisticsService(db, { clock: () => now }), projectService: new TaskFieldProjectService(db, { clock: () => now }), applicationBaseUrl: base, environment: "production" };
    const before = snapshot(db);
    for (const processId of [null, f.parent.publicId]) {
      const request = new Request(`${base}/api/projects/${f.project.publicId}/logistics/equipment/${f.equipment.publicId}`, { method: "PATCH", headers: { Origin: base, Cookie: `${editSessionCookieName("production", new URL(base))}=${token.rawToken}`, "If-Match": '"1"', "Content-Type": "application/json" }, body: JSON.stringify({ processId, name: "ROLLBACK", quantity: 10 }) });
      const response = await handleUpdateEquipment(request, f.project.publicId, f.equipment.publicId, deps);
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("TARGET_EQUIPMENT_PROCESS_MISMATCH");
      expect(snapshot(db)).toEqual(before);
    }
    const request = new Request(`${base}/api/projects/${f.project.publicId}/logistics/equipment/${f.equipment.publicId}`, { method: "PATCH", headers: { Origin: base, Cookie: `${editSessionCookieName("production", new URL(base))}=${token.rawToken}`, "If-Match": '"1"', "Content-Type": "application/json" }, body: JSON.stringify({ name: "Retained Target" }) });
    expect((await handleUpdateEquipment(request, f.project.publicId, f.equipment.publicId, deps)).status).toBe(200);
    expect(f.repo.findEquipmentById(f.project.id, f.equipment.id)).toMatchObject({ processId: f.process.id, name: "Retained Target", quantity: 9 });
  });
});
