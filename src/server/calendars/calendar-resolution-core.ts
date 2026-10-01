import type Database from "better-sqlite3";

import type { ProjectCalendarDto } from "../../contracts/projects";
import { resolveResourceCalendar, type ResourceCalendarException } from "../../domain/scheduling/resource-calendar";

import {
  createWorkingCalendar,
  type CalendarDayExceptionInput,
  type WorkingCalendar,
} from "../../domain/scheduling";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";

export class PersistedWorkCalendarConflictError extends Error {}

interface ProjectDateAggregate extends CalendarDayExceptionInput {
  names: string[];
}

function projectDateAggregates(database:Database.Database,projectId:number):Map<string,ProjectDateAggregate> {
  const repo=new WorkCalendarRepository(database);
  const rules=repo.listRules(projectId);
  const dates=repo.listDates(projectId);
  const ruleById=new Map(rules.map((rule)=>[rule.id,rule]));
  const result=new Map<string,ProjectDateAggregate>();
  for(const date of dates) {
    const rule=ruleById.get(date.calendarRuleId);
    if(!rule || rule.targetType!=="PROJECT") continue;
    const existing=result.get(date.date);
    if(existing && existing.dayType!==date.dayType) throw new PersistedWorkCalendarConflictError();
    const names=existing ? [...existing.names] : [];
    const normalizedName=date.name?.trim();
    if(normalizedName && !names.includes(normalizedName)) names.push(normalizedName);
    result.set(date.date,{
      date:date.date,
      dayType:date.dayType,
      // Preserve the legacy single-name projection: repository order previously
      // made the latest persisted source win for a duplicated effective date.
      name:date.name,
      names,
    });
  }
  for(const aggregate of result.values()) aggregate.names.sort((a,b)=>a < b ? -1 : a > b ? 1 : 0);
  return result;
}

function projectExceptions(database:Database.Database,projectId:number):Map<string,CalendarDayExceptionInput> {
  return new Map([...projectDateAggregates(database,projectId)].map(([date,entry])=>[
    date,
    {date:entry.date,dayType:entry.dayType,name:entry.name},
  ]));
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

/** Shared saved-rule adapter for workload and membership candidate validation. */
export function loadResourceCalendarExceptions(
  database:Database.Database,
  projectId:number,
):ResourceCalendarException[] {
  const calendars=new WorkCalendarRepository(database);
  const ruleById=new Map(calendars.listRules(projectId).map((rule)=>[rule.id,rule]));
  return calendars.listDates(projectId).flatMap((date)=>{
    const rule=ruleById.get(date.calendarRuleId);
    if(!rule || rule.targetType==="PROJECT" || rule.targetPublicId===null) return [];
    return [{date:date.date,dayType:date.dayType,name:date.name,
      ruleId:rule.publicId,ruleName:rule.name,targetType:rule.targetType,targetId:rule.targetPublicId}];
  });
}

export function resolveResourceWorkingCalendar(
  database:Database.Database,
  projectId:number,
  resourcePublicId:string,
):WorkingCalendar {
  const groups=new ResourceCatalogRepository(database).listGroups()
    .filter((group)=>group.memberResourceIds.includes(resourcePublicId))
    .map((group)=>group.publicId);
  return resolveResourceCalendar({
    projectCalendar:resolveProjectWorkingCalendar(database,projectId),
    resourceId:resourcePublicId,
    groupIds:groups,
    exceptions:loadResourceCalendarExceptions(database,projectId),
  }).calendar;
}

export function projectCalendarDto(
  database:Database.Database,
  projectId:number,
):ProjectCalendarDto {
  const aggregates=projectDateAggregates(database,projectId);
  const calendar=createWorkingCalendar({
    timezone:"Asia/Seoul",
    weekendDays:[6,0],
    exceptions:[...aggregates.values()].map((entry)=>({
      date:entry.date,
      dayType:entry.dayType,
      name:entry.name,
    })),
  });
  return {
    timezone:"Asia/Seoul",
    weekendDays:[6,0],
    holidays:calendar.holidays.map((holiday)=>({date:holiday.date,name:holiday.name??null})),
    exceptions:calendar.exceptions.map((entry)=>({
      date:entry.date,
      dayType:entry.dayType,
      name:entry.name??null,
      names:[...(aggregates.get(entry.date)?.names ?? [])],
    })),
  };
}
