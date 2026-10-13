import { taskRevealTarget } from "./task-reveal-target";
import type { IApi } from "@svar-ui/react-gantt";
import type { ProjectionReceipt } from "../projection-settled";
import { minimumTimelineScaleWidthForEnd } from "../timeline-range";
import type { ViewportCommand, ViewportContext, ViewportOutcome, ViewportPhase, ViewportPort, ViewportPosition, ViewportSample, ViewportTraceMetadata } from "./viewport-coordinator";

interface PortOptions {
  api: IApi; root: HTMLElement; frame: HTMLElement;
  context(): ViewportContext;
  receipt(): ProjectionReceipt | null;
  requestedEnd(): Date;
  recordEnd(): void;
}
/** Product compatibility port. This does not adopt #569's experimental axis
 * strategies or date-to-pixel formulas. All production app viewport writes live here. */
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
  const resizeCompatibility = async (minimumWidth: number, current: () => boolean) => {
    const state = api.getState();
    const scaleWidth = state._scales?.width, width = state._chartWidth, height = state._chartHeight;
    if (!Number.isFinite(minimumWidth) || minimumWidth > 1_000_000 || !scaleWidth || !width || !height || minimumWidth <= scaleWidth) return;
    // Preserve the existing #367 Core2.7.3 synthetic/physical pair. Its
    // compatibility behavior is not a new physical-capacity guarantee.
    resizing = true;
    try {
      if (!current()) return;
      // Keep the pre-existing pair in one call stack; cancellation cannot leave
      // synthetic container geometry between an awaited first/second command.
      const expansion = exec("resize-chart", { width: minimumWidth, height, scrollSize: state._scrollSize ?? 0 });
      const physical = exec("resize-chart", { width, height, scrollSize: state._scrollSize ?? 0 });
      await Promise.all([expansion, physical]);
    } finally { resizing = false; if (current()) options.recordEnd(); }
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
  const prepare = async (command: ViewportCommand, current: () => boolean): Promise<{ ready: boolean; projectionAfter?: number }> => {
    if (!("position" in command)) return { ready: true };
    if (!current() || !read().measurable) return { ready: false };
    const target = command.position, state = api.getState();
    const beforeWrites = writes, projectionBefore = read().context.projectionEpoch;
    if (![target.left, target.top].every(value => Number.isFinite(value) && value >= 0)) return { ready: false };
    // The coordinator independently requires three stable geometry frames
    // before APPLY. Avoid a compatibility resize (and its extra projection
    // epoch) if physical capacity already admits the saved position.
    const existing = read();
    if (existing.capacity.left >= target.left - 1 && existing.capacity.top >= target.top - 1) return { ready: true };
    const end = state._end, start = state._start;
    if (start instanceof Date && end instanceof Date && end < options.requestedEnd())
      await resizeCompatibility(minimumTimelineScaleWidthForEnd({ start, end: options.requestedEnd(), scaleMode: options.context().scale as "day" | "week" }), current);
    if (command.compatibility && typeof state._chartWidth === "number") await resizeCompatibility(state._chartWidth + target.left, current);
    // Capacity changes may replace the projection observation. Complete them
    // before the coordinator accepts a receipt for the coordinate command.
    let enough = 0;
    const admission = new AbortController();
    for (let count = 0; count < 120 && current(); count++) {
      const sample = read();
      enough = sample.measurable && sample.capacity.left >= target.left - 1 && sample.capacity.top >= target.top - 1 ? enough + 1 : 0;
      if (enough >= 3) return { ready: true, ...(writes > beforeWrites ? { projectionAfter: projectionBefore } : {}) };
      if (!(await nextFrame(admission.signal))) enough = 0;
    }
    return { ready: false };
  };
  const apply = async (command: ViewportCommand, current: () => boolean): Promise<ViewportPosition | null> => {
    if (!current() || !read().measurable) return null;
    const state = api.getState();
    if (command.kind === "RANGE_EXTENSION") { await resizeCompatibility(command.width, current); return read().core; }
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
    if (!current() || !sample.measurable || sample.capacity.left < target.left - 1 || sample.capacity.top < target.top - 1) return null;
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
  return { read, frame: nextFrame, prepare, apply, repair, protect(target, current) { authority = { target, current, geometry: read().geometry, repairs }; }, release() { authority = null; }, trace,
    resizing: () => resizing, dispose() { disposed = true; authority = null; api.detach(tag); } };
}
