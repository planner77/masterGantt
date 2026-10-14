"use client";
import { useEffect, useRef, useState } from "react";
import type { LogisticsTargetDto, LogisticsTargetListResponse } from "@/contracts/logistics-targets";
import type { TaskTargetBindingInput, TaskTargetBindingsResponse } from "@/contracts/task-target-bindings";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { taskContextLabels } from "@/features/logistics/task-context-label";
import type { ProjectTaskDto } from "@/contracts/projects";
import { TargetDetail } from "@/features/logistics/target-detail";
import styles from "@/features/logistics/target-ui.module.css";

export function TaskTargetBindingEditor({ taskId, taskType, revision, editable, disabled, discardGeneration, onDirtyChange, onPendingChange, onUnauthorized, onApplied, onOpenTask, tasks }: {
 tasks:readonly ProjectTaskDto[]; taskId:string; taskType:"task"|"summary"|"milestone"; revision:number; editable:boolean; disabled:boolean; discardGeneration:number;
 onDirtyChange:(dirty:boolean)=>void;onPendingChange:(pending:boolean)=>void;onUnauthorized?:()=>void;onApplied:()=>Promise<void>;onOpenTask?:(id:string)=>void;
}) {
 const [dirty,setDirty]=useState(false);
 const [targets,setTargets]=useState<LogisticsTargetDto[]>([]);
 const [bindings,setBindings]=useState<TaskTargetBindingInput[]>([]);
 const [effective,setEffective]=useState<TaskTargetBindingsResponse["data"]["effective"]|null>(null);
 const [ready,setReady]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [pending,setPending]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [search,setSearch]=useState("");
 const [retry,setRetry]=useState(0);
 const [detailRequest,setDetailRequest]=useState<LogisticsTargetDto|null>(null);
 const [scopeChange,setScopeChange]=useState<{targetId:string;scope:"self"|"subtree";remove?:boolean}|null>(null);
 const [detail,setDetail]=useState<LogisticsTargetDto|null>(null);
 const initial=useRef("");
 const dirtyRef=useRef(false);
 const generation=useRef(discardGeneration);
 const requestKey=`${taskId}:${revision}:${discardGeneration}:${retry}`;
 const [publicId,setPublicId]=useState<string|null>(null);
 useEffect(()=>{void Promise.resolve().then(()=>{const match=/^\/projects\/([^/]+)\/?$/.exec(window.location.pathname);if(match)setPublicId(decodeURIComponent(match[1]));});},[]);
 const url=publicId?`/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/target-bindings`:null;
 useEffect(()=>{
  if(!url||!publicId)return;
  const controller=new AbortController();
  void(async()=>{
   await Promise.resolve();if(controller.signal.aborted)return;
   if(dirtyRef.current&&generation.current===discardGeneration){setError("기준 정보가 변경되었습니다. Target 초안은 유지됩니다. 최신 정보 다시 불러오기에서 명시적으로 폐기해 주세요.");setReady(null);return;}
   generation.current=discardGeneration;setReady(null);setError(null);
   try{
    const res=await fetch(url,{credentials:"same-origin",cache:"no-store",signal:controller.signal});
    if(!res.ok)throw new Error();
    const body=await res.json() as TaskTargetBindingsResponse;
    const all:LogisticsTargetDto[]=[];let offset=0;
    while(true){
     const list=await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/targets?limit=100&offset=${offset}`,{credentials:"same-origin",cache:"no-store",signal:controller.signal});
     if(!list.ok)throw new Error();const data=(await list.json() as LogisticsTargetListResponse).data;
     if(data.projectRevision!==revision)throw new Error();all.push(...data.targets);
     if(all.length>=data.total)break;offset+=100;if(offset>10000)throw new Error();
    }
    if(body.data.projectRevision!==revision||body.data.taskId!==taskId||!Array.isArray(body.data.bindings)||!body.data.effective)throw new Error();
    if(controller.signal.aborted)return;
    setTargets(all);setBindings(body.data.bindings);setEffective(body.data.effective);initial.current=JSON.stringify(body.data.bindings);dirtyRef.current=false;setDirty(false);onDirtyChange(false);setReady(requestKey);setBlocked(false);
   }catch{if(!controller.signal.aborted){setReady(null);setError("Target 연결을 불러오지 못했습니다. 최신 정보로 다시 시도해 주세요.");}}
  })();return()=>controller.abort();
 },[url,publicId,taskId,revision,discardGeneration,retry,requestKey,onDirtyChange]);
 const valid=ready===requestKey;
 const locked=!editable||disabled||pending||!valid||blocked;
 function update(next:TaskTargetBindingInput[]) {setBindings(next);dirtyRef.current=JSON.stringify(next)!==initial.current;setDirty(dirtyRef.current);onDirtyChange(dirtyRef.current);}
 function patch(id:string, change:Partial<TaskTargetBindingInput>){update(bindings.map(b=>b.targetId===id?{...b,...change}:b));}
 async function save(){
  if(!url||locked)return;setPending(true);onPendingChange(true);setError(null);
  try{
   const res=await fetch(url,{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json","If-Match":`"${revision}"`},body:JSON.stringify({bindings:bindings.map(b=>({...((b.id!==undefined)?{id:b.id}:{}),targetId:b.targetId,scope:b.scope,selection:b.selection,memberIds:b.selection==="whole"?[]:b.memberIds,coverageByMember:b.selection==="whole"?[]:b.coverageByMember??[]}))})});
   if(res.status===401){setBlocked(true);onUnauthorized?.();setError("편집 권한이 만료되었습니다. Target 초안은 유지됩니다. 다시 권한을 확인해 주세요.");return;}
   if(res.status===412||res.status===403){setBlocked(true);setError("기준 정보 또는 권한이 변경되었습니다. Target 초안은 유지됩니다. 최신 정보 다시 불러오기에서 명시적으로 폐기하고 검토해 주세요.");return;}
   if(!res.ok){setError("Target 연결 저장에 실패했습니다. subset과 작업 범위 수량을 확인해 주세요.");return;}
   initial.current=JSON.stringify(bindings);dirtyRef.current=false;setDirty(false);onDirtyChange(false);await onApplied();
  }catch{setError("네트워크 오류로 Target 연결을 저장하지 못했습니다. 초안은 유지됩니다.");}finally{setPending(false);onPendingChange(false);}
 }
 const taskNames=taskContextLabels(tasks);
 const sourceTask=tasks.find(t=>t.taskId===taskId);
 const tasksByExternalId=new Map(tasks.map(task=>[task.externalId,task]));
 const descendantTasks=tasks.filter(task=>{
   const visited=new Set<string>();let parent=task.parentExternalId;
   while(parent&&!visited.has(parent)){if(parent===sourceTask?.externalId)return true;visited.add(parent);parent=tasksByExternalId.get(parent)?.parentExternalId??null;}
   return false;
 });
 const invalid=bindings.some(b=>b.selection==="subset"&&(!b.memberIds.length||(b.coverageByMember??[]).some(c=>{const member=targets.find(t=>t.id===b.targetId)?.members.find(m=>m.id===c.memberId);return c.coverage!==null&&(!member||member.kind!=="equipment"||!Number.isInteger(c.coverage)||c.coverage<=0||c.coverage>member.quantity);}))); 
 return <section className={styles.panel} aria-label="작업 Target 연결">
  <h3>물류 대상(Target) 연결</h3><p className={styles.note}>직접 연결과 조상 Summary의 하위 적용을 합집합으로 읽습니다. 같은 인스턴스는 한 번 계산하고 각 출처를 유지합니다. whole은 현재 모든 구성원을 동적으로 포함합니다.</p>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {!valid?<button type="button" className="secondary-button" disabled={pending} onClick={()=>setRetry(x=>x+1)}>Target 연결 다시 시도</button>:null}
  <label className={styles.field}>연결할 Target 검색<input value={search} onChange={e=>setSearch(e.target.value)}/></label>
  <ul className={styles.list}>{targets.filter(t=>(t.name+" "+t.code).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(target=>{const binding=bindings.find(b=>b.targetId===target.id);return <li key={target.id} className={styles.group}>
   <div className={styles.toolbar}><label><input type="checkbox" checked={!!binding} disabled={locked||(!target.active&&!binding)} onChange={e=>{if(!e.target.checked&&binding?.scope==="subtree"){setScopeChange({targetId:target.id,scope:"self",remove:true});return;}update(e.target.checked?[...bindings,{targetId:target.id,scope:"self",selection:"whole",memberIds:[]}]:bindings.filter(b=>b.targetId!==target.id));}}/> {target.name} ({target.code}){target.active?"":" · 비활성"}</label><button type="button" className="secondary-button" disabled={pending} onClick={()=>dirty?setDetailRequest(target):setDetail(target)}>Target 상세: {target.name}</button></div>
   {binding?<><div className={styles.fields}><label className={styles.field}>{target.name} 적용 범위<select value={binding.scope} disabled={locked} onChange={e=>setScopeChange({targetId:target.id,scope:e.target.value as "self"|"subtree"})}><option value="self">현재 작업만 (self)</option>{taskType==="summary"?<option value="subtree">하위 작업 포함 (subtree)</option>:null}</select></label><label className={styles.field}>{target.name} 구성원 선택<select value={binding.selection} disabled={locked} onChange={e=>patch(target.id,{selection:e.target.value as "whole"|"subset",memberIds:[],coverageByMember:[]})}><option value="whole">전체 구성원 (whole)</option><option value="subset">구성원 선택 (subset)</option></select></label></div>
   {binding.selection==="subset"?<fieldset className={styles.group} disabled={locked}><legend>{target.name} 선택 구성원</legend>{target.members.map(m=><div className={styles.row} key={m.id}><label><input type="checkbox" checked={binding.memberIds.includes(m.id)} onChange={e=>patch(target.id,{memberIds:e.target.checked?[...binding.memberIds,m.id]:binding.memberIds.filter(id=>id!==m.id),coverageByMember:(binding.coverageByMember??[]).filter(c=>c.memberId!==m.id)})}/> {m.label} ({m.code}) · 원본 {m.quantity}</label>{m.kind==="equipment"&&binding.memberIds.includes(m.id)?<label className={styles.field}>{m.label} 작업 범위 수량 (선택)<input type="number" aria-label={`${m.label} 작업 범위 수량 (선택)`} min={1} max={m.quantity} step={1} value={binding.coverageByMember?.find(c=>c.memberId===m.id)?.coverage??""} onChange={e=>patch(target.id,{coverageByMember:[...(binding.coverageByMember??[]).filter(c=>c.memberId!==m.id),{memberId:m.id,coverage:e.target.value===""?null:Number(e.target.value)}]})}/></label>:null}</div>)}</fieldset>:<p className={styles.note}>현재 및 이후 추가되는 전체 구성원을 포함합니다. 작업 범위 수량은 subset에서만 지정합니다.</p>}</>:null}
  </li>;})}</ul>
  {!targets.length&&valid?<p>등록된 Target이 없습니다. 물류 구성의 Target 탭에서 먼저 만드세요.</p>:null}
  {scopeChange?<div className={styles.group} role="alert"><p>{scopeChange.remove?"Target 연결 제거와 하위 적용 해제":scopeChange.scope==="subtree"?"하위 작업 포함 적용":"하위 적용 해제"}: 검토할 하위 작업 {descendantTasks.length}개. 직접 연결과 다른 조상의 연결은 합집합으로 유지됩니다.</p><ul className={styles.list}>{descendantTasks.map(t=><li key={t.taskId}>{taskNames[t.taskId]} · 작업 ID {t.taskId}</li>)}</ul><div className={styles.toolbar}><button type="button" className="secondary-button" disabled={locked} onClick={()=>{if(scopeChange.remove)update(bindings.filter(b=>b.targetId!==scopeChange.targetId));else patch(scopeChange.targetId,{scope:scopeChange.scope});setScopeChange(null);}}>하위 작업 영향 확인 후 적용</button><button type="button" className="secondary-button" disabled={pending} onClick={()=>setScopeChange(null)}>범위 변경 취소</button></div></div>:null}
  {detailRequest?<div className={styles.group} role="alert"><p>저장하지 않은 Target 연결 초안이 있습니다. 초안을 유지한 채 상세를 열까요?</p><div className={styles.toolbar}><button type="button" className="secondary-button" onClick={()=>{setDetail(detailRequest);setDetailRequest(null);}}>초안을 유지하고 상세 열기</button><button type="button" className="secondary-button" onClick={()=>setDetailRequest(null)}>상세 열기 취소</button></div></div>:null}
  {invalid?<p className={styles.error} role="alert">subset은 구성원을 1개 이상 선택해야 합니다. 설비 작업 범위 수량은 미지정 또는 원본 수량 이하의 양의 정수만 허용합니다.</p>:null}
  <button type="button" className="primary-button" disabled={locked||invalid||!dirty||!!scopeChange} onClick={()=>void save()}>{pending?"Target 연결 저장 중…":"Target 연결 저장"}</button>
  {effective&&valid?<><h4>저장된 조상 상속과 유효 출처</h4>{!effective.inheritedBindings.length?<p>상속된 Target 연결이 없습니다.</p>:<ul className={styles.list}>{effective.inheritedBindings.map(b=><li key={b.id}>{targets.find(t=>t.id===b.targetId)?.name??b.targetId} · {b.selection} · {b.scope} · 상위 작업 {taskNames[b.taskId]??b.taskId} (ID: {b.taskId}){onOpenTask?<button type="button" className="secondary-button" disabled={disabled||pending} onClick={()=>onOpenTask(b.taskId)}>상위 원본 작업 편집</button>:null}</li>)}</ul>}<ul className={styles.list}>{effective.effectiveMembers.map(m=><li key={m.kind+m.entityId}>{targets.flatMap(t=>t.members).find(x=>x.entityId===m.entityId&&x.kind===m.kind)?.label??m.entityId} · {m.coverageState==="multiple"?"복수 작업 범위 (합산하지 않음)":m.coverageState}<ul>{m.provenance.map(p=><li key={p.bindingId+p.memberId}>{targets.find(t=>t.id===p.targetId)?.name??p.targetId} · {p.inherited?"조상 상속":"직접 연결"} · 원본 작업 {taskNames[p.sourceTaskId]??p.sourceTaskId} (ID: {p.sourceTaskId}) · {p.selection}/{p.scope} · {p.coverageMode} · 작업 범위 {p.coverage??"미지정"}</li>)}</ul></li>)}</ul><p className={styles.note}>기존 직접 설비·System 출처 {effective.legacySources.length}개는 Target 연결과 별도입니다.</p></>:null}
  {detail&&publicId?<WorkspaceDialog title={`Target 상세 · ${detail.name}`} busy={pending} onClose={()=>setDetail(null)}>{valid?<TargetDetail key={detail.id} revision={revision} publicId={publicId} target={targets.find(t=>t.id===detail.id)??detail} taskNames={taskNames} disabled={pending} onOpenTask={onOpenTask ? id=>{setDetail(null);onOpenTask(id);}:undefined}/>:<p role="status">Target 기준 정보가 변경되었습니다. 닫은 뒤 최신 정보로 다시 조회하세요.</p>}</WorkspaceDialog>:null}
 </section>;
}
