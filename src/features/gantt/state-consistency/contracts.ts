import type { CanonicalProjection } from "../canonical-projection";
import type { CanonicalGanttSnapshot } from "../canonical-snapshot-sync";
import type { ProjectionReceipt } from "../projection-settled";
import type { ViewportOutcome, ViewportPosition, ViewportStamp } from "../viewport/viewport-coordinator";
import type { GanttGeometrySnapshot } from "../adapter/gantt-adapter";

export type CanonicalRevision = CanonicalProjection["revision"];
export type ConsistencyOutcome = ViewportOutcome | ProjectionReceipt["outcome"];
export interface DesiredProjectionIdentity {
  readonly revision: CanonicalRevision;
  readonly keys: CanonicalProjection["keys"];
  readonly query: string;
  readonly scope: string | null;
}
export interface CoreGeneration {
  readonly apiInstance: string;
  readonly dirty: number;
  readonly recovery: number;
}
export interface LayoutAxisIdentity {
  readonly layout: string;
  readonly axis: string;
}
/** Observation attempts count reads; they never grant a new user intent lease. */
export interface ObservationAttempt {
  readonly id: number;
  readonly startedAt: number;
  readonly deadline: number;
}
export interface UserIntentLease {
  readonly stamp: ViewportStamp;
  readonly priority: number;
}
export type RecoveryPhase = "IDLE" | "PENDING" | "UNCERTAIN" | "REQUIRED" | "RECONCILING" | "SETTLED";
export interface RecoveryInput {
  readonly phase: RecoveryPhase;
  readonly generation: number;
  readonly requestId: string | null;
  readonly baseRevision: CanonicalRevision;
  readonly affectedIds: readonly string[];
}
export interface NormalizedCoreTask {
  readonly id: string;
  readonly parent: string;
  readonly text: string;
  readonly type: string;
  readonly start: number | null;
  readonly end: number | null;
  readonly progress: number;
  readonly externalId: string | number | null;
  readonly projectDisplayKey: string | null;
  readonly baselineStart: string | null;
  readonly baselineEnd: string | null;
  readonly baselineDuration: number | null;
}
export interface NormalizedCoreLink {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: string;
}
/** tasks/tree are complete preorders, independent of collapse/filter/DOM. */
export interface ObservedCoreSnapshot {
  readonly tasks: readonly NormalizedCoreTask[];
  readonly tree: readonly Readonly<{ id: string; parent: string }>[];
  readonly links: readonly NormalizedCoreLink[];
}
export type CoreReadFailure = "READ_FAILED" | "INVALID_TASKS" | "INVALID_TREE" | "INVALID_LINKS" | "INCONSISTENT_TREE";
export type CoreReadResult = Readonly<{ ok: true; value: ObservedCoreSnapshot }> |
  Readonly<{ ok: false; outcome: "FAILED"; reason: CoreReadFailure }>;
export interface CoreConformanceProof {
  readonly source: CoreGeneration;
  readonly desired: DesiredProjectionIdentity;
  readonly observation: ObservationAttempt;
  readonly snapshot: ObservedCoreSnapshot;
}
export type CoreVerification = Readonly<{ ok: true; proof: CoreConformanceProof }> |
  Readonly<{ ok: false; outcome: "FAILED" | "SUPERSEDED"; reason: string }>;
export interface ConsistencyClockPort {
  now(): number;
  frame(signal: AbortSignal): Promise<boolean>;
}
export interface ConsistencyAbortPort {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
}
export interface CoreReaderPort {
  readCore(): CoreReadResult;
}
export type GeometryReadResult = Readonly<{ ok: true; value: GanttGeometrySnapshot; core: ViewportPosition }> |
  Readonly<{ ok: false; outcome: "NOT_MEASURABLE" | "NO_SCROLL_CAPACITY" | "FAILED" }>;
export interface GeometryReaderPort {
  readGeometry(): GeometryReadResult;
}
export interface CoreVerifierPort {
  verifyCore(input: Readonly<{
    observed: CoreReadResult;
    desired: CanonicalGanttSnapshot;
    identity: DesiredProjectionIdentity;
    source: CoreGeneration;
    observation: ObservationAttempt;
    recovery: RecoveryInput;
  }>): CoreVerification;
}
export interface RecoveryInputPort {
  readRecovery(): RecoveryInput;
}
