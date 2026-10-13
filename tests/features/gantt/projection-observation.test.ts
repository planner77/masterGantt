import { describe, expect, it } from "vitest";
import type { CanonicalProjection } from "../../../src/features/gantt/canonical-projection";
import { projectionObservationKey, sameAppliedProjection } from "../../../src/features/gantt/viewport/projection-observation";
import type { ViewportSample } from "../../../src/features/gantt/viewport/viewport-coordinator";

function fixture() {
  const projection: CanonicalProjection = { revision: 3, tasks: [], links: [], membershipIds: [], logicalVisibleIds: [],
    keys: { data: "data", structure: "structure", membership: "membership", layout: "layout" } };
  const sample: ViewportSample = {
    context: { apiInstance: "api-1", revision: 3, key: "query", scope: null, filter: "all", scale: "day",
      columns: "columns", geometry: "canonical", visible: true, empty: false, filtered: false,
      projectionEpoch: 7, receiptFilter: "query", bookmarkGeometry: "bookmark" },
    receipt: { apiInstance: "api-1", revision: 3, generation: 7, scope: null, scale: "day", columns: "columns",
      filterKey: "query", outcome: "SETTLED", reasons: [], logicalVisibleIds: [], coreVisibleIds: [], domIds: [],
      taskSelectionChanged: false, queryConditionsChanged: false, selectedIds: [] },
    measurable: true, geometry: "physical-axis", capacity: { left: 500, top: 0 }, core: { left: 120, top: 0 }, native: { left: 120, top: 0 },
  };
  return { projection, sample };
}

describe("metadata projection observation reuse", () => {
  it("preserves a settled receipt across fresh identical DTO objects and coordinate reconciliation", () => {
    const { projection, sample } = fixture(), clone = structuredClone(projection);
    expect(projectionObservationKey(clone, { ...sample, core: { left: 0, top: 0 } })).toBe(projectionObservationKey(projection, sample));
    const api = {};
    expect(sameAppliedProjection(projection, clone, api, api)).toBe(true);
  });
  it.each(["data", "structure", "membership", "layout"] as const)("requires a new observation for a real %s change", key => {
    const { projection, sample } = fixture(), next = { ...projection, keys: { ...projection.keys, [key]: "changed" } }, api = {};
    expect(projectionObservationKey(next, sample)).not.toBe(projectionObservationKey(projection, sample));
    expect(sameAppliedProjection(projection, next, api, api)).toBe(false);
  });
  it("does not reuse a canonical commit on an exchanged or removed API, or a new revision", () => {
    const { projection } = fixture(), firstApi = {}, nextApi = {};
    expect(sameAppliedProjection(projection, projection, firstApi, nextApi)).toBe(false);
    expect(sameAppliedProjection(projection, projection, null, null)).toBe(false);
    expect(sameAppliedProjection(projection, { ...projection, revision: 4 }, firstApi, firstApi)).toBe(false);
  });
  it.each(["apiInstance", "key", "scope", "filter", "scale", "columns", "geometry"] as const)("invalidates a receipt reuse key when %s changes", key => {
    const { projection, sample } = fixture();
    const changed = { ...sample, context: { ...sample.context, [key]: "changed" } };
    expect(projectionObservationKey(projection, changed)).not.toBe(projectionObservationKey(projection, sample));
  });
  it("requires a fresh observation after physical axis/layout changes, hiding, or receipt invalidation", () => {
    const { projection, sample } = fixture();
    expect(projectionObservationKey(projection, { ...sample, geometry: "changed-axis" })).not.toBe(projectionObservationKey(projection, sample));
    expect(projectionObservationKey(projection, { ...sample, context: { ...sample.context, visible: false } })).toBeNull();
    expect(projectionObservationKey(projection, { ...sample, measurable: false })).toBeNull();
    expect(projectionObservationKey(projection, { ...sample, context: { ...sample.context, projectionEpoch: 8 } })).toBeNull();
    expect(projectionObservationKey(projection, { ...sample, receipt: null })).toBeNull();
  });
});
