"use client";
import { Gantt, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createGanttAdapter, type GanttAdapter } from "../adapter/gantt-adapter";
import type { TraceContext } from "./core-action-trace";

// 기본 weekStart(Sunday)와 정렬한 공개 controlled 원점이다.
const ORIGIN = new Date(2026, 0, 4).getTime();
const INITIAL_END = new Date(2026, 6, 6).getTime();
const emptyLinks: [] = [];
const fixtureColumns = [{ id: "text", header: "작업", width: 200 }];
const tasks: ITask[] = Array.from({ length: 40 }, (_, index) => ({ id: `synthetic-${index + 1}`, text: `합성 작업 ${index + 1}`, type: index === 5 ? "milestone" : "task", parent: 0,
  start: new Date(2026, 0, index + 5), end: new Date(2026, 0, index === 5 ? index + 5 : index + 8), duration: index === 5 ? 0 : 3 }));
export interface AdapterTrialControl {
  sample: () => ReturnType<GanttAdapter["sample"]> & { apiInstance: number; mode: string; scale: string };
  settle: GanttAdapter["settle"];
  configure: (run: string, head: string) => void;
  scroll: GanttAdapter["scroll"];
  revealDate: (dateMs: number) => ReturnType<GanttAdapter["revealDate"]>;
  point: (dateMs: number) => ReturnType<GanttAdapter["dateToViewportPx"]>;
  inverse: GanttAdapter["viewportPxToDate"];
  extend: () => Promise<unknown>;
  taskEvidence: () => { core: Array<{ id: string; type: string; startMs: number | null; endMs: number | null }> | null; dom: string[] };
  resizeGrid: () => Promise<unknown>;
  split: () => Promise<unknown>;
  variant: (variant: "normal" | "empty" | "milestone") => Promise<unknown>;
  futureTask: () => Promise<unknown>;
  shortAxis: () => Promise<unknown>;
  trace: GanttAdapter["trace"];
  performance: () => { count: number; p95Ms: number; maximumMs: number };
}
declare global { interface Window { __issue569?: AdapterTrialControl; } }

export function GanttAdapterFixture({ mode, scale }: { mode: "A" | "B" | "C"; scale: "day" | "week" }) {
  const root = useRef<HTMLDivElement>(null), api = useRef<IApi | null>(null), adapterRef = useRef<GanttAdapter | null>(null);
  const instance = useRef(0), extensions = useRef(0), extending = useRef(false), endRef = useRef(INITIAL_END);
  const [ready, setReady] = useState(false), [end, setEnd] = useState(INITIAL_END), [display, setDisplay] = useState<"all" | "chart">("all");
  const [split, setSplit] = useState(false), [variant, setVariant] = useState<"normal" | "empty" | "milestone">("normal");
  const pendingCommits = useRef(new Set<(cancel?: boolean) => void>());
  const [future, setFuture] = useState(false);
  const [startDate] = useState(() => new Date(ORIGIN));
  const endDate = useMemo(() => new Date(end), [end]);
  const scales = useMemo(() => [{ unit: scale, step: 1, format: "%d %M" }], [scale]);
  const context = useRef<TraceContext>({ run: "manual", head: "unknown", scenario: `adapter-${mode}-${scale}`, layer: "REACT_WRAPPER", apiInstance: 0,
    projectRevision: null, canonicalEpoch: 0, projectionEpoch: 0, scope: "synthetic", filterKey: "all", scale, intentId: 0, intentSource: "initial" });
  useLayoutEffect(() => {
    endRef.current = end; context.current.projectionEpoch++;
    for (const finish of [...pendingCommits.current]) finish();
  }, [end, display, split, variant, future]);
  const init = useCallback((value: IApi) => { api.current = value; instance.current++; context.current.apiInstance = instance.current; setReady(true); }, []);
  useEffect(() => {
    if (!ready || !api.current || !root.current) return;
    const value = api.current, element = root.current, commitWaiters = pendingCommits.current;
    const adapter = createGanttAdapter({ api: value, root: element, installedVersion: "2.7.3", context: () => ({ ...context.current }), compatibilityResize: mode === "C",
      axis: { origin: () => new Date(ORIGIN), unit: () => scale, cellWidth: () => scale === "day" ? 36 : 68 } });
    adapterRef.current = adapter;
    // React 요청 뒤 실제 layout commit을 받은 후에만 3-frame settle을 시작한다.
    const commit = (update: () => void): Promise<string> => new Promise(resolve => {
      const requestedEpoch = context.current.projectionEpoch;
      let completed = false;
      const finish = (cancel = false) => {
        if (cancel) { completed = true; clearTimeout(timer); pendingCommits.current.delete(finish); resolve("DISPOSED"); return; }
        if (completed || context.current.projectionEpoch <= requestedEpoch) return;
        completed = true; clearTimeout(timer); pendingCommits.current.delete(finish); resolve("REACT_COMMITTED");
      };
      const timer = setTimeout(() => { completed = true; pendingCommits.current.delete(finish); resolve("TIMED_OUT"); }, 1500);
      pendingCommits.current.add(finish); update();
    });
    const afterCommit = async (update: () => void) => {
      const commitResult = await commit(update);
      return commitResult === "REACT_COMMITTED" ? adapter.settle() : commitResult;
    };
    const sample = () => ({ ...adapter.sample(), apiInstance: instance.current, mode, scale });
    void value.exec("select-task", { id: "synthetic-10", show: false });
    window.__issue569 = {
      sample, settle: adapter.settle, scroll: adapter.scroll, trace: adapter.trace,
      configure(run, head) { if ([run, head].some(item => !/^[\w.-]{1,64}$/.test(item))) throw new Error("Invalid diagnostic identity"); Object.assign(context.current, { run, head }); },
      revealDate: date => adapter.revealDate(new Date(date)), point: date => adapter.dateToViewportPx(new Date(date)), inverse: adapter.viewportPxToDate,
      taskEvidence() {
        const observed = (value.getState() as unknown as { tasks?: ITask[] }).tasks;
        const core = Array.isArray(observed) ? observed.map(task => ({
          id: String(task.id), type: String(task.type ?? "task"),
          startMs: task.start instanceof Date ? task.start.getTime() : null,
          endMs: task.end instanceof Date ? task.end.getTime() : null,
        })) : null;
        const dom = Array.from(element.querySelectorAll<HTMLElement>("[data-task-id]"),
          node => node.getAttribute("data-task-id")?.replace(/^:/, "") ?? "")
          .filter(id => id.startsWith("synthetic-"));
        return { core, dom };
      },
      async extend() {
        const before = sample();
        if (extending.current) return { result: "BUSY", before, after: sample() };
        if (extensions.current >= 3) return { result: "BOUND_EXCEEDED", before, after: sample() };
        extending.current = true;
        try {
          extensions.current++;
          let result: string;
          if (mode === "C") {
            result = await adapter.resizeCompatibility((before.core.scaleWidth ?? 0) + (scale === "day" ? 36 * 91 : 68 * 13));
          } else {
            const next = new Date(endRef.current); next.setDate(next.getDate() + 91); result = await afterCommit(() => setEnd(next.getTime()));
          }
          const after = sample();
          const checks = { instance: before.apiInstance === after.apiInstance, selection: JSON.stringify(before.core.selected) === JSON.stringify(after.core.selected),
            origin: before.core.originMs === after.core.originMs, position: before.core.left === after.core.left && before.core.top === after.core.top,
            range: after.core.scaleWidth !== null && before.core.scaleWidth !== null && after.core.scaleWidth > before.core.scaleWidth,
            capacity: before.geometry.ok && after.geometry.ok && after.geometry.value.scrollWidth > before.geometry.value.scrollWidth };
          return { mode, extension: extensions.current, result, checks, supported: result === "NATIVE_LAYOUT_SETTLED" && Object.values(checks).every(Boolean), before, after };
        } finally { extending.current = false; }
      },
      async resizeGrid() { await value.exec("set-columns", { columns: [{ id: "text", header: "작업", width: 240 }] }); await value.exec("resize-grid", { width: 240 }); return { result: await adapter.settle(), sample: sample() }; },
      async split() { return { result: await afterCommit(() => setSplit(current => !current)), sample: sample() }; },
      async variant(next) { return { result: await afterCommit(() => setVariant(next)), sample: sample() }; },
      async shortAxis() { return { result: await afterCommit(() => setEnd(new Date(2026, 3, 6).getTime())), sample: sample() }; },
      async futureTask() { const before = sample(); return { result: await afterCommit(() => setFuture(true)), before, after: sample() }; },
      performance() {
        const times: number[] = [];
        for (let index = 0; index < 100; index++) { const start = performance.now(); adapter.readGeometry(); adapter.readCore(); times.push(performance.now() - start); }
        times.sort((a, b) => a - b); return { count: times.length, p95Ms: times[94], maximumMs: times[99] };
      },
    };
    return () => { for (const cancel of [...commitWaiters]) cancel(true); adapter.dispose(); adapterRef.current = null; delete window.__issue569; };
  }, [ready, mode, scale]);
  const visibleTasks = useMemo(() => variant === "empty" ? [] : variant === "milestone" ? tasks.filter(task => task.type === "milestone") : future ? tasks.map(task => task.id === "synthetic-40" ? { ...task, start: new Date(2028, 0, 5), end: new Date(2028, 0, 8) } : task) : tasks, [variant, future]);
  return <section>
    <h1>Gantt Adapter PoC {mode} / {scale}</h1>
    <p>개발·테스트 전용 합성 데이터입니다. 확장 후보의 실패도 원본 관측으로 남깁니다.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button className="secondary-button" type="button" onClick={() => setDisplay(current => current === "all" ? "chart" : "all")}>Chart 확대 / Grid 복원</button>
      <button className="secondary-button" type="button" onClick={() => { void root.current?.requestFullscreen(); }}>전체 화면</button>
      <button className="secondary-button" type="button" onClick={() => { void window.__issue569?.extend(); }}>우측 범위 확장</button>
    </div>
    <div aria-label="합성 Milestone 읽기 목록"><span>합성 Milestone · 2026-01-10</span></div>
    <div ref={root} data-testid="adapter-root" style={{ height: 420, width: split ? "60%" : "100%", minWidth: 0 }}>
      <Willow><div style={{ height: 420, minWidth: 0 }}><Gantt readonly init={init} tasks={visibleTasks} links={emptyLinks} autoScale={mode === "A"}
        start={startDate} end={mode === "C" ? undefined : endDate} gridWidth={200} displayMode={display}
        cellWidth={scale === "day" ? 36 : 68} scales={scales} columns={fixtureColumns} /></div></Willow>
    </div>
  </section>;
}
