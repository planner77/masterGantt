import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { runMigrations } from "../../../src/server/db/migrations";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { loadTaskTargetBindingSnapshot } from "../../../src/server/repositories/task-target-binding-repository-core";
import { resolveAllTaskTargetBindings } from "../../../src/domain/logistics/task-target-bindings";
const migrationDir = join(process.cwd(), "db/migrations"), stamp = "2026-10-15T01:00:00.000Z";
const dirs: string[] = [], connections: Database.Database[] = [];
afterEach(() => { connections.splice(0).forEach(db => { if (db.open) db.close(); }); dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
function directory() { const dir = mkdtempSync(join(tmpdir(), "issue-623-migrations-")); dirs.push(dir); return dir; }
function migrations(dir: string, max: number) { mkdirSync(dir); for (const name of readdirSync(migrationDir).filter(name => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= max)) copyFileSync(join(migrationDir, name), join(dir, name)); return dir; }
function open(filename: string, dir = migrationDir) { const result = openDatabase({ filename, migrationsDirectory: dir }); connections.push(result.database); return result; }
function seedLegacy(db: Database.Database) {
  const project = new ProjectRepository(db).insert({ publicId: randomUUID(), name: "Pre-0025 legacy", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: stamp, updatedAt: stamp });
  const task = new ScheduleRepository(db).insertTask({ projectId: project.id, publicId: randomUUID(), externalId: "LEGACY", name: "Legacy Task", type: "task", parentId: null, scheduleMode: "auto", requestedStart: "2026-10-19", startDate: "2026-10-19", endDate: "2026-10-19", duration: 1, progress: 0, sortOrder: 0, createdAt: stamp, updatedAt: stamp });
  const catalog = new ResourceCatalogRepository(db), resource = catalog.insertResource({ publicId: randomUUID(), name: "Inactive retained person", code: "OLD-R", description: "", now: stamp });
  db.prepare("UPDATE resources SET active=0 WHERE id=?").run(resource.id);
  catalog.replaceTaskAssignments({ projectId: project.id, taskId: task.id, now: stamp, targets: [{ kind: "resource", publicId: resource.publicId, internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: null }] });
  const logistics = new LogisticsRepository(db);
  const process = logistics.insertProcess({ projectId: project.id, publicId: randomUUID(), code: "FREE", name: "Assembly (free legacy text)", parentId: null, active: 0, now: stamp });
  const equipment = logistics.insertEquipment({ projectId: project.id, publicId: randomUUID(), code: "EQ", name: "Legacy AMR", processId: process.id, equipmentType: "amr", managementUnit: "fleet", quantity: 15, now: stamp });
  const mcs = logistics.insertSystem({ projectId: project.id, publicId: randomUUID(), code: "MCS", name: "Legacy shared MCS", systemType: "mcs", layer: "coordinator", scope: "project", now: stamp });
  db.prepare("UPDATE project_equipment SET active=0 WHERE id=?").run(equipment.id);
  logistics.replaceTaskSystemLinks(project.id, task.id, [{ systemId: mcs.id, scope: "self" }], stamp);
  return { project, task, resource, process, equipment, mcs };
}
const preservedTables = ["tasks", "task_assignments", "project_processes", "project_equipment", "project_logistics_systems", "task_system_links", "resources"] as const;
function evidence(db: Database.Database) { return preservedTables.map(table => ({ table, rows: db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() })); }
function assertLedger(db: Database.Database) {
  const rows = db.prepare("SELECT version,name,checksum FROM schema_migrations ORDER BY version").all() as {version:number;name:string;checksum:string}[];
  expect(rows.map(row => row.version)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
  for (const row of rows) expect(row.checksum).toBe(createHash("sha256").update(readFileSync(join(migrationDir, row.name))).digest("hex"));
  expect(db.pragma("foreign_key_check")).toEqual([]); expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
}
describe("#623 actual schema migration and non-destructive recovery acceptance", () => {
  it("creates a fresh 27-version DB with exact checksums and stable restart", () => {
    const filename = join(directory(), "fresh.sqlite3"), first = open(filename);
    expect(first.migrations.applied).toHaveLength(27); assertLedger(first.database); first.database.close();
    const next = open(filename); expect(next.migrations.applied).toEqual([]); assertLedger(next.database);
    for (const table of ["process_types", "site_product_processes", "work_areas", "logistics_targets", "task_target_bindings"]) expect(next.database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name=?").get(table)).toEqual({ name: table });
  });
  it("upgrades real pre-0025 schema, preserves unmapped/inactive rows, persists new binding and restores a consistent pre-upgrade backup into a separate DB", async () => {
    const dir = directory(), oldDir = migrations(join(dir, "old"), 24), filename = join(dir, "legacy.sqlite3"), old = open(filename, oldDir).database;
    const f = seedLegacy(old), before = evidence(old), backup = join(dir, "before-target.sqlite3");
    expect(old.prepare("SELECT 1 FROM sqlite_schema WHERE name='process_types'").get()).toBeUndefined();
    await old.backup(backup); old.close();
    const upgraded = open(filename); expect(upgraded.migrations.applied).toEqual(["0025_process_catalog.sql", "0026_logistics_targets.sql", "0027_task_target_bindings.sql"]);
    const db = upgraded.database; assertLedger(db); expect(evidence(db)).toEqual(before);
    expect(db.prepare("SELECT COUNT(*) FROM project_process_occurrence_mappings").pluck().get()).toBe(0);
    expect(db.prepare("SELECT COUNT(*) FROM process_types").pluck().get()).toBe(0);
    const targetId = randomUUID(), memberId = randomUUID(), bindingId = randomUUID();
    db.transaction(() => {
      const target = Number(db.prepare("INSERT INTO logistics_targets(public_id,project_id,code,name,scope,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(targetId, f.project.id, "COMMON", "Common", "project_common", stamp, stamp).lastInsertRowid);
      const member = Number(db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,system_id,created_at) VALUES(?,?,?,?,?,?)").run(memberId, f.project.id, target, "system", f.mcs.id, stamp).lastInsertRowid);
      db.prepare("UPDATE logistics_targets SET anchor_member_id=? WHERE id=?").run(member, target);
      db.prepare("INSERT INTO task_target_bindings(public_id,project_id,task_id,target_id,scope,selection,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(bindingId, f.project.id, f.task.id, target, "self", "whole", stamp, stamp);
    })(); db.close();
    const restarted = open(filename).database, sources = resolveAllTaskTargetBindings(loadTaskTargetBindingSnapshot(restarted, f.project.id)).get(f.task.publicId)!;
    expect(sources.bindings[0].id).toBe(bindingId); expect(sources.effectiveTargetIds).toEqual([targetId]); expect(sources.legacySources[0].entityId).toBe(f.mcs.publicId); assertLedger(restarted);
    // An old binary must fail closed against the new ledger; never delete ledger rows to downgrade.
    expect(() => openDatabase({ filename, migrationsDirectory: oldDir })).toThrow("missing from disk");
    const restoredFilename = join(dir, "restored-copy.sqlite3"); copyFileSync(backup, restoredFilename);
    const restored = open(restoredFilename, oldDir).database;
    expect(evidence(restored)).toEqual(before); expect(restored.prepare("SELECT MAX(version) FROM schema_migrations").pluck().get()).toBe(24);
    expect(restored.pragma("integrity_check", { simple: true })).toBe("ok"); expect(restored.pragma("foreign_key_check")).toEqual([]);
    expect(restarted.prepare("SELECT COUNT(*) FROM task_target_bindings").pluck().get()).toBe(1);
  });
  it("rolls back every pending Target migration and ledger row on late SQL failure and rejects checksum/order corruption before changing legacy rows", () => {
    const dir = directory(), oldDir = migrations(join(dir, "old"), 24), badDir = migrations(join(dir, "late-failure"), 27), filename = join(dir, "failure.sqlite3"), db = open(filename, oldDir).database;
    seedLegacy(db); const before = evidence(db);
    writeFileSync(join(badDir, "0027_task_target_bindings.sql"), readFileSync(join(badDir, "0027_task_target_bindings.sql"), "utf8") + "\nINSERT INTO deliberately_missing_failure_table VALUES(1);\n");
    expect(() => runMigrations(db, badDir)).toThrow("rolled back");
    expect(evidence(db)).toEqual(before); expect(db.prepare("SELECT MAX(version) FROM schema_migrations").pluck().get()).toBe(24);
    for (const table of ["process_types", "logistics_targets", "task_target_bindings"]) expect(db.prepare("SELECT 1 FROM sqlite_schema WHERE name=?").get(table)).toBeUndefined();
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1); expect(db.pragma("foreign_key_check")).toEqual([]);
    const corrupt = migrations(join(dir, "checksum"), 27);
    writeFileSync(join(corrupt, "0024_project_master_relations.sql"), readFileSync(join(corrupt, "0024_project_master_relations.sql"), "utf8") + "\n-- changed after application\n");
    expect(() => runMigrations(db, corrupt)).toThrow("Checksum mismatch");
    const gap = migrations(join(dir, "gap"), 27); rmSync(join(gap, "0025_process_catalog.sql"));
    expect(() => runMigrations(db, gap)).toThrow("expected version 25"); expect(evidence(db)).toEqual(before);
    expect(runMigrations(db, migrationDir).applied).toHaveLength(3); assertLedger(db); expect(evidence(db)).toEqual(before);
  });
});
