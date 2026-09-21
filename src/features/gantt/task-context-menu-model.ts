import type {
  ProjectTaskDto,
  TaskHierarchyCommandRequest,
  TaskHierarchyPlacement,
} from "@/contracts/projects";

export type TaskClipboard = Readonly<{
  mode: "cut" | "copy";
  taskId: string;
  revision: number;
}>;

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
  hasLinks: boolean,
  clipboard: TaskClipboard | null,
): TaskContextCapabilities {
  const task = tasks.find((candidate) => candidate.taskId === taskId);
  const available = editable && !mutationLocked && !hasLinks && task !== undefined;
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
  return {
    canAddChild: available && task.type !== "milestone",
    canMoveUp: available && index > 0,
    canMoveDown: available && index >= 0 && index < siblings.length - 1,
    canIndent: available && index > 0,
    canOutdent: available && task.parentExternalId !== null &&
      siblings.length > 1,
    canPaste: available && clipboard !== null && clipboard.taskId !== task.taskId,
    canConvertToTask: available && task.type === "milestone" && !hasChildren,
    canConvertToMilestone: available && task.type === "task" && !hasChildren,
    // Canonical masterGantt summaries are derived and may not be empty.
    // A direct leaf→summary command therefore has no valid persisted state.
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
  return {
    kind: clipboard.mode === "cut" ? "reparent" : "copy",
    taskId: clipboard.taskId,
    anchorTaskId,
    placement,
  };
}
