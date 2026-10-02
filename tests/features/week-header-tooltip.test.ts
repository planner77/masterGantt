import { describe, expect, it } from "vitest";

import type { ProjectCalendarDto } from "../../src/contracts/projects";
import {
  buildGanttWeekHeaderTooltipDataForDateOnly,
  dateOnlyFromGanttWeekScaleClassName,
  ganttWeekScaleClassName,
  isoWeekStartDateOnly,
} from "../../src/features/gantt/week-header-tooltip";

const baseCalendar: ProjectCalendarDto = {
  timezone: "Asia/Seoul",
  weekendDays: [6, 0],
  holidays: [],
  exceptions: [],
};

describe("Issue #316 Gantt week header tooltip", () => {
  it("normalizes SVAR's Sunday Week anchor to the ISO Monday class key", () => {
    expect(isoWeekStartDateOnly("2026-09-20")).toBe("2026-09-14");
    const className = ganttWeekScaleClassName(new Date(2026, 8, 20));
    expect(className).toContain("project-gantt-week-scale");
    expect(dateOnlyFromGanttWeekScaleClassName(className)).toBe("2026-09-14");
  });

  it("counts a normal Monday-Friday week", () => {
    expect(buildGanttWeekHeaderTooltipDataForDateOnly("2026-09-14", baseCalendar)).toMatchObject({
      start: "2026-09-14",
      end: "2026-09-20",
      workingDays: 5,
      holidays: [],
    });
  });

  it("applies named NON_WORKING exceptions and preserves all canonical names", () => {
    const calendar: ProjectCalendarDto = {
      ...baseCalendar,
      exceptions: [
        { date: "2026-09-15", dayType: "NON_WORKING", name: "휴일 A", names: ["휴일 A", "회사 휴무"] },
        { date: "2026-09-17", dayType: "NON_WORKING", name: "휴일 B", names: ["휴일 B"] },
      ],
    };
    expect(buildGanttWeekHeaderTooltipDataForDateOnly("2026-09-14", calendar)).toMatchObject({
      workingDays: 3,
      holidays: [
        { date: "2026-09-15", names: ["회사 휴무", "휴일 A"] },
        { date: "2026-09-17", names: ["휴일 B"] },
      ],
    });
  });

  it("counts unnamed NON_WORKING dates without inventing a holiday label", () => {
    const calendar: ProjectCalendarDto = {
      ...baseCalendar,
      exceptions: [{ date: "2026-09-16", dayType: "NON_WORKING", name: null }],
    };
    const data = buildGanttWeekHeaderTooltipDataForDateOnly("2026-09-14", calendar);
    expect(data.workingDays).toBe(4);
    expect(data.holidays).toEqual([]);
  });

  it("lets a weekend WORKING override increase the actual working-day count", () => {
    const calendar: ProjectCalendarDto = {
      ...baseCalendar,
      exceptions: [{ date: "2026-09-19", dayType: "WORKING", name: "보충 근무", names: ["보충 근무"] }],
    };
    const data = buildGanttWeekHeaderTooltipDataForDateOnly("2026-09-14", calendar);
    expect(data.workingDays).toBe(6);
    expect(data.holidays).toEqual([]);
  });

  it("keeps legacy holidays compatible", () => {
    const calendar: ProjectCalendarDto = {
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: [{ date: "2026-09-15", name: "Legacy holiday" }],
    };
    expect(buildGanttWeekHeaderTooltipDataForDateOnly("2026-09-14", calendar)).toMatchObject({
      workingDays: 4,
      holidays: [{ date: "2026-09-15", names: ["Legacy holiday"] }],
    });
  });

  it("handles a W53 to W01 year boundary without changing the seven-day interval", () => {
    const calendar: ProjectCalendarDto = {
      ...baseCalendar,
      exceptions: [{ date: "2021-01-01", dayType: "NON_WORKING", name: "신정", names: ["신정"] }],
    };
    expect(buildGanttWeekHeaderTooltipDataForDateOnly("2020-12-28", calendar)).toMatchObject({
      start: "2020-12-28",
      end: "2021-01-03",
      workingDays: 4,
      holidays: [{ date: "2021-01-01", names: ["신정"] }],
    });
  });
});
