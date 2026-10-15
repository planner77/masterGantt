import { describe, expect, it } from "vitest";
import { canonicalFixture, driftFixture, fakeClock, fakeCore, fakeGeometry, inspectSyntheticEvidence, recoveryFixture, proofContextFixture, proofFixture, reusableSyntheticProof } from "../../fixtures/gantt-state-consistency/synthetic";

const evaluate = (core = fakeCore(), patch: Partial<Parameters<typeof inspectSyntheticEvidence>[0]> = {}) => inspectSyntheticEvidence({
  core: core.port, desired: canonicalFixture(), recovery: recoveryFixture(), capturedIntent: 1, currentIntent: 1, observationId: 1, dirtyGeneration: 0, ...patch,
});

describe("U1 synthetic counterexamples; product recovery and browser outcomes remain NOT TESTED", () => {
  it("SC-01/06 accepts matching fresh DTO data despite a same-revision observation attempt increase", () => {
    const core = fakeCore();
    core.replace(canonicalFixture());
    expect(evaluate(core, { observationId: 900 })).toBe("MATCHING_DATA");
    expect(core.reads).toBe(1);
    expect(Object.keys(core.port)).toEqual(["readCore"]);
  });
  it.each(["order", "date", "temporary-add", "delete", "type", "hierarchy", "link"] as const)("SC-02/03/04 detects %s drift at the same revision even with an advanced generation", kind => {
    const core = fakeCore(driftFixture(kind));
    expect(evaluate(core, { dirtyGeneration: 900, observationId: 901 })).toBe("DRIFT");
    expect(core.port.readCore()).not.toEqual(fakeCore().port.readCore());
  });
  it("SC-02 rejects A-C-B despite an identical ID set and link set", () => {
    const canonical = canonicalFixture(), actual = driftFixture("order");
    expect(new Set(actual.tasks.map(task => task.id))).toEqual(new Set(canonical.tasks.map(task => task.id)));
    expect(actual.links).toEqual(canonical.links);
    expect(evaluate(fakeCore(actual))).toBe("DRIFT");
  });
  it("SC-01 normalization ignores derived duration/collapse/coordinate caches", () => {
    expect(evaluate(fakeCore(driftFixture("renderer-cache")))).toBe("MATCHING_DATA");
  });
  it.each(["PENDING", "UNCERTAIN", "REQUIRED", "RECONCILING"] as const)("SC-03/05 matching canonical data cannot hide %s recovery", phase => {
    expect(evaluate(fakeCore(), { recovery: recoveryFixture(phase), dirtyGeneration: 900 })).toBe("RECOVERY_PENDING");
  });
  it("SC-05 uncertain commit fixtures represent both server outcomes and failed GET without issuing a retry", () => {
    const core = fakeCore(driftFixture("date"));
    const uncertain = recoveryFixture("UNCERTAIN");
    expect(evaluate(core, { recovery: uncertain })).toBe("DRIFT");
    // Simulate confirmed GET: commit succeeded. Updating authority is test input,
    // not U1 recovery behavior or an automatic mutation retry.
    expect(evaluate(core, { desired: driftFixture("date"), recovery: uncertain })).toBe("RECOVERY_PENDING");
    // Simulate commit did not succeed and a subsequent GET cannot be read.
    core.failReads();
    expect(evaluate(core, { recovery: uncertain })).toBe("UNREADABLE");
    expect(Object.keys(core.port)).toEqual(["readCore"]);
  });
  it("SC-07/09 old intent cannot revive on a fresh observation or generation", () => {
    expect(evaluate(fakeCore(), { currentIntent: 2, observationId: 1000, dirtyGeneration: 1000 })).toBe("SUPERSEDED");
  });
  it("SC-07 read failure never becomes matching data", () => {
    const core = fakeCore(); core.failReads();
    expect(evaluate(core)).toBe("UNREADABLE");
  });
  it("SC-08/12 exposes hidden and zero-capacity geometry as explicit outcomes without writes", () => {
    const geometry = fakeGeometry();
    expect(geometry.port.readGeometry()).toMatchObject({ ok: true, core: { left: 120, top: 96 } });
    geometry.replace({ ok: false, outcome: "NOT_MEASURABLE" });
    expect(geometry.port.readGeometry()).toEqual({ ok: false, outcome: "NOT_MEASURABLE" });
    geometry.replace({ ok: false, outcome: "NO_SCROLL_CAPACITY" });
    expect(geometry.port.readGeometry()).toEqual({ ok: false, outcome: "NO_SCROLL_CAPACITY" });
    expect(Object.keys(geometry.port)).toEqual(["readGeometry"]);
  });
  it("SC-14 deterministic frame cancellation removes pending callbacks and never resolves as success", async () => {
    const clock = fakeClock(), controller = new AbortController();
    const cancelled = clock.port.frame(controller.signal);
    expect(clock.pending).toBe(1);
    controller.abort();
    expect(await cancelled).toBe(false); expect(clock.pending).toBe(0);
    clock.advance(); expect(clock.port.now()).toBe(16);
    expect(await clock.port.frame(controller.signal)).toBe(false);
    const next = clock.port.frame(new AbortController().signal);
    clock.advance(); expect(await next).toBe(true); expect(clock.pending).toBe(0);
  });
});


describe("U1 test-only proof reuse and superseded response boundaries", () => {
  it("SC-01/06 same semantic DTO re-observation preserves the original proof without issuing a new one", () => {
    const core = fakeCore(), fixture = proofFixture(), current = proofContextFixture();
    const originalProof = fixture.proof;
    core.replace(canonicalFixture());
    expect(reusableSyntheticProof(fixture, { ...current, desired: structuredClone(current.desired), observation: { id: 200, startedAt: 32, deadline: 80 } }, core.port)).toBe(true);
    expect(fixture.proof).toBe(originalProof);
    expect(fixture.proof.observation.id).toBe(1);
    expect(core.effects).toEqual({ coreWrites: 0, mutationRetries: 0 });
  });
  it.each(["dirty", "recovery", "api", "revision", "query", "scope", "data", "layout", "axis", "intent"] as const)("SC-07 %s semantic change invalidates prior proof even when Core data matches", dimension => {
    const core = fakeCore(), fixture = proofFixture(), current = proofContextFixture();
    const changed = {
      ...current, source: { ...current.source }, desired: { ...current.desired, keys: { ...current.desired.keys } },
      layoutAxis: { ...current.layoutAxis }, intent: { ...current.intent, stamp: { ...current.intent.stamp } },
    };
    if (dimension === "dirty") changed.source.dirty++;
    if (dimension === "recovery") changed.source.recovery++;
    if (dimension === "api") changed.source.apiInstance = "synthetic-api-2";
    if (dimension === "revision") changed.desired.revision++;
    if (dimension === "query") changed.desired.query = "synthetic-query";
    if (dimension === "scope") changed.desired.scope = "B";
    if (dimension === "data") changed.desired.keys.data = "synthetic-new-data";
    if (dimension === "layout") changed.layoutAxis.layout = "synthetic-fullscreen";
    if (dimension === "axis") changed.layoutAxis.axis = "synthetic-week-axis";
    if (dimension === "intent") changed.intent.stamp.intent++;
    expect(reusableSyntheticProof(fixture, { ...changed, observation: { id: 300, startedAt: 32, deadline: 80 } }, core.port)).toBe(false);
    expect(fixture.proof.source).toEqual(current.source);
    expect(fixture.proof.observation.id).toBe(1);
  });
  it("SC-02/07 actual Core mutation invalidates a proof even if all counters/keys are unchanged", () => {
    const core = fakeCore(), fixture = proofFixture(), current = proofContextFixture();
    expect(reusableSyntheticProof(fixture, current, core.port)).toBe(true);
    core.replace(driftFixture("order"));
    expect(reusableSyntheticProof(fixture, current, core.port)).toBe(false);
    core.failReads();
    expect(reusableSyntheticProof(fixture, current, core.port)).toBe(false);
  });
  it("SC-03/05 an older response cannot roll back a newer pending edit or clear its recovery", () => {
    const core = fakeCore(driftFixture("date")), fixture = proofFixture(), current = proofContextFixture();
    const pending = { ...recoveryFixture("PENDING"), requestId: "synthetic-newer-request-2", generation: 1 };
    const newer = { ...current, source: { ...current.source, dirty: 1, recovery: 1 }, recovery: pending };
    const before = core.port.readCore();
    // A late old rejection/confirmed GET offers the old canonical. Neither the
    // reference proof check nor data comparison is authorized to apply it.
    const lateOldResponse = { requestId: "synthetic-request-1", baseRevision: 17, canonical: canonicalFixture(), status: 422 };
    expect(reusableSyntheticProof(fixture, newer, core.port)).toBe(false);
    expect(evaluate(core, { desired: lateOldResponse.canonical, recovery: newer.recovery, dirtyGeneration: 1 })).toBe("DRIFT");
    expect(core.port.readCore()).toEqual(before);
    expect(newer.recovery).toBe(pending);
    expect(newer.recovery).toMatchObject({ phase: "PENDING", requestId: "synthetic-newer-request-2", generation: 1 });
    expect(core.effects).toEqual({ coreWrites: 0, mutationRetries: 0 });
  });
});
