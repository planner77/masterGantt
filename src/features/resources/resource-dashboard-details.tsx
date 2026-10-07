"use client";
import { useEffect, useRef, useState } from "react";
import type { ResourceDashboardDetailsDto, ResourceDashboardDto, ResourceDashboardSelector } from "@/contracts/resource-dashboard";
import { detailsQuery, readDetails } from "./resource-dashboard-model";
import { dashboardError } from "./use-resource-dashboard";

export function ResourceDashboardDetails({ data, selector, unit, stale, onStale, view = "assignments" }: { data: ResourceDashboardDto; selector: ResourceDashboardSelector; unit: "md" | "mm"; stale: boolean; onStale: () => void; view?: "tasks" | "assignments" }) {
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ value: ResourceDashboardDetailsDto | null; phase: "loading" | "ready" | "error"; error: string }>({ value: null, phase: "loading", error: "" });
  const generation = useRef(0);
  const queryKey = detailsQuery(data, selector, view, offset).toString();
  const staleCallback = useRef(onStale);
  useEffect(() => { staleCallback.current = onStale; }, [onStale]);
  useEffect(() => {
    if (stale) return;
    let disposed = false;
    const current = ++generation.current;
    const controller = new AbortController();
    queueMicrotask(async () => {
      if (disposed) return;
      setState({ value: null, phase: "loading", error: "" });
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(data.projectPublicId)}/resource-dashboard/details?${queryKey}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) { if (response.status === 409 && !disposed) staleCallback.current(); throw new Error(body?.error?.code ?? "REQUEST_FAILED"); }
        const value = readDetails(body, data, selector, view, offset);
        if (!value) throw new Error("INVALID_RESPONSE");
        if (!disposed && !controller.signal.aborted && generation.current === current) setState({ value, phase: "ready", error: "" });
      } catch (error) {
        if (!disposed && !controller.signal.aborted && generation.current === current) setState({ value: null, phase: "error", error: dashboardError(error instanceof Error ? error.message : "REQUEST_FAILED") });
      }
    });
    return () => { disposed = true; controller.abort(); };
  }, [data, queryKey, selector, view, offset, stale, retry]);
  const value = state.value;
  return <div className="resource-dashboard-detail" data-detail-state={stale ? "stale" : state.phase}>
    {stale ? <p role="status">이전 결과 · 최신 조건 확인 대기. 상세와 페이지 이동이 잠겨 있습니다.</p> : state.phase === "loading" ? <p role="status">Task 상세 조회 중…</p> : null}
    {state.error ? <p role="alert">{state.error} <button type="button" className="secondary-button" disabled={stale} onClick={() => setRetry((value) => value + 1)}>상세 다시 시도</button></p> : null}
    {value ? <>
      <div className="resource-dashboard-table-scroll" tabIndex={0} role="region" aria-label={view === "tasks" ? "고유 Task 상세" : "Assignment Task 상세"}>
        <table className={`resource-dashboard-table resource-dashboard-detail-table ${view === "tasks" ? "tasks-only" : ""}`}>
          <thead><tr><th>작업명 / 안정 ID / WBS</th><th>상태</th><th>진행률</th><th>작업 일정</th>{view === "assignments" ? <><th>Assignment 투입 구간</th><th>투입률</th><th>계획 공수</th></> : null}<th>Milestone 소속</th></tr></thead>
          <tbody>{value.rows.map((row, index) => <tr key={row.assignment?.assignmentId ?? `${row.taskId}:${index}`}>
            <td><strong>{row.taskName}</strong><small>{row.externalId} · {row.taskId}</small><small>{row.wbsPath.map((part) => part.name).join(" / ") || "—"}</small></td>
            <td>{row.status === "completed" ? "완료" : row.status === "in_progress" ? "진행 중" : "시작 전"}{row.progress !== null && row.progress < 100 && row.taskEnd && row.taskEnd < data.asOfDate ? " · 지연" : ""}</td>
            <td>{row.progress === null ? "—" : `${row.progress}%`}</td><td><DateRange from={row.taskStart} to={row.taskEnd} /></td>
            {view === "assignments" ? <><td><DateRange from={row.assignment?.from} to={row.assignment?.to} /><small>저장 구간: <DateRange from={row.assignment?.assignmentStart ?? "작업 상속"} to={row.assignment?.assignmentEnd ?? "작업 상속"} /></small><small>{row.assignment?.resourceName} · 유효 근무 {row.assignment?.effectiveWorkingDays}일</small></td><td>{row.assignment?.allocationPercent === null ? "미설정" : `${row.assignment?.allocationPercent}%`}</td><td>{row.assignment?.plannedMd === null ? "공수 미설정" : `${(unit === "md" ? row.assignment?.plannedMd : row.assignment?.plannedMm)?.toFixed(2) ?? "—"} ${unit === "md" ? "M/D" : "M/M"}`}</td></> : null}
            <td>{row.effectiveMilestoneTaskId ? data.catalog.milestones.find((milestone) => milestone.id === row.effectiveMilestoneTaskId)?.name ?? row.effectiveMilestoneTaskId : "Milestone 미지정"}<small>{row.inheritedFromTaskId ? `상속: ${row.inheritedFromTaskId}` : row.explicitMilestoneTaskId ? "직접 지정" : "소속 없음"}</small></td>
          </tr>)}</tbody>
        </table>
      </div>
      {value.rows.length === 0 ? <p>이 상세 범위에 Task가 없습니다.</p> : null}
      <div className="resource-dashboard-pagination" aria-label="Task 상세 페이지"><span>{value.totalCount}건 중 {value.rows.length ? offset + 1 : 0}–{offset + value.rows.length}</span><button className="secondary-button" type="button" disabled={stale || offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>이전</button><button className="secondary-button" type="button" disabled={stale || value.nextOffset === null} onClick={() => setOffset(value.nextOffset!)}>다음</button></div>
    </> : null}
  </div>;
}

function DateRange({ from, to }: { from: string | null | undefined; to: string | null | undefined }) {
  return <><span className="resource-dashboard-date">{from ?? "—"}</span> ~ <span className="resource-dashboard-date">{to ?? "—"}</span></>;
}
