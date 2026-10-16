import { createRoot } from "react-dom/client";
import { Gantt, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { createCanonicalRecovery, type MutationOutcome } from "../../../src/features/gantt/canonical-recovery";
import { readCoreSnapshot, normalizeCanonicalCore, type DesiredProjectionIdentity } from "../../../src/features/gantt/state-consistency";
import { sameConformanceSnapshot } from "../../../src/features/gantt/core-conformance";

// Synthetic installation fixture only: no production route, server or DB.
const day = (value: number) => new Date(2026, 0, value);
const tasks: ITask[] = [
  { id: "fixture-root", text: "Synthetic root", type: "summary", parent: 0, open: true },
  ...["a", "b", "c"].map((key, index) => ({ id: `fixture-${key}`, text: `Synthetic ${key}`, type: "task", parent: "fixture-root", start: day(5 + index * 3), end: day(7 + index * 3), progress: 0 })),
  { id: "fixture-m", text: "Synthetic milestone", type: "milestone", parent: 0, start: day(18), duration: 0 },
];
const links = [
  { id: "fixture-ab", source: "fixture-a", target: "fixture-b", type: "e2s" },
  { id: "fixture-bc", source: "fixture-b", target: "fixture-c", type: "e2s" },
];
const root = document.getElementById("fixture")!;
const identity: DesiredProjectionIdentity = { revision: 7, keys: { data: "synthetic-data", structure: "synthetic-tree", membership: "all", layout: "day" }, query: "", scope: null };
function init(api: IApi) {
  const original = { tasks: structuredClone(tasks), links: structuredClone(links) };
  const expected = normalizeCanonicalCore(original);
  if (!expected.ok) throw new Error("invalid synthetic input");
  const abort = new AbortController();
  let fetches = 0;
  const actions: string[] = [];
  const controller = createCanonicalRecovery({
    core: { readCore: () => readCoreSnapshot(api) },
    api: { getTask: id => api.getTask(id), exec: (action, payload) => { actions.push(action); return api.exec(action, payload); } },
    clock: { now: () => performance.now(), frame: signal => new Promise(resolve => {
      if (signal.aborted) { resolve(false); return; }
      const cancel = () => { cancelAnimationFrame(frame); resolve(false); };
      const frame = requestAnimationFrame(() => { signal.removeEventListener("abort", cancel); resolve(true); });
      signal.addEventListener("abort", cancel, { once: true });
    }) },
    abort: { signal: abort.signal, isCurrent: () => true },
    currentIdentity: () => identity, apiInstance: () => "actual-core-664",
    fetchCanonical: async () => { fetches++; return { snapshot: structuredClone(original), identity: structuredClone(identity) }; },
  });
  const capture = () => ({ tasks: api.serialize({ data: "tasks" }), tree: api.serialize({ data: "tree" }), links: api.serialize({ data: "links" }) });
  const match = () => { const actual = readCoreSnapshot(api); return actual.ok && sameConformanceSnapshot(actual.value, expected.value); };
  const position = () => { const state = api.getState(); return { left: state.scrollLeft, top: state.scrollTop }; };
  async function run(name: string, outcome: MutationOutcome, mutate: () => Promise<unknown>) {
    const ticket = controller.beginMutation(name, ["fixture-a", "fixture-b", "fixture-c"]);
    if (!ticket) throw new Error(`cannot begin ${name}`);
    await mutate();
    const driftDetected = !match();
    if (!controller.completeMutation(ticket, outcome)) throw new Error(`cannot complete ${name}`);
    actions.length = 0;
    const result = await controller.recover();
    return { name, outcome: result.outcome, driftDetected, finalMatch: match(), actions: [...actions], reads: fetches, position: position(), selected: api.getState().selected, treeOpen: api.getTask("fixture-root").open };
  }
  Object.assign(window, { __gsc664: {
    capture,
    async run() {
      const rows = [];
      await api.exec("select-task", { id: "fixture-b" });
      const before = position();
      actions.length = 0;
      const noOp = await controller.recover();
      rows.push({ name: "fresh-dto-no-op", outcome: noOp.outcome, finalMatch: match(), actions: [...actions], position: position() });
      rows.push(await run("dnd-412", 412, () => api.exec("move-task", { id: "fixture-c", mode: "before", target: "fixture-b" })));
      rows.push(await run("dnd-500-not-committed", 500, () => api.exec("move-task", { id: "fixture-c", mode: "before", target: "fixture-b" })));
      rows.push(await run("date-422", 422, () => api.exec("update-task", { id: "fixture-b", task: { start: day(9), end: day(11) } })));
      rows.push(await run("add-422", 422, () => api.exec("add-task", { id: "fixture-temp", task: { id: "fixture-temp", text: "Synthetic temp", type: "task", start: day(8), end: day(10) }, select: false })));
      rows.push(await run("link-delete-422", 422, () => api.exec("delete-link", { id: "fixture-ab" })));
      rows.push(await run("task-delete-422", 422, () => api.exec("delete-task", { id: "fixture-c" })));
      rows.push(await run("link-add-422", 422, () => api.exec("add-link", { link: { id: "fixture-temp-link", source: "fixture-m", target: "fixture-c", type: "e2s" } })));
      rows.push(await run("metadata-422", 422, () => api.exec("update-task", { id: "fixture-b", task: { externalId: "synthetic-rejected", projectDisplayKey: "SYN.REJECTED" } })));
      rows.push(await run("parent-add-422-surviving-child", 422, async () => {
        await api.exec("add-task", { id: "fixture-temp-parent", task: { id: "fixture-temp-parent", text: "Synthetic temporary parent", type: "summary" }, select: false });
        return api.exec("move-task", { id: "fixture-a", mode: "child", target: "fixture-temp-parent" });
      }));
      rows.push(await run("type-422", 422, () => api.exec("update-task", { id: "fixture-b", task: { type: "milestone" } })));
      rows.push(await run("collapsed-dnd-412", 412, async () => {
        await api.exec("open-task", { id: "fixture-root", mode: false });
        return api.exec("move-task", { id: "fixture-c", mode: "before", target: "fixture-b" });
      }));
      return { collection: "SYNTHETIC_CORE_BROWSER", before, rows, snapshot: capture(), environment: { browser: navigator.userAgent, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, viewport: { width: innerWidth, height: innerHeight } }, serverMutationCalls: 0 };
    },
    dispose: () => { controller.dispose(); abort.abort(); },
  } });
  root.dataset.ready = "true";
}
createRoot(root).render(<Willow><Gantt init={init} tasks={tasks} links={links}
  readonly autoScale={false} start={day(1)} end={day(31)} gridWidth={280}
  columns={[{ id: "text", header: "Synthetic", width: 280 }]}
  scales={[{ unit: "day", step: 1, format: "%d" }]} /></Willow>);
