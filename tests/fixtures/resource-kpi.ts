import type { ResourceKpiInput, ResourceKpiTask } from "../../src/domain/resources/resource-kpi";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";

export const resourceKpiTask = (taskId: string, changes: Partial<ResourceKpiTask> = {}): ResourceKpiTask => ({
  taskId, parentTaskId: null, type: "task", duration: 4, progress: 0, status: "not_started",
  start: "2026-10-05", end: "2026-10-09", ...changes,
});

/** Fixed current-snapshot fixture; every call returns independent input rows. */
export function resourceKpiFixture(): ResourceKpiInput {
  return {
    projectPublicId: "P", timezone: "Asia/Seoul", asOfDate: "2026-10-17", from: "2026-10-05", to: "2026-10-18", mdPerMm: 21,
    projectCalendar: createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-10-06" }] }),
    tasks: [
      resourceKpiTask("S", { type: "summary", duration: 9, progress: (4 * 100 + 9 * 99.999) / 13, status: "in_progress", end: "2026-10-16" }),
      resourceKpiTask("S2", { type: "summary", parentTaskId: "S", duration: 4, progress: 100, status: "completed" }),
      resourceKpiTask("EMPTY", { type: "summary", duration: null, progress: null, start: null, end: null }),
      ...["M1", "M2", "M3"].map((id) => resourceKpiTask(id, { type: "milestone", duration: 0, end: "2026-10-05" })),
      resourceKpiTask("T1", { parentTaskId: "S2", status: "completed", progress: 100 }),
      resourceKpiTask("T2", { parentTaskId: "S", status: "in_progress", duration: 9, progress: 99.999, end: "2026-10-16" }),
      resourceKpiTask("T3"), resourceKpiTask("T4"),
      resourceKpiTask("T5", { start: "2026-10-09", end: "2026-10-12", duration: 2 }),
    ],
    memberships: [{ taskId: "S", milestoneTaskId: "M1" }, { taskId: "S2", milestoneTaskId: "M2" }, { taskId: "T1", milestoneTaskId: "M1" }, { taskId: "EMPTY", milestoneTaskId: "M3" }],
    links: [],
    resources: [
      { resourceId: "R1", groupIds: ["G1", "G2"], roles: ["PI", "DEVELOPER"], developerGrade: "ADVANCED" },
      { resourceId: "R2", groupIds: ["G1"], roles: ["EQUIPMENT_OWNER"], developerGrade: "INTERMEDIATE" },
    ],
    assignments: [
      { assignmentId: "A1", taskId: "T1", kind: "resource", targetId: "R1", allocationPercent: 50 },
      { assignmentId: "A2", taskId: "T1", kind: "resource", targetId: "R2", allocationPercent: 33.333333 },
      { assignmentId: "A3", taskId: "T2", kind: "resource", targetId: "R1", allocationPercent: null },
      { assignmentId: "A4", taskId: "T2", kind: "resource", targetId: "R2", allocationPercent: null },
      { assignmentId: "A5", taskId: "T5", kind: "resource", targetId: "R1", start: "2026-10-10", end: "2026-10-11", allocationPercent: 50 },
      { assignmentId: "GROUP", taskId: "T4", kind: "group", targetId: "G1", allocationPercent: null },
      { assignmentId: "SUMMARY", taskId: "S", kind: "resource", targetId: "R1", allocationPercent: null },
      { assignmentId: "MILESTONE", taskId: "M1", kind: "resource", targetId: "R1", allocationPercent: null },
    ],
  };
}
