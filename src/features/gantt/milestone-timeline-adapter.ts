import type { IApi, ITask } from "@svar-ui/react-gantt";
import { getDiffer } from "@svar-ui/gantt-store";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import { localDateFromDateOnly, type DateOnly } from "./date-adapter";

export interface MilestoneDateCoordinate {
  readonly contentX: number;
  readonly viewportX: number;
  readonly visible: boolean;
  readonly insideRange: boolean;
  readonly unit: "day" | "week";
  readonly cellWidth: number;
}

/** Version-bound to react-gantt 2.7.3 / gantt-store 2.7.2. Published typed
 * derived state is read only; it is not a stable documented geometry API.
 * Keep that coupling here, and fail closed outside the measured app scales.
 */
export function milestoneDateCoordinate(api: Pick<IApi, "getState">, dateOnly: string): MilestoneDateCoordinate | null {
  let date: Date;
  try { date = localDateFromDateOnly(parseDateOnly(dateOnly) as unknown as DateOnly); }
  catch { return null; }
  const state = api.getState(), scale = state._scales;
  const unit = scale?.minUnit, cellWidth = state.cellWidth, chartWidth = state._chartWidth;
  if (!scale || (unit !== "day" && unit !== "week") || scale.lengthUnit !== "day" ||
    state.scales?.at(-1)?.unit !== unit || state.scales.at(-1)?.step !== 1 ||
    !(scale.start instanceof Date) || !(scale.end instanceof Date) ||
    !Number.isFinite(scale.start.getTime()) || !Number.isFinite(scale.end.getTime()) ||
    scale.end <= scale.start || typeof cellWidth !== "number" || !Number.isFinite(cellWidth) || cellWidth <= 0 ||
    !Number.isFinite(state.scrollLeft) || typeof chartWidth !== "number" || !Number.isFinite(chartWidth) || chartWidth <= 0) return null;
  // This package-root export is already installed with Core. The widget's
  // declaration re-exports it, but its 2.7.3 runtime does not; no deep import.
  const contentX = Math.round(getDiffer(unit, undefined, state._weekStart)(date, scale.start, "day") * cellWidth);
  if (!Number.isFinite(contentX)) return null;
  const viewportX = contentX - state.scrollLeft;
  const insideRange = date >= scale.start && date < scale.end;
  return { contentX, viewportX, insideRange, visible: insideRange && viewportX >= 0 && viewportX < chartWidth,
    unit, cellWidth };
}

/** Reveal a calendar date without selecting a hidden native Milestone row.
 * An in-view date does not move the user's viewport. Out-of-axis dates require
 * the owning range extension first, rather than silently clamping elsewhere.
 */
export async function revealMilestoneDate(api: Pick<IApi, "getState" | "exec">, dateOnly: string): Promise<boolean> {
  const coordinate = milestoneDateCoordinate(api, dateOnly);
  if (!coordinate?.insideRange) return false;
  if (!coordinate.visible) await api.exec("scroll-chart", { left: coordinate.contentX });
  return true;
}

/** Display filtering never removes canonical Task/Link inputs. Callers supply
 * their full Summary context set and retain command/export sources separately.
 */
export async function filterMilestoneWbsRows(api: Pick<IApi, "exec">, visibleTaskIds: readonly string[] | null): Promise<void> {
  const visible = visibleTaskIds === null ? null : new Set(visibleTaskIds);
  await api.exec("filter-tasks", { open: false, filter: visible ? (task: ITask) => typeof task.id === "string" && visible.has(task.id) : undefined });
}

export interface MilestonePlotGeometry {
  readonly left: number;
  readonly width: number;
  readonly visibleLeft: number;
  readonly visibleRight: number;
  readonly controlLeft: number;
  readonly bodyTop: number;
  readonly bodyHeight: number;
}

/** Read-only DOM measurement stays beside the version-bound Core adapter.
 * The documented API does not promise a stable widget geometry interface.
 */
export function readMilestonePlotGeometry(api: Pick<IApi, "getState">, widget: HTMLElement): MilestonePlotGeometry | null {
  const chart = widget.querySelector<HTMLElement>(".wx-chart"), state = api.getState();
  if (!widget.isConnected || !chart || widget.closest("[hidden], [inert]") || !milestoneDateCoordinate(api, "2000-01-01")) return null;
  const plot = chart.getBoundingClientRect(), root = widget.getBoundingClientRect();
  if (!plot.width || !plot.height || !root.width || !root.height || typeof state._chartWidth !== "number" || Math.abs(plot.width - state._chartWidth) > 1) return null;
  const header = chart.querySelector<HTMLElement>(".wx-scale")?.getBoundingClientRect();
  const owner = widget.closest<HTMLElement>(".project-gantt-scroll");
  const ownerBox = owner?.getBoundingClientRect();
  const clipLeft = Math.max(0, ownerBox ? ownerBox.x + owner!.clientLeft : 0);
  const clipRight = Math.min(window.innerWidth, ownerBox ? ownerBox.x + owner!.clientLeft + owner!.clientWidth : window.innerWidth);
  const visibleLeft = Math.max(0, clipLeft - plot.x), visibleRight = Math.min(plot.width, clipRight - plot.x);
  const list = widget.querySelector<HTMLElement>(".project-milestone-lane-list")?.getBoundingClientRect();
  const controlLeft = list && list.right > plot.x ? Math.max(visibleLeft, list.right - plot.x) : visibleLeft;
  return { left: plot.x - root.x, width: plot.width, visibleLeft, visibleRight, controlLeft,
    bodyTop: (header?.bottom ?? plot.y) - root.y, bodyHeight: Math.max(0, plot.bottom - (header?.bottom ?? plot.y)) };
}

/** Grid-only layouts have no Chart width but still own a WBS projection.
 * Read the installed Core's derived rows only to detect a native filter reset.
 * Collapsed children are permitted; a row outside the controlled IDs is not.
 */
export function milestoneWbsProjectionMatches(api: Pick<IApi, "getState">, visibleTaskIds: readonly string[] | null): boolean {
  if (visibleTaskIds === null) return true;
  const allowed = new Set(visibleTaskIds);
  const rows = api.getState()._tasks;
  return Array.isArray(rows) && rows.every(row => typeof row.id === "string" && allowed.has(row.id));
}

export function canApplyMilestoneWbsProjection(widget: HTMLElement): boolean {
  if (!widget.isConnected || widget.closest("[hidden], [inert]")) return false;
  const box = widget.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/** Bounded development evidence; no state/store writes or geometry authority. */
export function readMilestoneCoreLayoutDiagnostic(api: Pick<IApi, "getState">, widget: HTMLElement | null) {
  const state = api.getState();
  return { isFiltered: state._isFiltered, scrollSize: state._scrollSize, columnsWidth: state._columnsWidth, chartHeight: state._chartHeight, filterKeys: Object.keys(state.filterValues ?? {}).slice(0, 20),
    boxes: widget ? Array.from(widget.querySelectorAll<HTMLElement>(".wx-pseudo-rows,.wx-gantt,.wx-chart,.wx-table-container,.wx-resizer")).slice(0, 10).map(element => {
      const box = element.getBoundingClientRect();
      return { className: element.className, width: box.width, height: box.height, offsetWidth: element.offsetWidth, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
    }) : [] };
}

interface MilestoneChartResizeInput {
  ownerWidth: number; contentWidth: number; gridWidth: number; resizerWidth: number;
  plotWidth: number; plotHeight: number; scaleHeight: number;
  stateWidth: number; stateHeight: number; scrollSize: number;
}

/** Installed Layout.jsx formula, verified against the current DOM commit.
 * This repairs a stale derived width through the public action, never the store.
 * The collapsed Chart-only rail must supply its effective width, not gridWidth.
 */
export function milestoneChartResizeCorrection(input: MilestoneChartResizeInput): { width: number; height: number; scrollSize: number } | null {
  const { ownerWidth, contentWidth, gridWidth, resizerWidth, plotWidth, plotHeight, scaleHeight, stateWidth, stateHeight, scrollSize } = input;
  if (!Object.values(input).every(Number.isFinite) || ownerWidth <= 0 || contentWidth <= 0 || gridWidth < 0 ||
    plotWidth <= 0 || plotHeight <= 0 || stateWidth <= 0 || stateHeight <= 0 || scaleHeight < 0 || scrollSize < 0 ||
    resizerWidth !== 4 || Math.abs(ownerWidth - contentWidth - scrollSize) > 1 ||
    Math.abs(plotHeight - scaleHeight - stateHeight) > 1) return null;
  const width = ownerWidth - gridWidth - scrollSize - resizerWidth;
  if (width <= 0 || Math.abs(width - plotWidth) > 1 || Math.abs(stateWidth - plotWidth) <= 1) return null;
  return { width, height: stateHeight, scrollSize };
}

export function readMilestoneChartResizeCorrection(api: Pick<IApi, "getState">, widget: HTMLElement) {
  if (!canApplyMilestoneWbsProjection(widget)) return null;
  const owner = widget.querySelector<HTMLElement>(".wx-gantt"), content = widget.querySelector<HTMLElement>(".wx-pseudo-rows"),
    grid = widget.querySelector<HTMLElement>(".wx-table-container"), resizer = widget.querySelector<HTMLElement>(".wx-resizer"),
    chart = widget.querySelector<HTMLElement>(".wx-chart");
  if (!owner || !content || !grid || !resizer || !chart) return null;
  const state = api.getState(), plot = chart.getBoundingClientRect();
  const gridWidth = state._columnsWidth;
  if (typeof gridWidth !== "number" || Math.abs(grid.clientWidth - gridWidth) > 1) return null;
  return milestoneChartResizeCorrection({ ownerWidth: owner.offsetWidth, contentWidth: content.offsetWidth, gridWidth,
    resizerWidth: resizer.getBoundingClientRect().width, plotWidth: plot.width, plotHeight: plot.height,
    scaleHeight: state._scales?.height ?? NaN, stateWidth: state._chartWidth ?? NaN,
    stateHeight: state._chartHeight ?? NaN, scrollSize: state._scrollSize ?? NaN });
}
