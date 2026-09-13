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
} from "@/contracts/projects";
import {
  browserLocales,
  formatLocaleDateOnly,
  todayLocalDateString,
} from "@/lib/date-display";

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
import { planCanonicalGanttSync } from "./canonical-snapshot-sync";

export type ProjectGridDataColumnId = "text" | "externalId" | "projectStart" | "projectDuration";

export type ProjectGridColumnVisibility = Record<ProjectGridDataColumnId, boolean>;
let nextApiInstanceId = 1;

interface ProjectGanttProps {
  readonly calendar: ProjectCalendarDto;
  readonly editable: boolean;
  readonly mutationLocked: boolean;
  readonly onCanonicalSyncFailure: () => void;
  readonly links: readonly ProjectLinkDto[];
  readonly onTaskAddRejected: () => void;
  readonly onTaskCreate: (command: ProjectTaskCreateCommand) => void;
  readonly onTaskCommand: (command: ProjectTaskUpdateCommand) => void;
  readonly columnVisibility: ProjectGridColumnVisibility;
  readonly onColumnVisibilityChange: (columnId: ProjectGridDataColumnId) => void;
  readonly tasks: readonly ProjectTaskDto[];
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
  columnVisibility,
  onColumnVisibilityChange,
  tasks,
}: ProjectGanttProps) {
  const apiReference = useRef<IApi | null>(null);
  const onTaskCreateReference = useRef(onTaskCreate);
  const onTaskAddRejectedReference = useRef(onTaskAddRejected);
  const onCanonicalSyncFailureReference = useRef(onCanonicalSyncFailure);
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
  const [columnMenuPosition, setColumnMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [apiInstanceId, setApiInstanceId] = useState<string | null>(null);
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
    canCreateReference.current = editable && !mutationLocked;
    mutationLockedReference.current = mutationLocked;
    tasksByIdReference.current = tasksById;
  }, [editable, mutationLocked, onCanonicalSyncFailure, onTaskAddRejected, onTaskCreate, tasksById]);

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
      const currentTasks = (api.serialize({ data: "tasks" }) ?? []) as ITask[];
      const currentLinks = (api.serialize({ data: "links" }) ?? []) as ILink[];
      const currentTaskById = new Map(currentTasks.map((task) => [task.id, task]));
      const plan = planCanonicalGanttSync({ tasks: currentTasks, links: currentLinks }, { tasks: svarTasks, links: svarLinks });
      canonicalSyncDepthReference.current += 1;
      try {
        for (const link of currentLinks) {
          if (syncVersion !== canonicalSyncVersionReference.current) return;
          if (plan.replaceLinks && link.id !== undefined) await api.exec("delete-link", { id: link.id });
        }
        for (const id of plan.deletedTaskIds) {
          if (syncVersion !== canonicalSyncVersionReference.current) return;
          await api.exec("delete-task", { id });
        }
        for (const task of plan.updatedTasks) {
          if (syncVersion !== canonicalSyncVersionReference.current) return;
          const { id, ...update } = task;
          delete update.open;
          if (id !== undefined) {
            const prior = currentTaskById.get(id);
            await api.exec("update-task", { id, task: update, eventSource: "project-canonical-sync", skipUndo: true });
            // A leaf converted by its first child did not have an existing
            // summary open/collapsed preference. Reveal that new hierarchy
            // without reopening summaries the user had deliberately closed.
            if (prior?.type !== "summary" && task.type === "summary") {
              await api.exec("open-task", { id, mode: true });
            }
          }
        }
        for (const task of plan.addedTasks) {
          if (syncVersion !== canonicalSyncVersionReference.current) return;
          const { id, ...add } = task;
          delete add.open;
          await api.exec("add-task", {
            id,
            // Installed Core reads the canonical ID from task.id when adding.
            // Keep the top-level ID as well for the public action contract.
            task: { ...add, id },
            select: false,
            eventSource: "project-canonical-sync",
            ...(task.parent && task.parent !== 0 ? { target: task.parent, mode: "child" as const } : {}),
          });
        }
        if (plan.replaceLinks) for (const link of svarLinks) {
          if (syncVersion !== canonicalSyncVersionReference.current) return;
          await api.exec("add-link", { link, eventSource: "project-canonical-sync" });
        }
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
    if (!columnMenuPosition) return;
    columnMenuReference.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
  }, [columnMenuPosition]);

  useLayoutEffect(() => {
    if (!columnMenuPosition) return;
    const menu = columnMenuReference.current;
    if (!menu) return;
    const inset = 8;
    const bounds = menu.getBoundingClientRect();
    const left = Math.max(inset, Math.min(bounds.left, window.innerWidth - bounds.width - inset));
    const top = Math.max(inset, Math.min(bounds.top, window.innerHeight - bounds.height - inset));
    if (Math.abs(left - bounds.left) < 1 && Math.abs(top - bounds.top) < 1) return;
    setColumnMenuPosition((current) => current ? { left, top } : current);
  }, [columnMenuPosition]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root) return;
    // Core renders its Grid header after this React tree. Its header wrapper
    // is not necessarily tabbable, so make only that existing header focusable
    // for the standard Shift+F10/ContextMenu entry path.
    const makeGridHeadersFocusable = () => {
      root.querySelectorAll<HTMLElement>(".wx-table-container .wx-header").forEach((header) => {
        if (!header.hasAttribute("tabindex")) header.tabIndex = 0;
      });
    };
    makeGridHeadersFocusable();
    const observer = new MutationObserver(makeGridHeadersFocusable);
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
    {
      unit: "day",
      step: 1,
      format: (date: Date) => new Intl.DateTimeFormat(locales, {
        day: "numeric",
        weekday: "narrow",
      }).format(date),
    },
  ], [locales]);

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
    const inset = 8;
    const menuWidth = 208;
    const menuHeight = 196;
    setColumnMenuPosition({
      left: Math.max(inset, Math.min(x, window.innerWidth - menuWidth - inset)),
      top: Math.max(inset, Math.min(y, window.innerHeight - menuHeight - inset)),
    });
  }

  function handleHeaderContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const header = headerFrom(event.target);
    if (!header) return;
    event.preventDefault();
    openColumnMenu(header, event.clientX, event.clientY);
  }

  function handleHeaderKeyboardMenu(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    const header = headerFrom(event.target);
    if (!header) return;
    event.preventDefault();
    const bounds = header.getBoundingClientRect();
    openColumnMenu(header, bounds.left + Math.min(bounds.width / 2, 24), bounds.top + Math.min(bounds.height / 2, 24));
  }

  function closeColumnMenu() {
    setColumnMenuPosition(null);
    queueMicrotask(() => columnMenuTriggerReference.current?.focus({ preventScroll: true }));
  }

  function handleColumnMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeColumnMenu();
    }
  }

  return (
    <div className="project-gantt-frame" data-project-gantt-api-instance={apiInstanceId ?? undefined} data-project-gantt-instance={instanceId} data-task-mutation-locked={mutationLocked || undefined}>
      <Willow>
        <div
          aria-label="프로젝트 일정 Grid와 Gantt 차트"
          className="project-gantt-scroll"
          onContextMenu={handleHeaderContextMenu}
          onKeyDown={handleHeaderKeyboardMenu}
          ref={ganttScrollReference}
          role="region"
          tabIndex={0}
        >
          <div className="wx-theme gantt-widget project-gantt-widget">
            <Gantt
              columns={initialConfig.columns}
              displayMode="all"
              gridWidth={620}
              highlightTime={highlightWeekend}
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
      </Willow>
    </div>
  );
}
