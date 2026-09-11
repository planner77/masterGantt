import { describe, expect, it } from "vitest";
import {
  addCalendarDays, dateToOrdinal, dayOfWeek, ordinalToDate, parseDateOnly,
  MAX_CALENDAR_SPAN_DAYS, MAX_DAY_ORDINAL, MAX_SUPPORTED_DATE,
  MIN_DAY_ORDINAL, MIN_SUPPORTED_DATE, SchedulingError,
} from "../../../src/domain/scheduling";

describe("strict Gregorian date-only", () => {
  it.each(["1900-01-01", "2000-02-29", "2028-02-29", "2100-02-28", "2199-12-31"])("accepts %s without coercion", (date) => {
    expect(parseDateOnly(date)).toBe(date);
  });

  it.each([
    "2026-02-29", "1900-02-29", "2100-02-29", "2026-04-31", "2026-00-01", "2026-13-01",
    "2026-01-00", "2026-01-32", "0000-01-01", "2026-1-01", "26-01-01", "2026-01-1",
    "2026-09-11T00:00:00Z", "2026-09-11+09:00", " 2026-09-11", "2026-09-11\n", "09/11/2026",
    "２０２６-０９-１１", "", null, undefined, 20260911, new Date("2026-09-11"),
  ])("rejects malformed/impossible date %s", (date) => {
    expect(() => parseDateOnly(date)).toThrowError(expect.objectContaining({ code: "INVALID_DATE" }));
  });

  it.each(["0001-01-01", "1899-12-31", "2200-01-01", "9999-12-31"])("rejects unsupported real date %s", (date) => {
    expect(() => parseDateOnly(date, "requestedStart")).toThrowError(expect.objectContaining({
      code: "DATE_OUT_OF_RANGE", context: { field: "requestedStart", date },
    }));
  });

  it("exports exact supported interval and bounded scan size", () => {
    expect(MIN_SUPPORTED_DATE).toBe("1900-01-01");
    expect(MAX_SUPPORTED_DATE).toBe("2199-12-31");
    expect(MAX_CALENDAR_SPAN_DAYS).toBe(109_573);
    expect(dateToOrdinal(MIN_SUPPORTED_DATE)).toBe(MIN_DAY_ORDINAL);
    expect(dateToOrdinal(MAX_SUPPORTED_DATE)).toBe(MAX_DAY_ORDINAL);
  });

  it.each([
    ["2028-02-28", 1, "2028-02-29"], ["2028-02-29", 1, "2028-03-01"],
    ["2100-02-28", 1, "2100-03-01"], ["2026-04-30", 1, "2026-05-01"],
    ["2026-12-31", 1, "2027-01-01"], ["2027-01-01", -1, "2026-12-31"],
    ["2000-03-01", -1, "2000-02-29"], ["2026-09-11", 0, "2026-09-11"],
  ] as const)("shifts %s by %s calendar days", (date, offset, expected) => {
    expect(addCalendarDays(date, offset)).toBe(expected);
  });

  it.each([1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid day offset %s", (offset) => {
    expect(() => addCalendarDays("2026-09-11", offset)).toThrowError(expect.objectContaining({ code: "INVALID_DAY_OFFSET" }));
  });

  it("rejects both range boundaries and invalid ordinals", () => {
    for (const ordinal of [MIN_DAY_ORDINAL - 1, MAX_DAY_ORDINAL + 1, NaN, Infinity, 1.5]) {
      expect(() => ordinalToDate(ordinal)).toThrowError(expect.objectContaining({ code: "DATE_OUT_OF_RANGE" }));
    }
    expect(() => addCalendarDays(MIN_SUPPORTED_DATE, -1)).toThrow(SchedulingError);
    expect(() => addCalendarDays(MAX_SUPPORTED_DATE, 1)).toThrow(SchedulingError);
  });

  it("round-trips every supported day against the independent UTC Gregorian oracle", () => {
    const firstInstant = Date.UTC(1900, 0, 1);
    const failures: string[] = [];
    for (let offset = 0; offset < MAX_CALENDAR_SPAN_DAYS; offset += 1) {
      const oracle = new Date(firstInstant + offset * 86_400_000);
      const date = oracle.toISOString().slice(0, 10);
      const ordinal = MIN_DAY_ORDINAL + offset;
      if (ordinalToDate(ordinal) !== date || dateToOrdinal(date) !== ordinal || dayOfWeek(date) !== oracle.getUTCDay()) {
        failures.push(date);
      }
    }
    expect(failures).toEqual([]);
  });
});
