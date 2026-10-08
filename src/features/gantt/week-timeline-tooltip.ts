import type { ProjectCalendarDto } from "../../contracts/projects";
import { localDateFromDateOnly, type DateOnly } from "./date-adapter";
import { weekCalendarInterval } from "./week-calendar-interval";
import { buildGanttWeekHeaderTooltipDataForDateOnly, type GanttWeekHeaderTooltipData } from "./week-header-tooltip";

export type WeekTimelineTooltipData = Omit<GanttWeekHeaderTooltipData, "workingDays"> & { readonly workingDays: number | null; readonly reason: string | null };

/** Display metadata may extend past the Calendar engine's supported dates.
 * Never report a partial week's working-day count as a complete one.
 */
export function weekTimelineTooltip(date: DateOnly, calendar: ProjectCalendarDto): WeekTimelineTooltipData {
  const interval = weekCalendarInterval(localDateFromDateOnly(date));
  if (interval.start < "1900-01-01" || interval.last > "2199-12-31") {
    const reason = "주 전체가 지원 Calendar 날짜 범위를 벗어나 근무일을 산정하지 않습니다.";
    return { start: interval.start, end: interval.last, workingDays: null, holidays: [], reason, ariaLabel: `${interval.description} · ${reason}` };
  }
  const data = buildGanttWeekHeaderTooltipDataForDateOnly(interval.start, calendar);
  return { ...data, reason: null, ariaLabel: `${data.ariaLabel} · ${interval.description}` };
}
