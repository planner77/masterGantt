import type { TaskStatus } from "../contracts/projects";

export function taskStatusFromProgress(progress: number | null): TaskStatus {
  if (progress === 100) return "completed";
  if (progress !== null && progress > 0) return "in_progress";
  return "not_started";
}

export function taskStatusProgressConsistent(status: TaskStatus, progress: number | null): boolean {
  if (progress === null) return status === "not_started";
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) return false;
  if (status === "completed") return progress === 100;
  if (status === "not_started") return progress === 0;
  return progress < 100;
}

export function normalizeTaskStatusProgress(input: Readonly<{
  currentStatus: TaskStatus;
  currentProgress: number;
  status?: TaskStatus;
  progress?: number;
}>): { readonly status: TaskStatus; readonly progress: number } {
  const requestedProgress = input.progress ?? input.currentProgress;
  if (input.status !== undefined) {
    if (input.status === "completed") return { status: "completed", progress: 100 };
    if (input.status === "not_started") return { status: "not_started", progress: 0 };
    return { status: "in_progress", progress: requestedProgress === 100 ? 0 : requestedProgress };
  }
  if (input.progress !== undefined) {
    if (requestedProgress === 100) return { status: "completed", progress: 100 };
    if (input.currentStatus === "completed") return { status: "in_progress", progress: requestedProgress };
    if (requestedProgress > 0) return { status: "in_progress", progress: requestedProgress };
    return { status: input.currentStatus, progress: requestedProgress };
  }
  return { status: input.currentStatus, progress: input.currentProgress };
}
