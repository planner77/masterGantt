import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsConflictError, LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import {
  ProjectMasterItemInUseError,
  ProjectMasterProcessMappingInUseError,
  ProjectMasterRelationInUseError,
  ProjectMasterService,
} from "../../../src/server/project-master/project-master-service-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { hashSessionToken } from "../../../src/server/security/session-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";

const now = new Date("2026-10-12T00:00:00.000Z");
const nowText = now.toISOString();
const databases: Database.Database[] = [];
const fixedHash = async () => ({
  algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2),
  n: 32768, r: 8, p: 3, keyLength: 32,
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const database of databases.splice(0)) database.close();
});

function catalogFixture() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") });
  databases.push(database);
  const masterRepository = new ProjectMasterRepository(database);
  const insertMaster = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) =>
    masterRepository.insertItem({ publicId: randomUUID(), category, code, name: code, active: true, sortOrder: 0, now: nowText });
  const business = insertMaster("BUSINESS_UNIT", "BU");
  const product = insertMaster("PRODUCT", "P");
  const site = insertMaster("SITE_ENTITY", "A");
  const otherSite = insertMaster("SITE_ENTITY", "B");
  masterRepository.addRelation(business.id, product.id, null);
  masterRepository.addRelation(business.id, product.id, site.id);
  masterRepository.addRelation(business.id, product.id, otherSite.id);
  const typeId = Number(database.prepare(`INSERT INTO process_types(public_id,code,name,created_at,updated_at)
    VALUES(?,'ASSEMBLY','조립',?,?)`).run(randomUUID(), nowText, nowText).lastInsertRowid);
  const standardId = Number(database.prepare(`INSERT INTO product_standard_processes
    (public_id,product_id,process_type_id,code,name,created_at,updated_at)
    VALUES(?,?,?,'ASSEMBLY','조립',?,?)`).run(randomUUID(), product.id, typeId, nowText, nowText).lastInsertRowid);
  const occurrenceId = Number(database.prepare(`INSERT INTO site_product_processes
    (public_id,business_unit_id,product_id,site_entity_id,process_type_id,standard_process_id,code,name,created_at,updated_at)
    VALUES(?,?,?,?,?,?,'ASSEMBLY','조립',?,?)`).run(randomUUID(), business.id, product.id, site.id, typeId, standardId, nowText, nowText).lastInsertRowid);
  const workAreaId = Number(database.prepare(`INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at)
    VALUES(?,?,'A','동명 작업구역',?,?)`).run(randomUUID(), occurrenceId, nowText, nowText).lastInsertRowid);
  const master = new ProjectMasterService(database, { clock: () => now });
  const admin = master.unlockAdmin("Admin123!", "Admin123!")!.rawToken;
  return { database, masterRepository, master, admin, business, product, site, otherSite, occurrenceId, workAreaId };
}

async function projectFixture(mapped = true) {
  const fixture = catalogFixture();
  const { database, business, product, site, occurrenceId, workAreaId } = fixture;
  const projects = new TaskFieldProjectService(database, {
    clock: () => now, hashPassword: fixedHash,
    generateSessionToken: () => ({ rawToken: "source", tokenHash: hashSessionToken("source") }),
  });
  const created = await projects.create({
    name: "원본", description: "유지", ownerName: "QA", editPassword: "pw",
    businessUnitId: business.publicId, productId: product.publicId, siteEntityId: site.publicId,
  });
  const authorized = projects.authorize(created.response.data.project.publicId, "source");
  if (authorized.kind !== "authorized") throw new Error("Missing source authorization");
  const authorization = authorized.authorization;
  const logistics = new LogisticsRepository(database);
  const parent = logistics.insertProcess({ publicId: randomUUID(), projectId: authorization.projectId, code: "PARENT", name: "상위 자유 공정", parentId: null, now: nowText });
  const child = logistics.insertProcess({ publicId: randomUUID(), projectId: authorization.projectId, code: "CHILD", name: "조립", parentId: parent.id, now: nowText });
  const equipment = logistics.insertEquipment({ publicId: randomUUID(), projectId: authorization.projectId, processId: child.id, code: "AMR", name: "AMR", equipmentType: "amr", managementUnit: "unit", quantity: 1, now: nowText });
  if (mapped) database.prepare(`INSERT INTO project_process_occurrence_mappings
    (project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,work_area_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(authorization.projectId, child.id, occurrenceId, business.id, product.id, site.id, workAreaId, nowText, nowText);
  return { ...fixture, projects, authorization, parent, child, equipment, logistics };
}

describe("Issue #615 compatibility of explicit process mappings", () => {
  it("rolls back name and triple changes together, retaining hierarchy, equipment and inactive mappings", async () => {
    const f = await projectFixture();
    const before = f.database.prepare("SELECT * FROM projects WHERE id=?").get(f.authorization.projectId);
    const mapping = f.database.prepare("SELECT * FROM project_process_occurrence_mappings").all();
    expect(() => f.projects.updateMetadata(f.authorization, 1, {
      name: "저장되면 안 됨", siteEntityId: f.otherSite.publicId,
    })).toThrow(ProjectMasterProcessMappingInUseError);
    expect(f.database.prepare("SELECT * FROM projects WHERE id=?").get(f.authorization.projectId)).toEqual(before);
    expect(f.database.prepare("SELECT * FROM project_process_occurrence_mappings").all()).toEqual(mapping);
    expect(f.logistics.findProcessByPublicId(f.authorization.projectId, f.child.publicId)?.parentId).toBe(f.parent.id);
    expect(f.logistics.findEquipmentByPublicId(f.authorization.projectId, f.equipment.publicId)?.processId).toBe(f.child.id);

    f.master.updateItem(f.site.publicId, f.admin, 1, { active: false });
    f.database.prepare("UPDATE site_product_processes SET active=0 WHERE id=?").run(f.occurrenceId);
    f.database.prepare("UPDATE work_areas SET active=0 WHERE id=?").run(f.workAreaId);
    const edited = f.projects.updateMetadata(f.authorization, 1, { name: "관련 없는 이름 수정", siteEntityId: f.site.publicId });
    expect(edited.data.project).toMatchObject({ name: "관련 없는 이름 수정", revision: 2, siteEntity: { id: f.site.publicId, active: false } });
    expect(f.database.prepare("SELECT * FROM project_process_occurrence_mappings").all()).toEqual(mapping);
  });

  it("counts standard and occurrence usage without projects and rejects relation removal before a raw FK error", () => {
    const f = catalogFixture();
    expect(f.masterRepository.usageCount(f.product.id)).toBe(2);
    expect(f.masterRepository.usageCount(f.business.id)).toBe(1);
    expect(f.masterRepository.usageCount(f.site.id)).toBe(1);
    expect(() => f.master.updateItem(f.product.publicId, f.admin, 1, { code: "REPLACED" })).toThrow(ProjectMasterItemInUseError);
    expect(() => f.master.updateItem(f.site.publicId, f.admin, 1, { code: "REPLACED" })).toThrow(ProjectMasterItemInUseError);
    expect(() => f.master.mutateRelation(f.admin, 1, {
      businessUnitId: f.business.publicId, productId: f.product.publicId, siteEntityId: f.site.publicId,
    }, true)).toThrow(ProjectMasterRelationInUseError);
    expect(f.masterRepository.getRevision()).toBe(1);
    expect(f.masterRepository.relationExists(f.business.id, f.product.id, f.site.id)).toBe(true);
  });

  it("copies mappings with new local IDs and stable inactive global IDs while preserving source links", async () => {
    const f = await projectFixture();
    f.database.prepare("UPDATE site_product_processes SET active=0 WHERE id=?").run(f.occurrenceId);
    f.database.prepare("UPDATE work_areas SET active=0 WHERE id=?").run(f.workAreaId);
    const originalMapping = f.database.prepare("SELECT * FROM project_process_occurrence_mappings").get();
    const copy = new ProjectCopyService(f.database, { clock: () => now, hashPassword: fixedHash });
    const copied = await copy.copy(f.authorization, 1, { name: "복사본", description: "", ownerName: "QA", editPassword: "pw" });
    const targetId = (f.database.prepare("SELECT id FROM projects WHERE public_id=?").get(copied.response.data.project.publicId) as { id: number }).id;
    const copiedChild = f.logistics.listProcesses(targetId).find((p) => p.code === "CHILD")!;
    const copiedParent = f.logistics.listProcesses(targetId).find((p) => p.code === "PARENT")!;
    expect(copiedChild.id).not.toBe(f.child.id);
    expect(copiedChild.parentId).toBe(copiedParent.id);
    expect(f.database.prepare("SELECT * FROM project_process_occurrence_mappings WHERE project_id=?").get(targetId)).toMatchObject({
      project_id: targetId, project_process_id: copiedChild.id, occurrence_id: f.occurrenceId, work_area_id: f.workAreaId,
    });
    expect(f.logistics.listEquipment(targetId)[0].processId).toBe(copiedChild.id);
    expect(f.database.prepare("SELECT * FROM project_process_occurrence_mappings WHERE project_id=?").get(f.authorization.projectId)).toEqual(originalMapping);
    expect(copied.response.data.project.revision).toBe(1);
  });

  it("rejects a changed copy destination triple atomically", async () => {
    const f = await projectFixture();
    const original = ProjectMasterService.prototype.copyProjectSelection;
    vi.spyOn(ProjectMasterService.prototype, "copyProjectSelection").mockImplementation(function (this: ProjectMasterService, source, target) {
      const warnings = original.call(this, source, target);
      f.database.prepare("UPDATE projects SET site_entity_id=? WHERE id=?").run(f.otherSite.id, target);
      return warnings;
    });
    const copy = new ProjectCopyService(f.database, { clock: () => now, hashPassword: fixedHash });
    await expect(copy.copy(f.authorization, 1, { name: "다른 범위", description: "", editPassword: "pw" })).rejects.toBeInstanceOf(LogisticsConflictError);
    expect(f.database.prepare("SELECT count(*) AS count FROM projects").get()).toEqual({ count: 1 });
    expect(f.database.prepare("SELECT count(*) AS count FROM project_processes").get()).toEqual({ count: 2 });
    expect(f.database.prepare("SELECT count(*) AS count FROM project_process_occurrence_mappings").get()).toEqual({ count: 1 });
  });

  it("roundtrips explicit process occurrence and WorkArea in Template v2", async () => {
    const f = await projectFixture();
    const templates = new ProjectTemplateService(f.database, { clock: () => now, hashPassword: fixedHash });
    const template = templates.createTemplateFromProject(f.authorization, 1, { name: "F2 공정 보존" });
    const row = f.database.prepare("SELECT content_json FROM project_templates WHERE public_id=?").get(template.id) as {content_json:string};
    const saved = JSON.parse(row.content_json);
    expect(saved.logistics.schemaVersion).toBe(2);
    expect(saved.logistics.processMappings).toHaveLength(1);
    const created = await templates.instantiateProject(template.id, {
      name: "F2 신규 Project", ownerName: "QA", editPassword: "pw", projectStartDate: "2026-10-12",
    });
    const copiedId = (f.database.prepare("SELECT id FROM projects WHERE public_id=?")
      .get(created.response.data.project.publicId) as {id:number}).id;
    const mappings = f.database.prepare("SELECT occurrence_id,work_area_id FROM project_process_occurrence_mappings WHERE project_id=?").all(copiedId) as Array<{occurrence_id:number;work_area_id:number|null}>;
    expect(mappings).toHaveLength(1);
    expect(mappings[0].occurrence_id).toBe(f.occurrenceId);
    expect(mappings[0].work_area_id).toBe(f.workAreaId);
    expect(created.response.data.operation.counts.processMappings).toBe(1);
    expect(f.projects.getReadonlySnapshot(f.authorization.projectPublicId)?.data.project.revision).toBe(1);
  });

  it("preserves unmapped legacy metadata edits, copy and Template instantiation without auto mapping", async () => {
    const f = await projectFixture(false);
    const edited = f.projects.updateMetadata(f.authorization, 1, { name: "legacy", siteEntityId: f.otherSite.publicId });
    expect(edited.data.project.revision).toBe(2);
    const templates = new ProjectTemplateService(f.database, { clock: () => now, hashPassword: fixedHash });
    const template = templates.createTemplateFromProject(f.authorization, 2, { name: "legacy template" });
    const instantiated = await templates.instantiateProject(template.id, { name: "재사용", ownerName: "QA", editPassword: "pw", projectStartDate: "2026-10-12" });
    const instantiatedId = (f.database.prepare("SELECT id FROM projects WHERE public_id=?").get(instantiated.response.data.project.publicId) as { id: number }).id;
    expect(f.logistics.listProcesses(instantiatedId)).toHaveLength(2);
    const copy = new ProjectCopyService(f.database, { clock: () => now, hashPassword: fixedHash });
    const copied = await copy.copy(f.authorization, 2, { name: "legacy copy", description: "", editPassword: "pw" });
    expect(copied.response.data.logistics?.processes).toHaveLength(2);
    expect(f.database.prepare("SELECT count(*) AS count FROM project_process_occurrence_mappings").get()).toEqual({ count: 0 });
  });

  it("allows deactivation but refuses permanent deletion of an otherwise unused mapped process", async () => {
    const f = await projectFixture();
    const standalone = f.logistics.insertProcess({ publicId: randomUUID(), projectId: f.authorization.projectId, code: "ISOLATED", name: "독립", parentId: null, now: nowText });
    f.database.prepare(`INSERT INTO project_process_occurrence_mappings
      (project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(f.authorization.projectId, standalone.id, f.occurrenceId, f.business.id, f.product.id, f.site.id, nowText, nowText);
    const service = new LogisticsService(f.database, { clock: () => now });
    expect(() => service.deleteProcess(f.authorization, 1, standalone.publicId, true)).toThrow(expect.objectContaining({ code: "PROCESS_IN_USE" }));
    expect(f.projects.getReadonlySnapshot(f.authorization.projectPublicId)?.data.project.revision).toBe(1);
    expect(service.deleteProcess(f.authorization, 1, standalone.publicId, false).data.project.revision).toBe(2);
    expect(f.logistics.findProcessByPublicId(f.authorization.projectId, standalone.publicId)?.active).toBe(0);
    expect(f.database.prepare("SELECT count(*) AS count FROM project_process_occurrence_mappings").get()).toEqual({ count: 2 });
  });
});
