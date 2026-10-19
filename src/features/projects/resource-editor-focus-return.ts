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
