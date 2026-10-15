import { createRoot } from "react-dom/client";
import { Gantt, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { createCoreActionTrace } from "../../../src/features/gantt/diagnostics/core-action-trace";
import { readCoreTraceSample } from "../../../src/features/gantt/diagnostics/core-trace-observer";

// Synthetic public-API reader fixture, loaded from file://; no app or HTTP data.
const tasks: ITask[] = [
  { id: "fixture-root", text: "Synthetic root", type: "summary", parent: 0, open: true },
  { id: "fixture-c", text: "Synthetic C", type: "task", parent: "fixture-root", start: new Date(2026, 0, 8), end: new Date(2026, 0, 10), progress: 25 },
  { id: "fixture-a", text: "Synthetic A", type: "task", parent: "fixture-root", start: new Date(2026, 0, 5), end: new Date(2026, 0, 8), progress: 50, externalId: "synthetic-A", projectDisplayKey: "SYN.A" },
  { id: "fixture-m", text: "Synthetic milestone", type: "milestone", parent: 0, start: new Date(2026, 0, 12), duration: 0 },
];
const root = document.getElementById("fixture")!;
function init(api: IApi) {
  const trace = createCoreActionTrace(() => ({
    run: "local-663", head: "synthetic", scenario: "SC-14", layer: "CORE_PUBLIC_API",
    apiInstance: 1, projectRevision: 7, canonicalEpoch: 0, projectionEpoch: 0,
    scope: "synthetic", filterKey: "all", scale: "Day", intentId: 0, intentSource: "fixture",
  }), () => readCoreTraceSample(api, root), 32);
  const capture = () => ({
    serializeTasks: api.serialize({ data: "tasks" }),
    serializeTree: api.serialize({ data: "tree" }),
    serializeLinks: api.serialize({ data: "links" }),
  });
  Object.assign(window, { __gsc663: {
    capture,
    async observe() { trace.record("reader-before"); const result = await trace.settle(); trace.record("reader-after"); return { result, snapshot: capture(), trace: trace.snapshot() }; },
    dispose: () => trace.dispose(),
  } });
  root.dataset.ready = "true";
}
createRoot(root).render(<Willow><Gantt init={init} tasks={tasks}
  links={[{ id: "fixture-link", source: "fixture-a", target: "fixture-c", type: "e2s" }]}
  readonly autoScale={false} start={new Date(2026, 0, 1)} end={new Date(2026, 1, 1)}
  gridWidth={280} columns={[{ id: "text", header: "Synthetic", width: 280 }]}
  scales={[{ unit: "day", step: 1, format: "%d" }]} /></Willow>);
