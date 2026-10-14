import type Database from "better-sqlite3";
import type { ResourceKpiLogisticsInput } from "../../domain/resources/resource-kpi-targets";
import { RESOURCE_TARGET_LIMITS } from "../../contracts/resource-dashboard";
import type { ResourceDashboardTargetProjection } from "../../contracts/resource-dashboard";
import { PublicApiError } from "../http/api-error-core";
import { loadTaskTargetBindingSnapshot } from "./task-target-binding-repository-core";

export const RESOURCE_TARGET_SNAPSHOT_LIMITS = Object.freeze({ rows: RESOURCE_TARGET_LIMITS.snapshotRows, provenancePaths: RESOURCE_TARGET_LIMITS.provenancePaths, lineageEdges: RESOURCE_TARGET_LIMITS.lineageEdges, projectionCells: RESOURCE_TARGET_LIMITS.projectionCells });
/** Fixed bulk queries inside the caller's read transaction; no per-Task/member queries. */
export function readResourceTargetSnapshot(db: Database.Database, projectId: number) {
  // Count every relation before materializing the graph (including subset rows).
  const tables = ["project_processes", "project_equipment", "project_logistics_systems", "logistics_targets", "logistics_target_members", "task_target_bindings", "task_target_binding_members", "task_equipment_links", "task_system_links", "project_process_occurrence_mappings"];
  const counts = tables.map(table => (db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE project_id=?`).get(projectId) as { count: number }).count);
  const occurrenceScope = "SELECT occurrence_id FROM project_process_occurrence_mappings WHERE project_id=?";
  counts.push((db.prepare(`SELECT COUNT(*) count FROM work_areas WHERE occurrence_id IN (${occurrenceScope})`).get(projectId) as { count: number }).count);
  if (counts.reduce((a, b) => a + b, 0) > RESOURCE_TARGET_SNAPSHOT_LIMITS.rows) throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "Target 원본 관계 조회 한도를 초과했습니다.", [{ path: "snapshot.targetRows", code: "REPORT_LIMIT_EXCEEDED", message: "Target 원본 관계 수를 줄여 주세요." }]);
  const processes = db.prepare(`SELECT p.public_id id,p.code,p.name,p.active,o.public_id occurrenceId,t.public_id processTypeId,w.public_id mappingWorkAreaId FROM project_processes p LEFT JOIN project_process_occurrence_mappings m ON m.project_id=p.project_id AND m.project_process_id=p.id LEFT JOIN site_product_processes o ON o.id=m.occurrence_id LEFT JOIN process_types t ON t.id=o.process_type_id LEFT JOIN work_areas w ON w.id=m.work_area_id WHERE p.project_id=? ORDER BY p.public_id`).all(projectId) as Array<{ id: string; code: string; name: string; active: number; occurrenceId: string | null; processTypeId: string | null; mappingWorkAreaId: string | null }>;
  const occurrences = db.prepare(`SELECT o.public_id id,o.name,o.code,o.active,t.public_id processTypeId FROM site_product_processes o JOIN process_types t ON t.id=o.process_type_id WHERE o.id IN (${occurrenceScope}) ORDER BY o.public_id`).all(projectId) as Array<{ id: string; name: string; code: string; active: number; processTypeId: string }>;
  const processTypes = db.prepare(`SELECT public_id id,name,code,active FROM process_types WHERE id IN (SELECT process_type_id FROM site_product_processes WHERE id IN (${occurrenceScope})) ORDER BY public_id`).all(projectId) as Array<{ id: string; name: string; code: string; active: number }>;
  const workAreas = db.prepare(`SELECT w.public_id id,w.code,w.name,w.active,o.public_id occurrenceId FROM work_areas w JOIN site_product_processes o ON o.id=w.occurrence_id WHERE w.occurrence_id IN (${occurrenceScope}) ORDER BY w.public_id`).all(projectId) as Array<{ id: string; name: string; code: string; active: number; occurrenceId: string }>;
  const instances = db.prepare(`SELECT 'equipment' kind,e.public_id entityId,e.name,e.code,e.active,e.equipment_type typeCode,e.quantity,p.public_id projectProcessId FROM project_equipment e JOIN project_processes p ON p.project_id=e.project_id AND p.id=e.process_id WHERE e.project_id=? UNION ALL SELECT 'system' kind,public_id entityId,name,code,active,system_type typeCode,1 quantity,NULL projectProcessId FROM project_logistics_systems WHERE project_id=? ORDER BY kind,entityId`).all(projectId, projectId) as Array<Omit<ResourceKpiLogisticsInput["instances"][number], "active"> & { name: string; code: string; active: number }>;
  const types = db.prepare("SELECT 'equipmentType' dimension,code id,code,name,active FROM logistics_equipment_types WHERE code IN (SELECT equipment_type FROM project_equipment WHERE project_id=?) UNION ALL SELECT 'systemType' dimension,code id,code,name,active FROM logistics_system_types WHERE code IN (SELECT system_type FROM project_logistics_systems WHERE project_id=?) ORDER BY dimension,id").all(projectId, projectId) as Array<{ dimension: "equipmentType" | "systemType"; id: string; code: string; name: string; active: number }>;
  const graph = loadTaskTargetBindingSnapshot(db, projectId);
  const targetRows = db.prepare("SELECT t.public_id id,t.code,t.name,t.active,t.scope,p.public_id projectProcessId,o.public_id occurrenceId,w.public_id workAreaId FROM logistics_targets t LEFT JOIN project_processes p ON p.project_id=t.project_id AND p.id=t.project_process_id LEFT JOIN site_product_processes o ON o.id=t.occurrence_id LEFT JOIN work_areas w ON w.id=t.work_area_id WHERE t.project_id=? ORDER BY t.public_id").all(projectId) as Array<Omit<ResourceKpiLogisticsInput["targets"][number], "members" | "active"> & { name: string; code: string; active: number }>;
  const membersByTarget = new Map(graph.targets.map(target => [target.id, target.members]));
  const logistics: ResourceKpiLogisticsInput = { targets: targetRows.map(target => ({ ...target, active: target.active === 1, members: membersByTarget.get(target.id)! })),
    instances: instances.map(instance => ({ ...instance, active: instance.active === 1 })), processes: processes.map(process => ({ ...process, active: process.active === 1 })), workAreas: workAreas.map(area => ({ ...area, active: area.active === 1 })), bindings: graph.bindings, legacy: graph.legacy ?? [],
    limits: { inputRows: RESOURCE_TARGET_SNAPSHOT_LIMITS.rows + 5000, ...RESOURCE_TARGET_SNAPSHOT_LIMITS } };
  const catalog: ResourceDashboardTargetProjection["catalog"] = [
    ...targetRows.map(row => ({ dimension: "target" as const, ...row, active: row.active === 1 })),
    ...processes.map(row => ({ dimension: "projectProcess" as const, ...row, active: row.active === 1 })),
    ...occurrences.map(row => ({ dimension: "process" as const, ...row, active: row.active === 1 })),
    ...processTypes.map(row => ({ dimension: "processType" as const, ...row, active: row.active === 1 })),
    ...workAreas.map(row => ({ dimension: "workArea" as const, ...row, active: row.active === 1 })),
    ...instances.map(row => ({ dimension: row.kind, id: row.entityId, name: row.name, code: row.code, active: row.active === 1 })),
    ...types.map(row => ({ ...row, active: row.active === 1 })),
  ].map(({ dimension, id, name, code, active }) => ({ dimension, id, name, code, active }));
  const revisions = { process: db.prepare("SELECT revision FROM process_catalog_state WHERE id=1").get(), logistics: db.prepare("SELECT revision FROM logistics_type_catalog_state WHERE id=1").get() };
  return { logistics, catalog, identity: { logistics, catalog, revisions, processes, occurrences, workAreas, types } };
}
