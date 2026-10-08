import type { ResourceKpiInput } from "../../src/domain/resources/resource-kpi";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";

/** Issue #530's named six-Task example; variants must not change this oracle. */
export const RESOURCE_KPI_INTEGRATION = Object.freeze({
  from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-10",
  now: "2026-10-09T15:00:00.000Z", mdPerMm: 20,
  expected: { knownMd: 11.5, plannedMm: 0.575, taskCount: 4, assignmentCount: 5, resourceCount: 2,
    unsetCount: 1, capacityMd: 10, groupSubtotalSum: 17, milestoneM1Md: 7.5, milestoneM2Md: 3, unassignedMilestoneMd: 1 },
});

export function resourceKpiIntegrationFixture(): ResourceKpiInput {
  const c = RESOURCE_KPI_INTEGRATION;
  return {
    projectPublicId: "P530", timezone: "Asia/Seoul", from: c.from, to: c.to, asOfDate: c.asOfDate, mdPerMm: c.mdPerMm,
    projectCalendar: createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] }),
    tasks: [
      ...["M1", "M2"].map(taskId => ({ taskId, parentTaskId: null, type: "milestone" as const, start: c.from, end: c.from, duration: 0, progress: 0, status: "not_started" as const })),
      ...["T1", "T2", "T3", "T4", "T5", "T6"].map(taskId => ({ taskId, name: taskId, externalId: taskId, parentTaskId: null, type: "task" as const,
        start: c.from, end: c.to, duration: 5, progress: 0, status: "not_started" as const })),
    ],
    memberships: [{ taskId: "T1", milestoneTaskId: "M1" }, { taskId: "T2", milestoneTaskId: "M2" }, { taskId: "T6", milestoneTaskId: "M2" }], links: [],
    resources: [
      { resourceId: "A", name: "A", code: "A", groupIds: ["G1", "G2"], roles: ["PI", "DEVELOPER"], developerGrade: "ADVANCED" },
      { resourceId: "B", name: "B", code: "B", groupIds: ["G1"], roles: ["EQUIPMENT_OWNER"], developerGrade: "INTERMEDIATE" },
    ],
    assignments: [
      { assignmentId: "T1-A", taskId: "T1", kind: "resource", targetId: "A", allocationPercent: 50 },
      { assignmentId: "T1-B", taskId: "T1", kind: "resource", targetId: "B", allocationPercent: 100 },
      { assignmentId: "T2-A", taskId: "T2", kind: "resource", targetId: "A", allocationPercent: 60 },
      { assignmentId: "T3-B", taskId: "T3", kind: "resource", targetId: "B", allocationPercent: 20 },
      { assignmentId: "T6-A", taskId: "T6", kind: "resource", targetId: "A", allocationPercent: null },
      { assignmentId: "T5-G1", taskId: "T5", kind: "group", targetId: "G1", allocationPercent: null },
    ],
  };
}
