import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowlistedTraceParams, createCoreActionTrace, samplesAgree, type TraceContext, type TraceSample } from "../../src/features/gantt/diagnostics/core-action-trace";

const sample = (): TraceSample => ({ core: { left: 120, top: 96, chartWidth: 400, scalesWidth: 6000 },
  native: { left: 119, top: 96, scrollWidth: 6000, clientWidth: 400, scrollHeight: 1600, clientHeight: 300 },
  geometry: { width: 600, height: 400, chartWidth: 400, chartHeight: 300 }, focus: "button" });
const context = (): TraceContext => ({ run: "unit", head: "synthetic", scenario: "settle", layer: "CORE_PUBLIC_API", apiInstance: 1,
  projectRevision: null, canonicalEpoch: 0, projectionEpoch: 0, scope: "synthetic", filterKey: "all", scale: "Day", intentId: 1, intentSource: "test" });

describe("bounded Core observation contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("drops raw task text, nested data, callbacks, URLs, nonfinite values and unknown fields", () => {
    expect(allowlistedTraceParams({ left: 120, task: { text: "private" }, cookie: "secret", id: "fixture-1", key: "https://host/password", width: Infinity, filter: () => true })).toEqual({ left: 120, id: "fixture-1" });
  });
  it("requires exact public coordinates and permits only native rounding of one pixel", () => {
    expect(samplesAgree(sample(), { left: 120, top: 96 })).toBe(true);
    expect(samplesAgree(sample(), { left: 119, top: 96 })).toBe(false);
    const changed = sample(); changed.native!.left = 118;
    expect(samplesAgree(changed)).toBe(false);
  });
  it("observes three stable frames rather than command resolution", async () => {
    const trace = createCoreActionTrace(context, sample);
    const pending = trace.settle({ left: 120, top: 96 });
    await vi.advanceTimersByTimeAsync(32);
    expect(trace.snapshot().entries.filter(entry => entry.event === "settle-result")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(16);
    expect(await pending).toBe("NATIVE_LAYOUT_SETTLED");
    expect(trace.snapshot().entries.at(-1)?.params.stableFrames).toBe(3);
  });
  it("restarts stable frame count when geometry changes", async () => {
    let observation = sample(); const trace = createCoreActionTrace(context, () => observation);
    const pending = trace.settle({ left: 120, top: 96 });
    await vi.advanceTimersByTimeAsync(32); observation = { ...observation, geometry: { ...observation.geometry, width: 650 } };
    await vi.advanceTimersByTimeAsync(32);
    expect(trace.snapshot().entries.at(-1)?.event).toBe("raf-observation");
    await vi.advanceTimersByTimeAsync(16); expect(await pending).toBe("NATIVE_LAYOUT_SETTLED");
  });
  it("classifies a newer input intent without restoring coordinates", async () => {
    const identity = context(), trace = createCoreActionTrace(() => identity, sample);
    const pending = trace.settle({ left: 120, top: 96 }); identity.intentId++;
    await vi.advanceTimersByTimeAsync(16); expect(await pending).toBe("SUPERSEDED_BY_INTENT");
  });
  it("distinguishes no native capacity from a finite timeout with capacity", async () => {
    const noCapacity = sample(); noCapacity.native!.scrollWidth = noCapacity.native!.clientWidth; noCapacity.native!.left = 0;
    const trace = createCoreActionTrace(context, () => noCapacity);
    const pending = trace.settle({ left: 120, top: 96 }); await vi.advanceTimersByTimeAsync(48);
    expect(await pending).toBe("NO_SCROLL_CAPACITY");
    const mismatch = createCoreActionTrace(context, sample);
    const timed = mismatch.settle({ left: 30, top: 96 }, 80); await vi.advanceTimersByTimeAsync(80);
    expect(await timed).toBe("TIMED_OUT");
  });
  it("does not call matching Core/native offsets settled when the actual chart has zero width", async () => {
    const hidden = sample(); hidden.native!.clientWidth = 0; hidden.geometry.chartWidth = 0;
    expect(samplesAgree(hidden, { left: 120, top: 96 })).toBe(false);
    const trace = createCoreActionTrace(context, () => hidden), pending = trace.settle();
    await vi.advanceTimersByTimeAsync(48); expect(await pending).toBe("NO_SCROLL_CAPACITY");
  });
  it("bounds the ring, redacts unsafe context and returns detached snapshots", () => {
    const identity = { ...context(), scenario: "https://host/private?token=secret" };
    const trace = createCoreActionTrace(() => identity, sample, 2);
    trace.record("one"); trace.record("two"); trace.record("three");
    const snapshot = trace.snapshot(); expect(snapshot.dropped).toBe(1); expect(snapshot.entries.map(entry => entry.sequence)).toEqual([2, 3]);
    expect(snapshot.entries[0].scenario).toBe("redacted"); snapshot.entries[0].sample.core.left = 0;
    expect(trace.snapshot().entries[0].sample.core.left).toBe(120);
  });
  it("resets trace identity and counters between fixture runs, cancelling old observers", async () => {
    const identity = context(), trace = createCoreActionTrace(() => identity, sample, 2);
    trace.record("old-one"); trace.record("old-two"); trace.record("old-three");
    const pending = trace.settle({ left: 120, top: 96 });
    trace.reset();
    expect(await pending).toBe("SUPERSEDED_BY_INTENT");
    Object.assign(identity, { run: "second", head: "new-sha", scenario: "new-scenario" });
    trace.record("scenario-start");
    const snapshot = trace.snapshot();
    expect(snapshot.dropped).toBe(0);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      sequence: 1, run: "second", head: "new-sha", scenario: "new-scenario", event: "scenario-start",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("disposes pending RAF/timer and rejects invalid settle bounds", async () => {
    const trace = createCoreActionTrace(context, sample), pending = trace.settle();
    trace.dispose(); expect(await pending).toBe("SUPERSEDED_BY_INTENT"); expect(vi.getTimerCount()).toBe(0);
    expect(await trace.settle()).toBe("SUPERSEDED_BY_INTENT");
    expect(() => trace.settle(undefined, NaN)).toThrow("Invalid settle bounds");
    expect(() => trace.settle({ left: Infinity, top: 0 })).toThrow("Invalid settle bounds");
  });
});
