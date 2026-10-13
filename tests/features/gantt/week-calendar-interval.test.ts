import { describe, expect, it } from "vitest";
import type { ProjectCalendarDto } from "../../../src/contracts/projects";
import { weekTimelineTooltip } from "../../../src/features/gantt/week-timeline-tooltip";
import { buildGanttWeekHeaderTooltipDataForDateOnly } from "../../../src/features/gantt/week-header-tooltip";
import { weekCalendarInterval, weekCalendarScaleClass, weekCalendarIntervalFromClass } from "../../../src/features/gantt/week-calendar-interval";

describe("Gregorian months in ISO week calendar intervals", () => {
  it.each([
    [2024, 1, 29, "2024-02-26", "2024-03-04", "2024.02→03", "2024-W09"],
    [2026, 0, 31, "2026-01-26", "2026-02-02", "2026.01→02", "2026-W05"],
    [2026, 2, 10, "2026-03-09", "2026-03-16", "2026.03", "2026-W11"],
    [2027, 0, 1, "2026-12-28", "2027-01-04", "2026.12→2027.01", "2026-W53"],
    [1900, 0, 1, "1900-01-01", "1900-01-08", "1900.01", "1900-W01"],
    [2199, 11, 31, "2199-12-30", "2200-01-06", "2199.12→2200.01", "2200-W01"],
    [2027, 1, 1, "2027-02-01", "2027-02-08", "2027.02", "2027-W05"],
  ])("%i/%i/%i preserves half-open month/year span", (y, m, d, start, end, label, iso) => {
    const date = new Date(y, m, d), before = date.getTime(), interval = weekCalendarInterval(date);
    expect(interval).toMatchObject({ start, end, label }); expect(interval.description).toContain(`ISO ${iso}`);
    expect(weekCalendarIntervalFromClass(weekCalendarScaleClass(date))).toEqual(interval);
    expect(date.getTime()).toBe(before);
  });
  it.each(["project-gantt-week-calendar-20260230", "project-gantt-week-calendar-21990229", "unrelated"])('invalid Gregorian class %s fails closed', value => {
    expect(weekCalendarIntervalFromClass(value)).toBeNull();
  });
  it("upper-bound presentation retains full metadata and reports working days as uncalculated", () => {
    const calendar: ProjectCalendarDto = { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [], exceptions: [] };
    expect(() => buildGanttWeekHeaderTooltipDataForDateOnly("2199-12-30", calendar)).toThrow();
    expect(weekTimelineTooltip("2199-12-31", calendar)).toMatchObject({ start: "2199-12-30", end: "2200-01-05", workingDays: null, holidays: [] });
    expect(weekTimelineTooltip("2199-12-31", calendar).ariaLabel).toContain("ISO 2200-W01");
    expect(weekTimelineTooltip("2199-12-31", calendar).reason).toContain("주 전체");
  });
});
