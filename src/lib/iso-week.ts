/**
 * Return the ISO 8601 week number for a local calendar date.
 *
 * SVAR scale dates are browser-local Date values. We intentionally read only
 * their local calendar components, then perform the ISO calculation in UTC so
 * DST and runtime timezone offsets cannot shift the result.
 */
export function getIsoWeek(date: Date): number {
  const calendarDate = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ));

  // ISO weekday: Monday=1 ... Sunday=7. Move to the Thursday belonging to
  // this ISO week; the Thursday's calendar year is the ISO week-year.
  const isoWeekday = calendarDate.getUTCDay() || 7;
  calendarDate.setUTCDate(calendarDate.getUTCDate() + 4 - isoWeekday);

  const isoYearStart = new Date(Date.UTC(calendarDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((calendarDate.getTime() - isoYearStart.getTime()) / 86_400_000) + 1) / 7);
}

/** Format an ISO 8601 week label with the canonical two-digit week component. */
export function formatIsoWeek(date: Date): string {
  return `W${String(getIsoWeek(date)).padStart(2, "0")}`;
}
