import {
  dateToOrdinal,
  MAX_CALENDAR_SPAN_DAYS,
  MAX_DAY_ORDINAL,
  ordinalToDate,
  parseDateOnly,
  type DateOnly,
} from "./date-only";
import { SchedulingError } from "./errors";

export interface HolidayInput {
  readonly date: string;
  readonly name?: string | null;
}

export interface WorkingCalendarInput {
  readonly timezone: "Asia/Seoul";
  readonly weekendDays: readonly [6, 0];
  readonly holidays: readonly HolidayInput[];
}

const holidayOrdinals = Symbol("holidayOrdinals");
export interface WorkingCalendar {
  readonly timezone: "Asia/Seoul";
  readonly weekendDays: readonly [6, 0];
  readonly holidays: readonly Readonly<{ date: DateOnly; name?: string | null }>[];
  readonly [holidayOrdinals]: readonly number[];
}

export const MAX_TASK_DURATION = 10_000;
export const MAX_CALENDAR_HOLIDAYS = MAX_CALENDAR_SPAN_DAYS;

/** Validate once and copy/freeze; caller mutation cannot alter later calculations. */
export function createWorkingCalendar(input: WorkingCalendarInput): WorkingCalendar {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SchedulingError("INVALID_CALENDAR", { field: "calendar" });
  }
  if (input.timezone !== "Asia/Seoul") throw new SchedulingError("UNSUPPORTED_TIMEZONE", { field: "timezone" });
  if (!Array.isArray(input.weekendDays) || input.weekendDays.length !== 2 || input.weekendDays[0] !== 6 || input.weekendDays[1] !== 0) {
    throw new SchedulingError("UNSUPPORTED_WEEKEND", { field: "weekendDays" });
  }
  if (!Array.isArray(input.holidays)) throw new SchedulingError("INVALID_HOLIDAY", { field: "holidays" });
  if (input.holidays.length > MAX_CALENDAR_HOLIDAYS) throw new SchedulingError("HOLIDAY_LIMIT_EXCEEDED", { field: "holidays" });
  const seen = new Set<string>();
  const holidays: { date: DateOnly; name?: string | null }[] = [];
  for (let index = 0; index < input.holidays.length; index += 1) {
    const holiday = input.holidays[index];
    if (holiday === null || typeof holiday !== "object" || Array.isArray(holiday) || (holiday.name !== undefined && holiday.name !== null && typeof holiday.name !== "string")) {
      throw new SchedulingError("INVALID_HOLIDAY", { field: `holidays[${index}]`, index });
    }
    const date = parseDateOnly(holiday.date, `holidays[${index}].date`);
    if (seen.has(date)) throw new SchedulingError("DUPLICATE_HOLIDAY", { field: `holidays[${index}].date`, index, date });
    seen.add(date);
    holidays.push(Object.freeze(holiday.name === undefined ? { date } : { date, name: holiday.name }));
  }
  holidays.sort((left, right) => left.date < right.date ? -1 : left.date > right.date ? 1 : 0);
  return Object.freeze({
    timezone: "Asia/Seoul" as const,
    weekendDays: Object.freeze([6, 0] as const),
    holidays: Object.freeze(holidays),
    [holidayOrdinals]: Object.freeze(holidays.map((holiday) => dateToOrdinal(holiday.date))),
  });
}

function workingOrdinal(ordinal: number, calendar: WorkingCalendar): boolean {
  const weekday = (ordinal + 1) % 7;
  if (weekday === 0 || weekday === 6) return false;
  const holidays = calendar[holidayOrdinals];
  let low = 0;
  let high = holidays.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (holidays[middle] === ordinal) return false;
    if (holidays[middle] < ordinal) low = middle + 1;
    else high = middle - 1;
  }
  return true;
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
