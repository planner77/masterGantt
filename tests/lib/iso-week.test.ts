import { describe, expect, it } from "vitest";

import { formatIsoWeek, getIsoWeek } from "../../src/lib/iso-week";

describe("ISO week helpers", () => {
  it("returns the same week number for dates in the same ISO week", () => {
    expect(getIsoWeek(new Date(2026, 8, 14))).toBe(38);
    expect(getIsoWeek(new Date(2026, 8, 20))).toBe(38);
  });

  it("keeps week numbers continuous across a month boundary", () => {
    expect(formatIsoWeek(new Date(2026, 8, 28))).toBe("W40");
    expect(formatIsoWeek(new Date(2026, 9, 5))).toBe("W41");
  });

  it("handles an ordinary year boundary from W52 to W01", () => {
    expect(formatIsoWeek(new Date(2021, 11, 27))).toBe("W52");
    expect(formatIsoWeek(new Date(2022, 0, 3))).toBe("W01");
  });

  it("handles a 53-week ISO year boundary", () => {
    expect(formatIsoWeek(new Date(2020, 11, 28))).toBe("W53");
    expect(formatIsoWeek(new Date(2021, 0, 4))).toBe("W01");
  });

  it("assigns early January dates to the previous ISO week-year when required", () => {
    expect(formatIsoWeek(new Date(2021, 0, 1))).toBe("W53");
    expect(formatIsoWeek(new Date(2016, 0, 1))).toBe("W53");
  });

  it("zero-pads single-digit ISO week labels", () => {
    expect(formatIsoWeek(new Date(2026, 0, 5))).toBe("W02");
  });
});
