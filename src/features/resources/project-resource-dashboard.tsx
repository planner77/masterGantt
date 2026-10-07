"use client";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ResourceDashboardFilterInput, ResourceDashboardRow, ResourceDashboardSelector, ResourceDashboardSummary } from "@/contracts/resource-dashboard";
import { dashboardQuery, plannedEffort } from "./resource-dashboard-model";
import { useResourceDashboard } from "./use-resource-dashboard";
import { ResourceDashboardDetails } from "./resource-dashboard-details";
import styles from "./resource-dashboard.module.css";

const ROLE_OPTIONS = [["PI", "PI"], ["DEVELOPER", "개발자"], ["EQUIPMENT_OWNER", "설비 담당"], ["UNSPECIFIED", "Global Role 미지정"]] as const;
const GRADES = [["BEGINNER", "초급"], ["INTERMEDIATE", "중급"], ["ADVANCED", "고급"], ["EXPERT", "특급"], ["UNSPECIFIED", "등급 미지정"]] as const;
const DEFAULTS: ResourceDashboardFilterInput = { mode: "group", resourceActivity: "all", groupActivity: "all" };
function percent(value: number | null) { return value === null ? "—" : `${value.toFixed(1)}%`; }

export function ProjectResourceDashboard({ publicId, revision, active, refreshDisabled, onRefreshProject }: { publicId: string; revision: number; active: boolean; refreshDisabled: boolean; onRefreshProject: () => void }) {
  const [filters, setFilters] = useState<ResourceDashboardFilterInput>(DEFAULTS);
  const [mode, setMode] = useState<"group" | "resource">("group");
  const [unit, setUnit] = useState<"md" | "mm">("md");
  const [advanced, setAdvanced] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<{ selector: ResourceDashboardSelector; label: string; view: "tasks" | "assignments"; snapshotId: string; queryKey: string } | null>(null);
  const [detailStale, setDetailStale] = useState<string | null>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const normalized = useMemo(() => filters, [filters]);
  const validDates = !(filters.from && filters.to && filters.from > filters.to);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const queryKey = dashboardQuery(normalized).toString();
  const report = useResourceDashboard(publicId, revision, active && validDates, queryKey);
  const data = report.data;
  const stale = report.stale || (data !== null && detailStale === data.snapshotId);
  const set = <K extends keyof ResourceDashboardFilterInput>(key: K, value: ResourceDashboardFilterInput[K]) => setFilters((previous) => ({ ...previous, [key]: value }));
  const selectedCount = Object.entries(filters).filter(([key, value]) => key !== "mode" && value !== undefined && value !== "" && value !== "all" && (!Array.isArray(value) || value.length)).length;
  const estimateActive = filters.roles?.length === 1 && filters.roles[0] === "DEVELOPER";
  const toggleEstimate = () => { setFilters((previous) => ({ ...previous, roles: estimateActive ? [] : ["DEVELOPER"], ...(estimateActive ? { developerGrades: [] } : {}) })); if (!estimateActive) setMode("resource"); };
  const reset = () => { setFilters(DEFAULTS); requestAnimationFrame(() => search.current?.focus({ preventScroll: true })); };
  const refresh = () => { if (detailStale) { setSelection(null); setExpanded(new Set()); } setDetailStale(null); report.refresh(); };
  const markStale = useCallback(() => { setDetailStale(data?.snapshotId ?? null); }, [data?.snapshotId]);
  const toggleRow = (key: string) => setExpanded((previous) => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const openDetail = (selector: ResourceDashboardSelector, label: string, view: "tasks" | "assignments", trigger: HTMLElement) => {
    if (stale || !data) return;
    detailTrigger.current = trigger;
    setSelection({ selector, label, view, snapshotId: data.snapshotId, queryKey });
    requestAnimationFrame(() => { detailHeading.current?.focus(); });
  };
  const closeDetail = () => { setSelection(null); requestAnimationFrame(() => { if (detailTrigger.current?.isConnected && !detailTrigger.current.matches(":disabled")) detailTrigger.current.focus({ preventScroll: true }); else search.current?.focus({ preventScroll: true }); }); };
  const openMetric = (summary: ResourceDashboardSummary, metric: ResourceDashboardSelector["metric"], label: string, trigger: HTMLElement) => openDetail({ ...summary.selector, metric }, label, metric === "unset" ? "assignments" : "tasks", trigger);
  const displayUnit = data?.mdPerMm ? unit : "md";

  const summaryRow = (row: ResourceDashboardRow, kind: "group" | "resource", parent = "") => {
    const key = `${data!.snapshotId}:${queryKey}:${parent}:${kind}:${row.id ?? "ungrouped"}`;
    const open = expanded.has(key);
    const s = row.summary;
    return <tbody key={key} className={kind === "resource" && parent ? "resource-dashboard-member" : undefined}>
      <tr data-resource-row={kind}>
        <th scope="row"><button type="button" className="resource-dashboard-disclosure" aria-expanded={open} aria-controls={`resource-row-${key}`} disabled={stale} onClick={() => toggleRow(key)}><span aria-hidden="true">{open ? "▾" : "▸"}</span><span>{row.name}{row.code ? ` (${row.code})` : ""}</span></button>{!row.active && row.id ? <small>비활성 · 기존 할당</small> : null}{kind === "resource" ? <small>{data?.catalog.resources.find((resource) => resource.id === row.id)?.roles.map((role) => ROLE_OPTIONS.find(([value]) => value === role)?.[1] ?? role).join(", ") || "Global Role 미지정"}{(() => { const grade = data?.catalog.resources.find((resource) => resource.id === row.id)?.developerGrade; return grade ? ` · ${GRADES.find(([value]) => value === grade)?.[1]}` : ""; })()}</small> : null}</th>
        <td>{s.taskCount}</td><td>{s.completed}</td><td>{s.inProgress}</td><td>{s.delayed ? <span className="status-badge danger">지연 {s.delayed}</span> : "0"}</td><td>{percent(s.assignedTaskProgress.percent)}</td><td>{row.assignmentRange?.from ?? "—"}</td><td>{row.assignmentRange?.to ?? "—"}</td><td>{plannedEffort(s.effort, displayUnit)}</td><td>{s.effort.unsetCount ? `미설정 ${s.effort.unsetCount}` : "설정됨"}</td>
      </tr>
      {open ? <tr id={`resource-row-${key}`}><td colSpan={10} className="resource-dashboard-expanded">
        {kind === "group" && row.resourceIds.length ? <div className="resource-dashboard-table-scroll" role="region" tabIndex={0} aria-label={`${row.name} 개인 현황`}><table className="resource-dashboard-table"><DashboardHeaders />{data?.resources.filter((resource) => resource.id !== null && row.resourceIds.includes(resource.id)).map((resource) => summaryRow(resource, "resource", key))}</table></div> : null}
        {kind === "group" ? <p className="resource-dashboard-hint">그룹은 현재 개인 소속 분류입니다. Group 직접 담당만 있는 Task는 아래 보조 진단에서 조회합니다.</p> : <FocusRestoreBoundary key={`${data!.snapshotId}:${key}`} onRestore={() => search.current?.focus({ preventScroll: true })}><ResourceDashboardDetails data={data!} selector={s.selector} unit={displayUnit} stale={stale} onStale={markStale} /></FocusRestoreBoundary>}
      </td></tr> : null}
    </tbody>;
  };
  return <section className={`${styles.dashboard} project-resource-workload`} aria-labelledby="resource-dashboard-heading" data-resource-dashboard="true" data-ready={!stale}>
    <div className="resource-dashboard-toolbar">
      <h2 id="resource-dashboard-heading">리소스 공수</h2>
      <div className="project-gantt-scale-controls" role="group" aria-label="리소스 표시 모드"><button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")}>그룹</button><button type="button" aria-pressed={mode === "resource"} onClick={() => setMode("resource")}>개인</button></div>
      <button type="button" className="secondary-button resource-estimate-button" aria-pressed={estimateActive} onClick={toggleEstimate}>개발 견적</button>
      <div className="project-gantt-scale-controls" role="group" aria-label="공수 표시 단위"><button type="button" aria-pressed={displayUnit === "md"} onClick={() => setUnit("md")}>M/D</button><button type="button" aria-pressed={displayUnit === "mm"} disabled={!data?.mdPerMm} title={!data?.mdPerMm ? "M/M 환산 기준 미설정" : undefined} onClick={() => setUnit("mm")}>M/M</button></div>
      <button type="button" className="secondary-button" disabled={report.phase === "loading" && active} onClick={refresh}>{report.phase === "loading" && active ? "조회 중…" : "새로고침"}</button>
    </div>
    <div className="resource-dashboard-filters" role="search" aria-label="리소스 검색과 필터">
      <label>기간 시작<input type="date" value={filters.from ?? ""} onChange={(event) => set("from", event.target.value || undefined)} /></label><label>기간 종료<input type="date" value={filters.to ?? ""} onChange={(event) => set("to", event.target.value || undefined)} /></label>
      <label>Milestone<select aria-label="Milestone" value={filters.milestoneIds?.[0] ?? ""} onChange={(event) => set("milestoneIds", event.target.value ? [event.target.value] : [])}><option value="">전체</option><option value="unassigned">Milestone 미지정</option>{data?.catalog.milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</select></label>
      <label className="resource-dashboard-search">검색<input ref={search} aria-label="리소스·그룹·Task 이름과 코드 검색" type="search" maxLength={200} placeholder="이름 · 코드 · Task · WBS" value={filters.search ?? ""} onChange={(event) => set("search", event.target.value)} /></label>
      <button ref={filterTrigger} type="button" className="secondary-button" aria-expanded={advanced} aria-controls="resource-dashboard-advanced-filter" onClick={() => setAdvanced((value) => !value)}>필터{selectedCount ? ` ${selectedCount}` : ""}</button>
      {selectedCount ? <button type="button" className="secondary-button" onClick={reset}>초기화</button> : null}
    </div>

    {filters.from && filters.to && filters.from > filters.to ? <p role="alert">시작일이 종료일보다 늦습니다. 날짜를 수정해 주세요. 이전 결과의 상세는 잠겨 있습니다.</p> : null}
    <div id="resource-dashboard-advanced-filter" hidden={!advanced} className="resource-dashboard-advanced" aria-label="리소스 고급 필터" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setAdvanced(false); filterTrigger.current?.focus({ preventScroll: true }); } }}>
      <label>Global Role<select aria-label="Global Role" value={filters.roles?.[0] ?? ""} onChange={(event) => set("roles", event.target.value ? [event.target.value as NonNullable<ResourceDashboardFilterInput["roles"]>[number]] : [])}><option value="">전체</option>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>개발자 등급<select aria-label="개발자 등급" value={filters.developerGrades?.[0] ?? ""} onChange={(event) => set("developerGrades", event.target.value ? [event.target.value as NonNullable<ResourceDashboardFilterInput["developerGrades"]>[number]] : [])}><option value="">전체</option>{GRADES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>작업 상태<select aria-label="작업 상태" value={filters.statuses?.[0] ?? ""} onChange={(event) => set("statuses", event.target.value ? [event.target.value as NonNullable<ResourceDashboardFilterInput["statuses"]>[number]] : [])}><option value="">전체</option><option value="not_started">시작 전</option><option value="in_progress">진행 중</option><option value="completed">완료</option></select></label>
      <label>개인 활성 상태<select aria-label="개인 활성 상태" value={filters.resourceActivity ?? "all"} onChange={(event) => set("resourceActivity", event.target.value as "all" | "active" | "inactive")}><option value="all">전체</option><option value="active">활성</option><option value="inactive">비활성</option></select></label>
      <label>그룹 활성 소속<select aria-label="그룹 활성 소속" value={filters.groupActivity ?? "all"} onChange={(event) => set("groupActivity", event.target.value as "all" | "active" | "inactive")}><option value="all">전체</option><option value="active">활성 그룹 소속</option><option value="inactive">비활성 그룹 소속</option></select></label>
      <label>그룹 선택<select aria-label="그룹 선택" value={filters.groupIds?.[0] ?? ""} onChange={(event) => set("groupIds", event.target.value ? [event.target.value] : [])}><option value="">전체</option><option value="ungrouped">미분류 Resource</option>{data?.catalog.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label>개인 선택<select aria-label="개인 선택" value={filters.resourceIds?.[0] ?? ""} onChange={(event) => set("resourceIds", event.target.value ? [event.target.value] : [])}><option value="">전체</option>{data?.catalog.resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}{!resource.active ? " (비활성)" : ""}</option>)}</select></label>
      <label>작업 검색<input type="search" maxLength={200} value={filters.taskSearch ?? ""} onChange={(event) => set("taskSearch", event.target.value)} /></label>
    </div>
    <div className="resource-dashboard-status" data-source="workload" data-state={report.phase}>
      <p role={report.phase === "error" ? "alert" : "status"}>{report.error || (report.phase === "loading" ? "리소스 공수 정보를 불러오는 중입니다." : `공수 정보 확인 완료 · ${report.confirmedAt ? new Date(report.confirmedAt).toLocaleString("ko-KR") : ""}`)}{data && stale ? ` 이전 성공 결과입니다 (${data.range.from} ~ ${data.range.to}, 검색: ${data.filters.search || "전체"}). 최신 조건으로 확정하지 않으며 상세를 잠급니다.` : ""}</p>
      {report.phase === "error" ? <button type="button" className="secondary-button" onClick={refresh}>공수 다시 시도</button> : null}
      {report.phase === "error" || (data && data.projectRevision !== revision) ? <button className="secondary-button" type="button" disabled={refreshDisabled} onClick={onRefreshProject}>최신 일정 조회</button> : null}
      {detailStale === data?.snapshotId ? <p role="alert">상세 조회 중 데이터 변경을 확인했습니다. 새로고침한 뒤 상세를 다시 열어 주세요.</p> : null}
    </div>
    {data ? <>
      <p className="resource-dashboard-hint">선택 범위: {data.range.from} ~ {data.range.to}{data.rangeFallback ? " · 빈 프로젝트의 기준일 범위" : ""} · 지연 기준일 {data.asOfDate} ({data.timezone}) · M/M 기준: {data.mdPerMm === null ? "미설정 · 전환 불가" : `1 M/M = ${data.mdPerMm} M/D (${data.mdPerMmSource === "query" ? "조회 조건" : "환경 설정"})`}</p>
      <dl className="resource-dashboard-kpis" aria-label="선택 범위 KPI">
        <div><dt>계획 공수</dt><dd>{plannedEffort(data.summary.effort, displayUnit)}</dd></div><div><dt>할당 Resource</dt><dd>{data.summary.resourceCount}명</dd></div>
        <div><dt>할당 Task</dt><dd><button type="button" disabled={stale} onClick={(event) => openMetric(data.summary, "all", "선택 범위 할당 Task", event.currentTarget)}>{data.summary.taskCount}건</button></dd></div>
        <div><dt>완료 Task / 완료율</dt><dd><button type="button" disabled={stale} onClick={(event) => openMetric(data.summary, "completed", "완료 Task", event.currentTarget)}>{data.summary.completed}건</button> / {percent(data.summary.completion.percent)}</dd></div>
        <div><dt>지연 Task</dt><dd><button type="button" disabled={stale} onClick={(event) => openMetric(data.summary, "delayed", "지연 Task", event.currentTarget)}>{data.summary.delayed}건</button></dd></div>
        <div><dt>공수 미설정</dt><dd><button type="button" disabled={stale} onClick={(event) => openMetric(data.summary, "unset", "공수 미설정 Assignment", event.currentTarget)}>{data.summary.effort.unsetCount}건</button></dd></div>
      </dl>
      <dl className="resource-dashboard-kpis" aria-label="Global Role별 계획 공수">{ROLE_OPTIONS.map(([role, label]) => { const total = data.roleTotals.find((entry) => entry.role === role); return <div key={role}><dt>{label}</dt><dd>{total ? plannedEffort(total.summary.effort, displayUnit) : `0.00 ${displayUnit === "md" ? "M/D" : "M/M"}`}</dd><small>{total?.summary.assignmentCount ?? 0} Assignment</small></div>; })}</dl>
      <p className="resource-dashboard-hint">¹ 투입 시작/종료는 선택 기간으로 자른 Assignment 구간입니다. Grand Total은 선택 Assignment를 한 번만 합산합니다. 복수 그룹·Global Role에 같은 Task/개인이 반복될 수 있어 소계는 서로 더하지 않습니다. 할당 작업 진척은 계획기간 가중값이며 개인의 실제 기여도·소진 공수가 아닙니다.</p>
      <div className="resource-dashboard-table-scroll" role="region" tabIndex={0} aria-label={mode === "group" ? "그룹 현황" : "개인 현황"}><table className="resource-dashboard-table"><DashboardHeaders />{(mode === "group" ? data.groups : data.resources).map((row) => summaryRow(row, mode))}</table></div>
      {(mode === "group" ? data.groups : data.resources).length === 0 ? <p className="resource-workload-empty">{data.diagnostics.denominator === 0 && !selectedCount ? "프로젝트에 일반 Task가 없습니다." : "검색 조건에 일치하는 리소스 할당이 없습니다."}</p> : null}
      <details className="resource-dashboard-diagnostics"><summary>보조 진단 · 개인 조건 적용 전 작업범위 T0 ({data.diagnostics.denominator} Task)</summary><p>개인·역할·등급·그룹·활성 소속·개인 검색 조건은 이 진단에 적용하지 않습니다. 기간·Milestone·작업 상태·작업 검색의 고유 Task 기준입니다.</p><div className="resource-dashboard-diagnostic-actions">{([["개인 미배정", data.diagnostics.personallyUnassigned], ["Group만 지정", data.diagnostics.groupOnly], ["완전 미할당", data.diagnostics.completelyUnassigned]] as const).map(([label, item]) => <button key={label} type="button" className="secondary-button" disabled={stale} onClick={(event) => openDetail(item.selector, label, "tasks", event.currentTarget)}>{label} {item.count}건</button>)}</div><p>Milestone 미지정은 Milestone 필터로 조회합니다. 개인 미배정 Task의 공수는 추정하지 않습니다.</p></details>
      {selection && selection.snapshotId === data.snapshotId && selection.queryKey === queryKey ? <FocusRestoreBoundary key={`${selection.snapshotId}:${selection.queryKey}`} onRestore={() => { if (detailTrigger.current?.isConnected && !detailTrigger.current.matches(":disabled")) detailTrigger.current.focus({ preventScroll: true }); else search.current?.focus({ preventScroll: true }); }}><section className="resource-dashboard-selected" aria-label={selection.label} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeDetail(); } }}><h3 ref={detailHeading} tabIndex={-1}>{selection.label}</h3><button type="button" className="secondary-button" onClick={closeDetail}>상세 닫기</button><ResourceDashboardDetails key={`${data.snapshotId}:${JSON.stringify(selection.selector)}`} data={data} selector={selection.selector} view={selection.view} unit={displayUnit} stale={stale} onStale={markStale} /></section></FocusRestoreBoundary> : null}
    </> : null}
  </section>;
}
function DashboardHeaders() { return <thead><tr><th>그룹 / 개인</th><th>고유 Task</th><th>완료</th><th>진행</th><th>지연</th><th>할당 작업 진척</th><th>투입 시작¹</th><th>투입 종료¹</th><th>계획 공수</th><th>공수 설정</th></tr></thead>; }

function FocusRestoreBoundary({ children, onRestore }: { children: ReactNode; onRestore: () => void }) {
  const root = useRef<HTMLDivElement>(null), restore = useRef(onRestore);
  useLayoutEffect(() => { restore.current = onRestore; }, [onRestore]);
  useLayoutEffect(() => { const element = root.current; return () => { if (element?.contains(document.activeElement)) queueMicrotask(() => restore.current()); }; }, []);
  return <div ref={root}>{children}</div>;
}
