/** Project-local visual profiles. Core cellHeight remains the row authority. */
export const GANTT_DENSITY_HEIGHTS = [34, 32, 30, 28] as const;
export const GANTT_COARSE_HEIGHT = 44;
export const densityHeight = (level: number, coarse: boolean) => coarse ? GANTT_COARSE_HEIGHT : GANTT_DENSITY_HEIGHTS[Math.max(0, Math.min(3, level))];
export const densityFontScale = (level: number, coarse: boolean) => coarse ? 1 : [1, 0.95, 0.9, 0.86][Math.max(0, Math.min(3, level))];

/** Small trackpad deltas accumulate, while a wheel notch changes at most one
 * profile per frame. A direction change/idle discards the previous remainder. */
export function createDensityWheel() {
  let total = 0, previous = 0;
  return {
    push(delta: number, mode: number, now: number): number {
      if (!Number.isFinite(delta) || delta === 0) return 0;
      const pixels = delta * (mode === 1 ? 16 : mode === 2 ? 100 : 1);
      if (now - previous > 250 || Math.sign(pixels) !== Math.sign(total)) total = 0;
      previous = now;
      total += pixels;
      if (Math.abs(total) < 60) return 0;
      const direction = Math.sign(total);
      total = 0;
      return direction;
    },
    reset() { total = 0; previous = 0; },
  };
}
export function nextDensityLevel(level: number, direction: number, coarse: boolean) {
  return coarse ? 0 : Math.max(0, Math.min(GANTT_DENSITY_HEIGHTS.length - 1, level + Math.sign(direction)));
}

export const DENSITY_INPUT_EXCLUSION = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="menu"], [role="listbox"], [popover]';
const DENSITY_CHROME = '.wx-scale, .wx-header, .project-schedule-view-header, .project-schedule-view-status, .project-schedule-view-grid-scrollbar, .project-gantt-scale-toolbar';
type DensityPointer = Readonly<{ x: number; y: number }>;
const inBounds = (rect: DOMRect, point: DensityPointer) =>
  rect.width > 0 && rect.height > 0 && point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;

/** Recognize the *visible* body, including blank rows and scroll layers.
 * A synthetic WheelEvent without coordinates still uses its DOM target; real
 * pointer events additionally respect sticky headers and the grid scrollbar.
 * This predicate never owns wheel input outside the current Gantt frame. */
export function isDensityWheelTarget(target: Element, root: HTMLElement, point?: DensityPointer) {
  if (!root.contains(target) || target.closest(DENSITY_INPUT_EXCLUSION) || target.closest(DENSITY_CHROME)) return false;

  const projected = target.closest<HTMLElement>('[data-schedule-view-scroll]');
  if (projected && root.contains(projected)) {
    const bounds = projected.getBoundingClientRect();
    if (point) {
      if (!inBounds(bounds, point)) return false;
      const header = projected.querySelector<HTMLElement>('.project-schedule-view-header')?.getBoundingClientRect();
      const scrollbar = projected.querySelector<HTMLElement>('.project-schedule-view-grid-scrollbar')?.getBoundingClientRect();
      const top = Math.max(bounds.top, header?.bottom ?? bounds.top);
      const bottom = Math.min(bounds.bottom, scrollbar?.top ?? bounds.bottom);
      return point.y >= top && point.y < bottom;
    }
    // Coordinates are absent for existing synthetic DOM tests (0,0). The
    // element is still owned by the projected body, never by its chrome.
    return true;
  }

  const native = target.closest<HTMLElement>('.wx-gantt, .wx-chart, .wx-table-container, .project-gantt-scroll');
  if (!native || !root.contains(native)) return false;
  const nativeBody = root.querySelector<HTMLElement>('.wx-gantt');
  if (point && nativeBody) return inBounds(nativeBody.getBoundingClientRect(), point);
  // Preserve Core row/bar synthetic assertions and handle scroll overlays
  // whose event target is the native body rather than a rendered row.
  return Boolean(target.closest('.wx-gantt, .wx-chart, .wx-table-container, .project-gantt-scroll'));
}
