import type { ProjectTaskDto, TaskHierarchyCommandRequest } from "@/contracts/projects";

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


export function canAddTaskWithinSubtree(
  tasks: readonly ProjectTaskDto[],
  rootTaskId: string | null,
  targetTaskId: string | undefined,
  mode: "before" | "after" | "child" | undefined,
): boolean {
  // Native Grid add supports root creation in the full-project view and
  // child creation on a concrete row. Before/after remains owned by the
  // canonical hierarchy-command path.
  if (mode !== undefined && mode !== "child") return false;
  if (!targetTaskId) return rootTaskId === null;

  const target = tasks.find((task) => task.taskId === targetTaskId);
  if (!target || target.type === "milestone") return false;
  if (!rootTaskId) return true;

  const scope = resolveTaskSubtreeScope(tasks, rootTaskId);
  return scope.kind === "valid" && scope.taskIds.includes(targetTaskId);
}


export function taskHierarchyCommandStaysInSubtree(
  tasks: readonly ProjectTaskDto[],
  rootTaskId: string | null,
  command: TaskHierarchyCommandRequest,
): boolean {
  if (!rootTaskId) return true;
  const scope = resolveTaskSubtreeScope(tasks, rootTaskId);
  if (scope.kind !== "valid") return false;

  const taskIds = new Set(scope.taskIds);
  const root = scope.root;
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));

  switch (command.kind) {
    case "create":
      return taskIds.has(command.anchorTaskId) &&
        !(command.anchorTaskId === rootTaskId && command.placement !== "child");
    case "convert":
      return taskIds.has(command.taskId);
    case "move":
    case "indent":
      return taskIds.has(command.taskId) && command.taskId !== rootTaskId;
    case "outdent": {
      const task = taskById.get(command.taskId);
      return Boolean(
        task &&
        taskIds.has(command.taskId) &&
        command.taskId !== rootTaskId &&
        task.parentExternalId !== root.externalId,
      );
    }
    case "reparent":
      return taskIds.has(command.taskId) &&
        taskIds.has(command.anchorTaskId) &&
        command.taskId !== rootTaskId &&
        !(command.anchorTaskId === rootTaskId && command.placement !== "child");
    case "copy": {
      const sources = command.taskIds ?? (command.taskId ? [command.taskId] : []);
      return sources.length > 0 && sources.every((id) => taskIds.has(id)) &&
        taskIds.has(command.anchorTaskId) &&
        !(command.anchorTaskId === rootTaskId && command.placement !== "child");
    }
  }
}
