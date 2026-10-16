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
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  function portFor(mode: string) {
    const horizontal = { clientWidth: mode === "zero" ? 0 : 100, clientHeight: 100, scrollWidth: mode === "commands" ? 125 : 200, scrollLeft: 0, getBoundingClientRect: () => ({ x: 100, y: 0 }) };
    const vertical = { clientHeight: 100, scrollHeight: 200, scrollTop: 0 };
    const root = { isConnected: mode !== "detached", clientWidth: 100, clientHeight: 100,
      closest: () => ["hidden", "inert"].includes(mode) ? {} : null,
      getClientRects: () => [{ width: 100, height: 100 }], getBoundingClientRect: () => ({ x: 0, y: 0 }), matches: () => false,
      querySelector: (selector: string) => selector === ".wx-chart" ? horizontal : selector === ".wx-gantt" ? vertical : null };
    vi.stubGlobal("window", { innerWidth: 1440, innerHeight: 900 });
    vi.stubGlobal("document", { visibilityState: mode === "document-hidden" ? "hidden" : "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("getComputedStyle", (element: unknown) => ({ display: mode === "display-none" ? "none" : "block", visibility: mode === "chart-hidden" && element === horizontal ? "hidden" : "visible" }));
    let requestedEnd = new Date(mode === "commands" ? "2026-12-01" : "2026-11-01");
    let dataReady = true;
    const nativeForwardInput = vi.fn();
    const axisSettled = vi.fn();
    const commands: string[] = [];
    const interceptors: Array<(event: { left?: number; top?: number; eventSource?: string }) => boolean | void> = [];
    const state = { scrollLeft: 0, scrollTop: 0, _scales: { width: horizontal.scrollWidth }, _chartWidth: 100, _chartHeight: 100, _start: new Date("2026-10-01"), _end: new Date("2026-11-01") };
    const api = { getState: () => state, intercept: vi.fn((_action: string, listener: (event: { left?: number; top?: number; eventSource?: string }) => boolean | void) => { interceptors.push(listener); }), detach: vi.fn(), exec: (action: string, position: { left?: number; top?: number }) => {
      commands.push(action);
      if (action === "resize-chart") { horizontal.scrollWidth = 200; state._scales.width = 200; state._end = new Date(Math.max(requestedEnd.getTime(), new Date("2026-12-01").getTime())); }
      if (action === "scroll-chart") { state.scrollLeft = Math.min(position.left ?? 0, Math.max(0, state._scales.width - state._chartWidth)); state.scrollTop = position.top ?? 0; }
    } } as unknown as IApi;
    const port = createSvarViewportPort({ api, root: root as unknown as HTMLElement, frame: { dataset: {} } as unknown as HTMLElement,
      context: () => ({ visible: true, projectionEpoch: 7, apiInstance: "api-test", scale: "day" } as ViewportContext), receipt: () => null, requestedEnd: () => requestedEnd, recordEnd: vi.fn(),
      canChangeAxis: () => dataReady,
      nativeForwardInput, axisSettled,
      lease: () => ({ stamp: { context: "test", contextEpoch: 0, gesture: 0, intent: 0 }, priority: 1 }) });
    if (mode === "disposed") port.dispose();
    return Object.assign(port, { commands, nativeForwardInput, axisSettled, setCoreGeometry: (width: number, chartWidth: number) => { state._scales.width = width; state._chartWidth = chartWidth; }, setAxisEnd: (end: Date) => { state._end = end; requestedEnd = end; }, setNativeClientWidth: (width: number) => { horizontal.clientWidth = width; }, setNativeWidth: (width: number) => { horizontal.scrollWidth = width; }, setCoreLeft: (left: number) => { state.scrollLeft = left; }, setNativeLeft: (left: number) => { horizontal.scrollLeft = left; }, setDataReady: (value: boolean) => { dataReady = value; }, setRequestedEnd: (value: Date) => { requestedEnd = value; }, intercept: (event: { left?: number; top?: number; eventSource?: string }) => interceptors[0]?.(event) });
  }
  it("checks actual Core and native capacity independently before executing a position", () => {
    const port = portFor("ready"), target = { left: 120, top: 0 };
    port.setCoreGeometry(240, 100); port.setNativeWidth(240);
    expect(port.admitPosition?.(target)).toBe(true);
    port.setCoreGeometry(219, 100);
    expect(port.admitPosition?.(target)).toBe(false);
    port.setCoreGeometry(240, 100); port.setNativeWidth(219);
    expect(port.admitPosition?.(target)).toBe(false);
    port.dispose();
  });
  it("prepares observed compatibility transaction geometry with a fresh receipt floor before issuing only coordinates at apply", async () => {
    const port = portFor("commands");
    const command = { kind: "PEER_RETURN" as const, position: { left: 50, top: 0 }, compatibility: true };
    expect(await port.prepare!(command, () => true)).toEqual({ ready: true, projectionAfter: 7 });
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart"]);
    expect(port.axisSettled).toHaveBeenCalledExactlyOnceWith();
    expect(await port.apply(command, () => true)).toEqual({ left: 50, top: 0 });
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart", "scroll-chart"]);
  });
  it("requests read-only reobservation only for a settled actual axis change, not position-only writes", async () => {
    const port = portFor("ready");
    port.setRequestedEnd(new Date("2026-12-01"));
    expect(await port.apply({ kind: "RANGE_EXTENSION", width: 600 }, () => true)).toEqual({ left: 0, top: 0 });
    expect(port.axisSettled).toHaveBeenCalledExactlyOnceWith();
    expect(await port.apply({ kind: "RANGE_EXTENSION", width: 600 }, () => true)).toEqual({ left: 0, top: 0 });
    expect(port.axisSettled).toHaveBeenCalledTimes(1);
    expect(await port.prepare!({ kind: "PEER_RETURN", position: { left: 50, top: 0 }, compatibility: true }, () => true)).toEqual({ ready: true });
    expect(port.axisSettled).toHaveBeenCalledTimes(1);
    port.dispose();
  });
  it("waits under the original preparation lease for canonical data readiness before extending", async () => {
    const port = portFor("commands");
    port.setDataReady(false);
    const pending = port.prepare!({ kind: "PEER_RETURN", position: { left: 50, top: 0 }, compatibility: true }, () => true,
      { context: "original", contextEpoch: 1, gesture: 1, intent: 1 });
    expect(port.commands).toEqual([]);
    port.setDataReady(true);
    expect(await pending).toMatchObject({ ready: true });
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart"]);
    port.dispose();
  });
  it("does not revive preparation after a new gesture while canonical data is pending", async () => {
    const port = portFor("commands"); let current = true;
    port.setDataReady(false);
    const pending = port.prepare!({ kind: "PEER_RETURN", position: { left: 50, top: 0 }, compatibility: true }, () => current);
    current = false; port.setDataReady(true);
    expect(await pending).toEqual({ ready: false });
    expect(port.commands).toEqual([]);
    port.dispose();
  });
  it("registers live native forward supersession once while excluding tagged, API-only and backward events", async () => {
    const port = portFor("ready");
    const pending = port.apply({ kind: "RANGE_EXTENSION", width: 600 }, () => true);
    port.intercept({ left: 80 }); // API command without actual native movement.
    port.repair({ left: 20, top: 0 });
    port.intercept({ left: 20, eventSource: "project-viewport-coordinator-port" });
    port.intercept({ left: 0 }); // A stale/backward event cannot claim the newer offset.
    expect(port.nativeForwardInput).not.toHaveBeenCalled();
    port.setCoreLeft(20);
    port.intercept({ left: 20 }); // Late callback already aligned with Core/native.
    expect(port.nativeForwardInput).not.toHaveBeenCalled();
    port.setCoreLeft(0);
    port.intercept({ left: 20 });
    port.intercept({ left: 20 });
    expect(port.nativeForwardInput).toHaveBeenCalledExactlyOnceWith(20);
    port.repair({ left: 0, top: 0 });
    await pending;
    port.dispose();
  });
  it.each([50, 80, 81])("rejects resize clamp/equal/tolerance native offset %s as forward input", async nativeLeft => {
    const port = portFor("ready");
    port.setCoreLeft(20); port.setNativeLeft(80);
    const pending = port.apply({ kind: "RANGE_EXTENSION", width: 600 }, () => true);
    port.setNativeLeft(nativeLeft); port.intercept({ left: nativeLeft });
    expect(port.nativeForwardInput).not.toHaveBeenCalled();
    port.setNativeLeft(20); await pending;
    port.dispose();
  });
  it("accepts fresh native forward input beyond both divergent registered offsets", async () => {
    const port = portFor("ready");
    port.setCoreLeft(20); port.setNativeLeft(80);
    const pending = port.apply({ kind: "RANGE_EXTENSION", width: 600 }, () => true);
    port.intercept({ left: 100 });
    expect(port.nativeForwardInput).not.toHaveBeenCalled();
    port.setNativeLeft(100); port.intercept({ left: 100 }); port.intercept({ left: 100 });
    expect(port.nativeForwardInput).toHaveBeenCalledExactlyOnceWith(100);
    port.setNativeLeft(20); await pending;
    port.dispose();
  });

  it("rejects a late native callback from an already revoked axis lease", async () => {
    const port = portFor("ready"); let current = true;
    const pending = port.apply({ kind: "RANGE_EXTENSION", width: 600 }, () => current);
    current = false;
    port.repair({ left: 20, top: 0 });
    port.intercept({ left: 20 });
    expect(port.nativeForwardInput).not.toHaveBeenCalled();
    expect(await pending).toBeNull();
    expect(port.axisSettled).not.toHaveBeenCalled();
    port.dispose();
  });
  it("bounds extension per registered command without exhausting later independent user commands", async () => {
    const port = portFor("ready");
    for (let index = 0; index < 4; index++) {
      port.setRequestedEnd(new Date(2026, 11 + index, 1));
      expect(await port.apply({ kind: "RANGE_EXTENSION", width: 600 + index * 600 }, () => true,
        { context: "test", contextEpoch: 0, gesture: index + 1, intent: index + 1 })).toEqual({ left: 0, top: 0 });
      expect(port.resizing()).toBe(false);
    }
    expect(port.commands.filter(action => action === "resize-chart")).toHaveLength(8);
    expect(port.commands.filter(action => action === "scroll-chart")).toHaveLength(4);
    port.dispose();
  });
  it("allows native scroll after filter return but blocks stale Core rewinds after peer return", async () => {
    const filter = portFor("ready"), position = { left: 20, top: 0 };
    expect(await filter.apply({ kind: "FILTER_RETURN", position }, () => true)).toEqual(position);
    expect(filter.intercept({ left: 30, top: 0 })).toBeUndefined();
    const peer = portFor("ready");
    expect(await peer.apply({ kind: "PEER_RETURN", position }, () => true)).toEqual(position);
    expect(peer.intercept({ left: 0, top: 0 })).toBe(false);
  });

  it("gives each dev diagnostic scroll a fresh bounded native repair budget", async () => {
    const port = portFor("ready"), target = { left: 20, top: 0 };
    await port.apply({ kind: "PEER_RETURN", position: target }, () => true);
    for (let count = 0; count < 3; count++) expect(port.repair(target)).toBe(true);
    expect(port.repair(target)).toBe(false);
    await port.apply({ kind: "DIAGNOSTIC_SCROLL", left: target.left }, () => true);
    for (let count = 0; count < 3; count++) expect(port.repair(target, true)).toBe(true);
    expect(port.repair(target, true)).toBe(false);
    await port.apply({ kind: "DIAGNOSTIC_SCROLL", left: 40 }, () => true);
    expect(port.repair({ left: 40, top: 0 }, true)).toBe(true);
    expect(port.repair(target)).toBe(false);
    port.dispose();
  });

  it("rejects diagnostic apply and repair in production while preserving ordinary repair", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const port = portFor("ready"), target = { left: 20, top: 0 };
    expect(await port.apply({ kind: "DIAGNOSTIC_SCROLL", left: target.left }, () => true)).toBeNull();
    expect(port.repair(target, true)).toBe(false);
    expect(port.commands).toEqual([]);
    expect(port.read().native).toEqual({ left: 0, top: 0 });
    expect(port.repair(target)).toBe(true);
    expect(port.read().native).toEqual(target);
    port.dispose();
  });

  it("does not issue a coordinate command after preparation loses input authority", async () => {
    const port = portFor("commands");
    const command = { kind: "PEER_RETURN" as const, position: { left: 50, top: 0 }, compatibility: true };
    expect((await port.prepare!(command, () => true)).ready).toBe(true);
    expect(await port.apply(command, () => false)).toBeNull();
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart"]);
  });
  it("does not resize or require another observation when actual capacity already admits the saved position", async () => {
    const port = portFor("ready");
    expect(await port.prepare!({ kind: "PEER_RETURN", position: { left: 50, top: 0 }, compatibility: true }, () => true)).toEqual({ ready: true });
    expect(port.commands).toEqual([]);
  });
  it("restores retained extent even when the shortened native and Core capacities admit the position", async () => {
    const port = portFor("ready");
    port.setRequestedEnd(new Date("2026-12-01"));
    expect(await port.prepare!({ kind: "PEER_RETURN", position: { left: 31, top: 0 }, compatibility: true }, () => true)).toEqual({ ready: true, projectionAfter: 7 });
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart"]);
    port.dispose();
  });
  it("extends divergent DOM capacity31/Core capacity30 before restoring exact Core31", async () => {
    const port = portFor("ready");
    port.setAxisEnd(new Date("2026-10-03")); port.setNativeClientWidth(77); port.setNativeWidth(108); port.setCoreGeometry(108, 78);
    const command = { kind: "PEER_RETURN" as const, position: { left: 31, top: 0 }, compatibility: true };
    expect(port.read().capacity.left).toBe(31);
    expect(await port.apply(command, () => true)).toBeNull();
    expect(port.commands).toEqual([]);
    expect(await port.prepare!(command, () => true)).toEqual({ ready: true, projectionAfter: 7 });
    expect(port.commands).toEqual(["resize-chart", "resize-chart", "scroll-chart"]);
    expect(await port.apply(command, () => true)).toEqual(command.position);
    port.dispose();
  });
  it("rejects insufficient Core capacity without compatibility instead of accepting the native tolerance", async () => {
    const port = portFor("ready"); port.setAxisEnd(new Date("2026-10-03")); port.setNativeClientWidth(77); port.setNativeWidth(108); port.setCoreGeometry(108, 78);
    expect(await port.prepare!({ kind: "PEER_RETURN", position: { left: 31, top: 0 } }, () => true)).toEqual({ ready: false });
    expect(port.commands).toEqual([]); port.dispose();
  });
  it.each([[NaN, 100], [Infinity, 100], [-1, 100], [200, NaN], [200, 0], [200, Infinity]])("rejects invalid public Core geometry %s/%s before any write", async (width, chartWidth) => {
    const port = portFor("ready"); port.setCoreGeometry(width, chartWidth);
    const command = { kind: "PEER_RETURN" as const, position: { left: 0, top: 0 }, compatibility: true };
    expect(await port.prepare!(command, () => true)).toEqual({ ready: false });
    expect(await port.apply(command, () => true)).toBeNull();
    expect(port.commands).toEqual([]); port.dispose();
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
