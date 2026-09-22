"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AssignedTargetsResponse, AssignmentTargetDto, ResourceWorkloadResponse } from "@/contracts/resources";

type Unit = "md" | "mm";
type ActiveFilter = "all" | "active" | "inactive";
type KindFilter = "all" | "resource" | "group";

type Props = Readonly<{ publicId: string }>;

function effort(md: number, mm: number | null, unit: Unit): string {
  if (unit === "mm") return mm === null ? "—" : `${mm.toFixed(2)} M/M`;
  return `${md.toFixed(2)} M/D`;
}

function includesText(target: AssignmentTargetDto | undefined, fallbackName: string, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLocaleLowerCase();
  return [target?.name ?? fallbackName, target?.code ?? "", target?.description ?? ""]
    .some((value) => value.toLocaleLowerCase().includes(needle));
}

function overlaps(start: string, end: string, from: string, to: string): boolean {
  if (!from || !to) return true;
  const low = from <= to ? from : to;
  const high = from <= to ? to : from;
  return start <= high && end >= low;
}

export function ProjectResourceWorkload({ publicId }: Props) {
  const [data, setData] = useState<ResourceWorkloadResponse["data"] | null>(null);
  const [targets, setTargets] = useState<AssignmentTargetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("md");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workloadResponse, targetResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(publicId)}/resource-workload`, { credentials: "same-origin", cache: "no-store" }),
        fetch(`/api/projects/${encodeURIComponent(publicId)}/assigned-targets`, { credentials: "same-origin", cache: "no-store" }),
      ]);
      const workloadBody: unknown = await workloadResponse.json().catch(() => null);
      const targetBody: unknown = await targetResponse.json().catch(() => null);
      if (!workloadResponse.ok || !workloadBody || typeof workloadBody !== "object" || !("data" in workloadBody)) {
        throw new Error("invalid workload response");
      }
      setData((workloadBody as ResourceWorkloadResponse).data);
      if (targetResponse.ok && targetBody && typeof targetBody === "object" && "data" in targetBody) {
        setTargets((targetBody as AssignedTargetsResponse).data.targets);
      }
    } catch {
      setError("리소스 공수 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [workloadResponse, targetResponse] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(publicId)}/resource-workload`, { credentials: "same-origin", cache: "no-store", signal: controller.signal }),
          fetch(`/api/projects/${encodeURIComponent(publicId)}/assigned-targets`, { credentials: "same-origin", cache: "no-store", signal: controller.signal }),
        ]);
        const workloadBody: unknown = await workloadResponse.json().catch(() => null);
        const targetBody: unknown = await targetResponse.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!workloadResponse.ok || !workloadBody || typeof workloadBody !== "object" || !("data" in workloadBody)) {
          throw new Error("invalid workload response");
        }
        setData((workloadBody as ResourceWorkloadResponse).data);
        if (targetResponse.ok && targetBody && typeof targetBody === "object" && "data" in targetBody) {
          setTargets((targetBody as AssignedTargetsResponse).data.targets);
        }
      } catch {
        if (!controller.signal.aborted) setError("리소스 공수 정보를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [publicId]);

  const targetByKey = useMemo(() => new Map(targets.map((target) => [`${target.kind}:${target.id}`, target])), [targets]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    return data.groups.flatMap((group) => {
      const groupTarget = group.id ? targetByKey.get(`group:${group.id}`) : undefined;
      const groupMatchesText = includesText(groupTarget, group.name, query);
      const groupMatchesActive = activeFilter === "all" || (activeFilter === "active" ? group.active : !group.active);
      const resources = group.resources.flatMap((resource) => {
        const resourceTarget = targetByKey.get(`resource:${resource.id}`);
        const textMatch = includesText(resourceTarget, resource.name, query);
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
          <button className="secondary-button resource-refresh-button" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "조회 중…" : "새로고침"}
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
        <span className="project-filter-result" role="status">그룹 {visibleGroupCount} · 리소스 {visibleResourceCount}</span>
      </div>

      {error ? <p className="resource-workload-error" role="alert">{error}</p> : null}

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
      ) : loading ? <p className="resource-workload-note" role="status">리소스 공수 정보를 불러오는 중입니다.</p> : null}
    </section>
  );
}
