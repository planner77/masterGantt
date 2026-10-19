import type { WbsViewNode, WbsViewReportDto, WbsViewSpec } from "../../contracts/wbs-dashboard-views";

/** Process IDs are Project-local; these presets never introduce Target ownership. */
export const PROCESS_WORKAREA_PRESETS: Array<{ label: string; levels: NonNullable<WbsViewSpec["levels"]> }> = [
  { label: "공정 단독", levels: [] },
  { label: "공정 → WorkArea → 설비 / 물류 시스템 → 리소스", levels: ["workArea", { kind: "siblings", dimensions: ["equipment", "system"] }, "resource"] },
  { label: "공정 → Milestone → 리소스", levels: ["milestone", "resource"] },
];
export const PROCESS_WORKAREA_DEFAULT_SPEC: WbsViewSpec = {
  version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "process",
  levels: [],
};

/** Presentation selectors only. The server remains the KPI and union authority. */
export function processWorkareaPresentation(data: WbsViewReportDto) {
  const processRows = data.children.filter(row => row.selector.dimension === "process" && row.selector.id !== null);
  const collect = (nodes: WbsViewNode[]): WbsViewNode[] => nodes.flatMap(node => [node, ...collect(node.children)]);
  const rows = collect(data.children);
  const areaIds = [...new Set(rows.filter(row => row.selector.dimension === "workArea" && row.selector.id !== null).map(row => row.selector.id!))];
  const relatedMilestoneIds = new Set(data.taskSources.flatMap(row => row.type === "task" && row.milestoneTaskId ? [row.milestoneTaskId] : []));
  return {
    processRows, processCount: data.configurationCatalog.processes.length,
    workAreaCount: data.configurationCatalog.workAreas.length,
    projectedWorkAreaCount: areaIds.length,
    workAreaIncluded: (data.spec.levels ?? []).includes("workArea"),
    zeroTaskProcessCount: processRows.filter(row => row.taskIds.length === 0).length,
    configuration: data.totals.configurationReference,
    unrelatedEquipmentCount: data.totals.configurationReference.equipmentIds.filter(id => !data.totals.relatedMembers.equipmentIds.includes(id)).length,
    unrelatedSystemCount: data.totals.configurationReference.systemIds.filter(id => !data.totals.relatedMembers.systemIds.includes(id)).length,
    relatedMembers: data.totals.relatedMembers,
    memberName: (kind: "equipment" | "system", id: string) => data.configurationCatalog.instances.find(row => row.kind === kind && row.id === id)?.name ?? (kind === "equipment" ? "관련 설비" : "관련 물류 시스템"),
    tasks: data.totals.tasks, assignments: data.totals.assignments,
    diagnostics: data.totals.diagnostics,
    fullMilestones: data.fullMilestones.filter(row => relatedMilestoneIds.has(row.milestoneTaskId)),
  };
}
