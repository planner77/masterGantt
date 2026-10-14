"use client";
import { useState, type ReactNode } from "react";
import type { ResourceDashboardDto, ResourceDashboardFilterInput, ResourceDashboardSummary, ResourceDashboardTargetNode, ResourceTargetDimension } from "@/contracts/resource-dashboard";
import { plannedEffort } from "./resource-dashboard-model";
import { ResourceDashboardDetails } from "./resource-dashboard-details";
import { useResourceDrill } from "./resource-drill-context";
import styles from "./resource-target-views.module.css";

export function projectionRowKey(path: NonNullable<ResourceDashboardSummary["selector"]["targetPath"]>) { return JSON.stringify(path); }
const EMPTY_LABELS: Partial<Record<ResourceTargetDimension, string>> = { target: "Target 미연결", group: "Group 미지정", resource: "개인 미배정", workArea: "WorkArea 미사용", process: "공정 미매핑" };
export function targetNodeLabel(node: ResourceDashboardTargetNode) { return node.name ?? (node.dimension === "target" && node.sourceKinds.includes("legacy_direct") ? "Target 없음 · Legacy 직접 출처" : (node.id === null ? EMPTY_LABELS[node.dimension] ?? "미지정" : node.id)); }
const FILTERS = [
  ["projectProcessIds", "프로젝트 공정", "projectProcess"], ["processOccurrenceIds", "현장 공정", "process"], ["processTypeIds", "공정 유형", "processType"],
  ["workAreaIds", "WorkArea", "workArea"], ["memberEquipmentIds", "Target 설비 인스턴스", "equipment"], ["memberSystemIds", "Target System 인스턴스", "system"],
  ["equipmentTypeCodes", "설비 종류", "equipmentType"], ["systemTypeCodes", "System 종류", "systemType"],
  ["directEquipmentIds", "Legacy 직접 설비", "equipment"], ["directSystemIds", "Legacy 직접 System", "system"],
] as const;
export function ResourceTargetFilters({ data, filters, onChange, quick = false }: { data: ResourceDashboardDto | null; filters: ResourceDashboardFilterInput; onChange: (patch: Partial<ResourceDashboardFilterInput>) => void; quick?: boolean }) {
  const catalog = data?.targetProjection?.catalog ?? [];
  const noCatalog = !data?.targetProjection;
  const unlinked = filters.targetIds?.includes("unassigned");
  const definitions = quick ? [["targetIds", "Target", "target"] as const] : FILTERS;
  return <>{definitions.map(([key, label, dimension]) => <label key={key}>{label}<select aria-label={label} value={filters[key]?.[0] ?? ""} disabled={noCatalog || (unlinked && ["memberEquipmentIds","memberSystemIds","equipmentTypeCodes","systemTypeCodes"].includes(key))} title={noCatalog ? "Target 보기에서 대상 목록을 확인하세요." : undefined} onChange={event => onChange({ [key]: event.target.value ? [event.target.value] : [], ...(key === "targetIds" && event.target.value === "unassigned" ? {memberEquipmentIds:[],memberSystemIds:[],equipmentTypeCodes:[],systemTypeCodes:[]} : {}) })}>
    <option value="">전체</option>{["target", "workArea"].includes(dimension) ? <option value="unassigned">{dimension === "target" ? "Target 미연결" : dimension === "workArea" ? "WorkArea 미사용" : "공정 미매핑"}</option> : null}
    {catalog.filter(item => item.dimension === dimension).map(item => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}{!item.active ? " · 비활성 기존 연결" : ""}</option>)}
    {filters[key]?.[0] && filters[key]?.[0] !== "unassigned" && !catalog.some(item => item.dimension === dimension && item.id === filters[key]?.[0]) ? <option value={filters[key]![0]}>{filters[key]![0]} · 현재 선택</option> : null}
  </select>{quick && noCatalog ? <small>Target 보기에서 대상 목록을 확인하세요.</small> : null}</label>)}{quick && unlinked ? <small>Target 미연결은 Target 구성원·유형 조건과 함께 조회하지 않습니다. 해당 조건은 해제됩니다.</small> : null}{!quick ? <label>Target 범위<select aria-label="Target 범위" value={filters.targetScopes?.[0] ?? ""} onChange={event => onChange({targetScopes: event.target.value ? [event.target.value as "process" | "project_common"] : []})}><option value="">전체</option><option value="process">공정 대상</option><option value="project_common">프로젝트 공통</option></select></label> : null}</>;
}
export function ResourceTargetViews({ data, unit, stale, onStale, expanded, onToggle, matrix, onOpen }: {
  data: ResourceDashboardDto; unit: "md" | "mm"; stale: boolean; onStale: () => void; expanded: Set<string>; onToggle: (key: string) => void; matrix: boolean;
  onOpen: (summary: ResourceDashboardSummary, label: string, trigger: HTMLElement) => void;
}) {
  const [metric, setMetric] = useState<"effort" | "tasks" | "completed" | "delayed" | "progress">("effort");
  const [sort, setSort] = useState<"server" | "name" | "effort">("server");
  const [columnOffset, setColumnOffset] = useState(0);
  const ordered = (nodes: ResourceDashboardTargetNode[]) => sort === "server" ? nodes : [...nodes].sort((a,b) => sort === "name" ? targetNodeLabel(a).localeCompare(targetNodeLabel(b), "ko") : b.summary.effort.knownMd - a.summary.effort.knownMd || targetNodeLabel(a).localeCompare(targetNodeLabel(b), "ko"));
  const metricValue = (s: ResourceDashboardSummary) => metric === "effort" ? plannedEffort(s.effort, unit) : metric === "tasks" ? `${s.taskCount} Task` : metric === "completed" ? `${s.completed} 완료 / ${s.completion.denominator} Task` : metric === "delayed" ? `${s.delayed} 지연 / ${s.taskCount} Task` : (s.assignedTaskProgress.percent === null ? "미산정 · 유효 작업기간 없음" : `${s.assignedTaskProgress.percent.toFixed(1)}% (Σ기간×진척 ${s.assignedTaskProgress.numerator} / Σ기간 ${s.assignedTaskProgress.denominator})`);
  const { onOpenTarget, locked } = useResourceDrill();
  const projection = data.targetProjection;
  if (!projection) return <p role="status">Target 범위를 조회하고 있습니다.</p>;
  const treeRows = (nodes: ResourceDashboardTargetNode[], depth = 0): ReactNode => ordered(nodes).map(node => {
    const key = projectionRowKey(node.summary.selector.targetPath!); const contentId = `target-projection-${encodeURIComponent(key)}`; const open = expanded.has(key); const label = targetNodeLabel(node);
    return <tbody key={key} data-projection-row-key={key}><tr><th scope="row" style={{paddingInlineStart: 12 + depth * 16}}><button type="button" aria-expanded={open} aria-controls={contentId} disabled={stale} onClick={() => onToggle(key)}>{open ? "▾" : "▸"} {label}</button>
      {node.sourceKinds.includes("legacy_direct") ? <small>Legacy 직접 연결 (Target 추론 없음)</small> : null}{node.sourceKinds.includes("target_unlinked") ? <small>Target 미연결</small> : null}{node.active === false ? <small>비활성 기존 연결</small> : null}
      {node.dimension === "target" && node.id ? <button type="button" disabled={stale || locked || !onOpenTarget} onClick={event => onOpenTarget?.(node.id!, event.currentTarget, projection.catalog.find(item => item.dimension === "target" && item.id === node.id)?.code)}>대상 구성 편집</button> : null}</th>
      <td>{plannedEffort(node.summary.effort, unit)}</td><td>{node.summary.taskCount}</td><td>{node.summary.completed}</td><td>{node.summary.delayed}</td><td><button type="button" disabled={stale} onClick={event => onOpen(node.summary, label, event.currentTarget)}>작업·배정 상세</button></td></tr>
      {open && !node.children.length ? <tr id={contentId}><td colSpan={6}><ResourceDashboardDetails data={data} selector={node.summary.selector} unit={unit} stale={stale} onStale={onStale}/></td></tr> : null}
      {open && node.children.length ? <tr id={contentId}><td colSpan={6} className={styles.nested}><table><Headers/>{treeRows(node.children, depth + 1)}</table></td></tr> : null}</tbody>;
  });
  // Column identities only; every amount/selector remains the server's exact intersection.
  const allColumns = ordered([...new Map(projection.children.flatMap(row => row.children).map(node => [JSON.stringify([node.dimension, node.id]), node])).values()]);
  const pageOffset = Math.min(columnOffset, Math.max(0, Math.ceil(allColumns.length / 4) - 1) * 4);
  const columns = allColumns.slice(pageOffset, pageOffset + 4);
  return <section className={styles.target} aria-label="Target 관련 계획 공수" data-testid="resource-target-view">
    <h3 tabIndex={-1}>Target 관련 계획 공수</h3>
    <div className={styles.controls}>{matrix ? <label>지표<select aria-label="Target 지표" value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="effort">관련 계획 공수</option><option value="tasks">고유 Task</option><option value="completed">완료 Task</option><option value="delayed">지연 Task</option><option value="progress">기간가중 진척</option></select></label> : null}<label>정렬<select aria-label="Target 정렬" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="server">서버 기본 순서</option><option value="name">이름순</option><option value="effort">알려진 공수 내림차순</option></select></label></div>
    <p>Task·완료·지연은 선택 범위의 고유 일반 Task 기준이며 기간가중 진척은 개인 배정 Task의 Σ(작업기간 × 진척률) / Σ(작업기간)이며 분모가 0이면 미산정입니다. 미설정 진척은 0으로 추정하지 않습니다. 정렬은 표시만 바꿉니다.</p><p>선택 전체: {plannedEffort(data.summary.effort, unit)} · 고유 Task {data.summary.taskCount} · Assignment {data.summary.assignmentCount}. 총계는 서버의 전체 선택값입니다. Target·Group 소계는 중첩되어 합산할 수 없습니다.</p>
    <p>전체 Project 참고 (필터·원본 범위 제외): {plannedEffort(projection.projectReference.effort, unit)} · Task {projection.projectReference.taskCount}. {data.mdPerMm === null ? "M/M 환산 기준없음." : `M/M 기준 ${data.mdPerMm} M/D.`}</p>
    <p>작업범위 T0: Target 미연결 {projection.diagnostics.targetUnlinkedTaskCount} · Legacy만 연결 {projection.diagnostics.legacyOnlyTaskCount}</p><p>전체 Project 구성 참고: 공정 미매핑 {projection.diagnostics.unmappedProjectProcessIds.length} · 미사용 Target {projection.diagnostics.unusedTargetIds.length} · 프로젝트 공통 Target {projection.diagnostics.projectCommonTargetIds.length} · WorkArea 미사용 Target {projection.diagnostics.noWorkAreaTargetIds.length}</p>
    <div className={styles.scroll} data-resource-scroll-owner tabIndex={0} onFocusCapture={event => {
      if (!matrix || !(event.target instanceof HTMLButtonElement)) return;
      const owner = event.currentTarget, button = event.target;
      const sticky = owner.querySelector("tbody th");
      if (!sticky) return;
      const bounds = owner.getBoundingClientRect(), box = button.getBoundingClientRect();
      const left = bounds.left + sticky.getBoundingClientRect().width + 8, right = bounds.right - 8;
      // Resource-owned native scroll only; no Gantt/viewport command or data mutation.
      if (box.left < left) owner.scrollLeft += box.left - left;
      else if (box.right > right) owner.scrollLeft += box.right - right;
    }} role="region" aria-label={matrix ? "Resource Target 비교표" : "Resource Target 계층"}>
      {matrix ? <table className={styles.matrix}><thead><tr><th>Resource / Group × Target</th>{columns.map(column => <th key={JSON.stringify([column.dimension,column.id])}>{targetNodeLabel(column)}</th>)}</tr></thead><tbody>{ordered(projection.children).map(row => <tr key={projectionRowKey(row.summary.selector.targetPath!)}><th scope="row">{targetNodeLabel(row)}<small>서버 소계 {plannedEffort(row.summary.effort, unit)}</small></th>{columns.map(column => {const cell = row.children.find(node => node.dimension === column.dimension && node.id === column.id);return <td key={JSON.stringify([column.dimension,column.id])}>{cell ? <button type="button" disabled={stale} onClick={event => onOpen(cell.summary, `${targetNodeLabel(row)} · ${targetNodeLabel(cell)}`, event.currentTarget)}>{metricValue(cell.summary)}<small>Task {cell.summary.taskCount} · 완료 {cell.summary.completed} · 지연 {cell.summary.delayed}</small></button> : "—"}</td>;})}</tr>)}</tbody></table> : <table><Headers/>{treeRows(projection.children)}</table>}
    </div>{matrix ? <div className={styles.controls} aria-label="Target 비교 열 페이지"><span>{allColumns.length}개 Target 열 중 {allColumns.length ? pageOffset + 1 : 0}–{Math.min(pageOffset + 4, allColumns.length)} · 전체값은 모든 열 포함</span><button type="button" disabled={stale || pageOffset === 0} onClick={() => setColumnOffset(Math.max(0,pageOffset - 4))}>이전 Target 열</button><button type="button" disabled={stale || pageOffset + 4 >= allColumns.length} onClick={() => setColumnOffset(pageOffset + 4)}>다음 Target 열</button></div> : null}{projection.children.length === 0 ? <p>현재 조건에 일치하는 Target 관련 배정이 없습니다. 저장 후 조건에서 제외된 경우 필터를 확인하세요.</p> : null}
  </section>;
}
function Headers() {return <thead><tr><th>원본 / 조회용 그룹</th><th>관련 계획 공수</th><th>Task</th><th>완료</th><th>지연</th><th>상세</th></tr></thead>;}
