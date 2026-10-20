import { describe, it, expect } from "vitest";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_WBS_DEFAULT_SPEC, RESOURCE_WBS_PRESETS, resourceParticipationLabel, resourceWbsPresentation, resourceWbsExcelRequest, resourceWbsPlanUnit } from "../../../src/features/resources/resource-wbs-dashboard-model";
import { parseProjectExcelExportInput } from "../../../src/server/exports/project-excel-export-contract";
import { validateWbsViewSpec } from "../../../src/features/resources/wbs-view-model";
import type { ProjectResourceMembershipDto } from "../../../src/contracts/project-resource-memberships";

describe("#736 Resource consumer identity and evidence",()=>{
 it("keeps null conversion from relabeling M/D as M/M",()=>{expect(resourceWbsPlanUnit("mm",null)).toBe("md");expect(resourceWbsPlanUnit("mm",20)).toBe("mm");expect(resourceWbsPlanUnit("md",null)).toBe("md");});
 it("distinguishes participation, actual assignment and inactive references without inventing effort",()=>{
  const resource: ProjectResourceMembershipDto={id:"r",name:"사람",code:null,description:"",active:true,roles:[],developerGrade:null,groups:[],registered:true,sources:{membership:true,taskAssignments:false,responsibilityAssignments:false,equipmentRoles:false,systemRoles:false},usage:{taskAssignments:0,responsibilityAssignments:0,equipmentRoles:0,systemRoles:0}};
  expect(resourceParticipationLabel(resource)).toContain("등록만 됨");
  expect(resourceParticipationLabel({...resource,sources:{...resource.sources,systemRoles:true}})).toContain("역할만 있음");
  expect(resourceParticipationLabel({...resource,active:false,sources:{...resource.sources,taskAssignments:true}})).toBe("Task 개인 배정 · 비활성 기존 참조");
 });
 it("uses exact server totals through both hierarchies and exports the WBS descriptor",()=>{
  const f=wbsDashboardViewsFixture("direct");
  try{
   let original:ReturnType<typeof resourceWbsPresentation>|undefined;
   for(const preset of RESOURCE_WBS_PRESETS){
    const spec={...RESOURCE_WBS_DEFAULT_SPEC,levels:preset.levels};
    expect(validateWbsViewSpec(spec).ok).toBe(true);
    const report=f.service.queryWbsView(f.project.publicId,{spec})!;
    if(report.projection!=="report")throw Error("report");
    const view=resourceWbsPresentation(report);
    expect(view.tasks).toBe(report.totals.tasks);expect(view.assignments).toBe(report.totals.assignments);
    if(original){expect(view.assignments).toEqual(original.assignments);expect(view.tasks).toEqual(original.tasks);}else original=view;
    const current=resourceWbsExcelRequest(report,"current");
    expect(current.resourceDashboard?.expectedReport.context).toBe(report.sourceContext);
    expect(current.resourceDashboard).toMatchObject({basis:"current",expectedReport:{snapshotId:report.snapshotId,filters:report.filters},granularities:["week","month"]});
    expect(parseProjectExcelExportInput(current).success).toBe(true);
    const project=resourceWbsExcelRequest(report,"project");
    expect(project.resourceDashboard?.expectedReport).toEqual({context:report.sourceContext,filters:report.filters});
    expect(parseProjectExcelExportInput(project).success).toBe(true);
   }
  }finally{f.database.close();}
 });
 it("a personal filter keeps the exact personal Assignment intersection without co-assignee effort",()=>{
  const f=wbsDashboardViewsFixture("direct");
  try{
   const resource=f.resources.get("R1")!;
   const report=f.service.queryWbsView(f.project.publicId,{spec:RESOURCE_WBS_DEFAULT_SPEC,filters:{resourceIds:[resource.publicId],granularity:"week"}})!;
   if(report.projection!=="report")throw Error("report");
   expect(report.resourceAdapter).toBeDefined();
   expect(report.assignmentIds.length).toBeGreaterThan(0);
   expect(report.resourceAdapter!.binding.scope).toEqual({kind:"exactAssignments",assignmentIds:report.assignmentIds});
   expect(resourceWbsExcelRequest(report,"current").resourceDashboard?.granularities).toEqual(["week"]);
   const resourceRow=report.children.find(row=>row.selector.id===resource.publicId)!;
   expect(resourceRow.assignmentIds).toEqual(report.assignmentIds);
   expect(resourceRow.totals.assignments).toEqual(report.totals.assignments);
  }finally{f.database.close();}
 });
});
