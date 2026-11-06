"use client";
import { wbsViewNodeLabel } from "./wbs-view-model";
import { useI18n } from "../../lib/i18n/provider";

import type { WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import { ContextHelp } from "@/components/ui/context-help";
import { IdentifierDetails } from "@/components/identifier-details";
import { WbsViewDashboard, type WbsViewConsumer, type WbsViewDashboardProps } from "./wbs-view-dashboard";
import { plannedEffort } from "./resource-dashboard-model";
import { PROCESS_WORKAREA_DEFAULT_SPEC, PROCESS_WORKAREA_PRESETS, processWorkareaPresentation } from "./process-workarea-dashboard-model";
import styles from "./wbs-view.module.css";
import processStyles from "./process-workarea-dashboard.module.css";

const consumer: WbsViewConsumer = {
  title: "공정&WorkArea", defaultSpec: PROCESS_WORKAREA_DEFAULT_SPEC,
  presets: PROCESS_WORKAREA_PRESETS, renderSummary: data => <ProcessWorkareaSummary data={data}/>,
};
export function ProcessWorkareaDashboard(props: Omit<WbsViewDashboardProps, "root" | "consumer">) {
  return <WbsViewDashboard {...props} root="process" consumer={consumer}/>;
}
function ProcessWorkareaSummary({ data }: { data: WbsViewReportDto }) {
  const { t, formatNumber, locale } = useI18n();
  const view = processWorkareaPresentation(data,locale);
  return <section className={processStyles.summary} data-testid="process-workarea-summary" aria-label={t("공정과 WorkArea 현황")}>
    <div className={styles.controls}><h4>{t("구성 참고")}</h4><ContextHelp label={t("공정 구성과 작업 범위 도움말")}><p>{t("공정은 Project에 등록된 공정이며 공정 유형·현장 occurrence와 구별합니다. 공정 구성은 주관리 공정 또는 명시 WorkArea 소속의 관련 구성 합집합이며 구역 구성은 해당 소속 원본입니다. 구성 수량은 등록 원본, 작업 지표는 현재 필터의 고유 Task·Assignment입니다. 여러 구역의 관련 수량과 공수를 합산하지 않습니다.")}</p><p>{t("구역 미사용·공정 미매핑·프로젝트 공통은 조회 상태입니다. Task의 명시 공정·구역과 구성 소속은 서로를 자동 생성하지 않습니다. Coverage는 작업 범위이며 설비 배치대수·설치실적이나 공수 배율이 아닙니다.")}</p></ContextHelp></div>
    <dl className={styles.summary} aria-label={t("등록 구성 참고")}>
      <div><dt>{t("고유 Project 공정")}</dt><dd>{formatNumber(view.processCount)}{t("개")}</dd></div>
      <div><dt>{t("고유 WorkArea")}</dt><dd>{formatNumber(view.workAreaCount)}{t("개")}</dd></div>
      <div><dt>{t("설비 관리단위")}</dt><dd>{formatNumber(view.configuration.equipmentIds.length)}{t("개")}</dd></div>
      <div><dt>{t("설비 원본 수량")}</dt><dd>{view.configuration.equipmentQuantity}{t("대")}</dd></div>
      <div><dt>{t("물류 시스템")}</dt><dd>{formatNumber(view.configuration.systemCount)}{t("식")}</dd></div>
      <div><dt>{t("현재 작업 0인 공정")}</dt><dd>{formatNumber(view.zeroTaskProcessCount)}{t("개")}</dd></div>
      <div><dt>{t("현재 작업 미연결 설비 / System")}</dt><dd>{formatNumber(view.unrelatedEquipmentCount)}{t("개 /")}{" "}{formatNumber(view.unrelatedSystemCount)}{t("식")}</dd></div>
    </dl>
    <h4>{t("필터된 작업 범위")}</h4>
    <dl className={styles.summary} aria-label={t("공정 작업 고유 총계")}>
      <div><dt>{t("고유 Task")}</dt><dd>{formatNumber(view.tasks.taskCount)}{t("건")}</dd></div>
      <div><dt>{t("완료 / 지연")}</dt><dd>{formatNumber(view.tasks.completed.count)} / {formatNumber(view.tasks.delayed.count)}{t("건")}</dd></div>
      <div><dt>{t("기간가중 진척")}</dt><dd>{view.tasks.progress.percent === null ? t("미산정") : `${formatNumber(view.tasks.progress.percent,{minimumFractionDigits:1,maximumFractionDigits:1})}%`}</dd></div>
      <div><dt>{t("관련 계획 M/D")}</dt><dd>{plannedEffort(view.assignments.effort, "md", locale)}</dd></div>
      <div><dt>{t("관련 계획 M/M")}</dt><dd>{data.mdPerMm === null ? t("환산 기준 미설정") : plannedEffort(view.assignments.effort, "mm", locale)}</dd></div>
      <div><dt>{t("개인 미배정 Task (T0)")}</dt><dd>{formatNumber(view.diagnostics.personallyUnassigned.count)}{t("건")}</dd></div>
      <div><dt>{t("공수 미설정 Assignment")}</dt><dd>{formatNumber(view.assignments.effort.unsetCount)}{t("건")}</dd></div>
    </dl>
    <p className={styles.subtle}>{t("구성 전체 참고와 필터된 작업은 다른 범위입니다. 공정·구역·설비/System 소계는 중첩되며 상위는 고유 합집합입니다.")}</p>
    <details><summary>{t("공정·구역별 구성 참고")}</summary>{view.processRows.map(process => <details key={process.viewRowKey}><summary>{wbsViewNodeLabel(process,locale)} {t("· 구성 설비")}{" "}{formatNumber(process.totals.configurationReference.equipmentIds.length)}{t("개 / 원본 수량")}{" "}{process.totals.configurationReference.equipmentQuantity}{t("대 · System")}{" "}{formatNumber(process.totals.configurationReference.systemCount)}{t("식")}</summary><p>{t("현재 작업")}{" "}{formatNumber(process.totals.tasks.taskCount)}{t("건 ·")}{" "}{plannedEffort(process.totals.assignments.effort,"md", locale)}</p>{process.children.filter(row=>row.selector.dimension === "workArea").map(area=><p key={area.viewRowKey}>{wbsViewNodeLabel(area,locale)} {t("· 관련 설비")}{" "}{formatNumber(area.totals.configurationReference.equipmentIds.length)}{t("개 / 원본 수량")}{" "}{area.totals.configurationReference.equipmentQuantity}{t("대 · System")}{" "}{formatNumber(area.totals.configurationReference.systemCount)}{t("식 · 현재 작업")}{" "}{formatNumber(area.totals.tasks.taskCount)}{t("건")}</p>)}</details>)}</details>
    <details><summary>{t("구성·연결 진단과 Coverage")}</summary>
      <p>{t("공정 미매핑")}{" "}{formatNumber(data.diagnostics.unmappedProcessIds.length)}{t("개 · 구역 미사용 설비")}{" "}{formatNumber(data.diagnostics.unassignedWorkAreaEquipmentIds.length)}{t("개 · 프로젝트 공통 System")}{" "}{formatNumber(data.diagnostics.projectCommonSystemIds.length)}{t("식")}</p>
      <p>{t("작업 범위의 관련 설비 관리단위")}{" "}{formatNumber(view.relatedMembers.equipmentIds.length)}{t("개 / 원본 수량")}{" "}{view.relatedMembers.equipmentQuantity}{t("대 · 관련 System")}{" "}{formatNumber(view.relatedMembers.systemCount)}{t("식")}</p>
      <p>{t("Legacy 문맥")}{" "}{formatNumber(data.diagnostics.legacyContextTaskIds.length)} {t("Task · 명시 공정 없음")}{" "}{formatNumber(data.diagnostics.explicitEmptyProcessTaskIds.length)} {t("Task. 구역 미사용은 오류가 아닙니다.")}</p>
      {view.relatedMembers.members.map(member => <details key={`${member.kind}:${member.entityId}`}><summary>{view.memberName(member.kind, member.entityId)} · {member.kind === "equipment" ? t("설비") : t("물류 시스템")} · Coverage {member.coverageState === "multiple" ? t("복수 출처") : member.coverageState === "unspecified" ? t("미설정") : t("단일 출처")}</summary><IdentifierDetails identifiers={[{ label: "원본 ID", value: member.entityId }]}/>{member.provenance.length ? <ul>{member.provenance.map((source, index) => <li key={index}>Coverage {source.coverage === null ? t("미설정") : `${source.coverage}%`} · {{whole:t("전체"),partial:t("일부"),unspecified:t("미설정")}[source.coverageMode]}<IdentifierDetails label={t("Coverage 출처 식별 정보")} identifiers={[{label:"Task ID",value:source.taskId},{label:"관계 참조",value:source.bindingId}]}/></li>)}</ul> : <p>{t("직접 연결 · 보존 범위 미지정")}</p>}</details>)}
    </details>
    <details><summary>{t("연관 Milestone 전체 Gate (")}{formatNumber(view.fullMilestones.length)})</summary><p className={styles.subtle}>{t("현재 선택 Task와 관계있는 Milestone의 전체 멤버·선행 조건입니다. 필터된 작업 진척으로 Gate를 대체하지 않습니다.")}</p>{view.fullMilestones.map(({milestoneTaskId,stageGate}) => <div key={milestoneTaskId}><p>{data.configurationCatalog.milestones.find(row=>row.id===milestoneTaskId)?.name ?? t("연관 Milestone")} · {stageGate.blocked ? "Blocked" : stageGate.ready === true ? "Ready" : stageGate.ready === false ? "Not Ready" : t("미판정")} {t("· 완료")}{" "}{formatNumber(stageGate.completedMemberCount)}/{formatNumber(stageGate.memberCount)} {t("Task · 미완료 선행")}{" "}{formatNumber(stageGate.incompletePredecessorMilestoneTaskIds.length)}{t("개")}</p><IdentifierDetails identifiers={[{label:"Milestone ID",value:milestoneTaskId}]}/></div>)}</details>
  </section>;
}
