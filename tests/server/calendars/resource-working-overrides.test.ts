import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ReplaceProjectWorkCalendarRequest } from "../../../src/contracts/work-calendar";
import { ResourceCalendarExceptionConflictError } from "../../../src/domain/scheduling/resource-calendar";
import { handleGetProjectWorkCalendar, handlePreviewProjectWorkCalendar, handleReplaceProjectWorkCalendar } from "../../../src/server/calendars/work-calendar-handlers-core";
import { WorkCalendarService, WorkCalendarInvalidInputError } from "../../../src/server/calendars/work-calendar-service-core";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { handleReplaceResourceGroupMembers } from "../../../src/server/resources/resource-catalog-handlers-core";
import { ResourceWorkloadService } from "../../../src/server/resources/resource-workload-service-core";
import { resourceCatalogAdminCookieName } from "../../../src/server/security/resource-catalog-cookie-core";

const NOW=new Date("2026-09-29T00:00:00.000Z");
const DATE="2026-10-09";
const BASE="http://localhost:3000";
async function fixture() {
  const database=openDatabase({filename:":memory:",migrationsDirectory:join(process.cwd(),"db/migrations")}).database;
  const projects=new ProjectService(database,{clock:()=>NOW,hashPassword:async()=>({algorithm:"scrypt",salt:Buffer.alloc(16,1),hash:Buffer.alloc(32,2),n:32768,r:8,p:3,keyLength:32})});
  const created=await projects.create({name:"Resource calendars",description:"",editPassword:"Pass123!"});
  const projectId=created.response.data.project.publicId;
  const auth=projects.authorize(projectId,created.rawSessionToken);
  if(auth.kind!=="authorized") throw new Error("Missing authorization");
  const calendars=new WorkCalendarService(database,{clock:()=>NOW});
  const resources=new ResourceCatalogService(database,{clock:()=>NOW});
  const admin=resources.unlockAdmin("Admin123!","Admin123!")!;
  let catalog=resources.createTarget("resource",admin.rawToken,1,{name:"Resource A"});
  const resource=catalog.data.resources[0];
  catalog=resources.createTarget("group",admin.rawToken,catalog.data.revision,{name:"Group A"});
  const groupA=catalog.data.groups[0];
  catalog=resources.createTarget("group",admin.rawToken,catalog.data.revision,{name:"Group B"});
  const groupB=catalog.data.groups.find((group)=>group.name==="Group B")!;
  catalog=resources.replaceGroupMembers(groupA.id,admin.rawToken,catalog.data.revision,{resourceIds:[resource.id]});
  const input=(customDates:ReplaceProjectWorkCalendarRequest["customDates"]):ReplaceProjectWorkCalendarRequest=>({countryRules:[],customDates});
  const exception=(targetType:"PROJECT"|"RESOURCE_GROUP"|"RESOURCE",targetId:string|null,dayType:"WORKING"|"NON_WORKING",date=DATE)=>({name:`${targetType} ${dayType}`,date,targetType,targetId,dayType});
  const deps={calendarService:calendars,projectService:projects,applicationBaseUrl:BASE,environment:"development",requestId:()=>"test-request"};
  const request=(body:unknown,revision=1,headers:Record<string,string>={})=>new Request(`${BASE}/api/projects/${projectId}/work-calendar`,{method:"PUT",headers:{origin:BASE,cookie:`mastergantt_edit=${created.rawSessionToken}`,"if-match":`"${revision}"`,"content-type":"application/json",...headers},body:JSON.stringify(body)});
  return {database,projects,projectId,authorization:auth.authorization,calendars,resources,admin,catalog,resource,groupA,groupB,input,exception,deps,request};
}

describe("Issue #261 server authoritative resource calendars",()=>{
  it("normalizes legacy input, round-trips WORKING and describes upper-layer effects and final winners",async()=>{
    const f=await fixture();
    try {
      const input=f.input([
        {name:"Legacy holiday",date:DATE,targetType:"PROJECT"},
        f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING"),
        f.exception("RESOURCE",f.resource.id,"NON_WORKING"),
        f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING","2026-10-08"),
        f.exception("RESOURCE_GROUP",f.groupB.id,"WORKING","2026-10-08"),
      ]);
      const preview=f.calendars.preview(f.projectId,input);
      expect(preview.data.calendar.customDates[0].dayType).toBe("NON_WORKING");
      expect(preview.data.resourceExceptionEffects[0]).toMatchObject({customDateIndex:1,effect:"CHANGED",affectedResources:[{beforeDayType:"NON_WORKING",effectiveDayType:"NON_WORKING",effect:"CHANGED",winningLayer:"RESOURCE"}]});
      expect(preview.data.resourceExceptionEffects[2]).toMatchObject({effect:"NO_EFFECT",warningCode:"REDUNDANT_WORKING_EXCEPTION"});
      expect(preview.data.resourceExceptionEffects[3]).toMatchObject({effect:"NO_EFFECT",affectedResources:[]});
      const saved=f.calendars.replace(f.authorization,1,input);
      expect(saved.data.projectRevision).toBe(2);
      const get=handleGetProjectWorkCalendar(f.request(null,2),f.projectId,f.deps);
      expect(get.status).toBe(200);
      const canonical=(await get.json()).data.customDates;
      expect(canonical).toContainEqual(expect.objectContaining({targetId:f.groupA.id,dayType:"WORKING",date:DATE}));
      const next=f.calendars.replace(f.authorization,2,f.input(canonical));
      expect(next.data.projectRevision).toBe(3);
      expect(f.calendars.get(f.projectId)?.data.customDates.map((date)=>({...date,id:""})))
        .toEqual(canonical.map((date:Record<string,unknown>)=>({...date,id:""})));
    } finally {f.database.close();}
  });

  it("validates dayType and rejects same-level conflicts before any calendar/task/revision write",async()=>{
    const f=await fixture();
    try {
      for(const dayType of ["WORKING","INVALID",null]) {
        expect(()=>f.calendars.preview(f.projectId,f.input([{name:"Invalid",date:DATE,targetType:"PROJECT",dayType} as never]))).toThrow(WorkCalendarInvalidInputError);
      }
      f.catalog=f.resources.replaceGroupMembers(f.groupB.id,f.admin.rawToken,f.catalog.data.revision,{resourceIds:[f.resource.id]});
      const schedules=new ScheduleRepository(f.database);
      schedules.insertTask({projectId:f.authorization.projectId,externalId:randomUUID(),publicId:randomUUID(),name:"Persisted task",type:"task",scheduleMode:"auto",requestedStart:"2026-10-08",startDate:"2026-10-08",endDate:"2026-10-08",duration:1,progress:0,parentId:null,sortOrder:0,createdAt:NOW.toISOString(),updatedAt:NOW.toISOString()});
      const beforeTasks=schedules.listTasks(f.authorization.projectId);
      const before=f.calendars.get(f.projectId);
      const input=f.input([f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING"),f.exception("RESOURCE_GROUP",f.groupB.id,"NON_WORKING"),f.exception("RESOURCE",f.resource.id,"WORKING")]);
      expect(()=>f.calendars.preview(f.projectId,input)).toThrow(ResourceCalendarExceptionConflictError);
      const result=await handleReplaceProjectWorkCalendar(f.request(input),f.projectId,f.deps);
      expect(result.status).toBe(409);
      const error=(await result.json()).error;
      expect(error.code).toBe("RESOURCE_CALENDAR_EXCEPTION_CONFLICT");
      expect(error.details).toContainEqual({path:"date",code:error.code,message:DATE});
      expect(error.details).toContainEqual({path:"resourceId",code:error.code,message:f.resource.id});
      expect(f.calendars.get(f.projectId)).toEqual(before);
      expect(schedules.listTasks(f.authorization.projectId)).toEqual(beforeTasks);
      for(const target of [f.groupB,f.resource]) {
        const type=target===f.resource?"RESOURCE":"RESOURCE_GROUP";
        const opposite=f.input([f.exception(type,target.id,"WORKING"),f.exception(type,target.id,"NON_WORKING")]);
        expect(()=>f.calendars.replace(f.authorization,1,opposite)).toThrow(ResourceCalendarExceptionConflictError);
      }
      expect(f.calendars.get(f.projectId)).toEqual(before);
    } finally {f.database.close();}
  });

  it("validates empty targets and inactive unassigned resources and preserves redundant NON_WORKING",async()=>{
    const f=await fixture();
    try {
      const emptyConflict=f.input([f.exception("RESOURCE_GROUP",f.groupB.id,"WORKING"),f.exception("RESOURCE_GROUP",f.groupB.id,"NON_WORKING")]);
      expect(()=>f.calendars.preview(f.projectId,emptyConflict)).toThrow(ResourceCalendarExceptionConflictError);
      expect(()=>f.calendars.replace(f.authorization,1,emptyConflict)).toThrow(ResourceCalendarExceptionConflictError);
      f.catalog=f.resources.updateTarget("resource",f.resource.id,f.admin.rawToken,f.catalog.data.revision,{active:false});
      f.catalog=f.resources.replaceGroupMembers(f.groupB.id,f.admin.rawToken,f.catalog.data.revision,{resourceIds:[f.resource.id]});
      const inactiveConflict=f.input([f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING"),f.exception("RESOURCE_GROUP",f.groupB.id,"NON_WORKING")]);
      expect(()=>f.calendars.preview(f.projectId,inactiveConflict)).toThrow(ResourceCalendarExceptionConflictError);
      expect(f.calendars.get(f.projectId)?.data.projectRevision).toBe(1);
      const noop=f.input([f.exception("RESOURCE",f.resource.id,"NON_WORKING","2026-10-10")]);
      expect(f.calendars.preview(f.projectId,noop).data.resourceExceptionEffects[0]).toMatchObject({effect:"NO_EFFECT",warningCode:"REDUNDANT_NON_WORKING_EXCEPTION"});
      expect(f.calendars.replace(f.authorization,1,noop).data.projectRevision).toBe(2);
    } finally {f.database.close();}
  });

  it("keeps Origin, edit-session and stale If-Match gates on preview and PUT",async()=>{
    const f=await fixture();
    try {
      const input=f.input([f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING")]);
      for(const handler of [handlePreviewProjectWorkCalendar,handleReplaceProjectWorkCalendar]) {
        for(const [revision,headers,status,code] of [
          [1,{origin:"http://other.test"},403,"ORIGIN_NOT_ALLOWED"],
          [1,{cookie:""},401,"EDIT_SESSION_REQUIRED"],
          [99,{},412,"REVISION_MISMATCH"],
        ] as const) {
          const response=await handler(f.request(input,revision,headers),f.projectId,f.deps);
          expect(response.status).toBe(status);
          expect((await response.json()).error.code).toBe(code);
        }
      }
      expect(f.calendars.get(f.projectId)?.data.projectRevision).toBe(1);
    } finally {f.database.close();}
  });

  it("atomically rejects membership conflicts in an unassigned second project without leaking private rule names",async()=>{
    const f=await fixture();
    try {
      const second=await f.projects.create({name:"Other project",description:"",editPassword:"Pass123!"});
      const auth=f.projects.authorize(second.response.data.project.publicId,second.rawSessionToken);
      if(auth.kind!=="authorized") throw new Error("Missing second authorization");
      f.calendars.replace(auth.authorization,1,f.input([
        {...f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING"),name:"PRIVATE CALENDAR REASON"},
        f.exception("RESOURCE_GROUP",f.groupB.id,"NON_WORKING"),
        f.exception("RESOURCE",f.resource.id,"WORKING"),
      ]));
      const before=f.resources.getCatalog(f.admin.rawToken);
      const response=await handleReplaceResourceGroupMembers(new Request(`${BASE}/api/resource-groups/${f.groupB.id}/members`,{method:"PUT",headers:{origin:BASE,"if-match":`"${before.data.revision}"`,cookie:`${resourceCatalogAdminCookieName("development",new URL(BASE))}=${f.admin.rawToken}`,"content-type":"application/json"},body:JSON.stringify({resourceIds:[f.resource.id]})}),f.groupB.id,{resourceService:f.resources,applicationBaseUrl:BASE,environment:"development"});
      expect(response.status).toBe(409);
      const body=await response.text();
      expect(body).toContain("RESOURCE_CALENDAR_EXCEPTION_CONFLICT");
      expect(body).not.toContain("PRIVATE CALENDAR REASON");
      expect(f.resources.getCatalog(f.admin.rawToken)).toEqual(before);
      expect(f.calendars.get(f.projectId)?.data.projectRevision).toBe(1);
      expect(f.calendars.get(second.response.data.project.publicId)?.data.projectRevision).toBe(2);
    } finally {f.database.close();}
  });

  it("uses layered availability for M/D, M/M and daily over-allocation without moving tasks",async()=>{
    const f=await fixture();
    try {
      // A Project holiday lies inside an unchanged two-working-day task span.
      f.calendars.replace(f.authorization,1,f.input([f.exception("PROJECT",null,"NON_WORKING")]));
      const schedules=new ScheduleRepository(f.database);
      const tasks=["First","Second"].map((name)=>schedules.insertTask({projectId:f.authorization.projectId,externalId:randomUUID(),publicId:randomUUID(),name,type:"task",scheduleMode:"auto",requestedStart:"2026-10-08",startDate:"2026-10-08",endDate:"2026-10-12",duration:2,progress:0,parentId:null,sortOrder:schedules.nextRootSortOrder(f.authorization.projectId),createdAt:NOW.toISOString(),updatedAt:NOW.toISOString()}));
      let revision=2;
      for(const task of tasks) revision=f.resources.replaceTaskAssignments(f.authorization,revision,task.publicId,{catalogRevision:f.catalog.data.revision,targets:[{kind:"resource",id:f.resource.id,allocation:{percent:100}}]}).data.projectRevision;
      f.catalog=f.resources.replaceGroupMembers(f.groupB.id,f.admin.rawToken,f.catalog.data.revision,{resourceIds:[f.resource.id]});
      const before=schedules.listTasks(f.authorization.projectId);
      const service=new ResourceWorkloadService(f.database);
      expect(service.get(f.projectId,DATE,DATE,"20")?.data).toMatchObject({grandTotalMd:0,grandTotalMm:0});
      const input=f.input([f.exception("PROJECT",null,"NON_WORKING"),f.exception("RESOURCE_GROUP",f.groupA.id,"WORKING"),f.exception("RESOURCE_GROUP",f.groupB.id,"WORKING")]);
      revision=f.calendars.replace(f.authorization,revision,input).data.projectRevision;
      const working=service.get(f.projectId,DATE,DATE,"20")!.data;
      expect(working.grandTotalMd).toBe(2);
      expect(working.grandTotalMm).toBe(0.1);
      expect(working.groups[0].resources[0].overAllocated).toBe(true);
      revision=f.calendars.replace(f.authorization,revision,f.input([...input.customDates,f.exception("RESOURCE",f.resource.id,"NON_WORKING")])).data.projectRevision;
      const holiday=service.get(f.projectId,DATE,DATE,"20")!.data;
      expect(holiday.grandTotalMd).toBe(0);
      expect(holiday.groups[0].resources[0].overAllocated).toBe(false);
      const groupHoliday=f.input([f.exception("PROJECT",null,"NON_WORKING"),f.exception("RESOURCE_GROUP",f.groupA.id,"NON_WORKING"),f.exception("RESOURCE",f.resource.id,"WORKING")]);
      revision=f.calendars.replace(f.authorization,revision,groupHoliday).data.projectRevision;
      expect(service.get(f.projectId,DATE,DATE,"20")?.data.grandTotalMd).toBe(2);
      // An explicit working day already supplied by the project is a saved no-op.
      const noop=f.input([...groupHoliday.customDates,f.exception("RESOURCE",f.resource.id,"WORKING","2026-10-08")]);
      expect(f.calendars.preview(f.projectId,noop).data.resourceExceptionEffects.at(-1)?.effect).toBe("NO_EFFECT");
      const fullBefore=service.get(f.projectId,"2026-10-08","2026-10-12","20")?.data;
      revision=f.calendars.replace(f.authorization,revision,noop).data.projectRevision;
      expect(service.get(f.projectId,"2026-10-08","2026-10-12","20")?.data).toEqual({...fullBefore,projectRevision:revision});
      expect(schedules.listTasks(f.authorization.projectId).map(({startDate,endDate,duration})=>({startDate,endDate,duration})))
        .toEqual(before.map(({startDate,endDate,duration})=>({startDate,endDate,duration})));
    } finally {f.database.close();}
  });
});
