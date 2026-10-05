import { describe, expect, it } from "vitest";

import {
  createWorkingCalendar,
  recalculateDependencies,
  type DependencyLinkInput,
  type DependencyType,
} from "../../src/domain/scheduling";

const calendar = createWorkingCalendar({
  timezone: "Asia/Seoul",
  weekendDays: [6, 0],
  exceptions: [{ date: "2026-10-12", dayType: "NON_WORKING", name: "Plant holiday" }],
});

function milestone(externalId: string, date = "2026-10-05", scheduleMode: "auto" | "manual" = "auto") {
  return Object.freeze({
    taskId: `${externalId}-id`, externalId, type: "milestone" as const,
    scheduleMode, requestedStart: date, start: date, end: date, duration: 0,
    progress: 0, status: "not_started" as const,
  });
}

function link(predecessorExternalId: string, successorExternalId: string, type: DependencyType = "FS", lag = 0): DependencyLinkInput {
  return Object.freeze({
    id: `${predecessorExternalId}-${successorExternalId}`, predecessorExternalId,
    successorExternalId, type, lag,
  });
}

const signedLagCases = [
  { type: "FS", lag: 2, date: "2026-10-15" },
  { type: "FS", lag: -2, date: "2026-10-08" },
  { type: "SS", lag: 2, date: "2026-10-14" },
  { type: "SS", lag: -2, date: "2026-10-07" },
  { type: "FF", lag: 2, date: "2026-10-14" },
  { type: "FF", lag: -2, date: "2026-10-07" },
  { type: "SF", lag: 2, date: "2026-10-14" },
  { type: "SF", lag: -2, date: "2026-10-07" },
] satisfies { type: DependencyType; lag: number; date: string }[];

describe("Issue #460 Milestone dependency scheduling reuse", () => {
  it.each(signedLagCases)("applies $type/$lag working-day lag without changing completion or requested dates", ({ type, lag, date }) => {
    const tasks = Object.freeze([milestone("A", "2026-10-09"), milestone("B")]);
    const links = Object.freeze([link("A", "B", type, lag)]);
    const result = recalculateDependencies(tasks, links, calendar);

    expect(result.tasks[1]).toEqual({ ...tasks[1], start: date, end: date });
    expect(result.changes).toEqual([{
      taskId: "B-id", externalId: "B", beforeStart: "2026-10-05", beforeEnd: "2026-10-05",
      afterStart: date, afterEnd: date, predecessorExternalIds: ["A"],
    }]);
    expect(result.manualConflicts).toEqual([]);
    expect(tasks[1].start).toBe("2026-10-05");
    expect(links).toEqual([link("A", "B", type, lag)]);
  });

  it("keeps FS/0 strictly after the predecessor across a weekend and holiday", () => {
    const result = recalculateDependencies(
      [milestone("A", "2026-10-09"), milestone("B")], [link("A", "B")], calendar,
    );
    expect(result.tasks[1]).toMatchObject({ start: "2026-10-13", end: "2026-10-13", duration: 0 });
  });

  it("propagates a serial graph even when the snapshot is in reverse dependency order", () => {
    const tasks = [milestone("C"), milestone("B"), milestone("A", "2026-10-09")];
    const result = recalculateDependencies(tasks, [link("B", "C"), link("A", "B")], calendar);
    expect(result.tasks.map((task) => [task.externalId, task.start, task.end])).toEqual([
      ["C", "2026-10-14", "2026-10-14"],
      ["B", "2026-10-13", "2026-10-13"],
      ["A", "2026-10-09", "2026-10-09"],
    ]);
    expect(recalculateDependencies(result.tasks, [link("B", "C"), link("A", "B")], calendar).changes).toEqual([]);
  });

  it("schedules branches independently and joins on both strongest predecessor bounds", () => {
    const result = recalculateDependencies(
      [milestone("A", "2026-10-09"), milestone("B"), milestone("C"), milestone("D")],
      [link("A", "B", "FS", 1), link("A", "C", "SS"), link("B", "D"), link("C", "D", "FS", 2)],
      calendar,
    );
    expect(result.tasks.map((task) => task.start)).toEqual([
      "2026-10-09", "2026-10-14", "2026-10-09", "2026-10-15",
    ]);
    expect(result.changes.find((change) => change.externalId === "D")?.predecessorExternalIds).toEqual(["B", "C"]);
  });

  it("uses only explicit N:M edges without creating a Cartesian product", () => {
    const tasks = [milestone("A", "2026-10-09"), milestone("B", "2026-10-08"), milestone("X"), milestone("Y")];
    const links = Object.freeze([link("A", "X"), link("B", "X", "SS"), link("B", "Y")]);
    const sparse = recalculateDependencies(tasks, links, calendar);
    expect(sparse.tasks.map((task) => task.start)).toEqual([
      "2026-10-09", "2026-10-08", "2026-10-13", "2026-10-09",
    ]);
    expect(links).toHaveLength(3);
    expect(sparse.changes.find((change) => change.externalId === "X")?.predecessorExternalIds).toEqual(["A"]);
    expect(sparse.changes.find((change) => change.externalId === "Y")?.predecessorExternalIds).toEqual(["B"]);
    const complete = recalculateDependencies(tasks, [...links, link("A", "Y")], calendar);
    expect(complete.tasks[3].start).toBe("2026-10-13");
  });

  it.each(signedLagCases)("reports a Manual $type/$lag conflict without moving the milestone", ({ type, lag, date }) => {
    const tasks = [milestone("A", "2026-10-09"), milestone("B", "2026-10-05", "manual")];
    const result = recalculateDependencies(tasks, [link("A", "B", type, lag)], calendar);
    expect(result.tasks).toEqual(tasks);
    expect(result.changes).toEqual([]);
    expect(result.manualConflicts).toEqual([{
      taskId: "B-id", externalId: "B", start: "2026-10-05", requiredStart: date,
      predecessorExternalIds: ["A"],
    }]);
  });

  it("preserves a Manual instant already later than all incoming bounds", () => {
    const result = recalculateDependencies(
      [milestone("A", "2026-10-09"), milestone("B", "2026-10-16", "manual")],
      [link("A", "B", "FS", 2)], calendar,
    );
    expect(result.tasks[1].start).toBe("2026-10-16");
    expect(result.changes).toEqual([]);
    expect(result.manualConflicts).toEqual([]);
  });

  it.each([
    { code: "SELF_DEPENDENCY", links: [link("A", "A")] },
    { code: "DUPLICATE_DEPENDENCY", links: [link("A", "B"), { ...link("A", "B", "SS", -1), id: "other-edge" }] },
    { code: "DUPLICATE_DEPENDENCY", links: [link("A", "B"), { ...link("B", "C"), id: "A-B" }] },
    { code: "DEPENDENCY_CYCLE", links: [link("A", "B"), link("B", "C"), link("C", "A")] },
    { code: "MISSING_DEPENDENCY", links: [link("A", "missing")] },
  ])("rejects $code in a Milestone graph without mutating schedules", ({ code, links }) => {
    const tasks = Object.freeze([milestone("A"), milestone("B"), milestone("C")]);
    expect(() => recalculateDependencies(tasks, links, calendar)).toThrowError(expect.objectContaining({ code }));
    expect(tasks.map((task) => task.start)).toEqual(["2026-10-05", "2026-10-05", "2026-10-05"]);
  });
});
