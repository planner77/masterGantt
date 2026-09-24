"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { AssignmentTargetDto, ResourceWorkloadResponse } from "@/contracts/resources";

type Unit = "md" | "mm";
type ActiveFilter = "all" | "active" | "inactive";
type KindFilter = "all" | "resource" | "group";

type Props = Readonly<{ publicId: string }>;
type Source = "workload" | "targets";
type QueryState<T> = Readonly<{
  publicId: string;
  value: T | null;
  phase: "loading" | "ready" | "error";
  lastSuccessAt: string | null;
}>;

function initialQueryState<T>(publicId: string): QueryState<T> {
  return { publicId, value: null, phase: "loading", lastSuccessAt: null };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function nullableNumber(value: unknown): boolean {
  return value === null || typeof value === "number";
}

function workloadFrom(body: unknown): ResourceWorkloadResponse["data"] | null {
  if (!record(body)) return null;
  const data = body.data;
  if (!record(data) || typeof data.projectRevision !== "number" || typeof data.catalogRevision !== "number" ||
    !record(data.range) || typeof data.range.from !== "string" || typeof data.range.to !== "string" ||
    typeof data.grandTotalMd !== "number" || !nullableNumber(data.grandTotalMm) ||
    !nullableNumber(data.mdPerMm) || typeof data.unsetCount !== "number" || !Array.isArray(data.groups)) return null;
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

function confirmedAt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR") : "";
}

function effort(md: number, mm: number | null, unit: Unit): string {
  if (unit === "mm") return mm === null ? "—" : `${mm.toFixed(2)} M/M`;
  return `${md.toFixed(2)} M/D`;
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

export function ProjectResourceWorkload({ publicId }: Props) {
  const [workloadQuery, setWorkloadQuery] = useState<QueryState<ResourceWorkloadResponse["data"]>>(() => initialQueryState(publicId));
  const [targetsQuery, setTargetsQuery] = useState<QueryState<AssignmentTargetDto[]>>(() => initialQueryState(publicId));
  const currentPublicId = useRef(publicId);
  const requestId = useRef<Record<Source, number>>({ workload: 0, targets: 0 });
  const requestControllers = useRef<Record<Source, AbortController | null>>({ workload: null, targets: null });
  const [unit, setUnit] = useState<Unit>("md");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useLayoutEffect(() => { currentPublicId.current = publicId; }, [publicId]);

  const loadSource = useCallback(async (source: Source) => {
    const id = ++requestId.current[source];
    requestControllers.current[source]?.abort();
    const controller = new AbortController();
    requestControllers.current[source] = controller;
    // Effect startup is asynchronous; cleanup can invalidate this request before any state update.
    await Promise.resolve();
    if (controller.signal.aborted || id !== requestId.current[source] || currentPublicId.current !== publicId) return;
    if (source === "workload") setWorkloadQuery((previous) => ({
      ...(previous.publicId === publicId ? previous : initialQueryState(publicId)), phase: "loading",
    }));
    else setTargetsQuery((previous) => ({
      ...(previous.publicId === publicId ? previous : initialQueryState(publicId)), phase: "loading",
    }));
    try {
      const endpoint = source === "workload" ? "resource-workload" : "assigned-targets";
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/${endpoint}`, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("request failed");
      const fresh = source === "workload" ? workloadFrom(body) : targetsFrom(body);
      if (!fresh) throw new Error("invalid response");
      if (controller.signal.aborted || id !== requestId.current[source] || currentPublicId.current !== publicId) return;
      const lastSuccessAt = new Date().toISOString();
      if (source === "workload") setWorkloadQuery({ publicId, value: fresh as ResourceWorkloadResponse["data"], phase: "ready", lastSuccessAt });
      else setTargetsQuery({ publicId, value: fresh as AssignmentTargetDto[], phase: "ready", lastSuccessAt });
    } catch {
      if (controller.signal.aborted || id !== requestId.current[source] || currentPublicId.current !== publicId) return;
      if (source === "workload") setWorkloadQuery((previous) => ({
        ...(previous.publicId === publicId ? previous : initialQueryState<ResourceWorkloadResponse["data"]>(publicId)), phase: "error",
      }));
      else setTargetsQuery((previous) => ({
        ...(previous.publicId === publicId ? previous : initialQueryState<AssignmentTargetDto[]>(publicId)), phase: "error",
      }));
    } finally {
      if (requestControllers.current[source] === controller) requestControllers.current[source] = null;
    }
  }, [publicId]);

  useEffect(() => {
    void loadSource("workload");
    void loadSource("targets");
    return () => {
      for (const source of ["workload", "targets"] as const) {
        ++requestId.current[source];
        requestControllers.current[source]?.abort();
        requestControllers.current[source] = null;
      }
    };
  }, [loadSource]);

  const currentWorkload = workloadQuery.publicId === publicId ? workloadQuery : initialQueryState<ResourceWorkloadResponse["data"]>(publicId);
  const currentTargets = targetsQuery.publicId === publicId ? targetsQuery : initialQueryState<AssignmentTargetDto[]>(publicId);
  const data = currentWorkload.value;
  const targets = currentTargets.value ?? [];

  const targetByKey = useMemo(() => new Map(targets.map((target) => [`${target.kind}:${target.id}`, target])), [targets]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    return data.groups.flatMap((group) => {
      const groupTarget = group.id ? targetByKey.get(`group:${group.id}`) : undefined;
      const groupMatchesText = includesText(groupTarget, group.name, query);
      const groupMatchesActive = activeFilter === "all" || (activeFilter === "active" ? group.active : !group.active);
      const resources = group.resources.flatMap((resource) => {
        const resourceTarget = targetByKey.get(`resource:${resource.id}`);
        const textMatch = includesText(resourceTarget, resource.name, query, resource.code);
        const activeMatch = activeFilter === "all" || (activeFilter === "active" ? resource.active : !resource.active);
        const tasks = resource.tasks.filter((task) => overlaps(task.start, task.end, dateFrom, dateTo));
        const dateMatch = !dateFrom || !dateTo || tasks.length > 0;
        if (!textMatch || !activeMatch || !dateMatch || kindFilter === "group") return [];
        return [{ ...resource, tasks }];
      });
      const groupDateMatch = !dateFrom || !dateTo || resources.length > 0 || group.resources.some((resource) => resource.tasks.some((task) => overlaps(task.start, task.end, dateFrom, dateTo)));
      const groupDirectMatch = kindFilter !== "resource" && groupMatchesText && groupMatchesActive && groupDateMatch;
      if (!groupDirectMatch && resources.length === 0) return [];
      return [{ ...group, resources: groupDirectMatch && kindFilter === "group" ? group.resources : resources }];
    });
  }, [activeFilter, data, dateFrom, dateTo, kindFilter, query, targetByKey]);

  const visibleResourceCount = new Set(filteredGroups.flatMap((group) => group.resources.map((resource) => resource.id))).size;
  const visibleGroupCount = filteredGroups.filter((group) => group.id !== null).length;
  const filterActive = Boolean(query.trim() || activeFilter !== "all" || kindFilter !== "all" || (dateFrom && dateTo));

  const overAllocatedCount = data
    ? new Set(
        data.groups.flatMap((group) =>
          group.resources.filter((resource) => resource.overAllocated).map((resource) => resource.id),
        ),
      ).size
    : 0;
  const workloadLoading = currentWorkload.phase === "loading";
  const targetsLoading = currentTargets.phase === "loading";
  const refreshAll = () => {
    void loadSource("workload");
    void loadSource("targets");
  };

  return (
    <section aria-labelledby="resource-workload-heading" className="project-resource-workload">
      <div className="resource-workload-header">
        <div>
          <h2 id="resource-workload-heading">리소스 공수</h2>
          <p>리소스 그룹 → 리소스 → 작업 계층으로 계획 투입 구간과 공수를 확인합니다.</p>
        </div>
        <div className="resource-workload-toolbar" role="toolbar" aria-label="리소스 공수 도구">
          <div className="project-gantt-scale-controls" role="group" aria-label="공수 표시 단위">
            <button type="button" aria-pressed={unit === "md"} onClick={() => setUnit("md")}>M/D</button>
            <button
              type="button"
              aria-pressed={unit === "mm"}
              disabled={!data?.mdPerMm}
              title={data?.mdPerMm ? undefined : "프로젝트의 M/M 환산 기준이 설정되지 않았습니다."}
              onClick={() => setUnit("mm")}
            >
              M/M
            </button>
          </div>
          <button className="secondary-button resource-refresh-button" type="button" onClick={refreshAll} disabled={workloadLoading || targetsLoading}>
            {workloadLoading || targetsLoading ? "조회 중…" : "새로고침"}
          </button>
        </div>
      </div>

      <div className="project-filter-toolbar resource-filter-toolbar" role="search" aria-label="리소스 검색과 필터">
        <input aria-label="리소스 또는 그룹 이름과 코드 검색" placeholder="이름 또는 코드 검색" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label>종류<select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as KindFilter)}><option value="all">전체</option><option value="resource">Resource</option><option value="group">Resource Group</option></select></label>
        <label>상태<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}><option value="all">전체</option><option value="active">활성</option><option value="inactive">비활성</option></select></label>
        <label>Task 기간 From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Task 기간 To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <button className="secondary-button" type="button" disabled={!filterActive} onClick={() => { setQuery(""); setActiveFilter("all"); setKindFilter("all"); setDateFrom(""); setDateTo(""); }}>초기화</button>
        <span className="project-filter-result" role="status">{data
          ? `그룹 ${visibleGroupCount} · 리소스 ${visibleResourceCount}`
          : currentWorkload.phase === "error" ? "조회 결과 없음 · 공수 조회 실패" : "공수 조회 중…"}</span>
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
          {currentWorkload.phase === "error" ? <button className="secondary-button" type="button" onClick={() => void loadSource("workload")}>공수 다시 시도</button> : null}
        </div>
        <div className={`resource-workload-status${currentTargets.phase === "error" ? " resource-workload-status-error" : ""}`} data-source="targets" data-state={currentTargets.phase}>
          <p role={currentTargets.phase === "error" ? "alert" : "status"}>
            {targetsLoading
              ? currentTargets.value ? `이름·코드 정보를 새로고침하는 중입니다. 마지막 성공 ${confirmedAt(currentTargets.lastSuccessAt)} 정보를 표시합니다.` : "리소스 이름·코드 정보를 불러오는 중입니다."
              : currentTargets.phase === "error"
                ? currentTargets.value ? `이름·코드·설명 정보 새로고침에 실패했습니다. 마지막 성공 ${confirmedAt(currentTargets.lastSuccessAt)} 정보를 표시합니다.` : "리소스 이름·코드·설명 정보를 불러오지 못했습니다. Group·Resource 기본 이름과 Resource 코드는 유지되며 Group 코드와 설명 검색은 사용할 수 없습니다."
                : `이름·코드 정보 확인 완료 · ${confirmedAt(currentTargets.lastSuccessAt)}`}
          </p>
          {currentTargets.phase === "error" ? <button className="secondary-button" type="button" onClick={() => void loadSource("targets")}>이름·코드 다시 시도</button> : null}
        </div>
      </div>

      {data ? (
        <>
          <dl className="resource-workload-summary" aria-label="리소스 공수 요약">
            <div>
              <dt>조회 범위</dt>
              <dd>{data.range.from} ~ {data.range.to}</dd>
            </div>
            <div>
              <dt>전체 공수</dt>
              <dd>{effort(data.grandTotalMd, data.grandTotalMm, unit)}</dd>
            </div>
            <div>
              <dt>공수 미설정</dt>
              <dd>{data.unsetCount}건</dd>
            </div>
            <div>
              <dt>과투입 리소스</dt>
              <dd>{overAllocatedCount}개</dd>
            </div>
          </dl>

          <p className="resource-workload-note">위 집계는 전체 Project 기준이며, 아래 필터는 표시 행만 제한합니다.</p>
          {data.mdPerMm
            ? <p className="resource-workload-note">M/M 환산 기준: 1 M/M = {data.mdPerMm} M/D</p>
            : <p className="resource-workload-note">M/M 환산 기준이 설정되지 않아 M/M 보기는 사용할 수 없습니다.</p>}

          <div className="resource-workload-groups">
            {filteredGroups.length === 0 ? (
              <p className="resource-workload-empty">검색 조건에 일치하는 리소스 할당이 없습니다.</p>
            ) : filteredGroups.map((group) => (
              <details className="resource-workload-group" key={group.id ?? "ungrouped"} open>
                <summary>
                  <span className="resource-workload-name">{group.name}</span>
                  <span>{group.start ?? "—"} ~ {group.end ?? "—"}</span>
                  <span>{effort(group.effortMd, group.effortMm, unit)}</span>
                  {group.unsetCount ? <span className="status-badge warning">미설정 {group.unsetCount}</span> : null}
                </summary>
                <div className="resource-workload-resources">
                  {group.resources.map((resource) => (
                    <details className="resource-workload-resource" key={`${group.id ?? "ungrouped"}:${resource.id}`}>
                      <summary>
                        <span className="resource-workload-name">{resource.name}{resource.code ? ` (${resource.code})` : ""}</span>
                        <span>{resource.start ?? "—"} ~ {resource.end ?? "—"}</span>
                        <span>{effort(resource.effortMd, resource.effortMm, unit)}</span>
                        {!resource.active ? <span className="status-badge">비활성</span> : null}
                        {resource.overAllocated ? <span className="status-badge danger">과투입</span> : null}
                        {resource.unsetCount ? <span className="status-badge warning">미설정 {resource.unsetCount}</span> : null}
                      </summary>
                      <div className="resource-workload-table-scroll">
                        <table className="resource-workload-table">
                          <thead>
                            <tr>
                              <th>작업</th>
                              <th>투입 시작</th>
                              <th>투입 종료</th>
                              <th>투입률</th>
                              <th>공수</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resource.tasks.map((task) => (
                              <tr key={task.assignmentId}>
                                <td>{task.taskName}</td>
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
