import type { ProjectCalendarDto } from "@/contracts/projects";

import { dateOnlyFromLocalDate, type DateOnly } from "./date-adapter";

const DAY_SCALE_DATE_CLASS_PREFIX = "project-gantt-day-date-";
const DAY_SCALE_DATE_CLASS_PATTERN = /(?:^|\s)project-gantt-day-date-(\d{4})(\d{2})(\d{2})(?=\s|$)/;

export interface GanttDayHeaderTooltipData {
  readonly date: DateOnly;
  readonly weekday: string;
  readonly holidayNames: readonly string[];
  readonly ariaLabel: string;
}

function uniqueMeaningfulNames(values: readonly (string | null | undefined)[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const name = value?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export function ganttDayScaleClassName(date: Date): string {
  const key = dateOnlyFromLocalDate(date).replaceAll("-", "");
  return `project-gantt-day-scale ${DAY_SCALE_DATE_CLASS_PREFIX}${key}`;
}

export function dateOnlyFromGanttDayScaleClassName(className: string): DateOnly | null {
  const match = DAY_SCALE_DATE_CLASS_PATTERN.exec(className);
  return match ? `${match[1]}-${match[2]}-${match[3]}` as DateOnly : null;
}

export function formatDateOnlyWeekday(
  date: DateOnly,
  locales: Intl.LocalesArgument,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) return "";
  return new Intl.DateTimeFormat(locales, {
    weekday: "long",
    timeZone: "UTC",
  }).format(utc);
}

export function projectHolidayNamesForDate(
  calendar: ProjectCalendarDto,
  date: DateOnly,
): string[] {
  if (calendar.exceptions) {
    const exception = calendar.exceptions.find((entry) => entry.date === date);
    if (!exception || exception.dayType !== "NON_WORKING") return [];
    return uniqueMeaningfulNames([...(exception.names ?? []), exception.name]);
  }

  return uniqueMeaningfulNames(
    calendar.holidays.filter((holiday) => holiday.date === date).map((holiday) => holiday.name),
  );
}

export function buildGanttDayHeaderTooltipData(
  date: Date,
  calendar: ProjectCalendarDto,
  locales: Intl.LocalesArgument,
): GanttDayHeaderTooltipData {
  const dateOnly = dateOnlyFromLocalDate(date);
  const weekday = formatDateOnlyWeekday(dateOnly, locales);
  const holidayNames = projectHolidayNamesForDate(calendar, dateOnly);
  return {
    date: dateOnly,
    weekday,
    holidayNames,
    ariaLabel: [dateOnly, weekday, ...holidayNames].filter(Boolean).join(", "),
  };
}
