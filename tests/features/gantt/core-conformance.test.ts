import { describe, expect, it } from "vitest";
import { reusableCoreProof, verifyCoreConformance } from "../../../src/features/gantt/core-conformance";
import { canonicalFixture, driftFixture, fakeCore, proofContextFixture } from "../../fixtures/gantt-state-consistency/synthetic";
import { normalizeSerializedCore } from "../../../src/features/gantt/state-consistency";
import actual from "../../fixtures/gantt-state-consistency/actual-core-2.7.3.json";

function setup() {
  const fixture = proofContextFixture();
  const context = { source: fixture.source, identity: fixture.desired, recovery: fixture.recovery, dirty: false };
  const core = fakeCore();
  return { context, core, verify: () => verifyCoreConformance({ reader: core.port, desired: canonicalFixture(), context, current: () => context, observation: fixture.observation }) };
}
describe("U2 actual Core conformance (SC-01~04/07)", () => {
  it.each(["order", "date", "temporary-add", "delete", "type", "hierarchy", "link"] as const)("refuses key-identical %s drift", kind => {
    const value = setup(); value.core.replace(driftFixture(kind)); expect(value.verify()).toMatchObject({ ok: false, reason: "CORE_DRIFT" });
  });
  it("ignores renderer caches but checks full normalized data", () => {
    const value = setup(); value.core.replace(driftFixture("renderer-cache")); expect(value.verify().ok).toBe(true);
  });
  it("reuses proof after equivalent DTO/observation only with another actual read", () => {
    const value = setup(), result = value.verify(); if (!result.ok) throw new Error("proof");
    value.core.replace(canonicalFixture()); expect(reusableCoreProof(result.proof, value.core.port, value.context)).toBe(true);
    expect(value.core.reads).toBe(2); value.core.replace(driftFixture("order")); expect(reusableCoreProof(result.proof, value.core.port, value.context)).toBe(false);
  });
  it.each(["dirty", "pending", "recovery", "api", "revision", "query"])("rejects %s proof reuse", kind => {
    const value = setup(), result = value.verify(); if (!result.ok) throw new Error("proof");
    let current = structuredClone(value.context);
    if (kind === "dirty") current.dirty = true;
    if (kind === "pending") current = { ...current, recovery: { ...current.recovery, phase: "PENDING" } };
    if (kind === "recovery") current = { ...current, source: { ...current.source, recovery: current.source.recovery + 1 } };
    if (kind === "api") current = { ...current, source: { ...current.source, apiInstance: "replacement" } };
    if (kind === "revision") current = { ...current, identity: { ...current.identity, revision: current.identity.revision + 1 } };
    if (kind === "query") current = { ...current, identity: { ...current.identity, query: "changed" } };
    expect(reusableCoreProof(result.proof, value.core.port, current)).toBe(false);
  });
  it("does not turn unreadable Core into empty success", () => {
    const value = setup(); value.core.failReads(); expect(value.verify()).toMatchObject({ ok: false, reason: "READ_FAILED" });
  });
  it("compares the installed serialize fixture through the shared normalized reader", () => {
    const hydrate = (input: unknown) => JSON.parse(JSON.stringify(input), (key, value) => ["start", "end"].includes(key) && typeof value === "string" ? new Date(value) : value);
    const snapshot = { tasks: hydrate(actual.serializeTasks), links: hydrate(actual.serializeLinks) };
    const observed = normalizeSerializedCore({ ...snapshot, tree: hydrate(actual.serializeTree) });
    const value = setup(); expect(verifyCoreConformance({ reader: { readCore: () => observed }, desired: snapshot, context: value.context, current: () => value.context, observation: proofContextFixture().observation }).ok).toBe(true);
  });
});

it("treats reordered links as the same relation collection while preserving task order", () => {
  const value = setup(); const canonical = canonicalFixture();
  const links = [...canonical.links, { id: "BC", source: "B", target: "C", type: "e2s" as const }];
  const reader = fakeCore({ ...canonical, links: [...links].reverse() });
  expect(verifyCoreConformance({ reader: reader.port, desired: { ...canonical, links }, context: value.context, current: () => value.context, observation: proofContextFixture().observation }).ok).toBe(true);
});
it("invalidates reused proof when a mutation occurs during the actual read", () => {
  const value = setup(), result = value.verify(); if (!result.ok) throw new Error("proof");
  const after = { ...value.context, dirty: true, source: { ...value.context.source, dirty: 1 } };
  expect(reusableCoreProof(result.proof, value.core.port, value.context, () => after)).toBe(false);
});
it("normalizes a complete 1000-task + 2000-milestone population with one actual read", () => {
  const value = setup(); const tasks = Array.from({ length: 3000 }, (_, index) => ({ id: `synthetic-${index}`, parent: 0, text: "Synthetic", type: index < 1000 ? "task" : "milestone", start: new Date(2026, 9, 1), ...(index < 1000 ? { end: new Date(2026, 9, 2) } : {}) }));
  const reader = fakeCore({ tasks, links: [] });
  const result = verifyCoreConformance({ reader: reader.port, desired: { tasks, links: [] }, context: value.context, current: () => value.context, observation: proofContextFixture().observation });
  expect(result.ok && result.proof.snapshot.tasks.length).toBe(3000); expect(reader.reads).toBe(1);
});
it.each(["query", "key", "source"])("rejects in-place %s mutation during conformance read", kind => {
  const value = setup();
  const mutable = { ...value.context, source: { ...value.context.source }, identity: { ...value.context.identity, keys: { ...value.context.identity.keys } } };
  const reader = { readCore() {
    if (kind === "query") mutable.identity.query = "new-query";
    if (kind === "key") mutable.identity.keys.data = "new-data";
    if (kind === "source") mutable.source.dirty++;
    return value.core.port.readCore();
  } };
  expect(verifyCoreConformance({ reader, desired: canonicalFixture(), context: mutable, current: () => mutable, observation: proofContextFixture().observation })).toMatchObject({ ok: false, outcome: "SUPERSEDED" });
});
it.each(["query", "key", "source"])("rejects in-place %s mutation while reusing a proof", kind => {
  const value = setup(), result = value.verify(); if (!result.ok) throw new Error("proof");
  const mutable = { ...value.context, source: { ...value.context.source }, identity: { ...value.context.identity, keys: { ...value.context.identity.keys } } };
  const reader = { readCore() {
    if (kind === "query") mutable.identity.query = "new-query";
    if (kind === "key") mutable.identity.keys.data = "new-data";
    if (kind === "source") mutable.source.dirty++;
    return value.core.port.readCore();
  } };
  expect(reusableCoreProof(result.proof, reader, mutable, () => mutable)).toBe(false);
});
it("accepts fresh semantically equal identities regardless of object property construction order", () => {
  const value = setup(), result = value.verify(); if (!result.ok) throw new Error("proof");
  const original = value.context;
  const reordered = { ...original, source: { recovery: original.source.recovery, dirty: original.source.dirty, apiInstance: original.source.apiInstance },
    identity: { scope: original.identity.scope, query: original.identity.query, keys: { layout: original.identity.keys.layout, membership: original.identity.keys.membership, structure: original.identity.keys.structure, data: original.identity.keys.data }, revision: original.identity.revision } };
  expect(reusableCoreProof(result.proof, value.core.port, reordered)).toBe(true);
  expect(verifyCoreConformance({ reader: value.core.port, desired: canonicalFixture(), context: original, current: () => reordered, observation: proofContextFixture().observation }).ok).toBe(true);
});
