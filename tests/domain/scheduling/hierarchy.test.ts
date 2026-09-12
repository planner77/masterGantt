import { describe, expect, it } from "vitest";
import { createWorkingCalendar, recalculateHierarchy, scheduleLeaf, MAX_HIERARCHY_DEPTH, MAX_HIERARCHY_TASKS, type HierarchyTaskInput } from "../../../src/domain/scheduling";

const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-14" }] });
function leaf(id: string, overrides: Partial<HierarchyTaskInput> = {}): HierarchyTaskInput {
  return { taskId: `id-${id}`, externalId: id, parentExternalId: null, siblingOrder: 0,
    ...scheduleLeaf({ type: "task", requestedStart: "2026-09-11", duration: 1 }, calendar), progress: 0, ...overrides };
}
function summary(id: string, overrides: Partial<HierarchyTaskInput> = {}): HierarchyTaskInput {
  return leaf(id, { type: "summary", requestedStart: null, ...overrides });
}
function hasCode(code: string) { return expect.objectContaining({ name: "SchedulingError", code }); }

describe("pure hierarchy calculation", () => {
  it("returns empty snapshot, input ordering, extra fields and frozen results without mutation", () => {
    expect(recalculateHierarchy([], calendar)).toEqual([]);
    const tasks = [Object.freeze({ ...leaf("child", { parentExternalId: "parent" }), name: "Preserved" }), Object.freeze(summary("parent"))];
    Object.freeze(tasks);
    const before = structuredClone(tasks);
    const result = recalculateHierarchy(tasks, calendar);
    expect(tasks).toEqual(before);
    expect(result[0]).toMatchObject({ taskId: "id-child", name: "Preserved", wbs: "1.1" });
    expect(result[1]).toMatchObject({ taskId: "id-parent", wbs: "1" });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.every(Object.isFrozen)).toBe(true);
    expect(recalculateHierarchy(result, calendar)).toEqual(result);
  });

  it("derives nested summaries using leaf weights, not summary spans, across weekends and holiday", () => {
    const tasks = [summary("root", { progress: 99, duration: 999, scheduleMode: "manual" }),
      summary("nested", { parentExternalId: "root" }),
      leaf("done", { parentExternalId: "nested", progress: 100 }),
      leaf("work", { parentExternalId: "root", siblingOrder: 1, start: "2026-09-15", end: "2026-09-16", duration: 2 }),
      leaf("marker", { parentExternalId: "nested", siblingOrder: 1, type: "milestone", duration: 0, progress: 100 }),
    ];
    const result = recalculateHierarchy(tasks, calendar);
    expect(result[0]).toMatchObject({ start: "2026-09-11", end: "2026-09-16", duration: 3, progress: 100 / 3, scheduleMode: "auto", requestedStart: null });
    expect(result[1]).toMatchObject({ duration: 1, progress: 100 });
    expect(result[2]).toMatchObject({ wbs: "1.1.1" });
    expect(result[3]).toMatchObject({ wbs: "1.2" });
  });

  it("averages all descendant milestones by count without double-weighting nested summary", () => {
    const result = recalculateHierarchy([summary("root"), summary("nested", { parentExternalId: "root" }),
      leaf("one", { type: "milestone", duration: 0, parentExternalId: "nested", progress: 100 }),
      leaf("two", { type: "milestone", duration: 0, parentExternalId: "nested", siblingOrder: 1, progress: 50 }),
      leaf("three", { type: "milestone", duration: 0, parentExternalId: "root", siblingOrder: 1, progress: 0 }),
    ], calendar);
    expect(result[0]).toMatchObject({ duration: 1, progress: 50 });
    expect(result[1].progress).toBe(75);
  });

  it("recalculates ancestors after a leaf update and deletion, preserving other leaf manual intent", () => {
    const tasks = [summary("root"), summary("nested", { parentExternalId: "root" }),
      leaf("first", { parentExternalId: "nested", scheduleMode: "manual", progress: 20.5 }),
      leaf("last", { parentExternalId: "nested", siblingOrder: 1, ...scheduleLeaf({ type: "task", requestedStart: "2026-09-15", duration: 2 }, calendar) })];
    expect(recalculateHierarchy(tasks, calendar)[0]).toMatchObject({ end: "2026-09-16", progress: 20.5 / 3 });
    const deleted = recalculateHierarchy(tasks.slice(0, 3), calendar);
    expect(deleted[0]).toMatchObject({ end: "2026-09-11", progress: 20.5 });
    expect(deleted[2]).toMatchObject({ scheduleMode: "manual", requestedStart: "2026-09-11" });
  });

  it("computes stable sibling WBS from stored order with gaps and unordered input", () => {
    const result = recalculateHierarchy([leaf("b", { siblingOrder: 8 }), summary("a", { siblingOrder: 3 }),
      leaf("a2", { parentExternalId: "a", siblingOrder: 10 }), leaf("a1", { parentExternalId: "a", siblingOrder: 2 })], calendar);
    expect(result.map((task) => task.wbs)).toEqual(["2", "1", "1.2", "1.1"]);
  });

  it.each([null, undefined, {}, 1, "tasks"])("rejects non-array input %s", (input) => {
    expect(() => recalculateHierarchy(input as unknown as HierarchyTaskInput[], calendar)).toThrow(hasCode("INVALID_HIERARCHY_INPUT"));
  });
  it.each([
    ["duplicate task id", [leaf("a"), leaf("b", { taskId: "id-a", siblingOrder: 1 })], "DUPLICATE_TASK_ID"],
    ["duplicate external id", [leaf("a"), leaf("a", { taskId: "other", siblingOrder: 1 })], "DUPLICATE_EXTERNAL_ID"],
    ["missing parent", [leaf("a", { parentExternalId: "missing" })], "MISSING_PARENT"],
    ["self parent", [summary("a", { parentExternalId: "a" })], "PARENT_CYCLE"],
    ["cycle and descendant", [summary("a", { parentExternalId: "b" }), summary("b", { parentExternalId: "a" }), leaf("c", { parentExternalId: "a", siblingOrder: 1 })], "PARENT_CYCLE"],
    ["task parent", [leaf("a"), leaf("b", { parentExternalId: "a" })], "INVALID_PARENT_TYPE"],
    ["milestone parent", [leaf("a", { type: "milestone", duration: 0 }), leaf("b", { parentExternalId: "a" })], "INVALID_PARENT_TYPE"],
    ["empty summary", [summary("a")], "EMPTY_SUMMARY"],
    ["negative order", [leaf("a", { siblingOrder: -1 })], "INVALID_SIBLING_ORDER"],
    ["fractional order", [leaf("a", { siblingOrder: 0.1 })], "INVALID_SIBLING_ORDER"],
    ["duplicate sibling order", [leaf("a"), leaf("b")], "DUPLICATE_SIBLING_ORDER"],
    ["invalid progress", [leaf("a", { progress: NaN })], "INVALID_PROGRESS"],
    ["out of range progress", [leaf("a", { progress: 100.1 })], "INVALID_PROGRESS"],
    ["wrong duration", [leaf("a", { duration: 2 })], "END_DURATION_MISMATCH"],
    ["milestone dates differ", [leaf("a", { type: "milestone", duration: 0, end: "2026-09-15" })], "END_DURATION_MISMATCH"],
    ["non-working start", [leaf("a", { start: "2026-09-12", end: "2026-09-15" })], "NON_WORKING_START"],
    ["non-working end", [leaf("a", { end: "2026-09-14" })], "END_DURATION_MISMATCH"],
  ] as const)("rejects %s atomically", (_name, tasks, code) => {
    const before = structuredClone(tasks);
    expect(() => recalculateHierarchy(tasks, calendar)).toThrow(hasCode(code));
    expect(tasks).toEqual(before);
  });

  it("enforces size and depth without recursive traversal overflow", () => {
    expect(() => recalculateHierarchy(Array.from({ length: MAX_HIERARCHY_TASKS + 1 }, (_, i) => leaf(String(i), { siblingOrder: i })), calendar)).toThrow(hasCode("HIERARCHY_TASK_LIMIT_EXCEEDED"));
    const deep = (size: number) => Array.from({ length: size }, (_, i) => (i === size - 1 ? leaf : summary)(String(i), { parentExternalId: i === 0 ? null : String(i - 1) }));
    expect(recalculateHierarchy(deep(MAX_HIERARCHY_DEPTH), calendar)).toHaveLength(MAX_HIERARCHY_DEPTH);
    expect(() => recalculateHierarchy(deep(MAX_HIERARCHY_DEPTH + 1), calendar)).toThrow(hasCode("HIERARCHY_DEPTH_EXCEEDED"));
  });

  it("accepts the maximum snapshot size and a bounded multi-century summary span", () => {
    const tasks = [summary("root"), ...Array.from({ length: MAX_HIERARCHY_TASKS - 1 }, (_, i) => leaf(String(i), {
      parentExternalId: "root", siblingOrder: i,
      ...scheduleLeaf({ type: "task", requestedStart: i === 0 ? "1900-01-01" : "2199-12-31", duration: 1 }, calendar),
    }))];
    const result = recalculateHierarchy(tasks, calendar);
    expect(result).toHaveLength(MAX_HIERARCHY_TASKS);
    expect(result[0]).toMatchObject({ start: "1900-01-01", end: "2199-12-31" });
    expect(result[0].duration).toBeGreaterThan(10_000); // Summary span is not a leaf-duration limit.
  });
});
