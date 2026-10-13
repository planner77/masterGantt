import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { PublicApiError } from "../http/api-error-core";

/** Snapshot-local typed keys keep shared instances shared without persisting source IDs. */
export interface TemplateTaskTargetBinding {
  taskExternalId: string;
  targetCode: string;
  scope: "self" | "subtree";
  selection: "whole" | "subset";
  members: Array<{ kind: "equipment" | "system"; instanceCode: string; coverage: number | null }>;
}
type BindingRow = { id: number; task_external_id: string; target_code: string; scope: "self"|"subtree"; selection: "whole"|"subset" };
type MemberRow = { binding_id: number; kind: "equipment"|"system"; instance_code: string; coverage: number|null };
function invalid(): never {
  throw new PublicApiError(409, "TASK_TARGET_TRANSFER_INVALID", "Task Target binding references cannot be transferred safely.");
}
export function snapshotTaskTargetBindings(db: Database.Database, projectId: number): TemplateTaskTargetBinding[] {
  const rows = db.prepare("SELECT b.id,t.external_id task_external_id,g.code target_code,b.scope,b.selection FROM task_target_bindings b JOIN tasks t ON t.project_id=b.project_id AND t.id=b.task_id JOIN logistics_targets g ON g.project_id=b.project_id AND g.id=b.target_id WHERE b.project_id=? ORDER BY t.external_id,g.code").all(projectId) as BindingRow[];
  const members = db.prepare("SELECT s.binding_id,m.kind,COALESCE(e.code,y.code) instance_code,s.coverage FROM task_target_binding_members s JOIN logistics_target_members m ON m.project_id=s.project_id AND m.target_id=s.target_id AND m.id=s.member_id LEFT JOIN project_equipment e ON e.project_id=m.project_id AND e.id=m.equipment_id LEFT JOIN project_logistics_systems y ON y.project_id=m.project_id AND y.id=m.system_id WHERE s.project_id=? ORDER BY s.binding_id,m.kind,instance_code").all(projectId) as MemberRow[];
  return rows.map(row=>({taskExternalId:row.task_external_id,targetCode:row.target_code,scope:row.scope,selection:row.selection,
    members:members.filter(m=>m.binding_id===row.id).map(m=>({kind:m.kind,instanceCode:m.instance_code,coverage:m.coverage}))}));
}
/** Caller owns an authorized immediate transaction and revision CAS. */
export function restoreTaskTargetBindings(db: Database.Database, projectId: number,
  rows: readonly TemplateTaskTargetBinding[], taskMap: ReadonlyMap<string,{id:number}>, now: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || typeof row.taskExternalId !== "string" || typeof row.targetCode !== "string" || Object.keys(row).some(key=>!["taskExternalId","targetCode","scope","selection","members"].includes(key)) || (row.scope!=="self" && row.scope!=="subtree") || (row.selection!=="whole" && row.selection!=="subset") || !Array.isArray(row.members)) invalid();
    const task = taskMap.get(row.taskExternalId);
    const target = db.prepare("SELECT id FROM logistics_targets WHERE project_id=? AND code=?").get(projectId,row.targetCode) as {id:number}|undefined;
    const key=row.taskExternalId+"\0"+row.targetCode;
    if (!task || !target || seen.has(key)) invalid();
    seen.add(key);
    const taskRow=db.prepare("SELECT type FROM tasks WHERE project_id=? AND id=?").get(projectId,task.id) as {type:string}|undefined;
    if (!taskRow || taskRow.type==="milestone" || (row.scope==="subtree" && taskRow.type!=="summary")) invalid();
    if ((row.selection==="whole" && row.members.length!==0) || (row.selection==="subset" && row.members.length===0)) invalid();
    const memberIds=new Set<number>();
    const resolved=row.members.map(m=>{
      if (!m || Object.keys(m).some(key=>!["kind","instanceCode","coverage"].includes(key)) || (m.kind!=="equipment" && m.kind!=="system") || typeof m.instanceCode!=="string") invalid();
      const member=db.prepare("SELECT m.id,e.quantity FROM logistics_target_members m LEFT JOIN project_equipment e ON e.project_id=m.project_id AND e.id=m.equipment_id LEFT JOIN project_logistics_systems s ON s.project_id=m.project_id AND s.id=m.system_id WHERE m.project_id=? AND m.target_id=? AND m.kind=? AND COALESCE(e.code,s.code)=?").get(projectId,target.id,m.kind,m.instanceCode) as {id:number;quantity:number|null}|undefined;
      if (!member || memberIds.has(member.id) || (m.coverage!==null && (!Number.isSafeInteger(m.coverage) || m.coverage<=0 || m.kind!=="equipment" || member.quantity===null || m.coverage>member.quantity))) invalid();
      memberIds.add(member.id);
      return {id:member.id,coverage:m.coverage};
    });
    const inserted=db.prepare("INSERT INTO task_target_bindings(public_id,project_id,task_id,target_id,scope,selection,anchor_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(randomUUID(),projectId,task.id,target.id,row.scope,row.selection,resolved[0]?.id??null,now,now);
    for(const m of resolved) db.prepare("INSERT INTO task_target_binding_members(project_id,binding_id,target_id,member_id,coverage) VALUES(?,?,?,?,?)").run(projectId,Number(inserted.lastInsertRowid),target.id,m.id,m.coverage);
  }
}

/** Copy only explicit rows; inherited rows remain resolver output. */
export function copyTaskTargetBindings(db: Database.Database, sourceProjectId: number, targetProjectId: number,
  taskIds: ReadonlyMap<number,number>, now: string): void {
  const externalMap=new Map<string,{id:number}>();
  for(const [sourceId,destinationId] of taskIds) {
    const task=db.prepare("SELECT external_id FROM tasks WHERE project_id=? AND id=?").get(sourceProjectId,sourceId) as {external_id:string}|undefined;
    if(!task) invalid();
    externalMap.set(task.external_id,{id:destinationId});
  }
  restoreTaskTargetBindings(db,targetProjectId,
    snapshotTaskTargetBindings(db,sourceProjectId).filter(row=>externalMap.has(row.taskExternalId)),externalMap,now);
}
