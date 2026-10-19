"use client";
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
  const view = processWorkareaPresentation(data);
  return <section className={processStyles.summary} data-testid="process-workarea-summary" aria-label="공정과 WorkArea 현황">
    <div className={styles.controls}><h4>구성 참고</h4><ContextHelp label="공정 구성과 작업 범위 도움말"><p>공정은 Project에 등록된 공정이며 공정 유형·현장 occurrence와 구별합니다. 공정 구성은 주관리 공정 또는 명시 WorkArea 소속의 관련 구성 합집합이며 구역 구성은 해당 소속 원본입니다. 구성 수량은 등록 원본, 작업 지표는 현재 필터의 고유 Task·Assignment입니다. 여러 구역의 관련 수량과 공수를 합산하지 않습니다.</p><p>구역 미사용·공정 미매핑·프로젝트 공통은 조회 상태입니다. Task의 명시 공정·구역과 구성 소속은 서로를 자동 생성하지 않습니다. Coverage는 작업 범위이며 설비 배치대수·설치실적이나 공수 배율이 아닙니다.</p></ContextHelp></div>
    <dl className={styles.summary} aria-label="등록 구성 참고">
      <div><dt>고유 Project 공정</dt><dd>{view.processCount}개</dd></div>
      <div><dt>고유 WorkArea</dt><dd>{view.workAreaCount}개</dd></div>
      <div><dt>설비 관리단위</dt><dd>{view.configuration.equipmentIds.length}개</dd></div>
      <div><dt>설비 원본 수량</dt><dd>{view.configuration.equipmentQuantity}대</dd></div>
      <div><dt>물류 시스템</dt><dd>{view.configuration.systemCount}식</dd></div>
      <div><dt>현재 작업 0인 공정</dt><dd>{view.zeroTaskProcessCount}개</dd></div>
      <div><dt>현재 작업 미연결 설비 / System</dt><dd>{view.unrelatedEquipmentCount}개 / {view.unrelatedSystemCount}식</dd></div>
    </dl>
    <h4>필터된 작업 범위</h4>
    <dl className={styles.summary} aria-label="공정 작업 고유 총계">
      <div><dt>고유 Task</dt><dd>{view.tasks.taskCount}건</dd></div>
      <div><dt>완료 / 지연</dt><dd>{view.tasks.completed.count} / {view.tasks.delayed.count}건</dd></div>
      <div><dt>기간가중 진척</dt><dd>{view.tasks.progress.percent === null ? "미산정" : `${view.tasks.progress.percent.toFixed(1)}%`}</dd></div>
      <div><dt>관련 계획 M/D</dt><dd>{plannedEffort(view.assignments.effort, "md")}</dd></div>
      <div><dt>관련 계획 M/M</dt><dd>{data.mdPerMm === null ? "환산 기준 미설정" : plannedEffort(view.assignments.effort, "mm")}</dd></div>
      <div><dt>개인 미배정 Task (T0)</dt><dd>{view.diagnostics.personallyUnassigned.count}건</dd></div>
      <div><dt>공수 미설정 Assignment</dt><dd>{view.assignments.effort.unsetCount}건</dd></div>
    </dl>
    <p className={styles.subtle}>구성 전체 참고와 필터된 작업은 다른 범위입니다. 공정·구역·설비/System 소계는 중첩되며 상위는 고유 합집합입니다.</p>
    <details><summary>공정·구역별 구성 참고</summary>{view.processRows.map(process => <details key={process.viewRowKey}><summary>{process.name} · 구성 설비 {process.totals.configurationReference.equipmentIds.length}개 / 원본 수량 {process.totals.configurationReference.equipmentQuantity}대 · System {process.totals.configurationReference.systemCount}식</summary><p>현재 작업 {process.totals.tasks.taskCount}건 · {plannedEffort(process.totals.assignments.effort,"md")}</p>{process.children.filter(row=>row.selector.dimension === "workArea").map(area=><p key={area.viewRowKey}>{area.name ?? "WorkArea 없음 (조회 상태)"} · 관련 설비 {area.totals.configurationReference.equipmentIds.length}개 / 원본 수량 {area.totals.configurationReference.equipmentQuantity}대 · System {area.totals.configurationReference.systemCount}식 · 현재 작업 {area.totals.tasks.taskCount}건</p>)}</details>)}</details>
    <details><summary>구성·연결 진단과 Coverage</summary>
      <p>공정 미매핑 {data.diagnostics.unmappedProcessIds.length}개 · 구역 미사용 설비 {data.diagnostics.unassignedWorkAreaEquipmentIds.length}개 · 프로젝트 공통 System {data.diagnostics.projectCommonSystemIds.length}식</p>
      <p>작업 범위의 관련 설비 관리단위 {view.relatedMembers.equipmentIds.length}개 / 원본 수량 {view.relatedMembers.equipmentQuantity}대 · 관련 System {view.relatedMembers.systemCount}식</p>
      <p>Legacy 문맥 {data.diagnostics.legacyContextTaskIds.length} Task · 명시 공정 없음 {data.diagnostics.explicitEmptyProcessTaskIds.length} Task. 구역 미사용은 오류가 아닙니다.</p>
      {view.relatedMembers.members.map(member => <details key={`${member.kind}:${member.entityId}`}><summary>{view.memberName(member.kind, member.entityId)} · {member.kind === "equipment" ? "설비" : "물류 시스템"} · Coverage {member.coverageState === "multiple" ? "복수 출처" : member.coverageState === "unspecified" ? "미설정" : "단일 출처"}</summary><IdentifierDetails identifiers={[{ label: "원본 ID", value: member.entityId }]}/>{member.provenance.length ? <ul>{member.provenance.map((source, index) => <li key={index}>Coverage {source.coverage === null ? "미설정" : `${source.coverage}%`} · {{whole:"전체",partial:"일부",unspecified:"미설정"}[source.coverageMode]}<IdentifierDetails label="Coverage 출처 식별 정보" identifiers={[{label:"Task ID",value:source.taskId},{label:"Target ID",value:source.targetId},{label:"Binding ID",value:source.bindingId}]}/></li>)}</ul> : <p>Legacy 직접 연결 · Target Coverage 없음</p>}</details>)}
    </details>
    <details><summary>연관 Milestone 전체 Gate ({view.fullMilestones.length})</summary><p className={styles.subtle}>현재 선택 Task와 관계있는 Milestone의 전체 멤버·선행 조건입니다. 필터된 작업 진척으로 Gate를 대체하지 않습니다.</p>{view.fullMilestones.map(({milestoneTaskId,stageGate}) => <div key={milestoneTaskId}><p>{data.configurationCatalog.milestones.find(row=>row.id===milestoneTaskId)?.name ?? "연관 Milestone"} · {stageGate.blocked ? "Blocked" : stageGate.ready === true ? "Ready" : stageGate.ready === false ? "Not Ready" : "미판정"} · 완료 {stageGate.completedMemberCount}/{stageGate.memberCount} Task · 미완료 선행 {stageGate.incompletePredecessorMilestoneTaskIds.length}개</p><IdentifierDetails identifiers={[{label:"Milestone ID",value:milestoneTaskId}]}/></div>)}</details>
  </section>;
}
