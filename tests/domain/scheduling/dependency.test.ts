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
      type: "UNKNOWN",
      lag: 0,
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

  describe("FS/SS/FF/SF and signed lag scheduling matrix", () => {
    it("handles FS with positive lag (+2) crossing weekend", () => {
      // 2026-09-11 is Friday. end = 2026-09-11.
      // FS / 0 = next workday: 2026-09-14 (Monday).
      // FS / +2 = 2 workdays after FS/0: 2026-09-16 (Wednesday).
      const taskA = task("A", { start: "2026-09-10", end: "2026-09-11", duration: 2 });
      const taskB = task("B", { start: "2026-09-01", end: "2026-09-01", duration: 1 });
      const result = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-1", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: 2 }],
        calendar,
      );
      expect(result.tasks[1].start).toBe("2026-09-16");
      expect(result.tasks[1].end).toBe("2026-09-16");
    });

    it("handles FS with negative lag (-1)", () => {
      // taskA ends on 2026-09-09 (Wednesday).
      // FS / 0 = 2026-09-10 (Thursday).
      // FS / -1 = 2026-09-09 (Wednesday).
      const taskA = task("A", { start: "2026-09-08", end: "2026-09-09", duration: 2 });
      const taskB = task("B", { start: "2026-09-01", end: "2026-09-01", duration: 2 });
      const result = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-1", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: -1 }],
        calendar,
      );
      expect(result.tasks[1].start).toBe("2026-09-09");
      expect(result.tasks[1].end).toBe("2026-09-10");
    });

    it("handles SS with lag 0 and positive lag (+3)", () => {
      // taskA starts on 2026-09-07 (Monday).
      // SS / 0 = taskA.start = 2026-09-07.
      // SS / +3 = 3 workdays after 2026-09-07 = 2026-09-10 (Thursday).
      const taskA = task("A", { start: "2026-09-07", end: "2026-09-11", duration: 5 });
      const taskB = task("B", { start: "2026-09-01", end: "2026-09-02", duration: 2 });
      const result0 = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-0", predecessorExternalId: "A", successorExternalId: "B", type: "SS", lag: 0 }],
        calendar,
      );
      expect(result0.tasks[1].start).toBe("2026-09-07");
      expect(result0.tasks[1].end).toBe("2026-09-09");

      const result3 = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-3", predecessorExternalId: "A", successorExternalId: "B", type: "SS", lag: 3 }],
        calendar,
      );
      // 09-07 + 3 working days (skipping 09-08 holiday): 1: 09-09, 2: 09-10, 3: 09-11
      expect(result3.tasks[1].start).toBe("2026-09-11");
      expect(result3.tasks[1].end).toBe("2026-09-14"); // crosses weekend (09-12 Sat, 09-13 Sun)
    });

    it("handles FF with lag 0 and negative lag (-1)", () => {
      // taskA ends on 2026-09-11 (Friday).
      // taskB duration = 3.
      // FF / 0: required end = 2026-09-11. startFromEnd(2026-09-11, 3, calendar)
      // 3 working days back: 09-11, 09-10, 09-09 -> start: 2026-09-09
      const taskA = task("A", { start: "2026-09-07", end: "2026-09-11", duration: 5 });
      const taskB = task("B", { start: "2026-09-01", end: "2026-09-03", duration: 3 });
      const result0 = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-0", predecessorExternalId: "A", successorExternalId: "B", type: "FF", lag: 0 }],
        calendar,
      );
      expect(result0.tasks[1].start).toBe("2026-09-09");
      expect(result0.tasks[1].end).toBe("2026-09-11");

      // FF / -1: required end = 1 workday before 2026-09-11 = 2026-09-10 (Thursday).
      // startFromEnd(2026-09-10, 3, calendar): 09-10, 09-09, (09-08 holiday skipped), 09-07 -> start: 2026-09-07
      const resultNeg = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-neg", predecessorExternalId: "A", successorExternalId: "B", type: "FF", lag: -1 }],
        calendar,
      );
      expect(resultNeg.tasks[1].start).toBe("2026-09-07");
      expect(resultNeg.tasks[1].end).toBe("2026-09-10");
    });

    it("handles SF with lag 0 and positive lag (+1)", () => {
      // taskA starts on 2026-09-07 (Monday).
      // taskB duration = 2.
      // SF / 0: required end = taskA.start = 2026-09-07.
      // startFromEnd(2026-09-07, 2, calendar) = 2026-09-04 (Friday).
      const taskA = task("A", { start: "2026-09-07", end: "2026-09-11", duration: 5 });
      const taskB = task("B", { start: "2026-08-01", end: "2026-08-02", duration: 2 });
      const result0 = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-0", predecessorExternalId: "A", successorExternalId: "B", type: "SF", lag: 0 }],
        calendar,
      );
      expect(result0.tasks[1].start).toBe("2026-09-04");
      expect(result0.tasks[1].end).toBe("2026-09-07");

      // SF / +1: required end = 1 workday after 2026-09-07 = 2026-09-09 (skipping 09-08 holiday).
      // startFromEnd(2026-09-09, 2, calendar): 09-09, (09-08 holiday skipped), 09-07 -> start: 2026-09-07
      const result1 = recalculateFinishStartDependencies(
        [taskA, taskB],
        [{ id: "link-1", predecessorExternalId: "A", successorExternalId: "B", type: "SF", lag: 1 }],
        calendar,
      );
      expect(result1.tasks[1].start).toBe("2026-09-07");
      expect(result1.tasks[1].end).toBe("2026-09-09");
    });

    it("selects the strongest lower bound from mixed multiple predecessors", () => {
      // taskA: 2026-09-07 ~ 2026-09-09 (duration 2). FS / +1 -> candidate = 2026-09-11
      // taskB: 2026-09-07 ~ 2026-09-14 (duration 5). SS / +4 -> candidate = 2026-09-14
      // taskC (duration 2): initially 2026-09-01 ~ 2026-09-02.
      // Strongest candidate is 2026-09-14 from taskB.
      const taskA = task("A", { start: "2026-09-07", end: "2026-09-09", duration: 2 });
      const taskB = task("B", { start: "2026-09-07", end: "2026-09-14", duration: 5 });
      const taskC = task("C", { start: "2026-09-01", end: "2026-09-02", duration: 2 });
      const result = recalculateFinishStartDependencies(
        [taskA, taskB, taskC],
        [
          { id: "link-A-C", predecessorExternalId: "A", successorExternalId: "C", type: "FS", lag: 1 },
          { id: "link-B-C", predecessorExternalId: "B", successorExternalId: "C", type: "SS", lag: 4 },
        ],
        calendar,
      );
      expect(result.tasks[2].start).toBe("2026-09-14");
      expect(result.tasks[2].end).toBe("2026-09-15");
    });
  });
});
