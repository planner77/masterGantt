import type { IApi } from "@svar-ui/react-gantt";
import { createCoreActionTrace, type SettleResult, type TraceContext } from "../diagnostics/core-action-trace";
import { readCoreTraceSample } from "../diagnostics/core-trace-observer";

export type AdapterFailure = "UNMEASURABLE" | "UNSUPPORTED_VERSION" | "BOUND_EXCEEDED" | "BUSY" | "DISPOSED" | "COMMAND_REJECTED" | "EXTENSION_UNSUPPORTED";
export type AdapterResult = SettleResult | AdapterFailure;
export interface GanttCoreSnapshot {
  readonly left: number; readonly top: number; readonly originMs: number | null; readonly endMs: number | null;
  readonly scaleWidth: number | null; readonly chartWidth: number | null; readonly chartHeight: number | null;
  readonly selected: readonly (string | number)[];
  readonly columns: readonly Readonly<{ id: string; width: number | null; hidden: boolean }>[];
  readonly scale: readonly Readonly<{ unit: string; step: number }>[];
}
export interface GanttGeometrySnapshot {
  readonly left: number; readonly top: number; readonly chartX: number; readonly chartY: number;
  readonly chartWidth: number; readonly chartHeight: number; readonly scrollWidth: number; readonly scrollHeight: number;
  readonly verticalClientHeight: number; readonly gridWidth: number;
}
export type AdapterRead<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; result: AdapterFailure | "NO_SCROLL_CAPACITY" }>;
export interface GanttAdapterOptions {
  readonly api: IApi; readonly root: HTMLElement; readonly installedVersion: string;
  readonly context: () => TraceContext;
  readonly axis: Readonly<{ origin: () => Date; unit: () => "day" | "week"; cellWidth: () => number }>;
  readonly compatibilityResize?: boolean;
  readonly maxExtensions?: number;
  readonly onFeedback?: (result: AdapterResult) => void;
}
let adapterObserverId = 0;
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const dateMs = (value: unknown): number | null => value instanceof Date && Number.isFinite(value.getTime()) ? value.getTime() : null;
const commandWasRejected = (value: unknown) => value === false;
/** 시간대/DST와 독립인 로컬 calendar 좌표. 원점/폭/단위는 공개 controlled 설정이다. */
export function calendarSerial(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}
export function calendarDate(serial: number): Date {
  const utc = new Date(serial);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds(), utc.getUTCMilliseconds());
}
export function calendarDateToContentPx(date: Date, origin: Date, unit: "day" | "week", cellWidth: number): number {
  return (calendarSerial(date) - calendarSerial(origin)) / 86_400_000 * cellWidth / (unit === "week" ? 7 : 1);
}
/** 윤일은 JS calendar rollover(2/29 -> 3/1)로 한정하며 실제 날짜 경계를 비교한다. */
export function calendarYearBounds(origin: Date) {
  const lower = new Date(origin), upper = new Date(origin);
  lower.setFullYear(lower.getFullYear() - 10); upper.setFullYear(upper.getFullYear() + 10);
  return { lower, upper };
}

/** 2.7.3 공개 getState의 파생 좌표를 읽는다. store/setState/DOM 스크롤 쓰기를 하지 않는다. */
export function createGanttAdapter(options: GanttAdapterOptions) {
  const { api, root } = options;
  const maxExtensions = options.maxExtensions ?? 3;
  if (!Number.isInteger(maxExtensions) || maxExtensions < 1 || maxExtensions > 3) throw new Error("Invalid extension budget");
  let disposed = false, busy = false, extensions = 0, intentId = 0;
  let lastExtensionWidth = 0;
  let compatibilityInvalidated = false;
  const pendingReceipts = new Set<(result: AdapterResult) => void>();
  const feedback = new Set<AdapterResult>();
  const readCore = (): GanttCoreSnapshot => {
    const state = api.getState();
    return Object.freeze({ left: state.scrollLeft, top: state.scrollTop, originMs: dateMs(state._start), endMs: dateMs(state._end),
      scaleWidth: number(state._scales?.width), chartWidth: number(state._chartWidth), chartHeight: number(state._chartHeight),
      selected: Object.freeze([...(state.selected ?? [])]),
      columns: Object.freeze((state.columns ?? []).map(column => Object.freeze({ id: String(column.id), width: number(column.width), hidden: column.hidden === true }))),
      scale: Object.freeze((state.scales ?? []).map(scale => Object.freeze({ unit: scale.unit, step: scale.step ?? 1 }))) });
  };
  const readGeometry = (): AdapterRead<GanttGeometrySnapshot> => {
    if (disposed) return { ok: false, result: "DISPOSED" };
    if (!root.isConnected || root.closest("[hidden],[inert],[aria-hidden='true']")) return { ok: false, result: "UNMEASURABLE" };
    for (let owner: HTMLElement | null = root; owner; owner = owner.parentElement) {
      const style = getComputedStyle(owner);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return { ok: false, result: "UNMEASURABLE" };
    }
    const chart = root.querySelector<HTMLElement>(".wx-chart"), vertical = root.querySelector<HTMLElement>(".wx-gantt");
    if (!chart || !vertical) return { ok: false, result: "UNMEASURABLE" };
    const rect = chart.getBoundingClientRect(), rootRect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || chart.clientWidth <= 0 || vertical.clientHeight <= 0) return { ok: false, result: "NO_SCROLL_CAPACITY" };
    const scaleHeight = root.querySelector<HTMLElement>(".wx-scale")?.getBoundingClientRect().height ?? 0;
    if (chart.clientHeight - scaleHeight <= 0) return { ok: false, result: "NO_SCROLL_CAPACITY" };
    return { ok: true, value: Object.freeze({ left: chart.scrollLeft, top: vertical.scrollTop, chartX: rect.x, chartY: rect.y + scaleHeight,
      chartWidth: chart.clientWidth, chartHeight: Math.max(0, chart.clientHeight - scaleHeight), scrollWidth: chart.scrollWidth, scrollHeight: vertical.scrollHeight,
      verticalClientHeight: vertical.clientHeight, gridWidth: rect.x - rootRect.x }) };
  };
  const trace = createCoreActionTrace(() => ({ ...options.context(), intentId }), () => readCoreTraceSample(api, root));
  const report = (result: AdapterResult): AdapterResult => {
    if (!disposed && !feedback.has(result) && result !== "NATIVE_LAYOUT_SETTLED" && result !== "COMMAND_ACCEPTED") {
      feedback.add(result); options.onFeedback?.(result);
    }
    return result;
  };
  const validate = (): AdapterResult | null => {
    if (disposed) return "DISPOSED";
    if (compatibilityInvalidated) return "EXTENSION_UNSUPPORTED";
    const geometry = readGeometry();
    return geometry.ok ? null : geometry.result;
  };
  const sample = () => Object.freeze({ core: readCore(), geometry: readGeometry(), extensions, intentId });
  const supersede = (source = "explicit") => { intentId++; for (const cancel of [...pendingReceipts]) cancel("SUPERSEDED_BY_INTENT"); trace.record("adapter-intent", source); };
  const input = (event: Event) => supersede(`native-${event.type}`);
  for (const event of ["wheel", "pointerdown", "keydown"]) root.addEventListener(event, input, { capture: true, passive: true });
  const observer = new ResizeObserver(() => trace.record("adapter-resize-observer")); observer.observe(root);
  const chart = root.querySelector(".wx-chart"); if (chart) observer.observe(chart);
  const settle = async (expected?: { left: number; top: number }, timeoutMs = 1500): Promise<AdapterResult> => {
    const failure = validate(); if (failure) return report(failure);
    const result = await trace.settle(expected, timeoutMs);
    const finalFailure = validate();
    return report(finalFailure ?? result);
  };
  const tag = `issue569-adapter-${++adapterObserverId}`;
  for (const action of ["scroll-chart", "resize-chart", "select-task", "set-columns"] as const) {
    api.intercept(action, params => { trace.record("adapter-core-before", action, params); return true; }, { tag });
    api.on(action, params => trace.record("adapter-core-after", action, params), { tag });
  }
  const exec = (action: string, params: object, epoch: number): Promise<AdapterResult> => {
    if (disposed) return Promise.resolve("DISPOSED");
    if (intentId !== epoch) return Promise.resolve("SUPERSEDED_BY_INTENT");
    trace.record("adapter-command-request", action, params);
    try {
      const returned: unknown = api.exec(action, params);
      const thenable = returned !== null && (typeof returned === "object" || typeof returned === "function") && typeof (returned as { then?: unknown }).then === "function";
      trace.record("adapter-command-return", action, { returnKind: typeof returned, thenable }, "COMMAND_ACCEPTED");
      if (!thenable) return Promise.resolve(commandWasRejected(returned) ? "COMMAND_REJECTED" : "COMMAND_ACCEPTED");
      // receipt 실패/timeout을 먼저 판정한다. receipt 성공은 DOM settle과 별개다.
      return new Promise(resolve => {
        let done = false;
        const finish = (result: AdapterResult) => { if (done) return; done = true; clearTimeout(timer); pendingReceipts.delete(finish); resolve(result); };
        const timer = setTimeout(() => finish("TIMED_OUT"), 1500); pendingReceipts.add(finish);
        void Promise.resolve(returned).then(value => {
          if (done) return;
          trace.record("adapter-command-resolved", action);
          finish(commandWasRejected(value) ? "COMMAND_REJECTED" : "COMMAND_ACCEPTED");
        }, () => { if (done) return; trace.record("adapter-command-rejected", action); finish("COMMAND_REJECTED"); });
      });
    } catch { trace.record("adapter-command-rejected", action); return Promise.resolve("COMMAND_REJECTED"); }
  };
  const transact = async (operation: (epoch: number) => Promise<AdapterResult>): Promise<AdapterResult> => {
    const failure = validate(); if (failure) return report(failure);
    if (busy) return report("BUSY");
    busy = true;
    try { supersede("adapter-command"); const epoch = intentId, result = await operation(epoch);
      return report(disposed ? "DISPOSED" : intentId !== epoch ? "SUPERSEDED_BY_INTENT" : result); }
    finally { busy = false; }
  };
  const scroll = (position: { left: number; top: number }) => transact(async epoch => {
    if (![position.left, position.top].every(value => Number.isFinite(value) && value >= 0)) return "BOUND_EXCEEDED";
    const geometry = readGeometry(); if (!geometry.ok) return geometry.result;
    if (position.left > Math.max(0, geometry.value.scrollWidth - geometry.value.chartWidth) || position.top > Math.max(0, geometry.value.scrollHeight - geometry.value.verticalClientHeight)) return "NO_SCROLL_CAPACITY";
    const receipt = await exec("scroll-chart", position, epoch); if (receipt !== "COMMAND_ACCEPTED") return receipt;
    return settle(position);
  });
  const dateToViewportPx = (date: Date): AdapterRead<Readonly<{ contentX: number; viewportX: number }>> => {
    const failure = validate(); if (failure) return { ok: false, result: failure as AdapterFailure | "NO_SCROLL_CAPACITY" };
    const origin = options.axis.origin(), width = options.axis.cellWidth();
    const state = api.getState();
    const observedOrigin = state._start;
    // 공개 Core scale 계약과 controlled 설정이 일치하지 않으면 좌표 계산을 허용하지 않는다.
    if (!Array.isArray(state.scales) || state.scales.length !== 1 ||
      state.scales[0].unit !== options.axis.unit() || state.scales[0].step !== 1) {
      return { ok: false, result: "UNMEASURABLE" };
    }
    // 현재 단일 row Day/Week만 지원한다. 짧은 축의 자동 stretch는 설정 cellWidth와 다르므로 DOM tick 폭으로 안전 거부한다.
    const tickWidth = root.querySelector<HTMLElement>(".wx-scale .wx-cell")?.getBoundingClientRect().width;
    if (tickWidth === undefined || !Number.isFinite(tickWidth) || Math.abs(tickWidth - width) > 0.001) return { ok: false, result: "UNMEASURABLE" };
    // 2.7.3 읽기 전용 원점 관측으로 controlled axis와의 정합성만 검사한다.
    if (!(observedOrigin instanceof Date) || calendarSerial(observedOrigin) !== calendarSerial(origin)) return { ok: false, result: "UNMEASURABLE" };
    const bounds = calendarYearBounds(origin);
    if (!Number.isFinite(origin.getTime()) || !Number.isFinite(date.getTime()) || !Number.isFinite(width) || width <= 0 || date < bounds.lower || date > bounds.upper) return { ok: false, result: "BOUND_EXCEEDED" };
    // _scales/_start/private store를 날짜 좌표 authority로 사용하지 않는다.
    const contentX = calendarDateToContentPx(date, origin, options.axis.unit(), width);
    if (!Number.isFinite(contentX)) return { ok: false, result: "UNMEASURABLE" };
    return { ok: true, value: Object.freeze({ contentX, viewportX: contentX - readCore().left }) };
  };
  const viewportPxToDate = (x: number): AdapterRead<number> => {
    const failure = validate(); if (failure) return { ok: false, result: failure as AdapterFailure | "NO_SCROLL_CAPACITY" };
    const width = options.axis.cellWidth(), origin = options.axis.origin();
    const calibration = dateToViewportPx(origin); if (!calibration.ok) return calibration;
    if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0 || !Number.isFinite(origin.getTime())) return { ok: false, result: "BOUND_EXCEEDED" };
    const serial = calendarSerial(origin) + (x + readCore().left) / width * (options.axis.unit() === "week" ? 7 : 1) * 86_400_000;
    const date = calendarDate(serial), bounds = calendarYearBounds(origin);
    if (date < bounds.lower || date > bounds.upper) return { ok: false, result: "BOUND_EXCEEDED" };
    return { ok: true, value: date.getTime() };
  };
  const revealDate = (date: Date) => {
    const point = dateToViewportPx(date), geometry = readGeometry();
    if (!point.ok) return Promise.resolve(report(point.result));
    if (!geometry.ok) return Promise.resolve(report(geometry.result));
    if (point.value.contentX < 0 || point.value.contentX >= geometry.value.scrollWidth) return Promise.resolve(report("NO_SCROLL_CAPACITY"));
    const core = readCore();
    // Core/native physical 폭의 최대 1px 차이에서 Core가 다시 clamp하지 않도록 공통 capacity를 쓴다.
    const capacity = Math.max(0, Math.min(geometry.value.scrollWidth - geometry.value.chartWidth, (core.scaleWidth ?? 0) - (core.chartWidth ?? 0)));
    return scroll({ left: Math.min(Math.max(0, point.value.contentX), capacity), top: core.top });
  };
  const resizeCompatibility = (minimumScaleWidth: number) => transact(async epoch => {
    if (!options.compatibilityResize || options.installedVersion !== "2.7.3") return "UNSUPPORTED_VERSION";
    const state = api.getState(), core = readCore(), geometry = readGeometry();
    if (!geometry.ok) return geometry.result;
    const origin = options.axis.origin(), limit = calendarYearBounds(origin).upper;
    const calendarWidthLimit = calendarDateToContentPx(limit, origin, options.axis.unit(), options.axis.cellWidth()) - 2 * options.axis.cellWidth();
    if (extensions >= maxExtensions || !Number.isFinite(minimumScaleWidth) || core.scaleWidth === null || minimumScaleWidth <= Math.max(core.scaleWidth, lastExtensionWidth) || minimumScaleWidth > 1_000_000 || minimumScaleWidth > calendarWidthLimit) return "BOUND_EXCEEDED";
    if (core.chartWidth === null || core.chartHeight === null) return "UNMEASURABLE";
    const original = { width: geometry.value.chartWidth, height: geometry.value.chartHeight, scrollSize: state._scrollSize ?? 0 };
    // 명시 opt-in PoC 예외: 임시 확장 후 실제 physical geometry를 즉시 복구한다.
    // 제품에는 도입하지 않는다. 어떤 store 필드나 DOM scrollWidth도 쓰지 않는다.
    extensions++; lastExtensionWidth = minimumScaleWidth;
    compatibilityInvalidated = true;
    const first = await exec("resize-chart", { ...original, width: minimumScaleWidth }, epoch);
    if (first !== "COMMAND_ACCEPTED") return first;
    const restored = await exec("resize-chart", original, epoch);
    if (restored !== "COMMAND_ACCEPTED") return restored;
    const physical = readGeometry(), restoredCore = readCore();
    if (!physical.ok || restoredCore.chartWidth === null || restoredCore.chartHeight === null || Math.abs(restoredCore.chartWidth - physical.value.chartWidth) > 1 || Math.abs(restoredCore.chartHeight - physical.value.chartHeight) > 1) return "EXTENSION_UNSUPPORTED";
    compatibilityInvalidated = false;
    const result = await settle({ left: core.left, top: core.top });
    if (result !== "NATIVE_LAYOUT_SETTLED") return result;
    const after = readCore(), native = readGeometry();
    if (!native.ok) return native.result;
    if (after.scaleWidth === null || after.scaleWidth < minimumScaleWidth || native.value.scrollWidth <= geometry.value.scrollWidth || after.chartWidth === null || Math.abs(after.chartWidth - native.value.chartWidth) > 1 || after.endMs === null || after.endMs > limit.getTime()) return "EXTENSION_UNSUPPORTED";
    return result;
  });
  return { readCore, readGeometry, sample, dateToViewportPx, viewportPxToDate, scroll, revealDate, resizeCompatibility, settle, supersede,
    trace: trace.snapshot,
    dispose() {
      if (disposed) return;
      trace.record("adapter-dispose"); disposed = true; intentId++;
      for (const cancel of [...pendingReceipts]) cancel("DISPOSED");
      for (const event of ["wheel", "pointerdown", "keydown"]) root.removeEventListener(event, input, true);
      observer.disconnect(); api.detach(tag); trace.dispose();
    } };
}
export type GanttAdapter = ReturnType<typeof createGanttAdapter>;
