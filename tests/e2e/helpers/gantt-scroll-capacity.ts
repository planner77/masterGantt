/**
 * Pick an interior CSSOM scroll position for test setup, not a boundary.
 *
 * scrollWidth/clientWidth are rounded DOM measurements; the last measured
 * pixel is not always assignable to scrollLeft (CI #2920: max=19, actual=18).
 * The midpoint preserves a meaningful nonzero Gantt scroll while leaving
 * margin for a one-pixel native clamp/reflow.  Callers must assert > 0 and
 * preserve the *exact selected position* through the workflow; this is not
 * a tolerance on the resulting application state.
 */
export function interiorGanttScrollLeft(measuredCapacity: number, preferred = 120): number {
  if (!Number.isFinite(measuredCapacity) || measuredCapacity <= 0 ||
      !Number.isFinite(preferred) || preferred <= 0) return 0;
  return Math.min(preferred, Math.floor(measuredCapacity / 2));
}
