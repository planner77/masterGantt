import { describe, expect, it } from "vitest";
import {
  createWorkingCalendar, MAX_HIERARCHY_DEPTH, MAX_HIERARCHY_TASKS,
  recalculateDependencies, recalculateHierarchy, scheduleLeaf,
  type DependencyLinkInput, type HierarchyTaskInput,
} from "../../../src/domain/scheduling";
import { recalculateTaskCandidate } from "../../../src/domain/scheduling/task-candidate";

const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-14" }] });
const emptySchedule = {
  requestedStart: null, start: null, end: null, duration: null, progress: null,
  scheduleMode: "auto", baselineStart: null, baselineEnd: null, baselineDuration: null,
};
function summary(id: string, parent: string | null = null, order = 0): HierarchyTaskInput {
  return { taskId: id, externalId: id, parentExternalId: parent, siblingOrder: order,
    type: "summary", requestedStart: null, start: null, end: null, duration: null,
    progress: null, scheduleMode: "auto" };
}
function leaf(id: string, parent: string | null, order = 0, overrides: Partial<HierarchyTaskInput> = {}): HierarchyTaskInput {
  return { taskId: id, externalId: id, parentExternalId: parent, siblingOrder: order,
    ...scheduleLeaf({ type: "task", requestedStart: "2026-09-11", duration: 1 }, calendar),
    progress: 50, baselineStart: "2026-09-11", baselineEnd: "2026-09-11", baselineDuration: 1,
    ...overrides };
}
const code = (value: string) => expect.objectContaining({ name: "SchedulingError", code: value });

describe("empty Summary is a structural WBS container", () => {
  it("derives null schedules and baselines for root/nested containers without artificial dates", () => {
    const tasks = [
      { ...summary("parent"), name: "상위", description: "유지", url: "https://example.test", start: "2026-09-11", end: "2026-09-11", duration: 1, progress: 100, baselineStart: "2026-09-11", baselineEnd: "2026-09-11", baselineDuration: 1 },
      summary("child", "parent"), summary("root", null, 1),
    ];
    const before = structuredClone(tasks);
    const result = recalculateHierarchy(tasks, calendar);
    expect(result.map(t => t.wbs)).toEqual(["1", "1.1", "2"]);
    for (const task of result) expect(task).toMatchObject({ type: "summary", ...emptySchedule });
    expect(result[0]).toMatchObject({ taskId: "parent", name: "상위", description: "유지", url: "https://example.test" });
    expect(tasks).toEqual(before);
    expect(recalculateHierarchy(result, calendar)).toEqual(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.every(Object.isFrozen)).toBe(true);
  });

  it("ignores empty branches in dated leaf progress and complete baseline aggregation", () => {
    const result = recalculateHierarchy([
      summary("parent"), summary("empty-first", "parent"),
      summary("nested-empty", "empty-first"), summary("dated", "parent", 1),
      leaf("one", "dated", 0, { progress: 100 }),
      leaf("two", "parent", 2, {
        ...scheduleLeaf({ type: "task", requestedStart: "2026-09-15", duration: 2 }, calendar), progress: 0,
        baselineStart: "2026-09-15", baselineEnd: "2026-09-16", baselineDuration: 2,
      }),
      summary("empty-last", "parent", 3),
    ], calendar);
    expect(result[0]).toMatchObject({ start: "2026-09-11", end: "2026-09-16", duration: 3, progress: 100 / 3,
      baselineStart: "2026-09-11", baselineEnd: "2026-09-16", baselineDuration: 3 });
    expect(result[1]).toMatchObject(emptySchedule);
    expect(result[2]).toMatchObject(emptySchedule);
    expect(result[6]).toMatchObject(emptySchedule);
  });

  it("does not let empty containers conceal an actual leaf missing baseline", () => {
    const result = recalculateHierarchy([summary("parent"), summary("empty", "parent"),
      leaf("one", "parent", 1, { baselineStart: null, baselineEnd: null, baselineDuration: null })], calendar);
    expect(result[0]).toMatchObject({ baselineStart: null, baselineEnd: null, baselineDuration: null, progress: 50 });
  });

  it("counts zero-duration Milestones as dated leaves and averages nested Milestones only once", () => {
    const result = recalculateHierarchy([summary("parent"), summary("empty", "parent"), summary("nested", "parent", 1),
      leaf("one", "nested", 0, { type: "milestone", duration: 0, baselineDuration: 0, progress: 100 }),
      leaf("two", "nested", 1, { type: "milestone", duration: 0, baselineDuration: 0, progress: 50 }),
      leaf("three", "parent", 2, { type: "milestone", duration: 0, baselineDuration: 0, progress: 0 })], calendar);
    expect(result[0]).toMatchObject({ start: "2026-09-11", end: "2026-09-11", duration: 1, progress: 50 });
    expect(result[2].progress).toBe(75);
    expect(result[1]).toMatchObject(emptySchedule);
  });

  it("adds the first leaf then deletes the last leaf without replacing parent identities or hierarchy", () => {
    const containers = [summary("parent"), summary("nested", "parent")];
    const scheduled = recalculateHierarchy([...containers, leaf("one", "nested")], calendar);
    expect(scheduled[0]).toMatchObject({ duration: 1, progress: 50 });
    const deleted = recalculateHierarchy(scheduled.filter(t => t.taskId !== "one"), calendar);
    expect(deleted.map(t => [t.taskId, t.type, t.parentExternalId, t.wbs])).toEqual([
      ["parent", "summary", null, "1"], ["nested", "summary", "parent", "1.1"],
    ]);
    for (const task of deleted) expect(task).toMatchObject(emptySchedule);
  });

  it("recalculates old/new ancestors when the last leaf is reparented", () => {
    const scheduled = recalculateHierarchy([summary("old"), summary("new", null, 1), leaf("one", "old")], calendar);
    const moved = recalculateHierarchy(scheduled.map(t => t.taskId === "one" ? { ...t, parentExternalId: "new" } : t), calendar);
    expect(moved[0]).toMatchObject({ taskId: "old", type: "summary", ...emptySchedule });
    expect(moved[1]).toMatchObject({ taskId: "new", type: "summary", duration: 1, progress: 50 });
    expect(moved[2]).toMatchObject({ parentExternalId: "new", wbs: "2.1", baselineStart: "2026-09-11" });
  });

  it("supports bounded all-container trees without calendar spans or recursion", () => {
    const roots = Array.from({ length: MAX_HIERARCHY_TASKS }, (_, index) => summary(String(index), null, index));
    const deep = Array.from({ length: MAX_HIERARCHY_DEPTH }, (_, index) => summary(String(index), index === 0 ? null : String(index - 1)));
    expect(recalculateHierarchy(roots, calendar)).toHaveLength(MAX_HIERARCHY_TASKS);
    const result = recalculateHierarchy(deep, calendar);
    expect(result.at(-1)).toMatchObject(emptySchedule);
    expect(result.at(-1)?.wbs.split(".")).toHaveLength(MAX_HIERARCHY_DEPTH);
    expect(() => recalculateHierarchy([...deep, summary("overflow", String(MAX_HIERARCHY_DEPTH - 1))], calendar)).toThrow(code("HIERARCHY_DEPTH_EXCEEDED"));
  });

  it.each([
    ["start", "INVALID_DATE"], ["end", "INVALID_DATE"], ["requestedStart", "INVALID_DATE"],
    ["duration", "INVALID_DURATION"], ["progress", "INVALID_PROGRESS"],
  ] as const)("keeps required leaf %s strict", (field, error) => {
    const tasks = [summary("parent"), leaf("one", "parent", 0, { [field]: null })];
    const before = structuredClone(tasks);
    expect(() => recalculateHierarchy(tasks, calendar)).toThrow(code(error));
    expect(tasks).toEqual(before);
  });
});

describe("empty Summary with Dependency candidate orchestration", () => {
  const edge: DependencyLinkInput = { id: "edge", predecessorExternalId: "one", successorExternalId: "two", type: "FS", lag: 0 };
  it("preserves empty containers while scheduling a leaf dependency graph", () => {
    const tasks = [summary("empty"), summary("parent", null, 1), leaf("one", "parent"), leaf("two", null, 2)];
    const before = structuredClone(tasks);
    const result = recalculateTaskCandidate(tasks, [edge], calendar);
    expect(result.tasks[0]).toMatchObject({ type: "summary", ...emptySchedule });
    expect(result.tasks[3]).toMatchObject({ start: "2026-09-15", end: "2026-09-15" });
    expect(result.manualConflicts).toEqual([]);
    expect(tasks).toEqual(before);
    expect(recalculateTaskCandidate(result.tasks, [edge], calendar).tasks).toEqual(result.tasks);
  });
  it("supports projects consisting exclusively of summaries", () => {
    const tasks = [summary("parent"), summary("empty", "parent")];
    const result = recalculateTaskCandidate(tasks, [], calendar);
    expect(result.tasks.map(t => t.wbs)).toEqual(["1", "1.1"]);
    for (const task of result.tasks) expect(task).toMatchObject(emptySchedule);
    expect(result.manualConflicts).toEqual([]);
  });
  it("keeps Summary endpoints prohibited despite nullable schedules", () => {
    expect(() => recalculateDependencies([summary("empty"), leaf("two", null, 1)], [{ ...edge, predecessorExternalId: "empty" }], calendar)).toThrow(code("SUMMARY_DEPENDENCY_ENDPOINT"));
  });
  it.each(["start", "end", "duration"] as const)("rejects nullable %s on dependency leaves even without links", (field) => {
    expect(() => recalculateDependencies([leaf("one", null, 0, { [field]: null })], [], calendar)).toThrow(code(field === "duration" ? "INVALID_DURATION" : "INVALID_DATE"));
  });
});
