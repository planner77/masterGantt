import type { ProjectTaskDto } from "@/contracts/projects";

import {
  dateOnlyFromLocalDate,
  localDateFromDateOnly,
  type DateOnly,
} from "./date-adapter";
import type { ProjectTaskUpdateCommand } from "./project-task-adapter";

export function canEditGridStartDate(task: ProjectTaskDto, canMutate: boolean): boolean {
  return canMutate && task.type !== "summary" && task.start !== null;
}

export function gridStartDateValue(task: ProjectTaskDto): Date | null {
  return task.start === null ? null : localDateFromDateOnly(task.start as DateOnly);
}

export function selectedGridStartDate(value: unknown): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? dateOnlyFromLocalDate(value)
    : null;
}

export function createGridStartDateCommand(
  task: ProjectTaskDto,
  selectedDate: string,
): ProjectTaskUpdateCommand | null {
  if (task.type === "summary" || task.start === null || selectedDate === (task.requestedStart ?? task.start)) return null;
  return { taskId: task.taskId, payload: { start: selectedDate } };
}
