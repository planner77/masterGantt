"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { IMPORT_PREVIEW_DIGEST_HEADER, type ProjectImportPreviewDto } from "@/contracts/project-import";
import type { ProjectSnapshotResponse } from "@/contracts/projects";
import { canCommitImport, importPreviewFrom, importPreviewMatches, importSnapshotFrom } from "./project-import-model";
import { ProjectImportPreview } from "./project-import-preview";
import styles from "./project-import-preview.module.css";

type ImportError = { message:string; details:string[] };
function responseError(value: unknown, fallback: string): ImportError {
  if (!value || typeof value !== "object" || !("error" in value) || !value.error || typeof value.error !== "object") return { message:fallback, details:[] };
  const e=value.error as Record<string,unknown>;
  return { message:typeof e.message === "string" ? e.message : fallback, details:Array.isArray(e.details) ? e.details.flatMap((detail) => detail && typeof detail === "object" ? [`${String(detail.path ?? "")} · ${String(detail.code ?? "")} · ${String(detail.message ?? "")}`] : []) : [] };
}
export function ProjectImportButton({ publicId, expectedRevision, onImportSuccess, disabled=false, editable=false, onAuthorizationExpired, onRequestUnlock, onPendingChange, onRefreshProject }: Readonly<{ publicId:string; expectedRevision:number; onImportSuccess:(snapshot:ProjectSnapshotResponse)=>boolean | Promise<boolean>; disabled?:boolean; editable?:boolean; onAuthorizationExpired:()=>void; onRequestUnlock:()=>void; onPendingChange:(pending:boolean)=>void; onRefreshProject:(signal:AbortSignal)=>Promise<boolean> }>) {
  const { notify }=useWorkspaceNotifications(), fileInput=useRef<HTMLInputElement>(null), trigger=useRef<HTMLButtonElement>(null), generation=useRef(0), controller=useRef<AbortController | null>(null), pending=useRef(false), committing=useRef(false), previewFile=useRef<File | null>(null);
  const errorFocus=useRef<HTMLParagraphElement>(null);
  const current=useRef({publicId,expectedRevision,editable});
  useLayoutEffect(()=>{current.current={publicId,expectedRevision,editable};},[publicId,expectedRevision,editable]);
  const [reviewedFile,setReviewedFile]=useState<File | null>(null);
  const [file,setFile]=useState<File | null>(null), [preview,setPreview]=useState<ProjectImportPreviewDto | null>(null), [open,setOpen]=useState(false), [status,setStatus]=useState<"idle"|"preview"|"refresh"|"commit">("idle"), [error,setError]=useState<ImportError | null>(null);
  const [reviewContext,setReviewContext]=useState({publicId,expectedRevision,editable});
  // 권한·대상·revision 세대가 바뀌면 File은 유지하되 기존 동의는 다시 사용할 수 없다.
  if(reviewContext.publicId!==publicId||reviewContext.expectedRevision!==expectedRevision||reviewContext.editable!==editable){
    setReviewContext({publicId,expectedRevision,editable});setPreview(null);setReviewedFile(null);
  }
  const invalidate=()=>{generation.current++;controller.current?.abort();controller.current=null;pending.current=false;committing.current=false;onPendingChange(false);};
  useEffect(()=>()=>{generation.current++;controller.current?.abort();onPendingChange(false);},[onPendingChange]);
  useEffect(()=>{previewFile.current=null;controller.current?.abort();},[publicId,expectedRevision,editable]);
  useEffect(()=>{if(error)errorFocus.current?.focus({preventScroll:true});},[error]);
  const stale=!!preview&&!importPreviewMatches(preview,publicId,expectedRevision);
  async function loadPreview(selected:File) {
    if(pending.current || !current.current.editable) return;
    const id=++generation.current, target={...current.current}, request=new AbortController();controller.current?.abort();controller.current=request;pending.current=true;setStatus("preview");onPendingChange(true);setError(null);setPreview(null);setReviewedFile(null);previewFile.current=null;
    const body=new FormData();body.append("file",selected);
    try {
      const response=await fetch(`/api/projects/${encodeURIComponent(target.publicId)}/imports/preview`,{method:"POST",credentials:"same-origin",body,signal:request.signal}), value:unknown=await response.json().catch(()=>null);
      if(request.signal.aborted||generation.current!==id||current.current.publicId!==target.publicId) return;
      if(response.status===401){onAuthorizationExpired();setError({message:"편집 세션이 만료되었습니다. 파일은 유지됩니다. 잠금 해제 후 새 미리보기를 실행해 주세요.",details:[]});return;}
      if(!response.ok){setError(responseError(value,"파일을 미리보지 못했습니다."));return;}
      const next=importPreviewFrom(value);
      if(!next||!importPreviewMatches(next,target.publicId,target.expectedRevision)||current.current.expectedRevision!==target.expectedRevision){setError({message:"프로젝트 Revision 또는 미리보기 응답이 다릅니다. 최신 일정에서 새 미리보기를 실행해 주세요.",details:[]});return;}
      previewFile.current=selected;setReviewedFile(selected);setPreview(next);
    } catch {if(!request.signal.aborted&&generation.current===id)setError({message:"네트워크 오류가 발생했습니다. 파일은 유지되며 자동으로 다시 보내지 않습니다.",details:[]});}
    finally {if(generation.current===id){pending.current=false;committing.current=false;setStatus("idle");onPendingChange(false);}}
  }
  async function refreshProject(){
    if(pending.current||!file)return;
    const id=++generation.current,target=current.current.publicId,request=new AbortController();controller.current?.abort();controller.current=request;pending.current=true;setStatus("refresh");onPendingChange(true);setError(null);setPreview(null);setReviewedFile(null);previewFile.current=null;
    try{
      const accepted=await onRefreshProject(request.signal);
      if(request.signal.aborted||generation.current!==id||current.current.publicId!==target)return;
      if(!accepted)setError({message:"최신 일정을 조회하지 못했습니다. 파일은 유지됩니다. 다시 조회한 뒤 미리보기를 실행해 주세요.",details:[]});
    }catch{if(!request.signal.aborted&&generation.current===id)setError({message:"최신 일정 조회 중 네트워크 오류가 발생했습니다. 파일은 유지되며 자동으로 다시 조회하지 않습니다.",details:[]});}
    finally{if(generation.current===id){pending.current=false;setStatus("idle");onPendingChange(false);}}
  }
  function changeFile(event:ChangeEvent<HTMLInputElement>) {const selected=event.target.files?.[0];event.target.value="";if(!selected||pending.current)return;invalidate();setFile(selected);setOpen(true);setPreview(null);setError(null);void loadPreview(selected);}
  function close(){if(committing.current)return;invalidate();setOpen(false);setStatus("idle");setFile(null);setPreview(null);setReviewedFile(null);previewFile.current=null;setError(null);}
  async function commit(){
    if(!file||pending.current||!canCommitImport(preview,current.current.publicId,current.current.expectedRevision,previewFile.current===file,current.current.editable,false))return;
    const reviewed=preview!,target=publicId,id=++generation.current,request=new AbortController();controller.current=request;pending.current=true;committing.current=true;setStatus("commit");onPendingChange(true);setError(null);
    const body=new FormData();body.append("file",file);
    try{
      const response=await fetch(`/api/projects/${encodeURIComponent(target)}/imports`,{method:"POST",credentials:"same-origin",headers:{"If-Match":`"${reviewed.baseRevision}"`,[IMPORT_PREVIEW_DIGEST_HEADER]:reviewed.previewDigest},body,signal:request.signal}),value:unknown=await response.json().catch(()=>null);
      if(request.signal.aborted||generation.current!==id||current.current.publicId!==target)return;
      if(response.status===401){onAuthorizationExpired();setPreview(null);setReviewedFile(null);previewFile.current=null;setError({message:"편집 세션이 만료되었습니다. 파일은 유지됩니다. 잠금 해제 후 새 미리보기를 실행해 주세요.",details:[]});return;}
      if(response.status===412){setPreview(null);setReviewedFile(null);previewFile.current=null;setError({message:"검토 이후 프로젝트가 변경되었습니다. 파일은 유지됩니다. 최신 일정 조회 후 새 미리보기가 필요합니다.",details:[]});return;}
      if(!response.ok){setError(responseError(value,"JSON 가져오기에 실패했습니다. 자동으로 다시 보내지 않습니다."));return;}
      const snapshot=importSnapshotFrom(value,target,reviewed.baseRevision);
      if(response.status!==201||!snapshot||!await onImportSuccess(snapshot)){setError({message:"저장 응답을 현재 일정에 적용하지 못했습니다. 최신 일정을 확인해 주세요. 자동 재저장하지 않습니다.",details:[]});setPreview(null);setReviewedFile(null);previewFile.current=null;return;}
      notify("success","JSON 가져오기가 완료되었습니다.","JSON 가져오기");setOpen(false);setFile(null);setPreview(null);setReviewedFile(null);previewFile.current=null;
    }catch{if(!request.signal.aborted&&generation.current===id)setError({message:"네트워크 오류가 발생했습니다. 파일은 유지되며 자동으로 다시 보내지 않습니다.",details:[]});}
    finally{if(generation.current===id){pending.current=false;committing.current=false;setStatus("idle");onPendingChange(false);}}
  }
  return <><input type="file" accept=".json,application/json" ref={fileInput} hidden onChange={changeFile}/><button ref={trigger} type="button" className="secondary-button" disabled={disabled||!editable} onClick={()=>fileInput.current?.click()}>가져오기 (JSON)</button>
    {open?<WorkspaceDialog title="JSON 파일 가져오기" size="wide" busy={status==="commit"} restoreFocusRef={trigger} onClose={close}><div className={styles.content}><div className={styles.body}>
      <p>파일: {file?.name} · 대상 Project ID: {publicId} · 현재 revision {expectedRevision}</p>
      {status==="preview"?<p role="status">파일을 검증하는 중… 취소하면 이 조회를 중단합니다.</p>:null}
      {status==="refresh"?<p role="status">최신 일정을 조회하는 중… 파일을 유지하고 미리보기는 별도로 실행합니다.</p>:null}
      {stale?<p role="alert">프로젝트 revision이 변경되어 미리보기가 만료되었습니다. 파일을 유지한 채 다시 미리봐 주세요.</p>:null}
      {error?<div><p ref={errorFocus} role="alert" tabIndex={-1}>{error.message}</p>{error.details.length?<ul className={styles.diagnostics}>{error.details.map((detail,i)=><li key={i}>{detail}</li>)}</ul>:null}</div>:null}
      {!editable?<button className="secondary-button" type="button" disabled={status!=="idle"} onClick={()=>{setPreview(null);setReviewedFile(null);previewFile.current=null;onRequestUnlock();}}>편집 잠금 해제 후 검토</button>:null}
      {preview?<ProjectImportPreview preview={preview}/>:null}
      </div><div className={styles.actions}><button type="button" className="secondary-button" disabled={status==="commit"} onClick={close}>취소</button><button type="button" className="secondary-button" disabled={!file||status!=="idle"} onClick={()=>void refreshProject()}>최신 일정 조회</button><button type="button" className="secondary-button" disabled={!file||status!=="idle"||!editable} onClick={()=>{if(file)void loadPreview(file);}}>다시 미리보기</button><button type="button" className="primary-button" disabled={!canCommitImport(preview,publicId,expectedRevision,reviewedFile===file,editable,status!=="idle")} onClick={()=>void commit()}>{status==="commit"?"추가 중…":"기존 일정에 추가"}</button></div>
    </div></WorkspaceDialog>:null}</>;
}
