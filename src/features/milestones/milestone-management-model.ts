import type { MilestoneDashboardStageDto } from "../../contracts/milestone-dashboard";
import type { ProjectTaskDto, TaskMutationResponse } from "../../contracts/projects";
import { stageFilterCandidates } from "../projects/project-search-filter";
import { parseDateOnly } from "../../domain/scheduling/date-only";

export type MilestoneManagementCommand = "detail" | "memberships" | "relations" | "copy-id" | "copy" | "delete" | "date" | "members";
export type MilestoneManagementHandler = (taskId: string, command: MilestoneManagementCommand, trigger: HTMLElement) => void;

export function milestoneManagementDate(task: ProjectTaskDto | undefined): string | null {
  if (!task?.start) return null;
  try { return parseDateOnly(task.start); } catch { return null; }
}

/** Presentation order never changes the canonical hierarchy or report population. */
export function sortMilestoneManagementRows(rows: readonly MilestoneDashboardStageDto[], tasks: readonly ProjectTaskDto[]): MilestoneDashboardStageDto[] {
  const ordered = stageFilterCandidates(tasks.map(task => milestoneManagementDate(task) ? task : { ...task, start: null }));
  const ranks = new Map(ordered.map((task, index) => [task.taskId, index]));
  return [...rows].sort((a, b) => (ranks.get(a.milestoneTaskId) ?? Infinity) - (ranks.get(b.milestoneTaskId) ?? Infinity) || a.milestoneTaskId.localeCompare(b.milestoneTaskId));
}

/** The server has no dedicated createdTaskId field: accept only one canonical new Milestone. */
export function resolveCreatedMilestone(previous: readonly ProjectTaskDto[], response: TaskMutationResponse): ProjectTaskDto | null {
  if (response.data.operation.kind !== "taskCreate") return null;
  const previousIds = new Set(previous.map(task => task.taskId));
  const added = response.data.tasks.filter(task => !previousIds.has(task.taskId));
  if (added.length !== 1) return null;
  const task = added[0];
  return task.type === "milestone" && response.data.operation.changedTaskExternalIds.includes(task.externalId) ? task : null;
}

export function milestoneRootPayload(name: string, start: string) {
  return { name: name.trim(), type: "milestone" as const, start: parseDateOnly(start), duration: 0, progress: 0, parentExternalId: null };
}

export function isVisibleFocusTarget(target: HTMLElement | null | undefined): target is HTMLElement {
  return Boolean(target?.isConnected && target.getClientRects().length && !target.closest("[hidden], [inert]") && !target.matches(":disabled"));
}
