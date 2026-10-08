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
  // The Core width can include the native scrollbar gutter after a Grid resize.
  // Use rendered Chart bounds for lane placement and visible clipping.
  if (!plot.width || !plot.height || !root.width || !root.height || typeof state._chartWidth !== "number" || !Number.isFinite(state._chartWidth) || state._chartWidth <= 0) return null;
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
