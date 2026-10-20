import type { WbsViewReportDto, WbsViewSpec } from "../../contracts/wbs-dashboard-views";

export const EQUIPMENT_DEFAULT_SPEC: WbsViewSpec = {
  version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "equipment", levels: [],
};
export const EQUIPMENT_PRESETS: Array<{ label: string; levels: NonNullable<WbsViewSpec["levels"]> }> = [
  { label: "설비 단독", levels: [] },
  { label: "설비 → 공정 → 시스템 → Resource", levels: ["process", "system", "resource"] },
  { label: "설비 → Milestone → 공정", levels: ["milestone", "process"] },
];

/** Presentation only; Task, Assignment, effort and full Gate retain server authority. */
export function equipmentPresentation(data: WbsViewReportDto) {
  const equipment = data.configurationCatalog.equipment;
  const equipmentRows = data.children.filter(row => row.selector.dimension === "equipment" && row.selector.id !== null);
  const milestoneIds = new Set(data.taskSources.flatMap(row => row.type === "task" && row.milestoneTaskId ? [row.milestoneTaskId] : []));
  return {
    equipment,
    equipmentRows,
    types: [...new Map(equipment.map(row => [row.equipmentType, { code: row.equipmentType, name: row.equipmentTypeName }])).values()].sort((a,b) => a.name.localeCompare(b.name,"ko")),
    configuration: data.totals.configurationReference,
    tasks: data.totals.tasks,
    assignments: data.totals.assignments,
    diagnostics: data.totals.diagnostics,
    inactive: equipment.filter(row => !row.active),
    withoutOwner: equipment.filter(row => !row.resourceRoles.some(role => role.role === "owner")),
    withoutPrimaryControl: equipment.filter(row => !row.controlSystems.some(control => control.controlRole === "primary")),
    withoutWorkArea: equipment.filter(row => !row.workAreaLinks.length),
    zeroTaskRows: equipmentRows.filter(row => !row.taskIds.length),
    fullMilestones: data.fullMilestones.filter(row => milestoneIds.has(row.milestoneTaskId)),
  };
}
