import { endFromStart, isWorkingDay, nextWorkingDay, validateTaskDuration, type WorkingCalendar } from "./calendar";
import { parseDateOnly, type DateOnly } from "./date-only";
import { SchedulingError } from "./errors";

export interface LeafScheduleInput {
  readonly type: "task" | "milestone";
  readonly requestedStart: string;
  readonly duration: number;
  readonly scheduleMode?: "auto" | "manual";
  /** Optional expected end, checked before any future dependency calculation. */
  readonly end?: string;
}

export interface CalendarShiftWarning {
  readonly code: "NON_WORKING_START_SHIFTED";
  readonly field: "requestedStart";
  readonly requestedStart: DateOnly;
  readonly start: DateOnly;
}

export interface LeafSchedule {
  readonly type: "task" | "milestone";
  readonly requestedStart: DateOnly;
  readonly start: DateOnly;
  readonly end: DateOnly;
  readonly duration: number;
  readonly scheduleMode: "auto" | "manual";
  readonly warnings: readonly CalendarShiftWarning[];
}

/** Calendar-only leaf calculation. Does not consume hierarchy or dependencies. */
export function scheduleLeaf(input: LeafScheduleInput, calendar: WorkingCalendar): LeafSchedule {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SchedulingError("INVALID_LEAF_INPUT", { field: "input" });
  }
  const requestedStart = parseDateOnly(input.requestedStart, "requestedStart");
  const expectedEnd = input.end === undefined ? undefined : parseDateOnly(input.end, "end");
  if (input.type !== "task" && input.type !== "milestone") throw new SchedulingError("INVALID_TASK_TYPE", { field: "type" });
  const scheduleMode = input.scheduleMode === undefined ? "auto" : input.scheduleMode;
  if (scheduleMode !== "auto" && scheduleMode !== "manual") throw new SchedulingError("INVALID_SCHEDULE_MODE", { field: "scheduleMode" });
  if (input.type === "task") validateTaskDuration(input.duration);
  else if (input.duration !== 0) throw new SchedulingError("INVALID_DURATION", { field: "duration" });

  const workingStart = isWorkingDay(requestedStart, calendar);
  if (!workingStart && scheduleMode === "manual") {
    throw new SchedulingError("NON_WORKING_MANUAL_START", { field: "requestedStart", date: requestedStart });
  }
  let start = requestedStart;
  if (!workingStart) {
    try {
      start = nextWorkingDay(requestedStart, calendar);
    } catch (error) {
      if (error instanceof SchedulingError && error.code === "NO_WORKING_DAY") {
        throw new SchedulingError("NO_WORKING_DAY", { field: "requestedStart", date: requestedStart });
      }
      throw error;
    }
  }
  const end = input.type === "milestone" ? start : endFromStart(start, input.duration, calendar);
  if (expectedEnd !== undefined && expectedEnd !== end) {
    throw new SchedulingError("END_DURATION_MISMATCH", { field: "end", date: expectedEnd, expectedDate: end });
  }
  const warnings: readonly CalendarShiftWarning[] = Object.freeze(workingStart ? [] : [Object.freeze({
    code: "NON_WORKING_START_SHIFTED" as const,
    field: "requestedStart" as const,
    requestedStart,
    start,
  })]);
  return Object.freeze({ type: input.type, requestedStart, start, end, duration: input.duration, scheduleMode, warnings });
}
