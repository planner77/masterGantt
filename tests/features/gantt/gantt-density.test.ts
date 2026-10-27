import { describe, expect, it } from "vitest";
import { createDensityWheel, densityFontScale, densityHeight, nextDensityLevel } from "../../../src/features/gantt/gantt-density";

describe("Project Gantt vertical density input", () => {
  it("clamps both ends and keeps touch/hybrid geometry at 44px", () => {
    expect([0, 1, 2, 3].map(level => densityHeight(level, false))).toEqual([34, 32, 30, 28]);
    expect(nextDensityLevel(0, -1, false)).toBe(0);
    expect(nextDensityLevel(3, 1, false)).toBe(3);
    expect(nextDensityLevel(2, -1, false)).toBe(1);
    for (let level = 0; level < 4; level++) {
      expect(densityHeight(level, true)).toBe(44);
      expect(densityFontScale(level, true)).toBe(1);
      expect(nextDensityLevel(level, 1, true)).toBe(0);
      expect(Math.max(12, 14 * densityFontScale(level, false))).toBeGreaterThanOrEqual(12);
    }
  });
  it("accumulates high-resolution input and normalizes line/page wheel modes", () => {
    const wheel = createDensityWheel();
    expect(wheel.push(20, 0, 10)).toBe(0);
    expect(wheel.push(20, 0, 20)).toBe(0);
    expect(wheel.push(20, 0, 30)).toBe(1);
    expect(wheel.push(-4, 1, 40)).toBe(-1);
    expect(wheel.push(1, 2, 50)).toBe(1);
    expect(wheel.push(10_000, 0, 60)).toBe(1);
  });
  it("discards stale/opposite remainders and rejects non-finite deltas", () => {
    const wheel = createDensityWheel();
    expect(wheel.push(50, 0, 10)).toBe(0);
    expect(wheel.push(-20, 0, 20)).toBe(0);
    expect(wheel.push(-40, 0, 30)).toBe(-1);
    expect(wheel.push(40, 0, 50)).toBe(0);
    expect(wheel.push(20, 0, 400)).toBe(0);
    expect(wheel.push(NaN, 0, 410)).toBe(0);
    expect(wheel.push(Infinity, 0, 420)).toBe(0);
    wheel.reset();
    expect(wheel.push(40, 0, 430)).toBe(0);
  });
});
