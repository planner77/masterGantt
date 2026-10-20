"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ComponentType } from "react";
import type { WbsViewDimension, WbsViewNode, WbsViewReportDto, WbsViewSpec } from "@/contracts/wbs-dashboard-views";
import type { ResourceDashboardFilterInput } from "@/contracts/resource-dashboard";
import { ContextHelp } from "@/components/ui/context-help";
import { WbsViewComposer } from "./wbs-view-composer";
import { WbsViewTable } from "./wbs-view-table";
import { WbsViewDetails } from "./wbs-view-details";
import { defaultWbsViewSpec, WBS_VIEW_LABELS } from "./wbs-view-model";
import { loadWbsViewState, saveWbsViewState, type WbsViewStoredState } from "./wbs-view-storage";
import { fetchWbsView } from "./wbs-view-transport";
import type { ResourceDrillBinding } from "./resource-drill-transport";
import { useResourceDrill, type WbsViewScheduleRequest } from "./resource-drill-context";
import { plannedEffort } from "./resource-dashboard-model";
import styles from "./wbs-view.module.css";
let nextWbsReportConfirmation = 0;
export interface WbsViewConsumer {
  title: string;
  defaultSpec: WbsViewSpec;
  presets: Array<{ label: string; levels: NonNullable<WbsViewSpec["levels"]> }>;
  renderControls?: (context: { spec: WbsViewSpec; onApply: (spec: WbsViewSpec) => void; disabled: boolean }) => ReactNode;
  renderSummary: (data: WbsViewReportDto) => ReactNode;
  Controls?: ComponentType<{data: WbsViewReportDto | null; filters: ResourceDashboardFilterInput; onChange: (patch: Partial<ResourceDashboardFilterInput>) => void}>;
  renderExtra?: (data: WbsViewReportDto, state: {locked: boolean; active: boolean; onStale: () => void}) => ReactNode;
  rowAnnotation?: (data: WbsViewReportDto, node: WbsViewNode) => string | undefined;
}
export interface WbsViewDashboardProps {
  consumer?: WbsViewConsumer;
  publicId: string; revision: number; root: WbsViewDimension; active: boolean; busy: boolean;
  binding?: ResourceDrillBinding | null;
  onOpenTask?: (id: string, trigger: HTMLElement) => void;
  onOpenAssignment?: (taskId: string, assignmentId: string, resourceId: string, trigger: HTMLElement) => void;
  onOpenEntity?: (dimension: WbsViewDimension, id: string, trigger: HTMLElement) => void;
  onSchedule?: (request: WbsViewScheduleRequest) => void;
}
const emptyState = (root: WbsViewDimension, consumer?: WbsViewConsumer): WbsViewStoredState => ({spec:consumer?.defaultSpec ?? defaultWbsViewSpec(root),filters:{},expanded:[],selected:null,scroll:{top:0,left:0},focus:null,sort:"name-asc"});
/** A root's local state stays mounted while switching the existing workspace tabs. */
export function WbsViewDashboard(props: WbsViewDashboardProps) {
  return <WbsViewDashboardRoot key={`${props.publicId}:${props.root}`} {...props}/>;
}
function WbsViewDashboardRoot({consumer,publicId,revision,root,active,busy,binding,onOpenTask,onOpenAssignment,onOpenEntity,onSchedule}:WbsViewDashboardProps) {
  const drill = useResourceDrill();
  const ConsumerControls = consumer?.renderControls;
  const [state,setState] = useState<WbsViewStoredState>(() => emptyState(root,consumer));
  const [hydrated,setHydrated] = useState(false);
  const [warning,setWarning] = useState<string|null>(null);
  const [report,setReport] = useState<{key:string;data:WbsViewReportDto;confirmationId:number}|null>(null);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [refresh,setRefresh] = useState(0);
  const [staleSnapshot,setStaleSnapshot] = useState<string|null>(null);
  const [selection,setSelection] = useState<{node:WbsViewNode;snapshot:string;key:string}|null>(null);
  // Independent generations for report fetch and original navigation.
  const reportGeneration=useRef(0); const originalGeneration=useRef(0);
  const intentController=useRef<AbortController|null>(null);
  const originalController=useRef<AbortController|null>(null); const liveContext=useRef("");
  const cancelOriginalRequest=useCallback(() => {
    originalGeneration.current++;
    originalController.current?.abort();
    originalController.current=null;
  },[]);
  const cancelOriginal=useCallback(() => {
    cancelOriginalRequest();
    intentController.current?.abort();
    intentController.current=new AbortController();
    return intentController.current.signal;
  },[cancelOriginalRequest]);

  useEffect(()=>()=>{cancelOriginal();},[cancelOriginal]); const scroll=useRef<HTMLDivElement>(null); const trigger=useRef<HTMLElement|null>(null); const fallback=useRef<HTMLHeadingElement>(null);
  const scope=binding?.scope ?? drill.binding?.scope;
  useLayoutEffect(()=>{liveContext.current=JSON.stringify([active,busy,revision,state.spec,state.filters,scope,staleSnapshot]);if(busy)cancelOriginalRequest();},[active,busy,revision,state.spec,state.filters,scope,staleSnapshot,cancelOriginalRequest]);
  // Host pending state locks the first query without revoking its handed-off intent.
  useLayoutEffect(()=>{cancelOriginal();},[active,revision,state.spec,state.filters,scope,staleSnapshot,cancelOriginal]);
  const queryKey=useMemo(() => JSON.stringify({revision,spec:state.spec,filters:state.filters,scope}),[revision,state.spec,state.filters,scope]);
  const validRange=!state.filters.from || !state.filters.to || state.filters.from <= state.filters.to;
  useEffect(() => {
    let storage:Storage|null=null; try {storage=localStorage;} catch {}
    const loaded=loadWbsViewState(storage,publicId,root); let cancelled=false; queueMicrotask(()=>{if(cancelled)return;if (loaded.state) setState(loaded.state); setWarning(loaded.warning); setHydrated(true);}); return ()=>{cancelled=true;};
  },[publicId,root]);
  useEffect(() => { if (!hydrated || warning) return; let storage:Storage|null=null; try {storage=localStorage;} catch {} const saved=saveWbsViewState(storage,publicId,root,state); if(saved.warning) queueMicrotask(()=>setWarning(saved.warning)); },[state,hydrated,publicId,root,warning]);
  useEffect(() => {
    if (!active || !hydrated || !validRange) return;
    const controller=new AbortController();const current=++reportGeneration.current;queueMicrotask(()=>{if(!controller.signal.aborted){setPending(true);setError(null);}});
    fetchWbsView({projectPublicId:publicId,projectRevision:revision,input:{spec:state.spec,filters:state.filters,scope,projection:{kind:"report"}},signal:controller.signal})
      .then(data => {if(!controller.signal.aborted && current===reportGeneration.current && data.projection==="report") {setReport({key:queryKey,data,confirmationId:++nextWbsReportConfirmation});setStaleSnapshot(null);}})
      .catch(cause => {if(!controller.signal.aborted && current===reportGeneration.current) setError(cause instanceof Error ? cause.message : "조회하지 못했습니다.");})
      .finally(() => {if(!controller.signal.aborted && current===reportGeneration.current) setPending(false);});
    return () => controller.abort();
  },[active,hydrated,validRange,queryKey,refresh,publicId,revision,state.spec,state.filters,scope]);
  const data=report?.data ?? null;
  const currentReport=report?.key===queryKey;
  const locked=busy || !!drill.locked || pending || !!error || !data || !currentReport || !validRange || staleSnapshot===data.snapshotId;
  const restoredNode = useMemo(() => {
    if(!data || !state.selected) return null;
    const visit=(nodes:WbsViewNode[]):WbsViewNode|null=>{for(const node of nodes){if(node.viewRowKey===state.selected?.viewRowKey && JSON.stringify(node.path)===JSON.stringify(state.selected.path))return node;const found=visit(node.children);if(found)return found;}return null;};
    return visit(data.children);
  },[data,state.selected]);
  const currentSelection=selection && data && selection.snapshot===data.snapshotId ? selection : restoredNode&&data?{node:restoredNode,snapshot:data.snapshotId,key:queryKey}:null;
  const markStale=useCallback(() => {setStaleSnapshot(report?.data.snapshotId ?? null);},[report]);
  const changeFilters=(patch:Partial<ResourceDashboardFilterInput>) => {cancelOriginal();setSelection(null);setState(previous=>({...previous,filters:{...previous.filters,...patch},selected:null}));};
  const apply=(spec:WbsViewSpec) => {cancelOriginal();setSelection(null);setState(previous=>({...previous,spec,selected:null}));setWarning(null);};
  const reset=() => {cancelOriginal();setState(emptyState(root,consumer));setSelection(null);setWarning(null);};
  const close=() => {cancelOriginal();setSelection(null);setState(previous=>({...previous,selected:null}));requestAnimationFrame(()=>{if(trigger.current?.isConnected && !trigger.current.closest("[hidden],[inert]")) trigger.current.focus({preventScroll:true});else fallback.current?.focus({preventScroll:true});});};
  useEffect(() => {if(active && hydrated && scroll.current && data){scroll.current.scrollTop=state.scroll.top;scroll.current.scrollLeft=state.scroll.left;}},[active,hydrated,data,state.scroll.top,state.scroll.left]);
  useEffect(()=>{if(active&&data&&state.focus){ const row=scroll.current?.querySelector<HTMLElement>(`[data-view-row-key="${CSS.escape(state.focus)}"] button`); if(document.activeElement===document.body)row?.focus({preventScroll:true});}},[active,data,state.focus]);
  async function openOriginal(node:WbsViewNode,element:HTMLElement) {
    if(locked || !data || !node.selector.id || !onOpenEntity) return;
    // A new row intent supersedes any previous pending navigation.
    cancelOriginal();
    const current=originalGeneration.current;
    const identity=liveContext.current;
    const controller=new AbortController();
    originalController.current=controller;
    try {
      await fetchWbsView({projectPublicId:publicId,projectRevision:revision,input:{spec:data.spec,filters:data.filters,scope,projection:{kind:"scope",snapshotId:data.snapshotId,path:node.path}},signal:controller.signal});
      if(!controller.signal.aborted && current===originalGeneration.current && identity===liveContext.current) onOpenEntity(node.selector.dimension,node.selector.id,element);
    } catch {
      if(!controller.signal.aborted && current===originalGeneration.current && identity===liveContext.current)markStale();
    } finally {
      if(originalController.current===controller) originalController.current=null;
    }
  }
  return <section className={styles.root} data-testid="wbs-view-dashboard" data-root={root} data-wbs-view={root} data-project-public-id={publicId} data-wbs-state={error ? "error" : !validRange ? "invalid" : data&&staleSnapshot===data.snapshotId ? "stale" : locked ? "pending" : "ready"} data-ready={!!data&&!locked} data-wbs-ready={!!data&&!locked} data-report-confirmation-id={currentReport ? report?.confirmationId : 0} aria-label="공통 계층 조회">
    <div className={styles.controls}><h3 ref={fallback} tabIndex={-1}>{consumer?.title ?? `${WBS_VIEW_LABELS[root]} 계층 조회`}</h3><ContextHelp label="공통 계층 조회">하위 축은 개인 조회 설정입니다. 원본 WBS·배정·Target을 변경하지 않습니다. 중복 경로의 소계를 더하지 않고 서버의 고유 총계를 표시합니다. 등록 구성 수량과 Task·Assignment·계획공수 및 전체 Gate는 각각 다른 범위입니다.</ContextHelp></div>
    <p className={styles.subtle}>현재 경로: {[root,...(state.spec.levels??[]).map(level=>typeof level==="string" ? level : level.dimensions)].map(level=>Array.isArray(level)?level.map(d=>WBS_VIEW_LABELS[d]).join(" / "):WBS_VIEW_LABELS[level]).join(" → ")}</p>
    <WbsViewComposer spec={state.spec} onApply={apply} onReset={reset} presets={consumer?.presets}/>
    {ConsumerControls ? <ConsumerControls spec={state.spec} onApply={apply} disabled={busy || !!drill.locked}/> : null}
    {warning ? <p role="alert">{warning} <button type="button" onClick={reset}>저장된 조회 초기화</button></p> : null}
    <div className={styles.controls}><label>표의 이름 찾기<input type="search" maxLength={200} value={state.rowSearch??""} onChange={event=>{cancelOriginal();setSelection(null);setState(previous=>({...previous,rowSearch:event.target.value,selected:null}));}}/></label><label>작업 검색<input type="search" maxLength={200} value={state.filters.taskSearch??""} onChange={event=>changeFilters({taskSearch:event.target.value})}/></label>
      <label>작업 상태<select value={state.filters.statuses?.[0]??""} onChange={event=>changeFilters({statuses:event.target.value?[event.target.value as "completed"|"not_started"|"in_progress"]:[]})}><option value="">전체</option><option value="not_started">시작 전</option><option value="in_progress">진행 중</option><option value="completed">완료</option></select></label>
      <label>조회 시작일<input type="date" value={state.filters.from??""} onChange={event=>changeFilters({from:event.target.value||undefined})}/></label><label>조회 종료일<input type="date" value={state.filters.to??""} onChange={event=>changeFilters({to:event.target.value||undefined})}/></label>
      <label>이름 정렬<select value={state.sort??"name-asc"} onChange={event=>{cancelOriginal();setState(previous=>({...previous,sort:event.target.value as "name-asc"|"name-desc"}));}}><option value="name-asc">오름차순</option><option value="name-desc">내림차순</option></select></label><button type="button" disabled={pending} onClick={()=>{cancelOriginal();setRefresh(value=>value+1);setSelection(null);}}>계층 새로고침</button></div>
    {consumer?.Controls ? <consumer.Controls data={data} filters={state.filters} onChange={changeFilters}/> : null}
    {!validRange ? <p role="alert">종료일은 시작일보다 빠를 수 없습니다.</p> : null}{pending ? <p role="status">계층 조회 중…</p>:null}{error ? <p role="alert">{error} <button type="button" onClick={()=>{cancelOriginal();setRefresh(value=>value+1);}}>다시 시도</button></p>:null}
    {selection&&!currentSelection || data&&(!currentReport || staleSnapshot===data.snapshotId) ? <p role="status">조회 조건 또는 원본 snapshot이 바뀌었습니다. 새로고침 후 다시 선택하세요.</p>:null}
    {data && (!currentReport || pending || !!error || staleSnapshot===data.snapshotId) ? <p role="status">이전 조회 결과입니다. 최신 조회를 확인한 뒤 상세·원본 이동을 사용할 수 있습니다.</p> : null}
    {data ? <><p className={styles.subtle}>조회 기간 {data.range.from}–{data.range.to} · 기준일 {data.asOfDate} · 명시적 Task 문맥 기준</p>{state.rowSearch?.trim()?<p role="status" className={styles.subtle}>이름이 일치하는 행만 표시합니다. 고유 총계는 전체 서버 조회 결과를 유지합니다.</p>:null}{consumer ? consumer.renderSummary(data) : <dl className={styles.summary} aria-label="고유 총계"><div><dt>구성 설비 수량</dt><dd>{data.totals.configurationReference.equipmentQuantity}대</dd></div><div><dt>구성 시스템</dt><dd>{data.totals.configurationReference.systemCount}식</dd></div><div><dt>Task</dt><dd>{data.totals.tasks.taskCount}</dd></div><div><dt>Assignment</dt><dd>{data.totals.assignments.assignmentCount}</dd></div><div><dt>계획공수 M/D</dt><dd>{plannedEffort(data.totals.assignments.effort,"md")}</dd></div></dl>}
      {consumer?.renderExtra?.(data,{locked,active,onStale:markStale})}
      <div ref={scroll} data-wbs-scroll className={styles.scroll} role="region" tabIndex={0} aria-label="공통 계층 표 스크롤" onScroll={event=>{const target=event.currentTarget;setState(previous=>({...previous,scroll:{top:target.scrollTop,left:target.scrollLeft}}));}} onFocusCapture={event=>{
        const row=event.target.closest<HTMLElement>("[data-view-row-key]");
        if(row)setState(previous=>({...previous,focus:row.dataset.viewRowKey??null}));
        if (!(event.target instanceof HTMLButtonElement) || !event.target.matches(":focus-visible")) return;
        // Native keyboard focus can leave a partially visible action clipped.
        // Reveal its focus ring inside this table's own horizontal scroll only.
        const owner=event.currentTarget, bounds=owner.getBoundingClientRect(), button=event.target.getBoundingClientRect();
        const left=bounds.left+owner.clientLeft+4, right=bounds.left+owner.clientLeft+owner.clientWidth-4;
        const clamp=(value:number)=>Math.max(0,Math.min(owner.scrollWidth-owner.clientWidth,value));
        if(button.left<left)owner.scrollLeft=clamp(owner.scrollLeft+button.left-left);
        else if(button.right>right)owner.scrollLeft=clamp(owner.scrollLeft+button.right-right);
      }}><WbsViewTable rowAnnotation={consumer?.rowAnnotation ? node => consumer.rowAnnotation!(data,node) : undefined} data={data} expanded={new Set(state.expanded)} sort={state.sort??"name-asc"} locked={locked} selected={state.selected?.viewRowKey??null} rowSearch={state.rowSearch} onToggle={key=>{cancelOriginal();setState(previous=>({...previous,expanded:previous.expanded.includes(key)?previous.expanded.filter(item=>item!==key):[...previous.expanded,key]}));}} onDetails={(node,element)=>{cancelOriginal();trigger.current=element;setSelection({node,snapshot:data.snapshotId,key:queryKey});setState(previous=>({...previous,selected:{viewRowKey:node.viewRowKey,path:node.path}}));}} onOriginal={onOpenEntity?openOriginal:undefined}/></div>
      {!data.children.length?<p>현재 조건에 해당하는 결과가 없습니다.</p>:null}
      <details><summary>조회 snapshot·원본 출처</summary><p className={styles.subtle}>snapshot {data.snapshotId} · Project revision {data.projectRevision}</p><pre className={styles.subtle}>{JSON.stringify(data.sourceContext,null,2)}</pre></details>
      {currentSelection?<div hidden={!currentReport || staleSnapshot===data.snapshotId} inert={!currentReport || staleSnapshot===data.snapshotId}><WbsViewDetails key={currentSelection.node.viewRowKey} data={data} node={currentSelection.node} locked={locked||!active} onStale={markStale} onClose={close} onIntent={cancelOriginal} onOpenTask={onOpenTask??drill.onOpenTask} onOpenAssignment={onOpenAssignment??drill.onOpenAssignment} onSchedule={onSchedule??drill.onWbsSchedule}/></div>:null}
    </>:null}
  </section>;
}
