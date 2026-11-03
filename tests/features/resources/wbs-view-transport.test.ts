import { toResourcePublicV2 } from "../../../src/contracts/resource-public-v2";
import {describe,it,expect,vi,afterEach} from "vitest";
import {wbsDashboardViewsFixture} from "../../fixtures/wbs-dashboard-views";
import {defaultWbsViewSpec} from "../../../src/features/resources/wbs-view-model";
import {readWbsViewResponse,fetchWbsView,WbsViewTransportError,wbsViewErrorMessage,type WbsViewFetchOptions} from "../../../src/features/resources/wbs-view-transport";
import type {WbsViewQueryInput} from "../../../src/contracts/wbs-dashboard-views";
afterEach(()=>vi.unstubAllGlobals());
describe("WBS transport production contract",()=>{
 it("accepts real reports all roots and exact details/scope, rejects mismatched origins/page",()=>{
  const f=wbsDashboardViewsFixture();
  try {
   for(const root of ["process","equipment","system","resource","milestone"] as const){
    const input:WbsViewQueryInput={spec:{...defaultWbsViewSpec(root),levels:root==="equipment"?["process"]:[]},filters:{from:"2026-10-05",to:"2026-10-09",mdPerMm:20}};
    const data=f.service.queryWbsView(f.project.publicId,input)!;
    const options:WbsViewFetchOptions={projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input};
    expect(readWbsViewResponse({data},options)).toBe(data);
    expect(()=>readWbsViewResponse({data},{...options,input:{...input,filters:{...input.filters,taskSearch:"old"}}})).toThrow();
    expect(()=>readWbsViewResponse({data:{...data,sourceContext:{...data.sourceContext,mdPerMmProvided:false}}},options)).toThrow();
    if(data.projection==="report") expect(()=>readWbsViewResponse({data:{...data,totals:{...data.totals,assignments:{}}}},options)).toThrow();
    expect(()=>readWbsViewResponse({data},{...options,projectRevision:data.projectRevision+1})).toThrow();
    if(data.projection!=="report")throw Error("report");
    expect(()=>readWbsViewResponse({data:{...data,configurationCatalog:undefined}},options)).toThrow();
    expect(()=>readWbsViewResponse({data:{...data,configurationCatalog:{...data.configurationCatalog,workAreas:[{...data.configurationCatalog.workAreas[0],processIds:null}]}}},options)).toThrow();
    for(const kind of ["details","scope"] as const){
     const projection=kind==="details"?{kind,snapshotId:data.snapshotId,path:data.children[0].path,view:"tasks" as const,offset:0,limit:2}:{kind,snapshotId:data.snapshotId,path:data.children[0].path};
     const next={...options,input:{...input,projection}};
     const selected=f.service.queryWbsView(f.project.publicId,next.input)!;
     expect(readWbsViewResponse({data:selected},next)).toBe(selected);
     expect(()=>readWbsViewResponse({data:{...selected,snapshotId:"0".repeat(64)}},next)).toThrow();
     expect(()=>readWbsViewResponse({data:{...selected,path:[]}},next)).toThrow();
    }
    const duplicated={...data,children:[data.children[0],data.children[0]]};expect(()=>readWbsViewResponse({data:duplicated},options)).toThrow();
    expect(()=>readWbsViewResponse({data:{...data,sourceContext:{...data.sourceContext,scope:{kind:"scheduleSelection",nodeIds:[]}}}},options)).toThrow();
   }
  }finally{f.database.close();}
 });
 it("validates explicit raw scopes, assignment detail paging and nullable conversion provenance",()=>{
  const f=wbsDashboardViewsFixture();
  try {
   const all=f.service.queryWbsView(f.project.publicId,{spec:defaultWbsViewSpec("process")})!;
   if(all.projection!=="report")throw Error("report");
   for(const scope of [{kind:"scheduleSelection" as const,nodeIds:all.taskIds.slice(0,3).reverse()},{kind:"exactAssignments" as const,assignmentIds:all.assignmentIds.slice(0,2).reverse()}]) {
    const input:WbsViewQueryInput={spec:defaultWbsViewSpec("process"),filters:{mdPerMm:null,taskSearch:"  "},scope};
    const data=f.service.queryWbsView(f.project.publicId,input)!;
    const options={projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input};
    expect(readWbsViewResponse({data},options)).toBe(data);
    const next={...options,input:{...input,projection:{kind:"details" as const,snapshotId:data.snapshotId,path:[],view:"assignments" as const,offset:0,limit:1}}};
    const detail=f.service.queryWbsView(f.project.publicId,next.input)!;
    expect(readWbsViewResponse({data:detail},next)).toBe(detail);
    if(detail.projection!=="details")throw Error("details");
    expect(()=>readWbsViewResponse({data:{...detail,offset:1}},next)).toThrow();
    expect(()=>readWbsViewResponse({data:{...detail,nextOffset:999}},next)).toThrow();
   }
  } finally {f.database.close();}
 });
 it("requires complete equipment metadata and rejects malformed consumer arrays before rendering",()=>{
  const f=wbsDashboardViewsFixture();
  try {
   const input={spec:defaultWbsViewSpec("equipment")},data=f.service.queryWbsView(f.project.publicId,input)!;
   if(data.projection!=="report")throw Error("report");
   const options={projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input};
   const equipment=data.configurationCatalog.equipment[0];
   expect(readWbsViewResponse({data},options)).toBe(data);
   expect(readWbsViewResponse({data},options).projection).toBe("report");
   const direct={...data,configurationCatalog:{...data.configurationCatalog,workAreas:[{id:"direct-area",name:"프로젝트 구역",occurrenceId:null,processIds:[equipment.primaryProcessId]}],equipment:[{...equipment,workAreaLinks:[{processId:equipment.primaryProcessId,workAreaId:"direct-area",occurrenceId:null}]}]}};
   expect(readWbsViewResponse({data:direct},options)).toBe(direct);
   const malformed={...direct,configurationCatalog:{...direct.configurationCatalog,workAreas:[{...direct.configurationCatalog.workAreas[0],occurrenceId:42}]}};
   expect(()=>readWbsViewResponse({data:malformed},options)).toThrow();
   for(const invalid of [undefined,null,{},[null],[{...equipment,name:undefined}],[{...equipment,active:"true"}],[{...equipment,managementUnit:"batch"}],[{...equipment,quantity:-1}],[{...equipment,quantity:1.5}],[{...equipment,equipmentTypeName:undefined}],[{...equipment,primaryProcessId:null}],[{...equipment,workAreaLinks:undefined}],[{...equipment,workAreaLinks:[null]}],[{...equipment,workAreaLinks:[{processId:"p",occurrenceId:"o",workAreaId:null}]}],[{...equipment,resourceRoles:null}],[{...equipment,resourceRoles:[{resourceId:"r",resourceName:"담당",role:"owner",isPrimary:true,active:"true"}]}],[{...equipment,controlSystems:"system"}],[{...equipment,controlSystems:[{systemId:"s",systemName:"제어",controlRole:"coordinator"}]}]]){
    expect(()=>readWbsViewResponse({data:{...data,configurationCatalog:{...data.configurationCatalog,equipment:invalid}}},options)).toThrow("조회 응답의 출처가 일치하지 않습니다");
   }
   // Validation must not replace the original metadata or strip extra source fields.
   const enriched={...data,configurationCatalog:{...data.configurationCatalog,equipment:[{...equipment,sourceAudit:{revision:42}}]}};
   const parsed=readWbsViewResponse({data:enriched},options);
   expect(parsed).toBe(enriched);
   if(parsed.projection!=="report")throw Error("report");
   expect(parsed.configurationCatalog.equipment).toBe(enriched.configurationCatalog.equipment);
  }finally{f.database.close();}
 });
 it("POST is same-origin/no-store and never uses legacy transport",async()=>{
  const f=wbsDashboardViewsFixture();
  try{
   const input={spec:defaultWbsViewSpec("process")},data=f.service.queryWbsView(f.project.publicId,input)!;
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(toResourcePublicV2({data})),{status:200}));vi.stubGlobal("fetch",fetcher);
   await fetchWbsView({projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input});
   expect(fetcher).toHaveBeenCalledWith(`/api/projects/${f.project.publicId}/resource-dashboard/views`,expect.objectContaining({method:"POST",credentials:"same-origin",cache:"no-store",body:JSON.stringify(input)}));
  }finally{f.database.close();}
 });
});

describe("#809 chart analysis transport binding",()=>{
 it("accepts the same transaction raw and public-v2 model, and rejects mixed query/source/generation/IDs/selector keys",()=>{
  const f=wbsDashboardViewsFixture("direct");
  try{
   const input:WbsViewQueryInput={spec:defaultWbsViewSpec("resource"),filters:{from:"2026-10-05",to:"2026-10-09",granularity:"week",mdPerMm:20},analysis:{query:{pivot:["resource","milestone"],granularity:"week",unit:"M/D"},fetchGeneration:7}};
   const data=f.service.queryWbsView(f.project.publicId,input)!;
   if(data.projection!=="report"||!data.analysis)throw Error("analysis report");
   const options={projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input};
   expect(readWbsViewResponse({data},options)).toBe(data);
   expect(readWbsViewResponse({data:toResourcePublicV2(data)},options).snapshotId).toBe(data.snapshotId);
   for(const mutate of [
    (a:NonNullable<typeof data.analysis>)=>{a.scope.source.fetchGeneration=6;},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.source.sourceContext.snapshotId="0".repeat(64);},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.unit="M/M";},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.source.filters.taskSearch="different";},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.sourceScope!.taskRows[0].equipmentIds=["foreign"];},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.pivot=["group"];},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.granularity="month";},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.conditions={resource:["another"]};},
    (a:NonNullable<typeof data.analysis>)=>{a.scope.scopeKey="{}";},
    (a:NonNullable<typeof data.analysis>)=>{a.total.taskIds.push("foreign");},
    (a:NonNullable<typeof data.analysis>)=>{a.cells[0].selector.scopeKey="old";},
    (a:NonNullable<typeof data.analysis>)=>{a.plan.resources[0].cells[0].selected.knownMd=NaN;},
   ]){const corrupted=structuredClone(data);mutate(corrupted.analysis!);expect(()=>readWbsViewResponse({data:corrupted},options)).toThrow("출처");}
   expect(()=>readWbsViewResponse({data:{...data,analysis:undefined}},options)).toThrow();
  }finally{f.database.close();}
 });
 it("accepts the WBS configuration-only equipment type predicate without narrowing analysis effort or rewriting selector keys",()=>{
  const f=wbsDashboardViewsFixture("direct");
  try{
   const input:WbsViewQueryInput={spec:defaultWbsViewSpec("resource"),filters:{from:"2026-10-05",to:"2026-10-09",equipmentTypeCodes:["amr"]},analysis:{query:{pivot:["resource","equipment"]},fetchGeneration:5}};
   const data=f.service.queryWbsView(f.project.publicId,input)!;if(data.projection!=="report"||!data.analysis)throw Error("analysis");
   const options={projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input};
   expect(data.analysis.scope.source.filters).not.toHaveProperty("physicalEquipmentTypeCodes");
   const wire=toResourcePublicV2(data);const accepted=readWbsViewResponse({data:wire},{...options,input:{...input,filters:{from:"2026-10-05",to:"2026-10-09",equipmentTypeCodes:["amr"]}}});
   if(accepted.projection!=="report")throw Error("report");expect(accepted.analysis!.scope.scopeKey).toBe(data.analysis.scope.scopeKey);expect(accepted.analysis!.total.assignmentIds).toEqual(data.analysis.total.assignmentIds);
  }finally{f.database.close();}
 });
 it("does not accept a later analysis generation or a different same-outer-response chart query",()=>{
  const f=wbsDashboardViewsFixture("mixed");
  try{
   const input:WbsViewQueryInput={spec:defaultWbsViewSpec("resource"),filters:{from:"2026-10-05",to:"2026-10-09"},analysis:{query:{pivot:["group"]},fetchGeneration:2}};
   const data=f.service.queryWbsView(f.project.publicId,input)!;
   const options={projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input};
   expect(()=>readWbsViewResponse({data},{...options,input:{...input,analysis:{query:{pivot:["resource"]},fetchGeneration:2}}})).toThrow();
   expect(()=>readWbsViewResponse({data},{...options,input:{...input,analysis:{query:{pivot:["group"]},fetchGeneration:1}}})).toThrow();
   expect(readWbsViewResponse({data},options)).toBe(data);
  }finally{f.database.close();}
 });
});


describe("WBS transport private upstream failure boundary", () => {
 const privateProse = "PRIVATE_UPSTREAM_PROSE_866_TRANSPORT_DO_NOT_RENDER";
 const requestFailure = "조회 요청에 실패했습니다. 다시 시도해 주세요.";
 const invalidResponse = "조회 응답의 출처가 일치하지 않습니다. 다시 조회해 주세요.";
 const options: WbsViewFetchOptions = { projectPublicId: "00000000-0000-4000-8000-000000000001", projectRevision: 1, input: { spec: defaultWbsViewSpec("equipment") } };

 it.each([200, 409, 412, 503])("normalizes non-JSON HTTP %i without exposing parser/body prose", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(privateProse, { status })));
  const error = await fetchWbsView(options).catch(cause => cause);
  expect(error).toBeInstanceOf(WbsViewTransportError);
  expect(error).toMatchObject({ code: status === 200 ? "INVALID_RESPONSE" : "REQUEST_FAILED", status, message: status === 200 ? invalidResponse : requestFailure });
  expect(error.message).not.toContain("PRIVATE_UPSTREAM");
  expect(error.stack).not.toContain("PRIVATE_UPSTREAM");
  expect(error).not.toHaveProperty("cause");
  expect(error.isStale).toBe(status === 409);
 });

 it("normalizes rejected fetch errors without retaining a nested private cause", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(privateProse, { cause: { privateBody: privateProse } })));
  const error = await fetchWbsView(options).catch(cause => cause);
  expect(error).toBeInstanceOf(WbsViewTransportError);
  expect(error).toMatchObject({ code: "REQUEST_FAILED", status: 0, message: requestFailure });
  expect(error.stack).not.toContain(privateProse);
  expect(error).not.toHaveProperty("cause");
 });

 it("retains a stale JSON error's code/status while replacing its private prose", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "STALE_SNAPSHOT", message: privateProse } }, { status: 409 })));
  const error = await fetchWbsView(options).catch(cause => cause);
  expect(error).toBeInstanceOf(WbsViewTransportError);
  expect(error).toMatchObject({ code: "STALE_SNAPSHOT", status: 409, isStale: true, message: "요청을 처리하지 못했습니다. 다시 시도해 주세요." });
  expect(error.message).not.toContain(privateProse);
 });

 it("preserves a native AbortError rejection", async () => {
  const abort = new DOMException("Operation aborted", "AbortError");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
  await expect(fetchWbsView(options)).rejects.toBe(abort);
 });

 it("does not fetch when the original signal is already cancelled", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchWbsView({ ...options, signal: controller.signal })).rejects.toBe(controller.signal.reason);
  expect(fetcher).not.toHaveBeenCalled();
 });

 it("preserves cancellation when a late non-JSON response arrives", async () => {
  const controller = new AbortController();
  let release!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(resolve => { release = resolve; })));
  const pending = fetchWbsView({ ...options, signal: controller.signal });
  controller.abort();
  release(new Response(privateProse, { status: 503 }));
  await expect(pending).rejects.toBe(controller.signal.reason);
 });

 it("preserves cancellation while the response body is being read", async () => {
  const controller = new AbortController();
  const response = new Response("{}");
  vi.spyOn(response, "json").mockImplementation(async () => { controller.abort(); return {}; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const error = await fetchWbsView({ ...options, signal: controller.signal }).catch(cause => cause);
  expect(controller.signal.aborted).toBe(true);
  expect(error).toBe(controller.signal.reason);
 });
});


it("uses typed WBS messages only and never exposes unknown UI errors or nested causes", () => {
 const safe = new WbsViewTransportError("INVALID_RESPONSE", "조회 응답 버전이 일치하지 않습니다.");
 expect(wbsViewErrorMessage(safe)).toBe("조회 응답 버전이 일치하지 않습니다.");
 const privateMessage = "PRIVATE_UPSTREAM_PROSE_866_UNKNOWN_UI_DO_NOT_RENDER";
 for (const cause of [new Error(privateMessage, { cause: new Error(privateMessage) }), new SyntaxError(privateMessage), new DOMException(privateMessage, "AbortError"), { name: "WbsViewTransportError", message: privateMessage }, privateMessage, null, undefined]) {
  expect(wbsViewErrorMessage(cause)).toBe("조회 요청에 실패했습니다. 다시 시도해 주세요.");
  expect(wbsViewErrorMessage(cause, "상세 조회에 실패했습니다.")).toBe("상세 조회에 실패했습니다.");
 }
});
