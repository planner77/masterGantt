import type { ProjectTaskDto } from "@/contracts/projects";

import { resolveTaskSubtreeScope } from "./task-subtree-scope";

export type NativeTaskAddSource = "header" | "row";
export type NativeTaskAddRejectReason = "scope" | "missing" | "milestone";

export type NativeTaskAddIntent =
  | Readonly<{
      kind: "create";
      source: NativeTaskAddSource;
      parentTaskId?: string;
      targetTaskId?: string;
      mode?: "child";
    }>
  | Readonly<{
      kind: "reject";
      source: NativeTaskAddSource;
      reason: NativeTaskAddRejectReason;
    }>;

export function resolveNativeTaskAddIntent(input: Readonly<{
  tasks: readonly ProjectTaskDto[];
  rootTaskId: string | null;
  source: NativeTaskAddSource;
  targetTaskId?: string;
  mode?: "before" | "after" | "child";
}>): NativeTaskAddIntent {
  const { tasks, rootTaskId, source, targetTaskId, mode } = input;

  if (source === "header") {
    if (rootTaskId === null) return { kind: "create", source };

    const scope = resolveTaskSubtreeScope(tasks, rootTaskId);
    if (scope.kind !== "valid") return { kind: "reject", source, reason: "scope" };
    return {
      kind: "create",
      source,
      parentTaskId: scope.root.taskId,
      targetTaskId: scope.root.taskId,
      mode: "child",
    };
  }

  if (!targetTaskId || (mode !== undefined && mode !== "child")) {
    return { kind: "reject", source, reason: "scope" };
  }
  const target = tasks.find((task) => task.taskId === targetTaskId);
  if (!target) return { kind: "reject", source, reason: "missing" };
  if (target.type === "milestone") return { kind: "reject", source, reason: "milestone" };

  if (rootTaskId !== null) {
    const scope = resolveTaskSubtreeScope(tasks, rootTaskId);
    if (scope.kind !== "valid" || !scope.taskIds.includes(targetTaskId)) {
      return { kind: "reject", source, reason: "scope" };
    }
  }

  return {
    kind: "create",
    source,
    parentTaskId: targetTaskId,
    targetTaskId,
    mode: "child",
  };
}
