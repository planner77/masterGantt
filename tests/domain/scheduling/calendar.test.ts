import { describe, expect, it } from "vitest";
import {
  createWorkingCalendar, endFromStart, isWorkingDay, nextWorkingDay, workingDaysBetween,
  MAX_CALENDAR_HOLIDAYS, MAX_CALENDAR_SPAN_DAYS, MAX_DAY_ORDINAL, MAX_TASK_DURATION,
  MIN_DAY_ORDINAL, ordinalToDate, type WorkingCalendarInput,
} from "../../../src/domain/scheduling";

const base: WorkingCalendarInput = { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] };
const plain = createWorkingCalendar(base);
const holidayCalendar = createWorkingCalendar({ ...base, holidays: [
  { date: "2026-09-14", name: "조직 휴일" }, { date: "2026-09-15" }, { date: "2026-09-12" },
] });

describe("v1 immutable working calendar", () => {
  it("sorts holiday metadata and copies/freezes all exposed structures", () => {
    const input = { ...base, holidays: [{ date: "2026-09-15", name: "한글" }, { date: "2026-09-16", name: null }, { date: "2026-09-14" }] };
    const calendar = createWorkingCalendar(input);
    input.holidays[0].date = "2026-09-16";
    input.holidays[1].name = "변경";
    expect(calendar.holidays).toEqual([{ date: "2026-09-14" }, { date: "2026-09-15", name: "한글" }, { date: "2026-09-16", name: null }]);
    expect(Object.hasOwn(calendar.holidays[0], "name")).toBe(false);
    expect(Object.hasOwn(calendar.holidays[2], "name")).toBe(true);
    expect(calendar.weekendDays).toEqual([6, 0]);
    expect(isWorkingDay("2026-09-15", calendar)).toBe(false);
    expect(Object.isFrozen(calendar)).toBe(true);
    expect(Object.isFrozen(calendar.holidays)).toBe(true);
    expect(Object.isFrozen(calendar.holidays[0])).toBe(true);
    expect(Object.isFrozen(calendar.holidays[2])).toBe(true);
    expect(Object.isFrozen(calendar.weekendDays)).toBe(true);
  });

  it.each([null, undefined, [], "calendar"])("rejects invalid calendar shape %s", (input) => {
    expect(() => createWorkingCalendar(input as unknown as WorkingCalendarInput)).toThrowError(expect.objectContaining({ code: "INVALID_CALENDAR" }));
  });

  it.each(["UTC", "Asia/Tokyo", "", null])("rejects unsupported timezone %s", (timezone) => {
    expect(() => createWorkingCalendar({ ...base, timezone } as unknown as WorkingCalendarInput)).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_TIMEZONE" }));
  });

  it.each([[0, 6], [], [6], [6, 0, 6], [6, 6], [0, 1, 2, 3, 4, 5, 6], ["6", "0"], null])("rejects noncanonical weekend %s", (weekendDays) => {
    expect(() => createWorkingCalendar({ ...base, weekendDays } as unknown as WorkingCalendarInput)).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_WEEKEND" }));
  });

  it.each([null, "2026-09-14", [null], ["2026-09-14"], [{ date: "2026-09-14", name: 1 }], Array(1)])("rejects malformed holiday list %s", (holidays) => {
    expect(() => createWorkingCalendar({ ...base, holidays } as unknown as WorkingCalendarInput)).toThrowError(expect.objectContaining({ code: "INVALID_HOLIDAY" }));
  });

  it("rejects duplicates rather than silently losing row metadata", () => {
    expect(() => createWorkingCalendar({ ...base, holidays: [
      { date: "2026-09-14", name: "A" }, { date: "2026-09-14", name: "B" },
    ] })).toThrowError(expect.objectContaining({ code: "DUPLICATE_HOLIDAY", context: { field: "holidays[1].date", index: 1, date: "2026-09-14" } }));
    expect(() => createWorkingCalendar({ ...base, holidays: [{ date: "2026-02-30" }] })).toThrowError(expect.objectContaining({ code: "INVALID_DATE", context: { field: "holidays[0].date", date: "2026-02-30" } }));
  });

  it("bounds holiday input before traversal", () => {
    expect(MAX_CALENDAR_HOLIDAYS).toBe(MAX_CALENDAR_SPAN_DAYS);
    expect(() => createWorkingCalendar({ ...base, holidays: Array(MAX_CALENDAR_HOLIDAYS + 1) })).toThrowError(expect.objectContaining({ code: "HOLIDAY_LIMIT_EXCEEDED" }));
  });
});

describe("bounded inclusive workday arithmetic", () => {
  it.each([
    ["2026-09-11", true], ["2026-09-12", false], ["2026-09-13", false],
    ["2026-09-14", false], ["2026-09-15", false], ["2026-09-16", true],
  ] as const)("classifies %s using weekend/organization holidays", (date, expected) => {
    expect(isWorkingDay(date, holidayCalendar)).toBe(expected);
  });

  it("does not invent public holidays", () => {
    expect(isWorkingDay("2026-01-01", plain)).toBe(true);
    expect(isWorkingDay("2026-12-25", plain)).toBe(true);
  });

  it("distinguishes inclusive and exclusive next workday and skips consecutive holidays", () => {
    expect(nextWorkingDay("2026-09-11", holidayCalendar)).toBe("2026-09-11");
    expect(nextWorkingDay("2026-09-11", holidayCalendar, false)).toBe("2026-09-16");
    expect(nextWorkingDay("2026-09-12", holidayCalendar)).toBe("2026-09-16");
    expect(nextWorkingDay("2026-09-14", holidayCalendar, false)).toBe("2026-09-16");
  });

  it("counts inclusive intervals and weekend overlap exactly once", () => {
    expect(workingDaysBetween("2026-09-11", "2026-09-11", plain)).toBe(1);
    expect(workingDaysBetween("2026-09-12", "2026-09-13", plain)).toBe(0);
    expect(workingDaysBetween("2026-09-11", "2026-09-16", holidayCalendar)).toBe(2);
    expect(workingDaysBetween("2026-09-12", "2026-09-16", holidayCalendar)).toBe(1);
    expect(workingDaysBetween("2026-09-11", "2026-09-14", plain)).toBe(2);
    expect(() => workingDaysBetween("2026-09-14", "2026-09-11", plain)).toThrowError(expect.objectContaining({ code: "INVALID_DATE_INTERVAL" }));
  });

  it("crosses leap/month/year boundaries while counting the start as day one", () => {
    expect(endFromStart("2026-09-11", 1, plain)).toBe("2026-09-11");
    expect(endFromStart("2026-09-11", 2, plain)).toBe("2026-09-14");
    expect(endFromStart("2026-09-11", 2, holidayCalendar)).toBe("2026-09-16");
    expect(endFromStart("2028-02-28", 3, plain)).toBe("2028-03-01");
    expect(endFromStart("2026-12-31", 2, plain)).toBe("2027-01-01");
    expect(endFromStart("2100-02-26", 2, plain)).toBe("2100-03-01");
  });

  it.each([0, -1, 0.5, 1.5, NaN, Infinity, 10_001, "2", null])("rejects invalid task duration %s", (duration) => {
    expect(() => endFromStart("2026-09-11", duration as number, plain)).toThrowError(expect.objectContaining({ code: "INVALID_DURATION" }));
  });

  it("handles maximum duration and inversely reproduces its workday count", () => {
    expect(MAX_TASK_DURATION).toBe(10_000);
    const end = endFromStart("1900-01-01", MAX_TASK_DURATION, plain);
    expect(end).toBe("1938-04-29");
    expect(workingDaysBetween("1900-01-01", end, plain)).toBe(MAX_TASK_DURATION);
  });

  it("requires a normalized start and rejects end overflow", () => {
    expect(() => endFromStart("2026-09-12", 1, plain)).toThrowError(expect.objectContaining({ code: "NON_WORKING_START" }));
    expect(endFromStart("2199-12-31", 1, plain)).toBe("2199-12-31");
    expect(() => endFromStart("2199-12-31", 2, plain)).toThrowError(expect.objectContaining({ code: "DATE_OUT_OF_RANGE" }));
    expect(() => nextWorkingDay("2199-12-31", plain, false)).toThrowError(expect.objectContaining({ code: "NO_WORKING_DAY" }));
  });

  it("terminates when every supported date is a holiday", () => {
    const holidays = [];
    for (let ordinal = MIN_DAY_ORDINAL; ordinal <= MAX_DAY_ORDINAL; ordinal += 1) holidays.push({ date: ordinalToDate(ordinal) });
    const calendar = createWorkingCalendar({ ...base, holidays });
    expect(workingDaysBetween("1900-01-01", "2199-12-31", calendar)).toBe(0);
    expect(() => nextWorkingDay("1900-01-01", calendar)).toThrowError(expect.objectContaining({ code: "NO_WORKING_DAY" }));
  });

  it("preserves duration inversion across a range of starts and spans", () => {
    for (const start of ["1900-01-01", "2000-02-28", "2026-09-11", "2026-09-16", "2099-12-31"]) {
      for (const duration of [1, 2, 5, 20, 260]) {
        const end = endFromStart(start, duration, holidayCalendar);
        expect(workingDaysBetween(start, end, holidayCalendar)).toBe(duration);
        expect(isWorkingDay(end, holidayCalendar)).toBe(true);
      }
    }
  });
});
