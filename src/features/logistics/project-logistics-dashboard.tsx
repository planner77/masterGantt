"use client";

import { useEffect, useState, useCallback, useId } from "react";
import type { LogisticsDashboardDto } from "@/contracts/logistics-dashboard";
import styles from "./project-logistics-dashboard.module.css";

export interface ProjectLogisticsDashboardProps {
  publicId: string;
  revision: number;
  onNavigateToSchedule?: (filter: {
    taskIds?: string[];
    processIds?: string[];
    equipmentIds?: string[];
    systemIds?: string[];
  }) => void;
}

type BreakdownTab = "processes" | "equipment" | "systems";

export function ProjectLogisticsDashboard({
  publicId,
  revision,
  onNavigateToSchedule,
}: ProjectLogisticsDashboardProps) {
  const [dashboard, setDashboard] = useState<LogisticsDashboardDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const today = new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState<string>(today);
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [systemView, setSystemView] = useState<"direct" | "coordination">("direct");
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<BreakdownTab>("processes");
  const [refreshKey, setRefreshKey] = useState(0);

  const asOfDateInputId = useId();
  const horizonDaysInputId = useId();
  const systemViewSelectId = useId();
  const activeOnlyCheckboxId = useId();

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      const params = new URLSearchParams();
      if (asOfDate) params.set("asOfDate", asOfDate);
      if (horizonDays) params.set("horizonDays", String(horizonDays));
      if (systemView) params.set("systemView", systemView);
      if (activeOnly) params.set("activeOnly", "true");

      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(publicId)}/logistics/dashboard?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`대시보드 조회 실패 (HTTP ${response.status})`);
        }
        const json = await response.json();
        if (!controller.signal.aborted) {
          setDashboard(json.data);
          setError(null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "대시보드를 불러오는 도중 오류가 발생했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [publicId, asOfDate, horizonDays, systemView, activeOnly, revision, refreshKey]);

  const handleDrillDownToTasks = (taskIds: string[]) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule({ taskIds });
    }
  };

  const handleDrillDownToProcess = (procId: string) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule({ processIds: [procId] });
    }
  };

  const handleDrillDownToEquipment = (eqId: string) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule({ equipmentIds: [eqId] });
    }
  };

  const handleDrillDownToSystem = (sysId: string) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule({ systemIds: [sysId] });
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
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className={styles.filterInput}
          />
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
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className={styles.filterInput}
            style={{ width: "4.5rem" }}
          />
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
          disabled={isLoading}
          className={styles.refreshButton}
        >
          {isLoading ? "새로고침 중..." : "새로고침"}
        </button>
      </div>

      {error && <div className={styles.errorNotice}>{error}</div>}

      {isLoading && !dashboard && (
        <div className={styles.loadingNotice} role="status">
          물류 KPI 대시보드를 집계하는 중입니다...
        </div>
      )}

      {dashboard && (
        <>
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
                <h4 className={styles.kpiTitle}>마일스톤 경보</h4>
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
                <span>총 마일스톤 {dashboard.kpi.milestoneTotalCount}개 중</span>
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
                경보 마일스톤 일정 보기
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
            <div className={styles.breakdownTabs}>
              <button
                type="button"
                className={`${styles.breakdownTabBtn} ${
                  activeBreakdownTab === "processes" ? styles.breakdownTabBtnActive : ""
                }`}
                onClick={() => setActiveBreakdownTab("processes")}
              >
                공정별 현황 ({dashboard.breakdowns.processes.length})
              </button>
              <button
                type="button"
                className={`${styles.breakdownTabBtn} ${
                  activeBreakdownTab === "equipment" ? styles.breakdownTabBtnActive : ""
                }`}
                onClick={() => setActiveBreakdownTab("equipment")}
              >
                설비별 현황 ({dashboard.breakdowns.equipment.length})
              </button>
              <button
                type="button"
                className={`${styles.breakdownTabBtn} ${
                  activeBreakdownTab === "systems" ? styles.breakdownTabBtnActive : ""
                }`}
                onClick={() => setActiveBreakdownTab("systems")}
              >
                물류 시스템별 현황 ({dashboard.breakdowns.systems.length})
              </button>
            </div>

            <div className={styles.tableWrapper}>
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
                              onClick={() => handleDrillDownToSystem(sys.id)}
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
        </>
      )}
    </div>
  );
}
