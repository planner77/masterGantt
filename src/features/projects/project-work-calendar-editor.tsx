"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  CountryCalendarDescriptorDto,
  PreviewProjectWorkCalendarResponse,
  ProjectWorkCalendarResponse,
  ReplaceProjectWorkCalendarRequest,
  ReplaceProjectWorkCalendarResponse,
  WorkCalendarCountryCode,
  WorkCalendarScope,
  WorkCalendarTargetType,
} from "../../contracts/work-calendar";
import type { AssignmentTargetDto, AssignmentTargetsResponse } from "../../contracts/resources";

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
const key=()=>crypto.randomUUID();

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

export function ProjectWorkCalendarEditor({
  publicId,revision,disabled,onSaved,onUnauthorized,onConflict,notify,
}:Props) {
  const [countries,setCountries]=useState<CountryCalendarDescriptorDto[]>([]);
  const [targets,setTargets]=useState<AssignmentTargetDto[]>([]);
  const [countryRules,setCountryRules]=useState<CountryDraft[]>([]);
  const [customDates,setCustomDates]=useState<CustomDraft[]>([]);
  const [preview,setPreview]=useState<PreviewProjectWorkCalendarResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState<"preview"|"save"|null>(null);

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
  const invalid=countryRules.some((rule)=>rule.scope==="DATE_RANGE" && (!rule.effectiveFrom || !rule.effectiveTo || rule.effectiveFrom>rule.effectiveTo)) ||
    customDates.some((entry)=>!entry.name.trim() || !entry.date || (entry.targetType!=="PROJECT" && !entry.targetId));

  async function previewCalendar() {
    if(disabled || working || invalid) return;
    setWorking("preview");
    try {
      const response=await fetch(`/api/projects/${encodeURIComponent(publicId)}/work-calendar/preview`,{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json","If-Match":`"${revision}"`},
        body:JSON.stringify(request),
      });
      const body:unknown=await response.json().catch(()=>null);
      if(response.status===401){onUnauthorized();return;}
      if(response.status===412){onConflict(body);return;}
      if(!response.ok){notify("error","작업 캘린더 Preview를 계산하지 못했습니다.","작업 캘린더 Preview",body);return;}
      setPreview(body as PreviewProjectWorkCalendarResponse);
    } catch { notify("error","네트워크 연결을 확인해 주세요.","작업 캘린더 Preview"); }
    finally { setWorking(null); }
  }

  async function saveCalendar() {
    if(disabled || working || invalid) return;
    setWorking("save");
    try {
      const response=await fetch(`/api/projects/${encodeURIComponent(publicId)}/work-calendar`,{
        method:"PUT",credentials:"same-origin",
        headers:{"Content-Type":"application/json","If-Match":`"${revision}"`},
        body:JSON.stringify(request),
      });
      const body:unknown=await response.json().catch(()=>null);
      if(response.status===401){onUnauthorized();return;}
      if(response.status===412){onConflict(body);return;}
      if(!response.ok){notify("error","작업 캘린더를 저장하지 못했습니다.","작업 캘린더 저장",body);return;}
      const saved=body as ReplaceProjectWorkCalendarResponse;
      setPreview(saved);
      const refreshed=await onSaved();
      notify(refreshed?"success":"info",refreshed?"작업 캘린더를 저장했습니다.":"저장했지만 최신 일정 재조회가 필요합니다.","작업 캘린더 저장");
    } catch { notify("error","네트워크 연결을 확인해 주세요.","작업 캘린더 저장"); }
    finally { setWorking(null); }
  }

  if(loading) return <p role="status">작업 캘린더 설정을 불러오는 중…</p>;
  return <div className="project-form compact-form" aria-busy={working!==null||undefined}>
    <div>
      <h3>작업 캘린더</h3>
      <p>프로젝트 일정에는 국가/프로젝트 휴무만 적용하고, 그룹·개인 휴무는 리소스 공수 계산에만 적용합니다.</p>
    </div>
    <fieldset disabled={disabled||working!==null}>
      <legend>국가 공휴일</legend>
      {countryRules.map((rule,index)=><div className="form-field" key={rule.key}>
        <label htmlFor={`country-${rule.key}`}>국가 {index+1}</label>
        <select id={`country-${rule.key}`} value={rule.countryCode} onChange={(event)=>setCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,countryCode:event.target.value as WorkCalendarCountryCode}:item))}>
          {countries.map((country)=><option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
        <select aria-label="적용 범위" value={rule.scope} onChange={(event)=>setCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,scope:event.target.value as WorkCalendarScope}:item))}>
          <option value="FULL_PROJECT">프로젝트 전체 기간</option><option value="DATE_RANGE">기간 지정</option>
        </select>
        {rule.scope==="DATE_RANGE"?<div>
          <input aria-label="시작일" type="date" value={rule.effectiveFrom} onChange={(event)=>setCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,effectiveFrom:event.target.value}:item))}/>
          <input aria-label="종료일" type="date" value={rule.effectiveTo} onChange={(event)=>setCountryRules((items)=>items.map((item)=>item.key===rule.key?{...item,effectiveTo:event.target.value}:item))}/>
        </div>:null}
        <button className="secondary-button" type="button" onClick={()=>{setCountryRules((items)=>items.filter((item)=>item.key!==rule.key));setPreview(null);}}>국가 규칙 삭제</button>
      </div>)}
      <button className="secondary-button" type="button" disabled={countries.length===0} onClick={()=>{setCountryRules((items)=>[...items,{key:key(),countryCode:(countries[0]?.code??"KR"),scope:"FULL_PROJECT",effectiveFrom:"",effectiveTo:""}]);setPreview(null);}}>국가 규칙 추가</button>
    </fieldset>
    <fieldset disabled={disabled||working!==null}>
      <legend>조직·개인·프로젝트 휴무일</legend>
      {customDates.map((entry,index)=><div className="form-field" key={entry.key}>
        <label htmlFor={`custom-name-${entry.key}`}>휴무일 {index+1}</label>
        <input id={`custom-name-${entry.key}`} placeholder="휴무 사유" value={entry.name} onChange={(event)=>setCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,name:event.target.value}:item))}/>
        <input aria-label="휴무일 날짜" type="date" value={entry.date} onChange={(event)=>setCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,date:event.target.value}:item))}/>
        <select aria-label="휴무 대상" value={entry.targetType} onChange={(event)=>setCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,targetType:event.target.value as WorkCalendarTargetType,targetId:""}:item))}>
          <option value="PROJECT">프로젝트 전체</option><option value="RESOURCE_GROUP">리소스 그룹</option><option value="RESOURCE">리소스</option>
        </select>
        {entry.targetType!=="PROJECT"?<select aria-label="대상 선택" value={entry.targetId} onChange={(event)=>setCustomDates((items)=>items.map((item)=>item.key===entry.key?{...item,targetId:event.target.value}:item))}>
          <option value="">대상을 선택하세요</option>
          {targets.filter((target)=>target.kind===(entry.targetType==="RESOURCE"?"resource":"group")).map((target)=><option key={target.id} value={target.id}>{target.name}{target.code?` (${target.code})`:""}</option>)}
        </select>:null}
        <button className="secondary-button" type="button" onClick={()=>{setCustomDates((items)=>items.filter((item)=>item.key!==entry.key));setPreview(null);}}>휴무일 삭제</button>
      </div>)}
      <button className="secondary-button" type="button" onClick={()=>{setCustomDates((items)=>[...items,{key:key(),name:"",date:"",targetType:"PROJECT",targetId:""}]);setPreview(null);}}>휴무일 추가</button>
    </fieldset>
    {invalid?<p role="alert">기간, 휴무일 이름/날짜 및 대상을 확인해 주세요.</p>:null}
    <div>
      <button className="secondary-button" disabled={disabled||working!==null||invalid} type="button" onClick={()=>void previewCalendar()}>{working==="preview"?"계산 중…":"변경 Preview"}</button>
      <button className="primary-button" disabled={disabled||working!==null||invalid} type="button" onClick={()=>void saveCalendar()}>{working==="save"?"저장 중…":"작업 캘린더 저장"}</button>
    </div>
    {preview?<div aria-live="polite">
      <p>일정 변경 작업: {preview.data.changedTasks.length}개 / 수동 작업 충돌: {preview.data.manualConflicts.length}개</p>
      {preview.data.manualConflicts.length>0?<ul>{preview.data.manualConflicts.slice(0,10).map((item)=><li key={item.taskId}>{item.name}: {item.date}</li>)}</ul>:null}
      <details><summary>적용 날짜 미리보기 ({preview.data.calendar.projectDates.length}개)</summary>
        <ul>{preview.data.calendar.projectDates.slice(0,40).map((item)=><li key={item.date}>{item.date} · {item.dayType} · {item.sources.map((source)=>source.ruleName).join(", ")}</li>)}</ul>
      </details>
    </div>:null}
  </div>;
}
