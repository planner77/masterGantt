import { describe, expect, it } from "vitest";
import {
  createWorkingCalendar,
  endFromStart,
  isWorkingDay,
  nextWorkingDay,
  workingDaysBetween,
} from "../../../src/domain/scheduling";

describe("working calendar date exceptions", () => {
  it("lets explicit WORKING dates override the weekend base rule", () => {
    const calendar = createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      exceptions: [
        { date: "2026-02-14", dayType: "WORKING", name: "중국 보충 근무일" },
        { date: "2026-02-16", dayType: "NON_WORKING", name: "춘절" },
      ],
    });

    expect(isWorkingDay("2026-02-14", calendar)).toBe(true);
    expect(isWorkingDay("2026-02-15", calendar)).toBe(false);
    expect(isWorkingDay("2026-02-16", calendar)).toBe(false);
    expect(nextWorkingDay("2026-02-13", calendar, false)).toBe("2026-02-14");
    expect(workingDaysBetween("2026-02-13", "2026-02-16", calendar)).toBe(2);
    expect(endFromStart("2026-02-13", 2, calendar)).toBe("2026-02-14");
  });

  it("lets explicit NON_WORKING dates override a weekday", () => {
    const calendar = createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      exceptions: [{ date: "2026-05-01", dayType: "NON_WORKING" }],
    });
    expect(isWorkingDay("2026-05-01", calendar)).toBe(false);
  });

  it("normalizes legacy holidays to NON_WORKING exceptions", () => {
    const calendar = createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: [{ date: "2026-09-14", name: "기존 휴일" }],
    });
    expect(calendar.exceptions).toEqual([
      { date: "2026-09-14", dayType: "NON_WORKING", name: "기존 휴일" },
    ]);
    expect(calendar.holidays).toEqual([{ date: "2026-09-14", name: "기존 휴일" }]);
  });

  it("rejects conflicting exceptions instead of selecting one silently", () => {
    expect(() => createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      exceptions: [
        { date: "2026-02-14", dayType: "WORKING" },
        { date: "2026-02-14", dayType: "NON_WORKING" },
      ],
    })).toThrowError(expect.objectContaining({ code: "DUPLICATE_CALENDAR_EXCEPTION" }));
  });

  it("rejects a legacy holiday and explicit exception on the same date", () => {
    expect(() => createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: [{ date: "2026-01-01" }],
      exceptions: [{ date: "2026-01-01", dayType: "WORKING" }],
    })).toThrowError(expect.objectContaining({ code: "DUPLICATE_CALENDAR_EXCEPTION" }));
  });
});
