import { describe, expect, it, vi } from "vitest";
import { createAxisTransaction, type AxisObservation, type AxisTransactionOptions } from "../../../src/features/gantt/viewport/axis-transaction";
import type { GeometryReadResult, UserIntentLease } from "../../../src/features/gantt/state-consistency";

let source = 0;
function fixture(overrides: Partial<AxisTransactionOptions> = {}) {
  let axis: AxisObservation = { startMs: 0, endMs: 100, scaleWidth: 500 };
  let left = 100, top = 20, nativeLeft = 100, nativeTop = 20, scrollWidth = 1000, time = 0;
  const width = 500;
  let visible = true, leaseCurrent = true;
  const controller = new AbortController();
  const lease: UserIntentLease = { stamp: { context: `axis-source-${++source}`, contextEpoch: 1, gesture: 1, intent: 1 }, priority: 1 };
  const abort = { signal: controller.signal, isCurrent: () => leaseCurrent };
  const readGeometry = (): GeometryReadResult => visible ? { ok: true, core: { left, top }, value: {
    left: nativeLeft, top: nativeTop, chartX: 0, chartY: 30, chartWidth: width, chartHeight: 200, scrollWidth, scrollHeight: 500, verticalClientHeight: 200, gridWidth: 300,
  } } : { ok: false, outcome: "NOT_MEASURABLE" };
  const changeExtent = vi.fn<AxisTransactionOptions["changeExtent"]>((extent) => { axis = { ...extent, scaleWidth: 1000 }; left = nativeLeft = 0; });
  const applyPosition = vi.fn<AxisTransactionOptions["applyPosition"]>((position) => { left = nativeLeft = position.left; top = nativeTop = position.top; });
  const clock = { now: () => time, frame: vi.fn(async () => { time += 16; await Promise.resolve(); return true; }) };
  const options: AxisTransactionOptions = { apiInstance: lease.stamp.context, source: {}, geometry: { readGeometry }, clock, strategy: "EXPLICIT_EXTENT", readAxis: () => axis, isLeaseCurrent: current => current === lease && leaseCurrent,
    changeExtent, applyPosition, ...overrides };
  return { options, lease, abort, controller, clock, changeExtent, applyPosition,
    request: { extent: { startMs: 0, endMs: 200 }, policy: { kind: "PRESERVE" as const }, lease, abort },
    setAxis: (value: AxisObservation) => { axis = value; }, setCapacity: (value: number) => { scrollWidth = value + width; },
    hide: () => { visible = false; leaseCurrent = false; }, stale: () => { leaseCurrent = false; },
    drift: () => { nativeLeft++; }, readGeometry };
}

describe("isolated axis transaction", () => {
  it("restores the pre-change Core position, not the resize side effect, and confirms three native frames", async () => {
    const f = fixture();
    const result = await createAxisTransaction(f.options).run(f.request);
    expect(result).toMatchObject({ outcome: "SETTLED", viewport: "PRESERVED", position: { left: 100, top: 20 }, axis: { endMs: 200 } });
    expect(f.applyPosition).toHaveBeenCalledWith({ left: 100, top: 20 }, expect.objectContaining({ lease: f.lease }));
    expect(f.clock.frame.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
  it("extends the union without truncating the previously covered right edge", async () => {
    const f = fixture();
    expect((await createAxisTransaction(f.options).run({ ...f.request, extent: { startMs: -100, endMs: 50 } })).outcome).toBe("SETTLED");
    expect(f.changeExtent).toHaveBeenCalledWith({ startMs: -100, endMs: 100 }, expect.anything());
  });
  it("rejects a greater-than-ten-calendar-year union without shrinking the existing axis", async () => {
    const f = fixture();
    const start = new Date(2020, 0, 1).getTime(), end = new Date(2030, 0, 1).getTime();
    f.setAxis({ startMs: start, endMs: end, scaleWidth: 1000 });
    expect((await createAxisTransaction(f.options).run({ ...f.request, extent: { startMs: start - 1, endMs: end } })).reason).toBe("DATE_SPAN_EXCEEDED");
    expect(f.changeExtent).not.toHaveBeenCalled();
    f.setAxis({ startMs: start, endMs: end + 1, scaleWidth: 1000 });
    expect((await createAxisTransaction(f.options).run({ ...f.request, extent: { startMs: start, endMs: end } })).reason).toBe("DATE_SPAN_EXCEEDED");
    expect(f.changeExtent).not.toHaveBeenCalled();
  });
  it.each(["command-return", "coverage-wait", "physical-frame", "settle-frame"])("rejects observed hundred-year overextension at %s", async phase => {
    const f = fixture(); let frames = 0;
    const oversized = { startMs: new Date(1950, 0, 1).getTime(), endMs: new Date(2050, 0, 1).getTime(), scaleWidth: 500 };
    const options: AxisTransactionOptions = { ...f.options,
      changeExtent: extent => { if (phase === "command-return") f.setAxis(oversized); else if (phase !== "coverage-wait") f.setAxis({ ...extent, scaleWidth: 1000 }); },
      applyPosition: (position, context) => { f.applyPosition(position, context); if (phase === "settle-frame") f.setAxis(oversized); },
      clock: { ...f.clock, frame: async () => {
        frames++;
        if (phase === "coverage-wait" && frames === 3 || phase === "physical-frame" && frames === 3) f.setAxis(oversized);
        return f.clock.frame();
      } },
    };
    const result = await createAxisTransaction(options).run(f.request);
    expect(result).toMatchObject({ outcome: "UNSUPPORTED", reason: "DATE_SPAN_EXCEEDED", viewport: "UNAVAILABLE" });
    if (phase !== "settle-frame") expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("coalesces the identical request under the original lease and rejects competing work as busy", async () => {
    const f = fixture(), facade = createAxisTransaction(f.options);
    const first = facade.run(f.request);
    expect(facade.run(f.request)).toBe(first);
    expect(await facade.run({ ...f.request, extent: { startMs: 0, endMs: 300 } })).toMatchObject({ reason: "BUSY" });
    expect((await first).outcome).toBe("SETTLED");
    expect(f.changeExtent).toHaveBeenCalledTimes(1);
  });
  it("does not infer date coverage from increased physical capacity or successful callback", async () => {
    const f = fixture({ maxFrames: 8 });
    f.options = { ...f.options, changeExtent: () => { f.setCapacity(4000); } };
    const result = await createAxisTransaction(f.options).run(f.request);
    expect(result.outcome).toBe("TIMED_OUT");
    expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("waits for actual extent observation after the prop callback returns", async () => {
    const f = fixture(); let frames = 0;
    const result = await createAxisTransaction({ ...f.options, changeExtent: () => {}, clock: { ...f.clock, frame: async () => {
      if (++frames === 3) f.setAxis({ startMs: 0, endMs: 200, scaleWidth: 1000 });
      return f.clock.frame();
    } } }).run(f.request);
    expect(result.outcome).toBe("SETTLED");
    expect(frames).toBeGreaterThanOrEqual(6);
  });
  it("reports unavailable preservation and only clamps under explicit policy", async () => {
    const f = fixture(); f.setCapacity(50);
    expect(await createAxisTransaction(f.options).run(f.request)).toMatchObject({ outcome: "NO_SCROLL_CAPACITY", viewport: "UNAVAILABLE", requestedPosition: { left: 100, top: 20 }, capacity: { left: 50 } });
    expect(f.applyPosition).not.toHaveBeenCalled();
    const g = fixture(); g.setCapacity(50);
    expect(await createAxisTransaction(g.options).run({ ...g.request, policy: { kind: "PRESERVE", allowClamp: true } })).toMatchObject({ outcome: "SETTLED", viewport: "CLAMPED", position: { left: 50, top: 20 }, requestedPosition: { left: 100, top: 20 } });
  });
  it.each(["user", "query", "API", "axis", "hidden"])("cancels %s drift without a follow-up position write", async reason => {
    const f = fixture();
    const result = await createAxisTransaction({ ...f.options, changeExtent: () => { if (reason === "hidden") f.hide(); else f.stale(); } }).run(f.request);
    expect(result.outcome).toBe("SUPERSEDED");
    expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("does not settle mere Core equality with persistent native drift", async () => {
    const f = fixture({ maxFrames: 10 });
    const result = await createAxisTransaction({ ...f.options, applyPosition: position => { f.applyPosition(position, { signal: f.controller.signal, lease: f.lease, current: () => true }); }, clock: { ...f.clock, frame: async () => { f.drift(); return f.clock.frame(); } } }).run(f.request);
    expect(result.outcome).toBe("TIMED_OUT");
  });
  it("bounds an unresolved axis command and rejects late writes by its original context", async () => {
    const f = fixture({ maxFrames: 5 }); let context: Parameters<AxisTransactionOptions["changeExtent"]>[1] | undefined;
    const result = await createAxisTransaction({ ...f.options, changeExtent: (_extent, current) => { context = current; return new Promise(() => {}); } }).run(f.request);
    expect(result.outcome).toBe("TIMED_OUT");
    expect(context?.current()).toBe(false);
    expect(context?.signal.aborted).toBe(true);
  });
  it("disposes immediately while a frame waits and cleans the active transaction", async () => {
    const f = fixture(); let waiting: AbortSignal | undefined, cleaned = 0;
    const facade = createAxisTransaction({ ...f.options, clock: { now: () => 0, frame: signal => new Promise(resolve => {
      waiting = signal;
      const onAbort = () => { signal.removeEventListener("abort", onAbort); cleaned++; resolve(false); };
      signal.addEventListener("abort", onAbort, { once: true });
    }) } });
    const pending = facade.run(f.request);
    expect(waiting?.aborted).toBe(false);
    facade.dispose();
    expect(waiting?.aborted).toBe(true);
    expect((await pending).outcome).toBe("SUPERSEDED");
    expect(facade.state().busy).toBe(false);
    expect(cleaned).toBe(1);
    expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("keeps hard compatibility budgets and normalizes callback error text", async () => {
    const f = fixture();
    for (const budget of [{ maxScaleWidth: 1_000_001 }, { maxExtensions: 4 }, { maxDurationMs: 5001 }, { maxFrames: 601 }]) {
      expect(() => createAxisTransaction({ ...f.options, ...budget })).toThrow("Invalid axis transaction budget");
    }
    const result = await createAxisTransaction({ ...f.options, changeExtent: () => { throw new Error("sensitive callback text"); } }).run(f.request);
    expect(result).toMatchObject({ outcome: "FAILED", reason: "PORT_FAILED" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });
  it.each(["abort", "lease"])("normalizes throwing %s authority reads without rejecting or exposing text", async port => {
    const f = fixture();
    const fail = () => { throw new Error("sensitive authority text"); };
    const result = await createAxisTransaction({ ...f.options, isLeaseCurrent: port === "lease" ? fail : f.options.isLeaseCurrent }).run({ ...f.request,
      abort: port === "abort" ? { signal: f.controller.signal, isCurrent: fail } : f.abort,
    });
    expect(result).toMatchObject({ outcome: "FAILED", reason: "PORT_FAILED" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(f.changeExtent).not.toHaveBeenCalled();
    expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("normalizes authority read failures arising after an await", async () => {
    const f = fixture(); let fail = false;
    const result = await createAxisTransaction({ ...f.options, changeExtent: () => { fail = true; }, isLeaseCurrent: () => {
      if (fail) throw new Error("sensitive delayed authority text"); return true;
    } }).run(f.request);
    expect(result).toMatchObject({ outcome: "FAILED", reason: "PORT_FAILED" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("requires versioned synthetic opt-in and persists cancelled-source taint across facade recreation", async () => {
    const f = fixture({ strategy: "SYNTHETIC_COMPATIBILITY" });
    expect((await createAxisTransaction(f.options).run(f.request)).reason).toBe("COMPATIBILITY_NOT_APPROVED");
    const options: AxisTransactionOptions = { ...f.options, compatibility: { enabled: true, wrapperVersion: "2.7.3", storeVersion: "2.7.2", source: f.options.source }, changeExtent: () => { f.controller.abort(); } };
    expect((await createAxisTransaction(options).run(f.request)).outcome).toBe("SUPERSEDED");
    expect((await createAxisTransaction(options).run(f.request)).reason).toBe("COMPATIBILITY_TAINTED");
    const freshAbort = { signal: new AbortController().signal, isCurrent: () => true };
    const explicit = createAxisTransaction({ ...f.options, strategy: "EXPLICIT_EXTENT" });
    expect(await explicit.run({ ...f.request, abort: freshAbort })).toMatchObject({ outcome: "UNSUPPORTED", reason: "COMPATIBILITY_TAINTED" });
    // A new mounted Core has a different object identity; no global API-ID ban.
    const clean = fixture();
    expect((await createAxisTransaction(clean.options).run(clean.request)).outcome).toBe("SETTLED");
    expect(f.applyPosition).not.toHaveBeenCalled();
  });
  it("requires a shared physical source for synthetic writes instead of an unrelated identity", async () => {
    const f = fixture({ strategy: "SYNTHETIC_COMPATIBILITY" });
    const result = await createAxisTransaction({ ...f.options, compatibility: {
      enabled: true, wrapperVersion: "2.7.3", storeVersion: "2.7.2", source: {},
    } }).run(f.request);
    expect(result).toMatchObject({ outcome: "UNSUPPORTED", reason: "COMPATIBILITY_NOT_APPROVED" });
    expect(f.changeExtent).not.toHaveBeenCalled();
  });
  it("rejects hidden/zero-sized geometry, invalid dates, oversize axis, and exhausted extension budget", async () => {
    const f = fixture();
    expect((await createAxisTransaction(f.options).run({ ...f.request, extent: { startMs: NaN, endMs: 1 } })).reason).toBe("INVALID_REQUEST");
    expect((await createAxisTransaction(f.options).run({ ...f.request, extent: { startMs: 0, endMs: 1e15 } })).reason).toBe("DATE_BOUND_EXCEEDED");
    f.setAxis({ startMs: 0, endMs: 100, scaleWidth: 1_000_001 });
    expect((await createAxisTransaction(f.options).run(f.request)).reason).toBe("AXIS_BOUND_EXCEEDED");
    const g = fixture(), facade = createAxisTransaction({ ...g.options, maxExtensions: 1 });
    expect((await facade.run(g.request)).outcome).toBe("SETTLED");
    expect((await facade.run({ ...g.request, extent: { startMs: 0, endMs: 300 } })).reason).toBe("EXTENSION_BUDGET_EXCEEDED");
    const h = fixture(); h.hide();
    expect((await createAxisTransaction(h.options).run(h.request)).outcome).toBe("SUPERSEDED");
    const i = fixture();
    expect((await createAxisTransaction({ ...i.options, geometry: { readGeometry: () => ({ ok: true, core: { left: 0, top: 0 }, value: { ...(i.readGeometry() as Extract<GeometryReadResult, { ok: true }>).value, chartWidth: 0 } }) } }).run(i.request)).outcome).toBe("NOT_MEASURABLE");
  });
});
