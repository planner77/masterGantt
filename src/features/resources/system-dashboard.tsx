"use client";
import { displayName } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n/provider";

import { useMemo, useState } from "react";
import type { ProjectLogisticsDto } from "@/contracts/logistics";
import type { WbsViewReportDto, WbsViewSpec } from "@/contracts/wbs-dashboard-views";
import { ContextHelp } from "@/components/ui/context-help";
import { IdentifierDetails } from "@/components/identifier-details";
import { WbsViewDashboard, type WbsViewConsumer, type WbsViewDashboardProps } from "./wbs-view-dashboard";
import { plannedEffort } from "./resource-dashboard-model";
import { SYSTEM_DEFAULT_SPEC, SYSTEM_PRESETS, selectSystemIds, systemPresentation, type SystemAttributeFilters } from "./system-dashboard-model";
import styles from "./wbs-view.module.css";
import systemStyles from "./system-dashboard.module.css";

export function SystemDashboard({ logistics, ...props }: Omit<WbsViewDashboardProps, "root" | "consumer"> & { logistics: ProjectLogisticsDto }) {
  const consumer = useMemo<WbsViewConsumer>(() => ({ title: "물류 시스템", defaultSpec: SYSTEM_DEFAULT_SPEC, presets: SYSTEM_PRESETS,
    renderControls: context => <SystemControls {...context} logistics={logistics}/>,
    renderSummary: data => <SystemSummary data={data} logistics={logistics} revision={props.revision}/>,
  }), [logistics, props.revision]);
  return <WbsViewDashboard {...props} root="system" consumer={consumer}/>;
}
function SystemControls({ spec, onApply, disabled, logistics }: { spec: WbsViewSpec; onApply: (spec: WbsViewSpec) => void; disabled: boolean; logistics: ProjectLogisticsDto }) {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<SystemAttributeFilters>({});
  const legacy = spec.systemView === undefined && spec.systemIds === undefined;
  const options = (role: "pi" | "developer") => [...new Map(logistics.systems.flatMap(system => system.resourceRoles.filter(row => row.role === role && row.active).map(row => [row.resourceId, row] as const))).values()];
  return <fieldset className={systemStyles.filters} disabled={disabled}><legend>{t("시스템 조회 범위")}</legend><div className={styles.controls}>
    <label>{t("시스템 연결 범위")}<select value={legacy ? "legacy" : spec.systemView ?? "direct"} onChange={event => { if (event.target.value !== "legacy") onApply({ ...spec, systemView: event.target.value as "direct" | "coordination" }); }}>{legacy ? <option value="legacy">{t("기존 전체 작업 (호환)")}</option> : null}<option value="direct">{t("직접 연결만")}</option><option value="coordination">{t("조율 범위 포함")}</option></select></label>
    <span>{t("시스템 선택:")}{" "}{spec.systemIds === undefined ? t("전체") : t("{value0}식", {value0: spec.systemIds.length})}</span>
    <button type="button" onClick={() => { setFilters({}); const next = { ...spec }; delete next.systemIds; onApply(next); }}>{t("시스템 필터 초기화")}</button>
    </div>{legacy ? <p role="status" className={styles.subtle}>{t("저장된 이전 조회는 시스템 미연결 프로젝트 작업도 포함합니다. 직접 연결만 또는 조율 범위 포함을 선택하면 해당 범위로 전환합니다.")}</p> : null}<details><summary>{t("시스템 속성 필터")}</summary><div className={styles.controls}>
    <label>{t("시스템 유형")}<select value={filters.type ?? ""} onChange={event => setFilters({ ...filters, type: event.target.value })}><option value="">{t("전체")}</option>{[...new Set(logistics.systems.map(row => row.systemType))].map(type => <option key={type} value={type}>{type}</option>)}</select></label>
    <label>{t("시스템 계층")}<select value={filters.layer ?? ""} onChange={event => setFilters({ ...filters, layer: event.target.value })}><option value="">{t("전체")}</option><option value="controller">Controller</option><option value="coordinator">Coordinator</option></select></label>
    <label>{t("시스템 공정 범위")}<select value={filters.scope ?? ""} onChange={event => setFilters({ ...filters, scope: event.target.value })}><option value="">{t("전체")}</option><option value="project">{t("프로젝트 공통")}</option><option value="processes">{t("명시 공정")}</option></select></label>
    <label>{t("시스템 공정")}<select value={filters.process ?? ""} onChange={event => setFilters({ ...filters, process: event.target.value })}><option value="">{t("전체")}</option>{logistics.processes.map(row => <option key={row.id} value={row.id}>{displayName(row,locale)}</option>)}</select></label>
    {(["pi", "developer"] as const).map(role => <label key={role}>{role === "pi" ? t("시스템 PI") : t("시스템 개발자")}<select value={filters[role] ?? ""} onChange={event => setFilters({ ...filters, [role]: event.target.value })}><option value="">{t("전체")}</option><option value="missing">{t("미설정")}</option>{options(role).map(row => <option key={row.resourceId} value={row.resourceId}>{row.resourceName}</option>)}</select></label>)}
    <button type="button" onClick={() => onApply({ ...spec, systemView: spec.systemView ?? "direct", systemIds: selectSystemIds(logistics, filters) })}>{t("시스템 속성 필터 적용")}</button>
    </div><p className={styles.subtle}>{t("속성은 필터 초안입니다. 적용하면 서버의 Task·공수 조회 범위도 변경됩니다. 저장·복원은 선택된 시스템을 유지하며, 초안은 다시 선택할 수 있습니다.")}</p></details>
  </fieldset>;
}
function SystemSummary({ data, logistics, revision }: { data: WbsViewReportDto; logistics: ProjectLogisticsDto; revision: number }) {
  const { t, locale, formatNumber } = useI18n();
  const view = systemPresentation(data);
  const legacy = data.spec.systemView === undefined && data.spec.systemIds === undefined;
  const current = data.projectRevision === revision;
  const systems = current ? logistics.systems.filter(system => view.systemRows.some(row => row.selector.id === system.id)) : [];
  return <section className={systemStyles.summary} data-testid="system-dashboard-summary" aria-label={t("물류 시스템 현황")}>
    <div className={styles.controls}><h4>{t("구성 참고")}</h4><ContextHelp label={t("물류 시스템 조회 도움말")}><p>{t("시스템 1개는 1식이며 제어 설비 관리단위·원본 수량과 Task·Assignment·계획공수는 별도입니다. 조율 범위는 저장된 coordinates와 Controller의 controls만 따릅니다. 같은 Task의 등장으로 제어·조율 관계를 만들지 않습니다.")}</p><p>{t("하위 조회 축은 원본 관계를 변경하지 않습니다. 공유 시스템의 중첩 소계는 합산하지 않습니다. PI·개발자 등록은 개인 배정이나 실제 투입 실적이 아닙니다. 운영 가동률·개발 실적은 추정하지 않습니다.")}</p></ContextHelp></div>
    <dl className={styles.summary} aria-label={t("시스템 구성 참고")}><div><dt>{t("등록 시스템")}</dt><dd>{view.systemRows.length}{t("식")}</dd></div><div><dt>{legacy ? t("프로젝트 구성 설비 관리단위") : t("제어 설비 관리단위")}</dt><dd>{view.configuration.equipmentIds.length}{t("개")}</dd></div><div><dt>{legacy ? t("프로젝트 구성 설비 원본 수량") : t("제어 설비 원본 수량")}</dt><dd>{view.configuration.equipmentQuantity}{t("대")}</dd></div><div><dt>{t("현재 작업 0인 시스템")}</dt><dd>{view.zeroTaskSystemCount}{t("식")}</dd></div></dl>
    {legacy ? <p className={styles.subtle}>{t("기존 전체 작업 (호환): 구성 참고는 프로젝트 전체 등록 범위이며, 작업은 시스템 미연결 작업도 포함합니다.")}</p> : null}
    <h4>{t("필터된 작업 범위")}</h4><dl className={styles.summary} aria-label={t("시스템 작업 고유 총계")}>
    <div><dt>{t("고유 Task")}</dt><dd>{view.tasks.taskCount}{t("건")}</dd></div><div><dt>{t("완료 / 지연")}</dt><dd>{view.tasks.completed.count} / {view.tasks.delayed.count}{t("건")}</dd></div><div><dt>{t("기간가중 진척")}</dt><dd>{view.tasks.progress.percent === null ? t("미산정") : `${formatNumber(view.tasks.progress.percent,{minimumFractionDigits:1,maximumFractionDigits:1})}%`}</dd></div><div><dt>{t("관련 계획 M/D")}</dt><dd>{plannedEffort(view.assignments.effort, "md", locale)}</dd></div><div><dt>{t("관련 계획 M/M")}</dt><dd>{data.mdPerMm === null ? t("환산 기준 미설정") : plannedEffort(view.assignments.effort, "mm", locale)}</dd></div><div><dt>{t("개인 미배정 Task (T0)")}</dt><dd>{view.diagnostics.personallyUnassigned.count}{t("건")}</dd></div><div><dt>{t("공수 미설정 Assignment")}</dt><dd>{view.assignments.effort.unsetCount}{t("건")}</dd></div></dl>
    <details><summary>{t("시스템 속성·제어·조율 원본")}</summary>{!current ? <p role="status">{t("이전 조회 결과입니다. 속성은 최신 조회 후 표시합니다.")}</p> : systems.map(system => {
      const row = view.systemRows.find(row => row.selector.id === system.id)!;
      return <details key={system.id}><summary>{displayName(system, locale)} · {system.systemType} · {system.layer === "controller" ? "Controller" : "Coordinator"} {t("· 1식 · 현재 작업")}{" "}{row.taskIds.length}{t("건")}</summary>
        <p>{system.scope === "project" ? t("프로젝트 공통") : t("명시 공정: {value0}", {value0: system.processIds.map(id => logistics.processes.find(process => process.id === id)?.name ?? "공정 확인 필요").join(" / ")})}</p>
        <p>{t("제어 설비")}{" "}{row.totals.configurationReference.equipmentIds.length}{t("개 / 원본 수량")}{" "}{row.totals.configurationReference.equipmentQuantity}{t("대")}</p>
        <p>{t("직접 controls:")}{" "}{logistics.equipment.filter(equipment => equipment.controlSystems.some(control => control.systemId === system.id)).map(equipment => equipment.name).join(" / ") || t("없음")}</p>
        <p>{t("직접 coordinates:")}{" "}{system.coordinatedSystemIds.map(id => logistics.systems.find(item => item.id === id)?.name ?? "연결 확인 필요").join(" / ") || t("없음")}</p>
        {(["pi", "developer"] as const).map(role => <p key={role}>{role === "pi" ? "PI" : t("개발자")}: {system.resourceRoles.filter(item => item.role === role && item.active).map(item => item.resourceName).join(" / ") || t("미설정")}</p>)}
        <IdentifierDetails identifiers={[{ label: "시스템 코드", value: system.code }, { label: "시스템 ID", value: system.id }]}/>
      </details>;
    })}</details>
    <details><summary>{t("시스템 누락·불일치 진단")}</summary>{current ? <><p>{t("선택 시스템 구성 · 프로젝트 공통")}{" "}{systems.filter(system => system.scope === "project").length}{t("식 · 복수 공정")}{" "}{systems.filter(system => system.processIds.length > 1).length}{t("식 · PI 미설정")}{" "}{systems.filter(system => !system.resourceRoles.some(role => role.role === "pi" && role.active)).length}{t("식 · 개발자 미설정")}{" "}{systems.filter(system => !system.resourceRoles.some(role => role.role === "developer" && role.active)).length}{t("식")}</p>
    <p>{t("공정 범위 불일치 Task")}{" "}{new Set(systems.flatMap(system => { const row = view.systemRows.find(row => row.selector.id === system.id)!; return data.taskSources.filter(task => task.type === "task" && row.taskIds.includes(task.taskId) && system.scope === "processes" && task.processIds.some(id => !system.processIds.includes(id))).map(task => task.taskId); })).size}{t("건")}</p></> : <p role="status">{t("이전 조회 결과입니다. 시스템 진단은 최신 조회 후 표시합니다.")}</p>}
    <p>{t("프로젝트 전체 canonical 참고 · 명시 공정 없음 엔터티")}{" "}{data.diagnostics.explicitEmptyProcessTaskIds.length}{t("개 · 공정 미매핑")}{" "}{data.diagnostics.unmappedProcessIds.length}{t("개. 엔터티는 일반 Task·Summary·Milestone을 포함하며 현재 선택과 무관합니다. WorkArea 미사용은 정상 조회 상태입니다.")}</p></details>
    <details><summary>{t("연관 Milestone 전체 Gate (")}{view.fullMilestones.length})</summary><p className={styles.subtle}>{t("필터된 Task 진척과 별개인 전체 멤버·선행 조건입니다.")}</p>{view.fullMilestones.map(({ milestoneTaskId, stageGate }) => <div key={milestoneTaskId}><p>{data.configurationCatalog.milestones.find(row => row.id === milestoneTaskId)?.name ?? t("연관 Milestone")} · {stageGate.blocked ? "Blocked" : stageGate.ready === true ? "Ready" : stageGate.ready === false ? "Not Ready" : t("미판정")} {t("· 완료")}{" "}{stageGate.completedMemberCount}/{stageGate.memberCount} {t("Task · 미완료 선행")}{" "}{stageGate.incompletePredecessorMilestoneTaskIds.length}{t("개")}</p><IdentifierDetails identifiers={[{ label: "Milestone ID", value: milestoneTaskId }]}/></div>)}</details>
  </section>;
}
