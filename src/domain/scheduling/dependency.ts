import { endFromStart, nextWorkingDay, type WorkingCalendar } from "./calendar";
import { MAX_HIERARCHY_TASKS } from "./hierarchy";
import { SchedulingError } from "./errors";

export interface FinishStartDependencyTaskInput {
  readonly taskId: string;
  readonly externalId: string;
  readonly type: "task" | "summary" | "milestone";
  readonly scheduleMode: "auto" | "manual";
  readonly start: string;
  readonly end: string;
  readonly duration: number;
}

export interface FinishStartDependencyLinkInput {
  readonly id: string;
  readonly predecessorExternalId: string;
  readonly successorExternalId: string;
  readonly type: "FS";
  readonly lag: 0;
}

export interface FinishStartDependencyChange {
  readonly taskId: string;
  readonly externalId: string;
  readonly beforeStart: string;
  readonly beforeEnd: string;
  readonly afterStart: string;
  readonly afterEnd: string;
  readonly predecessorExternalIds: readonly string[];
}

export interface FinishStartManualConflict {
  readonly taskId: string;
  readonly externalId: string;
  readonly start: string;
  readonly requiredStart: string;
  readonly predecessorExternalIds: readonly string[];
}

export interface FinishStartDependencyResult<T extends FinishStartDependencyTaskInput> {
  readonly tasks: readonly Readonly<T>[];
  readonly changes: readonly Readonly<FinishStartDependencyChange>[];
  readonly manualConflicts: readonly Readonly<FinishStartManualConflict>[];
}

type MutableTask<T extends FinishStartDependencyTaskInput> =
  Omit<T, "start" | "end"> & { start: string; end: string };

function invalid(field: string, index?: number): never {
  throw new SchedulingError("INVALID_DEPENDENCY_INPUT", {
    field,
    ...(index === undefined ? {} : { index }),
  });
}

/**
 * Apply supported FS/lag=0 constraints to calendar-normalized leaf schedules.
 * The caller owns requested-start/calendar normalization. This function owns
 * dependency graph validation, deterministic forward-pass scheduling, and
 * Manual lower-bound conflict detection.
 */
export function recalculateFinishStartDependencies<T extends FinishStartDependencyTaskInput>(
  tasks: readonly T[],
  links: readonly FinishStartDependencyLinkInput[],
  calendar: WorkingCalendar,
): FinishStartDependencyResult<T> {
  if (!Array.isArray(tasks) || !Array.isArray(links)) invalid("input");
  if (tasks.length > MAX_HIERARCHY_TASKS) {
    throw new SchedulingError("HIERARCHY_TASK_LIMIT_EXCEEDED", { field: "tasks" });
  }

  const taskIds = new Set<string>();
  const byExternalId = new Map<string, number>();
  const leafIndexes: number[] = [];
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (!task || typeof task !== "object" || Array.isArray(task)) invalid(`tasks[${index}]`, index);
    if (typeof task.taskId !== "string" || task.taskId.length === 0) invalid(`tasks[${index}].taskId`, index);
    if (typeof task.externalId !== "string" || task.externalId.length === 0) invalid(`tasks[${index}].externalId`, index);
    if (taskIds.has(task.taskId)) throw new SchedulingError("DUPLICATE_TASK_ID", { field: "taskId", index });
    if (byExternalId.has(task.externalId)) throw new SchedulingError("DUPLICATE_EXTERNAL_ID", { field: "externalId", index });
    if (task.type !== "task" && task.type !== "summary" && task.type !== "milestone") {
      invalid(`tasks[${index}].type`, index);
    }
    if (task.scheduleMode !== "auto" && task.scheduleMode !== "manual") {
      invalid(`tasks[${index}].scheduleMode`, index);
    }
    taskIds.add(task.taskId);
    byExternalId.set(task.externalId, index);
    if (task.type !== "summary") leafIndexes.push(index);
  }

  const outgoing = tasks.map((): number[] => []);
  const incoming = tasks.map((): number[] => []);
  const indegree = new Uint32Array(tasks.length);
  const linkIds = new Set<string>();
  const edges = new Set<string>();

  for (let index = 0; index < links.length; index += 1) {
    const link = links[index] as FinishStartDependencyLinkInput;
    if (!link || typeof link !== "object" || Array.isArray(link) ||
      typeof link.id !== "string" || link.id.length === 0 ||
      typeof link.predecessorExternalId !== "string" || !link.predecessorExternalId ||
      typeof link.successorExternalId !== "string" || !link.successorExternalId) {
      invalid(`links[${index}]`, index);
    }
    if (link.type !== "FS" || link.lag !== 0) {
      throw new SchedulingError("UNSUPPORTED_DEPENDENCY", { field: `links[${index}]`, index });
    }
    if (linkIds.has(link.id)) {
      throw new SchedulingError("DUPLICATE_DEPENDENCY", { field: `links[${index}].id`, index });
    }
    linkIds.add(link.id);

    const predecessor = byExternalId.get(link.predecessorExternalId);
    const successor = byExternalId.get(link.successorExternalId);
    if (predecessor === undefined || successor === undefined) {
      throw new SchedulingError("MISSING_DEPENDENCY", { field: `links[${index}]`, index });
    }
    if (predecessor === successor) {
      throw new SchedulingError("SELF_DEPENDENCY", { field: `links[${index}]`, index });
    }
    if (tasks[predecessor].type === "summary" || tasks[successor].type === "summary") {
      throw new SchedulingError("SUMMARY_DEPENDENCY_ENDPOINT", { field: `links[${index}]`, index });
    }
    const edge = `${link.predecessorExternalId}\u0000${link.successorExternalId}`;
    if (edges.has(edge)) {
      throw new SchedulingError("DUPLICATE_DEPENDENCY", { field: `links[${index}]`, index });
    }
    edges.add(edge);
    outgoing[predecessor].push(successor);
    incoming[successor].push(predecessor);
    indegree[successor] += 1;
  }

  const queue: number[] = [];
  for (const index of leafIndexes) if (indegree[index] === 0) queue.push(index);
  const order: number[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    order.push(index);
    for (const successor of outgoing[index]) {
      indegree[successor] -= 1;
      if (indegree[successor] === 0) queue.push(successor);
    }
  }
  if (order.length !== leafIndexes.length) {
    throw new SchedulingError("DEPENDENCY_CYCLE", { field: "links" });
  }

  const staged = tasks.map((task) => ({ ...task })) as MutableTask<T>[];
  const changes: FinishStartDependencyChange[] = [];
  const manualConflicts: FinishStartManualConflict[] = [];

  for (const index of order) {
    const task = staged[index];
    if (incoming[index].length === 0) continue;

    let requiredStart: string | undefined;
    let boundPredecessors: string[] = [];
    for (const predecessorIndex of incoming[index]) {
      const predecessor = staged[predecessorIndex];
      const candidate = nextWorkingDay(predecessor.end, calendar, false);
      if (requiredStart === undefined || candidate > requiredStart) {
        requiredStart = candidate;
        boundPredecessors = [predecessor.externalId];
      } else if (candidate === requiredStart) {
        boundPredecessors.push(predecessor.externalId);
      }
    }
    if (requiredStart === undefined || task.start >= requiredStart) continue;

    if (task.scheduleMode === "manual") {
      manualConflicts.push(Object.freeze({
        taskId: task.taskId,
        externalId: task.externalId,
        start: task.start,
        requiredStart,
        predecessorExternalIds: Object.freeze([...boundPredecessors]),
      }));
      continue;
    }

    const beforeStart = task.start;
    const beforeEnd = task.end;
    task.start = requiredStart;
    task.end = task.type === "milestone"
      ? requiredStart
      : endFromStart(requiredStart, task.duration, calendar);
    changes.push(Object.freeze({
      taskId: task.taskId,
      externalId: task.externalId,
      beforeStart,
      beforeEnd,
      afterStart: task.start,
      afterEnd: task.end,
      predecessorExternalIds: Object.freeze([...boundPredecessors]),
    }));
  }

  return Object.freeze({
    tasks: Object.freeze(staged.map((task) => Object.freeze({ ...task }) as Readonly<T>)),
    changes: Object.freeze(changes),
    manualConflicts: Object.freeze(manualConflicts),
  });
}
