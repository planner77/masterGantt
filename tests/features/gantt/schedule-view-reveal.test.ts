import { describe, expect, it } from "vitest";
import { projectedTaskReveal } from "../../../src/features/gantt/schedule-view-reveal";

const base = { start: "2026-10-14", axisStart: Date.parse("2026-10-01T00:00:00Z") / 86_400_000,
  pixelsPerDay: 36, scrollWidth: 3600, clientWidth: 1200 };

describe("Projected Resource/Equipment Grid Task horizontal reveal (#899)", () => {
  it("aligns the clicked Task start to the sticky Grid divider, without a second scroll writer", () => {
    expect(projectedTaskReveal(base)).toEqual({ status: "ALIGNED", left: 13 * 36 });
    expect(projectedTaskReveal({ ...base, pixelsPerDay: 68 / 7 })).toEqual({ status: "ALIGNED", left: 13 * (68 / 7) });
  });
  it("returns a typed limited-capacity result rather than falsely claiming alignment", () => {
    expect(projectedTaskReveal({ ...base, scrollWidth: 1200, clientWidth: 1200 }))
      .toEqual({ status: "NO_SCROLL_CAPACITY", left: 0 });
    expect(projectedTaskReveal({ ...base, scrollWidth: 1450, clientWidth: 1200 }))
      .toEqual({ status: "NO_SCROLL_CAPACITY", left: 250 });
    expect(projectedTaskReveal({ ...base, axisStart: base.axisStart + 20 }))
      .toEqual({ status: "NO_SCROLL_CAPACITY", left: 0 });
  });
  it("keeps missing or invalid dates distinct from insufficient scroll room", () => {
    expect(projectedTaskReveal({ ...base, start: null }).status).toBe("NO_DATE");
    for (const start of ["not-a-date", "2026-02-31", "2026-13-01", "2026-02-29"])
      expect(projectedTaskReveal({ ...base, start }).status).toBe("NOT_MEASURABLE");
    expect(projectedTaskReveal({ ...base, pixelsPerDay: Infinity }).status).toBe("NOT_MEASURABLE");
    expect(projectedTaskReveal({ ...base, clientWidth: 0 }).status).toBe("NOT_MEASURABLE");
  });
});
