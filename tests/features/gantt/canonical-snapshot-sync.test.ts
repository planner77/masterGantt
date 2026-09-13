import { describe, expect, it } from "vitest";

import { planCanonicalGanttSync } from "../../../src/features/gantt/canonical-snapshot-sync";

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
});
