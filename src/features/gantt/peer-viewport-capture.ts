/** Public SVAR viewport and native chart scroll are distinct observations.
 * Fractional/layout rounding can leave the DOM one pixel away from Core.
 * Never synthesize the Core command from a DOM scrollLeft value.
 */
export interface GanttViewportCoordinates {
  readonly left: number;
  readonly top: number;
}

export interface GanttViewportContinuity {
  readonly apiInstanceId: string;
  readonly syncVersion: number;
  readonly filter: string;
  readonly scale: string;
  readonly gridWidth: number | undefined;
  readonly columns: string;
  readonly viewportWidth: number;
  readonly viewportHeight?: number;
  readonly rootWidth?: number;
  readonly rootHeight?: number;
  readonly fullscreen?: boolean;
  readonly fullscreenElement?: Element | null;
  readonly syncDepth?: number;
}
export interface PeerViewportRestore extends GanttViewportCoordinates {
  readonly key: string;
  readonly continuity?: GanttViewportContinuity;
  readonly positions?: readonly Readonly<{ selector: string; left: number; top: number; owner?: HTMLElement }>[];
}
export type PublicGanttViewportReader = () => GanttViewportCoordinates & { continuity?: GanttViewportContinuity };

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
