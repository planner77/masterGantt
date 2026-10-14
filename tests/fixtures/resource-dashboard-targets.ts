import { randomUUID } from "node:crypto";
import { resourceDashboardFixture, RESOURCE_DASHBOARD_NOW as now } from "./resource-dashboard";
import { ProjectMasterRepository } from "../../src/server/repositories/project-master-repository-core";
import { LogisticsRepository } from "../../src/server/repositories/logistics-repository-core";
import { ProcessCatalogRepository } from "../../src/server/repositories/process-catalog-repository-core";
import { TaskTargetBindingRepository } from "../../src/server/repositories/task-target-binding-repository-core";

/** Real SQLite graph: A/B share MCS; ACS-only subset, unassigned and Group-only Tasks remain distinct. */
export function resourceDashboardTargetsFixture(filename = ":memory:") {
  const f = resourceDashboardFixture(filename), db = f.database, logistics = new LogisticsRepository(db), masters = new ProjectMasterRepository(db);
  const item = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) => masters.insertItem({ publicId: randomUUID(), category, code, name: code, active: true, sortOrder: 0, now });
  const bu = item("BUSINESS_UNIT", "BU"), product = item("PRODUCT", "PRODUCT"), site = item("SITE_ENTITY", "SITE");
  db.prepare("INSERT INTO business_unit_products(business_unit_id,product_id) VALUES(?,?)").run(bu.id, product.id);
  db.prepare("INSERT INTO business_unit_product_sites(business_unit_id,product_id,site_entity_id) VALUES(?,?,?)").run(bu.id, product.id, site.id);
  db.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?").run(bu.id, product.id, site.id, f.project.id);
  const processTypeId = randomUUID(), occurrenceId = randomUUID(), areaId = randomUUID();
  const type = Number(db.prepare("INSERT INTO process_types(public_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?)").run(processTypeId, "ASSEMBLY", "Assembly", now, now).lastInsertRowid);
  const occurrence = Number(db.prepare("INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(occurrenceId, bu.id, product.id, site.id, type, "OCC", "Occurrence", now, now).lastInsertRowid);
  db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(areaId, occurrence, "AREA", "WorkArea", now, now);
  const process = logistics.insertProcess({ publicId: randomUUID(), projectId: f.project.id, code: "P", name: "Process", parentId: null, active: 1, now });
  new ProcessCatalogRepository(db).setMapping(f.project.id, process.id, new ProcessCatalogRepository(db).find("occurrences", occurrenceId)!, null, now);
  const equipment = [10, 5].map((quantity, index) => logistics.insertEquipment({ publicId: randomUUID(), projectId: f.project.id, processId: process.id, code: `AMR${index}`, name: `AMR${index}`, equipmentType: "amr", managementUnit: "fleet", quantity, now }));
  const systems = ["ACS-A", "ACS-B", "MCS"].map(code => logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code, name: code, systemType: code === "MCS" ? "mcs" : "acs", layer: code === "MCS" ? "coordinator" : "controller", scope: "project", now }));
  const targets = db.transaction(() => ["A", "B"].map((code, index) => {
    const id = randomUUID();
    const target = Number(db.prepare("INSERT INTO logistics_targets(public_id,project_id,code,name,scope,project_process_id,occurrence_id,work_area_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, f.project.id, code, code, "process", process.id, occurrence, index === 0 ? (db.prepare("SELECT id FROM work_areas WHERE public_id=?").get(areaId) as { id: number }).id : null, now, now).lastInsertRowid);
    const memberIds: string[] = [];
    for (const [kind, entity] of [["equipment", equipment[index]], ["system", systems[index]], ["system", systems[2]]] as const) {
      const memberId = randomUUID(); memberIds.push(memberId);
      const member = Number(db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,system_id,created_at) VALUES(?,?,?,?,?,?,?)").run(memberId, f.project.id, target, kind, kind === "equipment" ? entity.id : null, kind === "system" ? entity.id : null, now).lastInsertRowid);
      if (memberIds.length === 1) db.prepare("UPDATE logistics_targets SET anchor_member_id=? WHERE id=?").run(member, target);
    }
    return { id, internalId: target, memberIds };
  }))();
  const bindings = new TaskTargetBindingRepository(db);
  const whole = (targetId: string, taskId: string) => ({ id: randomUUID(), targetId, taskId, selection: "whole" as const, scope: "self" as const, memberIds: [] });
  db.transaction(() => {
    const task = (id: string) => f.tasks.get(id)!;
    bindings.replace(f.project.id, task("T1").id, targets.map(target => whole(target.id, task("T1").publicId)), now);
    bindings.replace(f.project.id, task("T2").id, [{ ...whole(targets[0].id, task("T2").publicId), selection: "subset", memberIds: [targets[0].memberIds[1]] }], now);
    bindings.replace(f.project.id, task("T3").id, [whole(targets[0].id, task("T3").publicId)], now);
    bindings.replace(f.project.id, task("T4").id, [whole(targets[1].id, task("T4").publicId)], now);
    logistics.replaceTaskSystemLinks(f.project.id, task("T5").id, [{ systemId: systems[2].id, scope: "self" }], now);
  })();
  return { ...f, logistics, processTypeId, occurrenceId, areaId, process, equipment, systems, targets };
}
