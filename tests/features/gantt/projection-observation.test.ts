import { afterEach, describe, expect, it, vi } from "vitest";
import { createProjectionObservation, type ProjectionObservationPort, type ProjectionRowEvidence, type ProjectionReceipt } from "../../../src/features/gantt/projection-settled";
import { normalizeSerializedCore, readCoreSnapshot } from "../../../src/features/gantt/state-consistency/core-reader";
import { canonicalFixture, driftFixture, fakeClock, fakeCore, fakeGeometry, proofContextFixture, recoveryFixture } from "../../fixtures/gantt-state-consistency/synthetic";
import type { CanonicalGanttSnapshot } from "../../../src/features/gantt/canonical-snapshot-sync";
import type { CoreReadResult } from "../../../src/features/gantt/state-consistency/contracts";
import { createViewportCoordinator, type ViewportPort, type ViewportSample } from "../../../src/features/gantt/viewport/viewport-coordinator";
import captured from "../../fixtures/gantt-state-consistency/actual-core-2.7.3.json";

function fixture(input: CanonicalGanttSnapshot = canonicalFixture()) {
  const desired = input;
  vi.useFakeTimers();
  const base = proofContextFixture(), clock = fakeClock(), core = fakeCore(desired), geometry = fakeGeometry();
  const controller = new AbortController();
  let context = { source: base.source, desired: base.desired, layoutAxis: base.layoutAxis, intent: base.intent, visible: true, mounted: true };
  let recovery = recoveryFixture();
  let rows: ProjectionRowEvidence = { logicalVisibleIds: desired.tasks.map(task => String(task.id)), coreVisibleIds: desired.tasks.map(task => String(task.id)),
    mountedRows: desired.tasks.slice(0, 1).map(task => ({ id: String(task.id), text: task.text ?? "" })), requiredMountedIds: [String(desired.tasks[0].id)], measurable: true, aligned: true };
  const trace = { record: vi.fn() };
  const port: ProjectionObservationPort = {
    ...core.port, ...geometry.port, clock: clock.port, abort: { signal: controller.signal, isCurrent: () => true },
    readContext: () => context, readLayoutAxis: () => context.layoutAxis, readRecovery: () => recovery, readRows: () => rows, trace,
    // Deliberately permissive fake: facade independently checks actual/canonical/proof.
    verifyCore(input) {
      if (!input.observed.ok) return { ok: false, outcome: "FAILED", reason: "READ_FAILED" };
      return { ok: true, proof: { source: input.source, desired: input.identity, observation: input.observation, snapshot: input.observed.value } };
    },
  };
  const observer = createProjectionObservation(port);
  const settle = async () => { for (let index = 0; index < 4; index++) { clock.advance(); await Promise.resolve(); } };
  return { desired, core, clock, geometry, port, observer, settle, controller, trace, get context() { return context; }, setContext(value: typeof context) { context = value; }, get rows() { return rows; }, setRows(value: ProjectionRowEvidence) { rows = value; }, setRecovery(value: typeof recovery) { recovery = value; } };
}
afterEach(() => vi.useRealTimers());

describe("U3 semantic projection receipts (opt-in)", () => {
  it("retains the exact completed receipt and captured intent across fresh DTO/observation attempts", async () => {
    const f = fixture();
    const first = f.observer.observe(f.desired); await f.settle();
    const a = await first.promise;
    const second = await f.observer.observe(canonicalFixture()).promise;
    expect(a.outcome).toBe("SETTLED"); expect(second.outcome).toBe("SETTLED");
    expect(second.reused).toBe(true); expect(second.receipt).toBe(a.receipt);
    expect(second.observation.id).toBe(a.observation.id + 1);
    expect(second.semanticId).toBe(a.semanticId);
    expect(second.receipt?.observation.id).toBe(a.observation.id);
    expect(second.receipt?.context.intent).toEqual(f.context.intent);
    expect(f.core.reads).toBeGreaterThanOrEqual(4);
    expect(f.core.effects).toEqual({ coreWrites: 0, mutationRetries: 0 });
    expect(f.trace.record.mock.calls.every(call => Object.keys(call[2]).sort().join() === "count,id")).toBe(true);
    expect(vi.getTimerCount()).toBe(0); expect(f.clock.pending).toBe(0);
  });
  for (const drift of ["order", "date", "temporary-add", "link", "delete", "hierarchy", "type"] as const) {
    it(`rejects same-key ${drift} Core drift even with a permissive verifier`, async () => {
      const f = fixture(); const first = f.observer.observe(f.desired); await f.settle(); await first.promise;
      f.core.replace(driftFixture(drift));
      expect(await f.observer.observe(f.desired).promise).toMatchObject({ outcome: "FAILED", reused: false, receipt: null });
      expect(vi.getTimerCount()).toBe(0);
    });
  }
  for (const fault of ["missing", "source", "identity", "attempt", "snapshot", "throw"] as const) {
    it(`rejects ${fault} proof without reusing completion`, async () => {
      const f = fixture(); const first = f.observer.observe(f.desired); await f.settle(); await first.promise;
      const verify = f.port.verifyCore.bind(f.port);
      f.port.verifyCore = input => {
        if (fault === "throw") throw new Error("payload must not enter diagnostics");
        const result = verify(input); if (!result.ok) return result;
        const proof = fault === "missing" ? undefined : { ...result.proof,
          ...(fault === "source" ? { source: { ...input.source, dirty: 99 } } : {}),
          ...(fault === "identity" ? { desired: { ...input.identity, query: "stale" } } : {}),
          ...(fault === "attempt" ? { observation: { ...input.observation, id: 0 } } : {}),
          ...(fault === "snapshot" ? { snapshot: { tasks: [], tree: [], links: [] } } : {}) };
        return { ok: true, proof } as ReturnType<ProjectionObservationPort["verifyCore"]>;
      };
      expect(await f.observer.observe(f.desired).promise).toMatchObject({ outcome: "FAILED", receipt: null });
    });
  }
  for (const change of ["api", "revision", "query", "scope", "axis", "layout", "dirty", "intent", "hidden", "unmount"] as const) {
    it(`invalidates active observation for ${change} without issuing an intent lease`, async () => {
      const f = fixture(), context = f.context;
      const running = f.observer.observe(f.desired);
      f.setContext({ ...context,
        ...(change === "api" ? { source: { ...context.source, apiInstance: "next" } } : {}),
        ...(change === "dirty" ? { source: { ...context.source, dirty: 1 } } : {}),
        ...(change === "revision" ? { desired: { ...context.desired, revision: 18 } } : {}),
        ...(change === "query" ? { desired: { ...context.desired, query: "query" } } : {}),
        ...(change === "scope" ? { desired: { ...context.desired, scope: "A" } } : {}),
        ...(change === "axis" ? { layoutAxis: { ...context.layoutAxis, axis: "week" } } : {}),
        ...(change === "layout" ? { layoutAxis: { ...context.layoutAxis, layout: "compact" } } : {}),
        ...(change === "intent" ? { intent: { ...context.intent, stamp: { ...context.intent.stamp, gesture: 2 } } } : {}),
        ...(change === "hidden" ? { visible: false } : {}), ...(change === "unmount" ? { mounted: false } : {}),
      });
      await f.settle(); expect(await running.promise).toMatchObject({ outcome: "SUPERSEDED", receipt: null });
      expect(f.clock.pending).toBe(0); expect(vi.getTimerCount()).toBe(0);
    });
  }
  it("does not deadlock data receipt on viewport completion or horizontal offsets", async () => {
    const f = fixture();
    const geometry = f.port.readGeometry(); if (!geometry.ok) throw new Error("fixture");
    f.geometry.replace({ ...geometry, core: { left: 120, top: 96 }, value: { ...geometry.value, left: 108, top: 96 } });
    const operation = f.observer.observe(f.desired); await f.settle();
    expect((await operation.promise).outcome).toBe("SETTLED");
    expect(f.port.readGeometry()).toMatchObject({ core: { left: 120 }, value: { left: 108 } });
  });
  it("keeps mounted DOM names/order separate from the complete logical visible rows", async () => {
    const f = fixture(); const first = f.observer.observe(f.desired); await f.settle();
    const receipt = (await first.promise).receipt!;
    expect(receipt.rows.logicalVisibleIds).toEqual(["A", "B", "C"]);
    expect(receipt.rows.mountedRows).toEqual([{ id: "A", text: "Synthetic A" }]);
    f.setRows({ ...f.rows, mountedRows: [{ id: "B", text: "Synthetic B" }, { id: "A", text: "Synthetic A" }] });
    const invalid = f.observer.observe(f.desired, 100); await vi.advanceTimersByTimeAsync(100);
    expect((await invalid.promise).outcome).toBe("TIMED_OUT");
  });
  for (const mode of ["cancel", "dispose", "external-abort", "stalled-frame", "frame-budget", "pending-recovery", "read-failed", "zero-size"] as const) {
    it(`cleans up finitely for ${mode}`, async () => {
      const f = fixture();
      if (mode === "pending-recovery") f.setRecovery(recoveryFixture("PENDING"));
      if (mode === "read-failed") f.core.failReads();
      if (mode === "zero-size") f.setRows({ ...f.rows, measurable: false });
      if (mode === "frame-budget") f.setRows({ ...f.rows, aligned: false });
      const operation = f.observer.observe(f.desired, 100);
      if (mode === "cancel") operation.cancel();
      if (mode === "dispose") f.observer.dispose();
      if (mode === "external-abort") f.controller.abort();
      if (mode === "stalled-frame") await vi.advanceTimersByTimeAsync(100);
      if (mode === "frame-budget") for (let count = 0; count < 125; count++) { f.clock.advance(0); await Promise.resolve(); }
      const result = await operation.promise;
      expect(result.outcome).toBe(["cancel", "dispose", "external-abort"].includes(mode) ? "SUPERSEDED" : ["stalled-frame", "frame-budget"].includes(mode) ? "TIMED_OUT" : mode === "zero-size" ? "NOT_MEASURABLE" : "FAILED");
      expect(f.clock.pending).toBe(0); expect(vi.getTimerCount()).toBe(0);
    });
  }
  for (const mode of ["source", "lease", "core", "axis", "cancel", "invalidate", "dispose"] as const) {
    it(`refuses delayed delivery after ${mode} invalidation`, async () => {
      const f = fixture(), operation = f.observer.observe(f.desired); await f.settle();
      const receipt = (await operation.promise).receipt!;
      const deliver = vi.fn();
      expect(f.observer.isCurrent(receipt)).toBe(true);
      const delayed = Promise.resolve().then(() => f.observer.deliver(receipt, deliver));
      if (mode === "source") f.setContext({ ...f.context, source: { ...f.context.source, apiInstance: "next" } });
      if (mode === "lease") f.setContext({ ...f.context, intent: { ...f.context.intent, stamp: { ...f.context.intent.stamp, intent: 99 } } });
      if (mode === "core") f.core.replace(driftFixture("date"));
      if (mode === "axis") f.port.readLayoutAxis = () => ({ ...f.context.layoutAxis, axis: "actual-date-extent-drift" });
      if (mode === "cancel") operation.cancel();
      if (mode === "invalidate") f.observer.invalidate();
      if (mode === "dispose") f.observer.dispose();
      expect(await delayed).toBe(false); expect(deliver).not.toHaveBeenCalled();
      expect(f.observer.isCurrent(receipt)).toBe(false);
    });
  }
  it("changes semantic completion on physical geometry/row change under unchanged declared keys", async () => {
    const f = fixture(); const first = f.observer.observe(f.desired); await f.settle();
    const a = await first.promise;
    const geometry = f.port.readGeometry(); if (!geometry.ok) throw new Error("fixture");
    f.geometry.replace({ ...geometry, value: { ...geometry.value, chartWidth: 700 } });
    const second = f.observer.observe(f.desired); await f.settle(); const b = await second.promise;
    expect(b.outcome).toBe("SETTLED"); expect(b.reused).toBe(false);
    expect(b.semanticId).toBeGreaterThan(a.semanticId);
    expect(f.observer.isCurrent(a.receipt!)).toBe(false);
    f.setRows({ ...f.rows, mountedRows: [{ id: "B", text: "Synthetic B" }], requiredMountedIds: ["B"] });
    const third = f.observer.observe(f.desired); await f.settle();
    expect((await third.promise).semanticId).toBeGreaterThan(b.semanticId);
  });
  it("retains semantic completion across moving horizontal coordinates while preserving vertical row checks", async () => {
    const f = fixture(); const first = f.observer.observe(f.desired); await f.settle();
    const a = await first.promise;
    const geometry = f.port.readGeometry(); if (!geometry.ok) throw new Error("fixture");
    f.geometry.replace({ ...geometry, core: { left: 800, top: 96 }, value: { ...geometry.value, left: 700 } });
    expect(await f.observer.observe(f.desired).promise).toMatchObject({ reused: true, semanticId: a.semanticId });
    f.setRows({ ...f.rows, aligned: false });
    expect(f.observer.isCurrent(a.receipt!)).toBe(false);
  });
  it("rejects actual axis drift even when declared keys, task dates and viewport geometry agree", async () => {
    const f = fixture(); f.port.readLayoutAxis = () => ({ ...f.context.layoutAxis, axis: "unexpected-actual-start-end-unit" });
    expect(await f.observer.observe(f.desired).promise).toMatchObject({ outcome: "FAILED", receipt: null });
  });
  it("rejects stale DOM names and matching but wrong logical/Core order", async () => {
    for (const mode of ["name", "order"] as const) {
      const f = fixture();
      f.setRows(mode === "name" ? { ...f.rows, mountedRows: [{ id: "A", text: "stale name" }] } : { ...f.rows, logicalVisibleIds: ["C", "B", "A"], coreVisibleIds: ["C", "B", "A"] });
      const operation = f.observer.observe(f.desired, 100); await vi.advanceTimersByTimeAsync(100);
      expect((await operation.promise).outcome).toBe("TIMED_OUT");
    }
  });
  it("preserves unavailable scroll capacity as a distinct typed outcome", async () => {
    const f = fixture(); f.geometry.replace({ ok: false, outcome: "NO_SCROLL_CAPACITY" });
    expect(await f.observer.observe(f.desired).promise).toMatchObject({ outcome: "NO_SCROLL_CAPACITY", receipt: null });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rechecks source and lease after the last delivery read", async () => {
    const f = fixture(); const operation = f.observer.observe(f.desired); await f.settle();
    const receipt = (await operation.promise).receipt!, geometry = f.port.readGeometry.bind(f.port);
    f.port.readGeometry = () => {
      const value = geometry();
      f.setContext({ ...f.context, intent: { ...f.context.intent, stamp: { ...f.context.intent.stamp, intent: 99 } } });
      return value;
    };
    const deliver = vi.fn(); expect(f.observer.deliver(receipt, deliver)).toBe(false);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("unblocks a real Coordinator waiting for data and retains its in-flight restore across reobservation", async () => {
    const f = fixture();
    const frames: Array<() => void> = [];
    let sample: ViewportSample = { context: {
      apiInstance: f.context.source.apiInstance, revision: 17, key: "schedule", scope: null, filter: "all", scale: "Day", columns: "text", geometry: "stable-layout",
      visible: true, empty: false, filtered: false, projectionEpoch: 0, receiptFilter: "all", bookmarkGeometry: "fixed",
    }, receipt: null, measurable: true, geometry: "stable-layout", capacity: { left: 1000, top: 1000 }, core: { left: 120, top: 96 }, native: { left: 108, top: 96 } };
    const port: ViewportPort = {
      read: () => sample,
      frame: signal => new Promise(resolve => {
        const abort = () => { signal.removeEventListener("abort", abort); resolve(false); };
        signal.addEventListener("abort", abort, { once: true });
        frames.push(() => { signal.removeEventListener("abort", abort); resolve(!signal.aborted); });
      }),
      apply: vi.fn(async command => { const position = "position" in command ? command.position : sample.core; sample = { ...sample, core: position, native: position }; return position; }),
      repair: vi.fn(() => false), protect: vi.fn(), release: vi.fn(), trace: vi.fn(),
    };
    const coordinator = createViewportCoordinator(port, 30);
    const restore = coordinator.request({ kind: "PASSIVE_RESTORE", position: { left: 120, top: 96 } });
    const flush = async () => { for (let count = 0; count < 8; count++) await Promise.resolve(); };
    const advanceViewport = async () => { frames.splice(0).forEach(tick => tick()); await flush(); };
    await advanceViewport(); expect(port.apply).not.toHaveBeenCalled();
    const geometry = f.port.readGeometry(); if (!geometry.ok) throw new Error("fixture");
    const data = f.observer.observe(f.desired);
    for (let index = 0; index < 3; index++) {
      // The viewport remains incomplete and moving while data proof settles.
      f.geometry.replace({ ...geometry, core: { left: 120 + index, top: 96 }, value: { ...geometry.value, left: 108 + index } });
      f.clock.advance(); await flush();
    }
    const dataResult = await data.promise; expect(dataResult.outcome).toBe("SETTLED");
    const receipt: ProjectionReceipt = { revision: 17, apiInstance: f.context.source.apiInstance, generation: dataResult.semanticId,
      reasons: [], outcome: "SETTLED", logicalVisibleIds: ["A", "B", "C"], coreVisibleIds: ["A", "B", "C"], domIds: ["A"],
      columns: "text", scale: "Day", scope: null, filterKey: "all", taskSelectionChanged: false, queryConditionsChanged: false, selectedIds: [] };
    sample = { ...sample, receipt, context: { ...sample.context, projectionEpoch: dataResult.semanticId } };
    for (let count = 0; count < 5 && !vi.mocked(port.apply).mock.calls.length; count++) await advanceViewport();
    expect(port.apply).toHaveBeenCalledTimes(1);
    expect(port.protect).not.toHaveBeenCalled(); // restore is still settling
    const observedAgain = await f.observer.observe({ ...f.desired, tasks: [...f.desired.tasks] }).promise;
    expect(observedAgain.reused).toBe(true); expect(observedAgain.semanticId).toBe(dataResult.semanticId);
    expect(observedAgain.observation.id).toBeGreaterThan(dataResult.observation.id);
    sample = { ...sample, receipt: { ...receipt, generation: observedAgain.semanticId }, context: { ...sample.context, projectionEpoch: observedAgain.semanticId } };
    for (let count = 0; count < 8; count++) await advanceViewport();
    expect(await restore).toBe("SETTLED"); expect(port.protect).toHaveBeenCalledTimes(1);
    expect(vi.mocked(port.trace).mock.calls.some(call => call[2] === "SUPERSEDED")).toBe(false);
    expect(port.release).toHaveBeenCalledTimes(1); // initial request cancel only
    coordinator.dispose(); f.observer.dispose(); expect(f.clock.pending).toBe(0);
  });
  it("rejects recovery transitions during proof and final delivery reads", async () => {
    const f = fixture(), verify = f.port.verifyCore.bind(f.port);
    f.port.verifyCore = input => { f.setRecovery(recoveryFixture("PENDING")); return verify(input); };
    expect(await f.observer.observe(f.desired).promise).toMatchObject({ outcome: "SUPERSEDED", receipt: null });
    const settled = fixture(); const operation = settled.observer.observe(settled.desired); await settled.settle();
    const receipt = (await operation.promise).receipt!, geometry = settled.port.readGeometry.bind(settled.port);
    settled.port.readGeometry = () => { settled.setRecovery(recoveryFixture("UNCERTAIN")); return geometry(); };
    expect(settled.observer.deliver(receipt, vi.fn())).toBe(false);
  });
  it("returns typed failure and invalidates completion on setup reader/clock/clone exceptions", async () => {
    for (const mode of ["context", "clock", "clone"] as const) {
      const f = fixture(); const operation = f.observer.observe(f.desired); await f.settle();
      const receipt = (await operation.promise).receipt!;
      if (mode === "context") f.port.readContext = () => { throw new Error("payload"); };
      if (mode === "clock") f.port.clock.now = () => { throw new Error("clock"); };
      const target = mode === "clone" ? { ...f.desired, tasks: [{ ...f.desired.tasks[0], uncloneable: () => {} }] } : f.desired;
      expect(await f.observer.observe(target).promise).toMatchObject({ outcome: "FAILED", receipt: null });
      expect(f.observer.isCurrent(receipt)).toBe(false); expect(vi.getTimerCount()).toBe(0);
    }
  });
  it("completes and cleans up even when optional diagnostics throw", async () => {
    const f = fixture(); f.trace.record.mockImplementation(() => { throw new Error("trace failed"); });
    const operation = f.observer.observe(f.desired); await f.settle();
    expect((await operation.promise).outcome).toBe("SETTLED"); expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the newest adopted completion when an older repeated attempt cleans up", async () => {
    const f = fixture(), a = f.observer.observe(f.desired); await f.settle();
    const first = await a.promise, b = f.observer.observe(f.desired), second = await b.promise;
    expect(second.receipt).toBe(first.receipt); expect(second.reused).toBe(true);
    a.cancel();
    expect(f.observer.isCurrent(second.receipt!)).toBe(true);
    expect(f.observer.deliver(second.receipt!, vi.fn())).toBe(true);
    b.cancel(); expect(f.observer.isCurrent(second.receipt!)).toBe(false);
  });
  it("rejects receipt reuse on physical plot origin changes with unchanged declared layout and dimensions", async () => {
    const f = fixture(), first = f.observer.observe(f.desired); await f.settle();
    const a = await first.promise, geometry = f.port.readGeometry(); if (!geometry.ok) throw new Error("fixture");
    f.geometry.replace({ ...geometry, value: { ...geometry.value, chartX: geometry.value.chartX + 30, chartY: geometry.value.chartY + 10 } });
    const second = f.observer.observe(f.desired); await f.settle(); const b = await second.promise;
    expect(b.reused).toBe(false); expect(b.semanticId).toBeGreaterThan(a.semanticId);
  });
  it("compares semantic records independently of object property insertion order", async () => {
    const f = fixture(), operation = f.observer.observe(f.desired); await f.settle(); const first = await operation.promise;
    const original = f.context, identity = original.desired;
    f.setContext({ mounted: original.mounted, visible: original.visible, intent: original.intent, layoutAxis: original.layoutAxis,
      desired: { scope: identity.scope, query: identity.query, keys: { layout: identity.keys.layout, membership: identity.keys.membership, structure: identity.keys.structure, data: identity.keys.data }, revision: identity.revision }, source: original.source });
    const repeated = await f.observer.observe(f.desired).promise;
    expect(repeated.reused).toBe(true); expect(repeated.receipt).toBe(first.receipt); expect(repeated.semanticId).toBe(first.semanticId);
  });
  it("freezes context/recovery comparison baselines against in-place reader side effects", async () => {
    for (const mode of ["context-delivery", "recovery-delivery", "recovery-observe"] as const) {
      const f = fixture();
      if (mode === "recovery-observe") {
        const recovery = f.port.readRecovery(), verify = f.port.verifyCore.bind(f.port);
        f.port.verifyCore = input => { const value = verify(input); Object.assign(recovery, { phase: "PENDING" }); return value; };
        expect(await f.observer.observe(f.desired).promise).toMatchObject({ outcome: "SUPERSEDED", receipt: null });
        continue;
      }
      const operation = f.observer.observe(f.desired); await f.settle(); const receipt = (await operation.promise).receipt!;
      const geometry = f.port.readGeometry.bind(f.port), context = f.context, recovery = f.port.readRecovery();
      f.port.readGeometry = () => {
        const value = geometry();
        if (mode === "context-delivery") Object.assign(context.source, { apiInstance: "in-place-next-api" });
        else Object.assign(recovery, { phase: "PENDING" });
        return value;
      };
      expect(f.observer.deliver(receipt, vi.fn())).toBe(false);
    }
  });
  it("refuses delivery if a final reader invalidates or cancels the current completion", async () => {
    for (const mode of ["invalidate", "cancel"] as const) {
      const f = fixture(), operation = f.observer.observe(f.desired); await f.settle();
      const receipt = (await operation.promise).receipt!, geometry = f.port.readGeometry.bind(f.port);
      f.port.readGeometry = () => { const result = geometry(); if (mode === "invalidate") f.observer.invalidate(); else operation.cancel(); return result; };
      const callback = vi.fn(); expect(f.observer.deliver(receipt, callback)).toBe(false); expect(callback).not.toHaveBeenCalled();
    }
  });
  it("validates and reuses captured actual SVAR 2.7.3 public reader evidence independently of U2/U4", async () => {
    const hydrate = (value: unknown) => JSON.parse(JSON.stringify(value), (key, item) => ["start", "end"].includes(key) && typeof item === "string" ? new Date(item) : item);
    const tasks = hydrate(captured.serializeTasks), tree = hydrate(captured.serializeTree), links = hydrate(captured.serializeLinks);
    const original: CanonicalGanttSnapshot = { tasks: [
      { id: "fixture-root", text: "Synthetic root", type: "summary", parent: 0, open: true },
      { id: "fixture-c", text: "Synthetic C", type: "task", parent: "fixture-root", start: new Date("2026-01-08T00:00:00+09:00"), end: new Date("2026-01-10T00:00:00+09:00"), progress: 25 },
      { id: "fixture-a", text: "Synthetic A", type: "task", parent: "fixture-root", start: new Date("2026-01-05T00:00:00+09:00"), end: new Date("2026-01-08T00:00:00+09:00"), progress: 50, externalId: "synthetic-A", projectDisplayKey: "SYN.A" },
      { id: "fixture-m", text: "Synthetic milestone", type: "milestone", parent: 0, start: new Date("2026-01-12T00:00:00+09:00") },
    ], links: [{ id: "fixture-link", source: "fixture-a", target: "fixture-c", type: "e2s" }] };
    const f = fixture(original);
    f.port.readCore = () => readCoreSnapshot({ serialize(config) { return ({ tasks, tree, links })[config?.data as "tasks" | "tree" | "links"]; } });
    const first = f.observer.observe(original); await f.settle();
    expect((await first.promise).outcome).toBe("SETTLED");
    expect(await f.observer.observe(original).promise).toMatchObject({ outcome: "SETTLED", reused: true });
    for (const mode of ["order", "date", "temporary", "link"] as const) {
      const mutatedTasks = hydrate(captured.serializeTasks), mutatedTree = hydrate(captured.serializeTree), mutatedLinks = hydrate(captured.serializeLinks);
      if (mode === "order") { [mutatedTasks[1], mutatedTasks[2]] = [mutatedTasks[2], mutatedTasks[1]]; [mutatedTree[1], mutatedTree[2]] = [mutatedTree[2], mutatedTree[1]]; mutatedTasks[0].data.reverse(); mutatedTree[0].data.reverse(); }
      if (mode === "date") mutatedTasks[1].start = new Date("2026-01-09T00:00:00+09:00");
      if (mode === "temporary") { const temp = { id: "TEMP", parent: 0, text: "Temporary", type: "task" }; mutatedTasks.push(temp); mutatedTree.push(temp); }
      if (mode === "link") mutatedLinks[0].type = "s2s";
      const invalid: CoreReadResult = normalizeSerializedCore({ tasks: mutatedTasks, tree: mutatedTree, links: mutatedLinks });
      expect(invalid.ok, mode).toBe(true);
      f.port.readCore = () => invalid;
      expect(await f.observer.observe(original).promise, mode).toMatchObject({ outcome: "FAILED", reused: false });
    }
  });
});
