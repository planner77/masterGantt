import { describe, expect, it } from "vitest";
import { createWorkingCalendar, scheduleLeaf, type LeafScheduleInput } from "../../../src/domain/scheduling";

const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-14" }] });
const base: LeafScheduleInput = { type: "task", requestedStart: "2026-09-11", duration: 2 };

describe("calendar-only leaf schedule", () => {
  it.each([null, undefined, [], "task", 0, true])("rejects malformed root input %s with a domain error", (input) => {
    expect(() => scheduleLeaf(input as unknown as LeafScheduleInput, calendar)).toThrowError(expect.objectContaining({
      name: "SchedulingError", code: "INVALID_LEAF_INPUT", context: { field: "input" },
    }));
  });

  it("preserves requestedStart field context when Auto normalization exhausts the supported range", () => {
    const boundaryCalendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2199-12-31" }] });
    expect(() => scheduleLeaf({ ...base, requestedStart: "2199-12-31", duration: 1 }, boundaryCalendar)).toThrowError(expect.objectContaining({
      code: "NO_WORKING_DAY", context: { field: "requestedStart", date: "2199-12-31" },
    }));
  });

  it("defaults to Auto and preserves requestedStart while deriving an inclusive end", () => {
    expect(scheduleLeaf(base, calendar)).toEqual({ ...base, scheduleMode: "auto", start: "2026-09-11", end: "2026-09-15", warnings: [] });
  });

  it("normalizes non-working Auto starts with a structured warning", () => {
    expect(scheduleLeaf({ ...base, requestedStart: "2026-09-12" }, calendar)).toEqual({
      type: "task", requestedStart: "2026-09-12", start: "2026-09-15", end: "2026-09-16", duration: 2, scheduleMode: "auto",
      warnings: [{ code: "NON_WORKING_START_SHIFTED", field: "requestedStart", requestedStart: "2026-09-12", start: "2026-09-15" }],
    });
  });

  it.each(["2026-09-12", "2026-09-13", "2026-09-14"])("rejects non-working Manual start %s", (requestedStart) => {
    expect(() => scheduleLeaf({ ...base, scheduleMode: "manual", requestedStart }, calendar)).toThrowError(expect.objectContaining({
      code: "NON_WORKING_MANUAL_START", context: { field: "requestedStart", date: requestedStart },
    }));
  });

  it("preserves a valid Manual interval and rejects a conflicting supplied end", () => {
    expect(scheduleLeaf({ ...base, scheduleMode: "manual", end: "2026-09-15" }, calendar)).toMatchObject({ requestedStart: "2026-09-11", start: "2026-09-11", end: "2026-09-15", scheduleMode: "manual", warnings: [] });
    expect(() => scheduleLeaf({ ...base, scheduleMode: "manual", end: "2026-09-14" }, calendar)).toThrowError(expect.objectContaining({
      code: "END_DURATION_MISMATCH", context: { field: "end", date: "2026-09-14", expectedDate: "2026-09-15" },
    }));
  });

  it("checks end against calendar-normalized requested start before any dependency stage", () => {
    expect(scheduleLeaf({ ...base, requestedStart: "2026-09-12", end: "2026-09-16" }, calendar).end).toBe("2026-09-16");
    expect(() => scheduleLeaf({ ...base, requestedStart: "2026-09-12", end: "2026-09-15" }, calendar)).toThrowError(expect.objectContaining({ code: "END_DURATION_MISMATCH" }));
    expect(() => scheduleLeaf({ ...base, end: "2026-09-16" }, calendar)).toThrowError(expect.objectContaining({ code: "END_DURATION_MISMATCH" }));
  });

  it("validates supplied end syntax before calculation", () => {
    expect(() => scheduleLeaf({ ...base, end: "2026-02-30" }, calendar)).toThrowError(expect.objectContaining({ code: "INVALID_DATE", context: { field: "end", date: "2026-02-30" } }));
  });

  it("represents a milestone with zero duration and identical dates", () => {
    const milestone = scheduleLeaf({ ...base, type: "milestone", duration: 0 }, calendar);
    expect(milestone).toMatchObject({ duration: 0, start: "2026-09-11", end: "2026-09-11" });
    expect(scheduleLeaf({ ...base, type: "milestone", duration: 0, requestedStart: "2026-09-12" }, calendar)).toMatchObject({ duration: 0, start: "2026-09-15", end: "2026-09-15" });
    expect(() => scheduleLeaf({ ...base, type: "milestone", duration: 0, end: "2026-09-15" }, calendar)).toThrowError(expect.objectContaining({ code: "END_DURATION_MISMATCH" }));
    expect(() => scheduleLeaf({ ...base, type: "milestone", duration: 0, scheduleMode: "manual", requestedStart: "2026-09-12" }, calendar)).toThrowError(expect.objectContaining({ code: "NON_WORKING_MANUAL_START" }));
  });

  it.each([1, -1, 0.5, NaN, Infinity, "0", null])("rejects nonzero/non-numeric milestone duration %s", (duration) => {
    expect(() => scheduleLeaf({ ...base, type: "milestone", duration } as LeafScheduleInput, calendar)).toThrowError(expect.objectContaining({ code: "INVALID_DURATION" }));
  });

  it.each([0, -1, 1.5, NaN, Infinity, 10_001])("does not coerce invalid Task duration %s", (duration) => {
    expect(() => scheduleLeaf({ ...base, duration }, calendar)).toThrowError(expect.objectContaining({ code: "INVALID_DURATION" }));
  });

  it.each(["summary", "Task", "", null])("rejects unsupported leaf type %s", (type) => {
    expect(() => scheduleLeaf({ ...base, type } as LeafScheduleInput, calendar)).toThrowError(expect.objectContaining({ code: "INVALID_TASK_TYPE" }));
  });

  it.each(["AUTO", "", null])("rejects invalid schedule mode %s", (scheduleMode) => {
    expect(() => scheduleLeaf({ ...base, scheduleMode } as LeafScheduleInput, calendar)).toThrowError(expect.objectContaining({ code: "INVALID_SCHEDULE_MODE" }));
  });

  it("does not mutate inputs on success or failure and returns frozen deterministic results", () => {
    const input = Object.freeze({ ...base, requestedStart: "2026-09-12" });
    const snapshot = structuredClone(input);
    const first = scheduleLeaf(input, calendar);
    const second = scheduleLeaf(input, calendar);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(input).toEqual(snapshot);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.warnings)).toBe(true);
    expect(Object.isFrozen(first.warnings[0])).toBe(true);
    const bad = Object.freeze({ ...input, end: "2026-09-17" });
    expect(() => scheduleLeaf(bad, calendar)).toThrow();
    expect(bad).toEqual({ ...snapshot, end: "2026-09-17" });
    // Re-use requestedStart, never overwrite it with the shifted result.
    expect(scheduleLeaf({ type: first.type, requestedStart: first.requestedStart, duration: first.duration, scheduleMode: first.scheduleMode, end: first.end }, calendar)).toEqual(first);
  });
});
