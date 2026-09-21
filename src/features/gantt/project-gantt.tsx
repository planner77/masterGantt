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
import "./task-context-menu.css";
import "./gantt-scale-toolbar.css";

export type ProjectGridDataColumnId = "text" | "externalId" | "projectStart" | "projectDuration";

export type ProjectGridColumnVisibility = Record<ProjectGridDataColumnId, boolean>;
let nextApiInstanceId = 1;

type MenuPosition = Readonly<{ left: number; top: number }>;
type TaskMenuState = MenuPosition & Readonly<{ taskId: string }>;
type GanttScaleMode = "day" | "week";

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
  readonly columnVisibility: ProjectGridColumnVisibility;
  readonly onColumnVisibilityChange: (columnId: ProjectGridDataColumnId) => void;
  readonly tasks: readonly ProjectTaskDto[];
  readonly projectRevision: number;
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
  columnVisibility,
  onColumnVisibilityChange,
  tasks,
  projectRevision,
}: ProjectGanttProps) {
  const apiReference = useRef<IApi | null>(null);
  const onTaskCreateReference = useRef(onTaskCreate);
  const onTaskAddRejectedReference = useRef(onTaskAddRejected);
  const onCanonicalSyncFailureReference = useRef(onCanonicalSyncFailure);
  const onTaskEditorOpenReference = useRef(onTaskEditorOpen);
  const onTaskHierarchyCommandReference = useRef(onTaskHierarchyCommand);
  const onTaskDeleteRequestReference = useRef(onTaskDeleteRequest);
  const canCreateReference = useRef(editable && !mutationLocked);
  const mutationLockedReference = useRef(mutationLocked);
  const canonicalSyncDepthReference = useRef(0);
  const canonicalSyncVersionReference = useRef(0);
  const instanceId = useState(() => `project-gantt-${Math.random().toString(36).slice(2)}`)[0];
  const canonicalSyncQueueReference = useRef<Promise<void>>(Promise.resolve());
  const tasksByIdReference = useRef(new Map<string, ProjectTaskDto>());
  const ganttScrollReference = useRef<HTMLDivElement>(null);
  const columnMenuReference = useRef<HTMLDivElement>(null);
  const columnMenuTriggerReference = useRef<HTMLElement | null>(null);
  const taskMenuReference = useRef<HTMLDivElement>(null);
  const taskMenuTriggerReference = useRef<HTMLElement | null>(null);
  const taskMenuScrollChangedReference = useRef<() => boolean>(() => false);
  const [columnMenuPosition, setColumnMenuPosition] = useState<MenuPosition | null>(null);
  const [taskMenu, setTaskMenu] = useState<TaskMenuState | null>(null);
  const [taskClipboard, setTaskClipboard] = useState<TaskClipboard | null>(null);
  const [apiInstanceId, setApiInstanceId] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<GanttScaleMode>("day");
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
    canCreateReference.current = editable && !mutationLocked;
    mutationLockedReference.current = mutationLocked;
    tasksByIdReference.current = tasksById;
  }, [editable, mutationLocked, onCanonicalSyncFailure, onTaskAddRejected, onTaskCreate, onTaskDeleteRequest, onTaskEditorOpen, onTaskHierarchyCommand, tasksById]);

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
      restoreTaskMenuTrigger();
    };
    const closeForViewportChange = (event?: Event) => {
      if (event?.target instanceof Node && taskMenuReference.current?.contains(event.target)) return;
      // 열기 전에 완료된 scrollIntoView/SVAR 동기화의 지연 알림은 무시한다.
      // 임의의 지연 시간 대신 호출 대상 조상의 실제 위치 변화를 확인한다.
      if (event?.type === "scroll" && !taskMenuScrollChangedReference.current()) return;
      setTaskMenu(null);
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
    setColumnMenuPosition(null);
    setTaskMenu({ taskId: match.taskId, ...clampMenuPosition(anchorX, anchorY, 520, 452) });
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
    const canMutate = editable && !mutationLocked && links.length === 0;
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
    queueMicrotask(() => taskMenuTriggerReference.current?.focus({ preventScroll: true }));
  }

  function handleColumnMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeColumnMenu();
    }
  }

  function enabledMenuItems(menu: HTMLElement): HTMLButtonElement[] {
    return Array.from(menu.querySelectorAll<HTMLButtonElement>(
      ':scope > button[role="menuitem"]:not(:disabled), :scope > .project-task-context-submenu-host > button[role="menuitem"]:not(:disabled)',
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
    if (event.target === rootMenu) {
      const items = enabledMenuItems(rootMenu);
      const targetIndex = event.key === "ArrowUp" || event.key === "End" ? items.length - 1 : 0;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && items[targetIndex]) {
        event.preventDefault();
        event.stopPropagation();
        items[targetIndex].focus({ preventScroll: true });
      }
      return;
    }

    if (!(event.target instanceof HTMLButtonElement)) return;
    const currentMenu = event.target.closest<HTMLElement>('[role="menu"]');
    if (!currentMenu) return;

    if (event.key === "ArrowRight") {
      const host = event.target.closest<HTMLElement>(".project-task-context-submenu-host");
      const submenu = host?.querySelector<HTMLElement>(":scope > .project-task-context-submenu");
      const first = submenu ? enabledMenuItems(submenu)[0] : undefined;
      if (first) {
        event.preventDefault();
        event.stopPropagation();
        first.focus({ preventScroll: true });
      }
      return;
    }

    if (event.key === "ArrowLeft" && currentMenu.classList.contains("project-task-context-submenu")) {
      const trigger = currentMenu.parentElement?.querySelector<HTMLButtonElement>(
        ':scope > button[role="menuitem"]:not(:disabled)',
      );
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        trigger.focus({ preventScroll: true });
      }
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
      items[nextIndex]?.focus({ preventScroll: true });
    }
  }

  const canMutate = editable && !mutationLocked && links.length === 0;
  const canDelete = canMutate;
  const activeClipboard = taskClipboard?.revision === projectRevision ? taskClipboard : null;
  const menuCapabilities = taskMenu
    ? taskContextCapabilities(tasks, taskMenu.taskId, editable, mutationLocked, links.length > 0, activeClipboard)
    : null;

  useEffect(() => {
    if (!taskMenu) return;
    queueMicrotask(() => taskMenuReference.current?.focus({ preventScroll: true }));
  }, [taskMenu]);

  return (
    <div className="project-gantt-frame" data-gantt-scale-mode={scaleMode} data-project-gantt-api-instance={apiInstanceId ?? undefined} data-project-gantt-instance={instanceId} data-task-mutation-locked={mutationLocked || undefined}>
      <Willow>
      <div className="project-gantt-scale-toolbar">
        <div aria-label="Gantt 표시 단위" className="project-gantt-scale-controls" role="group">
          <span aria-hidden="true" className="project-gantt-scale-label">표시 단위</span>
          <button aria-pressed={scaleMode === "day"} onClick={() => setScaleMode("day")} type="button">일</button>
          <button aria-pressed={scaleMode === "week"} onClick={() => setScaleMode("week")} type="button">주</button>
        </div>
      </div>
      <div
        aria-label="프로젝트 일정 Grid와 Gantt 차트"
          className="project-gantt-scroll"
          onContextMenu={handleHeaderContextMenu}
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
          onKeyDown={handleTaskMenuKeyDown}
          ref={taskMenuReference}
          role="menu"
          tabIndex={-1}
          style={{ left: taskMenu.left, top: taskMenu.top }}
        >
          <div className="project-task-context-submenu-host">
            <button aria-haspopup="menu" aria-label="Add" disabled={!canMutate} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">＋</span><span>Add</span><span className="project-task-context-menu-arrow">›</span>
            </button>
            <div className="project-task-context-submenu" role="menu" aria-label="Add">
              <button disabled={!menuCapabilities.canAddChild} onClick={() => createTaskFromMenu("child")} role="menuitem" type="button">Child task</button>
              <button disabled={!canMutate} onClick={() => createTaskFromMenu("before")} role="menuitem" type="button">Task above</button>
              <button disabled={!canMutate} onClick={() => createTaskFromMenu("after")} role="menuitem" type="button">Task below</button>
            </div>
          </div>
          <div className="project-task-context-submenu-host">
            <button aria-haspopup="menu" aria-label="Convert to" disabled={!canMutate} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">↻</span><span>Convert to</span><span className="project-task-context-menu-arrow">›</span>
            </button>
            <div className="project-task-context-submenu" role="menu" aria-label="Convert to">
              <button disabled={!menuCapabilities.canConvertToTask} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "task" })} role="menuitem" type="button">Task</button>
              <button disabled={!menuCapabilities.canConvertToSummary} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "summary" })} role="menuitem" type="button">Summary task</button>
              <button disabled={!menuCapabilities.canConvertToMilestone} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "milestone" })} role="menuitem" type="button">Milestone</button>
            </div>
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
          <div className="project-task-context-submenu-host">
            <button aria-haspopup="menu" aria-label="Paste" disabled={!menuCapabilities.canPaste} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">▣</span><span>Paste</span><span className="project-task-context-menu-arrow">›</span>
            </button>
            <div className="project-task-context-submenu" role="menu" aria-label="Paste">
              <button disabled={!menuCapabilities.canPaste || !menuCapabilities.canAddChild} onClick={() => pasteFromMenu("child")} role="menuitem" type="button">As child</button>
              <button disabled={!menuCapabilities.canPaste} onClick={() => pasteFromMenu("before")} role="menuitem" type="button">Above</button>
              <button disabled={!menuCapabilities.canPaste} onClick={() => pasteFromMenu("after")} role="menuitem" type="button">Below</button>
            </div>
          </div>
          <div className="project-task-context-menu-separator" role="separator" />
          <div className="project-task-context-submenu-host">
            <button aria-haspopup="menu" aria-label="Move" disabled={!canMutate} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">↕</span><span>Move</span><span className="project-task-context-menu-arrow">›</span>
            </button>
            <div className="project-task-context-submenu" role="menu" aria-label="Move">
              <button disabled={!menuCapabilities.canMoveUp} onClick={() => executeHierarchyCommand(createHierarchyCommand("move-up", taskMenu.taskId))} role="menuitem" type="button">Move up</button>
              <button disabled={!menuCapabilities.canMoveDown} onClick={() => executeHierarchyCommand(createHierarchyCommand("move-down", taskMenu.taskId))} role="menuitem" type="button">Move down</button>
            </div>
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
        </div> : null}
      </Willow>
    </div>
  );
}
