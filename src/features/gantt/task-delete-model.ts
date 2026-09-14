import type { ProjectTaskDto } from "@/contracts/projects";

export interface TaskDeletePlan {
  readonly taskId: string;
  readonly taskName: string;
  readonly descendantTaskIds: readonly string[];
}

export function createTaskDeletePlan(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
): TaskDeletePlan | null {
  const root = tasks.find((task) => task.taskId === taskId);
  if (!root) return null;

  const childrenByParentExternalId = new Map<string, ProjectTaskDto[]>();
  for (const task of tasks) {
    if (task.parentExternalId === null) continue;
    const children = childrenByParentExternalId.get(task.parentExternalId) ?? [];
    children.push(task);
    childrenByParentExternalId.set(task.parentExternalId, children);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const descendants: string[] = [];
  const visit = (task: ProjectTaskDto) => {
    if (visiting.has(task.externalId)) throw new Error("Invalid cyclic task hierarchy.");
    if (visited.has(task.externalId)) return;
    visiting.add(task.externalId);
    for (const child of childrenByParentExternalId.get(task.externalId) ?? []) {
      visit(child);
      descendants.push(child.taskId);
    }
    visiting.delete(task.externalId);
    visited.add(task.externalId);
  };
  visit(root);

  return {
    taskId: root.taskId,
    taskName: root.name,
    descendantTaskIds: descendants,
  };
}
