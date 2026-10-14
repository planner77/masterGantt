"use client";
import { useResourceDrill } from "./resource-drill-context";
import { resourceProjectionFetch } from "./resource-drill-transport";
import { useEffect, useRef, useState } from "react";
import type {
  ResourceDashboardDetailsDto,
  ResourceDashboardDto,
  ResourceDashboardSelector,
} from "@/contracts/resource-dashboard";
import { detailsQuery, readDetails } from "./resource-dashboard-model";
import { dashboardError } from "./use-resource-dashboard";

export function ResourceDashboardDetails({
  data,
  selector,
  unit,
  stale,
  onStale,
  view = "assignments",
}: {
  data: ResourceDashboardDto;
  selector: ResourceDashboardSelector;
  unit: "md" | "mm";
  stale: boolean;
  onStale: () => void;
  view?: "tasks" | "assignments";
}) {
  const { binding, onSchedule, onOpenTask, onOpenAssignment, locked } = useResourceDrill();
  const [offset, setOffset] = useState(0);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    value: ResourceDashboardDetailsDto | null;
    phase: "loading" | "ready" | "error";
    error: string;
    confirmationId: string;
    ownerData: ResourceDashboardDto | null;
    confirmedQueryKey: string;
  }>({ value: null, phase: "loading", error: "", confirmationId: "", ownerData: null, confirmedQueryKey: "" });
  const generation = useRef(0);
  const queryKey = detailsQuery(data, selector, view, offset).toString();
  const staleCallback = useRef(onStale);
  useEffect(() => {
    staleCallback.current = onStale;
  }, [onStale]);
  useEffect(() => {
    if (stale) return;
    let disposed = false;
    const current = ++generation.current;
    const controller = new AbortController();
    queueMicrotask(async () => {
      if (disposed) return;
      setState({ value: null, phase: "loading", error: "", confirmationId: "", ownerData: null, confirmedQueryKey: "" });
      try {
        const response = await resourceProjectionFetch(
          binding,
          `/api/projects/${encodeURIComponent(data.projectPublicId)}/resource-dashboard/details?${queryKey}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          if (
            response.status === 409 &&
            !disposed &&
            !controller.signal.aborted &&
            generation.current === current
          )
            staleCallback.current();
          throw new Error(body?.error?.code ?? "REQUEST_FAILED");
        }
        const value = readDetails(body, data, selector, view, offset);
        if (!value) throw new Error("INVALID_RESPONSE");
        if (
          !disposed &&
          !controller.signal.aborted &&
          generation.current === current
        )
          {
            if (offset > 0 && offset >= value.totalCount) { setOffset(0); setPageNotice("저장 후 현재 페이지에 배정이 없어 첫 페이지로 돌아왔습니다."); }
            else setState({ value, phase: "ready", error: "", confirmationId: `${data.snapshotId}:${current}:${performance.now()}`, ownerData: data, confirmedQueryKey: queryKey });
          }
      } catch (error) {
        if (
          !disposed &&
          !controller.signal.aborted &&
          generation.current === current
        )
          setState({
            value: null,
            phase: "error",
            confirmationId: "",
            ownerData: null,
            confirmedQueryKey: "",
            error: dashboardError(
              error instanceof Error ? error.message : "REQUEST_FAILED",
            ),
          });
      }
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [data, queryKey, selector, view, offset, stale, retry, binding]);
  const currentResponse = state.ownerData === data && state.confirmedQueryKey === queryKey;
  const actionLocked = stale || !currentResponse || state.phase !== "ready";
  const renderedPhase = stale ? "stale" : !currentResponse && state.phase !== "error" ? "loading" : state.phase;
  const value = state.value;
  return (
    <div
      className="resource-dashboard-detail"
      data-detail-state={renderedPhase}
      data-detail-confirmation-id={currentResponse && state.phase === "ready" && !stale ? state.confirmationId : "0"}
      data-projection-detail-key={JSON.stringify(selector)}
    >
      <button
        type="button"
        data-resource-action="scope-schedule"
        disabled={actionLocked || locked || !onSchedule}
        onClick={(event) =>
          onSchedule?.({
            data,
            projection: {
              kind: "scope",
              target: "dashboard",
              snapshotId: data.snapshotId,
              selector,
            },
            label: "상세 전체 범위",
            trigger: event.currentTarget,
          })
        }
      >
        전체 범위 일정 보기
      </button>
      {pageNotice ? <p role="status">{pageNotice}</p> : null}
      {stale ? (
        <p role="status">
          이전 결과 · 최신 조건 확인 대기. 상세와 페이지 이동이 잠겨 있습니다.
        </p>
      ) : renderedPhase === "loading" ? (
        <p role="status">Task 상세 조회 중…</p>
      ) : null}
      {state.error ? (
        <p role="alert">
          {state.error}{" "}
          <button
            type="button"
            className="secondary-button"
            disabled={stale}
            onClick={() => setRetry((value) => value + 1)}
          >
            상세 다시 시도
          </button>
        </p>
      ) : null}
      {value ? (
        <>
          <div
            className="resource-dashboard-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={
              view === "tasks" ? "고유 Task 상세" : "Assignment Task 상세"
            }
          >
            <table
              className={`resource-dashboard-table resource-dashboard-detail-table ${view === "tasks" ? "tasks-only" : ""}`}
            >
              <thead>
                <tr>
                  <th>작업명 / 안정 ID / WBS</th>
                  <th>상태</th>
                  <th>진행률</th>
                  <th>작업 일정</th>
                  {view === "assignments" ? (
                    <>
                      <th>Assignment 투입 구간</th>
                      <th>투입률</th>
                      <th>계획 공수</th>
                    </>
                  ) : null}
                  <th>Milestone 소속</th>
                </tr>
              </thead>
              <tbody>
                {value.rows.map((row, index) => (
                  <tr
                    key={`${JSON.stringify(selector.targetPath ?? selector)}:${row.taskId}:${row.assignment?.assignmentId ?? index}`}
                    data-canonical-task-id={row.taskId} data-canonical-assignment-id={row.assignment?.assignmentId}
                  >
                    <td>
                      <button
                        type="button"
                        data-resource-action="task"
                        disabled={actionLocked || locked || !onOpenTask}
                        onClick={() => onOpenTask?.(row.taskId)}
                      >
                        {row.taskName}
                      </button>
                      <button
                        type="button"
                        data-resource-action="task-schedule"
                        disabled={actionLocked || locked || !onSchedule}
                        onClick={(event) =>
                          onSchedule?.({
                            data,
                            projection: {
                              kind: "scope",
                              target: "dashboard",
                              snapshotId: data.snapshotId,
                              selector,
                            },
                            label: row.taskName,
                            trigger: event.currentTarget,
                            taskId: row.taskId,
                            assignmentId: row.assignment?.assignmentId,
                          })
                        }
                      >
                        이 Task 일정
                      </button>
                      {row.assignment ? <button type="button" data-resource-assignment-edit disabled={actionLocked || locked || !onOpenAssignment || !row.assignment.active} title={!row.assignment.active ? "비활성 리소스의 기존 배정은 조회 전용입니다." : undefined} onClick={event => onOpenAssignment?.(row.taskId, row.assignment!.assignmentId, row.assignment!.resourceId, event.currentTarget)}>배정 편집: {row.assignment.resourceName}</button> : null}
                      {row.assignment && !row.assignment.active ? <small>비활성 리소스 · 기존 배정 조회 전용</small> : null}
                      {row.assignment ? <small>Assignment ID {row.assignment.assignmentId} · Resource ID {row.assignment.resourceId}</small> : null}
                      {row.targetSources ? <small>Target 출처: 직접 {row.targetSources.bindings.length} · 상속 {row.targetSources.inheritedBindings.length} · Legacy 직접 {row.targetSources.legacySources.length} · {row.targetSources.effectiveTargetIds.join(", ") || "Target 미연결"}</small> : null}
                      <small>
                        {row.externalId} · {row.taskId}
                      </small>
                      <small>
                        {row.wbsPath.map((part) => part.name).join(" / ") ||
                          "—"}
                      </small>
                    </td>
                    <td>
                      {row.status === "completed"
                        ? "완료"
                        : row.status === "in_progress"
                          ? "진행 중"
                          : "시작 전"}
                      {row.progress !== null &&
                      row.progress < 100 &&
                      row.taskEnd &&
                      row.taskEnd < data.asOfDate
                        ? " · 지연"
                        : ""}
                    </td>
                    <td>{row.progress === null ? "—" : `${row.progress}%`}</td>
                    <td>
                      <DateRange from={row.taskStart} to={row.taskEnd} />
                    </td>
                    {view === "assignments" ? (
                      <>
                        <td>
                          <DateRange
                            from={row.assignment?.from}
                            to={row.assignment?.to}
                          />
                          <small>
                            저장 구간:{" "}
                            <DateRange
                              from={
                                row.assignment?.assignmentStart ?? "작업 상속"
                              }
                              to={row.assignment?.assignmentEnd ?? "작업 상속"}
                            />
                          </small>
                          {row.assignment?.allocationOverlapsReport === false || row.assignment?.effortRangeBasis === "raw-allocation" ?
                            <small>조회 기간 밖 · 원래 배정 기간 기준</small> : null}
                          <small>
                            {row.assignment?.resourceName} · 유효 근무{" "}
                            {row.assignment?.effectiveWorkingDays}일
                          </small>
                        </td>
                        <td>
                          {row.assignment?.allocationPercent === null
                            ? "미설정"
                            : `${row.assignment?.allocationPercent}%`}
                        </td>
                        <td>
                          {row.assignment?.plannedMd === null
                            ? "공수 미설정"
                            : `${(unit === "md" ? row.assignment?.plannedMd : row.assignment?.plannedMm)?.toFixed(2) ?? "—"} ${unit === "md" ? "M/D" : "M/M"}`}
                        </td>
                      </>
                    ) : null}
                    <td>
                      {row.effectiveMilestoneTaskId
                        ? (data.catalog.milestones.find(
                            (milestone) =>
                              milestone.id === row.effectiveMilestoneTaskId,
                          )?.name ?? row.effectiveMilestoneTaskId)
                        : "Milestone 미지정"}
                      <small>
                        {row.inheritedFromTaskId
                          ? `상속: ${row.inheritedFromTaskId}`
                          : row.explicitMilestoneTaskId
                            ? "직접 지정"
                            : "소속 없음"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value.rows.length === 0 ? (
            <p>이 상세 범위에 Task가 없습니다.</p>
          ) : null}
          <div
            className="resource-dashboard-pagination"
            aria-label="Task 상세 페이지"
          >
            <span>
              {value.totalCount}건 중 {value.rows.length ? offset + 1 : 0}–
              {offset + value.rows.length}
            </span>
            <button
              className="secondary-button"
              type="button"
              disabled={actionLocked || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              이전
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={actionLocked || value.nextOffset === null}
              onClick={() => setOffset(value.nextOffset!)}
            >
              다음
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DateRange({
  from,
  to,
}: {
  from: string | null | undefined;
  to: string | null | undefined;
}) {
  return (
    <>
      <span className="resource-dashboard-date">{from ?? "—"}</span> ~{" "}
      <span className="resource-dashboard-date">{to ?? "—"}</span>
    </>
  );
}
