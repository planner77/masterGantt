"use client";
import { useRef, useState } from "react";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import type {
  ResourcePlanDemandScope,
  ResourcePlanMetrics,
  ResourcePlanRowSelector,
} from "@/domain/resources/resource-plan";
import {
  flattenPlanRows,
  planMetric,
  type PlanRow,
} from "./resource-plan-model";
import {
  ResourcePlanDetails,
  type PlanDetailStep,
} from "./resource-plan-details";
export function ResourcePlanView({
  data,
  mode,
  unit,
  stale,
  active,
  onStale,
}: {
  data: ResourceDashboardDto;
  mode: "group" | "resource";
  unit: "md" | "mm";
  stale: boolean;
  active: boolean;
  onStale: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set()),
    [rowOffsets, setRowOffsets] = useState({ group: 0, resource: 0 }),
    [periodOffsets, setPeriodOffsets] = useState({ week: 0, month: 0 }),
    [metric, setMetric] = useState<"effort" | "load" | "excess">("effort"),
    [scope, setScope] = useState<ResourcePlanDemandScope>("selected"),
    [selection, setSelection] = useState<PlanDetailStep | null>(null);
  const trigger = useRef<HTMLElement | null>(null),
    fallback = useRef<HTMLSelectElement>(null);
  const plan = data.plan;
  if (!plan) return <p role="status">Resource Plan을 조회하는 중입니다.</p>;
  if (plan.population.resourceCount === 0)
    return (
      <section aria-label="Resource Plan">
        <p role="status">
          조회 조건에 맞는 Project 개인 할당 이력이 없습니다. 대상 없음이며
          비근무기간·가용 인력 판정이 아닙니다.
        </p>
      </section>
    );
  const rowOffset = rowOffsets[mode],
    periodOffset = periodOffsets[plan.granularity],
    setRowOffset = (value: number) =>
      setRowOffsets((p) => ({ ...p, [mode]: value })),
    setPeriodOffset = (value: number) =>
      setPeriodOffsets((p) => ({ ...p, [plan.granularity]: value }));
  const rows = flattenPlanRows(plan, mode, expanded),
    periods = plan.periods.slice(periodOffset, periodOffset + 4),
    offset = Math.min(
      rowOffset,
      Math.max(0, Math.floor((rows.length - 1) / 49) * 49),
    );
  const open = (
    selector: ResourcePlanRowSelector,
    periodId: string,
    label: string,
    demandScope: ResourcePlanDemandScope,
    button: HTMLElement,
  ) => {
    if (stale) return;
    trigger.current = button;
    setSelection({
      kind: "daily",
      input: {
        snapshotId: data.snapshotId,
        granularity: plan.granularity,
        periodId,
        selector,
        demandScope,
        offset: 0,
        limit: 50,
      },
      label,
    });
  };
  const close = () => {
    setSelection(null);
    requestAnimationFrame(() => {
      const button = trigger.current;
      if (
        button?.isConnected &&
        !button.matches(":disabled") &&
        !button.closest("[hidden],[inert]")
      )
        button.focus({ preventScroll: true });
      else fallback.current?.focus({ preventScroll: true });
    });
  };
  const cell = (row: PlanRow, periodId: string) => {
    const name = [...(row.context ?? []), row.name].join(" / ");
    const pair =
      periodId === "all"
        ? row.series.summary
        : row.series.cells.find((c) => c.periodKey === periodId);
    if (!pair) return <span>대상 없음</span>;
    const selected =
        row.selector.kind === "resourceMilestone" ? pair.selected : pair[scope],
      parent = row.parentResource
        ? periodId === "all"
          ? row.parentResource.summary.project
          : row.parentResource.cells.find((c) => c.periodKey === periodId)
              ?.project
        : pair.project;
    const describe = (m: ResourcePlanMetrics) =>
      `${planMetric(m, metric, unit)} · 기준 Capacity ${m.capacityMd.toFixed(2)} M/D`;
    return (
      <>
        <button
          type="button"
          disabled={stale}
          aria-label={`${name} · ${periodId} · ${metric === "effort" ? "계획 공수" : metric === "load" ? "평균 Load" : "과투입"} 상세`}
          onClick={(e) =>
            open(
              row.selector,
              periodId,
              `${name} · ${periodId}`,
              row.selector.kind === "resourceMilestone" ? "selected" : scope,
              e.currentTarget,
            )
          }
        >
          {row.selector.kind === "resourceMilestone"
            ? "Milestone 기여(선택) · "
            : ""}
          {planMetric(selected, metric, unit)}
        </button>
        <small title={describe(selected)}>
          Capacity {selected.capacityMd.toFixed(2)} M/D
          {row.selector.kind === "resourceMilestone" ? " · 비가산 참고" : ""}
        </small>
        {parent &&
        (parent.excessMd > 0 || parent.unknownAssignmentCount > 0) ? (
          <button
            type="button"
            className="resource-plan-warning"
            disabled={stale}
            onClick={(e) =>
              open(
                row.selector.kind === "resourceMilestone"
                  ? { kind: "resource", resourceId: row.selector.resourceId }
                  : row.selector,
                periodId,
                `${name} · 개인/Project 전체 참고 · ${periodId}`,
                "project",
                e.currentTarget,
              )
            }
          >
            Project 전체 · 초과 {parent.excessMd.toFixed(2)} M/D ·{" "}
            {parent.overAllocatedResourceCount}명
            {parent.unknownAssignmentCount
              ? ` · 미설정 ${parent.unknownAssignmentCount}`
              : ""}
          </button>
        ) : null}
        {row.selector.kind === "resourceMilestone" ? (
          <small>
            개인 전체 참고{" "}
            {parent ? planMetric(parent, metric, unit) : "미산정"}
          </small>
        ) : null}
      </>
    );
  };
  const total: PlanRow = {
    key: "total",
    name: "전체(개인 고유 합계)",
    selector: { kind: "total" },
    series: plan.totals,
    level: 0,
    expandable: false,
  };
  return (
    <section aria-label="Resource Plan">
      <div className="resource-dashboard-view-controls">
        <label>
          기간 셀 지표
          <select
            ref={fallback}
            aria-label="기간 셀 지표"
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            <option value="effort">계획 공수</option>
            <option value="load">평균 Load %</option>
            <option value="excess">과투입 M/D</option>
          </select>
        </label>
        <label>
          부하 범위
          <select
            aria-label="부하 범위"
            value={scope}
            onChange={(e) =>
              setScope(e.target.value as ResourcePlanDemandScope)
            }
          >
            <option value="selected">선택 Milestone·Task 기여</option>
            <option value="project">동일 개인의 Project 전체 참고</option>
          </select>
        </label>
      </div>
      <p className="resource-dashboard-hint">
        현재 Project 개인 {plan.population.resourceCount}명 · 유효 근무일1 M/D
        기준. Task·Milestone·기간·검색으로 Capacity 모집단을 줄이지 않습니다.
        Group 소계와 Milestone Capacity는 비가산이며 전사 가용 인력이 아닙니다.
      </p>
      <p className="resource-dashboard-hint">
        조회 전체 {scope === "selected" ? "선택 기여" : "Project 전체 참고"} ·
        평균 {planMetric(plan.totals.summary[scope], "load", unit)} · 알려진
        가중 일별 Peak{" "}
        {plan.totals.summary[scope].knownPeakDailyLoadPercent === null
          ? "미산정"
          : `${plan.totals.summary[scope].knownPeakDailyLoadPercent.toFixed(2)}%`}{" "}
        / 알려진 개인 최대 Peak{" "}
        {plan.totals.summary[scope].knownPeakResourceDailyLoadPercent === null
          ? "미산정"
          : `${plan.totals.summary[scope].knownPeakResourceDailyLoadPercent.toFixed(2)}%`}{" "}
        · 과투입 {plan.totals.summary[scope].overAllocatedDayCount}일 /{" "}
        {plan.totals.summary[scope].overAllocatedResourceDayCount}개인일 /{" "}
        {plan.totals.summary[scope].overAllocatedResourceCount}명 · 초과{" "}
        {plan.totals.summary[scope].excessMd.toFixed(2)} M/D · 미설정{" "}
        {plan.totals.summary[scope].unknownAssignmentCount} Assignment
      </p>
      <div className="resource-dashboard-pagination">
        <span>
          행 {offset + 1}–{Math.min(offset + 49, rows.length)} / {rows.length} ·
          기간 {periodOffset + 1}–
          {Math.min(periodOffset + 4, plan.periods.length)} /{" "}
          {plan.periods.length}
        </span>
        <button
          type="button"
          disabled={stale || offset === 0}
          onClick={() => setRowOffset(Math.max(0, offset - 49))}
        >
          행 이전
        </button>
        <button
          type="button"
          disabled={stale || offset + 49 >= rows.length}
          onClick={() => setRowOffset(offset + 49)}
        >
          행 다음
        </button>
        <button
          type="button"
          disabled={stale || periodOffset === 0}
          onClick={() => setPeriodOffset(Math.max(0, periodOffset - 4))}
        >
          기간 이전
        </button>
        <button
          type="button"
          disabled={stale || periodOffset + 4 >= plan.periods.length}
          onClick={() => setPeriodOffset(periodOffset + 4)}
        >
          기간 다음
        </button>
      </div>
      <div
        className="resource-dashboard-table-scroll resource-plan-scroll"
        role="region"
        tabIndex={0}
        aria-label={`${mode === "group" ? "그룹" : "개인"} 기간 계획표`}
      >
        <table
          className="resource-plan-matrix"
          style={
            {
              "--plan-period-width": `${176 * (periods.length + 1)}px`,
            } as React.CSSProperties
          }
        >
          <colgroup>
            <col className="resource-plan-identity-column" />
            {Array.from({ length: periods.length + 1 }, (_, i) => (
              <col key={i} style={{ width: 176 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                {mode === "group"
                  ? "그룹 → 개인 → Milestone"
                  : "개인 → Milestone"}
              </th>
              {periods.map((p) => (
                <th scope="col" key={p.key}>
                  {p.label}
                  <small>
                    {p.from}–{p.to}
                    {p.partial ? " · 부분기간" : ""}
                  </small>
                </th>
              ))}
              <th scope="col">전체 조회기간</th>
            </tr>
          </thead>
          <tbody>
            {[total, ...rows.slice(offset, offset + 49)].map((row) => (
              <tr key={row.key} data-plan-row={row.selector.kind}>
                <th scope="row" style={{ paddingLeft: 8 + row.level * 12 }}>
                  {row.expandable ? (
                    <button
                      type="button"
                      aria-expanded={expanded.has(row.key)}
                      disabled={stale}
                      onClick={() =>
                        setExpanded((previous) => {
                          const next = new Set(previous);
                          if (next.has(row.key)) next.delete(row.key);
                          else next.add(row.key);
                          return next;
                        })
                      }
                    >
                      <span
                        className="resource-milestone-identity"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    </button>
                  ) : (
                    <span
                      className="resource-milestone-identity"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )}
                  {row.context?.length ? (
                    <small
                      className="resource-milestone-identity"
                      title={row.context.join(" / ")}
                    >
                      {row.context.join(" / ")}
                    </small>
                  ) : null}
                  {row.description ? (
                    <small
                      className="resource-milestone-identity"
                      title={row.description}
                    >
                      {row.description}
                    </small>
                  ) : null}
                </th>
                {periods.map((p) => (
                  <td key={p.key}>{cell(row, p.key)}</td>
                ))}
                <td>{cell(row, "all")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selection && selection.input.granularity === plan.granularity ? (
        <ResourcePlanDetails
          key={`${data.snapshotId}:${JSON.stringify(selection)}`}
          data={data}
          initial={selection}
          stale={stale}
          active={active}
          onStale={onStale}
          onClose={close}
          unit={unit}
        />
      ) : null}
    </section>
  );
}
