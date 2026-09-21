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

function normalizedParent(task: ITask | undefined): string {
  const parent = task?.parent;
  return parent === undefined || parent === null || parent === 0 ? "0" : String(parent);
}

function hierarchyChanged(
  task: ITask,
  current: readonly ITask[],
  canonical: readonly ITask[],
): boolean {
  const id = String(task.id);
  const currentTask = current.find((candidate) => String(candidate.id) === id);
  if (!currentTask || normalizedParent(currentTask) !== normalizedParent(task)) return true;

  const parent = normalizedParent(task);
  const currentOrder = current
    .filter((candidate) => normalizedParent(candidate) === parent)
    .map((candidate) => String(candidate.id));
  const canonicalIds = new Set(current.map((candidate) => String(candidate.id)));
  const canonicalOrder = canonical
    .filter((candidate) => normalizedParent(candidate) === parent && canonicalIds.has(String(candidate.id)))
    .map((candidate) => String(candidate.id));
  return currentOrder.indexOf(id) !== canonicalOrder.indexOf(id);
}

async function syncExistingTaskHierarchy(
  api: Pick<IApi, "exec">,
  current: readonly ITask[],
  canonical: readonly ITask[],
  isCurrent: () => boolean,
): Promise<void> {
  const existingIds = new Set(current.map((task) => String(task.id)));
  for (const task of canonical) {
    if (!isCurrent()) return;
    const id = String(task.id);
    if (!existingIds.has(id) || !hierarchyChanged(task, current, canonical)) continue;

    const parent = normalizedParent(task);
    const siblings = canonical.filter((candidate) =>
      normalizedParent(candidate) === parent && existingIds.has(String(candidate.id)),
    );
    const index = siblings.findIndex((candidate) => String(candidate.id) === id);
    const previous = index > 0 ? siblings[index - 1] : undefined;
    const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;
    const currentTask = current.find((candidate) => String(candidate.id) === id);

    if (parent !== "0" && normalizedParent(currentTask) !== parent) {
      await api.exec("move-task", { id: task.id, mode: "child", target: task.parent });
    }
    if (!isCurrent()) return;
    if (previous?.id !== undefined) {
      await api.exec("move-task", { id: task.id, mode: "after", target: previous.id });
    } else if (next?.id !== undefined) {
      await api.exec("move-task", { id: task.id, mode: "before", target: next.id });
    }
  }
}

function deletedTaskIdsChildFirst(
  current: readonly ITask[],
  canonicalIds: ReadonlySet<string>,
): string[] {
  const currentById = new Map(current.map((task) => [String(task.id), task]));
  const originalIndex = new Map(current.map((task, index) => [String(task.id), index]));
  const depthCache = new Map<string, number>();

  const depth = (id: string, visiting = new Set<string>()): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const task = currentById.get(id);
    const parentId = task?.parent === undefined || task.parent === null || task.parent === 0
      ? null
      : String(task.parent);
    const value = parentId && currentById.has(parentId) ? depth(parentId, visiting) + 1 : 0;
    visiting.delete(id);
    depthCache.set(id, value);
    return value;
  };

  return current
    .map((task) => String(task.id))
    .filter((id) => !canonicalIds.has(id))
    .sort((first, second) => depth(second) - depth(first) ||
      (originalIndex.get(first) ?? 0) - (originalIndex.get(second) ?? 0));
}

/** Plans public SVAR actions from the rendered data to the server snapshot. */
export function planCanonicalGanttSync(
  current: CanonicalGanttSnapshot,
  canonical: CanonicalGanttSnapshot,
): CanonicalGanttSyncPlan {
  const canonicalIds = new Set(canonical.tasks.map((task) => String(task.id)));
  const currentById = new Map(current.tasks.map((task) => [String(task.id), task]));
  return {
    // Core cannot safely delete a summary before its rendered descendants.
    // Mirror the server's child-first subtree mutation order so a successful
    // canonical DELETE never needs the remount/recovery path.
    deletedTaskIds: deletedTaskIdsChildFirst(current.tasks, canonicalIds),
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
  await syncExistingTaskHierarchy(api, current.tasks, canonical.tasks, isCurrent);
  for (const task of plan.updatedTasks) {
    if (!isCurrent()) return;
    const { id, ...update } = task;
    delete update.open;
    // Hierarchy/order is synchronized through SVAR's documented move-task action.
    // Updating parent directly is not a supported tree mutation and can force recovery remounts.
    delete update.parent;
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
