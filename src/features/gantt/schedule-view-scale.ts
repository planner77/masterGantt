import type { ProjectCalendarDto } from "../../contracts/projects";
import { formatGanttDayOfMonth } from "../../lib/gantt-scale-format";
import { formatIsoWeek } from "../../lib/iso-week";
import { LOCALE_FORMATS, type AppLocale } from "../../lib/i18n/locales";
import { buildGanttDayHeaderTooltipDataForDateOnly } from "./day-header-tooltip";
import { localDateFromDateOnly, type DateOnly } from "./date-adapter";
import { weekCalendarInterval } from "./week-calendar-interval";
import { weekTimelineTooltip } from "./week-timeline-tooltip";

const DAY = 86_400_000;
export const scheduleDateOrdinal = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
export const scheduleDateAtOrdinal = (ordinal: number) => new Date(ordinal * DAY).toISOString().slice(0, 10) as DateOnly;
export type ScheduleScaleCell = { key: string; date: DateOnly; left: number; width: number; label: string; tooltip: string; nonWorking: boolean };

/** Calendar labels share WBS formatters; ordinal arithmetic never adds elapsed
 * local milliseconds, so DST cannot shift a bar or a scale boundary. */
export function scheduleScaleCells(input: {
  start: number; width: number; cellWidth: number; first: number; last: number;
  mode: "day" | "week"; locale: AppLocale; calendar: ProjectCalendarDto;
}): { upper: ScheduleScaleCell[]; lower: ScheduleScaleCell[] } {
  const { start, width, cellWidth, first, last, mode, locale, calendar } = input;
  const lower: ScheduleScaleCell[] = [];
  const upper: ScheduleScaleCell[] = [];
  const formats = LOCALE_FORMATS[locale];
  for (let index = first; index < last; index++) {
    const date = scheduleDateAtOrdinal(start + index * (mode === "day" ? 1 : 7));
    const local = localDateFromDateOnly(date);
    const exception = calendar.exceptions?.find(item => item.date === date);
    const nonWorking = exception ? exception.dayType === "NON_WORKING" : calendar.weekendDays.includes(local.getDay() as 6 | 0) || calendar.holidays.some(item => item.date === date);
    const cell = { key: date, date, left: index * cellWidth, width: Math.min(cellWidth, width - index * cellWidth), nonWorking };
    if (mode === "week") {
      const interval = weekCalendarInterval(local, locale);
      const tooltip = weekTimelineTooltip(date, calendar, locale).ariaLabel;
      lower.push({ ...cell, label: formatIsoWeek(local), tooltip, nonWorking: false });
      upper.push({ ...cell, label: interval.label, tooltip: interval.description, nonWorking: false });
    } else {
      lower.push({ ...cell, label: formatGanttDayOfMonth(local), tooltip: buildGanttDayHeaderTooltipDataForDateOnly(date, calendar, formats).ariaLabel });
      const monthStart = scheduleDateOrdinal(`${date.slice(0, 7)}-01`);
      if (upper.at(-1)?.key === date.slice(0, 7)) continue;
      const nextMonth = new Date(Date.UTC(local.getFullYear(), local.getMonth() + 1, 1));
      const monthEnd = nextMonth.getTime() / DAY;
      const left = Math.max(0, monthStart - start) * cellWidth;
      const label = new Intl.DateTimeFormat(formats, { year: "numeric", month: "long" }).format(local);
      upper.push({ key: date.slice(0, 7), date, left, width: Math.min(width, (monthEnd - start) * cellWidth) - left, label, tooltip: label, nonWorking: false });
    }
  }
  return { upper, lower };
}
