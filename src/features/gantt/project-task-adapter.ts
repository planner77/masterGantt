import type { ILink, ITask } from "@svar-ui/react-gantt";

import type {
  ProjectCalendarDto,
  ProjectLinkDto,
  ProjectTaskDto,
} from "../../contracts/projects";
import {
  addCalendarDays,
  createWorkingCalendar,
  workingDaysBetween,
} from "../../domain/scheduling";

import type { LocalTaskUpdateCommand } from "./command-gateway";
import {
  dateOnlyFromLocalDate,
  domainDatesToSvarDates,
  type DateOnly,
} from "./date-adapter";

function dateOnly(value: string): DateOnly {
  return value as DateOnly;
}

export interface ProjectTaskUpdatePayload {
  readonly name?: string;
  readonly description?: string | null;
  readonly url?: string | null;
  readonly progress?: number;
  readonly start?: string;
  readonly duration?: number;
}

export interface ProjectTaskUpdateCommand {
  readonly taskId: string;
  readonly payload: ProjectTaskUpdatePayload;
}

export interface ProjectTaskCreateCommand {
  readonly name: string;
  readonly type: "task";
  readonly start: string;
  readonly duration: number;
  readonly progress: 0;
  readonly parentTaskId?: string;
  readonly convertParentToSummary?: true;
}

export function projectTasksToSvarTasks(tasks: readonly ProjectTaskDto[]): ITask[] {
  const taskIdsByExternalId = new Map(tasks.map((task) => [task.externalId, task.taskId]));
  return tasks.map((task) => ({
    id: task.taskId,
    text: task.name,
    ...domainDatesToSvarDates({ start: dateOnly(task.start), end: dateOnly(task.end) }),
    progress: task.progress,
    type: task.type,
    parent: task.parentExternalId === null
      ? 0
      : taskIdsByExternalId.get(task.parentExternalId) ?? 0,
    open: task.type === "summary",
    externalId: task.externalId,
  }));
}

export function projectLinksToSvarLinks(
  links: readonly ProjectLinkDto[],
  tasks: readonly ProjectTaskDto[],
): ILink[] {
  const taskIdsByExternalId = new Map(tasks.map((task) => [task.externalId, task.taskId]));
  return links.flatMap((link) => {
    const source = taskIdsByExternalId.get(link.predecessorExternalId);
    const target = taskIdsByExternalId.get(link.successorExternalId);
    return source === undefined || target === undefined
      ? []
      : [{ id: link.id, source, target, type: "e2s" }];
  });
}

function calendarFromDto(calendar: ProjectCalendarDto) {
  return calendar.exceptions
    ? createWorkingCalendar({ timezone: calendar.timezone, weekendDays: calendar.weekendDays, exceptions: calendar.exceptions })
    : createWorkingCalendar({ timezone: calendar.timezone, weekendDays: calendar.weekendDays, holidays: calendar.holidays });
}
function durationFromRange(start: string, end: string, calendar: ProjectCalendarDto): number {
  return workingDaysBetween(start, end, calendarFromDto(calendar));
}
function dateFromSvarExclusiveEnd(value: Date): string {
  return addCalendarDays(dateOnlyFromLocalDate(value), -1);
}

export function translateProjectTaskUpdate(
  local: LocalTaskUpdateCommand,
  task: ProjectTaskDto,
  calendar: ProjectCalendarDto,
): ProjectTaskUpdateCommand | null {
  if (typeof local.taskId !== "string" || local.taskId !== task.taskId || task.type === "summary") return null;
  const payload: { name?: string; progress?: number; start?: string; duration?: number } = {};
  if (typeof local.changes.text === "string" && local.changes.text !== task.name) payload.name = local.changes.text;
  if (typeof local.changes.progress === "number" && local.changes.progress !== task.progress) payload.progress = local.changes.progress;
  const { start: changedStart, end: changedEnd } = local.changes;
  const nextStart = changedStart instanceof Date ? dateOnlyFromLocalDate(changedStart) : undefined;
  const nextEnd = changedEnd instanceof Date ? dateFromSvarExclusiveEnd(changedEnd) : undefined;
  const startChanged = nextStart !== undefined && nextStart !== task.start;
  const endChanged = nextEnd !== undefined && nextEnd !== task.end;
  if (task.type === "milestone") {
    if (startChanged) payload.start = nextStart;
    return Object.keys(payload).length === 0 ? null : { taskId: task.taskId, payload };
  }
  if (typeof local.diff === "number") {
    if (startChanged && endChanged) payload.start = nextStart;
    else if (startChanged) { payload.start = nextStart; payload.duration = durationFromRange(nextStart, task.end, calendar); }
    else if (endChanged) payload.duration = durationFromRange(task.start, nextEnd, calendar);
  } else if (startChanged || endChanged) {
    const start = nextStart ?? task.start;
    const end = nextEnd ?? task.end;
    if (startChanged) payload.start = start;
    if (endChanged || startChanged) payload.duration = durationFromRange(start, end, calendar);
  }
  return Object.keys(payload).length === 0 ? null : { taskId: task.taskId, payload };
}
