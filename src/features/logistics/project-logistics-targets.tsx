"use client";
import { useEffect, useRef, useState } from "react";
import type { ProjectLogisticsDto, LogisticsActiveTypeCatalogResponse } from "@/contracts/logistics";
import type { CreateLogisticsTargetRequest, LogisticsTargetCreateMember, LogisticsTargetDto, LogisticsTargetListResponse, LogisticsTargetMemberInput } from "@/contracts/logistics-targets";
import type { ProcessContextResponse } from "@/contracts/process-catalog";
import type { ProjectDto, ProjectTaskDto } from "@/contracts/projects";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { taskContextLabels } from "./task-context-label";
import { TargetMasterRegistration } from "./target-master-registration";
import { TargetDetail } from "./target-detail";
import styles from "./target-ui.module.css";

type Impact = { impactToken:string; affectedTaskIds:string[]; wholeBindingIds:string[]; subsetBindingIds:string[]; blockedSubsetMemberIds:string[] };
type Draft = CreateLogisticsTargetRequest & { active:boolean; description:string };
const emptyDraft = ():Draft => ({code:"",name:"",scope:"process",projectProcessId:null,workAreaId:null,members:[],active:true,description:""});
export function ProjectLogisticsTargets({publicId, projectContext, revision, active, editable, busy, logistics, types, tasks, onMutated, onUnauthorized, onOpenTask, onTypesChanged, onOpenInstance}: {
  projectContext?: Pick<ProjectDto,"businessUnit"|"product"|"siteEntity">; publicId:string; revision:number; active:boolean; editable:boolean; busy:boolean; logistics:ProjectLogisticsDto;
  types:LogisticsActiveTypeCatalogResponse["data"] | null; tasks:readonly ProjectTaskDto[];
  onOpenInstance?:(kind:"equipment"|"system",id:string)=>void; onTypesChanged?:()=>void; onMutated:()=>void; onUnauthorized:()=>void; onOpenTask?:(id:string)=>void;
}) {
  const [targets,setTargets] = useState<LogisticsTargetDto[]>([]);
  const [context,setContext] = useState<ProcessContextResponse["data"] | null>(null);
  const [loaded,setLoaded] = useState<string|null>(null);
  const [instanceSearch,setInstanceSearch] = useState("");
  const [shared,setShared] = useState<{revision:number; counts:Record<string,number>}|null>(null);
  const [search,setSearch] = useState("");
  const [offset,setOffset] = useState(0);
  const [total,setTotal] = useState(0);
  const [inactive,setInactive] = useState(false);
  const [retry,setRetry] = useState(0);
  const [error,setError] = useState<string|null>(null);
  const [pending,setPending] = useState(false);
  const [adminPending,setAdminPending] = useState(false);
  const [adminDirty,setAdminDirty] = useState(false);
  const [detail,setDetail] = useState<LogisticsTargetDto|null>(null);
  const [draft,setDraft] = useState<Draft|null>(null);
  const [editing,setEditing] = useState<LogisticsTargetDto|null>(null);
  const [managedRevision,setManagedRevision] = useState<number|null>(null);
  const [baseRevision,setBaseRevision] = useState(revision);
  const [initial,setInitial] = useState("");
  const [discard,setDiscard] = useState(false);
  const [deleteConfirm,setDeleteConfirm] = useState(false);
  const [impact,setImpact] = useState<Impact|null>(null);
  const [confirmed,setConfirmed] = useState(false);
  const [blocked,setBlocked] = useState(false);
  const [inlineKind,setInlineKind] = useState<"equipment"|"system">("equipment");
  const [inline,setInline] = useState({code:"",name:"",type:"",quantity:1,managementUnit:"unit" as "unit"|"fleet",layer:"controller" as "controller"|"coordinator",confirmDuplicateLabel:false});
  const restoreTrigger = useRef<{element:HTMLElement;targetId:string|null}|null>(null);
  const alive = useRef(true);
  useEffect(() => {alive.current=true;return () => {alive.current=false;};}, []);
  const inlineDirty = inline.code!=="" || inline.name!=="" || inline.type!=="" || inline.quantity!==1 || inline.managementUnit!=="unit" || inline.layer!=="controller" || inline.confirmDuplicateLabel;
  const dirty = draft !== null && (JSON.stringify(draft)!==initial || adminDirty || (!editing && inlineDirty));
  const stale = draft !== null && baseRevision!==revision;
  const modalBusy = pending || adminPending;
  const locked = busy || modalBusy || !editable || blocked || stale;
  const url = `/api/projects/${encodeURIComponent(publicId)}/logistics/targets`;
  const listKey = `${publicId}:${revision}:${offset}:${search}:${inactive}:${retry}`;
  useEffect(() => {
    if (!dirty && !modalBusy) return;
    const protectDraft = (event:BeforeUnloadEvent) => {event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",protectDraft);
    return () => window.removeEventListener("beforeunload",protectDraft);
  }, [dirty,modalBusy]);
  useEffect(() => {
    if (draft || busy || loaded!==listKey || !restoreTrigger.current) return;
    const trigger=restoreTrigger.current;
    const visible=(element:HTMLElement|null):element is HTMLElement=>!!element&&element.isConnected&&!element.matches(":disabled")&&element.getClientRects().length>0;
    const logical=trigger.targetId?document.querySelector<HTMLElement>(`[data-target-edit-id="${CSS.escape(trigger.targetId)}"]`):null;
    const fallback=document.querySelector<HTMLElement>("[data-target-add]");
    const search=document.querySelector<HTMLElement>("[data-target-search]");
    if(visible(trigger.element))trigger.element.focus({preventScroll:true});
    else if(visible(logical))logical.focus({preventScroll:true});
    else if(visible(fallback))fallback.focus({preventScroll:true});
    else if(visible(search))search.focus({preventScroll:true});
    restoreTrigger.current=null;
  }, [draft,busy,loaded,listKey]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const [res,ctx] = await Promise.all([fetch(`${url}?limit=50&offset=${offset}${search.trim()?`&search=${encodeURIComponent(search.trim())}`:""}${inactive?"":"&activeOnly=true"}`,{signal:controller.signal,credentials:"same-origin",cache:"no-store"}),fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/process-context`,{signal:controller.signal,credentials:"same-origin",cache:"no-store"})]);
        if (!res.ok || !ctx.ok) throw new Error();
        const body = await res.json() as LogisticsTargetListResponse;
        const process = await ctx.json() as ProcessContextResponse;
        if (body.data.projectRevision!==revision || process.data.projectRevision!==revision) throw new Error();
        if (controller.signal.aborted) return;
        setTargets(body.data.targets); setTotal(body.data.total); setContext(process.data);setLoaded(listKey);setError(null);
      } catch { if(!controller.signal.aborted){setLoaded(null);setError("Target 목록 또는 공정 문맥을 불러오지 못했습니다. 최신 정보로 다시 조회해 주세요.");} }
    })();
    return () => controller.abort();
  }, [active,url,publicId,revision,retry,offset,search,inactive,listKey]);
  const composerOpen = draft !== null;
  useEffect(() => {
    if (!composerOpen) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const counts:Record<string,number> = {};
        let page = 0;
        while (true) {
          const res = await fetch(`${url}?limit=100&offset=${page}`, {signal:controller.signal,credentials:"same-origin",cache:"no-store"});
          if (!res.ok) throw new Error();
          const data = (await res.json() as LogisticsTargetListResponse).data;
          if (data.projectRevision !== revision) throw new Error();
          for (const target of data.targets) for (const member of target.members) counts[`${member.kind}:${member.entityId}`] = (counts[`${member.kind}:${member.entityId}`] ?? 0) + 1;
          page += data.targets.length;
          if (page >= data.total) break;
          if (!data.targets.length || page > 10000) throw new Error();
        }
        if (!controller.signal.aborted) setShared({revision,counts});
      } catch { if (!controller.signal.aborted) setShared(null); }
    })();
    return () => controller.abort();
  }, [composerOpen,revision,url]);
  const change = (patch:Partial<Draft>) => {setDraft(d=>d?{...d,...patch}:d);setImpact(null);setConfirmed(false);};
  function close() {if(modalBusy)return;if(dirty){setDiscard(true);return;}setDraft(null);setEditing(null);setDeleteConfirm(false);setDetail(null);}
  function start(target?:LogisticsTargetDto, trigger?:HTMLElement) {
    if(trigger)restoreTrigger.current={element:trigger,targetId:target?.id??null};
    const next:Draft = target?{code:target.code,name:target.name,scope:target.scope,projectProcessId:target.projectProcessId,workAreaId:target.workAreaId,members:target.members.map(m=>({kind:m.kind,entityId:m.entityId})),active:target.active,description:target.description}:emptyDraft();
    setAdminDirty(false);setAdminPending(false);setInline({code:"",name:"",type:"",quantity:1,managementUnit:"unit",layer:"controller",confirmDuplicateLabel:false});setInlineKind("equipment");setInstanceSearch("");
    setManagedRevision(null);setDraft(next);setInitial(JSON.stringify(next));setEditing(target??null);setBaseRevision(revision);setImpact(null);setConfirmed(false);setError(null);setBlocked(false);setDeleteConfirm(false);
  }
  async function request(method:string, path:string, body?:unknown) {
    const res = await fetch(path,{method,credentials:"same-origin",headers:{"If-Match":`"${baseRevision}"`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const value = await res.json().catch(()=>null);
    if(!res.ok){
      if(res.status===401){setBlocked(true);onUnauthorized();throw new Error("편집 권한이 만료되었습니다. 초안은 유지됩니다. 다시 편집 권한을 얻고 최신 정보로 재검토해 주세요.");}
      if(res.status===403 || res.status===412){setBlocked(true);throw new Error("권한 또는 기준 정보가 변경되었습니다. 초안은 유지됩니다. 닫기에서 초안을 명시적으로 폐기한 뒤 최신 정보를 조회해 주세요.");}
      throw new Error(`Target 요청 실패 (${value?.error?.code ?? value?.code ?? res.status}). 입력과 사용 중인 연결을 확인해 주세요.`);
    }
    return value;
  }
  function payload() {return draft && { ...draft, members:draft.members as LogisticsTargetMemberInput[] };}
  async function preview() {
    if(!draft || !editing || locked)return;
    setPending(true);setError(null);
    try{const body=await request("POST",`${url}/${encodeURIComponent(editing.id)}/impact`,payload());if(alive.current){setImpact(body.data);setConfirmed(false);}}
    catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setPending(false);}
  }
  async function save() {
    if(!draft || locked || !draft.members.length || (editing && (!impact || !confirmed || impact.blockedSubsetMemberIds.length)))return;
    setPending(true);setError(null);
    try{await request(editing?"PATCH":"POST",editing?`${url}/${encodeURIComponent(editing.id)}`:url,{...payload(),...(editing?{impactToken:impact!.impactToken,confirmImpact:true}:{})});if(!alive.current)return;setDraft(null);setEditing(null);setLoaded(null);onMutated();setRetry(x=>x+1);}
    catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setPending(false);}
  }
  async function remove() {
    if(!editing || locked)return;
    setPending(true);setError(null);
    try{await request("DELETE",`${url}/${encodeURIComponent(editing.id)}`);if(!alive.current)return;setDraft(null);setEditing(null);setLoaded(null);setDeleteConfirm(false);onMutated();setRetry(x=>x+1);}
    catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setPending(false);}
  }
  const occurrence = context?.mappings.find(m=>m.processId===draft?.projectProcessId)?.occurrenceId;
  const matchesInstance = (name:string,code:string) => `${name} ${code}`.toLocaleLowerCase().includes(instanceSearch.toLocaleLowerCase());
  const equipment = logistics.equipment.filter(e=>matchesInstance(e.name,e.code) && e.processId===draft?.projectProcessId && (e.active || draft?.members.some(m=>"entityId" in m && m.entityId===e.id)));
  const systems = logistics.systems.filter(s=>matchesInstance(s.name,s.code) && (draft?.scope!=="project_common" || s.scope==="project") && (s.active || draft?.members.some(m=>"entityId" in m && m.entityId===s.id)));
  const names = taskContextLabels(tasks);
  return <div className={styles.panel}>
    <div className={styles.toolbar}><label className={styles.field}>Target 검색<input data-target-search value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);setOffset(0);}} /></label><label><input type="checkbox" checked={inactive} onChange={e=>{setInactive(e.target.checked);setOffset(0);}} /> 비활성 포함</label><button type="button" className="primary-button" data-target-add disabled={!editable||busy||loaded!==listKey} onClick={event=>start(undefined,event.currentTarget)}>Target 추가</button><button type="button" className="secondary-button" disabled={modalBusy} onClick={()=>{onMutated();setRetry(x=>x+1);}}>Target 다시 조회</button></div>
    {!draft && error ? <p role="alert" className={styles.error}>{error}</p>:null}
    {loaded!==listKey ? <p role="status">Target 목록 조회 대기 중</p>:<>
      <ul className={styles.list}>{targets.map(t=><li className={styles.row} key={t.id}><strong>{t.name}</strong><span>{t.code}</span><span>{t.scope==="project_common"?"프로젝트 공통":logistics.processes.find(p=>p.id===t.projectProcessId)?.name??t.projectProcessId}</span><span>{context?.workAreas.find(w=>w.id===t.workAreaId)?.name??(t.workAreaId?"작업 구역 참조":"작업 구역 미지정")}</span><span>구성원 {t.members.length}개 · {t.active?"활성":"비활성"}</span><button type="button" className="secondary-button" onClick={()=>setDetail(t)}>Target 상세: {t.name}</button>{editable?<button type="button" className="secondary-button" data-target-edit-id={t.id} disabled={busy} onClick={event=>start(t,event.currentTarget)}>Target 수정: {t.name}</button>:null}</li>)}</ul>
      {!targets.length?<p>조건에 맞는 Target이 없습니다.</p>:null}
      <div className={styles.toolbar}><button type="button" className="secondary-button" disabled={offset===0} onClick={()=>setOffset(o=>Math.max(0,o-50))}>이전 Target</button><span>{total}개 중 {offset+1}–{Math.min(offset+50,total)}</span><button type="button" className="secondary-button" disabled={offset+50>=total} onClick={()=>setOffset(o=>o+50)}>다음 Target</button></div>
    </>}
    {detail?<WorkspaceDialog title={`Target 상세 · ${detail.name}`} onClose={()=>setDetail(null)}>{loaded===listKey && targets.some(t=>t.id===detail.id)?<TargetDetail key={detail.id} onOpenInstance={editable?onOpenInstance:undefined} disabled={busy||pending} revision={revision} publicId={publicId} target={targets.find(t=>t.id===detail.id)??detail} taskNames={names} onOpenTask={onOpenTask? id=>{onOpenTask(id);}:undefined}/>:<p role="status">Target 정보가 변경되었거나 목록을 다시 조회 중입니다. 닫은 뒤 최신 Target을 선택하세요.</p>}</WorkspaceDialog>:null}
    {draft?<WorkspaceDialog title={editing?"Target 수정":"Target 추가"} onClose={close} busy={modalBusy} size="wide"><div className={styles.form}>
      {error?<p role="alert" className={styles.error}>{error}</p>:null}{stale?<p role="alert">프로젝트 기준이 변경되어 Target 저장을 잠갔습니다. 별도 관리 저장 결과를 확인해 적용하거나, 초안을 명시적으로 폐기하고 최신 정보를 조회해 주세요.</p>:null}{managedRevision!==null&&managedRevision===revision&&loaded===listKey&&baseRevision!==revision?<div className={styles.group}><p>이 흐름에서 별도로 저장한 공정/매핑의 최신 기준을 확인했습니다. Target 초안은 유지됩니다.</p><button type="button" className="secondary-button" disabled={modalBusy||busy||!editable} onClick={()=>{setBaseRevision(revision);setBlocked(false);setImpact(null);setConfirmed(false);setManagedRevision(null);}}>변경된 기준정보 적용</button></div>:null}
      <p className={styles.note}>공정 또는 대상 범위를 변경하면 초안의 구성원 선택을 초기화합니다. 저장하기 전에 다시 선택해 주세요.</p>
      <p className={styles.note}>프로젝트 분류: 사업부 {projectContext?.businessUnit?.name??context?.selection.businessUnitId??"미지정"} / 제품 {projectContext?.product?.name??context?.selection.productId??"미지정"} / 사업장 {projectContext?.siteEntity?.name??context?.selection.siteEntityId??"미지정"}</p>
      <fieldset className={styles.group} disabled={locked}><legend>Target 정보</legend><div className={styles.fields}>
        <label className={styles.field}>대상 범위<select value={draft.scope} onChange={e=>{change({scope:e.target.value as Draft["scope"],projectProcessId:null,workAreaId:null,members:[]});if(e.target.value==="project_common"){setInlineKind("system");setInline(i=>({...i,type:""}));}}}><option value="process">공정</option><option value="project_common">프로젝트 공통</option></select></label>
        {draft.scope==="process"?<><label className={styles.field}>프로젝트 공정<select value={draft.projectProcessId??""} onChange={e=>change({projectProcessId:e.target.value||null,workAreaId:null,members:[]})}><option value="">공정 선택</option>{logistics.processes.filter(p=>p.id===draft.projectProcessId || (p.active && context?.mappings.some(m=>m.processId===p.id&&m.active))).map(p=><option key={p.id} value={p.id}>{p.name} · {p.code}{p.active&&context?.mappings.some(m=>m.processId===p.id&&m.active)?"":" (비활성 참조)"}</option>)}</select></label><label className={styles.field}>작업 구역 (선택)<select value={draft.workAreaId??""} onChange={e=>change({workAreaId:e.target.value||null})}><option value="">미지정</option>{context?.workAreas.filter(a=>a.occurrenceId===occurrence&&(a.active||a.id===draft.workAreaId)).map(a=><option key={a.id} value={a.id}>{a.name} · {a.code}{a.active?"":" (비활성)"}</option>)}</select></label></>:null}
        <label className={styles.field}>Target 이름<input value={draft.name} maxLength={200} onChange={e=>change({name:e.target.value})}/></label><label className={styles.field}>Target 코드<input value={draft.code} maxLength={80} onChange={e=>change({code:e.target.value})}/></label><label><input type="checkbox" checked={draft.active} onChange={e=>change({active:e.target.checked})}/> 활성</label><label className={styles.field}>설명<textarea value={draft.description} onChange={e=>change({description:e.target.value})}/></label>
      </div></fieldset>
      <fieldset className={styles.group} disabled={locked}><legend>기존 인스턴스 연결</legend><p className={styles.note}>선택한 인스턴스를 그대로 재사용합니다. 공유 System의 복제나 제어 관계 변경은 하지 않습니다.</p><label className={styles.field}>기존 인스턴스 검색<input value={instanceSearch} onChange={e=>setInstanceSearch(e.target.value)}/></label><ul className={styles.list}>{[...equipment.map(e=>({kind:"equipment" as const,id:e.id,name:e.name,code:e.code,active:e.active,quantity:e.quantity})),...systems.map(s=>({kind:"system" as const,id:s.id,name:s.name,code:s.code,active:s.active,quantity:1}))].map(m=><li key={m.kind+m.id}><label><input type="checkbox" checked={draft.members.some(x=>"entityId" in x&&x.kind===m.kind&&x.entityId===m.id)} disabled={!m.active&&!draft.members.some(x=>"entityId" in x&&x.entityId===m.id)} onChange={e=>change({members:e.target.checked?[...draft.members,{kind:m.kind,entityId:m.id}]:draft.members.filter(x=>!("entityId" in x&&x.kind===m.kind&&x.entityId===m.id))})}/> {m.kind==="equipment"?"설비":"System"} · {m.name} ({m.code}) · 원본 {m.quantity} · 공유 Target {shared?.revision===revision ? shared.counts[`${m.kind}:${m.id}`]??0 : "조회 중/미확인"}개{m.active?"":" · 비활성"}</label></li>)}</ul></fieldset>
      {!editing?<fieldset className={styles.group} disabled={locked || !types || (draft.scope==="process"&&!draft.projectProcessId)}><legend>새 인스턴스 만들기</legend><div className={styles.fields}><label className={styles.field}>종류<select value={inlineKind} onChange={e=>{setInlineKind(e.target.value as typeof inlineKind);setInline(i=>({...i,type:""}));}}><option value="equipment" disabled={draft.scope==="project_common"}>설비</option><option value="system">System</option></select></label><label className={styles.field}>유형<select value={inline.type} onChange={e=>setInline(i=>({...i,type:e.target.value}))}><option value="">유형 선택</option>{(inlineKind==="equipment"?types?.equipmentTypes:types?.systemTypes)?.map(t=><option key={t.code} value={t.code}>{t.name}</option>)}</select></label><label className={styles.field}>인스턴스 코드<input value={inline.code} onChange={e=>setInline(i=>({...i,code:e.target.value}))}/></label><label className={styles.field}>인스턴스 이름 (System은 생략 가능)<input value={inline.name} onChange={e=>setInline(i=>({...i,name:e.target.value}))}/></label>{inlineKind==="equipment"?<><label className={styles.field}>관리 단위<select value={inline.managementUnit} onChange={e=>setInline(i=>({...i,managementUnit:e.target.value as "unit"|"fleet",quantity:e.target.value==="unit"?1:i.quantity}))}><option value="unit">단품</option><option value="fleet">Fleet</option></select></label><label className={styles.field}>원본 수량<input type="number" min={1} max={inline.managementUnit==="unit"?1:100000} step={1} value={inline.quantity} onChange={e=>setInline(i=>({...i,quantity:Number(e.target.value)}))}/></label></>:<label className={styles.field}>System 계층<select value={inline.layer} onChange={e=>setInline(i=>({...i,layer:e.target.value as "controller"|"coordinator"}))}><option value="controller">Controller</option><option value="coordinator">Coordinator</option></select></label>}</div><label><input type="checkbox" checked={inline.confirmDuplicateLabel} onChange={e=>setInline(i=>({...i,confirmDuplicateLabel:e.target.checked}))}/> 동일 라벨의 별도 인스턴스 생성을 확인했습니다</label><button className="secondary-button" type="button" disabled={!inline.code.trim()||!inline.type||(inlineKind==="equipment"&&(!inline.name.trim()||draft.scope==="project_common"||!Number.isInteger(inline.quantity)||inline.quantity<1||inline.quantity>100000||(inline.managementUnit==="unit"&&inline.quantity!==1)))} onClick={()=>{const member:LogisticsTargetCreateMember=inlineKind==="equipment"?{kind:"equipment",create:{code:inline.code,name:inline.name,equipmentType:inline.type,managementUnit:inline.managementUnit,quantity:inline.quantity,confirmDuplicateLabel:inline.confirmDuplicateLabel}}:{kind:"system",create:{code:inline.code,...(inline.name.trim()?{name:inline.name}:{}),systemType:inline.type,scope:"project",layer:inline.layer,confirmDuplicateLabel:inline.confirmDuplicateLabel}};change({members:[...draft.members,member]});setInline(i=>({...i,code:"",name:""}));}}>새 인스턴스를 초안에 추가</button></fieldset>:<p className={styles.note}>기존 Target 수정에서는 저장된 인스턴스를 재사용합니다. 새 인스턴스는 설비/시스템 관리에서 등록한 뒤 연결하세요.</p>}
      {context?<TargetMasterRegistration publicId={publicId} revision={baseRevision} processId={draft.projectProcessId??null} context={context} processes={logistics.processes} disabled={locked} onBusyChange={setAdminPending} onDirtyChange={setAdminDirty} onRegistered={result=>{setImpact(null);setConfirmed(false);if(result.projectRevision!==undefined){setManagedRevision(result.projectRevision);onMutated();}setRetry(x=>x+1);onTypesChanged?.();}}/>:null}
      <p className={styles.note}>유형·공정·작업 구역이 없다면 관리자가 기준정보를 등록해야 합니다. 이 초안을 유지한 채 관리자 화면을 새 탭에서 열 수 있습니다. 별도 관리자 저장은 Target 취소로 되돌아가지 않습니다. <a href="/project-master-admin" target="_blank" rel="noopener noreferrer">관리자 화면 열기</a></p>
      <ul className={styles.list}>{draft.members.map((m,i)=><li className={styles.row} key={"entityId" in m?m.kind+m.entityId:`new-${i}`}><span>{m.kind} · {"entityId" in m ? (logistics.equipment.find(e=>e.id===m.entityId)?.name??logistics.systems.find(s=>s.id===m.entityId)?.name??m.entityId):`신규 ${m.create.code}`}</span><button type="button" className="secondary-button" disabled={locked} onClick={()=>change({members:draft.members.filter((_,index)=>index!==i)})}>구성원 제거</button></li>)}</ul>
      {editing?<><button type="button" className="secondary-button" disabled={locked||!draft.members.length} onClick={()=>void preview()}>변경 영향 확인</button>{impact?<div role="status"><p>영향 작업 {impact.affectedTaskIds.length}개 · whole 연결 {impact.wholeBindingIds.length}개 · subset 연결 {impact.subsetBindingIds.length}개</p>{impact.blockedSubsetMemberIds.length?<p className={styles.error}>subset이 참조하는 구성원은 제거할 수 없습니다. 작업 연결을 먼저 명시적으로 변경하세요.</p>:<label><input type="checkbox" checked={confirmed} disabled={locked} onChange={e=>setConfirmed(e.target.checked)}/> 이 변경 영향을 확인했습니다</label>}</div>:null}</>:null}
      <div className={styles.toolbar}><button type="button" className="primary-button" disabled={locked||!draft.code.trim()||!draft.name.trim()||!draft.members.length||(draft.scope==="process"&&!draft.projectProcessId)||(!!editing&&(!impact||!confirmed||!!impact.blockedSubsetMemberIds.length))} onClick={()=>void save()}>{pending?"저장 중…":"Target 저장"}</button><button type="button" className="secondary-button" disabled={modalBusy} onClick={close}>취소</button>{editing?<button type="button" className="secondary-button" disabled={locked} onClick={()=>setDeleteConfirm(true)}>Target 삭제</button>:null}</div>
      {deleteConfirm?<div role="alert"><p>사용 중인 Target은 삭제할 수 없습니다. 연결을 해제한 Target만 삭제합니다. 인스턴스는 남습니다.</p><button type="button" className="secondary-button" disabled={locked} onClick={()=>void remove()}>삭제 확인</button><button type="button" className="secondary-button" disabled={modalBusy} onClick={()=>setDeleteConfirm(false)}>삭제 취소</button></div>:null}
      {discard?<div role="alert"><p>Target 초안을 폐기하고 닫을까요?</p><button type="button" className="secondary-button" disabled={modalBusy} onClick={()=>{setDiscard(false);setDraft(null);setEditing(null);setBlocked(false);}}>초안 폐기</button><button type="button" className="secondary-button" onClick={()=>setDiscard(false)}>계속 편집</button></div>:null}
    </div></WorkspaceDialog>:null}
  </div>;
}
