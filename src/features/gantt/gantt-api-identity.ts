/**
 * Publish the actual SVAR init identity synchronously for development diagnostics.
 *
 * React owns the same data attribute and will reconcile it on the next render.
 * A large canonical projection must not delay the matching diagnostic identity.
 * Production does not call this helper.
 */
export function stampInitializedGanttApiIdentity(
  frame: Pick<HTMLDivElement, "dataset" | "isConnected">,
  apiInstanceId: string,
): void {
  if (!frame.isConnected) return;
  frame.dataset.projectGanttApiInstance = apiInstanceId;
}
