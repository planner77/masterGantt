import type { IApi, ITask } from "@svar-ui/react-gantt";
import { describe, expect, it, vi } from "vitest";

import { applyCanonicalGanttSync } from "../../../src/features/gantt/canonical-snapshot-sync";

function firstChildSnapshot() {
  const leaf: ITask = { id: "parent", text: "Leaf", type: "task", parent: 0 };
  const summary: ITask = { ...leaf, type: "summary", open: true };
  const child: ITask = { id: "server-child", text: "Child", type: "task", parent: "parent" };
  return { leaf, summary, child };
}

describe("canonical SVAR action execution", () => {
  it("restores a user-closed target after Core automatically opens it during reparent", async () => {
    const target: ITask = { id: "target", parent: 0, type: "summary", open: false };
    const existing: ITask = { id: "existing", parent: "target", type: "task" };
    const moved: ITask = { id: "moved", parent: 0, type: "task" };
    const exec = vi.fn().mockImplementation(async (action, payload) => {
      if (action === "move-task") target.open = true;
      if (action === "open-task") target.open = payload.mode;
    });
    const getTask = vi.fn().mockImplementation(() => target as ReturnType<IApi["getTask"]>);
    await applyCanonicalGanttSync({ exec, getTask }, { tasks: [target, existing, moved], links: [] }, { tasks: [target, existing, { ...moved, parent: "target" }], links: [] });
    expect(exec).toHaveBeenLastCalledWith("open-task", { id: "target", mode: false });
    expect(target.open).toBe(false);
  });

  it("moves the sole child to root with no canonical siblings", async () => {
    const parent: ITask = { id: "parent", parent: 0, type: "summary" };
    const child: ITask = { id: "child", parent: "parent", type: "task" };
    const exec = vi.fn().mockResolvedValue(undefined);
    await applyCanonicalGanttSync({ exec }, { tasks: [parent, child], links: [] }, { tasks: [{ ...child, parent: 0 }], links: [] });
    expect(exec).toHaveBeenCalledWith("move-task", { id: "child", mode: "child", target: 0, eventSource: "project-canonical-sync" });
  });

  it("inserts a new canonical sibling before surviving siblings rather than appending", async () => {
    const existing: ITask = { id: "existing", parent: 0, type: "task" };
    const inserted: ITask = { id: "inserted", parent: 0, type: "task" };
    const exec = vi.fn().mockResolvedValue(undefined);
    await applyCanonicalGanttSync({ exec }, { tasks: [existing], links: [] }, { tasks: [inserted, existing], links: [] });
    expect(exec).toHaveBeenCalledExactlyOnceWith("add-task", expect.objectContaining({ id: "inserted", target: "existing", mode: "before", select: false }));
  });

  it("opens a previously empty renderer container only after its first nested container is inserted", async () => {
    const parent: ITask = { id: "parent", type: "summary-container", parent: 0, open: false };
    const child: ITask = { id: "child", type: "summary-container", parent: "parent", open: false };
    const exec = vi.fn().mockResolvedValue(undefined);
    await applyCanonicalGanttSync({ exec }, { tasks: [parent], links: [] }, { tasks: [parent, child], links: [] });
    expect(exec.mock.calls.map(([action]) => action)).toEqual(["add-task", "open-task"]);
    expect(exec).toHaveBeenLastCalledWith("open-task", { id: "parent", mode: true });
  });
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
