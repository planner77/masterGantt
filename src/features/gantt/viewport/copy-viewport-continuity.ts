import type { MutationOutcome } from "../canonical-recovery";
import type { ViewportContext, ViewportSample, ViewportStamp } from "./viewport-coordinator";

type CopyContext = Pick<ViewportContext, "apiInstance" | "key" | "scope" | "filter" | "scale" | "columns">;
export interface CopyViewportEnvironment {
  readonly width: number;
  readonly height: number;
  readonly fullscreen: boolean;
}
export interface CopyViewportContinuity {
  readonly stamp: ViewportStamp;
  readonly context: CopyContext;
  readonly environment: CopyViewportEnvironment;
  readonly left: number;
  readonly baseRevision: number;
  /** Assigned only after the response body and canonical application succeed. */
  readonly confirmedRevision?: number;
}
export interface CanonicalMutationRequest {
  readonly requestId: string;
  readonly baseRevision: number;
  readonly affectedIds: readonly string[];
  readonly outcome?: MutationOutcome;
  readonly copyViewport?: CopyViewportContinuity;
}

/** Capture at the actual copy dispatch, before HTTP or canonical changes. */
export function captureCopyViewport(sample: ViewportSample | null, stamp: ViewportStamp, environment: CopyViewportEnvironment): CopyViewportContinuity | undefined {
  if (!sample?.measurable || !sample.context.visible || sample.context.empty ||
    !Number.isFinite(sample.core.left) || sample.core.left < 0 || !Number.isFinite(sample.native.left) || sample.native.left < 0 ||
    Math.abs(sample.core.left - sample.native.left) > 1) return;
  const { apiInstance, key, scope, filter, scale, columns } = sample.context;
  return { stamp: { ...stamp }, context: { apiInstance, key, scope, filter, scale, columns }, environment: { ...environment }, left: sample.core.left, baseRevision: sample.context.revision };
}

function sameCopyContext(capture: CopyViewportContinuity, sample: ViewportSample, environment: CopyViewportEnvironment): boolean {
  if (!sample.measurable || !sample.context.visible || sample.context.empty) return false;
  for (const key of ["apiInstance", "key", "scope", "filter", "scale", "columns"] as const)
    if (sample.context[key] !== capture.context[key]) return false;
  return sameCopyEnvironment(capture, environment);
}
function sameCopyEnvironment(capture: CopyViewportContinuity, environment: CopyViewportEnvironment): boolean {
  return (["width", "height", "fullscreen"] as const).every(key => environment[key] === capture.environment[key]);
}
/** One request owns one monotonic latch. Returning to the old control values
 * cannot revive a lease after an intermediate non-data context change. */
export function createCopyViewportRevocation(capture: CopyViewportContinuity) {
  let revoked = false;
  return {
    isRevoked: () => revoked,
    invalidate() { revoked = true; },
    observe(sample: ViewportSample, environment: CopyViewportEnvironment) {
      if (!sameCopyContext(capture, sample, environment)) revoked = true;
      return !revoked;
    },
    observeEnvironment(environment: CopyViewportEnvironment) {
      // A compatibility resize notification with unchanged physical window
      // dimensions is not a new context; real A→B→A resize is still revoked.
      if (!sameCopyEnvironment(capture, environment)) revoked = true;
      return !revoked;
    },
  };
}

/** Only the accepted copy may replace canonical identity. It cannot acquire
 * fresh input authority or restore a position on a later confirmed revision. */
export function copyViewportHandoffSource(request: CanonicalMutationRequest, current: Readonly<{
  requestId: string | null;
  sample: ViewportSample;
  stamp: ViewportStamp;
  environment: CopyViewportEnvironment;
  canonicalReady: boolean;
  blocked: boolean;
  revoked?: boolean;
}>): ViewportStamp | null {
  const capture = request.copyViewport, context = current.sample.context;
  if (!capture || current.requestId !== request.requestId || capture.baseRevision !== request.baseRevision || request.outcome !== "SUCCESS" || current.blocked || current.revoked || !current.canonicalReady ||
    !Number.isSafeInteger(capture.confirmedRevision) || capture.confirmedRevision! <= request.baseRevision ||
    context.revision !== capture.confirmedRevision || !current.sample.measurable || !context.visible || context.empty ||
    current.stamp.gesture !== capture.stamp.gesture || current.stamp.intent !== capture.stamp.intent ||
    !Number.isFinite(capture.left) || capture.left < 0) return null;
  if (!sameCopyContext(capture, current.sample, current.environment)) return null;
  return { ...current.stamp, gesture: capture.stamp.gesture, intent: capture.stamp.intent };
}
