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
export function isDensityWheelTarget(target: Element, root: HTMLElement) {
  if (!root.contains(target) || target.closest(DENSITY_INPUT_EXCLUSION)) return false;
  if (target.closest('.wx-scale, .wx-header')) return false;
  return Boolean(target.closest('.wx-table .wx-body, .wx-chart .wx-bars, .wx-chart .wx-content, .wx-table .wx-row[data-id]'));
}
