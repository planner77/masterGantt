"use client";

import {
  Gantt,
  Willow,
  defaultTaskTypes,
  type IApi,
  type IColumnConfig,
  type ILink,
  type ITask,
} from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { createTaskMoveGateway } from "./task-move-gateway";
import {
  buildGanttDayHeaderTooltipDataForDateOnly,
  dateOnlyFromGanttDayScaleClassName,
  ganttDayScaleClassName,
  type GanttDayHeaderTooltipData,
} from "./day-header-tooltip";
import {
  buildGanttWeekHeaderTooltipDataForDateOnly,
  dateOnlyFromGanttWeekScaleClassName,
  ganttWeekScaleClassName,
  type GanttWeekHeaderTooltipData,
} from "./week-header-tooltip";
import {
  canEditGridStartDate,
  createGridStartDateCommand,
} from "./grid-start-date-editor";

import { copyTextWithLegacyCommand, writeTextWithCompatibility } from "@/components/clipboard-write";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import feedbackStyles from "@/components/workspace-feedback.module.css";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
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
import { formatGanttDayOfMonth } from "@/lib/gantt-scale-format";
import { formatIsoWeek } from "@/lib/iso-week";
import {
  GANTT_CELL_WIDTH,
  minimumTimelineScaleWidthForEnd,
  nextTimelineScaleWidth,
  type GanttScaleMode,
} from "./timeline-range";

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
  normalizeInlineTaskName,
  type ProjectTaskCreateCommand,
  type ProjectTaskUpdateCommand,
} from "./project-task-adapter";
import { applyCanonicalGanttSync } from "./canonical-snapshot-sync";
import { findTaskContextElement, resolveTaskContextTarget, taskIdFromElement, TASK_TARGET_SELECTOR } from "./task-context-target";
import type { TaskEditorSaveResult } from "./task-editor-model";
import { captureMenuScrollChange } from "./menu-scroll-guard";
import {
  extractCollapsedSummaryIds,
  loadSummaryTogglePreference,
  saveSummaryTogglePreference,
} from "./summary-toggle-preference";
import {
  createHierarchyCommand,
  createPasteCommand,
  clipboardIncludesRoot,
  taskContextCapabilities,
  type TaskClipboard,
} from "./task-context-menu-model";
import { taskHasDependencyLinks, taskSubtreeHasDependencyLinks } from "./task-link-scope";
import { normalizeCopySelection, selectTaskGesture, hiddenSelectedCount } from "./task-selection-model";
import { canOpenTaskAsSubtreeRoot, taskHierarchyCommandStaysInSubtree } from "./task-subtree-scope";
import { taskStatusFromProgress } from "../../domain/task-status";
import { RelationContextMenu } from "./relation-context-menu";
import type { DependencyType } from "../../contracts/projects";
import "./task-context-menu.css";
import "./gantt-scale-toolbar.css";

interface CopySelectionContextValue {
  tasksById: ReadonlyMap<string, ProjectTaskDto>;
  selectedTaskIds: readonly string[];
  onGesture: (id: string, gesture: "single" | "toggle" | "range") => void;
}
const CopySelectionContext = createContext<CopySelectionContextValue | null>(null);

/** Stable public Grid renderer reads React context, never mutable refs. */
function ProjectTaskSelectionCell({ row }: { row: Record<string, unknown> }) {
    const context = useContext(CopySelectionContext);
    if (!context) return null;
    const id = String(row.id);
    return <label className="project-copy-selection-hitarea">
      <input type="checkbox" data-copy-selection={id}
        aria-label={`${context.tasksById.get(id)?.name ?? String(row.text ?? "작업")} 복사 대상으로 선택`}
        checked={context.selectedTaskIds.includes(id)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => context.onGesture(id, (event.nativeEvent as MouseEvent).shiftKey ? "range" : "toggle")}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey) && event.key !== "Escape" && event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) event.stopPropagation();
        }} />
    </label>;
}

export type ProjectGridDataColumnId =
  | "text"
  | "externalId"
  | "projectStart"
  | "projectDuration"
  | "baselineStart"
  | "baselineEnd";

export type ProjectGridColumnVisibility = Record<ProjectGridDataColumnId, boolean>;
let nextApiInstanceId = 1;
const projectTaskTypes = [...defaultTaskTypes, { id: "summary-container", label: "요약 작업 (일정 미산정)" }];

type MenuPosition = Readonly<{ left: number; top: number }>;
type TaskMenuState = MenuPosition & Readonly<{ taskId: string }>;
type TaskSubmenuName = "Add" | "Convert to" | "Paste" | "Move";
type TaskSubmenuState = Readonly<{ name: TaskSubmenuName; placement: "right" | "left" | "drilldown"; left: number; top: number }>;
type DayHeaderTooltipState = Readonly<{
  data: GanttDayHeaderTooltipData;
  left: number;
  top: number;
  anchorTop: number;
}>;
type WeekHeaderTooltipState = Readonly<{
  data: GanttWeekHeaderTooltipData;
  left: number;
  top: number;
  anchorTop: number;
}>;
type StartDatePickerState = Readonly<{
  taskId: string;
  revision: number;
  value: string;
  left: number;
  top: number;
  width: number;
}>;

function fullscreenShortcutBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], dialog, [role="dialog"]'));
}

type NativeTaskAddRejectReason = "scope" | "missing" | "milestone";

interface ProjectGanttProps {
  readonly calendar: ProjectCalendarDto;
  readonly editable: boolean;
  readonly mutationLocked: boolean;
  readonly onCanonicalSyncFailure: () => void;
  readonly links: readonly ProjectLinkDto[];
  readonly onTaskAddRejected: (reason: NativeTaskAddRejectReason) => void;
  readonly onTaskCreate: (command: ProjectTaskCreateCommand) => void;
  readonly onTaskCommand: (command: ProjectTaskUpdateCommand, expectedRevision?: number) => Promise<TaskEditorSaveResult>;
  readonly onTaskHierarchyCommand: (command: TaskHierarchyCommandRequest) => void;
  readonly onTaskEditorOpen: (taskId: string) => void;
  readonly onTaskOpenAsRoot: (taskId: string) => void;
  readonly onTaskDeleteRequest: (taskId: string, trigger: HTMLElement | null) => void;
  readonly onRelationEditorOpen?: (linkId: string) => void;
  readonly onLinkCreate: (sourceTaskId: string, targetTaskId: string) => void;
  readonly onLinkUpdate?: (linkId: string, patch: { type: DependencyType; lag: number }) => Promise<boolean>;
  readonly onLinkDelete: (linkId: string) => void;
  readonly columnVisibility: ProjectGridColumnVisibility;
  readonly onColumnVisibilityChange: (columnId: ProjectGridDataColumnId) => void;
  readonly tasks: readonly ProjectTaskDto[];
  readonly projectRevision: number;
  readonly visibleTaskIds?: readonly string[] | null;
  readonly matchingTaskIds?: readonly string[] | null;
  readonly selectionBoundaryKey?: string;
  readonly viewRootTaskId?: string | null;
  readonly projectPublicId?: string;
}

const baseProjectColumns: IColumnConfig[] = [
  { id: "text", header: "작업", width: 180, flexgrow: 1, sort: true },
  { id: "externalId", header: "외부 ID", width: 108, getter: (task) => task.externalId ?? "—" },
  // Do not use Core's `start`/`duration` IDs here: they install their own
  // calendar-day templates. These display-only IDs preserve the project's
  // localized local-date and canonical working-day duration contract.
  { id: "projectStart", header: "시작", width: 104, align: "center" },
  { id: "projectDuration", header: "기간", width: 56, align: "center" },
  { id: "baselineStart", header: "기준 시작", width: 104, align: "center", getter: (task) => String((task as Record<string, unknown>).baselineStart ?? "—") },
  { id: "baselineEnd", header: "기준 종료", width: 104, align: "center", getter: (task) => String((task as Record<string, unknown>).baselineEnd ?? "—") },
  // The Core recognizes this documented ID and renders its native header/row
  // plus controls. Their `add-task` event is intercepted below.
  { id: "add-task", header: "작업 추가", width: 37, align: "center" },
];

const dataColumns: ReadonlyArray<Readonly<{ id: ProjectGridDataColumnId; label: string }>> = [
  { id: "text", label: "작업" },
  { id: "externalId", label: "외부 ID" },
  { id: "projectStart", label: "시작" },
  { id: "projectDuration", label: "기간" },
  { id: "baselineStart", label: "기준 시작" },
  { id: "baselineEnd", label: "기준 종료" },
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
  onTaskOpenAsRoot,
  onTaskDeleteRequest,
  onRelationEditorOpen,
  onLinkCreate,
  onLinkUpdate,
  onLinkDelete,
  columnVisibility,
  onColumnVisibilityChange,
  tasks,
  projectRevision,
  visibleTaskIds = null,
  matchingTaskIds = null,
  selectionBoundaryKey = "",
  viewRootTaskId = null,
  projectPublicId,
}: ProjectGanttProps) {
  const { notify } = useWorkspaceNotifications();
  const apiReference = useRef<IApi | null>(null);
  const onTaskCreateReference = useRef(onTaskCreate);
  const onTaskCommandReference = useRef(onTaskCommand);
  const linksReference = useRef(links);
  const projectRevisionReference = useRef(projectRevision);
  const onTaskAddRejectedReference = useRef(onTaskAddRejected);
  const onCanonicalSyncFailureReference = useRef(onCanonicalSyncFailure);
  const onTaskEditorOpenReference = useRef(onTaskEditorOpen);
  const onRelationEditorOpenReference = useRef(onRelationEditorOpen);
  const onTaskHierarchyCommandReference = useRef(onTaskHierarchyCommand);
  const onTaskDeleteRequestReference = useRef(onTaskDeleteRequest);
  const onLinkCreateReference = useRef(onLinkCreate);
  const onLinkUpdateReference = useRef(onLinkUpdate);
  const onLinkDeleteReference = useRef(onLinkDelete);
  const canCreateReference = useRef(editable && !mutationLocked);
  const mutationLockedReference = useRef(mutationLocked);
  const canonicalSyncDepthReference = useRef(0);
  const canonicalSyncVersionReference = useRef(0);
  const taskFilterAppliedReference = useRef(false);
  const summaryToggleStateReference = useRef(new Map<string, boolean>());
  const projectPublicIdReference = useRef(projectPublicId);
  const viewRootTaskIdReference = useRef(viewRootTaskId);
  const tasksReference = useRef(tasks);
  const initialPreferenceRestoredReference = useRef(false);
  const prevProjectPublicIdReference = useRef(projectPublicId);

  useEffect(() => {
    if (prevProjectPublicIdReference.current === projectPublicId) return;
    prevProjectPublicIdReference.current = projectPublicId;
    initialPreferenceRestoredReference.current = false;
    summaryToggleStateReference.current.clear();
  }, [projectPublicId]);
  const inlineOpenTokenReference = useRef(0);
  const namePointerIntentReference = useRef<{ taskId: string; x: number; y: number } | null>(null);
  const startDatePointerIntentReference = useRef<{ taskId: string; x: number; y: number; cell: HTMLElement } | null>(null);
  const contextPointerTaskIdReference = useRef<string | null>(null);
  const inlineComposingReference = useRef(false);
  const inlineTableReference = useRef<Awaited<ReturnType<IApi["getTable"]>> | null>(null);
  const inlineSessionReference = useRef<{
    taskId: string;
    revision: number;
    cell: HTMLElement;
    table: Awaited<ReturnType<IApi["getTable"]>>;
    committed: boolean;
  } | null>(null);
  const startDateTriggerReference = useRef<HTMLElement | null>(null);
  const startDateOpenTimerReference = useRef<number | null>(null);
  const startDatePickerClosingReference = useRef(false);
  const startDatePickerReference = useRef<HTMLDivElement>(null);
  const startDateInputReference = useRef<HTMLInputElement>(null);
  const instanceId = useState(() => `project-gantt-${Math.random().toString(36).slice(2)}`)[0];
  const canonicalSyncQueueReference = useRef<Promise<void>>(Promise.resolve());
  const tasksByIdReference = useRef(new Map<string, ProjectTaskDto>());
  const ganttScrollReference = useRef<HTMLDivElement>(null);
  const fullscreenFrameReference = useRef<HTMLDivElement>(null);
  const fullscreenButtonReference = useRef<HTMLButtonElement>(null);
  const dayHeaderTooltipReference = useRef<HTMLDivElement>(null);
  const weekHeaderTooltipReference = useRef<HTMLDivElement>(null);
  const fullscreenPendingReference = useRef(false);
  const fullscreenWasActiveReference = useRef(false);
  const fullscreenUiStateReference = useRef<{
    columns: IColumnConfig[];
    summaries: Map<string, boolean>;
  } | null>(null);
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
  const [relationMenu, setRelationMenu] = useState<{ linkId: string; left: number; top: number } | null>(null);
  const [taskClipboard, setTaskClipboard] = useState<TaskClipboard | null>(null);
  const [copyTaskIdFallback, setCopyTaskIdFallback] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<readonly string[]>([]);
  const selectedTaskIdsReference = useRef<readonly string[]>([]);
  const selectionAnchorReference = useRef<string | null>(null);
  const visibleTaskIdsReference = useRef(visibleTaskIds);
  const matchingTaskIdsReference = useRef(matchingTaskIds);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [selectionHiddenCount, setSelectionHiddenCount] = useState(0);
  const selectionProjectReference = useRef(projectPublicId);
  // Content equality prevents ordinary React renders from clearing clipboard.
  const selectionBoundary = JSON.stringify([viewRootTaskId, selectionBoundaryKey,
    visibleTaskIds === null ? null : [...visibleTaskIds].sort(),
    matchingTaskIds === null ? null : [...matchingTaskIds].sort()]);
  const selectionBoundaryReference = useRef(selectionBoundary);
  const [apiInstanceId, setApiInstanceId] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<GanttScaleMode>("day");
  const scaleModeReference = useRef<GanttScaleMode>("day");
  const [dayHeaderTooltip, setDayHeaderTooltip] = useState<DayHeaderTooltipState | null>(null);
  const [weekHeaderTooltip, setWeekHeaderTooltip] = useState<WeekHeaderTooltipState | null>(null);
  const pendingScaleColumnsReference = useRef<IColumnConfig[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const [inlineNameMessage, setInlineNameMessage] = useState("");
  const [inlineNameError, setInlineNameError] = useState(false);
  const [startDatePicker, setStartDatePicker] = useState<StartDatePickerState | null>(null);
  const [inlineStartMessage, setInlineStartMessage] = useState("");
  const [inlineStartError, setInlineStartError] = useState(false);
  // This browser-only component is dynamically imported with SSR disabled.
  const [locales] = useState<Intl.LocalesArgument>(() => browserLocales());
  const dayHeaderTooltipId = `${instanceId}-day-header-tooltip`;
  const weekHeaderTooltipId = `${instanceId}-week-header-tooltip`;
  const highlightWeekend = useCallback(
    (date: Date, unit: "day" | "hour") => unit === "day" && isWeekend(date) ? "wx-weekend" : "",
    [],
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.taskId, task])),
    [tasks],
  );
  useLayoutEffect(() => {
    visibleTaskIdsReference.current = visibleTaskIds;
    matchingTaskIdsReference.current = matchingTaskIds;
  }, [visibleTaskIds, matchingTaskIds]);

  const updateSelection = useCallback((next: readonly string[]) => {
    const current = selectedTaskIdsReference.current;
    if (current.length === next.length && current.every((id, index) => id === next[index])) return;
    selectedTaskIdsReference.current = next;
    setSelectedTaskIds(next);
    const api = apiReference.current;
    const state: unknown = api?.getState().selected;
    const primary = Array.isArray(state) ? state : typeof state === "string" || typeof state === "number" ? [state] : [];
    if (api && !next.length) {
      for (const id of primary) if (typeof id === "string" || typeof id === "number") void api.exec("select-task", { id, toggle: true, eventSource: "project-owned-selection" });
    }
  }, []);

  const applySelectionGesture = useCallback((id: string, gesture: "single" | "toggle" | "range", mirrorCore = true) => {
    const next = selectTaskGesture(tasksReference.current, selectedTaskIdsReference.current,
      selectionAnchorReference.current, id, gesture, visibleTaskIdsReference.current, matchingTaskIdsReference.current);
    if (gesture === "range" && next.length === 1 && selectionAnchorReference.current !== id) {
      setSelectionMessage("같은 부모의 보이는 작업 범위가 없어 한 작업만 선택했습니다.");
    } else setSelectionMessage("");
    if (gesture !== "range") selectionAnchorReference.current = id;
    updateSelection(next);
    // Mirror a singular primary Task into Core: Cut/Move remain single target.
    if (mirrorCore && next.includes(id)) void apiReference.current?.exec("select-task", { id, eventSource: "project-owned-selection" });
  }, [updateSelection, setSelectionMessage]);

  const selectionContext = useMemo(() => ({
    tasksById, selectedTaskIds, onGesture: applySelectionGesture,
  }), [tasksById, selectedTaskIds, applySelectionGesture]);

  useEffect(() => {
    if (selectionProjectReference.current !== projectPublicId) {
      selectionProjectReference.current = projectPublicId;
      selectionBoundaryReference.current = selectionBoundary;
      selectionAnchorReference.current = null;
      updateSelection([]);
      setTaskClipboard(null);
      setSelectionMessage("");
      return;
    }
    const changed = selectionBoundaryReference.current !== selectionBoundary;
    selectionBoundaryReference.current = selectionBoundary;
    const known = new Set(tasks.map((task) => task.taskId));
    const matching = matchingTaskIds ?? visibleTaskIds;
    const allowed = changed && matching ? new Set(matching) : null;
    const current = selectedTaskIdsReference.current;
    const next = current.filter((id) => known.has(id) && (!allowed || allowed.has(id)));
    updateSelection(next);
    if (changed) {
      setTaskClipboard(null);
      setSelectionMessage(current.length > next.length
        ? `표시 범위 밖의 선택 ${current.length - next.length}개를 해제했습니다.`
        : "표시 범위가 변경되어 이전 클립보드를 비웠습니다.");
    }
  }, [projectPublicId, selectionBoundary, tasks, updateSelection, visibleTaskIds, matchingTaskIds]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    const api = apiReference.current;
    if (!root || !api || !apiInstanceId) return;
    const decorate = () => {
      const selected = new Set(selectedTaskIdsReference.current);
      root.querySelectorAll<HTMLElement>(TASK_TARGET_SELECTOR).forEach((element) => {
        const id = taskIdFromElement(element);
        const active = Boolean(id && selected.has(id));
        if (element.dataset.copySelected !== String(active)) element.dataset.copySelected = String(active);
        if (element.classList.contains("wx-row")) element.setAttribute("aria-selected", String(active));
        const checkbox = element.querySelector<HTMLInputElement>("input[data-copy-selection]");
        if (checkbox) checkbox.checked = active;
      });
      const count = hiddenSelectedCount(tasksReference.current, selectedTaskIdsReference.current, summaryToggleStateReference.current);
      setSelectionHiddenCount((current) => current === count ? current : count);
    };
    decorate();
    // Attribute decoration cannot retrigger this childList-only observer.
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    const tag = "project-copy-selection-decoration";
    api.on("open-task", decorate, { tag });
    return () => { observer.disconnect(); api.detach(tag); };
  }, [selectedTaskIds, tasks, apiInstanceId]);
  // Keep DOM editability and the refs used by native/SVAR handlers in the same
  // commit phase so the first click after a mutation cannot observe stale guards.
  useLayoutEffect(() => {
    canCreateReference.current = editable && !mutationLocked;
    mutationLockedReference.current = mutationLocked;
    tasksByIdReference.current = tasksById;
    projectPublicIdReference.current = projectPublicId;
    tasksReference.current = tasks;
  }, [editable, mutationLocked, projectPublicId, tasks, tasksById]);

  useEffect(() => {
    onTaskCreateReference.current = onTaskCreate;
    onTaskCommandReference.current = onTaskCommand;
    linksReference.current = links;
    onTaskAddRejectedReference.current = onTaskAddRejected;
    onCanonicalSyncFailureReference.current = onCanonicalSyncFailure;
    onTaskEditorOpenReference.current = onTaskEditorOpen;
    onRelationEditorOpenReference.current = onRelationEditorOpen;
    onTaskHierarchyCommandReference.current = onTaskHierarchyCommand;
    onTaskDeleteRequestReference.current = onTaskDeleteRequest;
    onLinkCreateReference.current = onLinkCreate;
    onLinkUpdateReference.current = onLinkUpdate;
    onLinkDeleteReference.current = onLinkDelete;
    canCreateReference.current = editable && !mutationLocked;
    mutationLockedReference.current = mutationLocked;
    tasksByIdReference.current = tasksById;
    projectPublicIdReference.current = projectPublicId;
    viewRootTaskIdReference.current = viewRootTaskId;
    tasksReference.current = tasks;
    const summaries = new Set(
      Array.from(tasksById.values()).filter((task) => task.type === "summary").map((task) => task.taskId),
    );
    for (const taskId of summaries) {
      if (!summaryToggleStateReference.current.has(taskId)) summaryToggleStateReference.current.set(taskId, false);
    }
    let hasStale = false;
    for (const taskId of summaryToggleStateReference.current.keys()) {
      if (!summaries.has(taskId)) {
        summaryToggleStateReference.current.delete(taskId);
        hasStale = true;
      }
    }
    if (hasStale && projectPublicId && initialPreferenceRestoredReference.current) {
      const collapsedIds = extractCollapsedSummaryIds(summaryToggleStateReference.current, summaries);
      saveSummaryTogglePreference(projectPublicId, collapsedIds);
    }
  }, [editable, links, mutationLocked, onCanonicalSyncFailure, onTaskAddRejected, onTaskCreate, onTaskCommand, onTaskDeleteRequest, onTaskEditorOpen, onRelationEditorOpen, onTaskHierarchyCommand, onLinkCreate, onLinkUpdate, onLinkDelete, projectPublicId, tasks, tasksById, viewRootTaskId]);

  useEffect(() => () => {
    inlineOpenTokenReference.current += 1;
    inlineTableReference.current?.detach("project-inline-name");
    inlineTableReference.current = null;
    inlineSessionReference.current = null;
    if (startDateOpenTimerReference.current !== null) window.clearTimeout(startDateOpenTimerReference.current);
  }, []);

  useEffect(() => {
    if (editable && !mutationLocked) return;
    if (startDateOpenTimerReference.current !== null) {
      window.clearTimeout(startDateOpenTimerReference.current);
      startDateOpenTimerReference.current = null;
    }
    queueMicrotask(() => setStartDatePicker(null));
    const session = inlineSessionReference.current;
    if (!session || session.committed) return;
    inlineOpenTokenReference.current += 1;
    inlineSessionReference.current = null;
    void session.table.exec("close-editor", { ignore: true });
  }, [editable, mutationLocked]);

  useLayoutEffect(() => {
    if (projectRevisionReference.current === projectRevision) return;
    projectRevisionReference.current = projectRevision;
    inlineOpenTokenReference.current += 1;
    const session = inlineSessionReference.current;
    inlineSessionReference.current = null;
    if (startDateOpenTimerReference.current !== null) {
      window.clearTimeout(startDateOpenTimerReference.current);
      startDateOpenTimerReference.current = null;
    }
    if (session && !session.committed) void session.table.exec("close-editor", { ignore: true });
    queueMicrotask(() => {
      setStartDatePicker(null);
      setInlineNameError(false);
      setInlineNameMessage("");
      setInlineStartError(false);
      setInlineStartMessage("");
    });
  }, [projectRevision]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root) return;
    const markRows = () => {
      root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]").forEach((row) => {
        const taskId = taskIdFromElement(row);
        const eligible = Boolean(taskId && editable && !mutationLocked && tasksById.has(taskId));
        if (row.dataset.inlineNameEligible !== String(eligible)) row.dataset.inlineNameEligible = String(eligible);
        const nameCell = row.querySelector<HTMLElement>('[role="gridcell"][data-col-id=":text"]');
        const startCell = row.querySelector<HTMLElement>('[role="gridcell"][data-col-id=":projectStart"]');
        const task = taskId ? tasksById.get(taskId) : undefined;
        const completed = task ? (task.status ?? taskStatusFromProgress(task.progress)) === "completed" : false;
        if (row.dataset.taskCompleted !== String(completed)) row.dataset.taskCompleted = String(completed);
        const startEditable = Boolean(task && canEditGridStartDate(task, editable && !mutationLocked));
        const summaryState = task?.type === "summary" && task.start === null
          ? tasks.some((candidate) => candidate.parentExternalId === task.externalId) ? "일정 있는 하위 작업 없음" : "하위 작업 없음"
          : null;
        if (nameCell && summaryState) {
          nameCell.dataset.summaryState = summaryState;
          nameCell.setAttribute("aria-description", `요약 작업: ${summaryState}`);
          nameCell.title = `${task!.name} · ${summaryState}`;
        } else if (nameCell) {
          delete nameCell.dataset.summaryState;
          nameCell.removeAttribute("aria-description");
          nameCell.removeAttribute("title");
        }
        if (nameCell && !eligible && nameCell.getAttribute("aria-readonly") !== "true") nameCell.setAttribute("aria-readonly", "true");
        if (nameCell && eligible && nameCell.hasAttribute("aria-readonly")) nameCell.removeAttribute("aria-readonly");
        if (startCell) {
          if (startEditable) {
            if (startCell.dataset.inlineStartEditable !== "true") startCell.dataset.inlineStartEditable = "true";
            if (startCell.hasAttribute("aria-readonly")) startCell.removeAttribute("aria-readonly");
          } else {
            if (startCell.hasAttribute("data-inline-start-editable")) delete startCell.dataset.inlineStartEditable;
            if (startCell.getAttribute("aria-readonly") !== "true") startCell.setAttribute("aria-readonly", "true");
          }
        }
      });
    };
    markRows();
    const observer = new MutationObserver(markRows);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-readonly"] });
    return () => observer.disconnect();
  }, [editable, links, mutationLocked, tasks, tasksById]);

  useEffect(() => {
    const frame = fullscreenFrameReference.current;
    if (!frame) return;
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === frame;
      setIsFullscreen(active);
      if (active) {
        setFullscreenMessage("");
        fullscreenButtonReference.current?.focus({ preventScroll: true });
      } else if (fullscreenWasActiveReference.current && frame.isConnected && document.fullscreenElement === null) fullscreenButtonReference.current?.focus({ preventScroll: true });
      fullscreenWasActiveReference.current = active;
    };
    const onFullscreenError = () => setFullscreenMessage("전체화면으로 전환할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("fullscreenerror", onFullscreenError);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("fullscreenerror", onFullscreenError);
      if (document.fullscreenElement === frame) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  function captureSummaryToggleState(): Map<string, boolean> {
    const state = new Map(summaryToggleStateReference.current);
    const root = ganttScrollReference.current;
    if (!root) return state;
    root.querySelectorAll<HTMLElement>('[data-action="open-task"]').forEach((toggle) => {
      const row = toggle.closest<HTMLElement>(".wx-row");
      const taskId = row ? taskIdFromElement(row) : null;
      if (!taskId || tasksByIdReference.current.get(taskId)?.type !== "summary") return;
      const collapsed = toggle.classList.contains("wxi-menu-right");
      state.set(taskId, collapsed);
      summaryToggleStateReference.current.set(taskId, collapsed);
    });
    return state;
  }

  async function restoreSummaryToggleState(api: IApi, summaryState: ReadonlyMap<string, boolean>) {
    for (const [taskId, collapsed] of summaryState) {
      const task = tasksByIdReference.current.get(taskId);
      if (!task || !tasksReference.current.some((candidate) => candidate.parentExternalId === task.externalId)) continue;
      await api.exec("open-task", { id: taskId, mode: !collapsed });
    }
  }

  async function restoreFullscreenUiState(
    savedColumns: IColumnConfig[],
    summaryState: ReadonlyMap<string, boolean>,
  ) {
    const api = apiReference.current;
    if (!api) return;

    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextFrame();
    await nextFrame();
    await api.exec("set-columns", { columns: savedColumns });
    await restoreSummaryToggleState(api, summaryState);
  }

  useEffect(() => {
    const saved = fullscreenUiStateReference.current;
    if (!saved || !apiInstanceId) return;
    let cancelled = false;
    void (async () => {
      await restoreFullscreenUiState(saved.columns, saved.summaries);
      if (cancelled) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (!cancelled) await restoreFullscreenUiState(saved.columns, saved.summaries);
    })().catch(() => {
      if (!cancelled) onCanonicalSyncFailureReference.current();
    });
    return () => { cancelled = true; };
  }, [apiInstanceId, isFullscreen]);

  async function toggleFullscreen() {
    const frame = fullscreenFrameReference.current;
    if (!frame || fullscreenPendingReference.current) return;
    fullscreenPendingReference.current = true;
    setFullscreenPending(true);
    setFullscreenMessage("");
    try {
      await canonicalSyncQueueReference.current;
      const api = apiReference.current;
      const savedColumns = (api?.getState().columns ?? []).map((column) => ({ ...column }));
      const summaryState = captureSummaryToggleState();
      fullscreenUiStateReference.current = { columns: savedColumns, summaries: summaryState };
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement && typeof frame.requestFullscreen === "function") {
        await frame.requestFullscreen();
      } else {
        throw new Error("Fullscreen unavailable");
      }
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
    const root = ganttScrollReference.current;
    if (!root || !apiInstanceId) return;
    const onSummaryToggleClick = (event: MouseEvent) => {
      const toggle = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-action="open-task"]')
        : null;
      if (!toggle || !root.contains(toggle)) return;
      const row = toggle.closest<HTMLElement>(".wx-row");
      const taskId = row ? taskIdFromElement(row) : null;
      if (!taskId || tasksByIdReference.current.get(taskId)?.type !== "summary") return;
      const currentlyCollapsed = toggle.classList.contains("wxi-menu-right");
      const nextCollapsed = !currentlyCollapsed;
      summaryToggleStateReference.current.set(taskId, nextCollapsed);
      if (projectPublicIdReference.current) {
        const summaries = new Set(
          tasksReference.current.filter((task) => task.type === "summary").map((task) => task.taskId),
        );
        const collapsedIds = extractCollapsedSummaryIds(summaryToggleStateReference.current, summaries);
        saveSummaryTogglePreference(projectPublicIdReference.current, collapsedIds);
      }
    };
    root.addEventListener("click", onSummaryToggleClick, true);
    return () => root.removeEventListener("click", onSummaryToggleClick, true);
  }, [apiInstanceId]);

  useEffect(() => {
    const api = apiReference.current;
    if (!api || !apiInstanceId) return;
    const tag = "project-summary-toggle-tracker";
    api.detach(tag);
    api.intercept("open-task", (event) => {
      if (typeof event.id === "string") {
        const taskId = event.id;
        const collapsed = !event.mode;
        summaryToggleStateReference.current.set(taskId, collapsed);
        if (projectPublicIdReference.current) {
          const summaries = new Set(
            tasksReference.current.filter((task) => task.type === "summary").map((task) => task.taskId),
          );
          const collapsedIds = extractCollapsedSummaryIds(summaryToggleStateReference.current, summaries);
          saveSummaryTogglePreference(projectPublicIdReference.current, collapsedIds);
        }
      }
      return true;
    }, { tag });
    return () => api.detach(tag);
  }, [apiInstanceId]);

  useEffect(() => {
    const api = apiReference.current;
    if (!api || !apiInstanceId || !projectPublicId) return;
    if (initialPreferenceRestoredReference.current) return;

    const currentSummaryIds = new Set(
      tasks.filter((task) => task.type === "summary").map((task) => task.taskId),
    );
    if (currentSummaryIds.size === 0) return;

    initialPreferenceRestoredReference.current = true;
    const collapsedIds = loadSummaryTogglePreference(projectPublicId, currentSummaryIds);
    if (collapsedIds.length > 0) {
      void (async () => {
        for (const id of collapsedIds) {
          summaryToggleStateReference.current.set(id, true);
          await api.exec("open-task", { id, mode: false });
        }
      })();
    }
  }, [apiInstanceId, projectPublicId, tasks]);

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
        action.setAttribute("aria-disabled", String(mutationLocked || viewRootTaskId !== null));
      });
    };
    setNativeAddAccessibility();
    const observer = new MutationObserver(setNativeAddAccessibility);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mutationLocked, viewRootTaskId]);
  const svarTasks = useMemo(() => projectTasksToSvarTasks(tasks, viewRootTaskId), [tasks, viewRootTaskId]);
  const svarLinks = useMemo(() => projectLinksToSvarLinks(links, tasks), [links, tasks]);
  const taskUpdateGateway = useMemo(
    () => createTaskUpdateGateway((local) => {
      const task = typeof local.taskId === "string" ? tasksById.get(local.taskId) : undefined;
      if (!task) return;
      const command = translateProjectTaskUpdate(local, task, calendar);
      if (command) void onTaskCommand(command);
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
    () => [{ id: "copySelection", header: "선택", width: 56, align: "center" as const, cell: ProjectTaskSelectionCell }, ...baseProjectColumns.map((column) => (
      column.id === "externalId"
        ? { ...column, hidden: !columnVisibility.externalId }
        : column.id === "projectStart"
          ? {
            ...column,
            hidden: !columnVisibility.projectStart,
            sort: (first: ITask, second: ITask) => {
              const firstStart = tasksByIdReference.current.get(String(first.id))?.start;
              const secondStart = tasksByIdReference.current.get(String(second.id))?.start;
              if (!firstStart || !secondStart) return !firstStart && !secondStart ? 0 : !firstStart ? 1 : -1;
              return firstStart === secondStart ? 0 : firstStart < secondStart ? -1 : 1;
            },
            getter: (task: ITask) => {
              const start = typeof task.id === "string" ? tasksByIdReference.current.get(task.id)?.start : null;
              return start ? formatLocaleDateOnly(start, locales) : "—";
            },
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
                  ? String(tasksByIdReference.current.get(task.id)!.duration)
                  : "—"
              ),
            }
          : column.id === "baselineStart"
            ? { ...column, hidden: !columnVisibility.baselineStart }
          : column.id === "baselineEnd"
            ? { ...column, hidden: !columnVisibility.baselineEnd }
          : column.id === "text"
            ? {
              ...column,
              hidden: !columnVisibility.text,
              editor: (row?: Record<string, unknown>) => {
                const taskId = typeof row?.id === "string" ? row.id : null;
                return canCreateReference.current && taskId && tasksByIdReference.current.has(taskId) ? "text" : null;
              },
            }
            : column
    ))],
    // Grid getters read the latest canonical DTO map through a ref, avoiding
    // stale values after failed mutations. Keep tasksById as a dependency so a
    // canonical Task change also re-runs the public set-columns synchronization;
    // Core needs that refresh when a dated Summary becomes an empty container.
    [columnVisibility, locales, tasksById],
  );
  const initialConfig = useState(() => ({
    tasks: projectTasksToSvarTasks(tasks, viewRootTaskId),
    links: projectLinksToSvarLinks(links, tasks),
    columns: columns.map((column) => ({ ...column })),
  }))[0];
  const ganttColumnsReference = useRef<IColumnConfig[]>(initialConfig.columns);
  const initialRange = useState(() => {
    const fallback = emptyWorkspaceRange();
    const starts = initialConfig.tasks.flatMap((task) => task.start instanceof Date ? [task.start] : []).concat(fallback.start);
    const ends = initialConfig.tasks.flatMap((task) => task.end instanceof Date ? [task.end] : []).concat(fallback.end);
    // New work always starts today. Keep that small range in the initial
    // scale so a canonical root add remains visible without reinitializing.
    return { start: new Date(Math.min(...starts.map((date) => date.getTime()))), end: new Date(Math.max(...ends.map((date) => date.getTime()))) };
  })[0];

  const [timelineEndMs, setTimelineEndMs] = useState(initialRange.end.getTime());
  const timelineEndReference = useRef(initialRange.end);
  const timelineExtensionFrameReference = useRef<number | null>(null);
  const timelineSyntheticResizeReference = useRef(false);

  type TimelineState = Readonly<{
    _start?: Date;
    _end?: Date;
    _scales?: { width?: number };
    _chartWidth?: number;
    _chartHeight?: number;
    _scrollSize?: number;
    scrollLeft?: number;
  }>;

  const recordTimelineEnd = useCallback((api: IApi): void => {
    const end = (api.getState() as TimelineState)._end;
    if (!(end instanceof Date) || !Number.isFinite(end.getTime())) return;
    if (end.getTime() > timelineEndReference.current.getTime()) {
      timelineEndReference.current = new Date(end);
    }
    setTimelineEndMs((current) => Math.max(current, timelineEndReference.current.getTime()));
  }, []);

  const expandTimelineScale = useCallback((api: IApi, minimumScaleWidth: number): boolean => {
    const state = api.getState() as TimelineState;
    const scaleWidth = state._scales?.width;
    const chartWidth = state._chartWidth;
    const chartHeight = state._chartHeight;
    const scrollSize = state._scrollSize ?? 0;
    if (
      !Number.isFinite(minimumScaleWidth) ||
      !Number.isFinite(scaleWidth) ||
      !Number.isFinite(chartWidth) ||
      !Number.isFinite(chartHeight) ||
      !scaleWidth || !chartWidth || !chartHeight ||
      minimumScaleWidth <= scaleWidth
    ) {
      recordTimelineEnd(api);
      return false;
    }

    timelineSyntheticResizeReference.current = true;
    try {
      // With a fixed start and open end, SVAR's public resize-chart action
      // expands _end while preserving _scaleDate/scrollLeft. Restore the real
      // viewport width immediately after using the larger width as a min scale
      // request so chart geometry itself is not inflated.
      api.exec("resize-chart", { width: minimumScaleWidth, height: chartHeight, scrollSize });
      api.exec("resize-chart", { width: chartWidth, height: chartHeight, scrollSize });
    } finally {
      timelineSyntheticResizeReference.current = false;
    }
    recordTimelineEnd(api);
    return true;
  }, [recordTimelineEnd]);

  const ensureTimelineEnd = useCallback((api: IApi): void => {
    const state = api.getState() as TimelineState;
    const currentStart = state._start;
    const currentEnd = state._end;
    if (!(currentStart instanceof Date) || !(currentEnd instanceof Date)) return;

    if (currentEnd.getTime() >= timelineEndReference.current.getTime()) {
      recordTimelineEnd(api);
      return;
    }

    expandTimelineScale(api, minimumTimelineScaleWidthForEnd({
      start: currentStart,
      end: timelineEndReference.current,
      scaleMode: scaleModeReference.current,
    }));
  }, [expandTimelineScale, recordTimelineEnd]);

  const scheduleTimelineExtension = useCallback((api: IApi): void => {
    if (timelineExtensionFrameReference.current !== null) return;
    timelineExtensionFrameReference.current = requestAnimationFrame(() => {
      timelineExtensionFrameReference.current = null;
      if (apiReference.current !== api) return;
      ensureTimelineEnd(api);
      const state = api.getState() as TimelineState;
      const nextScaleWidth = nextTimelineScaleWidth({
        scaleWidth: state._scales?.width,
        scrollLeft: state.scrollLeft,
        viewportWidth: state._chartWidth,
        scaleMode: scaleModeReference.current,
      });
      if (nextScaleWidth) expandTimelineScale(api, nextScaleWidth);
      else recordTimelineEnd(api);
    });
  }, [ensureTimelineEnd, expandTimelineScale, recordTimelineEnd]);

  useEffect(() => {
    const api = apiReference.current;
    if (!api || !apiInstanceId) return;
    const tag = "project-timeline-range-extension";
    api.detach(tag);

    api.on("scroll-chart", (event) => {
      if (timelineSyntheticResizeReference.current || typeof event.left !== "number") return;
      scheduleTimelineExtension(api);
    }, { tag });

    api.on("resize-chart", () => {
      if (timelineSyntheticResizeReference.current) return;
      scheduleTimelineExtension(api);
    }, { tag });

    ensureTimelineEnd(api);
    scheduleTimelineExtension(api);

    return () => {
      api.detach(tag);
      if (timelineExtensionFrameReference.current !== null) {
        cancelAnimationFrame(timelineExtensionFrameReference.current);
        timelineExtensionFrameReference.current = null;
      }
    };
  }, [apiInstanceId, ensureTimelineEnd, scheduleTimelineExtension]);

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
        ensureTimelineEnd(api);
      } catch {
        if (syncVersion === canonicalSyncVersionReference.current) onCanonicalSyncFailureReference.current();
      } finally { canonicalSyncDepthReference.current -= 1; }
    }).catch(() => onCanonicalSyncFailureReference.current());
  }, [ensureTimelineEnd, svarLinks, svarTasks]);

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
        const summaryState = captureSummaryToggleState();
        const currentColumns = api.getState().columns ?? [];
        const nextColumns = columns.map((column) => {
          const current = currentColumns.find((candidate) => candidate.id === column.id);
          return current ? { ...column, width: current.width, flexgrow: current.flexgrow } : { ...column };
        });
        ganttColumnsReference.current.splice(
          0,
          ganttColumnsReference.current.length,
          ...nextColumns.map((column) => ({ ...column })),
        );
        await api.exec("set-columns", { columns: nextColumns });
        await restoreSummaryToggleState(api, summaryState);
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

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root || scaleMode !== "day") {
      setDayHeaderTooltip(null);
      return;
    }

    const selector = ".project-gantt-day-scale";
    let activeCell: HTMLElement | null = null;
    let hoveredCell: HTMLElement | null = null;
    let focusedCell: HTMLElement | null = null;
    let repositionFrame: number | null = null;

    const tooltipData = (cell: HTMLElement): GanttDayHeaderTooltipData | null => {
      const date = dateOnlyFromGanttDayScaleClassName(cell.className);
      return date ? buildGanttDayHeaderTooltipDataForDateOnly(date, calendar, locales) : null;
    };

    const markCells = () => {
      root.querySelectorAll<HTMLElement>(selector).forEach((cell) => {
        if (!cell.hasAttribute("tabindex")) cell.tabIndex = 0;
        const data = tooltipData(cell);
        if (data) cell.setAttribute("aria-label", data.ariaLabel);
      });
    };

    const findCell = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const cell = target.closest<HTMLElement>(selector);
      return cell && root.contains(cell) ? cell : null;
    };

    const show = (cell: HTMLElement) => {
      const data = tooltipData(cell);
      if (!data) return;
      if (activeCell && activeCell !== cell && activeCell.getAttribute("aria-describedby") === dayHeaderTooltipId) {
        activeCell.removeAttribute("aria-describedby");
      }
      activeCell = cell;
      cell.setAttribute("aria-describedby", dayHeaderTooltipId);
      const bounds = cell.getBoundingClientRect();
      setDayHeaderTooltip({
        data,
        left: bounds.left + bounds.width / 2,
        top: bounds.bottom + 6,
        anchorTop: bounds.top,
      });
    };

    const hide = () => {
      if (activeCell?.getAttribute("aria-describedby") === dayHeaderTooltipId) activeCell.removeAttribute("aria-describedby");
      activeCell = null;
      setDayHeaderTooltip(null);
    };

    const showTrackedCell = () => {
      const hover = hoveredCell?.isConnected ? hoveredCell : null;
      const focus = focusedCell?.isConnected ? focusedCell : null;
      if (hover) show(hover);
      else if (focus) show(focus);
      else hide();
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const cell = findCell(event.target);
      if (!cell) return;
      hoveredCell = cell;
      show(cell);
    };
    const onPointerOut = (event: PointerEvent) => {
      const cell = findCell(event.target);
      if (!cell) return;
      const related = findCell(event.relatedTarget);
      if (related === cell) return;
      if (hoveredCell === cell) hoveredCell = related;
      showTrackedCell();
    };
    const onFocusIn = (event: FocusEvent) => {
      const cell = findCell(event.target);
      if (!cell) return;
      focusedCell = cell;
      // Explicit keyboard/programmatic focus must immediately expose the focused
      // date even when the pointer is still resting on another day cell.
      show(cell);
    };
    const onFocusOut = (event: FocusEvent) => {
      const cell = findCell(event.target);
      if (!cell) return;
      const related = findCell(event.relatedTarget);
      if (related === cell) return;
      if (focusedCell === cell) focusedCell = related;
      showTrackedCell();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeCell) return;
      hoveredCell = null;
      focusedCell = null;
      hide();
    };
    const onViewportChange = () => {
      if (repositionFrame !== null) return;
      repositionFrame = window.requestAnimationFrame(() => {
        repositionFrame = null;
        if (activeCell?.isConnected) show(activeCell);
        else showTrackedCell();
      });
    };

    markCells();
    const observer = new MutationObserver(markCells);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      observer.disconnect();
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      if (repositionFrame !== null) window.cancelAnimationFrame(repositionFrame);
      if (activeCell?.getAttribute("aria-describedby") === dayHeaderTooltipId) activeCell.removeAttribute("aria-describedby");
      setDayHeaderTooltip(null);
    };
  }, [calendar, dayHeaderTooltipId, locales, scaleMode]);

  useLayoutEffect(() => {
    const tooltip = dayHeaderTooltipReference.current;
    if (!tooltip || !dayHeaderTooltip) return;
    const bounds = tooltip.getBoundingClientRect();
    let left = dayHeaderTooltip.left;
    let top = dayHeaderTooltip.top;
    const gutter = 8;
    if (bounds.left < gutter) left += gutter - bounds.left;
    else if (bounds.right > window.innerWidth - gutter) left -= bounds.right - (window.innerWidth - gutter);
    if (bounds.bottom > window.innerHeight - gutter) top = dayHeaderTooltip.anchorTop - bounds.height - 6;
    if (top < gutter) top = gutter;
    if (Math.abs(left - dayHeaderTooltip.left) >= 1 || Math.abs(top - dayHeaderTooltip.top) >= 1) {
      setDayHeaderTooltip((current) => current ? { ...current, left, top } : current);
    }
  }, [dayHeaderTooltip]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root || scaleMode !== "week") {
      setWeekHeaderTooltip(null);
      return;
    }

    const selector = ".project-gantt-week-scale";
    let activeCell: HTMLElement | null = null;
    let hoveredCell: HTMLElement | null = null;
    let focusedCell: HTMLElement | null = null;
    let repositionFrame: number | null = null;

    const tooltipData = (cell: HTMLElement): GanttWeekHeaderTooltipData | null => {
      const date = dateOnlyFromGanttWeekScaleClassName(cell.className);
      return date ? buildGanttWeekHeaderTooltipDataForDateOnly(date, calendar) : null;
    };

    const markCells = () => {
      root.querySelectorAll<HTMLElement>(selector).forEach((cell) => {
        if (!cell.hasAttribute("tabindex")) cell.tabIndex = 0;
        const data = tooltipData(cell);
        if (data) cell.setAttribute("aria-label", data.ariaLabel);
      });
    };

    const findCell = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const cell = target.closest<HTMLElement>(selector);
      return cell && root.contains(cell) ? cell : null;
    };

    const show = (cell: HTMLElement) => {
      const data = tooltipData(cell);
      if (!data) return;
      if (activeCell && activeCell !== cell && activeCell.getAttribute("aria-describedby") === weekHeaderTooltipId) {
        activeCell.removeAttribute("aria-describedby");
      }
      activeCell = cell;
      cell.setAttribute("aria-describedby", weekHeaderTooltipId);
      const bounds = cell.getBoundingClientRect();
      setWeekHeaderTooltip({
        data,
        left: bounds.left + bounds.width / 2,
        top: bounds.bottom + 6,
        anchorTop: bounds.top,
      });
    };

    const hide = () => {
      if (activeCell?.getAttribute("aria-describedby") === weekHeaderTooltipId) activeCell.removeAttribute("aria-describedby");
      activeCell = null;
      setWeekHeaderTooltip(null);
    };

    const showTrackedCell = () => {
      const hover = hoveredCell?.isConnected ? hoveredCell : null;
      const focus = focusedCell?.isConnected ? focusedCell : null;
      if (hover) show(hover);
      else if (focus) show(focus);
      else hide();
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const cell = findCell(event.target);
      if (!cell) return;
      hoveredCell = cell;
      show(cell);
    };
    const onPointerOut = (event: PointerEvent) => {
      const cell = findCell(event.target);
      if (!cell) return;
      const related = findCell(event.relatedTarget);
      if (related === cell) return;
      if (hoveredCell === cell) hoveredCell = related;
      showTrackedCell();
    };
    const onFocusIn = (event: FocusEvent) => {
      const cell = findCell(event.target);
      if (!cell) return;
      focusedCell = cell;
      show(cell);
    };
    const onFocusOut = (event: FocusEvent) => {
      const cell = findCell(event.target);
      if (!cell) return;
      const related = findCell(event.relatedTarget);
      if (related === cell) return;
      if (focusedCell === cell) focusedCell = related;
      showTrackedCell();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeCell) return;
      hoveredCell = null;
      focusedCell = null;
      hide();
    };
    const onViewportChange = () => {
      if (repositionFrame !== null) return;
      repositionFrame = window.requestAnimationFrame(() => {
        repositionFrame = null;
        if (activeCell?.isConnected) show(activeCell);
        else showTrackedCell();
      });
    };

    markCells();
    const observer = new MutationObserver(markCells);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      observer.disconnect();
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      if (repositionFrame !== null) window.cancelAnimationFrame(repositionFrame);
      if (activeCell?.getAttribute("aria-describedby") === weekHeaderTooltipId) activeCell.removeAttribute("aria-describedby");
      setWeekHeaderTooltip(null);
    };
  }, [calendar, scaleMode, weekHeaderTooltipId]);

  useLayoutEffect(() => {
    const tooltip = weekHeaderTooltipReference.current;
    if (!tooltip || !weekHeaderTooltip) return;
    const bounds = tooltip.getBoundingClientRect();
    let left = weekHeaderTooltip.left;
    let top = weekHeaderTooltip.top;
    const gutter = 8;
    if (bounds.left < gutter) left += gutter - bounds.left;
    else if (bounds.right > window.innerWidth - gutter) left -= bounds.right - (window.innerWidth - gutter);
    if (bounds.bottom > window.innerHeight - gutter) top = weekHeaderTooltip.anchorTop - bounds.height - 6;
    if (top < gutter) top = gutter;
    if (Math.abs(left - weekHeaderTooltip.left) >= 1 || Math.abs(top - weekHeaderTooltip.top) >= 1) {
      setWeekHeaderTooltip((current) => current ? { ...current, left, top } : current);
    }
  }, [weekHeaderTooltip]);
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
        format: (date: Date) => formatGanttDayOfMonth(date),
        css: (date: Date) => ganttDayScaleClassName(date),
      }
      : {
        unit: "week",
        step: 1,
        format: (date: Date) => formatIsoWeek(date),
        css: (date: Date) => ganttWeekScaleClassName(date),
      },
  ], [locales, scaleMode]);

  function changeScaleMode(nextMode: GanttScaleMode): void {
    if (nextMode === scaleMode) return;
    scaleModeReference.current = nextMode;
    const currentColumns = (apiReference.current?.getState().columns ?? []).map((column) => ({ ...column }));
    if (currentColumns.length > 0) {
      pendingScaleColumnsReference.current = currentColumns;
      ganttColumnsReference.current.splice(
        0,
        ganttColumnsReference.current.length,
        ...currentColumns.map((column) => ({ ...column })),
      );
    }
    setScaleMode(nextMode);
  }

  useLayoutEffect(() => {
    const savedColumns = pendingScaleColumnsReference.current;
    const api = apiReference.current;
    if (!savedColumns || !api || !apiInstanceId) return;
    pendingScaleColumnsReference.current = null;
    let cancelled = false;
    const restore = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!cancelled) {
        await api.exec("set-columns", { columns: savedColumns });
        ensureTimelineEnd(api);
        scheduleTimelineExtension(api);
      }
    };
    void restore().catch(() => {
      if (!cancelled) onCanonicalSyncFailureReference.current();
    });
    return () => { cancelled = true; };
  }, [apiInstanceId, ensureTimelineEnd, scaleMode, scheduleTimelineExtension]);

  useEffect(() => {
    const root = ganttScrollReference.current;
    if (!root || !apiInstanceId) return;

    const rejectInvalidNativeAddBeforeCore = (event: MouseEvent) => {
      if (event.button !== 0 || mutationLockedReference.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const action = target.closest<HTMLElement>('[data-action="add-task"]');
      if (!action || !root.contains(action)) return;

      const row = action.closest<HTMLElement>(".wx-row[data-id]");
      const taskId = row ? taskIdFromElement(row) : null;
      const task = taskId ? tasksByIdReference.current.get(taskId) : undefined;
      const reason: NativeTaskAddRejectReason | null =
        !canCreateReference.current || viewRootTaskIdReference.current !== null
          ? "scope"
          : taskId && !task
            ? "missing"
            : task?.type === "milestone"
              ? "milestone"
              : null;
      if (!reason) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onTaskAddRejectedReference.current(reason);
    };

    root.addEventListener("click", rejectInvalidNativeAddBeforeCore, true);
    return () => root.removeEventListener("click", rejectInvalidNativeAddBeforeCore, true);
  }, [apiInstanceId]);

  function interceptNativeTaskAdd(local: LocalTaskAddCommand): void {
    if (!canCreateReference.current || viewRootTaskIdReference.current !== null) {
      if (!mutationLockedReference.current) onTaskAddRejectedReference.current("scope");
      return;
    }
    const target = typeof local.targetTaskId === "string"
      ? tasksByIdReference.current.get(local.targetTaskId)
      : undefined;
    if (typeof local.targetTaskId === "string" && !target) {
      onTaskAddRejectedReference.current("missing");
      return;
    }
    if (local.mode !== undefined && local.mode !== "child") {
      onTaskAddRejectedReference.current("scope");
      return;
    }
    if (target?.type === "milestone") {
      onTaskAddRejectedReference.current("milestone");
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
    api.detach("project-native-move");
    api.intercept("move-task", createTaskMoveGateway({
      canMutate: () => canCreateReference.current && inlineSessionReference.current === null,
      isCanonicalSync: () => canonicalSyncDepthReference.current > 0,
      hasTask: (id) => tasksByIdReference.current.has(id),
      canApply: (command) => taskHierarchyCommandStaysInSubtree(
        Array.from(tasksByIdReference.current.values()),
        viewRootTaskIdReference.current,
        command,
      ),
      dispatch: (command) => onTaskHierarchyCommandReference.current(command),
    }), { tag: "project-native-move" });
    api.detach("project-summary-update");
    api.intercept(
      "update-task",
      (event) => {
        const task = typeof event.id === "string"
          ? tasksByIdReference.current.get(event.id)
          : undefined;
        if (event.eventSource === "project-canonical-sync" && canonicalSyncDepthReference.current > 0) return undefined;
        return canonicalSyncDepthReference.current > 0 || !canCreateReference.current ||
          (inlineSessionReference.current?.taskId === event.id) || task?.type === "summary" ? false : undefined;
      },
      { tag: "project-summary-update" },
    );
    api.detach("project-owned-selection");
    api.on("select-task", (event) => {
      if (canonicalSyncDepthReference.current > 0 || event.eventSource === "project-canonical-sync" ||
        event.eventSource === "project-owned-selection" || typeof event.id !== "string" ||
        !tasksByIdReference.current.has(event.id)) return;
      if (!selectedTaskIdsReference.current.includes(event.id)) {
        selectionAnchorReference.current = event.id;
        updateSelection([event.id]);
      }
    }, { tag: "project-owned-selection" });
  // SVAR retains this initializer for the mounted instance. Refs keep the
  // revision and callback current without re-registering EventBus handlers.
  }, [updateSelection]);

  function headerFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const header = target.closest(".wx-table-container .wx-header");
    return header instanceof HTMLElement ? header : null;
  }

  function openColumnMenu(header: HTMLElement, x: number, y: number) {
    header.focus({ preventScroll: true });
    columnMenuTriggerReference.current = header;
    setTaskMenu(null);
    setRelationMenu(null);
    setColumnMenuPosition(clampMenuPosition(x, y, 208, 196));
  }

  function openRelationMenu(target: EventTarget | null, x: number, y: number): boolean {
    if (!(target instanceof Element)) return false;
    const linkElement = target.closest("[data-link-id]");
    if (!linkElement) return false;
    const rawId = linkElement.getAttribute("data-link-id");
    if (!rawId) return false;
    const linkId = rawId.startsWith(":") ? rawId.slice(1) : rawId;
    const exists = links.some((l) => l.id === linkId);
    if (!exists) return false;

    setTaskMenu(null);
    setTaskSubmenu(null);
    setColumnMenuPosition(null);
    setRelationMenu({ linkId, left: x, top: y });
    return true;
  }

  function openTaskMenu(target: EventTarget | null, x?: number, y?: number, fallbackTaskId?: string | null): boolean {
    const root = ganttScrollReference.current;
    if (!root || !apiReference.current || !apiInstanceId) return false;
    let match = resolveSelectionTarget(target, root);
    if (!match && fallbackTaskId) {
      const currentElement = findTaskContextElement(root, fallbackTaskId);
      if (currentElement) match = { taskId: fallbackTaskId, element: currentElement };
    }
    if (!match) return false;
    if (!selectedTaskIdsReference.current.includes(match.taskId)) applySelectionGesture(match.taskId, "single");
    if (!match.element.hasAttribute("tabindex")) match.element.tabIndex = 0;
    const focusTrigger = target instanceof HTMLElement && target.matches("input[data-copy-selection]")
      ? target
      : match.element;
    focusTrigger.focus({ preventScroll: true });
    taskMenuTriggerReference.current = focusTrigger;
    taskMenuScrollChangedReference.current = captureMenuScrollChange(match.element);
    const bounds = focusTrigger.getBoundingClientRect();
    const anchorX = x ?? bounds.left + Math.min(bounds.width / 2, 24);
    const anchorY = y ?? bounds.top + Math.min(bounds.height / 2, 24);
    const rootRem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const rootWidth = Math.min(16 * rootRem, window.innerWidth - 16);
    setColumnMenuPosition(null);
    setTaskSubmenu(null);
    suppressTaskSubmenuFocusOpenReference.current = null;
    focusTaskMenuOnOpenReference.current = true;
    setTaskMenu({ taskId: match.taskId, ...clampMenuPosition(anchorX, anchorY, rootWidth, Math.min(488, window.innerHeight - 16)) });
    return true;
  }

  function openTaskEditorFromMenu() {
    const api = apiReference.current;
    if (!api || !taskMenu) return;
    const taskId = taskMenu.taskId;
    setTaskMenu(null);
    void api.exec("show-editor", { id: taskId });
  }

  function openTaskAsRootFromMenu() {
    if (!taskMenu || !canOpenTaskAsSubtreeRoot(tasks, taskMenu.taskId)) return;
    const taskId = taskMenu.taskId;
    closeTaskMenu();
    onTaskOpenAsRoot(taskId);
  }

  async function writeTaskIdToClipboard(taskId: string): Promise<boolean> {
    try {
      const modernWrite = window.isSecureContext && navigator.clipboard?.writeText
        ? navigator.clipboard.writeText.bind(navigator.clipboard)
        : undefined;
      await writeTextWithCompatibility(taskId, modernWrite, copyTextWithLegacyCommand);
      notify("success", "작업 ID를 복사했습니다.", "작업 ID 복사");
      return true;
    } catch {
      return false;
    }
  }

  async function copyTaskIdFromMenu() {
    if (!taskMenu) return;
    const taskId = taskMenu.taskId;
    closeTaskMenu();
    if (!tasksByIdReference.current.has(taskId)) {
      notify("error", "선택한 작업을 찾을 수 없습니다. 최신 정보를 다시 확인해 주세요.", "작업 ID 복사");
      return;
    }
    if (!(await writeTaskIdToClipboard(taskId))) setCopyTaskIdFallback(taskId);
  }

  async function retryCopyTaskId() {
    if (!copyTaskIdFallback) return;
    if (await writeTaskIdToClipboard(copyTaskIdFallback)) setCopyTaskIdFallback(null);
  }

  function requestTaskDeleteFromMenu() {
    if (!taskMenu) return;
    const taskId = taskMenu.taskId;
    const trigger = taskMenuTriggerReference.current;
    setTaskMenu(null);
    onTaskDeleteRequestReference.current(taskId, trigger);
  }

  function executeHierarchyCommand(command: TaskHierarchyCommandRequest) {
    if (!taskHierarchyCommandStaysInSubtree(tasks, viewRootTaskId, command)) {
      closeTaskMenu();
      return;
    }
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
    if (!editable || mutationLocked) return;
    if (mode === "copy") copyCurrentSelection(taskMenu.taskId);
    else setTaskClipboard({ mode: "cut", taskId: taskMenu.taskId, revision: projectRevision });
    closeTaskMenu();
  }

  function pasteFromMenu(placement: "before" | "after" | "child" = "after") {
    if (!taskMenu || !activeClipboard) return;
    executeHierarchyCommand(createPasteCommand(activeClipboard, taskMenu.taskId, placement));
  }

  function resolveSelectionTarget(target: EventTarget | null, root: HTMLElement) {
    if (target instanceof Element && target.matches("input[data-copy-selection]")) {
      const row = target.closest<HTMLElement>(".wx-row[data-id]");
      const id = row ? taskIdFromElement(row) : null;
      if (row && id && root.contains(row) && tasksByIdReference.current.has(id)) return { taskId: id, element: row };
    }
    return resolveTaskContextTarget(target, root, (id) => tasksByIdReference.current.has(id));
  }

  function selectionPointerTarget(target: EventTarget | null) {
    const root = ganttScrollReference.current;
    if (!root || !(target instanceof Element) || target.closest(
      'input, label, [data-action="open-task"], [data-action="add-task"], .wx-reorder-task',
    )) return null;
    return resolveTaskContextTarget(target, root, (id) => tasksByIdReference.current.has(id));
  }

  function handleSelectionPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    namePointerIntentReference.current = null;
    startDatePointerIntentReference.current = null;
    if (event.button === 2) {
      const root = ganttScrollReference.current;
      contextPointerTaskIdReference.current = root ? resolveSelectionTarget(event.target, root)?.taskId ?? null : null;
    } else {
      contextPointerTaskIdReference.current = null;
    }
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.target instanceof Element) {
      const text = event.target.closest('.wx-table-container [role="gridcell"][data-col-id=":text"] .wx-content > .wx-text');
      const row = text?.closest<HTMLElement>(".wx-row[data-id]");
      const taskId = row ? taskIdFromElement(row) : null;
      if (taskId) namePointerIntentReference.current = { taskId, x: event.clientX, y: event.clientY };

      const startCell = event.target.closest<HTMLElement>('[role="gridcell"][data-col-id=":projectStart"]');
      const startRow = startCell?.closest<HTMLElement>(".wx-row[data-id]");
      const startTaskId = startRow ? taskIdFromElement(startRow) : null;
      if (startCell && startTaskId) {
        startDatePointerIntentReference.current = {
          taskId: startTaskId,
          x: event.clientX,
          y: event.clientY,
          cell: startCell,
        };
      }
    }
    if (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey) && selectionPointerTarget(event.target)) event.stopPropagation();
  }

  function handleSelectionClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const match = selectionPointerTarget(event.target);
    const nameIntent = namePointerIntentReference.current;
    const startIntent = startDatePointerIntentReference.current;
    startDatePointerIntentReference.current = null;
    const fallbackTarget = event.target instanceof Element && event.target.matches(".wx-scroll");
    const nameIntentTaskId = nameIntent && fallbackTarget && Math.hypot(event.clientX - nameIntent.x, event.clientY - nameIntent.y) <= 4
      ? nameIntent.taskId
      : null;
    const startIntentTaskId = startIntent && Math.hypot(event.clientX - startIntent.x, event.clientY - startIntent.y) <= 4
      ? startIntent.taskId
      : null;
    const taskId = match?.taskId ?? nameIntentTaskId ?? startIntentTaskId;
    if (!taskId) return;
    const modifier = event.ctrlKey || event.metaKey;
    applySelectionGesture(taskId, event.shiftKey ? "range" : modifier ? "toggle" : "single", modifier || event.shiftKey);
    if (!modifier && !event.shiftKey) {
      const directCell = startDateCellFrom(event.target);
      const intendedStartClick = directCell !== null || startIntentTaskId === taskId;
      const task = tasksByIdReference.current.get(taskId);
      if (intendedStartClick && task && canEditGridStartDate(task, editable && !mutationLocked)) {
        scheduleStartDatePicker(taskId, directCell ?? startIntent!.cell);
      }
    }
    if (modifier || event.shiftKey) { event.preventDefault(); event.stopPropagation(); }
  }

  function copyCurrentSelection(fallbackTaskId?: string) {
    if (!editable || mutationLocked) return;
    const ids = selectedTaskIdsReference.current.length ? selectedTaskIdsReference.current : fallbackTaskId ? [fallbackTaskId] : [];
    const taskIds = normalizeCopySelection(tasks, ids);
    if (!taskIds.length || taskIds.length > 500) {
      setSelectionMessage(taskIds.length > 500 ? "한 번에 최대 500개 root를 복사할 수 있습니다." : "복사할 작업을 선택해 주세요.");
      return;
    }
    setTaskClipboard({ mode: "copy", taskIds, revision: projectRevision });
    setSelectionMessage(`선택한 ${ids.length}개 작업을 복사했습니다. 요약 작업의 하위 작업도 포함됩니다.`);
  }

  function runTaskShortcut(event: ReactKeyboardEvent<HTMLDivElement>): boolean {
    if (!(event.target instanceof Element)) return false;
    const selectionCheckbox = event.target.matches("input[data-copy-selection]");
    if (!selectionCheckbox && event.target.closest("input, textarea, select, button, a, [contenteditable=true], dialog, .project-task-context-menu")) return false;
    const modifier = event.ctrlKey || event.metaKey;
    const shortcutKey = event.key.toLowerCase();
    if (selectionCheckbox && !(modifier && (shortcutKey === "c" || shortcutKey === "v"))) return false;
    const root = ganttScrollReference.current;
    if (!root) return false;
    const match = resolveSelectionTarget(event.target, root);
    if (!match) return false;
    const selectedHasLinks = taskSubtreeHasDependencyLinks(
      tasksByIdReference.current.size ? Array.from(tasksByIdReference.current.values()) : tasks,
      match.taskId,
      links,
    );
    const canCopy = editable && !mutationLocked;
    const canHierarchyMutate = canCopy && !selectedHasLinks;
    const canCut = canHierarchyMutate && match.taskId !== viewRootTaskId;
    const pasteCommand = activeClipboard ? createPasteCommand(activeClipboard, match.taskId) : null;
    const canPaste = Boolean(
      pasteCommand &&
      activeClipboard && !clipboardIncludesRoot(activeClipboard, match.taskId) &&
      (activeClipboard?.mode === "copy" ? canCopy : canHierarchyMutate) &&
      taskHierarchyCommandStaysInSubtree(tasks, viewRootTaskId, pasteCommand),
    );
    if (modifier && shortcutKey === "c" && canCopy) {
      copyCurrentSelection(match.taskId);
    } else if (modifier && shortcutKey === "x" && canCut) {
      setTaskClipboard({ mode: "cut", taskId: match.taskId, revision: projectRevision });
    } else if (modifier && shortcutKey === "v" && canPaste && pasteCommand) {
      onTaskHierarchyCommandReference.current(pasteCommand);
    } else if ((event.key === "Delete" || event.key === "Backspace" || (modifier && shortcutKey === "d")) && canHierarchyMutate) {
      onTaskDeleteRequestReference.current(match.taskId, match.element);
    } else {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function handleHeaderContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const fallbackTaskId = contextPointerTaskIdReference.current;
    contextPointerTaskIdReference.current = null;
    const header = headerFrom(event.target);
    if (header) {
      event.preventDefault();
      openColumnMenu(header, event.clientX, event.clientY);
    } else if (openRelationMenu(event.target, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    } else if (openTaskMenu(event.target, event.clientX, event.clientY, fallbackTaskId)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleTaskDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element) {
      if (event.target.closest('[role="gridcell"][data-col-id=":projectStart"]')) {
        if (startDateOpenTimerReference.current !== null) {
          window.clearTimeout(startDateOpenTimerReference.current);
          startDateOpenTimerReference.current = null;
        }
        setStartDatePicker(null);
      }
      const linkElement = event.target.closest("[data-link-id]");
      if (linkElement) {
        const rawId = linkElement.getAttribute("data-link-id");
        if (rawId) {
          const linkId = rawId.startsWith(":") ? rawId.slice(1) : rawId;
          if (linksReference.current.some((link) => link.id === linkId)) {
            event.preventDefault();
            event.stopPropagation();
            setRelationMenu(null);
            onRelationEditorOpenReference.current?.(linkId);
            return;
          }
        }
      }
    }

    // Editable name cells belong to the inline editor.
    // Readonly names retain the information editor double-click entry.
    const root = ganttScrollReference.current;
    if (!root) return;
    const match = resolveTaskContextTarget(event.target, root, (id) => tasksByIdReference.current.has(id));
    if (!match) return;
    if (editable) return;
    event.preventDefault();
    event.stopPropagation();
    onTaskEditorOpenReference.current(match.taskId);
  }

  function startDateCellFrom(target: EventTarget | null): HTMLElement | null {
    const root = ganttScrollReference.current;
    if (!root || !(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>('[role="gridcell"][data-col-id=":projectStart"]');
    return cell && root.contains(cell) ? cell : null;
  }

  function focusStartDateCell(): void {
    const cell = startDateTriggerReference.current;
    if (cell?.isConnected) cell.focus({ preventScroll: true });
  }

  function closeStartDatePicker(restoreFocus = true): void {
    startDatePickerClosingReference.current = true;
    setStartDatePicker(null);
    if (restoreFocus) requestAnimationFrame(focusStartDateCell);
  }

  function openStartDatePicker(taskId: string, cell: HTMLElement): void {
    const task = tasksByIdReference.current.get(taskId);
    if (!task || !task.start || !canEditGridStartDate(task, canCreateReference.current)) return;
    const bounds = cell.getBoundingClientRect();
    const width = Math.min(Math.max(bounds.width, 176), Math.max(176, window.innerWidth - 16));
    const position = clampMenuPosition(bounds.left, bounds.bottom + 4, width, 72);
    startDatePickerClosingReference.current = false;
    startDateTriggerReference.current = cell;
    setInlineStartError(false);
    setInlineStartMessage("");
    setStartDatePicker({
      taskId,
      revision: projectRevisionReference.current,
      value: task.start,
      left: position.left,
      top: position.top,
      width,
    });
  }

  function scheduleStartDatePicker(taskId: string, cell: HTMLElement): void {
    if (startDateOpenTimerReference.current !== null) window.clearTimeout(startDateOpenTimerReference.current);
    startDateOpenTimerReference.current = window.setTimeout(() => {
      startDateOpenTimerReference.current = null;
      if (!canCreateReference.current) return;
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      const root = ganttScrollReference.current;
      const currentRow = root && Array.from(root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]"))
        .find((candidate) => taskIdFromElement(candidate) === taskId);
      const currentCell = currentRow?.querySelector<HTMLElement>('[role="gridcell"][data-col-id=":projectStart"]')
        ?? (cell.isConnected ? cell : null);
      if (currentCell) openStartDatePicker(taskId, currentCell);
    }, 0);
  }

  function commitStartDate(value: string): void {
    const picker = startDatePicker;
    if (!picker || picker.revision !== projectRevisionReference.current || !canCreateReference.current) {
      closeStartDatePicker(false);
      return;
    }
    const task = tasksByIdReference.current.get(picker.taskId);
    if (!task) {
      closeStartDatePicker();
      return;
    }
    const command = createGridStartDateCommand(task, value);
    if (!command) {
      closeStartDatePicker();
      return;
    }
    setStartDatePicker(null);
    setInlineStartError(false);
    setInlineStartMessage("시작일을 저장하는 중…");
    void onTaskCommandReference.current(command, picker.revision).then((result) => {
      if (result.status === "saved") {
        setInlineStartMessage("시작일을 저장했습니다.");
      } else {
        setInlineStartError(true);
        setInlineStartMessage(result.message);
        requestAnimationFrame(focusStartDateCell);
      }
    });
  }

  const focusInlineNameCell = useCallback((taskId: string, fallback: HTMLElement): void => {
    const root = ganttScrollReference.current;
    const row = root && Array.from(root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]"))
      .find((candidate) => taskIdFromElement(candidate) === taskId);
    const cell = row?.querySelector<HTMLElement>('[role="gridcell"][data-col-id=":text"]');
    const target = cell ?? (fallback.isConnected ? fallback : null);
    target?.focus({ preventScroll: true });
  }, []);

  const findInlineNameInput = useCallback((taskId: string): HTMLInputElement | null => {
    const root = ganttScrollReference.current;
    const row = root && Array.from(root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]"))
      .find((candidate) => taskIdFromElement(candidate) === taskId);
    return row?.querySelector<HTMLInputElement>(".wx-cell.wx-editor input.wx-text") ?? null;
  }, []);

  function isCurrentInlineNameInput(target: EventTarget | null): target is HTMLInputElement {
    if (!(target instanceof HTMLInputElement) || !target.matches(".wx-cell.wx-editor input.wx-text")) return false;
    const row = target.closest(".wx-row[data-id]");
    return !!row && taskIdFromElement(row) === inlineSessionReference.current?.taskId;
  }

  const commitInlineName = useCallback((value: unknown, session: NonNullable<typeof inlineSessionReference.current>): void => {
    if (session.committed) return;
    if (!canCreateReference.current || session.revision !== projectRevisionReference.current) {
      inlineSessionReference.current = null;
      return;
    }
    const task = tasksByIdReference.current.get(session.taskId);
    const normalized = normalizeInlineTaskName(value);
    if (normalized.error || normalized.name === null) {
      setInlineNameError(true);
      setInlineNameMessage(normalized.error ?? "작업명을 확인해 주세요.");
      const input = findInlineNameInput(session.taskId);
      if (input) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", `${instanceId}-inline-name-status`);
        requestAnimationFrame(() => input.isConnected && input.focus({ preventScroll: true }));
      } else {
        inlineSessionReference.current = null;
        requestAnimationFrame(() => focusInlineNameCell(session.taskId, session.cell));
      }
      return;
    }
    if (!task || normalized.name === task.name) {
      inlineSessionReference.current = null;
      setInlineNameMessage("");
      return;
    }
    session.committed = true;
    setInlineNameError(false);
    setInlineNameMessage("작업명을 저장하는 중…");
    const token = inlineOpenTokenReference.current;
    const api = apiReference.current;
    void onTaskCommandReference.current({ taskId: task.taskId, payload: { name: normalized.name } }, session.revision).then((result) => {
      if (inlineOpenTokenReference.current !== token || apiReference.current !== api) return;
      if (result.status === "saved") {
        setInlineNameMessage("작업명을 저장했습니다.");
      } else {
        setInlineNameError(true);
        setInlineNameMessage(result.message);
        requestAnimationFrame(() => focusInlineNameCell(session.taskId, session.cell));
      }
    }).finally(() => {
      if (inlineSessionReference.current === session) inlineSessionReference.current = null;
    });
  }, [findInlineNameInput, focusInlineNameCell, instanceId, setInlineNameError, setInlineNameMessage]);

  const installInlineTableHandlers = useCallback((table: Awaited<ReturnType<IApi["getTable"]>>): void => {
    if (inlineTableReference.current === table) return;
    inlineTableReference.current?.detach("project-inline-name");
    inlineTableReference.current = table;
    table.detach("project-inline-name");
    table.intercept("open-editor", (request) => {
      const column = request.column ?? table.getState().focusCell?.column;
      if (column !== "text") return false;
      request.column = "text";
      const root = ganttScrollReference.current;
      const taskId = typeof request.id === "string" ? request.id : null;
      const task = taskId ? tasksByIdReference.current.get(taskId) : null;
      if (!root || !taskId || !task || !canCreateReference.current) return false;
      const row = Array.from(root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]"))
        .find((candidate) => taskIdFromElement(candidate) === taskId);
      const cell = row?.querySelector<HTMLElement>('[role="gridcell"][data-col-id=":text"]');
      if (!cell) return false;
      const current = inlineSessionReference.current;
      if (current) return false;
      inlineOpenTokenReference.current += 1;
      inlineSessionReference.current = { taskId, revision: projectRevisionReference.current, cell, table, committed: false };
      setInlineNameMessage("");
      setInlineNameError(false);
      return undefined;
    }, { tag: "project-inline-name" });
    // Installed before user interaction: native double-click and keyboard
    // editor entries use the same protected gateway as single click.
    table.intercept("update-cell", (change) => {
      if (change.column !== "text") return undefined;
      const current = inlineSessionReference.current;
      if (current && change.id === current.taskId) {
        // Core may coerce numeric-looking text before update-cell (e.g. "001"
        // to 1). Capture the editor's raw string while it is still mounted.
        const rawValue = findInlineNameInput(current.taskId)?.value;
        commitInlineName(rawValue ?? change.value, current);
      }
      return false;
    }, { tag: "project-inline-name" });
    table.intercept("close-editor", (change) => {
      const current = inlineSessionReference.current;
      const editor = table.getState().editor;
      if (!current || current.committed || change?.ignore || editor?.id !== current.taskId || editor.column !== "text") return undefined;
      const checked = normalizeInlineTaskName(editor.value);
      if (!checked.error) return undefined;
      setInlineNameError(true);
      setInlineNameMessage(checked.error);
      const input = findInlineNameInput(current.taskId);
      input?.setAttribute("aria-invalid", "true");
      input?.setAttribute("aria-describedby", `${instanceId}-inline-name-status`);
      requestAnimationFrame(() => input?.isConnected && input.focus({ preventScroll: true }));
      return false;
    }, { tag: "project-inline-name" });
    table.on("close-editor", () => {
      const current = inlineSessionReference.current;
      if (current && !current.committed) {
        inlineSessionReference.current = null;
        setInlineNameMessage("");
      }
    }, { tag: "project-inline-name" });
  }, [commitInlineName, findInlineNameInput, instanceId, setInlineNameError, setInlineNameMessage]);

  useEffect(() => {
    const api = apiReference.current;
    if (!api || !apiInstanceId) return;
    let active = true;
    void Promise.resolve(api.getTable(true)).then((table) => {
      if (active && apiReference.current === api && ganttScrollReference.current?.isConnected) installInlineTableHandlers(table);
    });
    return () => { active = false; };
  }, [apiInstanceId, installInlineTableHandlers]);

  useEffect(() => {
    if (!startDatePicker) return;
    // Picker opening is already deferred until after the Grid click/selection
    // completes. Own focus on mount, then repair only if SVAR subsequently
    // restores focus into the Gantt while this picker is still open.
    const focusInput = () => {
      if (startDatePickerClosingReference.current) return;
      const input = startDateInputReference.current;
      if (input?.isConnected && document.activeElement !== input) input.focus({ preventScroll: true });
    };
    const focusTimer = window.setTimeout(focusInput, 0);

    const closeForOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && startDatePickerReference.current?.contains(event.target)) return;
      if (event.target instanceof Node && startDateTriggerReference.current?.contains(event.target)) return;
      closeStartDatePicker(false);
    };
    const repairGridFocus = (event: FocusEvent) => {
      if (startDatePickerClosingReference.current || event.target === startDateInputReference.current) return;
      if (!(event.target instanceof Node) || !ganttScrollReference.current?.contains(event.target)) return;
      queueMicrotask(focusInput);
    };
    const closeForViewportResize = () => closeStartDatePicker(false);
    const closeForEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeStartDatePicker();
    };
    document.addEventListener("pointerdown", closeForOutsidePointer, true);
    document.addEventListener("focusin", repairGridFocus, true);
    document.addEventListener("keydown", closeForEscape, true);
    window.addEventListener("resize", closeForViewportResize);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("pointerdown", closeForOutsidePointer, true);
      document.removeEventListener("focusin", repairGridFocus, true);
      document.removeEventListener("keydown", closeForEscape, true);
      window.removeEventListener("resize", closeForViewportResize);
    };
  }, [startDatePicker]);

  async function handleNameClick(event: ReactMouseEvent<HTMLDivElement>) {
    const intent = namePointerIntentReference.current;
    namePointerIntentReference.current = null;
    if (!editable || mutationLocked || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const currentInline = inlineSessionReference.current;
    if (currentInline) {
      const editor = currentInline.table.getState().editor;
      const input = findInlineNameInput(currentInline.taskId);
      const activeEditor = editor?.id === currentInline.taskId && editor.column === "text" && input?.isConnected;
      if (activeEditor) return;
      // Drag/reorder or selection can leave an intercepted open-editor session
      // without a mounted editor. Do not let that stale session block the next
      // explicit name click.
      inlineSessionReference.current = null;
    }
    const root = ganttScrollReference.current;
    const api = apiReference.current;
    if (!root || !api || !(event.target instanceof Element)) return;
    let text = event.target.closest<HTMLElement>('.wx-table-container [role="gridcell"][data-col-id=":text"] .wx-content > .wx-text');
    // Core can replace a row during the pointer gesture (selection or resize).
    // Preserve only a plain name click at the original point; drag/other cells
    // cannot become an inline edit. Resolve the currently mounted row by ID.
    if (!text && intent && event.target.matches(".wx-scroll") && Math.hypot(event.clientX - intent.x, event.clientY - intent.y) <= 4) {
      const currentRow = Array.from(root.querySelectorAll<HTMLElement>(".wx-table-container .wx-row[data-id]"))
        .find((candidate) => taskIdFromElement(candidate) === intent.taskId);
      text = currentRow?.querySelector<HTMLElement>('[role="gridcell"][data-col-id=":text"] .wx-content > .wx-text') ?? null;
    }
    const cell = text?.closest<HTMLElement>('[role="gridcell"][data-col-id=":text"]');
    const row = cell?.closest<HTMLElement>(".wx-row[data-id]");
    const taskId = row ? taskIdFromElement(row) : null;
    if (!text || !cell || !taskId || !root.contains(cell) || !tasksByIdReference.current.has(taskId)) return;
    const token = ++inlineOpenTokenReference.current;
    setInlineNameMessage("");
    setInlineNameError(false);
    try {
      const table = await api.getTable(true);
      if (token !== inlineOpenTokenReference.current || apiReference.current !== api || !root.isConnected ||
        !canCreateReference.current) return;
      // SVAR may replace the clicked row/cell while applying selection before
      // getTable() resolves. The open-editor interceptor resolves the current
      // row/cell again by taskId, so a stale clicked cell must not cancel edit.
      installInlineTableHandlers(table);
      await table.exec("open-editor", { id: taskId, column: "text" });
    } catch {
      if (token !== inlineOpenTokenReference.current || !root.isConnected) return;
      inlineSessionReference.current = null;
      setInlineNameError(true);
      setInlineNameMessage("작업명 편집기를 열 수 없습니다. 다시 시도해 주세요.");
      focusInlineNameCell(taskId, cell);
    }
  }

  function handleInlineEscape(event: ReactKeyboardEvent<HTMLDivElement>): boolean {
    const session = inlineSessionReference.current;
    if (event.key !== "Escape" || !session || session.committed) return false;
    event.preventDefault();
    event.stopPropagation();
    inlineSessionReference.current = null;
    inlineOpenTokenReference.current += 1;
    setInlineNameMessage("");
    void session.table.exec("close-editor", { ignore: true }).finally(() => {
      focusInlineNameCell(session.taskId, session.cell);
    });
    return true;
  }

  function handleHeaderKeyboardMenu(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" && isCurrentInlineNameInput(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      // Core's input saves on Enter while its editor wrapper also cancels on
      // the bubbling Enter. Own the key before either handler can run.
      if (!inlineComposingReference.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
        const session = inlineSessionReference.current;
        if (session && !session.committed) void session.table.exec("close-editor", { ignore: false });
      }
      return;
    }
    if (handleInlineEscape(event)) return;
    if (!startDatePicker && (event.key === "Enter" || event.key === " ")) {
      const cell = startDateCellFrom(event.target);
      const row = cell?.closest<HTMLElement>(".wx-row[data-id]");
      const taskId = row ? taskIdFromElement(row) : null;
      const task = taskId ? tasksByIdReference.current.get(taskId) : undefined;
      if (cell && taskId && task && canEditGridStartDate(task, editable && !mutationLocked)) {
        event.preventDefault();
        event.stopPropagation();
        openStartDatePicker(taskId, cell);
        return;
      }
    }
    if (event.key === "Escape" && !taskMenu && !columnMenuPosition && selectedTaskIdsReference.current.length &&
      event.target instanceof Element && !event.target.closest('input:not([data-copy-selection]), textarea, select, [contenteditable=true], dialog, .wx-scale, .wx-header')) {
      event.preventDefault();
      event.stopPropagation();
      selectionAnchorReference.current = null;
      updateSelection([]);
      setSelectionMessage("선택을 해제했습니다.");
      return;
    }
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
    if (itemBounds.bottom > scrollBounds.bottom - 4) {
      scroller.scrollTo({ top: scroller.scrollTop + itemBounds.bottom - scrollBounds.bottom + 4 });
    } else if (itemBounds.top < scrollBounds.top + 4) {
      scroller.scrollTo({ top: scroller.scrollTop - (scrollBounds.top - itemBounds.top + 4) });
    }
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
  const selectedSubtreeHasLinks = taskMenu ? taskSubtreeHasDependencyLinks(tasks, taskMenu.taskId, links) : false;
  const canOpenAsRoot = taskMenu
    ? taskMenu.taskId !== viewRootTaskId && canOpenTaskAsSubtreeRoot(tasks, taskMenu.taskId)
    : false;
  const canCopy = editable && !mutationLocked;
  const canMutate = canCopy && !selectedTaskHasLinks;
  const canCut = canCopy && !selectedSubtreeHasLinks && taskMenu?.taskId !== viewRootTaskId;
  const canDelete = canCopy && !selectedSubtreeHasLinks;
  const activeClipboard = taskClipboard?.revision === projectRevision ? taskClipboard : null;
  const menuCapabilities = taskMenu
    ? taskContextCapabilities(tasks, taskMenu.taskId, editable, mutationLocked, links, activeClipboard, viewRootTaskId)
    : null;
  const submenuId = taskSubmenu ? `${instanceId}-${taskSubmenu.name.replaceAll(" ", "-")}-submenu` : undefined;
  const submenuCommands = taskMenu && menuCapabilities && taskSubmenu ? (() => {
    switch (taskSubmenu.name) {
      case "Add": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canAddChild} onClick={() => createTaskFromMenu("child")} role="menuitem" type="button">Child task</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canAddChild} onClick={() => {
          executeHierarchyCommand({ kind: "create", anchorTaskId: taskMenu.taskId, placement: "child", task: { name: "새 요약 작업", type: "summary" } });
        }} role="menuitem" type="button">요약 작업 추가</button>
        <button className="project-task-context-submenu-command" disabled={!canMutate || taskMenu.taskId === viewRootTaskId} onClick={() => createTaskFromMenu("before")} role="menuitem" type="button">Task above</button>
        <button className="project-task-context-submenu-command" disabled={!canMutate || taskMenu.taskId === viewRootTaskId} onClick={() => createTaskFromMenu("after")} role="menuitem" type="button">Task below</button>
      </>;
      case "Convert to": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canConvertToTask} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "task" })} role="menuitem" type="button">Task</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canConvertToSummary} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "summary" })} role="menuitem" type="button">Summary task</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canConvertToMilestone} onClick={() => executeHierarchyCommand({ kind: "convert", taskId: taskMenu.taskId, targetType: "milestone" })} role="menuitem" type="button">Milestone</button>
      </>;
      case "Paste": return <>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canPaste || !menuCapabilities.canAddChild} onClick={() => pasteFromMenu("child")} role="menuitem" type="button">As child</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canPaste || taskMenu.taskId === viewRootTaskId} onClick={() => pasteFromMenu("before")} role="menuitem" type="button">Above</button>
        <button className="project-task-context-submenu-command" disabled={!menuCapabilities.canPaste || taskMenu.taskId === viewRootTaskId} onClick={() => pasteFromMenu("after")} role="menuitem" type="button">Below</button>
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
    <div className="project-gantt-frame" ref={fullscreenFrameReference} data-gantt-scale-mode={scaleMode} data-gantt-cell-width={GANTT_CELL_WIDTH[scaleMode]} data-gantt-timeline-end={timelineEndMs} data-project-gantt-api-instance={apiInstanceId ?? undefined} data-project-gantt-instance={instanceId} data-task-mutation-locked={mutationLocked || undefined} data-task-add-disabled={viewRootTaskId !== null || undefined} data-task-inline-editable={editable && !mutationLocked || undefined}>
      <CopySelectionContext.Provider value={selectionContext}><Willow>
      <div className="project-gantt-scale-toolbar">
        <div aria-label="Gantt 표시 단위" className="project-gantt-scale-controls" role="group">
          <span aria-hidden="true" className="project-gantt-scale-label">표시 단위</span>
          <button aria-pressed={scaleMode === "day"} onClick={() => changeScaleMode("day")} type="button">일</button>
          <button aria-pressed={scaleMode === "week"} onClick={() => changeScaleMode("week")} type="button">주</button>
        </div>
        <div className="project-copy-selection-controls" role="group" aria-label="복사 대상 선택">
          <span role="status" aria-atomic="true">선택 {selectedTaskIds.length}개{selectionHiddenCount ? ` · 접힌 하위 ${selectionHiddenCount}개` : ""}</span>
          <button type="button" disabled={!selectedTaskIds.length || !editable || mutationLocked} onClick={() => copyCurrentSelection()}>선택 복사</button>
          <button type="button" disabled={!selectedTaskIds.length} onClick={() => {
            selectionAnchorReference.current = null;
            updateSelection([]);
            setSelectionMessage("선택을 해제했습니다.");
            ganttScrollReference.current?.focus({ preventScroll: true });
          }}>선택 해제</button>
          <span className="project-copy-selection-help">체크박스 · Ctrl/Cmd · Shift로 선택</span>
        </div>
        {editable && viewRootTaskId === null ? <button className="project-gantt-fullscreen-button" disabled={mutationLocked} onClick={() => onTaskCreateReference.current({ name: "새 요약 작업", type: "summary" })} type="button">요약 작업 추가</button> : null}
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
          onPointerDownCapture={handleSelectionPointerDown}
          onPointerMoveCapture={(event) => {
            const intent = namePointerIntentReference.current;
            if (intent && Math.hypot(event.clientX - intent.x, event.clientY - intent.y) > 4) namePointerIntentReference.current = null;
          }}
          onPointerCancelCapture={() => {
            namePointerIntentReference.current = null;
            startDatePointerIntentReference.current = null;
            contextPointerTaskIdReference.current = null;
          }}
          onClickCapture={handleSelectionClick}
          onClick={(event) => { void handleNameClick(event); }}
          onCompositionStart={() => { inlineComposingReference.current = true; }}
          onCompositionEnd={() => { inlineComposingReference.current = false; }}
          onInput={(event) => {
            if (!isCurrentInlineNameInput(event.target)) return;
            event.target.removeAttribute("aria-invalid");
            event.target.removeAttribute("aria-describedby");
            setInlineNameError(false);
            setInlineNameMessage("");
          }}
          onDoubleClick={handleTaskDoubleClick}
          onKeyDownCapture={handleHeaderKeyboardMenu}
          ref={ganttScrollReference}
          role="region"
          tabIndex={0}
        >
          <div className="wx-theme gantt-widget project-gantt-widget">
            <Gantt
              cellWidth={GANTT_CELL_WIDTH[scaleMode]}
              columns={initialConfig.columns}
              displayMode="all"
              gridWidth={480}
              highlightTime={scaleMode === "day" ? highlightWeekend : undefined}
              init={initialize}
              links={initialConfig.links}
              onUpdateTask={onUpdateTask}
              readonly={!editable}
              scales={scales}
              autoScale={false}
              start={initialRange.start}
              tasks={initialConfig.tasks}
              taskTypes={projectTaskTypes}
            />
          </div>
        </div>
        {startDatePicker ? (
          <div
            aria-label="시작일 날짜 선택"
            className="project-gantt-start-date-picker"
            ref={startDatePickerReference}
            role="dialog"
            style={{ left: startDatePicker.left, top: startDatePicker.top, width: startDatePicker.width }}
          >
            <label htmlFor={`${instanceId}-start-date-input`}>시작일</label>
            <input
              aria-label="시작일 선택"
              autoFocus
              id={`${instanceId}-start-date-input`}
              max="2199-12-31"
              min="1900-01-01"
              onChange={(event) => commitStartDate(event.target.value)}
              ref={startDateInputReference}
              type="date"
              value={startDatePicker.value}
            />
          </div>
        ) : null}
        {dayHeaderTooltip ? (
          <div
            className="project-gantt-day-header-tooltip"
            id={dayHeaderTooltipId}
            ref={dayHeaderTooltipReference}
            role="tooltip"
            style={{ left: dayHeaderTooltip.left, top: dayHeaderTooltip.top }}
          >
            <span className="project-gantt-day-header-tooltip-weekday">{dayHeaderTooltip.data.weekday}</span>
            {dayHeaderTooltip.data.holidayNames.map((name) => (
              <span className="project-gantt-day-header-tooltip-holiday" key={name}>{name}</span>
            ))}
          </div>
        ) : null}
        {selectionMessage ? <p className="project-copy-selection-status" role="status">{selectionMessage}</p> : null}
        {weekHeaderTooltip ? (
          <div
            className="project-gantt-week-header-tooltip"
            id={weekHeaderTooltipId}
            ref={weekHeaderTooltipReference}
            role="tooltip"
            style={{ left: weekHeaderTooltip.left, top: weekHeaderTooltip.top }}
          >
            <span className="project-gantt-week-header-tooltip-working">근무일: {weekHeaderTooltip.data.workingDays}일</span>
            {weekHeaderTooltip.data.holidays.length > 0 ? (
              <span className="project-gantt-week-header-tooltip-holidays">
                <span className="project-gantt-week-header-tooltip-label">공휴일:</span>
                {weekHeaderTooltip.data.holidays.flatMap((holiday) =>
                  holiday.names.map((name) => (
                    <span className="project-gantt-week-header-tooltip-holiday" key={holiday.date + "-" + name}>
                      <time dateTime={holiday.date}>{formatLocaleDateOnly(holiday.date, locales)}</time> {name}
                    </span>
                  )),
                )}
              </span>
            ) : null}
          </div>
        ) : null}
        {inlineNameMessage ? <p className="project-gantt-inline-name-status" role={inlineNameError ? "alert" : "status"} id={`${instanceId}-inline-name-status`}>{inlineNameMessage}</p> : null}
        {inlineStartMessage ? <p className="project-gantt-inline-name-status" role={inlineStartError ? "alert" : "status"} id={`${instanceId}-inline-start-status`}>{inlineStartMessage}</p> : null}
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
          {canOpenAsRoot ? <button aria-label="최상위로 열기 (작업공간 탭)" onClick={openTaskAsRootFromMenu} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">▤</span><span>최상위로 열기</span>
          </button> : null}
          <button aria-label="Copy ID" onClick={() => void copyTaskIdFromMenu()} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">#</span><span>Copy ID</span>
          </button>
          <div className="project-task-context-menu-separator" role="separator" />
          <button aria-label="Cut" disabled={!canCut} onClick={() => storeClipboard("cut")} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">✂</span><span>Cut</span><kbd>Ctrl+X</kbd>
          </button>
          <button aria-label="Copy" disabled={!canCopy} onClick={() => storeClipboard("copy")} role="menuitem" type="button">
            <span aria-hidden="true" className="project-task-context-menu-icon">□</span><span>Copy</span><kbd>Ctrl+C</kbd>
          </button>
          <div className="project-task-context-submenu-host" data-submenu="Paste">
            <button aria-controls={taskSubmenu?.name === "Paste" ? submenuId : undefined} aria-expanded={taskSubmenu?.name === "Paste"} aria-haspopup="menu" aria-label="Paste" disabled={!menuCapabilities.canPaste} onClick={() => { openTaskSubmenu("Paste", true); focusFirstTaskSubmenuItem(); }} onFocus={() => openTaskSubmenu("Paste", false)} onPointerEnter={(event) => { if (event.pointerType === "mouse") openTaskSubmenu("Paste", false); }} ref={(node) => { taskSubmenuTriggers.current.Paste = node; }} role="menuitem" type="button">
              <span aria-hidden="true" className="project-task-context-menu-icon">▣</span><span>Paste</span><span className="project-task-context-menu-arrow">›</span>
            </button>
          </div>
          <div className="project-task-context-menu-separator" role="separator" />
          <div className="project-task-context-submenu-host" data-submenu="Move">
            <button aria-controls={taskSubmenu?.name === "Move" ? submenuId : undefined} aria-expanded={taskSubmenu?.name === "Move"} aria-haspopup="menu" aria-label="Move" disabled={!canMutate && !menuCapabilities.canMoveUp && !menuCapabilities.canMoveDown} onClick={() => { openTaskSubmenu("Move", true); focusFirstTaskSubmenuItem(); }} onFocus={() => openTaskSubmenu("Move", false)} onPointerEnter={(event) => { if (event.pointerType === "mouse") openTaskSubmenu("Move", false); }} ref={(node) => { taskSubmenuTriggers.current.Move = node; }} role="menuitem" type="button">
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
        {copyTaskIdFallback ? <WorkspaceDialog title="작업 ID 수동 복사" onClose={() => setCopyTaskIdFallback(null)}>
          <p>자동 복사를 사용할 수 없습니다. 아래 작업 ID를 선택해 수동으로 복사해 주세요.</p>
          <input aria-label="작업 ID" className={feedbackStyles.copyValue} readOnly value={copyTaskIdFallback}
            onFocus={(event) => event.currentTarget.select()} />
          <button className="secondary-button" type="button" onClick={() => void retryCopyTaskId()}>복사 다시 시도</button>
        </WorkspaceDialog> : null}
        {relationMenu ? (
          <RelationContextMenu
            key={relationMenu.linkId}
            editable={editable && !mutationLocked}
            linkId={relationMenu.linkId}
            links={links}
            onClose={() => setRelationMenu(null)}
            onOpenEditor={(id) => onRelationEditorOpenReference.current?.(id)}
            onDelete={async (id) => {
              onLinkDeleteReference.current(id);
            }}
            onSave={async (id, patch) => {
              if (!onLinkUpdateReference.current) return false;
              return onLinkUpdateReference.current(id, patch);
            }}
            position={{ left: relationMenu.left, top: relationMenu.top }}
            tasks={tasks}
          />
        ) : null}
      </Willow></CopySelectionContext.Provider>
    </div>
  );
}
