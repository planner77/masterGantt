import { SchedulingError } from "./errors";

declare const dateOnlyBrand: unique symbol;
export type DateOnly = string & { readonly [dateOnlyBrand]: true };

export const MIN_SUPPORTED_DATE = "1900-01-01";
export const MAX_SUPPORTED_DATE = "2199-12-31";

function daysBeforeYear(year: number): number {
  const previous = year - 1;
  return 365 * previous + Math.floor(previous / 4) - Math.floor(previous / 100) + Math.floor(previous / 400);
}

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return leapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export const MIN_DAY_ORDINAL = daysBeforeYear(1900);
export const MAX_DAY_ORDINAL = daysBeforeYear(2200) - 1;
/** Absolute bound on every date traversal, including calendars with no workdays. */
export const MAX_CALENDAR_SPAN_DAYS = MAX_DAY_ORDINAL - MIN_DAY_ORDINAL + 1;

export function parseDateOnly(value: unknown, field = "date"): DateOnly {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SchedulingError("INVALID_DATE", { field });
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new SchedulingError("INVALID_DATE", { field, date: value });
  }
  if (value < MIN_SUPPORTED_DATE || value > MAX_SUPPORTED_DATE) {
    throw new SchedulingError("DATE_OUT_OF_RANGE", { field, date: value });
  }
  return value as DateOnly;
}

/** Gregorian day ordinal; 0001-01-01 is day zero (a Monday). No instant/timezone. */
export function dateToOrdinal(value: string): number {
  const date = parseDateOnly(value);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  let result = daysBeforeYear(year) + Number(date.slice(8, 10)) - 1;
  for (let current = 1; current < month; current += 1) result += daysInMonth(year, current);
  return result;
}

export function ordinalToDate(ordinal: number): DateOnly {
  if (!Number.isSafeInteger(ordinal) || ordinal < MIN_DAY_ORDINAL || ordinal > MAX_DAY_ORDINAL) {
    throw new SchedulingError("DATE_OUT_OF_RANGE", { field: "ordinal" });
  }
  // A bounded 300-year binary search avoids leap-century assumptions in the inverse.
  let low = 1900;
  let high = 2199;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (daysBeforeYear(middle) <= ordinal) low = middle;
    else high = middle - 1;
  }
  const year = low;
  let remaining = ordinal - daysBeforeYear(year);
  let month = 1;
  while (remaining >= daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(remaining + 1).padStart(2, "0")}` as DateOnly;
}

export function addCalendarDays(date: string, days: number): DateOnly {
  const ordinal = dateToOrdinal(date);
  if (!Number.isSafeInteger(days)) throw new SchedulingError("INVALID_DAY_OFFSET", { field: "days" });
  return ordinalToDate(ordinal + days);
}

/** Sunday=0, Monday=1, ..., Saturday=6. */
export function dayOfWeek(date: string): number {
  return (dateToOrdinal(date) + 1) % 7;
}
