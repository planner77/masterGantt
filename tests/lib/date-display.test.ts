import { describe, expect, it } from "vitest";

import {
  formatLocaleDateOnly,
  formatLocaleDateTime,
  SSR_TIME_ZONE,
  todayLocalDateString,
} from "../../src/lib/date-display";

describe("date display helpers", () => {
  it("uses each requested locale's date order", () => {
    const date = "2026-01-05";
    expect(formatLocaleDateOnly(date, "ko-KR")).toBe(
      new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: SSR_TIME_ZONE }).format(new Date("2026-01-05T00:00:00.000Z")),
    );
    expect(formatLocaleDateOnly(date, "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: SSR_TIME_ZONE }).format(new Date("2026-01-05T00:00:00.000Z")),
    );
    expect(formatLocaleDateOnly(date, "en-GB")).toBe(
      new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: SSR_TIME_ZONE }).format(new Date("2026-01-05T00:00:00.000Z")),
    );
  });

  it("keeps date-only values on the intended calendar day across time zones", () => {
    const instant = new Date("2026-01-05T00:00:00.000Z");
    const utcDate = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    }).format(instant);
    const newYorkDate = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York",
    }).format(instant);
    expect(utcDate).not.toBe(newYorkDate);
    expect(formatLocaleDateOnly("2026-01-05", "en-CA")).toBe(utcDate);
  });

  it("uses the supplied timezone for instants and local components for today's date", () => {
    expect(formatLocaleDateTime("2026-01-01T00:30:00.000Z", "en-CA", "America/New_York")).toContain("Dec");
    expect(todayLocalDateString(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
  });
});
