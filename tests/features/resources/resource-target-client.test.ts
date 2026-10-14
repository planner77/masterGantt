import { describe, expect, it } from "vitest";
import { dashboardQuery, detailsQuery, orderTargetMatrixColumns, readDashboard, readDetails, sameSelector } from "../../../src/features/resources/resource-dashboard-model";
import { resourceDashboardUiFixture, resourceDashboardDetailUiFixture } from "../../fixtures/resource-dashboard-ui";
import type { StatefulProjectFixture } from "../../fixtures/stateful-project";
import type { ResourceDashboardSelector, ResourceDashboardTargetProjection } from "../../../src/contracts/resource-dashboard";
const fixture = {project:{publicId:"a3405d3d-8cb4-4da4-9b0f-43a5de330003",revision:40}, tasks:[{},{},{taskId:"00000000-0000-4000-8000-000000000003",name:"shared",externalId:"LEAF"}]} as StatefulProjectFixture;
const path = [{dimension:"target" as const,id:"00000000-0000-4000-8000-000000000010"},{dimension:"resource" as const,id:"00000000-0000-4000-8000-000000000020"}];
const selector: ResourceDashboardSelector = {dimension:"targetProjection",id:null,metric:"all",targetPath:path};
function report() {
 const query=dashboardQuery({mode:"group",projectionOrder:["target","resource"],targetIds:[path[0].id]});
 const data=resourceDashboardUiFixture(fixture,new URLSearchParams("mode=group"));
 data.filters.projectionOrder=["target","resource"]; data.filters.targetIds=[path[0].id];
 data.targetProjection={order:["target","resource"],children:[{dimension:"target",id:path[0].id,name:"A",active:true,summary:{...data.summary,selector:{...selector,targetPath:[path[0]]}},sourceKinds:["target_binding"],equipmentQuantity:10,systemCount:1,children:[{dimension:"resource",id:path[1].id,name:"Alice",active:true,summary:{...data.summary,selector},sourceKinds:["target_binding"],equipmentQuantity:10,systemCount:1,children:[]}]}],projectReference:{...data.summary,selector:{dimension:"all",id:null,metric:"all",assignmentScope:"projectReference"}},relatedMembers:{},diagnostics:{targetUnlinkedTaskCount:1,legacyOnlyTaskCount:1,unusedTargetIds:[],projectCommonTargetIds:[],noWorkAreaTargetIds:[],unmappedProjectProcessIds:[]},metadata:{subtotalsAdditive:false,assignmentScope:"A",memberScope:"T0"},catalog:[{dimension:"target",id:path[0].id,name:"A",active:true,code:"A"}]} as unknown as ResourceDashboardTargetProjection;
 return {query,data};
}
describe("#621 Target client transport",()=>{
 it("preserves projection order and transports targetPath exactly",()=>{
  const {query,data}=report(); expect(query.get("projectionOrder")).toBe("target,resource");
  const targetQuery=detailsQuery(data,selector,"assignments",50);
  expect(targetQuery.get("targetPath")).toBe(JSON.stringify(path)); expect(targetQuery.get("targetIds")).toBe(path[0].id); expect(targetQuery.get("offset")).toBe("50");
  expect(dashboardQuery({projectionOrder:["resource","target","group"]}).get("projectionOrder")).toBe("resource,target,group");
 });
 it("retains nested server totals/catalog/reference and rejects stripped or mismatched projections",()=>{
  const {query,data}=report(); const value=readDashboard({data},fixture.project.publicId,query);
  expect(value?.targetProjection?.children[0].children[0].summary.selector).toEqual(selector);
  expect(value?.targetProjection?.projectReference.selector.assignmentScope).toBe("projectReference"); expect(value?.targetProjection?.catalog).toHaveLength(1);
  expect(readDashboard({data:{...data,targetProjection:undefined}},fixture.project.publicId,query)).toBeNull();
  expect(readDashboard({data:{...data,filters:{...data.filters,targetIds:undefined}}},fixture.project.publicId,query)).toBeNull();
  expect(readDashboard({data:{...data,targetProjection:{...data.targetProjection,order:["resource","target"]}}},fixture.project.publicId,query)).toBeNull();
 });
 it("does not merge same task/assignment detail across distinct Target paths",()=>{
  const {data}=report(); const value=resourceDashboardDetailUiFixture(fixture,detailsQuery(data,data.summary.selector,"assignments",0));
  value.selector=selector; value.rows[0].targetSources={taskId:value.rows[0].taskId,bindings:[],inheritedBindings:[],effectiveMembers:[],legacySources:[],effectiveEquipmentIds:[],effectiveSystemIds:[],effectiveTargetIds:[path[0].id]};
  expect(readDetails({data:value},data,selector,"assignments",0)?.rows[0].targetSources?.effectiveTargetIds).toEqual([path[0].id]);
  const other={...selector,targetPath:[{...path[0],id:"other"},path[1]]};
  expect(sameSelector(selector,other)).toBe(false); expect(readDetails({data:value},data,other,"assignments",0)).toBeNull();
 });
 it("sorts Target matrix columns by all Resource row contributions rather than the final cell",()=>{
  const {data}=report(); const original=data.targetProjection!.children[0];
  const target=(id:string,knownMd:number)=>({...original,dimension:"target" as const,id,name:id,summary:{...original.summary,effort:{...original.summary.effort,knownMd}},children:[]});
  const rows=[
   {...original,dimension:"resource" as const,id:"resource-1",children:[target("B",2),target("A",9)]},
   {...original,dimension:"resource" as const,id:"resource-2",children:[target("B",7),target("A",1)]},
  ];
  const label=(node: typeof original)=>node.name??"";
  expect(orderTargetMatrixColumns(rows,"server",label).map(node=>node.id)).toEqual(["B","A"]);
  expect(orderTargetMatrixColumns(rows,"effort",label).map(node=>node.id)).toEqual(["A","B"]);
  expect(orderTargetMatrixColumns(rows,"name",label).map(node=>node.id)).toEqual(["A","B"]);
  // A=10, B=9; the last row alone would incorrectly place B before A.
  expect(rows[1].children.map(node=>node.summary.effort.knownMd)).toEqual([7,1]);
 });
});
