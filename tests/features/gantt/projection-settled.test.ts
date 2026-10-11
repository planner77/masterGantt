import type { IApi, ITask } from "@svar-ui/react-gantt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProjection } from "../../../src/features/gantt/canonical-projection";
import { observeProjectionSettled, deliverProjectionReceipt } from "../../../src/features/gantt/projection-settled";
const projection = buildProjection({ revision: 9, tasks: [], links: [], displayTasks: [] }, { scope: null, filter: null, displayMode: "compatibility", columnPrefs: [], scale: "day" });
const context = { apiInstance: "core-1", generation: 4, reasons: ["data"], scale: "day", scope: null, filterKey: "all", taskSelectionChanged: false, queryConditionsChanged: false, expectedColumns: [] };
function fixture() {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => setTimeout(callback, 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible" }));
  vi.stubGlobal("document", { visibilityState: "visible" });
  const chart = { clientWidth: 500, clientHeight: 300, scrollLeft: 0, scrollWidth: 800, getBoundingClientRect: () => ({ top: 0, bottom: 300 }) };
  const root = { isConnected: true, closest: () => null, getBoundingClientRect: () => ({ width: 500, height: 300 }), querySelector: (selector: string) => selector === ".wx-chart" ? chart : selector === ".wx-gantt" ? { scrollTop: 0 } : null, querySelectorAll: () => [] } as unknown as HTMLElement;
  const state = { _tasks: [], columns: [], selected: [], scales: [{ unit: "day" }], scrollLeft: 0, scrollTop: 0, gridWidth: 0 };
  const api = { getState: () => state, serialize: () => [] } as unknown as IApi;
  return { api, root, state, chart };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("projection receipt observation", () => {
  it("requires actual measurable Core/DOM stability over three frames", async () => {
    const { api, root } = fixture();
    const observation = observeProjectionSettled(api, root, projection, context, () => true);
    await vi.advanceTimersByTimeAsync(80);
    expect((await observation.promise).outcome).toBe("SETTLED");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not approve zero-size native Chart", async () => {
    const { api, root, chart } = fixture(); chart.clientWidth = 0;
    const observation = observeProjectionSettled(api, root, projection, context, () => true);
    await vi.advanceTimersByTimeAsync(16);
    expect((await observation.promise).outcome).toBe("NOT_MEASURABLE");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("times out wrong actual scale instead of accepting exec or matching IDs", async () => {
    const { api, root, state } = fixture(); state.scales[0].unit = "week";
    const observation = observeProjectionSettled(api, root, projection, context, () => true, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect((await observation.promise).outcome).toBe("TIMED_OUT");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("supersedes stale revisions and cancels all observation work on disposal", async () => {
    const { api, root } = fixture();
    const stale = observeProjectionSettled(api, root, projection, context, () => false);
    await vi.advanceTimersByTimeAsync(16);
    expect((await stale.promise).outcome).toBe("SUPERSEDED");
    const disposed = observeProjectionSettled(api, root, projection, context, () => true);
    disposed.cancel(); expect((await disposed.promise).outcome).toBe("SUPERSEDED");
    expect(vi.getTimerCount()).toBe(0);
  });
});


describe("nonempty hostile projection observations", () => {
  for (const fault of ["missing-row", "missing-bar", "stale-grid-label", "stale-chart-label", "wrong-task", "wrong-link", "duplicate-order", "wrong-column"] as const) {
    it(`rejects ${fault} without accepting matching IDs alone`, async () => {
      const base = fixture();
      const task: ITask = { id: "task-1", parent: 0, text: "Short", type: "task", projectDisplayKey: "latest", $x: 0, $y: 10, $w: 60, $h: 20 };
      const nonempty = buildProjection({ revision: 9, tasks: [task], links: [], displayTasks: [] }, { scope: null, filter: null, displayMode: "compatibility", columnPrefs: [], scale: "day" });
      const row = { dataset: { id: ":task-1" }, getClientRects: () => [{}], textContent: "Short", getBoundingClientRect: () => ({ y: 10, height: 20 }),
        querySelector: () => ({ textContent: fault === "stale-grid-label" ? "Short extended" : "Short" }) };
      const bar = { dataset: { taskId: ":task-1" }, getBoundingClientRect: () => ({ y: 10, height: 20 }),
        querySelector: () => ({ textContent: fault === "stale-chart-label" ? "Short extended" : "Short" }) };
      const grid = { clientWidth: 500, getClientRects: () => [{}] };
      const root = { ...base.root, isConnected: true, closest: () => null, getBoundingClientRect: () => ({ width: 500, height: 300 }),
        querySelector: (selector: string) => selector === ".wx-chart" ? base.chart : selector === ".wx-gantt" ? { scrollTop: 0 } : grid,
        querySelectorAll: (selector: string) => selector.includes(".wx-row") ? (fault === "missing-row" ? [] : [row]) : (fault === "missing-bar" ? [] : [bar]) } as unknown as HTMLElement;
      const state = { ...base.state, _tasks: fault === "duplicate-order" ? [task, task] : [task], columns: [{ id: "text", hidden: fault === "wrong-column" }], _chartHeight: 300 };
      const api = { getState: () => state, serialize: ({ data }: { data: string }) => data === "tasks" ? [{ ...task, text: fault === "wrong-task" ? "Old" : "Short" }] : fault === "wrong-link" ? [{ id: "unexpected", source: "task-1", target: "task-1", type: "e2s" }] : [] } as unknown as IApi;
      const observation = observeProjectionSettled(api, root, nonempty, { ...context, expectedColumns: [{ id: "text", hidden: false }] }, () => true, 100);
      await vi.advanceTimersByTimeAsync(100);
      expect((await observation.promise).outcome).toBe("TIMED_OUT");
      expect(vi.getTimerCount()).toBe(0);
    });
  }
  it("refuses inert native roots before inspecting their IDs", async () => {
    const { api, root } = fixture();
    root.closest = () => root;
    const observation = observeProjectionSettled(api, root, projection, context, () => true);
    await vi.advanceTimersByTimeAsync(16);
    expect((await observation.promise).outcome).toBe("NOT_MEASURABLE");
  });
});


it("does not publish an observation resolved before a newer generation became current", async () => {
  const { api, root } = fixture();
  const observation = observeProjectionSettled(api, root, projection, context, () => true);
  await vi.advanceTimersByTimeAsync(80);
  const resolved = await observation.promise;
  expect(resolved.outcome).toBe("SETTLED");
  const publish = vi.fn();
  let current = true;
  const delivery = Promise.resolve(resolved).then(receipt => deliverProjectionReceipt(receipt, () => current, publish));
  current = false;
  expect(await delivery).toBe(false);
  expect(publish).not.toHaveBeenCalled();
});
