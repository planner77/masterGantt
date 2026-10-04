import type {
  ProjectLinkDto,
  ProjectTaskDto,
  TaskHierarchyCommandRequest,
  TaskHierarchyPlacement,
} from "@/contracts/projects";
import {
  taskHasDependencyLinks,
  taskSubtreeHasDependencyLinks,
  taskSubtreeHasExternalDependencyLinks,
} from "./task-link-scope";

export type TaskClipboard =
  | Readonly<{ mode: "cut"; taskId: string; revision: number }>
  | Readonly<{ mode: "copy"; taskIds: readonly string[]; revision: number }>;

export function clipboardIncludesRoot(clipboard: TaskClipboard, id: string): boolean {
  return clipboard.mode === "copy" ? clipboard.taskIds.includes(id) : clipboard.taskId === id;
}

export interface TaskContextCapabilities {
  canAddChild: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  canPaste: boolean;
  canConvertToTask: boolean;
  canConvertToMilestone: boolean;
  canConvertToSummary: boolean;
}

function orderedSiblings(tasks: readonly ProjectTaskDto[], task: ProjectTaskDto): ProjectTaskDto[] {
  return tasks
    .filter((candidate) => candidate.parentExternalId === task.parentExternalId)
    .sort((left, right) => left.siblingOrder - right.siblingOrder || left.externalId.localeCompare(right.externalId));
}

export function taskContextCapabilities(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
  editable: boolean,
  mutationLocked: boolean,
  links: readonly ProjectLinkDto[],
  clipboard: TaskClipboard | null,
  scopeRootTaskId: string | null = null,
): TaskContextCapabilities {
  const task = tasks.find((candidate) => candidate.taskId === taskId);
  const mutationAvailable = editable && !mutationLocked && task !== undefined;
  const siblingReorderAvailable = mutationAvailable;
  const hierarchyAvailable = mutationAvailable && !taskHasDependencyLinks(tasks, taskId, links);
  const parentChangeAvailable = mutationAvailable && !taskSubtreeHasDependencyLinks(tasks, taskId, links);
  if (!task) {
    return {
      canAddChild: false,
      canMoveUp: false,
      canMoveDown: false,
      canIndent: false,
      canOutdent: false,
      canPaste: false,
      canConvertToTask: false,
      canConvertToMilestone: false,
      canConvertToSummary: false,
    };
  }
  const siblings = orderedSiblings(tasks, task);
  const index = siblings.findIndex((candidate) => candidate.taskId === task.taskId);
  const hasChildren = tasks.some((candidate) => candidate.parentExternalId === task.externalId);
  const scopeRoot = scopeRootTaskId ? tasks.find((candidate) => candidate.taskId === scopeRootTaskId) : undefined;
  const isScopeRoot = task.taskId === scopeRootTaskId;
  const isDirectScopeChild = Boolean(scopeRoot && task.parentExternalId === scopeRoot.externalId);
  const pasteAvailable = clipboard !== null && !clipboardIncludesRoot(clipboard, task.taskId) &&
    (clipboard.mode === "copy"
      ? mutationAvailable
      : mutationAvailable && !taskSubtreeHasExternalDependencyLinks(tasks, clipboard.taskId, links));
  return {
    canAddChild: hierarchyAvailable && task.type !== "milestone",
    canMoveUp: siblingReorderAvailable && !isScopeRoot && index > 0,
    canMoveDown: siblingReorderAvailable && !isScopeRoot && index >= 0 && index < siblings.length - 1,
    canIndent: parentChangeAvailable && !isScopeRoot && index > 0,
    canOutdent: parentChangeAvailable && !isScopeRoot && !isDirectScopeChild && task.parentExternalId !== null,
    canPaste: pasteAvailable,
    canConvertToTask: hierarchyAvailable && task.type === "milestone" && !hasChildren,
    canConvertToMilestone: hierarchyAvailable && task.type === "task" && !hasChildren,
    // Empty summaries are created explicitly. Standalone leaf conversion is
    // still outside this command contract; first-child conversion is separate.
    canConvertToSummary: false,
  };
}

export function createHierarchyCommand(
  kind: "move-up" | "move-down" | "indent" | "outdent",
  taskId: string,
): TaskHierarchyCommandRequest {
  if (kind === "move-up" || kind === "move-down") {
    return { kind: "move", taskId, direction: kind === "move-up" ? "up" : "down" };
  }
  return { kind, taskId };
}

export function createPasteCommand(
  clipboard: TaskClipboard,
  anchorTaskId: string,
  placement: TaskHierarchyPlacement = "after",
): TaskHierarchyCommandRequest {
  return clipboard.mode === "cut"
    ? { kind: "reparent", taskId: clipboard.taskId, anchorTaskId, placement }
    : { kind: "copy", taskIds: clipboard.taskIds, anchorTaskId, placement };
}
