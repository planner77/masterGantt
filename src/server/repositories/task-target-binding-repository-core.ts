import type Database from "better-sqlite3";
import type { TaskTargetBindingDto } from "../../contracts/task-target-bindings";
import type { TaskTargetResolutionInput } from "../../domain/logistics/task-target-bindings";

/** Read one consistent SQLite snapshot; every consumer uses the same domain resolver. */
export function loadTaskTargetBindingSnapshot(db: Database.Database, projectId: number): TaskTargetResolutionInput {
  const tasks = db.prepare("SELECT t.public_id id,p.public_id parentId,t.type FROM tasks t LEFT JOIN tasks p ON p.project_id=t.project_id AND p.id=t.parent_id WHERE t.project_id=? ORDER BY t.id").all(projectId) as TaskTargetResolutionInput["tasks"];
  const targets = db.prepare("SELECT public_id id FROM logistics_targets WHERE project_id=? ORDER BY id").all(projectId) as Array<{id:string}>;
  const members = db.prepare("SELECT m.public_id id,t.public_id targetId,m.kind,COALESCE(e.public_id,s.public_id) entityId,COALESCE(e.quantity,1) quantity,COALESCE(e.active,s.active) active FROM logistics_target_members m JOIN logistics_targets t ON t.project_id=m.project_id AND t.id=m.target_id LEFT JOIN project_equipment e ON e.project_id=m.project_id AND e.id=m.equipment_id LEFT JOIN project_logistics_systems s ON s.project_id=m.project_id AND s.id=m.system_id WHERE m.project_id=? ORDER BY m.id").all(projectId) as Array<{id:string;targetId:string;kind:"equipment"|"system";entityId:string;quantity:number;active:number}>;
  const bindings = db.prepare("SELECT b.id internalId,b.public_id id,t.public_id taskId,g.public_id targetId,b.scope,b.selection FROM task_target_bindings b JOIN tasks t ON t.project_id=b.project_id AND t.id=b.task_id JOIN logistics_targets g ON g.project_id=b.project_id AND g.id=b.target_id WHERE b.project_id=? ORDER BY b.id").all(projectId) as Array<Omit<TaskTargetBindingDto,"memberIds"> & {internalId:number}>;
  const selected = db.prepare("SELECT bm.binding_id bindingId,m.public_id memberId,bm.coverage FROM task_target_binding_members bm JOIN logistics_target_members m ON m.project_id=bm.project_id AND m.target_id=bm.target_id AND m.id=bm.member_id WHERE bm.project_id=? ORDER BY m.public_id").all(projectId) as Array<{bindingId:number;memberId:string;coverage:number|null}>;
  const legacy = db.prepare("SELECT t.public_id taskId,'equipment' kind,e.public_id entityId,l.scope FROM task_equipment_links l JOIN tasks t ON t.project_id=l.project_id AND t.id=l.task_id JOIN project_equipment e ON e.project_id=l.project_id AND e.id=l.equipment_id WHERE l.project_id=? UNION ALL SELECT t.public_id taskId,'system' kind,s.public_id entityId,l.scope FROM task_system_links l JOIN tasks t ON t.project_id=l.project_id AND t.id=l.task_id JOIN project_logistics_systems s ON s.project_id=l.project_id AND s.id=l.system_id WHERE l.project_id=?").all(projectId,projectId) as TaskTargetResolutionInput["legacy"];
  const membersByTarget = new Map<string, typeof members>();
  for (const member of members) { const rows = membersByTarget.get(member.targetId) ?? []; rows.push(member); membersByTarget.set(member.targetId, rows); }
  const selectedByBinding = new Map<number, typeof selected>();
  for (const member of selected) { const rows = selectedByBinding.get(member.bindingId) ?? []; rows.push(member); selectedByBinding.set(member.bindingId, rows); }
  return {tasks, targets: targets.map(t => ({...t,members:(membersByTarget.get(t.id) ?? []).map(m => ({id:m.id,kind:m.kind,entityId:m.entityId,quantity:m.quantity,active:m.active===1}))})),
    bindings:bindings.map(({internalId,...b}) => ({...b,memberIds:(selectedByBinding.get(internalId) ?? []).map(m => m.memberId),coverageByMember:(selectedByBinding.get(internalId) ?? []).map(m => ({memberId:m.memberId,coverage:m.coverage}))})),legacy};
}

/** Caller owns authorization, validation and the encompassing IMMEDIATE transaction. */
export class TaskTargetBindingRepository {
  constructor(private readonly db: Database.Database) {}
  findTask(projectId: number, publicId: string) {
    return this.db.prepare("SELECT id,type FROM tasks WHERE project_id=? AND public_id=?").get(projectId,publicId) as {id:number;type:string}|undefined;
  }
  findTarget(projectId: number, publicId: string) {
    return this.db.prepare("SELECT id,active FROM logistics_targets WHERE project_id=? AND public_id=?").get(projectId,publicId) as {id:number;active:number}|undefined;
  }
  replace(projectId: number, taskId: number, bindings: readonly TaskTargetBindingDto[], now: string) {
    this.db.prepare("DELETE FROM task_target_bindings WHERE project_id=? AND task_id=?").run(projectId,taskId);
    for (const binding of bindings) {
      const target=this.findTarget(projectId,binding.targetId);
      if (!target) throw new Error("Validated Target disappeared inside the binding transaction.");
      const members=binding.memberIds.map(publicId=>{
        const row=this.db.prepare("SELECT id FROM logistics_target_members WHERE project_id=? AND target_id=? AND public_id=?").get(projectId,target.id,publicId) as {id:number}|undefined;
        if (!row) throw new Error("Validated member disappeared inside the binding transaction.");
        return {...row,publicId};
      });
      const inserted=this.db.prepare("INSERT INTO task_target_bindings(public_id,project_id,task_id,target_id,scope,selection,anchor_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .run(binding.id,projectId,taskId,target.id,binding.scope,binding.selection,members[0]?.id??null,now,now);
      for (const member of members) this.db.prepare("INSERT INTO task_target_binding_members(project_id,binding_id,target_id,member_id,coverage) VALUES(?,?,?,?,?)")
        .run(projectId,Number(inserted.lastInsertRowid),target.id,member.id,binding.coverageByMember?.find(c=>c.memberId===member.publicId)?.coverage??null);
    }
  }
}
