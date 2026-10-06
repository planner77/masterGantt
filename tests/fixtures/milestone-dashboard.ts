import type { MilestoneDashboardDto, MilestoneDashboardFilterInput } from "../../src/contracts/milestone-dashboard";
import { normalizeDashboardFilters } from "../../src/features/milestones/milestone-dashboard-model";
import type { StatefulProjectFixture } from "./stateful-project";

/** HTTP/UI fixture only. Gate and effort values are fixed server outputs, not a client calculation. */
export function dashboardFixture(project: StatefulProjectFixture, params: URLSearchParams, asOfDate = "2026-10-06", catalogRevision = 1): MilestoneDashboardDto {
  const input: MilestoneDashboardFilterInput = {};
  for (const key of ["search", "asOfDate", "from", "to", "systemView"] as const) if (params.has(key)) Object.assign(input, { [key]: params.get(key) });
  for (const key of ["milestoneIds", "resourceIds", "assignmentRoles", "developerGrades", "processIds", "equipmentIds", "systemIds", "roleResourceIds"] as const) if (params.has(key)) Object.assign(input, { [key]: params.getAll(key) });
  if (params.has("horizonDays")) input.horizonDays = Number(params.get("horizonDays"));
  for (const key of ["activeOnly", "includeDescendantProcesses"] as const) if (params.has(key)) input[key] = params.get(key) === "true";
  if (params.has("mdPerMm")) input.mdPerMm = params.get("mdPerMm") === "null" ? null : Number(params.get("mdPerMm"));
  const filters = normalizeDashboardFilters(input), milestones = project.tasks.filter((task) => task.type === "milestone");
  const member = project.tasks.find((task) => task.externalId === "LEAF-1")!, predecessor = milestones[1];
  const effort = { plannedMd: 5, plannedMm: input.mdPerMm === null ? null : 5 / (input.mdPerMm ?? 20), assignmentIds: ["assignment-1"], unsetAssignmentIds: [], unsetAllocationCount: 0, roleTotals: [] };
  const rows = milestones.filter((task) => (!filters.search || `${task.name} ${task.externalId} ${task.taskId}`.toLowerCase().includes(filters.search.toLowerCase())) && (!filters.milestoneIds.length || filters.milestoneIds.includes(task.taskId))).map((task) => ({
    milestoneTaskId: task.taskId, name: task.name, externalId: task.externalId, scheduledDate: task.start ?? "2026-10-08", status: task.status ?? "not_started", progress: task.progress ?? 0,
    memberDurationSum: 1, memberWeightedProgressSum: 100,
    stageGate: { memberTaskIds: [member.taskId], memberCount: 1, completedMemberCount: 1, incompleteMemberTaskIds: [], memberProgressPercent: 100, predecessorMilestoneTaskIds: predecessor && task.taskId === milestones[0].taskId ? [predecessor.taskId] : [], incompletePredecessorMilestoneTaskIds: predecessor && task.taskId === milestones[0].taskId ? [predecessor.taskId] : [], membersCompleted: true, predecessorsCompleted: !(predecessor && task.taskId === milestones[0].taskId), ready: !(predecessor && task.taskId === milestones[0].taskId), blocked: Boolean(predecessor && task.taskId === milestones[0].taskId), manualEvent: false, completionInconsistent: false },
    overdue: false, upcoming: true, atRisk: false, riskTaskIds: [], risks: [], scopedTaskIds: [member.taskId], effort: { ...effort },
  }));
  return {
    projectPublicId: project.project.publicId, projectRevision: project.project.revision, catalogRevision, calculatedAt: "2026-10-06T00:00:00.000Z", timezone: "Asia/Seoul", asOfDate: filters.asOfDate ?? asOfDate, horizonDays: filters.horizonDays, filters,
    workloadRange: { from: filters.from ?? "2026-09-01", to: filters.to ?? "2026-09-30" }, mdPerMm: input.mdPerMm === undefined ? 20 : input.mdPerMm, mdPerMmSource: input.mdPerMm === null ? "unset" : input.mdPerMm === undefined ? "environment" : "query",
    kpi: { completion: { numerator: 0, denominator: rows.length, percent: rows.length ? 0 : null, completedMilestoneTaskIds: [], milestoneTaskIds: rows.map((row) => row.milestoneTaskId) }, ready: { count: rows.filter((row) => row.stageGate.ready).length, milestoneTaskIds: rows.filter((row) => row.stageGate.ready).map((row) => row.milestoneTaskId) }, blocked: { count: rows.filter((row) => row.stageGate.blocked).length, milestoneTaskIds: rows.filter((row) => row.stageGate.blocked).map((row) => row.milestoneTaskId) }, overdue: { count: 0, milestoneTaskIds: [] }, upcoming: { count: rows.length, milestoneTaskIds: rows.map((row) => row.milestoneTaskId) }, atRisk: { count: 0, milestoneTaskIds: [] }, coverage: { numerator: 1, denominator: 1, percent: 100, assignedTaskIds: [member.taskId], taskIds: [member.taskId] } }, rows,
    scope: { taskIds: [member.taskId], assignmentIds: ["assignment-1"], milestoneTaskIds: [milestones[0].taskId] },
    effort: { ...effort, buckets: [{ ...effort, milestoneTaskId: milestones[0].taskId, taskIds: [member.taskId] }, { ...effort, plannedMd: 0, plannedMm: effort.plannedMm === null ? null : 0, assignmentIds: [], milestoneTaskId: null, taskIds: [] }], assignments: [{ assignmentId: "assignment-1", taskId: member.taskId, milestoneTaskId: milestones[0].taskId, resourceId: "resource-1", role: "DEVELOPER", developerGrade: "BEGINNER", from: filters.from ?? "2026-09-01", to: filters.to ?? "2026-09-30", allocationPercent: 100, effectiveWorkingDays: 5, plannedMd: 5, plannedMm: effort.plannedMm }] },
    catalog: { milestones: milestones.map((task) => ({ id: task.taskId, name: task.name, externalId: task.externalId })), resources: [{ id: "resource-1", name: "Resource one", code: "R1", active: true, developerGrade: "BEGINNER" }], processes: [], equipment: [], systems: [] },
  };
}
