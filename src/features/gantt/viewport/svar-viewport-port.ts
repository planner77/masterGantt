import { taskRevealTarget } from "./task-reveal-target";
import type { IApi } from "@svar-ui/react-gantt";
import type { ProjectionReceipt } from "../projection-settled";
import { createAxisTransaction } from "./axis-transaction";
import { GANTT_CELL_WIDTH, minimumTimelineScaleWidthForEnd } from "../timeline-range";
import type { GeometryReadResult, UserIntentLease } from "../state-consistency";
import type { ViewportCommand, ViewportContext, ViewportOutcome, ViewportPhase, ViewportPort, ViewportPosition, ViewportSample, ViewportTraceMetadata, ViewportStamp } from "./viewport-coordinator";

interface PortOptions {
  api: IApi; root: HTMLElement; frame: HTMLElement;
  context(): ViewportContext;
  receipt(): ProjectionReceipt | null;
  requestedEnd(): Date;
  recordEnd(): void;
  axisSettled?(): void;
  lease(): UserIntentLease;
  canChangeAxis?(): boolean;
  nativeForwardInput?(left: number): void;
}
/** Single product viewport writer. Version-bound compatibility transactions retain
 * the coordinator registration lease; physical capacity remains observed. */
export function createSvarViewportPort(options: PortOptions): ViewportPort & { dispose(): void; resizing(): boolean } {
  const { api, root, frame } = options;
  let disposed = false, resizing = false;
  let authority: { target: ViewportPosition; current: () => boolean; geometry: string; repairs: number } | null = null;
  let writes = 0, repairs = 0, diagnosticRepairs = 0;
  const chart = () => root.querySelector<HTMLElement>(".wx-chart");
  const vertical = () => root.querySelector<HTMLElement>(".wx-gantt");
  const read = (): ViewportSample => {
    const state = api.getState(), horizontal = chart(), y = vertical();
    const rootStyle = getComputedStyle(root), chartStyle = horizontal ? getComputedStyle(horizontal) : null;
    const hardAvailable = !disposed && root.isConnected && !root.closest("[hidden], [inert]") && document.visibilityState !== "hidden" &&
      rootStyle.display !== "none" && rootStyle.visibility !== "hidden" && chartStyle?.display !== "none" && chartStyle?.visibility !== "hidden";
    const measurable = hardAvailable && !!horizontal?.clientWidth && !!horizontal.clientHeight && root.getClientRects().length > 0;
    const context = options.context();
    // Window geometry/fullscreen is part of the intent lease. A physical
    // resize must revoke a pending peer return even without a React render.
    return { context: { ...context, geometry: JSON.stringify([context.geometry, window.innerWidth, window.innerHeight, Boolean(document.fullscreenElement)]),
      visible: context.visible && hardAvailable }, receipt: options.receipt(), measurable,
      geometry: JSON.stringify([root.clientWidth, root.clientHeight, horizontal?.clientWidth, horizontal?.clientHeight, horizontal?.scrollWidth, y?.scrollHeight]),
      capacity: { left: horizontal ? Math.max(0, horizontal.scrollWidth - horizontal.clientWidth) : 0, top: y ? Math.max(0, y.scrollHeight - y.clientHeight) : 0 },
      core: { left: state.scrollLeft, top: state.scrollTop },
      native: { left: horizontal?.scrollLeft ?? 0, top: y?.scrollTop ?? 0 },
      positions: [".project-gantt-scroll", ".wx-chart", ".wx-gantt", ".wx-table-container"].flatMap(selector => {
        const owner = root.matches(selector) ? root : root.querySelector<HTMLElement>(selector);
        return owner?.isConnected ? [{ selector, left: owner.scrollLeft, top: owner.scrollTop, owner }] : [];
      }) };
  };
  const trace = (phase: ViewportPhase, command?: ViewportCommand, outcome?: ViewportOutcome, metadata?: ViewportTraceMetadata) => {
    if (process.env.NODE_ENV !== "production") {
      const detail = { phase, kind: command?.kind, outcome, writes, ...metadata, core: read().core, native: read().native, geometry: read().geometry };
      frame.dataset.ganttViewportCoordinator = JSON.stringify(detail);
      const history = JSON.parse(frame.dataset.ganttViewportCoordinatorHistory ?? "[]") as unknown[];
      frame.dataset.ganttViewportCoordinatorHistory = JSON.stringify([...history.slice(-99), detail]);
      frame.dispatchEvent(new CustomEvent("mastergantt:viewport-coordinator", { bubbles: true, detail: { phase, kind: command?.kind, outcome, writes, apiInstance: options.context().apiInstance, revision: options.context().revision, projectionEpoch: options.context().projectionEpoch, ...metadata } }));
    }
  };
  const exec = async (action: "scroll-chart" | "resize-chart", parameters: object) => {
    writes++;
    const returned: unknown = api.exec(action, parameters);
    const failure = Symbol("timeout");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([Promise.resolve(returned), new Promise(resolve => { timer = setTimeout(() => resolve(failure), 1500); })]);
      if (value === failure) throw new Error("TIMED_OUT");
      if (value === false) throw new Error("COMMAND_REJECTED");
    } finally { clearTimeout(timer); }
  };
  const repair = (target: ViewportPosition, diagnostic = false) => {
    if (diagnostic && process.env.NODE_ENV === "production") return false;
    const sample = read(), horizontal = chart(), y = vertical();
    if ((diagnostic ? diagnosticRepairs : repairs) >= 3 || !sample.measurable || !horizontal || !y || sample.capacity.left < target.left - 1 || sample.capacity.top < target.top - 1) return false;
    horizontal.scrollLeft = target.left; y.scrollTop = target.top; writes++;
    if (diagnostic) diagnosticRepairs++; else repairs++;
    if (process.env.NODE_ENV !== "production") frame.dataset.ganttPeerNativeRepairs = String(Number(frame.dataset.ganttPeerNativeRepairs ?? 0) + 1);
    return Math.abs(horizontal.scrollLeft - target.left) <= 1 && Math.abs(y.scrollTop - target.top) <= 1;
  };
  const tag = "project-viewport-coordinator-port";
  api.intercept("scroll-chart", event => {
    const axis = axisAuthority;
    if (axis && !axis.nativeHandled && axis.current() && event.eventSource === undefined && typeof event.left === "number") {
      const native = chart()?.scrollLeft;
      // Only native forward ingress beyond the registered baseline wins here.
      // Own tagged writes, backward resize clamps and API commands whose DOM
      // position has not moved cannot acquire fresh user authority.
      if (native !== undefined && Math.abs(native - event.left) <= 1 && Math.abs(native - api.getState().scrollLeft) > 1 && native > axis.baselineLeft + 1) {
        axis.nativeHandled = true;
        options.nativeForwardInput?.(event.left);
      }
    }
    const guard = authority;
    // Only guard stale horizontal rewinds. SVAR/native vertical scrolling
    // (including programmatic scrollTop=0 for a virtualized Grid) must pass.
    if (!guard || typeof event.left !== "number" || event.eventSource === tag) return;
    const sample = read();
    if (!guard.current() || !sample.measurable || guard.geometry !== sample.geometry || (sample.core.left !== guard.target.left || sample.core.top !== guard.target.top)) { authority = null; return; }
    if (event.left === guard.target.left) return;
    if (Math.abs(sample.native.left - guard.target.left) > 1 || Math.abs(sample.native.top - guard.target.top) > 1) {
      if (repairs >= 3 || !repair(guard.target)) { authority = null; return; }
      guard.repairs = repairs;
    }
    if (process.env.NODE_ENV !== "production") frame.dataset.ganttPeerScrollGuardBlocks = String(Number(frame.dataset.ganttPeerScrollGuardBlocks ?? 0) + 1);
    return false;
  }, { tag });
  const nextFrame = (signal: AbortSignal) => new Promise<boolean>(resolve => {
    if (disposed || signal.aborted) { resolve(false); return; }
    let done = false;
    const finish = (animated: boolean) => {
      if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(timer);
      signal.removeEventListener("abort", cancel); document.removeEventListener("visibilitychange", visibility); resolve(animated);
    };
    const cancel = () => finish(false);
    const visibility = () => { if (document.visibilityState === "hidden") finish(false); };
    const raf = requestAnimationFrame(() => finish(true)), timer = setTimeout(() => finish(false), 50);
    signal.addEventListener("abort", cancel, { once: true }); document.addEventListener("visibilitychange", visibility);
  });
  const geometry = (): GeometryReadResult => {
    const sample = read(), horizontal = chart(), y = vertical();
    if (!sample.measurable || !horizontal || !y) return { ok: false, outcome: "NOT_MEASURABLE" };
    const box = horizontal.getBoundingClientRect(), rootBox = root.getBoundingClientRect();
    const scaleHeight = root.querySelector<HTMLElement>(".wx-scale")?.getBoundingClientRect().height ?? 0;
    return { ok: true, core: sample.core, value: { left: sample.native.left, top: sample.native.top,
      chartX: box.x, chartY: box.y + scaleHeight, chartWidth: horizontal.clientWidth, chartHeight: horizontal.clientHeight - scaleHeight,
      scrollWidth: horizontal.scrollWidth, scrollHeight: y.scrollHeight, verticalClientHeight: y.clientHeight, gridWidth: box.x - rootBox.x } };
  };
  let axisAuthority: { lease: UserIntentLease; current: () => boolean; minimumWidth: number; baselineLeft: number; nativeHandled: boolean } | null = null;
  let axisTransaction: ReturnType<typeof createAxisTransaction> | null = null;
  // Each registered command owns one extension attempt. Safety/taint remains
  // shared by the actual API source across these command-scoped facades.
  const createCommandTransaction = () => createAxisTransaction({ maxExtensions: 1, apiInstance: options.context().apiInstance, source: api,
    strategy: "SYNTHETIC_COMPATIBILITY", compatibility: { enabled: true, wrapperVersion: "2.7.3", storeVersion: "2.7.2", source: api },
    geometry: { readGeometry: geometry }, clock: { now: () => performance.now(), frame: nextFrame },
    readPhysicalSize: () => ({ width: api.getState()._chartWidth ?? NaN, height: api.getState()._chartHeight ?? NaN }),
    isLeaseCurrent: candidate => axisAuthority?.lease === candidate && axisAuthority.current(),
    readAxis: () => { const value = api.getState(); return { startMs: value._start?.getTime() ?? NaN, endMs: value._end?.getTime() ?? NaN, scaleWidth: value._scales?.width ?? 0 }; },
    changeExtent: async (_extent, context) => {
      if (!context.current() || !axisAuthority) return false;
      const state = api.getState(), width = state._chartWidth, height = state._chartHeight;
      if (!width || !height) return false;
      // Preserve the pre-existing synchronous pair. No await or authority
      // reacquisition can leave a cancelled half-pair in the physical container.
      const expansion = exec("resize-chart", { width: axisAuthority.minimumWidth, height, scrollSize: state._scrollSize ?? 0 });
      const physical = exec("resize-chart", { width, height, scrollSize: state._scrollSize ?? 0 });
      await Promise.all([expansion, physical]);
      return context.current();
    },
    applyPosition: async (target, context) => {
      if (!context.current()) return false;
      repairs = 0;
      await exec("scroll-chart", { ...target, eventSource: tag });
      if (!context.current()) return false;
      const sample = read();
      if (sample.core.left === target.left && sample.core.top === target.top &&
        (Math.abs(sample.native.left - target.left) > 1 || Math.abs(sample.native.top - target.top) > 1)) repair(target);
    },
  });
  const axisSignature = () => {
    const state = api.getState(), horizontal = chart();
    return JSON.stringify([state._start?.getTime(), state._end?.getTime(), state._scales?.width,
      horizontal?.clientWidth, horizontal?.clientHeight, horizontal?.scrollWidth]);
  };
  const extentTransaction = async (current: () => boolean, source?: ViewportStamp, minimumWidth?: number) => {
    const retirement = new AbortController();
    try {
      for (let count = 0; axisTransaction?.state().busy && count < 120 && current(); count++) await nextFrame(retirement.signal);
    } finally { retirement.abort(); }
    const beforeAxis = axisSignature();
    const state = api.getState(), start = state._start, end = state._end;
    if (!(start instanceof Date) || !(end instanceof Date) || !current() || axisTransaction?.state().busy || options.canChangeAxis?.() === false) return null;
    const lease = source ? { stamp: source, priority: 1 } : options.lease(), controller = new AbortController();
    const revision = options.context().revision;
    const authorized = () => current() && options.context().revision === revision && options.canChangeAxis?.() !== false;
    const scale = options.context().scale as "day" | "week";
    const desiredWidth = minimumWidth ?? minimumTimelineScaleWidthForEnd({ start, end: options.requestedEnd(), scaleMode: scale });
    if (!Number.isFinite(desiredWidth) || desiredWidth <= 0 || desiredWidth > 1_000_000) return null;
    const requestedEnd = new Date(Math.max(end.getTime(), options.requestedEnd().getTime()));
    const additionalCells = Math.ceil(Math.max(0, desiredWidth - (state._scales?.width ?? 0)) / GANTT_CELL_WIDTH[scale]);
    if (additionalCells > 0 && desiredWidth > minimumTimelineScaleWidthForEnd({ start, end: requestedEnd, scaleMode: scale })) {
      const capacityEnd = new Date(end);
      capacityEnd.setDate(capacityEnd.getDate() + additionalCells * (scale === "week" ? 7 : 1));
      if (capacityEnd > requestedEnd) requestedEnd.setTime(capacityEnd.getTime());
    }
    // 축 전환 중 남은 native 좌표의 뒤쪽 clamp는 새 forward 입력이 아니다.
    const baseline = read();
    axisAuthority = { lease, current: authorized, minimumWidth: desiredWidth, baselineLeft: Math.max(baseline.core.left, baseline.native.left), nativeHandled: false };
    const transaction = createCommandTransaction();
    axisTransaction = transaction;
    resizing = true;
    try {
      if (transaction.state().tainted) {
        const recovered = await transaction.recoverNaturalGeometry({ lease, abort: { signal: controller.signal, isCurrent: authorized } });
        if (process.env.NODE_ENV !== "production") frame.dataset.ganttAxisRecovery = JSON.stringify(recovered);
        if (recovered.outcome !== "SETTLED") return recovered;
      }
      const result = await transaction.run({ extent: { startMs: start.getTime(), endMs: requestedEnd.getTime() },
        policy: { kind: "PRESERVE" }, lease, abort: { signal: controller.signal, isCurrent: authorized } });
      if (process.env.NODE_ENV !== "production") frame.dataset.ganttAxisTransaction = JSON.stringify(result);
      if (result.outcome === "SETTLED") {
        options.recordEnd();
        // Scroll extent can change without a ResizeObserver client-size event.
        if (axisSignature() !== beforeAxis) options.axisSettled?.();
      }
      return result;
    } finally {
      controller.abort(); transaction.dispose();
      if (axisTransaction === transaction) { resizing = false; axisTransaction = null; axisAuthority = null; }
    }
  };
  const coreHorizontalCapacity = (): number | null => {
    const state = api.getState(), width = state._scales?.width, chartWidth = state._chartWidth;
    if (typeof width !== "number" || !Number.isFinite(width) || width < 0 ||
      typeof chartWidth !== "number" || !Number.isFinite(chartWidth) || chartWidth <= 0) return null;
    return Math.max(0, width - chartWidth);
  };
  const admitsPosition = (sample: ViewportSample, target: ViewportPosition): boolean => {
    const coreCapacity = coreHorizontalCapacity();
    // Core clamps against its measured width, which can differ from the DOM
    // client width by one pixel. Only native settlement permits that tolerance.
    return sample.measurable && coreCapacity !== null && coreCapacity >= target.left &&
      sample.capacity.left >= target.left - 1 && sample.capacity.top >= target.top - 1;
  };
  const prepare = async (command: ViewportCommand, current: () => boolean, source?: ViewportStamp): Promise<{ ready: boolean; projectionAfter?: number }> => {
    if (!("position" in command)) return { ready: true };
    if (!current() || !read().measurable) return { ready: false };
    const admission = new AbortController();
    let frames = 0;
    while ((options.canChangeAxis?.() === false || axisTransaction?.state().busy) && frames++ < 120 && current()) await nextFrame(admission.signal);
    if (!current() || options.canChangeAxis?.() === false || axisTransaction?.state().busy) return { ready: false };
    const target = command.position, state = api.getState();
    const beforeAxis = axisSignature(), projectionBefore = read().context.projectionEpoch;
    if (![target.left, target.top].every(value => Number.isFinite(value) && value >= 0)) return { ready: false };
    const existing = read(), coreCapacity = coreHorizontalCapacity();
    if (coreCapacity === null) return { ready: false };
    // Restore the retained date extent before admitting coordinates, even if
    // the shrunken native chart can still hold the saved position.
    if (state._end instanceof Date && state._end < options.requestedEnd()) {
      const retainedWidth = minimumTimelineScaleWidthForEnd({ start: state._start!, end: options.requestedEnd(), scaleMode: options.context().scale as "day" | "week" });
      const result = await extentTransaction(current, source, command.compatibility ? Math.max(retainedWidth, (state._chartWidth ?? 0) + target.left) : retainedWidth);
      if (result?.outcome !== "SETTLED") return { ready: false };
    } else if (admitsPosition(existing, target)) return { ready: true };
    else if (command.compatibility && (coreCapacity < target.left || existing.capacity.left < target.left - 1)) {
      const result = await extentTransaction(current, source, state._chartWidth! + target.left);
      if (result?.outcome !== "SETTLED") return { ready: false };
    } else return { ready: false };
    // Capacity changes may replace the projection observation. Complete them
    // before the coordinator accepts a receipt for the coordinate command.
    let enough = 0;
    for (; frames < 120 && current(); frames++) {
      const sample = read();
      enough = admitsPosition(sample, target) ? enough + 1 : 0;
      if (enough >= 3) return { ready: true, ...(axisSignature() !== beforeAxis ? { projectionAfter: projectionBefore } : {}) };
      if (!(await nextFrame(admission.signal))) enough = 0;
    }
    return { ready: false };
  };
  const apply = async (command: ViewportCommand, current: () => boolean, source?: ViewportStamp): Promise<ViewportPosition | null> => {
    if (!current() || !read().measurable) return null;
    const state = api.getState();
    if (command.kind === "RANGE_EXTENSION") { const result = await extentTransaction(current, source, command.width); return result?.outcome === "SETTLED" ? result.position ?? null : null; }
    if (command.kind === "DIAGNOSTIC_SCROLL") {
      if (process.env.NODE_ENV === "production" || !Number.isFinite(command.left) || command.left < 0 || read().capacity.left < command.left - 1) return null;
      // Diagnostic requests cannot replenish an existing peer repair budget.
      diagnosticRepairs = 0;
      await exec("scroll-chart", { left: command.left, eventSource: tag });
      return read().core;
    }
    repairs = 0;
    let target: ViewportPosition = read().core;
    if (command.kind === "TASK_REVEAL") {
      const task = api.getTask(command.taskId);
      if (!task || !state._tasks.some(candidate => String(candidate.id) === command.taskId)) return null;
      const sample = read();
      const target = taskRevealTarget({ type: task.type, start: task.start,
        x: task.$x, y: task.$y, width: task.$w, height: task.$h,
        axisStart: state._scales?.start ?? state._start, axisEnd: state._scales?.end ?? state._end,
        viewportWidth: chart()?.clientWidth ?? 0, viewportHeight: state._chartHeight ?? vertical()?.clientHeight ?? 0,
        current: sample.core, capacity: sample.capacity });
      if (!target) return null;
      await exec("scroll-chart", { ...target, eventSource: tag }); return target;
    }
    if (command.kind === "DATE_REVEAL") return null;
    if (command.kind === "DIAGNOSTIC_DATE_REVEAL") {
      if (process.env.NODE_ENV === "production" || !Number.isFinite(command.date.getTime())) return null;
      // Preserve the existing dev-only #549 native date-action probe. This is
      // not product DATE_REVEAL support or adoption of the #569 adapter.
      await exec("scroll-chart", { date: command.date, eventSource: tag }); return read().core;
    }
    if (command.kind === "NATIVE_ADD") {
      for (const position of command.positions) {
        if (!current()) return null;
        const owner = root.matches(position.selector) ? root : root.querySelector<HTMLElement>(position.selector);
        if (owner?.isConnected && !owner.closest("[hidden], [inert]") && owner.getClientRects().length > 0 && (!position.owner || owner === position.owner)) { owner.scrollLeft = position.left; owner.scrollTop = position.top; writes++; }
      }
      return read().core;
    }
    if (command.kind === "DRAG_EDGE") target = { left: state.scrollLeft, top: command.top };
    else target = command.position;
    if (![target.left, target.top].every(value => Number.isFinite(value) && value >= 0)) return null;
    const sample = read();
    if (!current() || !admitsPosition(sample, target)) return null;
    await exec("scroll-chart", { ...target, eventSource: tag });
    if (!current()) return null;
    // A filter bookmark is one-shot; it cannot intercept a later native
    // scroll-chart event. Peer/passive guards keep their stale-rewind policy.
    if (command.kind !== "DRAG_EDGE" && command.kind !== "FILTER_RETURN" && command.protect !== false) {
      const accepted = read();
      if (accepted.core.left === target.left && accepted.core.top === target.top)
        authority = { target, current, geometry: accepted.geometry, repairs };
    }
    if ("positions" in command) for (const position of command.positions ?? []) {
      const owner = root.matches(position.selector) ? root : root.querySelector<HTMLElement>(position.selector);
      if (owner?.isConnected && !owner.closest("[hidden], [inert]") && (!position.owner || owner === position.owner)) { owner.scrollLeft = position.left; owner.scrollTop = position.top; writes++; }
    }
    return target;
  };
  return { read, frame: nextFrame, prepare, admitPosition: position => admitsPosition(read(), position), apply, repair, protect(target, current) { authority = { target, current, geometry: read().geometry, repairs }; }, release() { authority = null; }, trace,
    resizing: () => resizing, dispose() { disposed = true; authority = null; axisTransaction?.dispose(); api.detach(tag); } };
}
