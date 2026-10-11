import type { IApi, ITask, ILink } from "@svar-ui/react-gantt";
import type { CanonicalProjection } from "./canonical-projection";

export interface ProjectionReceipt {
  readonly revision: number;
  readonly apiInstance: string;
  readonly generation: number;
  readonly reasons: readonly string[];
  readonly outcome: "SETTLED" | "SUPERSEDED" | "NOT_MEASURABLE" | "TIMED_OUT";
  readonly logicalVisibleIds: readonly string[];
  readonly coreVisibleIds: readonly string[];
  readonly domIds: readonly string[];
  readonly columns: string;
  readonly scale: string;
  readonly scope: string | null;
  readonly filterKey: string;
  readonly taskSelectionChanged: boolean;
  readonly queryConditionsChanged: boolean;
  readonly selectedIds: readonly string[];
}

function sameIds(first: readonly string[], second: readonly string[]) {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}
function sameTask(actual: ITask | undefined, expected: ITask) {
  return actual !== undefined && actual.text === expected.text && actual.type === expected.type &&
    (actual.parent || 0) === (expected.parent || 0) && actual.progress === expected.progress &&
    actual.start?.getTime() === expected.start?.getTime() &&
    (expected.type === "milestone" || actual.end?.getTime() === expected.end?.getTime()) &&
    actual.projectDisplayKey === expected.projectDisplayKey;
}
function linkShape(links: readonly ILink[]) {
  return JSON.stringify(links.map(link => [link.id, link.source, link.target, link.type]));
}

/** Read-only, finite observation of actual Core and native rows. exec receipts
 * are deliberately absent: a resolved command is not a committed projection. */
export function observeProjectionSettled(api: IApi, root: HTMLElement, projection: CanonicalProjection,
  context: { apiInstance: string; generation: number; reasons: readonly string[]; scale: string; scope: string | null; filterKey: string; taskSelectionChanged: boolean; queryConditionsChanged: boolean; expectedColumns: readonly { id: string | undefined; hidden: boolean }[] },
  isCurrent: () => boolean, timeoutMs = 1500): { promise: Promise<ProjectionReceipt>; cancel: () => void } {
  let cancel = () => {};
  const promise = new Promise<ProjectionReceipt>(resolve => {
    let frame = 0, stable = 0, previous = "", done = false;
    let logicalVisibleIds: string[] = [], coreVisibleIds: string[] = [], domIds: string[] = [], columns = "", selectedIds: string[] = [];
    const finish = (outcome: ProjectionReceipt["outcome"]) => {
      if (done) return;
      done = true; cancelAnimationFrame(frame); clearTimeout(timer);
      resolve({ ...context, revision: projection.revision, outcome, logicalVisibleIds, coreVisibleIds, domIds, columns, selectedIds });
    };
    const timer = setTimeout(() => finish(isCurrent() ? "TIMED_OUT" : "SUPERSEDED"), timeoutMs);
    cancel = () => finish("SUPERSEDED");
    const sample = () => {
      if (!isCurrent()) return finish("SUPERSEDED");
      const box = root.getBoundingClientRect();
      if (!root.isConnected || root.closest("[hidden], [inert]") || !box.width || !box.height) return finish("NOT_MEASURABLE");
      const state = api.getState(), actual = api.serialize({ data: "tasks" }) as ITask[] | null;
      const links = api.serialize({ data: "links" }) as ILink[] | null;
      if (!Array.isArray(actual) || !Array.isArray(links) || !Array.isArray(state._tasks)) return finish("NOT_MEASURABLE");
      const byId = new Map(actual.map(task => [String(task.id), task]));
      const membership = new Set(projection.membershipIds);
      logicalVisibleIds = projection.membershipIds.filter(id => {
        let parent = byId.get(id)?.parent;
        const visited = new Set<string>([id]);
        while (parent && byId.has(String(parent)) && !visited.has(String(parent))) {
          const parentId = String(parent);
          if (membership.has(parentId) && byId.get(parentId)?.open === false) return false;
          visited.add(parentId); parent = byId.get(parentId)?.parent;
        }
        return true;
      });
      coreVisibleIds = state._tasks.map(task => String(task.id));
      const rows = [...root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id], .wx-table-container .wx-row[data-task-id]")]
        .filter(row => row.getClientRects().length > 0);
      domIds = rows.map(row => (row.dataset.taskId ?? row.dataset.id ?? "").replace(/^:/, ""));
      const domOrder = logicalVisibleIds.filter(id => domIds.includes(id));
      const textCorrect = rows.every((row, index) => {
        const cell = row.querySelector<HTMLElement>('[data-col-id=":text"] .wx-content > .wx-text');
        const expectedText = byId.get(domIds[index])?.text;
        const textColumn = state.columns?.find(column => column.id === "text");
        return textColumn?.hidden === true || (cell !== null && typeof expectedText === "string" && cell.textContent === expectedText);
      });
      const chart = root.querySelector<HTMLElement>(".wx-chart");
      if (!chart || !chart.clientWidth || !chart.clientHeight || getComputedStyle(chart).visibility === "hidden" || document.visibilityState === "hidden") return finish("NOT_MEASURABLE");
      const bars = [...root.querySelectorAll<HTMLElement>(".wx-chart .wx-bar[data-task-id]")];
      const barsCorrect = bars.every(bar => {
        const id = (bar.dataset.taskId ?? "").replace(/^:/, "");
        if (!logicalVisibleIds.includes(id)) return false;
        const row = rows.find(candidate => (candidate.dataset.taskId ?? candidate.dataset.id ?? "").replace(/^:/, "") === id);
        const label = bar.querySelector<HTMLElement>(".wx-text-out") ?? bar.querySelector<HTMLElement>(".wx-content");
        const expectedText = byId.get(id)?.text;
        if (!label || label.textContent !== expectedText) return false;
        if (!row) return true; // Grid and Chart virtualize independently.
        const rowBox = row.getBoundingClientRect(), barBox = bar.getBoundingClientRect();
        return Math.abs(rowBox.y + rowBox.height / 2 - barBox.y - barBox.height / 2) <= 1;
      });
      columns = JSON.stringify((state.columns ?? []).map(column => [column.id, column.width, column.hidden]));
      const payloadCorrect = actual.length === projection.tasks.length && projection.tasks.every(task => sameTask(byId.get(String(task.id)), task)) && linkShape(links) === linkShape(projection.links);
      const visibleCoreTasks = state._tasks.filter(task =>
        task.$y + task.$h > state.scrollTop && task.$y < state.scrollTop + (state._chartHeight ?? chart.clientHeight));
      const requiredGridIds = visibleCoreTasks.map(task => String(task.id));
      const grid = root.querySelector<HTMLElement>(".wx-table-container");
      const gridMeasurable = Boolean(grid && grid.clientWidth > 0 && grid.getClientRects().length > 0);
      const requiredRowsPresent = !gridMeasurable || requiredGridIds.every(id => domIds.includes(id));
      const requiredBarIds = visibleCoreTasks.filter(task => task.type !== "summary-container" &&
        task.$x + task.$w >= state.scrollLeft && task.$x <= state.scrollLeft + chart.clientWidth).map(task => String(task.id));
      const requiredBarsPresent = requiredBarIds.every(id => bars.some(bar => (bar.dataset.taskId ?? "").replace(/^:/, "") === id));
      const actualScale = state.scales?.at(-1)?.unit;
      const vertical = root.querySelector<HTMLElement>(".wx-gantt");
      const verticalCorrect = vertical !== null && Math.abs(vertical.scrollTop - state.scrollTop) <= 1;
      selectedIds = (state.selected ?? []).map(String);
      const columnsCorrect = context.expectedColumns.every(expected => state.columns?.some(actual => actual.id === expected.id && Boolean(actual.hidden) === expected.hidden));
      const valid = verticalCorrect && requiredRowsPresent && columnsCorrect && actualScale === context.scale.toLowerCase() && requiredBarsPresent && payloadCorrect && sameIds(logicalVisibleIds, coreVisibleIds) && new Set(domIds).size === domIds.length && sameIds(domOrder, domIds) &&
        (rows.length > 0 || logicalVisibleIds.length === 0 || state.gridWidth === 0) && textCorrect && barsCorrect &&
        Math.abs(chart.scrollLeft - state.scrollLeft) <= 1;
      const signature = JSON.stringify([selectedIds, coreVisibleIds, domIds, rows.map(row => [row.textContent, row.getBoundingClientRect().y]), columns, state.scrollLeft, state.scrollTop, chart?.scrollLeft, vertical?.scrollTop, chart?.scrollWidth, box.width, box.height]);
      stable = valid && signature === previous ? stable + 1 : 0;
      previous = signature;
      if (stable >= 3) return finish("SETTLED");
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
  });
  return { promise, cancel: () => cancel() };
}

/** A resolved observation can become stale before its Promise callback runs. */
export function deliverProjectionReceipt(receipt: ProjectionReceipt, isCurrent: () => boolean,
  deliver: (receipt: ProjectionReceipt) => void): boolean {
  if (!isCurrent()) return false;
  deliver(receipt);
  return true;
}
