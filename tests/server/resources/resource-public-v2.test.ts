import { randomUUID } from "node:crypto";
import { handleWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-handlers-core";
import { afterEach,describe,expect,it } from "vitest";
import { handleGetResourceDashboard,handleGetResourcePlan,handleResourceDrill } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { resourceDashboardTargetsFixture } from "../../fixtures/resource-dashboard-targets";
import { readDashboard,readDetails } from "../../../src/features/resources/resource-dashboard-model";
import { readPlanDetails } from "../../../src/features/resources/resource-plan-model";
import { fromResourcePublicV2 } from "../../../src/contracts/resource-public-v2";
const fixtures:ReturnType<typeof resourceDashboardTargetsFixture>[]=[];
const fixture=()=>{const f=resourceDashboardTargetsFixture();fixtures.push(f);return f;};
afterEach(()=>{for(const f of fixtures.splice(0))f.database.close();});
const assertNeutral=(body:unknown,ids:string[])=>{
 const text=JSON.stringify(body);expect(text).not.toMatch(/"(?:targetId|targetIds|targetScopes|targetSources|targetOptions|targetMembers|inactiveTargetIds)"/);
 for(const id of ids)expect(text).not.toContain(id);
};
describe("#785 default-v2 SQLite resource boundary",()=>{
 it("rejects dangling archived rows before common Report/WBS/Excel inner joins without changing originals",async()=>{
  const f=fixture(),base=f.service.getDashboard(f.project.publicId)!;
  f.database.pragma("foreign_keys=OFF");
  const id=randomUUID();
  f.database.prepare("INSERT INTO task_target_bindings(public_id,project_id,task_id,target_id,scope,selection,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(id,f.project.id,999999,f.targets[0].internalId,"self","whole","2026-10-23T00:00:00.000Z","2026-10-23T00:00:00.000Z");
  f.database.pragma("foreign_keys=ON");
  const original=f.database.prepare("SELECT * FROM task_target_bindings WHERE public_id=?").get(id);
  expect(f.database.pragma("foreign_key_check")).toHaveLength(1);
  const report=await handleGetResourceDashboard(f.request(),f.project.publicId,{service:f.service});
  expect(report.status).toBe(409);expect((await report.json()).error.code).toBe("LOGISTICS_SOURCE_INVALID");
  const request=new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/views`,{method:"POST",headers:{Origin:"https://gantt.example","Content-Type":"application/json"},body:JSON.stringify({spec:{version:"wbs-view:v1",contextSourceVersion:"explicit-task-context:v1",root:"equipment"}})});
  const wbs=await handleWbsViewQuery(request,f.project.publicId,{service:f.service,applicationBaseUrl:"https://gantt.example",environment:"production"});
  expect(wbs.status).toBe(409);expect((await wbs.json()).error.code).toBe("LOGISTICS_SOURCE_INVALID");
  expect(()=>f.service.getExcelReport(f.project.publicId,{basis:"current",expectedReport:{context:base.resourceScopeContext!,snapshotId:base.snapshotId,filters:{}},granularities:["week"]})).toThrowError(expect.objectContaining({status:409,code:"LOGISTICS_SOURCE_INVALID"}));
  expect(f.database.prepare("SELECT * FROM task_target_bindings WHERE public_id=?").get(id)).toEqual(original);
  expect(f.database.pragma("foreign_key_check")).toHaveLength(1);
 });
 it("keeps physical direct/archive union, client provenance validation and Plan Capacity R with exact details",async()=>{
  const f=fixture(),query=new URLSearchParams({systemIds:f.systems[2].publicId,granularity:"week"});
  const before=f.state(),response=await handleGetResourceDashboard(f.request(query.toString()),f.project.publicId,{service:f.service});
  expect(response.status).toBe(200);expect(response.headers.get("X-MasterGantt-Resource-Version")).toBe("2");
  const body=await response.json();expect(body.data.schema).toBe("resource-dashboard/2");assertNeutral(body,f.targets.map(row=>row.id));
  const report=readDashboard(body,f.project.publicId,query);expect(report).not.toBeNull();
  const internal=f.service.getDashboard(f.project.publicId,{systemIds:[f.systems[2].publicId],granularity:"week"})!;
  expect(report!.summary).toEqual(internal.summary);expect(report!.plan!.population).toEqual(internal.plan!.population);
  expect(report!.plan!.totals).toEqual(internal.plan!.totals);
  const input={snapshotId:report!.snapshotId,selector:{dimension:"all" as const,id:null,metric:"all" as const},view:"assignments" as const,offset:0,limit:50};
  const detailQuery=new URLSearchParams(query);for(const [key,value]of Object.entries({...input,selector:undefined,dimension:"all",metric:"all"}))if(value!==undefined)detailQuery.set(key,String(value));
  const detailResponse=await handleGetResourceDashboard(f.request(detailQuery.toString(),true),f.project.publicId,{service:f.service},true);
  expect(detailResponse.status).toBe(200);const detailBody=await detailResponse.json();assertNeutral(detailBody,f.targets.map(row=>row.id));
  const page=readDetails(detailBody,report!,input.selector,"assignments",0);expect(page).not.toBeNull();expect(page!.totalCount).toBe(report!.summary.assignmentCount);
  const planInput={snapshotId:report!.snapshotId,granularity:"week" as const,periodId:"all",selector:{kind:"total" as const},demandScope:"selected" as const,offset:0,limit:100};
  const planParams=new URLSearchParams(query);for(const [key,value]of Object.entries({...planInput,selector:undefined,row:"total"}))if(value!==undefined)planParams.set(key,String(value));
  const planResponse=await handleGetResourcePlan(f.request(planParams.toString()),f.project.publicId,{service:f.service},"daily");
  expect(planResponse.status).toBe(200);const planBody=await planResponse.json();assertNeutral(planBody,f.targets.map(row=>row.id));expect(readPlanDetails(planBody,report!,planInput,"daily")).not.toBeNull();
  expect(f.state()).toEqual(before);
 });
 it("rejects legacy filter/projection by default but exposes an explicit deprecated read-only v1 audit",async()=>{
  const f=fixture(),old=f.request(`targetIds=${f.targets[0].id}`),blocked=await handleGetResourceDashboard(old,f.project.publicId,{service:f.service});
  expect(blocked.status).toBe(410);expect((await blocked.json()).error.code).toBe("RESOURCE_SELECTION_RETIRED");
  for(const order of ["resource,equipment","equipment,system"]){
    const result=await handleGetResourceDashboard(f.request(`projectionOrder=${order}`),f.project.publicId,{service:f.service});
    expect(result.status).toBe(410);expect((await result.json()).error.code).toBe("RESOURCE_SELECTION_RETIRED");
  }
  const legacy=await handleGetResourceDashboard(new Request(old,{headers:{"X-MasterGantt-Resource-Version":"1"}}),f.project.publicId,{service:f.service});
  expect(legacy.status).toBe(200);expect(legacy.headers.get("Deprecation")).toBe("true");expect(legacy.headers.get("Link")).toBe('<https://github.com/planner77/masterGantt/blob/main/docs/API.md>; rel="deprecation"');expect((await legacy.json()).data.schema).toBe("resource-dashboard/1");
 });
 it("preserves exact Assignment source intersection and normalized physical echo on POST",async()=>{
  const f=fixture(),base=f.service.getDashboard(f.project.publicId)!,filters={systemIds:[f.systems[2].publicId]},input={sourceContext:base.resourceScopeContext,scope:{kind:"exactAssignments",assignmentIds:[f.assignmentIds.get("A1")]},filters,projection:{kind:"report"}};
  const request=new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/query`,{method:"POST",headers:{Origin:"https://gantt.example","Content-Type":"application/json"},body:JSON.stringify(input)});
  const response=await handleResourceDrill(request,f.project.publicId,{service:f.service,applicationBaseUrl:"https://gantt.example",environment:"production"},true);
  expect(response.status).toBe(200);const body=await response.json();assertNeutral(body,f.targets.map(row=>row.id));
  const decoded=fromResourcePublicV2(body) as {drill:{targetFilters:{systemIds:string[]}};data:{summary:{assignmentCount:number}}};
  expect(decoded.drill.targetFilters.systemIds).toEqual(filters.systemIds);expect(decoded.data.summary.assignmentCount).toBe(1);
 });
});
