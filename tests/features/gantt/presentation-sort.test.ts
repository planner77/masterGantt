import { describe, expect, it } from "vitest";
import type { IColumnConfig, ITask } from "@svar-ui/react-gantt";
import { expectedPresentationOrder, mergePresentationSort, type PresentationSortClause } from "../../../src/features/gantt/state-consistency/presentation-sort";

const leaf = (id: string, text = id, parent: string | number = 0): ITask => ({ id, parent, text, type: "task" });
const textColumns: IColumnConfig[] = [{ id: "text", sort: true }];
const asc = (key: string): PresentationSortClause => ({ key, order: "asc" });
const desc = (key: string): PresentationSortClause => ({ key, order: "desc" });

describe("independent canonical presentation sort", () => {
  it("keeps canonical exact preorder without active sorting, independent of collapse or renderer caches", () => {
    const tasks = [{ ...leaf("root"), type: "summary", open: false }, { ...leaf("child", "Z", "root"), $y: 900 }, leaf("last", "A")];
    expect(expectedPresentationOrder(tasks, textColumns, [])).toEqual(["root", "child", "last"]);
  });

  it("sorts each sibling branch using numeric-aware strings without flattening descendants", () => {
    const tasks = [
      { ...leaf("g10", "Group 10"), type: "summary" }, leaf("t10", "Task 10", "g10"), leaf("t2", "Task 2", "g10"),
      { ...leaf("g2", "Group 2"), type: "summary" }, leaf("t1", "Task 1", "g2"),
    ];
    const before = JSON.stringify(tasks);
    expect(expectedPresentationOrder(tasks, textColumns, [asc("text")])).toEqual(["g2", "t1", "g10", "t2", "t10"]);
    expect(expectedPresentationOrder(tasks, textColumns, [desc("text")])).toEqual(["g10", "t10", "t2", "g2", "t1"]);
    expect(JSON.stringify(tasks)).toBe(before);
  });

  it("uses public column getters and custom comparators rather than rendered strings", () => {
    const tasks = [leaf("A", "native Z"), leaf("B", "native A"), leaf("C", "native B")];
    const values = new Map([["A", 30], ["B", 10], ["C", 20]]);
    const getterColumns: IColumnConfig[] = [{ id: "duration", getter: task => values.get(String(task.id)) }];
    expect(expectedPresentationOrder(tasks, getterColumns, [asc("duration")])).toEqual(["B", "C", "A"]);
    const comparatorColumns: IColumnConfig[] = [{ id: "duration", getter: () => -999,
      sort: (left, right) => Math.sign(values.get(String(left.id))! - values.get(String(right.id))!) as -1 | 0 | 1 }];
    expect(expectedPresentationOrder(tasks, comparatorColumns, [desc("duration")])).toEqual(["A", "C", "B"]);
  });

  it("matches scalar default ordering for numbers, nulls, dates and literal public keys", () => {
    const tasks = [
      { ...leaf("A"), value: 10, at: new Date(2026, 0, 3), "nested.rank": 30 },
      { ...leaf("B"), value: null, at: null, "nested.rank": 10 },
      { ...leaf("C"), value: 2, at: new Date(2026, 0, 1), "nested.rank": 20 },
    ];
    expect(expectedPresentationOrder(tasks, [{ id: "value" }], [asc("value")])).toEqual(["B", "C", "A"]);
    expect(expectedPresentationOrder(tasks, [{ id: "at" }], [asc("at")])).toEqual(["C", "A", "B"]);
    expect(expectedPresentationOrder(tasks, [{ id: "at" }], [desc("at")])).toEqual(["B", "A", "C"]);
    expect(expectedPresentationOrder(tasks, [{ id: "nested.rank" }], [asc("nested.rank")])).toEqual(["B", "C", "A"]);
  });

  it("compacts stable tie history to distinct known column keys and preserves prior tie order", () => {
    const tasks = [
      { ...leaf("A"), group: "same", rank: 2 },
      { ...leaf("B"), group: "same", rank: 1 },
      { ...leaf("C"), group: "z", rank: 0 },
    ];
    const columns = [{ id: "group" }, { id: "rank" }];
    const prior = mergePresentationSort([asc("rank")], [], ["group", "rank"]);
    const effective = mergePresentationSort([asc("group")], prior, ["group", "rank"]);
    expect(effective).toEqual([asc("group"), asc("rank")]);
    expect(expectedPresentationOrder(tasks, columns, effective)).toEqual(["B", "A", "C"]);
    expect(mergePresentationSort([desc("rank"), asc("group")], effective, ["group", "rank"])).toEqual([desc("rank"), asc("group")]);
    expect(mergePresentationSort([], effective, ["group", "rank"])).toEqual([]);
    let history: readonly PresentationSortClause[] = [];
    for (let index = 0; index < 1000; index++) history = mergePresentationSort([index % 2 ? asc("rank") : desc("group")], history, ["group", "rank"]);
    expect(history).toHaveLength(2);
    expect(mergePresentationSort([asc("unknown")], history, ["group", "rank"])).toHaveLength(2);
    expect(Object.isFrozen(history)).toBe(true);
  });

  it("retains canonical tie order as the final stable tie breaker", () => {
    const tasks = [{ ...leaf("Z"), rank: 1 }, { ...leaf("A"), rank: 1 }, { ...leaf("B"), rank: 1 }];
    expect(expectedPresentationOrder(tasks, [{ id: "rank" }], [asc("rank")])).toEqual(["Z", "A", "B"]);
  });

  it("rejects missing/duplicate/foreign parents, cycles and non-preorder canonical input", () => {
    for (const tasks of [
      [leaf("A"), leaf("A")], [leaf("A", "A", "missing")],
      [leaf("A", "A", "B"), leaf("B", "B", "A")], [leaf("A"), leaf("B"), leaf("child", "child", "A")],
      [{ ...leaf("A"), id: Number.NaN }],
    ]) expect(expectedPresentationOrder(tasks, textColumns, [asc("text")])).toBeNull();
  });

  it("fails closed for malformed descriptors, poisoned keys, throwing getters or non-finite comparators", () => {
    const tasks = [leaf("A"), leaf("B")];
    expect(expectedPresentationOrder(tasks, textColumns, [asc("text"), desc("text")])).toBeNull();
    expect(expectedPresentationOrder(tasks, textColumns, [asc("constructor")])).toBeNull();
    expect(expectedPresentationOrder(tasks, [{ id: "x", getter: () => { throw new Error("bad getter"); } }], [asc("x")])).toBeNull();
    expect(expectedPresentationOrder(tasks, [{ id: "x", sort: (() => Number.NaN) as never }], [asc("x")])).toBeNull();
    expect(expectedPresentationOrder(tasks, [{ id: "x", getter: () => ({ unsupported: true }) }], [asc("x")])).toBeNull();
  });
});
