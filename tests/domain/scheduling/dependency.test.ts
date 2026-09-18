import { describe, expect, it } from "vitest";

import {
  createWorkingCalendar,
  recalculateFinishStartDependencies,
  SchedulingError,
  type FinishStartDependencyTaskInput,
} from "../../../src/domain/scheduling";

const calendar = createWorkingCalendar({
  timezone: "Asia/Seoul",
  weekendDays: [6, 0],
  exceptions: [{ date: "2026-09-08", dayType: "NON_WORKING", name: "Plant holiday" }],
});

function task(
  externalId: string,
  overrides: Partial<FinishStartDependencyTaskInput> = {},
): FinishStartDependencyTaskInput {
  return Object.freeze({
    taskId: `${externalId}-id`,
    externalId,
    type: "task" as const,
    scheduleMode: "auto" as const,
    start: "2026-09-07",
    end: "2026-09-07",
    duration: 1,
    ...overrides,
  });
}

function link(id: string, predecessorExternalId: string, successorExternalId: string) {
  return Object.freeze({
    id,
    predecessorExternalId,
    successorExternalId,
    type: "FS" as const,
    lag: 0 as const,
  });
}

describe("FS/lag=0 dependency scheduling", () => {
  it("moves an Auto successor to the first workday after the latest predecessor", () => {
    const tasks = Object.freeze([
      task("A", { start: "2026-09-07", end: "2026-09-09", duration: 2 }),
      task("B"),
      task("C", { start: "2026-09-09", end: "2026-09-09" }),
    ]);
    const result = recalculateFinishStartDependencies(
      tasks,
      [link("A-B", "A", "B"), link("C-B", "C", "B")],
      calendar,
    );

    expect(result.tasks[1]).toMatchObject({ start: "2026-09-10", end: "2026-09-10" });
    expect(result.changes).toEqual([expect.objectContaining({
      externalId: "B",
      predecessorExternalIds: ["A", "C"],
      afterStart: "2026-09-10",
    })]);
    expect(result.manualConflicts).toEqual([]);
    expect(tasks[1]).toMatchObject({ start: "2026-09-07", end: "2026-09-07" });
  });

  it("keeps a later requested/calendar-normalized Auto start unchanged", () => {
    const result = recalculateFinishStartDependencies(
      [
        task("A"),
        task("B", { start: "2026-09-10", end: "2026-09-10" }),
      ],
      [link("A-B", "A", "B")],
      calendar,
    );
    expect(result.tasks[1]).toMatchObject({ start: "2026-09-10", end: "2026-09-10" });
    expect(result.changes).toEqual([]);
  });

  it("preserves milestone duration while applying the next-workday FS bound", () => {
    const result = recalculateFinishStartDependencies(
      [
        task("M1", { type: "milestone", duration: 0 }),
        task("M2", { type: "milestone", duration: 0 }),
      ],
      [link("M1-M2", "M1", "M2")],
      calendar,
    );
    expect(result.tasks[1]).toMatchObject({
      type: "milestone",
      duration: 0,
      start: "2026-09-09",
      end: "2026-09-09",
    });
  });

  it("reports a Manual dependency conflict without moving the Manual task", () => {
    const result = recalculateFinishStartDependencies(
      [
        task("A", { start: "2026-09-07", end: "2026-09-09", duration: 2 }),
        task("B", { scheduleMode: "manual", start: "2026-09-09", end: "2026-09-09" }),
      ],
      [link("A-B", "A", "B")],
      calendar,
    );
    expect(result.tasks[1]).toMatchObject({ start: "2026-09-09", end: "2026-09-09" });
    expect(result.manualConflicts).toEqual([expect.objectContaining({
      externalId: "B",
      requiredStart: "2026-09-10",
      predecessorExternalIds: ["A"],
    })]);
  });

  it("rejects dependency cycles and invalid endpoint structures deterministically", () => {
    const tasks = [task("A"), task("B")];
    expect(() => recalculateFinishStartDependencies(
      tasks,
      [link("A-B", "A", "B"), link("B-A", "B", "A")],
      calendar,
    )).toThrowError(expect.objectContaining({ code: "DEPENDENCY_CYCLE" }));

    expect(() => recalculateFinishStartDependencies(
      [task("S", { type: "summary" }), task("B")],
      [link("S-B", "S", "B")],
      calendar,
    )).toThrowError(expect.objectContaining({ code: "SUMMARY_DEPENDENCY_ENDPOINT" }));

    expect(() => recalculateFinishStartDependencies(
      tasks,
      [link("missing", "A", "MISSING")],
      calendar,
    )).toThrowError(expect.objectContaining({ code: "MISSING_DEPENDENCY" }));
  });

  it("rejects unsupported relation semantics instead of coercing them to FS/0", () => {
    const unsupported = {
      ...link("unsupported", "A", "B"),
      type: "SS",
      lag: 1,
    } as unknown as Parameters<typeof recalculateFinishStartDependencies>[1][number];
    try {
      recalculateFinishStartDependencies([task("A"), task("B")], [unsupported], calendar);
      throw new Error("Expected dependency validation failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(SchedulingError);
      expect((error as SchedulingError).code).toBe("UNSUPPORTED_DEPENDENCY");
    }
  });

  it("is idempotent when the already constrained result is recalculated", () => {
    const links = [link("A-B", "A", "B")];
    const first = recalculateFinishStartDependencies(
      [
        task("A", { start: "2026-09-07", end: "2026-09-09", duration: 2 }),
        task("B"),
      ],
      links,
      calendar,
    );
    const second = recalculateFinishStartDependencies(first.tasks, links, calendar);
    expect(second.tasks).toEqual(first.tasks);
    expect(second.changes).toEqual([]);
  });
});
