import { randomUUID } from "node:crypto";
import { resourceDashboardTargetsFixture } from "./resource-dashboard-targets";
import { RESOURCE_DASHBOARD_NOW as now } from "./resource-dashboard";
import { ProcessContextRepository } from "../../src/server/repositories/process-context-repository-core";
import { MilestoneMembershipRepository } from "../../src/server/repositories/milestone-membership-repository-core";
import { TaskTargetBindingRepository } from "../../src/server/repositories/task-target-binding-repository-core";

/** Persisted D1 W1/W2 oracle; all IDs in HTTP assertions are real immutable UUIDs. */
export function wbsDashboardViewsFixture(mode: "direct" | "target" | "mixed" = "mixed", filename = ":memory:") {
  const f = resourceDashboardTargetsFixture(filename), db = f.database;
  db.prepare("DELETE FROM tasks WHERE project_id=?").run(f.project.id);
  db.prepare("DELETE FROM work_calendar_dates WHERE calendar_rule_id IN (SELECT id FROM work_calendar_rules WHERE project_id=?)").run(f.project.id);
  f.tasks.clear(); f.assignmentIds.clear();
  const processB = f.logistics.insertProcess({ publicId: randomUUID(), projectId: f.project.id, code: "PB", name: "검사 공정", parentId: null, active: 1, now });
  const a = db.prepare("SELECT * FROM site_product_processes WHERE public_id=?").get(f.occurrenceId) as Record<string, number>;
  const occurrenceB = randomUUID();
  const occurrenceBId = Number(db.prepare("INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(occurrenceB, a.business_unit_id, a.product_id, a.site_entity_id, a.process_type_id, "OB", "검사 발생", now, now).lastInsertRowid);
  db.prepare("INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(f.project.id, processB.id, occurrenceBId, a.business_unit_id, a.product_id, a.site_entity_id, now, now);
  const areaB = randomUUID();
  const areaBId = Number(db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(areaB, occurrenceBId, "WB", "검사 작업구역", now, now).lastInsertRowid);
  const areaAId = (db.prepare("SELECT id FROM work_areas WHERE public_id=?").get(f.areaId) as { id: number }).id;
  const processA = f.process;
  db.prepare("UPDATE project_processes SET name='조립 공정' WHERE id=?").run(processA.id);
  db.prepare("UPDATE work_areas SET name='조립 작업구역' WHERE id=?").run(areaAId);
  db.prepare("UPDATE project_logistics_systems SET scope='processes' WHERE id=?").run(f.systems[2].id);
  for (const p of [processA, processB]) db.prepare("INSERT INTO project_system_processes(project_id,system_id,process_id,created_at) VALUES(?,?,?,?)").run(f.project.id, f.systems[2].id, p.id, now);
  const contexts = new ProcessContextRepository(db);
  const areaA = { processId: processA.id, occurrenceId: Number(a.id), workAreaId: areaAId };
  const areaBLink = { processId: processB.id, occurrenceId: occurrenceBId, workAreaId: areaBId };
  contexts.replaceEquipment(f.project.id, f.equipment[0].id, [areaA, areaBLink]);
  const idleEquipment = f.logistics.insertEquipment({ publicId: randomUUID(), projectId: f.project.id, processId: processA.id, code: "IDLE", name: "등록만 설비", equipmentType: "amr", managementUnit: "fleet", quantity: 7, now });
  const idleSystem = f.logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: "IDLE-S", name: "등록만 시스템", systemType: "mcs", layer: "coordinator", scope: "project", now });
  const ids = ["S", "M", "T0", "T1", "T2", "T3", "UNASSIGNED", "GROUP_ONLY"];
  for (const id of ids) {
    const type = id === "S" ? "summary" : id === "M" ? "milestone" : "task";
    const row = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: id, name: id, type,
      parentId: id === "T0" ? f.tasks.get("S")!.id : null, scheduleMode: "auto", requestedStart: type === "summary" ? null : "2026-10-05",
      startDate: "2026-10-05", endDate: type === "milestone" ? "2026-10-05" : "2026-10-09", duration: type === "milestone" ? 0 : 5,
      progress: id === "T1" ? 100 : 0, status: id === "T1" ? "completed" : "not_started", sortOrder: ids.indexOf(id), createdAt: now, updatedAt: now });
    f.tasks.set(id, row);
    const processes = id === "S" ? [processB] : id === "T1" ? [processA] : id === "T2" ? [processB] : id === "T3" ? [processA, processB] : [];
    contexts.replaceTask(f.project.id, row.id, { processLinks: processes.map(p => ({ processId: p.id, scope: id === "S" ? "subtree" : "self" })),
      workAreaLinks: id === "T3" ? [areaA, areaBLink].map(area => ({ ...area, scope: "self" })) : [] });
  }
  for (const id of ["T1", "T2", "T3"]) new MilestoneMembershipRepository(db).set(f.project.id, f.tasks.get(id)!.id, f.tasks.get("M")!.id);
  for (let i = 0; i < 4; i++) {
    const id = `T${i}`, task = f.tasks.get(id)!, resource = f.resources.get("R1")!, assignmentId = randomUUID();
    f.assignmentIds.set(`A${i}`, assignmentId);
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [{ publicId: resource.publicId, internalId: resource.id, kind: "resource", assignmentPublicId: assignmentId, assignmentStart: null, assignmentEnd: null, allocationPercent: (i + 2) * 20 }] });
    if (mode !== "target") f.logistics.replaceTaskSystemLinks(f.project.id, task.id, [{ systemId: f.systems[2].id, scope: "self" }], now);
    if (mode !== "direct") {
      const targets = i === 1 ? [f.targets[0]] : i === 2 ? [f.targets[1]] : f.targets;
      new TaskTargetBindingRepository(db).replace(f.project.id, task.id, targets.map(target => ({ id: randomUUID(), taskId: task.publicId, targetId: target.id, scope: "self", selection: "whole", memberIds: [] })), now);
    }
  }
  if (mode === "direct") db.prepare("DELETE FROM logistics_targets WHERE project_id=?").run(f.project.id);
  // Different tasks share M: E1→M must retain T1, never acquire T2's process/assignee.
  for (const [id, equipment] of [["T1", f.equipment[0]], ["T2", f.equipment[1]]] as const) if (mode !== "target")
    f.logistics.replaceTaskEquipmentLinks(f.project.id, f.tasks.get(id)!.id, [{ equipmentId: equipment.id, scope: "self" }], now);
  const group = f.groups.get("G1")!;
  f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: f.tasks.get("GROUP_ONLY")!.id, now, targets: [{ publicId: group.publicId, internalId: group.id, kind: "group", assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: null }] });
  for (const r of f.resources.values()) db.prepare("INSERT INTO project_resource_memberships(project_id,resource_id,created_at) VALUES(?,?,?)").run(f.project.id, r.id, now);
  return { ...f, contexts, processA, processB, areaA, areaB: areaBLink, areaBPublicId: areaB, idleEquipment, idleSystem };
}
