import type { CanonicalGanttSnapshot } from "../../../src/features/gantt/canonical-snapshot-sync";
import { normalizeCanonicalCore, normalizeSerializedCore, sameCoreSnapshot } from "../../../src/features/gantt/state-consistency/core-reader";
import type { ConsistencyClockPort, CoreReaderPort, GeometryReaderPort, GeometryReadResult, RecoveryInput, CoreConformanceProof, CoreGeneration, DesiredProjectionIdentity, LayoutAxisIdentity, ObservationAttempt, UserIntentLease } from "../../../src/features/gantt/state-consistency/contracts";

export function canonicalFixture(): CanonicalGanttSnapshot {
  return {
    tasks: ["A", "B", "C"].map((id, index) => ({ id, parent: 0, text: `Synthetic ${id}`, type: "task", start: new Date(2026, 9, 1 + index), end: new Date(2026, 9, 2 + index), progress: 0 })),
    links: [{ id: "AB", source: "A", target: "B", type: "e2s" }],
  };
}
export type DriftKind = "none" | "order" | "date" | "temporary-add" | "delete" | "type" | "hierarchy" | "link" | "renderer-cache";
export function driftFixture(kind: DriftKind): CanonicalGanttSnapshot {
  const canonical = canonicalFixture();
  const tasks = canonical.tasks.map(task => ({ ...task }));
  const links = canonical.links.map(link => ({ ...link }));
  if (kind === "order") [tasks[1], tasks[2]] = [tasks[2], tasks[1]];
  if (kind === "date") tasks[1] = { ...tasks[1], start: new Date(2026, 9, 9) };
  if (kind === "temporary-add") tasks.push({ ...tasks[2], id: "TEMP" });
  if (kind === "delete") tasks.splice(2, 1);
  if (kind === "type") tasks[1] = { ...tasks[1], type: "milestone" };
  if (kind === "hierarchy") tasks[2] = { ...tasks[2], parent: "B" };
  if (kind === "link") links[0] = { ...links[0], target: "C" };
  if (kind === "renderer-cache") Object.assign(tasks[1], { duration: 77, open: false, $x: 36, $width: 500 });
  return { tasks, links };
}
export function recoveryFixture(phase: RecoveryInput["phase"] = "IDLE"): RecoveryInput {
  return { phase, generation: 0, requestId: phase === "IDLE" ? null : "synthetic-request-1", baseRevision: 17, affectedIds: phase === "IDLE" ? [] : ["B"] };
}

/** Test driver owns replacement; the port exposed to consumers can only read. */
export function fakeCore(initial: CanonicalGanttSnapshot = canonicalFixture()) {
  let actual = initial;
  let readFailure = false;
  let reads = 0;
  const effects = { coreWrites: 0, mutationRetries: 0 };
  const reader: CoreReaderPort = {
    readCore() {
      reads++;
      if (readFailure) return { ok: false, outcome: "FAILED", reason: "READ_FAILED" };
      return normalizeSerializedCore({ tasks: actual.tasks, tree: actual.tasks, links: actual.links });
    },
  };
  const port: CoreReaderPort = new Proxy(reader, {
    get(target, key, receiver) {
      if (["exec", "updateTask", "deleteTask", "addTask"].includes(String(key))) { effects.coreWrites++; throw new Error("Read-only fixture: Core write forbidden"); }
      if (key === "retryMutation") { effects.mutationRetries++; throw new Error("Read-only fixture: mutation retry forbidden"); }
      return Reflect.get(target, key, receiver);
    },
  });
  return { port, effects, replace(value: CanonicalGanttSnapshot) { actual = value; }, failReads(value = true) { readFailure = value; }, get reads() { return reads; } };
}
export function fakeGeometry() {
  let sample: GeometryReadResult = { ok: true, core: { left: 120, top: 96 }, value: { left: 120, top: 96, chartX: 400, chartY: 40, chartWidth: 800, chartHeight: 600, scrollWidth: 2000, scrollHeight: 1200, verticalClientHeight: 640, gridWidth: 400 } };
  const port: GeometryReaderPort = { readGeometry: () => sample };
  return { port, replace(value: GeometryReadResult) { sample = value; } };
}
export function fakeClock() {
  let time = 0;
  const pending = new Set<() => void>();
  const port: ConsistencyClockPort = {
    now: () => time,
    frame(signal) {
      if (signal.aborted) return Promise.resolve(false);
      return new Promise<boolean>(resolve => {
        const finish = (value: boolean) => { pending.delete(tick); signal.removeEventListener("abort", abort); resolve(value); };
        const tick = () => finish(true);
        const abort = () => finish(false);
        pending.add(tick); signal.addEventListener("abort", abort, { once: true });
      });
    },
  };
  return { port, advance(milliseconds = 16) { time += milliseconds; for (const tick of [...pending]) tick(); }, get pending() { return pending.size; } };
}

/** Counterexample oracle only: this does not reconcile, retry, issue receipts or
 * certify product conformance. Generation/observation counters grant no evidence. */
export function inspectSyntheticEvidence(input: {
  core: CoreReaderPort; desired: CanonicalGanttSnapshot; recovery: RecoveryInput;
  capturedIntent: number; currentIntent: number; observationId: number; dirtyGeneration: number;
}): "MATCHING_DATA" | "DRIFT" | "UNREADABLE" | "RECOVERY_PENDING" | "SUPERSEDED" {
  if (input.capturedIntent !== input.currentIntent) return "SUPERSEDED";
  const actual = input.core.readCore(), desired = normalizeCanonicalCore(input.desired);
  if (!actual.ok || !desired.ok) return "UNREADABLE";
  if (!sameCoreSnapshot(actual.value, desired.value)) return "DRIFT";
  if (!["IDLE", "SETTLED"].includes(input.recovery.phase)) return "RECOVERY_PENDING";
  return "MATCHING_DATA";
}


export interface SyntheticProofContext {
  readonly source: CoreGeneration;
  readonly desired: DesiredProjectionIdentity;
  readonly layoutAxis: LayoutAxisIdentity;
  readonly intent: UserIntentLease;
  readonly observation: ObservationAttempt;
  readonly recovery: RecoveryInput;
}
export interface SyntheticProofFixture {
  readonly proof: CoreConformanceProof;
  readonly layoutAxis: LayoutAxisIdentity;
  readonly intent: UserIntentLease;
}
export function proofContextFixture(): SyntheticProofContext {
  return {
    source: { apiInstance: "synthetic-api-1", dirty: 0, recovery: 0 },
    desired: { revision: 17, keys: { data: "synthetic-data", structure: "synthetic-structure", membership: "synthetic-membership", layout: "synthetic-layout" }, query: "", scope: null },
    layoutAxis: { layout: "synthetic-layout", axis: "synthetic-day-axis" },
    intent: { stamp: { context: "synthetic-context", contextEpoch: 0, gesture: 0, intent: 1 }, priority: 2 },
    observation: { id: 1, startedAt: 0, deadline: 48 },
    recovery: recoveryFixture(),
  };
}
/** Known-good synthetic proof input, never a production verifier or receipt. */
export function proofFixture(): SyntheticProofFixture {
  const context = proofContextFixture(), canonical = normalizeCanonicalCore(canonicalFixture());
  if (!canonical.ok) throw new Error("Invalid synthetic canonical fixture");
  return { proof: { source: context.source, desired: context.desired, observation: context.observation, snapshot: canonical.value }, layoutAxis: context.layoutAxis, intent: context.intent };
}
/** Test-only stale-evidence reference model. It reads current actual data and
 * invalidates an existing proof; it cannot issue new proofs or perform recovery.
 * Observation attempts are intentionally absent from semantic equality. */
export function reusableSyntheticProof(fixture: SyntheticProofFixture, current: SyntheticProofContext, core: CoreReaderPort): boolean {
  const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  if (!same(fixture.proof.source, current.source) || !same(fixture.proof.desired, current.desired) ||
      !same(fixture.layoutAxis, current.layoutAxis) || !same(fixture.intent, current.intent) ||
      !["IDLE", "SETTLED"].includes(current.recovery.phase) || current.recovery.generation !== current.source.recovery) return false;
  const actual = core.readCore();
  return actual.ok && sameCoreSnapshot(actual.value, fixture.proof.snapshot);
}
