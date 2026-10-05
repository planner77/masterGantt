import { describe, expect, it } from "vitest";

import type { ProjectCalendarDto } from "../../src/contracts/projects";
import {
  buildGanttDayHeaderTooltipDataForDateOnly,
  dateOnlyFromGanttDayScaleClassName,
  formatDateOnlyWeekday,
  ganttDayScaleClassName,
  projectHolidayNamesForDate,
} from "../../src/features/gantt/day-header-tooltip";

const calendar: ProjectCalendarDto = {
  timezone: "Asia/Seoul",
  weekendDays: [6, 0],
  holidays: [],
  exceptions: [
    {
      date: "2026-12-25",
      dayType: "NON_WORKING",
      name: "기독탄신일",
      names: ["회사 휴무", "기독탄신일", "기독탄신일"],
    },
    {
      date: "2026-12-26",
      dayType: "NON_WORKING",
      name: "주말 명명 휴일",
      names: ["주말 명명 휴일"],
    },
    {
      date: "2026-12-27",
      dayType: "WORKING",
      name: "일요일 근무 전환",
      names: ["일요일 근무 전환"],
    },
  ],
};

describe("Issue #315 Gantt day header tooltip", () => {
  it("round-trips a date through the public scale css class without UTC parsing", () => {
    const className = ganttDayScaleClassName(new Date(2026, 11, 25));
    expect(className).toContain("project-gantt-day-scale");
    expect(dateOnlyFromGanttDayScaleClassName(className)).toBe("2026-12-25");
  });

  it("formats date-only weekdays deterministically for the requested locale", () => {
    expect(formatDateOnlyWeekday("2026-12-24", "ko-KR")).toBe("목요일");
    expect(formatDateOnlyWeekday("2026-12-25", "ko-KR")).toBe("금요일");
    expect(formatDateOnlyWeekday("2026-12-26", "ko-KR")).toBe("토요일");
    expect(formatDateOnlyWeekday("2026-12-27", "ko-KR")).toBe("일요일");
  });

  it("shows deduplicated deterministic names only for NON_WORKING exceptions", () => {
    expect(projectHolidayNamesForDate(calendar, "2026-12-25")).toEqual(["기독탄신일", "회사 휴무"]);
    expect(projectHolidayNamesForDate(calendar, "2026-12-26")).toEqual(["주말 명명 휴일"]);
    expect(projectHolidayNamesForDate(calendar, "2026-12-27")).toEqual([]);
    expect(projectHolidayNamesForDate(calendar, "2026-12-28")).toEqual([]);
  });

  it("builds weekday + holiday tooltip data without treating an ordinary weekend as a named holiday", () => {
    expect(buildGanttDayHeaderTooltipDataForDateOnly("2026-12-25", calendar, "ko-KR")).toMatchObject({
      date: "2026-12-25",
      weekday: "금요일",
      holidayNames: ["기독탄신일", "회사 휴무"],
    });
    expect(buildGanttDayHeaderTooltipDataForDateOnly("2026-12-26", {
      ...calendar,
      exceptions: [],
    }, "ko-KR")).toMatchObject({
      weekday: "토요일",
      holidayNames: [],
    });
  });

  it("keeps legacy holidays compatible when exceptions are absent", () => {
    const legacy: ProjectCalendarDto = {
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: [
        { date: "2026-12-25", name: "Christmas" },
        { date: "2026-12-25", name: "Christmas" },
        { date: "2026-12-25", name: "Company holiday" },
      ],
    };
    expect(projectHolidayNamesForDate(legacy, "2026-12-25")).toEqual(["Christmas", "Company holiday"]);
  });
});
