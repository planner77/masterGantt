import type { ProjectTaskDto } from "@/contracts/projects";

export type TaskSubtreeScope =
  | Readonly<{ kind: "all"; root: null; taskIds: null }>
  | Readonly<{ kind: "valid"; root: ProjectTaskDto; taskIds: readonly string[] }>
  | Readonly<{ kind: "missing"; root: null; taskIds: readonly [] }>
  | Readonly<{ kind: "not-summary"; root: ProjectTaskDto; taskIds: readonly [] }>;

export function canOpenTaskAsSubtreeRoot(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
): boolean {
  const root = tasks.find((task) => task.taskId === taskId);
  return Boolean(
    root?.type === "summary" &&
    tasks.some((task) => task.parentExternalId === root.externalId),
  );
}

export function resolveTaskSubtreeScope(
  tasks: readonly ProjectTaskDto[],
  rootTaskId: string | null,
): TaskSubtreeScope {
  if (!rootTaskId) return { kind: "all", root: null, taskIds: null };

  const root = tasks.find((task) => task.taskId === rootTaskId);
  if (!root) return { kind: "missing", root: null, taskIds: [] };
  if (root.type !== "summary") return { kind: "not-summary", root, taskIds: [] };

  const childrenByParentExternalId = new Map<string, ProjectTaskDto[]>();
  for (const task of tasks) {
    if (task.parentExternalId === null) continue;
    const children = childrenByParentExternalId.get(task.parentExternalId) ?? [];
    children.push(task);
    childrenByParentExternalId.set(task.parentExternalId, children);
  }

  const taskIds: string[] = [];
  const pending: ProjectTaskDto[] = [root];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const task = pending.shift();
    if (!task || visited.has(task.taskId)) continue;
    visited.add(task.taskId);
    taskIds.push(task.taskId);
    const children = childrenByParentExternalId.get(task.externalId) ?? [];
    pending.push(...children);
  }

  return { kind: "valid", root, taskIds };
}
