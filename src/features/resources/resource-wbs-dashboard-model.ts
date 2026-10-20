import type { ProjectResourceMembershipDto } from "../../contracts/project-resource-memberships";
import type { WbsViewNode, WbsViewReportDto, WbsViewSpec } from "../../contracts/wbs-dashboard-views";

export const RESOURCE_WBS_DEFAULT_SPEC: WbsViewSpec = {
  version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "resource", levels: [],
};
export const RESOURCE_WBS_PRESETS: Array<{ label: string; levels: NonNullable<WbsViewSpec["levels"]> }> = [
  { label: "리소스 단독", levels: [] },
  { label: "리소스 → 공정 → WorkArea → 설비 / 물류 시스템", levels: ["process", "workArea", { kind: "siblings", dimensions: ["equipment", "system"] }] },
  { label: "리소스 → Milestone → 공정", levels: ["milestone", "process"] },
];
/** These are participation labels, never effort/Capacity or assignment selectors. */
export function resourceParticipationLabel(resource: ProjectResourceMembershipDto) {
  const assigned = resource.sources.taskAssignments;
  const roleOnly = !assigned && (resource.sources.responsibilityAssignments || resource.sources.equipmentRoles || resource.sources.systemRoles);
  return [assigned ? "Task 개인 배정" : roleOnly ? "역할만 있음 · Task 개인 배정 없음" : resource.registered ? "등록만 됨 · Task 개인 배정 없음" : "Task 개인 배정 없음", !resource.active ? "비활성 기존 참조" : null].filter(Boolean).join(" · ");
}
/** Server totals and canonical participation are deliberately separate populations. */
export function resourceWbsPresentation(data: WbsViewReportDto) {
  const resources = data.configuration.resourceMemberships;
  return {
    resources,
    registeredCount: data.totals.participation.registeredCount,
    projectAssignedCount: data.totals.participation.projectAssignedCount,
    selectedAssignedCount: data.totals.participation.assignedCount,
    registeredOnlyCount: resources.filter(row => row.registered && !row.sources.taskAssignments && !row.sources.responsibilityAssignments && !row.sources.equipmentRoles && !row.sources.systemRoles).length,
    roleOnlyCount: resources.filter(row => !row.sources.taskAssignments && (row.sources.responsibilityAssignments || row.sources.equipmentRoles || row.sources.systemRoles)).length,
    inactiveCount: resources.filter(row => !row.active).length,
    tasks: data.totals.tasks,
    assignments: data.totals.assignments,
    fullMilestones: data.fullMilestones,
    rowAnnotation: (node: WbsViewNode) => {
      if(node.selector.dimension !== "resource" || !node.selector.id) return undefined;
      const resource=resources.find(row=>row.id===node.selector.id);
      return resource ? resourceParticipationLabel(resource) : undefined;
    },
  };
}

/** Keep the server WBS descriptor intact; never export the legacy screen's filters. */
export function resourceWbsExcelRequest(data: WbsViewReportDto, basis: "current"|"project"): import("../../contracts/project-excel-export").ProjectExcelExportRequest {
  const granularities: Array<"week"|"month">=data.filters.granularity?[data.filters.granularity]:["week","month"];
  const resourceDashboard: import("../../contracts/resource-excel-export").WbsResourceExcelExportOptions = basis==="current"
    ? {basis,expectedReport:{context:data.sourceContext,snapshotId:data.snapshotId,filters:data.filters},granularities}
    : {basis,expectedReport:{context:data.sourceContext,filters:data.filters},granularities};
  return {includeDependencies:true,includeLogistics:true,includeResourceEffort:true,scope:"project",scale:"day",hierarchyDisplay:"expanded",layout:{columns:[{id:"text",widthPx:224},{id:"projectStart",widthPx:128},{id:"projectDuration",widthPx:84}]},resourceDashboard};
}

/** A previously selected M/M unit must not relabel M/D after policy becomes unset. */
export const resourceWbsPlanUnit = (unit: "md"|"mm", mdPerMm: number|null): "md"|"mm" => unit==="mm" && mdPerMm===null ? "md" : unit;
