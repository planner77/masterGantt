import { describe, expect, it } from "vitest";

import {
  dateOnlyFromLocalDate,
  domainDatesToSvarDates,
  localDateFromDateOnly,
  svarDatesToDomainDates,
} from "../../../src/features/gantt/date-adapter";

describe("SVAR date adapter", () => {
  it("round trips inclusive domain dates through an exclusive local endpoint", () => {
    const svar = domainDatesToSvarDates({ start: "2026-09-14", end: "2026-09-18" });
    expect(dateOnlyFromLocalDate(svar.start)).toBe("2026-09-14");
    expect(dateOnlyFromLocalDate(svar.end)).toBe("2026-09-19");
    expect(svarDatesToDomainDates(svar)).toEqual({ start: "2026-09-14", end: "2026-09-18" });
  });

  it("keeps date-only values on local calendar boundaries", () => {
    expect(dateOnlyFromLocalDate(localDateFromDateOnly("2026-03-29"))).toBe("2026-03-29");
    expect(dateOnlyFromLocalDate(localDateFromDateOnly("2026-10-25"))).toBe("2026-10-25");
  });

  it("rejects invalid date-only values", () => {
    expect(() => localDateFromDateOnly("2026-02-30")).toThrow("valid Gregorian");
  });

  it("rejects an end date before its start date", () => {
    expect(() => domainDatesToSvarDates({ start: "2026-09-20", end: "2026-09-19" })).toThrow(
      "must not precede",
    );
  });

  it("rejects an empty exclusive widget range", () => {
    expect(() =>
      svarDatesToDomainDates({
        start: localDateFromDateOnly("2026-09-20"),
        end: localDateFromDateOnly("2026-09-20"),
      }),
    ).toThrow("must follow");
  });
});
