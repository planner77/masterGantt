"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CalendarTaskChangeReason,
  CountryCalendarDescriptorDto,
  PreviewProjectWorkCalendarResponse,
  ProjectWorkCalendarResponse,
  ReplaceProjectWorkCalendarRequest,
  WorkCalendarCountryCode,
  WorkCalendarScope,
  WorkCalendarTargetType,
} from "../../contracts/work-calendar";
import type { AssignmentTargetDto, AssignmentTargetsResponse } from "../../contracts/resources";
import styles from "./project-work-calendar-editor.module.css";

interface Props {
  publicId:string;
  revision:number;
  disabled:boolean;
  onSaved:()=>Promise<boolean>;
  onUnauthorized:()=>void;
  onConflict:(body:unknown)=>void;
  notify:(kind:"success"|"error"|"info",message:string,operation:string,serverBody?:unknown)=>void;
}

interface CountryDraft {
  key:string;
  countryCode:WorkCalendarCountryCode;
  scope:WorkCalendarScope;
  effectiveFrom:string;
  effectiveTo:string;
}
interface CustomDraft {
  key:string;
  name:string;
  date:string;
  targetType:WorkCalendarTargetType;
  targetId:string;
}
type CalendarIssue={id:string;label:string;message:string};
const key=()=>crypto.randomUUID();
const reasonLabel=(reason:CalendarTaskChangeReason)=>reason==="CALENDAR"?"캘린더":reason==="DEPENDENCY"?"FS 선행 관계":"상위 요약";
type PreviewOrigin = {publicId:string;revision:number;fingerprint:string};
type PreviewState = {kind:"idle"|"stale"|"pending"|"error";origin?:PreviewOrigin} |
  {kind:"ready";origin:PreviewOrigin;result:PreviewProjectWorkCalendarResponse};
const sameOrigin=(a:PreviewOrigin,b:PreviewOrigin)=>a.publicId===b.publicId && a.revision===b.revision && a.fingerprint===b.fingerprint;

function requestFrom(countryRules:CountryDraft[],customDates:CustomDraft[]):ReplaceProjectWorkCalendarRequest {
  return {
    countryRules:countryRules.map((rule)=>({
      countryCode:rule.countryCode,
      scope:rule.scope,
      effectiveFrom:rule.scope==="DATE_RANGE"?rule.effectiveFrom:null,
      effectiveTo:rule.scope==="DATE_RANGE"?rule.effectiveTo:null,
    })),
    customDates:customDates.map((entry)=>({
      name:entry.name,
      date:entry.date,
      targetType:entry.targetType,
      targetId:entry.targetType==="PROJECT"?null:entry.targetId,
    })),
  };
}
function validCalendar(value:unknown):value is ProjectWorkCalendarResponse {
  if(!value || typeof value!=="object" || !("data" in value)) return false;
  const data=(value as ProjectWorkCalendarResponse).data;
  return !!data && typeof data.projectRevision==="number" && Array.isArray(data.rules) && Array.isArray(data.projectDates);
}
function validCountries(value:unknown):value is {data:{countries:CountryCalendarDescriptorDto[]}} {
  return !!value && typeof value==="object" && "data" in value &&
    Array.isArray((value as {data?:{countries?:unknown}}).data?.countries);
}
function validTargets(value:unknown):value is AssignmentTargetsResponse {
  return !!value && typeof value==="object" && "data" in value &&
    Array.isArray((value as AssignmentTargetsResponse).data?.targets);
}
function validPreview(value:unknown,revision:number):value is PreviewProjectWorkCalendarResponse {
  if(!value || typeof value!=="object" || !("data" in value)) return false;
  const data=(value as Partial<PreviewProjectWorkCalendarResponse>).data;
  return !!data && data.projectRevision===revision && !!data.calendar && data.calendar.projectRevision===revision &&
    Array.isArray(data.calendar.projectDates) &&
    data.calendar.projectDates.every((date)=>typeof date.date==="string" && Array.isArray(date.sources) &&
      date.sources.every((source)=>typeof source.ruleName==="string")) &&
    Array.isArray(data.changedTasks) && data.changedTasks.every((task)=>typeof task.taskId==="string" &&
      typeof task.name==="string" && Array.isArray(task.reasons) && Array.isArray(task.dependencyPredecessorExternalIds)) &&
    Array.isArray(data.manualConflicts) && data.manualConflicts.every((conflict)=>typeof conflict.taskId==="string" &&
      typeof conflict.name==="string" && Array.isArray(conflict.predecessorExternalIds));
}

export function ProjectWorkCalendarEditor({
  publicId,revision,disabled,onSaved,onUnauthorized,onConflict,notify,
}:Props) {
  const [countries,setCountries]=useState<CountryCalendarDescriptorDto[]>([]);
  const [targets,setTargets]=useState<AssignmentTargetDto[]>([]);
  const [countryRules,setCountryRules]=useState<CountryDraft[]>([]);
  const [customDates,setCustomDates]=useState<CustomDraft[]>([]);
  const [previewState,setPreviewState]=useState<PreviewState>({kind:"idle"});
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState<"preview"|"save"|null>(null);
  const requestSequence=useRef(0);
  const latestUserOperation=useRef(0);
  const mounted=useRef(false);
  const previousProject=useRef({publicId,revision});
  const previewButton=useRef<HTMLButtonElement|null>(null);
  const validationSummary=useRef<HTMLDivElement|null>(null);
  const [showValidation,setShowValidation]=useState(false);
  const restorePreviewFocus=useRef<number|null>(null);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;requestSequence.current+=1;restorePreviewFocus.current=null;};
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{
      setLoading(true);
      try {
        const [countryResponse,calendarResponse,resourceResponse,groupResponse]=await Promise.all([
          fetch("/api/work-calendars/countries",{credentials:"same-origin",signal:controller.signal}),
          fetch(`/api/projects/${encodeURIComponent(publicId)}/work-calendar`,{credentials:"same-origin",signal:controller.signal}),
          fetch(`/api/projects/${encodeURIComponent(publicId)}/assignment-targets?kind=resource`,{credentials:"same-origin",signal:controller.signal}),
          fetch(`/api/projects/${encodeURIComponent(publicId)}/assignment-targets?kind=group`,{credentials:"same-origin",signal:controller.signal}),
        ]);
        const [countryBody,calendarBody,resourceBody,groupBody]:unknown[]=await Promise.all([
          countryResponse.json().catch(()=>null),calendarResponse.json().catch(()=>null),
          resourceResponse.json().catch(()=>null),groupResponse.json().catch(()=>null),
        ]);
        if(controller.signal.aborted) return;
        if(!countryResponse.ok || !validCountries(countryBody) || !calendarResponse.ok || !validCalendar(calendarBody)) {
          notify("error","작업 캘린더 설정을 불러오지 못했습니다.","작업 캘린더",calendarBody);
          return;
        }
        setCountries(countryBody.data.countries);
        const calendar=calendarBody.data;
        setCountryRules(calendar.rules.filter((rule)=>rule.kind==="COUNTRY").map((rule)=>({
          key:rule.id,countryCode:rule.countryCode!,scope:rule.scope,
          effectiveFrom:rule.effectiveFrom??"",effectiveTo:rule.effectiveTo??"",
        })));
        setCustomDates(calendar.rules.filter((rule)=>rule.kind==="CUSTOM").map((rule)=>({
          key:rule.id,name:rule.name,date:rule.effectiveFrom??"",
          targetType:rule.targetType,targetId:rule.targetId??"",
        })));
        const loadedTargets:AssignmentTargetDto[]=[];
        if(resourceResponse.ok && validTargets(resourceBody)) loadedTargets.push(...resourceBody.data.targets);
        if(groupResponse.ok && validTargets(groupBody)) loadedTargets.push(...groupBody.data.targets);
        setTargets(loadedTargets);
      } catch {
        if(!controller.signal.aborted) notify("error","네트워크 연결을 확인해 주세요.","작업 캘린더");
      } finally {
        if(!controller.signal.aborted) setLoading(false);
      }
    })();
    return ()=>controller.abort();
  },[publicId,notify]);

  const request=useMemo(()=>requestFrom(countryRules,customDates),[countryRules,customDates]);
  const origin:PreviewOrigin=useMemo(()=>({publicId,revision,fingerprint:JSON.stringify(request)}),[publicId,revision,request]);
  const currentOrigin=useRef(origin);
  useEffect(()=>{currentOrigin.current=origin;},[origin]);
  const preview=previewState.kind==="ready" && sameOrigin(previewState.origin,origin)?previewState.result:null;
  const statusKind=previewState.origin && !sameOrigin(previewState.origin,origin)?"stale":previewState.kind;
  const previewStatus=statusKind==="pending"?"미리보기를 계산하는 중…":
    statusKind==="error"?"미리보기를 계산하지 못했습니다. 입력을 확인하고 다시 계산하세요.":
    statusKind==="ready" && preview?`현재 입력 기준 미리보기 계산 완료. 일정 변경 작업 ${preview.data.changedTasks.length}개, 수동 작업 충돌 ${preview.data.manualConflicts.length}개.`:
    statusKind==="stale"?"입력이 변경되었습니다. 미리보기를 다시 계산하세요.":
    "저장 전에 일정 변경을 확인하려면 미리보기를 계산하세요.";
  useEffect(()=>{
    if(previousProject.current.publicId===publicId && previousProject.current.revision===revision) return;
    previousProject.current={publicId,revision};
    requestSequence.current+=1;
    restorePreviewFocus.current=null;
    setPreviewState({kind:"stale"});
    setWorking(null);
  },[publicId,revision]);
  useEffect(()=>{
    if(working!==null || restorePreviewFocus.current===null) return;
    const operation=restorePreviewFocus.current;
    restorePreviewFocus.current=null;
    if(operation!==latestUserOperation.current || !previewButton.current) return;
    if(document.activeElement===document.body || document.activeElement===previewButton.current) {
      previewButton.current.focus({preventScroll:true});
    }
  },[working]);
  function invalidatePreview() {
    requestSequence.current+=1;
    setPreviewState({kind:"stale"});
  }
  function changeCountryRules(update:(items:CountryDraft[])=>CountryDraft[]) {
    invalidatePreview();
    setCountryRules(update);
  }
  function changeCustomDates(update:(items:CustomDraft[])=>CustomDraft[]) {
    invalidatePreview();
    setCustomDates(update);
  }
  const issues:CalendarIssue[]=[];
  countryRules.forEach((rule,index)=>{
    if(rule.scope!=="DATE_RANGE") return;
    if(!rule.effectiveFrom) issues.push({id:`calendar-rule-${rule.key}-from`,label:`국가 규칙 ${index+1} 시작일`,message:"시작일을 입력해 주세요."});
    if(!rule.effectiveTo) issues.push({id:`calendar-rule-${rule.key}-to`,label:`국가 규칙 ${index+1} 종료일`,message:"종료일을 입력해 주세요."});
    else if(rule.effectiveFrom && rule.effectiveFrom>rule.effectiveTo) issues.push({id:`calendar-rule-${rule.key}-to`,label:`국가 규칙 ${index+1} 종료일`,message:"종료일은 시작일보다 빠를 수 없습니다."});
  });
  customDates.forEach((entry,index)=>{
    if(!entry.name.trim()) issues.push({id:`calendar-date-${entry.key}-name`,label:`휴무일 ${index+1} 이름`,message:"휴무일 이름을 입력해 주세요."});
    if(!entry.date) issues.push({id:`calendar-date-${entry.key}-date`,label:`휴무일 ${index+1} 날짜`,message:"날짜를 입력해 주세요."});
    if(entry.targetType!=="PROJECT" && !entry.targetId) issues.push({id:`calendar-date-${entry.key}-target`,label:`휴무일 ${index+1} 대상`,message:"대상을 선택해 주세요."});
  });
  function invalidSubmission() {
    if(issues.length===0) {setShowValidation(false);return false;}
    setShowValidation(true);
    requestAnimationFrame(()=>validationSummary.current?.focus({preventScroll:true}));
    return true;
  }

  async function previewCalendar() {
    if(disabled || working || invalidSubmission()) return;
    const operation=++requestSequence.current;
    latestUserOperation.current=operation;
    const submittedOrigin=origin;
    const isCurrent=()=>mounted.current && operation===requestSequence.current && sameOrigin(submittedOrigin,currentOrigin.current);
    restorePreviewFocus.current=document.activeElement===previewButton.current?operation:null;
    setPreviewState({kind:"pending",origin:submittedOrigin});
    setWorking("preview");
    try {
      const response=await fetch(`/api/projects/${encodeURIComponent(publicId)}/work-calendar/preview`,{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json","If-Match":`"${revision}"`},
        body:JSON.stringify(request),
      });
      const body:unknown=await response.json().catch(()=>null);
      if(!isCurrent()) return;
      if(response.status===401){onUnauthorized();return;}
      if(response.status===412){onConflict(body);return;}
      if(!response.ok || !validPreview(body,revision)){setPreviewState({kind:"error",origin:submittedOrigin});notify("error","작업 캘린더 미리보기를 계산하지 못했습니다.","작업 캘린더 Preview",body);return;}
      setPreviewState({kind:"ready",origin:submittedOrigin,result:body});
    } catch { if(isCurrent()){setPreviewState({kind:"error",origin:submittedOrigin});notify("error","네트워크 연결을 확인해 주세요.","작업 캘린더 Preview");} }
    finally { if(isCurrent()) setWorking(null); }
  }

  async function saveCalendar() {
    if(disabled || working || invalidSubmission()) return;
    const operation=++requestSequence.current;
    latestUserOperation.current=operation;
    const submittedOrigin=origin;
    const isCurrent=()=>mounted.current && operation===requestSequence.current && sameOrigin(submittedOrigin,currentOrigin.current);
    const isAcceptedSaveCurrent=()=>mounted.current && savedResponseAccepted && requestSequence.current===operation+1 && sameOrigin(submittedOrigin,currentOrigin.current);
    const shouldReportAcceptedSave=()=>mounted.current && currentOrigin.current.publicId===publicId && latestUserOperation.current===operation;
    let savedResponseAccepted=false;
    setWorking("save");
    try {
      const response=await fetch(`/api/projects/${encodeURIComponent(publicId)}/work-calendar`,{
        method:"PUT",credentials:"same-origin",
        headers:{"Content-Type":"application/json","If-Match":`"${revision}"`},
        body:JSON.stringify(request),
      });
      const body:unknown=await response.json().catch(()=>null);
      if(!isCurrent()) return;
      if(response.status===401){onUnauthorized();return;}
      if(response.status===412){onConflict(body);return;}
      if(!response.ok){notify("error","작업 캘린더를 저장하지 못했습니다.","작업 캘린더 저장",body);return;}
      savedResponseAccepted=true;
      invalidatePreview();
      const refreshed=await onSaved();
      if(shouldReportAcceptedSave()) notify(refreshed?"success":"info",refreshed?"작업 캘린더를 저장했습니다.":"저장했지만 최신 일정 재조회가 필요합니다.","작업 캘린더 저장");
    } catch { if((savedResponseAccepted && shouldReportAcceptedSave()) || isCurrent()) notify("error","네트워크 연결을 확인해 주세요.","작업 캘린더 저장"); }
    finally { if(isCurrent() || isAcceptedSaveCurrent()) setWorking(null); }
  }

  if(loading) return <p role="status">작업 캘린더 설정을 불러오는 중…</p>;
  return <div className="project-form compact-form" aria-busy={working!==null||undefined}>
    <div>
      <h3>작업 캘린더</h3>
      <p>프로젝트 일정에는 국가/프로젝트 휴무만 적용하고, 그룹·개인 휴무는 리소스 공수 계산에만 적용합니다.</p>
    </div>
    <fieldset disabled={disabled||working!==null}>
      <legend>국가 공휴일</legend>
      {countryRules.map((rule,index)=><fieldset className={styles.itemFieldset} key={rule.key}>
        <legend>국가 규칙 {index+1}</legend>
        <div className="form-field"><label htmlFor={`country-${rule.key}`}>국가 {index+1}</label>
        <select id={`country-${rule.key}`} value={rule.countryCode} onChange={(event)=>changeCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,countryCode:event.target.value as WorkCalendarCountryCode}:item))}>
          {countries.map((country)=><option key={country.code} value={country.code}>{country.name}</option>)}
        </select></div>
        <label className={styles.field}>적용 범위 <select aria-label={`국가 규칙 ${index+1} 적용 범위`} value={rule.scope} onChange={(event)=>changeCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,scope:event.target.value as WorkCalendarScope}:item))}>
          <option value="FULL_PROJECT">프로젝트 전체 기간</option><option value="DATE_RANGE">기간 지정</option>
        </select></label>
        {rule.scope==="DATE_RANGE"?<div className={styles.dateFields}>
          <label className={styles.field}>시작일 <input id={`calendar-rule-${rule.key}-from`} aria-label={`국가 규칙 ${index+1} 시작일`} aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-rule-${rule.key}-from`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-rule-${rule.key}-from`)?`calendar-rule-${rule.key}-from-error`:undefined} type="date" value={rule.effectiveFrom} onChange={(event)=>changeCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,effectiveFrom:event.target.value}:item))}/>{showValidation?issues.filter((issue)=>issue.id===`calendar-rule-${rule.key}-from`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>
          <label className={styles.field}>종료일 <input id={`calendar-rule-${rule.key}-to`} aria-label={`국가 규칙 ${index+1} 종료일`} aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-rule-${rule.key}-to`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-rule-${rule.key}-to`)?`calendar-rule-${rule.key}-to-error`:undefined} type="date" value={rule.effectiveTo} onChange={(event)=>changeCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,effectiveTo:event.target.value}:item))}/>{showValidation?issues.filter((issue)=>issue.id===`calendar-rule-${rule.key}-to`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>
        </div>:null}
        <button className="secondary-button" type="button" onClick={()=>changeCountryRules((items)=>items.filter((item)=>item.key!==rule.key))}>국가 규칙 삭제 {index+1}</button>
      </fieldset>)}
      <button className="secondary-button" type="button" disabled={countries.length===0} onClick={()=>changeCountryRules((items)=>[...items,{key:key(),countryCode:(countries[0]?.code??"KR"),scope:"FULL_PROJECT",effectiveFrom:"",effectiveTo:""}])}>국가 규칙 추가</button>
    </fieldset>
    <fieldset disabled={disabled||working!==null}>
      <legend>조직·개인·프로젝트 휴무일</legend>
      {customDates.map((entry,index)=><fieldset className={styles.itemFieldset} key={entry.key}>
        <legend>휴무일 항목 {index+1}</legend>
        <label className={styles.field}>휴무일 {index+1} 이름<input id={`calendar-date-${entry.key}-name`} placeholder="휴무 사유" aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-name`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-name`)?`calendar-date-${entry.key}-name-error`:undefined} value={entry.name} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,name:event.target.value}:item))}/>{showValidation?issues.filter((issue)=>issue.id===`calendar-date-${entry.key}-name`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>
        <label className={styles.field}>휴무일 날짜 {index+1}<input id={`calendar-date-${entry.key}-date`} aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-date`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-date`)?`calendar-date-${entry.key}-date-error`:undefined} type="date" value={entry.date} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,date:event.target.value}:item))}/>{showValidation?issues.filter((issue)=>issue.id===`calendar-date-${entry.key}-date`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>
        <label className={styles.field}>휴무 대상 {index+1}<select value={entry.targetType} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,targetType:event.target.value as WorkCalendarTargetType,targetId:""}:item))}>
          <option value="PROJECT">프로젝트 전체</option><option value="RESOURCE_GROUP">리소스 그룹</option><option value="RESOURCE">리소스</option>
        </select></label>
        {entry.targetType!=="PROJECT"?<label className={styles.field}>대상 선택 {index+1}<select id={`calendar-date-${entry.key}-target`} aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-target`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-target`)?`calendar-date-${entry.key}-target-error`:undefined} value={entry.targetId} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,targetId:event.target.value}:item))}>
          <option value="">대상을 선택하세요</option>
          {targets.filter((target)=>target.kind===(entry.targetType==="RESOURCE"?"resource":"group")).map((target)=><option key={target.id} value={target.id}>{target.name}{target.code?` (${target.code})`:""}</option>)}
        </select>{showValidation?issues.filter((issue)=>issue.id===`calendar-date-${entry.key}-target`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>:null}
        <button className="secondary-button" type="button" onClick={()=>changeCustomDates((items)=>items.filter((item)=>item.key!==entry.key))}>휴무일 삭제 {index+1}</button>
      </fieldset>)}
      <button className="secondary-button" type="button" onClick={()=>changeCustomDates((items)=>[...items,{key:key(),name:"",date:"",targetType:"PROJECT",targetId:""}])}>휴무일 추가</button>
    </fieldset>
    {showValidation&&issues.length>0?<div className={styles.validationSummary} role="alert" tabIndex={-1} ref={validationSummary}>
      <strong>작업 캘린더 입력 {issues.length}곳을 확인해 주세요.</strong>
      <ul>{issues.map((issue)=><li key={issue.id}><button type="button" onClick={()=>document.getElementById(issue.id)?.focus()}>{issue.label}: {issue.message}</button></li>)}</ul>
    </div>:null}
    <div>
      <button ref={previewButton} className="secondary-button" disabled={disabled||working!==null} type="button" onClick={()=>void previewCalendar()}>{working==="preview"?"계산 중…":"미리보기 계산"}</button>
      <button className="primary-button" disabled={disabled||working!==null} type="button" onClick={()=>void saveCalendar()}>{working==="save"?"저장 중…":"작업 캘린더 저장"}</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true">{previewStatus}</p>
    {preview?<div>
      {preview.data.changedTasks.length>0?<ul>{preview.data.changedTasks.slice(0,10).map((item)=><li key={item.taskId}>
        {item.name}: {item.beforeStart}~{item.beforeEnd} → {item.afterStart}~{item.afterEnd} · {item.reasons.map(reasonLabel).join(", ")}
        {item.dependencyPredecessorExternalIds.length>0?` (선행: ${item.dependencyPredecessorExternalIds.join(", ")})`:""}
      </li>)}</ul>:null}
      {preview.data.manualConflicts.length>0?<ul>{preview.data.manualConflicts.slice(0,10).map((item)=><li key={item.taskId}>
        {item.name}: {item.date} · {item.reason==="DEPENDENCY"?"FS 선행 관계 충돌":"캘린더 충돌"}
        {item.predecessorExternalIds.length>0?` (선행: ${item.predecessorExternalIds.join(", ")})`:""}
      </li>)}</ul>:null}
      <details><summary>적용 날짜 미리보기 ({preview.data.calendar.projectDates.length}개)</summary>
        <ul>{preview.data.calendar.projectDates.slice(0,40).map((item)=><li key={item.date}>{item.date} · {item.dayType} · {item.sources.map((source)=>source.ruleName).join(", ")}</li>)}</ul>
      </details>
    </div>:null}
  </div>;
}
