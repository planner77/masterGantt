import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../../../src/server/db/core';
import { runMigrations } from '../../../src/server/db/migrations';
import { ProjectMasterRepository } from '../../../src/server/repositories/project-master-repository-core';
import { EditSessionRepository, ProjectRepository } from '../../../src/server/repositories/project-repository-core';
import { insertHistoricalPublicProject } from "../../fixtures/legacy-project";
import { ProcessContextRepository } from '../../../src/server/repositories/process-context-repository-core';
import { ProcessCatalogService } from '../../../src/server/process-catalog/process-catalog-service-core';
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { TaskHierarchyService } from "../../../src/server/projects/task-hierarchy-service-core";
import { handleTaskHierarchyCommand } from "../../../src/server/projects/task-hierarchy-handlers-core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { LogisticsService } from '../../../src/server/logistics/logistics-service-core';
import { handleCreateEquipment, handleUpdateEquipment } from '../../../src/server/logistics/logistics-handlers-core';
import { handleGetTaskProcessContext, handleReplaceTaskProcessContext } from '../../../src/server/process-catalog/process-catalog-handlers-core';
import { TaskFieldProjectService } from '../../../src/server/projects/task-field-project-service';
import { createSessionToken, sessionExpiry } from '../../../src/server/security/session-core';
import { editSessionCookieName } from '../../../src/server/security/cookie-core';

const now=new Date('2026-10-18T01:00:00Z'), base='https://gantt.example.test';
const databases:Database.Database[]=[],directories:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const db of databases.splice(0))if(db.open)db.close();for(const path of directories.splice(0))rmSync(path,{recursive:true,force:true});});
function setup(filename=':memory:') {
 const {database:db}=openDatabase({filename,migrationsDirectory:join(process.cwd(),'db/migrations')});databases.push(db);
 const master=new ProjectMasterRepository(db),admin=createSessionToken();master.insertAdminSession({tokenHash:admin.tokenHash,createdAt:now.toISOString(),expiresAt:sessionExpiry(now).toISOString()});
 const item=(category:'BUSINESS_UNIT'|'PRODUCT'|'SITE_ENTITY')=>master.insertItem({publicId:randomUUID(),category,code:category,name:category,active:true,sortOrder:0,now:now.toISOString()});
 const bu=item('BUSINESS_UNIT'),product=item('PRODUCT'),site=item('SITE_ENTITY');
 db.prepare('INSERT INTO business_unit_products VALUES(?,?)').run(bu.id,product.id);db.prepare('INSERT INTO business_unit_product_sites VALUES(?,?,?)').run(bu.id,product.id,site.id);
 const projects=new ProjectRepository(db),project=projects.insert({publicId:randomUUID(),name:'Context',description:'',status:'planned',passwordKdf:'scrypt',passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:'Asia/Seoul',createdAt:now.toISOString(),updatedAt:now.toISOString()});
 db.prepare('UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?').run(bu.id,product.id,site.id,project.id);
 const token=createSessionToken();new EditSessionRepository(db).insert({projectId:project.id,tokenHash:token.tokenHash,authVersion:project.authVersion,createdAt:now.toISOString(),expiresAt:sessionExpiry(now).toISOString()});
 const projectService=new TaskFieldProjectService(db,{clock:()=>now}),authorization=projectService.authorize(project.publicId,token.rawToken);if(authorization.kind!=='authorized')throw new Error('fixture');const auth=authorization.authorization;
 const revision=()=>projects.findById(project.id)!.revision,catalog=new ProcessCatalogService(db,{clock:()=>now}),contexts=new ProcessContextRepository(db),logistics=new LogisticsService(db,{clock:()=>now});
 const triple={businessUnitId:bu.publicId,productId:product.publicId,siteEntityId:site.publicId};
 const type=catalog.mutate(admin.rawToken,contexts.revision(),'types','create',null,{code:'T',name:'T'}).data.types[0];
 const processes= ['A','B'].map(code=>logistics.createProcess(auth,revision(),{code,name:code}).data.logistics.processes.find(p=>p.code===code)!);
 const occurrences=['A','B'].map(code=>catalog.mutate(admin.rawToken,contexts.revision(),'occurrences','create',null,{...triple,code,name:code,processTypeId:type.id}).data.occurrences.find(o=>o.code===code)!);
 for(let i=0;i<2;i++)catalog.mapProjectProcess(auth,revision(),processes[i].id,{processCatalogRevision:contexts.revision(),occurrenceId:occurrences[i].id});
 const areas=['A1','A2','B1'].map((code,i)=>catalog.mutate(admin.rawToken,contexts.revision(),'workAreas','create',null,{code,name:'동일 구역명',occurrenceId:occurrences[i===2?1:0].id}).data.workAreas.find(a=>a.code===code)!);
 const areaLinks=areas.map((area,i)=>({processId:processes[i===2?1:0].id,workAreaId:area.id}));
 const task=(type:'task'|'summary'='task',parentId:number|null=null)=>{
  const publicId=randomUUID();const row=db.prepare(`INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,status,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,'auto',?,?,?,?,?,'not_started',?,0,?,?)`).run(project.id,publicId,publicId,type,type,type==='summary'?null:'2026-10-19',type==='summary'?null:'2026-10-19',type==='summary'?null:'2026-10-19',type==='summary'?null:1,type==='summary'?null:0,parentId,now.toISOString(),now.toISOString());return{id:Number(row.lastInsertRowid),publicId};
 };
 const equipmentInput={processId:processes[0].id,code:'E10',name:'Fleet',equipmentType:'amr',managementUnit:'fleet' as const,quantity:10};
 const createEquipment=(links=areaLinks)=>logistics.createEquipment(auth,revision(),{...equipmentInput,workAreaLinks:links,processCatalogRevision:contexts.revision()}).data.logistics.equipment[0];
 const dependencies={service:catalog,projectService,applicationBaseUrl:base,environment:'production'};
 const logisticsDependencies={logisticsService:logistics,projectService,applicationBaseUrl:base,environment:'production'};
 const cookie=`${editSessionCookieName('production',new URL(base))}=${token.rawToken}`;
 const request=(body:unknown,options:{cookie?:string;origin?:string;etag?:string;method?:string}={})=>new Request(`${base}/api/projects/${project.publicId}/tasks/task/process-context`,{method:options.method??'PUT',headers:{Origin:options.origin??base,Cookie:options.cookie??cookie,'If-Match':options.etag??`"${revision()}"`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return{db,project,projects,projectService,auth,token,admin,catalog,contexts,logistics,processes,occurrences,areas,areaLinks,revision,task,equipmentInput,createEquipment,dependencies,logisticsDependencies,cookie,request};
}
describe('Issue #725 typed process/WorkArea SQLite and HTTP',()=>{
 it('stores cross-process WorkArea 0/1/N without duplicating fleet or creating Targets',()=>{
  const f=setup(),e=f.createEquipment();
  expect(e).toMatchObject({quantity:10,processId:f.processes[0].id,workAreaIds:expect.arrayContaining(f.areas.map(a=>a.id))});
  const snapshot=f.logistics.getLogisticsDto(f.project.id);expect(snapshot.equipment).toHaveLength(1);expect(snapshot.equipmentWorkAreas).toHaveLength(3);
  expect(snapshot.equipmentWorkAreas).toContainEqual({equipmentId:e.id,...f.areaLinks[2],occurrenceId:f.occurrences[1].id});
  for(const links of [[f.areaLinks[1]],[]])f.logistics.updateEquipment(f.auth,f.revision(),e.id,{workAreaLinks:links,processCatalogRevision:f.contexts.revision()});
  expect(f.logistics.getLogisticsDto(f.project.id).equipment[0]).toMatchObject({id:e.id,quantity:10,workAreaIds:[]});
  expect(f.db.prepare('SELECT COUNT(*) FROM logistics_targets').pluck().get()).toBe(0);
 });
 it('retains legacy-null and explicit Task 0/1/2 independently of equipment/system configuration',()=>{
  const f=setup(),task=f.task(),other=f.task(),e=f.createEquipment();
  expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context.processLinks).toBeNull();
  for(const selected of [[],[f.processes[0]],[...f.processes]]){
   f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:selected.map(p=>({processId:p.id,scope:'self'})),workAreaLinks:[]});
   expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context.processLinks).toHaveLength(selected.length);
  }
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]});
  f.logistics.updateEquipment(f.auth,f.revision(),e.id,{processId:f.processes[1].id});
  expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context).toMatchObject({processLinks:[],workAreaLinks:[]});
  expect(f.catalog.taskContext(f.project.publicId,other.publicId).data.context.processLinks).toBeNull();
 });
 it('requires explicit owner process selection and summary-only subtree, without partial rows',()=>{
  const f=setup(),task=f.task(),before=f.revision(),valid={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:f.processes[0].id,scope:'self'}],workAreaLinks:[{...f.areaLinks[0],scope:'self'}]};
  for(const input of [ {...valid,processLinks:[]},{...valid,workAreaLinks:[{processId:f.processes[1].id,workAreaId:f.areas[0].id,scope:'self'}]},{...valid,processLinks:[...valid.processLinks,...valid.processLinks]},{...valid,workAreaLinks:[...valid.workAreaLinks,...valid.workAreaLinks]},{...valid,processLinks:[{processId:randomUUID(),scope:'self'}]},{...valid,processLinks:[{processId:f.processes[0].id,scope:'subtree'}]}])expect(()=>f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,input)).toThrow();
  expect(f.revision()).toBe(before);expect(f.db.prepare('SELECT COUNT(*) FROM task_process_contexts').pluck().get()).toBe(0);
  const summary=f.task('summary');f.catalog.replaceTaskContext(f.auth,f.revision(),summary.publicId,{...valid,processLinks:[{processId:f.processes[0].id,scope:'subtree'}],workAreaLinks:[{...f.areaLinks[0],scope:'subtree'}]});
  const child=f.task('task',summary.id);f.catalog.replaceTaskContext(f.auth,f.revision(),child.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]});
  expect(f.contexts.taskContexts(f.project.id).find(t=>t.taskId===child.publicId)?.processLinks).toEqual([]);
  expect(()=>f.db.prepare("UPDATE tasks SET type='task' WHERE id=?").run(summary.id)).toThrow('PROCESS_CONTEXT_SUBTREE_REQUIRES_SUMMARY');
 });
 it('rejects wrong owner, duplicates, foreign IDs, catalog stale and rolls equipment fields back',()=>{
  const f=setup(),e=f.createEquipment(),before=f.logistics.getLogisticsDto(f.project.id),revision=f.revision();
  for(const input of [{workAreaLinks:[{processId:f.processes[1].id,workAreaId:f.areas[0].id}],processCatalogRevision:f.contexts.revision()},{workAreaLinks:[f.areaLinks[0],f.areaLinks[0]],processCatalogRevision:f.contexts.revision()},{workAreaLinks:[{processId:randomUUID(),workAreaId:f.areas[0].id}],processCatalogRevision:f.contexts.revision()},{workAreaLinks:[],processCatalogRevision:f.contexts.revision()-1}])expect(()=>f.logistics.updateEquipment(f.auth,f.revision(),e.id,{name:'must rollback',...input})).toThrow();
  expect(f.revision()).toBe(revision);expect(f.logistics.getLogisticsDto(f.project.id)).toEqual(before);
  expect(()=>f.logistics.createEquipment(f.auth,f.revision(),{...f.equipmentInput,code:'INVALID',workAreaLinks:[f.areaLinks[0],{processId:f.processes[0].id,workAreaId:randomUUID()}],processCatalogRevision:f.contexts.revision()})).toThrow();
  expect(f.logistics.getLogisticsDto(f.project.id).equipment).toHaveLength(1);
 });
 it('counts new references and protects owner mapping, global deletion and direct-process deletion',()=>{
  const f=setup(),task=f.task();f.createEquipment();
  expect(f.catalog.getCatalog(f.admin.rawToken).data.workAreas[0].usageCount).toBe(1);
  expect(()=>f.catalog.mapProjectProcess(f.auth,f.revision(),f.processes[0].id,{processCatalogRevision:f.contexts.revision(),occurrenceId:null})).toThrowError(expect.objectContaining({status:409,code:'PROJECT_PROCESS_MAPPING_IN_USE'}));
  expect(()=>f.catalog.mutate(f.admin.rawToken,f.contexts.revision(),'workAreas','delete',f.areas[0].id,undefined)).toThrowError(expect.objectContaining({status:409}));
  const p=f.logistics.createProcess(f.auth,f.revision(),{code:'UNMAPPED',name:'legacy'}).data.logistics.processes.find(p=>p.code==='UNMAPPED')!;
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[{processId:p.id,scope:'self'}],workAreaLinks:[]});
  expect(()=>f.logistics.deleteProcess(f.auth,f.revision(),p.id,true)).toThrowError(expect.objectContaining({code:'PROCESS_IN_USE'}));
 });
 it('counts a Target-only WorkArea reference when mapping defaults and equipment relations are empty',()=>{
  const f=setup(),equipment=f.createEquipment([]),area=f.areas[1];
  expect(f.db.prepare('SELECT COUNT(*) FROM project_process_occurrence_mappings WHERE project_id=? AND work_area_id IS NOT NULL').pluck().get(f.project.id)).toBe(0);
  expect(f.contexts.equipmentLinks(f.project.id)).toEqual([]);
  const usage=()=>f.catalog.getCatalog(f.admin.rawToken).data.workAreas.find(row=>row.id===area.id)!.usageCount;
  expect(usage()).toBe(0);
  const targets=new LogisticsTargetService(f.db,{clock:()=>now});
  const target=targets.create(f.auth,f.revision(),{code:'AREA-TARGET',name:'구역 Target',scope:'process',projectProcessId:f.processes[0].id,workAreaId:area.id,members:[{kind:'equipment',entityId:equipment.id}]}).data.target!;
  expect(usage()).toBe(1);
  const catalogRevision=f.contexts.revision();
  expect(()=>f.catalog.mutate(f.admin.rawToken,catalogRevision,'workAreas','delete',area.id,undefined)).toThrowError(expect.objectContaining({status:409,code:'PROCESS_CATALOG_IN_USE'}));
  expect(f.contexts.revision()).toBe(catalogRevision);expect(usage()).toBe(1);
  targets.delete(f.auth,f.revision(),target.id);expect(usage()).toBe(0);
  f.catalog.mutate(f.admin.rawToken,f.contexts.revision(),'workAreas','delete',area.id,undefined);
  expect(f.catalog.getCatalog(f.admin.rawToken).data.workAreas.some(row=>row.id===area.id)).toBe(false);
  expect(f.logistics.getLogisticsDto(f.project.id).equipment[0]).toMatchObject({id:equipment.id,quantity:10,workAreaIds:[]});
 });
 it('preserves retained inactive references and rejects newly adding inactive WorkAreas',()=>{
  const f=setup(),e=f.createEquipment([f.areaLinks[0]]);
  f.catalog.mutate(f.admin.rawToken,f.contexts.revision(),'workAreas','update',f.areas[0].id,{active:false});
  f.logistics.updateEquipment(f.auth,f.revision(),e.id,{name:'retained',workAreaLinks:[f.areaLinks[0]],processCatalogRevision:f.contexts.revision()});
  expect(()=>f.logistics.createEquipment(f.auth,f.revision(),{...f.equipmentInput,code:'NEW',workAreaLinks:[f.areaLinks[0]],processCatalogRevision:f.contexts.revision()})).toThrowError(expect.objectContaining({status:409}));
 });
 it('rolls back relation replacement when revision advance fails and cleans task/project cascades',()=>{
  const f=setup(),task=f.task(),e=f.createEquipment(),before=f.contexts.equipmentLinks(f.project.id);
  const advance=vi.spyOn(ProjectRepository.prototype,'advanceRevision').mockReturnValue(undefined);
  expect(()=>f.logistics.updateEquipment(f.auth,f.revision(),e.id,{workAreaLinks:[],processCatalogRevision:f.contexts.revision()})).toThrow();
  expect(f.contexts.equipmentLinks(f.project.id)).toEqual(before);advance.mockRestore();
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[{processId:f.processes[0].id,scope:'self'}],workAreaLinks:[{...f.areaLinks[0],scope:'self'}]});
  f.db.prepare('DELETE FROM tasks WHERE id=?').run(task.id);expect(f.db.prepare('SELECT COUNT(*) FROM task_process_contexts').pluck().get()).toBe(0);
  f.db.prepare('DELETE FROM projects WHERE id=?').run(f.project.id);expect(f.db.pragma('foreign_key_check')).toEqual([]);expect(f.contexts.equipmentLinks(f.project.id)).toEqual([]);
 });
 it('returns safe readonly HTTP and rejects auth/origin/revision/body failures atomically',async()=>{
  const f=setup(),task=f.task(),body={processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]};
  const read=handleGetTaskProcessContext(new Request(`${base}/api/context`),f.project.publicId,task.publicId,f.dependencies);expect(read.status).toBe(200);expect(await read.json()).toMatchObject({data:{permission:'readonly',context:{processLinks:null}}});
  for(const [options,status] of [[{cookie:''},401],[{origin:'https://evil.test'},403],[{etag:'W/"1"'},400],[{etag:'"999"'},412]] as const){const response=await handleReplaceTaskProcessContext(f.request(body,options),f.project.publicId,task.publicId,f.dependencies);expect(response.status).toBe(status);}
  const missing=f.request(body);missing.headers.delete('if-match');expect((await handleReplaceTaskProcessContext(missing,f.project.publicId,task.publicId,f.dependencies)).status).toBe(428);
  expect((await handleReplaceTaskProcessContext(f.request({...body,processLinks:[{processId:randomUUID(),scope:'self'}]}),f.project.publicId,task.publicId,f.dependencies)).status).toBe(400);
  const valid=await handleReplaceTaskProcessContext(f.request(body),f.project.publicId,task.publicId,f.dependencies);expect(valid.status).toBe(200);expect(valid.headers.get('Cache-Control')).toBe('private, no-store');
  expect((await valid.json()).data.context.processLinks).toEqual([]);
  expect((await handleCreateEquipment(f.request({...f.equipmentInput,workAreaLinks:f.areaLinks,processCatalogRevision:f.contexts.revision()},{method:'POST'}),f.project.publicId,f.logisticsDependencies)).status).toBe(201);
  const e=f.logistics.getLogisticsDto(f.project.id).equipment[0];expect((await handleUpdateEquipment(f.request({workAreaLinks:[f.areaLinks[0],f.areaLinks[0]],processCatalogRevision:f.contexts.revision()}),f.project.publicId,e.id,f.logisticsDependencies)).status).toBe(400);
  expect(f.contexts.equipmentLinks(f.project.id)).toHaveLength(3);
 });
 it('preserves omitted equipment relations and treats identical Task replacement as a no-op',()=>{
  const f=setup(),e=f.createEquipment(),task=f.task(),before=f.contexts.equipmentLinks(f.project.id);
  f.logistics.updateEquipment(f.auth,f.revision(),e.id,{name:'rename'});expect(f.contexts.equipmentLinks(f.project.id)).toEqual(before);
  const input={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:f.processes[0].id,scope:'self'}],workAreaLinks:[{...f.areaLinks[0],scope:'self'}]};
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,input);const revision=f.revision();
  const repeated=f.catalog.replaceTaskContext(f.auth,revision,task.publicId,input);expect(repeated.data.operation.changed).toBe(false);expect(f.revision()).toBe(revision);
 });
 it('blocks used equipment WorkArea changes with Task and Target references and rolls back ordinary fields',()=>{
  const f=setup(),e=f.createEquipment(),task=f.task();
  f.logistics.replaceTaskLogisticsLinks(f.auth,f.revision(),task.publicId,{equipmentLinks:[{equipmentId:e.id,scope:'self'}],systemLinks:[]});
  const before=f.logistics.getLogisticsDto(f.project.id),revision=f.revision();
  expect(()=>f.logistics.updateEquipment(f.auth,revision,e.id,{name:'rollback',workAreaLinks:[],processCatalogRevision:f.contexts.revision()})).toThrowError(expect.objectContaining({status:409,code:'EQUIPMENT_WORK_AREA_IN_USE'}));
  expect(f.revision()).toBe(revision);expect(f.logistics.getLogisticsDto(f.project.id)).toEqual(before);
  f.logistics.replaceTaskLogisticsLinks(f.auth,f.revision(),task.publicId,{equipmentLinks:[],systemLinks:[]});
  const targets=new LogisticsTargetService(f.db,{clock:()=>now});targets.create(f.auth,f.revision(),{code:'TARGET',name:'Target',scope:'process',projectProcessId:f.processes[0].id,members:[{kind:'equipment',entityId:e.id}]});
  expect(()=>f.logistics.updateEquipment(f.auth,f.revision(),e.id,{workAreaLinks:[f.areaLinks[0]],processCatalogRevision:f.contexts.revision()})).toThrowError(expect.objectContaining({code:'EQUIPMENT_WORK_AREA_IN_USE'}));
 });
 it('keeps common Task explicit zero when multi-process System membership changes',()=>{
  const f=setup(),task=f.task();
  const system=f.logistics.createSystem(f.auth,f.revision(),{code:'S',name:'Shared',systemType:'mcs',layer:'coordinator',scope:'processes',processIds:f.processes.map(p=>p.id)}).data.logistics.systems[0];
  f.logistics.replaceTaskLogisticsLinks(f.auth,f.revision(),task.publicId,{equipmentLinks:[],systemLinks:[{systemId:system.id,scope:'self'}]});
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]});
  f.logistics.setSystemProcesses(f.auth,f.revision(),system.id,{processIds:[f.processes[1].id]});
  expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context).toMatchObject({processLinks:[],workAreaLinks:[]});
 });
 it('rejects actual foreign Project IDs at HTTP and composite SQLite FKs',async()=>{
  const f=setup(),task=f.task();
  const other=f.projects.insert({publicId:randomUUID(),name:'Other',description:'',status:'planned',passwordKdf:'scrypt',passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:'Asia/Seoul',createdAt:now.toISOString(),updatedAt:now.toISOString()});
  const foreign=new LogisticsRepository(f.db).insertProcess({publicId:randomUUID(),projectId:other.id,code:'FOREIGN',name:'Foreign',parentId:null,now:now.toISOString()});
  const response=await handleReplaceTaskProcessContext(f.request({processCatalogRevision:f.contexts.revision(),processLinks:[{processId:foreign.publicId,scope:'self'}],workAreaLinks:[]}),f.project.publicId,task.publicId,f.dependencies);
  expect(response.status).toBe(400);expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context.processLinks).toBeNull();
  f.db.prepare('INSERT INTO task_process_contexts VALUES(?,?)').run(f.project.id,task.id);
  expect(()=>f.db.prepare("INSERT INTO task_process_links VALUES(?,?,?,'self')").run(f.project.id,task.id,foreign.id)).toThrow('FOREIGN KEY');
 });
 it('preserves and clears inactive Task references while rejecting new inactive selections',()=>{
  const f=setup(),task=f.task(),second=f.task(),body={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:f.processes[0].id,scope:'self'}],workAreaLinks:[{...f.areaLinks[0],scope:'self'}]};
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,body);
  f.logistics.updateProcess(f.auth,f.revision(),f.processes[0].id,{active:false});
  f.catalog.mutate(f.admin.rawToken,f.contexts.revision(),'workAreas','update',f.areas[0].id,{active:false});body.processCatalogRevision=f.contexts.revision();
  expect(f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,body).data.operation.changed).toBe(false);
  expect(()=>f.catalog.replaceTaskContext(f.auth,f.revision(),second.publicId,body)).toThrowError(expect.objectContaining({status:409}));
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]});
  expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context.processLinks).toEqual([]);
 });
 it('checks milestone and generic type conversion through HTTP without changing context or revision',async()=>{
  const f=setup(),task=f.task(),body={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:f.processes[0].id,scope:'self'}],workAreaLinks:[]};
  f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,body);const revision=f.revision();
  const converted=await handleTaskHierarchyCommand(f.request({kind:'convert',taskId:task.publicId,targetType:'milestone'}),f.project.publicId,{authorizationService:f.projectService,hierarchyService:new TaskHierarchyService(f.db,{clock:()=>now}),applicationBaseUrl:base,environment:'production'});
  expect(converted.status).toBe(409);expect((await converted.json()).error.code).toBe('PROCESS_CONTEXT_TYPE_CONFLICT');expect(f.revision()).toBe(revision);
  const milestone=f.task();f.db.prepare("UPDATE tasks SET type='milestone',duration=0 WHERE id=?").run(milestone.id);
  expect((await handleReplaceTaskProcessContext(f.request(body),f.project.publicId,milestone.publicId,f.dependencies)).status).toBe(400);
 });
 it('rechecks session and both revisions after a delayed HTTP request body',async()=>{
  for(const change of ['session','project','catalog']){
   const f=setup(),task=f.task();let finish!:(body:unknown)=>void;
   const stream=new ReadableStream<Uint8Array>({start(controller){finish=body=>{controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));controller.close();};}});
   const body={processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]};
   const request=new Request(`${base}/api/context`,{method:'PUT',headers:{Origin:base,Cookie:f.cookie,'If-Match':`"${f.revision()}"`,'Content-Type':'application/json'},body:stream,duplex:'half'} as RequestInit&{duplex:'half'});
   const pending=handleReplaceTaskProcessContext(request,f.project.publicId,task.publicId,f.dependencies);
   if(change==='session') f.db.prepare('UPDATE edit_sessions SET revoked_at=? WHERE id=?').run(now.toISOString(),f.auth.sessionId);
   else if(change==='project') f.db.prepare('UPDATE projects SET revision=revision+1 WHERE id=?').run(f.project.id);
   else f.db.prepare('UPDATE process_catalog_state SET revision=revision+1').run();
   finish(body);expect((await pending).status).toBe(change==='session'?401:412);expect(f.catalog.taskContext(f.project.publicId,task.publicId).data.context.processLinks).toBeNull();
  }
 });
 it('upgrades old DB without rewriting legacy tasks and preserves multiple links on restart',()=>{
  const dir=mkdtempSync(join(tmpdir(),'issue725-'));directories.push(dir);const old=join(dir,'old');mkdirSync(old);
  for(const name of readdirSync(join(process.cwd(),'db/migrations')).filter(name=>Number(name.slice(0,4))<=27))copyFileSync(join(process.cwd(),'db/migrations',name),join(old,name));
  const filename=join(dir,'upgrade.sqlite3');const prior=openDatabase({filename,migrationsDirectory:old}).database;
  const legacyProject=insertHistoricalPublicProject(prior, {publicId:randomUUID(),name:'pre-0028',description:'',status:'planned',passwordKdf:'scrypt',passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:'Asia/Seoul',createdAt:now.toISOString(),updatedAt:now.toISOString()});
  const legacyTaskId=randomUUID();prior.prepare("INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,status,sort_order,created_at,updated_at) VALUES(?,?,?,'legacy','task','auto','2026-10-19','2026-10-19','2026-10-19',1,0,'not_started',0,?,?)").run(legacyProject.id,legacyTaskId,legacyTaskId,now.toISOString(),now.toISOString());
  const legacyRows=prior.prepare('SELECT * FROM tasks').all();
  runMigrations(prior,join(process.cwd(),'db/migrations'));
   expect(prior.prepare('SELECT version,name FROM schema_migrations ORDER BY version DESC LIMIT 1').get()).toEqual({version:32,name:'0032_project_issues.sql'});
   expect(prior.prepare('SELECT name FROM schema_migrations WHERE version=28').pluck().get()).toBe('0028_process_context.sql');
  expect(prior.prepare('SELECT * FROM tasks').all()).toEqual(legacyRows);expect(new ProcessContextRepository(prior).taskContexts(legacyProject.id)[0]).toMatchObject({taskId:legacyTaskId,processLinks:null,workAreaLinks:null});prior.close();
  const f=setup(filename),task=f.task(),e=f.createEquipment();f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]});f.db.close();
  const restarted=openDatabase({filename,migrationsDirectory:join(process.cwd(),'db/migrations')}).database;databases.push(restarted);const context=new ProcessContextRepository(restarted);
  expect(context.equipmentLinks(f.project.id)).toHaveLength(3);expect(context.taskContexts(f.project.id).find(t=>t.taskId===task.publicId)?.processLinks).toEqual([]);
  expect(new LogisticsService(restarted).getLogisticsDto(f.project.id).equipment[0]).toMatchObject({id:e.id,quantity:10});expect(restarted.pragma('foreign_key_check')).toEqual([]);
 });
});
