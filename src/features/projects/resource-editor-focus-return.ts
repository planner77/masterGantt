/** Issue #751/#622: native dialog close + refreshed Resource detail focus handoff. */
export interface ResourceEditorFocusReadiness {
  modal: "closing" | "foreign" | "none";
  reportPending: boolean;
  reportConfirmed: boolean;
  detailOrigin: boolean;
  detailPresent: boolean;
  detailState: string | null;
  detailConfirmationId: string | undefined;
}


/**
 * Only the visible Resource workspace peer and current visit can satisfy or
 * block an editor focus handoff. Hidden/inert reports remain mounted for
 * navigation and may retain a stale data-ready=false after a mutation.
 */
export function activeResourceEditorReceipts(panel: HTMLElement, detailKey: string | null) {
  const visible = (node: HTMLElement) => !node.closest("[hidden], [inert]");
  const nodes = (selector: string) =>
    Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(visible);
  const reportPending = nodes('[data-ready="false"]').length > 0;
  const reportConfirmed = nodes('[data-resource-dashboard="true"][data-ready="true"], [data-wbs-view="resource"][data-ready="true"]')
    .some(node => Boolean(node.dataset.reportConfirmationId) && node.dataset.reportConfirmationId !== "0");
  const detailRoot = detailKey === null ? panel
    : nodes("[data-projection-detail-key]").find(node => node.dataset.projectionDetailKey === detailKey) ?? null;
  return { reportPending, reportConfirmed, detailRoot };
}

/**
 * Never "fall through" a pending receipt because a frame budget was exhausted.
 * A newer modal or user intent cancels instead of stealing focus.
 */
export function resourceEditorFocusDecision(
  input: ResourceEditorFocusReadiness,
): "CANCEL" | "WAIT" | "READY" {
  if (input.modal === "foreign") return "CANCEL";
  if (input.modal === "closing" || input.reportPending) return "WAIT";
  if (input.detailOrigin && !input.detailPresent && !input.reportConfirmed) return "WAIT";
  if (input.detailOrigin && input.detailPresent && (
    input.detailState !== "ready" ||
    !input.detailConfirmationId ||
    input.detailConfirmationId === "0"
  )) return "WAIT";
  return "READY";
}
