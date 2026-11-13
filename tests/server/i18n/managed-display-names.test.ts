import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";
import { LogisticsDashboardService } from "../../../src/server/logistics/logistics-dashboard-service";
import type { WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";
import { readResourceTargetSnapshot } from "../../../src/server/repositories/resource-target-snapshot-repository-core";
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { runMigrations } from "../../../src/server/db/migrations";
import { ProjectMasterService, ProjectMasterAuthorizationError, ProjectMasterRevisionMismatchError } from "../../../src/server/project-master/project-master-service-core";
import { LogisticsTypeCatalogService } from "../../../src/server/logistics/logistics-type-catalog-service-core";
import { ProcessCatalogService } from "../../../src/server/process-catalog/process-catalog-service-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { ProjectRepository, EditSessionRepository } from "../../../src/server/repositories/project-repository-core";
import { ProjectWorkAreaRepository } from "../../../src/server/repositories/project-work-area-repository-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";
import { parseDisplayNameTranslations, readDisplayNameTranslations, writeDisplayNameTranslations } from "../../../src/server/repositories/display-name-translations-repository-core";
import { handleCreateProjectMasterItem } from "../../../src/server/project-master/project-master-handlers-core";
import { handleCreateProcess } from "../../../src/server/logistics/logistics-handlers-core";
import { projectMasterAdminCookieName } from "../../../src/server/security/project-master-admin-cookie-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { assertScheduleContextExportSupported } from "../../../src/server/exports/project-context-export-guard-core";

const now = new Date("2026-11-03T09:00:00Z"), migrationsDirectory = join(process.cwd(), "db/migrations");
const connections: Database.Database[] = [], directories: string[] = [];
afterEach(() => { connections.splice(0).forEach(db => { if (db.open) db.close(); }); directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
function setup(filename = ":memory:") {
  const { database: db } = openDatabase({ filename, migrationsDirectory }); connections.push(db);
  const master = new ProjectMasterService(db, { clock: () => now });
  const masterToken = master.unlockAdmin("Admin123!", "Admin123!")!.rawToken;
  const types = new LogisticsTypeCatalogService(db, { clock: () => now });
  const typeToken = types.unlockAdmin("Type123!", "Type123!")!.rawToken;
  const resources = new ResourceCatalogService(db, { clock: () => now });
  const resourceToken = resources.unlockAdmin("Group123!", "Group123!")!.rawToken;
  const catalog = new ProcessCatalogService(db, { clock: () => now }), logistics = new LogisticsService(db, { clock: () => now });
  const projects = new ProjectRepository(db), projectService = new TaskFieldProjectService(db, { clock: () => now });
  function project() {
    const row = projects.insert({ publicId: randomUUID(), name: "Project 원문", description: "", status: "planned", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: now.toISOString(), updatedAt: now.toISOString() });
    const token = createSessionToken(); new EditSessionRepository(db).insert({ projectId: row.id, tokenHash: token.tokenHash, authVersion: row.authVersion, createdAt: now.toISOString(), expiresAt: sessionExpiry(now).toISOString() });
    const auth = projectService.authorize(row.publicId, token.rawToken); if (auth.kind !== "authorized") throw new Error("fixture authorization");
    return { row, auth: auth.authorization, token: token.rawToken, revision: () => projects.findById(row.id)!.revision };
  }
  return { db, master, masterToken, types, typeToken, resources, resourceToken, catalog, logistics, project, projectService };
}
const translations = { ko: "조립 표시명", en: "Assembly", vi: "Lắp ráp" };

describe("#866 manual managed display names", () => {
  it("normalizes NFC/trim, removes cleared entries and rejects invalid locale/size/control/unpaired input", () => {
    const invalid = () => { throw new Error("invalid"); };
    expect(parseDisplayNameTranslations({ vi: "  La\u0306\u0301p ra\u0301p  ", en: " " }, invalid)).toEqual({ vi: "Lắp ráp" });
    expect(parseDisplayNameTranslations({}, invalid)).toEqual({});
    expect(parseDisplayNameTranslations(undefined, invalid)).toBeUndefined();
    for (const input of [null, [], { fr: "Nom" }, { en: 123 }, { en: "x".repeat(201) }, { en: "a\n" }, { en: "\ud800" }, { en: "\u0000" }]) expect(() => parseDisplayNameTranslations(input, invalid)).toThrow("invalid");
  });

  it("persists optional translations for every global owner without changing IDs, original names or uniqueness", () => {
    const f = setup();
    const createMaster = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) => f.master.createItem(f.masterToken, f.master.getAdminCatalog(f.masterToken).data.revision, { category, code, name: "원문", translations }).data.items.find(row => row.category === category && row.code === code)!;
    const bu = createMaster("BUSINESS_UNIT", "BU"), product = createMaster("PRODUCT", "PRODUCT"), site = createMaster("SITE_ENTITY", "SITE");
    for (const row of [bu, product, site]) expect(row).toMatchObject({ name: "원문", translations });
    const globalRevision = () => f.master.getAdminCatalog(f.masterToken).data.revision;
    f.master.mutateRelation(f.masterToken, globalRevision(), { businessUnitId: bu.id, productId: product.id }, false);
    f.master.mutateRelation(f.masterToken, globalRevision(), { businessUnitId: bu.id, productId: product.id, siteEntityId: site.id }, false);
    const catalogRevision = () => f.catalog.getCatalog(f.masterToken).data.processCatalogRevision;
    const type = f.catalog.mutate(f.masterToken, catalogRevision(), "types", "create", null, { code: "TYPE", name: "공정 원문", translations }).data.types[0];
    const standard = f.catalog.mutate(f.masterToken, catalogRevision(), "standards", "create", null, { code: "STD", name: "표준 원문", translations, productId: product.id, processTypeId: type.id }).data.standards[0];
    const occurrence = f.catalog.mutate(f.masterToken, catalogRevision(), "occurrences", "create", null, { code: "OCC", name: "현장 원문", translations, businessUnitId: bu.id, productId: product.id, siteEntityId: site.id, processTypeId: type.id }).data.occurrences[0];
    const workArea = f.catalog.mutate(f.masterToken, catalogRevision(), "workAreas", "create", null, { code: "AREA", name: "공유 구역 원문", translations, occurrenceId: occurrence.id }).data.workAreas[0];
    for (const row of [type, standard, occurrence, workArea]) expect(row.translations).toEqual(translations);
    expect(f.catalog.getCatalog(f.masterToken, { search: "Lắp ráp" }).data.occurrences.map(row => row.id)).toEqual([occurrence.id]);
    for (const kind of ["equipment", "system"] as const) {
      const catalog = f.types.create(kind, f.typeToken, f.types.getCatalog(f.typeToken).data.revision, { code: "manual", name: "유형 원문", translations });
      expect((kind === "equipment" ? catalog.data.equipmentTypes : catalog.data.systemTypes).find(row => row.code === "manual")).toMatchObject({ name: "유형 원문", translations });
      expect((kind === "equipment" ? f.types.getActiveCatalog().data.equipmentTypes : f.types.getActiveCatalog().data.systemTypes).find(row => row.code === "manual")!.translations).toEqual(translations);
    }
    const group = f.resources.createTarget("group", f.resourceToken, 1, { name: "그룹 원문", translations }).data.groups[0];
    expect(group).toMatchObject({ name: "그룹 원문", translations });
    expect(() => f.resources.createTarget("resource", f.resourceToken, 2, { name: "개인 원문", translations })).toThrow();
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
    const ownerTables = f.db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE '%_translations' ORDER BY name").all();
    expect(ownerTables).toHaveLength(12);
  });

  it("keeps project owner isolation, exact revision, deletion cascade, optional omission and explicit clearing", () => {
    const f = setup(), owner = f.project(), other = f.project();
    const created = f.logistics.createProcess(owner.auth, owner.revision(), { name: "공정 원문", translations });
    const process = created.data.logistics.processes[0];
    const areaResponse = f.logistics.mutateWorkArea(owner.auth, owner.revision(), "create", process.id, { name: "구역 원문", translations });
    const area = new ProjectWorkAreaRepository(f.db).list(owner.row.id)[0];
    expect(area).toMatchObject({ name: "구역 원문", translations });
    expect(areaResponse.data.operation.targetPublicId).toBe(area.id);
    const equipment = f.logistics.createEquipment(owner.auth, owner.revision(), { processId: process.id, code: "EQ", name: "설비 원문", equipmentType: "amr", managementUnit: "unit", quantity: 1, translations }).data.logistics.equipment[0];
    const system = f.logistics.createSystem(owner.auth, owner.revision(), { code: "SYS", name: "시스템 원문", systemType: "mcs", layer: "controller", scope: "project", translations }).data.logistics.systems[0];
    expect(equipment).toMatchObject({ name: "설비 원문", translations }); expect(system).toMatchObject({ name: "시스템 원문", translations });
    const revision = owner.revision();
    expect(() => f.logistics.updateProcess(owner.auth, revision - 1, process.id, { translations: {} })).toThrow();
    expect(() => f.logistics.updateProcess(other.auth, other.revision(), process.id, { translations: { en: "foreign" } })).toThrow();
    expect(() => f.logistics.mutateWorkArea(other.auth, other.revision(), "update", area.id, { translations: {} })).toThrow();
    expect(owner.revision()).toBe(revision); expect(f.logistics.getLogisticsDto(other.row.id).processes).toEqual([]);
    const retained = f.logistics.updateProcess(owner.auth, revision, process.id, { name: "변경 원문" }).data.logistics.processes[0];
    expect(retained.translations).toEqual(translations);
    expect(f.logistics.updateProcess(owner.auth, owner.revision(), process.id, { translations: {} }).data.logistics.processes[0]).toMatchObject({ name: "변경 원문" });
    expect(f.logistics.getLogisticsDto(owner.row.id).processes[0].translations).toBeUndefined();
    const areaInternal = new ProjectWorkAreaRepository(f.db).find(owner.row.id, area.id)!.id;
    f.logistics.mutateWorkArea(owner.auth, owner.revision(), "delete", area.id);
    expect(readDisplayNameTranslations(f.db, "project_work_areas", areaInternal)).toEqual({});
    expect(f.db.prepare("SELECT name FROM projects WHERE id=?").pluck().get(owner.row.id)).toBe("Project 원문");
  });

  it("enforces existing HTTP Origin/session/If-Match for translation writes and rejects invalid input transactionally", async () => {
    const f = setup(), project = f.project(), base = "https://gantt.example.test";
    const dependencies = { service: f.master, applicationBaseUrl: base, environment: "production" };
    const request = (headers: Record<string, string>) => new Request(base + "/api/project-master/admin/items", { method: "POST", headers: { Origin: base, "Content-Type": "application/json", "If-Match": '"1"', Cookie: `${projectMasterAdminCookieName("production", new URL(base))}=${f.masterToken}`, ...headers }, body: JSON.stringify({ category: "PRODUCT", code: "SAFE", name: "원문", translations }) });
    for (const [headers, status] of [[{ Origin: "https://evil.test" }, 403], [{ Cookie: "" }, 401], [{ "If-Match": '"0"' }, 400], [{ "If-Match": '"2"' }, 412]] as const) {
      expect((await handleCreateProjectMasterItem(request(headers), dependencies)).status).toBe(status);
    }
    expect(f.master.getAdminCatalog(f.masterToken).data.revision).toBe(1);
    expect((await handleCreateProjectMasterItem(request({}), dependencies)).status).toBe(201);
    const snapshot = f.master.getAdminCatalog(f.masterToken);
    expect(() => f.master.updateItem(snapshot.data.items[0].id, undefined, 2, { translations: {} })).toThrow(ProjectMasterAuthorizationError);
    expect(() => f.master.updateItem(snapshot.data.items[0].id, f.masterToken, 1, { translations: {} })).toThrow(ProjectMasterRevisionMismatchError);
    expect(() => f.master.updateItem(snapshot.data.items[0].id, f.masterToken, 2, { translations: { en: "\u0000" } })).toThrow();
    expect(f.master.getAdminCatalog(f.masterToken)).toEqual(snapshot);
    const processRequest = new Request(base + `/api/projects/${project.row.publicId}/logistics/processes`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json", "If-Match": '"1"', Cookie: `${editSessionCookieName("production", new URL(base))}=${project.token}` }, body: JSON.stringify({ name: "HTTP 원문", translations }) });
    const response = await handleCreateProcess(processRequest, project.row.publicId, { logisticsService: f.logistics, projectService: f.projectService, applicationBaseUrl: base, environment: "production" });
    expect(response.status).toBe(201); expect((await response.json()).data.logistics.processes[0]).toMatchObject({ name: "HTTP 원문", translations });
    expect(() => assertScheduleContextExportSupported(f.db, project.row.id)).toThrowError(expect.objectContaining({ code: "DISPLAY_NAME_TRANSLATIONS_EXPORT_UNSUPPORTED" }));
  });

  it("propagates managed metadata through report/selector snapshots while canonical names, KPI values and population stay unchanged", () => {
    const f = wbsDashboardViewsFixture("mixed"); connections.push(f.database);
    const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
    const baseline = f.service.getDashboard(f.project.publicId, filters)!;
    const beforeRevision = f.database.prepare("SELECT revision FROM projects WHERE id=?").pluck().get(f.project.id);
    const baselineNames = f.database.prepare("SELECT public_id,name FROM project_processes WHERE project_id=? ORDER BY id").all(f.project.id);
    for (const owner of ["project_processes","project_equipment","project_logistics_systems","process_types","site_product_processes","work_areas","resource_groups"]) {
      f.database.prepare(`INSERT INTO ${owner}_translations(owner_id,locale,name) SELECT id,'en',name||' display' FROM ${owner}`).run();
    }
    f.database.prepare("INSERT INTO logistics_equipment_types_translations(owner_code,locale,name) SELECT code,'en',name||' display' FROM logistics_equipment_types").run();
    const report = f.service.getDashboard(f.project.publicId, filters)!;
    expect(report.summary).toEqual(baseline.summary);
    expect(report.catalog.groups.every(row=>row.translations?.en===row.name+' display')).toBe(true);
    expect(report.groups.filter(row=>row.id!==null).every(row=>row.translations?.en===row.name+' display')).toBe(true);
    const targets = readResourceTargetSnapshot(f.database,f.project.id);
    expect(targets.catalog.filter(row=>['projectProcess','process','processType','workArea','equipment','system','equipmentType'].includes(row.dimension)).every(row=>row.translations?.en===row.name+' display')).toBe(true);
    const view = f.service.queryWbsView(f.project.publicId,{spec:{version:"wbs-view:v1",contextSourceVersion:"explicit-task-context:v1",root:"process"},filters}) as WbsViewReportDto;
    expect(view.configurationCatalog.processes.every(row=>row.translations?.en===row.name+' display')).toBe(true);
    expect(view.children.filter(row=>row.selector.id!==null).every(row=>row.translations?.en===row.name+' display')).toBe(true);
    expect(view.configurationCatalog.equipment.every(row=>row.translations?.en===row.name+' display')).toBe(true);
    const logistics = new LogisticsDashboardService(f.database,{clock:()=>new Date(RESOURCE_DASHBOARD_NOW),mdPerMmEnvironment:"20"}).getDashboard(f.project.publicId)!;
    expect([...logistics.breakdowns.processes,...logistics.breakdowns.equipment,...logistics.breakdowns.systems].every(row=>row.translations?.en===row.name+' display')).toBe(true);
    expect(f.database.prepare("SELECT public_id,name FROM project_processes WHERE project_id=? ORDER BY id").all(f.project.id)).toEqual(baselineNames);
    expect(f.database.prepare("SELECT revision FROM projects WHERE id=?").pluck().get(f.project.id)).toBe(beforeRevision);
  });

  it("reads owner name, translations and catalog revision from one SQLite snapshot during a concurrent commit", () => {
    const dir = mkdtempSync(join(tmpdir(),"i18n-catalog-snapshot-")); directories.push(dir);
    const filename = join(dir,"snapshot.sqlite3"), f = setup(filename);
    f.master.createItem(f.masterToken,1,{category:"PRODUCT",code:"PRODUCT",name:"Before",translations:{en:"Before display"}});
    const other = openDatabase({filename,migrationsDirectory}).database; connections.push(other);
    const prepare = f.db.prepare.bind(f.db); let changed = false;
    const spy = vi.spyOn(f.db,"prepare").mockImplementation((sql:string) => {
      if (!changed && sql.includes("FROM project_master_items_translations WHERE")) {
        changed = true;
        other.transaction(()=>{
          other.prepare("UPDATE project_master_items SET name='After'").run();
          other.prepare("UPDATE project_master_items_translations SET name='After display'").run();
          other.prepare("UPDATE project_master_catalog_state SET revision=revision+1 WHERE id=1").run();
        }).immediate();
      }
      return prepare(sql);
    });
    let snapshot;
    try { snapshot = f.master.getAdminCatalog(f.masterToken); } finally { spy.mockRestore(); }
    expect(changed).toBe(true);
    expect(snapshot.data).toMatchObject({revision:2,items:[{name:"Before",translations:{en:"Before display"}}]});
    expect(f.master.getAdminCatalog(f.masterToken).data).toMatchObject({revision:3,items:[{name:"After",translations:{en:"After display"}}]});
  });

  it("adds schema 0036 to a real 0035 database without backfill, preserves original data, and persists after reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "i18n-migration-")); directories.push(dir); const oldDir = join(dir, "old"); mkdirSync(oldDir);
    for (const name of readdirSync(migrationsDirectory).filter(name => Number(name.slice(0, 4)) <= 35)) copyFileSync(join(migrationsDirectory, name), join(oldDir, name));
    const filename = join(dir, "migration.sqlite3"), old = openDatabase({ filename, migrationsDirectory: oldDir }).database; connections.push(old);
    const publicId = randomUUID(), stamp = now.toISOString();
    const inserted = old.prepare("INSERT INTO project_master_items(public_id,category,code,name,active,sort_order,created_at,updated_at) VALUES(?,'PRODUCT','EXISTING','원문',1,0,?,?)").run(publicId, stamp, stamp);
    const before = old.prepare("SELECT * FROM project_master_items").all();
    expect(runMigrations(old, migrationsDirectory).applied).toEqual(["0036_display_name_translations.sql", "0037_project_workspace_tabs.sql", "0038_description_formats.sql", "0039_optional_equipment_process.sql"]);
    expect(old.prepare("SELECT * FROM project_master_items").all()).toEqual(before);
    expect(readDisplayNameTranslations(old, "project_master_items", Number(inserted.lastInsertRowid))).toEqual({});
    old.transaction(() => writeDisplayNameTranslations(old, "project_master_items", Number(inserted.lastInsertRowid), translations)).immediate(); old.close();
    const reopened = openDatabase({ filename, migrationsDirectory }).database; connections.push(reopened);
    expect(readDisplayNameTranslations(reopened, "project_master_items", Number(inserted.lastInsertRowid))).toEqual(translations);
    expect(() => writeDisplayNameTranslations(reopened, "process_types", 999999, translations)).toThrow("FOREIGN KEY");
    expect(reopened.pragma("foreign_key_check")).toEqual([]);
  });
});
