import type { IApi, ITask, ILink } from "@svar-ui/react-gantt";
import { applyCanonicalGanttSync, type CanonicalGanttSnapshot } from "./canonical-snapshot-sync";
import { captureConformanceContext, sameConformanceContext, sameConformanceSnapshot, verifyCoreConformance, type ConformanceContext } from "./core-conformance";
import { normalizeCanonicalCore } from "./state-consistency";
import type { ConsistencyAbortPort, ConsistencyClockPort, CoreConformanceProof, CoreReaderPort, DesiredProjectionIdentity, ObservedCoreSnapshot, RecoveryInput } from "./state-consistency";

export type MutationOutcome = "SUCCESS" | 401 | 412 | 422 | 500 | "TIMEOUT" | "NETWORK";
export interface MutationTicket { readonly requestId: string; readonly generation: number; readonly apiInstance: string; readonly baseRevision: number; readonly affectedIds: readonly string[] }
export interface RecoveryCanonical { readonly snapshot: CanonicalGanttSnapshot; readonly identity: DesiredProjectionIdentity }
export type CanonicalRecoveryResult =
  | Readonly<{ outcome: "SETTLED"; canonical: RecoveryCanonical; proof: CoreConformanceProof; changed: boolean }>
  | Readonly<{ outcome: "SUPERSEDED" | "FAILED" | "TIMED_OUT" | "BLOCKED"; reason: string }>;
export interface CanonicalRecoveryPorts {
  readonly core: CoreReaderPort;
  readonly api: Pick<IApi, "exec" | "getTask">;
  readonly clock: ConsistencyClockPort;
  readonly abort: ConsistencyAbortPort;
  /** Must read latest server canonical; this port never submits a mutation. */
  fetchCanonical(signal: AbortSignal): Promise<RecoveryCanonical>;
  currentIdentity(): DesiredProjectionIdentity;
  apiInstance(): string;
}
function materialize(snapshot: ObservedCoreSnapshot): CanonicalGanttSnapshot {
  return { tasks: snapshot.tasks.map(task => ({ ...task, parent: task.parent === "0" ? 0 : task.parent,
    start: task.start === null ? undefined : new Date(task.start), end: task.end === null ? undefined : new Date(task.end),
    externalId: task.externalId ?? undefined, projectDisplayKey: task.projectDisplayKey ?? undefined,
    baselineStart: task.baselineStart ?? undefined, baselineEnd: task.baselineEnd ?? undefined, baselineDuration: task.baselineDuration ?? undefined })), links: snapshot.links.map(link => ({ ...link, type: link.type as ILink["type"] })) };
}

/** Opt-in data reconciler. U5 owns wiring every native mutation to invalidation.
 * No remount, viewport write, server retry, revision invention or draft mutation. */
export function createCanonicalRecovery(ports: CanonicalRecoveryPorts, budget: { maxFrames: number; timeoutMs: number } = { maxFrames: 12, timeoutMs: 250 }) {
  if (!Number.isInteger(budget.maxFrames) || budget.maxFrames < 1 || budget.maxFrames > 120 || !Number.isFinite(budget.timeoutMs) || budget.timeoutMs <= 0) throw new Error("Invalid recovery budget");
  let generation = 0, dirtyGeneration = 0, observationId = 0, dirty = false;
  let phase: RecoveryInput["phase"] = "IDLE";
  let ticket: MutationTicket | null = null;
  let disposed = false, authorizationRequired = false;
  let active: AbortController | null = null;
  const cancel = () => { active?.abort(); active = null; };
  const state = (): ConformanceContext => {
    const identity = ports.currentIdentity();
    return captureConformanceContext({ source: { apiInstance: ports.apiInstance(), dirty: dirtyGeneration, recovery: generation }, identity, dirty,
      recovery: { phase, generation, requestId: ticket?.requestId ?? null, baseRevision: ticket?.baseRevision ?? identity.revision, affectedIds: ticket?.affectedIds ?? [] } });
  };
  const validTicket = (value: MutationTicket) => ticket === value && value.generation === generation && value.apiInstance === ports.apiInstance();
  return {
    state,
    authorizationRequired: () => authorizationRequired,
    /** U5 calls only after server-confirmed authorization success. */
    confirmAuthorization() { authorizationRequired = false; },
    canWrite: () => !authorizationRequired && !disposed && !ports.abort.signal.aborted && ports.abort.isCurrent() && ["IDLE", "SETTLED"].includes(phase) && !dirty,
    beginMutation(requestId: string, affectedIds: readonly string[]): MutationTicket | null {
      if (authorizationRequired || disposed || ports.abort.signal.aborted || !ports.abort.isCurrent() || !["IDLE", "SETTLED", "RECONCILING"].includes(phase) || !requestId) return null;
      cancel(); generation++; dirtyGeneration++; dirty = true; phase = "PENDING";
      ticket = Object.freeze({ requestId, generation, apiInstance: ports.apiInstance(), baseRevision: ports.currentIdentity().revision, affectedIds: Object.freeze([...affectedIds]) });
      return ticket;
    },
    /** Native/app Core changes invalidate an existing proof even without a request. */
    markDirty() { cancel(); dirtyGeneration++; dirty = true; if (phase !== "PENDING") phase = "REQUIRED"; },
    completeMutation(value: MutationTicket, outcome: MutationOutcome): boolean {
      if (!validTicket(value) || phase !== "PENDING") return false;
      if (outcome === 401) authorizationRequired = true;
      phase = [500, "TIMEOUT", "NETWORK"].includes(outcome) ? "UNCERTAIN" : "REQUIRED";
      return true;
    },
    async recover(): Promise<CanonicalRecoveryResult> {
      if (disposed || phase === "PENDING" || phase === "RECONCILING") return { outcome: "BLOCKED", reason: "PENDING_OR_DISPOSED" };
      cancel(); const controller = new AbortController(); active = controller;
      const captured = state();
      const sourceCurrent = () => !disposed && active === controller && !ports.abort.signal.aborted && ports.abort.isCurrent() && sameConformanceContext(captured, state());
      const current = () => sourceCurrent() && !controller.signal.aborted;
      const abort = () => controller.abort(); ports.abort.signal.addEventListener("abort", abort, { once: true });
      const startedAt = ports.clock.now(), observation = ++observationId;
      const deadline = startedAt + budget.timeoutMs;
      let remainingFrames = budget.maxFrames, watchdogExpired = false;
      // RAF can be suspended in hidden tabs. One wall-time watchdog wakes every
      // pending operation even if the injected frame/request never resolves.
      let wakeAbort!: () => void;
      const aborted = new Promise<false>(resolve => { wakeAbort = () => resolve(false); });
      controller.signal.addEventListener("abort", wakeAbort, { once: true });
      const watchdog = setTimeout(() => { watchdogExpired = true; controller.abort(); }, budget.timeoutMs);
      const assertBudget = () => {
        if (!sourceCurrent()) throw new Error("SUPERSEDED");
        if (watchdogExpired || ports.clock.now() >= deadline) throw new Error("TIMED_OUT");
        if (controller.signal.aborted) throw new Error("SUPERSEDED");
      };
      async function bounded<T>(operation: () => Promise<T>): Promise<T> {
        assertBudget();
        let complete = false, rejected = false, value: T | undefined, failure: unknown;
        const promise = operation();
        promise.then(result => { value = result; complete = true; }, error => { failure = error; rejected = true; complete = true; });
        await Promise.resolve();
        while (!complete && remainingFrames > 0 && ports.clock.now() < deadline) {
          assertBudget(); remainingFrames--;
          await Promise.race([promise.then(() => undefined, () => undefined), ports.clock.frame(controller.signal), aborted]);
        }
        assertBudget();
        if (!complete) throw new Error("TIMED_OUT");
        if (rejected) throw failure;
        return value as T;
      }
      phase = "RECONCILING";
      try {
        const fetched = await bounded(() => ports.fetchCanonical(controller.signal));
        const identity = Object.freeze({ ...fetched.identity, keys: Object.freeze({ ...fetched.identity.keys }) });
        if (!Number.isSafeInteger(identity.revision) || identity.revision < Math.max(captured.identity.revision, ticket?.baseRevision ?? 0) ||
          identity.query !== captured.identity.query || identity.scope !== captured.identity.scope ||
          !identity.keys || ["data", "structure", "membership", "layout"].some(key => typeof identity.keys[key as keyof typeof identity.keys] !== "string")) throw new Error("STALE_OR_INVALID_CANONICAL_IDENTITY");
        const desired = normalizeCanonicalCore(fetched.snapshot);
        if (!desired.ok) throw new Error(`DESIRED_${desired.reason}`);
        if (desired.value.links.some(link => !["e2s", "s2s", "e2e", "s2e"].includes(link.type))) throw new Error("INVALID_LINK_TYPE");
        const detached = materialize(desired.value);
        const canonical: RecoveryCanonical = Object.freeze({ identity, snapshot: Object.freeze({
          tasks: Object.freeze(detached.tasks.map(task => Object.freeze(task))), links: Object.freeze(detached.links.map(link => Object.freeze(link))),
        }) });
        const actual = ports.core.readCore();
        if (!current()) throw new Error("SUPERSEDED");
        if (!actual.ok) throw new Error(actual.reason);
        const changed = !sameConformanceSnapshot(actual.value, desired.value);
        if (changed) {
          const raw = materialize(actual.value);
          const tasks: ITask[] = raw.tasks.map(task => ({ ...task, open: ports.api.getTask(task.id!)?.open }));
          const target = materialize(desired.value);
          const desiredLinks = new Map(desired.value.links.map(link => [link.id, link]));
          const actualLinks = new Map(actual.value.links.map(link => [link.id, link]));
          const equalLink = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
          // Delete only missing/changed links before subtree deletions. Add only
          // missing/changed links after the task topology is valid.
          for (const link of actual.value.links) {
            if (!current()) throw new Error("SUPERSEDED");
            if (!equalLink(link, desiredLinks.get(link.id))) await bounded(() => Promise.resolve(ports.api.exec("delete-link", { id: link.id })));
          }
          await bounded(() => applyCanonicalGanttSync(ports.api, { ...raw, tasks, links: [] }, { ...target, links: [] }, () => current() && ports.clock.now() < deadline));
          for (const link of desired.value.links) {
            if (!current()) throw new Error("SUPERSEDED");
            if (!equalLink(link, actualLinks.get(link.id))) await bounded(() => Promise.resolve(ports.api.exec("add-link", { link: { ...link, type: link.type as ILink["type"] }, eventSource: "project-canonical-sync" })));
          }
        }
        // Canonical's new revision is returned to caller, never written/invented here.
        // Validation uses the fetched identity while source/query are still guarded.
        const clean: ConformanceContext = { ...state(), identity: canonical.identity, dirty: false, recovery: { ...state().recovery, phase: "SETTLED" } };
        assertBudget();
        let verification = verifyCoreConformance({ reader: ports.core, desired: canonical.snapshot, context: clean,
          observation: { id: observation, startedAt, deadline: startedAt + budget.timeoutMs }, current: () => current() ? clean : state() });
        for (let frame = 0; !verification.ok && verification.reason === "CORE_DRIFT" && remainingFrames > 0 && ports.clock.now() < deadline; frame++) {
          if (!current()) throw new Error("SUPERSEDED");
          assertBudget(); remainingFrames--;
          const frameReady = await Promise.race([ports.clock.frame(controller.signal), aborted]);
          assertBudget();
          if (!frameReady) throw new Error("SUPERSEDED");
          verification = verifyCoreConformance({ reader: ports.core, desired: canonical.snapshot, context: clean,
            observation: { id: observation, startedAt, deadline: startedAt + budget.timeoutMs }, current: () => current() ? clean : state() });
        }
        assertBudget();
        if (!verification.ok) throw new Error(verification.outcome === "SUPERSEDED" ? "SUPERSEDED" : verification.reason === "CORE_DRIFT" ? "TIMED_OUT" : verification.reason);
        if (!current()) throw new Error("SUPERSEDED");
        dirty = false; phase = "SETTLED"; ticket = null;
        return { outcome: "SETTLED", canonical, proof: verification.proof, changed };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "RECOVERY_FAILED";
        if (!sourceCurrent() || (reason === "SUPERSEDED" && !watchdogExpired)) {
          if (active === controller && phase === "RECONCILING") { dirty = true; phase = "REQUIRED"; }
          return { outcome: "SUPERSEDED", reason: "SOURCE_CHANGED" };
        }
        dirty = true; phase = "UNCERTAIN";
        return { outcome: watchdogExpired || reason === "TIMED_OUT" ? "TIMED_OUT" : "FAILED", reason: watchdogExpired ? "TIMED_OUT" : reason };
      } finally {
        clearTimeout(watchdog);
        ports.abort.signal.removeEventListener("abort", abort);
        controller.signal.removeEventListener("abort", wakeAbort);
        controller.abort(); if (active === controller) active = null;
      }
    },
    dispose() { disposed = true; cancel(); },
  };
}
