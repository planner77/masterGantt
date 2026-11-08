import { describe, expect, it } from "vitest";
import type { IApi, ITask } from "@svar-ui/react-gantt";
import { normalizeCanonicalCore, normalizeSerializedCore, readCoreSnapshot, sameCoreSnapshot } from "../../../src/features/gantt/state-consistency";
import { expectedPresentationOrder } from "../../../src/features/gantt/state-consistency/presentation-sort";

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
  it("fills omitted canonical summary roll-up dates recursively but still detects actual Core date drift", () => {
    const child = leaf("child", "inner");
    const root = { id: "root", text: "root", type: "summary", parent: 0 };
    const inner = { id: "inner", text: "inner", type: "summary", parent: "root" };
    const canonical = normalizeCanonicalCore({ tasks: [root, inner, child], links: [] });
    const actual = normalizeSerializedCore(input([
      { ...root, start: child.start, end: child.end },
      { ...inner, start: child.start, end: child.end }, child,
    ]));
    expect(canonical.ok && actual.ok && sameCoreSnapshot(actual.value, canonical.value)).toBe(true);
    const drifted = normalizeSerializedCore(input([
      { ...root, start: new Date(2026, 0, 3), end: child.end },
      { ...inner, start: child.start, end: child.end }, child,
    ]));
    expect(canonical.ok && drifted.ok && sameCoreSnapshot(drifted.value, canonical.value)).toBe(false);
    expect(root).not.toHaveProperty("start");
    expect(inner).not.toHaveProperty("end");
  });
  it("accepts an actual empty collection but never turns unreadable links into empty", () => {
    expect(normalizeSerializedCore({ tasks: [], tree: [], links: [] })).toEqual({ ok: true, value: { tasks: [], tree: [], links: [] } });
    expect(normalizeSerializedCore({ tasks: [], tree: null, links: [] })).toMatchObject({ ok: false, reason: "INVALID_TREE" });
  });

  it("normalizes only an independently expected presentation tree while preserving the canonical task order", () => {
    const tasks = [leaf("Z"), leaf("A"), leaf("B")];
    const expectedTreeOrder = expectedPresentationOrder(tasks, [{ id: "text" }], [{ key: "text", order: "asc" }])!;
    const sortedTree = [tasks[1], tasks[2], tasks[0]];
    const desired = normalizeCanonicalCore({ tasks, links: [] });
    expect(normalizeSerializedCore({ tasks, tree: sortedTree, links: [] })).toMatchObject({ ok: false, reason: "INCONSISTENT_TREE" });
    const actual = normalizeSerializedCore({ tasks: sortedTree, tree: sortedTree, links: [] }, { expectedTreeOrder, canonicalTaskOrder: tasks.map(task => String(task.id)) });
    expect(actual.ok && desired.ok && sameCoreSnapshot(actual.value, desired.value)).toBe(true);
    expect(actual.ok && actual.value.tasks.map(task => task.id)).toEqual(["Z", "A", "B"]);
    expect(actual.ok && actual.value.tree.map(task => task.id)).toEqual(["Z", "A", "B"]);
    const read = readCoreSnapshot({ serialize: config => (config?.data === "tree" || config?.data === "tasks" ? sortedTree : []) } as Pick<IApi, "serialize">, { expectedTreeOrder, canonicalTaskOrder: tasks.map(task => String(task.id)) });
    expect(read).toEqual(actual);
  });

  it("keeps exact sort order, branch membership, IDs and tree owned payload guards", () => {
    const tasks = [
      { ...leaf("Z"), type: "summary" }, leaf("child2", "Z"), leaf("child1", "Z"), leaf("A"),
    ];
    const expectedTreeOrder = expectedPresentationOrder(tasks, [{ id: "text" }], [{ key: "text", order: "asc" }])!;
    const byId = new Map(tasks.map(task => [String(task.id), task]));
    const sortedTree = expectedTreeOrder.map(id => byId.get(id)!);
    const options = { expectedTreeOrder, canonicalTaskOrder: tasks.map(task => String(task.id)) };
    expect(normalizeSerializedCore({ tasks: sortedTree, tree: sortedTree, links: [] }, options).ok).toBe(true);
    for (const tree of [
      tasks,
      [sortedTree[1], sortedTree[0], ...sortedTree.slice(2)],
      [...sortedTree.slice(0, -1), sortedTree[0]],
      sortedTree.slice(1),
      sortedTree.map((task, index) => index === 0 ? { ...task, id: "foreign" } : task),
      sortedTree.map(task => task.id === "child1" ? { ...task, parent: "A" } : task),
      sortedTree.map((task, index) => index === 0 ? { ...task, text: "changed" } : task),
      sortedTree.map((task, index) => index === 0 ? { ...task, start: new Date(2030, 0, 1) } : task),
    ]) expect(normalizeSerializedCore({ tasks: sortedTree, tree, links: [] }, options).ok).toBe(false);
    expect(normalizeSerializedCore({ tasks: sortedTree, tree: sortedTree, links: [] }, { ...options, expectedTreeOrder: ["foreign", ...expectedTreeOrder.slice(1)] }).ok).toBe(false);
    expect(normalizeSerializedCore({ tasks: sortedTree, tree: sortedTree, links: [] }, { ...options, expectedTreeOrder: [...expectedTreeOrder, "foreign"] }).ok).toBe(false);
    expect(normalizeSerializedCore({ tasks: sortedTree, tree: sortedTree, links: [{ id: "L", source: "A", target: "missing" }] }, options)).toMatchObject({ ok: false, reason: "INVALID_LINKS" });
  });

  it("does not erase matching task/tree payload or link drift from the canonical conformance comparison", () => {
    const tasks = [leaf("B"), leaf("A")];
    const expectedTreeOrder = ["A", "B"];
    const desired = normalizeCanonicalCore({ tasks, links: [{ id: "L", source: "A", target: "B", type: "e2s" }] });
    for (const change of ["text", "date", "parent", "link"] as const) {
      const changed = tasks.map(task => ({ ...task }));
      if (change === "text") changed[0].text = "drift";
      if (change === "date") changed[0].end = new Date(2030, 0, 1);
      if (change === "parent") changed[0].parent = "A";
      const links = [{ id: "L", source: "A", target: "B", type: change === "link" ? "s2s" : "e2s" }];
      const result = normalizeSerializedCore({ tasks: [changed[1], changed[0]], tree: [changed[1], changed[0]], links }, { expectedTreeOrder, canonicalTaskOrder: tasks.map(task => String(task.id)) });
      expect(!result.ok || desired.ok && !sameCoreSnapshot(result.value, desired.value)).toBe(true);
    }
  });

  it("separates raw sorted observations from server-order semantic verification without inventing an old-generation source order", () => {
    const desiredTasks = [leaf("Z"), leaf("A"), leaf("B")];
    const sorted = [desiredTasks[1], desiredTasks[2], desiredTasks[0]];
    const expectedTreeOrder = expectedPresentationOrder(desiredTasks, [{ id: "text" }], [{ key: "text", order: "asc" }])!;
    const raw = normalizeSerializedCore({ tasks: sorted, tree: sorted, links: [] });
    expect(normalizeSerializedCore({ tasks: sorted, tree: sorted, links: [] }, { expectedTreeOrder }).ok).toBe(false);
    expect(normalizeSerializedCore({ tasks: sorted, tree: sorted, links: [] }, { canonicalTaskOrder: desiredTasks.map(task => String(task.id)) }).ok).toBe(false);
    expect(raw.ok && raw.value.tasks.map(task => task.id)).toEqual(["A", "B", "Z"]);
    const verified = normalizeSerializedCore({ tasks: sorted, tree: sorted, links: [] }, {
      expectedTreeOrder, canonicalTaskOrder: desiredTasks.map(task => String(task.id)),
    });
    const desired = normalizeCanonicalCore({ tasks: desiredTasks, links: [] });
    expect(verified.ok && desired.ok && sameCoreSnapshot(verified.value, desired.value)).toBe(true);
    // The actual/old snapshot remains readable for a real add/delete drift;
    // only current-generation semantic approval requires exact expected IDs.
    const older = sorted.slice(0, -1);
    expect(normalizeSerializedCore({ tasks: older, tree: older, links: [] }).ok).toBe(true);
    expect(normalizeSerializedCore({ tasks: older, tree: older, links: [] }, {
      expectedTreeOrder, canonicalTaskOrder: desiredTasks.map(task => String(task.id)),
    }).ok).toBe(false);
    expect(normalizeSerializedCore({ tasks: sorted, tree: sorted, links: [] }, {
      expectedTreeOrder, canonicalTaskOrder: ["A", "Z", "foreign"],
    }).ok).toBe(false);
    expect(normalizeSerializedCore({ tasks: sorted, tree: sorted, links: [] }, {
      expectedTreeOrder, canonicalTaskOrder: ["A", "A", "Z"],
    }).ok).toBe(false);
    const wrongPermutation = [sorted[1], sorted[0], sorted[2]];
    expect(normalizeSerializedCore({ tasks: wrongPermutation, tree: wrongPermutation, links: [] }, {
      expectedTreeOrder, canonicalTaskOrder: desiredTasks.map(task => String(task.id)),
    }).ok).toBe(false);
  });
});
