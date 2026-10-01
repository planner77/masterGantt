import {randomUUID} from "node:crypto";
import {join} from "node:path";
import {inflateRawSync} from "node:zlib";
import {describe,expect,it} from "vitest";
import {openDatabase} from "../../../src/server/db/core";
import {ProjectService,RevisionMismatchError,SummaryTaskDeleteUnsupportedError} from "../../../src/server/projects/project-service-core";
import {TaskHierarchyService} from "../../../src/server/projects/task-hierarchy-service-core";
import {ProjectCopyService} from "../../../src/server/projects/project-copy-service-core";
import {ProjectTemplateService} from "../../../src/server/templates/project-template-service-core";
import {LinkService,LinkConflictError} from "../../../src/server/projects/link-service-core";
import {LogisticsService} from "../../../src/server/logistics/logistics-service-core";
import {buildAllEffectiveTaskLogistics,calculateLogisticsDashboardPure} from "../../../src/server/logistics/logistics-dashboard-service";
import {createWorkingCalendar} from "../../../src/domain/scheduling";
import {ResourceWorkloadService} from "../../../src/server/resources/resource-workload-service-core";
import {parseCreateTaskInput} from "../../../src/server/projects/task-contract";
import {buildProjectGanttSvg} from "../../../src/server/exports/project-svg-export-core";
import {buildProjectExcelWorkbook} from "../../../src/server/exports/project-excel-export-core";
const migrationsDirectory=join(process.cwd(),"db","migrations");
const clock=()=>new Date("2026-10-01T01:00:00Z");
const hashPassword=async()=>({algorithm:"scrypt" as const,salt:Buffer.alloc(16,1),hash:Buffer.alloc(32,2),n:32768,r:8,p:3,keyLength:32});
async function fixture(){
 const database=openDatabase({filename:":memory:",migrationsDirectory}).database;
 const service=new ProjectService(database,{clock,hashPassword});
 const created=await service.create({name:"빈 WBS",description:"",ownerName:"담당",editPassword:"Pass123456!"});
 const authorized=service.authorize(created.response.data.project.publicId,created.rawSessionToken);
 if(authorized.kind!=="authorized")throw new Error("Authorization required");
 return {database,service,authorization:authorized.authorization,publicId:created.response.data.project.publicId,hierarchy:new TaskHierarchyService(database,{clock})};
}
const unscheduled={type:"summary",scheduleMode:"auto",requestedStart:null,start:null,end:null,duration:null,progress:null};
const leaf={name:"첫 실제 작업",type:"task" as const,start:"2026-10-01",duration:2,progress:50};
describe("Issue #345 empty summary server boundaries",()=>{
 it("accepts name-only or null summary creation but never relaxes leaf/manual shape validation",()=>{
  expect(parseCreateTaskInput({name:"요약",type:"summary"}).success).toBe(true);
  expect(parseCreateTaskInput({name:"요약",type:"summary",start:null,end:null,duration:null,progress:null}).success).toBe(true);
  for(const input of [{name:"요약",type:"summary",start:"2026-10-01"},{name:"요약",type:"summary",scheduleMode:"manual"},{...leaf,start:null},{...leaf,duration:null},{...leaf,progress:null}]) expect(parseCreateTaskInput(input).success).toBe(false);
 });
 it("creates nested empty WBS, then adds and removes a milestone without changing Summary identity",async()=>{
  const f=await fixture();try{
   const root=f.service.createTask(f.authorization,1,{externalId:"S",name:"상위",type:"summary"}).data.tasks[0];
   const nestedResult=f.service.createTask(f.authorization,2,{externalId:"N",name:"중첩",type:"summary",parentTaskId:root.taskId});
   const nested=nestedResult.data.tasks.find(t=>t.externalId==="N")!;
   expect(nestedResult.data.tasks).toMatchObject([unscheduled,{...unscheduled,parentExternalId:"S"}]);
   const added=f.service.createTask(f.authorization,3,{...leaf,externalId:"M",type:"milestone",duration:0,parentTaskId:nested.taskId});
   expect(added.data.tasks.filter(t=>t.type==="summary")).toMatchObject([{start:"2026-10-01",end:"2026-10-01",duration:1,progress:50},{start:"2026-10-01",end:"2026-10-01",duration:1,progress:50}]);
   expect(()=>f.service.deleteTask(f.authorization,4,nested.taskId)).toThrow(SummaryTaskDeleteUnsupportedError);
   const milestone=added.data.tasks.find(t=>t.externalId==="M")!;
   const removed=f.service.deleteTask(f.authorization,4,milestone.taskId);
   expect(removed.data.project.revision).toBe(5);expect(removed.data.tasks).toMatchObject([{...unscheduled,taskId:root.taskId},{...unscheduled,taskId:nested.taskId}]);
   expect(new ProjectService(f.database,{clock}).getReadonlySnapshot(f.publicId)?.data.tasks).toEqual(removed.data.tasks);
   expect(()=>f.service.deleteTask(f.authorization,4,nested.taskId)).toThrow(RevisionMismatchError);
  }finally{f.database.close();}
 });
 it("keeps parent direct group assignments and rejects summary dependency endpoints after moving the last leaf",async()=>{
  const f=await fixture();try{
   const root=f.service.createTask(f.authorization,1,{externalId:"S",name:"상위",type:"summary"}).data.tasks[0];
   const group=Number(f.database.prepare("INSERT INTO resource_groups(public_id,name,created_at,updated_at) VALUES(?,'담당 그룹',?,?)").run(randomUUID(),clock().toISOString(),clock().toISOString()).lastInsertRowid);
   const parent=f.database.prepare("SELECT id FROM tasks WHERE public_id=?").pluck().get(root.taskId);
   f.database.prepare("INSERT INTO task_assignments(public_id,project_id,task_id,group_id,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(randomUUID(),f.authorization.projectId,parent,group,clock().toISOString(),clock().toISOString());
   const added=f.service.createTask(f.authorization,2,{...leaf,externalId:"T",parentTaskId:root.taskId});
   const target=f.service.createTask(f.authorization,3,{externalId:"D",name:"목표",type:"summary"}).data.tasks.find(t=>t.externalId==="D")!;
   const child=added.data.tasks.find(t=>t.externalId==="T")!;
   const moved=f.hierarchy.execute(f.authorization,4,{kind:"reparent",taskId:child.taskId,anchorTaskId:target.taskId,placement:"child"});
   expect(moved.data.tasks.find(t=>t.externalId==="S")).toMatchObject({...unscheduled,taskId:root.taskId});
   expect(f.database.prepare("SELECT task_id,group_id FROM task_assignments").all()).toEqual([{task_id:parent,group_id:group}]);
   expect(()=>new LinkService(f.database,clock).create(f.authorization,5,{predecessorExternalId:"S",successorExternalId:"T"})).toThrow(LinkConflictError);
   const workload=new ResourceWorkloadService(f.database).get(f.publicId);
   expect(workload).toBeDefined();
  }finally{f.database.close();}
 });
 it("retains subtree logistics scopes while empty and inherits them when a later child is added",async()=>{
  const f=await fixture();try{
   const root=f.service.createTask(f.authorization,1,{externalId:"S",name:"상위",type:"summary"}).data.tasks[0];
   const logistics=new LogisticsService(f.database,{clock});
   const process=logistics.createProcess(f.authorization,2,{code:"P",name:"공정"}).data.logistics.processes[0];
   const equipment=logistics.createEquipment(f.authorization,3,{code:"E",name:"설비",equipmentType:"conveyor",managementUnit:"unit",processId:process.id,quantity:1}).data.logistics.equipment[0];
   const linked=logistics.replaceTaskLogisticsLinks(f.authorization,4,root.taskId,{equipmentLinks:[{equipmentId:equipment.id,scope:"subtree"}],systemLinks:[]});
   const before=linked.data.logistics.taskEquipmentLinks;
   const first=f.service.createTask(f.authorization,5,{...leaf,externalId:"T",parentTaskId:root.taskId});
   const child=first.data.tasks.find(t=>t.externalId==="T")!;
   f.service.deleteTask(f.authorization,6,child.taskId);
   expect(logistics.getLogisticsDto(f.authorization.projectId).taskEquipmentLinks).toEqual(before);
   const added=f.service.createTask(f.authorization,7,{...leaf,externalId:"LATER",parentTaskId:root.taskId});
   const later=added.data.tasks.find(t=>t.externalId==="LATER")!;
   const logisticsDto=logistics.getLogisticsDto(f.authorization.projectId);
   const effective=buildAllEffectiveTaskLogistics(added.data.tasks,logisticsDto);
   expect(effective.get(later.taskId)?.effectiveEquipmentIds.has(equipment.id)).toBe(true);
   f.service.deleteTask(f.authorization,8,later.taskId);
   const snapshot=f.service.getReadonlySnapshot(f.publicId)!;
   const dashboard=calculateLogisticsDashboardPure({project:snapshot.data.project,catalogRevision:1,tasks:snapshot.data.tasks,logistics:logistics.getLogisticsDto(f.authorization.projectId),assignments:[],resources:[],groups:[],calendarForResource:()=>createWorkingCalendar({timezone:"Asia/Seoul",weekendDays:[6,0]}),filter:{},now:clock()});
   expect(JSON.stringify(dashboard)).not.toMatch(/NaN|Infinity/);
   expect(logistics.getLogisticsDto(f.authorization.projectId).taskEquipmentLinks).toEqual(before);
  }finally{f.database.close();}
 });
 it("preserves empty summary when copying project/subtree and instantiating a shifted template",async()=>{
  const f=await fixture();try{
   const root=f.service.createTask(f.authorization,1,{externalId:"S",name:"상위",type:"summary"}).data.tasks[0];
   const nested=f.hierarchy.execute(f.authorization,2,{kind:"create",anchorTaskId:root.taskId,placement:"child",task:{name:"중첩",type:"summary"}});
   expect(nested.data.tasks).toMatchObject([unscheduled,unscheduled]);
   const copied=f.hierarchy.execute(f.authorization,3,{kind:"copy",taskId:root.taskId,anchorTaskId:root.taskId,placement:"after"});
   expect(copied.data.tasks).toHaveLength(4);expect(copied.data.tasks.every(t=>t.start===null && t.duration===null)).toBe(true);
   const copy=await new ProjectCopyService(f.database,{clock,hashPassword}).copy(f.authorization,4,{name:"복사",description:"",ownerName:"담당",editPassword:"Pass123456!",resetProgress:true});
   expect(copy.response.data.tasks).toHaveLength(4);expect(copy.response.data.tasks.every(t=>t.progress===null && t.start===null)).toBe(true);
   const templates=new ProjectTemplateService(f.database,{clock,hashPassword});
   const template=templates.createTemplateFromProject(f.authorization,4,{name:"빈 템플릿"});
   expect(template.previewTasks.every(t=>t.offsetDays===null && t.duration===null)).toBe(true);
   const instantiated=await templates.instantiateProject(template.id,{name:"미래 WBS",ownerName:"담당",editPassword:"Pass123456!",projectStartDate:"2027-03-01"});
   expect(instantiated.response.data.tasks.every(t=>t.start===null && t.end===null && t.progress===null)).toBe(true);
  }finally{f.database.close();}
 });
 it("retains unscheduled rows in SVG/Excel with no bar or numeric date/progress substitute",async()=>{
  const f=await fixture();try{
   f.service.createTask(f.authorization,1,{externalId:"S",name:"빈 요약",type:"summary"});
   const snapshot=f.service.getReadonlySnapshot(f.publicId)!;
   const svg=buildProjectGanttSvg(snapshot,{scope:"project",scale:"day",hierarchyDisplay:"expanded"});
   expect(svg).toContain("1 빈 요약");expect(svg).toContain("—</text>");expect(svg).not.toContain('height="16" rx="3"');expect(svg).not.toContain("null</text>");
   const workbook=buildProjectExcelWorkbook(snapshot,{includeDependencies:false,scope:"project",scale:"day",hierarchyDisplay:"expanded",layout:{columns:[{id:"text",widthPx:224}]}});
   const xmls:string[]=[];const archive=Buffer.from(workbook);let offset=0;
   while(offset+30<=archive.length && archive.readUInt32LE(offset)===0x04034b50){const size=archive.readUInt32LE(offset+18),length=archive.readUInt16LE(offset+26),extra=archive.readUInt16LE(offset+28);const start=offset+30+length+extra;xmls.push(inflateRawSync(archive.subarray(start,start+size)).toString("utf8"));offset=start+size;}
   const taskSheet=xmls.find(xml=>xml.includes("기간(근무일)"))!;
   expect(taskSheet).toContain("빈 요약");expect(taskSheet).toMatch(/<c r="E2"[^>]*\/>/);expect(taskSheet).toMatch(/<c r="H2"[^>]*\/>/);
  }finally{f.database.close();}
 });
});
