import { randomUUID } from "node:crypto";
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { runMigrations } from "../../../src/server/db/migrations";
import { ProjectRepository, EditSessionRepository } from "../../../src/server/repositories/project-repository-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { ProcessCatalogService } from "../../../src/server/process-catalog/process-catalog-service-core";
import { ProcessContextRepository } from "../../../src/server/repositories/process-context-repository-core";
import { ProjectWorkAreaRepository } from "../../../src/server/repositories/project-work-area-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { handleReplaceTaskProcessContext } from "../../../src/server/process-catalog/process-catalog-handlers-core";
import { LogisticsKpiService } from "../../../src/server/logistics/logistics-kpi-service-core";
import { handleMutateWorkArea } from "../../../src/server/logistics/logistics-handlers-core";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import type { WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";

const now=new Date("2026-10-22T00:00:00Z"), base="https://gantt.example.test", migrationsDirectory=join(process.cwd(),"db/migrations");
const databases:Database.Database[]=[], dirs:string[]=[];
afterEach(()=>{for(const db of databases.splice(0))if(db.open)db.close();for(const path of dirs.splice(0))rmSync(path,{force:true,recursive:true});});
function setup(filename=":memory:") {
  const {database:db}=openDatabase({filename,migrationsDirectory});databases.push(db);
  const projects=new ProjectRepository(db);
  const project=projects.insert({publicId:randomUUID(),name:"신규",description:"",status:"planned",passwordKdf:"scrypt",passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:"Asia/Seoul",createdAt:now.toISOString(),updatedAt:now.toISOString()});
  const token=createSessionToken();new EditSessionRepository(db).insert({projectId:project.id,tokenHash:token.tokenHash,authVersion:project.authVersion,createdAt:now.toISOString(),expiresAt:sessionExpiry(now).toISOString()});
  const projectService=new TaskFieldProjectService(db,{clock:()=>now}),authorized=projectService.authorize(project.publicId,token.rawToken);
  if(authorized.kind!=="authorized")throw Error("fixture authorization");
  const auth=authorized.authorization,logistics=new LogisticsService(db,{clock:()=>now}),catalog=new ProcessCatalogService(db,{clock:()=>now}),areas=new ProjectWorkAreaRepository(db),contexts=new ProcessContextRepository(db);
  const revision=()=>projects.findById(project.id)!.revision;
  const process=(name:string)=>{const result=logistics.createProcess(auth,revision(),{name});return result.data.logistics.processes.find(p=>p.id===result.data.operation.targetPublicId)!;};
  const area=(processId:string,name="동명 구역")=>{const r=logistics.mutateWorkArea(auth,revision(),"create",processId,{name});return areas.list(project.id).find(a=>a.id===r.data.operation.targetPublicId)!;};
  const task=(type:"task"|"summary"="task",parentId:number|null=null)=>new ScheduleRepository(db).insertTask({projectId:project.id,publicId:randomUUID(),externalId:randomUUID(),name:type,type,parentId,scheduleMode:"auto",requestedStart:type==="task"?"2026-10-22":null,startDate:type==="task"?"2026-10-22":null,endDate:type==="task"?"2026-10-22":null,duration:type==="task"?1:null,progress:type==="task"?0:null,status:"not_started",sortOrder:0,createdAt:now.toISOString(),updatedAt:now.toISOString()});
  const dependencies={logisticsService:logistics,projectService,applicationBaseUrl:base,environment:"production"};
  const request=(body:unknown={},headers:Record<string,string>={})=>new Request(base+"/api/projects/p/logistics/work-areas/w",{method:"POST",headers:{Origin:base,"Content-Type":"application/json",Cookie:`${editSessionCookieName("production",new URL(base))}=${token.rawToken}`,"If-Match":`"${revision()}"`,...headers},body:JSON.stringify(body)});
  return {db,projects,project,auth,logistics,catalog,areas,contexts,revision,process,area,task,dependencies,request};
}
const filters={from:"2026-10-19",to:"2026-10-23",mdPerMm:20};
const spec={version:"wbs-view:v1" as const,contextSourceVersion:"explicit-task-context:v1" as const,root:"process" as const,levels:["workArea" as const]};

describe("#762 direct project-owned WorkAreas",()=>{
  it("completes name-only Project CRUD without classification or hidden catalog/Target writes and survives restart",async()=>{
    const dir=mkdtempSync(join(tmpdir(),"work-areas-"));dirs.push(dir);const filename=join(dir,"app.sqlite3"),f=setup(filename);
    const assembly=f.process("조립"),inspection=f.process("검사"),revision=f.revision(),catalogRevision=f.contexts.revision();
    for(const name of ["A구역","B구역"]) expect((await handleMutateWorkArea(f.request({name}),f.project.publicId,assembly.id,"create",f.dependencies)).status).toBe(201);
    const context=f.catalog.context(f.project.publicId).data;
    expect(context.selectionValid).toBe(false);expect(context.projectWorkAreas).toHaveLength(2);
    expect(context.projectWorkAreas!.every(a=>a.processId===assembly.id&&a.source==="project"&&a.occurrenceId===null&&a.editable)).toBe(true);
    expect(context.projectWorkAreas!.some(a=>a.processId===inspection.id)).toBe(false);
    expect(f.revision()).toBe(revision+2);expect(f.contexts.revision()).toBe(catalogRevision);
    for(const table of ["process_types","product_standard_processes","site_product_processes","work_areas","project_process_occurrence_mappings","logistics_targets"])expect(f.db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    const snapshot=context.projectWorkAreas;f.db.close();const restarted=openDatabase({filename,migrationsDirectory});databases.push(restarted.database);
    expect(new ProjectWorkAreaRepository(restarted.database).list(f.project.id)).toEqual(snapshot);expect(restarted.migrations.applied).toEqual([]);
  });
  it("enforces edit session, exact Origin and strong current revision; failed writes leave no rows or revision",async()=>{
    const f=setup(),p=f.process("P"),revision=f.revision();
    for(const [headers,status] of [[{Cookie:""},401],[{Origin:"https://evil.test"},403],[{"If-Match":`"${revision-1}"`},412],[{"If-Match":"W/\"1\""},400]] as const) {
      const response=await handleMutateWorkArea(f.request({name:"A"},headers),f.project.publicId,p.id,"create",f.dependencies);expect(response.status).toBe(status);
    }
    expect(f.areas.list(f.project.id)).toEqual([]);expect(f.revision()).toBe(revision);
    expect((await handleMutateWorkArea(f.request({name:"A",processId:randomUUID()}),f.project.publicId,p.id,"create",f.dependencies)).status).toBe(400);
    expect((await handleMutateWorkArea(f.request({name:"A"}),f.project.publicId,p.id,"create",f.dependencies)).status).toBe(201);
    expect((await handleMutateWorkArea(f.request({name:"B"},{"If-Match":`"${revision}"`}),f.project.publicId,p.id,"create",f.dependencies)).status).toBe(412);
  });
  it("keeps one immutable owner with same names in different processes, and validates both service and SQLite FKs",()=>{
    const f=setup(),a=f.process("A"),b=f.process("B"),wa=f.area(a.id),wb=f.area(b.id),task=f.task();
    expect(wa.id).not.toBe(wb.id);const revision=f.revision();
    const context={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:b.id,scope:"self"}],workAreaLinks:[{processId:b.id,workAreaId:wa.id,scope:"self"}]};
    expect(()=>f.catalog.replaceTaskContext(f.auth,revision,task.publicId,context)).toThrowError(expect.objectContaining({code:"WORK_AREA_OWNER_MISMATCH"}));
    expect(f.contexts.taskContexts(f.project.id)[0].processLinks).toBeNull();expect(f.revision()).toBe(revision);
    const area=f.areas.find(f.project.id,wa.id)!,other=f.db.prepare("SELECT id FROM project_processes WHERE public_id=?").pluck().get(b.id);
    expect(()=>f.db.prepare("UPDATE project_work_areas SET process_id=? WHERE id=?").run(other,area.id)).toThrow("WORK_AREA_OWNER_IMMUTABLE");
    f.db.prepare("INSERT INTO task_process_contexts VALUES(?,?)").run(f.project.id,task.id);f.db.prepare("INSERT INTO task_process_links VALUES(?,?,?,'self')").run(f.project.id,task.id,other);
    expect(()=>f.db.prepare("INSERT INTO task_project_work_area_links VALUES(?,?,?,?,'self')").run(f.project.id,task.id,other,area.id)).toThrow("FOREIGN KEY");
    expect(()=>f.logistics.deleteProcess(f.auth,revision,a.id,true)).toThrowError(expect.objectContaining({code:"PROCESS_IN_USE"}));
  });
  it("rejects foreign Project area mutation and Task linkage with separate valid edit sessions without changing either Project",async()=>{
    const f=setup(),ownerProcess=f.process("원본 공정"),ownerArea=f.area(ownerProcess.id);
    const other=f.projects.insert({publicId:randomUUID(),name:"다른 프로젝트",description:"",status:"planned",passwordKdf:"scrypt",passwordSalt:Buffer.alloc(16,3),passwordHash:Buffer.alloc(32,4),scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:"Asia/Seoul",createdAt:now.toISOString(),updatedAt:now.toISOString()});
    const token=createSessionToken();
    new EditSessionRepository(f.db).insert({projectId:other.id,tokenHash:token.tokenHash,authVersion:other.authVersion,createdAt:now.toISOString(),expiresAt:sessionExpiry(now).toISOString()});
    const authorized=new TaskFieldProjectService(f.db,{clock:()=>now}).authorize(other.publicId,token.rawToken);
    if(authorized.kind!=="authorized")throw Error("foreign Project fixture authorization");
    const auth=authorized.authorization,revision=()=>f.projects.findById(other.id)!.revision;
    const createdProcess=f.logistics.createProcess(auth,revision(),{name:"다른 공정"});
    const process=createdProcess.data.logistics.processes[0];
    const createdArea=f.logistics.mutateWorkArea(auth,revision(),"create",process.id,{name:"다른 구역"});
    const areaId=createdArea.data.operation.targetPublicId!;
    const task=new ScheduleRepository(f.db).insertTask({projectId:other.id,publicId:randomUUID(),externalId:randomUUID(),name:"다른 작업",type:"task",parentId:null,scheduleMode:"auto",requestedStart:"2026-10-22",startDate:"2026-10-22",endDate:"2026-10-22",duration:1,progress:0,status:"not_started",sortOrder:0,createdAt:now.toISOString(),updatedAt:now.toISOString()});
    const snapshot=()=>({projects:f.db.prepare("SELECT public_id,revision FROM projects ORDER BY id").all(),areas:f.db.prepare("SELECT * FROM project_work_areas ORDER BY id").all(),contexts:f.db.prepare("SELECT * FROM task_process_contexts ORDER BY project_id,task_id").all(),links:f.db.prepare("SELECT * FROM task_project_work_area_links ORDER BY project_id,task_id,work_area_id").all()});
    const before=snapshot();
    const patch=new Request(f.request({name:"잘못된 수정"}),{method:"PATCH"});
    expect((await handleMutateWorkArea(patch,f.project.publicId,areaId,"update",f.dependencies)).status).toBe(404);
    const deletion=new Request(base+"/api/projects/p/logistics/work-areas/w",{method:"DELETE",headers:f.request().headers});
    expect((await handleMutateWorkArea(deletion,f.project.publicId,areaId,"delete",f.dependencies)).status).toBe(404);
    const body={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:process.id,scope:"self"}],workAreaLinks:[{processId:process.id,workAreaId:ownerArea.id,scope:"self"}]};
    const linkage=new Request(base+"/api/projects/"+other.publicId+"/tasks/"+task.publicId+"/process-context",{method:"PUT",headers:{Origin:base,"Content-Type":"application/json",Cookie:`${editSessionCookieName("production",new URL(base))}=${token.rawToken}`,"If-Match":`"${revision()}"`},body:JSON.stringify(body)});
    const response=await handleReplaceTaskProcessContext(linkage,other.publicId,task.publicId,{service:f.catalog,projectService:f.dependencies.projectService,applicationBaseUrl:base,environment:"production"});
    expect(response.status).toBe(400);expect((await response.json()).error.code).toBe("WORK_AREA_OWNER_MISMATCH");
    expect(snapshot()).toEqual(before);
    expect(f.areas.find(f.project.id,ownerArea.id)).toBeDefined();expect(f.areas.find(other.id,areaId)).toBeDefined();
  });
  it("preserves explicit Task/Summary scope, multi-process equipment locations and quantity with no Target",()=>{
    const f=setup(),a=f.process("A"),b=f.process("B"),wa=f.area(a.id),wb=f.area(b.id),summary=f.task("summary"),child=f.task("task",summary.id);
    const links=[{processId:a.id,workAreaId:wa.id},{processId:b.id,workAreaId:wb.id}];
    const equipment=f.logistics.createEquipment(f.auth,f.revision(),{processId:a.id,code:"E",name:"Fleet",equipmentType:"amr",managementUnit:"fleet",quantity:10,workAreaLinks:links,processCatalogRevision:f.contexts.revision()}).data.logistics.equipment[0];
    f.catalog.replaceTaskContext(f.auth,f.revision(),summary.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[a,b].map(p=>({processId:p.id,scope:"subtree"})),workAreaLinks:links.map(l=>({...l,scope:"subtree"}))});
    f.catalog.replaceTaskContext(f.auth,f.revision(),child.publicId,{processCatalogRevision:f.contexts.revision(),processLinks:[],workAreaLinks:[]});
    expect(f.contexts.equipmentLinks(f.project.id)).toEqual(links.map(l=>({...l,equipmentId:equipment.id,occurrenceId:null})).sort((a,b)=>a.processId.localeCompare(b.processId)));
    expect(()=>f.logistics.mutateWorkArea(f.auth,f.revision(),"delete",wa.id)).toThrowError(expect.objectContaining({code:"WORK_AREA_IN_USE"}));
    expect(()=>f.db.prepare("UPDATE task_process_links SET scope='self' WHERE project_id=? AND task_id=?").run(f.project.id,summary.id)).toThrow("WORK_AREA_PROCESS_SCOPE_MISMATCH");
    expect(f.logistics.getLogisticsDto(f.project.id).equipment[0]).toMatchObject({id:equipment.id,quantity:10,processId:a.id});
    expect(f.contexts.taskContexts(f.project.id).find(row=>row.taskId===child.publicId)?.processLinks).toEqual([]);
    expect(f.db.prepare("SELECT COUNT(*) FROM logistics_targets").pluck().get()).toBe(0);
  });
  it("retains inactive selections and refuses new inactive references, unsafe reparent and duplicate codes atomically",()=>{
    const f=setup(),p=f.process("P"),wa=f.area(p.id),task=f.task();
    const input={processCatalogRevision:f.contexts.revision(),processLinks:[{processId:p.id,scope:"self"}],workAreaLinks:[{processId:p.id,workAreaId:wa.id,scope:"self"}]};
    f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,input);f.logistics.mutateWorkArea(f.auth,f.revision(),"update",wa.id,{active:false,name:"비활성"});
    expect(f.catalog.replaceTaskContext(f.auth,f.revision(),task.publicId,input).data.operation.changed).toBe(false);
    const second=f.task();expect(()=>f.catalog.replaceTaskContext(f.auth,f.revision(),second.publicId,input)).toThrowError(expect.objectContaining({code:"PROCESS_CATALOG_INACTIVE"}));
    const revision=f.revision();expect(()=>f.logistics.mutateWorkArea(f.auth,revision,"update",wa.id,{processId:p.id})).toThrow();
    f.logistics.mutateWorkArea(f.auth,revision,"create",p.id,{name:"duplicate",code:"SAME"});
    expect(()=>f.logistics.mutateWorkArea(f.auth,f.revision(),"create",p.id,{name:"duplicate",code:"SAME"})).toThrowError(expect.objectContaining({code:"WORK_AREA_CODE_ALREADY_EXISTS"}));
  });
  it("shows zero-Task direct areas only under their exact owner in both dashboard orders",()=>{
    const f=setup(),a=f.process("A"),b=f.process("B"),wa=f.area(a.id),wb=f.area(b.id),service=new ResourceDashboardService(f.db,{clock:()=>now});
    const report=service.queryWbsView(f.project.publicId,{spec,filters}) as WbsViewReportDto;
    const pa=report.children.find(n=>n.selector.id===a.id)!,pb=report.children.find(n=>n.selector.id===b.id)!;
    expect(pa.children.some(n=>n.selector.id===wa.id)).toBe(true);expect(pa.children.some(n=>n.selector.id===wb.id)).toBe(false);
    expect(pb.children.some(n=>n.selector.id===wa.id)).toBe(false);expect(report.taskIds).toEqual([]);
    expect(report.configurationCatalog.workAreas.find(row=>row.id===wa.id)).toMatchObject({occurrenceId:null,processIds:[a.id]});
    const reverse=service.queryWbsView(f.project.publicId,{spec:{...spec,root:"workArea",levels:["process"]},filters}) as WbsViewReportDto;
    expect(reverse.children.find(n=>n.selector.id===wa.id)!.children.filter(n=>n.selector.id!==null).map(n=>n.selector.id)).toEqual([a.id]);
  });
  it("preserves six-view Task/Assignment golden totals and exact drills with direct contexts plus legacy Target sources",()=>{
    const f=wbsDashboardViewsFixture("mixed");databases.push(f.database);
    const roots=["milestone","process","equipment","system","resource"] as const;
    const period={from:"2026-10-05",to:"2026-10-09",mdPerMm:20};
    const query=(root:typeof roots[number])=>f.service.queryWbsView(f.project.publicId,{spec:{...spec,root,levels:[]},filters:period}) as WbsViewReportDto;
    const golden=roots.map(query),kpi=new LogisticsKpiService(f.database,{clock:()=>now}),beforeKpi=kpi.getDashboard(f.project.publicId)!;
    const sourceTables=["logistics_targets","logistics_target_members","task_target_bindings","task_assignments","project_equipment","project_logistics_systems"];
    const before=sourceTables.map(table=>f.database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    const directId=randomUUID(),repo=new ProjectWorkAreaRepository(f.database);
    repo.insert({publicId:directId,projectId:f.project.id,processId:f.processA.id,code:"DIRECT-A",name:"직접 구역",active:true,sortOrder:0,now:now.toISOString()});
    const area=repo.find(f.project.id,directId)!;
    f.contexts.replaceEquipment(f.project.id,f.equipment[0].id,[{processId:f.processA.id,occurrenceId:null,workAreaId:area.id},f.areaB]);
    const t3=f.tasks.get("T3")!;
    f.contexts.replaceTask(f.project.id,t3.id,{processLinks:[f.processA,f.processB].map(p=>({processId:p.id,scope:"self"})),workAreaLinks:[{processId:f.processA.id,occurrenceId:null,workAreaId:area.id,scope:"self"},{...f.areaB,scope:"self"}]});
    roots.forEach((root,index)=>{
      const current=query(root),prior=golden[index];
      expect(current.taskIds).toEqual(prior.taskIds);expect(current.assignmentIds).toEqual(prior.assignmentIds);expect(current.totals).toEqual(prior.totals);
      for(const old of prior.children) {
        const node=current.children.find(n=>n.selector.id===old.selector.id)!;
        expect(node.taskIds).toEqual(old.taskIds);expect(node.assignmentIds).toEqual(old.assignmentIds);expect(node.totals).toEqual(old.totals);
        const drill=f.service.queryWbsView(f.project.publicId,{spec:{...spec,root,levels:[]},filters:period,projection:{kind:"scope",snapshotId:current.snapshotId,path:node.path}})!;
        expect(drill).toMatchObject({taskIds:old.taskIds,assignmentIds:old.assignmentIds});
      }
    });
    const afterKpi=kpi.getDashboard(f.project.publicId)!;
    expect(afterKpi.kpi).toEqual(beforeKpi.kpi);expect(afterKpi.effort).toEqual(beforeKpi.effort);expect(afterKpi.integrated!.assignmentIds).toEqual(beforeKpi.integrated!.assignmentIds);
    const report=f.service.queryWbsView(f.project.publicId,{spec,filters:period}) as WbsViewReportDto;
    const node=report.children.find(n=>n.selector.id===f.processA.publicId)!.children.find(n=>n.selector.id===directId)!;
    expect(node.taskIds).toEqual([t3.publicId]);
    expect(sourceTables.map(table=>f.database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())).toEqual(before);
  });
  it("adds an empty local schema over legacy data without cloning shared IDs or changing references",()=>{
    const f=wbsDashboardViewsFixture("direct");databases.push(f.database);
    const occurrence=f.database.prepare("SELECT * FROM site_product_processes WHERE id=?").get(f.areaA.occurrenceId) as {business_unit_id:number;product_id:number;site_entity_id:number};
    const sharedProcess=f.logistics.insertProcess({publicId:randomUUID(),projectId:f.project.id,code:"SHARED",name:"shared alias",parentId:null,now:now.toISOString()});
    f.database.prepare("INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(f.project.id,sharedProcess.id,f.areaA.occurrenceId,occurrence.business_unit_id,occurrence.product_id,occurrence.site_entity_id,now.toISOString(),now.toISOString());
    for(let i=0;i<100;i++)f.database.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(randomUUID(),f.areaA.occurrenceId,`EXTRA-${i}`,`legacy-${i}`,now.toISOString(),now.toISOString());
    const allAliases=new ProjectWorkAreaRepository(f.database).list(f.project.id);
    expect(allAliases.length).toBeGreaterThan(200);
    expect(new Set(allAliases.map(row=>row.id)).size).toBeLessThan(allAliases.length);
    const legacy=new ProjectWorkAreaRepository(f.database).list(f.project.id).filter(row=>row.id===f.areaId);
    expect(legacy).toHaveLength(2);expect(legacy.every(row=>row.editable===false&&row.diagnostics?.includes("shared"))).toBe(true);expect(legacy.every(row=>Number.isInteger(row.usageCount))).toBe(true);
    const tables=["project_processes","site_product_processes","work_areas","project_process_occurrence_mappings","task_work_area_links","equipment_work_areas","logistics_targets","logistics_target_members"];
    const before=tables.map(table=>f.database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    f.database.exec("DROP TRIGGER projects_project_work_area_delete; DROP TRIGGER task_process_links_project_area_scope_guard; DROP TABLE task_project_work_area_links; DROP TABLE equipment_project_work_areas; DROP TABLE project_work_areas; DELETE FROM schema_migrations WHERE version=30");
    const result=runMigrations(f.database,migrationsDirectory);expect(result.applied).toEqual(["0030_project_work_areas.sql"]);
    expect(tables.map(table=>f.database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())).toEqual(before);expect(f.database.pragma("foreign_key_check")).toEqual([]);
  });
  it("rolls back additive migration SQL and ledger together on failure",()=>{
    const dir=mkdtempSync(join(tmpdir(),"work-area-migration-"));dirs.push(dir);const old=join(dir,"old");mkdirSync(old);
    for(const file of readdirSync(migrationsDirectory).filter(file=>Number(file.slice(0,4))<=29))copyFileSync(join(migrationsDirectory,file),join(old,file));
    const f=openDatabase({filename:join(dir,"db.sqlite3"),migrationsDirectory:old});databases.push(f.database);
    f.database.exec("CREATE TABLE project_work_areas(id INTEGER PRIMARY KEY)");
    expect(()=>runMigrations(f.database,migrationsDirectory)).toThrow("Database migration failed");
    expect(f.database.prepare("SELECT MAX(version) FROM schema_migrations").pluck().get()).toBe(29);expect(f.database.prepare("SELECT 1 FROM sqlite_schema WHERE name='equipment_project_work_areas'").get()).toBeUndefined();
  });
});
