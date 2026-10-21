import {describe,it,expect,vi,afterEach} from "vitest";
import {wbsDashboardViewsFixture} from "../../fixtures/wbs-dashboard-views";
import {defaultWbsViewSpec} from "../../../src/features/resources/wbs-view-model";
import {readWbsViewResponse,fetchWbsView,type WbsViewFetchOptions} from "../../../src/features/resources/wbs-view-transport";
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
   const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data}),{status:200}));vi.stubGlobal("fetch",fetcher);
   await fetchWbsView({projectPublicId:f.project.publicId,projectRevision:data.projectRevision,input});
   expect(fetcher).toHaveBeenCalledWith(`/api/projects/${f.project.publicId}/resource-dashboard/views`,expect.objectContaining({method:"POST",credentials:"same-origin",cache:"no-store",body:JSON.stringify(input)}));
  }finally{f.database.close();}
 });
});
