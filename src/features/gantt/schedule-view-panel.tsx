"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IApi, IColumnConfig } from "@svar-ui/react-gantt";
import type { ProjectTaskDto, ProjectCalendarDto } from "@/contracts/projects";
import type { ScheduleViewSourceResponse } from "@/contracts/schedule-views";
import { taskStatusFromProgress } from "@/domain/task-status";
import { displayName } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import { projectScheduleView, type ScheduleViewRow } from "./schedule-view-projection";
import { GANTT_CELL_WIDTH, type GanttScaleMode } from "./timeline-range";
import { ganttColumnHeader } from "./svar-locales";
import { formatLocaleDateOnly } from "../../lib/date-display";
import { scheduleScaleCells } from "./schedule-view-scale";
import { projectedTaskReveal, type ProjectedTaskRevealStatus } from "./schedule-view-reveal";
import "./schedule-view-panel.css";

const DAY = 86_400_000;
const dateOrdinal = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const localOrdinal = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;

type Source = ScheduleViewSourceResponse["data"];
type ProjectionBookmark = {
  context: string;
  presentation: string;
  receipt: number;
  intent: number;
  rowKey: string | null;
  canonicalTaskId: string | null;
  ancestors: string[];
  offset: number;
  date: number;
  densityAnchor?: number;
};
const visibleRows = (rows: readonly ScheduleViewRow[], collapsed: ReadonlySet<string>) => {
  const hidden = new Set<string>();
  return rows.filter(row => {
    if (row.parentViewRowKey && (collapsed.has(row.parentViewRowKey) || hidden.has(row.parentViewRowKey))) {
      hidden.add(row.viewRowKey); return false;
    }
    return true;
  });
};
type Props = {
  view: "resource" | "equipment";
  projectPublicId?: string;
  projectRevision: number;
  contextKey: string;
  tasks: readonly ProjectTaskDto[];
  visibleTaskIds: readonly string[];
  scaleMode: GanttScaleMode;
  cellHeight: number;
  calendar: ProjectCalendarDto;
  statusContainer?: HTMLElement | null;
  readApi: () => IApi | null;
  selectedTaskIds: readonly string[];
  blocked: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  onOpenTask: (id: string) => void;
};

/** Read-only presentation: neither synthetic identities nor mutations reach Core. */
export function ScheduleViewPanel(props: Props) {
  const { t, locale, formatLocale } = useI18n();
  const { view, projectPublicId, projectRevision, readApi, scaleMode, cellHeight } = props;
  const [refresh, setRefresh] = useState(0);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);
  const [infoTooltip, setInfoTooltip] = useState<{ kind: "group" | "error"; key?: string; left: number; top: number } | null>(null);
  const showInfoTooltip = (target: HTMLElement, kind: "group" | "error", key?: string) => {
    const box = target.getBoundingClientRect();
    setInfoTooltip({ kind, key, left: Math.max(8, Math.min(box.left, window.innerWidth - 328)),
      top: Math.max(8, Math.min(box.bottom + 6, window.innerHeight - 120)) });
  };
  const [scaleTooltip, setScaleTooltip] = useState<{ date: string; tier: number; mode: GanttScaleMode; left: number; top: number } | null>(null);
  const showScaleTooltip = (target: HTMLElement, date: string, tier: number) => {
    const box = target.getBoundingClientRect();
    setScaleTooltip({ date, tier, mode: scaleMode, left: Math.max(8, Math.min(box.left, window.innerWidth - 328)),
      top: Math.max(8, Math.min(box.bottom + 6, window.innerHeight - 120)) });
  };
  const sourceKey = `${projectPublicId}:${projectRevision}:${view}:${props.active}:${props.blocked}:${refresh}`;
  const projectionContext = JSON.stringify([projectPublicId, view, props.contextKey, scaleMode]);
  const [loaded, setLoaded] = useState<{
    key: string; data: Source; intent: number; context: string; receipt: number;
    tasks: readonly ProjectTaskDto[]; visibleTaskIds: readonly string[]; chartWidth: number;
  } | null>(null);
  const [requestState, setRequestState] = useState<{ key: string; pending: boolean; error?: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState({ top: 0, left: 0, height: 500, width: 1000 });
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [axis, setAxis] = useState<{ start: number; width: number; grid: number; left: number; headerHeight: number; columns: IColumnConfig[] } | null>(null);
  const focusRow = useRef<string | null>(null);
  const bookmark = useRef<ProjectionBookmark | null>(null);
  // Preserve the clicked duplicated projection path across React selection
  // rerenders, but relinquish it to a later actual user input/source receipt.
  const selectedPathAnchor = useRef<{ rowKey: string; context: string; receipt: number; intent: number } | null>(null);
  const requestSequence = useRef(0);
  const userIntent = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestSequence.current;
    const intent = userIntent.current;
    const load = async () => {
      try {
        // A hidden workspace or open Editor cannot validate an active View.
        setRequestState({ key: sourceKey, pending: true });
        if (!props.active || props.blocked) return;
        if (!projectPublicId) throw new Error("source");
        const response = await fetch(`/api/projects/${encodeURIComponent(projectPublicId)}/schedule-view-source`, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) throw new Error("source");
        const payload: ScheduleViewSourceResponse = await response.json();
        const data = payload.data;
        if (!data || data.schema !== "schedule-view-source/1" || data.projectPublicId !== projectPublicId ||
            data.projectRevision !== projectRevision ||
            ![data.assignments, data.resources, data.groups, data.equipment, data.equipmentTypes, data.taskEquipment].every(Array.isArray) ||
            !Number.isSafeInteger(data.catalogRevision) || !Number.isSafeInteger(data.logisticsTypeCatalogRevision) ||
            !data.resources.every(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.active === "boolean") ||
            !data.groups.every(item => item && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.memberResourceIds)) ||
            !data.equipment.every(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.model === "string") ||
            !data.equipmentTypes.every(item => item && typeof item.code === "string" && typeof item.name === "string") ||
            !data.assignments.every(item => item && typeof item.taskId === "string" && item.target && ["resource", "group"].includes(item.target.kind) && typeof item.target.id === "string") ||
            !data.taskEquipment.every(item => item && typeof item.taskId === "string" && Array.isArray(item.effectiveEquipmentIds))) throw new Error("stale");
        if (!controller.signal.aborted && request === requestSequence.current) {
          // Keep a matched canonical/source snapshot for geometry only while
          // later requests are unverified. Never combine it with newer Tasks.
          setLoaded({ key: sourceKey, data, intent, context: projectionContext, receipt: request,
            tasks: props.tasks, visibleTaskIds: props.visibleTaskIds,
            chartWidth: readApi()?.getState()._scales?.width ?? 0 });
          setRequestState({ key: sourceKey, pending: false });
        }
      } catch {
        if (!controller.signal.aborted && request === requestSequence.current) setRequestState({ key: sourceKey, pending: false, error: "View 데이터를 확인할 수 없습니다. 최신 일정을 확인한 뒤 다시 조회해 주세요." });
      }
    };
    void load();
    return () => controller.abort();
  }, [projectPublicId, projectRevision, sourceKey, props.active, props.blocked, projectionContext, props.tasks, props.visibleTaskIds, readApi]);

  useEffect(() => {
    const refreshSource = () => { if (document.visibilityState === "visible") setRefresh(value => value + 1); };
    window.addEventListener("focus", refreshSource);
    return () => window.removeEventListener("focus", refreshSource);
  }, []);

  useLayoutEffect(() => {
    // Keep fixed overlays inside the same fullscreen top layer as the View.
    setOverlayHost(scroller.current?.closest<HTMLElement>(".project-gantt-frame") ?? null);
  }, []);

  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const read = () => setViewport({ top: root.scrollTop, left: root.scrollLeft, height: root.clientHeight, width: root.clientWidth });
    const observer = new ResizeObserver(read);
    observer.observe(root);
    const frame = requestAnimationFrame(read);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  useLayoutEffect(() => {
    // The established Core axis remains the sole date-range authority.
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      const api = readApi();
      if (!api) return;
      const state = api.getState();
      const start = state._scales?.start ?? state._start;
      const width = state._scales?.width;
      if (start instanceof Date && Number.isFinite(start.getTime()) && typeof width === "number" && width > 0) {
        setAxis({ start: localOrdinal(start), width, grid: typeof state.gridWidth === "number" ? state.gridWidth : 480,
          left: typeof state.scrollLeft === "number" ? state.scrollLeft : 0,
          headerHeight: (state.scaleHeight ?? 36) * (state.scales?.length ?? 2),
          columns: (state.columns ?? []).map(column => ({ ...column })) });
      }
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [readApi, scaleMode, projectRevision, locale]);

  const source = props.active && !props.blocked && loaded?.key === sourceKey && requestState?.key === sourceKey &&
    !requestState.pending && !requestState.error ? loaded.data : undefined;
  const projectionResult = useMemo(() => {
    if (!source) return { projection: null, error: false };
    try { return { projection: projectScheduleView({
    ...source, view, tasks: props.tasks, visibleTaskIds: props.visibleTaskIds,
    resources: source.resources.map(item => ({ ...item, name: displayName(item, locale) })),
    groups: source.groups.map(item => ({ ...item, name: displayName(item, locale) })),
    equipment: source.equipment.map(item => ({ ...item, name: displayName(item, locale) })),
    equipmentTypes: source.equipmentTypes.map(item => ({ ...item, name: displayName(item, locale) })),
    labels: { personUnspecified: t("개인 미지정"), groupUnassigned: t("그룹 미소속"), fullyUnassigned: t("완전 미할당"), modelUnspecified: t("모델 미지정"), equipmentUnlinked: t("설비 미연결") },
  }), error: false }; } catch { return { projection: null, error: true }; }
  }, [source, view, props.tasks, props.visibleTaskIds, locale, t]);
  const projection = projectionResult.projection;

  const retainedGeometry = useMemo(() => {
    if (source || !loaded || loaded.context !== projectionContext) return null;
    try {
      const previous = projectScheduleView({ ...loaded.data, view, tasks: loaded.tasks, visibleTaskIds: loaded.visibleTaskIds });
      return { rowCount: visibleRows(previous.rows, collapsed).length, chartWidth: loaded.chartWidth };
    } catch { return null; }
  }, [source, loaded, projectionContext, view, collapsed]);
  const rows = useMemo(() => visibleRows(projection?.rows ?? [], collapsed), [projection, collapsed]);
  const headerHeight = axis?.headerHeight ?? 72;
  const startRow = Math.max(0, Math.floor(Math.max(0, viewport.top - headerHeight) / cellHeight) - 4);
  const endRow = Math.min(rows.length, Math.ceil((viewport.top + viewport.height) / cellHeight) + 4);
  const visible = rows.slice(startRow, endRow);
  const unitDays = scaleMode === "day" ? 1 : 7;
  const cellWidth = GANTT_CELL_WIDTH[scaleMode];
  const gridWidth = axis?.grid ?? 480;
  const columns = (axis?.columns ?? []).filter(column => !column.hidden);
  const columnWidth = columns.reduce((sum, column) => sum + (column.width ?? 100), 0);
  const gridColumns = columns.map(column => ({ ...column, width: (column.width ?? 100) +
    (column.id === "text" && column.flexgrow ? Math.max(0, gridWidth - columnWidth) : 0) }));
  const gridOffset = Math.min(gridScrollLeft, Math.max(0, columnWidth - gridWidth));
  const pixelsPerDay = cellWidth / unitDays;
  const chartWidth = axis?.width ?? 0;
  const firstTick = Math.max(0, Math.floor((viewport.left - gridWidth) / cellWidth) - 1);
  const lastTick = Math.min(Math.ceil(chartWidth / cellWidth), firstTick + Math.ceil(viewport.width / cellWidth) + 4);
  const scaleCells = axis ? scheduleScaleCells({ start: axis.start, width: chartWidth, cellWidth,
    first: firstTick, last: lastTick, mode: scaleMode, locale, calendar: props.calendar }) : { upper: [], lower: [] };
  const scaleTooltipText = scaleTooltip?.mode === scaleMode
    ? (scaleTooltip.tier === 0 ? scaleCells.upper : scaleCells.lower).find(cell => cell.date === scaleTooltip.date)?.tooltip : undefined;
  const validTask = (id: string | null) => Boolean(id && props.tasks.some(task => task.taskId === id && task.type === "task"));
  const selectTaskRow = (row: ScheduleViewRow) => {
    if (row.kind !== "task" || !row.canonicalTaskId || !validTask(row.canonicalTaskId) || props.blocked || !source || !props.active) return;
    const root = scroller.current;
    focusRow.current = row.viewRowKey;
    if (root) {
      const reveal = axis ? projectedTaskReveal({ start: row.start, axisStart: axis.start, pixelsPerDay,
        scrollWidth: root.scrollWidth, clientWidth: root.clientWidth })
        : { status: "NOT_MEASURABLE" as const, left: 0 };
      let status: ProjectedTaskRevealStatus = reveal.status;
      if (status === "ALIGNED" || status === "NO_SCROLL_CAPACITY") {
        if (Math.abs(root.scrollLeft - reveal.left) > 0.5) root.scrollLeft = reveal.left;
        if (Math.abs(root.scrollLeft - reveal.left) > 1) status = "NOT_MEASURABLE";
      }
      root.dataset.lastRevealStatus = status;
      root.dataset.lastRevealRowKey = row.viewRowKey;
      selectedPathAnchor.current = { rowKey: row.viewRowKey, context: projectionContext,
        receipt: loaded?.receipt ?? -1, intent: userIntent.current };
      captureBookmark(root);
      setViewport({ top: root.scrollTop, left: root.scrollLeft, height: root.clientHeight, width: root.clientWidth });
    }
    props.onSelect(row.canonicalTaskId);
  };
  const openTask = (id: string) => {
    if (props.blocked || !source || !validTask(id)) return;
    const root = scroller.current;
    if (root) captureBookmark(root);
    props.onSelect(id); props.onOpenTask(id);
  };

  const presentation = `${sourceKey}:${loaded?.receipt}:${axis?.start}:${axis?.width}:${locale}:${cellHeight}`;
  const captureBookmark = useCallback((root: HTMLDivElement) => {
    if (!source || !axis || !loaded || !props.active || props.blocked || root.clientWidth === 0 || root.clientHeight === 0) return;
    const topIndex = Math.max(0, Math.min(rows.length - 1, Math.floor(root.scrollTop / cellHeight)));
    const anchor = selectedPathAnchor.current;
    const trustedAnchor = anchor && anchor.context === projectionContext && anchor.receipt === loaded.receipt && anchor.intent === userIntent.current;
    if (anchor && !trustedAnchor) selectedPathAnchor.current = null;
    const selectedIndex = trustedAnchor ? rows.findIndex(row => row.viewRowKey === anchor.rowKey) : -1;
    const index = selectedIndex >= 0 ? selectedIndex : topIndex;
    const row = rows[index];
    const byKey = new Map(rows.map(entry => [entry.viewRowKey, entry]));
    const ancestors: string[] = [];
    let parent = row?.parentViewRowKey;
    while (parent) { ancestors.push(parent); parent = byKey.get(parent)?.parentViewRowKey ?? null; }
    bookmark.current = { context: projectionContext, presentation, receipt: loaded.receipt, intent: userIntent.current,
      rowKey: row?.viewRowKey ?? null, canonicalTaskId: row?.canonicalTaskId ?? null, ancestors,
      offset: root.scrollTop - index * cellHeight, date: axis.start + root.scrollLeft / pixelsPerDay };
  }, [source, axis, loaded, props.active, props.blocked, rows, cellHeight, projectionContext, presentation, pixelsPerDay]);

  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root || !source || !projection || !axis || !props.active || props.blocked) return;
    const previous = bookmark.current;
    // Locale/density changes reuse the same verified source. A new GET
    // receipt must additionally retain its original request's input generation.
    const currentIntent = previous?.receipt === loaded?.receipt || loaded?.intent === userIntent.current;
    if (previous?.context === projectionContext && previous.presentation !== presentation &&
        currentIntent && previous.intent === userIntent.current) {
      let index = rows.findIndex(row => row.viewRowKey === previous.rowKey);
      if (index < 0 && previous.canonicalTaskId) index = rows.findIndex(row => row.canonicalTaskId === previous.canonicalTaskId);
      for (const ancestor of previous.ancestors) {
        if (index >= 0) break;
        index = rows.findIndex(row => row.viewRowKey === ancestor);
      }
      // Reinterpret the original Task/path and date against fresh geometry;
      // deleted branches may clamp naturally rather than reopening stale rows.
      root.scrollLeft = Math.max(0, (previous.date - axis.start) * pixelsPerDay);
      if (index >= 0) root.scrollTop = Math.max(0, previous.densityAnchor === undefined
        ? index * cellHeight + Math.min(cellHeight - 1, previous.offset)
        : headerHeight + (index + 0.5) * cellHeight - previous.densityAnchor);
    } else if (previous?.context !== projectionContext && currentIntent) {
      root.scrollLeft = axis.left;
      const id = props.selectedTaskIds[0];
      const index = rows.findIndex(row => row.canonicalTaskId === id);
      if (index >= 0) {
        const top = headerHeight + index * cellHeight;
        if (top < root.scrollTop + headerHeight || top + cellHeight > root.scrollTop + root.clientHeight) root.scrollTop = Math.max(0, top - headerHeight);
      }
    }
    captureBookmark(root);
  }, [source, projection, axis, rows, projectionContext, presentation, loaded?.intent, loaded?.receipt, props.active, props.blocked, props.selectedTaskIds, cellHeight, pixelsPerDay, headerHeight, captureBookmark]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const captureDensity = (event: Event) => {
      captureBookmark(root);
      const previous = bookmark.current;
      if (!previous || !rows.length) return;
      const pointerY = (event as CustomEvent<{ pointerY: number | null }>).detail?.pointerY;
      const localY = pointerY === null || pointerY === undefined ? root.clientHeight / 2 : pointerY - root.getBoundingClientRect().top;
      const index = Math.max(0, Math.min(rows.length - 1, Math.floor((root.scrollTop + localY - headerHeight) / cellHeight)));
      const row = rows[index];
      bookmark.current = { ...previous, rowKey: row.viewRowKey, canonicalTaskId: row.canonicalTaskId,
        densityAnchor: headerHeight + (index + 0.5) * cellHeight - root.scrollTop };
    };
    root.addEventListener("project-gantt-density", captureDensity);
    return () => root.removeEventListener("project-gantt-density", captureDensity);
  });

  const navigateRow = (index: number) => {
    const root = scroller.current;
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!root || !row) return;
    focusRow.current = row.viewRowKey;
    const logicalIndex = rows.indexOf(row);
    const top = headerHeight + logicalIndex * cellHeight;
    if (top < root.scrollTop + headerHeight || top + cellHeight > root.scrollTop + root.clientHeight) root.scrollTop = Math.max(0, top - headerHeight);
    setViewport({ top: root.scrollTop, left: root.scrollLeft, height: root.clientHeight, width: root.clientWidth });
    // #880/#899: roving keyboard navigation must retain the original Task
    // information control even though single click now belongs to the separate
    // selection button. Group rows still focus their expand/collapse control.
    const intent = userIntent.current;
    requestAnimationFrame(() => {
      if (!root.isConnected || intent !== userIntent.current) return;
      const currentRow = root.querySelector<HTMLElement>(`[data-view-row-key="${CSS.escape(row.viewRowKey)}"]`);
      const preferred = row.kind === "task"
        ? currentRow?.querySelector<HTMLButtonElement>("button[data-schedule-task-open]:not(:disabled)")
        : null;
      const target = preferred ?? currentRow?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      target?.focus({ preventScroll: true });
    });
  };

  const errorMessage = requestState?.key === sourceKey && requestState.error ? t(requestState.error)
    : projectionResult.error ? t("View 데이터를 확인할 수 없습니다. 최신 일정을 확인한 뒤 다시 조회해 주세요.") : null;
  const groupDescription = (row: ScheduleViewRow) => `${row.label} · ${row.start ? formatLocaleDateOnly(row.start, formatLocale) : t("미산정")} ~ ${row.end ? formatLocaleDateOnly(row.end, formatLocale) : t("미산정")} · ${row.taskCount ? t("{count}개 작업", { count: row.taskCount }) : t("하위 작업 없음")}`;
  const tooltipRow = infoTooltip?.kind === "group" ? rows.find(row => row.viewRowKey === infoTooltip.key) : undefined;
  const infoTooltipText = infoTooltip?.kind === "error" ? errorMessage : tooltipRow ? groupDescription(tooltipRow) : undefined;

  const status = <div className="project-schedule-view-status">
      <span role="status" title={projection ? `${t("조회 전용")}${t(" · 고유 작업 {count}개 · 표시 작업 행 {rows}개", { count: projection.uniqueTaskCount, rows: projection.taskRowCount })}` : t("조회 전용")}>{t("조회 전용")}{projection ? t(" · 고유 작업 {count}개 · 표시 작업 행 {rows}개", { count: projection.uniqueTaskCount, rows: projection.taskRowCount }) : ""}</span>
      {view === "resource" && projection?.diagnostics.summaryAssignmentIds.length ? <span className="project-schedule-view-diagnostic">{t("Summary 직접 배정은 WBS 작업 정보에서 확인하며 하위 작업에 자동 배정하지 않습니다.")}</span> : null}
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={props.blocked}>{t("다시 조회")}</button>
      {errorMessage ? <span role="alert" className="project-schedule-view-error"><button type="button" className="project-schedule-view-message" title={errorMessage}
        onMouseEnter={event => showInfoTooltip(event.currentTarget, "error")} onMouseLeave={() => setInfoTooltip(null)}
        onFocus={event => showInfoTooltip(event.currentTarget, "error")} onBlur={() => setInfoTooltip(null)}
        onKeyDown={event => { if (event.key === "Escape") setInfoTooltip(null); }}>{errorMessage}</button></span>
        : !source ? <span role="status">{t("View 데이터를 불러오는 중…")}</span> : null}
      {projection && !axis ? <span role="status">{t("일정 축을 확인하는 중…")}</span> : null}
    </div>;

  const cellValue = (column: IColumnConfig, task: Readonly<ProjectTaskDto> | null | undefined) => {
    if (!task) return "";
    if (column.id === "externalId") return task.externalId || "—";
    if (column.id === "projectDuration") return task.duration === null ? "—" : new Intl.NumberFormat(formatLocale).format(task.duration);
    if (["projectStart", "baselineStart", "baselineEnd"].includes(String(column.id))) {
      const date = column.id === "projectStart" ? task.start : column.id === "baselineStart" ? task.baselineStart : task.baselineEnd;
      return date ? formatLocaleDateOnly(date, formatLocale) : "—";
    }
    if (column.id === "milestoneStage") {
      const milestoneId = task.membership?.effectiveMilestoneTaskId;
      return props.tasks.find(candidate => candidate.taskId === milestoneId)?.name ?? t("미지정");
    }
    return "";
  };

  return <section className="project-schedule-view" data-schedule-view={view} aria-label={t("일정 조회 View")}>
    {props.statusContainer ? createPortal(status, props.statusContainer) : status}
    <div ref={scroller} className="project-schedule-view-scroll" data-schedule-view-scroll data-schedule-view-body
      style={{ minWidth: Math.max(720, columnWidth + 100) }}
      aria-busy={!projection || !axis} data-ready={Boolean(projection && axis)} data-logical-row-count={rows.length} data-visible-row-count={visible.length}
      onScroll={event => { setInfoTooltip(null); setScaleTooltip(null); const root = event.currentTarget; captureBookmark(root); setViewport({ top: root.scrollTop, left: root.scrollLeft, height: root.clientHeight, width: root.clientWidth }); }}
      onWheelCapture={event => { if (!event.ctrlKey || event.altKey || event.metaKey) userIntent.current++; }} onPointerDownCapture={() => { userIntent.current++; }}
      onKeyDown={event => {
        userIntent.current++;
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-view-row-key]") : null;
        const index = rows.findIndex(row => row.viewRowKey === target?.dataset.viewRowKey);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && !event.altKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault(); event.stopPropagation();
          navigateRow(event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, index + (event.key === "ArrowUp" ? -1 : 1)));
          return;
        }
        const row = rows[index];
        if (row?.kind === "group" && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          setCollapsed(current => { const next = new Set(current); if (event.key === "ArrowLeft") next.add(row.viewRowKey); else next.delete(row.viewRowKey); return next; });
          return;
        }
        if ((event.ctrlKey || event.metaKey) && ["x", "v", "d"].includes(event.key.toLowerCase()) || ["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); } }}
      onContextMenu={event => event.preventDefault()}
      role="treegrid" aria-readonly="true" aria-label={t("일정 조회 Grid와 차트")} aria-rowcount={rows.length + 1} aria-colcount={gridColumns.length + 1} tabIndex={0}>
      {projection && axis ? <div className="project-schedule-view-canvas" style={{ width: gridWidth + chartWidth, height: headerHeight + rows.length * cellHeight }}>
        <div className="project-schedule-view-header" role="row" style={{ height: headerHeight }}>
          <div className="project-schedule-view-grid" style={{ width: gridWidth, height: headerHeight }}>
            {gridColumns.map(column => <div key={column.id} role="columnheader" data-column-id={column.id}
              className="project-schedule-view-cell" style={{ width: column.width, textAlign: column.align ?? "start", transform: `translateX(${-gridOffset}px)` }}
              title={ganttColumnHeader(column.id ?? "", locale)} aria-label={ganttColumnHeader(column.id ?? "", locale)}
              aria-disabled={column.id === "add-task" || undefined}>{column.id === "add-task" ? null : ganttColumnHeader(column.id ?? "", locale) ?? ""}</div>)}
          </div>
          <div role="columnheader" aria-label={t("일정 축")} className="project-schedule-view-axis" style={{ left: gridWidth, width: chartWidth, height: headerHeight }}>
            {[scaleCells.upper, scaleCells.lower].map((cells, tier) => <div key={tier} className="project-schedule-view-scale-row" style={{ top: tier * headerHeight / 2, height: headerHeight / 2 }}>
              {cells.map(cell => <span key={cell.key} tabIndex={0} aria-label={cell.tooltip} title={cell.tooltip}
                onMouseEnter={event => showScaleTooltip(event.currentTarget, cell.date, tier)} onMouseLeave={() => setScaleTooltip(null)}
                onFocus={event => showScaleTooltip(event.currentTarget, cell.date, tier)} onBlur={() => setScaleTooltip(null)}
                onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setScaleTooltip(null); } }}
                data-scale-date={cell.date} data-non-working={cell.nonWorking || undefined}
                style={{ left: cell.left, width: cell.width }}>{cell.label}</span>)}
            </div>)}
          </div>
        </div>
        {scaleMode === "day" ? <div className="project-schedule-view-holidays" aria-hidden="true"
          style={{ left: gridWidth, top: headerHeight, width: chartWidth, height: rows.length * cellHeight }}>
          {scaleCells.lower.filter(cell => cell.nonWorking).map(cell => <span key={cell.key} style={{ left: cell.left, width: cell.width }} />)}
        </div> : null}
        {visible.map((row, offset) => {
          const task = row.task;
          const status = task ? task.status ?? taskStatusFromProgress(task.progress) : null;
          const statusLabel = status === "completed" ? t("완료") : status === "in_progress" ? t("진행 중") : t("시작 전");
          const selected = row.canonicalTaskId !== null && props.selectedTaskIds.includes(row.canonicalTaskId);
          const barLeft = row.start ? (dateOrdinal(row.start) - axis.start) * pixelsPerDay : null;
          const barWidth = row.start && row.end ? Math.max(2, (dateOrdinal(row.end) - dateOrdinal(row.start) + 1) * pixelsPerDay) : 0;
          return <div key={row.viewRowKey} role="row" aria-rowindex={startRow + offset + 2} aria-level={row.depth + 1}
            aria-expanded={row.kind === "group" ? !collapsed.has(row.viewRowKey) : undefined} aria-selected={row.kind === "task" ? selected : undefined}
            data-task-completed={status === "completed" || undefined} data-view-row-key={row.viewRowKey} data-canonical-task-id={row.canonicalTaskId ?? undefined} data-view-row-kind={row.kind} data-view-entity-id={row.entityId} data-view-group-kind={row.groupKind}
            className={`project-schedule-view-row ${row.kind === "group" ? "project-schedule-view-group" : ""}`}
            style={{ top: headerHeight + (startRow + offset) * cellHeight, height: cellHeight }}>
            <div className="project-schedule-view-grid" data-schedule-view-grid-cell data-schedule-view-body style={{ width: gridWidth }}
              onClick={row.kind === "task" ? () => selectTaskRow(row) : undefined}
              onDoubleClick={row.kind === "task" ? () => { if (row.canonicalTaskId) openTask(row.canonicalTaskId); } : undefined}>
              {gridColumns.map(column => <div key={column.id} role="gridcell" data-column-id={column.id}
                className={`project-schedule-view-cell ${column.id === "text" ? "project-schedule-view-name" : ""}`}
                style={{ width: column.width, textAlign: column.align ?? "start", transform: `translateX(${-gridOffset}px)`, paddingInlineStart: column.id === "text" ? 8 + row.depth * 16 : undefined }}>
              {column.id === "text" ? <>
              {row.kind === "group" ? <button type="button" title={groupDescription(row)} aria-label={groupDescription(row)} aria-expanded={!collapsed.has(row.viewRowKey)}
                onMouseEnter={event => showInfoTooltip(event.currentTarget, "group", row.viewRowKey)} onMouseLeave={() => setInfoTooltip(null)}
                onFocus={event => showInfoTooltip(event.currentTarget, "group", row.viewRowKey)} onBlur={() => setInfoTooltip(null)}
                onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setInfoTooltip(null); } }}
                onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(row.viewRowKey)) next.delete(row.viewRowKey); else next.add(row.viewRowKey); return next; })}>
                <span aria-hidden="true">{collapsed.has(row.viewRowKey) ? "▸" : "▾"}</span> {row.label}{row.active === false ? ` · ${t("비활성")}` : ""}{row.managementUnit === "fleet" ? ` (${row.quantity})` : ""} <small>{row.taskCount ? t("{count}개 작업", { count: row.taskCount }) : t("하위 작업 없음")}</small>
              </button> : <>
                <button type="button" disabled={props.blocked} title={row.label} aria-label={`${t("선택")}: ${row.label}`}
                  onFocus={() => { focusRow.current = row.viewRowKey; }}><span className="project-schedule-view-task-name">{row.label}</span><small>{statusLabel}</small></button>
                <button type="button" className="project-schedule-view-info" data-schedule-task-open disabled={props.blocked}
                  title={t("작업 정보 열기: {name}", { name: row.label })} aria-label={t("작업 정보 열기: {name}", { name: row.label })}
                  onFocus={() => { focusRow.current = row.viewRowKey; }}
                  onClick={event => { event.stopPropagation(); if (row.canonicalTaskId) openTask(row.canonicalTaskId); }}
                  onDoubleClick={event => event.stopPropagation()}><span aria-hidden="true">ⓘ</span></button>
              </>}
              </> : column.id === "copySelection" && task ? <span className="project-schedule-view-selection" role="checkbox" aria-checked={selected} aria-readonly="true" aria-label={t("선택")} ><span aria-hidden="true">{selected ? "✓" : ""}</span></span> : <span title={cellValue(column, task)}>{cellValue(column, task)}</span>}
              </div>)}
            </div>
            <div role="gridcell" className="project-schedule-view-chart" data-schedule-view-chart-cell data-schedule-view-body data-axis-start={axis.start} style={{ left: gridWidth, width: chartWidth, backgroundSize: `${cellWidth}px 100%` }}>
              {barLeft !== null && barWidth > 0 ? row.kind === "task" && task ? <button type="button" className="project-schedule-view-bar" disabled={props.blocked}
                title={`${task.name} · ${statusLabel} · ${task.start ?? "—"} ~ ${task.end ?? "—"} · ${task.progress === null ? t("미산정") : `${task.progress}%`}`} data-task-status={status} aria-label={`${statusLabel} · ${t("작업 차트 정보: {name}, {start} ~ {end}, {progress}", { name: task.name, start: task.start, end: task.end, progress: task.progress === null ? t("미산정") : `${task.progress}%` })}`}
                style={{ left: barLeft, width: barWidth, top: 3, height: cellHeight - 7 }} onFocus={() => { focusRow.current = row.viewRowKey; }} onClick={() => openTask(task.taskId)}>
                <span aria-hidden="true" className="project-schedule-view-progress" style={{ width: `${Math.min(100, Math.max(0, task.progress ?? 0))}%` }} /><span>{task.progress === null ? t("미산정") : `${task.progress}%`}</span>
              </button> : <span className="project-schedule-view-summary-bar" aria-label={t("View 요약 범위")} style={{ left: barLeft, width: barWidth, top: 3 + (cellHeight - 7) * 0.2, height: (cellHeight - 7) * 0.6 }}
                title={groupDescription(row)} onMouseEnter={event => showInfoTooltip(event.currentTarget, "group", row.viewRowKey)} onMouseLeave={() => setInfoTooltip(null)} /> : <span className="project-schedule-view-no-date">{t("미산정")}</span>}
            </div>
          </div>;
        })}
        {!rows.length ? <p className="project-schedule-view-empty">{t("하위 작업 없음")}</p> : null}
      </div> : retainedGeometry ? <div className="project-schedule-view-canvas" data-pending-view-geometry aria-hidden="true" inert
        style={{ width: gridWidth + retainedGeometry.chartWidth, height: headerHeight + retainedGeometry.rowCount * cellHeight }} /> : null}
      {columnWidth > gridWidth ? <div className="project-schedule-view-grid-scrollbar" data-schedule-view-grid-scroll
        style={{ width: gridWidth }} onScroll={event => setGridScrollLeft(event.currentTarget.scrollLeft)}
        aria-label={t("작업")} tabIndex={0}><div style={{ width: columnWidth, height: 1 }} /></div> : null}
    </div>
    {overlayHost && infoTooltip && infoTooltipText ? createPortal(<div className="project-schedule-view-scale-tooltip" role="tooltip"
      style={{ left: infoTooltip.left, top: infoTooltip.top }}>{infoTooltipText}</div>, overlayHost) : null}
    {overlayHost && scaleTooltip && scaleTooltipText ? createPortal(<div className="project-schedule-view-scale-tooltip" role="tooltip"
      style={{ left: scaleTooltip.left, top: scaleTooltip.top }}>{scaleTooltipText}</div>, overlayHost) : null}
  </section>;
}
