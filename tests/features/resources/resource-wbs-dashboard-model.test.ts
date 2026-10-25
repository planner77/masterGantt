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

// #809 extends this consumer's presentation tests; all arithmetic remains existing R2/Plan authority.
import { resourceChartDiagnosticQuery,resourceChartDiagnosticSelection,resourceChartEffort,resourceChartMetricValue,resourceChartPlanText,resourceChartQuery,resourceChartRank } from "../../../src/features/resources/resource-charts-model";
import { calculateResourcePlan } from "../../../src/domain/resources/resource-plan";
import { resourcePlanFixture,resourcePlanAssignment } from "../../fixtures/resource-plan";
import { buildResourceAnalysis } from "../../../src/domain/resources/resource-analysis";
import { wbsTaskLedgerFixture } from "../../fixtures/wbs-task-ledger";

describe("#809 chart presentation preserves canonical meanings",()=>{
 it("shows selected80 and same-person Project140, peak/excess, and null/partial/conversion separately",()=>{
  const selected=resourcePlanAssignment("selected","R1",80),outside=resourcePlanAssignment("outside","R1",60);
  const plan=calculateResourcePlan(resourcePlanFixture({selectedAssignments:[selected],fullProjectAssignments:[selected,outside]}));
  expect(plan.resources[0].summary.selected.loadPercent).toBe(80);expect(plan.resources[0].summary.project.loadPercent).toBe(140);
  expect(resourceChartPlanText(plan.resources[0].summary.selected,"M/D",20)).toContain("Load 80%");
  expect(resourceChartPlanText(plan.resources[0].summary.project,"M/D",20)).toContain("Load 140%");
  expect(resourceChartPlanText(plan.resources[0].summary.project,"M/D",20)).toContain("초과 5 개인·일 / 2 M/D");
  const unknown=resourcePlanAssignment("unknown","R1",null),partial=calculateResourcePlan(resourcePlanFixture({selectedAssignments:[selected,unknown],fullProjectAssignments:[selected,unknown]}));
  const text=resourceChartPlanText(partial.resources[0].summary.selected,"M/D",null);
  expect(text).toContain("부분합 · 미설정 1건");expect(text).toContain("Load 알려진 부분 80%");
  expect(resourceChartPlanText(plan.resources[0].summary.selected,"M/M",null)).toContain("환산 기준 미설정");
  expect(resourceChartPlanText({...plan.resources[0].summary.selected,capacityMd:0,loadPercent:null},"M/D",20)).toContain("Capacity 0의 계획 투입 경고");
 });
 it("uses exact R2 cells for three decisions, overlapping raw IDs, ranks and raw units",()=>{
  const ledger=wbsTaskLedgerFixture();
  const source={fetchGeneration:1,filters:{},sourceContext:{schema:"wbs-view-source/1" as const,contextSourceVersion:"explicit-task-context:v1" as const,snapshotId:"snapshot",dataSnapshotId:"data",projectPublicId:ledger.kpi.projectPublicId,projectRevision:1,catalogRevision:1,calendarRevision:"calendar",spec:RESOURCE_WBS_DEFAULT_SPEC,path:[],range:{from:ledger.kpi.from,to:ledger.kpi.to},asOfDate:ledger.kpi.asOfDate,mdPerMm:20,mdPerMmSource:"query" as const,mdPerMmProvided:true}};
  for(const kind of ["period","concentration","contribution"] as const){const query=resourceChartQuery(kind,"group","workArea","week","M/M"),model=buildResourceAnalysis({ledger,source,expectedSource:source,query});
   const ranked=resourceChartRank(model,"effort",10,0);expect(ranked.allCount).toBe(model.cells.length);
   for(const cell of ranked.rows){expect(model.cells).toContain(cell);expect(cell.selector.scopeKey).toBe(model.scope.scopeKey);expect(resourceChartMetricValue(cell,"tasks","M/M",20)).toBe(cell.tasks.taskCount);expect(resourceChartMetricValue(cell,"effort","M/M",20)).toBe(cell.assignments.effort.knownMd/20);}
   expect(resourceChartEffort(model.total.assignments.effort,"M/M",20)).toBe("0.7 M/M");expect(model.total.assignments.effort.knownMd).toBe(14);
  }
 });
 it("does not label unset or unknown conversion as configured zero",()=>{
  const effort={knownMd:0,plannedMd:null,plannedMm:null,state:"unset" as const,partial:false,unsetCount:2,assignmentIds:["a","b"],unsetAssignmentIds:["a","b"]};
  expect(resourceChartEffort(effort,"M/D",20)).toBe("미설정 2건");expect(resourceChartEffort(effort,"M/M",null)).toBe("환산 기준 미설정");
  expect(resourceChartEffort({...effort,state:"empty",plannedMd:0,plannedMm:0,unsetCount:0},"M/D",20)).toBe("0 M/D");
 });
});

describe("#809 explicit T0 diagnostic navigation",()=>{
 it("removes only personal conditions, fixes the original effective period and retains original scope",()=>{
  const f=wbsDashboardViewsFixture("direct");
  try{
   const person=f.resources.get("R1")!.publicId;
   const original=f.service.queryWbsView(f.project.publicId,{spec:RESOURCE_WBS_DEFAULT_SPEC,filters:{resourceIds:[person],from:"2026-10-01",to:"2026-10-31",asOfDate:"2026-10-26",granularity:"week",mdPerMm:20},analysis:{fetchGeneration:1,query:{pivot:["resource"]}}});
   if(!original||original.projection!=="report")throw Error("report");
   const ids=original.analysis!.diagnostics.personallyUnassigned.taskIds;
   expect(ids.length).toBeGreaterThan(0);expect(ids.every(id=>!original.taskIds.includes(id))).toBe(true);
   const query=resourceChartDiagnosticQuery(original);
   expect(query.filters).not.toHaveProperty("resourceIds");expect(query.filters).not.toHaveProperty("granularity");expect(query).not.toHaveProperty("analysis");
   expect(query.filters).toMatchObject({from:original.range.from,to:original.range.to,asOfDate:original.asOfDate,mdPerMm:20});expect(query.scope).toEqual(original.sourceContext.scope);
   const diagnostic=f.service.queryWbsView(f.project.publicId,query);
   if(!diagnostic||diagnostic.projection!=="report")throw Error("report");
   const exactSelection=resourceChartDiagnosticSelection(original,diagnostic,ids);
   expect(exactSelection).toEqual({taskIds:ids,assignmentIds:[]});
   const scope=f.service.queryWbsView(f.project.publicId,{...query,projection:{kind:"scope",snapshotId:diagnostic.snapshotId,path:[]}});
   if(!scope||scope.projection!=="scope")throw Error("scope");
   expect(wbsScheduleDisplayScope(scope,{exactSelection},[]).taskIds).toEqual(ids);
   expect(()=>resourceChartDiagnosticSelection(original,original,ids)).toThrow("REPORT_STALE");
   expect(()=>resourceChartDiagnosticSelection(original,{...diagnostic,sourceContext:{...diagnostic.sourceContext,calendarRevision:"different"}},ids)).toThrow("REPORT_STALE");
   expect(()=>resourceChartDiagnosticSelection(original,diagnostic,[original.taskIds[0]])).toThrow("REPORT_STALE");
   const restricted={...original,filters:{...original.filters,taskSearch:"업무",statuses:["completed" as const]},sourceContext:{...original.sourceContext,scope:{kind:"summarySubtree" as const,rootId:f.tasks.get("S")!.publicId}}};
   expect(resourceChartDiagnosticQuery(restricted)).toMatchObject({scope:restricted.sourceContext.scope,filters:{taskSearch:"업무",statuses:["completed"]}});
  }finally{f.database.close();}
 });
});

import { wbsScheduleDisplayScope } from "../../../src/features/resources/resource-drill-navigation-model";
