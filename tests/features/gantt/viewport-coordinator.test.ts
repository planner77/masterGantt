import { describe, expect, it, vi } from "vitest";
import type { ProjectionReceipt } from "../../../src/features/gantt/projection-settled";
import {
  createViewportCoordinator, validViewportReceipt,
  type ViewportCommand, type ViewportContext, type ViewportPort, type ViewportSample,
} from "../../../src/features/gantt/viewport/viewport-coordinator";

function fixture(maxFrames = 12) {
  let context: ViewportContext = {
    apiInstance: "api-1", revision: 3, key: "schedule", scope: null, filter: "all",
    scale: "Day", columns: "text,start", geometry: "layout-1", visible: true,
    empty: false, filtered: false, projectionEpoch: 5, receiptFilter: "all", bookmarkGeometry: "fixed",
  };
  const receipt = (): ProjectionReceipt => ({
    apiInstance: context.apiInstance, revision: context.revision, generation: context.projectionEpoch,
    scope: context.scope, scale: context.scale, columns: context.columns, filterKey: context.receiptFilter,
    outcome: "SETTLED", reasons: [], logicalVisibleIds: ["task"], coreVisibleIds: ["task"],
    domIds: ["task"], taskSelectionChanged: false, queryConditionsChanged: false, selectedIds: [],
  });
  let sample: ViewportSample = {
    context, receipt: receipt(), measurable: true, geometry: "measured-1",
    capacity: { left: 1000, top: 1000 }, core: { left: 120, top: 96 }, native: { left: 120, top: 96 },
  };
  const frames: Array<(animated: boolean) => void> = [];
  const port: ViewportPort = {
    read: vi.fn(() => sample),
    frame: vi.fn(signal => new Promise<boolean>(resolve => {
      let done = false;
      const finish = (animated: boolean) => {
        if (done) return;
        done = true; signal.removeEventListener("abort", abort); resolve(animated);
      };
      const abort = () => finish(false);
      signal.addEventListener("abort", abort, { once: true });
      frames.push(finish);
      if (signal.aborted) finish(false);
    })),
    apply: vi.fn(async command => {
      const position = "position" in command ? command.position : { left: 30, top: 48 };
      sample = { ...sample, core: position, native: position };
      return position;
    }),
    repair: vi.fn(() => false), protect: vi.fn(), release: vi.fn(), trace: vi.fn(),
  };
  const coordinator = createViewportCoordinator(port, maxFrames);
  const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
  const advance = async (count = 1, animated = true) => {
    for (let n = 0; n < count; n++) {
      await flush();
      frames.splice(0).forEach(resolve => resolve(animated));
      await flush();
    }
  };
  return {
    port, coordinator, advance, flush,
    get sample() { return sample; },
    update(patch: Partial<ViewportSample>) { sample = { ...sample, ...patch }; },
    context(patch: Partial<ViewportContext>, freshReceipt = true) {
      context = { ...context, ...patch };
      sample = { ...sample, context, ...(freshReceipt ? { receipt: receipt() } : {}) };
    },
  };
}
const peer: ViewportCommand = { kind: "PEER_RETURN", position: { left: 120, top: 96 } };
const passive: ViewportCommand = { kind: "PASSIVE_RESTORE", position: { left: 120, top: 96 } };

describe("Viewport Coordinator arbitration and bounded observation", () => {
  it("invalidates settled consumer stamps on another accepted intent, unchanged-position input, context round-trip, and disposal", async () => {
    const f = fixture(), first = f.coordinator.request({ kind: "TASK_REVEAL", taskId: "task" });
    const firstStamp = f.coordinator.stamp();
    await f.advance(8); expect(await first).toBe("SETTLED");
    expect(f.coordinator.isCurrent(firstStamp)).toBe(true);
    const second = f.coordinator.request(passive);
    expect(f.coordinator.validSource(firstStamp)).toBe(true);
    expect(f.coordinator.isCurrent(firstStamp)).toBe(false);
    await f.advance(8); expect(await second).toBe("SETTLED");
    const secondStamp = f.coordinator.stamp(), position = f.sample.core;
    f.coordinator.userInput();
    expect(f.sample.core).toEqual(position);
    expect(f.coordinator.isCurrent(secondStamp)).toBe(false);
    const gestureStamp = f.coordinator.stamp();
    f.context({ scope: "B" }); f.coordinator.contextChanged();
    f.context({ scope: null }); f.coordinator.contextChanged();
    expect(f.coordinator.isCurrent(gestureStamp)).toBe(false);
    const finalStamp = f.coordinator.stamp(); f.coordinator.dispose();
    expect(f.coordinator.isCurrent(finalStamp)).toBe(false);
  });

  it("waits for fresh visible-session evidence before pinning a peer return even when coordinates already match", async () => {
    const f = fixture();
    f.context({ visible: false }); f.coordinator.contextChanged();
    f.update({ receipt: null });
    f.context({ visible: true }, false); f.coordinator.contextChanged();
    const pending = f.coordinator.request(peer);
    await f.advance(3);
    expect(f.port.apply).not.toHaveBeenCalled();
    f.context({ projectionEpoch: 6 });
    await f.advance(8);
    expect(await pending).toBe("SETTLED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.protect).toHaveBeenCalledTimes(1);
    expect(f.sample.core).toEqual({ left: 120, top: 96 });
  });

  it.each([false, undefined, "throw"])("fails closed for an original source guard returning %s", result => {
    const f = fixture();
    const sourceCurrent = (() => { if (result === "throw") throw new Error("revoked"); return result; }) as () => boolean;
    return expect(f.coordinator.request({ ...passive, sourceCurrent })).resolves.toBe("SUPERSEDED").then(() => {
      expect(f.port.apply).not.toHaveBeenCalled();
      expect(vi.mocked(f.port.trace).mock.calls.every(call => !("sourceCurrent" in (call[1] ?? {})))).toBe(true);
    });
  });
  it("propagates original-source revocation to a port's pending preparation without fresh authority", async () => {
    const f = fixture(); let valid = true, release!: () => void, preparationCurrent: (() => boolean) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.port.prepare = async (_command, current) => { preparationCurrent = current; await gate; return { ready: current() }; };
    const pending = f.coordinator.request({ ...passive, sourceCurrent: () => valid });
    await f.flush(); expect(preparationCurrent?.()).toBe(true);
    valid = false; expect(preparationCurrent?.()).toBe(false); release();
    await f.flush(); expect(await pending).toBe("SUPERSEDED");
    expect(f.port.apply).not.toHaveBeenCalled();
    expect(f.coordinator.stamp().gesture).toBe(0);
  });
  it("cannot finish or retain settled authority after the original source guard is revoked", async () => {
    const f = fixture(); let valid = true;
    const pending = f.coordinator.request({ ...passive, sourceCurrent: () => { if (!valid) throw new Error("revoked"); return true; } });
    await f.advance(4); expect(f.port.apply).toHaveBeenCalledTimes(1);
    valid = false; await f.advance(); expect(await pending).toBe("SUPERSEDED");
    expect(f.port.protect).not.toHaveBeenCalled();
    valid = true; expect(f.port.apply).toHaveBeenCalledTimes(1);
  });

  it("revokes settled passive protection when the original source later expires", async () => {
    const f = fixture(); let valid = true;
    const pending = f.coordinator.request({ ...passive, sourceCurrent: () => valid });
    await f.advance(8); expect(await pending).toBe("SETTLED");
    const authority = vi.mocked(f.port.protect).mock.calls[0][1];
    expect(authority()).toBe(true);
    valid = false; expect(authority()).toBe(false);
  });

  it("requires geometry frames and three actual post-command frames before reporting settled", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(2);
    expect(f.port.apply).not.toHaveBeenCalled();
    await f.advance();
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    await f.advance(2);
    expect(f.port.protect).not.toHaveBeenCalled();
    await f.advance();
    expect(await pending).toBe("SETTLED");
    expect(f.port.trace).toHaveBeenLastCalledWith("SETTLED", peer, "SETTLED", expect.objectContaining({ decisionReason: "SETTLED" }));
    expect(f.port.protect).toHaveBeenCalledTimes(1);
  });

  it("lets a Task reveal supersede a waiting peer and rejects a later passive with its old creation stamp", async () => {
    const f = fixture(), source = f.coordinator.stamp(), old = f.coordinator.request(peer, source);
    const reveal = f.coordinator.request({ kind: "TASK_REVEAL", taskId: "task" });
    expect(await f.coordinator.request(passive, source)).toBe("SUPERSEDED");
    expect(await f.coordinator.request(passive)).toBe("SUPERSEDED");
    expect(await old).toBe("SUPERSEDED");
    await f.advance(8);
    expect(await reveal).toBe("SETTLED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.apply).toHaveBeenCalledWith({ kind: "TASK_REVEAL", taskId: "task" }, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
  });

  it("does not let a lower priority peer replace a pending filter return", async () => {
    const f = fixture(), restore = f.coordinator.request({ kind: "FILTER_RETURN", position: { left: 80, top: 0 } });
    expect(await f.coordinator.request(peer)).toBe("SUPERSEDED");
    await f.advance(8);
    expect(await restore).toBe("SETTLED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
  });

  it("does not retain write protection after a one-shot FILTER_RETURN settles", async () => {
    const f = fixture(), command = { kind: "FILTER_RETURN", position: { left: 120, top: 0 } } as const;
    const pending = f.coordinator.request(command);
    await f.advance(8);
    expect(await pending).toBe("SETTLED");
    expect(f.port.protect).not.toHaveBeenCalled();
    expect(f.port.repair).not.toHaveBeenCalled();
  });

  it.each([
    ["horizontal", { left: 180, top: 0 }],
    ["vertical", { left: 120, top: 128 }],
  ] as const)("supersedes an in-flight FILTER_RETURN for a coherent new %s offset", async (_axis, moved) => {
    const f = fixture(), command = { kind: "FILTER_RETURN", position: { left: 120, top: 0 } } as const;
    const pending = f.coordinator.request(command);
    await f.advance(3);
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    f.update({ core: moved, native: moved });
    await f.advance();
    expect(await pending).toBe("SUPERSEDED");
    expect(f.sample.core).toEqual(moved);
    expect(f.port.repair).not.toHaveBeenCalled();
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it("does not repair an early native scroll while its matching Core event is delayed", async () => {
    const f = fixture(), command = { kind: "FILTER_RETURN", position: { left: 120, top: 0 } } as const;
    const pending = f.coordinator.request(command);
    await f.advance(3);
    f.update({ native: { left: 180, top: 0 } });
    await f.advance();
    expect(f.port.repair).not.toHaveBeenCalled();
    f.update({ core: { left: 180, top: 0 } });
    await f.advance();
    expect(await pending).toBe("SUPERSEDED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it("invalidates captured sources across A to B to A even when the final context looks identical", async () => {
    const f = fixture(), source = f.coordinator.stamp();
    f.context({ scope: "B" }); f.coordinator.contextChanged();
    f.context({ scope: null }); f.coordinator.contextChanged();
    expect(f.coordinator.validSource(source)).toBe(false);
    expect(await f.coordinator.request(peer, source)).toBe("SUPERSEDED");
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("cancels waiting work and settled restoration authority on real user input", async () => {
    const f = fixture(), source = f.coordinator.stamp(), pending = f.coordinator.request(peer);
    f.coordinator.userInput();
    expect(await pending).toBe("SUPERSEDED");
    expect(await f.coordinator.request(peer, source)).toBe("SUPERSEDED");
    expect(f.port.apply).not.toHaveBeenCalled();
    const fresh = f.coordinator.request(peer); await f.advance(8); expect(await fresh).toBe("SETTLED");
    const authority = vi.mocked(f.port.protect).mock.calls[0][1];
    expect(authority()).toBe(true);
    f.coordinator.userInput(); expect(authority()).toBe(false);
  });

  it.each([
    ["apiInstance", "old-api"], ["revision", 2], ["generation", 4], ["scope", "other"],
    ["scale", "Week"], ["columns", "different"], ["filterKey", "other"], ["outcome", "TIMED_OUT"],
  ] as const)("rejects a stale projection receipt %s", async (key, value) => {
    const f = fixture(4);
    f.update({ receipt: { ...f.sample.receipt!, [key]: value } });
    expect(validViewportReceipt(f.sample)).toBe(false);
    const pending = f.coordinator.request(peer); await f.advance(5);
    expect(await pending).toBe("TIMED_OUT");
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("waits for the new revision's projection instead of resetting the viewport on revision increment", async () => {
    const f = fixture(); f.context({ revision: 4, projectionEpoch: 6 }, false); f.coordinator.contextChanged();
    const pending = f.coordinator.request(peer); await f.advance(2);
    expect(f.port.apply).not.toHaveBeenCalled();
    f.context({}); await f.advance(8);
    expect(await pending).toBe("SETTLED");
    expect(f.sample.core).toEqual({ left: 120, top: 96 });
  });

  it("never applies when the latest observation generation has no valid receipt", async () => {
    const f = fixture(5), pending = f.coordinator.request(peer);
    await f.advance(); f.context({ projectionEpoch: 6 }, false);
    await f.advance(8);
    expect(await pending).toBe("TIMED_OUT");
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("follows a newer observation receipt while waiting and freezes its generation for apply", async () => {
    const f = fixture(); f.update({ receipt: null });
    const pending = f.coordinator.request(peer);
    await f.advance(); f.context({ projectionEpoch: 6 });
    await f.advance(2); expect(f.port.apply).not.toHaveBeenCalled();
    await f.advance(8); expect(await pending).toBe("SETTLED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.trace).toHaveBeenLastCalledWith("SETTLED", peer, "SETTLED",
      expect.objectContaining({ projectionEpoch: 6 }));
  });

  it("restarts geometry proof when a valid newer receipt arrives before apply", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(2);
    f.context({ projectionEpoch: 6 });
    await f.advance(3); expect(f.port.apply).not.toHaveBeenCalled();
    await f.advance(); expect(f.port.apply).toHaveBeenCalledTimes(1);
    await f.advance(3); expect(await pending).toBe("SETTLED");
  });

  it("still rejects a canonical revision change while waiting for a newer observation", async () => {
    const f = fixture(); f.update({ receipt: null });
    const pending = f.coordinator.request(peer);
    await f.advance(); f.context({ revision: 4, projectionEpoch: 6 });
    await f.advance(); expect(await pending).toBe("SUPERSEDED");
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("prepares geometry once, then waits for its latest receipt before pinning and applying coordinates", async () => {
    const f = fixture();
    f.port.prepare = vi.fn<NonNullable<ViewportPort["prepare"]>>(async (_command, current) => {
      expect(current()).toBe(true);
      f.context({ projectionEpoch: 6 }, false);
      expect(current()).toBe(true);
      return { ready: true, projectionAfter: 5 };
    });
    const pending = f.coordinator.request(peer);
    await f.advance(2); expect(f.port.apply).not.toHaveBeenCalled();
    f.context({});
    await f.advance(8); expect(await pending).toBe("SETTLED");
    expect(f.port.prepare).toHaveBeenCalledTimes(1);
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.trace).toHaveBeenLastCalledWith("SETTLED", peer, "SETTLED",
      expect.objectContaining({ projectionEpoch: 6 }));
  });

  it("does not reuse a successful pre-resize receipt when preparation requires a newer observation", async () => {
    const f = fixture(5);
    f.port.prepare = vi.fn(async () => ({ ready: true, projectionAfter: 5 }));
    const pending = f.coordinator.request(peer);
    await f.advance(8); expect(await pending).toBe("TIMED_OUT");
    expect(validViewportReceipt(f.sample)).toBe(true);
    expect(f.port.prepare).toHaveBeenCalledTimes(1);
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("does not require an artificial newer observation when geometry preparation is a no-op", async () => {
    const f = fixture(); f.port.prepare = vi.fn(async () => ({ ready: true }));
    const pending = f.coordinator.request(peer);
    await f.advance(8); expect(await pending).toBe("SETTLED");
    expect(f.sample.context.projectionEpoch).toBe(5);
    expect(f.port.prepare).toHaveBeenCalledTimes(1);
    expect(f.port.apply).toHaveBeenCalledTimes(1);
  });

  it.each(["wheel", "revision"] as const)("keeps preparation bound to its original %s authority", async change => {
    const f = fixture(); let resolvePreparation!: (result: { ready: boolean }) => void;
    f.port.prepare = vi.fn<NonNullable<ViewportPort["prepare"]>>(() => new Promise<{ ready: boolean }>(resolve => { resolvePreparation = resolve; }));
    const pending = f.coordinator.request(peer); await f.flush();
    const preparationCurrent = vi.mocked(f.port.prepare!).mock.calls[0][1];
    if (change === "wheel") f.coordinator.userInput();
    else f.context({ revision: 4, projectionEpoch: 6 });
    expect(preparationCurrent()).toBe(false);
    resolvePreparation({ ready: true }); expect(await pending).toBe("SUPERSEDED");
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it.each(["capacity", "TIMED_OUT", "rejected"] as const)("reports geometry preparation failure %s without applying coordinates", async failure => {
    const f = fixture();
    f.port.prepare = vi.fn<NonNullable<ViewportPort["prepare"]>>(async () => {
      if (failure === "capacity") return { ready: false };
      throw new Error(failure);
    });
    expect(await f.coordinator.request(peer)).toBe(failure === "capacity" ? "NO_SCROLL_CAPACITY" : failure === "TIMED_OUT" ? "TIMED_OUT" : "FAILED");
    expect(f.port.prepare).toHaveBeenCalledTimes(1);
    expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("can extend physical range when canonical projection is pending, without forging a projection receipt", async () => {
    const f = fixture(); f.update({ receipt: null });
    const pending = f.coordinator.request({ kind: "RANGE_EXTENSION", width: 2400 });
    await f.advance(5);
    expect(await pending).toBe("SETTLED");
    expect(f.sample.receipt).toBeNull();
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it("allows only dev diagnostic scroll to test the native right edge without a canonical receipt", async () => {
    const f = fixture(); f.update({ receipt: null });
    vi.mocked(f.port.apply).mockImplementation(async command => {
      const position = { left: command.kind === "DIAGNOSTIC_SCROLL" ? command.left : 0, top: 96 };
      f.update({ core: position, native: position });
      return position;
    });
    const pending = f.coordinator.request({ kind: "DIAGNOSTIC_SCROLL", left: 240 });
    await f.advance(5);
    expect(await pending).toBe("SETTLED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.protect).not.toHaveBeenCalled();
    expect(f.sample.receipt).toBeNull();
  });

  it("repairs one delayed native diagnostic offset without acquiring production authority", async () => {
    const f = fixture(); f.update({ receipt: null });
    const target = { left: 240, top: 96 };
    vi.mocked(f.port.apply).mockImplementation(async () => { f.update({ core: target }); return target; });
    vi.mocked(f.port.repair).mockImplementation(position => { f.update({ native: position }); return true; });
    const pending = f.coordinator.request({ kind: "DIAGNOSTIC_SCROLL", left: target.left });
    await f.advance(8);
    expect(await pending).toBe("SETTLED");
    expect(f.port.repair).toHaveBeenCalledExactlyOnceWith(target, true);
    expect(f.port.protect).not.toHaveBeenCalled();
    expect(f.sample.receipt).toBeNull();
  });

  it("bounds persistent diagnostic native disagreement to three repairs per operation", async () => {
    const f = fixture(), target = { left: 240, top: 96 };
    vi.mocked(f.port.apply).mockImplementation(async () => { f.update({ core: target }); return target; });
    vi.mocked(f.port.repair).mockReturnValue(true);
    const pending = f.coordinator.request({ kind: "DIAGNOSTIC_SCROLL", left: target.left });
    await f.advance(14);
    expect(await pending).toBe("TIMED_OUT");
    expect(f.port.repair).toHaveBeenCalledTimes(3);
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it.each(["gesture", "hidden", "context", "revision", "projection"])("stops diagnostic repair on a new %s before touching native scroll", async change => {
    const f = fixture(), target = { left: 240, top: 96 };
    vi.mocked(f.port.apply).mockImplementation(async () => { f.update({ core: target }); return target; });
    const pending = f.coordinator.request({ kind: "DIAGNOSTIC_SCROLL", left: target.left });
    await f.advance();
    if (change === "gesture") f.coordinator.userInput();
    else if (change === "hidden") f.context({ visible: false });
    else if (change === "revision") f.context({ revision: 4 });
    else if (change === "projection") f.context({ projectionEpoch: 6 });
    else { f.context({ key: "other" }); f.coordinator.contextChanged(); }
    await f.advance(2);
    expect(await pending).toBe("SUPERSEDED");
    expect(f.port.repair).not.toHaveBeenCalled();
  });

  it("does not repair diagnostic scroll after native capacity shrinks", async () => {
    const f = fixture(), target = { left: 240, top: 96 };
    vi.mocked(f.port.apply).mockImplementation(async () => { f.update({ core: target }); return target; });
    const pending = f.coordinator.request({ kind: "DIAGNOSTIC_SCROLL", left: target.left });
    await f.advance(); f.update({ capacity: { left: 100, top: 1000 } });
    await f.advance(14);
    expect(await pending).toBe("TIMED_OUT");
    expect(f.port.repair).not.toHaveBeenCalled();
  });

  it("keeps range extension on its immediate path without geometry preparation", async () => {
    const f = fixture(); f.port.prepare = vi.fn<NonNullable<ViewportPort["prepare"]>>(async () => ({ ready: false }));
    const pending = f.coordinator.request({ kind: "RANGE_EXTENSION", width: 2400 });
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    await f.advance(5); expect(await pending).toBe("SETTLED");
    expect(f.port.prepare).not.toHaveBeenCalled();
  });

  it("restarts the three-frame geometry observation when measured layout changes", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(2);
    f.update({ geometry: "measured-2" });
    await f.advance(3);
    expect(f.port.apply).not.toHaveBeenCalled();
    await f.advance(); expect(f.port.apply).toHaveBeenCalledTimes(1);
    await f.advance(3); expect(await pending).toBe("SETTLED");
  });

  it.each([false, true])("restores a filter bookmark only without a newer user gesture (gesture=%s)", async moved => {
    const f = fixture(); f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    f.update({ core: { left: 0, top: 0 }, native: { left: 0, top: 0 } });
    if (moved) f.coordinator.userInput();
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.advance(8);
    if (moved) expect(f.port.apply).not.toHaveBeenCalled();
    else expect(f.port.apply).toHaveBeenCalledWith({ kind: "FILTER_RETURN", position: { left: 120, top: 0 } }, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
  });

  it.each([0, 24])("restores horizontal bookmark while preserving a legal filtered vertical clamp to %s", async top => {
    const f = fixture(); f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    f.update({ core: { left: 0, top }, native: { left: 0, top } });
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.advance(8);
    expect(f.port.apply).toHaveBeenCalledWith({ kind: "FILTER_RETURN", position: { left: 120, top } }, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
    expect(f.sample.core).toEqual({ left: 120, top });
    expect(f.sample.native).toEqual({ left: 120, top });
  });

  it("re-prepares a filter bookmark when late Core filter-tasks contracts axis capacity after first preparation", async () => {
    const f = fixture();
    let preparations = 0;
    f.port.admitPosition = vi.fn(position => f.sample.capacity.left >= position.left && f.sample.capacity.top >= position.top);
    f.port.prepare = vi.fn(async command => {
      expect(command).toMatchObject({ kind: "FILTER_RETURN", compatibility: true });
      preparations++;
      if (preparations === 2) f.update({ capacity: { left: 1000, top: 1000 } });
      return { ready: true };
    });
    f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    f.update({ core: { left: 0, top: 0 }, native: { left: 0, top: 0 } });
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.flush();
    expect(f.port.prepare).toHaveBeenCalledTimes(1);
    // Actual UI trace #2838: the old geometry admitted 120, but the
    // filter-tasks layout shrank it to 47 before FILTER_RETURN applied.
    f.update({ capacity: { left: 47, top: 1000 } });
    await f.advance(15);
    expect(f.port.prepare).toHaveBeenCalledTimes(2);
    expect(f.port.apply).toHaveBeenCalledExactlyOnceWith(
      { kind: "FILTER_RETURN", position: { left: 120, top: 0 } },
      expect.any(Function), expect.any(Object),
    );
    expect(f.sample.core).toEqual({ left: 120, top: 0 });
  });

  it("fails closed when the same filter return cannot re-prepare capacity, without replaying a stale coordinate", async () => {
    const f = fixture();
    let preparations = 0;
    f.port.admitPosition = vi.fn(position => f.sample.capacity.left >= position.left);
    f.port.prepare = vi.fn(async () => ({ ready: ++preparations === 1 }));
    f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    f.update({ core: { left: 0, top: 0 }, native: { left: 0, top: 0 } });
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.flush();
    f.update({ capacity: { left: 47, top: 1000 } });
    await f.advance(12);
    expect(f.port.prepare).toHaveBeenCalledTimes(2);
    expect(f.port.apply).not.toHaveBeenCalled();
    expect(f.port.trace).toHaveBeenCalledWith("NO_SCROLL_CAPACITY", expect.objectContaining({ kind: "FILTER_RETURN" }),
      "NO_SCROLL_CAPACITY", expect.objectContaining({ decisionReason: "NO_SCROLL_CAPACITY" }));
  });

  it("uses the latest coherent vertical clamp at apply rather than the one before preparation", async () => {
    const f = fixture(); let finish!: (result: { ready: boolean }) => void;
    f.port.prepare = vi.fn<NonNullable<ViewportPort["prepare"]>>(() => new Promise(resolve => { finish = resolve; }));
    f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    f.update({ core: { left: 0, top: 32 }, native: { left: 0, top: 32 } });
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.flush();
    expect(f.port.prepare).toHaveBeenCalledWith({ kind: "FILTER_RETURN", position: { left: 120, top: 32 }, compatibility: true }, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
    f.update({ core: { left: 0, top: 8 }, native: { left: 0, top: 8 } }); finish({ ready: true });
    await f.advance(8);
    expect(f.port.apply).toHaveBeenCalledWith({ kind: "FILTER_RETURN", position: { left: 120, top: 8 } }, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
  });

  it("does not restore horizontal bookmark before a pending native vertical clamp becomes coherent", async () => {
    const f = fixture(); f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    f.update({ core: { left: 0, top: 96 }, native: { left: 0, top: 0 } });
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.advance(4); expect(f.port.apply).not.toHaveBeenCalled();
    f.update({ core: { left: 0, top: 0 } });
    await f.advance(8);
    expect(f.port.apply).toHaveBeenCalledWith({ kind: "FILTER_RETURN", position: { left: 120, top: 0 } }, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
  });

  it.each(["reveal", "columns"] as const)("discards filter bookmark after %s", async change => {
    const f = fixture(); f.coordinator.filterInput();
    f.context({ filtered: true, filter: "search", receiptFilter: "search" }); f.coordinator.contextChanged();
    if (change === "reveal") {
      const reveal = f.coordinator.request({ kind: "TASK_REVEAL", taskId: "task" });
      await f.advance(8); expect(await reveal).toBe("SETTLED");
      vi.mocked(f.port.apply).mockClear();
    } else {
      f.context({ columns: "new-columns" }); f.coordinator.contextChanged();
    }
    f.context({ filtered: false, filter: "all", receiptFilter: "all" }); f.coordinator.contextChanged();
    await f.advance(8); expect(f.port.apply).not.toHaveBeenCalled();
  });

  it("rejects an older explicit reveal even after the newer reveal settles", async () => {
    const f = fixture(), old = f.coordinator.stamp();
    const reveal = f.coordinator.request({ kind: "TASK_REVEAL", taskId: "new" });
    await f.advance(8); expect(await reveal).toBe("SETTLED");
    expect(await f.coordinator.request({ kind: "TASK_REVEAL", taskId: "old" }, old)).toBe("SUPERSEDED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
  });

  it("does not replay a bookmark into empty results or another scope", async () => {
    for (const patch of [{ empty: true }, { scope: "other" }]) {
      const f = fixture(); f.coordinator.filterInput();
      f.context({ filtered: true, filter: "search" }); f.coordinator.contextChanged();
      f.context({ filtered: false, filter: "all", ...patch }); f.coordinator.contextChanged();
      await f.advance(8); expect(f.port.apply).not.toHaveBeenCalled();
    }
  });

  it("requires exact Core offsets but permits one pixel of native rounding", async () => {
    const f = fixture(8), pending = f.coordinator.request(peer);
    await f.advance(3);
    f.update({ core: { left: 119, top: 96 }, native: { left: 119, top: 96 } });
    await f.advance(3); expect(f.port.protect).not.toHaveBeenCalled();
    f.update({ core: { left: 120, top: 96 } });
    await f.advance(3); expect(await pending).toBe("SETTLED");
  });

  it("bounds repairs to three attempts and reports timeout when native offsets never settle", async () => {
    const f = fixture(8);
    vi.mocked(f.port.repair).mockReturnValue(true);
    const pending = f.coordinator.request(peer); await f.advance(3);
    f.update({ native: { left: 0, top: 0 } });
    await f.advance(10);
    expect(await pending).toBe("TIMED_OUT");
    expect(f.port.repair).toHaveBeenCalledTimes(3);
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.trace).toHaveBeenLastCalledWith("TIMED_OUT", peer, "TIMED_OUT", expect.objectContaining({ decisionReason: "TIMED_OUT" }));
  });

  it("does not count unanimated frame callbacks as settled observations", async () => {
    const f = fixture(6), pending = f.coordinator.request(peer);
    await f.advance(3); await f.advance(8, false);
    expect(await pending).toBe("TIMED_OUT");
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it("extends capacity before projection readiness without repairing an obsolete coordinate", async () => {
    const f = fixture();
    f.update({ receipt: null, core: { left: 17, top: 0 }, native: { left: 17, top: 0 } });
    vi.mocked(f.port.apply).mockResolvedValue({ left: 17, top: 0 });
    const range = { kind: "RANGE_EXTENSION", width: 2400 } as const;
    const source = f.coordinator.stamp();
    const pending = f.coordinator.request(range, source);
    expect(f.port.apply).toHaveBeenCalledWith(range, expect.any(Function), source);
    f.context({});
    f.update({ core: { left: 120, top: 0 }, native: { left: 17, top: 0 } });
    await f.advance(5);
    expect(f.port.trace).not.toHaveBeenCalledWith("SETTLED", range, "SETTLED", expect.any(Object));
    f.update({ native: { left: 120, top: 0 } });
    await f.advance(5);
    expect(await pending).toBe("SETTLED");
    expect(f.port.repair).not.toHaveBeenCalled();
    expect(f.port.protect).not.toHaveBeenCalled();
    expect(f.sample.core.left).toBe(120);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1, 1_000_001])("rejects unsupported range width %s without touching the port", async width => {
    const f = fixture();
    const command = { kind: "RANGE_EXTENSION", width } as const;
    expect(await f.coordinator.request(command)).toBe("UNSUPPORTED");
    expect(f.port.apply).not.toHaveBeenCalled();
    expect(f.port.frame).not.toHaveBeenCalled();
    expect(f.port.release).not.toHaveBeenCalled();
    expect(f.port.trace).toHaveBeenLastCalledWith("UNSUPPORTED", command, "UNSUPPORTED",
      expect.objectContaining({ decisionReason: "INVALID_RANGE_WIDTH" }));
  });

  it.each([1, 1_000_000])("accepts supported range boundary %s", async width => {
    const f = fixture(), command = { kind: "RANGE_EXTENSION", width } as const;
    const pending = f.coordinator.request(command);
    expect(f.port.apply).toHaveBeenCalledWith(command, expect.any(Function), expect.objectContaining({ context: expect.any(String), contextEpoch: expect.any(Number), gesture: expect.any(Number), intent: expect.any(Number) }));
    await f.advance(5); expect(await pending).toBe("SETTLED");
  });

  it("rejects a parallel axis position writer while an existing restore or reveal owns its lease", async () => {
    for (const command of [peer, { kind: "TASK_REVEAL", taskId: "task" } as const, { kind: "FILTER_RETURN", position: { left: 120, top: 0 } } as const]) {
      const f = fixture(), pending = f.coordinator.request(command);
      const releasesBeforeRange = vi.mocked(f.port.release).mock.calls.length;
      expect(await f.coordinator.request({ kind: "RANGE_EXTENSION", width: 2400 })).toBe("SUPERSEDED");
      expect(f.port.release).toHaveBeenCalledTimes(releasesBeforeRange);
      await f.advance(10);
      expect(await pending).toBe("SETTLED");
      expect(f.port.apply).toHaveBeenCalledTimes(1);
      expect(f.port.apply).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "RANGE_EXTENSION" }), expect.anything(), expect.anything());
    }
  });

  it("revokes an old range position callback before a newer filter return can be overwritten", async () => {
    const f = fixture();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(f.port.apply).mockImplementation(async (command, current) => {
      if (command.kind === "RANGE_EXTENSION") {
        await gate;
        if (!current()) return null;
        f.update({ core: { left: 0, top: 0 }, native: { left: 0, top: 0 } });
        return { left: 0, top: 0 };
      }
      const position = "position" in command ? command.position : { left: 120, top: 0 };
      f.update({ core: position, native: position });
      return position;
    });
    const old = f.coordinator.request({ kind: "RANGE_EXTENSION", width: 2400 });
    const latest = f.coordinator.request({ kind: "FILTER_RETURN", position: { left: 120, top: 0 } });
    await f.advance(10);
    expect(await latest).toBe("SETTLED");
    release(); await f.flush();
    expect(await old).toBe("SUPERSEDED");
    expect(f.sample.core.left).toBe(120);
    expect(f.sample.native.left).toBe(120);
  });
  it("aborts replaced range observers and releases their frames on input and dispose", async () => {
    const f = fixture();
    const first = f.coordinator.request({ kind: "RANGE_EXTENSION", width: 2400 });
    await f.flush(); const firstSignal = vi.mocked(f.port.frame).mock.calls.at(-1)![0];
    const second = f.coordinator.request({ kind: "RANGE_EXTENSION", width: 2800 });
    await f.flush(); const secondSignal = vi.mocked(f.port.frame).mock.calls.at(-1)![0];
    expect(firstSignal.aborted).toBe(true);
    expect(await first).toBe("SUPERSEDED");
    f.coordinator.userInput(); expect(secondSignal.aborted).toBe(true);
    expect(await second).toBe("SUPERSEDED");
    expect(f.port.trace).toHaveBeenLastCalledWith("SUPERSEDED", expect.objectContaining({ kind: "RANGE_EXTENSION" }), "SUPERSEDED",
      expect.objectContaining({ decisionReason: "USER_GESTURE" }));
    const third = f.coordinator.request({ kind: "RANGE_EXTENSION", width: 3200 });
    await f.flush(); const thirdSignal = vi.mocked(f.port.frame).mock.calls.at(-1)![0];
    f.coordinator.dispose(); expect(thirdSignal.aborted).toBe(true);
    expect(await third).toBe("SUPERSEDED");
    expect(f.port.repair).not.toHaveBeenCalled();
  });

  it("logs early rejection provenance and its actual arbitration reason", async () => {
    const f = fixture(), source = f.coordinator.stamp();
    f.coordinator.userInput();
    expect(await f.coordinator.request(peer, source)).toBe("SUPERSEDED");
    expect(f.port.trace).toHaveBeenLastCalledWith("SUPERSEDED", peer, "SUPERSEDED", {
      intentEpoch: 1, contextEpoch: 0, gesture: 0, projectionEpoch: 5,
      apiInstance: "api-1", decisionReason: "STALE_GESTURE",
    });
    f.context({ visible: false });
    expect(await f.coordinator.request(peer)).toBe("NOT_MEASURABLE");
    expect(f.port.trace).toHaveBeenLastCalledWith("NOT_MEASURABLE", peer, "NOT_MEASURABLE",
      expect.objectContaining({ decisionReason: "HIDDEN_OR_UNMEASURABLE" }));
  });

  it("never repairs an old target after the projection generation changes during settle", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(3); expect(f.port.apply).toHaveBeenCalledTimes(1);
    f.context({ projectionEpoch: 6 });
    f.update({ native: { left: 0, top: 0 } });
    await f.advance(); expect(await pending).toBe("SUPERSEDED");
    expect(f.port.trace).toHaveBeenLastCalledWith("SUPERSEDED", peer, "SUPERSEDED",
      expect.objectContaining({ decisionReason: "STALE_PROJECTION" }));
    expect(f.port.repair).not.toHaveBeenCalled();
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it("requires three fresh settled frames after post-command geometry changes", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(5);
    f.update({ geometry: "post-command-layout" });
    await f.advance(); expect(f.port.protect).not.toHaveBeenCalled();
    await f.advance(2); expect(f.port.protect).not.toHaveBeenCalled();
    await f.advance(); expect(await pending).toBe("SETTLED");
  });

  it.each(["revision", "generation", "receipt"] as const)("revokes settled authority when %s changes before the next queue", async change => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(8); expect(await pending).toBe("SETTLED");
    const authority = vi.mocked(f.port.protect).mock.calls.at(-1)![1];
    expect(authority()).toBe(true);
    const releases = vi.mocked(f.port.release).mock.calls.length;
    if (change === "revision") f.context({ revision: 4, projectionEpoch: 6 }, false);
    else if (change === "generation") f.context({ projectionEpoch: 6 });
    else f.update({ receipt: { ...f.sample.receipt!, outcome: "TIMED_OUT" } });
    expect(authority()).toBe(false);
    f.coordinator.contextChanged();
    expect(f.port.release).toHaveBeenCalledTimes(releases + 1);
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.repair).not.toHaveBeenCalled();
  });

  it("invalidates provisional write authority when the same-generation receipt becomes invalid", async () => {
    const f = fixture();
    const pending = f.coordinator.request(peer);
    await f.advance(3); expect(f.port.apply).toHaveBeenCalledTimes(1);
    const provisional = vi.mocked(f.port.apply).mock.calls[0][1];
    expect(provisional()).toBe(true);
    f.update({ receipt: null, native: { left: 0, top: 0 } });
    expect(provisional()).toBe(false);
    await f.advance(); expect(await pending).toBe("SUPERSEDED");
    expect(f.port.repair).not.toHaveBeenCalled();
    expect(f.port.protect).not.toHaveBeenCalled();
  });

  it("rejects hidden views immediately and persistent zero geometry within a finite budget", async () => {
    const hidden = fixture(); hidden.context({ visible: false });
    expect(await hidden.coordinator.request(peer)).toBe("NOT_MEASURABLE");
    expect(hidden.port.apply).not.toHaveBeenCalled();
    const zero = fixture(); zero.update({ measurable: false });
    const zeroPending = zero.coordinator.request(peer);
    await zero.advance(13);
    expect(await zeroPending).toBe("NOT_MEASURABLE");
    expect(zero.port.frame).toHaveBeenCalledTimes(12);
    expect(zero.port.apply).not.toHaveBeenCalled();
    const empty = fixture(); empty.context({ empty: true });
    expect(await empty.coordinator.request(peer)).toBe("NOT_MEASURABLE");
    expect(empty.port.apply).not.toHaveBeenCalled();
  });

  it("waits for a visible peer's zero geometry to become measurable with the latest receipt", async () => {
    const f = fixture(); f.update({ measurable: false, receipt: null });
    const pending = f.coordinator.request(peer);
    await f.advance(2); expect(f.port.apply).not.toHaveBeenCalled();
    f.context({ projectionEpoch: 6 }); f.update({ measurable: true, geometry: "visible-layout" });
    await f.advance(3); expect(f.port.apply).not.toHaveBeenCalled();
    await f.advance(5); expect(await pending).toBe("SETTLED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
  });

  it("restarts geometry proof after a temporary zero measurement before apply", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    await f.advance(2); f.update({ measurable: false });
    await f.advance(2); expect(f.port.apply).not.toHaveBeenCalled();
    f.update({ measurable: true });
    await f.advance(3); expect(f.port.apply).not.toHaveBeenCalled();
    await f.advance(4); expect(await pending).toBe("SETTLED");
  });

  it.each(["wheel", "scope"] as const)("cancels a visible zero-geometry waiter on %s without writing", async change => {
    const f = fixture(); f.update({ measurable: false });
    const pending = f.coordinator.request(peer);
    await f.advance();
    if (change === "wheel") f.coordinator.userInput();
    else { f.context({ scope: "other" }); f.coordinator.contextChanged(); }
    expect(await pending).toBe("SUPERSEDED");
    f.update({ measurable: true }); await f.advance(8);
    expect(f.port.apply).not.toHaveBeenCalled();
    expect(f.port.repair).not.toHaveBeenCalled();
  });

  it("classifies no-capacity and unsupported date requests without retries", async () => {
    const f = fixture(); vi.mocked(f.port.apply).mockResolvedValue(null);
    const pending = f.coordinator.request(peer); await f.advance(8);
    expect(await pending).toBe("NO_SCROLL_CAPACITY");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(await f.coordinator.request({ kind: "DATE_REVEAL", date: new Date("2026-10-11") })).toBe("UNSUPPORTED");
    expect(f.port.apply).toHaveBeenCalledTimes(1);
  });

  it.each([["TIMED_OUT", "TIMED_OUT"], ["command rejected", "FAILED"]] as const)("classifies command rejection %s as %s", async (message, outcome) => {
    const f = fixture(); vi.mocked(f.port.apply).mockRejectedValue(new Error(message));
    const pending = f.coordinator.request(peer); await f.advance(8);
    expect(await pending).toBe(outcome);
    expect(f.port.apply).toHaveBeenCalledTimes(1);
    expect(f.port.trace).toHaveBeenLastCalledWith(outcome, peer, outcome, expect.objectContaining({ decisionReason: outcome }));
  });

  it("disposes pending observation and refuses subsequent commands", async () => {
    const f = fixture(), pending = f.coordinator.request(peer);
    f.coordinator.dispose(); expect(await pending).toBe("SUPERSEDED");
    await f.advance(8);
    expect(await f.coordinator.request(peer)).toBe("SUPERSEDED");
    expect(f.port.apply).not.toHaveBeenCalled();
    expect(f.port.release).toHaveBeenCalled();
  });
});
