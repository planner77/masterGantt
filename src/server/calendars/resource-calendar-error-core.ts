import { ResourceCalendarExceptionConflictError } from "../../domain/scheduling/resource-calendar";
import { PublicApiError } from "../http/api-error-core";

/** Shared HTTP error contract for calendar edits and global membership edits. */
export function resourceCalendarConflictApiError(error:unknown,includeRuleNames=true):PublicApiError|undefined {
  if(!(error instanceof ResourceCalendarExceptionConflictError)) return undefined;
  const {date,layer,resourceId,groupIds,ruleIds,sources}=error.context;
  const code=error.code;
  return new PublicApiError(409,code,"같은 수준의 근무/휴무 날짜 예외가 충돌합니다.",[
    {path:"date",code,message:date},
    {path:"layer",code,message:layer},
    {path:"resourceId",code,message:resourceId||"대상 리소스 없음"},
    ...groupIds.map((id)=>({path:"groupIds",code,message:id})),
    ...ruleIds.map((id)=>({path:"ruleIds",code,message:id})),
    ...sources.map((source)=>({path:`rules.${source.ruleId}`,code,
      message:`${date} · ${includeRuleNames?source.ruleName:source.ruleId} · ${source.dayType} · 대상 ${source.targetId} · 리소스 ${resourceId||"없음"}`})),
  ]);
}
