import { describe, expect, it } from "vitest";
import {
  normalizeTaskStatusProgress,
  taskStatusFromProgress,
  taskStatusProgressConsistent,
} from "../../src/domain/task-status";

describe("Issue #303 task status normalization", () => {
  it.each([
    [null, "not_started"],
    [0, "not_started"],
    [1, "in_progress"],
    [50, "in_progress"],
    [99.999, "in_progress"],
    [100, "completed"],
  ] as const)("derives %s as %s", (progress, status) => {
    expect(taskStatusFromProgress(progress)).toBe(status);
  });

  it("keeps canonical status/progress combinations deterministic", () => {
    expect(normalizeTaskStatusProgress({ currentStatus: "not_started", currentProgress: 0, progress: 50 }))
      .toEqual({ status: "in_progress", progress: 50 });
    expect(normalizeTaskStatusProgress({ currentStatus: "in_progress", currentProgress: 50, progress: 100 }))
      .toEqual({ status: "completed", progress: 100 });
    expect(normalizeTaskStatusProgress({ currentStatus: "completed", currentProgress: 100, progress: 0 }))
      .toEqual({ status: "in_progress", progress: 0 });
    expect(normalizeTaskStatusProgress({ currentStatus: "in_progress", currentProgress: 50, status: "not_started" }))
      .toEqual({ status: "not_started", progress: 0 });
    expect(normalizeTaskStatusProgress({ currentStatus: "not_started", currentProgress: 0, status: "completed" }))
      .toEqual({ status: "completed", progress: 100 });
    expect(normalizeTaskStatusProgress({ currentStatus: "completed", currentProgress: 100, status: "in_progress" }))
      .toEqual({ status: "in_progress", progress: 0 });
  });

  it("rejects contradictory persisted combinations", () => {
    expect(taskStatusProgressConsistent("completed", 99)).toBe(false);
    expect(taskStatusProgressConsistent("not_started", 1)).toBe(false);
    expect(taskStatusProgressConsistent("in_progress", 100)).toBe(false);
    expect(taskStatusProgressConsistent("not_started", null)).toBe(true);
  });
});
