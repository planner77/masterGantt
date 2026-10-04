import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";

export function taskHasDependencyLinks(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
  links: readonly ProjectLinkDto[],
): boolean {
  const task = tasks.find((candidate) => candidate.taskId === taskId);
  if (!task) return false;
  return links.some((link) =>
    link.predecessorExternalId === task.externalId ||
    link.successorExternalId === task.externalId
  );
}

function taskSubtreeExternalIds(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
): Set<string> | null {
  const root = tasks.find((candidate) => candidate.taskId === taskId);
  if (!root) return null;
  const childrenByParent = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentExternalId === null) continue;
    const children = childrenByParent.get(task.parentExternalId) ?? [];
    children.push(task.externalId);
    childrenByParent.set(task.parentExternalId, children);
  }
  const affected = new Set<string>();
  const pending = [root.externalId];
  while (pending.length) {
    const externalId = pending.pop()!;
    if (affected.has(externalId)) continue;
    affected.add(externalId);
    pending.push(...(childrenByParent.get(externalId) ?? []));
  }
  return affected;
}

export function taskSubtreeHasDependencyLinks(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
  links: readonly ProjectLinkDto[],
): boolean {
  const affected = taskSubtreeExternalIds(tasks, taskId);
  if (!affected) return false;
  return links.some((link) =>
    affected.has(link.predecessorExternalId) ||
    affected.has(link.successorExternalId)
  );
}

export function taskSubtreeHasExternalDependencyLinks(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
  links: readonly ProjectLinkDto[],
): boolean {
  const affected = taskSubtreeExternalIds(tasks, taskId);
  if (!affected) return false;
  return links.some((link) =>
    affected.has(link.predecessorExternalId) !== affected.has(link.successorExternalId)
  );
}
