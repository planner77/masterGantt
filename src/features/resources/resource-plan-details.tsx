"use client";
import { useResourceDrill } from "./resource-drill-context";
import {
  resourceProjectionFetch,
  planScopeProjection,
} from "./resource-drill-transport";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  ResourceDashboardDto,
  ResourcePlanDetailsDto,
  ResourcePlanDetailInput,
  ResourcePlanDetailKind,
} from "@/contracts/resource-dashboard";
import {
  planDetailQuery,
  planMetric,
  readPlanDetails,
} from "./resource-plan-model";
import { dashboardError } from "./use-resource-dashboard";
export type PlanDetailStep = {
  kind: ResourcePlanDetailKind;
  input: ResourcePlanDetailInput;
  label: string;
};
export function ResourcePlanDetails({
  data,
  initial,
  stale,
  active,
  onStale,
  onClose,
  unit,
}: {
  data: ResourceDashboardDto;
  initial: PlanDetailStep;
  stale: boolean;
  active: boolean;
  onStale: () => void;
  onClose: () => void;
  unit: "md" | "mm";
}) {
  const { binding, onSchedule, onOpenTask, locked } = useResourceDrill();
  const [steps, setSteps] = useState([initial]),
    [result, setResult] = useState<ResourcePlanDetailsDto | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(true),
    [loadedQuery, setLoadedQuery] = useState("");
  const operationTrigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    generation = useRef(0),
    current = steps[steps.length - 1],
    query = planDetailQuery(data, current.input).toString();
  useLayoutEffect(() => {
    heading.current?.focus();
  }, [current.kind, steps.length]);
  useLayoutEffect(() => {
    if (
      !loading &&
      active &&
      document.activeElement === document.body &&
      operationTrigger.current?.isConnected &&
      !operationTrigger.current.matches(":disabled") &&
      !operationTrigger.current.closest("[hidden],[inert]")
    )
      operationTrigger.current.focus({ preventScroll: true });
  }, [loading, active]);
  useEffect(() => {
    if (stale || !active) return;
    const abort = new AbortController(),
      id = ++generation.current;
    let disposed = false;
    queueMicrotask(async () => {
      if (disposed) return;
      setLoading(true);
      setError("");
      try {
        const response = await resourceProjectionFetch(
          binding,
          `/api/projects/${data.projectPublicId}/resource-dashboard/plan/${current.kind}?${query}`,
          { cache: "no-store", signal: abort.signal },
        );
        const body = await response.json();
        if (disposed || abort.signal.aborted || id !== generation.current)
          return;
        if (!response.ok) {
          if (response.status === 409) onStale();
          throw Error(body?.error?.code ?? "REQUEST_FAILED");
        }
        const value = readPlanDetails(body, data, current.input, current.kind);
        if (!value) throw Error("INVALID_RESPONSE");
        setResult(value);
        setLoadedQuery(query);
        setLoading(false);
      } catch (e) {
        if (!disposed && !abort.signal.aborted && id === generation.current) {
          setError(
            dashboardError(e instanceof Error ? e.message : "REQUEST_FAILED"),
          );
          setLoading(false);
        }
      }
    });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [data, current, query, stale, active, onStale, retry, binding]);
  const back = () =>
    steps.length > 1 ? setSteps((s) => s.slice(0, -1)) : onClose();
  const next = (date: string, resourceId?: string, name?: string) => {
    const selector = resourceId
      ? { kind: "resource" as const, resourceId }
      : current.input.selector;
    const kind =
      selector.kind === "group" || selector.kind === "total"
        ? "day-resources"
        : "day-assignments";
    setSteps((s) => [
      ...s,
      {
        kind,
        input: {
          ...current.input,
          selector,
          date,
          offset: 0,
        },
        label: `${current.label} · ${date}${name ? ` · ${name}` : ""}`,
      },
    ]);
  };
  return (
    <section
      className="resource-plan-detail"
      aria-label="기간 부하 상세"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          back();
        }
      }}
    >
      <h3 ref={heading} tabIndex={-1}>
        {current.label}
      </h3>
      <p className="resource-dashboard-hint">
        {current.input.demandScope === "project"
          ? "동일 개인의 현재 Project 전체 참고"
          : "선택 Milestone·Task 기여"}{" "}
        · {current.input.periodId} · Capacity는 유효 근무일1 M/D
      </p>
      <div className="resource-dashboard-pagination">
        {steps.length > 1 ? (
          <button type="button" onClick={back}>
            이전 근거
          </button>
        ) : null}
        <button type="button" onClick={onClose}>
          기간 상세 닫기
        </button>
        <button
          type="button"
          disabled={stale || loading}
          aria-busy={loading}
          onClick={(event) => {
            operationTrigger.current = event.currentTarget;
            setRetry((r) => r + 1);
          }}
        >
          상세 다시 시도
        </button>
      </div>
      {stale ? (
        <p role="alert">
          데이터가 변경되었습니다. 새로고침한 뒤 다시 열어 주세요.
        </p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <p role="status">기간 상세 조회 중…</p>
      ) : null}
      <button
        type="button"
        disabled={stale || locked || !onSchedule || loading}
        onClick={(event) =>
          onSchedule?.({
            data,
            projection: {
              kind: "scope",
              target: "plan",
              ...planScopeProjection(current.input),
            },
            label: current.label,
            trigger: event.currentTarget,
          })
        }
      >
        전체 범위 일정 보기
      </button>
      {result && !error && loadedQuery === query && !loading ? (
        <>
          <div
            className="resource-dashboard-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="기간 상세 표"
          >
            <table className="resource-plan-detail-table">
              <thead>
                <tr>
                  <th>
                    {result.view === "daily"
                      ? "날짜"
                      : result.view === "day-resources"
                        ? "개인"
                        : "Task / Assignment"}
                  </th>
                  <th>계획 공수</th>
                  <th>
                    {result.view === "day-assignments"
                      ? "배정률 / 근무"
                      : "Capacity M/D / 평균 Load"}
                  </th>
                  <th>
                    {result.view === "day-assignments"
                      ? "Milestone / WBS"
                      : "개인 최대 Peak / 초과"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.view === "day-assignments"
                  ? result.rows.map((row) => (
                      <tr key={row.assignmentId}>
                        <th scope="row">
                          <button
                            type="button"
                            disabled={stale || locked || !onOpenTask}
                            onClick={() => onOpenTask?.(row.taskId)}
                          >
                            {row.taskName}
                          </button>
                          <button
                            type="button"
                            disabled={stale || locked || !onSchedule}
                            onClick={(event) =>
                              onSchedule?.({
                                data,
                                projection: {
                                  kind: "scope",
                                  target: "plan",
                                  ...planScopeProjection(current.input),
                                },
                                label: row.taskName,
                                trigger: event.currentTarget,
                                taskId: row.taskId,
                                assignmentId: row.assignmentId,
                              })
                            }
                          >
                            이 Task 일정
                          </button>
                          <small>
                            {row.externalId} · Assignment {row.assignmentId}
                          </small>
                          <small>
                            작업 {row.taskStart ?? "—"}–{row.taskEnd ?? "—"} /
                            배정 {row.assignmentStart ?? "상속"}–
                            {row.assignmentEnd ?? "상속"}
                          </small>
                        </th>
                        <td>
                          {row.plannedMd === null
                            ? "공수 미설정"
                            : `${(unit === "mm" && data.mdPerMm ? row.plannedMd / data.mdPerMm : row.plannedMd).toFixed(2)} ${unit === "mm" ? "M/M" : "M/D"}`}
                        </td>
                        <td>
                          {row.allocationPercent === null
                            ? "미설정"
                            : `${row.allocationPercent}%`}{" "}
                          · {row.working ? "근무일" : "비근무일"}
                        </td>
                        <td>
                          {row.milestoneName}
                          <small>
                            {row.wbsPath.map((t) => t.name).join(" / ")}
                          </small>
                        </td>
                      </tr>
                    ))
                  : result.rows.map((row) => (
                      <tr key={"resourceId" in row ? row.resourceId : row.date}>
                        <th scope="row">
                          <button
                            type="button"
                            disabled={stale}
                            onClick={() =>
                              next(
                                row.date,
                                "resourceId" in row
                                  ? row.resourceId
                                  : undefined,
                                "name" in row ? row.name : undefined,
                              )
                            }
                          >
                            {"name" in row ? row.name : row.date}
                          </button>
                          {"code" in row ? (
                            <small>
                              {row.code} · {row.active ? "활성" : "비활성"} ·{" "}
                              {row.roles.join(", ") || "Role 미지정"} ·{" "}
                              {row.developerGrade ?? "등급 미지정"}
                            </small>
                          ) : null}
                        </th>
                        <td>{planMetric(row.metrics, "effort", unit)}</td>
                        <td>
                          {row.metrics.capacityMd.toFixed(2)} M/D ·{" "}
                          {planMetric(row.metrics, "load", unit)}
                        </td>
                        <td>
                          {row.metrics.knownPeakResourceDailyLoadPercent ===
                          null
                            ? "Peak 미산정"
                            : `${row.metrics.knownPeakResourceDailyLoadPercent.toFixed(2)}%`}{" "}
                          · 초과 {row.metrics.excessMd.toFixed(2)} M/D
                          <small>
                            미설정 {row.metrics.unknownAssignmentCount}{" "}
                            Assignment / {row.metrics.unknownResourceDayCount}{" "}
                            개인일 · 과투입{" "}
                            {row.metrics.overAllocatedResourceCount}명
                          </small>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!result.rows.length ? (
            <p>이 날짜·범위의 Assignment가 없습니다.</p>
          ) : null}
        </>
      ) : null}
      <div className="resource-dashboard-pagination">
        <span>
          {result && loadedQuery === query
            ? result.totalCount === 0
              ? 0
              : result.offset + 1
            : 0}
          –
          {result && loadedQuery === query
            ? Math.min(result.offset + result.limit, result.totalCount)
            : 0}{" "}
          / {result && loadedQuery === query ? result.totalCount : "조회 중"}
        </span>
        {(
          [
            [-1, "이전"],
            [1, "다음"],
          ] as const
        ).map(([direction, label]) => (
          <button
            key={label}
            type="button"
            disabled={
              stale ||
              loading ||
              !result ||
              (direction < 0
                ? current.input.offset === 0
                : result.nextOffset === null)
            }
            onClick={(event) => {
              operationTrigger.current = event.currentTarget;
              setSteps((s) =>
                s.map((entry, i) =>
                  i === s.length - 1
                    ? {
                        ...entry,
                        input: {
                          ...entry.input,
                          offset:
                            entry.input.offset + direction * entry.input.limit,
                        },
                      }
                    : entry,
                ),
              );
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
