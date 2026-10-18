"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LogisticsTypeCatalogItemDto, LogisticsTypeCatalogResponse, LogisticsTypeKind } from "@/contracts/logistics";
import { AdminAuth, adminAuthStyles } from "@/components/admin-auth";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import styles from "./logistics-type-catalog-admin.module.css";

function validCatalog(value:unknown):value is LogisticsTypeCatalogResponse{
  if(!value||typeof value!=="object"||!("data" in value))return false;
  const data=value.data;return !!data&&typeof data==="object"&&"revision" in data&&typeof data.revision==="number"&&Number.isSafeInteger(data.revision)&&
    "equipmentTypes" in data&&Array.isArray(data.equipmentTypes)&&"systemTypes" in data&&Array.isArray(data.systemTypes);
}
function etag(revision:number){return `"${revision}"`;}

export function LogisticsTypeCatalogAdmin(){
  const [authenticated,setAuthenticated]=useState(false);
  const [catalog,setCatalog]=useState<LogisticsTypeCatalogResponse|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("error");
  const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [notice,setNotice]=useState<string|null>(null);
  const [password,setPassword]=useState("");const [kind,setKind]=useState<LogisticsTypeKind>("equipment");const [statusFilter,setStatusFilter]=useState<"all"|"active"|"inactive">("all");
  const [code,setCode]=useState("");const [name,setName]=useState("");const [sortOrder,setSortOrder]=useState(0);
  const [editing,setEditing]=useState<LogisticsTypeCatalogItemDto|null>(null);const [editName,setEditName]=useState("");
  const [passwordOpen,setPasswordOpen]=useState(false);const [newPassword,setNewPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");
  const request=useRef<AbortController|null>(null);const loginRef=useRef<HTMLInputElement|null>(null);const passwordButtonRef=useRef<HTMLButtonElement|null>(null);
  const restoreLoginFocus = useRef(false);
  const pendingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement|null>(null);
  const editButtonRef = useRef<HTMLButtonElement|null>(null);
  useEffect(() => {
    if (busy) panelRef.current?.querySelector<HTMLDialogElement>("dialog[open]")?.focus({ preventScroll: true });
  }, [busy]);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(() => {
    if (!authenticated && !busy && restoreLoginFocus.current) {
      restoreLoginFocus.current = false;
      loginRef.current?.focus();
    }
  }, [authenticated, busy]);

  function begin(){if(pendingRef.current)return null;const c=new AbortController();request.current=c;pendingRef.current=true;setBusy(true);setError(null);setNotice(null);return c;}
  function end(c:AbortController){if(!c.signal.aborted&&request.current===c){pendingRef.current=false;setBusy(false);}}
  function expire(){setPassword("");setNewPassword("");setConfirmPassword("");setPasswordOpen(false);restoreLoginFocus.current=true;setAuthenticated(false);setCatalog(null);setState("error");setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");}
  async function load(c:AbortController){setState("loading");try{const r=await fetch("/api/logistics-catalog/admin/equipment-types",{credentials:"same-origin",cache:"no-store",signal:c.signal});const body:unknown=await r.json().catch(()=>null);if(r.status===401){expire();return false;}if(!r.ok||!validCatalog(body)){setState("error");setError("최신 물류 유형 목록을 불러오지 못했습니다.");return false;}setCatalog(body);setState("ready");return true;}catch{if(!c.signal.aborted){setState("error");setError("물류 유형 카탈로그에 연결할 수 없습니다.");}return false;}}
  async function login(e:FormEvent){e.preventDefault();const c=begin();if(!c)return;const submitted=password;setPassword("");try{const r=await fetch("/api/logistics-catalog/admin-sessions",{method:"POST",credentials:"same-origin",signal:c.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({password:submitted})});if(!r.ok){setError("물류 관리자 인증에 실패했습니다.");return;}setAuthenticated(true);await load(c);}catch{if(!c.signal.aborted)setError("물류 관리자 인증 서버에 연결할 수 없습니다.");}finally{end(c);}}
  async function mutate(url:string,method:"POST"|"PATCH",body:unknown){if(!catalog||state!=="ready")return false;const c=begin();if(!c)return false;try{const r=await fetch(url,{method,credentials:"same-origin",signal:c.signal,headers:{"Content-Type":"application/json","If-Match":etag(catalog.data.revision)},body:JSON.stringify(body)});const value:unknown=await r.json().catch(()=>null);if(r.status===401){expire();return false;}if(r.status===412){if(await load(c))setError("다른 관리 변경이 먼저 저장되어 최신 목록을 다시 불러왔습니다.");return false;}if(!r.ok||!validCatalog(value)){if(r.ok&&!validCatalog(value))setState("error");setError("변경사항을 저장하지 못했습니다. 입력값과 중복 코드를 확인해 주세요.");return false;}setCatalog(value);setState("ready");setNotice("변경사항을 저장했습니다.");return true;}catch{if(!c.signal.aborted){setState("error");setError("변경 결과를 확인할 수 없습니다.");}return false;}finally{end(c);}}
  async function add(e:FormEvent){e.preventDefault();if(!code.trim()||!name.trim())return;const endpoint=kind==="equipment"?"equipment-types":"system-types";if(await mutate(`/api/logistics-catalog/admin/${endpoint}`,"POST",{code:code.trim(),name:name.trim(),sortOrder})){setCode("");setName("");setSortOrder(0);}}
  async function saveEdit(e:FormEvent){e.preventDefault();if(!editing||!editName.trim())return;const endpoint=kind==="equipment"?"equipment-types":"system-types";if(await mutate(`/api/logistics-catalog/admin/${endpoint}/${encodeURIComponent(editing.code)}`,"PATCH",{name:editName.trim()}))setEditing(null);}
  async function toggle(item:LogisticsTypeCatalogItemDto){const endpoint=kind==="equipment"?"equipment-types":"system-types";await mutate(`/api/logistics-catalog/admin/${endpoint}/${encodeURIComponent(item.code)}`,"PATCH",{active:!item.active});}
  function closeEditDialog(){if(pendingRef.current)return;setEditing(null);}
  function closePasswordDialog(){if(pendingRef.current)return;setPasswordOpen(false);setNewPassword("");setConfirmPassword("");}
  async function changePassword(e:FormEvent){e.preventDefault();if(newPassword!==confirmPassword||Array.from(newPassword).length<1||Array.from(newPassword).length>12){setError("새 비밀번호는 1~12자이며 확인 값이 일치해야 합니다.");return;}const c=begin();if(!c)return;try{const r=await fetch("/api/logistics-catalog/admin-password",{method:"PUT",credentials:"same-origin",signal:c.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({newPassword,confirmPassword})});if(r.status===401){expire();return;}if(!r.ok){setError("관리자 비밀번호를 변경하지 못했습니다.");return;}setPasswordOpen(false);setNotice("관리자 비밀번호를 변경했습니다.");}catch{setError("비밀번호 변경 결과를 확인할 수 없습니다.");}finally{setNewPassword("");setConfirmPassword("");end(c);}}
  async function logout(){const c=begin();if(!c)return;try{const r=await fetch("/api/logistics-catalog/admin-sessions",{method:"DELETE",credentials:"same-origin",signal:c.signal});if(!r.ok)setError("서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.");}catch{if(!c.signal.aborted)setError("서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.");}finally{if(!c.signal.aborted){setAuthenticated(false);setCatalog(null);setState("error");setPassword("");setNewPassword("");setConfirmPassword("");end(c);}}}

  if (!authenticated) return <AdminAuth title="관리자 로그인" titleId="logistics-auth-title"
    description="프로젝트 편집 권한과 별도의 글로벌 물류 관리자 권한이 필요합니다.">
    <form className={adminAuthStyles.form} onSubmit={login}>
      {error ? <p id="logistics-login-error" className={adminAuthStyles.error} role="alert">{error}</p> : null}
      <div className={adminAuthStyles.controls}>
        <label className={adminAuthStyles.field}>관리자 비밀번호
          <input ref={loginRef} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}
            aria-describedby={error ? "logistics-login-error" : undefined}/>
        </label>
        <button className={`primary-button ${adminAuthStyles.submit}`} type="submit" disabled={busy||!password}>{busy ? "확인 중…" : "로그인"}</button>
      </div>
    </form>
  </AdminAuth>;
  if(!catalog)return <div ref={panelRef} className={styles.panel} onKeyDownCapture={event=>{
    if(event.key==="Escape"&&pendingRef.current&&event.target instanceof HTMLElement&&event.target.closest("dialog[open]")){
      event.preventDefault();event.stopPropagation();
    }
  }}>{state==="loading"?<p role="status" className={styles.note}>최신 물류 유형 목록을 불러오는 중입니다.</p>:null}{error?<p className={styles.error} role="alert">{error}</p>:null}<button className="secondary-button" disabled={busy} onClick={()=>{const c=begin();if(c)void load(c).finally(()=>end(c));}}>다시 시도</button></div>;

  const items=kind==="equipment"?catalog.data.equipmentTypes:catalog.data.systemTypes;
  const filteredItems=statusFilter==="all"?items:items.filter(item=>statusFilter==="active"?item.active:!item.active);
  const emptyMessage=items.length===0?"등록된 유형이 없습니다.":statusFilter==="active"?"활성 유형이 없습니다.":statusFilter==="inactive"?"비활성 유형이 없습니다.":"등록된 유형이 없습니다.";
  return <div ref={panelRef} className={styles.panel} onKeyDownCapture={event=>{
    if(event.key==="Escape"&&pendingRef.current&&event.target instanceof HTMLElement&&event.target.closest("dialog[open]")){
      event.preventDefault();event.stopPropagation();
    }
  }}>
    <div className={styles.toolbar}><div className={styles.tabs} role="group" aria-label="물류 유형 종류"><button type="button" className={kind==="equipment"?"primary-button":"secondary-button"} aria-pressed={kind==="equipment"} disabled={busy} onClick={()=>setKind("equipment")}>설비 유형</button><button type="button" className={kind==="system"?"primary-button":"secondary-button"} aria-pressed={kind==="system"} disabled={busy} onClick={()=>setKind("system")}>시스템 유형</button></div><div className={styles.actions}><button ref={passwordButtonRef} className="secondary-button" type="button" disabled={busy} onClick={()=>{if(!pendingRef.current)setPasswordOpen(true);}}>관리자 비밀번호 변경</button><button className="secondary-button" type="button" disabled={busy} onClick={()=>{const c=begin();if(c)void load(c).finally(()=>end(c));}}>새로고침</button><button className="secondary-button" type="button" disabled={busy} onClick={()=>void logout()}>로그아웃</button></div></div>
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.note} role="status">{notice}</p>:null}{state!=="ready"?<p className={styles.note}>최신 목록을 확인하기 전에는 변경할 수 없습니다.</p>:null}
    <form className={styles.addRow} onSubmit={add}><label>유형명<input value={name} maxLength={200} onChange={e=>setName(e.target.value)} disabled={busy||state!=="ready"}/></label><label>코드<input value={code} maxLength={64} onChange={e=>setCode(e.target.value)} disabled={busy||state!=="ready"} placeholder="예: shuttle"/></label><label>정렬<input type="number" min={0} value={sortOrder} onChange={e=>setSortOrder(Math.max(0,Number(e.target.value)||0))} disabled={busy||state!=="ready"}/></label><button className={`primary-button ${styles.addButton}`} type="submit" disabled={busy||state!=="ready"||!name.trim()||!code.trim()}>유형 추가</button></form>
    <div className={styles.listTools}><div className={styles.filterGroup} role="group" aria-label="유형 상태 필터"><button type="button" className={statusFilter==="all"?"primary-button":"secondary-button"} aria-pressed={statusFilter==="all"} disabled={busy} onClick={()=>setStatusFilter("all")}>전체</button><button type="button" className={statusFilter==="active"?"primary-button":"secondary-button"} aria-pressed={statusFilter==="active"} disabled={busy} onClick={()=>setStatusFilter("active")}>활성</button><button type="button" className={statusFilter==="inactive"?"primary-button":"secondary-button"} aria-pressed={statusFilter==="inactive"} disabled={busy} onClick={()=>setStatusFilter("inactive")}>비활성</button></div><p className={styles.note} role="status">{filteredItems.length} / {items.length}개</p></div>
    <div className={styles.tableWrap} onFocusCapture={event=>{
      if(!(event.target instanceof HTMLButtonElement)||!event.target.closest("td"))return;
      const owner=event.currentTarget,control=event.target.getBoundingClientRect(),bounds=owner.getBoundingClientRect();
      // Native focus may leave a partially visible button clipped by horizontal overflow.
      const focusSpace=6;
      if(control.left-focusSpace<bounds.left)owner.scrollLeft+=control.left-focusSpace-bounds.left;
      else if(control.right+focusSpace>bounds.right)owner.scrollLeft+=control.right+focusSpace-bounds.right;
    }}><table aria-label={kind==="equipment"?"설비 유형 목록":"시스템 유형 목록"}><colgroup><col/><col style={{width:160}}/><col style={{width:88}}/><col style={{width:104}}/><col style={{width:232}}/></colgroup><thead><tr><th>표시명</th><th>코드</th><th>상태</th><th className={styles.numeric}>사용 건수</th><th>작업</th></tr></thead><tbody>{filteredItems.map(item=><tr key={item.code}><td className={styles.nameCell}>{item.name}</td><td className={styles.codeCell}><code>{item.code}</code></td><td className={styles.statusCell}>{item.active?"활성":"비활성"}</td><td className={styles.numeric}>{item.usageCount}</td><td><div className={styles.rowActions}><button className="secondary-button" type="button" disabled={busy||state!=="ready"} onClick={event=>{if(pendingRef.current)return;editButtonRef.current=event.currentTarget;setEditing(item);setEditName(item.name);}}>이름 수정</button><button className="secondary-button" type="button" disabled={busy||state!=="ready"} onClick={()=>void toggle(item)}>{item.active?"비활성화":"재활성화"}</button></div></td></tr>)}</tbody></table>{filteredItems.length===0?<p className={styles.emptyState}>{emptyMessage}</p>:null}</div>
    {editing?<WorkspaceDialog title="유형 이름 수정" restoreFocusRef={editButtonRef} busy={busy} onClose={closeEditDialog}><form className={styles.dialog} onSubmit={saveEdit}>{error?<p className={styles.error} role="alert">{error}</p>:null}<label>표시명<input ref={input=>{input?.setAttribute("autofocus","");}} disabled={busy} value={editName} maxLength={200} onChange={e=>setEditName(e.target.value)}/></label><div className={styles.dialogActions}>{state!=="ready"?<button className="secondary-button" type="button" disabled={busy} onClick={()=>{const c=begin();if(c)void load(c).finally(()=>end(c));}}>최신 목록 조회</button>:null}<button className="secondary-button" type="button" disabled={busy} onClick={closeEditDialog}>취소</button><button className="primary-button" type="submit" disabled={busy||state!=="ready"||!editName.trim()}>저장</button></div></form></WorkspaceDialog>:null}
    {passwordOpen?<WorkspaceDialog title="관리자 비밀번호 변경" restoreFocusRef={passwordButtonRef} busy={busy} onClose={closePasswordDialog}><form className={styles.dialog} onSubmit={changePassword}>{error?<p className={styles.error} role="alert">{error}</p>:null}<label>새 비밀번호<input ref={input=>{input?.setAttribute("autofocus","");}} disabled={busy} type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>새 비밀번호 확인<input disabled={busy} type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><div className={styles.dialogActions}><button className="secondary-button" type="button" disabled={busy} onClick={closePasswordDialog}>취소</button><button className="primary-button" type="submit" disabled={busy||!newPassword||newPassword!==confirmPassword}>변경</button></div></form></WorkspaceDialog>:null}
  </div>;
}
