import type { IApi, ITask, ILink } from "@svar-ui/react-gantt";
import { describe, expect, it, vi } from "vitest";
import { createCanonicalRecovery, type RecoveryCanonical } from "../../../src/features/gantt/canonical-recovery";
import { normalizeSerializedCore } from "../../../src/features/gantt/state-consistency";
import { canonicalFixture, driftFixture, proofContextFixture } from "../../fixtures/gantt-state-consistency/synthetic";
import type { CanonicalGanttSnapshot } from "../../../src/features/gantt/canonical-snapshot-sync";
function harness(initial = canonicalFixture(), stalled = false) {
  let tasks: ITask[] = initial.tasks.map(task => ({ ...task })); let links: ILink[] = initial.links.map(link => ({ ...link }));
  let server: CanonicalGanttSnapshot = canonicalFixture(), identity = proofContextFixture().desired, instance = "api-1", time = 0;
  let afterExec: (() => void) | undefined;
  const exec = vi.fn(async (action: string, payload: Record<string, unknown>) => {
    const id = String(payload.id), item = tasks.find(task => String(task.id) === id);
    if (action === "update-task" && item) Object.assign(item, payload.task);
    if (action === "delete-task") tasks = tasks.filter(task => String(task.id) !== id);
    if (action === "add-task") tasks.push({ ...(payload.task as ITask) });
    if (action === "move-task" && item) {
      tasks = tasks.filter(task => task !== item);
      const target = tasks.findIndex(task => String(task.id) === String(payload.target));
      if (payload.mode === "child") { item.parent = payload.target as string | number; tasks.push(item); }
      else { item.parent = tasks[target]?.parent; tasks.splice(Math.max(0, target + (payload.mode === "after" ? 1 : 0)), 0, item); }
    }
    if (action === "delete-link") links = links.filter(link => String(link.id) !== id);
    if (action === "add-link") links.push({ ...(payload.link as ILink) });
    afterExec?.();
  });
  const fetchCanonical = vi.fn(async (_signal: AbortSignal): Promise<RecoveryCanonical> => { void _signal; return { snapshot: server, identity }; });
  const abort = new AbortController();
  const recovery = createCanonicalRecovery({ core: { readCore: () => normalizeSerializedCore({ tasks, tree: tasks, links }) },
    api: { exec: exec as IApi["exec"], getTask: ((id: string | number) => tasks.find(task => String(task.id) === String(id))) as IApi["getTask"] },
    clock: { now: () => stalled ? performance.now() : time, frame: async () => { if (stalled) return new Promise<boolean>(() => {}); time += 16; return true; } }, abort: { signal: abort.signal, isCurrent: () => true }, fetchCanonical,
    currentIdentity: () => identity, apiInstance: () => instance }, { maxFrames: stalled ? 1 : 3, timeoutMs: stalled ? 20 : 48 });
  return { recovery, exec, fetchCanonical, abort, actual: () => ({ tasks, links }), setServer(value: CanonicalGanttSnapshot) { server = value; }, advanceTime(milliseconds: number) { time += milliseconds; },
    setIdentity(value: typeof identity) { identity = value; }, replaceApi() { instance = "api-2"; }, onExec(value: () => void) { afterExec = value; } };
}
function reject(value: ReturnType<typeof harness>, outcome: Parameters<ReturnType<typeof createCanonicalRecovery>["completeMutation"]>[1]) {
  const ticket = value.recovery.beginMutation("request-1", ["B"]); if (!ticket) throw new Error("ticket");
  expect(value.recovery.canWrite()).toBe(false); expect(value.recovery.completeMutation(ticket, outcome)).toBe(true); return ticket;
}
describe("U2 latest-canonical recovery (SC-02~05/07)", () => {
  it.each([401, 412, 422, 500, "TIMEOUT", "NETWORK", "SUCCESS"] as const)("refetches %s and restores actual date/order without server mutation retry", async outcome => {
    const value = harness(driftFixture(outcome === 422 ? "date" : "order")); reject(value, outcome);
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED", changed: true });
    expect(value.fetchCanonical).toHaveBeenCalledTimes(1); expect(value.recovery.canWrite()).toBe(outcome !== 401);
    expect(value.actual().tasks.map(task => task.id)).toEqual(["A", "B", "C"]);
    expect(value.actual().tasks[1].start).toEqual(canonicalFixture().tasks[1].start);
    expect(value.exec.mock.calls.every(([action]) => !["scroll-chart", "resize-chart", "select-task"].includes(action))).toBe(true);
  });
  it.each(["temporary-add", "delete", "type", "link"] as const)("recovers refused %s including temporary objects and links", async kind => {
    const value = harness(driftFixture(kind)); reject(value, 422);
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED" });
  });
  it.each([500, "TIMEOUT", "NETWORK"] as const)("does not rollback %s when the mutation actually committed on the server", async outcome => {
    const value = harness(driftFixture("date")); value.setServer(driftFixture("date")); reject(value, outcome);
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED", changed: false }); expect(value.exec).not.toHaveBeenCalled();
  });
  it("uses server's latest revision after 412 without inventing one", async () => {
    const value = harness(driftFixture("date")); reject(value, 412);
    const canonical = { snapshot: canonicalFixture(), identity: { ...proofContextFixture().desired, revision: 29 } };
    value.fetchCanonical.mockResolvedValue(canonical);
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED", canonical: { identity: { revision: 29 } } });
  });
  it("leaves uncertainty and blocks conflicting writes after GET fails", async () => {
    const value = harness(driftFixture("date")); reject(value, 500); value.fetchCanonical.mockRejectedValue(new Error("GET_FAILED"));
    expect(await value.recovery.recover()).toEqual({ outcome: "FAILED", reason: "GET_FAILED" });
    expect(value.recovery.state().recovery.phase).toBe("UNCERTAIN"); expect(value.recovery.canWrite()).toBe(false);
    expect(value.recovery.beginMutation("conflict", ["B"])).toBeNull(); expect(value.exec).not.toHaveBeenCalled();
  });
  it("does not overwrite a pending edit or accept an old response", async () => {
    const value = harness(); const ticket = value.recovery.beginMutation("pending", ["B"])!;
    expect(await value.recovery.recover()).toMatchObject({ outcome: "BLOCKED" });
    value.replaceApi(); expect(value.recovery.completeMutation(ticket, 412)).toBe(false); expect(value.exec).not.toHaveBeenCalled();
  });
  it("supersedes delayed GET on API replacement", async () => {
    const value = harness(driftFixture("date")); reject(value, 412);
    value.fetchCanonical.mockImplementation(async () => { value.replaceApi(); return { snapshot: canonicalFixture(), identity: proofContextFixture().desired }; });
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SUPERSEDED" }); expect(value.exec).not.toHaveBeenCalled();
  });
  it("supersedes on newer pending mutation during awaited public apply", async () => {
    const value = harness(driftFixture("order")); reject(value, 412);
    value.onExec(() => { value.recovery.beginMutation("new-request", ["A"]); });
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SUPERSEDED" });
    expect(value.recovery.state().recovery).toMatchObject({ phase: "PENDING", requestId: "new-request" });
    expect(value.recovery.canWrite()).toBe(false);
  });
  it("refuses success when public exec resolves without changing actual Core", async () => {
    const value = harness(driftFixture("date")); reject(value, 422); value.exec.mockImplementation(async () => {});
    expect(await value.recovery.recover()).toMatchObject({ outcome: "TIMED_OUT", reason: "TIMED_OUT" }); expect(value.recovery.canWrite()).toBe(false);
  });
  it("bounds a never-resolving GET and cleans up its abort signal", async () => {
    const value = harness(); reject(value, 500); let signal: AbortSignal | undefined;
    value.fetchCanonical.mockImplementation(input => { signal = input; return new Promise(() => {}); });
    expect(await value.recovery.recover()).toMatchObject({ outcome: "TIMED_OUT" }); expect(signal?.aborted).toBe(true); expect(value.recovery.canWrite()).toBe(false);
  });
  it("reconciles only changed links", async () => {
    const canonical = canonicalFixture(); const extra = { id: "BC", source: "B", target: "C", type: "e2s" as const };
    const value = harness({ ...canonical, links: [...canonical.links, extra] }); reject(value, 422);
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED" }); expect(value.exec.mock.calls.map(([action]) => action)).toEqual(["delete-link"]);
  });
  it("keeps collapsed children and hidden milestones in the complete canonical snapshot", async () => {
    const canonical: CanonicalGanttSnapshot = { tasks: [{ id: "S", text: "Summary", type: "summary", parent: 0, open: false }, { id: "M", text: "Milestone", type: "milestone", parent: "S", start: new Date(2026, 9, 2) }], links: [] };
    const value = harness(canonical); value.setServer(canonical); reject(value, 422);
    // The fake Core does not derive summary dates; give it the runtime rollup.
    value.actual().tasks[0].start = new Date(2026, 9, 2);
    expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED" }); expect(value.actual().tasks.map(task => task.id)).toEqual(["S", "M"]); expect(value.actual().tasks[0].open).toBe(false);
  });
});

it("retains 401 permission lock until explicit server-confirmed authorization", async () => {
  const value = harness(driftFixture("date")); reject(value, 401);
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED" });
  expect(value.recovery.authorizationRequired()).toBe(true); expect(value.recovery.beginMutation("blocked", ["B"])).toBeNull();
  value.recovery.confirmAuthorization(); expect(value.recovery.canWrite()).toBe(true);
});
it.each([{ revision: 16 }, { query: "other" }, { scope: "other" }])("refuses stale/mismatched GET identity %j", async patch => {
  const value = harness(driftFixture("date")); reject(value, 412);
  value.fetchCanonical.mockResolvedValue({ snapshot: canonicalFixture(), identity: { ...proofContextFixture().desired, ...patch } });
  expect(await value.recovery.recover()).toMatchObject({ outcome: "FAILED", reason: "STALE_OR_INVALID_CANONICAL_IDENTITY" }); expect(value.exec).not.toHaveBeenCalled();
});
it("recovers new API after a superseded old GET without leaving RECONCILING", async () => {
  const value = harness(driftFixture("date")); reject(value, 412);
  value.fetchCanonical.mockImplementationOnce(async () => { value.replaceApi(); return { snapshot: canonicalFixture(), identity: proofContextFixture().desired }; });
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SUPERSEDED" });
  expect(value.recovery.state().recovery.phase).toBe("REQUIRED");
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED" });
});
it("clears rejected adapter-owned optional metadata rather than adopting dirty Core", async () => {
  const canonical = canonicalFixture(); const value = harness({ ...canonical, tasks: canonical.tasks.map(task => ({ ...task, externalId: "temporary", projectDisplayKey: "TMP" })) }); reject(value, 422);
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SETTLED" }); expect(value.actual().tasks.every(task => task.externalId === undefined && task.projectDisplayKey === undefined)).toBe(true);
});
it("stops public apply after abort and preserves the blocked state", async () => {
  const value = harness(driftFixture("order")); reject(value, 412); value.onExec(() => value.abort.abort());
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SUPERSEDED" }); expect(value.recovery.canWrite()).toBe(false);
});
it("does not let a stale response settle the newer mutation", () => {
  const value = harness(); const old = reject(value, 412); value.recovery.markDirty();
  expect(value.recovery.completeMutation(old, "SUCCESS")).toBe(false); expect(value.recovery.canWrite()).toBe(false);
});
it.each(["query", "key"])("supersedes a recovery when shared identity %s changes in-place during GET", async kind => {
  const value = harness(driftFixture("date"));
  const identity = { ...proofContextFixture().desired, keys: { ...proofContextFixture().desired.keys } };
  value.setIdentity(identity); reject(value, 412);
  value.fetchCanonical.mockImplementation(async () => {
    if (kind === "query") identity.query = "new-query";
    else identity.keys.data = "new-data";
    return { snapshot: canonicalFixture(), identity };
  });
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SUPERSEDED" }); expect(value.exec).not.toHaveBeenCalled(); expect(value.recovery.canWrite()).toBe(false);
});
it("returns immutable captured state independent of reused port identity objects", () => {
  const value = harness(); const identity = { ...proofContextFixture().desired, keys: { ...proofContextFixture().desired.keys } }; value.setIdentity(identity);
  const captured = value.recovery.state(); identity.query = "new-query"; identity.keys.data = "new-data";
  expect(captured.identity.query).toBe(""); expect(captured.identity.keys.data).toBe("synthetic-data"); expect(Object.isFrozen(captured.identity.keys)).toBe(true);
});

it("shares a deadline across GET, public apply and final verification", async () => {
  const value = harness(driftFixture("date")); reject(value, 412);
  value.fetchCanonical.mockImplementation(async () => { value.advanceTime(40); return { snapshot: canonicalFixture(), identity: proofContextFixture().desired }; });
  value.onExec(() => value.advanceTime(40));
  expect(await value.recovery.recover()).toMatchObject({ outcome: "TIMED_OUT" });
  expect(value.recovery.state().recovery.phase).toBe("UNCERTAIN"); expect(value.recovery.canWrite()).toBe(false);
});
it("gives supersession priority over simultaneous deadline overflow", async () => {
  const value = harness(driftFixture("date")); reject(value, 412);
  value.fetchCanonical.mockImplementation(async () => { value.advanceTime(80); value.replaceApi(); return { snapshot: canonicalFixture(), identity: proofContextFixture().desired }; });
  expect(await value.recovery.recover()).toMatchObject({ outcome: "SUPERSEDED" }); expect(value.exec).not.toHaveBeenCalled();
});
it("does not start public commands after GET exhausted the shared deadline", async () => {
  const value = harness(driftFixture("date")); reject(value, 412);
  value.fetchCanonical.mockImplementation(async () => { value.advanceTime(80); return { snapshot: canonicalFixture(), identity: proofContextFixture().desired }; });
  expect(await value.recovery.recover()).toMatchObject({ outcome: "TIMED_OUT" }); expect(value.exec).not.toHaveBeenCalled();
});

it("detaches the fetched canonical identity and payload before public apply awaits", async () => {
  const value = harness(driftFixture("date")); reject(value, 412);
  const fetched = { snapshot: canonicalFixture(), identity: { ...proofContextFixture().desired, keys: { ...proofContextFixture().desired.keys } } };
  value.fetchCanonical.mockResolvedValue(fetched);
  value.onExec(() => {
    fetched.identity.query = "mutated-response-query"; fetched.identity.keys.data = "mutated-response-key";
    fetched.snapshot.tasks[1].text = "mutated-response-task";
    fetched.snapshot.tasks[1].start?.setFullYear(2030);
  });
  const result = await value.recovery.recover(); expect(result.outcome).toBe("SETTLED");
  if (result.outcome !== "SETTLED") throw new Error("recovery");
  expect(result.canonical.identity.query).toBe(""); expect(result.proof.desired.query).toBe("");
  expect(result.canonical.snapshot.tasks[1].text).toBe("Synthetic B");
  expect(result.canonical.snapshot.tasks[1].start).toEqual(canonicalFixture().tasks[1].start);
  expect(value.actual().tasks[1].text).toBe("Synthetic B");
});

it("wall-time watchdog bounds a stalled GET and suspended frame without relying on RAF", async () => {
  const value = harness(canonicalFixture(), true); reject(value, 500);
  let fetchSignal: AbortSignal | undefined;
  value.fetchCanonical.mockImplementation(signal => { fetchSignal = signal; return new Promise(() => {}); });
  const result = await value.recovery.recover();
  expect(result).toMatchObject({ outcome: "TIMED_OUT" }); expect(fetchSignal?.aborted).toBe(true);
  expect(value.recovery.state().recovery.phase).toBe("UNCERTAIN"); expect(value.recovery.canWrite()).toBe(false);
});
it("external abort wakes a stalled GET/frame immediately", async () => {
  const value = harness(canonicalFixture(), true); reject(value, 500);
  value.fetchCanonical.mockImplementation(() => new Promise(() => {}));
  const pending = value.recovery.recover(); value.abort.abort();
  expect(await pending).toMatchObject({ outcome: "SUPERSEDED" }); expect(value.recovery.canWrite()).toBe(false);
});
it("a newer pending mutation wakes stalled recovery without waiting for its request/frame", async () => {
  const value = harness(canonicalFixture(), true); reject(value, 500);
  value.fetchCanonical.mockImplementation(() => new Promise(() => {}));
  const pending = value.recovery.recover(); const next = value.recovery.beginMutation("new-pending", ["A"]);
  expect(next).not.toBeNull(); expect(await pending).toMatchObject({ outcome: "SUPERSEDED" });
  expect(value.recovery.state().recovery.requestId).toBe("new-pending");
});
it("cleans up its single watchdog on success, timeout and external cancellation", async () => {
  vi.useFakeTimers();
  try {
    const success = harness(); reject(success, 412); expect(await success.recovery.recover()).toMatchObject({ outcome: "SETTLED" }); expect(vi.getTimerCount()).toBe(0);
    const timeout = harness(canonicalFixture(), true); reject(timeout, 500); timeout.fetchCanonical.mockImplementation(() => new Promise(() => {}));
    const pending = timeout.recovery.recover(); await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toMatchObject({ outcome: "TIMED_OUT" }); expect(vi.getTimerCount()).toBe(0);
    const cancelled = harness(canonicalFixture(), true); reject(cancelled, 500); cancelled.fetchCanonical.mockImplementation(() => new Promise(() => {}));
    const aborted = cancelled.recovery.recover(); cancelled.abort.abort(); expect(await aborted).toMatchObject({ outcome: "SUPERSEDED" }); expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
it("wall-time watchdog also bounds a stalled public exec", async () => {
  const value = harness(driftFixture("date"), true); reject(value, 422); value.exec.mockImplementation(() => new Promise(() => {}));
  expect(await value.recovery.recover()).toMatchObject({ outcome: "TIMED_OUT" }); expect(value.recovery.canWrite()).toBe(false);
});
it("wall-time watchdog bounds suspended post-apply verification frames", async () => {
  const value = harness(driftFixture("date"), true); reject(value, 422); value.exec.mockImplementation(async () => {});
  expect(await value.recovery.recover()).toMatchObject({ outcome: "TIMED_OUT" }); expect(value.recovery.canWrite()).toBe(false);
});
