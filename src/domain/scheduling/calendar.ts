import {
  dateToOrdinal,
  MAX_CALENDAR_SPAN_DAYS,
  MAX_DAY_ORDINAL,
  ordinalToDate,
  parseDateOnly,
  type DateOnly,
} from "./date-only";
import { SchedulingError } from "./errors";

export type CalendarDayType = "NON_WORKING" | "WORKING";

export interface HolidayInput {
  readonly date: string;
  readonly name?: string | null;
}

export interface CalendarDayExceptionInput {
  readonly date: string;
  readonly dayType: CalendarDayType;
  readonly name?: string | null;
}

export interface WorkingCalendarInput {
  readonly timezone: "Asia/Seoul";
  readonly weekendDays: readonly [6, 0];
  /** Legacy compatibility. Holidays are normalized to NON_WORKING exceptions. */
  readonly holidays?: readonly HolidayInput[];
  /** Explicit date exception has precedence over the base weekly rule. */
  readonly exceptions?: readonly CalendarDayExceptionInput[];
}

const exceptionOrdinals = Symbol("exceptionOrdinals");
const exceptionTypes = Symbol("exceptionTypes");

export interface WorkingCalendar {
  readonly timezone: "Asia/Seoul";
  readonly weekendDays: readonly [6, 0];
  /** Backward-compatible projection of all NON_WORKING exceptions. */
  readonly holidays: readonly Readonly<{ date: DateOnly; name?: string | null }>[];
  readonly exceptions: readonly Readonly<{ date: DateOnly; dayType: CalendarDayType; name?: string | null }>[];
  readonly [exceptionOrdinals]: readonly number[];
  readonly [exceptionTypes]: readonly CalendarDayType[];
}

export const MAX_TASK_DURATION = 10_000;
export const MAX_CALENDAR_HOLIDAYS = MAX_CALENDAR_SPAN_DAYS;
export const MAX_CALENDAR_EXCEPTIONS = MAX_CALENDAR_SPAN_DAYS;

function validDayType(value: unknown): value is CalendarDayType {
  return value === "NON_WORKING" || value === "WORKING";
}

function normalizeName(
  value: unknown,
  field: string,
  code: "INVALID_HOLIDAY" | "INVALID_CALENDAR_EXCEPTION",
): string | null | undefined {
  if (value === undefined || value === null || typeof value === "string") return value as string | null | undefined;
  throw new SchedulingError(code, { field });
}

/** Validate once and copy/freeze; caller mutation cannot alter later calculations. */
export function createWorkingCalendar(input: WorkingCalendarInput): WorkingCalendar {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SchedulingError("INVALID_CALENDAR", { field: "calendar" });
  }
  if (input.timezone !== "Asia/Seoul") throw new SchedulingError("UNSUPPORTED_TIMEZONE", { field: "timezone" });
  if (!Array.isArray(input.weekendDays) || input.weekendDays.length !== 2 || input.weekendDays[0] !== 6 || input.weekendDays[1] !== 0) {
    throw new SchedulingError("UNSUPPORTED_WEEKEND", { field: "weekendDays" });
  }

  const legacyHolidays = input.holidays ?? [];
  const explicitExceptions = input.exceptions ?? [];
  if (!Array.isArray(legacyHolidays)) throw new SchedulingError("INVALID_HOLIDAY", { field: "holidays" });
  if (!Array.isArray(explicitExceptions)) throw new SchedulingError("INVALID_CALENDAR_EXCEPTION", { field: "exceptions" });
  if (legacyHolidays.length > MAX_CALENDAR_HOLIDAYS) throw new SchedulingError("HOLIDAY_LIMIT_EXCEEDED", { field: "holidays" });
  if (legacyHolidays.length + explicitExceptions.length > MAX_CALENDAR_EXCEPTIONS) {
    throw new SchedulingError("CALENDAR_EXCEPTION_LIMIT_EXCEEDED", { field: "exceptions" });
  }

  const seen = new Set<string>();
  const exceptions: { date: DateOnly; dayType: CalendarDayType; name?: string | null }[] = [];

  for (let index = 0; index < legacyHolidays.length; index += 1) {
    const holiday = legacyHolidays[index];
    if (holiday === null || typeof holiday !== "object" || Array.isArray(holiday)) {
      throw new SchedulingError("INVALID_HOLIDAY", { field: `holidays[${index}]`, index });
    }
    const name = normalizeName(holiday.name, `holidays[${index}].name`, "INVALID_HOLIDAY");
    const date = parseDateOnly(holiday.date, `holidays[${index}].date`);
    if (seen.has(date)) throw new SchedulingError("DUPLICATE_HOLIDAY", { field: `holidays[${index}].date`, index, date });
    seen.add(date);
    exceptions.push(Object.freeze(name === undefined ? { date, dayType: "NON_WORKING" as const } : { date, dayType: "NON_WORKING" as const, name }));
  }

  for (let index = 0; index < explicitExceptions.length; index += 1) {
    const exception = explicitExceptions[index];
    if (
      exception === null ||
      typeof exception !== "object" ||
      Array.isArray(exception) ||
      !validDayType(exception.dayType)
    ) {
      throw new SchedulingError("INVALID_CALENDAR_EXCEPTION", { field: `exceptions[${index}]`, index });
    }
    const name = normalizeName(exception.name, `exceptions[${index}].name`, "INVALID_CALENDAR_EXCEPTION");
    const date = parseDateOnly(exception.date, `exceptions[${index}].date`);
    if (seen.has(date)) {
      throw new SchedulingError("DUPLICATE_CALENDAR_EXCEPTION", { field: `exceptions[${index}].date`, index, date });
    }
    seen.add(date);
    exceptions.push(Object.freeze(name === undefined
      ? { date, dayType: exception.dayType }
      : { date, dayType: exception.dayType, name }));
  }

  exceptions.sort((left, right) => left.date < right.date ? -1 : left.date > right.date ? 1 : 0);
  const holidays = exceptions
    .filter((exception) => exception.dayType === "NON_WORKING")
    .map((exception) => Object.freeze(exception.name === undefined
      ? { date: exception.date }
      : { date: exception.date, name: exception.name }));

  return Object.freeze({
    timezone: "Asia/Seoul" as const,
    weekendDays: Object.freeze([6, 0] as const),
    holidays: Object.freeze(holidays),
    exceptions: Object.freeze(exceptions),
    [exceptionOrdinals]: Object.freeze(exceptions.map((exception) => dateToOrdinal(exception.date))),
    [exceptionTypes]: Object.freeze(exceptions.map((exception) => exception.dayType)),
  });
}

function workingOrdinal(ordinal: number, calendar: WorkingCalendar): boolean {
  const ordinals = calendar[exceptionOrdinals];
  let low = 0;
  let high = ordinals.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (ordinals[middle] === ordinal) return calendar[exceptionTypes][middle] === "WORKING";
    if (ordinals[middle] < ordinal) low = middle + 1;
    else high = middle - 1;
  }

  const weekday = (ordinal + 1) % 7;
  return weekday !== 0 && weekday !== 6;
}

export function isWorkingDay(date: string, calendar: WorkingCalendar): boolean {
  return workingOrdinal(dateToOrdinal(date), calendar);
}

export function nextWorkingDay(date: string, calendar: WorkingCalendar, inclusive = true): DateOnly {
  const start = dateToOrdinal(date) + (inclusive ? 0 : 1);
  for (let ordinal = start; ordinal <= MAX_DAY_ORDINAL; ordinal += 1) {
    if (workingOrdinal(ordinal, calendar)) return ordinalToDate(ordinal);
  }
  throw new SchedulingError("NO_WORKING_DAY", { field: "date", date });
}

/** Inclusive interval count, allowing non-working endpoints (and a zero count). */
export function workingDaysBetween(start: string, end: string, calendar: WorkingCalendar): number {
  const first = dateToOrdinal(start);
  const last = dateToOrdinal(end);
  if (first > last) throw new SchedulingError("INVALID_DATE_INTERVAL", { field: "end", date: end });
  let duration = 0;
  for (let ordinal = first; ordinal <= last; ordinal += 1) {
    if (workingOrdinal(ordinal, calendar)) duration += 1;
  }
  return duration;
}

export function validateTaskDuration(duration: number): void {
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_TASK_DURATION) {
    throw new SchedulingError("INVALID_DURATION", { field: "duration" });
  }
}

/** start must already be a workday; n=1 returns start itself. */
export function endFromStart(start: string, duration: number, calendar: WorkingCalendar): DateOnly {
  const first = dateToOrdinal(start);
  validateTaskDuration(duration);
  if (!workingOrdinal(first, calendar)) throw new SchedulingError("NON_WORKING_START", { field: "start", date: start });
  let remaining = duration;
  for (let ordinal = first; ordinal <= MAX_DAY_ORDINAL; ordinal += 1) {
    if (workingOrdinal(ordinal, calendar)) remaining -= 1;
    if (remaining === 0) return ordinalToDate(ordinal);
  }
  throw new SchedulingError("DATE_OUT_OF_RANGE", { field: "end" });
}
