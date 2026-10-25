import type { PeerViewportRestore, PublicGanttViewportReader } from "../gantt/peer-viewport-capture";

/** Each navigation frame owns a separate immutable Core/native observation. */
export interface ResourceNavigationViewport {
  readonly snapshot: object;
  readonly generation: number;
  readonly reader: PublicGanttViewportReader;
  readonly request: PeerViewportRestore;
}
export function captureResourceNavigationViewport(
  snapshot: object, generation: number, reader: PublicGanttViewportReader | null,
  key: string, positions: PeerViewportRestore["positions"],
): ResourceNavigationViewport | null {
  const value = reader?.();
  if (!reader || !value?.continuity || (value.continuity.syncDepth ?? 0) !== 0 || ![value.left, value.top].every(Number.isFinite)) return null;
  return Object.freeze({ snapshot, generation, reader, request: Object.freeze({
    key, left: value.left, top: value.top,
    continuity: Object.freeze({ ...value.continuity }),
    positions: Object.freeze((positions ?? []).map(position => Object.freeze({ ...position }))),
  }) });
}
export function canRestoreResourceNavigationViewport(
  saved: ResourceNavigationViewport, snapshot: object, generation: number,
  reader: PublicGanttViewportReader | null, key: string,
): boolean {
  const current = reader?.().continuity, origin = saved.request.continuity;
  return saved.snapshot === snapshot && saved.generation === generation && saved.reader === reader &&
    saved.request.key === key && !!current && !!origin &&
    current.apiInstanceId === origin.apiInstanceId && current.syncVersion >= origin.syncVersion &&
    current.scale === origin.scale && current.gridWidth === origin.gridWidth &&
    current.columns === origin.columns && current.viewportWidth === origin.viewportWidth &&
    current.viewportHeight === origin.viewportHeight && current.fullscreen === origin.fullscreen && current.fullscreenElement === origin.fullscreenElement;
}

export function cloneResourceNavigationViewport(saved: ResourceNavigationViewport | null | undefined): ResourceNavigationViewport | null {
  if (!saved) return null;
  return Object.freeze({ ...saved, request: Object.freeze({ ...saved.request,
    continuity: saved.request.continuity && Object.freeze({ ...saved.request.continuity }),
    positions: Object.freeze((saved.request.positions ?? []).map(position => Object.freeze({ ...position }))),
  }) });
}
