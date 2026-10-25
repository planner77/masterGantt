import type Database from 'better-sqlite3';
import type { EquipmentWorkAreaDto, EquipmentWorkAreaInput, TaskProcessContextDto, TaskProcessLink, TaskWorkAreaLink } from '../../contracts/process-context';
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from '../projects/project-contract';
export class ProcessContextError extends Error {
 constructor(public readonly status: number, public readonly code: string) { super(code); this.name='ProcessContextError'; }
}
const fail=(status:number,code:string):never=>{throw new ProcessContextError(status,code);};
const uuid=(value:unknown):string=>typeof value==='string'&&isCanonicalUuidV4(value)?value:fail(400,'INVALID_PROCESS_CONTEXT');
const object=(value:unknown,keys:string[]):Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value)) return fail(400,'INVALID_PROCESS_CONTEXT');
 const row=value as Record<string,unknown>;
 if(Object.keys(row).some(key=>!keys.includes(key))) return fail(400,'INVALID_PROCESS_CONTEXT');
 return row;
};
export interface InternalWorkAreaLink { processId:number; occurrenceId:number|null; workAreaId:number }
export interface InternalTaskContext { processLinks:Array<{processId:number;scope:'self'|'subtree'}>;workAreaLinks:Array<InternalWorkAreaLink&{scope:'self'|'subtree'}> }
export class ProcessContextRepository {
 constructor(private readonly db:Database.Database){}
 revision():number {return this.db.prepare('SELECT revision FROM process_catalog_state WHERE id=1').pluck().get() as number;}
 requireRevision(expected:unknown):void {
  if(!Number.isSafeInteger(expected)||(expected as number)<1) fail(400,'INVALID_PROCESS_CONTEXT');
  if(this.revision()!==expected) fail(412,'PROCESS_CATALOG_REVISION_MISMATCH');
 }
 equipmentLinks(projectId:number):EquipmentWorkAreaDto[]{
  return this.db.prepare(`SELECT e.public_id equipmentId,p.public_id processId,w.public_id workAreaId,NULL occurrenceId FROM equipment_project_work_areas x JOIN project_equipment e ON e.project_id=x.project_id AND e.id=x.equipment_id JOIN project_processes p ON p.project_id=x.project_id AND p.id=x.process_id JOIN project_work_areas w ON w.project_id=x.project_id AND w.id=x.work_area_id WHERE x.project_id=? UNION ALL SELECT e.public_id equipmentId,p.public_id processId,w.public_id workAreaId,o.public_id occurrenceId FROM equipment_work_areas x JOIN project_equipment e ON e.project_id=x.project_id AND e.id=x.equipment_id JOIN project_processes p ON p.project_id=x.project_id AND p.id=x.process_id JOIN work_areas w ON w.id=x.work_area_id JOIN site_product_processes o ON o.id=x.occurrence_id WHERE x.project_id=? ORDER BY equipmentId,processId,workAreaId`).all(projectId,projectId) as EquipmentWorkAreaDto[];
 }
 taskContexts(projectId:number):TaskProcessContextDto[]{
  const rows=this.db.prepare('SELECT t.id,t.public_id taskId,c.task_id marker FROM tasks t LEFT JOIN task_process_contexts c ON c.project_id=t.project_id AND c.task_id=t.id WHERE t.project_id=? ORDER BY t.public_id').all(projectId) as Array<{id:number;taskId:string;marker:number|null}>;
  const processes=this.db.prepare(`SELECT l.task_id taskId,p.public_id processId,l.scope FROM task_process_links l JOIN project_processes p ON p.project_id=l.project_id AND p.id=l.process_id WHERE l.project_id=? ORDER BY p.public_id`).all(projectId) as Array<TaskProcessLink&{taskId:number}>;
  const areas=this.db.prepare(`SELECT l.task_id taskId,p.public_id processId,w.public_id workAreaId,l.scope FROM task_project_work_area_links l JOIN project_processes p ON p.project_id=l.project_id AND p.id=l.process_id JOIN project_work_areas w ON w.project_id=l.project_id AND w.id=l.work_area_id WHERE l.project_id=? UNION ALL SELECT l.task_id taskId,p.public_id processId,w.public_id workAreaId,l.scope FROM task_work_area_links l JOIN project_processes p ON p.project_id=l.project_id AND p.id=l.process_id JOIN work_areas w ON w.id=l.work_area_id WHERE l.project_id=? ORDER BY processId,workAreaId`).all(projectId,projectId) as Array<TaskWorkAreaLink&{taskId:number}>;
  const processMap=new Map<number,TaskProcessLink[]>(),areaMap=new Map<number,TaskWorkAreaLink[]>();
  for(const {taskId,...link} of processes) { const links=processMap.get(taskId)??[];links.push(link);processMap.set(taskId,links); }
  for(const {taskId,...link} of areas) {const links=areaMap.get(taskId)??[];links.push(link);areaMap.set(taskId,links);}
  return rows.map(row=>({taskId:row.taskId,processLinks:row.marker===null?null:processMap.get(row.id)??[],workAreaLinks:row.marker===null?null:areaMap.get(row.id)??[]}));
 }
 private resolveArea(projectId:number,link:EquipmentWorkAreaInput,retained:boolean):InternalWorkAreaLink {
  const local=this.db.prepare("SELECT p.id processId,NULL occurrenceId,w.id workAreaId,(p.active=1 AND w.active=1) active FROM project_work_areas w JOIN project_processes p ON p.project_id=w.project_id AND p.id=w.process_id WHERE w.project_id=? AND p.public_id=? AND w.public_id=?").get(projectId,link.processId,link.workAreaId) as (InternalWorkAreaLink&{active:number})|undefined;
  if(local) {if(!local.active&&!retained) fail(409,'PROCESS_CATALOG_INACTIVE');return {processId:local.processId,occurrenceId:null,workAreaId:local.workAreaId};}
  const row=this.db.prepare(`SELECT p.id processId,m.occurrence_id occurrenceId,w.id workAreaId,(p.active=1 AND w.active=1 AND o.active=1 AND pt.active=1 AND b.active=1 AND product.active=1 AND s.active=1 AND (st.id IS NULL OR st.active=1)) active FROM project_processes p JOIN project_process_occurrence_mappings m ON m.project_id=p.project_id AND m.project_process_id=p.id JOIN projects project ON project.id=p.project_id JOIN work_areas w ON w.occurrence_id=m.occurrence_id JOIN site_product_processes o ON o.id=w.occurrence_id JOIN process_types pt ON pt.id=o.process_type_id JOIN project_master_items b ON b.id=o.business_unit_id JOIN project_master_items product ON product.id=o.product_id JOIN project_master_items s ON s.id=o.site_entity_id LEFT JOIN product_standard_processes st ON st.id=o.standard_process_id WHERE p.project_id=? AND p.public_id=? AND w.public_id=? AND project.business_unit_id=o.business_unit_id AND project.product_id=o.product_id AND project.site_entity_id=o.site_entity_id`).get(projectId,link.processId,link.workAreaId) as (InternalWorkAreaLink&{active:number})|undefined;
  if(!row) return fail(400,'WORK_AREA_OWNER_MISMATCH');
  if(!row.active&&!retained) fail(409,'PROCESS_CATALOG_INACTIVE');
  return {processId:row.processId,occurrenceId:row.occurrenceId,workAreaId:row.workAreaId};
 }
 validateEquipmentWorkAreas(projectId:number,input:unknown,retained:EquipmentWorkAreaInput[]=[]):InternalWorkAreaLink[]{
  if(!Array.isArray(input)||input.length>200) return fail(400,'INVALID_PROCESS_CONTEXT');
  const parsed=input.map(value=>{
   if(typeof value==='string') {
    const workAreaId=uuid(value);
    const owners=this.db.prepare(`SELECT p.public_id processId FROM project_work_areas w JOIN project_processes p ON p.project_id=w.project_id AND p.id=w.process_id WHERE w.project_id=? AND w.public_id=? UNION ALL SELECT p.public_id processId FROM project_process_occurrence_mappings m JOIN project_processes p ON p.project_id=m.project_id AND p.id=m.project_process_id JOIN work_areas w ON w.occurrence_id=m.occurrence_id WHERE m.project_id=? AND w.public_id=?`).all(projectId,workAreaId,projectId,workAreaId) as Array<{processId:string}>;
    if(owners.length!==1) return fail(400,'WORK_AREA_OWNER_AMBIGUOUS');
    return {processId:owners[0].processId,workAreaId};
   }
   const row=object(value,['processId','workAreaId']);return {processId:uuid(row.processId),workAreaId:uuid(row.workAreaId)};
  });
  if(new Set(parsed.map(link=>link.workAreaId)).size!==parsed.length) fail(400,'PROCESS_CONTEXT_DUPLICATE');
  return parsed.map(link=>this.resolveArea(projectId,link,retained.some(old=>old.processId===link.processId&&old.workAreaId===link.workAreaId)));
 }
 replaceEquipment(projectId:number,equipmentId:number,links:InternalWorkAreaLink[]):void {
  this.db.prepare('DELETE FROM equipment_project_work_areas WHERE project_id=? AND equipment_id=?').run(projectId,equipmentId);
  this.db.prepare('DELETE FROM equipment_work_areas WHERE project_id=? AND equipment_id=?').run(projectId,equipmentId);
  const insert=this.db.prepare('INSERT INTO equipment_work_areas(project_id,equipment_id,process_id,occurrence_id,work_area_id) VALUES(?,?,?,?,?)');
  const local=this.db.prepare('INSERT INTO equipment_project_work_areas(project_id,equipment_id,process_id,work_area_id) VALUES(?,?,?,?)');
  for(const link of links) {if(link.occurrenceId===null) local.run(projectId,equipmentId,link.processId,link.workAreaId);else insert.run(projectId,equipmentId,link.processId,link.occurrenceId,link.workAreaId);}
 }
 validateTaskContext(projectId:number,taskId:number,input:unknown,retainInactive:boolean|TaskProcessContextDto=false):InternalTaskContext {
  const parsed=object(input,['processLinks','workAreaLinks']);
  const task=this.db.prepare('SELECT type,public_id publicId FROM tasks WHERE project_id=? AND id=?').get(projectId,taskId) as {type:string;publicId:string}|undefined;
  if(!task) return fail(404,'TASK_NOT_FOUND');
  if(!Array.isArray(parsed.processLinks)||parsed.processLinks.length>200||!Array.isArray(parsed.workAreaLinks)||parsed.workAreaLinks.length>200) return fail(400,'INVALID_PROCESS_CONTEXT');
  if(task.type==='milestone'&&(parsed.processLinks.length||parsed.workAreaLinks.length)) fail(400,'PROCESS_CONTEXT_MILESTONE_FORBIDDEN');
  const old=typeof retainInactive==='object'?retainInactive:retainInactive?this.taskContexts(projectId).find(t=>t.taskId===task.publicId):undefined;
  const scope=(value:unknown):'self'|'subtree'=>{
   if(value!=='self'&&value!=='subtree') return fail(400,'INVALID_PROCESS_CONTEXT');
   if(value==='subtree'&&task.type!=='summary') fail(400,'PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY');
   return value;
  };
  const processLinks=parsed.processLinks.map(value=>{
   const link=object(value,['processId','scope']),publicId=uuid(link.processId),linkScope=scope(link.scope);
   const process=this.db.prepare('SELECT id,active FROM project_processes WHERE project_id=? AND public_id=?').get(projectId,publicId) as {id:number;active:number}|undefined;
   if(!process) return fail(400,'INVALID_PROCESS_SELECTION');
   if(!process.active&&!old?.processLinks?.some(p=>p.processId===publicId&&p.scope===linkScope)) fail(409,'PROCESS_CATALOG_INACTIVE');
   return {processId:process.id,scope:linkScope};
  });
  if(new Set(processLinks.map(p=>p.processId)).size!==processLinks.length) fail(400,'PROCESS_CONTEXT_DUPLICATE');
  const workAreaLinks=parsed.workAreaLinks.map(value=>{
   const link=object(value,['processId','workAreaId','scope']);
   const publicLink={processId:uuid(link.processId),workAreaId:uuid(link.workAreaId)},linkScope=scope(link.scope);
   const owner=this.resolveArea(projectId,publicLink,!!old?.workAreaLinks?.some(w=>w.processId===publicLink.processId&&w.workAreaId===publicLink.workAreaId&&w.scope===linkScope));
   const process=processLinks.find(p=>p.processId===owner.processId);
   if(!process||linkScope==='subtree'&&process.scope!=='subtree') fail(400,'WORK_AREA_PROCESS_NOT_SELECTED');
   return {...owner,scope:linkScope};
  });
  if(new Set(workAreaLinks.map(w=>JSON.stringify([w.occurrenceId,w.workAreaId]))).size!==workAreaLinks.length) fail(400,'PROCESS_CONTEXT_DUPLICATE');
  return {processLinks,workAreaLinks};
 }
 replaceTask(projectId:number,taskId:number,input:InternalTaskContext):void {
  this.db.prepare('INSERT OR IGNORE INTO task_process_contexts(project_id,task_id) VALUES(?,?)').run(projectId,taskId);
  this.db.prepare('DELETE FROM task_project_work_area_links WHERE project_id=? AND task_id=?').run(projectId,taskId);
  this.db.prepare('DELETE FROM task_work_area_links WHERE project_id=? AND task_id=?').run(projectId,taskId);
  this.db.prepare('DELETE FROM task_process_links WHERE project_id=? AND task_id=?').run(projectId,taskId);
  const process=this.db.prepare('INSERT INTO task_process_links(project_id,task_id,process_id,scope) VALUES(?,?,?,?)');
  for(const p of input.processLinks) process.run(projectId,taskId,p.processId,p.scope);
  const area=this.db.prepare('INSERT INTO task_work_area_links(project_id,task_id,process_id,occurrence_id,work_area_id,scope) VALUES(?,?,?,?,?,?)');
  const local=this.db.prepare('INSERT INTO task_project_work_area_links(project_id,task_id,process_id,work_area_id,scope) VALUES(?,?,?,?,?)');
  for(const w of input.workAreaLinks) {if(w.occurrenceId===null) local.run(projectId,taskId,w.processId,w.workAreaId,w.scope);else area.run(projectId,taskId,w.processId,w.occurrenceId,w.workAreaId,w.scope);}
 }
}

/** Generic task edits must not bypass direct context type/scope rules. */
export function assertTaskProcessContextTypeChange(db:Database.Database,projectId:number,taskId:string,targetType:string):void {
 if(targetType==='summary') return;
 const row=db.prepare(`SELECT 1 FROM task_process_links l JOIN tasks t ON t.project_id=l.project_id AND t.id=l.task_id WHERE t.project_id=? AND t.public_id=? AND (?='milestone' OR l.scope='subtree') LIMIT 1`).get(projectId,taskId,targetType);
 if(row) throw new PublicApiError(409,'PROCESS_CONTEXT_TYPE_CONFLICT','Remove incompatible process/WorkArea contexts before changing the task type.');
}
