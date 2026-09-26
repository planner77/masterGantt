import type { ProjectAssignmentDto, AssignmentTargetDto } from "@/contracts/resources";
import type { ProjectTaskDto } from "@/contracts/projects";

export type DateOperator = "overlap" | "contained" | "start-in" | "end-in";
export type NumberOperator = "eq" | "gte" | "lte" | "range";
export type TextOperator = "contains" | "not-contains" | "equals";

export type TaskFilterState = Readonly<{
  query: string;
  nameQuery: string;
  nameOperator: TextOperator;
  descriptionQuery: string;
  descriptionOperator: Exclude<TextOperator, "equals">;
  externalIdQuery: string;
  externalIdOperator: Exclude<TextOperator, "not-contains">;
  dateFrom: string;
  dateTo: string;
  dateOperator: DateOperator;
  assignmentState: "all" | "assigned" | "unassigned";
  types: readonly ProjectTaskDto["type"][];
  scheduleModes: readonly ProjectTaskDto["scheduleMode"][];
  progressMin: number | null;
  progressMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  targetIds: readonly string[];
  targetMode: "any" | "all";
}>;

export const EMPTY_TASK_FILTER: TaskFilterState = {
  query: "",
  nameQuery: "",
  nameOperator: "contains",
  descriptionQuery: "",
  descriptionOperator: "contains",
  externalIdQuery: "",
  externalIdOperator: "contains",
  dateFrom: "",
  dateTo: "",
  dateOperator: "overlap",
  assignmentState: "all",
  types: [],
  scheduleModes: [],
  progressMin: null,
  progressMax: null,
  durationMin: null,
  durationMax: null,
  targetIds: [],
  targetMode: "any",
};

export function normalizeFilterText(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function textMatchesFilter(value: string | null | undefined, query: string, operator: TextOperator): boolean {
  const normalizedQuery = normalizeFilterText(query);
  if (!normalizedQuery) return true;
  const normalizedValue = normalizeFilterText(value);
  if (operator === "equals") return normalizedValue === normalizedQuery;
  if (operator === "not-contains") return !normalizedValue.includes(normalizedQuery);
  return normalizedValue.includes(normalizedQuery);
}

function inRange(value: string, from: string, to: string): boolean {
  return value >= from && value <= to;
}

function dateMatches(task: ProjectTaskDto, filter: TaskFilterState): boolean {
  if (!filter.dateFrom || !filter.dateTo) return true;
  const from = filter.dateFrom <= filter.dateTo ? filter.dateFrom : filter.dateTo;
  const to = filter.dateFrom <= filter.dateTo ? filter.dateTo : filter.dateFrom;
  if (filter.dateOperator === "contained") return task.start >= from && task.end <= to;
  if (filter.dateOperator === "start-in") return inRange(task.start, from, to);
  if (filter.dateOperator === "end-in") return inRange(task.end, from, to);
  return task.start <= to && task.end >= from;
}

export function taskMatchesFilter(
  task: ProjectTaskDto,
  filter: TaskFilterState,
  assignmentIdsByTask: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  const query = normalizeFilterText(filter.query);
  if (query) {
    const haystack = [task.name, task.description, task.externalId].map(normalizeFilterText);
    if (!haystack.some((value) => value.includes(query))) return false;
  }
  if (!textMatchesFilter(task.name, filter.nameQuery, filter.nameOperator)) return false;
  if (!textMatchesFilter(task.description, filter.descriptionQuery, filter.descriptionOperator)) return false;
  if (!textMatchesFilter(task.externalId, filter.externalIdQuery, filter.externalIdOperator)) return false;
  if (!dateMatches(task, filter)) return false;
  if (filter.types.length > 0 && !filter.types.includes(task.type)) return false;
  if (filter.scheduleModes.length > 0 && !filter.scheduleModes.includes(task.scheduleMode)) return false;
  if (filter.progressMin !== null && task.progress < filter.progressMin) return false;
  if (filter.progressMax !== null && task.progress > filter.progressMax) return false;
  if (filter.durationMin !== null && task.duration < filter.durationMin) return false;
  if (filter.durationMax !== null && task.duration > filter.durationMax) return false;

  const assigned = assignmentIdsByTask.get(task.taskId) ?? new Set<string>();
  if (filter.assignmentState === "assigned" && assigned.size === 0) return false;
  if (filter.assignmentState === "unassigned" && assigned.size > 0) return false;
  if (filter.targetIds.length > 0) {
    const targetMatch = filter.targetMode === "all"
      ? filter.targetIds.every((id) => assigned.has(id))
      : filter.targetIds.some((id) => assigned.has(id));
    if (!targetMatch) return false;
  }
  return true;
}

export function buildAssignmentIdsByTask(assignments: readonly ProjectAssignmentDto[] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const assignment of assignments ?? []) {
    const set = map.get(assignment.taskId) ?? new Set<string>();
    set.add(`${assignment.target.kind}:${assignment.target.id}`);
    map.set(assignment.taskId, set);
  }
  return map;
}

export function filterTasksWithAncestors(
  tasks: readonly ProjectTaskDto[],
  filter: TaskFilterState,
  assignments: readonly ProjectAssignmentDto[] | undefined,
): Readonly<{ tasks: ProjectTaskDto[]; matchCount: number }> {
  const assigned = buildAssignmentIdsByTask(assignments);
  const matching = tasks.filter((task) => taskMatchesFilter(task, filter, assigned));
  const matchingExternalIds = new Set(matching.map((task) => task.externalId));
  const byExternalId = new Map(tasks.map((task) => [task.externalId, task]));
  const visibleExternalIds = new Set(matchingExternalIds);
  for (const task of matching) {
    let parentId = task.parentExternalId;
    while (parentId) {
      if (visibleExternalIds.has(parentId)) break;
      visibleExternalIds.add(parentId);
      parentId = byExternalId.get(parentId)?.parentExternalId ?? null;
    }
  }
  return { tasks: tasks.filter((task) => visibleExternalIds.has(task.externalId)), matchCount: matching.length };
}

export function activeTaskFilterCount(filter: TaskFilterState): number {
  return [
    normalizeFilterText(filter.query) !== "",
    normalizeFilterText(filter.nameQuery) !== "",
    normalizeFilterText(filter.descriptionQuery) !== "",
    normalizeFilterText(filter.externalIdQuery) !== "",
    Boolean(filter.dateFrom && filter.dateTo),
    filter.assignmentState !== "all",
    filter.types.length > 0,
    filter.scheduleModes.length > 0,
    filter.progressMin !== null || filter.progressMax !== null,
    filter.durationMin !== null || filter.durationMax !== null,
    filter.targetIds.length > 0,
  ].filter(Boolean).length;
}

export function targetLabel(target: AssignmentTargetDto): string {
  const code = target.code ? ` (${target.code})` : "";
  const inactive = target.active ? "" : " · 비활성";
  return `${target.name}${code}${inactive}`;
}

export type TaskQuickView = "all" | "task" | "milestone";

export function getTaskQuickView(types: readonly ProjectTaskDto["type"][]): TaskQuickView | "custom" {
  if (types.length === 0) return "all";
  if (types.length === 1 && types[0] === "task") return "task";
  if (types.length === 1 && types[0] === "milestone") return "milestone";
  return "custom";
}

export function applyTaskQuickView(filter: TaskFilterState, view: TaskQuickView): TaskFilterState {
  return {
    ...filter,
    types: view === "all" ? [] : [view],
  };
}
