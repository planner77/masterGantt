import { projectStageGates, type StageTask, type StageMembership, type StageLink } from "../milestones/stage-gates";
import { workingDaysBetween, type WorkingCalendar } from "../scheduling/calendar";
import { parseDateOnly } from "../scheduling/date-only";
import { resolveResourceCalendar, type ResourceCalendarException } from "../scheduling/resource-calendar";
import { mdPerMmSource, resolveMdPerMm } from "./md-per-mm";

export interface ResourceKpiTask extends StageTask { start: string | null; end: string | null; name?: string; externalId?: string; wbsPath?: string }
export interface ResourceKpiResource {
  resourceId: string;
  name?: string;
  code?: string | null;
  groupSearchText?: string;
  groupIds: readonly string[];
  roles: readonly string[];
  developerGrade: string | null;
}
export interface ResourceKpiAssignment {
  assignmentId: string;
  taskId: string;
  kind: "resource" | "group";
  targetId: string;
  start?: string | null;
  end?: string | null;
  allocationPercent: number | null;
}
export interface ResourceKpiFilters {
  /** Defined empty means no eligible Resource, unlike optional user OR arrays. */
  eligibleResourceIds?: readonly string[];
  statuses?: readonly StageTask["status"][];
  search?: string;
  taskSearch?: string;
  includeUngrouped?: boolean;
  taskIds?: readonly string[];
  wbsRootIds?: readonly string[];
  milestoneIds?: readonly (string | null)[];
  resourceIds?: readonly string[];
  groupIds?: readonly string[];
  roles?: readonly string[];
  developerGrades?: readonly string[];
}
export interface ResourceKpiInput {
  projectPublicId: string;
  timezone: "Asia/Seoul";
  asOfDate: string;
  from: string;
  to: string;
  tasks: readonly ResourceKpiTask[];
  memberships: readonly StageMembership[];
  links: readonly StageLink[];
  resources: readonly ResourceKpiResource[];
  assignments: readonly ResourceKpiAssignment[];
  projectCalendar: WorkingCalendar;
  calendarExceptions?: readonly ResourceCalendarException[];
  filters?: ResourceKpiFilters;
  mdPerMm?: number | null;
  /** Deployment value is injected by the caller; the domain never reads ENV. */
  mdPerMmEnvironment?: string;
  /** Optional caller budget, checked before subtotal/cell materialization. */
  maxProjectionCells?: number;
}
export interface ResourceKpiAssignmentRow {
  projectPublicId: string;
  assignmentId: string;
  taskId: string;
  resourceId: string;
  milestoneTaskId: string | null;
  groupIds: string[];
  roles: string[];
  from: string;
  to: string;
  allocationPercent: number | null;
  effectiveWorkingDays: number;
  plannedMd: number | null;
  plannedMm: number | null;
}
export interface ResourceKpiCount { count: number; taskIds: string[] }
export interface ResourceKpiEffort {
  knownMd: number;
  plannedMd: number | null;
  plannedMm: number | null;
  state: "empty" | "configured" | "partial" | "unset";
  partial: boolean;
  unsetCount: number;
  assignmentIds: string[];
  unsetAssignmentIds: string[];
}
export interface ResourceKpiTotals {
  taskIds: string[];
  resourceIds: string[];
  assignmentIds: string[];
  taskCount: number;
  resourceCount: number;
  assignmentCount: number;
  notStarted: ResourceKpiCount;
  inProgress: ResourceKpiCount;
  completed: ResourceKpiCount;
  delayed: ResourceKpiCount;
  completion: { numerator: number; denominator: number; percent: number | null; taskIds: string[]; completedTaskIds: string[] };
  assignedTaskProgress: { numerator: number; denominator: number; percent: number | null; taskIds: string[] };
  effort: ResourceKpiEffort;
}
export interface ResourceKpiDictionaryEntry {
  name: string;
  unit: "task" | "resource" | "assignment" | "%" | "M/D" | "M/M" | "milestone";
  grain: "distinct taskId" | "distinct resourceId" | "projectPublicId,assignmentId" | "full milestone";
  numerator: string;
  denominator: string | null;
  scope: "A" | "T0" | "full E(M)/P(M)";
  asOf: "canonical snapshot + project timezone/asOfDate";
  additive: "disjoint grains only" | "non-additive";
  missing: string;
  drillDown: string;
}
const entry = (name: string, unit: ResourceKpiDictionaryEntry["unit"], grain: ResourceKpiDictionaryEntry["grain"], numerator: string, denominator: string | null, scope: ResourceKpiDictionaryEntry["scope"], missing: string, drillDown: string): ResourceKpiDictionaryEntry => ({ name, unit, grain, numerator, denominator, scope, asOf: "canonical snapshot + project timezone/asOfDate", additive: denominator || scope === "full E(M)/P(M)" ? "non-additive" : "disjoint grains only", missing, drillDown });
export const RESOURCE_KPI_DICTIONARY: readonly ResourceKpiDictionaryEntry[] = [
  entry("할당 Task", "task", "distinct taskId", "unique ordinary tasks in A", null, "A", "empty=0", "taskIds"),
  entry("시작 전 Task", "task", "distinct taskId", "status=not_started", null, "A", "empty=0", "notStarted.taskIds"),
  entry("진행 중 Task", "task", "distinct taskId", "status=in_progress", null, "A", "empty=0", "inProgress.taskIds"),
  entry("완료 Task", "task", "distinct taskId", "status=completed", null, "A", "empty=0", "completed.taskIds"),
  entry("지연 Task", "task", "distinct taskId", "progress<100 AND canonical end<asOfDate", null, "A", "empty=0", "delayed.taskIds"),
  entry("Resource", "resource", "distinct resourceId", "unique resources in A", null, "A", "empty=0", "resourceIds"),
  entry("Assignment", "assignment", "projectPublicId,assignmentId", "unique personal assignments in A", null, "A", "empty=0", "assignmentIds"),
  entry("완료율", "%", "distinct taskId", "completed unique task count", "unique task count", "A", "denominator0=null", "completion.taskIds/completedTaskIds"),
  entry("할당 작업 진척", "%", "distinct taskId", "sum(duration*progress)", "sum(duration)", "A", "denominator0=null", "assignedTaskProgress.taskIds"),
  entry("계획 M/D", "M/D", "projectPublicId,assignmentId", "resource working days in clipped assignment range * allocation/100", null, "A", "allocation null=null; all unset=null; partial=known sum+unsetCount; empty=0", "effort.assignmentIds/unsetAssignmentIds"),
  entry("계획 M/M", "M/M", "projectPublicId,assignmentId", "same raw planned M/D", "effective finite-positive mdPerMm", "A", "unset conversion=null; source explicit", "effort.assignmentIds"),
  entry("완전 미할당", "task", "distinct taskId", "no personal or direct Group assignment", "T0 ordinary task count (diagnostic only)", "T0", "empty=0; personal filters inapplicable", "diagnostics.completelyUnassigned.taskIds"),
  entry("Group만 지정", "task", "distinct taskId", "direct Group assignment but no personal assignment", "T0 ordinary task count (diagnostic only)", "T0", "empty=0; personal filters inapplicable", "diagnostics.groupOnly.taskIds"),
  entry("개인 미배정", "task", "distinct taskId", "union of completelyUnassigned and groupOnly", "T0 ordinary task count (diagnostic only)", "T0", "empty=0; personal filters inapplicable", "diagnostics.personallyUnassigned.taskIds"),
  entry("공수 미설정 Task", "task", "distinct taskId", "tasks with allocation=null personal assignment", "T0 ordinary task count (diagnostic only)", "T0", "empty=0; personal filters inapplicable", "diagnostics.unsetTasks.taskIds"),
  entry("공수 미설정 Assignment", "assignment", "projectPublicId,assignmentId", "allocation=null personal assignments on T0", null, "T0", "empty=0", "diagnostics.unsetAssignmentIds"),
  entry("Milestone 전체 진척/Ready/Blocked", "milestone", "full milestone", "canonical projectStageGates full snapshot", "full E(M) duration for progress", "full E(M)/P(M)", "manual event progress/Ready=null", "fullMilestones.stageGate"),
];

export class ResourceKpiProjectionLimitError extends Error {
  constructor() { super("Resource KPI projection cell limit exceeded"); this.name = "ResourceKpiProjectionLimitError"; }
}

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const matches = <T>(filter: readonly T[] | undefined, value: T): boolean => !filter?.length || filter.includes(value);

/** Structural equality preserves non-finite numbers and ignores object key order. */
function equalKpiInput(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => equalKpiInput(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>, rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort(), rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && equalKpiInput(leftRecord[key], rightRecord[key]));
}

/** Exact duplicate joins collapse; conflicting rows fail instead of choosing input order. */
/** Structural equality preserves non-finite numbers and ignores object key order. */
function equalKpiInput(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => equalKpiInput(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>, rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort(), rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && equalKpiInput(leftRecord[key], rightRecord[key]));
}

/** Exact duplicate joins collapse; conflicting rows fail instead of choosing input order. */
function distinct<T>(rows: readonly T[], id: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = id(row), previous = map.get(key);
    if (previous && !equalKpiInput(previous, row)) throw new Error(`Conflicting KPI input: ${key}`);
    map.set(key, row);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
}

/** Matches the existing Workload/Logistics canonical date-only delay definition. */
export function isResourceKpiTaskDelayed(task: ResourceKpiTask, asOfDate: string): boolean {
  return task.progress !== null && task.progress < 100 && task.end !== null && task.end < asOfDate;
}

function effort(rows: readonly ResourceKpiAssignmentRow[], mdPerMm: number | null): ResourceKpiEffort {
  const unsetAssignmentIds = rows.filter((row) => row.plannedMd === null).map((row) => row.assignmentId);
  const knownMd = rows.reduce((sum, row) => sum + (row.plannedMd ?? 0), 0);
  const allUnset = rows.length > 0 && unsetAssignmentIds.length === rows.length;
  const plannedMd = allUnset ? null : knownMd;
  return { knownMd, plannedMd, plannedMm: plannedMd === null || mdPerMm === null ? null : plannedMd / mdPerMm,
    state: !rows.length ? "empty" : allUnset ? "unset" : unsetAssignmentIds.length ? "partial" : "configured",
    partial: unsetAssignmentIds.length > 0, unsetCount: unsetAssignmentIds.length,
    assignmentIds: rows.map((row) => row.assignmentId), unsetAssignmentIds };
}

/** Pure current-snapshot projection. All scopes are intersections; no snapshot mutation. */
export function prepareResourceKpiSnapshot(input: ResourceKpiInput) {
  parseDateOnly(input.from, "from"); parseDateOnly(input.to, "to"); parseDateOnly(input.asOfDate, "asOfDate");
  if (input.from > input.to) throw new Error("Invalid KPI date range");
  if (input.timezone !== input.projectCalendar.timezone) throw new Error("KPI timezone/calendar mismatch");
  if (input.mdPerMm !== undefined && input.mdPerMm !== null && (!Number.isFinite(input.mdPerMm) || input.mdPerMm <= 0)) throw new Error("Invalid mdPerMm query");
  const mdPerMm = resolveMdPerMm(input.mdPerMm, input.mdPerMmEnvironment);
  const tasks = distinct(input.tasks, (task) => task.taskId);
  const memberships = distinct(input.memberships, (row) => row.taskId);
  const links = distinct(input.links, (row) => row.id);
  const resources = distinct(input.resources.map((row) => ({ ...row, groupIds: unique(row.groupIds), roles: unique(row.roles) })), (row) => row.resourceId);
  const assignments = distinct(input.assignments, (row) => row.assignmentId);
  const byTask = new Map(tasks.map((task) => [task.taskId, task]));
  const byResource = new Map(resources.map((resource) => [resource.resourceId, resource]));
  const projection = projectStageGates({ tasks, memberships, links });
  for (const task of tasks) {
    if (task.type !== "task") continue;
    if (task.start === null || task.end === null || task.duration === null || task.progress === null) throw new Error("Canonical task schedule is missing");
    parseDateOnly(task.start); parseDateOnly(task.end);
    if (task.start > task.end || !Number.isFinite(task.duration) || task.duration <= 0 || !Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100) throw new Error("Invalid canonical task schedule");
  }
  for (const assignment of assignments) {
    const task = byTask.get(assignment.taskId);
    if (!task || (assignment.kind === "resource" && !byResource.has(assignment.targetId))) throw new Error("Invalid KPI assignment reference");
    if (assignment.allocationPercent !== null && (!Number.isFinite(assignment.allocationPercent) || assignment.allocationPercent <= 0 || assignment.allocationPercent > 100)) throw new Error("Invalid KPI allocation");
    if (task.type !== "task" || assignment.kind !== "resource") continue;
    const start = assignment.start ?? task.start!, end = assignment.end ?? task.end!;
    parseDateOnly(start); parseDateOnly(end);
    if (start > end || start < task.start! || end > task.end!) throw new Error("Invalid KPI assignment range");
  }
  return { input, mdPerMm, tasks, resources, assignments, byTask, byResource, projection, calendars: new Map<string, WorkingCalendar>(), assignmentRows: new Map<string, ResourceKpiAssignmentRow>() };
}
export type PreparedResourceKpiSnapshot = ReturnType<typeof prepareResourceKpiSnapshot>;

/** Select a validated snapshot without materializing Resource/Group/Milestone cells. */
export function selectResourceKpiAssignments(prepared: PreparedResourceKpiSnapshot, filters: ResourceKpiFilters = prepared.input.filters ?? {}) {
  const { input, mdPerMm, tasks, assignments, byTask, byResource, projection, calendars, assignmentRows } = prepared;
  const inWbs = (task: ResourceKpiTask): boolean => {
    if (!filters.wbsRootIds?.length) return true;
    let current: ResourceKpiTask | undefined = task;
    while (current) {
      if (filters.wbsRootIds.includes(current.taskId)) return true;
      current = current.parentTaskId === null ? undefined : byTask.get(current.parentTaskId);
    }
    return false;
  };
  const taskText = (task: ResourceKpiTask) => [task.taskId, task.name ?? "", task.externalId ?? "", task.wbsPath ?? ""].join(" ").toLocaleLowerCase();
  const taskSearch = (filters.taskSearch ?? "").trim().toLocaleLowerCase();
  const search = (filters.search ?? "").trim().toLocaleLowerCase();
  const t0 = tasks.filter((task) => task.type === "task" && matches(filters.statuses, task.status) && (!taskSearch || taskText(task).includes(taskSearch)) && matches(filters.taskIds, task.taskId) && inWbs(task) &&
    matches(filters.milestoneIds, projection.membership.get(task.taskId)!.effectiveMilestoneTaskId) && task.start! <= input.to && task.end! >= input.from);
  const t0Ids = new Set(t0.map((task) => task.taskId));
  const selected: ResourceKpiAssignmentRow[] = [];
  for (const assignment of assignments) {
    if (assignment.kind !== "resource" || !t0Ids.has(assignment.taskId)) continue;
    const resource = byResource.get(assignment.targetId)!;
    const roles = resource.roles.length ? resource.roles : ["UNSPECIFIED"];
    if ((filters.eligibleResourceIds !== undefined && !filters.eligibleResourceIds.includes(resource.resourceId)) || !matches(filters.resourceIds, resource.resourceId) ||
        ((filters.groupIds?.length || filters.includeUngrouped) && !resource.groupIds.some((id) => filters.groupIds?.includes(id)) && !(filters.includeUngrouped && !resource.groupIds.length)) ||
        (filters.roles?.length && !roles.some((role) => filters.roles!.includes(role))) ||
        !matches(filters.developerGrades, resource.developerGrade ?? "UNSPECIFIED")) continue;
    const task = byTask.get(assignment.taskId)!;
    if (search && ![taskText(task), resource.name ?? "", resource.code ?? "", resource.groupSearchText ?? ""].join(" ").toLocaleLowerCase().includes(search)) continue;
    const from = (assignment.start ?? task.start!) < input.from ? input.from : assignment.start ?? task.start!;
    const to = (assignment.end ?? task.end!) > input.to ? input.to : assignment.end ?? task.end!;
    if (from > to) continue;
    const cached = assignmentRows.get(assignment.assignmentId);
    if (cached) { selected.push(cached); continue; }
    let calendar = calendars.get(resource.resourceId);
    if (!calendar) {
      calendar = resolveResourceCalendar({ projectCalendar: input.projectCalendar, resourceId: resource.resourceId, groupIds: resource.groupIds, exceptions: input.calendarExceptions ?? [] }).calendar;
      calendars.set(resource.resourceId, calendar);
    }
    const effectiveWorkingDays = workingDaysBetween(from, to, calendar);
    const plannedMd = assignment.allocationPercent === null ? null : effectiveWorkingDays * assignment.allocationPercent / 100;
    const row: ResourceKpiAssignmentRow = { projectPublicId: input.projectPublicId, assignmentId: assignment.assignmentId, taskId: task.taskId,
      resourceId: resource.resourceId, milestoneTaskId: projection.membership.get(task.taskId)!.effectiveMilestoneTaskId,
      groupIds: resource.groupIds, roles, from, to, allocationPercent: assignment.allocationPercent, effectiveWorkingDays,
      plannedMd, plannedMm: plannedMd === null || mdPerMm === null ? null : plannedMd / mdPerMm };
    assignmentRows.set(assignment.assignmentId, row); selected.push(row);
  }
  return { assignments: selected, t0, t0Ids, filters };
}
export type ResourceKpiSelection = ReturnType<typeof selectResourceKpiAssignments>;

/** Distinct/raw totals of an actual Assignment set, including an empty or excluded set. */
export function summarizeResourceKpiAssignments(prepared: PreparedResourceKpiSnapshot, rows: readonly ResourceKpiAssignmentRow[]): ResourceKpiTotals {
  const { input, mdPerMm, byTask } = prepared;
  rows = distinct(rows, (row) => row.assignmentId);
  const taskIds = unique(rows.map((row) => row.taskId));
  const targetTasks = taskIds.map((id) => byTask.get(id)!);
  const count = (predicate: (task: ResourceKpiTask) => boolean): ResourceKpiCount => { const ids = targetTasks.filter(predicate).map((task) => task.taskId); return { count: ids.length, taskIds: ids }; };
  const completed = count((task) => task.status === "completed");
  const denominator = targetTasks.reduce((sum, task) => sum + task.duration!, 0);
  const numerator = targetTasks.reduce((sum, task) => sum + task.duration! * task.progress!, 0);
  const resourceIds = unique(rows.map((row) => row.resourceId));
  return { taskIds, resourceIds, assignmentIds: rows.map((row) => row.assignmentId), taskCount: taskIds.length, resourceCount: resourceIds.length,
    assignmentCount: rows.length, notStarted: count((task) => task.status === "not_started"), inProgress: count((task) => task.status === "in_progress"), completed,
    delayed: count((task) => isResourceKpiTaskDelayed(task, input.asOfDate)),
    completion: { numerator: completed.count, denominator: taskIds.length, percent: taskIds.length ? completed.count / taskIds.length * 100 : null, taskIds, completedTaskIds: completed.taskIds },
    assignedTaskProgress: { numerator, denominator, percent: denominator ? numerator / denominator : null, taskIds }, effort: effort(rows, mdPerMm) };
}

/** Bound the selected projection before any subtotal/cell materialization. */
export function assertResourceKpiProjectionBudget(prepared: PreparedResourceKpiSnapshot, selection: ResourceKpiSelection) {
  const { input } = prepared;
  const { assignments: selected } = selection;
  if (input.maxProjectionCells !== undefined) {
    const dimensions = new Map<string, Set<string | null>>();
    const add = (key: string, milestone: string | null) => { const values = dimensions.get(key) ?? new Set<string | null>([null]); values.add(milestone); dimensions.set(key, values); };
    add("all", null); add("group:none", null);
    const roleIds = new Set<string>();
    for (const row of selected) {
      add("all", row.milestoneTaskId); add(`resource:${row.resourceId}`, row.milestoneTaskId);
      if (!row.groupIds.length) add("group:none", row.milestoneTaskId);
      for (const groupId of row.groupIds) add(`group:${groupId}`, row.milestoneTaskId);
      for (const role of row.roles) roleIds.add(role);
    }
    const cells = [...dimensions.values()].reduce((sum, values) => sum + values.size, roleIds.size);
    if (cells > input.maxProjectionCells) throw new ResourceKpiProjectionLimitError();
  }
}

/** T0 diagnostics reuse the same full membership without generating any matrix cells. */
export function getResourceKpiDiagnostics(prepared: PreparedResourceKpiSnapshot, selection: ResourceKpiSelection) {
  const { assignments } = prepared;
  const { t0, t0Ids, filters } = selection;
  const onT0 = assignments.filter((row) => t0Ids.has(row.taskId));
  const personalTaskIds = new Set(onT0.filter((row) => row.kind === "resource").map((row) => row.taskId));
  const groupTaskIds = new Set(onT0.filter((row) => row.kind === "group").map((row) => row.taskId));
  const diagnostic = (predicate: (task: ResourceKpiTask) => boolean) => { const taskIds = t0.filter(predicate).map((task) => task.taskId); return { count: taskIds.length, taskIds }; };
  const unsetRows = onT0.filter((row) => row.kind === "resource" && row.allocationPercent === null);
  return {
      scope: "T0" as const, taskIds: t0.map((task) => task.taskId), denominator: t0.length,
      inapplicableFilters: ["resourceIds", "groupIds", "roles", "developerGrades", "search", "resourceActivity", "groupActivity"] as const,
      personalFiltersAppliedToA: Boolean(filters.eligibleResourceIds !== undefined || filters.resourceIds?.length || filters.groupIds?.length || filters.includeUngrouped || filters.roles?.length || filters.developerGrades?.length || (filters.search ?? "").trim()),
      completelyUnassigned: diagnostic((task) => !personalTaskIds.has(task.taskId) && !groupTaskIds.has(task.taskId)),
      groupOnly: diagnostic((task) => !personalTaskIds.has(task.taskId) && groupTaskIds.has(task.taskId)),
      personallyUnassigned: diagnostic((task) => !personalTaskIds.has(task.taskId)),
      unsetTasks: { count: unique(unsetRows.map((row) => row.taskId)).length, taskIds: unique(unsetRows.map((row) => row.taskId)) },
      unsetAssignmentCount: unsetRows.length, unsetAssignmentIds: unsetRows.map((row) => row.assignmentId),
  };
}

/** Materialize only the selected projection, retaining the existing public Domain result. */
export function renderResourceKpi(prepared: PreparedResourceKpiSnapshot, selection: ResourceKpiSelection) {
  const { input, mdPerMm, byTask, projection, assignments } = prepared;
  const { assignments: selected } = selection;
  assertResourceKpiProjectionBudget(prepared, selection);
  const totals = (rows: readonly ResourceKpiAssignmentRow[]) => summarizeResourceKpiAssignments(prepared, rows);
  const buckets = (rows: readonly ResourceKpiAssignmentRow[]) => [...unique(rows.flatMap((row) => row.milestoneTaskId === null ? [] : [row.milestoneTaskId])), null].map((milestoneTaskId) => ({ milestoneTaskId, ...totals(rows.filter((row) => row.milestoneTaskId === milestoneTaskId)) }));
  const grouped = (ids: readonly string[], predicate: (row: ResourceKpiAssignmentRow, id: string) => boolean) => ids.map((id) => {
    const rows = selected.filter((row) => predicate(row, id)); return { id, ...totals(rows), milestones: buckets(rows) };
  });
  return {
    projectPublicId: input.projectPublicId, timezone: input.timezone, asOfDate: input.asOfDate, range: { from: input.from, to: input.to },
    mdPerMm, mdPerMmSource: mdPerMmSource(input.mdPerMm, input.mdPerMmEnvironment), mdPerMmProvided: input.mdPerMm !== undefined,
    assignments: selected, total: totals(selected), milestones: buckets(selected),
    resources: grouped(unique(selected.map((row) => row.resourceId)), (row, id) => row.resourceId === id),
    groups: [...grouped(unique(selected.flatMap((row) => row.groupIds)), (row, id) => row.groupIds.includes(id)),
      { id: null, ...totals(selected.filter((row) => !row.groupIds.length)), milestones: buckets(selected.filter((row) => !row.groupIds.length)) }],
    roles: grouped(unique(selected.flatMap((row) => row.roles)), (row, id) => row.roles.includes(id)),
    fullMilestones: [...projection.gates.entries()].map(([milestoneTaskId, stageGate]) => ({ milestoneTaskId, stageGate })),
    responsibilityReferences: assignments.filter((row) => row.kind === "group" || byTask.get(row.taskId)!.type !== "task"),
    diagnostics: getResourceKpiDiagnostics(prepared, selection),
    metadata: { taskScope: "distinct ordinary tasks represented in A", assignmentScope: "A: T0 AND personal classification filters AND assignment range", diagnosticsScope: "T0: project/WBS/milestone/task AND canonical task schedule range; no personal filters", responsibilityScope: "full project reference-only", groupRoleSubtotalsAdditive: false, precision: "raw; round at presentation boundary" },
  };
}
/** Backward-compatible entry point. Pure snapshot/selection helpers also support totals-only callers. */
export function calculateResourceKpi(input: ResourceKpiInput) {
  const prepared = prepareResourceKpiSnapshot(input);
  return renderResourceKpi(prepared, selectResourceKpiAssignments(prepared));
}
export type ResourceKpiResult = ReturnType<typeof calculateResourceKpi>;
