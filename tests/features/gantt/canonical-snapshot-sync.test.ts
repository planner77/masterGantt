import { describe, expect, it } from "vitest";

import { applyCanonicalGanttSync, planCanonicalGanttSync } from "../../../src/features/gantt/canonical-snapshot-sync";

describe("canonical SVAR snapshot sync", () => {
  it("preserves unchanged rendered tasks while planning only server-confirmed additions", () => {
    const root = { id: "root", text: "Root", start: new Date(2026, 8, 14), end: new Date(2026, 8, 15), parent: 0 };
    const child = { id: "child", text: "New", start: new Date(2026, 8, 15), end: new Date(2026, 8, 16), parent: "root" };
    const plan = planCanonicalGanttSync({ tasks: [root], links: [] }, { tasks: [root, child], links: [] });

    expect(plan).toMatchObject({ deletedTaskIds: [], updatedTasks: [], addedTasks: [child], replaceLinks: false });
  });

  it("updates canonical parent summaries and replaces changed links without duplicate task adds", () => {
    const current = { id: "summary", text: "Parent", start: new Date(2026, 8, 14), end: new Date(2026, 8, 15), parent: 0, type: "task" };
    const canonical = { ...current, type: "summary", end: new Date(2026, 8, 16) };
    const plan = planCanonicalGanttSync(
      { tasks: [current], links: [{ id: "old", source: "a", target: "b", type: "e2s" }] },
      { tasks: [canonical], links: [{ id: "new", source: "a", target: "summary", type: "e2s" }] },
    );

    expect(plan.updatedTasks).toEqual([canonical]);
    expect(plan.addedTasks).toEqual([]);
    expect(plan.replaceLinks).toBe(true);
  });

  it("does not rewrite a task only because Core derived its duration", () => {
    const canonical = { id: "task", text: "Task", start: new Date(2026, 8, 14), end: new Date(2026, 8, 16), parent: 0 };
    const current = { ...canonical, duration: 2 };

    expect(planCanonicalGanttSync({ tasks: [current], links: [] }, { tasks: [canonical], links: [] }))
      .toMatchObject({ deletedTaskIds: [], updatedTasks: [], addedTasks: [] });
  });

  it("does not rewrite an existing summary only because its user-controlled open state differs", () => {
    const canonical = { id: "summary", text: "Summary", start: new Date(2026, 8, 14), end: new Date(2026, 8, 16), parent: 0, type: "summary", open: true };
    const collapsed = { ...canonical, open: false };

    expect(planCanonicalGanttSync({ tasks: [collapsed], links: [] }, { tasks: [canonical], links: [] }))
      .toMatchObject({ deletedTaskIds: [], updatedTasks: [], addedTasks: [] });
  });

  it("plans removed IDs once and becomes idempotent after the canonical state is applied", () => {
    const removed = { id: "removed", text: "Removed", start: new Date(2026, 8, 14), end: new Date(2026, 8, 15), parent: 0 };
    const kept = { id: "kept", text: "Kept", start: new Date(2026, 8, 14), end: new Date(2026, 8, 15), parent: 0 };
    const first = planCanonicalGanttSync({ tasks: [removed, kept], links: [] }, { tasks: [kept], links: [] });
    const second = planCanonicalGanttSync({ tasks: [kept], links: [] }, { tasks: [kept], links: [] });

    expect(first.deletedTaskIds).toEqual(["removed"]);
    expect(second).toMatchObject({ deletedTaskIds: [], updatedTasks: [], addedTasks: [], replaceLinks: false });
  });

  it("orders subtree removals child-first so Core never deletes a rendered summary before its descendants", () => {
    const root = { id: "root", text: "Root", start: new Date(2026, 8, 14), end: new Date(2026, 8, 19), parent: 0, type: "summary" };
    const branch = { id: "branch", text: "Branch", start: new Date(2026, 8, 15), end: new Date(2026, 8, 17), parent: "root", type: "summary" };
    const grandchild = { id: "grandchild", text: "Grandchild", start: new Date(2026, 8, 16), end: new Date(2026, 8, 17), parent: "branch", type: "task" };
    const sibling = { id: "sibling", text: "Sibling", start: new Date(2026, 8, 18), end: new Date(2026, 8, 19), parent: "root", type: "task" };

    const plan = planCanonicalGanttSync(
      { tasks: [root, branch, grandchild, sibling], links: [] },
      { tasks: [root, sibling], links: [] },
    );

    expect(plan.deletedTaskIds).toEqual(["grandchild", "branch"]);
  });

  it("inserts a new root sibling directly before an existing middle task without extra moves", async () => {
    const a = { id: "a", text: "A", parent: 0 };
    const b = { id: "b", text: "B", parent: 0 };
    const c = { id: "c", text: "C", parent: 0 };
    const inserted = { id: "new", text: "New", parent: 0 };
    const calls: Array<{ action: string; payload: unknown }> = [];
    await applyCanonicalGanttSync(
      { exec: async (action: string, payload: unknown) => { calls.push({ action, payload }); } } as never,
      { tasks: [a, b, c], links: [] },
      { tasks: [a, inserted, b, c], links: [] },
    );
    expect(calls).toEqual([{
      action: "add-task",
      payload: {
        id: "new", task: { ...inserted }, target: "b", mode: "before",
        select: false, eventSource: "project-canonical-sync",
      },
    }]);
  });

  it("inserts after a middle sibling, before the first, and after the last", async () => {
    const a = { id: "a", text: "A", parent: 0 };
    const b = { id: "b", text: "B", parent: 0 };
    const c = { id: "c", text: "C", parent: 0 };
    const before = { id: "before", text: "First", parent: 0 };
    const below = { id: "below", text: "Below B", parent: 0 };
    const last = { id: "last", text: "Last", parent: 0 };
    const calls: Array<{ action: string; payload: unknown }> = [];
    await applyCanonicalGanttSync(
      { exec: async (action: string, payload: unknown) => { calls.push({ action, payload }); } } as never,
      { tasks: [a, b, c], links: [] },
      { tasks: [before, a, b, below, c, last], links: [] },
    );
    expect(calls.filter(({ action }) => action === "move-task")).toEqual([]);
    expect(calls.filter(({ action }) => action === "add-task").map(({ payload }) => payload))
      .toMatchObject([
        { id: "before", mode: "before", target: "a" },
        { id: "below", mode: "before", target: "c" },
        { id: "last", mode: "after", target: "c" },
      ]);
  });

  it("preserves nested family order and the parent when inserting before a middle child", async () => {
    const parent = { id: "parent", text: "Summary", parent: 0, type: "summary", open: false };
    const a = { id: "a", text: "A", parent: "parent" };
    const b = { id: "b", text: "B", parent: "parent" };
    const c = { id: "c", text: "C", parent: "parent" };
    const inserted = { id: "new", text: "New", parent: "parent", open: true };
    const calls: Array<{ action: string; payload: unknown }> = [];
    await applyCanonicalGanttSync(
      { exec: async (action: string, payload: unknown) => { calls.push({ action, payload }); } } as never,
      { tasks: [parent, a, b, c], links: [] },
      { tasks: [parent, a, inserted, b, c], links: [] },
    );
    expect(calls).toEqual([{
      action: "add-task",
      payload: {
        id: "new", task: { id: "new", text: "New", parent: "parent" },
        target: "b", mode: "before", select: false,
        eventSource: "project-canonical-sync",
      },
    }]);
  });

  it("maintains the order of multiple inserted roots and waits for newly added parents", async () => {
    const a = { id: "a", text: "A", parent: 0 };
    const b = { id: "b", text: "B", parent: 0 };
    const first = { id: "first", text: "First", parent: 0 };
    const second = { id: "second", text: "Second", parent: 0 };
    const parent = { id: "new-parent", text: "Summary", parent: 0, type: "summary" };
    const child = { id: "child", text: "Child", parent: "new-parent" };
    const calls: Array<{ action: string; payload: unknown }> = [];
    await applyCanonicalGanttSync(
      { exec: async (action: string, payload: unknown) => { calls.push({ action, payload }); } } as never,
      { tasks: [a, b], links: [] },
      // An incoming snapshot need not list a newly created parent before its child.
      { tasks: [a, first, second, b, child, parent], links: [] },
    );
    const adds = calls.filter(({ action }) => action === "add-task")
      .map(({ payload }) => payload);
    expect(adds).toMatchObject([
      { id: "first", mode: "before", target: "b" },
      { id: "second", mode: "before", target: "b" },
      { id: "new-parent", mode: "after", target: "b" },
      { id: "child", mode: "child", target: "new-parent" },
    ]);
    expect(calls.filter(({ action }) => action === "move-task")).toHaveLength(0);
  });

  it("renaming a persisted reordered task does not generate a reverse move",async()=>{
    const tasks=[{id:"a",text:"A",parent:0},{id:"c",text:"C",parent:0},{id:"b",text:"B",parent:0}];
    const canonical=[tasks[0],tasks[1],{...tasks[2],text:"B renamed"}];
    const calls:Array<{action:string;payload:unknown}>=[];
    await applyCanonicalGanttSync({exec:async(action:string,payload:unknown)=>{calls.push({action,payload});}} as never,{tasks,links:[]},{tasks:canonical,links:[]});
    expect(calls.filter((call)=>call.action==="move-task")).toEqual([]);
    expect(calls.filter((call)=>call.action==="update-task")).toHaveLength(1);
  });

  it("does not move surviving siblings when a preceding task was deleted", async () => {
    const removed = { id: "removed", text: "Removed", parent: 0 };
    const summary = { id: "summary", text: "Collapsed", parent: 0, type: "summary", open: false };
    const child = { id: "child", text: "Child", parent: "summary" };
    const sibling = { id: "sibling", text: "Sibling", parent: 0 };
    const calls: Array<{ action: string; payload: unknown }> = [];
    await applyCanonicalGanttSync({
      exec: async (action: string, payload: unknown) => { calls.push({ action, payload }); },
    } as never, { tasks: [removed, summary, child, sibling], links: [] }, {
      tasks: [summary, child, sibling], links: [],
    });
    expect(calls).toEqual([{ action: "delete-task", payload: { id: "removed" } }]);
  });

  it("uses move-task for canonical reparenting instead of rewriting parent through update-task", async () => {
    const parent = { id: "parent", text: "Parent", start: new Date(2026, 8, 14), end: new Date(2026, 8, 16), parent: 0, type: "summary" };
    const currentChild = { id: "child", text: "Child", start: new Date(2026, 8, 15), end: new Date(2026, 8, 16), parent: 0, type: "task" };
    const canonicalChild = { ...currentChild, parent: "parent" };
    const calls: Array<{ action: string; payload: unknown }> = [];
    const api = {
      exec: async (action: string, payload: unknown) => {
        calls.push({ action, payload });
      },
    };

    await applyCanonicalGanttSync(
      api as never,
      { tasks: [parent, currentChild], links: [] },
      { tasks: [parent, canonicalChild], links: [] },
    );

    expect(calls).toContainEqual({
      action: "move-task",
      payload: { id: "child", mode: "child", target: "parent", eventSource: "project-canonical-sync" },
    });
    const update = calls.find((call) => call.action === "update-task");
    expect(update).toBeDefined();
    expect(update?.payload).not.toMatchObject({ task: { parent: "parent" } });
  });
});
