import { describe, expect, it, vi } from "vitest";

import { createTaskUpdateGateway } from "../../../src/features/gantt/command-gateway";

describe("SVAR command gateway", () => {
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
});
