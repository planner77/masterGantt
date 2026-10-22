"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectWorkAreaDto, ProcessContextResponse } from "@/contracts/process-catalog";
import type { LogisticsMutationResponse, ProcessDto, ProjectLogisticsDto } from "@/contracts/logistics";
import type { ProjectDto } from "@/contracts/projects";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { IdentifierDetails } from "@/components/identifier-details";
import { validProjectWorkareas } from "./project-workarea-options";
import styles from "./project-process-management.module.css";

type Area = ProjectWorkAreaDto;
type Draft = { id?: string; name: string; code: string; active: boolean; sortOrder: number; revision: number; processId: string };
export function ProjectWorkareaManagement({publicId, revision, editable, active, busy: externalBusy, process, onMutated, onUnauthorized, onRequireRefresh, openRequest, onRequestHandled, onInteractionLocked, onContextLoaded, onSelectProcess, onLegacyRequest}: {
  publicId: string; revision: number; editable: boolean; active: boolean; busy: boolean; process?: ProcessDto;
  onMutated: (logistics: ProjectLogisticsDto, project: ProjectDto) => void; onUnauthorized: () => void; onRequireRefresh: () => void;
  onLegacyRequest?: (sequence:number)=>void;
  onContextLoaded: (data:ProcessContextResponse["data"])=>void; onSelectProcess: (id:string)=>void;
  onInteractionLocked: (locked:boolean)=>void;
  openRequest?: {id:string;sequence:number;trigger:HTMLElement}|null; onRequestHandled?:()=>void;
}) {
  const [context, setContext] = useState<ProcessContextResponse["data"] | null>(null);
  const [loaded, setLoaded] = useState("");
  const [refresh,setRefresh]=useState(0);
  const [error, setError] = useState<string|null>(null);
  const [notice, setNotice] = useState<string|null>(null);
  const [draft, setDraft] = useState<Draft|null>(null);
  const [deleting, setDeleting] = useState<Area|null>(null);
  const [discard, setDiscard] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search,setSearch] = useState(""); const [status,setStatus] = useState("all"); const [sort,setSort] = useState("order");
  useEffect(()=>{onInteractionLocked(!!draft || busy || !!deleting);return()=>onInteractionLocked(false);},[draft,busy,deleting,onInteractionLocked]);
  const initial = useRef(""); const pending = useRef(false); const trigger = useRef<HTMLElement|null>(null);
  const successFocus=useRef<HTMLElement|null>(null);
  const heading=useRef<HTMLHeadingElement|null>(null);
  const drillDraft=useRef(false);
  const observedDrillDraft=useRef(false);
  const generation = useRef(0); const handled = useRef<number|null>(null);
  const key = `${publicId}:${revision}:${editable}:${refresh}`;
  const current = loaded === key && context?.projectRevision === revision;
  const canEdit = editable && current && context?.permission === "edit" && !busy && !externalBusy && !invalid;
  const load = useCallback(async(signal?:AbortSignal) => {
    const epoch = ++generation.current;
    const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/process-context`,{credentials:"same-origin",cache:"no-store",signal});
    const value = await response.json().catch(()=>null) as ProcessContextResponse|null;
    if (!response.ok || !value?.data || value.data.projectRevision !== revision || !validProjectWorkareas(value.data.projectWorkAreas)) throw new Error("context");
    if(signal?.aborted || epoch !== generation.current) return;
    setContext(value.data); setLoaded(key); setError(null);
  },[publicId,revision,key]);
  useEffect(()=>{if(!active || current)return;const c=new AbortController();void Promise.resolve().then(()=>load(c.signal)).catch(()=>{if(!c.signal.aborted)setError("작업 구역을 조회하지 못했습니다. 0개로 처리하지 않습니다. 새로고침을 선택해 주세요.");});return()=>c.abort();},[active,current,load]);
  useEffect(()=>{if(context && current)onContextLoaded(context);},[context,current,onContextLoaded]);
  useEffect(()=>{
    if(!current || draft || deleting || busy || !successFocus.current)return;
    const element=successFocus.current;successFocus.current=null;
    if(document.activeElement===document.body || document.activeElement===null){
      if(element.isConnected && !element.matches(":disabled"))element.focus({preventScroll:true});else heading.current?.focus({preventScroll:true});
    }
  },[current,draft,deleting,busy]);
  function begin(element:HTMLElement,area?:Area){
    if(!process || !canEdit)return;
    trigger.current=element;setError(null);setInvalid(false);
    const next={id:area?.id,name:area?.name??"",code:area?.code??"",active:area?.active??true,sortOrder:area?.sortOrder??0,revision,processId:process.id};
    initial.current=JSON.stringify(next);setDraft(next);
  }
  useEffect(()=>{
    if(!openRequest || handled.current===openRequest.sequence || !current)return;
    let cancelled=false;
    void Promise.resolve().then(()=>{
      if(cancelled)return;
    const area=context?.projectWorkAreas?.find(a=>a.id===openRequest.id && a.processId===process?.id) ?? context?.projectWorkAreas?.find(a=>a.id===openRequest.id);
    if(area?.source==="legacy" && onLegacyRequest){handled.current=openRequest.sequence;onLegacyRequest(openRequest.sequence);return;}
    if(area && area.processId!==process?.id){onSelectProcess(area.processId);return;}
    if(area && editable && (!canEdit || draft))return;
    handled.current=openRequest.sequence;
    if(!area){setNotice("선택한 작업 구역의 소유 공정을 목록에서 선택해 주세요.");return;}
    setNotice(`${area.name} · ${area.source==="legacy"?"기존 공유 구역 (읽기 전용)":"프로젝트 작업 구역"}`);
    setSearch("");setStatus("all");
    if(area.editable && canEdit){
      trigger.current=openRequest.trigger;
      const next={id:area.id,name:area.name,code:area.code,active:area.active,sortOrder:area.sortOrder,revision,processId:area.processId};
      initial.current=JSON.stringify(next);drillDraft.current=true;setDraft(next);
    }else requestAnimationFrame(()=>document.getElementById(`project-workarea-${area.id}`)?.focus({preventScroll:true}));
    });
    return()=>{cancelled=true;};
  },[openRequest,current,context,process,onRequestHandled,onSelectProcess,onLegacyRequest,editable,canEdit,draft,revision]);
  useEffect(()=>{
    if(draft && drillDraft.current)observedDrillDraft.current=true;
    if(!draft && drillDraft.current && observedDrillDraft.current){drillDraft.current=false;observedDrillDraft.current=false;onRequestHandled?.();}
  },[draft,onRequestHandled]);
  function close(){if(pending.current)return;if(draft && JSON.stringify(draft)!==initial.current)setDiscard(true);else setDraft(null);}
  async function mutate(method:"POST"|"PATCH"|"DELETE", area?:Area, body?:unknown){
    if(pending.current || !canEdit || !process || (draft && draft.revision!==revision))return false;
    pending.current=true;setBusy(true);setError(null);
    const base=`/api/projects/${encodeURIComponent(publicId)}/logistics`;
    try{
      const response=await fetch(method==="POST"?`${base}/processes/${encodeURIComponent(process.id)}/work-areas`:`${base}/work-areas/${encodeURIComponent(area?.id??draft?.id??"")}`,{method,credentials:"same-origin",headers:{"If-Match":`"${revision}"`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
      if(response.status===204 && method==="DELETE"){successFocus.current=trigger.current;setLoaded("");onRequireRefresh();setNotice("작업 구역을 삭제했습니다.");return true;}
      const value=await response.json().catch(()=>null) as LogisticsMutationResponse|null;
      if(!response.ok || !value?.data?.project || !value.data.logistics || value.data.permission!=="edit" || !Number.isSafeInteger(value.data.project.revision)){
        if(response.status===401){onUnauthorized();setInvalid(true);}
        if(response.status===412 || response.status>=500 || response.ok){setInvalid(true);onRequireRefresh();}
        setError(response.status===409?"사용 중이거나 중복되는 구역입니다. 연결을 확인하거나 비활성화를 사용해 주세요.":response.status===412?"다른 변경이 먼저 저장되었습니다. 초안을 보존했습니다. 취소한 뒤 최신 목록에서 다시 열어 주세요.":response.status===401||response.status===403?"편집 권한을 확인해 주세요. 입력 내용은 유지됩니다.":"저장 결과를 확인할 수 없습니다. 입력 내용을 보존하고 최신 목록에서 확인해 주세요.");return false;
      }
      successFocus.current=trigger.current;setLoaded("");onMutated(value.data.logistics,value.data.project);setNotice("작업 구역을 저장했습니다.");return true;
    }catch{setInvalid(true);setError("서버 연결이 끊겨 저장 결과가 불확실합니다. 초안은 유지됩니다. 취소한 뒤 새로고침으로 확인해 주세요.");return false;}
    finally{pending.current=false;setBusy(false);}
  }
  async function save(event:FormEvent){event.preventDefault();if(!draft || !draft.name.trim())return;const{name,code,active,sortOrder}=draft;if(await mutate(draft.id?"PATCH":"POST",undefined,{name:name.trim(),...(code.trim()?{code:code.trim()}:{}),active,sortOrder}))setDraft(null);}
  const areas=context?.projectWorkAreas?.filter(a=>a.processId===process?.id)??[];
  const direct=areas.filter(a=>a.source==="project").filter(a=>(status==="all"||a.active===(status==="active"))&&`${a.name} ${a.code}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"ko"):a.sortOrder-b.sortOrder||a.name.localeCompare(b.name,"ko"));
  const legacy=areas.filter(a=>a.source==="legacy");
  return <section className={styles.section} aria-label="선택 공정 작업 구역" aria-busy={busy} hidden={!active}>
    <div className={styles.heading}><h3 ref={heading} tabIndex={-1}>{process?`${process.name} · 프로젝트 작업 구역${current?` ${areas.filter(a=>a.source==="project").length}개${legacy.length?` · 기존 공유 ${legacy.length}개`:""}`:""}`:"공정을 선택해 작업 구역을 확인하세요"}</h3><button type="button" className="secondary-button" disabled={busy||externalBusy||!!draft} onClick={()=>{setError(null);setInvalid(false);setRefresh(value=>value+1);}}>작업 구역 새로고침</button></div>
    {openRequest?<button type="button" className="secondary-button" disabled={busy||!!draft} onClick={onRequestHandled}>원래 계층 조회로 돌아가기</button>:null}
    {error?<p role="alert" className={styles.error}>{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!current?<p role="status">작업 구역 목록을 확인하는 중이거나 사용할 수 없습니다.</p>:null}
    {context && process?<>
      {!editable?<p className={styles.note}>읽기 전용입니다. 작업 구역을 변경하려면 프로젝트 편집 권한을 활성화해 주세요.</p>:null}
      <div className={styles.toolbar}><label>작업 구역 검색<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>작업 구역 상태<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">전체</option><option value="active">활성</option><option value="inactive">비활성</option></select></label><label>작업 구역 정렬<select value={sort} onChange={e=>setSort(e.target.value)}><option value="order">정렬 순서</option><option value="name">이름순</option></select></label>{editable?<button type="button" className="primary-button" disabled={!canEdit||!process.active} onClick={e=>begin(e.currentTarget)}>작업 구역 추가</button>:null}</div>
      <div className={styles.tableScroll}><table className={styles.areaTable}><caption>{process.name}의 프로젝트 작업 구역</caption><colgroup><col/><col style={{width:96}}/><col style={{width:88}}/><col style={{width:176}}/></colgroup><thead><tr><th>작업 구역명</th><th>상태</th><th>정렬 순서</th><th>관리</th></tr></thead><tbody>{direct.map(a=><tr key={a.id} id={`project-workarea-${a.id}`} tabIndex={-1}><th scope="row">{a.name}<IdentifierDetails identifiers={[{label:"작업 구역 코드",value:a.code},{label:"작업 구역 ID",value:a.id}]}/></th><td>{a.active?"활성":"비활성"}</td><td>{a.sortOrder}</td><td><div className={styles.actions}>{a.usageCount>0?<span id={`workarea-usage-${a.id}`} className={styles.note}>사용 중 · 연결을 해제한 뒤 삭제할 수 있습니다.</span>:null}{editable?<><button type="button" className="secondary-button" disabled={!canEdit||!a.editable} onClick={e=>begin(e.currentTarget,a)}>수정<span className={styles.srOnly}> {a.name}</span></button><button type="button" className="secondary-button" disabled={!canEdit||!a.editable||a.usageCount>0} aria-describedby={a.usageCount>0?`workarea-usage-${a.id}`:undefined} onClick={e=>{trigger.current=e.currentTarget;setDeleting(a);}}>삭제<span className={styles.srOnly}> {a.name}</span></button></>:"읽기 전용"}</div></td></tr>)}{!direct.length?<tr><td colSpan={4}>{areas.some(a=>a.source==="project")?"조건에 맞는 작업 구역이 없습니다.":"등록된 작업 구역이 없습니다. 구역 없이 공정을 사용할 수 있습니다."}</td></tr>:null}</tbody></table></div>
      {legacy.length?<details><summary>기존 공유 구역 ({legacy.length}개 · 읽기 전용)</summary><p className={styles.note}>현장 공정 연결의 기존 공유 원본입니다. 프로젝트 구역으로 자동 전환하지 않습니다.</p>{legacy.map(a=><p key={`${a.processId}:${a.id}`}>{a.name} · {a.active?"활성":"비활성"}{a.diagnostics?.includes("shared")?" · 여러 프로젝트/공정에서 공유":""}{a.diagnostics?.includes("classification_mismatch")?" · 현재 분류 밖":""}<IdentifierDetails identifiers={[{label:"기존 구역 ID",value:a.id},{label:"현장 공정 ID",value:a.occurrenceId ?? "미지정"}]}/></p>)}</details>:null}
    </>:null}
    {draft?<WorkspaceDialog title={`작업 구역 ${draft.id?"수정":"추가"}`} busy={busy} restoreFocusRef={trigger} onClose={close}><form data-project-workarea-id={draft.id} data-project-process-id={draft.processId} className={styles.form} onSubmit={e=>void save(e)}><fieldset className={styles.fields} disabled={busy}><label>작업 구역명<input autoFocus required maxLength={200} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>정렬 순서<input type="number" min={0} step={1} required value={draft.sortOrder} onChange={e=>setDraft({...draft,sortOrder:e.target.valueAsNumber})}/></label><label className={styles.check}><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>활성</label><details><summary>식별 정보</summary><label>작업 구역 코드 (비워 두면 자동 생성)<input maxLength={64} value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value})}/></label></details></fieldset>{draft.revision!==revision||invalid||!editable?<p role="alert">최신 정보 또는 편집 권한을 확인해야 합니다. 초안을 보존했으며 저장을 잠갔습니다. 취소한 뒤 최신 목록에서 다시 열어 주세요.</p>:null}{error?<p role="alert">{error}</p>:null}<div className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={close}>취소</button><button type="submit" className="primary-button" disabled={!canEdit||draft.revision!==revision||!draft.name.trim()}>저장</button></div></form></WorkspaceDialog>:null}
    {discard?<WorkspaceDialog title="작업 구역 변경 내용 버리기" onClose={()=>setDiscard(false)}><p>저장하지 않은 변경 내용이 있습니다.</p><div className={styles.actions}><button type="button" className="secondary-button" onClick={()=>setDiscard(false)}>계속 편집</button><button type="button" className="danger-button" onClick={()=>{setDiscard(false);setDraft(null);}}>변경 내용 버리기</button></div></WorkspaceDialog>:null}
    {deleting?<WorkspaceDialog title="작업 구역 삭제 확인" busy={busy} restoreFocusRef={trigger} onClose={()=>setDeleting(null)}><p>{deleting.name} 구역을 삭제하시겠습니까? 사용 여부는 서버에서 다시 확인합니다.</p>{error?<p role="alert">{error}</p>:null}<div className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={()=>setDeleting(null)}>취소</button><button type="button" className="danger-button" disabled={!canEdit} onClick={()=>void mutate("DELETE",deleting).then(ok=>{if(ok)setDeleting(null);})}>삭제 확인</button></div></WorkspaceDialog>:null}
  </section>;
}
