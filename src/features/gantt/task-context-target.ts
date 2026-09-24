/** SVAR DOM integration is deliberately isolated here and covered by browser tests. */
export const TASK_TARGET_SELECTOR = ".wx-table-container .wx-row[data-id], .wx-table-container .wx-row[data-task-id], .wx-chart .wx-bar[data-task-id]";

export function taskIdFromElement(element: Element): string | null {
  const raw = element.getAttribute("data-task-id") ?? element.getAttribute("data-id");
  if (!raw) return null;
  const id = raw.startsWith(":") ? raw.slice(1) : raw;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ? id : null;
}

export function resolveTaskContextTarget(
  target: EventTarget | null,
  root: HTMLElement,
  knownTask: (id: string) => boolean,
): { taskId: string; element: HTMLElement } | null {
  if (!(target instanceof Element) || !root.contains(target)) return null;
  if (target.closest("input, textarea, select, button, a, [contenteditable=true], dialog, .wx-header")) return null;
  const element = target.closest(TASK_TARGET_SELECTOR);
  if (!(element instanceof HTMLElement) || !root.contains(element)) return null;
  const taskId = taskIdFromElement(element);
  return taskId && knownTask(taskId) ? { taskId, element } : null;
}

export function findTaskContextElement(root: HTMLElement, taskId: string): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>(TASK_TARGET_SELECTOR))
    .find((element) => taskIdFromElement(element) === taskId) ?? null;
}

type PointerCandidate = { taskId: string; x: number; y: number; moved: boolean };
let installed = false;
let candidate: PointerCandidate | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let refreshAgain = false;

function projectPublicId(): string | null {
  if (typeof window === "undefined") return null;
  const match = /^\/projects\/([^/]+)\/?$/.exec(window.location.pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function safeStoredUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : null;
  } catch { return null; }
}

async function decorateTaskUrls(): Promise<void> {
  if (refreshing) { refreshAgain = true; return; }
  const publicId = projectPublicId();
  const frame = document.querySelector<HTMLElement>(".project-gantt-frame");
  if (!publicId || !frame) return;
  refreshing = true;
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin", cache: "no-store" });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) return;
    const data = body.data;
    if (typeof data !== "object" || data === null || !("tasks" in data) || !Array.isArray(data.tasks)) return;
    const urls = new Map<string, string>();
    for (const task of data.tasks) {
      if (typeof task !== "object" || task === null || !("taskId" in task) || typeof task.taskId !== "string" || !("url" in task)) continue;
      const url = safeStoredUrl(task.url);
      if (url) urls.set(task.taskId, url);
    }
    frame.querySelectorAll<HTMLElement>(TASK_TARGET_SELECTOR).forEach((element) => {
      const taskId = taskIdFromElement(element);
      const url = taskId ? urls.get(taskId) : undefined;
      if (url) {
        element.dataset.taskUrl = url;
        element.classList.add("has-task-url");
      } else {
        delete element.dataset.taskUrl;
        element.classList.remove("has-task-url");
      }
    });
  } finally {
    refreshing = false;
    if (refreshAgain) { refreshAgain = false; scheduleDecoration(); }
  }
}

function scheduleDecoration(): void {
  if (typeof document === "undefined") return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshTimer = null; void decorateTaskUrls(); }, 80);
}

function ordinaryTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("input, textarea, select, button, a, [contenteditable=true], dialog, .wx-header, .project-task-context-menu")) return null;
  // In edit mode the name text has a single-click Grid editor. Chart bars
  // and readonly name cells retain their existing URL launch behavior.
  if (target.closest('.project-gantt-frame[data-task-inline-editable="true"] .wx-table-container .wx-row[data-inline-name-eligible="true"] [role="gridcell"][data-col-id="text"] .wx-content > .wx-text')) return null;
  const element = target.closest(TASK_TARGET_SELECTOR);
  return element instanceof HTMLElement ? element : null;
}

function installTaskUrlLauncher(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) { candidate = null; return; }
    const element = ordinaryTarget(event.target);
    const taskId = element ? taskIdFromElement(element) : null;
    candidate = taskId ? { taskId, x: event.clientX, y: event.clientY, moved: false } : null;
  }, true);
  document.addEventListener("pointermove", (event) => {
    if (!candidate) return;
    if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 5) candidate.moved = true;
  }, true);
  document.addEventListener("pointercancel", () => { candidate = null; }, true);
  document.addEventListener("click", (event) => {
    const current = candidate;
    candidate = null;
    if (!current || current.moved || event.button !== 0) return;
    const element = ordinaryTarget(event.target);
    const taskId = element ? taskIdFromElement(element) : null;
    if (!element || taskId !== current.taskId) return;
    const url = safeStoredUrl(element.dataset.taskUrl);
    if (!url) return;
    // With noopener/noreferrer a successful browser open is allowed to return null,
    // so the WindowProxy return value cannot distinguish success from popup blocking.
    window.open(url, "_blank", "noopener,noreferrer");
  }, true);
  const observer = new MutationObserver(() => scheduleDecoration());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pageshow", scheduleDecoration);
  scheduleDecoration();
}

installTaskUrlLauncher();
