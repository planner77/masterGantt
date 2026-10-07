import type { MilestoneDashboardAssignmentDto, MilestoneDashboardDto, MilestoneDashboardEffortDto, MilestoneDashboardFilterInput, MilestoneDashboardFiltersDto } from "../../contracts/milestone-dashboard";
import type { ResourceWorkloadRole } from "../../contracts/resources";
import type { StageSnapshot } from "../../domain/milestones/stage-gates";
import { workingDaysBetween } from "../../domain/scheduling/calendar";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import { calculateLogisticsDashboardPure, type CalculateDashboardInput } from "../logistics/logistics-dashboard-service";
import { mdPerMmSource, resolveMdPerMm } from "../resources/md-per-mm-core";
import { milestoneDashboardStages } from "./milestone-dashboard-projection-core";
import { hasTaskSchedule } from "./task-schedule-guard";

const ROLES: ResourceWorkloadRole[] = ["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"];
export class MilestoneDashboardInvalidRangeError extends Error {}
const unique = <T extends string>(values: readonly T[] | undefined): T[] => [...new Set(values ?? [])].sort();

export function normalizeMilestoneDashboardFilters(filter: MilestoneDashboardFilterInput): MilestoneDashboardFiltersDto {
  return {
    search: (filter.search ?? "").trim(), milestoneIds: unique(filter.milestoneIds), asOfDate: filter.asOfDate ?? null,
    horizonDays: filter.horizonDays ?? 14, from: filter.from ?? null, to: filter.to ?? null,
    resourceIds: unique(filter.resourceIds), assignmentRoles: unique(filter.assignmentRoles), developerGrades: unique(filter.developerGrades),
    processIds: unique(filter.processIds), equipmentIds: unique(filter.equipmentIds), systemIds: unique(filter.systemIds), roleResourceIds: unique(filter.roleResourceIds),
    systemView: filter.systemView ?? "direct", activeOnly: filter.activeOnly ?? false, includeDescendantProcesses: filter.includeDescendantProcesses ?? true,
    mdPerMm: filter.mdPerMm ?? null,
    mdPerMmProvided: filter.mdPerMm !== undefined,
  };
}

/** Raw sums/ratios are retained; presentation owns rounding. IDs are deduplicated before all counts. */
function sumEffort(assignments: MilestoneDashboardAssignmentDto[], mdPerMm: number | null): MilestoneDashboardEffortDto {
  const plannedMd = assignments.reduce((sum, row) => sum + (row.plannedMd ?? 0), 0);
  const unsetAssignmentIds = assignments.filter((row) => row.plannedMd === null).map((row) => row.assignmentId);
  return {
    plannedMd, plannedMm: mdPerMm === null ? null : plannedMd / mdPerMm,
    assignmentIds: assignments.map((row) => row.assignmentId), unsetAssignmentIds, unsetAllocationCount: unsetAssignmentIds.length,
    roleTotals: ROLES.map((role) => {
      const rows = assignments.filter((row) => row.roles.includes(role)), md = rows.reduce((sum, row) => sum + (row.plannedMd ?? 0), 0);
      return { role, plannedMd: md, plannedMm: mdPerMm === null ? null : md / mdPerMm, assignmentIds: rows.map((row) => row.assignmentId), unsetAssignmentIds: rows.filter((row) => row.plannedMd === null).map((row) => row.assignmentId) };
    }),
  };
}

export interface MilestoneDashboardCalculationInput extends Omit<CalculateDashboardInput, "filter" | "stageSnapshot"> {
  stageSnapshot: StageSnapshot;
  filter: MilestoneDashboardFilterInput;
}

export function calculateMilestoneDashboard(input: MilestoneDashboardCalculationInput): MilestoneDashboardDto {
  const filter = normalizeMilestoneDashboardFilters(input.filter);
  // Existing logistics selection is the authority for direct/subtree/coordination filters.
  const logistics = calculateLogisticsDashboardPure({ ...input, stageSnapshot: undefined, filter: {
    asOfDate: input.filter.asOfDate, horizonDays: filter.horizonDays, processIds: filter.processIds,
    equipmentIds: filter.equipmentIds, systemIds: filter.systemIds, roleResourceIds: filter.roleResourceIds,
    systemView: filter.systemView, activeOnly: filter.activeOnly, includeDescendantProcesses: filter.includeDescendantProcesses,
    mdPerMm: input.filter.mdPerMm,
  } });
  const projection = milestoneDashboardStages(input.tasks, input.stageSnapshot, logistics.asOfDate, filter.horizonDays);
  const resourceById = new Map(input.resources.map((resource) => [resource.id, resource]));
  const byTask = new Map(input.tasks.map((task) => [task.taskId, task]));
  const hasResourceFilters = filter.resourceIds.length + filter.assignmentRoles.length + filter.developerGrades.length > 0;
  const matchedAssignments = [...new Map(input.assignments.map((row) => [row.id, row])).values()].filter((row) => {
    if (row.target.kind !== "resource") return false;
    const resource = resourceById.get(row.target.id);
    if (!resource) return false;
    return (!filter.resourceIds.length || filter.resourceIds.includes(row.target.id)) &&
      (!filter.assignmentRoles.length || (() => {
        const roles: ResourceWorkloadRole[] = (resource.roles?.length ?? 0) > 0 ? resource.roles! : ["UNSPECIFIED"];
        return roles.some((role) => filter.assignmentRoles.includes(role));
      })()) &&
      (!filter.developerGrades.length || filter.developerGrades.includes(resource.developerGrade ?? "UNSPECIFIED"));
  });
  const resourceMatchedTaskIds = new Set(matchedAssignments.map((row) => row.taskId));
  const taskDates = input.tasks.filter((task) => task.type === "task").flatMap((task) => [task.start, task.end]).filter((date): date is string => date !== null).sort();
  const from = filter.from ?? taskDates[0] ?? logistics.asOfDate;
  const to = filter.to ?? taskDates.at(-1) ?? from;
  parseDateOnly(from, "from"); parseDateOnly(to, "to");
  if (from > to) throw new MilestoneDashboardInvalidRangeError();
  const matchingLogisticsTasks = new Set(logistics.includedTaskIds), matchingLogisticsMilestones = new Set(logistics.includedMilestoneIds);
  // S must apply Logistics + Resource dimensions to the same ordinary Task.
  // Date remains F-only, so keep a non-date intersection for stage visibility
  // and derive the dated scopedTasks separately for effort.
  const nonDateScopedTaskSet = new Set(input.tasks.filter((task) =>
    task.type === "task" &&
    matchingLogisticsTasks.has(task.taskId) &&
    (!hasResourceFilters || resourceMatchedTaskIds.has(task.taskId)),
  ).map((task) => task.taskId));
  const scopedTasks = input.tasks.filter((task) => {
    if (task.type !== "task" || !nonDateScopedTaskSet.has(task.taskId)) return false;
    if (!hasTaskSchedule(task)) throw new Error("Canonical task schedule is missing.");
    return task.start <= to && task.end >= from;
  });
  const scopedTaskIds = scopedTasks.map((task) => task.taskId), scopedTaskSet = new Set(scopedTaskIds);
  const mdPerMm = resolveMdPerMm(input.filter.mdPerMm, input.mdPerMmEnvironment);
  const assignments: MilestoneDashboardAssignmentDto[] = matchedAssignments.flatMap((assignment) => {
    const task = byTask.get(assignment.taskId);
    if (!task || !scopedTaskSet.has(task.taskId) || !hasTaskSchedule(task)) return [];
    const start = assignment.allocation?.start ?? task.start, end = assignment.allocation?.end ?? task.end;
    const clippedFrom = start < from ? from : start, clippedTo = end > to ? to : end;
    if (clippedFrom > clippedTo) return [];
    const effectiveWorkingDays = workingDaysBetween(clippedFrom, clippedTo, input.calendarForResource(assignment.target.id));
    const percent = assignment.allocation?.percent ?? null;
    const plannedMd = percent === null ? null : effectiveWorkingDays * percent / 100;
    return [{ assignmentId: assignment.id, taskId: task.taskId, milestoneTaskId: projection.membership.get(task.taskId)!.effectiveMilestoneTaskId,
      resourceId: assignment.target.id,
      roles: (resourceById.get(assignment.target.id)!.roles?.length ?? 0) > 0 ? resourceById.get(assignment.target.id)!.roles! : ["UNSPECIFIED"],
      developerGrade: resourceById.get(assignment.target.id)!.developerGrade ?? "UNSPECIFIED",
      from: clippedFrom, to: clippedTo, allocationPercent: percent, effectiveWorkingDays, plannedMd,
      plannedMm: plannedMd === null || mdPerMm === null ? null : plannedMd / mdPerMm }];
  });
  const scopedMilestoneIds = unique(scopedTasks.flatMap((task) => projection.membership.get(task.taskId)!.effectiveMilestoneTaskId ?? []));
  const buckets = [...scopedMilestoneIds, null].map((id) => ({
    milestoneTaskId: id,
    taskIds: scopedTasks.filter((task) => projection.membership.get(task.taskId)!.effectiveMilestoneTaskId === id).map((task) => task.taskId),
    ...sumEffort(assignments.filter((row) => row.milestoneTaskId === id), mdPerMm),
  }));
  const search = filter.search.toLocaleLowerCase();
  const rows = projection.rows.filter((row) => {
    if (filter.milestoneIds.length && !filter.milestoneIds.includes(row.milestoneTaskId)) return false;
    if (search && ![row.name, row.externalId, row.milestoneTaskId].some((value) => value.toLocaleLowerCase().includes(search))) return false;
    const memberMatchesCombinedScope = row.stageGate.memberTaskIds.some((id) => nonDateScopedTaskSet.has(id));
    // A direct Milestone Logistics match remains meaningful when Resource
    // dimensions are absent. Once Resource filters are present, S is selected
    // only by an ordinary member Task satisfying the combined non-date scope.
    if (!memberMatchesCombinedScope && !(matchingLogisticsMilestones.has(row.milestoneTaskId) && !hasResourceFilters)) return false;
    return true;
  }).map((row) => ({ ...row,
    scopedTaskIds: row.stageGate.memberTaskIds.filter((id) => scopedTaskSet.has(id)),
    effort: sumEffort(assignments.filter((assignment) => assignment.milestoneTaskId === row.milestoneTaskId), mdPerMm),
  }));
  const ids = rows.map((row) => row.milestoneTaskId), completed = rows.filter((row) => row.status === "completed").map((row) => row.milestoneTaskId);
  const count = (predicate: (row: (typeof rows)[number]) => boolean) => { const milestoneTaskIds = rows.filter(predicate).map((row) => row.milestoneTaskId); return { count: milestoneTaskIds.length, milestoneTaskIds }; };
  const assignedTaskIds = scopedTasks.filter((task) => projection.membership.get(task.taskId)!.effectiveMilestoneTaskId !== null).map((task) => task.taskId);
  const referencedResourceIds = new Set([
    ...input.assignments.filter((row) => row.target.kind === "resource").map((row) => row.target.id),
    ...input.logistics.equipment.flatMap((row) => row.resourceRoles.map((role) => role.resourceId)),
    ...input.logistics.systems.flatMap((row) => row.resourceRoles.map((role) => role.resourceId)),
  ]);
  const candidates = <T extends { id: string; code: string; name: string; active: boolean }>(values: T[]) => values.map(({ id, code, name, active }) => ({ id, code, name, active }));
  return {
    projectPublicId: input.project.publicId, projectRevision: input.project.revision, catalogRevision: input.catalogRevision,
    calculatedAt: logistics.calculatedAt, timezone: input.project.calendar.timezone, asOfDate: logistics.asOfDate,
    horizonDays: filter.horizonDays, filters: filter, workloadRange: { from, to }, mdPerMm,
    mdPerMmSource: mdPerMmSource(input.filter.mdPerMm, input.mdPerMmEnvironment),
    kpi: { completion: { numerator: completed.length, denominator: ids.length, percent: ids.length ? completed.length / ids.length * 100 : null, completedMilestoneTaskIds: completed, milestoneTaskIds: ids },
      ready: count((row) => row.stageGate.ready === true), blocked: count((row) => row.stageGate.blocked), overdue: count((row) => row.overdue),
      upcoming: count((row) => row.upcoming), atRisk: count((row) => row.atRisk),
      coverage: { numerator: assignedTaskIds.length, denominator: scopedTaskIds.length, percent: scopedTaskIds.length ? assignedTaskIds.length / scopedTaskIds.length * 100 : null, assignedTaskIds, taskIds: scopedTaskIds } },
    rows, scope: { taskIds: scopedTaskIds, assignmentIds: assignments.map((row) => row.assignmentId), milestoneTaskIds: ids },
    effort: { ...sumEffort(assignments, mdPerMm), buckets, assignments },
    catalog: {
      milestones: projection.rows.map((row) => ({ id: row.milestoneTaskId, name: row.name, externalId: row.externalId })),
      resources: input.resources.filter((row) => referencedResourceIds.has(row.id)).map((row) => ({ id: row.id, name: row.name, code: row.code, active: row.active, developerGrade: row.developerGrade ?? null, roles: row.roles ?? [] })),
      processes: candidates(input.logistics.processes), equipment: candidates(input.logistics.equipment), systems: candidates(input.logistics.systems),
    },
  };
}
