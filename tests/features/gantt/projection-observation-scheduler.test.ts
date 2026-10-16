import { describe, expect, it, vi } from "vitest";
import { createProjectionObservationScheduler } from "../../../src/features/gantt/projection-observation-scheduler";

const held = () => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("projection observation data ordering", () => {
  it("holds real event requests while canonical reconciliation is pending and coalesces them", async () => {
    const data = held(), observe = vi.fn();
    const scheduler = createProjectionObservationScheduler({ queue: () => data.promise, current: () => true, observe });
    scheduler.request("projection"); scheduler.request("select-task"); scheduler.request("layout");
    await flush();
    expect(observe).not.toHaveBeenCalled();
    data.release(); await flush();
    expect(observe.mock.calls).toEqual([[["projection", "select-task", "layout"]]]);
  });
  it("follows a replaced canonical queue instead of observing its predecessor", async () => {
    const first = held(), latest = held(), observe = vi.fn();
    let queue = first.promise;
    const scheduler = createProjectionObservationScheduler({ queue: () => queue, current: () => true, observe });
    scheduler.request("select-task");
    queue = latest.promise; first.release(); await flush();
    expect(observe).not.toHaveBeenCalled();
    latest.release(); await flush();
    expect(observe).toHaveBeenCalledExactlyOnceWith(["select-task"]);
  });
  it.each(["dispose", "supersede"])("does not observe after %s", async kind => {
    const data = held(), observe = vi.fn(); let current = true;
    const scheduler = createProjectionObservationScheduler({ queue: () => data.promise, current: () => current, observe });
    scheduler.request("layout");
    if (kind === "dispose") scheduler.dispose(); else current = false;
    data.release(); await flush();
    expect(observe).not.toHaveBeenCalled();
  });
  it("never automatically repeats a completed observation", async () => {
    const observe = vi.fn(), queue = Promise.resolve();
    const scheduler = createProjectionObservationScheduler({ queue: () => queue, current: () => true, observe });
    scheduler.request("layout"); await flush(); await flush();
    expect(observe).toHaveBeenCalledTimes(1);
    scheduler.request("select-task"); await flush();
    expect(observe).toHaveBeenCalledTimes(2);
  });
  it("keeps a fresh request made by the observation callback", async () => {
    const queue = Promise.resolve(), calls: readonly string[][] = [];
    const observe = vi.fn((triggers: readonly string[]) => {
      (calls as string[][]).push([...triggers]);
      if (calls.length === 1) scheduler.request("layout");
    });
    const scheduler = createProjectionObservationScheduler({ queue: () => queue, current: () => true, observe });
    scheduler.request("select-task"); await flush(); await flush();
    expect(calls).toEqual([["select-task"], ["layout"]]);
  });
  it.each(["queue", "current", "observe", "rejection"])("fails closed once for %s errors without a retry loop", async kind => {
    const failed = vi.fn(), observe = vi.fn(() => { if (kind === "observe") throw new Error("probe"); });
    const queue = kind === "rejection" ? Promise.reject(new Error("probe")) : Promise.resolve();
    const scheduler = createProjectionObservationScheduler({
      queue: () => { if (kind === "queue") throw new Error("probe"); return queue; },
      current: () => { if (kind === "current") throw new Error("probe"); return true; },
      observe, failed,
    });
    scheduler.request("layout"); await flush(); await flush();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(kind === "observe" ? 1 : 0);
  });
  it("retires an old drain after a reader error before accepting a fresh explicit request", async () => {
    const old = held(), fresh = held(), observe = vi.fn(), failed = vi.fn();
    let queue = old.promise, broken = false;
    const scheduler = createProjectionObservationScheduler({ queue: () => queue,
      current: () => { if (broken) throw new Error("probe"); return true; }, observe, failed });
    scheduler.request("old"); broken = true; scheduler.request("fault");
    broken = false; queue = fresh.promise; scheduler.request("fresh");
    old.release(); await flush(); fresh.release(); await flush();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls).toEqual([[["fresh"]]]);
  });
});
