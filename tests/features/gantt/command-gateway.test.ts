import { describe, expect, it, vi } from "vitest";

import {
  createTaskAddGateway,
  createTaskUpdateGateway,
} from "../../../src/features/gantt/command-gateway";

describe("SVAR command gateway", () => {
  it("intercepts native add events before SVAR creates a temporary local task", () => {
    const dispatch = vi.fn();
    const gateway = createTaskAddGateway(dispatch);

    expect(gateway({ target: "parent-task", mode: "child" })).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({
      kind: "add-task",
      targetTaskId: "parent-task",
      mode: "child",
    });
  });

  it("ignores transient drag events and collapses duplicate final widget events", async () => {
    const dispatch = vi.fn();
    const gateway = createTaskUpdateGateway(dispatch);
    const event = { id: "build", task: { progress: 50 } };

    gateway({ ...event, inProgress: true });
    gateway(event);
    gateway(event);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      kind: "update-task",
      taskId: "build",
      changes: { text: undefined, start: undefined, end: undefined, progress: 50, parent: undefined },
    });

    await Promise.resolve();
    gateway(event);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("keeps distinct final pointer deltas in the same browser turn", () => {
    const dispatch = vi.fn();
    const gateway = createTaskUpdateGateway(dispatch);
    gateway({ id: "build", diff: 1, task: { start: new Date(2026, 8, 14) } });
    gateway({ id: "build", diff: 2, task: { start: new Date(2026, 8, 14) } });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ diff: 2 }));
  });
});
