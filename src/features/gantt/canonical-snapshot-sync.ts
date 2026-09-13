import type { ILink, ITask } from "@svar-ui/react-gantt";

export interface CanonicalGanttSnapshot {
  readonly tasks: readonly ITask[];
  readonly links: readonly ILink[];
}

export interface CanonicalGanttSyncPlan {
  readonly deletedTaskIds: readonly string[];
  readonly updatedTasks: readonly ITask[];
  readonly addedTasks: readonly ITask[];
  readonly replaceLinks: boolean;
}

function sameLinks(first: readonly ILink[], second: readonly ILink[]): boolean {
  if (first.length !== second.length) return false;
  return first.every((link, index) => {
    const candidate = second[index];
    return link.id === candidate?.id && link.source === candidate.source &&
      link.target === candidate.target && link.type === candidate.type;
  });
}

function sameDate(first: Date | undefined, second: Date | undefined): boolean {
  return first?.getTime() === second?.getTime();
}

function sameTask(first: ITask, second: ITask): boolean {
  return first.id === second.id && first.text === second.text &&
    sameDate(first.start, second.start) && sameDate(first.end, second.end) &&
    // SVAR derives duration from the exclusive end date. It is not part of
    // the canonical adapter payload and must not cause all rows to update.
    first.progress === second.progress &&
    first.type === second.type && first.parent === second.parent &&
    first.externalId === second.externalId;
}

/** Plans public SVAR actions from the rendered data to the server snapshot. */
export function planCanonicalGanttSync(
  current: CanonicalGanttSnapshot,
  canonical: CanonicalGanttSnapshot,
): CanonicalGanttSyncPlan {
  const canonicalIds = new Set(canonical.tasks.map((task) => String(task.id)));
  const currentById = new Map(current.tasks.map((task) => [String(task.id), task]));
  return {
    deletedTaskIds: current.tasks
      .map((task) => String(task.id))
      .filter((id) => !canonicalIds.has(id)),
    updatedTasks: canonical.tasks.filter((task) => {
      const currentTask = currentById.get(String(task.id));
      return currentTask !== undefined && !sameTask(currentTask, task);
    }),
    addedTasks: canonical.tasks.filter((task) => !currentById.has(String(task.id))),
    replaceLinks: !sameLinks(current.links, canonical.links),
  };
}
