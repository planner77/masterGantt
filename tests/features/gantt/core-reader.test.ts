import { describe, expect, it } from "vitest";
import type { IApi, ITask } from "@svar-ui/react-gantt";
import { normalizeCanonicalCore, normalizeSerializedCore, readCoreSnapshot, sameCoreSnapshot } from "../../../src/features/gantt/state-consistency";

const leaf = (id: string, parent = 0 as string | number): ITask => ({ id, parent, text: id, type: "task", start: new Date(2026, 0, 1), end: new Date(2026, 0, 2), progress: 0 });
const input = (tasks: unknown[], links: unknown = []) => ({ tasks, tree: tasks, links });

describe("public actual Core reader", () => {
  it("reads all three public collections and keeps collapsed descendants exactly once", () => {
    const child = leaf("B", "A"), summary = { ...leaf("A"), type: "summary", open: false, data: [child] };
    const tasks = [summary, child, leaf("C")];
    const calls: string[] = [];
    const api = { serialize: ({ data }: { data?: string } = {}) => { calls.push(data!); return data === "links" ? [] : tasks; } } as Pick<IApi, "serialize">;
    const result = readCoreSnapshot(api);
    expect(calls).toEqual(["tasks", "tree", "links"]);
    expect(result.ok && result.value.tasks.map(task => task.id)).toEqual(["A", "B", "C"]);
    expect(result.ok && result.value.tree).toEqual([{ id: "A", parent: "0" }, { id: "B", parent: "A" }, { id: "C", parent: "0" }]);
  });
  it("rejects null, thrown reads, duplicate IDs and malformed owned values", () => {
    expect(normalizeSerializedCore({ tasks: null, tree: [], links: [] })).toMatchObject({ ok: false, reason: "INVALID_TASKS" });
    expect(readCoreSnapshot({ serialize: () => { throw new Error("private payload"); } })).toEqual({ ok: false, outcome: "FAILED", reason: "READ_FAILED" });
    expect(normalizeSerializedCore(input([leaf("A"), leaf("A")]))).toMatchObject({ ok: false });
    expect(normalizeSerializedCore(input([{ ...leaf("A"), start: new Date(NaN) }]))).toMatchObject({ ok: false });
    expect(normalizeSerializedCore(input([{ ...leaf("A"), text: {} } as ITask]))).toMatchObject({ ok: false });
    expect(normalizeSerializedCore(input([leaf("A")], null))).toMatchObject({ ok: false, reason: "INVALID_LINKS" });
  });
  it("rejects broken hierarchy, cycles, nested order drift and tree/tasks disagreements", () => {
    for (const tasks of [[leaf("A", "missing")], [leaf("A", "B"), leaf("B", "A")], [leaf("A"), leaf("C"), leaf("B", "A")],
      [{ ...leaf("A"), data: [leaf("C", "A"), leaf("B", "A")] }, leaf("B", "A"), leaf("C", "A")]]) {
      expect(normalizeSerializedCore(input(tasks))).toMatchObject({ ok: false });
    }
    expect(normalizeSerializedCore({ tasks: [leaf("A"), leaf("B")], tree: [leaf("B"), leaf("A")], links: [] })).toMatchObject({ ok: false, reason: "INCONSISTENT_TREE" });
  });
  it("compares sibling order, parent, owned payload and links rather than ID sets", () => {
    const a = normalizeCanonicalCore({ tasks: [leaf("A"), leaf("B")], links: [{ id: "L", source: "A", target: "B", type: "e2s" }] });
    expect(a.ok).toBe(true);
    for (const tasks of [[leaf("B"), leaf("A")], [leaf("A"), leaf("B", "A")], [{ ...leaf("A"), text: "changed" }, leaf("B")]]) {
      const b = normalizeCanonicalCore({ tasks, links: [{ id: "L", source: "A", target: "B", type: "e2s" }] });
      expect(b.ok).toBe(true);
      expect(a.ok && b.ok && sameCoreSnapshot(a.value, b.value)).toBe(false);
    }
    const changedLink = normalizeCanonicalCore({ tasks: [leaf("A"), leaf("B")], links: [{ id: "L", source: "A", target: "B", type: "s2s" }] });
    expect(a.ok && changedLink.ok && sameCoreSnapshot(a.value, changedLink.value)).toBe(false);
    expect(normalizeSerializedCore(input([leaf("A")], [{ id: "L", source: "A", target: "missing" }]))).toMatchObject({ ok: false, reason: "INVALID_LINKS" });
  });
  it("normalizes renderer defaults/milestone end and excludes caches without mutating source", () => {
    const task = { id: "M", type: "milestone", start: new Date(2026, 0, 1) };
    const desired = normalizeCanonicalCore({ tasks: [task], links: [] });
    const actual = normalizeSerializedCore(input([{ ...task, parent: 0, text: "", progress: 0, end: new Date(2026, 0, 2), duration: 0, $x: 36, open: true, data: null }]));
    expect(desired.ok && actual.ok && sameCoreSnapshot(actual.value, desired.value)).toBe(true);
    expect(task).not.toHaveProperty("parent");
    if (actual.ok) {
      expect(Object.isFrozen(actual.value.tasks[0])).toBe(true);
      expect(actual.value.tasks[0]).not.toHaveProperty("$x");
    }
  });
  it("accepts an actual empty collection but never turns unreadable links into empty", () => {
    expect(normalizeSerializedCore({ tasks: [], tree: [], links: [] })).toEqual({ ok: true, value: { tasks: [], tree: [], links: [] } });
    expect(normalizeSerializedCore({ tasks: [], tree: null, links: [] })).toMatchObject({ ok: false, reason: "INVALID_TREE" });
  });
});
