import type { ResourceKpiAssignmentRow, ResourceKpiResource } from "../../src/domain/resources/resource-kpi";
import type { ResourcePlanInput } from "../../src/domain/resources/resource-plan";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
export const resourcePlanResource = (resourceId: string, groupIds = ["G1"]): ResourceKpiResource => ({ resourceId, groupIds, roles: ["PI", "DEVELOPER"], developerGrade: "ADVANCED" });
export const resourcePlanAssignment = (assignmentId: string, resourceId = "R1", allocationPercent: number | null = 50, changes: Partial<ResourceKpiAssignmentRow> = {}): ResourceKpiAssignmentRow => ({ projectPublicId: "P", assignmentId, taskId: assignmentId, resourceId, milestoneTaskId: "M1", groupIds: ["G1", "G2"], roles: ["PI", "DEVELOPER"], from: "2026-10-05", to: "2026-10-09", allocationPercent, effectiveWorkingDays: 5, plannedMd: allocationPercent === null ? null : 5 * allocationPercent / 100, plannedMm: allocationPercent === null ? null : 5 * allocationPercent / 100 / 20, ...changes });
export function resourcePlanFixture(changes: Partial<ResourcePlanInput> = {}): ResourcePlanInput {
  const rows = [resourcePlanAssignment("A1")];
  return { projectPublicId: "P", from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-08", granularity: "week", mdPerMm: 20,
    projectCalendar: createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] }), resources: [resourcePlanResource("R1", ["G1", "G2"])], capacityResourceIds: ["R1"], selectedAssignments: rows, fullProjectAssignments: rows,
    limits: { resourceDays: 200000, assignmentDays: 1000000, matrixCells: 5000 }, ...changes };
}
