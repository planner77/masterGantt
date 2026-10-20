"use client";
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
  renderFilters: ({data,filters,onChange}) => {
    const types = data ? equipmentPresentation(data).types : [];
    const selected = filters.equipmentTypeCodes ?? [];
    return <fieldset className={equipmentStyles.filters}><legend>설비 유형</legend><div className={equipmentStyles.types}>
      <button type="button" aria-pressed={!selected.length} onClick={()=>onChange({equipmentTypeCodes:[]})}>전체 유형</button>
      {types.map(type=><label key={type.code}><input type="checkbox" checked={selected.includes(type.code)} onChange={event=>onChange({equipmentTypeCodes:event.target.checked?[...selected,type.code]:selected.filter(code=>code!==type.code)})}/>{type.name}</label>)}
    </div><p className={styles.subtle}>유형은 같은 축에서 OR 조건입니다. 구성 참고와 작업 지표에 유형 조건을 적용합니다. 원본 정보는 전체 등록 설비를 보존합니다.</p></fieldset>;
  },
  renderSummary: data => <EquipmentSummary data={data}/>,
  renderSupplement: data => <EquipmentSupplement data={data}/>,
};
export function EquipmentDashboard(props: Omit<WbsViewDashboardProps,"root"|"consumer">) {
  return <WbsViewDashboard {...props} root="equipment" consumer={consumer}/>;
}
function EquipmentSummary({data}:{data:WbsViewReportDto}) {
  const view = equipmentPresentation(data);

  return <section className={equipmentStyles.summary} data-testid="equipment-summary" aria-label="설비 현황">
    <div className={styles.controls}><h4>구성 참고</h4><ContextHelp label="설비 구성과 작업 범위 도움말"><p>unit은 개별 관리, fleet은 묶음 관리입니다. 등록 관리단위 수와 고유 원본 수량은 다릅니다. 여러 WorkArea에 연결된 fleet 수량을 구역마다 합산하지 않습니다. 수량과 Coverage는 설치완료 대수나 진척 배율이 아닙니다.</p><p>제어 시스템은 원본 controls 관계입니다. 하위 시스템 조회는 같은 Task 업무 연관이며 실제 제어 관계를 생성하거나 추론하지 않습니다. Owner와 개인 Task Assignment도 별개입니다.</p></ContextHelp></div>
    <dl className={styles.summary} aria-label="등록 구성 참고">
      <div><dt>설비 관리단위</dt><dd>{view.configuration.equipmentIds.length}개</dd></div>
      <div><dt>설비 원본 수량</dt><dd>{view.configuration.equipmentQuantity}대</dd></div>
      <div><dt>전체 등록 중 비활성 설비</dt><dd>{view.inactive.length}개</dd></div>
      <div><dt>현재 작업 0인 설비</dt><dd>{view.zeroTaskRows.length}개</dd></div>
    </dl>
    <h4>필터된 작업 범위</h4>
    <dl className={styles.summary} aria-label="설비 작업 고유 총계">
      <div><dt>고유 Task</dt><dd>{view.tasks.taskCount}건</dd></div>
      <div><dt>완료 / 지연</dt><dd>{view.tasks.completed.count} / {view.tasks.delayed.count}건</dd></div>
      <div><dt>기간가중 진척</dt><dd>{view.tasks.progress.percent===null?"미산정":`${view.tasks.progress.percent.toFixed(1)}%`}</dd></div>
      <div><dt>고유 Assignment</dt><dd>{view.assignments.assignmentCount}건</dd></div>
      <div><dt>관련 계획 M/D</dt><dd>{plannedEffort(view.assignments.effort,"md")}</dd></div>
      <div><dt>관련 계획 M/M</dt><dd>{data.mdPerMm===null?"환산 기준 미설정":plannedEffort(view.assignments.effort,"mm")}</dd></div>
      <div><dt>개인 미배정 Task (T0)</dt><dd>{view.diagnostics.personallyUnassigned.count}건</dd></div>
      <div><dt>공수 미설정 Assignment</dt><dd>{view.assignments.effort.unsetCount}건</dd></div>
    </dl>
    <p className={styles.subtle}>등록 구성 참고와 현재 필터의 고유 작업은 다른 범위입니다. 중첩된 하위 소계를 더하지 않습니다. 설비 미연결 Task도 고유 Task 총계와 미연결 행에 포함됩니다. 개인 미배정과 설비 미연결은 다릅니다.</p>
  </section>;
}
function EquipmentSupplement({data}:{data:WbsViewReportDto}) {
  const view = equipmentPresentation(data);
  const nameOf = (dimension:"process"|"workArea"|"system",id:string) => dimension === "process" ? data.configurationCatalog.processes.find(row=>row.id===id)?.name ?? "공정 정보 없음" : dimension === "workArea" ? data.configurationCatalog.workAreas.find(row=>row.id===id)?.name ?? "WorkArea 정보 없음" : data.configurationCatalog.instances.find(row=>row.kind==="system"&&row.id===id)?.name ?? "시스템 정보 없음";
  return <section className={equipmentStyles.summary} aria-label="전체 등록 설비 원본과 연결 진단">
    <details><summary>설비 원본 정보</summary><p className={styles.subtle}>전체 등록 설비 기준입니다. 유형·기간·작업 필터를 적용한 작업 범위와 구분합니다.</p>{view.equipment.map(equipment=><details key={equipment.id}><summary>{equipment.name} · {equipment.managementUnit} · {equipment.quantity}대 · {equipment.active?"활성":"비활성"}</summary>
      <dl className={equipmentStyles.metadata}>
        <div><dt>설비 유형</dt><dd>{equipment.equipmentTypeName}</dd></div>
        <div><dt>주관리 공정</dt><dd>{nameOf("process",equipment.primaryProcessId)}</dd></div>
        <div><dt>WorkArea (전체 소속)</dt><dd>{equipment.workAreaLinks.length?equipment.workAreaLinks.map(area=><p key={`${area.processId}:${area.workAreaId}`}>{nameOf("process",area.processId)} → {nameOf("workArea",area.workAreaId)}</p>):"구역 미사용 (정상 상태)"}</dd></div>
        <div><dt>Owner</dt><dd>{equipment.resourceRoles.filter(role=>role.role==="owner").map(role=><p key={role.resourceId}>{role.resourceName}{role.isPrimary?" · 주담당":""}{!role.active?" · 비활성":""}</p>)}{!equipment.resourceRoles.some(role=>role.role==="owner")?"Owner 미설정":null}</dd></div>
        <div><dt>실제 제어 시스템</dt><dd>{equipment.controlSystems.length?equipment.controlSystems.map(control=><p key={control.systemId}>{control.systemName} · {control.controlRole==="primary"?"주제어":"보조제어"}</p>):"제어 연결 없음"}</dd></div>
      </dl><IdentifierDetails identifiers={[{label:"설비 ID",value:equipment.id},{label:"설비 유형 코드",value:equipment.equipmentType}]}/>
    </details>)}</details>
    <details><summary>연결·설정 진단</summary>
      <p>전체 등록 기준 · 구역 미사용 {view.withoutWorkArea.length}개 · Owner 미설정 {view.withoutOwner.length}개 · 주제어 미연결 {view.withoutPrimaryControl.length}개</p>
      <p>구역 미사용은 오류가 아닙니다. 비활성 설비와 작업0 설비도 등록 정보로 남습니다. Owner·제어 누락이 Task Assignment나 실제 설치 상태를 뜻하지 않습니다.</p>
      {view.equipment.filter(row=>!row.active||!row.workAreaLinks.length||!row.resourceRoles.some(role=>role.role==="owner")||!row.controlSystems.some(control=>control.controlRole==="primary")).map(row=><p key={row.id}>{row.name} · {[!row.active?"비활성":null,!row.workAreaLinks.length?"구역 미사용":null,!row.resourceRoles.some(role=>role.role==="owner")?"Owner 미설정":null,!row.controlSystems.some(control=>control.controlRole==="primary")?"주제어 미연결":null].filter(Boolean).join(" · ")}</p>)}
      {view.zeroTaskRows.map(row=><p key={row.viewRowKey}>{row.name} · 현재 필터 Task 0</p>)}
    </details>
    <details><summary>연관 Milestone 전체 Gate ({view.fullMilestones.length})</summary><p className={styles.subtle}>현재 작업과 연관된 Milestone의 전체 멤버·선행 조건입니다. 설비로 좁힌 작업 진척과 별개이며 Gate를 다시 계산하지 않습니다.</p>{view.fullMilestones.map(({milestoneTaskId,stageGate})=><div key={milestoneTaskId}><p>{data.configurationCatalog.milestones.find(row=>row.id===milestoneTaskId)?.name??"연관 Milestone"} · {stageGate.blocked?"Blocked":stageGate.ready===true?"Ready":stageGate.ready===false?"Not Ready":"미판정"} · 완료 {stageGate.completedMemberCount}/{stageGate.memberCount} Task · 미완료 선행 {stageGate.incompletePredecessorMilestoneTaskIds.length}개</p><IdentifierDetails identifiers={[{label:"Milestone ID",value:milestoneTaskId}]}/></div>)}</details>
  </section>;
}
