import type { CanonicalGanttSnapshot } from "./canonical-snapshot-sync";
import { normalizeCanonicalCore, sameCoreSnapshot } from "./state-consistency";
import type { CoreConformanceProof, CoreGeneration, CoreReaderPort, CoreVerification, DesiredProjectionIdentity, ObservationAttempt, RecoveryInput } from "./state-consistency";

export interface ConformanceContext {
  readonly source: CoreGeneration;
  readonly identity: DesiredProjectionIdentity;
  readonly recovery: RecoveryInput;
  /** Dirty is independent of its monotonic invalidation generation. */
  readonly dirty: boolean;
}
/** Capture values before public reads/awaits; ports may reuse mutable DTOs. */
export function captureConformanceContext(context: ConformanceContext): ConformanceContext {
  return Object.freeze({ source: Object.freeze({ ...context.source }),
    identity: Object.freeze({ ...context.identity, keys: Object.freeze({ ...context.identity.keys }) }),
    recovery: Object.freeze({ ...context.recovery, affectedIds: Object.freeze([...context.recovery.affectedIds]) }), dirty: context.dirty });
}
export function sameConformanceContext(first: ConformanceContext, second: ConformanceContext): boolean {
  return first.source.apiInstance === second.source.apiInstance && first.source.dirty === second.source.dirty && first.source.recovery === second.source.recovery &&
    first.identity.revision === second.identity.revision && first.identity.query === second.identity.query && first.identity.scope === second.identity.scope &&
    first.identity.keys.data === second.identity.keys.data && first.identity.keys.structure === second.identity.keys.structure &&
    first.identity.keys.membership === second.identity.keys.membership && first.identity.keys.layout === second.identity.keys.layout;
}
/** Link collection order has no renderer or dependency semantics. */
export function sameConformanceSnapshot(first: import("./state-consistency").ObservedCoreSnapshot, second: import("./state-consistency").ObservedCoreSnapshot): boolean {
  if (!sameCoreSnapshot({ ...first, links: [] }, { ...second, links: [] }) || first.links.length !== second.links.length) return false;
  const byId = new Map(first.links.map(link => [link.id, link]));
  return second.links.every(link => { const actual = byId.get(link.id); return actual !== undefined && actual.source === link.source && actual.target === link.target && actual.type === link.type; });
}
const available = (context: ConformanceContext) => !context.dirty &&
  ["IDLE", "SETTLED"].includes(context.recovery.phase) && context.recovery.generation === context.source.recovery;

/** Always reads actual public Core payload/tree/order/links. No key-only fast path. */
export function verifyCoreConformance(input: {
  readonly reader: CoreReaderPort;
  readonly desired: CanonicalGanttSnapshot;
  readonly context: ConformanceContext;
  readonly observation: ObservationAttempt;
  readonly current: () => ConformanceContext;
}): CoreVerification {
  const captured = captureConformanceContext(input.context);
  if (!available(captured)) return { ok: false, outcome: "FAILED", reason: "RECOVERY_PENDING_OR_DIRTY" };
  const desired = normalizeCanonicalCore(input.desired);
  const actual = input.reader.readCore();
  const current = input.current();
  if (!sameConformanceContext(captured, current) || !available(current)) return { ok: false, outcome: "SUPERSEDED", reason: "SOURCE_CHANGED" };
  if (!desired.ok) return { ok: false, outcome: "FAILED", reason: `DESIRED_${desired.reason}` };
  if (!actual.ok) return actual;
  if (!sameConformanceSnapshot(actual.value, desired.value)) return { ok: false, outcome: "FAILED", reason: "CORE_DRIFT" };
  return { ok: true, proof: { source: { ...current.source }, desired: { ...current.identity, keys: { ...current.identity.keys } }, observation: { ...input.observation }, snapshot: actual.value } };
}

/** Re-observation may reuse evidence only after another actual read. */
export function reusableCoreProof(proof: CoreConformanceProof, reader: CoreReaderPort, current: ConformanceContext, readCurrent: () => ConformanceContext = () => current): boolean {
  const captured = captureConformanceContext(current);
  if (!available(captured) || !sameConformanceContext({ ...captured, source: proof.source, identity: proof.desired }, captured)) return false;
  const actual = reader.readCore();
  const after = readCurrent();
  return available(after) && sameConformanceContext(captured, after) && actual.ok && sameConformanceSnapshot(actual.value, proof.snapshot);
}
