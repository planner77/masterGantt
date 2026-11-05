import { translate } from "../../lib/i18n";
import type { AppLocale } from "../../lib/i18n/locales";
import type { ProjectCalendarDto } from "../../contracts/projects";
import {
  addCalendarDays,
  createWorkingCalendar,
  dayOfWeek,
  workingDaysBetween,
} from "../../domain/scheduling";

import { projectHolidayNamesForDate } from "./day-header-tooltip";
import { dateOnlyFromLocalDate, type DateOnly } from "./date-adapter";

const WEEK_SCALE_DATE_CLASS_PREFIX = "project-gantt-week-date-";
const WEEK_SCALE_DATE_CLASS_PATTERN = /(?:^|\s)project-gantt-week-date-(\d{4})(\d{2})(\d{2})(?=\s|$)/;

export interface GanttWeekHeaderHoliday {
  readonly date: DateOnly;
  readonly names: readonly string[];
}

export interface GanttWeekHeaderTooltipData {
  readonly start: DateOnly;
  readonly end: DateOnly;
  readonly workingDays: number;
  readonly holidays: readonly GanttWeekHeaderHoliday[];
  readonly ariaLabel: string;
}

export function isoWeekStartDateOnly(date: DateOnly): DateOnly {
  const weekday = dayOfWeek(date);
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(date, -daysSinceMonday) as DateOnly;
}

export function ganttWeekScaleClassName(date: Date): string {
  const start = isoWeekStartDateOnly(dateOnlyFromLocalDate(date));
  const key = start.replaceAll("-", "");
  return `project-gantt-week-scale ${WEEK_SCALE_DATE_CLASS_PREFIX}${key}`;
}

export function dateOnlyFromGanttWeekScaleClassName(className: string): DateOnly | null {
  const match = WEEK_SCALE_DATE_CLASS_PATTERN.exec(className);
  return match ? `${match[1]}-${match[2]}-${match[3]}` as DateOnly : null;
}

function workingCalendarFromProject(calendar: ProjectCalendarDto) {
  return calendar.exceptions
    ? createWorkingCalendar({
        timezone: calendar.timezone,
        weekendDays: calendar.weekendDays,
        exceptions: calendar.exceptions.map((exception) => ({
          date: exception.date,
          dayType: exception.dayType,
          name: exception.name,
        })),
      })
    : createWorkingCalendar({
        timezone: calendar.timezone,
        weekendDays: calendar.weekendDays,
        holidays: calendar.holidays,
      });
}

export function formatGanttWeekWorkingDaysLabel(workingDays: number, locale: AppLocale = "ko"): string {
  return translate(locale, "{count}일", { count: workingDays });
}

export function buildGanttWeekHeaderTooltipDataForDateOnly(
  start: DateOnly,
  calendar: ProjectCalendarDto,
  locale: AppLocale = "ko",
): GanttWeekHeaderTooltipData {
  const end = addCalendarDays(start, 6) as DateOnly;
  const workingDays = workingDaysBetween(start, end, workingCalendarFromProject(calendar));
  const holidays: GanttWeekHeaderHoliday[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addCalendarDays(start, offset) as DateOnly;
    const names = projectHolidayNamesForDate(calendar, date);
    if (names.length > 0) holidays.push({ date, names });
  }

  const holidayText = holidays
    .flatMap((holiday) => holiday.names.map((name) => `${holiday.date} ${name}`))
    .join(", ");

  return {
    start,
    end,
    workingDays,
    holidays,
    ariaLabel: holidayText
      ? translate(locale, "{start} ~ {end}, 근무일 {count}일, 공휴일 {holidays}", { start, end, count: workingDays, holidays: holidayText })
      : translate(locale, "{start} ~ {end}, 근무일 {count}일", { start, end, count: workingDays }),
  };
}

export function buildGanttWeekHeaderTooltipData(
  date: Date,
  calendar: ProjectCalendarDto,
  locale: AppLocale = "ko",
): GanttWeekHeaderTooltipData {
  return buildGanttWeekHeaderTooltipDataForDateOnly(
    isoWeekStartDateOnly(dateOnlyFromLocalDate(date)),
    calendar,
    locale,
  );
}
