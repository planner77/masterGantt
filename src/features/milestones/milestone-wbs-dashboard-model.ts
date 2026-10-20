import type { MilestoneStageGateDto } from "@/contracts/milestones";
import type { WbsViewReportDto, WbsViewSpec } from "@/contracts/wbs-dashboard-views";

export const MILESTONE_WBS_DEFAULT_SPEC: WbsViewSpec = {
  version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "milestone", levels: [],
};
export const MILESTONE_WBS_PRESETS: Array<{ label: string; levels: NonNullable<WbsViewSpec["levels"]> }> = [
  { label: "Milestone 단독", levels: [] },
  { label: "Milestone → 공정 → WorkArea → 설비 / 물류 시스템 → 리소스", levels: ["process", "workArea", { kind: "siblings", dimensions: ["equipment", "system"] }, "resource"] },
  { label: "Milestone → 리소스 → 공정", levels: ["resource", "process"] },
];
/** Keep full Gate and selected metrics as separate server-owned populations. */
export function milestoneWbsPresentation(data: WbsViewReportDto) {
  return {
    tasks: data.totals.tasks,
    assignments: data.totals.assignments,
    diagnostics: data.totals.diagnostics,
    fullMilestones: data.fullMilestones,
    unlinkedLogisticsCount: data.taskSources.filter(row => row.type === "task" && !row.equipmentIds.length && !row.systemIds.length).length,
  };
}

/** Manual-event readiness, predecessor blocking and stored completion are independent. */
export function milestoneFullGateLabel(gate: MilestoneStageGateDto): string {
  return [
    gate.manualEvent ? "수동 이벤트 · Ready N/A" : gate.ready ? "Ready" : "Not Ready",
    ...(gate.blocked ? ["Blocked"] : []),
    ...(gate.completionInconsistent ? ["완료 조건 불일치 진단"] : []),
  ].join(" · ");
}
