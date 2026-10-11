import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProcessCatalogKind } from "../../../src/contracts/process-catalog";
import { openDatabase } from "../../../src/server/db/core";
import { runMigrations } from "../../../src/server/db/migrations";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { ProcessCatalogService } from "../../../src/server/process-catalog/process-catalog-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { ProcessCatalogRepository } from "../../../src/server/repositories/process-catalog-repository-core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";

const now = new Date("2026-10-12T01:00:00Z");
const migrationsDirectory = join(process.cwd(), "db/migrations");
const databases: Database.Database[] = [];
const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const database of databases.splice(0)) if (database.open) database.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function setup(filename = ":memory:", migrations = migrationsDirectory) {
  const { database } = openDatabase({ filename, migrationsDirectory: migrations });
  databases.push(database);
  const master = new ProjectMasterRepository(database);
  const admin = createSessionToken();
  master.insertAdminSession({ tokenHash: admin.tokenHash, createdAt: now.toISOString(), expiresAt: sessionExpiry(now).toISOString() });
  const item = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) => master.insertItem({ publicId: randomUUID(), category, code, name: code, active: true, sortOrder: 0, now: now.toISOString() });
  const businessUnit = item("BUSINESS_UNIT", "BU");
  const otherBusinessUnit = item("BUSINESS_UNIT", "BU2");
  const product = item("PRODUCT", "PRODUCT");
  const otherProduct = item("PRODUCT", "OTHER");
  const site = item("SITE_ENTITY", "SITE-A");
  const siteB = item("SITE_ENTITY", "SITE-B");
  for (const bu of [businessUnit, otherBusinessUnit]) {
    database.prepare("INSERT INTO business_unit_products VALUES (?,?)").run(bu.id, product.id);
    for (const selectedSite of [site, siteB]) database.prepare("INSERT INTO business_unit_product_sites VALUES (?,?,?)").run(bu.id, product.id, selectedSite.id);
  }
  const triple = { businessUnitId: businessUnit.publicId, productId: product.publicId, siteEntityId: site.publicId };
  const project = new ProjectRepository(database).insert({ publicId: randomUUID(), name: "Legacy Project", description: "", status: "planned", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: now.toISOString(), updatedAt: now.toISOString() });
  database.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?").run(businessUnit.id, product.id, site.id, project.id);
  const editor = createSessionToken();
  new EditSessionRepository(database).insert({ projectId: project.id, tokenHash: editor.tokenHash, authVersion: project.authVersion, createdAt: now.toISOString(), expiresAt: sessionExpiry(now).toISOString() });
  const result = new TaskFieldProjectService(database, { clock: () => now }).authorize(project.publicId, editor.rawToken);
  if (result.kind !== "authorized") throw new Error("Fixture authorization failed");
  const authorization = result.authorization;
  const projectRevision = () => new ProjectRepository(database).findByPublicId(project.publicId)!.revision;
  const process = new LogisticsService(database, { clock: () => now }).createProcess(authorization, projectRevision(), { code: "LEGACY", name: "Existing Process" }).data.logistics.processes[0];
  const service = new ProcessCatalogService(database, { clock: () => now });
  const repository = new ProcessCatalogRepository(database);
  const catalog = () => service.getCatalog(admin.rawToken).data;
  const mutate = (kind: ProcessCatalogKind, input: unknown, id: string | null = null) => service.mutate(admin.rawToken, repository.revision(), kind, id ? "update" : "create", id, input).data;
  const apply = (standardIds: string[], selected = triple) => service.applyStandards(admin.rawToken, repository.revision(), { ...selected, standardIds }).data;
  const map = (occurrenceId: string | null, workAreaId: string | null = null) => service.mapProjectProcess(authorization, projectRevision(), process.id, { processCatalogRevision: repository.revision(), occurrenceId, workAreaId }).data;
  return { database, master, admin, businessUnit, otherBusinessUnit, product, otherProduct, site, siteB, triple, project, authorization, process, service, repository, catalog, mutate, apply, map, projectRevision };
}

function seed(f: ReturnType<typeof setup>) {
  const type = f.mutate("types", { code: "ASSEMBLY", name: "Assembly" }).types[0];
  const standard = f.mutate("standards", { code: "STD", name: "Shared", productId: f.product.publicId, processTypeId: type.id }).standards[0];
  const occurrence = f.apply([standard.id]).occurrences[0];
  return { type, standard, occurrence };
}

function temporaryMigrations(include25 = false) {
  const directory = mkdtempSync(join(tmpdir(), "process-catalog-native-"));
  directories.push(directory);
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  for (const name of readdirSync(migrationsDirectory).filter(name => name.endsWith(".sql") && (include25 || Number(name.slice(0, 4)) <= 24))) copyFileSync(join(migrationsDirectory, name), join(migrations, name));
  return { directory, migrations };
}

describe("Process catalog native service contracts", () => {
  it("shares product standards across sites and business units while additions stay local", () => {
    const f = setup(); const { type, standard, occurrence } = seed(f);
    const siteBTriple = { ...f.triple, siteEntityId: f.siteB.publicId };
    const second = f.apply([standard.id], siteBTriple).occurrences.find(o => o.siteEntityId === f.siteB.publicId)!;
    const third = f.apply([standard.id], { ...f.triple, businessUnitId: f.otherBusinessUnit.publicId }).occurrences.find(o => o.businessUnitId === f.otherBusinessUnit.publicId)!;
    f.mutate("occurrences", { ...siteBTriple, code: "LOCAL", name: "Shared", processTypeId: type.id });
    expect(new Set([occurrence.id, second.id, third.id]).size).toBe(3);
    expect(f.catalog().standards).toHaveLength(1);
    expect(f.service.context(f.project.publicId).data.occurrences.map(o => o.id)).toEqual([occurrence.id]);
    expect(f.catalog().occurrences.filter(o => o.source === "site_addition")).toHaveLength(1);
  });

  it("applies standard differences explicitly without changing local project rows or revisions", () => {
    const f = setup(); const { standard, occurrence } = seed(f);
    const beforeProject = f.projectRevision();
    const beforeRows = f.database.prepare("SELECT * FROM project_processes").all();
    f.mutate("standards", { name: "New standard name", sortOrder: 9 }, standard.id);
    expect(f.catalog().occurrences[0].name).toBe("Shared");
    expect(f.service.diff(f.admin.rawToken, f.triple).data.standardDiff.changed).toEqual([{ standardId: standard.id, occurrenceId: occurrence.id, fields: ["name", "sortOrder"], canApply: true }]);
    const applied = f.apply([standard.id]);
    expect(applied.occurrences[0]).toMatchObject({ id: occurrence.id, name: "New standard name", sortOrder: 9 });
    expect(f.database.prepare("SELECT * FROM project_processes").all()).toEqual(beforeRows);
    expect(f.projectRevision()).toBe(beforeProject);
    expect(f.apply([standard.id]).processCatalogRevision).toBe(applied.processCatalogRevision);
    expect(f.mutate("standards", { name: "New standard name" }, standard.id).processCatalogRevision).toBe(applied.processCatalogRevision);
  });

  it("reports retired standards without implicit writes and preserves inactive occurrences during apply", () => {
    const f = setup(); const { standard, occurrence } = seed(f);
    f.mutate("occurrences", { active: false }, occurrence.id);
    f.mutate("standards", { name: "Updated active standard" }, standard.id);
    expect(f.apply([standard.id]).occurrences[0]).toMatchObject({ id: occurrence.id, active: false, name: "Updated active standard" });
    f.mutate("standards", { active: false, name: "Retired renamed standard" }, standard.id);
    const before = f.catalog();
    const diff = f.service.diff(f.admin.rawToken, f.triple).data.standardDiff;
    expect(diff.retiredOccurrenceIds).toEqual([occurrence.id]);
    expect(diff.changed).toEqual([{ standardId: standard.id, occurrenceId: occurrence.id, fields: ["name"], canApply: false }]);
    expect(diff.missingStandardIds).toEqual([]);
    expect(f.catalog()).toEqual(before);
    expect(() => f.apply([standard.id])).toThrowError(expect.objectContaining({ status: 409, code: "PROCESS_CATALOG_INACTIVE" }));
    expect(f.catalog()).toEqual(before);
  });

  it("rolls back a multi-standard apply when a later local code collides", () => {
    const f = setup(); const { type } = seed(f);
    const createStandard = (code: string) => f.mutate("standards", { code, name: code, productId: f.product.publicId, processTypeId: type.id }).standards.find(s => s.code === code)!;
    const first = createStandard("FIRST"); const collision = createStandard("COLLISION");
    f.mutate("occurrences", { ...f.triple, code: collision.code, name: "Local", processTypeId: type.id });
    const before = f.catalog();
    expect(() => f.apply([first.id, collision.id])).toThrowError(expect.objectContaining({ status: 409, code: "PROCESS_CATALOG_CONFLICT" }));
    expect(f.catalog()).toEqual(before);
  });

  it("converts duplicate codes at every catalog level to409 without revision or partial writes", () => {
    const f = setup(); const { type, standard, occurrence } = seed(f);
    f.mutate("workAreas", { occurrenceId: occurrence.id, code: "WA", name: "Area" });
    const cases: Array<[ProcessCatalogKind, unknown]> = [
      ["types", { code: type.code, name: "Duplicate" }],
      ["standards", { code: standard.code, name: "Duplicate", productId: f.product.publicId, processTypeId: type.id }],
      ["occurrences", { ...f.triple, code: occurrence.code, name: "Duplicate", processTypeId: type.id }],
      ["workAreas", { occurrenceId: occurrence.id, code: "WA", name: "Duplicate" }],
    ];
    const before = f.catalog();
    for (const [kind, input] of cases) {
      expect(() => f.mutate(kind, input)).toThrowError(expect.objectContaining({ status: 409, code: "PROCESS_CATALOG_CONFLICT" }));
      expect(f.catalog()).toEqual(before);
    }
  });

  it("rejects the201st catalog entity and rolls back its revision instead of truncating", () => {
    const f = setup();
    for (let index = 0; index < 199; index++) f.repository.insert("types", randomUUID(), { code: `TYPE${index}`, name: `Type ${index}`, active: 1, sort_order: index }, now.toISOString());
    const before = f.mutate("types", { code: "TYPE199", name: "Type 199" });
    expect(before.types).toHaveLength(200);
    expect(() => f.mutate("types", { code: "OVERFLOW", name: "Overflow" })).toThrowError(expect.objectContaining({ status: 422, code: "PROCESS_CATALOG_LIMIT_EXCEEDED" }));
    expect(f.catalog()).toEqual(before);
  });

  it("enforces usage, immutable type code, exclusive WorkArea identity, and distinct same-name IDs", () => {
    const f = setup(); const { type, standard, occurrence } = seed(f);
    const other = f.mutate("occurrences", { ...f.triple, code: "SECOND", name: "Shared", processTypeId: type.id }).occurrences.find(o => o.code === "SECOND")!;
    const area = f.mutate("workAreas", { occurrenceId: occurrence.id, code: "WA", name: "Same" }).workAreas[0];
    const otherArea = f.mutate("workAreas", { occurrenceId: other.id, code: "WA", name: "Same" }).workAreas.find(w => w.occurrenceId === other.id)!;
    expect(area.id).not.toBe(otherArea.id);
    expect(() => f.mutate("workAreas", { occurrenceId: other.id }, area.id)).toThrowError(expect.objectContaining({ code: "WORK_AREA_REPARENT_FORBIDDEN" }));
    expect(() => f.mutate("types", { code: "RENAMED" }, type.id)).toThrowError(expect.objectContaining({ code: "PROCESS_TYPE_CODE_IMMUTABLE" }));
    expect(() => f.mutate("standards", { productId: f.otherProduct.publicId }, standard.id)).toThrowError(expect.objectContaining({ code: "PROCESS_CATALOG_IN_USE" }));
    expect(() => f.service.mutate(f.admin.rawToken, f.repository.revision(), "occurrences", "delete", occurrence.id, {})).toThrowError(expect.objectContaining({ code: "PROCESS_CATALOG_IN_USE" }));
    const revision = f.projectRevision();
    expect(f.map(occurrence.id).project.revision).toBe(revision + 1);
    expect(f.map(occurrence.id).operation.changed).toBe(false);
    expect(() => f.map(occurrence.id, otherArea.id)).toThrowError(expect.objectContaining({ code: "WORK_AREA_OCCURRENCE_MISMATCH" }));
    expect(f.projectRevision()).toBe(revision + 1);
  });

  it("allows assembly WorkAreas A/B and inspection without WorkArea in the same project", () => {
    const f = setup(); const { occurrence: assembly } = seed(f);
    const inspectionType = f.mutate("types", { code: "INSPECTION", name: "검사" }).types.find(t => t.code === "INSPECTION")!;
    const inspection = f.mutate("occurrences", { ...f.triple, code: "INSPECT", name: "검사", processTypeId: inspectionType.id }).occurrences.find(o => o.code === "INSPECT")!;
    const createArea = (code: string) => f.mutate("workAreas", { occurrenceId: assembly.id, code, name: code }).workAreas.find(w => w.code === code)!;
    const areaA = createArea("A"); const areaB = createArea("B");
    const context = f.service.context(f.project.publicId).data;
    expect(context.workAreas.filter(w => w.occurrenceId === assembly.id).map(w => w.id)).toEqual([areaA.id, areaB.id]);
    expect(context.workAreas.filter(w => w.occurrenceId === inspection.id)).toEqual([]);
    expect(f.map(assembly.id, areaA.id).mappings[0].workAreaId).toBe(areaA.id);
    expect(f.map(assembly.id, areaB.id).mappings[0].workAreaId).toBe(areaB.id);
    expect(f.map(inspection.id).mappings[0]).toMatchObject({ occurrenceId: inspection.id, workAreaId: null });
    const revision = f.projectRevision(); const before = f.repository.rawMappings(f.project.id);
    expect(() => f.map(inspection.id, areaA.id)).toThrowError(expect.objectContaining({ code: "WORK_AREA_OCCURRENCE_MISMATCH" }));
    expect(f.repository.rawMappings(f.project.id)).toEqual(before);
    expect(f.projectRevision()).toBe(revision);
  });

  it.each(["type", "standard", "businessUnit", "product", "site"] as const)("rejects new WorkArea/mapping through inactive %s and retains existing mapping", inactive => {
    const f = setup(); const { type, standard, occurrence } = seed(f);
    const area = f.mutate("workAreas", { occurrenceId: occurrence.id, code: "WA", name: "Area" }).workAreas[0];
    f.map(occurrence.id);
    if (inactive === "type") f.mutate("types", { active: false }, type.id);
    else if (inactive === "standard") f.mutate("standards", { active: false }, standard.id);
    else f.database.prepare("UPDATE project_master_items SET active=0 WHERE id=?").run(f[inactive].id);
    const before = f.catalog(); const projectRevision = f.projectRevision();
    expect(() => f.mutate("workAreas", { occurrenceId: occurrence.id, code: "NEW", name: "New" })).toThrowError(expect.objectContaining({ code: "PROCESS_CATALOG_INACTIVE" }));
    expect(() => f.map(occurrence.id, area.id)).toThrowError(expect.objectContaining({ code: "PROCESS_CATALOG_INACTIVE" }));
    expect(f.map(occurrence.id).operation.changed).toBe(false);
    expect(f.repository.mappings(f.project.id, 200)[0].active).toBe(false);
    expect(f.catalog()).toEqual(before);
    expect(f.projectRevision()).toBe(projectRevision);
    expect(f.map(null).operation.changed).toBe(true);
  });

  it("bounds complete context, retains mapped inactive entries, and reports invalid legacy selections", () => {
    const f = setup(); const { standard, occurrence } = seed(f);
    f.map(occurrence.id);
    f.mutate("occurrences", { active: false }, occurrence.id);
    const context = f.service.context(f.project.publicId, { active: true, search: "not-matching" }).data;
    expect(context.selection).toEqual(f.triple);
    expect(context.projectMasterRevision).toBe(f.master.getRevision());
    expect(context.occurrences.map(o => o.id)).toEqual([occurrence.id]);
    expect(context.standards.map(s => s.id)).toEqual([standard.id]);
    expect(context.mappings[0].active).toBe(false);
    f.map(null);
    f.database.prepare("DELETE FROM business_unit_product_sites WHERE business_unit_id=? AND product_id=? AND site_entity_id=?").run(f.otherBusinessUnit.id, f.product.id, f.siteB.id);
    f.database.prepare("UPDATE projects SET business_unit_id=?,site_entity_id=? WHERE id=?").run(f.otherBusinessUnit.id, f.siteB.id, f.project.id);
    expect(f.service.context(f.project.publicId).data).toMatchObject({ selectionValid: false, types: [], standards: [], occurrences: [], workAreas: [] });
  });

  it("includes local process activity in effective mapping state and permits retained inactive references", () => {
    const f = setup(); const { occurrence } = seed(f);
    f.map(occurrence.id);
    f.database.prepare("UPDATE project_processes SET active=0 WHERE project_id=?").run(f.project.id);
    expect(f.map(occurrence.id)).toMatchObject({ operation: { changed: false }, mappings: [{ active: false }] });
    f.map(null);
    expect(() => f.map(occurrence.id)).toThrowError(expect.objectContaining({ code: "PROCESS_CATALOG_INACTIVE" }));
  });

  it("uses fixed query count and indexed triple lookup independently of occurrence count", () => {
    const f = setup(); const { type } = seed(f);
    const measure = () => {
      const spy = vi.spyOn(f.database, "prepare");
      f.service.context(f.project.publicId);
      const count = spy.mock.calls.length;
      spy.mockRestore(); return count;
    };
    const first = measure();
    for (let index = 0; index < 30; index++) f.mutate("occurrences", { ...f.triple, processTypeId: type.id, code: `LOCAL${index}`, name: `Local ${index}`, sortOrder: index });
    expect(measure()).toBe(first);
    const plan = f.database.prepare("EXPLAIN QUERY PLAN SELECT * FROM site_product_processes WHERE business_unit_id=? AND product_id=? AND site_entity_id=?").all(f.businessUnit.id, f.product.id, f.site.id) as Array<{ detail: string }>;
    expect(plan.some(row => /SEARCH site_product_processes USING INDEX/.test(row.detail))).toBe(true);
    expect(() => f.service.context(f.project.publicId, { limit: 5 })).toThrowError(expect.objectContaining({ status: 422, code: "PROCESS_CATALOG_LIMIT_EXCEEDED" }));
    expect(f.service.getCatalog(f.admin.rawToken, { search: "LOCAL29", limit: 1 }).data.occurrences.map(o => o.code)).toEqual(["LOCAL29"]);
    console.info(`Process context prepare count: ${first}; triple plan: ${plan.map(row => row.detail).join("; ")}`);
  });
});

describe("Process catalog migration persistence and SQLite guards", () => {
  it("upgrades legacy version24 without inferred mappings and persists explicit mapping on restart", () => {
    const { directory, migrations } = temporaryMigrations();
    const filename = join(directory, "catalog.sqlite3");
    const f = setup(filename, migrations);
    const legacyRows = f.database.prepare("SELECT * FROM project_processes").all();
    const beforeRevision = f.projectRevision();
    expect(runMigrations(f.database, migrationsDirectory).applied).toEqual(["0025_process_catalog.sql"]);
    expect(f.database.prepare("SELECT * FROM project_processes").all()).toEqual(legacyRows);
    expect(f.repository.rawMappings(f.project.id)).toEqual([]);
    expect(f.projectRevision()).toBe(beforeRevision);
    const { occurrence } = seed(f);
    f.map(occurrence.id);
    const mapped = f.repository.rawMappings(f.project.id);
    f.database.close();
    const reopened = openDatabase({ filename, migrationsDirectory }); databases.push(reopened.database);
    expect(reopened.migrations.applied).toEqual([]);
    expect(new ProcessCatalogRepository(reopened.database).rawMappings(f.project.id)).toEqual(mapped);
    expect(reopened.database.pragma("foreign_key_check")).toEqual([]);
  });

  it("rolls back all new schema and ledger changes when migration25 fails", () => {
    const { migrations } = temporaryMigrations();
    const f = setup(":memory:", migrations);
    const before = f.database.prepare("SELECT * FROM project_processes").all();
    writeFileSync(join(migrations, "0025_process_catalog.sql"), `${readFileSync(join(migrationsDirectory, "0025_process_catalog.sql"), "utf8")}\nINSERT INTO does_not_exist VALUES(1);`);
    expect(() => runMigrations(f.database, migrations)).toThrow("changes were rolled back");
    expect(f.database.prepare("SELECT max(version) version FROM schema_migrations").get()).toEqual({ version: 24 });
    expect(f.database.prepare("SELECT name FROM sqlite_schema WHERE name='process_types'").get()).toBeUndefined();
    expect(f.database.prepare("SELECT * FROM project_processes").all()).toEqual(before);
    expect(f.database.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("enforces raw SQL mapping triple, WorkArea parent, standard identity, and Project reparent guards", () => {
    const f = setup(); const { type, standard, occurrence } = seed(f);
    const other = f.mutate("occurrences", { ...f.triple, code: "OTHER", name: "Other", processTypeId: type.id }).occurrences.find(o => o.code === "OTHER")!;
    const area = f.mutate("workAreas", { occurrenceId: other.id, code: "WA", name: "Area" }).workAreas[0];
    const rawOccurrence = f.repository.find("occurrences", occurrence.id)!;
    const rawOther = f.repository.find("occurrences", other.id)!;
    const rawArea = f.repository.find("workAreas", area.id)!;
    expect(() => f.database.prepare("UPDATE work_areas SET occurrence_id=? WHERE id=?").run(rawOccurrence.id, rawArea.id)).toThrow("WORK_AREA_REPARENT_FORBIDDEN");
    expect(() => f.database.prepare("UPDATE site_product_processes SET standard_process_id=?,product_id=? WHERE id=?").run(f.repository.find("standards", standard.id)!.id, f.otherProduct.id, rawOther.id)).toThrow();
    f.map(occurrence.id);
    expect(() => f.database.prepare("UPDATE project_process_occurrence_mappings SET work_area_id=? WHERE project_id=?").run(rawArea.id, f.project.id)).toThrow("FOREIGN KEY");
    expect(() => f.database.prepare("UPDATE projects SET site_entity_id=? WHERE id=?").run(f.siteB.id, f.project.id)).toThrow("PROJECT_PROCESS_MAPPING_IN_USE");
    expect(() => f.database.prepare("UPDATE project_process_occurrence_mappings SET business_unit_id=? WHERE project_id=?").run(f.otherBusinessUnit.id, f.project.id)).toThrow("PROJECT_PROCESS_MAPPING_TRIPLE_MISMATCH");
    expect(f.database.pragma("foreign_key_check")).toEqual([]);
  });
});
