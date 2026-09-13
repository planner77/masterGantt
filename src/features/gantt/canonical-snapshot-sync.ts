import type { IApi, ILink, ITask } from "@svar-ui/react-gantt";

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

/**
 * Applies the plan without rebuilding the widget. The caller owns the serialized
 * queue, synchronization guard and recovery. Rejections deliberately propagate.
 */
export async function applyCanonicalGanttSync(
  api: Pick<IApi, "exec">,
  current: CanonicalGanttSnapshot,
  canonical: CanonicalGanttSnapshot,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const plan = planCanonicalGanttSync(current, canonical);
  const currentById = new Map(current.tasks.map((task) => [task.id, task]));
  const parentIds = new Set(canonical.tasks.map((task) => task.parent));
  // Capture transitions before exec can mutate objects returned by serialize.
  const summaryIdsToOpen = plan.updatedTasks.flatMap((task) => (
    task.id !== undefined && task.type === "summary" &&
    currentById.get(task.id)?.type !== "summary" && parentIds.has(task.id)
      ? [task.id]
      : []
  ));

  for (const link of current.links) {
    if (!isCurrent()) return;
    if (plan.replaceLinks && link.id !== undefined) await api.exec("delete-link", { id: link.id });
  }
  for (const id of plan.deletedTaskIds) {
    if (!isCurrent()) return;
    await api.exec("delete-task", { id });
  }
  for (const task of plan.updatedTasks) {
    if (!isCurrent()) return;
    const { id, ...update } = task;
    delete update.open;
    if (id !== undefined) {
      await api.exec("update-task", { id, task: update, eventSource: "project-canonical-sync", skipUndo: true });
    }
  }
  for (const task of plan.addedTasks) {
    if (!isCurrent()) return;
    const { id, ...add } = task;
    delete add.open;
    await api.exec("add-task", {
      id,
      // Core reads task.id; preserve the public top-level action ID as well.
      task: { ...add, id },
      select: false,
      eventSource: "project-canonical-sync",
      ...(task.parent && task.parent !== 0 ? { target: task.parent, mode: "child" as const } : {}),
    });
  }
  // A former leaf has no child collection until add-task has run. Opening it
  // earlier exposes an invalid intermediate tree to Core's synchronous render.
  // Do not reopen existing summaries that the user deliberately collapsed.
  for (const id of summaryIdsToOpen) {
    if (!isCurrent()) return;
    await api.exec("open-task", { id, mode: true });
  }
  if (plan.replaceLinks) for (const link of canonical.links) {
    if (!isCurrent()) return;
    await api.exec("add-link", { link, eventSource: "project-canonical-sync" });
  }
}
