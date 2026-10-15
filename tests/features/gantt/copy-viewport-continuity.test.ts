import { describe, expect, it } from "vitest";
import { captureCopyViewport, copyViewportHandoffSource, createCopyViewportRevocation, type CanonicalMutationRequest } from "../../../src/features/gantt/viewport/copy-viewport-continuity";
import type { ViewportSample } from "../../../src/features/gantt/viewport/viewport-coordinator";

function fixture() {
  const environment = { width: 1440, height: 1000, fullscreen: false };
  const original = { context: "canonical-before", contextEpoch: 1, gesture: 3, intent: 4 };
  const sample: ViewportSample = { measurable: true, geometry: "before", capacity: { left: 1000, top: 100 },
    core: { left: 46, top: 96 }, native: { left: 46, top: 96 }, receipt: null,
    context: { apiInstance: "api-1", revision: 7, key: "project:scope:query", scope: null, filter: "all", scale: "week", columns: "saved-widths",
      geometry: "before-data", visible: true, empty: false, filtered: false, projectionEpoch: 1, receiptFilter: "all", bookmarkGeometry: "before" } };
  const captured = captureCopyViewport(sample, original, environment)!;
  const request: CanonicalMutationRequest = { requestId: "copy-1", baseRevision: 7, affectedIds: ["A", "B"], outcome: "SUCCESS",
    copyViewport: { ...captured, confirmedRevision: 8 } };
  const current = { requestId: request.requestId, canonicalReady: true, blocked: false, environment,
    sample: { ...sample, geometry: "after", core: { left: 0, top: 0 }, native: { left: 0, top: 0 }, context: { ...sample.context, revision: 8, geometry: "after-data", projectionEpoch: 2 } },
    stamp: { ...original, context: "canonical-after", contextEpoch: 2 } };
  return { request, current, sample, original, environment };
}

describe("confirmed copy viewport continuity", () => {
  it("captures an aligned measured position and replaces only confirmed canonical identity", () => {
    const { request, current, original } = fixture();
    expect(request.copyViewport?.left).toBe(46);
    expect(copyViewportHandoffSource(request, current)).toEqual({ ...current.stamp, gesture: original.gesture, intent: original.intent });
    expect(request.copyViewport?.stamp.context).toBe("canonical-before");
  });
  it.each(["hidden", "unmeasured", "empty", "unaligned", "invalid"])("does not capture %s ingress", kind => {
    const { sample, original, environment } = fixture();
    const changed = { ...sample, measurable: kind !== "unmeasured", context: { ...sample.context, visible: kind !== "hidden", empty: kind === "empty" },
      core: { ...sample.core, left: kind === "invalid" ? NaN : sample.core.left }, native: { ...sample.native, left: kind === "unaligned" ? 0 : sample.native.left } };
    expect(captureCopyViewport(changed, original, environment)).toBeUndefined();
  });
  it.each([NaN, Infinity, -Infinity, -1])("rejects invalid native ingress %s", left => {
    const { sample, original, environment } = fixture();
    expect(captureCopyViewport({ ...sample, native: { ...sample.native, left } }, original, environment)).toBeUndefined();
  });
  it("cannot attach a viewport captured from another base revision", () => {
    const { request, current } = fixture();
    expect(copyViewportHandoffSource({ ...request, baseRevision: 6 }, current)).toBeNull();
  });
  it.each(["gesture", "intent"] as const)("never acquires authority after a newer %s", key => {
    const { request, current } = fixture();
    expect(copyViewportHandoffSource(request, { ...current, stamp: { ...current.stamp, [key]: current.stamp[key] + 1 } })).toBeNull();
  });
  it.each(["apiInstance", "key", "scope", "filter", "scale", "columns"] as const)("rejects changed non-data context %s", key => {
    const { request, current } = fixture();
    expect(copyViewportHandoffSource(request, { ...current, sample: { ...current.sample, context: { ...current.sample.context, [key]: "changed" } } })).toBeNull();
  });
  it.each(["width", "height", "fullscreen"] as const)("rejects changed environment %s", key => {
    const { request, current } = fixture();
    expect(copyViewportHandoffSource(request, { ...current, environment: { ...current.environment, [key]: key === "fullscreen" ? true : 390 } })).toBeNull();
  });
  it("permits owned unchanged-size resize notifications and canonical data changes", () => {
    const { request, current } = fixture();
    const lease = createCopyViewportRevocation(request.copyViewport!);
    expect(lease.observeEnvironment({ ...current.environment })).toBe(true);
    expect(lease.observe(current.sample, current.environment)).toBe(true);
    expect(lease.isRevoked()).toBe(false);
  });
  it("does not revive after Week→Day→Week, including a confirmed object update with the same request", () => {
    const { request, current } = fixture();
    const lease = createCopyViewportRevocation(request.copyViewport!);
    expect(lease.observe({ ...current.sample, context: { ...current.sample.context, scale: "day" } }, current.environment)).toBe(false);
    expect(lease.observe(current.sample, current.environment)).toBe(false);
    expect(copyViewportHandoffSource({ ...request, copyViewport: { ...request.copyViewport! } }, { ...current, revoked: lease.isRevoked() })).toBeNull();
  });
  it("does not revive after a physical window resize round-trip", () => {
    const { request, current } = fixture();
    const lease = createCopyViewportRevocation(request.copyViewport!);
    expect(lease.observeEnvironment({ ...current.environment, width: 1024 })).toBe(false);
    expect(lease.observeEnvironment(current.environment)).toBe(false);
    expect(lease.observe(current.sample, current.environment)).toBe(false);
  });
  it.each(["hidden", "fullscreen-or-visibility-event", "columns"])("keeps %s revocation after returning to old values", kind => {
    const { request, current } = fixture();
    const lease = createCopyViewportRevocation(request.copyViewport!);
    if (kind === "fullscreen-or-visibility-event") lease.invalidate();
    else lease.observe({ ...current.sample, context: { ...current.sample.context, visible: kind !== "hidden", columns: kind === "columns" ? "changed" : current.sample.context.columns } }, current.environment);
    expect(lease.observe(current.sample, current.environment)).toBe(false);
    expect(copyViewportHandoffSource(request, { ...current, revoked: lease.isRevoked() })).toBeNull();
  });
  it("rejects missing validated response revision even if HTTP reported SUCCESS", () => {
    const { request, current } = fixture();
    expect(copyViewportHandoffSource({ ...request, copyViewport: { ...request.copyViewport!, confirmedRevision: undefined } }, current)).toBeNull();
  });
  it.each(["NETWORK", "TIMEOUT", 401, 412, 422, 500] as const)("rejects failure or UNKNOWN %s", outcome => {
    const { request, current } = fixture();
    expect(copyViewportHandoffSource({ ...request, outcome }, current)).toBeNull();
  });
  it.each(["blocked", "unproven", "different-request", "newer-revision", "same-base", "hidden", "unmeasured"])("rejects %s without replay", kind => {
    const { request, current } = fixture();
    const changed = { ...current, blocked: kind === "blocked", canonicalReady: kind !== "unproven", requestId: kind === "different-request" ? "copy-2" : current.requestId,
      sample: { ...current.sample, measurable: kind !== "unmeasured", context: { ...current.sample.context, visible: kind !== "hidden", revision: kind === "newer-revision" ? 9 : current.sample.context.revision } } };
    expect(copyViewportHandoffSource(kind === "same-base" ? { ...request, copyViewport: { ...request.copyViewport!, confirmedRevision: 7 } } : request, changed)).toBeNull();
  });
});
