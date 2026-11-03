import { dateOnlyFromLocalDate, localDateFromDateOnly, type DateOnly } from "./date-adapter";
import { translate } from "../../lib/i18n";
import type { AppLocale } from "../../lib/i18n/locales";
import { formatIsoWeek } from "../../lib/iso-week";

// Presentation endpoints may cross the domain's 2199-12-31 limit. Calendar
// field operations describe the interval without widening mutation inputs.
function calendarShift(date: Date, days: number) {
  const shifted = new Date(date); shifted.setDate(shifted.getDate() + days); return shifted;
}

const month = (date: DateOnly) => date.slice(0, 7).replace("-", ".");

/** Gregorian months included in the half-open ISO calendar week. */
export function weekCalendarInterval(date: Date, locale: AppLocale = "ko") {
  const monday = calendarShift(date, -((date.getDay() + 6) % 7));
  const nextMonday = calendarShift(monday, 7);
  const start = dateOnlyFromLocalDate(monday);
  const end = dateOnlyFromLocalDate(nextMonday);
  const last = dateOnlyFromLocalDate(calendarShift(nextMonday, -1));
  const firstMonth = month(start), lastMonth = month(last);
  const label = firstMonth === lastMonth ? firstMonth : start.slice(0, 4) === last.slice(0, 4) ? `${firstMonth}→${lastMonth.slice(-2)}` : `${firstMonth}→${lastMonth}`;
  const isoYear = String(calendarShift(monday, 3).getFullYear());
  const description = translate(locale, "{start} 이상, {end} 미만 · 포함 월 {month} · ISO {isoYear}-{week}", { start, end, month: label, isoYear, week: formatIsoWeek(localDateFromDateOnly(start)) });
  return { start, end, last, label, description };
}

export function weekCalendarScaleClass(date: Date) {
  return `project-gantt-week-calendar-scale project-gantt-week-calendar-${weekCalendarInterval(date).start.replaceAll("-", "")}`;
}

export function weekCalendarIntervalFromClass(className: string, locale: AppLocale = "ko") {
  const match = /(?:^|\s)project-gantt-week-calendar-(\d{4})(\d{2})(\d{2})(?=\s|$)/.exec(className);
  if (!match) return null;
  try { return weekCalendarInterval(localDateFromDateOnly(`${match[1]}-${match[2]}-${match[3]}` as DateOnly), locale); }
  catch { return null; }
}

export function weekTimelineScaleClass(date: Date) {
  return `project-gantt-week-scale project-gantt-week-date-${weekCalendarInterval(date).start.replaceAll("-", "")}`;
}
