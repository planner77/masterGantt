import { describe, expect, it, vi } from "vitest";
import { createTaskMoveGateway } from "../../../src/features/gantt/task-move-gateway";
describe("Grid move persistence gateway", () => {
  function setup() {
    const dispatch = vi.fn();
    const state = { editable: true, sync: false };
    const gateway = createTaskMoveGateway({ canMutate: () => state.editable, isCanonicalSync: () => state.sync, hasTask: (id) => ["a", "b", "c"].includes(id), dispatch });
    return { gateway, dispatch, state };
  }
  it("allows transient feedback and dispatches the final reparent once", async () => {
    const { gateway, dispatch } = setup();
    const event = { id: "b", mode: "after" as const, target: "c" };
    expect(gateway({ ...event, inProgress: true })).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
    expect(gateway({ ...event, inProgress: false })).toBeUndefined();
    gateway({ ...event, inProgress: false });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ kind: "reparent", taskId: "b", anchorTaskId: "c", placement: "after" });
    await Promise.resolve();
    gateway(event);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
  it("only permits marked canonical moves during synchronization", () => {
    const { gateway, dispatch, state } = setup();
    state.sync = true;
    state.editable = false;
    const event = { id: "b", mode: "before" as const, target: "a" };
    expect(gateway(event)).toBe(false);
    expect(gateway({ ...event, eventSource: "project-canonical-sync" })).toBeUndefined();
    state.sync = false;
    expect(gateway({ ...event, eventSource: "project-canonical-sync" })).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("blocks readonly, busy, invalid target and self-target events", () => {
    const { gateway, dispatch, state } = setup();
    state.editable = false;
    expect(gateway({ id: "b", mode: "after", target: "c", inProgress: true })).toBe(false);
    state.editable = true;
    for (const event of [{ id: "missing", mode: "after" as const, target: "c" }, { id: "b", mode: "child" as const, target: "missing" }, { id: "b", mode: "before" as const, target: "b" }, { id: "b", mode: "after" as const, target: 0 }])
      expect(gateway(event)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("rejects disallowed moves before provisional Core feedback", () => {
    const dispatch = vi.fn();
    const canApply = vi.fn((command) => command.kind !== "reparent" || command.placement !== "after");
    const gateway = createTaskMoveGateway({
      canMutate: () => true,
      isCanonicalSync: () => false,
      hasTask: (id) => ["a", "b"].includes(id),
      canApply,
      dispatch,
    });
    const event = { id: "b", mode: "after" as const, target: "a" };
    expect(gateway({ ...event, inProgress: true })).toBe(false);
    expect(gateway({ ...event, inProgress: false })).toBe(false);
    expect(canApply).toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("maps sibling, parent and directional actions to existing commands", () => {
    const { gateway, dispatch } = setup();
    gateway({ id: "b", mode: "before", target: "a" });
    gateway({ id: "b", mode: "child", target: "a" });
    gateway({ id: "b", mode: "up" });
    expect(dispatch.mock.calls.map(([command]) => command)).toEqual([
      { kind: "reparent", taskId: "b", anchorTaskId: "a", placement: "before" },
      { kind: "reparent", taskId: "b", anchorTaskId: "a", placement: "child" },
      { kind: "move", taskId: "b", direction: "up" },
    ]);
  });
});
