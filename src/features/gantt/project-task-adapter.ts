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
  localDateFromDateOnly,
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
  readonly scheduleMode?: "auto" | "manual";
  readonly baselineStart?: string | null;
  readonly baselineDuration?: number | null;
  readonly baselineEnd?: string | null;
}

export interface ProjectTaskUpdateCommand {
  readonly taskId: string;
  readonly payload: ProjectTaskUpdatePayload;
}

export type ProjectTaskCreateCommand = {
  readonly name: string;
  readonly type: "task";
  readonly start: string;
  readonly duration: number;
  readonly progress: 0;
  readonly parentTaskId?: string;
  readonly convertParentToSummary?: true;
} | {
  readonly name: string;
  readonly type: "summary";
  readonly parentTaskId?: string;
  readonly convertParentToSummary?: true;
};

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
  // Core cannot parse a date-less native summary. Its public custom type and
  // zero-length renderer coordinates preserve a row without drawing a bar.
  // This anchor is NEVER a domain schedule; all display/commands use the DTO.
  const datedLeafStarts = tasks.flatMap((task) => task.type !== "summary" && task.start !== null ? [task.start] : []).sort();
  const anchor = datedLeafStarts[0] ? localDateFromDateOnly(dateOnly(datedLeafStarts[0])) : new Date();
  anchor.setHours(0, 0, 0, 0);
  return tasks.map((task) => {
    const dates = task.start !== null && task.end !== null
      ? domainDatesToSvarDates({ start: dateOnly(task.start), end: dateOnly(task.end) })
      : { start: new Date(anchor), end: new Date(anchor), duration: 0 };

    return {
      id: task.taskId,
      text: task.name,
      ...dates,
      ...(task.progress !== null ? { progress: task.progress } : {}),
      type: task.type === "summary" && task.start === null ? "summary-container" : task.type,
      parent: task.parentExternalId === null
        ? 0
        : taskIdsByExternalId.get(task.parentExternalId) ?? 0,
      open: task.type === "summary" && tasks.some((candidate) => candidate.parentExternalId === task.externalId),
      externalId: task.externalId,
      baselineStart: task.baselineStart,
      baselineDuration: task.baselineDuration,
      baselineEnd: task.baselineEnd,
    };
  });
}

function toSvarLinkType(type: string): "s2s" | "s2e" | "e2s" | "e2e" {
  switch (type) {
    case "FS": return "e2s";
    case "SS": return "s2s";
    case "FF": return "e2e";
    case "SF": return "s2e";
    default: return "e2s";
  }
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
      : [{ id: link.id, source, target, type: toSvarLinkType(link.type) }];
  });
}

export function workingCalendarFromProjectCalendar(calendar: ProjectCalendarDto) {
  return calendar.exceptions
    ? createWorkingCalendar({ timezone: calendar.timezone, weekendDays: calendar.weekendDays, exceptions: calendar.exceptions })
    : createWorkingCalendar({ timezone: calendar.timezone, weekendDays: calendar.weekendDays, holidays: calendar.holidays });
}
function durationFromRange(start: string, end: string, calendar: ProjectCalendarDto): number {
  return workingDaysBetween(start, end, workingCalendarFromProjectCalendar(calendar));
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
    if (task.start === null || task.end === null) return payload.name &&
      local.changes.start === undefined && local.changes.end === undefined &&
      local.changes.progress === undefined && local.changes.parent === undefined &&
      (local.diff === undefined || local.diff === 0)
      ? { taskId: task.taskId, payload: { name: payload.name } } : null;
    const startChanged = local.changes.start instanceof Date && dateOnlyFromLocalDate(local.changes.start) !== task.start;
    const endChanged = local.changes.end instanceof Date && dateFromSvarExclusiveEnd(local.changes.end) !== task.end;
    return payload.name && !startChanged && !endChanged && local.changes.parent === undefined &&
      (local.changes.progress === undefined || local.changes.progress === task.progress) &&
      (local.diff === undefined || local.diff === 0)
      ? { taskId: task.taskId, payload: { name: payload.name } }
      : null;
  }
  if (task.start === null || task.end === null) return null;
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
