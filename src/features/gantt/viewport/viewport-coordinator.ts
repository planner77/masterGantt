import type { ProjectionReceipt } from "../projection-settled";

export type ViewportPosition = Readonly<{ left: number; top: number }>;
export type ViewportContext = Readonly<{
  apiInstance: string; revision: number; key: string; scope: string | null;
  filter: string; scale: string; columns: string; geometry: string;
  visible: boolean; empty: boolean; filtered: boolean; projectionEpoch: number; receiptFilter: string; bookmarkGeometry: string;
}>;
export type ViewportStamp = Readonly<{ context: string; contextEpoch: number; gesture: number; intent: number }>;
export type ViewportCommand =
  | { kind: "PEER_RETURN" | "PASSIVE_RESTORE" | "FILTER_RETURN"; position: ViewportPosition; positions?: readonly NativeViewportPosition[]; compatibility?: boolean; protect?: boolean }
  | { kind: "TASK_REVEAL"; taskId: string }
  | { kind: "DATE_REVEAL"; date: Date }
  | { kind: "DIAGNOSTIC_DATE_REVEAL"; date: Date }
  | { kind: "DIAGNOSTIC_SCROLL"; left: number }
  | { kind: "RANGE_EXTENSION"; width: number }
  | { kind: "NATIVE_ADD"; positions: readonly NativeViewportPosition[] }
  | { kind: "DRAG_EDGE"; top: number };
export type NativeViewportPosition = Readonly<{ selector: string; left: number; top: number; owner?: HTMLElement }>;
export type ViewportOutcome = "SETTLED" | "SUPERSEDED" | "NOT_MEASURABLE" | "NO_SCROLL_CAPACITY" | "TIMED_OUT" | "FAILED" | "UNSUPPORTED";
export type ViewportPhase = "IDLE" | "WAIT_PROJECTION" | "PREPARING_GEOMETRY" | "WAIT_GEOMETRY" | "APPLYING" | "SETTLING" | ViewportOutcome;
export interface ViewportSample {
  readonly context: ViewportContext;
  readonly receipt: ProjectionReceipt | null;
  readonly measurable: boolean;
  readonly geometry: string;
  readonly capacity: ViewportPosition;
  readonly core: ViewportPosition;
  readonly native: ViewportPosition;
  readonly positions?: readonly NativeViewportPosition[];
}
export type ViewportTraceMetadata = Readonly<{
  intentEpoch: number; contextEpoch: number; gesture: number; projectionEpoch: number;
  apiInstance: string; decisionReason: string;
}>;
export type ViewportPreparation = Readonly<{ ready: boolean; projectionAfter?: number }>;
export interface ViewportPort {
  read(): ViewportSample;
  frame(signal: AbortSignal): Promise<boolean>;
  prepare?(command: ViewportCommand, current: () => boolean): Promise<ViewportPreparation>;
  apply(command: ViewportCommand, current: () => boolean): Promise<ViewportPosition | null>;
  repair(position: ViewportPosition): boolean;
  protect(position: ViewportPosition, current: () => boolean): void;
  release(): void;
  trace(phase: ViewportPhase, command?: ViewportCommand, outcome?: ViewportOutcome, metadata?: ViewportTraceMetadata): void;
}
const priority = (command: ViewportCommand) => command.kind === "TASK_REVEAL" || command.kind === "DATE_REVEAL" || command.kind === "DIAGNOSTIC_DATE_REVEAL" || command.kind === "DRAG_EDGE" ? 4 : command.kind === "FILTER_RETURN" ? 3 : command.kind === "PEER_RETURN" || command.kind === "NATIVE_ADD" ? 2 : 1;
const identity = (context: ViewportContext) => JSON.stringify([context.apiInstance, context.key, context.scope, context.filter, context.scale, context.columns, context.geometry]);
export function validViewportReceipt(sample: ViewportSample): boolean {
  const { context, receipt } = sample;
  return receipt?.outcome === "SETTLED" && receipt.apiInstance === context.apiInstance && receipt.revision === context.revision &&
    receipt.scope === context.scope && receipt.scale === context.scale && receipt.columns === context.columns &&
    receipt.filterKey === context.receiptFilter && receipt.generation === context.projectionEpoch;
}

/** Pure arbitration. Native wheel/selection stays owned by Core; only typed
 * application commands can reach the production port. */
export function createViewportCoordinator(port: ViewportPort, maxFrames = 120) {
  let gesture = 0, epoch = 0, contextEpoch = 0, disposed = false;
  let pending: { controller: AbortController; priority: number; epoch: number } | null = null;
  let rangeController: AbortController | null = null;
  let settledAuthority: (() => boolean) | null = null;
  let explicitEpoch = 0;
  let bookmark: { sample: ViewportSample; gesture: number } | null = null;
  let lastContext = port.read().context;
  const cancel = (reason = "NEW_INTENT") => { pending?.controller.abort(reason); pending = null; rangeController?.abort(reason); rangeController = null; settledAuthority = null; port.release(); };
  const stamp = (): ViewportStamp => ({ context: identity(port.read().context), contextEpoch, gesture, intent: epoch });
  const userInput = () => { gesture++; explicitEpoch = ++epoch; bookmark = null; cancel("USER_GESTURE"); };
  const filterInput = () => {
    const sample = port.read();
    if (!bookmark && !sample.context.filtered && sample.measurable && !sample.context.empty)
      bookmark = { sample, gesture };
    explicitEpoch = ++epoch; contextEpoch++; cancel("FILTER_INPUT");
  };
  const request = async (command: ViewportCommand, source = stamp()): Promise<ViewportOutcome> => {
    const initial = port.read(), level = priority(command);
    let operationEpoch = epoch;
    let acceptedProjection: number | null = null;
    let preparationFloor = -1;
    const trace = (phase: ViewportPhase, outcome?: ViewportOutcome, decisionReason: string = phase) => port.trace(phase, command, outcome, {
      intentEpoch: operationEpoch, contextEpoch: source.contextEpoch, gesture: source.gesture,
      projectionEpoch: acceptedProjection ?? port.read().context.projectionEpoch, apiInstance: initial.context.apiInstance, decisionReason,
    });
    const supersededReason = (controller: AbortController) => {
      if (controller.signal.aborted) return String(controller.signal.reason);
      if (disposed) return "DISPOSED";
      const context = port.read().context;
      if (context.revision !== initial.context.revision || (acceptedProjection !== null && context.projectionEpoch !== acceptedProjection)) return "STALE_PROJECTION";
      if (acceptedProjection !== null && !validViewportReceipt(port.read())) return "INVALID_RECEIPT";
      if (source.gesture !== gesture) return "STALE_GESTURE";
      if (!context.visible) return "HIDDEN_CONTEXT";
      return "STALE_CONTEXT_OR_INTENT";
    };
    const reject = (outcome: ViewportOutcome, reason: string) => { trace(outcome, outcome, reason); return outcome; };
    if (disposed) return reject("SUPERSEDED", "DISPOSED");
    if (source.context !== identity(initial.context) || source.contextEpoch !== contextEpoch) return reject("SUPERSEDED", "STALE_CONTEXT");
    if (source.gesture !== gesture) return reject("SUPERSEDED", "STALE_GESTURE");
    if (source.intent < explicitEpoch) return reject("SUPERSEDED", "STALE_INTENT");
    if (pending && level < pending.priority && command.kind !== "RANGE_EXTENSION") return reject("SUPERSEDED", "LOWER_PRIORITY");
    if (!initial.context.visible || (!initial.measurable && (command.kind === "RANGE_EXTENSION" || command.kind === "DIAGNOSTIC_SCROLL"))) return reject("NOT_MEASURABLE", "HIDDEN_OR_UNMEASURABLE");
    if (initial.context.empty && command.kind !== "RANGE_EXTENSION") return reject("NOT_MEASURABLE", "EMPTY_PROJECTION");
    // #367 changes capacity, not viewport intent. Keep the validated resize
    // pair synchronous with ingress and never repair a captured old position.
    if (command.kind === "RANGE_EXTENSION" || command.kind === "DIAGNOSTIC_SCROLL") {
      if (command.kind === "RANGE_EXTENSION" && (!Number.isFinite(command.width) || command.width <= 0 || command.width > 1_000_000))
        return reject("UNSUPPORTED", "INVALID_RANGE_WIDTH");
      if (command.kind === "DIAGNOSTIC_SCROLL" && (process.env.NODE_ENV === "production" || !Number.isFinite(command.left) || command.left < 0))
        return reject("UNSUPPORTED", "DIAGNOSTIC_ONLY");
      rangeController?.abort("NEW_RANGE");
      const controller = new AbortController();
      rangeController = controller;
      const current = () => !disposed && !controller.signal.aborted && validSource(source) && port.read().context.visible;
      let result: ViewportOutcome = "TIMED_OUT";
      try {
        trace("APPLYING");
        const applied = await port.apply(command, current);
        if (!current()) return result = "SUPERSEDED";
        if (!applied) return result = "NO_SCROLL_CAPACITY";
        trace("SETTLING");
        let stable = 0, geometry = "";
        for (let count = 0; count < maxFrames && current(); count++) {
          const animated = await port.frame(controller.signal), sample = port.read();
          if (!current()) return result = "SUPERSEDED";
          if (!sample.measurable) return result = "NOT_MEASURABLE";
          // Range growth is physical capacity preparation, not a canonical
          // projection operation. A stale projection receipt must not block
          // safe, three-frame Core/native geometry observation. The dev-only
          // scroll probe likewise must not acquire production restore authority.
          const coherent = Math.abs(sample.core.left - sample.native.left) <= 1 && Math.abs(sample.core.top - sample.native.top) <= 1 &&
            (command.kind !== "DIAGNOSTIC_SCROLL" || sample.core.left === command.left);
          stable = animated && coherent && geometry === sample.geometry ? stable + 1 : 0;
          geometry = sample.geometry;
          if (stable >= 3) return result = "SETTLED";
        }
        return result = current() ? "TIMED_OUT" : "SUPERSEDED";
      } catch (error) {
        return result = !current() ? "SUPERSEDED" : error instanceof Error && error.message === "TIMED_OUT" ? "TIMED_OUT" : "FAILED";
      } finally {
        if (rangeController === controller) rangeController = null;
        trace(result, result, result === "SUPERSEDED" ? supersededReason(controller) : result);
      }
    }
    cancel();
    const controller = new AbortController(), operation = { controller, priority: level, epoch: ++epoch };
    pending = operation;
    operationEpoch = operation.epoch;
    if (level === 4) { explicitEpoch = epoch; bookmark = null; }
    const current = () => !disposed && !controller.signal.aborted && pending === operation &&
      source.contextEpoch === contextEpoch && source.gesture === gesture && identity(port.read().context) === source.context && port.read().context.visible &&
      port.read().context.revision === initial.context.revision &&
      (acceptedProjection === null || (port.read().context.projectionEpoch === acceptedProjection && validViewportReceipt(port.read())));
    const phase = (value: ViewportPhase) => trace(value);
    let result: ViewportOutcome = "TIMED_OUT";
    const complete = (outcome: ViewportOutcome) => { result = outcome; return outcome; };
    try {
      if (command.kind === "DATE_REVEAL") return complete("UNSUPPORTED");
      phase("WAIT_PROJECTION");
      let ready = false;
      for (let count = 0; count < maxFrames && current(); count++) {
        const sample = port.read();
        result = sample.measurable ? "TIMED_OUT" : "NOT_MEASURABLE";
        if (sample.measurable && sample.context.projectionEpoch > preparationFloor && validViewportReceipt(sample)) { ready = true; break; }
        await port.frame(controller.signal);
      }
      if (!current()) return complete("SUPERSEDED");
      if (!ready) return complete(result);
      // Compatibility resize can start a newer observation of the same
      // canonical data. Finish that preparation before pinning its receipt.
      if (port.prepare) {
        phase("PREPARING_GEOMETRY");
        const prepared = await port.prepare(command, current);
        if (!current()) return complete("SUPERSEDED");
        if (!prepared.ready) return complete("NO_SCROLL_CAPACITY");
        preparationFloor = prepared.projectionAfter ?? -1;
        phase("WAIT_PROJECTION");
        ready = false;
        for (let count = 0; count < maxFrames && current(); count++) {
          const sample = port.read();
          result = sample.measurable ? "TIMED_OUT" : "NOT_MEASURABLE";
          if (sample.measurable && sample.context.projectionEpoch > preparationFloor && validViewportReceipt(sample)) { ready = true; break; }
          await port.frame(controller.signal);
        }
        if (!current()) return complete("SUPERSEDED");
        if (!ready) return complete(result);
      }
      phase("WAIT_GEOMETRY");
      let stable = 0, previous = "";
      for (let count = 0; count < maxFrames && current(); count++) {
        const sample = port.read();
        if (!sample.measurable) {
          stable = 0; previous = "";
          await port.frame(controller.signal);
          continue;
        }
        // Observation generations may advance without a new canonical revision.
        // Follow the latest receipt while waiting, restarting its geometry proof;
        // only the generation accepted for the actual command becomes immutable.
        const signature = JSON.stringify([sample.geometry, sample.context.projectionEpoch]);
        stable = validViewportReceipt(sample) && sample.context.projectionEpoch > preparationFloor && signature === previous ? stable + 1 : 0; previous = signature;
        if (stable >= 3) { acceptedProjection = sample.context.projectionEpoch; break; }
        if (!(await port.frame(controller.signal))) stable = 0;
      }
      if (!current()) return complete("SUPERSEDED");
      if (stable < 3) return complete(port.read().measurable ? "TIMED_OUT" : "NOT_MEASURABLE");
      if (!validViewportReceipt(port.read())) return complete("SUPERSEDED");
      phase("APPLYING");
      const target = await port.apply(command, current);
      if (!current()) return complete("SUPERSEDED");
      if (!target) return complete("NO_SCROLL_CAPACITY");
      phase("SETTLING");
      stable = 0;
      let repairs = 0, animated = false, settledGeometry = port.read().geometry;
      for (let count = 0; count < maxFrames && current(); count++) {
        const sample = port.read();
        if (!sample.measurable) return complete("NOT_MEASURABLE");
        const coreCorrect = sample.core.left === target.left && sample.core.top === target.top;
        const nativeCorrect = Math.abs(sample.native.left - target.left) <= 1 && Math.abs(sample.native.top - target.top) <= 1;
        if (coreCorrect && !nativeCorrect && repairs < 3 && port.repair(target)) { repairs++; stable = 0; }
        else stable = animated && validViewportReceipt(sample) && coreCorrect && nativeCorrect && sample.geometry === settledGeometry ? stable + 1 : 0;
        settledGeometry = sample.geometry;
        if (stable >= 3) {
          if (command.kind === "PEER_RETURN" || command.kind === "PASSIVE_RESTORE" || command.kind === "FILTER_RETURN") {
            // A settled command cannot retain write authority over a newer
            // canonical queue or an invalidated observation of the same data.
            if (command.protect !== false) {
              const authorityCurrent = () => {
                const sample = port.read();
                return !disposed && source.contextEpoch === contextEpoch && source.gesture === gesture &&
                  identity(sample.context) === source.context && sample.context.visible && sample.measurable &&
                  sample.context.revision === initial.context.revision && sample.context.projectionEpoch === acceptedProjection && validViewportReceipt(sample);
              };
              settledAuthority = authorityCurrent;
              port.protect(target, authorityCurrent);
            }
          }
          result = "SETTLED"; return result;
        }
        animated = await port.frame(controller.signal);
        if (!animated) stable = 0;
      }
      return complete(current() ? "TIMED_OUT" : "SUPERSEDED");
    } catch (error) { result = !current() ? "SUPERSEDED" : error instanceof Error && error.message === "TIMED_OUT" ? "TIMED_OUT" : "FAILED"; return result; }
    finally {
      if (pending === operation) {
        pending = null;
        if (result !== "SETTLED") port.release();
      }
      trace(result, result, result === "SUPERSEDED" ? supersededReason(controller) : result);
    }
  };
  const contextChanged = () => {
    const context = port.read().context;
    if (identity(context) !== identity(lastContext) || !context.visible) {
      contextEpoch++; cancel("CONTEXT_CHANGED");
      if (context.columns !== lastContext.columns || context.bookmarkGeometry !== lastContext.bookmarkGeometry) bookmark = null;
      if (context.apiInstance !== lastContext.apiInstance || context.scope !== lastContext.scope || context.scale !== lastContext.scale) bookmark = null;
    }
    if (settledAuthority && !settledAuthority()) {
      settledAuthority = null;
      port.release();
    }
    const restore = bookmark && lastContext.filtered && !context.filtered && bookmark.gesture === gesture &&
      bookmark.sample.context.apiInstance === context.apiInstance && bookmark.sample.context.scope === context.scope && !context.empty
      ? bookmark.sample.core : null;
    lastContext = context;
    if (restore) { bookmark = null; void request({ kind: "FILTER_RETURN", position: restore }); }
  };
  const validSource = (source: ViewportStamp) => source.context === identity(port.read().context) && source.contextEpoch === contextEpoch && source.gesture === gesture && source.intent >= explicitEpoch;
  return { stamp, validSource, request, userInput, filterInput, contextChanged, dispose() { disposed = true; bookmark = null; cancel("DISPOSED"); } };
}
export type ViewportCoordinator = ReturnType<typeof createViewportCoordinator>;
export type ViewportController = Readonly<{ capture(): ViewportSample | null; filterInput(): void; request(command: ViewportCommand): Promise<ViewportOutcome> }>;
