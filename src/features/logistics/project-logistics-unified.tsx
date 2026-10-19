"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectLogisticsDto } from "@/contracts/logistics";
import type { ResourceDashboardFilterInput, ResourceDashboardSelector, ResourceDashboardSummary } from "@/contracts/resource-dashboard";
import { ProcessWorkareaDashboard } from "@/features/resources/process-workarea-dashboard";
import { WbsViewDashboard } from "@/features/resources/wbs-view-dashboard";
import type { WbsViewDimension } from "@/contracts/wbs-dashboard-views";
import { ResourceDrillContext, type WbsViewScheduleRequest, type ResourceScheduleRequest } from "@/features/resources/resource-drill-context";
import { dashboardQuery, plannedEffort } from "@/features/resources/resource-dashboard-model";
import { ResourceDashboardDetails } from "@/features/resources/resource-dashboard-details";
import { ResourceTargetFilters, ResourceTargetViews } from "@/features/resources/resource-target-views";
import { useResourceDashboard } from "@/features/resources/use-resource-dashboard";
import { configuredLogisticsInventory, currentLogisticsDetail, fullMilestoneGateLabel, LOGISTICS_PERSPECTIVES, type LogisticsPerspective } from "./logistics-unified-model";
import styles from "./project-logistics-unified.module.css";
import { useLogisticsViewState } from "./use-logistics-view-state";

interface Props {
  perspective?: LogisticsPerspective;
  onPerspectiveChange?: (view: LogisticsPerspective) => void;
  publicId: string;
  revision: number;
  active: boolean;
  busy: boolean;
  editable: boolean;
  logistics: ProjectLogisticsDto;
  onOpenTask?: (taskId: string, trigger?: HTMLElement) => void;
  onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void;
  onOpenTarget?: (targetId: string, trigger: HTMLElement, code?: string | null) => void;
  onOpenMilestone?: (taskId: string) => void;
  onWbsSchedule?: (request: WbsViewScheduleRequest) => void;
  onWbsOpenEntity?: (dimension: WbsViewDimension, id: string, trigger: HTMLElement) => void;
  onResourceSchedule?: (request: ResourceScheduleRequest) => void;
}

const DETAIL_SCOPE_CHANGED = "조회 조건 또는 원본 snapshot이 바뀌어 이전 상세를 닫았습니다. 현재 결과에서 다시 선택하세요.";

/** Share the existing exact Task/Assignment/Target editor and resource scope navigation. */
export function ProjectLogisticsUnified(props: Props) {
  return (
    <ResourceDrillContext.Provider value={{
      binding: null,
      locked: props.busy,
      onWbsSchedule: props.onWbsSchedule,
      onOpenTask: props.onOpenTask,
      onOpenAssignment: props.editable ? props.onOpenAssignment : undefined,
      onOpenTarget: props.editable ? props.onOpenTarget : undefined,
      onSchedule: props.onResourceSchedule ? (request) => props.onResourceSchedule?.({ ...request, binding: null }) : undefined,
    }}>
      {(["process", "equipment", "system"] as const).map(root => {
        const Dashboard = root === "process" ? ProcessWorkareaDashboard : WbsViewDashboard;
        return <div key={root} hidden={(props.perspective ?? "process") !== root} inert={(props.perspective ?? "process") !== root}><Dashboard publicId={props.publicId} revision={props.revision} root={root} active={props.active && (props.perspective ?? "process") === root} busy={props.busy} onOpenTask={props.onOpenTask} onOpenAssignment={props.editable ? props.onOpenAssignment : undefined} onOpenEntity={props.editable ? props.onWbsOpenEntity : undefined} onSchedule={props.onWbsSchedule}/></div>;
      })}
      <UnifiedContent {...props} />
    </ResourceDrillContext.Provider>
  );
}

function UnifiedContent({ publicId, revision, active, busy, logistics, onOpenMilestone, perspective: controlledPerspective, onPerspectiveChange }: Props) {
  const [localPerspective, setLocalPerspective] = useState<LogisticsPerspective>("process");
  const perspective = controlledPerspective ?? localPerspective;
  function setPerspective(view: LogisticsPerspective) { setLocalPerspective(view); onPerspectiveChange?.(view); }
  const [filters, setFilters] = useLogisticsViewState<ResourceDashboardFilterInput>(perspective, { mode: "resource" });
  const [advanced, setAdvanced] = useLogisticsViewState(perspective, false);
  const [unit, setUnit] = useLogisticsViewState<"md" | "mm">(perspective, "md");
  const [expanded, setExpanded] = useLogisticsViewState<Set<string>>(perspective, () => new Set());
  const [stageExpanded, setStageExpanded] = useLogisticsViewState(perspective, false);
  const [staleSnapshot, setStaleSnapshot] = useLogisticsViewState<string | null>(perspective, null);
  const [selection, setSelection] = useLogisticsViewState<{
    selector: ResourceDashboardSelector;
    label: string;
    snapshotId: string;
    queryKey: string;
  } | null>(perspective, null);
  const [selectionNotice, setSelectionNotice] = useLogisticsViewState<string | null>(perspective, null);
  const detailsTrigger = useRef<HTMLElement | null>(null);
  const detailsHeading = useRef<HTMLHeadingElement | null>(null);
  const viewSelect = useRef<HTMLSelectElement | null>(null);
  const validRange = !filters.from || !filters.to || filters.from <= filters.to;
  const normalized = useMemo<ResourceDashboardFilterInput>(() => ({
    ...filters, projectionOrder: [...LOGISTICS_PERSPECTIVES[perspective].order],
  }), [filters, perspective]);
  const queryKey = useMemo(() => dashboardQuery(normalized).toString(), [normalized]);
  const report = useResourceDashboard(publicId, revision, active && validRange, queryKey);
  const data = report.data;
  const stale = report.stale || (data !== null && staleSnapshot === data.snapshotId);
  const inventory = useMemo(() => configuredLogisticsInventory(logistics), [logistics]);
  const linked = data?.targetProjection?.relatedMembers;
  const unitShown = data?.mdPerMm && unit === "mm" ? "mm" : "md";
  // A selection is valid only for the exact query and canonical snapshot.
  // Derive validity during render rather than synchronously resetting state in an effect.
  const currentSelection = currentLogisticsDetail(selection, data?.snapshotId, queryKey);
  const visibleSelectionNotice = selection && !currentSelection ? DETAIL_SCOPE_CHANGED : selectionNotice;

  useEffect(() => {
    if (currentSelection && !stale) detailsHeading.current?.focus({ preventScroll: true });
  }, [currentSelection, stale]);

  // Explicit user interactions may invalidate the old detail without a render-effect cascade.
  const invalidateSelection = () => {
    setSelection(null);
    setSelectionNotice(selection ? DETAIL_SCOPE_CHANGED : null);
  };

  const toggle = (key: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const openDetail = (summary: ResourceDashboardSummary, label: string, trigger: HTMLElement) => {
    if (!data || stale || busy) return;
    detailsTrigger.current = trigger;
    setSelectionNotice(null);
    setSelection({ selector: summary.selector, label, snapshotId: data.snapshotId, queryKey });
  };
  const closeDetail = () => {
    setSelection(null);
    setSelectionNotice(null);
    requestAnimationFrame(() => {
      const trigger = detailsTrigger.current;
      if (trigger?.isConnected && !trigger.closest("[hidden],[inert]") && !trigger.matches(":disabled")) {
        trigger.focus({ preventScroll: true });
      } else viewSelect.current?.focus({ preventScroll: true });
    });
  };
  const markStale = () => setStaleSnapshot(data?.snapshotId ?? null);
  const refresh = () => { setStaleSnapshot(null); setSelection(null); setSelectionNotice(null); report.refresh(); };
  const changeFilters = (patch: Partial<ResourceDashboardFilterInput>) => {
    setFilters(previous => ({ ...previous, ...patch }));
    invalidateSelection();
  };

  return <section className={styles.root} data-testid="logistics-unified-view" aria-label="물류 통합 교차 조회">
    <div className={styles.toolbar}>
      <label>조회 관점
        <select ref={viewSelect} aria-label="물류 통합 조회 관점" value={perspective}
          onChange={event => setPerspective(event.target.value as LogisticsPerspective)}>
          {Object.entries(LOGISTICS_PERSPECTIVES).map(([key, view]) =>
            <option key={key} value={key}>{view.label}</option>)}
        </select>
      </label>
      <label>기간 시작
        <input aria-label="통합 조회 시작일" type="date" value={filters.from ?? ""} onChange={event => changeFilters({ from: event.target.value })} />
      </label>
      <label>기간 종료
        <input aria-label="통합 조회 종료일" type="date" value={filters.to ?? ""} onChange={event => changeFilters({ to: event.target.value })} />
      </label>
      <label>공수 단위
        <select aria-label="통합 공수 단위" value={unitShown} onChange={event => setUnit(event.target.value as "md" | "mm")}>
          <option value="md">M/D</option>
          <option value="mm" disabled={!data?.mdPerMm}>M/M</option>
        </select>
      </label>
      <button type="button" aria-expanded={advanced} aria-controls="logistics-unified-filters"
        onClick={() => setAdvanced(previous => !previous)}>
        상세 필터 {advanced ? "접기" : "펼치기"}
      </button>
      <button type="button" disabled={busy || report.phase === "loading"} onClick={refresh}>
        {report.phase === "loading" ? "조회 중…" : "새로고침"}
      </button>
    </div>

    {!validRange ? <p role="alert" className={styles.error}>종료일은 시작일보다 빠를 수 없습니다.</p> : null}
    <div className={styles.toolbar} aria-label="Target 빠른 필터">
      <ResourceTargetFilters quick data={data} filters={filters} onChange={changeFilters} />
    </div>
    {advanced ? <div id="logistics-unified-filters" className={styles.toolbar} aria-label="물류 상세 필터">
      <ResourceTargetFilters data={data} filters={filters} onChange={changeFilters} />
    </div> : <div id="logistics-unified-filters" hidden />}
    <p className={styles.subtle}>
      조회용 공정 종류 → site/product 공정 occurrence → 선택적 WorkArea → Target 구조입니다.
      프로젝트 공통·WorkArea 미사용·legacy 직접 연결은 저장된 가상 공정이 아니라 출처가 구별되는 조회 그룹입니다.
      같은 Task/Assignment가 여러 그룹에 나타나도 서버 고유 총계만 사용합니다.
    </p>

    <dl className={styles.inventory} aria-label="설비 구성 수량과 Task 범위">
      <div><dt>Project 구성 설비 인스턴스</dt><dd>{inventory.equipmentIds.length}개</dd></div>
      <div><dt>Project 구성 설비 수량 (고유 ID)</dt><dd>{inventory.equipmentQuantity}대</dd></div>
      <div><dt>Project 구성 시스템 인스턴스</dt><dd>{inventory.systemIds.length}식</dd></div>
      <div><dt>현재 Task 범위의 설비 대상</dt><dd>{linked ? linked.equipmentIds.length : "조회 전"}개 인스턴스 · {linked?.equipmentQuantity ?? "—"}대</dd></div>
      <div><dt>현재 Task 범위의 시스템 대상</dt><dd>{linked ? linked.systemIds.length : "조회 전"}식</dd></div>
      <div><dt>배정된 Task / Assignment (A)</dt><dd>{data ? data.summary.taskCount : "—"} / {data ? data.summary.assignmentCount : "—"}</dd></div>
      <div><dt>선택 전체 관련 계획공수 (A)</dt><dd>{data ? plannedEffort(data.summary.effort, unitShown) : "—"}</dd></div>
      <div><dt>배정 작업의 기간가중 진척</dt><dd>{data?.summary.assignedTaskProgress.percent == null ? "미산정" : data.summary.assignedTaskProgress.percent.toFixed(1) + "%"}</dd></div>
    </dl>
    <p className={styles.subtle}>
      Project 구성 수량은 등록 instance ID 기준이며, 현재 Task 범위 수량은 T0 일반 Task·유효 Target/member/legacy 출처 기준입니다.
      공유 fleet/MCS는 고유 instance ID로 계산합니다. 이 값은 설치완료 대수·물류 실적이 아닙니다.
      Task 대상 coverage는 출처별 확인이며 Task 진척률이나 수량을 곱해 환산하지 않습니다.
      계획공수는 실제 Allocation이 설정된 Assignment만 대상으로 합니다. 미설정은 미설정 상태 그대로 유지합니다.
    </p>
    {inventory.conflictingEquipmentIds.length ? <p role="alert" className={styles.error}>
      중복 canonical 설비 ID에 서로 다른 수량이 발견되었습니다. 구성 수량을 합산 결과로 승인하지 말고 원본을 확인하세요.
    </p> : null}
    {linked && linked.members.some(row => row.coverageState !== "single") ? <p className={styles.subtle}>
      Coverage 확인 필요: 출처 다중 {linked.members.filter(row => row.coverageState === "multiple").length}개 /
      범위 미지정 {linked.members.filter(row => row.coverageState === "unspecified").length}개.
      Coverage는 구성 수량과 별도이며 실적 상태를 의미하지 않습니다.
    </p> : null}
    {data?.targetProjection ? <p className={styles.subtle}>
      Target 미연결 일반 Task {data.targetProjection.diagnostics.targetUnlinkedTaskCount}개 /
      legacy-only {data.targetProjection.diagnostics.legacyOnlyTaskCount}개.
      공정 미매핑 {data.targetProjection.diagnostics.unmappedProjectProcessIds.length}개 /
      WorkArea 없는 Target {data.targetProjection.diagnostics.noWorkAreaTargetIds.length}개 /
      공통 Target {data.targetProjection.diagnostics.projectCommonTargetIds.length}개.
    </p> : null}

    {report.phase === "loading" || report.stale ? <p role="status">조회 중 또는 이전 snapshot입니다. 상세 수정·이동은 최신값 확인 후 가능합니다.</p> : null}
    {staleSnapshot === data?.snapshotId && data ? <p role="status">상세가 stale입니다. 새로고침하여 최신 snapshot을 확인하세요.</p> : null}
    {report.error ? <p role="alert" className={styles.error}>{report.error} <button type="button" onClick={refresh}>다시 시도</button></p> : null}
    {visibleSelectionNotice ? <p role="status">{visibleSelectionNotice}</p> : null}

    {data && data.targetProjection && validRange ?
      <ResourceTargetViews data={data} unit={unitShown} stale={stale || busy} onStale={markStale}
        expanded={expanded} onToggle={toggle} matrix={false} onOpen={openDetail} /> : null}

    {currentSelection && data && !stale ?
      <section className={styles.details} aria-label="정확 Task 및 Assignment 상세">
        <h3 ref={detailsHeading} tabIndex={-1}>{currentSelection.label}</h3>
        <button type="button" onClick={closeDetail}>상세 닫기</button>
        <ResourceDashboardDetails data={data} selector={currentSelection.selector} unit={unitShown}
          stale={stale || busy} onStale={markStale} />
      </section> : null}

    {data && !stale ? <section aria-label="Milestone 전체 Stage Gate 교차 조회">
      <div className={styles.toolbar}>
        <h3>Milestone 전체 Stage Gate</h3>
        {data.stages.length > 10 ? <button type="button" aria-expanded={stageExpanded} onClick={() => setStageExpanded(previous => !previous)}>
          {stageExpanded ? "10건만 보기" : "전체 " + data.stages.length + "건 보기"}
        </button> : null}
      </div>
      <p className={styles.subtle}>Ready/Blocked·선행·완료멤버는 전체 canonical Milestone 기준입니다. 선택 Task 수·공수는 교차 조회 참고값이며 전체 Gate를 다시 계산하지 않습니다.</p>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label="Milestone Stage Gate 표">
        <table>
          <thead><tr><th>Milestone</th><th>예정일</th><th>전체 Gate</th><th>전체 완료 멤버</th><th>선택 Assignment Task</th><th>상세</th></tr></thead>
          <tbody>{data.stages.slice(0,stageExpanded ? undefined : 10).map(stage =>
            <tr key={stage.milestoneTaskId}>
              <th scope="row">{stage.name}</th>
              <td>{stage.scheduledDate ?? "미정"}</td>
              <td>{fullMilestoneGateLabel(stage)}</td>
              <td>{stage.full.completedMemberCount} / {stage.full.memberCount}</td>
              <td>{stage.selected.taskCount} Task · {stage.selected.assignmentCount} 배정</td>
              <td><button type="button" disabled={busy || !onOpenMilestone} onClick={() => onOpenMilestone?.(stage.milestoneTaskId)}>
                Milestone 원본
              </button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!data.stages.length ? <p className={styles.subtle}>현재 Milestone이 없습니다.</p> : null}
    </section> : null}
  </section>;
}
