import type { CanonicalGanttSnapshot } from "../canonical-snapshot-sync";
import type { ConsistencyAbortPort, ConsistencyClockPort, CoreConformanceProof, CoreGeneration, CoreReaderPort, CoreVerifierPort, DesiredProjectionIdentity, GeometryReaderPort, LayoutAxisIdentity, ObservationAttempt, RecoveryInputPort, UserIntentLease } from "../state-consistency/contracts";
import { normalizeCanonicalCore, sameCoreSnapshot } from "../state-consistency/core-reader";
import type { createCoreActionTrace } from "../diagnostics/core-action-trace";

export interface ProjectionObservationContext {
  readonly source: CoreGeneration;
  readonly desired: DesiredProjectionIdentity;
  readonly layoutAxis: LayoutAxisIdentity;
  readonly intent: UserIntentLease;
  readonly visible: boolean;
  readonly mounted: boolean;
}
/** Mounted rows are a virtualized subset, never a replacement for logical rows. */
export interface ProjectionRowEvidence {
  readonly logicalVisibleIds: readonly string[];
  readonly coreVisibleIds: readonly string[];
  readonly mountedRows: readonly Readonly<{ id: string; text: string }>[];
  readonly requiredMountedIds: readonly string[];
  readonly measurable: boolean;
  readonly aligned: boolean;
}
export interface ProjectionObservationPort extends CoreReaderPort, CoreVerifierPort, GeometryReaderPort, RecoveryInputPort {
  readonly clock: ConsistencyClockPort;
  readonly abort: ConsistencyAbortPort;
  readContext(): ProjectionObservationContext;
  readRows(): ProjectionRowEvidence;
  /** Independently read actual scale/date extent and layout, encoded by caller. */
  readLayoutAxis(): LayoutAxisIdentity;
  /** Existing bounded, allowlisted trace: id=semantic ID, count=attempt ID. */
  readonly trace?: Pick<ReturnType<typeof createCoreActionTrace>, "record">;
}
export interface SemanticProjectionReceipt {
  readonly semanticId: number;
  readonly observation: ObservationAttempt;
  readonly context: ProjectionObservationContext;
  readonly proof: CoreConformanceProof;
  readonly rows: ProjectionRowEvidence;
  readonly geometry: string;
}
export type ProjectionObservationOutcome = "SETTLED" | "SUPERSEDED" | "NOT_MEASURABLE" | "NO_SCROLL_CAPACITY" | "TIMED_OUT" | "FAILED";
export interface ProjectionObservationResult {
  readonly outcome: ProjectionObservationOutcome;
  readonly semanticId: number;
  readonly observation: ObservationAttempt;
  readonly receipt: SemanticProjectionReceipt | null;
  readonly reused: boolean;
}
const stableKey = (value: unknown): string => {
  const ordered = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(ordered);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, ordered(entry)]));
    return item;
  };
  return JSON.stringify(ordered(value));
};
const equal = (a: unknown, b: unknown) => stableKey(a) === stableKey(b);
const snapshot = <T>(value: T): T => {
  const copy = structuredClone(value);
  const freeze = (item: unknown) => {
    if (item && typeof item === "object") {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  };
  freeze(copy);
  return copy;
};
function validRows(rows: ProjectionRowEvidence, proof: CoreConformanceProof): boolean {
  const logical = rows.logicalVisibleIds, mounted = rows.mountedRows.map(row => row.id);
  const logicalSet = new Set(logical), mountedSet = new Set(mounted);
  const byId = new Map(proof.snapshot.tasks.map(task => [task.id, task]));
  return rows.aligned && equal(logical, rows.coreVisibleIds) && logicalSet.size === logical.length &&
    logical.every(id => byId.has(id)) && equal(proof.snapshot.tasks.filter(task => logicalSet.has(task.id)).map(task => task.id), logical) && mountedSet.size === mounted.length &&
    equal(logical.filter(id => mountedSet.has(id)), mounted) &&
    rows.mountedRows.every(row => byId.get(row.id)?.text === row.text) &&
    rows.requiredMountedIds.every(id => logicalSet.has(id) && mountedSet.has(id));
}

function geometryIdentity(port: GeometryReaderPort): string | null {
  const geometry = port.readGeometry();
  if (!geometry.ok) return null;
  const g = geometry.value;
  const dimensions = [g.chartX, g.chartY, g.chartWidth, g.chartHeight, g.scrollWidth, g.scrollHeight, g.verticalClientHeight, g.gridWidth];
  return dimensions.every(Number.isFinite) && g.chartWidth > 0 && g.chartHeight > 0 ? JSON.stringify(dimensions) : null;
}

/** Opt-in read-only facade. It issues data/row evidence without waiting for
 * viewport completion, applying commands, or acquiring/renewing user intent. */
export function createProjectionObservation(port: ProjectionObservationPort) {
  let attempts = 0, semanticId = 0, semanticKey = "", disposed = false;
  let completed: SemanticProjectionReceipt | null = null;
  let adoptedAttempt = 0;
  let active: (() => void) | null = null;
  const trace = (event: string, id: number, attempt: number) => {
    try { port.trace?.record(event, "projection-observation", { id, count: attempt }); }
    catch { /* Diagnostics must not interrupt finite observation cleanup. */ }
  };
  const clearCompletion = () => {
    if (completed) { completed = null; adoptedAttempt = 0; semanticId++; }
  };
  const isCurrent = (receipt: SemanticProjectionReceipt): boolean => {
    if (completed !== receipt) return false;
    try {
      const context = snapshot(port.readContext()), recovery = snapshot(port.readRecovery()), actual = port.readCore(), rows = port.readRows();
      const valid = !disposed && !port.abort.signal.aborted && port.abort.isCurrent() && context.visible && context.mounted &&
        equal(context, receipt.context) && equal(port.readLayoutAxis(), context.layoutAxis) &&
        ["IDLE", "SETTLED"].includes(recovery.phase) && recovery.generation === context.source.recovery &&
        actual.ok && sameCoreSnapshot(actual.value, receipt.proof.snapshot) && rows.measurable && validRows(rows, receipt.proof) &&
        equal(rows, receipt.rows) && geometryIdentity(port) === receipt.geometry &&
        !disposed && !port.abort.signal.aborted && port.abort.isCurrent() && equal(port.readRecovery(), recovery) && equal(port.readContext(), context) && completed === receipt;
      if (!valid) clearCompletion();
      return valid;
    } catch { clearCompletion(); return false; }
  };
  const observe = (desired: CanonicalGanttSnapshot, timeoutMs = 1500) => {
    active?.();
    let initial: ProjectionObservationContext, target: CanonicalGanttSnapshot, startedAt: number;
    try {
      initial = snapshot(port.readContext());
      target = snapshot(desired);
      startedAt = port.clock.now();
      if (!Number.isFinite(startedAt)) throw new Error("Invalid clock");
    } catch {
      clearCompletion();
      const observation = Object.freeze({ id: ++attempts, startedAt: 0, deadline: 0 });
      trace("projection-failed", semanticId, observation.id);
      return { promise: Promise.resolve<ProjectionObservationResult>({ outcome: "FAILED", semanticId, observation, receipt: null, reused: false }), cancel() {} };
    }
    const canonical = normalizeCanonicalCore(target);
    const key = stableKey(initial);
    if (key !== semanticKey) { semanticKey = key; semanticId++; completed = null; }
    let id = semanticId;
    const budget = Number.isFinite(timeoutMs) ? Math.min(5000, Math.max(1, timeoutMs)) : 1500;
    const observation = Object.freeze({ id: ++attempts, startedAt, deadline: startedAt + budget });
    const controller = new AbortController();
    let cancel = () => {};
    const promise = new Promise<ProjectionObservationResult>(resolve => {
      let done = false, stable = 0, previous = "", frames = 0;
      let issued: SemanticProjectionReceipt | null = null;
      const current = () => {
        try { return !disposed && !controller.signal.aborted && !port.abort.signal.aborted && port.abort.isCurrent() && equal(initial, port.readContext()); }
        catch { return false; }
      };
      const finish = (outcome: ProjectionObservationOutcome, receipt: SemanticProjectionReceipt | null = null, reused = false) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        port.abort.signal.removeEventListener("abort", externalAbort);
        controller.abort();
        if (active === cancel) active = null;
        if (outcome !== "SETTLED") { clearCompletion(); id = semanticId; }
        issued = receipt;
        if (outcome === "SETTLED") adoptedAttempt = observation.id;
        trace(`projection-${outcome.toLowerCase()}`, id, observation.id);
        resolve({ outcome, semanticId: id, observation, receipt, reused });
      };
      const externalAbort = () => finish("SUPERSEDED");
      // Timer is independent of frame progress (hidden/stalled renderer).
      const timer = setTimeout(() => finish(current() ? "TIMED_OUT" : "SUPERSEDED"), budget);
      cancel = () => {
        if (done) { if (issued && completed === issued && adoptedAttempt === observation.id) clearCompletion(); return; }
        finish("SUPERSEDED");
      };
      active = cancel;
      port.abort.signal.addEventListener("abort", externalAbort, { once: true });
      trace("projection-observation", id, observation.id);
      const sample = () => {
        if (!current()) return finish("SUPERSEDED");
        if (!initial.mounted || !initial.visible) return finish("NOT_MEASURABLE");
        if (port.clock.now() >= observation.deadline) return finish("TIMED_OUT");
        const actual = port.readCore(), recovery = snapshot(port.readRecovery());
        if (!actual.ok || !canonical.ok) return finish("FAILED");
        const verified = port.verifyCore({ observed: actual, desired: target, identity: initial.desired, source: initial.source, observation, recovery });
        if (!current()) return finish("SUPERSEDED");
        // A verifier's success/proof is not self-authenticating evidence.
        if (!verified.ok) return finish(verified.outcome);
        const proof = verified.proof;
        if (!proof || !equal(proof.source, initial.source) || !equal(proof.desired, initial.desired) || !equal(proof.observation, observation) ||
          !["IDLE", "SETTLED"].includes(recovery.phase) || recovery.generation !== initial.source.recovery ||
          !sameCoreSnapshot(actual.value, canonical.value) || !sameCoreSnapshot(proof.snapshot, actual.value)) return finish("FAILED");
        const rows = port.readRows(), geometry = port.readGeometry();
        if (!equal(port.readLayoutAxis(), initial.layoutAxis)) return finish("FAILED");
        if (!current()) return finish("SUPERSEDED");
        if (!equal(port.readRecovery(), recovery) || !current()) return finish("SUPERSEDED");
        if (!rows.measurable) return finish("NOT_MEASURABLE");
        if (!geometry.ok) return finish(geometry.outcome);
        const g = geometry.value;
        // Data readiness must not depend on Core/native X/Y agreement. Physical
        // extents still invalidate reuse, even under the same layout/axis keys.
        const geometryKey = JSON.stringify([g.chartX, g.chartY, g.chartWidth, g.chartHeight, g.scrollWidth, g.scrollHeight, g.verticalClientHeight, g.gridWidth]);
        if (![g.chartX, g.chartY, g.chartWidth, g.chartHeight, g.scrollWidth, g.scrollHeight, g.verticalClientHeight, g.gridWidth].every(Number.isFinite) || g.chartWidth <= 0 || g.chartHeight <= 0) return finish("NOT_MEASURABLE");
        const valid = validRows(rows, proof);
        const signature = stableKey([rows, geometryKey]);
        if (completed && valid && equal(completed.context, initial) && sameCoreSnapshot(completed.proof.snapshot, actual.value) &&
          equal(completed.rows, rows) && completed.geometry === geometryKey) return finish("SETTLED", completed, true);
        if (completed) { clearCompletion(); id = semanticId; }
        stable = valid ? (signature === previous ? stable + 1 : 1) : 0;
        previous = signature;
        if (stable >= 3) {
          completed = snapshot({ semanticId: id, observation, context: initial, proof, rows, geometry: geometryKey });
          return finish("SETTLED", completed);
        }
      };
      const run = async () => {
        try {
          while (!done && frames++ < 120) {
            sample();
            if (done) break;
            if (port.clock.now() >= observation.deadline) return finish("TIMED_OUT");
            if (!await port.clock.frame(controller.signal)) return finish(current() ? "TIMED_OUT" : "SUPERSEDED");
          }
          if (!done) finish(current() ? "TIMED_OUT" : "SUPERSEDED");
        } catch { finish(current() ? "FAILED" : "SUPERSEDED"); }
      };
      void run();
    });
    return { promise, cancel: () => cancel() };
  };
  return { observe, isCurrent,
    deliver(receipt: SemanticProjectionReceipt, callback: (receipt: SemanticProjectionReceipt) => void): boolean {
      if (!isCurrent(receipt)) return false;
      callback(receipt);
      return true;
    },
    invalidate() { active?.(); clearCompletion(); semanticKey = ""; },
    dispose() { disposed = true; active?.(); clearCompletion(); },
  };
}
