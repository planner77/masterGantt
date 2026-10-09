"use client";

import { Gantt, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createCoreActionTrace, type TraceContext, type TraceSample } from "./core-action-trace";
import { readCoreTraceSample } from "./core-trace-observer";

const syntheticTasks: ITask[] = Array.from({ length: 40 }, (_, index) => ({
  id: `fixture-${index + 1}`, text: `Synthetic task ${index + 1}`, parent: 0,
  start: new Date(2026, 0, index + 1), end: new Date(2026, 0, index + 4), duration: 3,
  type: index === 5 ? "milestone" : "task",
}));
const actions = ["scroll-chart", "resize-chart", "filter-tasks", "set-columns", "select-task", "update-task", "delete-task"] as const;
export type FixtureCommand = "scroll120" | "scroll30" | "date" | "rename-core" | "rename-react" | "delete-core" | "filter-empty" | "filter-reset" | "reveal" | "columns" | "resize" | "day" | "week";
export interface CoreTraceFixtureControl {
  configure: (run: string, head: string, scenario: string) => void;
  command: (command: FixtureCommand) => Promise<string>;
  settle: (expected?: { left: number; top: number }) => Promise<string>;
  sample: () => TraceSample;
  snapshot: () => ReturnType<ReturnType<typeof createCoreActionTrace>["snapshot"]>;
}
declare global { interface Window { __issue568?: CoreTraceFixtureControl; } }

function finite(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

export function CoreActionTraceFixture() {
  const root = useRef<HTMLDivElement>(null), api = useRef<IApi | null>(null);
  const [tasks, setTasks] = useState(syntheticTasks), [week, setWeek] = useState(false);
  const [ready, setReady] = useState(false), [result, setResult] = useState("READY");
  const context = useRef<TraceContext>({ run: "manual", head: "unknown", scenario: "initial", layer: "CORE_PUBLIC_API", apiInstance: 0,
    projectRevision: null, canonicalEpoch: 0, projectionEpoch: 0, scope: "synthetic", filterKey: "all", scale: "Day", intentId: 0, intentSource: "initial" });
  const read = useCallback((): TraceSample => {
    if (api.current && root.current) return readCoreTraceSample(api.current, root.current);
    const state = api.current?.getState(), chart = root.current?.querySelector<HTMLElement>(".wx-chart");
    const box = root.current?.getBoundingClientRect(), chartBox = chart?.getBoundingClientRect();
    const active = document.activeElement;
    return {
      core: { left: finite(state?.scrollLeft) ?? 0, top: finite(state?.scrollTop) ?? 0,
        chartWidth: finite(state?._chartWidth), scalesWidth: finite(state?._scales?.width) },
      native: chart ? { left: chart.scrollLeft, top: chart.scrollTop, scrollWidth: chart.scrollWidth,
        clientWidth: chart.clientWidth, scrollHeight: chart.scrollHeight, clientHeight: chart.clientHeight } : null,
      geometry: { width: box?.width ?? 0, height: box?.height ?? 0, chartWidth: chartBox?.width ?? 0, chartHeight: chartBox?.height ?? 0 },
      // 입력값/텍스트/URL/접근성 이름/임의 DOM ID를 기록하지 않는다.
      focus: active?.tagName.toLowerCase() ?? "none",
    };
  }, []);
  const traceRef = useRef<ReturnType<typeof createCoreActionTrace> | null>(null);
  const init = useCallback((instance: IApi) => {
    api.current = instance; context.current.apiInstance = Number(context.current.apiInstance) + 1;
    const trace = createCoreActionTrace(() => ({ ...context.current }), read);
    traceRef.current = trace;
    trace.record("component-mount");
    for (const action of actions) {
      let before = "";
      instance.intercept(action, params => { before = JSON.stringify(read().core); trace.record("core-before", action, params); return true; }, { tag: "issue568" });
      instance.on(action, params => { trace.record("core-after", action, params, before !== JSON.stringify(read().core) ? "CORE_STATE_UPDATED" : undefined); }, { tag: "issue568" });
    }
    setReady(true);
  }, [read]);

  useLayoutEffect(() => { traceRef.current?.record("react-commit"); }, [tasks, week, ready]);
  useEffect(() => {
    if (!ready || !root.current || !api.current || !traceRef.current) return;
    const trace = traceRef.current, element = root.current, instance = api.current;
    const invoke = (action: string, params: object) => {
      trace.record("command-request", action, params);
      const returned: unknown = instance.exec(action, params);
      const thenable = returned !== null && (typeof returned === "object" || typeof returned === "function") && typeof (returned as { then?: unknown }).then === "function";
      trace.record("command-return", action, { returnKind: typeof returned, thenable }, "COMMAND_ACCEPTED");
      // Promise resolve 관측을 settle 판정과 분리한다.
      if (thenable) void Promise.resolve(returned).then(() => trace.record("command-resolved", action), () => trace.record("command-rejected", action));
    };
    window.__issue568 = {
      configure(run, head, scenario) {
        for (const value of [run, head, scenario]) if (!/^[\w.-]{1,64}$/.test(value)) throw new Error("Invalid synthetic trace identity");
        trace.reset(); Object.assign(context.current, { run, head, scenario }); trace.record("scenario-start");
      },
      async command(command) {
        context.current.intentId++; context.current.intentSource = command;
        context.current.layer = command === "rename-react" || command === "day" || command === "week" ? "REACT_WRAPPER" : "CORE_PUBLIC_API";
        let expected: { left: number; top: number } | undefined;
        if (command === "scroll120" || command === "scroll30") {
          expected = { left: command === "scroll120" ? 120 : 30, top: 96 }; invoke("scroll-chart", expected);
        } else if (command === "date") invoke("scroll-chart", { date: new Date(2026, 1, 15) });
        else if (command === "rename-core") invoke("update-task", { id: "fixture-1", task: { text: "Core renamed" } });
        else if (command === "rename-react") {
          context.current.canonicalEpoch++; context.current.projectionEpoch++;
          trace.record("react-effect-request", "update-task");
          setTasks(current => current.map(task => task.id === "fixture-1" ? { ...task, text: "React renamed" } : task));
        } else if (command === "delete-core") invoke("delete-task", { id: "fixture-2" });
        else if (command === "filter-empty" || command === "filter-reset") {
          context.current.filterKey = command === "filter-empty" ? "empty" : "all"; context.current.projectionEpoch++;
          invoke("filter-tasks", { filter: command === "filter-empty" ? () => false : () => true });
        } else if (command === "reveal") invoke("select-task", { id: "fixture-35", show: true });
        else if (command === "columns") { context.current.projectionEpoch++; invoke("set-columns", { columns: [{ id: "text", header: "Task", width: 160 }] }); }
        else if (command === "resize") {
          const chart = element.querySelector<HTMLElement>(".wx-chart");
          if (chart) invoke("resize-chart", { width: chart.clientWidth, height: chart.clientHeight, scrollSize: chart.offsetWidth - chart.clientWidth });
        } else if (command === "day" || command === "week") {
          context.current.scale = command === "week" ? "Week" : "Day"; context.current.projectionEpoch++;
          trace.record("react-effect-request", "scale"); setWeek(command === "week");
        }
        const settled = await trace.settle(expected); setResult(settled); return settled;
      },
      settle: expected => trace.settle(expected), sample: read, snapshot: trace.snapshot,
    };
    const input = (event: Event) => {
      context.current.intentId++; context.current.intentSource = `native-${event.type}`;
      const params = event instanceof WheelEvent ? { deltaX: event.deltaX, deltaY: event.deltaY }
        : event instanceof KeyboardEvent ? { key: ["Enter", "Tab", "Escape", "ArrowLeft", "ArrowRight"].includes(event.key) ? event.key : "other" } : {};
      trace.record("native-intent", event.type, params);
    };
    const scroll = () => trace.record("native-scroll");
    for (const event of ["pointerdown", "wheel", "keydown"]) element.addEventListener(event, input, { capture: true, passive: true });
    element.addEventListener("scroll", scroll, true);
    const observer = new ResizeObserver(() => trace.record("resize-observer")); observer.observe(element);
    const chart = element.querySelector(".wx-chart"); if (chart) observer.observe(chart);
    trace.record("react-effect-installed");
    return () => {
      trace.record("react-effect-cleanup"); trace.record("component-unmount"); instance.detach("issue568");
      for (const event of ["pointerdown", "wheel", "keydown"]) element.removeEventListener(event, input, true);
      element.removeEventListener("scroll", scroll, true); observer.disconnect(); trace.dispose(); delete window.__issue568;
    };
  }, [ready, read]);

  return <section aria-labelledby="core-trace-heading">
    <h1 id="core-trace-heading">Core 2.7.3 Action Trace</h1>
    <p>명시적으로 활성화한 개발·테스트 전용 합성 fixture입니다. 서버 데이터를 조회하거나 저장하지 않습니다.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {(["scroll120", "date", "rename-core", "rename-react", "filter-empty", "filter-reset", "reveal", "columns", "day", "week"] as FixtureCommand[]).map(command =>
        <button className="secondary-button" disabled={!ready} key={command} onClick={() => { void window.__issue568?.command(command); }} type="button">{command}</button>)}
    </div>
    <p role="status" data-testid="trace-ready">{ready ? result : "LOADING"}</p>
    <div ref={root} data-testid="core-trace-root" style={{ height: 420, width: "100%", minWidth: 0 }}>
      <Willow><div style={{ height: 420, minWidth: 0 }}><Gantt init={init} tasks={tasks} links={[]} autoScale={false} readonly gridWidth={200}
        start={new Date(2026, 0, 1)} end={new Date(2026, 5, 1)} cellWidth={week ? 100 : 40}
        scales={[{ unit: week ? "week" : "day", step: 1, format: week ? "%d %M" : "%d" }]}
        columns={[{ id: "text", header: "Task", width: 200 }]} /></div></Willow>
    </div>
  </section>;
}
