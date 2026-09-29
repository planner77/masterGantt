import type { ProjectTaskDto, TaskHierarchyCommandRequest } from "@/contracts/projects";

export type ChartDragIntent = "pending" | "horizontal" | "vertical";
export type ChartDropPlacement = "before" | "after";

export interface VisibleChartRow {
  readonly taskId: string;
  readonly parentExternalId: string | null;
  readonly top: number;
  readonly bottom: number;
}

export interface ChartVerticalDrop {
  readonly anchorTaskId: string;
  readonly placement: ChartDropPlacement;
}

const VERTICAL_LOCK_DISTANCE = 8;
const HORIZONTAL_LOCK_DISTANCE = 12;

export function resolveChartDragIntent(dx: number, dy: number): ChartDragIntent {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (horizontal < VERTICAL_LOCK_DISTANCE && vertical < VERTICAL_LOCK_DISTANCE) return "pending";
  if (vertical > horizontal) return "vertical";
  if (horizontal >= HORIZONTAL_LOCK_DISTANCE) return "horizontal";
  return "pending";
}

export function resolveChartVerticalDrop(
  sourceTaskId: string,
  sourceParentExternalId: string | null,
  pointerY: number,
  rows: readonly VisibleChartRow[],
): ChartVerticalDrop | null {
  const candidates = rows.filter((row) => row.taskId !== sourceTaskId);
  if (candidates.length === 0) return null;

  let nearest = candidates[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const row of candidates) {
    const center = (row.top + row.bottom) / 2;
    const distance = Math.abs(pointerY - center);
    if (distance < nearestDistance) {
      nearest = row;
      nearestDistance = distance;
    }
  }

  if (!nearest || nearest.parentExternalId !== sourceParentExternalId) return null;
  const center = (nearest.top + nearest.bottom) / 2;
  return {
    anchorTaskId: nearest.taskId,
    placement: pointerY < center ? "before" : "after",
  };
}

export function buildChartReorderCommand(
  tasks: readonly ProjectTaskDto[],
  sourceTaskId: string,
  anchorTaskId: string,
  placement: ChartDropPlacement,
): TaskHierarchyCommandRequest | null {
  const source = tasks.find((task) => task.taskId === sourceTaskId);
  const anchor = tasks.find((task) => task.taskId === anchorTaskId);
  if (!source || !anchor || source.taskId === anchor.taskId) return null;
  if (source.parentExternalId !== anchor.parentExternalId) return null;

  const siblings = tasks
    .filter((task) => task.parentExternalId === source.parentExternalId)
    .slice()
    .sort((left, right) => left.siblingOrder - right.siblingOrder || left.taskId.localeCompare(right.taskId));
  const before = siblings.map((task) => task.taskId);
  const reordered = siblings.filter((task) => task.taskId !== source.taskId);
  const anchorIndex = reordered.findIndex((task) => task.taskId === anchor.taskId);
  if (anchorIndex < 0) return null;
  reordered.splice(anchorIndex + (placement === "after" ? 1 : 0), 0, source);
  const after = reordered.map((task) => task.taskId);
  if (before.length === after.length && before.every((taskId, index) => taskId === after[index])) return null;

  return {
    kind: "reparent",
    taskId: source.taskId,
    anchorTaskId: anchor.taskId,
    placement,
  };
}
