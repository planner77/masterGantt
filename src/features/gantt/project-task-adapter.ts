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

/** Matches the Task Editor and server task-name boundary. */
export function normalizeInlineTaskName(value: unknown): { name: string | null; error: string | null } {
  if (typeof value !== "string" && typeof value !== "number") {
    return { name: null, error: "작업명은 올바른 문자로 1~200자까지 입력해 주세요." };
  }
  // The installed Core coerces a numeric-looking Grid text value to number.
  const name = String(value).trim();
  const characters = Array.from(name);
  const invalid = characters.length < 1 || characters.length > 200 || characters.some((character) => {
    const code = character.charCodeAt(0);
    return character.length === 1 && code >= 0xd800 && code <= 0xdfff;
  });
  return invalid
    ? { name: null, error: "작업명은 올바른 문자로 1~200자까지 입력해 주세요." }
    : { name, error: null };
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
  if (typeof local.taskId !== "string" || local.taskId !== task.taskId) return null;
  const payload: { name?: string; progress?: number; start?: string; duration?: number } = {};
  const normalizedName = normalizeInlineTaskName(local.changes.text);
  if (normalizedName.name !== null && normalizedName.name !== task.name) payload.name = normalizedName.name;
  if (task.type === "summary") {
    const startChanged = local.changes.start instanceof Date && dateOnlyFromLocalDate(local.changes.start) !== task.start;
    const endChanged = local.changes.end instanceof Date && dateFromSvarExclusiveEnd(local.changes.end) !== task.end;
    return payload.name && !startChanged && !endChanged && local.changes.parent === undefined &&
      (local.changes.progress === undefined || local.changes.progress === task.progress) &&
      (local.diff === undefined || local.diff === 0)
      ? { taskId: task.taskId, payload: { name: payload.name } }
      : null;
  }
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
