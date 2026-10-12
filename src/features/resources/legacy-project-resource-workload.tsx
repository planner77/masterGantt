"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  AssignmentTargetDto,
  DeveloperGrade,
  ResourceWorkloadResponse,
  ResourceWorkloadRole,
  ResourceWorkloadTaskDto,
} from "@/contracts/resources";
import { resourceDrillMatches, resourceDrillRevisionMatches, type MilestoneResourceDrill } from "./milestone-resource-drill";

type Unit = "md" | "mm";
type ActiveFilter = "all" | "active" | "inactive";
type KindFilter = "all" | "resource" | "group";
type RoleFilter = "all" | ResourceWorkloadRole;
type GradeFilter = "all" | DeveloperGrade;

type Props = Readonly<{ publicId: string; drillScope?: MilestoneResourceDrill | null; onClearDrillScope?: () => void }>;
type Source = "workload" | "targets";
type QueryState<T> = Readonly<{
  publicId: string;
  queryKey?: string;
  value: T | null;
  phase: "loading" | "ready" | "error";
  lastSuccessAt: string | null;
  retrying: boolean;
}>;

const ROLE_OPTIONS: Array<{ value: ResourceWorkloadRole; label: string }> = [
  { value: "PI", label: "PI" },
  { value: "DEVELOPER", label: "개발자" },
  { value: "EQUIPMENT_OWNER", label: "설비 담당" },
  { value: "UNSPECIFIED", label: "Global Role 미지정" },
];
const GRADE_OPTIONS: Array<{ value: DeveloperGrade; label: string }> = [
  { value: "BEGINNER", label: "초급" },
  { value: "INTERMEDIATE", label: "중급" },
  { value: "ADVANCED", label: "고급" },
  { value: "EXPERT", label: "특급" },
];

function initialQueryState<T>(publicId: string): QueryState<T> {
  return { publicId, value: null, phase: "loading", lastSuccessAt: null, retrying: false };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nullableString(value: unknown): boolean { return value === null || typeof value === "string"; }
function nullableNumber(value: unknown): boolean { return value === null || typeof value === "number"; }

function workloadFrom(body: unknown): ResourceWorkloadResponse["data"] | null {
  if (!record(body)) return null;
  const data = body.data;
  if (!record(data) || typeof data.projectRevision !== "number" || typeof data.catalogRevision !== "number" ||
    !record(data.range) || typeof data.range.from !== "string" || typeof data.range.to !== "string" ||
    typeof data.grandTotalMd !== "number" || !nullableNumber(data.grandTotalMm) ||
    !nullableNumber(data.mdPerMm) || typeof data.unsetCount !== "number" || !Array.isArray(data.groups)) return null;
  if (data.roleTotals !== undefined && (!Array.isArray(data.roleTotals) || !data.roleTotals.every((total: unknown) =>
    record(total) && ["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"].includes(String(total.role)) &&
    typeof total.assignmentCount === "number" && typeof total.effortMd === "number" &&
    nullableNumber(total.effortMm) && typeof total.unsetCount === "number"))) return null;
  if (!data.groups.every((group: unknown) => record(group) && nullableString(group.id) &&
    typeof group.name === "string" && typeof group.active === "boolean" &&
    nullableString(group.start) && nullableString(group.end) &&
    typeof group.effortMd === "number" && nullableNumber(group.effortMm) &&
    typeof group.unsetCount === "number" && Array.isArray(group.resources) &&
    group.resources.every((resource: unknown) => record(resource) &&
      typeof resource.id === "string" && typeof resource.name === "string" && nullableString(resource.code) &&
      typeof resource.active === "boolean" && nullableString(resource.start) && nullableString(resource.end) &&
      typeof resource.effortMd === "number" && nullableNumber(resource.effortMm) &&
      typeof resource.unsetCount === "number" && typeof resource.overAllocated === "boolean" &&
      Array.isArray(resource.tasks) && resource.tasks.every((task: unknown) => record(task) &&
        typeof task.assignmentId === "string" && typeof task.taskId === "string" &&
        typeof task.taskName === "string" && typeof task.effortConfigured === "boolean" &&
        typeof task.start === "string" && typeof task.end === "string" &&
        nullableNumber(task.allocationPercent) && nullableNumber(task.effortMd) && nullableNumber(task.effortMm))))) return null;
  return data as ResourceWorkloadResponse["data"];
}

function targetsFrom(body: unknown): AssignmentTargetDto[] | null {
  if (!record(body) || !record(body.data) ||
    typeof body.data.projectRevision !== "number" || typeof body.data.catalogRevision !== "number" ||
    !Array.isArray(body.data.assignments) || !Array.isArray(body.data.targets)) return null;
  if (!body.data.assignments.every((assignment: unknown) => record(assignment) &&
    typeof assignment.id === "string" && typeof assignment.taskId === "string" &&
    record(assignment.target) && (assignment.target.kind === "resource" || assignment.target.kind === "group") &&
    typeof assignment.target.id === "string")) return null;
  if (!body.data.targets.every((target: unknown) => record(target) &&
    (target.kind === "resource" || target.kind === "group") &&
    typeof target.id === "string" && typeof target.name === "string" &&
    nullableString(target.code) && typeof target.active === "boolean" &&
    (target.description === undefined || typeof target.description === "string"))) return null;
  return body.data.targets as AssignmentTargetDto[];
}

function confirmedAt(iso: string | null): string { return iso ? new Date(iso).toLocaleString("ko-KR") : ""; }
function effort(md: number, mm: number | null, unit: Unit): string {
  if (unit === "mm") return mm === null ? "—" : `${mm.toFixed(2)} M/M`;
  return `${md.toFixed(2)} M/D`;
}
function roleLabels(roles: readonly string[] | undefined): string {
  if (!roles || roles.length === 0) return "Global Role 미지정";
  return roles.map((role) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role).join(", ");
}
function gradeLabel(grade: DeveloperGrade | null | undefined): string {
  return GRADE_OPTIONS.find((option) => option.value === grade)?.label ?? "등급 미지정";
}
function statusLabel(status: ResourceWorkloadTaskDto["status"]): string {
  if (status === "completed") return "완료";
  if (status === "in_progress") return "진행 중";
  if (status === "not_started") return "시작 전";
  return "상태 미지정";
}
function includesText(target: AssignmentTargetDto | undefined, fallbackName: string, query: string, fallbackCode: string | null = null): boolean {
  if (!query) return true;
  const needle = query.trim().toLocaleLowerCase();
  return [target?.name ?? fallbackName, target?.code ?? fallbackCode ?? "", target?.description ?? ""]
    .some((value) => value.toLocaleLowerCase().includes(needle));
}
function overlaps(start: string, end: string, from: string, to: string): boolean {
  if (!from || !to) return true;
  const low = from <= to ? from : to;
  const high = from <= to ? to : from;
  return start <= high && end >= low;
}
function minTaskDate(tasks: ResourceWorkloadTaskDto[], field: "start" | "end"): string | null {
  return tasks.length ? tasks.map((task) => task[field]).reduce((a, b) => a < b ? a : b) : null;
}
function maxTaskDate(tasks: ResourceWorkloadTaskDto[], field: "start" | "end"): string | null {
  return tasks.length ? tasks.map((task) => task[field]).reduce((a, b) => a > b ? a : b) : null;
}

export function LegacyProjectResourceWorkload({ publicId, drillScope = null, onClearDrillScope }: Props) {
  const [workloadQuery, setWorkloadQuery] = useState<QueryState<ResourceWorkloadResponse["data"]>>(() => initialQueryState(publicId));
  const [targetsQuery, setTargetsQuery] = useState<QueryState<AssignmentTargetDto[]>>(() => initialQueryState(publicId));
  const currentPublicId = useRef(publicId);
  const requestId = useRef<Record<Source, number>>({ workload: 0, targets: 0 });
  const requestControllers = useRef<Record<Source, AbortController | null>>({ workload: null, targets: null });
  const [unit, setUnit] = useState<Unit>("md");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => { currentPublicId.current = publicId; }, [publicId]);
  const drillFrom = drillScope?.from, drillTo = drillScope?.to;
  const drillRevision = drillScope ? `${drillScope.projectRevision}:${drillScope.catalogRevision}` : "";
  const workloadKey = `${publicId}:${drillFrom ?? ""}:${drillTo ?? ""}:${drillRevision}`;

  const loadSource = useCallback(async (source: Source, retrying = false) => {
    const id = ++requestId.current[source];
    requestControllers.current[source]?.abort();
    const controller = new AbortController();
    requestControllers.current[source] = controller;
    if (source === "workload") setWorkloadQuery((previous) => ({
      ...(previous.publicId === publicId ? previous : initialQueryState(publicId)), queryKey: workloadKey, phase: "loading", retrying,
    }));
    else setTargetsQuery((previous) => ({
      ...(previous.publicId === publicId ? previous : initialQueryState(publicId)), phase: "loading", retrying,
    }));
    try {
      const endpoint = source === "workload" ? "resource-workload" : "assigned-targets";
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/${endpoint}${source === "workload" && drillFrom && drillTo ? `?${new URLSearchParams({ from: drillFrom, to: drillTo })}` : ""}`, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("request failed");
      const fresh = source === "workload" ? workloadFrom(body) : targetsFrom(body);
      if (!fresh) throw new Error("invalid response");
      if (source === "workload" && drillFrom && drillTo) {
        const snapshot = fresh as ResourceWorkloadResponse["data"];
        if (`${snapshot.projectRevision}:${snapshot.catalogRevision}` !== drillRevision) throw new Error("revision mismatch");
        const range = snapshot.range;
        if (range.from !== drillFrom || range.to !== drillTo) throw new Error("range mismatch");
      }
      if (controller.signal.aborted || id !== requestId.current[source] || currentPublicId.current !== publicId) return;
      const lastSuccessAt = new Date().toISOString();
      if (source === "workload") setWorkloadQuery({ publicId, queryKey: workloadKey, value: fresh as ResourceWorkloadResponse["data"], phase: "ready", lastSuccessAt, retrying: false });
      else setTargetsQuery({ publicId, value: fresh as AssignmentTargetDto[], phase: "ready", lastSuccessAt, retrying: false });
    } catch {
      if (controller.signal.aborted || id !== requestId.current[source] || currentPublicId.current !== publicId) return;
      if (source === "workload") setWorkloadQuery((previous) => ({
        ...(previous.publicId === publicId ? previous : initialQueryState<ResourceWorkloadResponse["data"]>(publicId)), queryKey: workloadKey, phase: "error", retrying: false,
      }));
      else setTargetsQuery((previous) => ({
        ...(previous.publicId === publicId ? previous : initialQueryState<AssignmentTargetDto[]>(publicId)), phase: "error", retrying: false,
      }));
    } finally {
      if (requestControllers.current[source] === controller) requestControllers.current[source] = null;
    }
  }, [publicId, drillFrom, drillTo, drillRevision, workloadKey]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadSource("workload");
      void loadSource("targets");
    });
    return () => {
      active = false;
      for (const source of ["workload", "targets"] as const) {
        ++requestId.current[source];
        requestControllers.current[source]?.abort();
        requestControllers.current[source] = null;
      }
    };
  }, [loadSource]);

  const currentWorkload = workloadQuery.publicId === publicId && workloadQuery.queryKey === workloadKey ? workloadQuery : initialQueryState<ResourceWorkloadResponse["data"]>(publicId);
  const currentTargets = targetsQuery.publicId === publicId ? targetsQuery : initialQueryState<AssignmentTargetDto[]>(publicId);
  const data = currentWorkload.value;
  const targets = currentTargets.value ?? [];
  const targetByKey = useMemo(() => new Map(targets.map((target) => [`${target.kind}:${target.id}`, target])), [targets]);
  const drillCurrent = !drillScope || (currentWorkload.phase === "ready" && data !== null && resourceDrillRevisionMatches(drillScope, data) && data.range.from === drillScope.from && data.range.to === drillScope.to);

  const filteredGroups = useMemo(() => {
    if (!data || !drillCurrent) return [];
    const taskFilterActive = roleFilter !== "all" || Boolean(dateFrom && dateTo) || drillScope !== null;
    const memberScopeActive = taskFilterActive || gradeFilter !== "all";
    return data.groups.flatMap((group) => {
      const groupTarget = group.id ? targetByKey.get(`group:${group.id}`) : undefined;
      const groupMatchesText = includesText(groupTarget, group.name, query);
      const groupMatchesActive = activeFilter === "all" || (activeFilter === "active" ? group.active : !group.active);

      const scopedMembers = group.resources.flatMap((resource) => {
        const gradeMatch = gradeFilter === "all" || resource.developerGrade === gradeFilter;
        const tasks = resource.tasks.filter((task) =>
          (!drillScope || resourceDrillMatches(drillScope, resource.id, task)) &&
          overlaps(task.start, task.end, dateFrom, dateTo) &&
          (roleFilter === "all" ||
            (roleFilter === "UNSPECIFIED" ? (task.roles?.length ?? 0) === 0 : (task.roles ?? []).includes(roleFilter))));
        if (!gradeMatch || (taskFilterActive && tasks.length === 0)) return [];
        return [{ resource, tasks }];
      });

      if (kindFilter === "group") {
        if (drillScope) return [];
        const memberScopeMatch = !memberScopeActive || scopedMembers.length > 0;
        if (!groupMatchesText || !groupMatchesActive || !memberScopeMatch) return [];
        return [{ ...group, resources: group.resources }];
      }

      const resources = scopedMembers.flatMap(({ resource, tasks }) => {
        const resourceTarget = targetByKey.get(`resource:${resource.id}`);
        const textMatch = includesText(resourceTarget, resource.name, query, resource.code);
        const activeMatch = activeFilter === "all" || (activeFilter === "active" ? resource.active : !resource.active);
        if (!textMatch || !activeMatch) return [];
        const effortMd = tasks.reduce((sum, task) => sum + (task.effortMd ?? 0), 0);
        return [{
          ...resource,
          start: minTaskDate(tasks, "start"),
          end: maxTaskDate(tasks, "end"),
          effortMd,
          effortMm: data.mdPerMm === null ? null : effortMd / data.mdPerMm,
          unsetCount: tasks.filter((task) => task.effortMd === null).length,
          tasks,
        }];
      });

      const groupDirectMatch = kindFilter !== "resource" && !memberScopeActive && groupMatchesText && groupMatchesActive;
      if (!groupDirectMatch && resources.length === 0) return [];
      const effortMd = resources.reduce((sum, resource) => sum + resource.effortMd, 0);
      return [{
        ...group,
        start: resources.map((resource) => resource.start).filter((value): value is string => value !== null).sort()[0] ?? null,
        end: resources.map((resource) => resource.end).filter((value): value is string => value !== null).sort().at(-1) ?? null,
        effortMd,
        effortMm: data.mdPerMm === null ? null : effortMd / data.mdPerMm,
        unsetCount: resources.reduce((sum, resource) => sum + resource.unsetCount, 0),
        resources,
      }];
    });
  }, [activeFilter, data, dateFrom, dateTo, gradeFilter, kindFilter, query, roleFilter, targetByKey, drillScope, drillCurrent]);

  const visibleResourceCount = new Set(filteredGroups.flatMap((group) => group.resources.map((resource) => resource.id))).size;
  const visibleGroupCount = filteredGroups.filter((group) => group.id !== null).length;
  const appliedFilterCount = Number(Boolean(query.trim())) + Number(activeFilter !== "all") + Number(kindFilter !== "all") +
    Number(roleFilter !== "all") + Number(gradeFilter !== "all") + Number(Boolean(dateFrom && dateTo));
  const hasFilterInput = appliedFilterCount > 0 || Boolean(dateFrom || dateTo);
  const totalGroupCount = data?.groups.filter((group) => group.id !== null).length ?? 0;
  const totalResourceCount = data ? new Set(data.groups.flatMap((group) => group.resources.map((resource) => resource.id))).size : 0;
  const resetFilters = () => {
    setQuery(""); setActiveFilter("all"); setKindFilter("all"); setRoleFilter("all"); setGradeFilter("all"); setDateFrom(""); setDateTo("");
    requestAnimationFrame(() => searchInput.current?.focus({ preventScroll: true }));
  };
  const developerEstimateActive = roleFilter === "DEVELOPER" && kindFilter === "resource";
  const toggleDeveloperEstimate = () => {
    if (developerEstimateActive) {
      setRoleFilter("all");
      setKindFilter("all");
      setGradeFilter("all");
    } else {
      setRoleFilter("DEVELOPER");
      setKindFilter("resource");
    }
  };

  const roleTotals = data?.roleTotals ?? [];
  const totalForRole = (role: ResourceWorkloadRole) => roleTotals.find((total) => total.role === role);
  const overAllocatedCount = data?.overAllocatedResourceCount ?? (data
    ? new Set(data.groups.flatMap((group) => group.resources.filter((resource) => resource.overAllocated).map((resource) => resource.id))).size
    : 0);
  const workloadLoading = currentWorkload.phase === "loading";
  const targetsLoading = currentTargets.phase === "loading";
  const refreshAll = () => { void loadSource("workload"); void loadSource("targets"); };

  return (
    <section aria-labelledby="resource-workload-heading" className="project-resource-workload">
      {drillScope ? <div className="resource-workload-note" role="status">
        <strong>Milestone에서 전달한 개인 assignment 표시 범위</strong> · {drillScope.from} ~ {drillScope.to} · Revision {drillScope.projectRevision}/{drillScope.catalogRevision}
        <p>Milestone Dashboard 범위 공수: {effort(drillScope.plannedMd, drillScope.plannedMm, "md")}{drillScope.plannedMm === null ? " · M/M 미설정" : ` / ${effort(drillScope.plannedMd, drillScope.plannedMm, "mm")}`}. 아래 행과 표시 subtotal은 같은 기간을 기존 Resource 서버 계산으로 조회한 뒤 전달된 assignment ID와 기존 필터를 적용합니다. 상단 전체 합계는 같은 기간의 Project 전체 값입니다. Milestone 공수는 반올림 전 합계이며 Resource는 기존 반올림 기준을 사용합니다. Milestone의 명시 M/M 환산 기준은 Resource에 전달하지 않습니다. Resource 환산 기준은 {data?.mdPerMm === null || data?.mdPerMm === undefined ? "미설정" : `${data.mdPerMm} M/D = 1 M/M (환경 설정)`}입니다.</p>
        {!drillCurrent ? <p>리소스 응답 Revision이 전달한 범위와 다릅니다. 최신 Milestone에서 다시 진입하거나 범위를 해제해 주세요.</p> : null}
        <button type="button" className="secondary-button" onClick={onClearDrillScope}>Milestone 전달 범위 해제</button>
      </div> : null}
      <div className="resource-workload-header">
        <div>
          <h2 id="resource-workload-heading">리소스 공수</h2>
          <p>Global Role·그룹·리소스·작업별 계획 공수와 현재 작업 상태를 함께 확인합니다.</p>
        </div>
        <div className="resource-workload-toolbar" role="toolbar" aria-label="리소스 공수 도구">
          <button className={`secondary-button resource-estimate-button${developerEstimateActive ? " is-active" : ""}`} type="button" aria-pressed={developerEstimateActive} onClick={toggleDeveloperEstimate}>개발 견적</button>
          <div className="project-gantt-scale-controls" role="group" aria-label="공수 표시 단위">
            <button type="button" aria-pressed={unit === "md"} onClick={() => setUnit("md")}>M/D</button>
            <button type="button" aria-pressed={unit === "mm"} disabled={!data?.mdPerMm}
              title={data?.mdPerMm ? undefined : "프로젝트의 M/M 환산 기준이 설정되지 않았습니다."}
              onClick={() => setUnit("mm")}>M/M</button>
          </div>
          <button className="secondary-button resource-refresh-button" type="button" onClick={refreshAll} disabled={workloadLoading || targetsLoading}>
            {workloadLoading || targetsLoading ? "조회 중…" : "새로고침"}
          </button>
        </div>
      </div>

      <div className="project-filter-toolbar resource-filter-toolbar" role="search" aria-label="리소스 검색과 필터">
        <input ref={searchInput} aria-label="리소스 또는 그룹 이름과 코드 검색" placeholder="이름 또는 코드 검색" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button ref={filterTrigger} className="secondary-button resource-filter-trigger" type="button" aria-controls="resource-advanced-filter" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>필터{appliedFilterCount ? ` ${appliedFilterCount}` : ""}</button>
        {hasFilterInput ? <button className="secondary-button resource-filter-reset" type="button" onClick={resetFilters}>초기화</button> : null}
        <span className="project-filter-result resource-filter-result" role="status">{data
          ? `그룹 ${visibleGroupCount} / 전체 ${totalGroupCount} · 리소스 ${visibleResourceCount} / 전체 ${totalResourceCount}`
          : currentWorkload.phase === "error" ? "조회 결과 없음 · 공수 조회 실패" : "공수 조회 중…"}</span>
      </div>
      <div id="resource-advanced-filter" className="project-filter-panel resource-filter-panel" hidden={!filterOpen}
        aria-label="리소스 고급 필터" onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault(); event.stopPropagation(); setFilterOpen(false);
          requestAnimationFrame(() => filterTrigger.current?.focus({ preventScroll: true }));
        }}>
        <label>종류<select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as KindFilter)}><option value="all">전체</option><option value="resource">Resource</option><option value="group">Resource Group</option></select></label>
        <label>상태<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}><option value="all">전체</option><option value="active">활성</option><option value="inactive">비활성</option></select></label>
        <label>Global Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}><option value="all">전체</option>{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>개발자 등급<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value as GradeFilter)}><option value="all">전체</option>{GRADE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Task 기간 From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Task 기간 To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        {Boolean(dateFrom) !== Boolean(dateTo) ? <p className="resource-filter-date-note" role="status">기간 시작일과 종료일을 모두 입력해 주세요. 기간 조건은 아직 적용되지 않습니다.</p> : null}
        {dateFrom && dateTo && dateFrom > dateTo ? <p className="resource-filter-date-note" role="status">시작일이 종료일보다 늦어 두 날짜 사이의 범위로 검색합니다.</p> : null}
      </div>

      <div className="resource-workload-statuses" aria-label="리소스 조회 상태">
        <div className={`resource-workload-status${currentWorkload.phase === "error" ? " resource-workload-status-error" : ""}`} data-source="workload" data-state={currentWorkload.phase}>
          <p role={currentWorkload.phase === "error" ? "alert" : "status"}>
            {workloadLoading
              ? data ? `공수 정보를 새로고침하는 중입니다. 마지막 성공 ${confirmedAt(currentWorkload.lastSuccessAt)} 결과를 표시합니다.` : "리소스 공수 정보를 불러오는 중입니다."
              : currentWorkload.phase === "error"
                ? data ? `공수 정보 새로고침에 실패했습니다. 마지막 성공 ${confirmedAt(currentWorkload.lastSuccessAt)} 결과를 표시합니다.` : "리소스 공수 정보를 불러오지 못했습니다."
                : `공수 정보 확인 완료 · ${confirmedAt(currentWorkload.lastSuccessAt)}`}
          </p>
          {currentWorkload.phase === "error" || currentWorkload.retrying ? <button className="secondary-button" type="button" aria-disabled={currentWorkload.retrying || undefined} aria-busy={currentWorkload.retrying || undefined} onClick={() => { if (!currentWorkload.retrying) void loadSource("workload", true); }}>{currentWorkload.retrying ? "공수 재시도 중…" : "공수 다시 시도"}</button> : null}
        </div>
        <div className={`resource-workload-status${currentTargets.phase === "error" ? " resource-workload-status-error" : ""}`} data-source="targets" data-state={currentTargets.phase}>
          <p role={currentTargets.phase === "error" ? "alert" : "status"}>
            {targetsLoading
              ? currentTargets.value ? `이름·코드 정보를 새로고침하는 중입니다. 마지막 성공 ${confirmedAt(currentTargets.lastSuccessAt)} 정보를 표시합니다.` : "리소스 이름·코드 정보를 불러오는 중입니다."
              : currentTargets.phase === "error"
                ? currentTargets.value ? `이름·코드·설명 정보 새로고침에 실패했습니다. 마지막 성공 ${confirmedAt(currentTargets.lastSuccessAt)} 정보를 표시합니다.` : "리소스 이름·코드·설명 정보를 불러오지 못했습니다. Group·Resource 기본 이름과 Resource 코드는 유지되며 Group 코드와 설명 검색은 사용할 수 없습니다."
                : `이름·코드 정보 확인 완료 · ${confirmedAt(currentTargets.lastSuccessAt)}`}
          </p>
          {currentTargets.phase === "error" || currentTargets.retrying ? <button className="secondary-button" type="button" aria-disabled={currentTargets.retrying || undefined} aria-busy={currentTargets.retrying || undefined} onClick={() => { if (!currentTargets.retrying) void loadSource("targets", true); }}>{currentTargets.retrying ? "이름·코드 재시도 중…" : "이름·코드 다시 시도"}</button> : null}
        </div>
      </div>

      {data ? (
        <>
          <dl className="resource-workload-summary" aria-label="리소스 공수 요약">
            <div><dt>조회 범위</dt><dd>{data.range.from} ~ {data.range.to}</dd></div>
            <div><dt>전체 계획 공수</dt><dd>{effort(data.grandTotalMd, data.grandTotalMm, unit)}</dd></div>
            <div><dt>공수 미설정</dt><dd>{data.unsetCount}건</dd></div>
            <div><dt>과투입 리소스</dt><dd>{overAllocatedCount}개</dd></div>
          </dl>
          <dl className="resource-role-summary" aria-label="Global Role별 계획 공수">
            {ROLE_OPTIONS.map((option) => {
              const total = totalForRole(option.value);
              return <div key={option.value}>
                <dt>{option.label}</dt>
                <dd>{effort(total?.effortMd ?? 0, total?.effortMm ?? (data.mdPerMm === null ? null : 0), unit)}</dd>
                <span>{total?.assignmentCount ?? 0}건{total?.unsetCount ? ` · 공수 미설정 ${total.unsetCount}` : ""}</span>
              </div>;
            })}
          </dl>

          <p className="resource-workload-note">Global Role별 집계는 같은 assignment가 복수 Global Role에 중복 포함될 수 있는 비가산 분류 보기입니다. 역할별 값을 서로 더해 전체 계획 공수로 해석하지 않으며, 전체 합계는 assignmentId 기준으로 정확히 한 번만 계산합니다. 아래 필터는 drill-down 표시 범위와 표시 subtotal만 제한합니다.</p>
          {data.asOfDate ? <p className="resource-workload-note">작업 지연 기준일: {data.asOfDate}{data.timezone ? ` (${data.timezone})` : ""}. 계획 공수는 진행률로 차감하거나 실제 소진 공수로 환산하지 않습니다.</p> : null}
          {data.mdPerMm
            ? <p className="resource-workload-note">M/M 환산 기준: 1 M/M = {data.mdPerMm} M/D</p>
            : <p className="resource-workload-note">M/M 환산 기준이 설정되지 않아 M/M 보기는 사용할 수 없습니다.</p>}

          <div className="resource-workload-groups">
            {filteredGroups.length === 0 ? (
              <p className="resource-workload-empty">검색 조건에 일치하는 리소스 할당이 없습니다.</p>
            ) : filteredGroups.map((group) => (
              <details className="resource-workload-group" key={group.id ?? "ungrouped"} open>
                <summary>
                  <span className="resource-workload-name">{group.id ? targetByKey.get(`group:${group.id}`)?.name ?? group.name : group.name}</span>
                  <span>{group.start ?? "—"} ~ {group.end ?? "—"}</span>
                  <span>{effort(group.effortMd, group.effortMm, unit)}</span>
                  {group.unsetCount ? <span className="status-badge warning">미설정 {group.unsetCount}</span> : null}
                </summary>
                <div className="resource-workload-resources">
                  {group.resources.map((resource) => (
                    <details className="resource-workload-resource" key={`${group.id ?? "ungrouped"}:${resource.id}`}>
                      <summary>
                        <span className="resource-workload-name">{targetByKey.get(`resource:${resource.id}`)?.name ?? resource.name}{(targetByKey.get(`resource:${resource.id}`)?.code ?? resource.code) ? ` (${targetByKey.get(`resource:${resource.id}`)?.code ?? resource.code})` : ""}</span>
                        <span>{resource.start ?? "—"} ~ {resource.end ?? "—"}</span>
                        <span>{effort(resource.effortMd, resource.effortMm, unit)}</span>
                        {resource.developerGrade ? <span className="status-badge">{gradeLabel(resource.developerGrade)}</span> : null}
                        {!resource.active ? <span className="status-badge">비활성</span> : null}
                        {resource.overAllocated ? <span className="status-badge danger" title="과투입은 전체 assignment의 일별 투입률 합계 기준입니다.">과투입</span> : null}
                        {resource.unsetCount ? <span className="status-badge warning">미설정 {resource.unsetCount}</span> : null}
                      </summary>
                      <div className="resource-workload-table-scroll">
                        <table className="resource-workload-table">
                          <thead>
                            <tr>
                              <th>작업</th><th>Global Role</th><th>상태</th><th>진행률</th><th>일정</th>
                              <th>투입 시작</th><th>투입 종료</th><th>투입률</th><th>공수</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resource.tasks.map((task) => (
                              <tr key={task.assignmentId}>
                                <td>{task.taskName}</td>
                                <td>{roleLabels(task.roles)}</td>
                                <td>{task.delayed ? <span className="status-badge danger">지연</span> : statusLabel(task.status)}</td>
                                <td>{task.progress === null || task.progress === undefined ? "—" : `${task.progress}%`}</td>
                                <td>{task.taskStart && task.taskEnd ? `${task.taskStart} ~ ${task.taskEnd}` : "—"}</td>
                                <td>{task.start}</td>
                                <td>{task.end}</td>
                                <td>{task.allocationPercent === null ? "미설정" : `${task.allocationPercent}%`}</td>
                                <td>{task.effortMd === null ? "공수 미설정" : effort(task.effortMd, task.effortMm, unit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
