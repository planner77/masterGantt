import type { CanonicalProjection } from "../canonical-projection";
import { validViewportReceipt, type ViewportSample } from "./viewport-coordinator";

/** Reuse an observation only for the same committed projection and physical
 * view. Fresh DTO objects alone do not invalidate a settled receipt. */
export function projectionObservationKey(projection: CanonicalProjection, sample: ViewportSample | null): string | null {
  if (!sample?.measurable || !sample.context.visible || !validViewportReceipt(sample) ||
    sample.context.revision !== projection.revision) return null;
  const context = sample.context;
  return JSON.stringify([projection.revision, projection.keys, context.apiInstance, context.key,
    context.scope, context.filter, context.scale, context.columns, context.geometry, sample.geometry]);
}

export function sameAppliedProjection(previous: CanonicalProjection | null, next: CanonicalProjection,
  previousApi: unknown, currentApi: unknown): boolean {
  return currentApi != null && previousApi === currentApi && previous?.revision === next.revision &&
    (["data", "structure", "membership", "layout"] as const).every(key => previous.keys[key] === next.keys[key]);
}
