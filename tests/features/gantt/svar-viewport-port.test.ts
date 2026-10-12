import { afterEach, describe, expect, it, vi } from "vitest";
import type { IApi } from "@svar-ui/react-gantt";
import { createSvarViewportPort } from "../../../src/features/gantt/viewport/svar-viewport-port";
import type { ViewportContext } from "../../../src/features/gantt/viewport/viewport-coordinator";
import { taskRevealTarget } from "../../../src/features/gantt/viewport/task-reveal-target";

const input = () => ({ type: "task", start: new Date("2026-10-10"), x: 240, y: 20, width: 40, height: 38,
  axisStart: new Date("2026-10-01"), axisEnd: new Date("2026-11-01"), viewportWidth: 100, viewportHeight: 200,
  current: { left: 120, top: 100 }, capacity: { left: 500, top: 500 } });

describe("SVAR observed Task reveal admission", () => {
  it.each(["2026-09-30", "2026-11-01", "2026-12-01"])("rejects out-of-axis %s even when Core clamps x into capacity", date => {
    expect(taskRevealTarget({ ...input(), start: new Date(date), x: 0 })).toBeNull();
  });
  it("accepts the inclusive rendered start using observed x and y", () => {
    expect(taskRevealTarget({ ...input(), start: new Date("2026-10-01"), x: 0 })).toEqual({ left: 0, top: 20 });
  });
  it.each([null, new Date(NaN)])("rejects missing or invalid canonical dates", start => {
    expect(taskRevealTarget({ ...input(), start })).toBeNull();
  });
  it("rejects unmeasured geometry and a target outside native capacity", () => {
    expect(taskRevealTarget({ ...input(), x: NaN })).toBeNull();
    expect(taskRevealTarget({ ...input(), capacity: { left: 200, top: 500 } })).toBeNull();
  });
  it("reveals an undated Summary row without using its artificial x or date", () => {
    expect(taskRevealTarget({ ...input(), type: "summary-container", start: null, x: 0 })).toEqual({ left: 120, top: 20 });
  });
});


describe("SVAR visibility admission", () => {
  afterEach(() => vi.unstubAllGlobals());
  function portFor(mode: string) {
    const horizontal = { clientWidth: mode === "zero" ? 0 : 100, clientHeight: 100, scrollWidth: mode === "commands" ? 125 : 200, scrollLeft: 0 };
    const vertical = { clientHeight: 100, scrollHeight: 200, scrollTop: 0 };
    const root = { isConnected: mode !== "detached", clientWidth: 100, clientHeight: 100,
      closest: () => ["hidden", "inert"].includes(mode) ? {} : null,
      getClientRects: () => [{ width: 100, height: 100 }], matches: () => false,
      querySelector: (selector: string) => selector === ".wx-chart" ? horizontal : selector === ".wx-gantt" ? vertical : null };
    vi.stubGlobal("window", { innerWidth: 1440, innerHeight: 900 });
    vi.stubGlobal("document", { visibilityState: mode === "document-hidden" ? "hidden" : "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("getComputedStyle", (element: unknown) => ({ display: mode === "display-none" ? "none" : "block", visibility: mode === "chart-hidden" && element === horizontal ? "hidden" : "visible" }));
    const commands: string[] = [];
    const interceptors: Array<(event: { left?: number; top?: number; eventSource?: string }) => boolean | void> = [];
    const state = { scrollLeft: 0, scrollTop: 0, _scales: { width: 100 }, _chartWidth: 100, _chartHeight: 100 };
    const api = { getState: () => state, intercept: vi.fn((_action: string, listener: (event: { left?: number; top?: number; eventSource?: string }) => boolean | void) => { interceptors.push(listener); }), detach: vi.fn(), exec: (action: string, position: { left?: number; top?: number }) => {
      commands.push(action);
      if (action === "resize-chart") horizontal.scrollWidth = 200;
      if (action === "scroll-chart") { state.scrollLeft = position.left ?? 0; state.scrollTop = position.top ?? 0; }
    } } as unknown as IApi;
    const port = createSvarViewportPort({ api, root: root as unknown as HTMLElement, frame: { dataset: {} } as unknown as HTMLElement,
      context: () => ({ visible: true, projectionEpoch: 7 } as ViewportContext), receipt: () => null, requestedEnd: () => new Date(), recordEnd: vi.fn() });
    if (mode === "disposed") port.dispose();
    return Object.assign(port, { commands, intercept: (event: { left?: number; top?: number; eventSource?: string }) => interceptors[0]?.(event) });
  }
  it("prepares resize geometry with a fresh receipt floor before issuing only coordinates at apply", async () => {
    const port = portFor("commands");
    const command = { kind: "PEER_RETURN" as const, position: { left: 50, top: 0 }, compatibility: true };
    expect(await port.prepare!(command, () => true)).toEqual({ ready: true, projectionAfter: 7 });
    expect(port.commands).toEqual(["resize-chart", "resize-chart"]);
    expect(await port.apply(command, () => true)).toEqual({ left: 50, top: 0 });
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart"]);
  });
  it("allows native scroll after filter return but blocks stale Core rewinds after peer return", async () => {
    const filter = portFor("ready"), position = { left: 20, top: 0 };
    expect(await filter.apply({ kind: "FILTER_RETURN", position }, () => true)).toEqual(position);
    expect(filter.intercept({ left: 30, top: 0 })).toBeUndefined();
    const peer = portFor("ready");
    expect(await peer.apply({ kind: "PEER_RETURN", position }, () => true)).toEqual(position);
    expect(peer.intercept({ left: 0, top: 0 })).toBe(false);
  });

  it("does not issue a coordinate command after preparation loses input authority", async () => {
    const port = portFor("commands");
    const command = { kind: "PEER_RETURN" as const, position: { left: 50, top: 0 }, compatibility: true };
    expect((await port.prepare!(command, () => true)).ready).toBe(true);
    expect(await port.apply(command, () => false)).toBeNull();
    expect(port.commands).toEqual(["resize-chart", "resize-chart"]);
  });
  it("does not resize or require another observation when actual capacity already admits the saved position", async () => {
    const port = portFor("ready");
    expect(await port.prepare!({ kind: "PEER_RETURN", position: { left: 50, top: 0 }, compatibility: true }, () => true)).toEqual({ ready: true });
    expect(port.commands).toEqual([]);
  });
  it.each(["resize", "fullscreen"])("includes physical %s in the lease even before React renders", mode => {
    const port = portFor("ready"), before = port.read().context.geometry;
    if (mode === "resize") window.innerWidth = 1024;
    else Object.assign(document, { fullscreenElement: {} });
    expect(port.read().context.geometry).not.toBe(before);
  });
  it("keeps visible zero geometry eligible for bounded measurement without permitting a write", () => {
    const sample = portFor("zero").read();
    expect(sample.context.visible).toBe(true);
    expect(sample.measurable).toBe(false);
  });
  it.each(["hidden", "inert", "detached", "document-hidden", "display-none", "chart-hidden", "disposed"])("marks %s unavailable instead of a resumable zero geometry", mode => {
    const sample = portFor(mode).read();
    expect(sample.context.visible).toBe(false);
    expect(sample.measurable).toBe(false);
  });
});
