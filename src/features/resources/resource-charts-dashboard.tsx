"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ResourceAnalysisCell, ResourceAnalysisDimension, ResourceAnalysisPlanSelector } from "@/contracts/resource-analysis";
import type { ResourceDashboardFilterInput } from "@/contracts/resource-dashboard";
import type { WbsViewReportDto } from "@/contracts/wbs-dashboard-views";
import { selectResourceAnalysisDetails, selectResourceAnalysisPlanDetails } from "@/domain/resources/resource-analysis";
import { IdentifierDetails } from "@/components/identifier-details";
import { fetchWbsView, stableWbsValue } from "./wbs-view-transport";
import { ResourceWbsExport } from "./resource-wbs-dashboard";
import { RESOURCE_WBS_DEFAULT_SPEC } from "./resource-wbs-dashboard-model";
import { useResourceWorkspace } from "./resource-workspace";
import type { WbsViewDashboardProps } from "./wbs-view-dashboard";
import type { ResourceScheduleRequest } from "./resource-drill-context";
import { RESOURCE_CHART_LABELS, RESOURCE_CHART_PERIOD_SIZE, resourceChartCellName, resourceChartDiagnosticQuery, resourceChartDiagnosticSelection, resourceChartEffort, resourceChartMetricValue, resourceChartName, resourceChartPercent, resourceChartPlanText, resourceChartQuery, resourceChartRank, type ResourceChartKind, type ResourceChartMetric } from "./resource-charts-model";
import styles from "./resource-charts.module.css";

type Selection = { label:string; scopeKey:string; taskIds:string[]; assignmentIds:string[]; plan?:ResourceAnalysisPlanSelector; diagnosticT0?:boolean };
type Props = Omit<WbsViewDashboardProps,"root"|"consumer"> & { onResourceSchedule?: (request:ResourceScheduleRequest)=>void };
const TYPES: Array<[ResourceChartKind,string]> = [["period","기간 투입"],["concentration","업무 집중"],["contribution","기여 분포"]];
const metrics: Array<[ResourceChartMetric,string]> = [["effort","계획공수"],["tasks","고유 Task"],["completed","완료 Task"],["delayed","지연 Task"]];
const number = (value:number) => value.toLocaleString("ko-KR",{maximumFractionDigits:2});

/** One active chart query shares one authenticated WBS read and the R2 analysis model. */
export function ResourceChartsDashboard({ publicId,revision,active,busy,binding,onOpenTask,onOpenAssignment,onSchedule,onResourceSchedule }: Props) {
  const workspace=useResourceWorkspace();
  const [kind,setKind]=useState<ResourceChartKind>("period");
  const [concentration,setConcentration]=useState<ResourceAnalysisDimension>("resource");
  const [contribution,setContribution]=useState<ResourceAnalysisDimension>("milestone");
  const [metric,setMetric]=useState<ResourceChartMetric>("effort");
  const [filters,setFilters]=useState<ResourceDashboardFilterInput>({granularity:"week"});
  const [unit,setUnit]=useState<"M/D"|"M/M">("M/D");
  const [demand,setDemand]=useState<"selected"|"project">("selected");
  const [top,setTop]=useState<number|"all">(10);
  const [page,setPage]=useState(0),[periodPage,setPeriodPage]=useState(0);
  const [advanced,setAdvanced]=useState(false),[notice,setNotice]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[stale,setStale]=useState(false);
  const [report,setReport]=useState<{key:string;data:WbsViewReportDto}|null>(null);
  const [selection,setSelection]=useState<Selection|null>(null),[detailPage,setDetailPage]=useState(0),[actionPending,setActionPending]=useState(false);
  const reportCache=useRef<{key:string;refresh:number}|null>(null);
  const generation=useRef(0),actionGeneration=useRef(0),actionController=useRef<AbortController|null>(null),intentController=useRef<AbortController|null>(null),mounted=useRef(true);
  const fallback=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLElement|null>(null),heading=useRef<HTMLHeadingElement>(null),detail=useRef<HTMLElement>(null);
  const scroll=useRef<HTMLDivElement>(null),scrollPosition=useRef({top:0,left:0});
  const selectionScroll=useRef<Array<{element:HTMLElement;top:number;left:number}>>([]);
  const rememberTrigger=(element:HTMLElement)=>{
    trigger.current=element;selectionScroll.current=[];
    for(let owner=element.parentElement;owner;owner=owner.parentElement){
      if(owner.scrollHeight>owner.clientHeight||owner.scrollWidth>owner.clientWidth)selectionScroll.current.push({element:owner,top:owner.scrollTop,left:owner.scrollLeft});
      if(owner.matches(".project-resource-panel"))break;
    }
  };
  const granularity=filters.granularity??"week";
  const effectiveUnit=report?.data.mdPerMm===null?"M/D":unit;
  const query=useMemo(()=>resourceChartQuery(kind,concentration,contribution,granularity,effectiveUnit),[kind,concentration,contribution,granularity,effectiveUnit]);
  const key=stableWbsValue({publicId,revision,filters,query,scope:binding?.scope});
  const liveKey=useRef(""),viewLease=useRef(""),focusGeneration=useRef(0);
  const validRange=!(filters.from&&filters.to&&filters.from>filters.to);
  useLayoutEffect(()=>{liveKey.current=stableWbsValue([key,active,busy]);actionGeneration.current++;actionController.current?.abort();},[key,active,busy]);
  useLayoutEffect(()=>{viewLease.current=stableWbsValue([key,active]);focusGeneration.current++;intentController.current?.abort();},[key,active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;actionController.current?.abort();intentController.current?.abort();};},[]);
  useEffect(()=>{
    if(!active||!validRange)return;
    // Re-entering an unchanged visit retains its exact confirmed model and DOM.
    // Navigation separately revalidates the immutable source before returning.
    if(reportCache.current?.key===key&&reportCache.current.refresh===refresh){
      let cancelled=false;queueMicrotask(()=>{if(!cancelled)setPending(false);});return()=>{cancelled=true;};
    }
    const request=new AbortController(),current=++generation.current;
    queueMicrotask(()=>{if(!request.signal.aborted){setPending(true);setError(null);setStale(false);}});
    fetchWbsView({projectPublicId:publicId,projectRevision:revision,input:{spec:RESOURCE_WBS_DEFAULT_SPEC,filters,scope:binding?.scope,projection:{kind:"report"},analysis:{query,fetchGeneration:current}},signal:request.signal})
      .then(data=>{if(!request.signal.aborted&&current===generation.current&&data.projection==="report"&&data.analysis){reportCache.current={key,refresh};setReport({key,data});}})
      .catch(cause=>{if(!request.signal.aborted&&current===generation.current){reportCache.current=null;setReport(null);setError(cause instanceof Error?cause.message:"차트 조회에 실패했습니다.");}})
      .finally(()=>{if(!request.signal.aborted&&current===generation.current)setPending(false);});
    return()=>request.abort();
  },[publicId,revision,active,validRange,key,filters,query,binding?.scope,refresh]);
  const data=report?.data??null;
  const current=report?.key===key&&!pending&&!error&&validRange;
  const model=current?data?.analysis:null;
  const locked=!active||busy||!current||stale||actionPending;
  const modelLocked=locked||!model;
  useLayoutEffect(()=>{if(active&&scroll.current){scroll.current.scrollTop=scrollPosition.current.top;scroll.current.scrollLeft=scrollPosition.current.left;}},[active,kind]);
  useEffect(()=>{if(selection){heading.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:"nearest"});}},[selection]);
  const changeFilters=(patch:Partial<ResourceDashboardFilterInput>)=>{cancelAction();setFilters(previous=>({...previous,...patch}));setSelection(null);setPage(0);setPeriodPage(0);};
  const cancelAction=()=>{focusGeneration.current++;actionGeneration.current++;actionController.current?.abort();intentController.current?.abort();setActionPending(false);};
  const close=()=>{
    cancelAction();setSelection(null);setDetailPage(0);
    const target=trigger.current,closeGeneration=focusGeneration.current,lease=viewLease.current,previousFocus=document.activeElement;
    requestAnimationFrame(()=>{
      if(!mounted.current||closeGeneration!==focusGeneration.current||lease!==viewLease.current)return;
      const focused=document.activeElement;
      if(focused!==previousFocus&&focused!==document.body&&focused!==document.documentElement)return;
      const available=(element:HTMLElement|null)=>!!element?.isConnected&&element.getClientRects().length>0&&!element.closest("[hidden],[inert]")&&!(element instanceof HTMLButtonElement&&element.disabled);
      const next=available(target)?target:available(fallback.current)?fallback.current:null;
      if(next===target)for(const saved of selectionScroll.current){if(saved.element.isConnected){saved.element.scrollTop=saved.top;saved.element.scrollLeft=saved.left;}}
      next?.focus({preventScroll:true});
    });
  };
  function selectCell(cell:ResourceAnalysisCell,element:HTMLElement){
    if(modelLocked||!model||!data)return;
    const raw=selectResourceAnalysisDetails(model,cell.selector,model.scope.source);
    cancelAction();rememberTrigger(element);setDetailPage(0);setSelection({...raw,label:resourceChartCellName(data,cell),scopeKey:model.scope.scopeKey});
  }
  function selectPlan(resourceId:string,periodKey:string,element:HTMLElement){
    if(modelLocked||!model||!data)return;
    const selector:ResourceAnalysisPlanSelector={scopeKey:model.scope.scopeKey,row:{kind:"resource",resourceId},demandScope:demand,periodKey,granularity:model.plan.granularity};
    const raw=selectResourceAnalysisPlanDetails(model,selector,model.scope.source);
    cancelAction();rememberTrigger(element);setDetailPage(0);setSelection({...raw,label:`${resourceChartName(data,"resource",resourceId)} · ${periodKey==="all"?"현재 기간":periodKey} · ${demand==="project"?"동일 개인 Project 전체 참고":"선택 조건 기여"}`,scopeKey:model.scope.scopeKey,plan:selector});
  }
  function selectIds(label:string,taskIds:string[],assignmentIds:string[],element:HTMLElement,diagnosticT0=false){if(!model||modelLocked)return;cancelAction();rememberTrigger(element);setDetailPage(0);setSelection({label,taskIds,assignmentIds,scopeKey:model.scope.scopeKey,diagnosticT0});}
  async function revalidate(action:(signal:AbortSignal)=>void|Promise<void>){
    if(modelLocked||!model||!data||!selection||selection.scopeKey!==model.scope.scopeKey)return;
    const lease=liveKey.current,controller=new AbortController(),currentAction=++actionGeneration.current;
    actionController.current?.abort();intentController.current?.abort();const intent=new AbortController();intentController.current=intent;actionController.current=controller;setActionPending(true);
    try{
      // Read-only source confirmation is required before every existing original/schedule action.
      const result=await fetchWbsView({projectPublicId:publicId,projectRevision:revision,input:{spec:data.spec,filters:data.filters,scope:data.sourceContext.scope,projection:{kind:"scope",snapshotId:data.snapshotId,path:[]}},signal:controller.signal});
      if(stableWbsValue(result.sourceContext)!==stableWbsValue(data.sourceContext))throw Error("원본 출처가 변경되었습니다.");
      if(mounted.current&&!controller.signal.aborted&&currentAction===actionGeneration.current&&lease===liveKey.current)await action(intent.signal);
    }catch(cause){if(mounted.current&&!controller.signal.aborted){reportCache.current=null;setStale(true);setNotice(cause instanceof Error?cause.message:"원본이 바뀌었습니다. 차트를 새로 조회하세요.");}}
    finally{if(mounted.current&&actionController.current===controller)setActionPending(false);}
  }
  function schedule(eventTrigger:HTMLElement,taskId?:string,assignmentId?:string){
    if(!data||!selection)return;
    void revalidate(async intentSignal=>{
      if(selection.diagnosticT0&&onSchedule){
        const diagnosticAction=actionGeneration.current,diagnosticLease=liveKey.current;
        const diagnostic=await fetchWbsView({projectPublicId:publicId,projectRevision:revision,input:resourceChartDiagnosticQuery(data),signal:intentSignal});
        if(diagnostic.projection!=="report")throw Error("REPORT_STALE");
        const exactSelection=resourceChartDiagnosticSelection(data,diagnostic,taskId?[taskId]:selection.taskIds);
        if(intentSignal.aborted||!mounted.current||diagnosticAction!==actionGeneration.current||diagnosticLease!==liveKey.current)return;
        onSchedule({data:diagnostic,path:[],label:selection.label,trigger:eventTrigger,taskId,intentSignal,exactSelection});
      }
      else if(selection.plan&&data.resourceAdapter&&onResourceSchedule){const p=selection.plan;onResourceSchedule({intentSignal,data:data.resourceAdapter.report,binding:data.resourceAdapter.binding,projection:{kind:"scope",target:"plan",snapshotId:data.resourceAdapter.report.snapshotId,granularity:p.granularity,periodId:p.periodKey,selector:p.row,demandScope:p.demandScope},label:selection.label,trigger:eventTrigger,taskId,assignmentId});}
      else if(onSchedule){onSchedule({data,path:[],label:selection.label,trigger:eventTrigger,taskId,assignmentId,intentSignal,exactSelection:{taskIds:taskId?[taskId]:selection.taskIds,assignmentIds:selection.assignmentIds.filter(id=>(!assignmentId||id===assignmentId)&&(!taskId||model?.assignmentRows.some(row=>row.assignmentId===id&&row.taskId===taskId)))}});}
    });
  }
  const changePage=(next:number)=>{cancelAction();setPage(next);};
  const changePeriodPage=(next:number)=>{cancelAction();setPeriodPage(next);};
  const selectType=(value:ResourceChartKind)=>{cancelAction();setKind(value);setSelection(null);setPage(0);setPeriodPage(0);};
  const selectedMetric=metric==="effort"?`계획공수 ${effectiveUnit}`:metrics.find(row=>row[0]===metric)![1];
  const ranked=model?resourceChartRank(model,metric,top,page):null;
  const periodOffset=Math.min(periodPage*RESOURCE_CHART_PERIOD_SIZE,Math.max(0,Math.floor(((model?.plan.periods.length??0)-1)/RESOURCE_CHART_PERIOD_SIZE)*RESOURCE_CHART_PERIOD_SIZE));
  const periods=model?.plan.periods.slice(periodOffset,periodOffset+RESOURCE_CHART_PERIOD_SIZE)??[];
  const resourceOffset=Math.min(page*12,Math.max(0,Math.floor(((model?.plan.resources.length??0)-1)/12)*12));
  const periodResources=model?.plan.resources.slice(resourceOffset,resourceOffset+12)??[];
  const maxEffort=model?Math.max(1,...model.plan.resources.flatMap(row=>row.cells.flatMap(cell=>[cell[demand].knownMd,cell[demand].capacityMd]))):1;
  const rankMax=ranked?Math.max(1,...ranked.rows.map(cell=>resourceChartMetricValue(cell,metric,effectiveUnit,data?.mdPerMm??null)??0)):1;
  const selectionCurrent=!!selection&&!!model&&selection.scopeKey===model.scope.scopeKey;
  const detailLocked=modelLocked||!selectionCurrent;
  const selectedTasks=selection?.taskIds.slice(detailPage*20,(detailPage+1)*20)??[];
  const selectedAssignments=selection?.assignmentIds.slice(detailPage*20,(detailPage+1)*20)??[];
  const risk=model?.plan.totals.summary.project;
  return <section className={styles.root} data-resource-charts data-wbs-view="resource-charts" data-project-public-id={publicId} data-ready={!modelLocked} data-wbs-state={error?"error":!validRange?"invalid":stale?"stale":modelLocked?"pending":"ready"} data-chart-state={error?"error":!validRange?"invalid":stale?"stale":modelLocked?"pending":"ready"} data-chart-kind={kind} data-snapshot-id={model?.scope.source.sourceContext.snapshotId} aria-label="리소스 차트" onChangeCapture={()=>cancelAction()}>
    <div className={styles.toolbar}><h3 tabIndex={-1}>리소스 차트</h3><div role="group" aria-label="차트 유형">{TYPES.map(([value,label])=><button ref={value==="period"?fallback:undefined} key={value} type="button" aria-pressed={kind===value} onClick={()=>selectType(value)}>{label}</button>)}</div></div>
    <div className={styles.toolbar} aria-label="차트 조회 조건">
      <label>차트 작업 검색<input type="search" value={filters.taskSearch??""} maxLength={200} onChange={event=>changeFilters({taskSearch:event.target.value})}/></label>
      <label>차트 시작일<input type="date" value={filters.from??""} onChange={event=>changeFilters({from:event.target.value||undefined})}/></label><label>차트 종료일<input type="date" value={filters.to??""} onChange={event=>changeFilters({to:event.target.value||undefined})}/></label>
      <label>차트 기간<select value={granularity} onChange={event=>changeFilters({granularity:event.target.value as "week"|"month"})}><option value="week">주간</option><option value="month">월간</option></select></label>
      <label>공수 표시 단위<select value={effectiveUnit} onChange={event=>{cancelAction();setUnit(event.target.value as "M/D"|"M/M");setSelection(null);}}><option value="M/D">M/D</option><option value="M/M" disabled={data?.mdPerMm===null}>M/M</option></select></label>
      <button type="button" aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}>차트 필터·범위{[filters.resourceIds?.length,filters.groupIds?.length,filters.roles?.length,filters.developerGrades?.length].filter(Boolean).length?` (${[filters.resourceIds?.length,filters.groupIds?.length,filters.roles?.length,filters.developerGrades?.length].filter(Boolean).length})`:""}</button><button type="button" disabled={pending} onClick={()=>{cancelAction();setRefresh(value=>value+1);setSelection(null);}}>차트 새로고침</button>
    </div>
    {advanced?<div className={styles.toolbar} aria-label="차트 추가 조건">
      <label>차트 개인<select value={filters.resourceIds?.[0]??""} onChange={event=>changeFilters({resourceIds:event.target.value?[event.target.value]:[]})}><option value="">전체 개인</option>{data?.configuration.resourceMemberships.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>차트 Group<select value={filters.groupIds?.[0]??""} onChange={event=>changeFilters({groupIds:event.target.value?[event.target.value]:[]})}><option value="">전체 Group</option>{Array.from(new Map(data?.configuration.resourceMemberships.flatMap(row=>row.groups).map(row=>[row.id,row])??[]).values()).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>차트 Global Role<select value={filters.roles?.[0]??""} onChange={event=>changeFilters({roles:event.target.value?[event.target.value as "DEVELOPER"]:[]})}><option value="">전체 역할</option><option value="DEVELOPER">개발자</option><option value="PI">PI</option><option value="EQUIPMENT_OWNER">설비 담당</option><option value="UNSPECIFIED">미지정</option></select></label>
      <label>차트 개발 등급<select value={filters.developerGrades?.[0]??""} onChange={event=>changeFilters({developerGrades:event.target.value?[event.target.value as "ADVANCED"]:[]})}><option value="">전체 등급</option><option value="BEGINNER">초급</option><option value="INTERMEDIATE">중급</option><option value="ADVANCED">고급</option><option value="EXPERT">특급</option><option value="UNSPECIFIED">미지정</option></select></label>
      <label>차트 기준일<input type="date" value={filters.asOfDate??""} onChange={event=>changeFilters({asOfDate:event.target.value||undefined})}/></label>
      <button type="button" disabled={!workspace?.periods.report&&!workspace?.periods.dynamic} onClick={()=>{const period=workspace?.periods.dynamic??workspace?.periods.report;if(period){changeFilters({from:period.from,to:period.to,asOfDate:period.asOfDate});setNotice("확정된 기간·기준일만 가져왔습니다. 다른 분석의 개인·범위는 자동 동기화하지 않습니다.");}}}>마지막 분석 기간 가져오기</button>
      <button type="button" onClick={()=>{cancelAction();setFilters({granularity});setSelection(null);setPage(0);setPeriodPage(0);}}>차트 조건 초기화</button>
      <p className={styles.subtle}>현재 범위: {binding?.scope?.kind==="exactAssignments"?`정확 Assignment ${binding.scope.assignmentIds.length}건`:binding?.scope?"일정에서 명시적으로 인계한 Task 범위":"Project 전체"}. 기간·개인 조건은 이 차트에서만 유지합니다.</p>
    </div>:null}
    {data&&(filters.resourceIds?.length||filters.groupIds?.length||filters.roles?.length||filters.developerGrades?.length)?<p className={styles.subtle}>적용 조건: {([...[...(filters.resourceIds??[])].map(id=>resourceChartName(data,"resource",id)),...[...(filters.groupIds??[])].map(id=>resourceChartName(data,"group",id)),...[...(filters.roles??[])].map(id=>resourceChartName(data,"role",id)),...[...(filters.developerGrades??[])].map(id=>resourceChartName(data,"developerGrade",id))]).join(" · ")}</p>:null}
    {!validRange?<p role="alert">종료일은 시작일보다 빠를 수 없습니다.</p>:null}{pending?<p role="status">같은 원본의 차트·표를 조회 중…</p>:null}{error?<p role="alert">{error} 이전 차트의 명령은 사용할 수 없습니다.</p>:null}{notice?<p role="status">{notice}</p>:null}{stale?<p role="alert">원본이 변경되었습니다. 차트 새로고침 후 다시 선택하세요.</p>:null}
    {model&&data?<>
      <p className={styles.subtle}>조회 {data.range.from}–{data.range.to} · 기준일 {data.asOfDate} · {model.total.taskIds.length} 고유 Task / {model.total.assignmentIds.length} 개인 Assignment · {data.sourceContext.scope?"인계된 범위":"Project 범위"} · {effectiveUnit}{unit==="M/M"&&data.mdPerMm===null?" (환산 기준 미설정으로 M/D 표시)":""}</p>
      <dl className={styles.summary} aria-label="차트 요약 위험">
        <div><dt>선택 계획공수</dt><dd><button type="button" disabled={modelLocked} onClick={event=>selectCell(model.total,event.currentTarget)}>{resourceChartEffort(model.total.assignments.effort,effectiveUnit,data.mdPerMm)}</button></dd></div>
        <div><dt>확인된 동일 개인 Project 과투입</dt><dd>{risk?.overAllocatedResourceCount??0}명 · {risk?.overAllocatedResourceDayCount??0} 개인·일</dd></div>
        <div><dt>초과 M/D · 완료 / 지연</dt><dd>{number(risk?.excessMd??0)} · <button type="button" disabled={modelLocked} onClick={event=>selectIds("완료 Task",model.total.tasks.completed.taskIds,model.assignmentRows.filter(row=>model.total.tasks.completed.taskIds.includes(row.taskId)).map(row=>row.assignmentId),event.currentTarget)}>{model.total.tasks.completed.count}</button> / <button type="button" disabled={modelLocked} onClick={event=>selectIds("지연 Task",model.total.tasks.delayed.taskIds,model.assignmentRows.filter(row=>model.total.tasks.delayed.taskIds.includes(row.taskId)).map(row=>row.assignmentId),event.currentTarget)}>{model.total.tasks.delayed.count}</button>건</dd></div>
        <div><dt>선택 공수 미설정 / T0 개인 미배정</dt><dd><button type="button" disabled={modelLocked} onClick={event=>selectIds("선택 공수 미설정 Assignment",[...new Set(model.assignmentRows.filter(row=>row.plannedMd===null).map(row=>row.taskId))],model.assignmentRows.filter(row=>row.plannedMd===null).map(row=>row.assignmentId),event.currentTarget)}>{model.total.assignments.effort.unsetCount}</button> / <button type="button" disabled={modelLocked} onClick={event=>selectIds("개인 미배정 Task · T0",model.diagnostics.personallyUnassigned.taskIds,[],event.currentTarget,true)}>{model.diagnostics.personallyUnassigned.count}</button>건</dd></div>
      </dl>
      {!model.total.taskIds.length?<p role="status">현재 선택 조건에 해당하는 Task가 없습니다. 개인 배정 이력의 Capacity와 동일 개인 Project 전체 참고는 별도 범위입니다.</p>:null}
      <p className={styles.subtle}>Group·Role·Milestone·실물 분류는 중복될 수 있어 소계를 합산하지 않습니다. 등록만 된 인원은 Capacity·계획공수를 만들지 않습니다. 계획은 실제 수행 실적이 아닙니다.</p>
      {kind==="period"?<>
        <div className={styles.toolbar}><h4>기간별 계획과 Capacity</h4><label>차트 부하 범위<select value={demand} onChange={event=>{cancelAction();setDemand(event.target.value as "selected"|"project");setSelection(null);}}><option value="selected">선택 조건 기여</option><option value="project">동일 개인 Project 전체 참고</option></select></label></div>
        <p className={styles.subtle}>계획은 굵은 막대, Capacity는 얇은 기준 막대입니다. 막대축·Capacity 단위는 M/D. Load 100% 초과·Peak day·초과 개인·일을 수치로 표시합니다. Group 평균이 낮아도 개인 위험은 아래 각 개인에 남습니다.</p>
        <div ref={scroll} className={styles.scroll} data-resource-scroll-owner role="region" aria-label="기간 투입 차트·데이터 표" tabIndex={0} onScroll={event=>{scrollPosition.current={top:event.currentTarget.scrollTop,left:event.currentTarget.scrollLeft};}}>
          <table className={styles.table}><caption>{demand==="project"?"동일 개인 Project 전체 참고":"현재 선택 조건 기여"} · {model.plan.granularity==="week"?"주별":"월별"} 계획 / Capacity · 0부터 {number(maxEffort)} M/D 동일 축</caption><thead><tr><th scope="col">개인</th>{periods.map(period=><th scope="col" key={period.key}>{period.label}{period.partial?" · 부분 기간":""}<br/>{period.from}–{period.to}</th>)}</tr></thead><tbody>{periodResources.map(row=><tr key={row.resourceId} data-chart-resource-id={row.resourceId}><th scope="row">{resourceChartName(data,"resource",row.resourceId)}<br/><button type="button" disabled={modelLocked} onClick={event=>selectPlan(row.resourceId,"all",event.currentTarget)}>현재 기간 원본</button></th>{periods.map(period=>{const pair=row.cells.find(cell=>cell.periodKey===period.key)!;const value=pair[demand];return <td key={period.key}><button type="button" disabled={modelLocked} onClick={event=>selectPlan(row.resourceId,period.key,event.currentTarget)} aria-label={`${resourceChartName(data,"resource",row.resourceId)} · ${period.label} · ${demand==="project"?"Project 전체 참고":"선택 조건"} · ${resourceChartPlanText(value,effectiveUnit,data.mdPerMm)}`}><span className={styles.series} aria-hidden="true"><span className={styles.bar}><i style={{width:`${value.knownMd/maxEffort*100}%`}}/></span><span className={`${styles.bar} ${styles.capacity}`}><i style={{width:`${value.capacityMd/maxEffort*100}%`}}/></span></span><span>{resourceChartPlanText(value,effectiveUnit,data.mdPerMm)}</span>{demand==="selected"?<small className={styles.warning}>같은 개인 Project 참고: Load {resourceChartPercent(pair.project.loadPercent)} · 초과 {pair.project.overAllocatedResourceDayCount} 개인·일 / {number(pair.project.excessMd)} M/D</small>:null}</button></td>;})}</tr>)}</tbody></table>
        </div>
        {!model.plan.resources.length?<p role="status">현재 조건에 개인 배정 이력이 없습니다. Capacity 0이나 가용 인력으로 해석하지 않습니다.</p>:null}
        <div className={styles.toolbar}><button type="button" disabled={resourceOffset===0} onClick={()=>changePage(resourceOffset/12-1)}>이전 개인</button><span>{periodResources.length?resourceOffset+1:0}–{resourceOffset+periodResources.length} / {model.plan.resources.length} 개인</span><button type="button" disabled={resourceOffset+12>=model.plan.resources.length} onClick={()=>changePage(resourceOffset/12+1)}>다음 개인</button><button type="button" disabled={periodOffset===0} onClick={()=>changePeriodPage(periodOffset/4-1)}>이전 기간</button><span>{periods.length?periodOffset+1:0}–{periodOffset+periods.length} / {model.plan.periods.length} 기간</span><button type="button" disabled={periodOffset+4>=model.plan.periods.length} onClick={()=>changePeriodPage(periodOffset/4+1)}>다음 기간</button></div>
      </>:<>
        <div className={styles.toolbar}>{kind==="concentration"?<label>업무 집중 축<select value={concentration} onChange={event=>{setConcentration(event.target.value as ResourceAnalysisDimension);setSelection(null);setPage(0);}}>{(["resource","group","role","developerGrade"] as const).map(axis=><option key={axis} value={axis}>{RESOURCE_CHART_LABELS[axis]}</option>)}</select></label>:<label>기여 분류<select value={contribution} onChange={event=>{setContribution(event.target.value as ResourceAnalysisDimension);setSelection(null);setPage(0);}}>{(["milestone","process","workArea","equipment","system"] as const).map(axis=><option key={axis} value={axis}>개인 × {RESOURCE_CHART_LABELS[axis]}</option>)}</select></label>}
          <label>차트 지표<select value={metric} onChange={event=>{cancelAction();setMetric(event.target.value as ResourceChartMetric);setPage(0);}}>{metrics.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>순위 표시<select value={top} onChange={event=>{cancelAction();setTop(event.target.value==="all"?"all":Number(event.target.value));setPage(0);}}><option value="10">Top 10</option><option value="20">Top 20</option><option value="all">전체 (20행씩)</option></select></label>
        </div>
        <p className={styles.subtle}>{selectedMetric} 내림차순. 막대는 알려진 부분합이며 미설정은 0으로 채우지 않습니다. 표시 {ranked?.total??0} / 전체 {ranked?.allCount??0}개 · 선택하면 같은 원본 Task·Assignment를 확인합니다.</p>
        <div className={styles.plot} data-resource-scroll-owner aria-label={`${selectedMetric} 비교 그래프`}><ol className={styles.rank}>{ranked?.rows.map(cell=>{const value=resourceChartMetricValue(cell,metric,effectiveUnit,data.mdPerMm);return <li key={cell.key}><button type="button" disabled={modelLocked} onClick={event=>selectCell(cell,event.currentTarget)}><span className={styles.name}>{resourceChartCellName(data,cell)}</span><span className={styles.bar} aria-hidden="true"><i style={{width:`${(value??0)/rankMax*100}%`}}/></span><span>{metric==="effort"?resourceChartEffort(cell.assignments.effort,effectiveUnit,data.mdPerMm):`${value}건`}</span></button></li>;})}</ol></div>
        <div className={styles.scroll} data-resource-scroll-owner role="region" tabIndex={0} aria-label="공수·업무 분포 데이터 표"><table className={styles.table}><caption>그래프와 같은 snapshot·범위의 원본 수치</caption><thead><tr><th scope="col">분류</th><th scope="col">계획공수 {effectiveUnit}</th><th scope="col">고유 Task / Assignment</th><th scope="col">완료 / 지연 Task</th></tr></thead><tbody>{ranked?.rows.map(cell=><tr key={cell.key} data-chart-cell-key={cell.key}><th scope="row"><button type="button" disabled={modelLocked} onClick={event=>selectCell(cell,event.currentTarget)}>{resourceChartCellName(data,cell)} 원본</button></th><td>{resourceChartEffort(cell.assignments.effort,effectiveUnit,data.mdPerMm)}</td><td>{cell.tasks.taskCount} / {cell.assignmentIds.length}</td><td>{cell.tasks.completed.count} / {cell.tasks.delayed.count}</td></tr>)}</tbody></table></div>
        {!ranked?.rows.length?<p role="status">현재 조건에 해당하는 분포가 없습니다.</p>:null}
        <div className={styles.toolbar}><button type="button" disabled={!ranked||ranked.offset===0} onClick={()=>changePage((ranked?.offset??0)/20-1)}>이전 분류</button><span>{ranked&&ranked.total?ranked.offset+1:0}–{ranked?ranked.offset+ranked.rows.length:0} / {ranked?.total??0}</span><button type="button" disabled={!ranked||ranked.offset+ranked.rows.length>=ranked.total} onClick={()=>changePage((ranked?.offset??0)/20+1)}>다음 분류</button></div>
      </>}
      {selection?<section ref={detail} className={styles.detail} role="region" aria-label="차트 원본 상세" data-chart-detail-state={detailLocked?"locked":"ready"} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();close();}}}>
        <div className={styles.toolbar}><h4 ref={heading} tabIndex={-1}>{selection.label}</h4><button type="button" onClick={close}>차트 상세 닫기</button></div>
        {selection.diagnosticT0?<p className={styles.subtle}>개인·Group·Role·등급 조건 적용 전 T0 진단입니다. 일정 이동 시 이 개인 조건만 명시적으로 제외하고 원래 기간·작업·실물 범위와 선택한 미배정 Task를 유지합니다.</p>:null}
        <p>{selection.taskIds.length} 고유 Task · {selection.assignmentIds.length} 개인 Assignment. {selection.plan?`${selection.plan.demandScope==="project"?"동일 개인 Project 전체 참고":"선택 기여"} · 기간에 겹친 원시 Assignment 근거입니다. 근무일별 분해는 기존 Resource Plan 상세를 사용합니다.`:"선택한 분류의 고유 ID 집합입니다."}</p>
        {!selectionCurrent?<p role="status">원본 snapshot이 바뀌었습니다. 차트를 다시 선택하세요.</p>:null}
        {(onSchedule||onResourceSchedule)&&selection.taskIds.length>0&&(selection.diagnosticT0||selection.taskIds.every(id=>data.taskIds.includes(id)))?<button type="button" disabled={detailLocked} onClick={event=>schedule(event.currentTarget)}>차트 선택 범위 일정 보기</button>:null}
        <ul>{selectedTasks.map(taskId=>{const task=model.taskSources.find(row=>row.taskId===taskId);return <li key={taskId} data-canonical-task-id={taskId}><strong>{task?.name??"현재 선택 밖 원본 작업"}</strong>{task?` · ${task.status} · ${task.start??"일정 없음"}–${task.end??"일정 없음"}`:null}<div className={styles.toolbar}>{onOpenTask?<button type="button" disabled={detailLocked} onClick={event=>{const element=event.currentTarget;void revalidate(()=>onOpenTask(taskId,element));}}>Task 원본</button>:null}{onSchedule&&data.taskIds.includes(taskId)?<button type="button" disabled={detailLocked} onClick={event=>schedule(event.currentTarget,taskId)}>이 작업 일정 보기</button>:null}</div><IdentifierDetails label="작업 원본 식별 정보" identifiers={[{label:"Task ID",value:taskId}]}/></li>;})}</ul>
        <ul>{selectedAssignments.map(assignmentId=>{const row=[...model.assignmentRows,...model.projectAssignmentRows].find(assignment=>assignment.assignmentId===assignmentId);if(!row)return null;const resource=data.configuration.resourceMemberships.find(person=>person.id===row.resourceId);return <li key={assignmentId} data-canonical-assignment-id={assignmentId}><strong>{resource?.name??"원본 담당자"}</strong> · {model.taskSources.find(task=>task.taskId===row.taskId)?.name??"현재 선택 밖 원본 작업"} · {row.plannedMd===null?"공수 미설정":`${number(row.plannedMd)} M/D`}<div className={styles.toolbar}>{onOpenAssignment?<button type="button" disabled={detailLocked||resource?.active===false} onClick={event=>{const element=event.currentTarget;void revalidate(()=>onOpenAssignment(row.taskId,row.assignmentId,row.resourceId,element));}}>Assignment 원본</button>:null}{onSchedule?<button type="button" disabled={detailLocked} onClick={event=>schedule(event.currentTarget,row.taskId,row.assignmentId)}>이 배정 일정 보기</button>:null}</div><IdentifierDetails label="배정 원본 식별 정보" identifiers={[{label:"Assignment ID",value:row.assignmentId},{label:"Task ID",value:row.taskId},{label:"Resource ID",value:row.resourceId}]}/></li>;})}</ul>
        <div className={styles.toolbar}><button type="button" disabled={detailPage===0} onClick={()=>setDetailPage(value=>value-1)}>이전 원본</button><span>원본 {detailPage+1} 페이지 · Task/Assignment 각 20건씩</span><button type="button" disabled={(detailPage+1)*20>=Math.max(selection.taskIds.length,selection.assignmentIds.length)} onClick={()=>setDetailPage(value=>value+1)}>다음 원본</button></div>
      </section>:null}
      <details><summary>전체 Milestone Gate · 선택 완료율과 별도</summary><p className={styles.subtle}>선택 Task 완료율·명시적 Milestone 완료 상태와 별도인 전체 Gate 판정입니다.</p>{model.fullMilestones.map(row=><p key={row.milestoneTaskId}>{resourceChartName(data,"milestone",row.milestoneTaskId)} · {row.stageGate.ready===null?"준비 판정 해당 없음 · 수동 이벤트":row.stageGate.blocked?"선행 차단 있음":row.stageGate.ready?"준비 완료 판정: Ready":"준비 완료 판정: 아님"} · 전체 완료 {row.stageGate.completedMemberCount}/{row.stageGate.memberCount} Task{row.stageGate.completionInconsistent?" · 완료 상태와 전체 Gate 불일치":""}</p>)}</details>
      <ResourceWbsExport data={data} locked={modelLocked} onStale={()=>{reportCache.current=null;setStale(true);}}/>
      <details><summary>차트 snapshot·범위·출처</summary><p className={styles.subtle}>snapshot {data.snapshotId} · revision {data.projectRevision} · fetch generation {model.scope.source.fetchGeneration}</p><pre>{JSON.stringify(model.scope,null,2)}</pre></details>
    </>:null}
  </section>;
}
