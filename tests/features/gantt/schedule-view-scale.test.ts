import { describe, expect, it } from "vitest";
import type { ProjectCalendarDto } from "../../../src/contracts/projects";
import { scheduleScaleCells, scheduleDateOrdinal } from "../../../src/features/gantt/schedule-view-scale";
import { weekTimelineTooltip } from "../../../src/features/gantt/week-timeline-tooltip";

const calendar: ProjectCalendarDto = { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [], exceptions: [
  { date: "2026-03-09", dayType: "NON_WORKING", name: "원본 휴일" },
  { date: "2026-03-08", dayType: "WORKING", name: "원본 근무일" },
] };
const day = (start: string, locale: "ko" | "en" | "vi" = "ko", count = 4) => scheduleScaleCells({
  start: scheduleDateOrdinal(start), width: count * 36, cellWidth: 36, first: 0, last: count, mode: "day", locale, calendar,
});

describe("projected View shares native calendar scale semantics", () => {
  it.each(["ko", "en", "vi"] as const)("%s Day uses month spans and unpadded day labels", locale => {
    const cells = day("2026-01-30", locale);
    expect(cells.lower.map(cell => cell.label)).toEqual(["30", "31", "1", "2"]);
    expect(cells.upper.map(cell => [cell.left, cell.width])).toEqual([[0, 72], [72, 72]]);
    expect(cells.upper[0].label).toBe(new Intl.DateTimeFormat({ ko: "ko-KR", en: "en-US", vi: "vi-VN" }[locale], { year: "numeric", month: "long" }).format(new Date(2026, 0, 30)));
  });
  it("DST date boundaries remain exactly one date and 36 pixels apart", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      expect(day("2026-03-07").lower.map(cell => [cell.date, cell.left])).toEqual([
        ["2026-03-07", 0], ["2026-03-08", 36], ["2026-03-09", 72], ["2026-03-10", 108],
      ]);
    } finally { process.env.TZ = original; }
  });
  it("effective working exception overrides a weekend, holiday tooltip keeps original name", () => {
    const cells = day("2026-03-07").lower;
    expect(cells.map(cell => cell.nonWorking)).toEqual([true, false, true, false]);
    expect(cells[2].tooltip).toContain("원본 휴일");
  });
  it.each(["ko", "en", "vi"] as const)("%s Week uses same ISO-year/month boundary and full working-day tooltip", locale => {
    const cells = scheduleScaleCells({ start: scheduleDateOrdinal("2026-12-28"), width: 136, cellWidth: 68,
      first: 0, last: 2, mode: "week", locale, calendar });
    expect(cells.lower.map(cell => cell.label)).toEqual(["W53", "W01"]);
    expect(cells.upper.map(cell => cell.label)).toEqual(["2026.12→2027.01", "2027.01"]);
    expect(cells.lower[0].tooltip).toBe(weekTimelineTooltip("2026-12-28", calendar, locale).ariaLabel);
    expect(cells.lower[0].tooltip).toContain("ISO 2026-W53");
  });
  it("virtualized month labels retain complete native span rather than shifting to visible ticks", () => {
    const cells = scheduleScaleCells({ start: scheduleDateOrdinal("2026-01-01"), width: 90 * 36,
      cellWidth: 36, first: 35, last: 40, mode: "day", locale: "en", calendar });
    expect(cells.upper).toHaveLength(1);
    expect(cells.upper[0]).toMatchObject({ left: 31 * 36, width: 28 * 36, label: "February 2026" });
  });
});
