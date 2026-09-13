import type { ITask } from "@svar-ui/react-gantt";
import { describe, expect, it, vi } from "vitest";

import { applyCanonicalGanttSync } from "../../../src/features/gantt/canonical-snapshot-sync";

function firstChildSnapshot() {
  const leaf: ITask = { id: "parent", text: "Leaf", type: "task", parent: 0 };
  const summary: ITask = { ...leaf, type: "summary", open: true };
  const child: ITask = { id: "server-child", text: "Child", type: "task", parent: "parent" };
  return { leaf, summary, child };
}

describe("canonical SVAR action execution", () => {
  it("inserts the first child before opening its converted parent, even with live snapshot objects", async () => {
    const { leaf, summary, child } = firstChildSnapshot();
    let childInserted = false;
    const exec = vi.fn().mockImplementation(async (action, payload) => {
      if (action === "update-task") {
        expect(payload.task).not.toHaveProperty("open");
        // serialize may expose live Core objects; capture transitions first.
        Object.assign(leaf, payload.task);
      }
      if (action === "add-task") childInserted = true;
      if (action === "open-task") {
        // This would fail for CI #33's update -> open -> add ordering.
        expect(childInserted).toBe(true);
      }
    });

    await applyCanonicalGanttSync({ exec }, { tasks: [leaf], links: [] }, { tasks: [summary, child], links: [] });

    expect(exec.mock.calls.map(([action]) => action)).toEqual(["update-task", "add-task", "open-task"]);
    expect(exec).toHaveBeenNthCalledWith(2, "add-task", expect.objectContaining({
      id: "server-child",
      task: expect.objectContaining({ id: "server-child", parent: "parent" }),
      target: "parent",
      mode: "child",
      select: false,
      eventSource: "project-canonical-sync",
    }));
    expect(exec).toHaveBeenLastCalledWith("open-task", { id: "parent", mode: true });
    expect(summary.open).toBe(true);
  });

  it("does not reopen an existing collapsed summary when adding another child", async () => {
    const { summary, child } = firstChildSnapshot();
    const existing = { ...summary, open: false };
    const updated = { ...summary, text: "Changed summary" };
    const exec = vi.fn().mockResolvedValue(undefined);

    await applyCanonicalGanttSync({ exec }, { tasks: [existing], links: [] }, { tasks: [updated, child], links: [] });

    expect(exec.mock.calls.map(([action]) => action)).toEqual(["update-task", "add-task"]);
    expect(exec.mock.calls[0][1].task).not.toHaveProperty("open");
    expect(existing.open).toBe(false);
  });

  it("does not open a summary with no canonical children", async () => {
    const { leaf, summary } = firstChildSnapshot();
    const exec = vi.fn().mockResolvedValue(undefined);

    await applyCanonicalGanttSync({ exec }, { tasks: [leaf], links: [] }, { tasks: [summary], links: [] });

    expect(exec.mock.calls.map(([action]) => action)).toEqual(["update-task"]);
  });

  it("propagates a failed child insertion without attempting to open the parent", async () => {
    const { leaf, summary, child } = firstChildSnapshot();
    const error = new Error("child insertion failed");
    const exec = vi.fn().mockImplementation(async (action) => {
      if (action === "add-task") throw error;
    });

    await expect(applyCanonicalGanttSync({ exec }, { tasks: [leaf], links: [] }, { tasks: [summary, child], links: [] }))
      .rejects.toBe(error);
    expect(exec.mock.calls.map(([action]) => action)).toEqual(["update-task", "add-task"]);
  });

  it("stops stale work before expansion and does not execute an already stale plan", async () => {
    const { leaf, summary, child } = firstChildSnapshot();
    let current = true;
    const exec = vi.fn().mockImplementation(async (action) => {
      if (action === "add-task") current = false;
    });

    await applyCanonicalGanttSync({ exec }, { tasks: [leaf], links: [] }, { tasks: [summary, child], links: [] }, () => current);
    expect(exec.mock.calls.map(([action]) => action)).toEqual(["update-task", "add-task"]);
    exec.mockClear();
    await applyCanonicalGanttSync({ exec }, { tasks: [leaf], links: [] }, { tasks: [summary, child], links: [] }, () => false);
    expect(exec).not.toHaveBeenCalled();
  });
});
