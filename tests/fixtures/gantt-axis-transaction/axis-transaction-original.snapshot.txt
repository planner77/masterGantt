import type { ConsistencyAbortPort, ConsistencyClockPort, GeometryReaderPort, GeometryReadResult, UserIntentLease } from "../state-consistency";
import { calendarYearBounds } from "../adapter/gantt-adapter";
import type { ViewportOutcome, ViewportPosition } from "./viewport-coordinator";

export interface AxisExtent { readonly startMs: number; readonly endMs: number }
export interface AxisObservation extends AxisExtent { readonly scaleWidth: number }
export type AxisViewportPolicy = Readonly<{ kind: "PRESERVE"; allowClamp?: boolean }> | Readonly<{ kind: "ORIGIN"; allowClamp?: boolean }> |
  Readonly<{ kind: "POSITION"; position: ViewportPosition; allowClamp?: boolean }>;
export interface AxisTransactionRequest {
  readonly extent: AxisExtent;
  readonly policy: AxisViewportPolicy;
  readonly lease: UserIntentLease;
  readonly abort: ConsistencyAbortPort;
}
export interface AxisWriteContext {
  readonly signal: AbortSignal;
  readonly lease: UserIntentLease;
  current(): boolean;
}
export interface AxisTransactionResult {
  readonly outcome: ViewportOutcome;
  readonly reason: string;
  readonly viewport: "PRESERVED" | "APPLIED" | "CLAMPED" | "UNAVAILABLE";
  readonly position?: ViewportPosition;
  readonly requestedPosition?: ViewportPosition;
  readonly axis?: AxisObservation;
  readonly capacity?: ViewportPosition;
}
export interface AxisTransactionOptions {
  readonly apiInstance: string;
  readonly geometry: GeometryReaderPort;
  readonly clock: ConsistencyClockPort;
  readonly strategy: "EXPLICIT_EXTENT" | "SYNTHETIC_COMPATIBILITY";
  /** Compatibility is isolated, opt-in and tied to the installed wrapper/store. */
  readonly compatibility?: Readonly<{ enabled: boolean; wrapperVersion: string; storeVersion: string; source: object }>;
  readAxis(): AxisObservation;
  isLeaseCurrent(lease: UserIntentLease): boolean;
  changeExtent(extent: AxisExtent, context: AxisWriteContext): void | boolean | Promise<void | boolean>;
  applyPosition(position: ViewportPosition, context: AxisWriteContext): void | boolean | Promise<void | boolean>;
  readonly maxFrames?: number;
  readonly maxDurationMs?: number;
  readonly maxScaleWidth?: number;
  readonly maxExtensions?: number;
}
// A cancelled synthetic write may outlive the facade. Never reset its source
// taint by constructing another facade for the same API/context.
const taintedCompatibilitySources = new WeakSet<object>();
const finitePosition = (position: ViewportPosition) => [position.left, position.top].every(value => Number.isFinite(value) && value >= 0);
const validAxis = (axis: AxisObservation, bound: number) => Number.isFinite(axis.startMs) && Number.isFinite(axis.endMs) &&
  axis.endMs > axis.startMs && Number.isFinite(new Date(axis.startMs).getTime()) && Number.isFinite(new Date(axis.endMs).getTime()) && Number.isFinite(axis.scaleWidth) && axis.scaleWidth > 0 && axis.scaleWidth <= bound;
const exceedsDateSpan = (extent: AxisExtent) => extent.endMs > calendarYearBounds(new Date(extent.startMs)).upper.getTime();
const covers = (axis: AxisObservation, extent: AxisExtent) => axis.startMs <= extent.startMs && axis.endMs >= extent.endMs;
const capacityOf = (read: Extract<GeometryReadResult, { ok: true }>): ViewportPosition => ({
  left: Math.max(0, read.value.scrollWidth - read.value.chartWidth),
  top: Math.max(0, read.value.scrollHeight - read.value.verticalClientHeight),
});
const measurable = (read: Extract<GeometryReadResult, { ok: true }>) => Object.values(read.value).every(Number.isFinite) &&
  read.value.chartWidth > 0 && read.value.chartHeight > 0 && read.value.verticalClientHeight > 0 &&
  read.value.scrollWidth >= read.value.chartWidth && read.value.scrollHeight >= read.value.verticalClientHeight && finitePosition(read.core) && finitePosition({ left: read.value.left, top: read.value.top });

/** Isolated facade: callbacks own writes; API returns never certify axis or viewport completion.
 * No production coordinator is installed and no lease is minted after an await. */
export function createAxisTransaction(options: AxisTransactionOptions) {
  const maxFrames = options.maxFrames ?? 120, maxDuration = options.maxDurationMs ?? 1500;
  const maxScaleWidth = options.maxScaleWidth ?? 1_000_000, maxExtensions = options.maxExtensions ?? 3;
  if (!options.apiInstance || !Number.isInteger(maxFrames) || maxFrames < 3 || maxFrames > 600 || !Number.isFinite(maxDuration) || maxDuration <= 0 || maxDuration > 5000 ||
    !Number.isFinite(maxScaleWidth) || maxScaleWidth <= 0 || maxScaleWidth > 1_000_000 || !Number.isInteger(maxExtensions) || maxExtensions < 1 || maxExtensions > 3)
    throw new Error("Invalid axis transaction budget");
  let active: { key: string; lease: UserIntentLease; abort: ConsistencyAbortPort; controller: AbortController; promise: Promise<AxisTransactionResult> } | null = null;
  let disposed = false, tainted = false, extensions = 0;
  const reject = (outcome: ViewportOutcome, reason: string): AxisTransactionResult => ({ outcome, reason, viewport: "UNAVAILABLE" });
  const run = (input: AxisTransactionRequest): Promise<AxisTransactionResult> => {
    const key = JSON.stringify([input.extent, input.policy]);
    if (active) return active.key === key && active.lease === input.lease && active.abort === input.abort
      ? active.promise : Promise.resolve(reject("UNSUPPORTED", "BUSY"));
    if (disposed) return Promise.resolve(reject("SUPERSEDED", "DISPOSED"));
    if (tainted || (options.strategy === "SYNTHETIC_COMPATIBILITY" && !!options.compatibility?.source && taintedCompatibilitySources.has(options.compatibility.source))) return Promise.resolve(reject("UNSUPPORTED", "COMPATIBILITY_TAINTED"));
    const request = { ...input, extent: { ...input.extent }, policy: input.policy.kind === "POSITION" ? { ...input.policy, position: { ...input.policy.position } } : { ...input.policy } };
    const controller = new AbortController();
    let authorityReadFailed = false;
    const current = () => {
      if (authorityReadFailed) return false;
      try {
        return !disposed && !controller.signal.aborted && !request.abort.signal.aborted && request.abort.isCurrent() && options.isLeaseCurrent(request.lease);
      } catch { authorityReadFailed = true; return false; }
    };
    const context: AxisWriteContext = { signal: controller.signal, lease: request.lease, current };
    const onAbort = () => controller.abort(request.abort.signal.reason);
    request.abort.signal.addEventListener("abort", onAbort, { once: true });
    const execute = async (): Promise<AxisTransactionResult> => {
      let changed = false, settled = false, frames = 0;
      const deadline = options.clock.now() + maxDuration;
      const frame = async () => {
        if (!current()) throw new Error("SUPERSEDED");
        if (frames++ >= maxFrames || options.clock.now() >= deadline) throw new Error("TIMED_OUT");
        const animated = await options.clock.frame(controller.signal);
        if (!current()) throw new Error("SUPERSEDED");
        if (options.clock.now() >= deadline) throw new Error("TIMED_OUT");
        return animated;
      };
      // Bound even a command Promise that never resolves. Each callback must also
      // guard delayed writes with context.current()/signal (no rollback after cancel).
      const write = async (callback: () => void | boolean | Promise<void | boolean>) => {
        let done = false;
        const operation = Promise.resolve().then(() => {
          if (!current()) throw new Error("SUPERSEDED");
          return callback();
        }).finally(() => { done = true; });
        const monitor = async () => { while (!done) await frame(); return operation; };
        const value = await Promise.race([operation, monitor()]);
        if (!current()) throw new Error("SUPERSEDED");
        if (value === false) throw new Error("COMMAND_REJECTED");
      };
      try {
        if (!current()) {
          if (authorityReadFailed) return reject("FAILED", "PORT_FAILED");
          return reject("SUPERSEDED", "STALE_LEASE");
        }
        if (options.strategy !== "EXPLICIT_EXTENT" && options.strategy !== "SYNTHETIC_COMPATIBILITY") return reject("UNSUPPORTED", "INVALID_STRATEGY");
        if (!Number.isFinite(request.extent.startMs) || !Number.isFinite(request.extent.endMs) || request.extent.endMs <= request.extent.startMs ||
          (request.policy.kind === "POSITION" && !finitePosition(request.policy.position))) return reject("UNSUPPORTED", "INVALID_REQUEST");
        if (options.strategy === "SYNTHETIC_COMPATIBILITY" && (!options.compatibility?.enabled || options.compatibility.wrapperVersion !== "2.7.3" || options.compatibility.storeVersion !== "2.7.2" || !options.compatibility.source || typeof options.compatibility.source !== "object"))
          return reject("UNSUPPORTED", "COMPATIBILITY_NOT_APPROVED");
        const initial = options.geometry.readGeometry();
        if (!initial.ok) return reject(initial.outcome, "PREPARE_GEOMETRY_UNAVAILABLE");
        if (!measurable(initial)) return reject("NOT_MEASURABLE", "PREPARE_GEOMETRY_INVALID");
        const before = options.readAxis();
        if (exceedsDateSpan(before)) return reject("UNSUPPORTED", "DATE_SPAN_EXCEEDED");
        if (!validAxis(before, maxScaleWidth)) return reject("UNSUPPORTED", "AXIS_BOUND_EXCEEDED");
        const lower = calendarYearBounds(new Date(before.startMs)).lower.getTime();
        const upper = calendarYearBounds(new Date(before.endMs)).upper.getTime();
        if (request.extent.startMs < lower || request.extent.endMs > upper)
          return reject("UNSUPPORTED", "DATE_BOUND_EXCEEDED");
        const extent = { startMs: Math.min(before.startMs, request.extent.startMs), endMs: Math.max(before.endMs, request.extent.endMs) };
        if (exceedsDateSpan(extent)) return reject("UNSUPPORTED", "DATE_SPAN_EXCEEDED");
        const original = { ...initial.core };
        if (!covers(before, extent)) {
          if (extensions >= maxExtensions) return reject("UNSUPPORTED", "EXTENSION_BUDGET_EXCEEDED");
          changed = true; extensions++;
          await write(() => options.changeExtent(extent, context));
        }
        let observed = options.readAxis();
        if (exceedsDateSpan(observed)) return reject("UNSUPPORTED", "DATE_SPAN_EXCEEDED");
        // Prop commit and Core computation may follow callback return on later frames.
        while (!validAxis(observed, maxScaleWidth) || !covers(observed, extent)) {
          if (Number.isFinite(observed.scaleWidth) && observed.scaleWidth > maxScaleWidth) return reject("UNSUPPORTED", "AXIS_BOUND_EXCEEDED");
          await frame(); observed = options.readAxis();
          if (exceedsDateSpan(observed)) return reject("UNSUPPORTED", "DATE_SPAN_EXCEEDED");
        }
        // Physical layout must stabilize independently of date coverage before
        // selecting a position policy; a prop receipt alone is insufficient.
        let geometry = options.geometry.readGeometry(), geometrySignature = "", geometryStable = 0;
        while (geometryStable < 3) {
          const animated = await frame(); geometry = options.geometry.readGeometry();
          if (!geometry.ok) return reject(geometry.outcome, "GEOMETRY_UNAVAILABLE");
          if (!measurable(geometry)) return reject("NOT_MEASURABLE", "GEOMETRY_INVALID");
          const axis = options.readAxis();
          if (exceedsDateSpan(axis)) return reject("UNSUPPORTED", "DATE_SPAN_EXCEEDED");
          if (!validAxis(axis, maxScaleWidth) || !covers(axis, extent)) return reject("SUPERSEDED", "AXIS_CHANGED");
          const signature = JSON.stringify([axis, geometry.value.chartWidth, geometry.value.chartHeight, geometry.value.scrollWidth, geometry.value.scrollHeight, geometry.value.verticalClientHeight, geometry.value.chartX, geometry.value.chartY, geometry.value.gridWidth]);
          geometryStable = animated ? (signature === geometrySignature ? geometryStable + 1 : 1) : 0;
          geometrySignature = signature; observed = axis;
        }
        if (!geometry.ok) return reject(geometry.outcome, "GEOMETRY_UNAVAILABLE");
        if (!measurable(geometry)) return reject("NOT_MEASURABLE", "GEOMETRY_INVALID");
        const requested = request.policy.kind === "PRESERVE" ? original : request.policy.kind === "ORIGIN" ? { left: 0, top: 0 } : request.policy.position;
        const capacity = capacityOf(geometry);
        const target = { left: Math.min(requested.left, capacity.left), top: Math.min(requested.top, capacity.top) };
        const clamped = target.left !== requested.left || target.top !== requested.top;
        if (clamped && !request.policy.allowClamp) return { ...reject("NO_SCROLL_CAPACITY", "PRESERVATION_UNAVAILABLE"), requestedPosition: requested, capacity, axis: observed };
        await write(() => options.applyPosition(target, context));
        let stable = 0, signature = "";
        while (true) {
          const animated = await frame(), read = options.geometry.readGeometry(), axis = options.readAxis();
          if (exceedsDateSpan(axis)) return reject("UNSUPPORTED", "DATE_SPAN_EXCEEDED");
          if (!read.ok) return reject(read.outcome, "SETTLE_GEOMETRY_UNAVAILABLE");
          if (!measurable(read)) return reject("NOT_MEASURABLE", "SETTLE_GEOMETRY_INVALID");
          if (!validAxis(axis, maxScaleWidth) || !covers(axis, extent)) return reject("SUPERSEDED", "AXIS_CHANGED");
          const available = capacityOf(read);
          if (available.left < target.left || available.top < target.top) return { ...reject("NO_SCROLL_CAPACITY", "CAPACITY_CHANGED"), axis, capacity: available };
          const nextSignature = JSON.stringify([axis, read.value.chartWidth, read.value.chartHeight, read.value.scrollWidth, read.value.scrollHeight, read.value.verticalClientHeight, read.value.chartX, read.value.chartY, read.value.gridWidth]);
          const coherent = read.core.left === target.left && read.core.top === target.top &&
            Math.abs(read.value.left - target.left) <= 1 && Math.abs(read.value.top - target.top) <= 1;
          stable = animated && coherent ? (signature === nextSignature ? stable + 1 : 1) : 0;
          signature = nextSignature;
          if (stable >= 3) {
            settled = true;
            return { outcome: "SETTLED", reason: clamped ? "CAPACITY_CLAMPED" : "AXIS_AND_VIEWPORT_CONFIRMED", viewport: clamped ? "CLAMPED" : request.policy.kind === "PRESERVE" ? "PRESERVED" : "APPLIED", position: target, requestedPosition: requested, axis, capacity: available };
          }
        }
      } catch (error) {
        const stillCurrent = current();
        const message = error instanceof Error ? error.message : "";
        const reason = authorityReadFailed ? "PORT_FAILED" : ["SUPERSEDED", "TIMED_OUT", "COMMAND_REJECTED"].includes(message) ? message : "PORT_FAILED";
        return reject(authorityReadFailed ? "FAILED" : !stillCurrent || reason === "SUPERSEDED" ? "SUPERSEDED" : reason === "TIMED_OUT" ? "TIMED_OUT" : "FAILED", reason);
      } finally {
        if (changed && !settled && options.strategy === "SYNTHETIC_COMPATIBILITY") {
          tainted = true; if (options.compatibility?.source) taintedCompatibilitySources.add(options.compatibility.source);
        }
        controller.abort();
        request.abort.signal.removeEventListener("abort", onAbort);
      }
    };
    const promise = execute().finally(() => { if (active?.promise === promise) active = null; });
    active = { key, lease: input.lease, abort: input.abort, controller, promise };
    return promise;
  };
  return { run, dispose: () => { disposed = true; active?.controller.abort("DISPOSED"); }, state: () => ({ busy: active !== null, tainted, extensions }) };
}
