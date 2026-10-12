import { taskIdFromElement } from "../task-context-target";
import type { ViewportController, ViewportStamp } from "./viewport-coordinator";

export type TaskFocusOutcome = "SETTLED" | "SUPERSEDED" | "NOT_MEASURABLE" | "TIMED_OUT";

/** Viewport settlement does not imply that Core has finished replacing its
 * virtual rows. Observe focus separately, without acquiring scroll authority. */
export async function handoffTaskRevealFocus(input: Readonly<{
  controller: ViewportController; stamp: ViewportStamp; taskId: string;
  current(): boolean; root(): HTMLElement | null;
}>): Promise<TaskFocusOutcome> {
  const { controller, stamp } = input;
  const settled = controller.capture();
  if (!settled?.measurable || !settled.context.visible) return "NOT_MEASURABLE";
  const priorFocus = document.activeElement;
  let cancelled = false, lastRow: HTMLElement | null = null, stableFrames = 0;
  // Even a wheel at the scroll boundary or a click on the already focused
  // control is a new user intent. Never resume this handoff afterwards.
  const cancel = () => { cancelled = true; };
  const events = ["pointerdown", "wheel", "keydown", "touchstart"];
  for (const event of events) document.addEventListener(event, cancel, { capture: true, passive: true });
  // A dialog can open and close between two animation frames. Attribute
  // mutation records preserve that ingress even after open has been removed.
  const dialogs = new MutationObserver(records => {
    if (records.some(record => record.type === "attributes"
      ? record.attributeName === "open" && (record.target as Element).tagName === "DIALOG"
      : Array.from(record.addedNodes).some(node => node instanceof Element &&
        (node.matches("dialog[open]") || node.querySelector("dialog[open]"))))) cancel();
  });
  dialogs.observe(document.body, { attributes: true, attributeFilter: ["open"], attributeOldValue: true, childList: true, subtree: true });
  try {
    for (let frame = 0; frame < 12; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (cancelled || !input.current() || !controller.isCurrent(stamp) || document.querySelector("dialog[open]")) return "SUPERSEDED";
      const live = controller.capture();
      if (!live?.measurable || !live.context.visible ||
        live.context.apiInstance !== settled.context.apiInstance || live.context.revision !== settled.context.revision ||
        live.context.projectionEpoch !== settled.context.projectionEpoch ||
        Math.abs(live.core.left - settled.core.left) > 1 || Math.abs(live.core.top - settled.core.top) > 1 ||
        Math.abs(live.native.left - live.core.left) > 1 || Math.abs(live.native.top - live.core.top) > 1) return "SUPERSEDED";
      const root = input.root();
      if (!root?.isConnected || root.closest("[hidden], [inert]")) return "NOT_MEASURABLE";
      const grid = root.querySelector<HTMLElement>(".wx-table-container");
      const row = grid && Array.from(grid.querySelectorAll<HTMLElement>(".wx-row[data-id], .wx-row[data-task-id]"))
        .find(candidate => taskIdFromElement(candidate) === input.taskId);
      const rowRect = row?.getBoundingClientRect(), gridRect = grid?.getBoundingClientRect(), rootRect = root.getBoundingClientRect();
      const style = row && getComputedStyle(row);
      if (!row?.isConnected || !row.getClientRects().length || row.closest("[hidden], [inert]") ||
        style?.visibility === "hidden" || style?.display === "none" || !rowRect || !gridRect ||
        rowRect.bottom <= Math.max(gridRect.top, rootRect.top, 0) || rowRect.top >= Math.min(gridRect.bottom, rootRect.bottom, window.innerHeight) ||
        rowRect.right <= Math.max(gridRect.left, rootRect.left, 0) || rowRect.left >= Math.min(gridRect.right, rootRect.right, window.innerWidth)) {
        lastRow = null; stableFrames = 0;
        continue;
      }
      const focused = document.activeElement;
      if (focused !== document.body && focused !== row && focused !== lastRow && focused !== priorFocus) return "SUPERSEDED";
      if (!row.hasAttribute("tabindex")) row.tabIndex = -1;
      if (focused !== row) row.focus({ preventScroll: true });
      if (document.activeElement !== row) { lastRow = null; stableFrames = 0; continue; }
      stableFrames = row === lastRow ? stableFrames + 1 : 1;
      lastRow = row;
      if (frame >= 6 && stableFrames >= 3) return "SETTLED";
    }
    return "TIMED_OUT";
  } finally {
    dialogs.disconnect();
    for (const event of events) document.removeEventListener(event, cancel, true);
  }
}
