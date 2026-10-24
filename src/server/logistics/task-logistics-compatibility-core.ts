import type Database from "better-sqlite3";
import type { TaskLogisticsCompatibilityLink } from "../../contracts/logistics";
import { RESOURCE_DASHBOARD_LIMITS, RESOURCE_TARGET_LIMITS } from "../../contracts/resource-dashboard";
import { resolveTaskTargetBindings, TaskTargetResolutionError, type TaskTargetResolutionInput } from "../../domain/logistics/task-target-bindings";
import { PublicApiError } from "../http/api-error-core";
import { loadTaskTargetBindingSnapshot } from "../repositories/task-target-binding-repository-core";

export class LogisticsCompatibilityError extends Error {
  constructor() { super("기존 물류 연결 원본의 참조를 확인해 주세요. 원본 자료는 보존됩니다."); }
}

function sourceLimit(): never { throw new PublicApiError(422,"LOGISTICS_SOURCE_LIMIT_EXCEEDED","물류 연결 조회 한도를 초과했습니다. 프로젝트의 연결 범위를 확인해 주세요."); }

/** Bound materialization and inherited path expansion before invoking the archive resolver. */
export function loadBoundedTaskLogisticsSnapshot(db: Database.Database, projectId: number): TaskTargetResolutionInput {
  const taskCount=(db.prepare("SELECT count(*) count FROM tasks WHERE project_id=?").get(projectId) as {count:number}).count;
  if(taskCount>RESOURCE_DASHBOARD_LIMITS.tasks) sourceLimit();
  const tables=["project_equipment","project_logistics_systems","logistics_targets","logistics_target_members","task_target_bindings","task_target_binding_members","task_equipment_links","task_system_links"];
  let rowCount=taskCount;
  for(const table of tables) {
    rowCount+=(db.prepare(`SELECT count(*) count FROM ${table} WHERE project_id=?`).get(projectId) as {count:number}).count;
    if(rowCount>RESOURCE_TARGET_LIMITS.snapshotRows) sourceLimit();
  }
  assertLogisticsCompatibilityIntegrity(db,projectId);
  const snapshot=loadTaskTargetBindingSnapshot(db,projectId);
  const tasks=new Map(snapshot.tasks.map(task=>[task.id,task])),descendants=new Map<string,number>();
  let lineageEdges=0;
  for(const task of snapshot.tasks) {
    const seen=new Set<string>();let current:typeof task|undefined=task;
    while(current) {
      if(seen.has(current.id)) throw new LogisticsCompatibilityError();
      seen.add(current.id);
      if(++lineageEdges>RESOURCE_TARGET_LIMITS.lineageEdges) sourceLimit();
      descendants.set(current.id,(descendants.get(current.id)??0)+1);
      if(current.parentId===null) break;
      current=tasks.get(current.parentId);
      if(!current) throw new LogisticsCompatibilityError();
    }
  }
  const targets=new Map(snapshot.targets.map(target=>[target.id,target]));
  let paths=0;
  for(const binding of snapshot.bindings) {
    const target=targets.get(binding.targetId);if(!target) throw new LogisticsCompatibilityError();
    const selectedCount=binding.selection==="whole"?target.members.length:binding.memberIds.length;
    paths+=target.members.length+binding.memberIds.length*(binding.coverageByMember?.length??0)+(1+selectedCount)*(binding.scope==="subtree"?(descendants.get(binding.taskId)??0):1);
    if(paths>RESOURCE_TARGET_LIMITS.provenancePaths) sourceLimit();
  }
  for(const link of snapshot.legacy) {
    paths+=link.scope==="subtree"?(descendants.get(link.taskId)??0):1;
    if(paths>RESOURCE_TARGET_LIMITS.provenancePaths) sourceLimit();
  }
  return snapshot;
}

/** Inner joins in the historical reader must never turn a damaged source into zero links. */
export function assertLogisticsCompatibilityIntegrity(db: Database.Database, projectId: number): void {
  const invalid = db.prepare(`SELECT 1 FROM task_target_bindings b WHERE b.project_id=? AND (
    NOT EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=b.project_id AND t.id=b.task_id) OR
    NOT EXISTS(SELECT 1 FROM logistics_targets g WHERE g.project_id=b.project_id AND g.id=b.target_id) OR
    (b.selection='subset' AND NOT EXISTS(SELECT 1 FROM task_target_binding_members m WHERE m.project_id=b.project_id AND m.binding_id=b.id AND m.target_id=b.target_id AND m.member_id=b.anchor_member_id)))
    UNION ALL SELECT 1 FROM logistics_target_members m WHERE m.project_id=? AND (
    NOT EXISTS(SELECT 1 FROM logistics_targets g WHERE g.project_id=m.project_id AND g.id=m.target_id) OR
    (m.kind='equipment' AND NOT EXISTS(SELECT 1 FROM project_equipment e WHERE e.project_id=m.project_id AND e.id=m.equipment_id)) OR
    (m.kind='system' AND NOT EXISTS(SELECT 1 FROM project_logistics_systems s WHERE s.project_id=m.project_id AND s.id=m.system_id)))
    UNION ALL SELECT 1 FROM task_target_binding_members m WHERE m.project_id=? AND (
    NOT EXISTS(SELECT 1 FROM task_target_bindings b WHERE b.project_id=m.project_id AND b.id=m.binding_id AND b.target_id=m.target_id) OR
    NOT EXISTS(SELECT 1 FROM logistics_target_members g WHERE g.project_id=m.project_id AND g.target_id=m.target_id AND g.id=m.member_id))
    UNION ALL SELECT 1 FROM logistics_targets g WHERE g.project_id=? AND (
    NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=g.project_id) OR
    NOT EXISTS(SELECT 1 FROM logistics_target_members m WHERE m.project_id=g.project_id AND m.target_id=g.id AND m.id=g.anchor_member_id) OR
    (g.project_process_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_processes p WHERE p.project_id=g.project_id AND p.id=g.project_process_id)) OR
    (g.project_process_id IS NOT NULL AND g.occurrence_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_process_occurrence_mappings p WHERE p.project_id=g.project_id AND p.project_process_id=g.project_process_id AND p.occurrence_id=g.occurrence_id)) OR
    (g.occurrence_id IS NOT NULL AND g.work_area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM work_areas w WHERE w.occurrence_id=g.occurrence_id AND w.id=g.work_area_id)))
    UNION ALL SELECT 1 FROM task_equipment_links l WHERE l.project_id=? AND (
    NOT EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=l.project_id AND t.id=l.task_id) OR
    NOT EXISTS(SELECT 1 FROM project_equipment e WHERE e.project_id=l.project_id AND e.id=l.equipment_id))
    UNION ALL SELECT 1 FROM task_system_links l WHERE l.project_id=? AND (
    NOT EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=l.project_id AND t.id=l.task_id) OR
    NOT EXISTS(SELECT 1 FROM project_logistics_systems s WHERE s.project_id=l.project_id AND s.id=l.system_id))
    UNION ALL SELECT 1 FROM tasks t WHERE t.project_id=? AND t.parent_id IS NOT NULL AND
    NOT EXISTS(SELECT 1 FROM tasks p WHERE p.project_id=t.project_id AND p.id=t.parent_id) LIMIT 1`).get(projectId,projectId,projectId,projectId,projectId,projectId,projectId);
  if (invalid) throw new LogisticsCompatibilityError();
}

/** Caller owns a read transaction. No source rows are flattened or rewritten. */
export function loadTaskLogisticsCompatibility(db: Database.Database, projectId: number, taskId: string) {
  let effective;
  try { effective = resolveTaskTargetBindings(taskId, loadBoundedTaskLogisticsSnapshot(db, projectId)); }
  catch (error) { if (error instanceof TaskTargetResolutionError) throw new LogisticsCompatibilityError(); throw error; }
  const tasks = new Map((db.prepare("SELECT public_id id,name FROM tasks WHERE project_id=?").all(projectId) as {id:string;name:string}[]).map(row => [row.id,row.name]));
  const entities = new Map((db.prepare(`SELECT 'equipment' kind,public_id id,code,name,active FROM project_equipment WHERE project_id=?
    UNION ALL SELECT 'system' kind,public_id id,code,name,active FROM project_logistics_systems WHERE project_id=?`).all(projectId,projectId) as {kind:string;id:string;code:string;name:string;active:number}[]).map(row => [`${row.kind}:${row.id}`,row]));
  const contexts = new Map((db.prepare(`SELECT g.public_id id,g.scope,p.public_id processId,p.name processName,o.public_id occurrenceId,w.public_id workAreaId,w.name workAreaName,g.work_area_id originalWorkAreaId
    FROM logistics_targets g LEFT JOIN project_processes p ON p.project_id=g.project_id AND p.id=g.project_process_id
    LEFT JOIN site_product_processes o ON o.id=g.occurrence_id LEFT JOIN work_areas w ON w.occurrence_id=g.occurrence_id AND w.id=g.work_area_id
    WHERE g.project_id=?`).all(projectId) as {id:string;scope:"process"|"project_common";processId:string|null;processName:string|null;occurrenceId:string|null;workAreaId:string|null;workAreaName:string|null;originalWorkAreaId:number|null}[]).map(row=>{
      if(row.scope==="process"&&(!row.processId||row.processName===null||!row.occurrenceId)||row.originalWorkAreaId!==null&&(!row.workAreaId||row.workAreaName===null)) throw new LogisticsCompatibilityError();
      return [row.id,{scope:row.scope,process:row.processId===null?null:{id:row.processId,name:row.processName!},occurrenceId:row.occurrenceId,workArea:row.workAreaId===null?null:{id:row.workAreaId,name:row.workAreaName!}}];
    }));
  const links: TaskLogisticsCompatibilityLink[] = effective.effectiveMembers.flatMap(member => {
    const entity=entities.get(`${member.kind}:${member.entityId}`);
    if (!entity) throw new LogisticsCompatibilityError();
    return member.provenance.map(source => {
      const sourceTaskName=tasks.get(source.sourceTaskId);
      const context=contexts.get(source.targetId);
      if (sourceTaskName===undefined||context===undefined) throw new LogisticsCompatibilityError();
      return {sourceId:source.bindingId,kind:member.kind,entityId:member.entityId,code:entity.code,name:entity.name,active:entity.active===1,
        sourceTaskId:source.sourceTaskId,sourceTaskName,scope:source.scope,inherited:source.inherited,selection:source.selection,
        coverage:source.coverage,coverageMode:source.coverageMode,readonly:true as const,context};
    });
  });
  return {links,effectiveEquipmentIds:effective.effectiveEquipmentIds,effectiveSystemIds:effective.effectiveSystemIds};
}
