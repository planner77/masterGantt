/** Public SVAR viewport and native chart scroll are distinct observations.
 * Fractional/layout rounding can leave the DOM one pixel away from Core.
 * Never synthesize the Core command from a DOM scrollLeft value.
 */
export interface GanttViewportCoordinates {
  readonly left: number;
  readonly top: number;
}

export type PublicGanttViewportReader = () => GanttViewportCoordinates;

export function capturePeerViewportCoordinates(
  reader: PublicGanttViewportReader | null,
  dom: GanttViewportCoordinates,
): { public: GanttViewportCoordinates; dom: GanttViewportCoordinates } | null {
  const core = reader?.();
  if (!core || ![core.left, core.top, dom.left, dom.top].every(Number.isFinite)) return null;
  return {
    public: { left: core.left, top: core.top },
    dom: { left: dom.left, top: dom.top },
  };
}
