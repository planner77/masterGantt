import type { ProjectLogisticsDto } from "../../contracts/logistics";
import type { WbsViewReportDto, WbsViewSpec } from "../../contracts/wbs-dashboard-views";

export const SYSTEM_PRESETS: Array<{ label: string; levels: NonNullable<WbsViewSpec["levels"]> }> = [
  { label: "시스템 단독", levels: [] },
  { label: "시스템 → 공정 → WorkArea → 설비 → 리소스", levels: ["process", "workArea", "equipment", "resource"] },
  { label: "시스템 → Milestone → 공정", levels: ["milestone", "process"] },
];
export const SYSTEM_DEFAULT_SPEC: WbsViewSpec = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "system", levels: [], systemView: "direct" };
export interface SystemAttributeFilters { type?: string; layer?: string; scope?: string; pi?: string; developer?: string; process?: string }
/** Attribute selection only; all Task, Assignment and configuration aggregates remain server-owned. */
export function selectSystemIds(logistics: ProjectLogisticsDto, filters: SystemAttributeFilters): string[] {
  return logistics.systems.filter(system => (!filters.type || system.systemType === filters.type)
    && (!filters.layer || system.layer === filters.layer) && (!filters.scope || system.scope === filters.scope)
    && (!filters.process || system.processIds.includes(filters.process))
    && (["pi", "developer"] as const).every(role => !filters[role] || (filters[role] === "missing" ? !system.resourceRoles.some(row => row.role === role && row.active) : system.resourceRoles.some(row => row.role === role && row.active && row.resourceId === filters[role]))))
    .map(row => row.id).sort();
}
export function systemPresentation(data: WbsViewReportDto) {
  const systemRows = data.children.filter(row => row.selector.dimension === "system" && row.selector.id !== null);
  const milestoneIds = new Set(data.taskSources.flatMap(row => row.type === "task" && row.milestoneTaskId ? [row.milestoneTaskId] : []));
  return { systemRows, configuration: data.totals.configurationReference, tasks: data.totals.tasks,
    assignments: data.totals.assignments, diagnostics: data.totals.diagnostics,
    zeroTaskSystemCount: systemRows.filter(row => row.taskIds.length === 0).length,
    fullMilestones: data.fullMilestones.filter(row => milestoneIds.has(row.milestoneTaskId)) };
}
