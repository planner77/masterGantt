"use client";
import { wbsViewNodeLabel } from "./wbs-view-model";
import { displayName } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n/provider";

import type { WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import { ContextHelp } from "@/components/ui/context-help";
import { IdentifierDetails } from "@/components/identifier-details";
import { WbsViewDashboard, type WbsViewConsumer, type WbsViewDashboardProps } from "./wbs-view-dashboard";
import { EQUIPMENT_DEFAULT_SPEC, EQUIPMENT_PRESETS, equipmentPresentation } from "./equipment-dashboard-model";
import { plannedEffort } from "./resource-dashboard-model";
import styles from "./wbs-view.module.css";
import equipmentStyles from "./equipment-dashboard.module.css";

const consumer: WbsViewConsumer = {
  title: "설비", defaultSpec: EQUIPMENT_DEFAULT_SPEC, presets: EQUIPMENT_PRESETS,
  renderFilters: props => <EquipmentTypeFilters {...props}/>,
  renderSummary: data => <EquipmentSummary data={data}/>,
  renderSupplement: data => <EquipmentSupplement data={data}/>,
};
function EquipmentTypeFilters({data,filters,onChange}: Parameters<NonNullable<WbsViewConsumer["renderFilters"]>>[0]) {
  const {t,locale } = useI18n();
    const types = data ? equipmentPresentation(data,locale).types : [];
    const selected = filters.equipmentTypeCodes ?? [];
    return <fieldset className={equipmentStyles.filters}><legend>{t("설비 유형")}</legend><div className={equipmentStyles.types}>
      <button type="button" aria-pressed={!selected.length} onClick={()=>onChange({equipmentTypeCodes:[]})}>{t("전체 유형")}</button>
      {types.map(type=><label key={type.code}><input type="checkbox" checked={selected.includes(type.code)} onChange={event=>onChange({equipmentTypeCodes:event.target.checked?[...selected,type.code]:selected.filter(code=>code!==type.code)})}/>{type.label}</label>)}
    </div><p className={styles.subtle}>{t("유형은 같은 축에서 OR 조건입니다. 구성 참고와 작업 지표에 유형 조건을 적용합니다. 원본 정보는 전체 등록 설비를 보존합니다.")}</p></fieldset>;
}
export function EquipmentDashboard(props: Omit<WbsViewDashboardProps,"root"|"consumer">) {
  return <WbsViewDashboard {...props} root="equipment" consumer={consumer}/>;
}
function EquipmentSummary({data}:{data:WbsViewReportDto}) {
  const { t, formatNumber, locale } = useI18n();
  const view = equipmentPresentation(data,locale);

  return <section className={equipmentStyles.summary} data-testid="equipment-summary" aria-label={t("설비 현황")}>
    <div className={styles.controls}><h4>{t("구성 참고")}</h4><ContextHelp label={t("설비 구성과 작업 범위 도움말")}><p>{t("unit은 개별 관리, fleet은 묶음 관리입니다. 등록 관리단위 수와 고유 원본 수량은 다릅니다. 여러 WorkArea에 연결된 fleet 수량을 구역마다 합산하지 않습니다. 수량과 Coverage는 설치완료 대수나 진척 배율이 아닙니다.")}</p><p>{t("제어 시스템은 원본 controls 관계입니다. 하위 시스템 조회는 같은 Task 업무 연관이며 실제 제어 관계를 생성하거나 추론하지 않습니다. Owner와 개인 Task Assignment도 별개입니다.")}</p></ContextHelp></div>
    <dl className={styles.summary} aria-label={t("등록 구성 참고")}>
      <div><dt>{t("설비 관리단위")}</dt><dd>{formatNumber(view.configuration.equipmentIds.length)}{t("개")}</dd></div>
      <div><dt>{t("설비 원본 수량")}</dt><dd>{view.configuration.equipmentQuantity}{t("대")}</dd></div>
      <div><dt>{t("전체 등록 중 비활성 설비")}</dt><dd>{formatNumber(view.inactive.length)}{t("개")}</dd></div>
      <div><dt>{t("현재 작업 0인 설비")}</dt><dd>{formatNumber(view.zeroTaskRows.length)}{t("개")}</dd></div>
    </dl>
    <h4>{t("필터된 작업 범위")}</h4>
    <dl className={styles.summary} aria-label={t("설비 작업 고유 총계")}>
      <div><dt>{t("고유 Task")}</dt><dd>{formatNumber(view.tasks.taskCount)}{t("건")}</dd></div>
      <div><dt>{t("완료 / 지연")}</dt><dd>{formatNumber(view.tasks.completed.count)} / {formatNumber(view.tasks.delayed.count)}{t("건")}</dd></div>
      <div><dt>{t("기간가중 진척")}</dt><dd>{view.tasks.progress.percent===null?t("미산정"):`${formatNumber(view.tasks.progress.percent,{minimumFractionDigits:1,maximumFractionDigits:1})}%`}</dd></div>
      <div><dt>{t("고유 Assignment")}</dt><dd>{formatNumber(view.assignments.assignmentCount)}{t("건")}</dd></div>
      <div><dt>{t("관련 계획 M/D")}</dt><dd>{plannedEffort(view.assignments.effort,"md", locale)}</dd></div>
      <div><dt>{t("관련 계획 M/M")}</dt><dd>{data.mdPerMm===null?t("환산 기준 미설정"):plannedEffort(view.assignments.effort,"mm", locale)}</dd></div>
      <div><dt>{t("개인 미배정 Task (T0)")}</dt><dd>{formatNumber(view.diagnostics.personallyUnassigned.count)}{t("건")}</dd></div>
      <div><dt>{t("공수 미설정 Assignment")}</dt><dd>{formatNumber(view.assignments.effort.unsetCount)}{t("건")}</dd></div>
    </dl>
    <p className={styles.subtle}>{t("등록 구성 참고와 현재 필터의 고유 작업은 다른 범위입니다. 중첩된 하위 소계를 더하지 않습니다. 설비 미연결 Task도 고유 Task 총계와 미연결 행에 포함됩니다. 개인 미배정과 설비 미연결은 다릅니다.")}</p>
  </section>;
}
function EquipmentSupplement({data}:{data:WbsViewReportDto}) {
  const {t, locale, formatNumber } = useI18n();
  const view = equipmentPresentation(data,locale);
  const nameOf = (dimension:"process"|"workArea"|"system",id:string) => {
    const item = dimension === "process" ? data.configurationCatalog.processes.find(row=>row.id===id) : dimension === "workArea" ? data.configurationCatalog.workAreas.find(row=>row.id===id) : data.configurationCatalog.instances.find(row=>row.kind==="system"&&row.id===id);
    return item ? displayName(item,locale) : t(dimension === "process" ? "공정 정보 없음" : dimension === "workArea" ? "WorkArea 정보 없음" : "시스템 정보 없음");
  };
  return <section className={equipmentStyles.summary} aria-label={t("전체 등록 설비 원본과 연결 진단")}>
    <details><summary>{t("설비 원본 정보")}</summary><p className={styles.subtle}>{t("전체 등록 설비 기준입니다. 유형·기간·작업 필터를 적용한 작업 범위와 구분합니다.")}</p>{view.equipment.map(equipment=><details key={equipment.id}><summary>{displayName(equipment, locale)} · {equipment.managementUnit} · {formatNumber(equipment.quantity)}{t("대 ·")}{" "}{equipment.active?t("활성"):t("비활성")}</summary>
      <dl className={equipmentStyles.metadata}>
        <div><dt>{t("설비 유형")}</dt><dd>{displayName({name:equipment.equipmentTypeName,translations:equipment.equipmentTypeTranslations},locale)}</dd></div>
        <div><dt>{t("주관리 공정")}</dt><dd>{equipment.primaryProcessId === null ? t("공정 미지정") : nameOf("process",equipment.primaryProcessId)}</dd></div>
        <div><dt>{t("WorkArea (전체 소속)")}</dt><dd>{equipment.workAreaLinks.length?equipment.workAreaLinks.map(area=><p key={`${area.processId}:${area.workAreaId}`}>{nameOf("process",area.processId)} → {nameOf("workArea",area.workAreaId)}</p>):t("구역 미사용 (정상 상태)")}</dd></div>
        <div><dt>Owner</dt><dd>{equipment.resourceRoles.filter(role=>role.role==="owner").map(role=><p key={role.resourceId}>{role.resourceName}{role.isPrimary?t(" · 주담당"):""}{!role.active?t(" · 비활성"):""}</p>)}{!equipment.resourceRoles.some(role=>role.role==="owner")?t("Owner 미설정"):null}</dd></div>
        <div><dt>{t("실제 제어 시스템")}</dt><dd>{equipment.controlSystems.length?equipment.controlSystems.map(control=><p key={control.systemId}>{displayName({name:control.systemName,translations:control.systemTranslations},locale)} · {control.controlRole==="primary"?t("주제어"):t("보조제어")}</p>):t("제어 연결 없음")}</dd></div>
      </dl><IdentifierDetails identifiers={[{label:"설비 ID",value:equipment.id},{label:"설비 유형 코드",value:equipment.equipmentType}]}/>
    </details>)}</details>
    <details><summary>{t("연결·설정 진단")}</summary>
      <p>{t("전체 등록 기준 · 구역 미사용")}{" "}{formatNumber(view.withoutWorkArea.length)}{t("개 · Owner 미설정")}{" "}{formatNumber(view.withoutOwner.length)}{t("개 · 주제어 미연결")}{" "}{formatNumber(view.withoutPrimaryControl.length)}{t("개")}</p>
      <p>{t("구역 미사용은 오류가 아닙니다. 비활성 설비와 작업0 설비도 등록 정보로 남습니다. Owner·제어 누락이 Task Assignment나 실제 설치 상태를 뜻하지 않습니다.")}</p>
      {view.equipment.filter(row=>!row.active||!row.workAreaLinks.length||!row.resourceRoles.some(role=>role.role==="owner")||!row.controlSystems.some(control=>control.controlRole==="primary")).map(row=><p key={row.id}>{displayName(row,locale)} · {[!row.active?t("비활성"):null,!row.workAreaLinks.length?t("구역 미사용"):null,!row.resourceRoles.some(role=>role.role==="owner")?t("Owner 미설정"):null,!row.controlSystems.some(control=>control.controlRole==="primary")?t("주제어 미연결"):null].filter(Boolean).join(" · ")}</p>)}
      {view.zeroTaskRows.map(row=><p key={row.viewRowKey}>{wbsViewNodeLabel(row,locale)} {t("· 현재 필터 Task 0")}</p>)}
    </details>
    <details><summary>{t("연관 Milestone 전체 Gate (")}{formatNumber(view.fullMilestones.length)})</summary><p className={styles.subtle}>{t("현재 작업과 연관된 Milestone의 전체 멤버·선행 조건입니다. 설비로 좁힌 작업 진척과 별개이며 Gate를 다시 계산하지 않습니다.")}</p>{view.fullMilestones.map(({milestoneTaskId,stageGate})=><div key={milestoneTaskId}><p>{data.configurationCatalog.milestones.find(row=>row.id===milestoneTaskId)?.name??t("연관 Milestone")} · {stageGate.blocked?"Blocked":stageGate.ready===true?"Ready":stageGate.ready===false?"Not Ready":t("미판정")} {t("· 완료")}{" "}{formatNumber(stageGate.completedMemberCount)}/{formatNumber(stageGate.memberCount)} {t("Task · 미완료 선행")}{" "}{formatNumber(stageGate.incompletePredecessorMilestoneTaskIds.length)}{t("개")}</p><IdentifierDetails identifiers={[{label:"Milestone ID",value:milestoneTaskId}]}/></div>)}</details>
  </section>;
}
