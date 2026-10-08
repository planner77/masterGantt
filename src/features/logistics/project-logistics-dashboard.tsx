"use client";

import { useEffect, useState, useId, useRef, type KeyboardEvent } from "react";
import type { LogisticsDashboardDto } from "@/contracts/logistics-dashboard";
import type { ProjectTaskDto } from "@/contracts/projects";
import { ProjectMilestoneStageTable } from "../milestones/project-milestone-stage-table";
import { conversionLabel, dashboardStageValid, projectDateAt } from "../milestones/milestone-dashboard-model";
import { parseDateOnly } from "@/domain/scheduling/date-only";
import styles from "./project-logistics-dashboard.module.css";

export interface ProjectLogisticsDashboardProps {
  tasks?: readonly ProjectTaskDto[];
  active?: boolean;
  busy?: boolean;
  onStageOpen?: (taskId: string, tab?: "task" | "memberships") => void;
  onStageSchedule?: (taskIds: string[]) => void;
  publicId: string;
  revision: number;
  onNavigateToSchedule?: (filter: {
    taskIds?: string[];
    processIds?: string[];
    equipmentIds?: string[];
    systemIds?: string[];
  }) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isDashboard(value: unknown): value is LogisticsDashboardDto {
  if (!isRecord(value)) return false;
  try {
    parseDateOnly(value.asOfDate);
  } catch {
    return false;
  }
  const number = (item: unknown) => typeof item === "number" && Number.isFinite(item);
  const nullableNumber = (item: unknown) => item === null || number(item);
  const strings = (item: unknown) => Array.isArray(item) && item.every((entry) => typeof entry === "string");
  const nullableString = (item: unknown) => item === null || typeof item === "string";
  const numericFields = (item: unknown, fields: string[]) => isRecord(item) && fields.every((field) => number(item[field]));
  const kpi = value.kpi;
  const effort = value.effort;
  const quality = value.quality;
  if (!number(value.projectRevision) || typeof value.asOfDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.asOfDate) || !number(value.horizonDays) || (value.systemView !== "direct" && value.systemView !== "coordination") || typeof value.activeOnly !== "boolean" || !strings(value.includedTaskIds)) return false;
  if (!numericFields(kpi, ["totalDuration", "taskCount", "overdueTaskCount", "milestoneTotalCount", "milestoneOverdueCount", "milestoneUpcomingCount"]) || !isRecord(kpi) || !nullableNumber(kpi.progressPercent) || !strings(kpi.overdueTaskIds) || !strings(kpi.milestoneOverdueIds) || !strings(kpi.milestoneUpcomingIds)) return false;
  if (!numericFields(effort, ["plannedMd", "unsetAllocationCount"]) || !isRecord(effort) || !nullableNumber(effort.plannedMm)) return false;
  if (value.milestoneStages !== undefined && (!isRecord(value.milestoneStages) || !strings(value.milestoneStages.milestoneTaskIds) || !Array.isArray(value.milestoneStages.rows) || !value.milestoneStages.rows.every(dashboardStageValid))) return false;
  if (!numericFields(quality, ["unlinkedLeafTaskCount", "equipmentWithoutPrimaryControllerCount", "equipmentWithoutOwnerCount", "systemsWithoutPrimaryPICount", "totalEquipmentMasterCount", "totalEquipmentQuantity"]) || !isRecord(quality) || !nullableNumber(quality.unlinkedLeafTaskPercent)) return false;
  if (!isRecord(value.breakdowns)) return false;
  for (const kind of ["processes", "equipment", "systems"]) {
    const rows = value.breakdowns[kind];
    if (!Array.isArray(rows) || !rows.every((row) => {
      if (!isRecord(row) || !["id", "code", "name"].every((field) => typeof row[field] === "string") || typeof row.active !== "boolean" || !numericFields(row, ["taskCount", "overdueTaskCount", "plannedMd"]) || !nullableNumber(row.progressPercent)) return false;
      if (kind === "equipment") return typeof row.equipmentType === "string" && number(row.quantity) && ["processName", "primaryControllerName", "ownerName"].every((field) => nullableString(row[field]));
      if (kind === "systems") return typeof row.systemType === "string" && typeof row.layer === "string" && nullableString(row.primaryPIName) && strings(row.taskIds);
      return true;
    })) return false;
  }
  return true;
}

type BreakdownTab = "processes" | "equipment" | "systems";

export function ProjectLogisticsDashboard({
  tasks = [], active = true, busy = false, onStageOpen, onStageSchedule,
  publicId,
  revision,
  onNavigateToSchedule,
}: ProjectLogisticsDashboardProps) {
  const [dashboard, setDashboard] = useState<LogisticsDashboardDto | null>(null);
  const [outcome, setOutcome] = useState<{ key: string | null; status: "loading" | "ready" | "error"; error?: string }>({ key: null, status: "loading" });

  // Filter state. Leave asOfDate empty for the first request so the server
  // derives the project-local date from the project timezone.
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [horizonDays, setHorizonDays] = useState<string>("14");
  const [systemView, setSystemView] = useState<"direct" | "coordination">("direct");
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<BreakdownTab>("processes");
  const [refreshKey, setRefreshKey] = useState(0);

  const asOfDateInputId = useId();
  const horizonDaysInputId = useId();
  const systemViewSelectId = useId();
  const activeOnlyCheckboxId = useId();

  const tabId = useId();
  const tabRefs = useRef<Partial<Record<BreakdownTab, HTMLButtonElement | null>>>({});
  const lastAttempt = useRef(0);
  const dayAttempt = useRef<string | null>(null), scheduledRefresh = useRef(false);
  const horizonNumber = Number(horizonDays);
  const horizonError = !horizonDays.trim() || !Number.isInteger(horizonNumber) || horizonNumber < 1 || horizonNumber > 90 ? "임박 기준은 1~90 사이의 정수로 입력해 주세요." : null;
  const requestKey = JSON.stringify([publicId, revision, asOfDate, horizonDays, systemView, activeOnly, refreshKey]);
  const ready = !horizonError && outcome.key === requestKey && outcome.status === "ready";
  const isLoading = !horizonError && (outcome.key !== requestKey || outcome.status === "loading");
  const error = outcome.key === requestKey && outcome.status === "error" ? outcome.error : null;

  function handleRefresh() {
    if (isLoading || horizonError) return;
    setRefreshKey((key) => key + 1);
  }
  function selectBreakdown(tab: BreakdownTab) {
    setActiveBreakdownTab(tab);
    tabRefs.current[tab]?.focus();
  }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, current: BreakdownTab) {
    const tabs: BreakdownTab[] = ["processes", "equipment", "systems"];
    const index = tabs.indexOf(current);
    const next = event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] : event.key === "ArrowLeft" ? tabs[(index + tabs.length - 1) % tabs.length] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2] : null;
    if (next) { event.preventDefault(); selectBreakdown(next); }
  }

  useEffect(() => {
    const controller = new AbortController();
    if (horizonError) return () => controller.abort();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setOutcome({ key: requestKey, status: "loading" });
      lastAttempt.current = Date.now();
      scheduledRefresh.current = false;
      const params = new URLSearchParams({ horizonDays: String(horizonNumber), systemView });
      if (asOfDate) params.set("asOfDate", asOfDate);
      if (activeOnly) params.set("activeOnly", "true");
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/dashboard?${params}`, { signal: controller.signal, credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error(`대시보드 조회 실패 (HTTP ${response.status})`);
        const json: unknown = await response.json();
        const data = isRecord(json) ? json.data : null;
        if (!isDashboard(data) || data.projectRevision !== revision || data.horizonDays !== horizonNumber || data.systemView !== systemView || data.activeOnly !== activeOnly || (asOfDate && data.asOfDate !== asOfDate)) throw new Error("대시보드 응답이 현재 조회 조건과 일치하지 않습니다. 다시 시도해 주세요.");
        if (controller.signal.aborted) return;
        setDashboard(data);
        setOutcome({ key: requestKey, status: "ready" });
      } catch (failure) {
        if (!controller.signal.aborted) setOutcome({ key: requestKey, status: "error", error: failure instanceof Error ? failure.message : "대시보드를 불러오는 도중 오류가 발생했습니다." });
      }
    })();
    return () => controller.abort();
  }, [publicId, asOfDate, horizonNumber, horizonError, systemView, activeOnly, revision, requestKey]);

  useEffect(() => {
    if (!active) return;
    const catchUp = () => {
      if (document.visibilityState !== "visible" || isLoading || scheduledRefresh.current) return;
      if (Date.now() - lastAttempt.current >= 30_000) { scheduledRefresh.current = true; setRefreshKey((key) => key + 1); }
    };
    const clock = window.setInterval(() => {
      if (document.visibilityState !== "visible" || asOfDate || !dashboard || isLoading || scheduledRefresh.current) return;
      const day = projectDateAt(dashboard.timezone);
      if (dashboard.asOfDate !== day && dayAttempt.current !== day) { dayAttempt.current = day; scheduledRefresh.current = true; setRefreshKey((key) => key + 1); }
    }, 60_000);
    window.addEventListener("focus", catchUp); document.addEventListener("visibilitychange", catchUp);
    return () => { window.clearInterval(clock); window.removeEventListener("focus", catchUp); document.removeEventListener("visibilitychange", catchUp); };
  }, [active, asOfDate, dashboard, isLoading]);

  const handleDrillDownToTasks = (taskIds: string[]) => {
    if (ready && onNavigateToSchedule) {
      onNavigateToSchedule({ taskIds });
    }
  };

  const handleDrillDownToProcess = (procId: string) => {
    if (ready && onNavigateToSchedule) {
      onNavigateToSchedule({ processIds: [procId] });
    }
  };

  const handleDrillDownToEquipment = (eqId: string) => {
    if (ready && onNavigateToSchedule) {
      onNavigateToSchedule({ equipmentIds: [eqId] });
    }
  };

  const handleDrillDownToSystem = (sysId: string, taskIds: string[]) => {
    if (ready && onNavigateToSchedule) {
      if (systemView === "coordination") {
        onNavigateToSchedule({ taskIds });
      } else {
        onNavigateToSchedule({ systemIds: [sysId] });
      }
    }
  };

  return (
    <div className={styles.dashboardContainer} data-testid="logistics-dashboard-view">
      {/* 1. 상단 필터 및 옵션 바 */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label htmlFor={asOfDateInputId} className={styles.filterLabel}>
            기준일 (As of)
          </label>
          <input
            id={asOfDateInputId}
            type="date"
            value={asOfDate || dashboard?.asOfDate || ""}
            onChange={(e) => setAsOfDate(e.target.value)}
            className={styles.filterInput}
          />
          {asOfDate ? <button type="button" className={styles.refreshButton} onClick={() => setAsOfDate("")}>자동 기준일</button> : null}
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor={horizonDaysInputId} className={styles.filterLabel}>
            임박 기준 (일)
          </label>
          <input
            id={horizonDaysInputId}
            type="number"
            min={1}
            max={90}
            value={horizonDays}
            onChange={(e) => setHorizonDays(e.target.value)}
            aria-invalid={Boolean(horizonError)}
            aria-describedby={horizonError ? `${horizonDaysInputId}-error` : undefined}
            className={styles.filterInput}
            style={{ width: "4.5rem" }}
          />
          {horizonError ? <p id={`${horizonDaysInputId}-error`} className={styles.fieldError} role="alert">{horizonError}</p> : null}
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor={systemViewSelectId} className={styles.filterLabel}>
            시스템 집계 범위
          </label>
          <select
            id={systemViewSelectId}
            value={systemView}
            onChange={(e) => setSystemView(e.target.value as "direct" | "coordination")}
            className={styles.filterSelect}
          >
            <option value="direct">직접 연결만 (Direct)</option>
            <option value="coordination">조율 범위 포함 (Coordination Roll-up)</option>
          </select>
        </div>

        <label htmlFor={activeOnlyCheckboxId} className={styles.filterCheckboxLabel}>
          <input
            id={activeOnlyCheckboxId}
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          활성 마스터만 보기
        </label>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading || Boolean(horizonError)}
          className={styles.refreshButton}
        >
          {isLoading ? "새로고침 중…" : error ? "다시 시도" : "새로고침"}
        </button>
      </div>

      {error && <div className={styles.errorNotice} role="alert">{error}</div>}

      {isLoading && (
        <div className={styles.loadingNotice} role="status">
          현재 조회 조건으로 물류 KPI 대시보드를 집계하는 중입니다…
        </div>
      )}

      {ready && dashboard && (
        <>
          <p className={styles.scopeNote}>현재 snapshot 평가일 {dashboard.asOfDate} · {dashboard.timezone} · 과거 상태 복원이 아닙니다. {conversionLabel(dashboard.effort.mdPerMm, dashboard.effort.mdPerMmSource)}</p>
          {/* 2. 핵심 KPI 카드 그리드 */}
          <div className={styles.kpiGrid}>
            {/* 카드 1: 기간 가중 진척률 */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <h4 className={styles.kpiTitle}>기간 가중 진척률</h4>
                <span className={styles.kpiBadge}>핵심 KPI</span>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>
                  {dashboard.kpi.progressPercent !== null
                    ? `${dashboard.kpi.progressPercent}%`
                    : "대상 없음"}
                </span>
                {dashboard.kpi.progressPercent !== null && (
                  <span className={styles.kpiUnit}>가중 평균</span>
                )}
              </div>
              {dashboard.kpi.progressPercent !== null && (
                <div className={styles.kpiProgressBar}>
                  <div
                    className={styles.kpiProgressFill}
                    style={{ width: `${Math.min(100, Math.max(0, dashboard.kpi.progressPercent))}%` }}
                  />
                </div>
              )}
              <div className={styles.kpiMetaRow}>
                <span>대상 작업 {dashboard.kpi.taskCount}개</span>
                <span>총 가중 기간 {dashboard.kpi.totalDuration}일</span>
              </div>
              <button
                type="button"
                className={styles.kpiActionBtn}
                onClick={() => handleDrillDownToTasks(dashboard.includedTaskIds)}
              >
                일정에서 전체 작업 보기
              </button>
            </div>

            {/* 카드 2: 미완료 지연 일반 작업 */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <h4 className={styles.kpiTitle}>미완료 지연 작업</h4>
                <span
                  className={styles.kpiBadge}
                  style={
                    dashboard.kpi.overdueTaskCount > 0
                      ? { backgroundColor: "#fee2e2", color: "#991b1b" }
                      : {}
                  }
                >
                  {dashboard.kpi.overdueTaskCount > 0 ? "주의 필요" : "정상 진행"}
                </span>
              </div>
              <div className={styles.kpiValueRow}>
                <span
                  className={`${styles.kpiValue} ${
                    dashboard.kpi.overdueTaskCount > 0 ? styles.kpiWarning : ""
                  }`}
                >
                  {dashboard.kpi.overdueTaskCount}
                </span>
                <span className={styles.kpiUnit}>건</span>
              </div>
              <div className={styles.kpiMetaRow}>
                <span>기준일 {dashboard.asOfDate} 이전 종료 미완료</span>
              </div>
              <button
                type="button"
                className={styles.kpiActionBtn}
                disabled={dashboard.kpi.overdueTaskCount === 0}
                onClick={() => handleDrillDownToTasks(dashboard.kpi.overdueTaskIds)}
              >
                지연 작업만 일정에서 보기
              </button>
            </div>

            {/* 카드 3: Milestone 경보 */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <h4 className={styles.kpiTitle}>Milestone 경보</h4>
                <span className={styles.kpiBadge}>주요 일정</span>
              </div>
              <div className={styles.kpiValueRow}>
                <span
                  className={`${styles.kpiValue} ${
                    dashboard.kpi.milestoneOverdueCount > 0 ? styles.kpiWarning : ""
                  }`}
                >
                  {dashboard.kpi.milestoneOverdueCount}
                </span>
                <span className={styles.kpiUnit}>건 지연</span>
                <span style={{ margin: "0 0.25rem", color: "#94a3b8" }}>/</span>
                <span
                  className={`${styles.kpiValue} ${
                    dashboard.kpi.milestoneUpcomingCount > 0 ? styles.kpiAlert : ""
                  }`}
                  style={{ fontSize: "1.5rem" }}
                >
                  {dashboard.kpi.milestoneUpcomingCount}
                </span>
                <span className={styles.kpiUnit}>건 임박</span>
              </div>
              <div className={styles.kpiMetaRow}>
                <span>총 Milestone {dashboard.kpi.milestoneTotalCount}개 중</span>
                <span>{dashboard.horizonDays}일 이내 임박</span>
              </div>
              <button
                type="button"
                className={styles.kpiActionBtn}
                disabled={
                  dashboard.kpi.milestoneOverdueCount === 0 &&
                  dashboard.kpi.milestoneUpcomingCount === 0
                }
                onClick={() =>
                  handleDrillDownToTasks([
                    ...dashboard.kpi.milestoneOverdueIds,
                    ...dashboard.kpi.milestoneUpcomingIds,
                  ])
                }
              >
                경보 Milestone 일정 보기
              </button>
            </div>

            {/* 카드 4: 보조 계획 투입 공수 */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <h4 className={styles.kpiTitle}>계획 투입 공수</h4>
                <span className={styles.kpiBadge}>자원 계획</span>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={styles.kpiValue}>{dashboard.effort.plannedMd}</span>
                <span className={styles.kpiUnit}>M/D</span>
                {dashboard.effort.plannedMm !== null && (
                  <>
                    <span style={{ margin: "0 0.25rem", color: "#94a3b8" }}>/</span>
                    <span className={styles.kpiValue} style={{ fontSize: "1.5rem" }}>
                      {dashboard.effort.plannedMm}
                    </span>
                    <span className={styles.kpiUnit}>M/M</span>
                  </>
                )}
                {dashboard.effort.plannedMm === null ? <span className={styles.kpiUnit}>— M/M · 환산 기준 미설정</span> : null}
              </div>
              <div className={styles.kpiMetaRow}>
                <span>투입률 미설정 {dashboard.effort.unsetAllocationCount}건</span>
                <span>단일 배정 dedup 집계</span>
              </div>
              <button
                type="button"
                className={styles.kpiActionBtn}
                onClick={() => handleDrillDownToTasks(dashboard.includedTaskIds)}
              >
                투입 작업 확인
              </button>
            </div>
          </div>

          {dashboard.milestoneStages ? <section className={styles.relatedStages} aria-labelledby={`${tabId}-stages`}>
            <h3 id={`${tabId}-stages`}>관련 Milestone — Milestone 전체 상태 기준</h3>
            <p className={styles.scopeNote}>물류 연결에 관련된 고유 Milestone입니다. Ready·소속 진척·원인은 전체 소속 작업과 직접 선행 Milestone 기준이며 위 물류 Task·진척·계획 M/D 범위를 확장하지 않습니다.</p>
            {dashboard.milestoneStages.rows.length ? <ProjectMilestoneStageTable rows={dashboard.milestoneStages.rows} tasks={tasks} enabled={ready && !busy} onOpenTask={onStageOpen} onSchedule={onStageSchedule} /> : <p>관련 Milestone가 없습니다.</p>}
          </section> : null}

          {/* 3. 데이터 품질 및 구성 진단 패널 */}
          <div className={styles.qualityPanel}>
            <div className={styles.qualityHeader}>
              <h4 className={styles.qualityTitle}>데이터 품질 및 마스터 구성 진단</h4>
              <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                설비 마스터 {dashboard.quality.totalEquipmentMasterCount}개 / 총 수량 {dashboard.quality.totalEquipmentQuantity}대
              </span>
            </div>
            <div className={styles.qualityGrid}>
              <div className={styles.qualityItem}>
                <span className={styles.qualityItemLabel}>물류 미연결 작업</span>
                <span
                  className={`${styles.qualityItemValue} ${
                    dashboard.quality.unlinkedLeafTaskCount > 0 ? styles.qualityItemWarn : ""
                  }`}
                >
                  {dashboard.quality.unlinkedLeafTaskCount}개
                  {dashboard.quality.unlinkedLeafTaskPercent !== null && (
                    <span style={{ fontSize: "0.8125rem", fontWeight: 400, marginLeft: "0.375rem" }}>
                      ({dashboard.quality.unlinkedLeafTaskPercent}%)
                    </span>
                  )}
                </span>
              </div>

              <div className={styles.qualityItem}>
                <span className={styles.qualityItemLabel}>주 제어기 미매핑 설비</span>
                <span
                  className={`${styles.qualityItemValue} ${
                    dashboard.quality.equipmentWithoutPrimaryControllerCount > 0
                      ? styles.qualityItemWarn
                      : ""
                  }`}
                >
                  {dashboard.quality.equipmentWithoutPrimaryControllerCount}개
                </span>
              </div>

              <div className={styles.qualityItem}>
                <span className={styles.qualityItemLabel}>주 담당자(Owner) 미지정 설비</span>
                <span
                  className={`${styles.qualityItemValue} ${
                    dashboard.quality.equipmentWithoutOwnerCount > 0 ? styles.qualityItemWarn : ""
                  }`}
                >
                  {dashboard.quality.equipmentWithoutOwnerCount}개
                </span>
              </div>

              <div className={styles.qualityItem}>
                <span className={styles.qualityItemLabel}>주 책임자(PI) 미지정 시스템</span>
                <span
                  className={`${styles.qualityItemValue} ${
                    dashboard.quality.systemsWithoutPrimaryPICount > 0 ? styles.qualityItemWarn : ""
                  }`}
                >
                  {dashboard.quality.systemsWithoutPrimaryPICount}개
                </span>
              </div>
            </div>
          </div>

          {/* 4. 세부 현황 표 (Breakdown Tables) */}
          <div className={styles.breakdownSection}>
            <div className={styles.breakdownTabs} role="tablist" aria-label="물류 세부 현황">
              <button
                type="button"
                className={`${styles.breakdownTabBtn} ${
                  activeBreakdownTab === "processes" ? styles.breakdownTabBtnActive : ""
                }`}
                role="tab"
                id={`${tabId}-tab-processes`}
                aria-controls={`${tabId}-panel-processes`}
                aria-selected={activeBreakdownTab === "processes"}
                tabIndex={activeBreakdownTab === "processes" ? 0 : -1}
                ref={(node) => { tabRefs.current.processes = node; }}
                onKeyDown={(event) => handleTabKey(event, "processes")}
                onClick={() => selectBreakdown("processes")}
              >
                공정별 현황 ({dashboard.breakdowns.processes.length})
              </button>
              <button
                type="button"
                className={`${styles.breakdownTabBtn} ${
                  activeBreakdownTab === "equipment" ? styles.breakdownTabBtnActive : ""
                }`}
                role="tab"
                id={`${tabId}-tab-equipment`}
                aria-controls={`${tabId}-panel-equipment`}
                aria-selected={activeBreakdownTab === "equipment"}
                tabIndex={activeBreakdownTab === "equipment" ? 0 : -1}
                ref={(node) => { tabRefs.current.equipment = node; }}
                onKeyDown={(event) => handleTabKey(event, "equipment")}
                onClick={() => selectBreakdown("equipment")}
              >
                설비별 현황 ({dashboard.breakdowns.equipment.length})
              </button>
              <button
                type="button"
                className={`${styles.breakdownTabBtn} ${
                  activeBreakdownTab === "systems" ? styles.breakdownTabBtnActive : ""
                }`}
                role="tab"
                id={`${tabId}-tab-systems`}
                aria-controls={`${tabId}-panel-systems`}
                aria-selected={activeBreakdownTab === "systems"}
                tabIndex={activeBreakdownTab === "systems" ? 0 : -1}
                ref={(node) => { tabRefs.current.systems = node; }}
                onKeyDown={(event) => handleTabKey(event, "systems")}
                onClick={() => selectBreakdown("systems")}
              >
                물류 시스템별 현황 ({dashboard.breakdowns.systems.length})
              </button>
            </div>

            <div>
              <div className={styles.tableWrapper} role="tabpanel" id={`${tabId}-panel-processes`} aria-labelledby={`${tabId}-tab-processes`} hidden={activeBreakdownTab !== "processes"} tabIndex={0}>
              {activeBreakdownTab === "processes" && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>공정 코드</th>
                      <th>공정명</th>
                      <th>연결 작업 수</th>
                      <th>기간 가중 진척률</th>
                      <th>지연 작업</th>
                      <th>계획 공수 (M/D)</th>
                      <th>작업 이동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.breakdowns.processes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyNotice}>
                          등록된 공정이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      dashboard.breakdowns.processes.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.code}</strong></td>
                          <td>{p.name} {!p.active && <span style={{ color: "#94a3b8" }}>(비활성)</span>}</td>
                          <td>{p.taskCount}건</td>
                          <td>
                            {p.progressPercent !== null ? (
                              <>
                                <span className={styles.tableProgressBar}>
                                  <span
                                    className={styles.tableProgressFill}
                                    style={{ width: `${Math.min(100, Math.max(0, p.progressPercent))}%` }}
                                  />
                                </span>
                                {p.progressPercent}%
                              </>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>
                          <td>
                            <span style={p.overdueTaskCount > 0 ? { color: "#dc2626", fontWeight: 600 } : {}}>
                              {p.overdueTaskCount}건
                            </span>
                          </td>
                          <td>{p.plannedMd}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.drillBtn}
                              disabled={p.taskCount === 0}
                              onClick={() => handleDrillDownToProcess(p.id)}
                            >
                              일정 필터
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              </div>

              <div className={styles.tableWrapper} role="tabpanel" id={`${tabId}-panel-equipment`} aria-labelledby={`${tabId}-tab-equipment`} hidden={activeBreakdownTab !== "equipment"} tabIndex={0}>
              {activeBreakdownTab === "equipment" && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>설비 코드</th>
                      <th>설비명</th>
                      <th>유형 / 수량</th>
                      <th>배치 공정</th>
                      <th>주 제어 시스템</th>
                      <th>주 담당자 (Owner)</th>
                      <th>연결 작업 수</th>
                      <th>진척률</th>
                      <th>지연 작업</th>
                      <th>계획 공수</th>
                      <th>작업 이동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.breakdowns.equipment.length === 0 ? (
                      <tr>
                        <td colSpan={11} className={styles.emptyNotice}>
                          등록된 설비가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      dashboard.breakdowns.equipment.map((eq) => (
                        <tr key={eq.id}>
                          <td><strong>{eq.code}</strong></td>
                          <td>{eq.name} {!eq.active && <span style={{ color: "#94a3b8" }}>(비활성)</span>}</td>
                          <td>{eq.equipmentType} ({eq.quantity}대)</td>
                          <td>{eq.processName ?? "-"}</td>
                          <td>{eq.primaryControllerName ?? <span style={{ color: "#d97706" }}>미지정</span>}</td>
                          <td>{eq.ownerName ?? <span style={{ color: "#d97706" }}>미지정</span>}</td>
                          <td>{eq.taskCount}건</td>
                          <td>
                            {eq.progressPercent !== null ? (
                              <>
                                <span className={styles.tableProgressBar}>
                                  <span
                                    className={styles.tableProgressFill}
                                    style={{ width: `${Math.min(100, Math.max(0, eq.progressPercent))}%` }}
                                  />
                                </span>
                                {eq.progressPercent}%
                              </>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>
                          <td>
                            <span style={eq.overdueTaskCount > 0 ? { color: "#dc2626", fontWeight: 600 } : {}}>
                              {eq.overdueTaskCount}건
                            </span>
                          </td>
                          <td>{eq.plannedMd} M/D</td>
                          <td>
                            <button
                              type="button"
                              className={styles.drillBtn}
                              disabled={eq.taskCount === 0}
                              onClick={() => handleDrillDownToEquipment(eq.id)}
                            >
                              일정 필터
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              </div>

              <div className={styles.tableWrapper} role="tabpanel" id={`${tabId}-panel-systems`} aria-labelledby={`${tabId}-tab-systems`} hidden={activeBreakdownTab !== "systems"} tabIndex={0}>
              {activeBreakdownTab === "systems" && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>시스템 코드</th>
                      <th>시스템명</th>
                      <th>유형 / 계층</th>
                      <th>주 책임자 (PI)</th>
                      <th>연결 작업 수</th>
                      <th>진척률</th>
                      <th>지연 작업</th>
                      <th>계획 공수</th>
                      <th>작업 이동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.breakdowns.systems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className={styles.emptyNotice}>
                          등록된 시스템이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      dashboard.breakdowns.systems.map((sys) => (
                        <tr key={sys.id}>
                          <td><strong>{sys.code}</strong></td>
                          <td>{sys.name} {!sys.active && <span style={{ color: "#94a3b8" }}>(비활성)</span>}</td>
                          <td>{sys.systemType} ({sys.layer})</td>
                          <td>{sys.primaryPIName ?? <span style={{ color: "#d97706" }}>미지정</span>}</td>
                          <td>{sys.taskCount}건</td>
                          <td>
                            {sys.progressPercent !== null ? (
                              <>
                                <span className={styles.tableProgressBar}>
                                  <span
                                    className={styles.tableProgressFill}
                                    style={{ width: `${Math.min(100, Math.max(0, sys.progressPercent))}%` }}
                                  />
                                </span>
                                {sys.progressPercent}%
                              </>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>-</span>
                            )}
                          </td>
                          <td>
                            <span style={sys.overdueTaskCount > 0 ? { color: "#dc2626", fontWeight: 600 } : {}}>
                              {sys.overdueTaskCount}건
                            </span>
                          </td>
                          <td>{sys.plannedMd} M/D</td>
                          <td>
                            <button
                              type="button"
                              className={styles.drillBtn}
                              disabled={sys.taskCount === 0}
                              onClick={() => handleDrillDownToSystem(sys.id, sys.taskIds)}
                            >
                              일정 필터
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
