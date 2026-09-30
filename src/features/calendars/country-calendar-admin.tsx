"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";

import type {
  CountryCalendarAdminDateDto,
  CountryCalendarAdminResponse,
  CountryCalendarDatasetStatus,
  CountryCalendarImportPreviewResponse,
} from "@/contracts/country-calendar-admin";
import { COUNTRY_CALENDAR_MANAGED_YEARS } from "@/contracts/country-calendar-admin";
import type { WorkCalendarCountryCode, WorkCalendarDayType } from "@/contracts/work-calendar";
import { WORK_CALENDAR_COUNTRY_CODES } from "@/contracts/work-calendar";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import styles from "./country-calendar-admin.module.css";

const COUNTRY_NAMES: Record<WorkCalendarCountryCode, string> = {
  KR: "대한민국", CN: "중국", VN: "베트남", PH: "필리핀", TH: "태국", MX: "멕시코", US: "미국",
};
const STATUS_LABELS: Record<CountryCalendarDatasetStatus, string> = {
  OFFICIAL: "공식", UNAVAILABLE: "미확보", SUPERSEDED: "대체됨",
};
function revisionTag(revision:number){return `"${revision}"`;}
function weekday(date:string){
  const labels=["일","월","화","수","목","금","토"];
  return labels[new Date(`${date}T00:00:00Z`).getUTCDay()];
}
function validAdmin(value:unknown):value is CountryCalendarAdminResponse{
  if(!value||typeof value!=="object"||!("data" in value))return false;
  const data=value.data;
  return !!data&&typeof data==="object"&&"revision" in data&&typeof data.revision==="number"&&
    "dataset" in data&&!!data.dataset&&typeof data.dataset==="object"&&
    "dates" in data&&Array.isArray(data.dates);
}
function validPreview(value:unknown):value is CountryCalendarImportPreviewResponse{
  if(!value||typeof value!=="object"||!("data" in value))return false;
  const data=value.data;
  return !!data&&typeof data==="object"&&"revision" in data&&typeof data.revision==="number"&&
    "summary" in data&&!!data.summary&&typeof data.summary==="object"&&
    "importDataset" in data&&!!data.importDataset&&typeof data.importDataset==="object";
}

export function CountryCalendarAdmin(){
  const [authenticated,setAuthenticated]=useState(false);
  const [password,setPassword]=useState("");
  const [country,setCountry]=useState<WorkCalendarCountryCode>("KR");
  const [year,setYear]=useState<number>(2026);
  const [snapshot,setSnapshot]=useState<CountryCalendarAdminResponse|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [fileEnvelope,setFileEnvelope]=useState<{format:"json"|"csv";content:string}|null>(null);
  const [preview,setPreview]=useState<CountryCalendarImportPreviewResponse|null>(null);
  const [newDate,setNewDate]=useState("");
  const [newName,setNewName]=useState("");
  const [newDayType,setNewDayType]=useState<WorkCalendarDayType>("NON_WORKING");
  const [newSourceKey,setNewSourceKey]=useState("");
  const [editing,setEditing]=useState<CountryCalendarAdminDateDto|null>(null);
  const [editDate,setEditDate]=useState("");
  const [editName,setEditName]=useState("");
  const [editDayType,setEditDayType]=useState<WorkCalendarDayType>("NON_WORKING");
  const [editSourceKey,setEditSourceKey]=useState("");
  const [deleting,setDeleting]=useState<CountryCalendarAdminDateDto|null>(null);
  const [sourceVersion,setSourceVersion]=useState("");
  const [sourceUrl,setSourceUrl]=useState("");
  const [datasetStatus,setDatasetStatus]=useState<CountryCalendarDatasetStatus>("UNAVAILABLE");
  const request=useRef<AbortController|null>(null);
  const loginRef=useRef<HTMLInputElement|null>(null);
  const editTriggerRef=useRef<HTMLButtonElement|null>(null);
  const deleteTriggerRef=useRef<HTMLButtonElement|null>(null);

  useEffect(()=>()=>request.current?.abort(),[]);
  const locked=busy||!snapshot;
  const dataset=snapshot?.data.dataset;

  function begin(){
    if(busy)return null;
    const controller=new AbortController();
    request.current=controller;
    setBusy(true);setError(null);setNotice(null);
    return controller;
  }
  function end(controller:AbortController){if(!controller.signal.aborted)setBusy(false);}
  function expire(){
    setAuthenticated(false);setSnapshot(null);setPreview(null);
    setError("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
    queueMicrotask(()=>loginRef.current?.focus());
  }
  function syncMetadata(value:CountryCalendarAdminResponse){
    setDatasetStatus(value.data.dataset.status);
    setSourceVersion(value.data.dataset.sourceVersion??"");
    setSourceUrl(value.data.dataset.sourceUrl??"");
  }
  async function load(controller:AbortController, nextCountry=country, nextYear=year){
    try{
      const response=await fetch(`/api/admin/work-calendars/countries/${nextCountry}/years/${nextYear}`,{
        credentials:"same-origin",cache:"no-store",signal:controller.signal,
      });
      const body:unknown=await response.json().catch(()=>null);
      if(response.status===401){expire();return false;}
      if(!response.ok||!validAdmin(body)){setError("국가 캘린더 데이터를 불러오지 못했습니다.");return false;}
      setAuthenticated(true);setSnapshot(body);syncMetadata(body);setPreview(null);return true;
    }catch{if(!controller.signal.aborted)setError("국가 캘린더 서버에 연결할 수 없습니다.");return false;}
  }
  useEffect(()=>{
    const controller=new AbortController();
    request.current=controller;
    const timer=window.setTimeout(()=>{
      void load(controller).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    },0);
    return()=>{
      window.clearTimeout(timer);
      controller.abort();
    };
    // Initial session probe only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function login(event:FormEvent){
    event.preventDefault();const controller=begin();if(!controller)return;
    const submitted=password;setPassword("");
    try{
      const response=await fetch("/api/project-master/admin-sessions",{
        method:"POST",credentials:"same-origin",signal:controller.signal,
        headers:{"Content-Type":"application/json"},body:JSON.stringify({password:submitted}),
      });
      if(!response.ok){setError("관리자 인증에 실패했습니다.");return;}
      setAuthenticated(true);await load(controller);
    }catch{if(!controller.signal.aborted)setError("관리자 인증 서버에 연결할 수 없습니다.");}
    finally{end(controller);}
  }
  async function reload(nextCountry=country,nextYear=year){
    const controller=begin();if(!controller)return;
    try{await load(controller,nextCountry,nextYear);}finally{end(controller);}
  }
  async function mutate(url:string,method:"POST"|"PATCH"|"DELETE",body?:unknown){
    if(!snapshot)return false;
    const controller=begin();if(!controller)return false;
    try{
      const response=await fetch(url,{
        method,credentials:"same-origin",signal:controller.signal,
        headers:{
          ...(body===undefined?{}:{"Content-Type":"application/json"}),
          "If-Match":revisionTag(snapshot.data.revision),
        },
        ...(body===undefined?{}:{body:JSON.stringify(body)}),
      });
      const value:unknown=await response.json().catch(()=>null);
      if(response.status===401){expire();return false;}
      if(response.status===412){await load(controller);setError("다른 관리 변경이 먼저 저장되어 최신 데이터를 다시 불러왔습니다.");return false;}
      if(!response.ok||!validAdmin(value)){
        setError(response.status===409?"현재 dataset 상태와 충돌하여 변경할 수 없습니다. 공식 상태에는 source 정보와 최소 1개 날짜가 필요합니다.":"변경사항을 저장하지 못했습니다. 입력값과 중복 날짜를 확인해 주세요.");
        return false;
      }
      setSnapshot(value);syncMetadata(value);setPreview(null);setNotice("변경사항을 저장했습니다.");return true;
    }catch{if(!controller.signal.aborted)setError("변경 결과를 확인할 수 없습니다.");return false;}
    finally{end(controller);}
  }
  function switchCountry(value:WorkCalendarCountryCode){setCountry(value);setPreview(null);void reload(value,year);}
  function switchYear(value:number){setYear(value);setPreview(null);void reload(country,value);}

  async function saveMetadata(event:FormEvent){
    event.preventDefault();
    await mutate(`/api/admin/work-calendars/countries/${country}/years/${year}`,"PATCH",{
      status:datasetStatus,sourceVersion:sourceVersion.trim()||null,sourceUrl:sourceUrl.trim()||null,
    });
  }
  async function addDate(event:FormEvent){
    event.preventDefault();
    if(!newDate||!newName.trim()||!newSourceKey.trim())return;
    if(await mutate(`/api/admin/work-calendars/countries/${country}/years/${year}/dates`,"POST",{
      date:newDate,name:newName.trim(),dayType:newDayType,sourceKey:newSourceKey.trim(),
    })){
      setNewDate("");setNewName("");setNewDayType("NON_WORKING");setNewSourceKey("");
    }
  }
  function openEdit(item:CountryCalendarAdminDateDto,event:MouseEvent<HTMLButtonElement>){
    editTriggerRef.current=event.currentTarget;setEditing(item);setEditDate(item.date);setEditName(item.name);
    setEditDayType(item.dayType);setEditSourceKey(item.sourceKey);
  }
  async function saveEdit(event:FormEvent){
    event.preventDefault();if(!editing)return;
    if(await mutate(
      `/api/admin/work-calendars/countries/${country}/years/${year}/dates/${encodeURIComponent(editing.date)}`,
      "PATCH",{date:editDate,name:editName.trim(),dayType:editDayType,sourceKey:editSourceKey.trim()},
    ))setEditing(null);
  }
  function openDelete(item:CountryCalendarAdminDateDto,event:MouseEvent<HTMLButtonElement>){
    deleteTriggerRef.current=event.currentTarget;setDeleting(item);
  }
  async function confirmDelete(){
    if(!deleting)return;
    if(await mutate(
      `/api/admin/work-calendars/countries/${country}/years/${year}/dates/${encodeURIComponent(deleting.date)}`,
      "DELETE",
    ))setDeleting(null);
  }
  async function chooseFile(selected:File|null){
    setFile(selected);setFileEnvelope(null);setPreview(null);setError(null);
    if(!selected)return;
    const lower=selected.name.toLowerCase();
    const format=lower.endsWith(".csv")?"csv":lower.endsWith(".json")?"json":null;
    if(!format){setError("JSON 또는 CSV 파일만 업로드할 수 있습니다.");return;}
    if(selected.size>1024*1024){setError("업로드 파일은 1 MiB 이하여야 합니다.");return;}
    try{setFileEnvelope({format,content:await selected.text()});}
    catch{setError("파일을 읽지 못했습니다.");}
  }
  async function previewImport(){
    if(!fileEnvelope)return;
    const controller=begin();if(!controller)return;
    try{
      const response=await fetch("/api/admin/work-calendars/import/preview",{
        method:"POST",credentials:"same-origin",signal:controller.signal,
        headers:{"Content-Type":"application/json"},body:JSON.stringify(fileEnvelope),
      });
      const value:unknown=await response.json().catch(()=>null);
      if(response.status===401){expire();return;}
      if(!response.ok||!validPreview(value)){setError("업로드 검증에 실패했습니다. 국가·연도·날짜·중복·source metadata를 확인해 주세요.");return;}
      if(value.data.importDataset.countryCode!==country||value.data.importDataset.year!==year){setError(`선택한 ${country} ${year}과 파일의 ${value.data.importDataset.countryCode} ${value.data.importDataset.year}이 일치하지 않습니다.`);return;}
      setPreview(value);setNotice("검증이 완료되었습니다. 변경 예상 건수를 확인한 뒤 적용하세요.");
    }catch{if(!controller.signal.aborted)setError("업로드 검증 결과를 확인할 수 없습니다.");}
    finally{end(controller);}
  }
  async function applyImport(){
    if(!preview||!fileEnvelope)return;
    const controller=begin();if(!controller)return;
    try{
      const response=await fetch("/api/admin/work-calendars/import/apply",{
        method:"POST",credentials:"same-origin",signal:controller.signal,
        headers:{"Content-Type":"application/json","If-Match":revisionTag(preview.data.revision)},
        body:JSON.stringify(fileEnvelope),
      });
      const value:unknown=await response.json().catch(()=>null);
      if(response.status===401){expire();return;}
      if(response.status===412){await load(controller);setError("Preview 이후 Catalog가 변경되었습니다. 파일을 다시 검증해 주세요.");return;}
      if(!response.ok||!validAdmin(value)){setError("업로드 적용에 실패했습니다. 일부 데이터는 반영되지 않았습니다.");return;}
      const target=value.data.dataset;
      setCountry(target.countryCode);setYear(target.year);setSnapshot(value);syncMetadata(value);
      setPreview(null);setFile(null);setFileEnvelope(null);setNotice("공식 국가 캘린더 dataset을 적용했습니다.");
    }catch{if(!controller.signal.aborted)setError("업로드 적용 결과를 확인할 수 없습니다.");}
    finally{end(controller);}
  }

  const statusClass=dataset?.status==="OFFICIAL"?styles.official:dataset?.status==="SUPERSEDED"?styles.superseded:styles.unavailable;
  const sortedDates=useMemo(()=>snapshot?.data.dates??[],[snapshot]);

  if(!authenticated&&!snapshot)return <form className={styles.login} onSubmit={login}>
    <h2>관리자 로그인</h2>
    <p>프로젝트 기준정보 관리자 권한으로 국가 캘린더 Catalog를 관리합니다.</p>
    {error?<p className={styles.error} role="alert">{error}</p>:null}
    <label>관리자 비밀번호<input ref={loginRef} type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></label>
    <button className="primary-button" type="submit" disabled={busy||!password}>로그인</button>
  </form>;

  return <div className={styles.panel}>
    <div className={styles.toolbar} aria-label="국가 캘린더 조회 조건">
      <label>국가<select value={country} disabled={busy} onChange={event=>switchCountry(event.target.value as WorkCalendarCountryCode)}>{WORK_CALENDAR_COUNTRY_CODES.map(code=><option key={code} value={code}>{code} · {COUNTRY_NAMES[code]}</option>)}</select></label>
      <label>연도<select value={year} disabled={busy} onChange={event=>switchYear(Number(event.target.value))}>{COUNTRY_CALENDAR_MANAGED_YEARS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <button className="secondary-button" type="button" disabled={busy} onClick={()=>void reload()}>새로고침</button>
    </div>

    {error?<p className={styles.error} role="alert">{error}</p>:null}
    {notice?<p className={styles.notice} role="status">{notice}</p>:null}

    {snapshot&&dataset?<section className={styles.dataset} aria-labelledby="dataset-title">
      <div className={styles.datasetHeader}>
        <div><h2 id="dataset-title">{dataset.countryName} {dataset.year}</h2><p>{dataset.origin==="BUILT_IN"?"내장 기준 데이터":dataset.origin==="OVERRIDE"?"DB 관리 데이터":"등록 데이터 없음"}</p></div>
        <span className={`${styles.status} ${statusClass}`}>{STATUS_LABELS[dataset.status]}</span>
      </div>
      <dl className={styles.facts}>
        <div><dt>데이터 건수</dt><dd>{dataset.dateCount}</dd></div>
        <div><dt>마지막 수정</dt><dd>{dataset.updatedAt?new Date(dataset.updatedAt).toLocaleString("ko-KR"):"내장 데이터"}</dd></div>
        <div><dt>Scheduling</dt><dd>{dataset.status==="OFFICIAL"?"사용 가능":"사용 불가"}</dd></div>
      </dl>
      <form className={styles.metadata} onSubmit={saveMetadata}>
        <label>상태<select value={datasetStatus} disabled={busy} onChange={event=>setDatasetStatus(event.target.value as CountryCalendarDatasetStatus)}><option value="OFFICIAL">공식</option><option value="UNAVAILABLE">미확보</option><option value="SUPERSEDED">대체됨</option></select></label>
        <label>Source version<input value={sourceVersion} maxLength={200} disabled={busy} onChange={event=>setSourceVersion(event.target.value)}/></label>
        <label>Source URL<input type="url" value={sourceUrl} maxLength={2048} disabled={busy} onChange={event=>setSourceUrl(event.target.value)}/></label>
        <button className="primary-button" type="submit" disabled={locked}>메타데이터 저장</button>
      </form>
    </section>:null}

    <section className={styles.importSection} aria-labelledby="import-title">
      <div><h2 id="import-title">파일 Import</h2><p>JSON canonical 또는 CSV 파일을 검증한 뒤 연도 dataset 전체를 원자적으로 교체합니다.</p></div>
      <div className={styles.importControls}>
        <label className={styles.fileLabel}>파일<input type="file" accept=".json,.csv,application/json,text/csv" disabled={busy} onChange={event=>void chooseFile(event.target.files?.[0]??null)}/></label>
        <button className="secondary-button" type="button" disabled={busy||!fileEnvelope} onClick={()=>void previewImport()}>업로드 전 검증</button>
      </div>
      {file?<p className={styles.muted}>{file.name} · {(file.size/1024).toFixed(1)} KiB</p>:null}
      {preview?<div className={styles.preview} role="status">
        <strong>{preview.data.importDataset.countryCode} {preview.data.importDataset.year} · {preview.data.importDataset.dateCount}건</strong>
        <span>추가 {preview.data.summary.additions}</span><span>변경 {preview.data.summary.changes}</span><span>삭제 {preview.data.summary.deletions}</span><span>동일 {preview.data.summary.unchanged}</span>
        <button className="primary-button" type="button" disabled={busy} onClick={()=>void applyImport()}>검증 결과 적용</button>
      </div>:null}
    </section>

    <section className={styles.dateSection} aria-labelledby="dates-title">
      <div className={styles.sectionTitle}><h2 id="dates-title">휴일·보충 근무일</h2><span>{sortedDates.length}건</span></div>
      <form className={styles.addRow} onSubmit={addDate}>
        <label>날짜<input type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={newDate} disabled={locked} onChange={event=>setNewDate(event.target.value)}/></label>
        <label>이름<input value={newName} maxLength={200} disabled={locked} onChange={event=>setNewName(event.target.value)}/></label>
        <label>구분<select value={newDayType} disabled={locked} onChange={event=>setNewDayType(event.target.value as WorkCalendarDayType)}><option value="NON_WORKING">휴일</option><option value="WORKING">보충 근무일</option></select></label>
        <label>sourceKey<input value={newSourceKey} maxLength={120} disabled={locked} onChange={event=>setNewSourceKey(event.target.value)}/></label>
        <button className="primary-button" type="submit" disabled={locked||!newDate||!newName.trim()||!newSourceKey.trim()}>추가</button>
      </form>
      <div className={styles.tableWrap}>
        <table><thead><tr><th>날짜</th><th>요일</th><th>이름</th><th>구분</th><th>sourceKey</th><th>작업</th></tr></thead>
        <tbody>{sortedDates.map(item=><tr key={item.date}>
          <td><time dateTime={item.date}>{item.date}</time></td><td>{weekday(item.date)}</td><td>{item.name}</td>
          <td><span className={item.dayType==="WORKING"?styles.working:styles.nonWorking}>{item.dayType==="WORKING"?"근무":"휴일"}</span></td>
          <td><code>{item.sourceKey}</code></td>
          <td><div className={styles.actions}>
            <button className="secondary-button" type="button" disabled={busy} onClick={event=>openEdit(item,event)}>편집</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={event=>openDelete(item,event)}>삭제</button>
          </div></td>
        </tr>)}</tbody></table>
        {sortedDates.length===0?<p className={styles.empty}>등록된 날짜가 없습니다. 파일 Import 또는 수동 추가 후 source metadata를 확인하세요.</p>:null}
      </div>
    </section>

    {editing?<WorkspaceDialog title="캘린더 날짜 편집" restoreFocusRef={editTriggerRef} busy={busy} onClose={()=>setEditing(null)}>
      <form className={styles.dialog} onSubmit={saveEdit}>
        <label>날짜<input autoFocus type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={editDate} onChange={event=>setEditDate(event.target.value)}/></label>
        <label>이름<input value={editName} maxLength={200} onChange={event=>setEditName(event.target.value)}/></label>
        <label>구분<select value={editDayType} onChange={event=>setEditDayType(event.target.value as WorkCalendarDayType)}><option value="NON_WORKING">휴일</option><option value="WORKING">보충 근무일</option></select></label>
        <label>sourceKey<input value={editSourceKey} maxLength={120} onChange={event=>setEditSourceKey(event.target.value)}/></label>
        <div className={styles.actions}><button className="secondary-button" type="button" onClick={()=>setEditing(null)}>취소</button><button className="primary-button" type="submit" disabled={busy||!editDate||!editName.trim()||!editSourceKey.trim()}>저장</button></div>
      </form>
    </WorkspaceDialog>:null}

    {deleting?<WorkspaceDialog title="캘린더 날짜 삭제" restoreFocusRef={deleteTriggerRef} busy={busy} onClose={()=>setDeleting(null)}>
      <div className={styles.dialog}><p><strong>{deleting.date} {deleting.name}</strong>을 삭제합니다. 기존 Project의 저장된 Calendar는 자동 변경되지 않습니다.</p>
      <div className={styles.actions}><button className="secondary-button" type="button" onClick={()=>setDeleting(null)}>취소</button><button className="primary-button" type="button" disabled={busy} onClick={()=>void confirmDelete()}>삭제</button></div></div>
    </WorkspaceDialog>:null}
  </div>;
}
