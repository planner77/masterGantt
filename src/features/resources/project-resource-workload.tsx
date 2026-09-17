"use client";

import { useCallback, useEffect, useState } from "react";

import type { ResourceWorkloadResponse } from "@/contracts/resources";

type Unit = "md" | "mm";

type Props = Readonly<{ publicId: string }>;

function effort(md: number, mm: number | null, unit: Unit): string {
  if (unit === "mm") return mm === null ? "—" : `${mm.toFixed(2)} M/M`;
  return `${md.toFixed(2)} M/D`;
}

export function ProjectResourceWorkload({ publicId }: Props) {
  const [data, setData] = useState<ResourceWorkloadResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("md");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/resource-workload`, { credentials: "same-origin", cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("data" in body)) throw new Error("invalid workload response");
      setData((body as ResourceWorkloadResponse).data);
    } catch {
      setError("리소스 공수 정보를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, [publicId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (alive) await load();
    })();
    return () => { alive = false; };
  }, [load]);

  return <section aria-labelledby="resource-workload-heading" className="project-resource-workload">
    <div className="schedule-heading-row">
      <div>
        <h2 id="resource-workload-heading">리소스 공수</h2>
        <p>개별 리소스의 계획 투입 구간과 투입률을 프로젝트 근무일 기준으로 집계합니다.</p>
      </div>
      <div className="project-gantt-scale-controls" role="group" aria-label="공수 표시 단위">
        <button type="button" aria-pressed={unit === "md"} onClick={() => setUnit("md")}>M/D</button>
        <button type="button" aria-pressed={unit === "mm"} disabled={!data?.mdPerMm} onClick={() => setUnit("mm")}>M/M</button>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "조회 중…" : "새로고침"}</button>
      </div>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {data ? <>
      <p>조회 범위 {data.range.from} ~ {data.range.to} · 전체 {effort(data.grandTotalMd, data.grandTotalMm, unit)} · 공수 미설정 {data.unsetCount}건{data.mdPerMm ? ` · 1 M/M = ${data.mdPerMm} M/D` : " · M/M 기준 미설정"}</p>
      {data.groups.length === 0 ? <p>조회할 리소스 할당이 없습니다.</p> : data.groups.map((group) => <details key={group.id ?? "ungrouped"} open>
        <summary><strong>{group.name}</strong> · {group.start ?? "—"} ~ {group.end ?? "—"} · {effort(group.effortMd, group.effortMm, unit)}{group.unsetCount ? ` · 미설정 ${group.unsetCount}` : ""}</summary>
        <div style={{ paddingInlineStart: "1.25rem" }}>
          {group.resources.map((resource) => <details key={`${group.id ?? "ungrouped"}:${resource.id}`}>
            <summary>{resource.name}{resource.code ? ` (${resource.code})` : ""}{!resource.active ? " · 비활성" : ""} · {resource.start ?? "—"} ~ {resource.end ?? "—"} · {effort(resource.effortMd, resource.effortMm, unit)}{resource.overAllocated ? " · 과투입" : ""}{resource.unsetCount ? ` · 미설정 ${resource.unsetCount}` : ""}</summary>
            <div style={{ overflowX: "auto" }}><table><thead><tr><th>작업</th><th>투입 시작</th><th>투입 종료</th><th>투입률</th><th>공수</th></tr></thead><tbody>
              {resource.tasks.map((task) => <tr key={task.assignmentId}><td>{task.taskName}</td><td>{task.start}</td><td>{task.end}</td><td>{task.allocationPercent === null ? "미설정" : `${task.allocationPercent}%`}</td><td>{task.effortMd === null ? "공수 미설정" : effort(task.effortMd, task.effortMm, unit)}</td></tr>)}
            </tbody></table></div>
          </details>)}
        </div>
      </details>)}
    </> : null}
  </section>;
}
