/** SVAR DOM integration is deliberately isolated here and covered by browser tests. */
export const TASK_TARGET_SELECTOR = ".wx-table-container .wx-row[data-id], .wx-table-container .wx-row[data-task-id], .wx-chart .wx-bar[data-task-id]";

export function taskIdFromElement(element: Element): string | null {
  const raw = element.getAttribute("data-task-id") ?? element.getAttribute("data-id");
  if (!raw) return null;
  // SVAR prefixes string IDs with a colon; never infer an ID from a row index.
  const id = raw.startsWith(":") ? raw.slice(1) : raw;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ? id : null;
}

export function resolveTaskContextTarget(
  target: EventTarget | null,
  root: HTMLElement,
  knownTask: (id: string) => boolean,
): { taskId: string; element: HTMLElement } | null {
  if (!(target instanceof Element) || !root.contains(target)) return null;
  if (target.closest("input, textarea, select, [contenteditable=true], dialog, .wx-header")) return null;
  const element = target.closest(TASK_TARGET_SELECTOR);
  if (!(element instanceof HTMLElement) || !root.contains(element)) return null;
  const taskId = taskIdFromElement(element);
  return taskId && knownTask(taskId) ? { taskId, element } : null;
}

export function findTaskContextElement(root: HTMLElement, taskId: string): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>(TASK_TARGET_SELECTOR))
    .find((element) => taskIdFromElement(element) === taskId) ?? null;
}
