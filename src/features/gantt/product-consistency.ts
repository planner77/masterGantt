import type { IApi, ITask } from "@svar-ui/react-gantt";
import type { CanonicalProjection } from "./canonical-projection";
import { createCanonicalRecovery } from "./canonical-recovery";
import { verifyCoreConformance } from "./core-conformance";
import { readCoreSnapshot, type DesiredProjectionIdentity, type GeometryReadResult, type UserIntentLease } from "./state-consistency";
import { createProjectionObservation } from "./viewport/projection-observation";
import { expectedPresentationOrder, type PresentationSortClause } from "./state-consistency/presentation-sort";

/** One mounted Core source. Server-confirmed props supply canonical authority;
 * an unresolved HTTP outcome prevents consuming that older snapshot. */
export function createProductConsistency(options: {
  api: IApi; root: HTMLElement; apiInstance: string;
  projection(): CanonicalProjection;
  presentationSort?(): readonly PresentationSortClause[];
  replayPresentationSort?(isCurrent: () => boolean): Promise<void>;
  identity(): DesiredProjectionIdentity;
  visible(): boolean;
  blocked(): boolean;
  intent(): UserIntentLease;
  frame(signal: AbortSignal): Promise<boolean>;
  observationFrame?(signal: AbortSignal): Promise<boolean>;
}) {
  const controller = new AbortController();
  const abort = { signal: controller.signal, isCurrent: () => !controller.signal.aborted };
  const clock = { now: () => performance.now(), frame: options.frame };
  const displayOrder = () => expectedPresentationOrder(options.projection().tasks, options.api.getState().columns ?? [], options.presentationSort?.() ?? []);
  const rawCore = { readCore: () => readCoreSnapshot(options.api) };
  const core = { readCore: () => {
    const sort = options.presentationSort?.() ?? [];
    if (!sort.length) return readCoreSnapshot(options.api);
    const expectedTreeOrder = displayOrder();
    return expectedTreeOrder === null ? { ok: false as const, outcome: "FAILED" as const, reason: "INCONSISTENT_TREE" as const } :
      readCoreSnapshot(options.api, { expectedTreeOrder, canonicalTaskOrder: options.projection().tasks.map(task => String(task.id)) });
  } };
  let recoverySort: readonly PresentationSortClause[] | undefined;
  const recovery = createCanonicalRecovery({ api: options.api, core: rawCore, clock, abort,
    ...(options.presentationSort ? { verificationCore: core, beforeVerification: async (isCurrent: () => boolean) => {
      const current = () => isCurrent() && recoverySort === options.presentationSort?.();
      if (!current()) throw new Error("SUPERSEDED");
      await options.replayPresentationSort?.(current);
      if (!current()) throw new Error("SUPERSEDED");
    } } : {}),
    apiInstance: () => options.apiInstance, currentIdentity: options.identity,
    fetchCanonical: async () => {
      if (options.blocked()) throw new Error("CANONICAL_UNCONFIRMED");
      recoverySort = options.presentationSort?.();
      return { snapshot: options.projection(), identity: options.identity() };
    },
  }, { maxFrames: 120, timeoutMs: 1500 });
  const readGeometry = (): GeometryReadResult => {
    const chart = options.root.querySelector<HTMLElement>(".wx-chart"), vertical = options.root.querySelector<HTMLElement>(".wx-gantt");
    if (!options.visible() || !options.root.isConnected || options.root.closest("[hidden],[inert]") || !chart?.clientWidth || !chart.clientHeight || !vertical?.clientHeight || document.visibilityState === "hidden") return { ok: false, outcome: "NOT_MEASURABLE" };
    const box = chart.getBoundingClientRect(), rootBox = options.root.getBoundingClientRect(), state = options.api.getState();
    return { ok: true, core: { left: state.scrollLeft, top: state.scrollTop }, value: {
      left: chart.scrollLeft, top: vertical.scrollTop, chartX: box.x, chartY: box.y,
      chartWidth: chart.clientWidth, chartHeight: chart.clientHeight, scrollWidth: chart.scrollWidth,
      scrollHeight: vertical.scrollHeight, verticalClientHeight: vertical.clientHeight, gridWidth: box.x - rootBox.x,
    } };
  };
  const readLayoutAxis = () => {
    const state = options.api.getState();
    return { layout: JSON.stringify([state.gridWidth, (state.columns ?? []).map(column => [column.id, column.width, column.hidden]), options.presentationSort?.() ?? []]),
      axis: JSON.stringify([state._start, state._end, state._scales?.width, state.scales]) };
  };
  const observation = createProjectionObservation({ ...core, clock: { ...clock, frame: options.observationFrame ?? options.frame }, abort, readGeometry, readLayoutAxis,
    readExpectedDisplayOrder: () => displayOrder(),
    readRecovery: () => recovery.state().recovery,
    readContext: () => ({ source: recovery.state().source, desired: options.identity(), layoutAxis: readLayoutAxis(), intent: options.intent(), visible: options.visible(), mounted: options.root.isConnected }),
    verifyCore: input => verifyCoreConformance({ reader: core, desired: input.desired, context: recovery.state(), observation: input.observation, current: recovery.state }),
    readRows: () => {
      const state = options.api.getState(), actual = options.api.serialize({ data: "tasks" }) as ITask[] | null;
      const byId = new Map((actual ?? []).map(task => [String(task.id), task]));
      const membership = new Set(options.projection().membershipIds);
      const logical = (displayOrder() ?? []).filter(id => membership.has(id)).filter(id => {
        let parent = byId.get(id)?.parent;
        const seen = new Set<string>();
        while (parent && !seen.has(String(parent))) {
          const key = String(parent); seen.add(key);
          if (membership.has(key) && byId.get(key)?.open === false) return false;
          parent = byId.get(key)?.parent;
        }
        return true;
      });
      const grid = options.root.querySelector<HTMLElement>(".wx-table-container");
      const rows = [...options.root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id], .wx-table-container .wx-row[data-task-id]")].filter(row => row.getClientRects().length > 0);
      const mountedRows = rows.map(row => ({ id: (row.dataset.taskId ?? row.dataset.id ?? "").replace(/^:/, ""),
        text: state.columns?.find(column => column.id === "text")?.hidden ? String(byId.get((row.dataset.taskId ?? row.dataset.id ?? "").replace(/^:/, ""))?.text ?? "") : row.querySelector('[data-col-id=":text"] .wx-content > .wx-text')?.textContent ?? "" }));
      const bars = [...options.root.querySelectorAll<HTMLElement>(".wx-chart .wx-bar[data-task-id]")];
      const aligned = bars.every(bar => {
        const row = rows.find(row => (row.dataset.taskId ?? row.dataset.id ?? "").replace(/^:/, "") === (bar.dataset.taskId ?? "").replace(/^:/, ""));
        if (!row) return true;
        const r = row.getBoundingClientRect(), b = bar.getBoundingClientRect();
        return Math.abs(r.y + r.height / 2 - b.y - b.height / 2) <= 1;
      });
      return { logicalVisibleIds: logical, coreVisibleIds: state._tasks.map(task => String(task.id)), mountedRows,
        requiredMountedIds: grid?.clientWidth ? state._tasks.filter(task => task.$y + task.$h > state.scrollTop && task.$y < state.scrollTop + (state._chartHeight ?? 0)).map(task => String(task.id)) : [],
        measurable: readGeometry().ok, aligned };
    },
  });
  return { recovery, observation, readGeometry,
    dataReady: () => { const state = recovery.state(); return !options.blocked() && !state.dirty && ["IDLE", "SETTLED"].includes(state.recovery.phase); },
    invalidate() { recovery.markDirty(); observation.invalidate(); },
    dispose() { controller.abort(); observation.dispose(); recovery.dispose(); },
  };
}
