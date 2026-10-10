"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type {
  MilestoneDashboardFilterInput,
  MilestoneDashboardFiltersDto,
} from "../../contracts/milestone-dashboard";
import type { ResourceDrillSourceContext } from "../../contracts/resource-drill";
import type { ProjectTaskDto } from "../../contracts/projects";
import type { MilestoneResourceDrill } from "../resources/milestone-resource-drill";
import { StageFilterPicker } from "../projects/stage-filter-picker";
import { ProjectMilestoneStageTable } from "./project-milestone-stage-table";
import {
  conversionLabel,
  displayEffort,
  displayPercent,
} from "./milestone-dashboard-model";
import { sortMilestoneManagementRows, type MilestoneManagementHandler } from "./milestone-management-model";
import { useMilestoneDashboard } from "./use-milestone-dashboard";
import styles from "./project-milestone-dashboard.module.css";

export interface ProjectMilestoneDashboardProps {
  publicId: string;
  revision: number;
  tasks: readonly ProjectTaskDto[];
  active: boolean;
  busy: boolean;
  onOpenTask: (taskId: string, tab?: "task" | "memberships") => void;
  onSchedule: (
    taskIds: string[],
    sourceContext: ResourceDrillSourceContext,
  ) => void;
  onSourceContext?: (context: ResourceDrillSourceContext | null) => void;
  onResources: (scope: MilestoneResourceDrill) => void;
  onRefreshProject: () => void;
  editable?: boolean;
  onAddMilestone?: (trigger: HTMLElement) => void;
  onManageMilestone?: MilestoneManagementHandler;
  onManagementFocusUnavailable?: () => void;
}

export function ProjectMilestoneDashboard({
  publicId,
  revision,
  tasks,
  active,
  busy,
  onOpenTask,
  onSchedule,
  onResources,
  onSourceContext,
  onRefreshProject,
  editable = false,
  onAddMilestone,
  onManageMilestone,
  onManagementFocusUnavailable,
}: ProjectMilestoneDashboardProps) {
  const id = useId();
  const [search, setSearch] = useState(""),
    [horizon, setHorizon] = useState("14"),
    [date, setDate] = useState(""),
    [manualDate, setManualDate] = useState(false);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [conversionMode, setConversionMode] = useState<
      "environment" | "query" | "unset"
    >("environment"),
    [conversion, setConversion] = useState("");
  const [filters, setFilters] = useState<MilestoneDashboardFilterInput>({});
  const input = useMemo<MilestoneDashboardFilterInput>(
    () => ({
      ...filters,
      search,
      horizonDays: Number(horizon),
      ...(manualDate ? { asOfDate: date } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(conversionMode === "query"
        ? { mdPerMm: Number(conversion) }
        : conversionMode === "unset"
          ? { mdPerMm: null }
          : {}),
    }),
    [
      filters,
      search,
      horizon,
      manualDate,
      date,
      from,
      to,
      conversionMode,
      conversion,
    ],
  );
  const query = useMilestoneDashboard(publicId, revision, input, active);
  const data = query.data,
    enabled = query.ready && !busy;
  useEffect(() => { onSourceContext?.(data?.resourceScopeContext ?? null); }, [data, onSourceContext]);
  const schedule = (ids: string[]) => {
    if (enabled && ids.length && data?.resourceScopeContext)
      onSchedule([...new Set(ids)], data.resourceScopeContext);
  };
  const managementRows = useMemo(() => sortMilestoneManagementRows(data?.rows ?? [], tasks), [data?.rows, tasks]);
  const resourceAvailable = enabled && Boolean(data?.resourceScopeContext);
  const resourceScope = (
    assignmentIds: string[],
    taskIds: string[],
    plannedMd: number,
    plannedMm: number | null,
  ) => {
    if (!enabled || !data || !data.resourceScopeContext) return;
    onResources({
      sourceContext: data.resourceScopeContext,
      projectRevision: data.projectRevision,
      catalogRevision: data.catalogRevision,
      assignmentIds,
      taskIds,
      resourceIds: [
        ...new Set(
          data.effort.assignments
            .filter((assignment) =>
              assignmentIds.includes(assignment.assignmentId),
            )
            .map((assignment) => assignment.resourceId),
        ),
      ],
      ...data.workloadRange,
      plannedMd,
      plannedMm,
    });
  };
  const arrayFilter = (
    key:
      | "milestoneIds"
      | "resourceIds"
      | "processIds"
      | "equipmentIds"
      | "systemIds"
      | "roleResourceIds"
      | "assignmentRoles"
      | "developerGrades",
    label: string,
    options: readonly {
      id: string;
      name: string;
      code?: string | null;
      externalId?: string;
    }[],
  ) => (
    <fieldset className={styles.choiceField}>
      <legend>{label}</legend>
      <div className={styles.choiceOwner}>
        {options.length ? (
          options.map((option) => (
            <label key={option.id} title={`${option.name} · ${option.id}`}>
              <input
                type="checkbox"
                checked={
                  (filters[key] as string[] | undefined)?.includes(option.id) ??
                  false
                }
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    [key]: event.target.checked
                      ? [...(current[key] ?? []), option.id]
                      : (current[key] ?? []).filter(
                          (value) => value !== option.id,
                        ),
                  }))
                }
              />
              <span>
                {option.name}
                {option.externalId || option.code ? (
                  <small>{option.externalId || option.code}</small>
                ) : null}
              </span>
            </label>
          ))
        ) : (
          <p>선택 대상 없음</p>
        )}
      </div>
    </fieldset>
  );
  const countCards = data
    ? [
        {
          key: "ready",
          title: "Ready",
          metric: data.kpi.ready,
          note: "미완료·소속 작업 있는 Milestone",
        },
        {
          key: "blocked",
          title: "선행 차단",
          metric: data.kpi.blocked,
          note: "직접 선행 Milestone 미완료",
        },
        {
          key: "overdue",
          title: "지연",
          metric: data.kpi.overdue,
          note: "미완료 · 적용 예정일 < 기준일",
        },
        {
          key: "upcoming",
          title: "임박",
          metric: data.kpi.upcoming,
          note: `${data.horizonDays}일 · 마지막 날 포함`,
        },
        {
          key: "atRisk",
          title: "계획 일정 위험",
          metric: data.kpi.atRisk,
          note: "미완료 소속 작업 종료 > Milestone 예정",
        },
      ]
    : [];
  return (
    <div
      className={styles.dashboard}
      data-testid="milestone-dashboard"
      data-project-public-id={publicId}
      data-ready={enabled}
      aria-busy={query.loading || undefined}
    >
      {!data?.resourceScopeContext && data ? (
        <p role="status">
          원본 조회 문맥을 확인할 수 없어 화면 간 이동이 잠겨 있습니다.{" "}
          {data.resourceScopeUnavailableReason === "limit-exceeded"
            ? "원본 문맥 조회 한도 초과"
            : "문맥 정보 없음"}
        </p>
      ) : null}
      <div className={styles.sectionHeading}>
        <div>
          <h2 tabIndex={-1} data-milestone-focus="heading">Milestone 대시보드</h2>
          <p>프로젝트 전체 기준 · Gantt WBS 범위 미적용</p>
        </div>
        <div className={styles.actions}>
        <button type="button" disabled={!editable || !enabled || !onAddMilestone} onClick={event => onAddMilestone?.(event.currentTarget)} data-milestone-focus="add" title={editable ? "프로젝트 최상위에 추가" : "편집 활성화 후 추가할 수 있습니다"}>Milestone 추가</button>
        <button
          type="button"
          className="secondary-button"
          disabled={query.loading || Boolean(query.validation)}
          onClick={query.reload}
        >
          {query.loading ? "조회 중…" : query.error ? "다시 시도" : "새로고침"}
        </button>
        </div>
      </div>
      <div className={styles.filters}>
        {(filters.milestoneIds?.length ?? 0) > 1 ? (
          <div className={styles.multiSummary}>
            <strong>여러 Milestone {filters.milestoneIds!.length}개 선택</strong>
            <span>추가 조건에서 선택을 변경합니다.</span>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({ ...current, milestoneIds: [] }))
              }
            >
              모든 Milestone 선택 해제
            </button>
          </div>
        ) : (
          <StageFilterPicker
            tasks={tasks}
            value={filters.milestoneIds?.[0] ?? "all"}
            allowUnassigned={false}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                milestoneIds: value === "all" ? [] : [value],
              }))
            }
          />
        )}
        <label className={styles.search}>
          Milestone 검색
          <input
            type="search"
            value={search}
            placeholder="이름·외부 ID·작업 ID" data-milestone-focus="search"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          기준일
          <input
            type="date"
            value={manualDate ? date : (data?.asOfDate ?? "")}
            disabled={!manualDate}
            aria-describedby={`${id}-date-note`}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={manualDate}
            onChange={(event) => {
              setManualDate(event.target.checked);
              if (event.target.checked && !date) setDate(data?.asOfDate ?? "");
            }}
          />
          수동 기준일
        </label>
        <label>
          임박 기간 (일)
          <input
            type="number"
            min={1}
            max={90}
            value={horizon}
            onChange={(event) => setHorizon(event.target.value)}
          />
        </label>
      </div>
      <p className={styles.note}>
        추가 조건{" "}
        {Object.entries(filters).filter(([key, value]) =>
          Array.isArray(value)
            ? value.length > 0
            : key === "includeDescendantProcesses"
              ? value === false
              : value !== undefined && value !== false && value !== "direct",
        ).length +
          Number(Boolean(from)) +
          Number(Boolean(to)) +
          Number(conversionMode !== "environment")}
        개 · 공수 기간 {from || "서버 기본"} ~ {to || "서버 기본"} ·{" "}
        {conversionMode === "unset"
          ? "환산 기준 제외"
          : conversionMode === "query"
            ? `명시 환산 ${conversion || "미입력"}`
            : "환경 환산 기준"}
      </p>
      <p id={`${id}-date-note`} className={styles.note}>
        {manualDate ? "수동 기준일" : "자동 기준일 · 서버 Project timezone"}
        {data ? ` ${data.timezone} · 평가일 ${data.asOfDate}` : ""}. 현재
        snapshot을 평가하며 과거 실제 상태를 복원하지 않습니다.
      </p>
      <details className={styles.advanced}>
        <summary>Milestone 표시·공수 범위 조건</summary>
        <p>
          검색과 Milestone 선택은 표시 대상 S입니다. 리소스·물류·기간은 공수 범위
          F이며 Milestone 전체 Ready와 소속 진척은 바뀌지 않습니다.
        </p>
        <div className={styles.advancedGrid}>
          {arrayFilter(
            "milestoneIds",
            "표시 Milestone",
            data?.catalog.milestones ?? [],
          )}
          {arrayFilter(
            "resourceIds",
            "공수 대상 개인 리소스",
            data?.catalog.resources ?? [],
          )}
          {arrayFilter(
            "assignmentRoles",
            "Global Role",
            ["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"].map(
              (role) => ({
                id: role,
                name: role === "UNSPECIFIED" ? "Global Role 미지정" : role,
              }),
            ),
          )}
          {arrayFilter(
            "developerGrades",
            "개발자 등급",
            [
              "BEGINNER",
              "INTERMEDIATE",
              "ADVANCED",
              "EXPERT",
              "UNSPECIFIED",
            ].map((grade, index) => ({
              id: grade,
              name: ["초급", "중급", "고급", "특급", "등급 미지정"][index],
            })),
          )}
          {arrayFilter("processIds", "공정", data?.catalog.processes ?? [])}
          {arrayFilter("equipmentIds", "설비", data?.catalog.equipment ?? [])}
          {arrayFilter("systemIds", "시스템", data?.catalog.systems ?? [])}
          {arrayFilter(
            "roleResourceIds",
            "물류 담당 리소스",
            data?.catalog.resources ?? [],
          )}
          <label>
            공수 시작일
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            공수 종료일
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label>
            시스템 범위
            <select
              value={filters.systemView ?? "direct"}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  systemView: event.target
                    .value as MilestoneDashboardFiltersDto["systemView"],
                }))
              }
            >
              <option value="direct">직접 연결</option>
              <option value="coordination">조율 범위 포함</option>
            </select>
          </label>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={filters.activeOnly ?? false}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  activeOnly: event.target.checked,
                }))
              }
            />
            활성 물류 마스터만
          </label>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={filters.includeDescendantProcesses ?? true}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  includeDescendantProcesses: event.target.checked,
                }))
              }
            />
            하위 공정 포함
          </label>
          <label>
            M/M 환산 기준
            <select
              value={conversionMode}
              onChange={(event) =>
                setConversionMode(event.target.value as typeof conversionMode)
              }
            >
              <option value="environment">환경 설정 기준</option>
              <option value="query">명시 기준</option>
              <option value="unset">미설정 (환경 기준 제외)</option>
            </select>
          </label>
          {conversionMode === "query" ? (
            <label>
              1 M/M당 M/D
              <input
                type="number"
                min={0.01}
                step="any"
                value={conversion}
                onChange={(event) => setConversion(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setFilters({});
            setSearch("");
            setHorizon("14");
            setManualDate(false);
            setDate("");
            setFrom("");
            setTo("");
            setConversionMode("environment");
            setConversion("");
          }}
        >
          Dashboard 조건 초기화
        </button>
      </details>
      {query.loading ? (
        <p role="status">
          현재 조건으로 Milestone을 조회 중입니다. 이전 결과의 상세·일정·리소스
          이동은 잠깁니다.
        </p>
      ) : null}
      {query.error ? (
        <div className={styles.error} role="alert">
          <p>{query.error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={onRefreshProject}
          >
            프로젝트 최신 정보 조회
          </button>
        </div>
      ) : null}
      {data ? (
        <div className={styles.results} data-stale={!query.ready}>
          <p className={styles.note}>
            {query.ready
              ? "현재 조회 조건 확인 완료"
              : "이전 성공 결과 · 현재 조건의 정상값이 아닙니다"}{" "}
            · 계산 {data.calculatedAt} · Project {data.projectRevision} /
            Catalog {data.catalogRevision}
          </p>
          <div className={styles.kpis}>
            <article>
              <h3>완료 처리율</h3>
              <strong>{displayPercent(data.kpi.completion.percent)}</strong>
              <p>
                완료 기록 {data.kpi.completion.numerator} / 표시 Milestone{" "}
                {data.kpi.completion.denominator}
              </p>
              <button
                type="button"
                disabled={
                  !resourceAvailable ||
                  !data.kpi.completion.completedMilestoneTaskIds.length
                }
                onClick={() =>
                  schedule(data.kpi.completion.completedMilestoneTaskIds)
                }
              >
                전체 일정에서 Milestone 보기
              </button>
            </article>
            {countCards.map((card) => (
              <article key={card.key}>
                <h3>{card.title}</h3>
                <strong>{card.metric.count}개</strong>
                <p>{card.note}</p>
                <button
                  type="button"
                  disabled={
                    !resourceAvailable || !card.metric.milestoneTaskIds.length
                  }
                  onClick={() => schedule(card.metric.milestoneTaskIds)}
                >
                  전체 일정에서 {card.title} 보기
                </button>
              </article>
            ))}
            <article>
              <h3>소속 적용률</h3>
              <strong>{displayPercent(data.kpi.coverage.percent)}</strong>
              <p>
                유효 소속 {data.kpi.coverage.numerator} / 범위 일반 작업{" "}
                {data.kpi.coverage.denominator}
              </p>
              <button
                type="button"
                disabled={
                  !resourceAvailable || !data.kpi.coverage.taskIds.length
                }
                onClick={() => schedule(data.kpi.coverage.taskIds)}
              >
                전체 일정에서 보고 범위 보기
              </button>
            </article>
          </div>
          <p className={styles.note}>
            Ready·선행 차단·지연·임박·위험은 중첩 가능한 축입니다. 건수를 합쳐
            전체 Milestone 수로 해석하지 않습니다.
          </p>
          <section className={styles.stageSection}>
            <h3>Milestone 전체 상태 · 표시 {data.rows.length}개</h3>
            <p className={styles.note}>
              프로젝트 전체의 평면 목록이며 적용 예정일·외부 ID·작업 ID 순입니다. 소속 작업과 직접 선행 단계 전체 기준입니다. 계획 공수의 범위와
              분모가 다릅니다.
            </p>
            {data.rows.length ? (
              <ProjectMilestoneStageTable
                rows={managementRows}
                tasks={tasks}
                enabled={enabled}
                scheduleEnabled={resourceAvailable}
                editable={editable}
                onManage={onManageMilestone}
                onFocusUnavailable={onManagementFocusUnavailable}
                onOpenTask={onOpenTask}
                onSchedule={schedule}
              />
            ) : (
              <p>
                {tasks.some(task => task.type === "milestone") ? "조건에 일치하는 Milestone이 없습니다." : "프로젝트에 Milestone이 없습니다."} 전체 공수 bucket은
                아래에서 별도로 확인합니다.
              </p>
            )}
          </section>
          <section>
            <h3>범위 내 계획 공수 · 모든 Milestone + 미지정</h3>
            <p className={styles.note}>
              {data.workloadRange.from} ~ {data.workloadRange.to} ·{" "}
              {conversionLabel(data.mdPerMm, data.mdPerMmSource)}. 숨긴 Milestone
              bucket도 전체 합계에 포함하며 위 표시 행의 합계가 아닙니다. 투입률
              미설정 {data.effort.unsetAllocationCount}건.
            </p>
            <div className={styles.grandTotal}>
              <strong>범위 Grand Total</strong>
              <span>
                {displayEffort(data.effort.plannedMd)} M/D /{" "}
                {displayEffort(data.effort.plannedMm)} M/M
              </span>
              <button
                type="button"
                disabled={
                  !resourceAvailable || !data.effort.assignmentIds.length
                }
                onClick={() =>
                  resourceScope(
                    data.effort.assignmentIds,
                    data.scope.taskIds,
                    data.effort.plannedMd,
                    data.effort.plannedMm,
                  )
                }
              >
                해당 범위 리소스 보기
              </button>
            </div>
            <div
              className={styles.tableOwner}
              tabIndex={0}
              role="region"
              aria-label="범위 내 Milestone 공수 표 가로 스크롤"
            >
              <table className={styles.effortTable}>
                <colgroup>
                  <col style={{ width: 260 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 180 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">공수 bucket</th>
                    <th scope="col">계획 M/D</th>
                    <th scope="col">계획 M/M</th>
                    <th scope="col">미설정</th>
                    <th scope="col">조회</th>
                  </tr>
                </thead>
                <tbody>
                  {data.effort.buckets.map((bucket) => (
                    <tr key={bucket.milestoneTaskId ?? "unassigned"}>
                      <td>
                        <span className={styles.identity}>
                          {bucket.milestoneTaskId === null
                            ? "미지정 Milestone"
                            : (data.catalog.milestones.find(
                                (milestone) =>
                                  milestone.id === bucket.milestoneTaskId,
                              )?.name ?? bucket.milestoneTaskId)}
                        </span>
                        <small>
                          {bucket.milestoneTaskId === null
                            ? "effective 소속 없음"
                            : bucket.milestoneTaskId}
                        </small>
                      </td>
                      <td>{displayEffort(bucket.plannedMd)}</td>
                      <td>{displayEffort(bucket.plannedMm)}</td>
                      <td>{bucket.unsetAllocationCount}건</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            disabled={
                              !resourceAvailable || !bucket.taskIds.length
                            }
                            onClick={() => schedule(bucket.taskIds)}
                          >
                            전체 일정
                          </button>
                          <button
                            type="button"
                            disabled={
                              !resourceAvailable || !bucket.assignmentIds.length
                            }
                            onClick={() =>
                              resourceScope(
                                bucket.assignmentIds,
                                bucket.taskIds,
                                bucket.plannedMd,
                                bucket.plannedMm,
                              )
                            }
                          >
                            리소스
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
