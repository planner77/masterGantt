"use client";
import { useEffect, useRef, useState } from "react";
import type { ResourceDashboardFilterInput } from "@/contracts/resource-dashboard";
import { resourceExportBodyBudget } from "./resource-export-model";
import { ResourcePlanView } from "./resource-plan-view";
import { ResourceDrillContext, useResourceDrill, type ResourceScheduleRequest } from "./resource-drill-context";
import { resourceParticipationLabel, resourceWbsExcelRequest, resourceWbsPlanUnit } from "./resource-wbs-dashboard-model";
import type { WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import { ContextHelp } from "@/components/ui/context-help";
import { WbsViewDashboard, type WbsViewConsumer, type WbsViewDashboardProps } from "./wbs-view-dashboard";
import { plannedEffort } from "./resource-dashboard-model";
import { RESOURCE_WBS_DEFAULT_SPEC, RESOURCE_WBS_PRESETS, resourceWbsPresentation } from "./resource-wbs-dashboard-model";
import styles from "./wbs-view.module.css";
import planStyles from "./resource-dashboard.module.css";

const consumer: WbsViewConsumer = {
  title: "리소스", defaultSpec: RESOURCE_WBS_DEFAULT_SPEC, presets: RESOURCE_WBS_PRESETS,
  renderSummary: data => <ResourceWbsSummary data={data}/>,
  Controls: ResourceWbsControls,
  renderExtra: (data,state) => <ResourceWbsTools data={data} {...state}/>,
  rowAnnotation: (data,node) => {
    if(node.selector.dimension!=="resource" || !node.selector.id)return undefined;
    const resource=data.configuration.resourceMemberships.find(row=>row.id===node.selector.id);
    return resource ? resourceParticipationLabel(resource) : undefined;
  },
};
export function ResourceWbsDashboard({onResourceSchedule,...props}: Omit<WbsViewDashboardProps,"root"|"consumer"> & {onResourceSchedule?: (request: ResourceScheduleRequest) => void}) {
  const drill=useResourceDrill();
  return <ResourceDrillContext.Provider value={{...drill,onSchedule:onResourceSchedule,onOpenTask:props.onOpenTask ? id=>props.onOpenTask!(id,document.activeElement as HTMLElement) : drill.onOpenTask,onOpenAssignment:props.onOpenAssignment,locked:props.busy}}><WbsViewDashboard {...props} root="resource" consumer={consumer}/></ResourceDrillContext.Provider>;
}
function ResourceWbsSummary({data}:{data:WbsViewReportDto}) {
  const view=resourceWbsPresentation(data);
  return <section className={styles.root} data-testid="resource-wbs-summary" aria-label="리소스 현황">
    <div className={styles.controls}><h4>프로젝트 참여 참고</h4><ContextHelp label="등록 인원과 실제 배정 도움말"><p>등록은 프로젝트 참여, 설비 책임·시스템 역할은 책임 관계입니다. Task 개인 배정이 있어야 계획공수가 생깁니다. 등록 인원·역할만 있는 사람·비활성 기존 참조는 서로 겹칠 수 있으며 합산하지 않습니다. 비활성은 Capacity 0을 뜻하지 않습니다.</p><p>공동 담당자는 같은 Task를 참조해도 다른 Assignment입니다. 선택한 개인의 공수만 포함하며 등록이나 Group으로 숨은 배정을 만들지 않습니다.</p></ContextHelp></div>
    <dl className={styles.summary} aria-label="프로젝트 참여 인원">
      <div><dt>등록 인원</dt><dd>{view.registeredCount}명</dd></div>
      <div><dt>등록만 된 인원</dt><dd>{view.registeredOnlyCount}명</dd></div>
      <div><dt>역할만 있는 인원</dt><dd>{view.roleOnlyCount}명</dd></div>
      <div><dt>Project Task 개인 배정 인원</dt><dd>{view.projectAssignedCount}명</dd></div>
      <div><dt>비활성 기존 참조</dt><dd>{view.inactiveCount}명</dd></div>
    </dl>
    <h4>현재 필터의 고유 작업·개인 배정</h4>
    <dl className={styles.summary} aria-label="리소스 작업 고유 총계">
      <div><dt>고유 Task</dt><dd>{view.tasks.taskCount}건</dd></div>
      <div><dt>완료 / 지연</dt><dd>{view.tasks.completed.count} / {view.tasks.delayed.count}건</dd></div>
      <div><dt>기간가중 진척</dt><dd>{view.tasks.progress.percent===null ? "미산정" : `${view.tasks.progress.percent.toFixed(1)}%`}</dd></div>
      <div><dt>고유 개인 Assignment</dt><dd>{view.assignments.assignmentCount}건</dd></div>
      <div><dt>선택 배정 인원</dt><dd>{view.selectedAssignedCount}명</dd></div>
      <div><dt>관련 계획 M/D</dt><dd>{plannedEffort(view.assignments.effort,"md")}</dd></div>
      <div><dt>관련 계획 M/M</dt><dd>{data.mdPerMm===null ? "환산 기준 미설정" : plannedEffort(view.assignments.effort,"mm")}</dd></div>
      <div><dt>공수 미설정 Assignment</dt><dd>{view.assignments.effort.unsetCount}건</dd></div>
      <div><dt>개인 미배정 Task (T0)</dt><dd>{data.totals.diagnostics.personallyUnassigned.count}건</dd></div>
    </dl>
    <p className={styles.subtle}>등록 인원과 계획공수는 다른 모집단입니다. 공정·WorkArea·설비·물류 시스템·Milestone 경로는 겹칠 수 있으며 소계를 더하지 않습니다. 계획공수는 실제 수행 실적이 아닙니다.</p>
    <details><summary>참여·개인 배정 구분</summary>{view.resources.map(resource=><p key={resource.id}>{resource.name} · {resourceParticipationLabel(resource)}</p>)}</details>
    <details><summary>Project Milestone 전체 Gate ({view.fullMilestones.length})</summary><p className={styles.subtle}>현재 개인의 작업 완료와 전체 Milestone의 멤버·선행 Gate는 별개입니다.</p>{view.fullMilestones.map(({milestoneTaskId,stageGate})=><p key={milestoneTaskId}>{data.configurationCatalog.milestones.find(row=>row.id===milestoneTaskId)?.name??"Milestone"} · {stageGate.blocked?"Blocked":stageGate.ready===true?"Ready":stageGate.ready===false?"Not Ready":"미판정"} · 완료 {stageGate.completedMemberCount}/{stageGate.memberCount} Task · 미완료 선행 {stageGate.incompletePredecessorMilestoneTaskIds.length}개</p>)}</details>
  </section>;
}

function ResourceWbsControls({data,filters,onChange}:{data:WbsViewReportDto|null;filters:ResourceDashboardFilterInput;onChange:(patch:Partial<ResourceDashboardFilterInput>)=>void}) {
  return <div className={styles.controls} aria-label="개인 배정 조건">
    <label>개인<select value={filters.resourceIds?.[0]??""} onChange={event=>onChange({resourceIds:event.target.value?[event.target.value]:[]})}><option value="">전체 개인</option>{data?.configuration.resourceMemberships.map(row=><option key={row.id} value={row.id}>{row.name}{!row.active?" (비활성)":""}</option>)}</select></label>
    <label>Global Role<select value={filters.roles?.[0]??""} onChange={event=>onChange({roles:event.target.value?[event.target.value as "PI"|"DEVELOPER"|"EQUIPMENT_OWNER"|"UNSPECIFIED"]:[]})}><option value="">전체 역할</option><option value="DEVELOPER">DEVELOPER</option><option value="PI">PI</option><option value="EQUIPMENT_OWNER">EQUIPMENT_OWNER</option><option value="UNSPECIFIED">역할 미지정</option></select></label>
    <label>개발 등급<select value={filters.developerGrades?.[0]??""} onChange={event=>onChange({developerGrades:event.target.value?[event.target.value as "BEGINNER"|"INTERMEDIATE"|"ADVANCED"|"EXPERT"|"UNSPECIFIED"]:[]})}><option value="">전체 등급</option><option value="BEGINNER">초급</option><option value="INTERMEDIATE">중급</option><option value="ADVANCED">고급</option><option value="EXPERT">특급</option><option value="UNSPECIFIED">미지정</option></select></label>
    <label>Plan 기간<select value={filters.granularity??""} onChange={event=>onChange({granularity:event.target.value ? event.target.value as "week"|"month" : undefined})}><option value="">Plan 접기</option><option value="week">주간</option><option value="month">월간</option></select></label>
  </div>;
}
function ResourceWbsTools({data,locked,active,onStale}:{data:WbsViewReportDto;locked:boolean;active:boolean;onStale:()=>void}) {
  const drill=useResourceDrill();
  const [unit,setUnit]=useState<"md"|"mm">("md");
  const effectiveUnit=resourceWbsPlanUnit(unit,data.mdPerMm);
  return <>
    <ResourceWbsExport data={data} locked={locked||!active} onStale={onStale}/>
    {data.filters.granularity && data.resourceAdapter ? <section aria-label="현재 개인 배정 Plan" className={`${styles.root} ${planStyles.dashboard}`}><div className={styles.controls}><h4>Resource Plan</h4><label>Plan 단위<select value={effectiveUnit} onChange={event=>setUnit(event.target.value as "md"|"mm")}><option value="md">M/D</option><option value="mm" disabled={data.mdPerMm===null}>M/M</option></select></label></div><p className={styles.subtle}>선택 계획과 같은 개인의 Project 전체 부하 참고를 구별합니다. Capacity는 기존 개인 배정 이력·Calendar 기준이며 등록 인원을 추가하지 않습니다.</p><ResourceDrillContext.Provider value={{...drill,binding:data.resourceAdapter.binding,locked:locked||!active,onSchedule:drill.onSchedule ? request=>drill.onSchedule!({...request,binding:data.resourceAdapter!.binding}) : undefined}}><ResourcePlanView data={data.resourceAdapter.report} mode="resource" unit={effectiveUnit} stale={locked} active={active} onStale={onStale}/></ResourceDrillContext.Provider></section> : null}
  </>;
}
function ResourceWbsExport({data,locked,onStale}:{data:WbsViewReportDto;locked:boolean;onStale:()=>void}) {
  const [basis,setBasis]=useState<"current"|"project">("current");
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const generation=useRef(0), controller=useRef<AbortController|null>(null);
  useEffect(()=>{generation.current++;controller.current?.abort();},[data,locked,basis]);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  async function download(){
    if(locked||pending)return;
    const current=++generation.current;
    controller.current?.abort();const request=new AbortController();controller.current=request;
    setPending(true);setMessage(null);
    try {

      const body=resourceWbsExcelRequest(data,basis);
      if(!resourceExportBodyBudget(body).allowed)throw Error("내보내기 요청이 8 KiB 한도를 초과했습니다. 범위를 줄인 뒤 다시 확인해 주세요.");
      const response=await fetch(`/api/projects/${encodeURIComponent(data.projectPublicId)}/exports/excel`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","If-Match":`"${data.projectRevision}"`},body:JSON.stringify(body),signal:request.signal});
      if(request.signal.aborted||current!==generation.current)return;
      if(!response.ok){const body=await response.json();if(response.status===409||response.status===412)onStale();throw Error(body.error?.message??"Excel 보고서를 만들지 못했습니다. 다시 조회 후 시도하세요.");}
      const blob=await response.blob();
      if(request.signal.aborted||current!==generation.current)return;
      const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="resource-report.xlsx";document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);setMessage("Excel 보고서를 내려받았습니다.");
    }catch(error){if(!request.signal.aborted&&current===generation.current)setMessage(error instanceof Error?error.message:"Excel 보고서 생성 실패");}
    finally{if(controller.current===request)setPending(false);}
  }
  return <section aria-label="현재 리소스 계층 Excel" className={styles.root}><div className={styles.controls}><label>Excel 범위<select value={basis} disabled={pending} onChange={event=>setBasis(event.target.value as "current"|"project")}><option value="current">현재 선택 조건·계층</option><option value="project">Project 전체 (기간·기준일·환산 유지)</option></select></label><button type="button" disabled={locked||pending} onClick={()=>void download()}>계층 Excel 보고서</button></div><p className={styles.subtle}>{basis==="current"?"현재 개인 배정 조건·동적 계층·snapshot과 같은 원시 Task/Assignment를 출력합니다.":"개인·분류·작업·정확 배정 제한을 제거합니다. 현재 화면의 선택 총계와 다를 수 있습니다."} 반복 경로는 근거이며 합산하지 않습니다.</p>{pending?<p role="status">Excel 보고서 생성 중…</p>:null}{message?<p role="status">{message}</p>:null}</section>;
}
