import { describe, expect, it } from "vitest";
import { createWorkingCalendar, recalculateDependencies, type DependencyLinkInput } from "../../../src/domain/scheduling";
import { recalculateTaskCandidate } from "../../../src/domain/scheduling/task-candidate";
import { classifyTaskPatch } from "../../../src/domain/tasks/task-patch-fields";

const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] });
const task = (id: string, duration = 1) => ({ taskId: id, externalId: id, name: id, type: "task" as const, requestedStart: "2026-09-14", start: "2026-09-14", end: "2026-09-14", duration, scheduleMode: "auto" as const, progress: 0, parentExternalId: null, siblingOrder: id.charCodeAt(0), baselineStart: "2026-09-14", baselineEnd: "2026-09-14", baselineDuration: 1 });
const link = (a: string, b: string): DependencyLinkInput => ({ id: `${a}-${b}`, predecessorExternalId: a, successorExternalId: b, type: "FS", lag: 0 });

describe("Task PATCH classification", () => {
  it.each([
    [{ name: "x", description: null, url: null }, false, true, false, false],
    [{ progress: 12 }, false, false, true, false],
    [{ baseline: null }, false, false, false, true],
    [{ start: "2026-09-14", name: "x", baselineStart: null, progress: 12 }, true, true, true, true],
    [{ duration: 1 }, true, false, false, false],
    [{ end: "2026-09-14" }, true, false, false, false],
    [{ scheduleMode: "manual" }, true, false, false, false],
  ])("classifies supplied fields %j", (input, hasSchedule, hasMetadata, hasProgress, hasBaseline) => {
    expect(classifyTaskPatch(input)).toEqual({ hasSchedule, hasMetadata, hasProgress, hasBaseline, unknownFields: [] });
  });
  it("keeps unknown fields visible to callers without authorizing them", () => {
    expect(classifyTaskPatch({ externalId: "unsafe", name: "x" }).unknownFields).toEqual(["externalId"]);
  });
});

describe("full graph Task candidate", () => {
  it("moves successors earlier from requests, derives summaries, preserves inputs and Baseline", () => {
    const links = [link("A", "B"), link("B", "C")];
    const original = recalculateTaskCandidate([task("A", 3), task("B", 2), task("C")], links, calendar).tasks;
    const before = structuredClone(original);
    const changed = original.map(t => t.externalId === "A" ? { ...t, duration: 1 } : t);
    const result = recalculateTaskCandidate(changed, links, calendar);
    expect(result.tasks.map(t => [t.start, t.end])).toEqual([["2026-09-14", "2026-09-14"], ["2026-09-15", "2026-09-16"], ["2026-09-17", "2026-09-17"]]);
    expect(result.tasks.map(t => t.requestedStart)).toEqual(["2026-09-14", "2026-09-14", "2026-09-14"]);
    expect(result.tasks.map(t => t.baselineStart)).toEqual(before.map(t => t.baselineStart));
    expect(original).toEqual(before);
    expect(recalculateTaskCandidate(result.tasks, links, calendar).tasks).toEqual(result.tasks);
  });
  it.each(["FS", "SS", "FF", "SF"] as const)("reuses %s signed lag semantics and strongest bound", (type) => {
    for (const lag of [-2, 0, 2]) {
      const tasks = [task("A", 3), task("B", 2), task("C")];
      const links: DependencyLinkInput[] = [{ ...link("A", "B"), type, lag }, { ...link("C", "B"), type: "FS", lag: 2 }];
      const base = recalculateTaskCandidate(tasks, [], calendar).tasks;
      const expected = recalculateDependencies(base, links, calendar);
      const result = recalculateTaskCandidate(tasks, links, calendar);
      expect(result.tasks.map(t => [t.start, t.end])).toEqual(expected.tasks.map(t => [t.start, t.end]));
      expect(result.manualConflicts).toEqual(expected.manualConflicts);
    }
  });
  it("returns Manual conflicts without replacing fixed dates", () => {
    const fixed = { ...task("B"), scheduleMode: "manual" as const };
    const result = recalculateTaskCandidate([task("A", 3), fixed], [link("A", "B")], calendar);
    expect(result.manualConflicts).toHaveLength(1);
    expect(result.tasks[1].start).toBe(fixed.start);
  });
  it("uses working exceptions and milestone bounds across a year boundary", () => {
    const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], exceptions: [{ date: "2027-01-01", dayType: "NON_WORKING" }, { date: "2027-01-02", dayType: "WORKING" }] });
    const a = { ...task("A"), requestedStart: "2026-12-31" };
    const b = { ...task("B", 0), type: "milestone" as const, requestedStart: "2026-12-31" };
    expect(recalculateTaskCandidate([a, b], [link("A", "B")], calendar).tasks[1]).toMatchObject({ start: "2027-01-02", end: "2027-01-02", duration: 0 });
  });
});
