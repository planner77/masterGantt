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
  WorkCalendarDayType,
  WorkCalendarTargetType,
} from "../../contracts/work-calendar";
import type { AssignmentTargetDto, AssignmentTargetsResponse } from "../../contracts/resources";
import { createClientLocalId } from "../../lib/client-local-id";
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
  dayType:WorkCalendarDayType;
}
type CalendarIssue={id:string;label:string;message:string};
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
      dayType:entry.dayType,
    })),
  };
}
function validCalendar(value:unknown):value is ProjectWorkCalendarResponse {
  if(!value || typeof value!=="object" || !("data" in value)) return false;
  const data=(value as ProjectWorkCalendarResponse).data;
  return !!data && typeof data.projectRevision==="number" && Array.isArray(data.rules) && Array.isArray(data.projectDates) && Array.isArray(data.customDates) && data.customDates.every((entry)=>
    typeof entry.id==="string" && typeof entry.name==="string" && typeof entry.date==="string" &&
    ["PROJECT","RESOURCE_GROUP","RESOURCE"].includes(entry.targetType) &&
    (entry.dayType==="WORKING" || entry.dayType==="NON_WORKING"));
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
    Array.isArray(data.resourceExceptionEffects) && data.resourceExceptionEffects.every((effect)=>
      typeof effect.date==="string" && typeof effect.targetId==="string" && Array.isArray(effect.affectedResources) &&
      effect.affectedResources.every((resource)=>typeof resource.resourceName==="string" && Array.isArray(resource.winningSources))) &&
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
  const addCustomDateButton=useRef<HTMLButtonElement|null>(null);
  const validationSummary=useRef<HTMLDivElement|null>(null);
  const [showValidation,setShowValidation]=useState(false);
  const [normalizationNotice,setNormalizationNotice]=useState("");
  const [serverConflict,setServerConflict]=useState<string[]|null>(null);
  const conflictSummary=useRef<HTMLDivElement|null>(null);
  const [serverConflictDates,setServerConflictDates]=useState<string[]>([]);
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
        setCustomDates(calendar.customDates.map((entry)=>({
          key:entry.id,name:entry.name,date:entry.date,dayType:entry.dayType,
          targetType:entry.targetType,targetId:entry.targetId??"",
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
    statusKind==="ready" && preview?`현재 입력 기준 미리보기 계산 완료. 일정 변경 작업 ${preview.data.changedTasks.length}개, 수동 작업 충돌 ${preview.data.manualConflicts.length}개. 리소스 예외 적용 ${preview.data.resourceExceptionEffects.filter((effect)=>effect.effect==="CHANGED").length}개, 현재 효과 없음 ${preview.data.resourceExceptionEffects.filter((effect)=>effect.effect==="NO_EFFECT").length}개.`:
    statusKind==="stale"?"입력이 변경되었습니다. 미리보기를 다시 계산하세요.":
    "저장 전에 일정 변경을 확인하려면 미리보기를 계산하세요.";
  useEffect(()=>{
    if(previousProject.current.publicId===publicId && previousProject.current.revision===revision) return;
    previousProject.current={publicId,revision};
    setServerConflict(null);
    setServerConflictDates([]);
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
    setServerConflict(null);
    setServerConflictDates([]);
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
    if(!entry.name.trim()) issues.push({id:`calendar-date-${entry.key}-name`,label:`날짜 예외 ${index+1} 이름`,message:"예외 이름을 입력해 주세요."});
    if(!entry.date) issues.push({id:`calendar-date-${entry.key}-date`,label:`날짜 예외 ${index+1} 날짜`,message:"날짜를 입력해 주세요."});
    if(entry.targetType!=="PROJECT" && !entry.targetId) issues.push({id:`calendar-date-${entry.key}-target`,label:`날짜 예외 ${index+1} 대상`,message:"대상을 선택해 주세요."});
  });
  function invalidSubmission() {
    if(issues.length===0) {setShowValidation(false);return false;}
    setShowValidation(true);
    requestAnimationFrame(()=>validationSummary.current?.focus({preventScroll:true}));
    return true;
  }

  function reportExceptionConflict(body:unknown) {
    if(!body || typeof body!=="object" || !("error" in body)) return false;
    const error=(body as {error?:{code?:string;details?:Array<{path?:string;message?:string}>}}).error;
    if(error?.code!=="RESOURCE_CALENDAR_EXCEPTION_CONFLICT") return false;
    setServerConflictDates(error.details?.filter((detail)=>detail.path==="date").map((detail)=>detail.message??"")??[]);
    const labels:Record<string,string>={date:"날짜",layer:"충돌 단계",resourceId:"영향받는 리소스",groupIds:"충돌 대상 그룹",ruleIds:"충돌 규칙"};
    setServerConflict(error.details?.filter((detail)=>detail.path!=="ruleIds" || !error.details?.some((item)=>item.path?.startsWith("rules."))).map((detail)=>{
      let message=detail.message??"날짜와 대상 규칙을 확인하세요.";
      for(const target of targets) message=message.replaceAll(target.id,target.name);
      for(const entry of customDates) message=message.replaceAll(entry.key,entry.name||"이름 없는 예외");
      message=message.replaceAll("RESOURCE_GROUP","리소스 그룹").replaceAll("NON_WORKING","휴무일").replaceAll("WORKING","근무일");
      return `${labels[detail.path??""]??(detail.path?.startsWith("rules.")?"규칙 상세":"충돌 정보")}: ${message}`;
    })??["날짜와 대상 규칙을 확인하세요."]);
    requestAnimationFrame(()=>conflictSummary.current?.focus({preventScroll:true}));
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
      if(response.status===409 && reportExceptionConflict(body)){setPreviewState({kind:"error",origin:submittedOrigin});return;}
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
      if(response.status===409 && reportExceptionConflict(body)){setPreviewState({kind:"error",origin:submittedOrigin});return;}
      if(!response.ok){notify("error","작업 캘린더를 저장하지 못했습니다.","작업 캘린더 저장",body);return;}
      savedResponseAccepted=true;
      invalidatePreview();
      let calendarRefreshed=false;
      try {
        const canonicalResponse=await fetch(`/api/projects/${encodeURIComponent(publicId)}/work-calendar`,{credentials:"same-origin"});
        const canonical:unknown=await canonicalResponse.json().catch(()=>null);
        if(isAcceptedSaveCurrent() && canonicalResponse.status===401){onUnauthorized();return;}
        const savedRevision=body && typeof body==="object" && "data" in body?(body as Partial<PreviewProjectWorkCalendarResponse>).data?.projectRevision:undefined;
        if(isAcceptedSaveCurrent() && canonicalResponse.ok && validCalendar(canonical) && typeof savedRevision==="number" && validPreview(body,savedRevision) && canonical.data.projectRevision===savedRevision) {
          setCountryRules(canonical.data.rules.filter((rule)=>rule.kind==="COUNTRY").map((rule)=>({key:rule.id,countryCode:rule.countryCode!,scope:rule.scope,effectiveFrom:rule.effectiveFrom??"",effectiveTo:rule.effectiveTo??""})));
          setCustomDates(canonical.data.customDates.map((entry)=>({key:entry.id,name:entry.name,date:entry.date,targetType:entry.targetType,targetId:entry.targetId??"",dayType:entry.dayType})));
          calendarRefreshed=true;
        }
      } catch { /* Keep the draft when the canonical calendar cannot be refreshed. */ }
      const refreshed=await onSaved();
      if(shouldReportAcceptedSave()) notify(refreshed&&calendarRefreshed?"success":"info",refreshed&&calendarRefreshed?"작업 캘린더를 저장했습니다.":"저장했지만 최신 캘린더·일정 재조회가 필요합니다.","작업 캘린더 저장");
    } catch { if((savedResponseAccepted && shouldReportAcceptedSave()) || isCurrent()) notify("error","네트워크 연결을 확인해 주세요.","작업 캘린더 저장"); }
    finally { if(isCurrent() || (savedResponseAccepted && shouldReportAcceptedSave())) setWorking(null); }
  }

  if(loading) return <p role="status">작업 캘린더 설정을 불러오는 중…</p>;
  return <div className="project-form compact-form" aria-busy={working!==null||undefined}>
    <div>
      <h3>작업 캘린더</h3>
      <p>프로젝트 일정에는 국가·프로젝트 휴무를 적용합니다. 그룹·리소스의 날짜 예외는 리소스 공수 계산에 적용합니다.</p>
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
        <div className={styles.actionsRow}>
          <button className="secondary-button" type="button" onClick={()=>changeCountryRules((items)=>items.filter((item)=>item.key!==rule.key))}>국가 규칙 삭제 {index+1}</button>
        </div>
      </fieldset>)}
      <button className="secondary-button" type="button" disabled={countries.length===0} onClick={()=>changeCountryRules((items)=>[...items,{key:createClientLocalId(),countryCode:(countries[0]?.code??"KR"),scope:"FULL_PROJECT",effectiveFrom:"",effectiveTo:""}])}>국가 규칙 추가</button>
    </fieldset>
    <fieldset disabled={disabled||working!==null}>
      <legend>사용자 날짜 예외</legend>
      <p className={styles.fullRow}>프로젝트 전체는 휴무일만 지정합니다. 그룹·리소스에는 휴무일 또는 근무일을 지정할 수 있습니다.</p>
      {customDates.length===0?<p>등록된 사용자 날짜 예외가 없습니다. 날짜 예외 추가로 시작하세요.</p>:null}
      {customDates.map((entry,index)=><fieldset className={styles.itemFieldset} key={entry.key}>
        <legend>날짜 예외 항목 {index+1}</legend>
        <label className={styles.field}>날짜 예외 {index+1} 이름<input id={`calendar-date-${entry.key}-name`} placeholder="예외 사유" aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-name`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-name`)?`calendar-date-${entry.key}-name-error`:undefined} value={entry.name} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,name:event.target.value}:item))}/>{showValidation?issues.filter((issue)=>issue.id===`calendar-date-${entry.key}-name`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>
        <label className={styles.field}>예외 날짜 {index+1}<input id={`calendar-date-${entry.key}-date`} aria-invalid={(showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-date`))||serverConflictDates.includes(entry.date)} aria-describedby={[showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-date`)?`calendar-date-${entry.key}-date-error`:null,serverConflictDates.includes(entry.date)?"calendar-exception-conflict":null].filter(Boolean).join(" ")||undefined} type="date" value={entry.date} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,date:event.target.value}:item))}/>{showValidation?issues.filter((issue)=>issue.id===`calendar-date-${entry.key}-date`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>
        <label className={styles.field}>예외 대상 {index+1}<select value={entry.targetType} onChange={(event)=>{
          const targetType=event.target.value as WorkCalendarTargetType;
          setNormalizationNotice(targetType==="PROJECT" && entry.dayType==="WORKING"?"프로젝트 전체에는 근무일 예외를 지정할 수 없어 휴무일로 변경했습니다.":"");
          changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,targetType,targetId:"",dayType:targetType==="PROJECT"?"NON_WORKING":item.dayType}:item));
        }}>
          <option value="PROJECT">프로젝트 전체</option><option value="RESOURCE_GROUP">리소스 그룹</option><option value="RESOURCE">리소스</option>
        </select></label>
        <label className={styles.field}>일 유형 {index+1}<select value={entry.dayType} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,dayType:event.target.value as WorkCalendarDayType}:item))}>
          <option value="NON_WORKING">휴무일</option>{entry.targetType!=="PROJECT"?<option value="WORKING">근무일</option>:null}
        </select></label>
        {entry.targetType!=="PROJECT"?<label className={styles.field}>대상 선택 {index+1}<select id={`calendar-date-${entry.key}-target`} aria-invalid={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-target`)} aria-describedby={showValidation&&issues.some((issue)=>issue.id===`calendar-date-${entry.key}-target`)?`calendar-date-${entry.key}-target-error`:undefined} value={entry.targetId} onChange={(event)=>changeCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,targetId:event.target.value}:item))}>
          <option value="">대상을 선택하세요</option>
          {targets.filter((target)=>target.kind===(entry.targetType==="RESOURCE"?"resource":"group")).map((target)=><option key={target.id} value={target.id}>{target.name}{target.code?` (${target.code})`:""}</option>)}
        </select>{showValidation?issues.filter((issue)=>issue.id===`calendar-date-${entry.key}-target`).map((issue)=><span className={styles.fieldError} id={`${issue.id}-error`} key={issue.id}>{issue.message}</span>):null}</label>:null}
        <div className={styles.actionsRow}>
          <button className="secondary-button" type="button" onClick={()=>{
            changeCustomDates((items)=>items.filter((item)=>item.key!==entry.key));
            const next=customDates[index+1]??customDates[index-1];
            requestAnimationFrame(()=>{if(next) document.getElementById(`calendar-date-${next.key}-name`)?.focus();else addCustomDateButton.current?.focus();});
          }}>날짜 예외 삭제 {index+1}</button>
        </div>
      </fieldset>)}
      <button ref={addCustomDateButton} className="secondary-button" type="button" onClick={()=>changeCustomDates((items)=>[...items,{key:createClientLocalId(),name:"",date:"",targetType:"PROJECT",targetId:"",dayType:"NON_WORKING"}])}>날짜 예외 추가</button>
    </fieldset>
    <p role="status" aria-live="polite">{normalizationNotice}</p>
    {serverConflict?<div id="calendar-exception-conflict" className={styles.validationSummary} role="alert" tabIndex={-1} ref={conflictSummary}>
      <strong>같은 날짜의 리소스 캘린더 예외가 충돌합니다.</strong>
      <ul>{serverConflict.map((message,index)=><li key={index}>{message}</li>)}</ul>
      <p>날짜·대상·규칙과 영향받는 리소스를 확인하고 다시 계산하거나 저장하세요.</p>
      {customDates.map((entry,index)=><button key={entry.key} type="button" onClick={()=>document.getElementById(`calendar-date-${entry.key}-date`)?.focus()}>날짜 예외 {index+1} 수정 · {entry.date} · {entry.name}</button>)}
    </div>:null}
    {showValidation&&issues.length>0?<div className={styles.validationSummary} role="alert" tabIndex={-1} ref={validationSummary}>
      <strong>작업 캘린더 입력 {issues.length}곳을 확인해 주세요.</strong>
      <ul>{issues.map((issue)=><li key={issue.id}><button type="button" onClick={()=>document.getElementById(issue.id)?.focus()}>{issue.label}: {issue.message}</button></li>)}</ul>
    </div>:null}
    <div>
      <button ref={previewButton} className="secondary-button" disabled={disabled||working!==null} type="button" onClick={()=>void previewCalendar()}>{working==="preview"?"계산 중…":"미리보기 계산"}</button>
      <button className="primary-button" disabled={disabled||working!==null||serverConflict!==null} type="button" onClick={()=>void saveCalendar()}>{working==="save"?"저장 중…":"작업 캘린더 저장"}</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true">{previewStatus}</p>
    {preview?<div>
      <h4>프로젝트 일정 영향</h4>
      <p>일정 변경 작업 {preview.data.changedTasks.length}개 · 수동 작업 충돌 {preview.data.manualConflicts.length}개</p>
      {preview.data.changedTasks.length>0?<ul>{preview.data.changedTasks.slice(0,10).map((item)=><li key={item.taskId}>
        {item.name}: {item.beforeStart}~{item.beforeEnd} → {item.afterStart}~{item.afterEnd} · {item.reasons.map(reasonLabel).join(", ")}
        {item.dependencyPredecessorExternalIds.length>0?` (선행: ${item.dependencyPredecessorExternalIds.join(", ")})`:""}
      </li>)}</ul>:null}
      {preview.data.manualConflicts.length>0?<ul>{preview.data.manualConflicts.slice(0,10).map((item)=><li key={item.taskId}>
        {item.name}: {item.date} · {item.reason==="DEPENDENCY"?"FS 선행 관계 충돌":"캘린더 충돌"}
        {item.predecessorExternalIds.length>0?` (선행: ${item.predecessorExternalIds.join(", ")})`:""}
      </li>)}</ul>:null}
      <h4>리소스 날짜 예외 영향</h4>
      <p>효과는 각 예외의 상위 캘린더 대비 변경입니다. 리소스별 최종 일 유형에는 더 높은 우선순위의 예외도 반영합니다.</p>
      {preview.data.resourceExceptionEffects.length===0?<p>그룹·리소스 날짜 예외가 없습니다.</p>:<ul>
        {preview.data.resourceExceptionEffects.map((effect)=><li key={`${effect.customDateIndex}-${effect.date}`}>
          <strong>{effect.date} · {effect.targetType==="RESOURCE"?"리소스":"리소스 그룹"} {targets.find((target)=>target.id===effect.targetId)?.name??effect.targetId} · {effect.dayType==="WORKING"?"근무일":"휴무일"} · {effect.effect==="CHANGED"?"적용됨":"현재 효과 없음"}</strong>
          {effect.effect==="NO_EFFECT"?<p className={styles.effectWarning}>{effect.affectedResources.length===0?"대상 리소스가 없습니다.":"상위 캘린더와 같은 일 유형입니다."} 저장할 수 있으며, 상위 캘린더나 그룹 구성원이 바뀌면 효과가 생길 수 있습니다.</p>:null}
          <details><summary>리소스별 최종 적용 확인 ({effect.affectedResources.length}명)</summary>
          <ul>{effect.affectedResources.map((resource)=><li key={resource.resourceId}>
            {resource.resourceName}: 예외 효과 {resource.effect==="CHANGED"?"적용됨":"현재 효과 없음"} · 상위 {resource.beforeDayType==="WORKING"?"근무일":"휴무일"} · 최종 {resource.effectiveDayType==="WORKING"?"근무일":"휴무일"} · 최종 적용 {resource.winningLayer==="RESOURCE"?"리소스":resource.winningLayer==="RESOURCE_GROUP"?"리소스 그룹":resource.winningLayer==="PROJECT"?"프로젝트":"기본 캘린더"}
            {resource.winningSources.length>0?` · 근거 ${resource.winningSources.map((source)=>source.ruleName).join(", ")}`:""}
          </li>)}</ul></details>
        </li>)}
      </ul>}

      <details><summary>적용 날짜 미리보기 ({preview.data.calendar.projectDates.length}개)</summary>
        <ul>{preview.data.calendar.projectDates.slice(0,40).map((item)=><li key={item.date}>{item.date} · {item.dayType==="WORKING"?"근무일":"휴무일"} · {item.sources.map((source)=>source.ruleName).join(", ")}</li>)}</ul>
      </details>
    </div>:null}
  </div>;
}
