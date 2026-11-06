"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IApi } from "@svar-ui/react-gantt";
import type { ProjectTaskDto } from "@/contracts/projects";
import type { ScheduleViewSourceResponse } from "@/contracts/schedule-views";
import { taskStatusFromProgress } from "@/domain/task-status";
import { displayName } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import { projectScheduleView } from "./schedule-view-projection";
import { GANTT_CELL_WIDTH, type GanttScaleMode } from "./timeline-range";
import "./schedule-view-panel.css";

const DAY = 86_400_000;
const dateOrdinal = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const localOrdinal = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;

type Source = ScheduleViewSourceResponse["data"];
type Props = {
  view: "resource" | "equipment";
  projectPublicId?: string;
  projectRevision: number;
  tasks: readonly ProjectTaskDto[];
  visibleTaskIds: readonly string[];
  scaleMode: GanttScaleMode;
  cellHeight: number;
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
  const sourceKey = `${projectPublicId}:${projectRevision}:${view}:${props.active}:${props.blocked}:${refresh}`;
  const [loaded, setLoaded] = useState<{ key: string; data?: Source; error?: string; intent?: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, left: 0, height: 500, width: 1000 });
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [axis, setAxis] = useState<{ start: number; width: number; grid: number; left: number } | null>(null);
  const focusRow = useRef<string | null>(null);
  const horizontalInitialized = useRef(false);
  const requestSequence = useRef(0);
  const userIntent = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestSequence.current;
    const intent = userIntent.current;
    const load = async () => {
      try {
        // A hidden workspace or open Editor cannot validate an active View.
        if (!props.active || props.blocked) { if (!controller.signal.aborted) setLoaded({ key: sourceKey }); return; }
        setLoaded({ key: sourceKey });
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
        if (!controller.signal.aborted && request === requestSequence.current) setLoaded({ key: sourceKey, data, intent });
      } catch {
        if (!controller.signal.aborted && request === requestSequence.current) setLoaded({ key: sourceKey, error: "View 데이터를 확인할 수 없습니다. 최신 일정을 확인한 뒤 다시 조회해 주세요." });
      }
    };
    void load();
    return () => controller.abort();
  }, [projectPublicId, projectRevision, sourceKey, props.active, props.blocked]);

  useEffect(() => {
    const refreshSource = () => { if (document.visibilityState === "visible") setRefresh(value => value + 1); };
    window.addEventListener("focus", refreshSource);
    return () => window.removeEventListener("focus", refreshSource);
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
        setAxis({ start: localOrdinal(start), width, grid: typeof state.gridWidth === "number" ? state.gridWidth : 480, left: typeof state.scrollLeft === "number" ? state.scrollLeft : 0 });
      }
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [readApi, scaleMode, projectRevision]);

  const source = loaded?.key === sourceKey ? loaded.data : undefined;
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

  useLayoutEffect(() => {
    if (!projection || !axis || horizontalInitialized.current) return;
    const frame = requestAnimationFrame(() => {
      const root = scroller.current;
      if (!root || horizontalInitialized.current) return;
      horizontalInitialized.current = true;
      root.scrollLeft = axis.left;
    });
    return () => cancelAnimationFrame(frame);
  }, [axis, projection]);


  const rows = useMemo(() => {
    const hidden = new Set<string>();
    return (projection?.rows ?? []).filter(row => {
      if (row.parentViewRowKey && (collapsed.has(row.parentViewRowKey) || hidden.has(row.parentViewRowKey))) {
        hidden.add(row.viewRowKey); return false;
      }
      return true;
    });
  }, [projection, collapsed]);
  const startRow = Math.max(0, Math.floor(Math.max(0, viewport.top - 64) / cellHeight) - 4);
  const endRow = Math.min(rows.length, Math.ceil((viewport.top + viewport.height) / cellHeight) + 4);
  const visible = rows.slice(startRow, endRow);
  const unitDays = scaleMode === "day" ? 1 : 7;
  const cellWidth = GANTT_CELL_WIDTH[scaleMode];
  // Keep the date chart reachable beside the sticky Grid on narrow screens.
  const gridWidth = Math.min(axis?.grid ?? 480, Math.max(120, Math.floor(viewport.width * 0.45)));
  const pixelsPerDay = cellWidth / unitDays;
  const chartWidth = axis?.width ?? 0;
  const firstTick = Math.max(0, Math.floor((viewport.left - gridWidth) / cellWidth) - 1);
  const lastTick = Math.min(Math.ceil(chartWidth / cellWidth), firstTick + Math.ceil(viewport.width / cellWidth) + 4);
  const openTask = (id: string) => {
    if (props.blocked || !source || !props.tasks.some(task => task.taskId === id && task.type === "task")) return;
    props.onSelect(id); props.onOpenTask(id);
  };

  useEffect(() => {
    const root = scroller.current;
    if (!root || !source || !projection || !axis || loaded?.intent !== userIntent.current) return;
    const id = props.selectedTaskIds[0];
    const selected = focusRow.current ? rows.findIndex(row => row.viewRowKey === focusRow.current && row.canonicalTaskId === id) : -1;
    const index = selected >= 0 ? selected : rows.findIndex(row => row.canonicalTaskId === id);
    if (index < 0) return;
    const top = 64 + index * cellHeight;
    if (top < root.scrollTop + 64 || top + cellHeight > root.scrollTop + root.clientHeight) root.scrollTop = Math.max(0, top - 64);
  }, [source, projection, rows, props.selectedTaskIds, cellHeight, loaded?.intent, axis]);

  const navigateRow = (index: number) => {
    const root = scroller.current;
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!root || !row) return;
    focusRow.current = row.viewRowKey;
    const logicalIndex = rows.indexOf(row);
    const top = 64 + logicalIndex * cellHeight;
    if (top < root.scrollTop + 64 || top + cellHeight > root.scrollTop + root.clientHeight) root.scrollTop = Math.max(0, top - 64);
    setViewport({ top: root.scrollTop, left: root.scrollLeft, height: root.clientHeight, width: root.clientWidth });
    requestAnimationFrame(() => root.querySelector<HTMLElement>(`[data-view-row-key="${CSS.escape(row.viewRowKey)}"] button:not(:disabled)`)?.focus({ preventScroll: true }));
  };

  return <section className="project-schedule-view" data-schedule-view={view} aria-label={t("일정 조회 View")}>
    <div className="project-schedule-view-status">
      <span role="status">{t("조회 전용")}{projection ? t(" · 고유 작업 {count}개 · 표시 작업 행 {rows}개", { count: projection.uniqueTaskCount, rows: projection.taskRowCount }) : ""}</span>
      {view === "resource" && projection?.diagnostics.summaryAssignmentIds.length ? <span>{t("Summary 직접 배정은 WBS 작업 정보에서 확인하며 하위 작업에 자동 배정하지 않습니다.")}</span> : null}
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={props.blocked}>{t("다시 조회")}</button>
    </div>
    {loaded?.key === sourceKey && loaded.error ? <div role="alert">{t(loaded.error)}</div> : !source ? <p role="status">{t("View 데이터를 불러오는 중…")}</p> : null}
    {projectionResult.error ? <div role="alert">{t("View 데이터를 확인할 수 없습니다. 최신 일정을 확인한 뒤 다시 조회해 주세요.")}</div> : null}
    {projection && !axis ? <p role="status">{t("일정 축을 확인하는 중…")}</p> : null}
    <div ref={scroller} className="project-schedule-view-scroll" data-schedule-view-scroll
      data-ready={Boolean(projection && axis)} data-logical-row-count={rows.length} data-visible-row-count={visible.length}
      onScroll={event => { const root = event.currentTarget; setViewport({ top: root.scrollTop, left: root.scrollLeft, height: root.clientHeight, width: root.clientWidth }); }}
      onWheelCapture={() => { userIntent.current++; }} onPointerDownCapture={() => { userIntent.current++; }}
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
      role="treegrid" aria-readonly="true" aria-label={t("일정 조회 Grid와 차트")} aria-rowcount={rows.length + 1} aria-colcount={2} tabIndex={0}>
      {projection && axis ? <div className="project-schedule-view-canvas" style={{ width: gridWidth + chartWidth, height: 64 + rows.length * cellHeight }}>
        <div className="project-schedule-view-header" role="row" style={{ height: 64 }}>
          <div className="project-schedule-view-name" role="columnheader" style={{ width: gridWidth }}>{t("작업")} / {t("가상 계층")}</div>
          <div role="columnheader" aria-label={t("일정 축")} className="project-schedule-view-axis" style={{ left: gridWidth, width: chartWidth }}>
            {Array.from({ length: Math.max(0, lastTick - firstTick) }, (_, offset) => {
              const tick = firstTick + offset;
              const date = new Date((axis.start + tick * unitDays) * DAY);
              return <span key={tick} style={{ left: tick * cellWidth, width: cellWidth }}><span>{date.toLocaleDateString(formatLocale, { month: "short", timeZone: "UTC" })}</span><span>{date.toLocaleDateString(formatLocale, { day: "numeric", timeZone: "UTC" })}</span></span>;
            })}
          </div>
        </div>
        {visible.map((row, offset) => {
          const task = row.task;
          const status = task ? task.status ?? taskStatusFromProgress(task.progress) : null;
          const statusLabel = status === "completed" ? t("완료") : status === "in_progress" ? t("진행 중") : t("시작 전");
          const selected = row.canonicalTaskId !== null && props.selectedTaskIds.includes(row.canonicalTaskId);
          const barLeft = row.start ? (dateOrdinal(row.start) - axis.start) * pixelsPerDay : null;
          const barWidth = row.start && row.end ? Math.max(2, (dateOrdinal(row.end) - dateOrdinal(row.start) + 1) * pixelsPerDay) : 0;
          return <div key={row.viewRowKey} role="row" aria-rowindex={startRow + offset + 2} aria-level={row.depth + 1}
            aria-expanded={row.kind === "group" ? !collapsed.has(row.viewRowKey) : undefined} aria-selected={row.kind === "task" ? selected : undefined}
            data-view-row-key={row.viewRowKey} data-canonical-task-id={row.canonicalTaskId ?? undefined} data-view-row-kind={row.kind} data-view-entity-id={row.entityId} data-view-group-kind={row.groupKind}
            className={`project-schedule-view-row ${row.kind === "group" ? "project-schedule-view-group" : ""}`}
            style={{ top: 64 + (startRow + offset) * cellHeight, height: cellHeight }}>
            <div role="gridcell" className="project-schedule-view-name" data-schedule-view-grid-cell style={{ width: gridWidth, paddingInlineStart: 8 + row.depth * 16 }}>
              {row.kind === "group" ? <button type="button" aria-expanded={!collapsed.has(row.viewRowKey)} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(row.viewRowKey)) next.delete(row.viewRowKey); else next.add(row.viewRowKey); return next; })}>
                <span aria-hidden="true">{collapsed.has(row.viewRowKey) ? "▸" : "▾"}</span> {row.label}{row.active === false ? ` · ${t("비활성")}` : ""}{row.managementUnit === "fleet" ? ` (${row.quantity})` : ""} <small>{row.taskCount ? t("{count}개 작업", { count: row.taskCount }) : t("하위 작업 없음")}</small>
              </button> : <button type="button" disabled={props.blocked} title={row.label} aria-label={t("작업 정보 열기: {name}", { name: row.label })}
                onFocus={() => { focusRow.current = row.viewRowKey; }} onClick={() => row.canonicalTaskId && openTask(row.canonicalTaskId)}>{row.label}<small>{statusLabel}</small></button>}
            </div>
            <div role="gridcell" className="project-schedule-view-chart" data-schedule-view-chart-cell data-axis-start={axis.start} style={{ left: gridWidth, width: chartWidth, backgroundSize: `${cellWidth}px 100%` }}>
              {barLeft !== null && barWidth > 0 ? row.kind === "task" && task ? <button type="button" className="project-schedule-view-bar" disabled={props.blocked}
                data-task-status={status} aria-label={`${statusLabel} · ${t("작업 차트 정보: {name}, {start} ~ {end}, {progress}", { name: task.name, start: task.start, end: task.end, progress: task.progress === null ? t("미산정") : `${task.progress}%` })}`}
                style={{ left: barLeft, width: barWidth }} onFocus={() => { focusRow.current = row.viewRowKey; }} onClick={() => openTask(task.taskId)}>
                <span aria-hidden="true" className="project-schedule-view-progress" style={{ width: `${Math.min(100, Math.max(0, task.progress ?? 0))}%` }} /><span>{task.progress === null ? t("미산정") : `${task.progress}%`}</span>
              </button> : <span className="project-schedule-view-summary-bar" aria-label={t("View 요약 범위")} style={{ left: barLeft, width: barWidth }} /> : <span className="project-schedule-view-no-date">{t("미산정")}</span>}
            </div>
          </div>;
        })}
        {!rows.length ? <p className="project-schedule-view-empty">{t("하위 작업 없음")}</p> : null}
      </div> : null}
    </div>
  </section>;
}
