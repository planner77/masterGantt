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
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/resource-workload`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("data" in body)) {
        throw new Error("invalid workload response");
      }
      setData((body as ResourceWorkloadResponse).data);
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
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/resource-workload`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !body || typeof body !== "object" || !("data" in body)) {
          throw new Error("invalid workload response");
        }
        setData((body as ResourceWorkloadResponse).data);
      } catch {
        if (!controller.signal.aborted) setError("리소스 공수 정보를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [publicId]);

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

          {!data.mdPerMm ? <p className="resource-workload-note">M/M 환산 기준이 설정되지 않아 M/M 보기는 사용할 수 없습니다.</p> : null}

          <div className="resource-workload-groups">
            {data.groups.length === 0 ? (
              <p className="resource-workload-empty">조회할 리소스 할당이 없습니다.</p>
            ) : data.groups.map((group) => (
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
