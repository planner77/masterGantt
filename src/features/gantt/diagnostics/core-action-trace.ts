/** 테스트 전용 관측 계약. mutation/private store 접근/DOM 쓰기를 하지 않는다. */
export type SettleResult = "COMMAND_ACCEPTED" | "CORE_STATE_UPDATED" | "NATIVE_LAYOUT_SETTLED" | "SUPERSEDED_BY_INTENT" | "NO_SCROLL_CAPACITY" | "TIMED_OUT";
export interface TraceSample {
  core: { left: number; top: number; chartWidth: number | null; scalesWidth: number | null };
  native: { left: number; top: number; scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number } | null;
  geometry: { width: number; height: number; chartWidth: number; chartHeight: number };
  lane?: { width: number; height: number; plotWidth: number } | null;
  focus: string;
}
export interface TraceContext {
  run: string; head: string; scenario: string; layer: "CORE_PUBLIC_API" | "REACT_WRAPPER" | "FULL_APP";
  apiInstance: number | string; projectRevision: number | null; canonicalEpoch: number; projectionEpoch: number;
  scope: string; filterKey: string; scale: string; intentId: number; intentSource: string;
}
export interface TraceEntry extends TraceContext {
  sequence: number; elapsedMs: number; rafTick: number; event: string; action: string;
  params: Record<string, string | number | boolean>; sample: TraceSample; result?: SettleResult;
}
const parameterKeys = new Set(["left", "top", "width", "height", "id", "show", "deltaX", "deltaY", "key", "returnKind", "thenable", "stableFrames", "timeoutMs", "count"]);
/** 원본 action 객체의 작업명/callback/앱 데이터를 직접 기록하지 않는다. */
export function allowlistedTraceParams(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object") return {};
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!parameterKeys.has(key)) continue;
    if (typeof item === "number" && Number.isFinite(item)) safe[key] = item;
    else if (typeof item === "boolean") safe[key] = item;
    else if (typeof item === "string" && item.length <= 64 && /^[\w.: -]+$/.test(item)) safe[key] = item;
  }
  return safe;
}
export function samplesAgree(sample: TraceSample, expected?: { left: number; top: number }): boolean {
  const { core, native } = sample;
  if (!native || native.clientWidth <= 0 || native.clientHeight <= 0 || ![core.left, core.top, native.left, native.top].every(Number.isFinite)) return false;
  if (expected && (core.left !== expected.left || core.top !== expected.top)) return false;
  return Math.abs(core.left - native.left) <= 1 && Math.abs(core.top - native.top) <= 1;
}
/** ID/원본 필터 노출 없이 scope를 구분한다. 권한 token으로 사용하지 않는다. */
export function traceFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `f${(hash >>> 0).toString(16)}`;
}
export function createCoreActionTrace(context: () => TraceContext, read: () => TraceSample, capacity = 512) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 2048) throw new Error("Invalid trace capacity");
  const entries: TraceEntry[] = [];
  let started = performance.now();
  let sequence = 0, rafTick = 0, dropped = 0;
  let disposed = false;
  const pending = new Set<() => void>();
  const record = (event: string, action = "none", params: unknown = {}, result?: SettleResult) => {
    if (disposed) return;
    const identity = { ...context() };
    for (const key of ["run", "head", "scenario", "scope", "filterKey", "scale", "intentSource"] as const) {
      if (!/^[\w.:-]{1,64}$/.test(identity[key])) identity[key] = "redacted";
    }
    entries.push({ ...identity, sequence: ++sequence, elapsedMs: performance.now() - started, rafTick,
      event, action, params: allowlistedTraceParams(params), sample: read(), ...(result ? { result } : {}) });
    if (entries.length > capacity) { entries.shift(); dropped++; }
  };
  const settle = (expected?: { left: number; top: number }, timeoutMs = 1500): Promise<SettleResult> => {
    if (!Number.isFinite(timeoutMs) || (expected && ![expected.left, expected.top].every(Number.isFinite))) throw new Error("Invalid settle bounds");
    if (disposed) return Promise.resolve("SUPERSEDED_BY_INTENT");
    // 숨긴 탭과 멈춘 렌더러에서도 timer/frame 관측은 유한해야 한다.
    const boundedTimeout = Math.min(5000, Math.max(50, timeoutMs));
    const intent = context().intentId;
    return new Promise(resolve => {
      let previous = "", stable = 0, frame = 0, done = false;
      const finish = (result: SettleResult) => {
        if (done) return;
        done = true; clearTimeout(timer); cancelAnimationFrame(frame); pending.delete(cancel);
        record("settle-result", "none", { stableFrames: stable, timeoutMs: boundedTimeout }, result); resolve(result);
      };
      const cancel = () => finish("SUPERSEDED_BY_INTENT");
      pending.add(cancel);
      const timer = setTimeout(() => finish("TIMED_OUT"), boundedTimeout);
      const tick = () => {
        if (done) return;
        rafTick++;
        if (intent !== context().intentId) return finish("SUPERSEDED_BY_INTENT");
        const sample = read();
        const key = JSON.stringify([sample.core, sample.native, sample.geometry, sample.lane]);
        stable = key === previous ? stable + 1 : 1;
        previous = key;
        record("raf-observation");
        if (stable >= 3) {
          if (sample.native && (sample.native.clientWidth <= 0 || sample.native.clientHeight <= 0)) return finish("NO_SCROLL_CAPACITY");
          if (samplesAgree(sample, expected)) return finish("NATIVE_LAYOUT_SETTLED");
          if (expected && sample.native && (expected.left > Math.max(0, sample.native.scrollWidth - sample.native.clientWidth) + 1 || expected.top > Math.max(0, sample.native.scrollHeight - sample.native.clientHeight) + 1)) return finish("NO_SCROLL_CAPACITY");
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  };
  const reset = () => {
    // A new synthetic run must not inherit earlier entries, timestamps or pending settles.
    for (const cancel of [...pending]) cancel();
    entries.length = 0;
    sequence = 0;
    rafTick = 0;
    dropped = 0;
    started = performance.now();
  };
  return { record, settle, reset, snapshot: () => ({ schemaVersion: 1, capacity, dropped, entries: structuredClone(entries) }),
    dispose() { for (const cancel of [...pending]) cancel(); disposed = true; } };
}
