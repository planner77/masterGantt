import type { ProjectTaskDto } from "@/contracts/projects";

/** Canonical preorder is independent of click order and Grid sorting. */
export function canonicalTaskOrder(tasks: readonly ProjectTaskDto[]): ProjectTaskDto[] {
  const children = new Map<string | null, ProjectTaskDto[]>();
  for (const task of tasks) {
    const group = children.get(task.parentExternalId) ?? [];
    group.push(task);
    children.set(task.parentExternalId, group);
  }
  for (const group of children.values()) group.sort((a, b) => a.siblingOrder - b.siblingOrder || a.externalId.localeCompare(b.externalId));
  const result: ProjectTaskDto[] = [];
  const seen = new Set<string>();
  const pending = [...(children.get(null) ?? [])].reverse();
  while (pending.length) {
    const task = pending.pop()!;
    if (seen.has(task.taskId)) continue;
    seen.add(task.taskId);
    result.push(task);
    pending.push(...[...(children.get(task.externalId) ?? [])].reverse());
  }
  return result;
}

export function normalizeCopySelection(tasks: readonly ProjectTaskDto[], ids: readonly string[]): string[] {
  const selected = new Set(ids);
  const byExternal = new Map(tasks.map((task) => [task.externalId, task]));
  return canonicalTaskOrder(tasks).filter((task) => {
    if (!selected.has(task.taskId)) return false;
    let parent = task.parentExternalId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const ancestor = byExternal.get(parent);
      if (!ancestor) break;
      if (selected.has(ancestor.taskId)) return false;
      parent = ancestor.parentExternalId;
    }
    return true;
  }).map((task) => task.taskId);
}

export function selectTaskGesture(tasks: readonly ProjectTaskDto[], selected: readonly string[], anchorId: string | null,
  taskId: string, gesture: "single" | "toggle" | "range", visibleIds?: readonly string[] | null, matchingIds?: readonly string[] | null): string[] {
  const visible = visibleIds ? new Set(visibleIds) : null;
  const all = canonicalTaskOrder(tasks);
  const ordered = all.filter((task) => !visible || visible.has(task.taskId));
  const target = ordered.find((task) => task.taskId === taskId);
  if (!target) return selected.filter((id) => ordered.some((task) => task.taskId === id));
  if (gesture === "single") return [taskId];
  const selection = new Set(selected.filter((id) => all.some((task) => task.taskId === id)));
  if (gesture === "toggle") {
    if (selection.has(taskId)) selection.delete(taskId); else selection.add(taskId);
  } else {
    // Context-only ancestors remain explicit targets, but never implicit range members.
    const matching = matchingIds ? new Set(matchingIds) : null;
    const siblings = ordered.filter((task) => task.parentExternalId === target.parentExternalId && (!matching || matching.has(task.taskId)));
    const start = siblings.findIndex((task) => task.taskId === anchorId);
    const end = siblings.findIndex((task) => task.taskId === taskId);
    if (start < 0 || end < 0) return [taskId];
    return siblings.slice(Math.min(start, end), Math.max(start, end) + 1).map((task) => task.taskId);
  }
  return all.filter((task) => selection.has(task.taskId)).map((task) => task.taskId);
}

export function hiddenSelectedCount(tasks: readonly ProjectTaskDto[], ids: readonly string[], collapsed: ReadonlyMap<string, boolean>): number {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const byExternal = new Map(tasks.map((task) => [task.externalId, task]));
  return ids.filter((id) => {
    let parent = byId.get(id)?.parentExternalId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const ancestor = byExternal.get(parent);
      if (!ancestor) break;
      if (collapsed.get(ancestor.taskId)) return true;
      parent = ancestor.parentExternalId;
    }
    return false;
  }).length;
}
