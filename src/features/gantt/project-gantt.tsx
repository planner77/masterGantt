"use client";

import {
  Gantt,
  Willow,
  type IApi,
  type IColumnConfig,
  type ILink,
  type ITask,
} from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type {
  ProjectCalendarDto,
  ProjectLinkDto,
  ProjectTaskDto,
  TaskHierarchyCommandRequest,
} from "@/contracts/projects";
import {
  browserLocales,
  formatLocaleDateOnly,
  todayLocalDateString,
} from "@/lib/date-display";
import { formatIsoWeek } from "@/lib/iso-week";

import {
  createTaskAddGateway,
  createTaskUpdateGateway,
  createLinkAddGateway,
  createLinkDeleteGateway,
  type LocalTaskAddCommand,
  type TaskUpdateEvent,
} from "./command-gateway";
import {
  projectLinksToSvarLinks,
  projectTasksToSvarTasks,
  translateProjectTaskUpdate,
  type ProjectTaskCreateCommand,
  type ProjectTaskUpdateCommand,
} from "./project-task-adapter";
import { dateOnlyFromLocalDate } from "./date-adapter";
import { applyCanonicalGanttSync } from "./canonical-snapshot-sync";
import { resolveTaskContextTarget, taskIdFromElement, TASK_TARGET_SELECTOR } from "./task-context-target";
import { captureMenuScrollChange } from "./menu-scroll-guard";
import {
  createHierarchyCommand,
  createPasteCommand,
  taskContextCapabilities,
  type TaskClipboard,
} from "./task-context-menu-model";
import { taskHasDependencyLinks } from "./task-link-scope";
import "./task-context-menu.css";
import "./gantt-scale-toolbar.css";

export type ProjectGridDataColumnId = "text" | "externalId" | "projectStart" | "projectDuration";

export type ProjectGridColumnVisibility = Record<ProjectGridDataColumnId, boolean>;
let nextApiInstanceId = 1;

type MenuPosition = Readonly<{ left: number; top: number }>;
type TaskMenuState = MenuPosition & Readonly<{ taskId: string }>;
type TaskSubmenuName = "Add" | "Convert to" | "Paste" | "Move";
type TaskSubmenuState = Readonly<{ name: TaskSubmenuName; placement: "right" | "left" | "drilldown"; left: number; top: number }>;
type GanttScaleMode = "day" | "week";

function fullscreenShortcutBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], dialog, [role="dialog"]'));
}

interface ProjectGanttProps {
  readonly calendar: ProjectCalendarDto;
  readonly editable: boolean;
  readonly mutationLocked: boolean;
  readonly onCanonicalSyncFailure: () => void;
  readonly links: readonly ProjectLinkDto[];
  readonly onTaskAddRejected: () => void;
  readonly onTaskCreate: (command: ProjectTaskCreateCommand) => void;
  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;
  readonly onTaskHierarchyCommand: (command: TaskHierarchyCommandRequest) => void;
  readonly onTaskEditorOpen: (taskId: string) => void;
  readonly onTaskDeleteRequest: (taskId: string, trigger: HTMLElement | null) => void;
  readonly onLinkCreate: (sourceTaskId: string, targetTaskId: string) => void;
  readonly onLinkDelete: (linkId: string) => void;
  readonly columnVisibility: ProjectGridColumnVisibility;
  readonly onColumnVisibilityChange: (columnId: ProjectGridDataColumnId) => void;
  readonly tasks: readonly ProjectTaskDto[];
  readonly projectRevision: number;
  readonly visibleTaskIds?: readonly string[] | null;
}

const baseProjectColumns: IColumnConfig[] = [
  { id: "text", header: "작업", width: 224, flexgrow: 1, sort: true },
  { id: "externalId", header: "외부 ID", width: 128, getter: (task) => task.externalId ?? "—" },
  // Do not use Core's `start`/`duration` IDs here: they install their own
  // calendar-day templates. These display-only IDs preserve the project's
  // localized local-date and canonical working-day duration contract.
  { id: "projectStart", header: "시작", width: 128, align: "center" },
  { id: "projectDuration", header: "기간", width: 84, align: "center" },
  // The Core recognizes this documented ID and renders its native header/row
  // plus controls. Their `add-task` event is intercepted below.
  { id: "add-task", header: "작업 추가", width: 37, align: "center" },
];

const dataColumns: ReadonlyArray<Readonly<{ id: ProjectGridDataColumnId; label: string }>> = [
  { id: "text", label: "작업" },
  { id: "externalId", label: "외부 ID" },
  { id: "projectStart", label: "시작" },
  { id: "projectDuration", label: "기간" },
];

function emptyWorkspaceRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start, end };
}

function todayDateOnly(): string {
  return todayLocalDateString();
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function clampMenuPosition(left: number, top: number, width: number, height: number): MenuPosition {
  const inset = 8;
  return {
    left: Math.max(inset, Math.min(left, window.innerWidth - width - inset)),
    top: Math.max(inset, Math.min(top, window.innerHeight - height - inset)),
  };
}

/** Browser-only renderer; normal canonical snapshots keep this SVAR instance mounted. */
export function ProjectGantt({
  calendar,
  editable,
  mutationLocked,
  onCanonicalSyncFailure,
  links,
  onTaskAddRejected,
  onTaskCreate,
  onTaskCommand,
  onTaskHierarchyCommand,
  onTaskEditorOpen,
  onTaskDeleteRequest,
  onLinkCreate,
  onLinkDelete,
  columnVisibility,
  onColumnVisibilityChange,
  tasks,
  projectRevision,
  visibleTaskIds = null,
}: ProjectGanttProps) {
  const apiReference = useRef<IApi | null>(null);
  const onTaskCreateReference = useRef(onTaskCreate);
  const onTaskAddRejectedReference = useRef(onTaskAddRejected);
  const onCanonicalSyncFailureReference = useRef(onCanonicalSyncFailure);
  const onTaskEditorOpenReference = useRef(onTaskEditorOpen);
  const onTaskHierarchyCommandReference = useRef(onTaskHierarchyCommand);
  const onTaskDeleteRequestReference = useRef(onTaskDeleteRequest);
  const onLinkCreateReference = useRef(onLinkCreate);
  const onLinkDeleteReference = useRef(onLinkDelete);
  const canCreateReference = useRef(editable && !mutationLocked);
  const mutationLockedReference = useRef(mutationLocked);
  const canonicalSyncDepthReference = useRef(0);
  const canonicalSyncVersionReference = useRef(0);
  const taskFilterAppliedReference = useRef(false);
  const instanceId = useState(() => `project-gantt-${Math.random().toString(36).slice(2)}`)[0];
  const canonicalSyncQueueReference = useRef<Promise<void>>(Promise.resolve());
  const tasksByIdReference = useRef(new Map<string, ProjectTaskDto>());
  const ganttScrollReference = useRef<HTMLDivElement>(null);
  const fullscreenFrameReference = useRef<HTMLDivElement>(null);
  const fullscreenButtonReference = useRef<HTMLButtonElement>(null);
  const fullscreenPendingReference = useRef(false);
  const fullscreenWasActiveReference = useRef(false);
  const columnMenuReference = useRef<HTMLDivElement>(null);
  const columnMenuTriggerReference = useRef<HTMLElement | null>(null);
  const taskMenuReference = useRef<HTMLDivElement>(null);
  const taskSubmenuReference = useRef<HTMLDivElement>(null);
  const taskSubmenuTriggers = useRef<Partial<Record<TaskSubmenuName, HTMLButtonElement | null>>>({});
  const suppressTaskSubmenuFocusOpenReference = useRef<TaskSubmenuName | null>(null);
  const focusTaskMenuOnOpenReference = useRef(false);
  const taskMenuTriggerReference = useRef<HTMLElement | null>(null);
  const taskMenuScrollChangedReference = useRef<() => boolean>(() => false);
  const [columnMenuPosition, setColumnMenuPosition] = useState<MenuPosition | null>(null);
  const [taskMenu, setTaskMenu] = useState<TaskMenuState | null>(null);
  const [taskSubmenu, setTaskSubmenu] = useState<TaskSubmenuState | null>(null);
  const [taskClipboard, setTaskClipboard] = useState<TaskClipboard | null>(null);
  const [apiInstanceId, setApiInstanceId] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<GanttScaleMode>("day");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  // This browser-only component is dynamically imported with SSR disabled.
  const [locales] = useState<Intl.LocalesArgument>(() => browserLocales());
  const highlightWeekend = useCallback(
    (date: Date, unit: "day" | "hour") => unit === "day" && isWeekend(date) ? "wx-weekend" : "",
    [],
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.taskId, task])),
    [tasks],
  );
  useEffect(() => {
    onTaskCreateReference.current = onTaskCreate;
    onTaskAddRejectedReference.current = onTaskAddRejected;
    onCanonicalSyncFailureReference.current = onCanonicalSyncFailure;
    onTaskEditorOpenReference.current = onTaskEditorOpen;
    onTaskHierarchyCommandReference.current = onTaskHierarchyCommand;
    onTaskDeleteRequestReference.current = onTaskDeleteRequest;
    onLinkCreateReference.current = onLinkCreate;
    onLinkDeleteReference.current = onLinkDelete;
    canCreateReference.current = editable && !mutationLocked;
    mutationLockedReference.current = mutationLocked;
    tasksByIdReference.current = tasksById;
  }, [editable, mutationLocked, onCanonicalSyncFailure, onTaskAddRejected, onTaskCreate, onTaskDeleteRequest, onTaskEditorOpen, onTaskHierarchyCommand, onLinkCreate, onLinkDelete, tasksById]);

  useEffect(() => {
    const frame = fullscreenFrameReference.current;
    if (!frame) return;
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === frame;
      setIsFullscreen(active);
      if (active) setFullscreenMessage("");
      else if (fullscreenWasActiveReference.current && frame.isConnected && document.fullscreenElement === null) fullscreenButtonReference.current?.focus({ preventScroll: true });
      fullscreenWasActiveReference.current = active;
    };
    const onFullscreenError = () => setFullscreenMessage("전체화면으로 전환할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    const onEditorExitError = () => setFullscreenMessage("전체화면을 종료하지 못해 작업 정보를 열 수 없습니다. 전체화면을 종료한 뒤 다시 시도해 주세요.");
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("fullscreenerror", onFullscreenError);
    frame.addEventListener("project-gantt-fullscreen-exit-error", onEditorExitError);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("fullscreenerror", onFullscreenError);
      frame.removeEventListener("project-gantt-fullscreen-exit-error", onEditorExitError);
      if (document.fullscreenElement === frame) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  function captureSummaryToggleState(): Map<string, boolean> {
    const root = ganttScrollReference.current;
    const state = new Map<string, boolean>();
    if (!root) return state;
    root.querySelectorAll<HTMLElement>('[data-action="open-task"]').forEach((toggle) => {
      const row = toggle.closest<HTMLElement>(".wx-row");
      const taskId = row ? taskIdFromElement(row) : null;
      if (taskId) state.set(taskId, toggle.classList.contains("wxi-menu-right"));
    });
    return state;
  }

  async function restoreFullscreenUiState(
    savedColumns: IColumnConfig[],
    summaryState: ReadonlyMap<string, boolean>,
  ) {
    const api = apiReference.current;
    const root = ganttScrollReference.current;
    if (!api || !root) return;
    await api.exec("set-columns", { columns: savedColumns });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    root.querySelectorAll<HTMLElement>('[data-action="open-task"]').forEach((toggle) => {
      const row = toggle.closest<HTMLElement>(".wx-row");
      const taskId = row ? taskIdFromElement(row) : null;
      if (!taskId || !summaryState.has(taskId)) return;
      const shouldBeCollapsed = summaryState.get(taskId)!;
      const isCollapsed = toggle.classList.contains("wxi-menu-right");
      if (isCollapsed !== shouldBeCollapsed) toggle.click();
    });
  }

  async function toggleFullscreen() {
    const frame = fullscreenFrameReference.current;
    if (!frame || fullscreenPendingReference.current) return;
    fullscreenPendingReference.current = true;
    setFullscreenPending(true);
    setFullscreenMessage("");
    try {
      // Flush pending canonical/column state before the browser changes layout.
      // Re-applying columns after fullscreenchange can reset SVAR UI state such as
      // Summary expand/collapse, so settle the existing queue first instead.
      await canonicalSyncQueueReference.current;
      const api = apiReference.current;
      const savedColumns = (api?.getState().columns ?? []).map((column) => ({ ...column }));
      const summaryState = captureSummaryToggleState();
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement && typeof frame.requestFullscreen === "function") {
        await frame.requestFullscreen();
      } else {
        throw new Error("Fullscreen unavailable");
      }
      if (savedColumns.length > 0) await restoreFullscreenUiState(savedColumns, summaryState);
    } catch {
      setFullscreenMessage("전체화면으로 전환하거나 종료할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    } finally {
      fullscreenPendingReference.current = false;
      setFullscreenPending(false);
    }
  }

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const frame = fullscreenFrameReference.current;
      if (!frame || !frame.getClientRects().length || event.defaultPrevented || event.repeat || event.isComposing ||
        !event.shiftKey || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "f" ||
        fullscreenShortcutBlocked(event.target) || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      void toggleFullscreen();
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  });

  useEffect(() => {
    const api = apiReference.current;
    const root = ganttScrollReference.current;
    if (!api || !root || !apiInstanceId) return;
    const tag = "project-task-editor";
    api.detach(tag);
    api.intercept("show-editor", (event) => {
      if (apiReference.current === api && root.isConnected && typeof event.id === "string" && tasksByIdReference.current.has(event.id)) {
        onTaskEditorOpenReference.current(event.id);
      }
      // The project editor owns explicit server-confirmed saves, not Core's editor.
      return false;
    }, { tag });
    return () => api.detach(tag);
  }, [apiInstanceId]);

  useEffect(() => {
    const api = apiReference.current;
    if (!api || !apiInstanceId) return;
    const tag = "project-link-mutations";
    api.detach(tag);
    const add = createLinkAddGateway(({ source, target }) => {
      if (!canCreateReference.current) return;
      if (typeof source === "string" && typeof target === "string") onLinkCreateReference.current(source, target);
    });
    const remove = createLinkDeleteGateway((id) => {
      if (!canCreateReference.current) return;
      if (typeof id === "string") onLinkDeleteReference.current(id);
    });
    api.intercept("add-link", (event) => canonicalSyncDepthReference.current > 0 ? true : add(event), { tag });
    api.intercept("delete-link", (event) => canonicalSyncDepthReference.current > 0 ? true : remove(event), { tag });
    return () => api.detach(tag);
  }, [apiInstanceId]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root) return;
    const setNativeAddAccessibility = () => {
      root.querySelectorAll<HTMLElement>('[data-action="add-task"]').forEach((action) => {
        action.setAttribute("aria-disabled", String(mutationLocked));
      });
    };
    setNativeAddAccessibility();
    const observer = new MutationObserver(setNativeAddAccessibility);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mutationLocked]);
  const svarTasks = useMemo(() => projectTasksToSvarTasks(tasks), [tasks]);
  const svarLinks = useMemo(() => projectLinksToSvarLinks(links, tasks), [links, tasks]);
  const taskUpdateGateway = useMemo(
    () => createTaskUpdateGateway((local) => {
      const task = typeof local.taskId === "string" ? tasksById.get(local.taskId) : undefined;
      if (!task) return;
      const command = translateProjectTaskUpdate(local, task, calendar);
      if (command) onTaskCommand(command);
    }),
    [calendar, onTaskCommand, tasksById],
  );
  const onUpdateTask = useCallback((event: TaskUpdateEvent) => {
    // Read mutable guards only when the widget dispatches an event, not
    // through a callback passed to a factory during React rendering.
    if (canonicalSyncDepthReference.current > 0 || !canCreateReference.current) return;
    taskUpdateGateway(event);
  }, [taskUpdateGateway]);
  const columns = useMemo(
    () => baseProjectColumns.map((column) => (
      column.id === "externalId"
        ? { ...column, hidden: !columnVisibility.externalId }
        : column.id === "projectStart"
          ? {
            ...column,
            hidden: !columnVisibility.projectStart,
            sort: (first: ITask, second: ITask) => {
              const difference = (first.start?.getTime() ?? 0) - (second.start?.getTime() ?? 0);
              return difference === 0 ? 0 : difference < 0 ? -1 : 1;
            },
            getter: (task: ITask) => task.start instanceof Date
              ? formatLocaleDateOnly(dateOnlyFromLocalDate(task.start), locales)
              : "—",
          }
          : column.id === "projectDuration"
            ? {
              ...column,
              hidden: !columnVisibility.projectDuration,
              getter: (task: ITask) => (
                // Core renders elapsed calendar duration for its bar. Keep
                // the Grid contract truthful by reading the scheduler's
                // canonical working-day duration from the snapshot instead.
                typeof task.id === "string" && typeof tasksByIdReference.current.get(task.id)?.duration === "number"
                  ? `${tasksByIdReference.current.get(task.id)!.duration} 근무일`
                  : "—"
              ),
            }
          : column.id === "text"
            ? { ...column, hidden: !columnVisibility.text }
            : column
    )),
    [columnVisibility, locales],
  );
  const initialConfig = useState(() => ({
    tasks: projectTasksToSvarTasks(tasks),
    links: projectLinksToSvarLinks(links, tasks),
    columns,
  }))[0];
  const initialRange = useState(() => {
    const fallback = emptyWorkspaceRange();
    const starts = initialConfig.tasks.flatMap((task) => task.start instanceof Date ? [task.start] : []).concat(fallback.start);
    const ends = initialConfig.tasks.flatMap((task) => task.end instanceof Date ? [task.end] : []).concat(fallback.end);
    // New work always starts today. Keep that small range in the initial
    // scale so a canonical root add remains visible without reinitializing.
    return { start: new Date(Math.min(...starts.map((date) => date.getTime()))), end: new Date(Math.max(...ends.map((date) => date.getTime()))) };
  })[0];

  useEffect(() => {
    const syncVersion = ++canonicalSyncVersionReference.current;
    canonicalSyncQueueReference.current = canonicalSyncQueueReference.current.then(async () => {
      if (syncVersion !== canonicalSyncVersionReference.current) return;
      const api = apiReference.current;
      if (!api) return;
      canonicalSyncDepthReference.current += 1;
      try {
        const currentTasks = (api.serialize({ data: "tasks" }) ?? []) as ITask[];
        const currentLinks = (api.serialize({ data: "links" }) ?? []) as ILink[];
        await applyCanonicalGanttSync(
          api,
          { tasks: currentTasks, links: currentLinks },
          { tasks: svarTasks, links: svarLinks },
          () => syncVersion === canonicalSyncVersionReference.current,
        );
      } catch {
        if (syncVersion === canonicalSyncVersionReference.current) onCanonicalSyncFailureReference.current();
      } finally { canonicalSyncDepthReference.current -= 1; }
    }).catch(() => onCanonicalSyncFailureReference.current());
  }, [svarLinks, svarTasks]);

  useEffect(() => {
    const api = apiReference.current;
    if (!api || !apiInstanceId) return;
    const visible = visibleTaskIds ? new Set(visibleTaskIds) : null;
    if (!visible && !taskFilterAppliedReference.current) return;
    taskFilterAppliedReference.current = visible !== null;
    void api.exec("filter-tasks", {
      filter: visible ? (task: ITask) => typeof task.id === "string" && visible.has(task.id) : undefined,
    });
  }, [apiInstanceId, visibleTaskIds]);

  useEffect(() => {
    canonicalSyncQueueReference.current = canonicalSyncQueueReference.current.then(async () => {
      const api = apiReference.current;
      if (!api) return;
      canonicalSyncDepthReference.current += 1;
      try {
        // State columns are optional; retain configured defaults when absent.
        const currentColumns = api.getState().columns ?? [];
        const nextColumns = columns.map((column) => {
          const current = currentColumns.find((candidate) => candidate.id === column.id);
          return current ? { ...column, width: current.width, flexgrow: current.flexgrow } : column;
        });
        await api.exec("set-columns", { columns: nextColumns });
      } catch {
        onCanonicalSyncFailureReference.current();
      } finally {
        // State reads and column mapping must also release the sync guard.
        canonicalSyncDepthReference.current -= 1;
      }
    }).catch(() => onCanonicalSyncFailureReference.current());
  }, [columns]);

  useEffect(() => {
    if (!columnMenuPosition) return;
    const restoreColumnMenuTrigger = () => {
      queueMicrotask(() => columnMenuTriggerReference.current?.focus({ preventScroll: true }));
    };
    const closeForOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && columnMenuReference.current?.contains(event.target)) return;
      setColumnMenuPosition(null);
      restoreColumnMenuTrigger();
    };
    document.addEventListener("pointerdown", closeForOutsidePointer, true);
    const closeForViewportChange = (event?: Event) => {
      if (event?.target instanceof Node && columnMenuReference.current?.contains(event.target)) return;
      setColumnMenuPosition(null);
      restoreColumnMenuTrigger();
    };
    window.addEventListener("resize", closeForViewportChange);
    document.addEventListener("scroll", closeForViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsidePointer, true);
      window.removeEventListener("resize", closeForViewportChange);
      document.removeEventListener("scroll", closeForViewportChange, true);
    };
  }, [columnMenuPosition]);

  useEffect(() => {
    if (!taskMenu) return;
    const restoreTaskMenuTrigger = () => {
      queueMicrotask(() => taskMenuTriggerReference.current?.focus({ preventScroll: true }));
    };
    const closeForOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && taskMenuReference.current?.contains(event.target)) return;
      setTaskMenu(null);
      setTaskSubmenu(null);
      restoreTaskMenuTrigger();
    };
    const closeForViewportChange = (event?: Event) => {
      if (event?.target instanceof Node && taskMenuReference.current?.contains(event.target)) return;
      // 열기 전에 완료된 scrollIntoView/SVAR 동기화의 지연 알림은 무시한다.
      // 임의의 지연 시간 대신 호출 대상 조상의 실제 위치 변화를 확인한다.
      if (event?.type === "scroll" && !taskMenuScrollChangedReference.current()) return;
      setTaskMenu(null);
      setTaskSubmenu(null);
      restoreTaskMenuTrigger();
    };
    document.addEventListener("pointerdown", closeForOutsidePointer, true);
    window.addEventListener("resize", closeForViewportChange);
    document.addEventListener("scroll", closeForViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsidePointer, true);
      window.removeEventListener("resize", closeForViewportChange);
      document.removeEventListener("scroll", closeForViewportChange, true);
    };
  }, [taskMenu]);

  useEffect(() => {
    if (!columnMenuPosition) return;
    columnMenuReference.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [columnMenuPosition]);

  useLayoutEffect(() => {
    if (!columnMenuPosition) return;
    const menu = columnMenuReference.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const next = clampMenuPosition(bounds.left, bounds.top, bounds.width, bounds.height);
    if (Math.abs(next.left - bounds.left) < 1 && Math.abs(next.top - bounds.top) < 1) return;
    setColumnMenuPosition(next);
  }, [columnMenuPosition]);

  useLayoutEffect(() => {
    if (!taskMenu) return;
    const menu = taskMenuReference.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const next = clampMenuPosition(bounds.left, bounds.top, bounds.width, bounds.height);
    if (Math.abs(next.left - bounds.left) < 1 && Math.abs(next.top - bounds.top) < 1) return;
    setTaskMenu((current) => current ? { ...current, ...next } : current);
  }, [taskMenu]);

  useLayoutEffect(() => {
    if (!taskSubmenu || taskSubmenu.placement === "drilldown") return;
    const menu = taskSubmenuReference.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const top = Math.max(8, Math.min(taskSubmenu.top, window.innerHeight - bounds.height - 8));
    if (Math.abs(top - taskSubmenu.top) >= 1) setTaskSubmenu((current) => current ? { ...current, top } : current);
  }, [taskSubmenu]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root) return;
    const makeContextTargetsFocusable = () => {
      root.querySelectorAll<HTMLElement>(".wx-table-container .wx-header").forEach((header) => {
        if (!header.hasAttribute("tabindex")) header.tabIndex = 0;
      });
      root.querySelectorAll<HTMLElement>(TASK_TARGET_SELECTOR).forEach((element) => {
        const id = taskIdFromElement(element);
        if (id && tasksByIdReference.current.has(id) && !element.hasAttribute("tabindex")) element.tabIndex = 0;
      });
    };
    makeContextTargetsFocusable();
    const observer = new MutationObserver(makeContextTargetsFocusable);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const scales = useMemo(() => [
    {
      unit: "month",
      step: 1,
      format: (date: Date) => new Intl.DateTimeFormat(locales, {
        year: "numeric",
        month: "long",
      }).format(date),
    },
    scaleMode === "day"
      ? {
        unit: "day",
        step: 1,
        format: (date: Date) => new Intl.DateTimeFormat(locales, {
          day: "numeric",
          weekday: "narrow",
        }).format(date),
      }
      : {
        unit: "week",
        step: 1,
        format: (date: Date) => formatIsoWeek(date),
      },
  ], [locales, scaleMode]);

  function interceptNativeTaskAdd(local: LocalTaskAddCommand): void {
    if (!canCreateReference.current) {
      if (!mutationLockedReference.current) onTaskAddRejectedReference.current();
      return;
    }
    const target = typeof local.targetTaskId === "string"
      ? tasksByIdReference.current.get(local.targetTaskId)
      : undefined;
    if ((typeof local.targetTaskId === "string" && !target) ||
      (local.mode !== undefined && local.mode !== "child")) {
      onTaskAddRejectedReference.current();
      return;
    }
    onTaskCreateReference.current({
      name: "새 작업",
      type: "task",
      start: todayDateOnly(),
      duration: 1,
      progress: 0,
      ...(target ? { parentTaskId: target.taskId } : {}),
    });
  }

  const initialize = useMemo(() => (api: IApi) => {
    apiReference.current = api;
    setApiInstanceId(`svar-api-${nextApiInstanceId++}`);
    api.detach("project-native-add");
    api.intercept(
      "add-task",
      (event) => event.eventSource === "project-canonical-sync" && canonicalSyncDepthReference.current > 0
        ? undefined
        : canonicalSyncDepthReference.current > 0
          ? false
          : createTaskAddGateway(interceptNativeTaskAdd)(event),
      { tag: "project-native-add" },
    );
    api.detach("project-summary-update");
    api.intercept(
      "update-task",
      (event) => {
        const task = typeof event.id === "string"
          ? tasksByIdReference.current.get(event.id)
          : undefined;
        if (event.eventSource === "project-canonical-sync" && canonicalSyncDepthReference.current > 0) return undefined;
        return canonicalSyncDepthReference.current > 0 || !canCreateReference.current || task?.type === "summary" ? false : undefined;
      },
      { tag: "project-summary-update" },
    );
  // SVAR retains this initializer for the mounted instance. Refs keep the
  // revision and callback current without re-registering EventBus handlers.
  }, []);

  function headerFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const header = target.closest(".wx-table-container .wx-header");
    return header instanceof HTMLElement ? header : null;
  }

  function openColumnMenu(header: HTMLElement, x: number, y: number) {
    header.focus({ preventScroll: true });
    columnMenuTriggerReference.current = header;
    setTaskMenu(null);
    setColumnMenuPosition(clampMenuPosition(x, y, 208, 196));
  }

  function openTaskMenu(target: EventTarget | null, x?: number, y?: number): boolean {
    const root = ganttScrollReference.current;
    if (!root || !apiReference.current || !apiInstanceId) return false;
    const match = resolveTaskContextTarget(target, root, (id) => tasksByIdReference.current.has(id));
    if (!match) return false;
    if (!match.element.hasAttribute("tabindex")) match.element.tabIndex = 0;
    match.element.focus({ preventScroll: true });
    taskMenuTriggerReference.current = match.element;
    taskMenuScrollChangedReference.current = captureMenuScrollChange(match.element);
    const bounds = match.element.getBoundingClientRect();
    const anchorX = x ?? bounds.left + Math.min(bounds.width / 2, 24);
    const anchorY = y ?? bounds.top + Math.min(bounds.height / 2, 24);
    const rootRem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const rootWidth = Math.min(16 * rootRem, window.innerWidth - 16);
    setColumnMenuPosition(null);
    setTaskSubmenu(null);
    suppressTaskSubmenuFocusOpenReference.current = null;
    focusTaskMenuOnOpenReference.current = true;
    setTaskMenu({ taskId: match.taskId, ...clampMenuPosition(anchorX, anchorY, rootWidth, Math.min(452, window.innerHeight - 16)) });
    return true;
  }

  function openTaskEditorFromMenu() {
    const api = apiReference.current;
    if (!api || !taskMenu) return;
    const taskId = taskMenu.taskId;
    setTaskMenu(null);
    void api.exec("show-editor", { id: taskId });
  }

  function requestTaskDeleteFromMenu() {
    if (!taskMenu) return;
    const taskId = taskMenu.taskId;
    const trigger = taskMenuTriggerReference.current;
    setTaskMenu(null);
    onTaskDeleteRequestReference.current(taskId, trigger);
  }

  function executeHierarchyCommand(command: TaskHierarchyCommandRequest) {
    setTaskMenu(null);
    onTaskHierarchyCommandReference.current(command);
  }

  function createTaskFromMenu(placement: "before" | "after" | "child") {
    if (!taskMenu) return;
    executeHierarchyCommand({
      kind: "create",
      anchorTaskId: taskMenu.taskId,
      placement,
      task: {
        name: "새 작업",
        type: "task",
        start: todayDateOnly(),
        duration: 1,
        progress: 0,
      },
    });
  }

  function storeClipboard(mode: "cut" | "copy") {
    if (!taskMenu) return;
    setTaskClipboard({ mode, taskId: taskMenu.taskId, revision: projectRevision });
    closeTaskMenu();
  }

  function pasteFromMenu(placement: "before" | "after" | "child" = "after") {
    if (!taskMenu || !activeClipboard) return;
    executeHierarchyCommand(createPasteCommand(activeClipboard, taskMenu.taskId, placement));
  }

  function runTaskShortcut(event: ReactKeyboardEvent<HTMLDivElement>): boolean {
    if (!(event.target instanceof Element) ||
      event.target.closest("input, textarea, select, button, a, [contenteditable=true], dialog, .project-task-context-menu")) return false;
    const root = ganttScrollReference.current;
    if (!root) return false;
    const match = resolveTaskContextTarget(event.target, root, (id) => tasksByIdReference.current.has(id));
    if (!match) return false;
    const canMutate = editable && !mutationLocked && !taskHasDependencyLinks(tasksByIdReference.current.size ? Array.from(tasksByIdReference.current.values()) : tasks, match.taskId, links);
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "c" && canMutate) {
      setTaskClipboard({ mode: "copy", taskId: match.taskId, revision: projectRevision });
    } else if (modifier && event.key.toLowerCase() === "x" && canMutate) {
      setTaskClipboard({ mode: "cut", taskId: match.taskId, revision: projectRevision });
    } else if (modifier && event.key.toLowerCase() === "v" && canMutate && activeClipboard && activeClipboard.taskId !== match.taskId) {
      onTaskHierarchyCommandReference.current(createPasteCommand(activeClipboard, match.taskId));
    } else if ((event.key === "Delete" || event.key === "Backspace" || (modifier && event.key.toLowerCase() === "d")) && canMutate) {
      onTaskDeleteRequestReference.current(match.taskId, match.element);
    } else {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function handleHeaderContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const header = headerFrom(event.target);
    if (header) {
      event.preventDefault();
      openColumnMenu(header, event.clientX, event.clientY);
    } else if (openTaskMenu(event.target, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleTaskDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    // SVAR's readonly mode suppresses its native show-editor action. Keep
    // mutation readonly while still allowing the project's information editor
    // to open from Grid/Chart double-click.
    if (editable) return;
    const root = ganttScrollReference.current;
    if (!root) return;
    const match = resolveTaskContextTarget(event.target, root, (id) => tasksByIdReference.current.has(id));
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    onTaskEditorOpenReference.current(match.taskId);
  }

  function handleHeaderKeyboardMenu(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (runTaskShortcut(event)) return;
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    const header = headerFrom(event.target);
    if (header) {
      event.preventDefault();
      const bounds = header.getBoundingClientRect();
      openColumnMenu(header, bounds.left + Math.min(bounds.width / 2, 24), bounds.top + Math.min(bounds.height / 2, 24));
    } else if (openTaskMenu(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function closeColumnMenu() {
    setColumnMenuPosition(null);
    queueMicrotask(() => columnMenuTriggerReference.current?.focus({ preventScroll: true }));
  }

  function closeTaskMenu() {
    setTaskMenu(null);
    setTaskSubmenu(null);
    suppressTaskSubmenuFocusOpenReference.current = null;
    queueMicrotask(() => taskMenuTriggerReference.current?.focus({ preventScroll: true }));
  }

  function openTaskSubmenu(name: TaskSubmenuName, explicit: boolean) {
    if (!explicit && suppressTaskSubmenuFocusOpenReference.current === name) {
      suppressTaskSubmenuFocusOpenReference.current = null;
      return;
    }
    const root = taskMenuReference.current;
    const trigger = taskSubmenuTriggers.current[name];
    if (!root || !trigger || trigger.disabled) return;
    const rootBounds = root.getBoundingClientRect();
    const triggerBounds = trigger.getBoundingClientRect();
    // Match the CSS 10.5rem width even when the user changes the root font size.
    const childWidth = Math.min(10.5 * parseFloat(getComputedStyle(document.documentElement).fontSize), window.innerWidth - 16);
    const right = rootBounds.right - 4;
    const left = rootBounds.left - childWidth + 4;
    const placement = right + childWidth <= window.innerWidth - 8
      ? "right"
      : left >= 8 ? "left" : "drilldown";
    if (placement === "drilldown" && !explicit) return;
    setTaskSubmenu({
      name,
      placement,
      left: placement === "left" ? left : right,
      top: Math.max(8, triggerBounds.top - 6),
    });
  }

  function focusFirstTaskSubmenuItem() {
    requestAnimationFrame(() => {
      const submenu = taskSubmenuReference.current;
      const first = submenu?.querySelector<HTMLButtonElement>(
        '.project-task-context-submenu-command[role="menuitem"]:not(:disabled)',
      ) ?? submenu?.querySelector<HTMLButtonElement>(".project-task-context-submenu-back");
      if (first) focusTaskMenuItem(first);
    });
  }

  function returnToTaskMenu() {
    const name = taskSubmenu?.name;
    suppressTaskSubmenuFocusOpenReference.current = name ?? null;
    setTaskSubmenu(null);
    requestAnimationFrame(() => {
      const trigger = name ? taskSubmenuTriggers.current[name] : null;
      if (trigger) focusTaskMenuItem(trigger);
      if (suppressTaskSubmenuFocusOpenReference.current === name) suppressTaskSubmenuFocusOpenReference.current = null;
    });
  }

  function focusTaskMenuItem(item: HTMLButtonElement) {
    item.focus({ preventScroll: true });
    const scroller = item.closest<HTMLElement>(".project-task-context-submenu-flyout") ?? taskMenuReference.current;
    if (!scroller) return;
    const itemBounds = item.getBoundingClientRect();
    const scrollBounds = scroller.getBoundingClientRect();
    if (itemBounds.bottom > scrollBounds.bottom - 4) scroller.scrollTop += itemBounds.bottom - scrollBounds.bottom + 4;
    else if (itemBounds.top < scrollBounds.top + 4) scroller.scrollTop -= scrollBounds.top - itemBounds.top + 4;
  }

  function closeTaskSubmenuForOrdinaryRootItem(target: EventTarget | null) {
    if (!taskSubmenu || !(target instanceof Element)) return;
    const item = target.closest<HTMLButtonElement>('button[role="menuitem"]');
    if (!item || !taskMenuReference.current?.contains(item)) return;
    if (item.closest(".project-task-context-submenu-host") || item.closest(".project-task-context-submenu")) return;
    setTaskSubmenu(null);
  }

  function handleColumnMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeColumnMenu();
    }
  }

  function enabledMenuItems(menu: HTMLElement): HTMLButtonElement[] {
    return Array.from(menu.querySelectorAll<HTMLButtonElement>(
      ':scope > button[role="menuitem"]:not(:disabled), :scope > .project-task-context-submenu-host > button[role="menuitem"]:not(:disabled), :scope > .project-task-context-submenu-content > button[role="menuitem"]:not(:disabled)',
    ));
  }

  function handleTaskMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeTaskMenu();
      return;
    }
    const rootMenu = taskMenuReference.current;
    if (!rootMenu) return;
    if (event.target === rootMenu && taskSubmenu?.placement !== "drilldown") {
      const items = enabledMenuItems(rootMenu);
      const targetIndex = event.key === "ArrowUp" || event.key === "End" ? items.length - 1 : 0;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && items[targetIndex]) {
        event.preventDefault();
        event.stopPropagation();
        focusTaskMenuItem(items[targetIndex]);
      }
      return;
    }

    if (!(event.target instanceof HTMLButtonElement)) return;
    const currentMenu = event.target.closest<HTMLElement>('[role="menu"]');
    if (!currentMenu) return;

    if (event.key === "ArrowRight") {
      const name = event.target.closest<HTMLElement>(".project-task-context-submenu-host")?.getAttribute("data-submenu") as TaskSubmenuName | null;
      if (name && !event.target.disabled) {
        event.preventDefault();
        event.stopPropagation();
        openTaskSubmenu(name, true);
        focusFirstTaskSubmenuItem();
      }
      return;
    }

    if (event.key === "ArrowLeft" && currentMenu.classList.contains("project-task-context-submenu")) {
      event.preventDefault();
      event.stopPropagation();
      returnToTaskMenu();
      return;
    }

    const items = enabledMenuItems(currentMenu);
    const index = items.indexOf(event.target);
    if (index < 0 || items.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % items.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      event.stopPropagation();
      if (items[nextIndex]) focusTaskMenuItem(items[nextIndex]);
    }
  }

  const selectedTaskHasLinks = taskMenu ? taskHasDependencyLinks(tasks, taskMenu.taskId, links) : false;
  const canMutate = editable && !mutationLocked && !selectedTaskHasLinks;
  const canDelete = canMutate;
  const activeClipboard = taskClipboard?.revision === projectRevision ? taskClipboard : null;
  const menuCapabilities = taskMenu
    ? taskContextCapabilities(tasks, taskMenu.taskId, editable, mutationLocked, links, activeClipboard)
    : null;
  const submenuId = taskSubmenu ? `${instanceId}-${taskSubmenu.name.replaceAll(" ", "-")}-submenu` : undefined;
  const submenuCommands = taskMenu && menuCapabilities && taskSubmenu ? (() => {
    switch (taskSubmenu.name) {
      case "Add": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canAddChild} onClick={() => createTaskFromMenu("child")} role="menuitem" type="button">Child task</button>
        <button className="project-task-context-submenu-command" disabled={!canMutate} onClick={() => createTaskFromMenu("before")} role="menuitem" type="button">Task above</button>
        <button className="project-task-context-submenu-command" disabled={!canMutate} onClick={() => createTaskFromMenu("after")} role="menuitem" type="button">Task below</button>
      </>;
      case "Convert to": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canConvertToTask} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "task" })} role="menuitem" type="button">Task</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canConvertToSummary} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "summary" })} role="menuitem" type="button">Summary task</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canConvertToMilestone} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "milestone" })} role="menuitem" type="button">Milestone</button>
      </>;
      case "Paste": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canPaste || !menuCapabilities.canAddChild} onClick={() => pasteFromMenu("child")} role="menuitem" type="button">As child</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canPaste} onClick={() => pasteFromMenu("before")} role="menuitem" type="button">Above</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canPaste} onClick={() => pasteFromMenu("after")} role="menuitem" type="button">Below</button>
      </>;
      case "Move": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canMoveUp} onClick={() => executeHierarchyCommand(createHierarchyCommand("move-up", taskMenu.taskId))} role="menuitem" type="button">Move up</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canMoveDown} onClick={() => executeHierarchyCommand(createHierarchyCommand("move-down", taskMenu.taskId))} role="menuitem" type="button">Move down</button>
      </>;
    }
  })() : null;

  useEffect(() => {
    if (!taskMenu || !focusTaskMenuOnOpenReference.current) return;
    focusTaskMenuOnOpenReference.current = false;
    if (!taskSubmenu) queueMicrotask(() => {
      if (!taskSubmenuReference.current) taskMenuReference.current?.focus({ preventScroll: true });
    });
  }, [taskMenu, taskSubmenu]);

  return (
    <div className="project-gantt-frame" ref={fullscreenFrameReference} data-gantt-scale-mode={scaleMode} data-project-gantt-api-instance={apiInstanceId ?? undefined} data-project-gantt-instance={instanceId} data-task-mutation-locked={mutationLocked || undefined}>
      <Willow>
      <div className="project-gantt-scale-toolbar">
        <div aria-label="Gantt 표시 단위" className="project-gantt-scale-controls" role="group">
          <span aria-hidden="true" className="project-gantt-scale-label">표시 단위</span>
          <button aria-pressed={scaleMode === "day"} onClick={() => setScaleMode("day")} type="button">일</button>
          <button aria-pressed={scaleMode === "week"} onClick={() => setScaleMode("week")} type="button">주</button>
        </div>
        <button className="project-gantt-fullscreen-button" ref={fullscreenButtonReference} type="button"
          aria-label={isFullscreen ? "Gantt 전체 화면 종료" : "Gantt 전체 화면"} aria-pressed={isFullscreen}
          aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
          title={isFullscreen ? "전체 화면 종료 (Esc)" : "전체 화면 (Ctrl/Cmd+Shift+F)"}
          aria-busy={fullscreenPending || undefined} aria-disabled={fullscreenPending || undefined}
          onClick={() => void toggleFullscreen()}>
          {isFullscreen ? "전체 화면 종료" : "전체 화면"}
        </button>
        <span className="project-gantt-fullscreen-status" role="status" aria-live="polite">{fullscreenMessage}</span>
      </div>
      <div
        aria-label="프로젝트 일정 Grid와 Gantt 차트"
          className="project-gantt-scroll"
          onContextMenu={handleHeaderContextMenu}
          onDoubleClick={handleTaskDoubleClick}
          onKeyDownCapture={handleHeaderKeyboardMenu}
          ref={ganttScrollReference}
          role="region"
          tabIndex={0}
        >
          <div className="wx-theme gantt-widget project-gantt-widget">
            <Gantt
              columns={initialConfig.columns}
              displayMode="all"
              gridWidth={620}
              highlightTime={scaleMode === "day" ? highlightWeekend : undefined}
              init={initialize}
              links={initialConfig.links}
              onUpdateTask={onUpdateTask}
              readonly={!editable}
              scales={scales}
              end={initialRange.end}
              start={initialRange.start}
              tasks={initialConfig.tasks}
            />
          </div>
        </div>
        {columnMenuPosition ? <div
          aria-label="표시 열 선택"
          className="project-column-menu"
          onKeyDown={handleColumnMenuKeyDown}
          ref={columnMenuReference}
          style={columnMenuPosition}
        >
          <fieldset>
            <legend>표시 열</legend>
            {dataColumns.map((column) => {
              const isOnlyVisible = columnVisibility[column.id] && dataColumns.every(
                (candidate) => candidate.id === column.id || !columnVisibility[candidate.id],
              );
              return <label
                className={isOnlyVisible ? "project-column-menu-option is-disabled" : "project-column-menu-option"}
                key={column.id}
              >
                <input
                  checked={columnVisibility[column.id]}
                  disabled={isOnlyVisible}
                  onChange={() => onColumnVisibilityChange(column.id)}
                  type="checkbox"
                />
                {column.label}
              </label>;
            })}
          </fieldset>
        </div> : null}
        {taskMenu && menuCapabilities ? <div
          aria-label="작업 메뉴"
          className="project-task-context-menu"
          onFocusCapture={(event) => closeTaskSubmenuForOrdinaryRootItem(event.target)}
          onKeyDown={handleTaskMenuKeyDown}
          onPointerOver={(event) => { if (event.pointerType === "mouse") closeTaskSubmenuForOrdinaryRootItem(event.target); }}
          onScroll={(event) => { if (event.target === event.currentTarget && taskSubmenu?.placement !== "drilldown") setTaskSubmenu(null); }}
          ref={taskMenuReference}
          role="menu"
          tabIndex={-1}
          style={{ left: taskMenu.left, top: taskMenu.top }}
        >
          {taskSubmenu?.placement === "drilldown" ? <div
            aria-label={taskSubmenu.name}
            className="project-task-context-submenu project-task-context-submenu-drilldown"
            id={submenuId}
            ref={taskSubmenuReference}
            role="menu"
          >
            <button className="project-task-context-submenu-back" onClick={returnToTaskMenu} role="menuitem" type="button">‹ Back</button>
            <div className="project-task-context-submenu-content">{submenuCommands}</div>
          </div> : <>
          <div className="project-task-context-submenu-host" data-submenu="Add">
            <button aria-controls={taskSubmenu?.name === "Add" ? submenuId : undefined} aria-expanded={taskSubmenu?.name === "Add"} aria-haspopup="menu" aria-label="Add" disabled={!canMutate} onClick={() => { openTaskSubmenu("Add", true); focusFirstTaskSubmenuItem(); }} onFocus={() => openTaskSubmenu("Add", false)} onPointerEnter={(event) => { if (event.pointerType === "mouse") openTaskSubmenu("Add", false); }} ref={(node) => { taskSubmenuTriggers.current.Add = node; }} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">＋</span><span>Add</span><span className="project-task-context-menu-arrow">›</span>
            </button>
          </div>
          <div className="project-task-context-submenu-host" data-submenu="Convert to">
            <button aria-controls={taskSubmenu?.name === "Convert to" ? submenuId : undefined} aria-expanded={taskSubmenu?.name === "Convert to"} aria-haspopup="menu" aria-label="Convert to" disabled={!canMutate} onClick={() => { openTaskSubmenu("Convert to", true); focusFirstTaskSubmenuItem(); }} onFocus={() => openTaskSubmenu("Convert to", false)} onPointerEnter={(event) => { if (event.pointerType === "mouse") openTaskSubmenu("Convert to", false); }} ref={(node) => { taskSubmenuTriggers.current["Convert to"] = node; }} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">↻</span><span>Convert to</span><span className="project-task-context-menu-arrow">›</span>
            </button>
          </div>
          <button aria-label="Edit" onClick={openTaskEditorFromMenu} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">i</span><span>Edit</span>
          </button>
          <div className="project-task-context-menu-separator" role="separator" />
          <button aria-label="Cut" disabled={!canMutate} onClick={() => storeClipboard("cut")} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">✂</span><span>Cut</span><kbd>Ctrl+X</kbd>
          </button>
          <button aria-label="Copy" disabled={!canMutate} onClick={() => storeClipboard("copy")} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">□</span><span>Copy</span><kbd>Ctrl+C</kbd>
          </button>
          <div className="project-task-context-submenu-host" data-submenu="Paste">
            <button aria-controls={taskSubmenu?.name === "Paste" ? submenuId : undefined} aria-expanded={taskSubmenu?.name === "Paste"} aria-haspopup="menu" aria-label="Paste" disabled={!menuCapabilities.canPaste} onClick={() => { openTaskSubmenu("Paste", true); focusFirstTaskSubmenuItem(); }} onFocus={() => openTaskSubmenu("Paste", false)} onPointerEnter={(event) => { if (event.pointerType === "mouse") openTaskSubmenu("Paste", false); }} ref={(node) => { taskSubmenuTriggers.current.Paste = node; }} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">▣</span><span>Paste</span><span className="project-task-context-menu-arrow">›</span>
            </button>
          </div>
          <div className="project-task-context-menu-separator" role="separator" />
          <div className="project-task-context-submenu-host" data-submenu="Move">
            <button aria-controls={taskSubmenu?.name === "Move" ? submenuId : undefined} aria-expanded={taskSubmenu?.name === "Move"} aria-haspopup="menu" aria-label="Move" disabled={!canMutate} onClick={() => { openTaskSubmenu("Move", true); focusFirstTaskSubmenuItem(); }} onFocus={() => openTaskSubmenu("Move", false)} onPointerEnter={(event) => { if (event.pointerType === "mouse") openTaskSubmenu("Move", false); }} ref={(node) => { taskSubmenuTriggers.current.Move = node; }} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">↕</span><span>Move</span><span className="project-task-context-menu-arrow">›</span>
            </button>
          </div>
          <button aria-label="Indent" disabled={!menuCapabilities.canIndent} onClick={() => executeHierarchyCommand(createHierarchyCommand("indent", taskMenu.taskId))} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">→</span><span>Indent</span>
          </button>
          <button aria-label="Outdent" disabled={!menuCapabilities.canOutdent} onClick={() => executeHierarchyCommand(createHierarchyCommand("outdent", taskMenu.taskId))} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">←</span><span>Outdent</span>
          </button>
          <div className="project-task-context-menu-separator" role="separator" />
          <button aria-label="Delete" className="project-task-context-menu-danger" disabled={!canDelete} onClick={requestTaskDeleteFromMenu} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">×</span><span>Delete</span><kbd>Ctrl+D / Backspace</kbd>
          </button>
          {taskSubmenu ? <div
            aria-label={taskSubmenu.name}
            className="project-task-context-submenu project-task-context-submenu-flyout"
            data-placement={taskSubmenu.placement}
            id={submenuId}
            ref={taskSubmenuReference}
            role="menu"
            style={{ left: taskSubmenu.left, top: taskSubmenu.top }}
          >{submenuCommands}</div> : null}
          </>}
        </div> : null}
      </Willow>
    </div>
  );
}
