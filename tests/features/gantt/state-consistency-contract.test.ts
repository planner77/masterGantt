import { expect, expectTypeOf, it } from "vitest";
import type { ConsistencyOutcome, CoreGeneration, DesiredProjectionIdentity, ObservationAttempt, RecoveryInput, UserIntentLease } from "../../../src/features/gantt/state-consistency";
import type { ViewportOutcome } from "../../../src/features/gantt/viewport/viewport-coordinator";
import type { ProjectionReceipt } from "../../../src/features/gantt/projection-settled";

it("preserves existing typed outcomes", () => {
  expectTypeOf<ViewportOutcome>().toExtend<ConsistencyOutcome>();
  expectTypeOf<ProjectionReceipt["outcome"]>().toExtend<ConsistencyOutcome>();
});
it("keeps observation attempts independent from semantic identity, dirty/recovery and intent", () => {
  const desired: DesiredProjectionIdentity = { revision: 3, keys: { data: "d", structure: "s", membership: "m", layout: "l" }, query: "", scope: null };
  const source: CoreGeneration = { apiInstance: "core-1", dirty: 2, recovery: 1 };
  const recovery: RecoveryInput = { phase: "REQUIRED", generation: 1, requestId: "request-1", baseRevision: 3, affectedIds: ["A"] };
  const lease: UserIntentLease = { stamp: { context: "c", contextEpoch: 2, gesture: 4, intent: 5 }, priority: 4 };
  const first: ObservationAttempt = { id: 1, startedAt: 0, deadline: 1500 }, next: ObservationAttempt = { id: 2, startedAt: 10, deadline: 1510 };
  expect(first).not.toEqual(next);
  expectTypeOf(desired).not.toExtend<ObservationAttempt>();
  expectTypeOf(source).not.toExtend<ObservationAttempt>();
  expectTypeOf(recovery).not.toExtend<ObservationAttempt>();
  expectTypeOf(lease).not.toExtend<ObservationAttempt>();
  expectTypeOf<ObservationAttempt>().not.toExtend<CoreGeneration>();
  expectTypeOf<ObservationAttempt>().not.toExtend<UserIntentLease>();
});
