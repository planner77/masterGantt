import type { IApi } from "@svar-ui/react-gantt";
import type { createCoreActionTrace, TraceSample } from "./core-action-trace";

export function readCoreTraceSample(api: IApi, root: HTMLElement): TraceSample {
  const state = api.getState(), chart = root.querySelector<HTMLElement>(".wx-chart"), vertical = root.querySelector<HTMLElement>(".wx-gantt");
  const lane = root.querySelector<HTMLElement>(".project-milestone-lane"), plot = root.querySelector<HTMLElement>(".project-milestone-lane-plot");
  const box = root.getBoundingClientRect(), chartBox = chart?.getBoundingClientRect();
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    core: { left: state.scrollLeft, top: state.scrollTop, chartWidth: finite(state._chartWidth), scalesWidth: finite(state._scales?.width) },
    native: chart && vertical ? { left: chart.scrollLeft, top: vertical.scrollTop, scrollWidth: chart.scrollWidth, clientWidth: chart.clientWidth,
      scrollHeight: vertical.scrollHeight, clientHeight: vertical.clientHeight } : null,
    geometry: { width: box.width, height: box.height, chartWidth: chartBox?.width ?? 0, chartHeight: chartBox?.height ?? 0 },
    focus: document.activeElement?.tagName.toLowerCase() ?? "none",
    lane: lane ? { width: lane.getBoundingClientRect().width, height: lane.getBoundingClientRect().height, plotWidth: plot?.getBoundingClientRect().width ?? 0 } : null,
  };
}

/** 읽기 전용 listener. exec 교체/좌표 쓰기/scheduling 변경을 하지 않는다. */
export function observeCoreTrace(api: IApi, root: HTMLElement, trace: ReturnType<typeof createCoreActionTrace>, onIntent: (source: string) => void) {
  const tag = "issue568-action-trace";
  for (const action of ["scroll-chart", "resize-chart", "filter-tasks", "set-columns", "select-task", "update-task", "delete-task"] as const) {
    let before = "";
    api.intercept(action, params => { before = JSON.stringify(readCoreTraceSample(api, root).core); trace.record("core-before", action, params); return true; }, { tag });
    api.on(action, params => trace.record("core-after", action, params, before !== JSON.stringify(readCoreTraceSample(api, root).core) ? "CORE_STATE_UPDATED" : undefined), { tag });
  }
  const input = (event: Event) => {
    onIntent(`native-${event.type}`);
    trace.record("native-intent", event.type, event instanceof WheelEvent ? { deltaX: event.deltaX, deltaY: event.deltaY }
      : event instanceof KeyboardEvent ? { key: ["Enter", "Tab", "Escape", "ArrowLeft", "ArrowRight"].includes(event.key) ? event.key : "other" } : {});
  };
  const scroll = () => trace.record("native-scroll");
  for (const event of ["pointerdown", "wheel", "keydown"]) root.addEventListener(event, input, { capture: true, passive: true });
  root.addEventListener("scroll", scroll, true);
  const observer = new ResizeObserver(() => trace.record("resize-observer")); observer.observe(root);
  const chart = root.querySelector(".wx-chart"); if (chart) observer.observe(chart);
  trace.record("observer-installed");
  return () => {
    trace.record("observer-cleanup"); api.detach(tag);
    for (const event of ["pointerdown", "wheel", "keydown"]) root.removeEventListener(event, input, true);
    root.removeEventListener("scroll", scroll, true); observer.disconnect(); trace.dispose();
  };
}
