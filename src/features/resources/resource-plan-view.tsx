"use client";
import { formatLocaleDateOnly } from "../../lib/date-display";
import { LOCALE_FORMATS } from "../../lib/i18n/locales";
import { displayName } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n/provider";

import { ContextHelp } from "@/components/ui/context-help";

import { IdentifierDetails } from "@/components/identifier-details";
import { useRef, useState } from "react";
import type { ResourceDashboardDto } from "@/contracts/resource-dashboard";
import type {
  ResourcePlanDemandScope,
  ResourcePlanMetrics,
  ResourcePlanRowSelector,
} from "@/domain/resources/resource-plan";
import {
  flattenPlanRows,
  resourcePlanLabel,
  renderResourcePlanLabel,
  type ResourcePlanLabelPresentation,
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
  const { t, locale, formatNumber } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set()),
    [rowOffsets, setRowOffsets] = useState({ group: 0, resource: 0 }),
    [periodOffsets, setPeriodOffsets] = useState({ week: 0, month: 0 }),
    [metric, setMetric] = useState<"effort" | "load" | "excess">("effort"),
    [scope, setScope] = useState<ResourcePlanDemandScope>("selected"),
    [selection, setSelection] = useState<PlanDetailStep | null>(null);
  const queryIdentity = JSON.stringify(data.filters);
  const [selectionQuery, setSelectionQuery] = useState(queryIdentity);
  if (selectionQuery !== queryIdentity) {
    setSelectionQuery(queryIdentity);
    setSelection(null);
  }
  const trigger = useRef<HTMLElement | null>(null),
    fallback = useRef<HTMLSelectElement>(null);
  const plan = data.plan;
  if (!plan) return <p role="status">{t("Resource Plan을 조회하는 중입니다.")}</p>;
  if (plan.population.resourceCount === 0)
    return (
      <section aria-label="Resource Plan">
        <p role="status">
          {t("조회 조건에 맞는 Project 개인 할당 이력이 없습니다. 대상 없음이며 비근무기간·가용 인력 판정이 아닙니다.")}</p>
      </section>
    );
  const rowOffset = rowOffsets[mode],
    periodOffset = periodOffsets[plan.granularity],
    setRowOffset = (value: number) =>
      setRowOffsets((p) => ({ ...p, [mode]: value })),
    setPeriodOffset = (value: number) =>
      setPeriodOffsets((p) => ({ ...p, [plan.granularity]: value }));
  const rows = flattenPlanRows(plan, mode, expanded, locale),
    periods = plan.periods.slice(periodOffset, periodOffset + 4),
    offset = Math.min(
      rowOffset,
      Math.max(0, Math.floor((rows.length - 1) / 49) * 49),
    );
  const open = (
    selector: ResourcePlanRowSelector,
    periodId: string,
    planLabel: ResourcePlanLabelPresentation,
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
      label: renderResourcePlanLabel(planLabel,locale),
      planLabel,
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
    const name = [...(row.context ?? []), row.selector.kind === "total" ? t(row.name) : displayName(row, locale)].join(" / ");
    const pair =
      periodId === "all"
        ? row.series.summary
        : row.series.cells.find((c) => c.periodKey === periodId);
    if (!pair) return <span>{t("대상 없음")}</span>;
    const selected =
        row.selector.kind === "resourceMilestone" ? pair.selected : pair[scope],
      parent = row.parentResource
        ? periodId === "all"
          ? row.parentResource.summary.project
          : row.parentResource.cells.find((c) => c.periodKey === periodId)
              ?.project
        : pair.project;
    const describe = (m: ResourcePlanMetrics) =>
      `${planMetric(m, metric, unit, locale)} · 기준 Capacity ${formatNumber(m.capacityMd,{minimumFractionDigits:2,maximumFractionDigits:2})} M/D`;
    return (
      <>
        <button
          type="button"
          disabled={stale}
          aria-label={t("{value0} · {value1} · {value2} 상세", {value0: name, value1: periodId, value2: metric === "effort" ? t("계획 공수") : metric === "load" ? t("평균 Load") : t("과투입")})}
          onClick={(e) =>
            open(
              row.selector,
              periodId,
              resourcePlanLabel(row,periodId,false),
              row.selector.kind === "resourceMilestone" ? "selected" : scope,
              e.currentTarget,
            )
          }
        >
          {row.selector.kind === "resourceMilestone"
            ? t("Milestone 기여(선택) · ")
            : ""}
          {planMetric(selected, metric, unit, locale)}
        </button>
        <small title={describe(selected)}>
          Capacity {formatNumber(selected.capacityMd,{minimumFractionDigits:2,maximumFractionDigits:2})} M/D
          {row.selector.kind === "resourceMilestone" ? t(" · 비가산 참고") : ""}
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
                resourcePlanLabel(row,periodId,true),
                "project",
                e.currentTarget,
              )
            }
          >
            {t("Project 전체 · 초과")}{" "}{formatNumber(parent.excessMd,{minimumFractionDigits:2,maximumFractionDigits:2})} M/D ·{" "}
            {formatNumber(parent.overAllocatedResourceCount)}{t("명")}{parent.unknownAssignmentCount
              ? t(" · 미설정 {value0}", {value0: parent.unknownAssignmentCount})
              : ""}
          </button>
        ) : null}
        {row.selector.kind === "resourceMilestone" ? (
          <small>
            {t("개인 전체 참고")}{" "}
            {parent ? planMetric(parent, metric, unit, locale) : t("미산정")}
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
          {t("기간 셀 지표")}<select
            ref={fallback}
            aria-label={t("기간 셀 지표")}
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            <option value="effort">{t("계획 공수")}</option>
            <option value="load">{t("평균 Load %")}</option>
            <option value="excess">{t("과투입 M/D")}</option>
          </select>
        </label>
        <label>
          {t("부하 범위")}<select
            aria-label={t("부하 범위")}
            value={scope}
            onChange={(e) =>
              setScope(e.target.value as ResourcePlanDemandScope)
            }
          >
            <option value="selected">{t("선택 실물·Milestone·Task 기여")}</option>
            <option value="project">{t("동일 개인의 Project 전체 참고")}</option>
          </select>
        </label>
        <ContextHelp label={t("Resource Plan Capacity 도움말")}><p>{t("공정·WorkArea·설비·시스템·Task·Milestone·기간·검색으로 Capacity 모집단을 줄이지 않습니다. 유효 근무일1 M/D 기준이며 Group·Milestone Capacity는 비가산 참고값입니다. 현재 Project의 개인 배정 이력에 따른 모집단이며 전사 가용 인력이 아닙니다.")}</p></ContextHelp>
      </div>
      <p className="resource-dashboard-hint">
        {t("현재 Project 개인")}{" "}{formatNumber(plan.population.resourceCount)}{t("명 · Capacity 비가산 참고 · 유효 근무일1 M/D")}</p>
      <p className="resource-dashboard-hint">
        {t("조회 전체")}{" "}{scope === "selected" ? t("선택 기여") : t("Project 전체 참고")} {t("· 평균")}{" "}{planMetric(plan.totals.summary[scope], "load", unit, locale)} {t("· 알려진 가중 일별 Peak")}{" "}
        {plan.totals.summary[scope].knownPeakDailyLoadPercent === null
          ? t("미산정")
          : `${formatNumber(plan.totals.summary[scope].knownPeakDailyLoadPercent,{minimumFractionDigits:2,maximumFractionDigits:2})}%`}{" "}
        {t("/ 알려진 개인 최대 Peak")}{" "}
        {plan.totals.summary[scope].knownPeakResourceDailyLoadPercent === null
          ? t("미산정")
          : `${formatNumber(plan.totals.summary[scope].knownPeakResourceDailyLoadPercent,{minimumFractionDigits:2,maximumFractionDigits:2})}%`}{" "}
        {t("· 과투입")}{" "}{formatNumber(plan.totals.summary[scope].overAllocatedDayCount)}{t("일 /")}{" "}
        {formatNumber(plan.totals.summary[scope].overAllocatedResourceDayCount)}{t("개인일 /")}{" "}
        {formatNumber(plan.totals.summary[scope].overAllocatedResourceCount)}{t("명 · 초과")}{" "}
        {formatNumber(plan.totals.summary[scope].excessMd,{minimumFractionDigits:2,maximumFractionDigits:2})} {t("M/D · 미설정")}{" "}
        {formatNumber(plan.totals.summary[scope].unknownAssignmentCount)} Assignment
      </p>
      <div className="resource-dashboard-pagination">
        <span>
          {t("행")}{" "}{offset + 1}–{Math.min(offset + 49, rows.length)} / {formatNumber(rows.length)} {t("· 기간")}{" "}{periodOffset + 1}–
          {Math.min(periodOffset + 4, plan.periods.length)} /{" "}
          {formatNumber(plan.periods.length)}
        </span>
        <button
          type="button"
          disabled={stale || offset === 0}
          onClick={() => setRowOffset(Math.max(0, offset - 49))}
        >
          {t("행 이전")}</button>
        <button
          type="button"
          disabled={stale || offset + 49 >= rows.length}
          onClick={() => setRowOffset(offset + 49)}
        >
          {t("행 다음")}</button>
        <button
          type="button"
          disabled={stale || periodOffset === 0}
          onClick={() => setPeriodOffset(Math.max(0, periodOffset - 4))}
        >
          {t("기간 이전")}</button>
        <button
          type="button"
          disabled={stale || periodOffset + 4 >= plan.periods.length}
          onClick={() => setPeriodOffset(periodOffset + 4)}
        >
          {t("기간 다음")}</button>
      </div>
      <div
        className="resource-dashboard-table-scroll resource-plan-scroll"
        role="region"
        tabIndex={0}
        aria-label={t("{value0} 기간 계획표", {value0: mode === "group" ? t("그룹") : t("개인")})}
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
                  ? t("그룹 → 개인 → Milestone")
                  : t("개인 → Milestone")}
              </th>
              {periods.map((p) => (
                <th scope="col" key={p.key}>
                  {p.label}
                  <small>
                    {formatLocaleDateOnly(p.from,LOCALE_FORMATS[locale])}–{formatLocaleDateOnly(p.to,LOCALE_FORMATS[locale])}
                    {p.partial ? t(" · 부분기간") : ""}
                  </small>
                </th>
              ))}
              <th scope="col">{t("전체 조회기간")}</th>
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
                        title={displayName(row, locale)}
                      >
                        {displayName(row, locale)}
                      </span>
                    </button>
                  ) : (
                    <span
                      className="resource-milestone-identity"
                      title={displayName(row, locale)}
                    >
                      {displayName(row, locale)}
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
                  {row.selector.kind === "resource" ? <IdentifierDetails label={t("{value0} 식별 정보", {value0: displayName(row, locale)})} identifiers={[{label:"리소스 ID",value:row.selector.resourceId}, ...(data.catalog.resources.find(resource=>"resourceId" in row.selector && resource.id===row.selector.resourceId)?.code ? [{label:"코드",value:data.catalog.resources.find(resource=>"resourceId" in row.selector && resource.id===row.selector.resourceId)!.code!}] : [])]}/> : row.selector.kind === "group" && row.selector.groupId ? <IdentifierDetails label={t("{value0} 식별 정보", {value0: displayName(row, locale)})} identifiers={[{label:"그룹 ID",value:row.selector.groupId},...(data.catalog.groups.find(group=>"groupId" in row.selector&&group.id===row.selector.groupId)?.code?[{label:"코드",value:data.catalog.groups.find(group=>"groupId" in row.selector&&group.id===row.selector.groupId)!.code!}]:[])]}/> : null}
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
          key={JSON.stringify(selection)}
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
