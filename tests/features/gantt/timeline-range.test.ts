import { describe, expect, it } from "vitest";

import {
  GANTT_CELL_WIDTH,
  minimumTimelineScaleWidthForEnd,
  nextTimelineScaleWidth,
} from "../../../src/features/gantt/timeline-range";

describe("Issue #367 Gantt timeline scale extension", () => {
  it("uses the denser Day width while keeping Week width unchanged", () => {
    expect(GANTT_CELL_WIDTH.day).toBe(36);
    expect(GANTT_CELL_WIDTH.week).toBe(68);
  });

  it("does not extend while enough timeline pixels remain to the right", () => {
    expect(nextTimelineScaleWidth({
      scaleWidth: 1800,
      scrollLeft: 0,
      viewportWidth: 720,
      scaleMode: "day",
    })).toBeNull();
  });

  it("extends by at least one viewport near the right boundary", () => {
    const nextWidth = nextTimelineScaleWidth({
      scaleWidth: 1800,
      scrollLeft: 1080,
      viewportWidth: 720,
      scaleMode: "day",
    });
    expect(nextWidth).not.toBeNull();
    expect(nextWidth!).toBeGreaterThanOrEqual(2520);
    expect(nextWidth! % GANTT_CELL_WIDTH.day).toBe(0);
  });

  it("primes a future buffer when the scale is no wider than the viewport", () => {
    const nextWidth = nextTimelineScaleWidth({
      scaleWidth: 360,
      scrollLeft: 0,
      viewportWidth: 900,
      scaleMode: "day",
    });
    expect(nextWidth).not.toBeNull();
    expect(nextWidth!).toBeGreaterThan(900);
  });

  it("computes a minimum Day scale width that covers a preserved future end", () => {
    const start = new Date(2026, 9, 1);
    const end = new Date(2026, 10, 15);
    const width = minimumTimelineScaleWidthForEnd({ start, end, scaleMode: "day" });
    expect(width).toBeGreaterThanOrEqual(45 * GANTT_CELL_WIDTH.day);
  });

  it("uses week-sized cells when restoring a preserved end across scale changes", () => {
    const start = new Date(2026, 10, 1);
    const end = new Date(2027, 0, 10);
    const width = minimumTimelineScaleWidthForEnd({ start, end, scaleMode: "week" });
    expect(width % GANTT_CELL_WIDTH.week).toBe(0);
    expect(width).toBeGreaterThan(4 * GANTT_CELL_WIDTH.week);
  });
});
