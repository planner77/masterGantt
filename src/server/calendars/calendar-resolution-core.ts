import type Database from "better-sqlite3";

import {
  createWorkingCalendar,
  type CalendarDayExceptionInput,
  type WorkingCalendar,
} from "../../domain/scheduling";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";

export class PersistedWorkCalendarConflictError extends Error {}

function projectExceptions(database:Database.Database,projectId:number):Map<string,CalendarDayExceptionInput> {
  const repo=new WorkCalendarRepository(database);
  const rules=repo.listRules(projectId);
  const dates=repo.listDates(projectId);
  const ruleById=new Map(rules.map((rule)=>[rule.id,rule]));
  const result=new Map<string,CalendarDayExceptionInput>();
  for(const date of dates) {
    const rule=ruleById.get(date.calendarRuleId);
    if(!rule || rule.targetType!=="PROJECT") continue;
    const existing=result.get(date.date);
    if(existing && existing.dayType!==date.dayType) throw new PersistedWorkCalendarConflictError();
    result.set(date.date,{date:date.date,dayType:date.dayType,name:date.name});
  }
  return result;
}

export function resolveProjectWorkingCalendar(
  database:Database.Database,
  projectId:number,
):WorkingCalendar {
  return createWorkingCalendar({
    timezone:"Asia/Seoul",
    weekendDays:[6,0],
    exceptions:[...projectExceptions(database,projectId).values()],
  });
}

export function resolveResourceWorkingCalendar(
  database:Database.Database,
  projectId:number,
  resourcePublicId:string,
):WorkingCalendar {
  const effective=projectExceptions(database,projectId);
  const calendars=new WorkCalendarRepository(database);
  const catalog=new ResourceCatalogRepository(database);
  const groups=catalog.listGroups()
    .filter((group)=>group.memberResourceIds.includes(resourcePublicId))
    .map((group)=>group.publicId);
  const groupSet=new Set(groups);
  const rules=calendars.listRules(projectId);
  const dates=calendars.listDates(projectId);
  const ruleById=new Map(rules.map((rule)=>[rule.id,rule]));

  for(const date of dates) {
    const rule=ruleById.get(date.calendarRuleId);
    if(!rule || rule.targetType==="PROJECT") continue;
    const applies=rule.targetType==="RESOURCE"
      ? rule.targetPublicId===resourcePublicId
      : rule.targetPublicId!==null && groupSet.has(rule.targetPublicId);
    if(!applies) continue;
    // Issue #57 custom resource/group calendars add NON_WORKING dates only.
    // They therefore override a project WORKING exception by union semantics.
    if(date.dayType==="NON_WORKING") {
      effective.set(date.date,{date:date.date,dayType:"NON_WORKING",name:date.name});
    }
  }

  return createWorkingCalendar({
    timezone:"Asia/Seoul",
    weekendDays:[6,0],
    exceptions:[...effective.values()],
  });
}
