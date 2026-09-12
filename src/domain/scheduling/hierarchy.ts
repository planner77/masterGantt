import { isWorkingDay, MAX_TASK_DURATION, type WorkingCalendar } from "./calendar";
import { dateToOrdinal, ordinalToDate, parseDateOnly } from "./date-only";
import { SchedulingError, type SchedulingErrorCode } from "./errors";

export const MAX_HIERARCHY_TASKS = 5_000;
/** Root is depth 1. */
export const MAX_HIERARCHY_DEPTH = 64;

export interface HierarchyTaskInput {
  readonly taskId: string;
  readonly externalId: string;
  readonly parentExternalId: string | null;
  readonly siblingOrder: number;
  readonly type: "task" | "summary" | "milestone";
  readonly requestedStart: string | null;
  readonly start: string;
  readonly end: string;
  readonly duration: number;
  readonly progress: number;
  readonly scheduleMode: "auto" | "manual";
}

interface Aggregate {
  start: string;
  end: string;
  weight: number;
  weightedProgress: number;
  milestoneCount: number;
  milestoneProgress: number;
}

/**
 * Validate a complete canonical snapshot, derive summaries and WBS, preserving
 * input array order and other DTO fields. Does not reschedule leaves, change
 * parents/types, perform I/O, or mutate input. Callers first schedule changed
 * leaves and explicitly convert a task to summary when adding its first child.
 */
export function recalculateHierarchy<T extends HierarchyTaskInput>(
  tasks: readonly T[], calendar: WorkingCalendar,
): readonly Readonly<T & { wbs: string }>[] {
  if (!Array.isArray(tasks)) throw new SchedulingError("INVALID_HIERARCHY_INPUT", { field: "tasks" });
  if (tasks.length > MAX_HIERARCHY_TASKS) throw new SchedulingError("HIERARCHY_TASK_LIMIT_EXCEEDED", { field: "tasks" });
  const fail = (code: SchedulingErrorCode, index: number, field: string): never => {
    throw new SchedulingError(code, { index, field });
  };
  const byExternalId = new Map<string, number>();
  const taskIds = new Set<string>();
  const children = tasks.map((): number[] => []);
  const roots: number[] = [];
  let earliest = Infinity;
  let latest = -Infinity;
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (!task || typeof task !== "object" || Array.isArray(task)) fail("INVALID_HIERARCHY_INPUT", index, "task");
    for (const field of ["taskId", "externalId"] as const) {
      if (typeof task[field] !== "string" || task[field].length === 0) fail("INVALID_HIERARCHY_INPUT", index, field);
    }
    if (taskIds.has(task.taskId)) fail("DUPLICATE_TASK_ID", index, "taskId");
    if (byExternalId.has(task.externalId)) fail("DUPLICATE_EXTERNAL_ID", index, "externalId");
    taskIds.add(task.taskId);
    byExternalId.set(task.externalId, index);
    if (!Number.isSafeInteger(task.siblingOrder) || task.siblingOrder < 0) fail("INVALID_SIBLING_ORDER", index, "siblingOrder");
    if (task.parentExternalId !== null && (typeof task.parentExternalId !== "string" || !task.parentExternalId)) fail("INVALID_HIERARCHY_INPUT", index, "parentExternalId");
    if (task.type !== "task" && task.type !== "milestone" && task.type !== "summary") fail("INVALID_TASK_TYPE", index, "type");
    if (task.type === "summary") continue; // Its schedule and progress are exclusively derived.
    const start = parseDateOnly(task.start, "start");
    const end = parseDateOnly(task.end, "end");
    parseDateOnly(task.requestedStart as string, "requestedStart");
    if (start > end) fail("INVALID_DATE_INTERVAL", index, "end");
    if (task.scheduleMode !== "auto" && task.scheduleMode !== "manual") fail("INVALID_SCHEDULE_MODE", index, "scheduleMode");
    if (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100) fail("INVALID_PROGRESS", index, "progress");
    if (task.type === "task" ? !Number.isInteger(task.duration) || task.duration < 1 || task.duration > MAX_TASK_DURATION : task.duration !== 0) fail("INVALID_DURATION", index, "duration");
    if (!isWorkingDay(start, calendar)) fail("NON_WORKING_START", index, "start");
    if (!isWorkingDay(end, calendar)) fail("END_DURATION_MISMATCH", index, "end");
    earliest = Math.min(earliest, dateToOrdinal(start));
    latest = Math.max(latest, dateToOrdinal(end));
  }
  for (let index = 0; index < tasks.length; index += 1) {
    const parent = tasks[index].parentExternalId;
    if (parent === null) roots.push(index);
    else {
      const parentIndex = byExternalId.get(parent);
      if (parentIndex === undefined) fail("MISSING_PARENT", index, "parentExternalId");
      if (parentIndex === index) fail("PARENT_CYCLE", index, "parentExternalId");
      if (tasks[parentIndex!].type !== "summary") fail("INVALID_PARENT_TYPE", index, "parentExternalId");
      children[parentIndex!].push(index);
    }
  }
  for (const siblings of [roots, ...children]) {
    siblings.sort((left, right) => tasks[left].siblingOrder - tasks[right].siblingOrder);
    for (let i = 1; i < siblings.length; i += 1) {
      if (tasks[siblings[i - 1]].siblingOrder === tasks[siblings[i]].siblingOrder) fail("DUPLICATE_SIBLING_ORDER", siblings[i], "siblingOrder");
    }
  }
  // A parent graph has at most one incoming edge per node. A root-first traversal
  // visits every acyclic node exactly once; unvisited nodes imply a parent cycle.
  const traversal = roots.map((index, order) => ({ index, depth: 1, wbs: String(order + 1) }));
  for (let cursor = 0; cursor < traversal.length; cursor += 1) {
    const { index, depth, wbs } = traversal[cursor];
    if (depth > MAX_HIERARCHY_DEPTH) fail("HIERARCHY_DEPTH_EXCEEDED", index, "parentExternalId");
    children[index].forEach((child, order) => traversal.push({ index: child, depth: depth + 1, wbs: `${wbs}.${order + 1}` }));
  }
  if (traversal.length !== tasks.length) throw new SchedulingError("PARENT_CYCLE", { field: "parentExternalId" });
  for (let index = 0; index < tasks.length; index += 1) {
    if (tasks[index].type === "summary" && !children[index].length) fail("EMPTY_SUMMARY", index, "type");
  }
  // One bounded prefix avoids scanning a multi-century span per nested summary.
  const prefix = new Uint32Array(Number.isFinite(earliest) ? latest - earliest + 2 : 1);
  for (let ordinal = earliest; ordinal <= latest; ordinal += 1) {
    const offset = ordinal - earliest;
    prefix[offset + 1] = prefix[offset] + Number(isWorkingDay(ordinalToDate(ordinal), calendar));
  }
  const span = (start: string, end: string): number => prefix[dateToOrdinal(end) - earliest + 1] - prefix[dateToOrdinal(start) - earliest];
  const aggregate: Aggregate[] = [];
  const output: Readonly<T & { wbs: string }>[] = [];
  for (let cursor = traversal.length - 1; cursor >= 0; cursor -= 1) {
    const { index, wbs } = traversal[cursor];
    const task = tasks[index];
    if (task.type !== "summary") {
      if (task.type === "milestone" ? task.start !== task.end : span(task.start, task.end) !== task.duration) fail("END_DURATION_MISMATCH", index, "end");
      aggregate[index] = { start: task.start, end: task.end, weight: task.duration, weightedProgress: task.duration * task.progress,
        milestoneCount: Number(task.type === "milestone"), milestoneProgress: task.type === "milestone" ? task.progress : 0 };
      output[index] = Object.freeze({ ...task, wbs });
      continue;
    }
    const totals = { ...aggregate[children[index][0]] };
    for (const child of children[index].slice(1)) {
      const next = aggregate[child];
      totals.start = totals.start < next.start ? totals.start : next.start;
      totals.end = totals.end > next.end ? totals.end : next.end;
      totals.weight += next.weight;
      totals.weightedProgress += next.weightedProgress;
      totals.milestoneCount += next.milestoneCount;
      totals.milestoneProgress += next.milestoneProgress;
    }
    aggregate[index] = totals;
    output[index] = Object.freeze({ ...task, wbs, start: totals.start, end: totals.end, duration: span(totals.start, totals.end),
      progress: totals.weight ? totals.weightedProgress / totals.weight : totals.milestoneProgress / totals.milestoneCount,
      requestedStart: null, scheduleMode: "auto" as const });
  }
  return Object.freeze(output);
}
