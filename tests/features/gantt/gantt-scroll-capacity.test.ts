import { describe, expect, it } from "vitest";
import { interiorGanttScrollLeft } from "../../e2e/helpers/gantt-scroll-capacity";

describe("#624 #2920 / #703 #490 bounded native Gantt scroll setup", () => {
  it.each([
    { capacity: 19, expected: 9 },  // #2920 measured max19, native scroll18 at edge
    { capacity: 18, expected: 9 },  // actual reachable native boundary
    { capacity: 62, expected: 31 }, // #2893 scoped Week: never request 120 at capacity62
    { capacity: 120, expected: 60 },
    { capacity: 240, expected: 120 },
    { capacity: 810, expected: 120 },
  ])("selects a positive interior scroll at capacity=$capacity", ({ capacity, expected }) => {
    const selected = interiorGanttScrollLeft(capacity);
    expect(selected).toBe(expected);
    expect(selected).toBeGreaterThan(0);
    expect(selected).toBeLessThan(capacity);
    expect(selected).toBeLessThanOrEqual(120);
  });

  it.each([0, -1, 1, NaN, Infinity, -Infinity])(
    "never presents an unusable capacity (%s) as a successful scroll",
    capacity => {
      expect(interiorGanttScrollLeft(capacity)).toBe(0);
    },
  );

  it("rejects invalid requested input rather than inventing a horizontal movement", () => {
    expect(interiorGanttScrollLeft(120, 0)).toBe(0);
    expect(interiorGanttScrollLeft(120, NaN)).toBe(0);
    expect(interiorGanttScrollLeft(120, Infinity)).toBe(0);
    expect(interiorGanttScrollLeft(240, 90)).toBe(90);
  });
});
