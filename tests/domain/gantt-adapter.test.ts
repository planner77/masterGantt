import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IApi } from "@svar-ui/react-gantt";
import { calendarDate, calendarDateToContentPx, calendarSerial, calendarYearBounds, createGanttAdapter } from "../../src/features/gantt/adapter/gantt-adapter";
import type { TraceContext } from "../../src/features/gantt/diagnostics/core-action-trace";

function fixture({ version = "2.7.3", compatibility = true, unit = "day" as "day" | "week", hidden = false } = {}) {
  const rect = { x: 200, y: 100, width: 400, height: 300 };
  const chart = { scrollLeft: 0, scrollTop: 0, scrollWidth: 2000, clientWidth: 400, clientHeight: 300, getBoundingClientRect: () => rect };
  const vertical = { scrollTop: 0, scrollHeight: 1600, clientHeight: 300 };
  const scaleHeader = { height: 0 };
  const tick = { width: unit === "day" ? 36 : 68 };
  const listeners = new Map<string, EventListener>();
  const root = { isConnected: true, parentElement: null, closest: () => hidden ? {} : null,
    getBoundingClientRect: () => ({ x: 0, y: 100, width: 600, height: 300 }),
    querySelector: (selector: string) => selector === ".wx-chart" ? chart : selector === ".wx-gantt" ? vertical : selector === ".wx-scale" ? { getBoundingClientRect: () => scaleHeader } : selector === ".wx-scale .wx-cell" ? { getBoundingClientRect: () => tick } : null,
    addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener), removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as HTMLElement;
  const state = { scrollLeft: 0, scrollTop: 0, _start: new Date(2026, 0, 5), _end: new Date(2026, 2, 1), _scales: { width: 2000 }, _chartWidth: 400, _chartHeight: 300,
    _scrollSize: 0, cellWidth: unit === "day" ? 36 : 68, selected: ["synthetic-1"], scales: [{ unit, step: 1 }] };
  const exec = vi.fn((action: string, params: { left?: number; top?: number }) => {
    if (action === "scroll-chart") { state.scrollLeft = chart.scrollLeft = params.left!; state.scrollTop = vertical.scrollTop = params.top!; }
    return Promise.resolve();
  });
  const api = { getState: () => state, exec, intercept: vi.fn(), on: vi.fn(), detach: vi.fn() } as unknown as IApi;
  const context: TraceContext = { run: "unit", head: "synthetic", scenario: "adapter", layer: "CORE_PUBLIC_API", apiInstance: 1, projectRevision: null,
    canonicalEpoch: 0, projectionEpoch: 0, scope: "synthetic", filterKey: "all", scale: unit, intentId: 0, intentSource: "unit" };
  const onFeedback = vi.fn();
  const adapter = createGanttAdapter({ api, root, installedVersion: version, compatibilityResize: compatibility, context: () => context,
    axis: { origin: () => new Date(2026, 0, 5), unit: () => unit, cellWidth: () => state.cellWidth }, onFeedback });
  return { adapter, state, tick, scaleHeader, chart, vertical, root, exec, onFeedback, listeners };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("document", { activeElement: { tagName: "BODY" } });
  vi.stubGlobal("getComputedStyle", () => ({ display: "block", visibility: "visible" }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Gantt adapter 안전 경계", () => {
  it("외곽 Chart가 있어도 scale을 제외한 plot높이0이면 명령을 거부한다", async () => {
    const f = fixture(); f.scaleHeader.height = 300;
    expect(await f.adapter.scroll({ left: 0, top: 0 })).toBe("NO_SCROLL_CAPACITY"); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
  it("짧은 축의 native tick stretch를 날짜 좌표 성공으로 오인하지 않는다", async () => {
    const f = fixture({ unit: "week" }); f.tick.width = 72;
    expect(f.adapter.dateToViewportPx(new Date(2026, 0, 12))).toEqual({ ok: false, result: "UNMEASURABLE" });
    expect(f.adapter.viewportPxToDate(68)).toEqual({ ok: false, result: "UNMEASURABLE" });
    expect(await f.adapter.revealDate(new Date(2026, 0, 12))).toBe("UNMEASURABLE"); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
  it("다중 scale/단위/step 불일치 시 좌표변환과 reveal을 거부한다", async () => {
    const f = fixture();
    for (const scales of [[], [{ unit: "day" as const, step: 1 }, { unit: "week" as const, step: 1 }],
      [{ unit: "week" as const, step: 1 }], [{ unit: "day" as const, step: 2 }]]) {
      f.state.scales = scales;
      expect(f.adapter.dateToViewportPx(new Date(2026, 0, 12))).toEqual({ ok: false, result: "UNMEASURABLE" });
      expect(f.adapter.viewportPxToDate(252)).toEqual({ ok: false, result: "UNMEASURABLE" });
      expect(await f.adapter.revealDate(new Date(2026, 0, 12))).toBe("UNMEASURABLE");
    }
    expect(f.exec).not.toHaveBeenCalled();
    f.state.scales = [{ unit: "day", step: 1 }];
    expect(f.adapter.dateToViewportPx(new Date(2026, 0, 12)).ok).toBe(true);
    f.adapter.dispose();
  });
  it("hidden/inert/분리된 DOM에서는 명령을 보내지 않는다", async () => {
    const f = fixture({ hidden: true }); expect(f.adapter.readGeometry()).toEqual({ ok: false, result: "UNMEASURABLE" });
    expect(await f.adapter.scroll({ left: 120, top: 96 })).toBe("UNMEASURABLE"); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
  it("Chart 폭0과 실제 capacity 초과를 구분하고 feedback은 한번만 낸다", async () => {
    const f = fixture(); f.chart.clientWidth = 0;
    expect(await f.adapter.settle()).toBe("NO_SCROLL_CAPACITY"); expect(await f.adapter.scroll({ left: 120, top: 96 })).toBe("NO_SCROLL_CAPACITY");
    expect(f.onFeedback).toHaveBeenCalledTimes(1); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
  it("공개 Core 좌표 exact와 native ±1px를 3 frame 관측한다", async () => {
    const f = fixture(), pending = f.adapter.scroll({ left: 120, top: 96 });
    await vi.advanceTimersByTimeAsync(32); expect(f.adapter.trace().entries.some(entry => entry.result === "NATIVE_LAYOUT_SETTLED")).toBe(false);
    await vi.advanceTimersByTimeAsync(16); expect(await pending).toBe("NATIVE_LAYOUT_SETTLED");
    expect(f.adapter.readCore()).toMatchObject({ left: 120, top: 96 }); f.adapter.dispose();
  });
  it("thenable rejection을 기존 stable DOM 성공으로 바꾸지 않는다", async () => {
    const f = fixture(); f.exec.mockImplementation(() => Promise.reject(new Error("synthetic rejection")));
    expect(await f.adapter.scroll({ left: 0, top: 0 })).toBe("COMMAND_REJECTED"); expect(vi.getTimerCount()).toBe(0); f.adapter.dispose();
  });
  it("settle과 receipt가 finite timeout을 갖는다", async () => {
    const f = fixture(); f.exec.mockImplementation(() => new Promise(() => {}));
    const pending = f.adapter.scroll({ left: 120, top: 96 }); await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBe("TIMED_OUT"); expect(vi.getTimerCount()).toBe(0); f.adapter.dispose();
  });
  it("대기 중 dispose는 receipt timer를 취소하고 후속 resize를 보내지 않는다", async () => {
    const f = fixture(); let resolve!: () => void; f.exec.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const pending = f.adapter.resizeCompatibility(2500); expect(f.exec).toHaveBeenCalledTimes(1); f.adapter.dispose(); resolve();
    expect(await pending).toBe("DISPOSED"); expect(f.exec).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0); expect(f.listeners.size).toBe(0); expect(f.onFeedback).not.toHaveBeenCalled();
  });
  it("새 사용자 intent가 receipt 대기를 취소하며 후속 복원을 보내지 않는다", async () => {
    const f = fixture(); let resolve!: () => void; f.exec.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const pending = f.adapter.resizeCompatibility(2500); f.adapter.supersede("native-wheel"); resolve();
    expect(await pending).toBe("SUPERSEDED_BY_INTENT"); expect(f.exec).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    expect(await f.adapter.scroll({ left: 20, top: 0 })).toBe("EXTENSION_UNSUPPORTED"); expect(f.exec).toHaveBeenCalledTimes(1); f.adapter.dispose();
  });
  it("겹친 요청을 BUSY로 거부한다", async () => {
    const f = fixture(); f.exec.mockImplementation(() => new Promise(() => {})); const pending = f.adapter.scroll({ left: 10, top: 0 });
    expect(await f.adapter.scroll({ left: 20, top: 0 })).toBe("BUSY"); f.adapter.dispose(); expect(await pending).toBe("DISPOSED");
  });
  it("C 호환 예외는 명시 opt-in과 exact 2.7.3에 한정한다", async () => {
    for (const options of [{ version: "2.8.0" }, { compatibility: false }]) {
      const f = fixture(options); expect(await f.adapter.resizeCompatibility(2500)).toBe("UNSUPPORTED_VERSION"); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
    }
  });
  it("Week 10 calendar year / 1,000,000px / NaN 상한을 명령 전에 검사한다", async () => {
    const f = fixture({ unit: "week" });
    expect(await f.adapter.resizeCompatibility(100000)).toBe("BOUND_EXCEEDED");
    expect(await f.adapter.resizeCompatibility(1000001)).toBe("BOUND_EXCEEDED"); expect(await f.adapter.resizeCompatibility(NaN)).toBe("BOUND_EXCEEDED");
    expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
  it("C no-op은 layout settle이어도 확장 지원 성공이 아니다", async () => {
    const f = fixture(), pending = f.adapter.resizeCompatibility(2500); await vi.advanceTimersByTimeAsync(64);
    expect(await pending).toBe("EXTENSION_UNSUPPORTED"); expect(await f.adapter.resizeCompatibility(2500)).toBe("BOUND_EXCEEDED"); f.adapter.dispose();
  });
  it("snapshot 배열을 복사하고 공개 설정으로 date↔px를 왕복한다", () => {
    const f = fixture(), core = f.adapter.readCore(); f.state.selected.push("synthetic-2"); expect(core.selected).toEqual(["synthetic-1"]);
    const date = new Date(2026, 0, 12); expect(f.adapter.dateToViewportPx(date)).toEqual({ ok: true, value: { contentX: 252, viewportX: 252 } });
    expect(f.adapter.viewportPxToDate(252)).toEqual({ ok: true, value: date.getTime() }); f.adapter.dispose();
  });
  it("관측 원점이 바뀌면 forward/inverse/reveal 모두 거부한다", async () => {
    const f = fixture(); f.state._start = new Date(2026, 0, 6);
    expect(f.adapter.dateToViewportPx(new Date(2026, 0, 12))).toEqual({ ok: false, result: "UNMEASURABLE" });
    expect(f.adapter.viewportPxToDate(252)).toEqual({ ok: false, result: "UNMEASURABLE" });
    expect(await f.adapter.revealDate(new Date(2026, 0, 12))).toBe("UNMEASURABLE"); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
  it("축 밖 날짜 reveal은 마지막 viewport로 조용히 clamp하지 않는다", async () => {
    const f = fixture(); expect(await f.adapter.revealDate(new Date(2027, 0, 5))).toBe("NO_SCROLL_CAPACITY");
    expect(await f.adapter.revealDate(new Date(2025, 11, 5))).toBe("NO_SCROLL_CAPACITY"); expect(f.exec).not.toHaveBeenCalled(); f.adapter.dispose();
  });
});
describe("calendar axis 윤일/DST 경계", () => {
  it("윤일을 포함한 두 달은 calendar 일수로 계산한다", () => {
    expect(calendarDateToContentPx(new Date(2024, 2, 1), new Date(2024, 1, 28), "day", 36)).toBe(72);
    expect(calendarDate(calendarSerial(new Date(2024, 1, 29))).getTime()).toBe(new Date(2024, 1, 29).getTime());
  });
  it("10년 경계의 윤일 rollover를 명시적으로 고정한다", () => {
    const bounds = calendarYearBounds(new Date(2024, 1, 29)); expect(bounds.upper.getFullYear()).toBe(2034); expect(bounds.upper.getMonth()).toBe(2); expect(bounds.upper.getDate()).toBe(1);
  });
  it("DST 날짜 변화도 clock hour 대신 calendar day로 계산한다", () => {
    const original = process.env.TZ; process.env.TZ = "America/New_York";
    try { expect(calendarDateToContentPx(new Date(2026, 2, 9), new Date(2026, 2, 7), "day", 36)).toBe(72);
      expect(calendarDateToContentPx(new Date(2026, 10, 2), new Date(2026, 9, 31), "week", 70)).toBe(20); }
    finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  });
});
