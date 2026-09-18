import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  CalendarTaskChangeDto,
  CountryCalendarListResponse,
  PreviewProjectWorkCalendarResponse,
  ProjectWorkCalendarResponse,
  ReplaceProjectWorkCalendarRequest,
  ReplaceProjectWorkCalendarResponse,
  WorkCalendarDateDto,
  WorkCalendarDateSourceDto,
  WorkCalendarRuleDto,
  WorkCalendarTargetType,
} from "../../contracts/work-calendar";
import { WORK_CALENDAR_COUNTRY_CODES } from "../../contracts/work-calendar";
import {
  createWorkingCalendar,
  parseDateOnly,
  recalculateHierarchy,
  scheduleLeaf,
  SchedulingError,
} from "../../domain/scheduling";
import type { ProjectTaskDto } from "../../contracts/projects";
import { ProjectRepository } from "../repositories/project-repository-core";
import { EditSessionRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import {
  WorkCalendarRepository,
  type WorkCalendarDateRecord,
  type WorkCalendarRuleRecord,
} from "../repositories/work-calendar-repository-core";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { getCountryCalendarDataset, listCountryCalendarDescriptors } from "./country-calendar-data";

const MAX_COUNTRY_RULES = 32;
const MAX_CUSTOM_DATES = 2_000;

export class WorkCalendarInvalidInputError extends Error {}
export class WorkCalendarCountryUnavailableError extends Error {
  constructor(readonly countryCode:string, readonly year:number) { super("Country calendar data is unavailable."); }
}
export class WorkCalendarConflictError extends Error {
  constructor(readonly date:string) { super("Conflicting calendar exceptions exist for the same date."); }
}
export class WorkCalendarManualConflictError extends Error {
  constructor(readonly conflicts:PreviewProjectWorkCalendarResponse["data"]["manualConflicts"]) { super("Manual tasks conflict with the proposed calendar."); }
}
export class WorkCalendarRevisionMismatchError extends Error {}
export class WorkCalendarEditSessionInvalidError extends Error {}
export class WorkCalendarScheduleStructureUnsupportedError extends Error {}
export class WorkCalendarProjectNotFoundError extends Error {}

interface CandidateRule {
  dto: WorkCalendarRuleDto;
  dates: Array<{
    date:string;
    dayType:"NON_WORKING"|"WORKING";
    name:string|null;
    sourceKey:string|null;
    sourceVersion:string|null;
  }>;
}

interface PreviewInternal {
  response: PreviewProjectWorkCalendarResponse;
  candidateRules: CandidateRule[];
  afterTasks: ProjectTaskDto[];
}

function isObject(value:unknown):value is Record<string,unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validCountryCode(value:unknown):value is (typeof WORK_CALENDAR_COUNTRY_CODES)[number] {
  return typeof value === "string" && (WORK_CALENDAR_COUNTRY_CODES as readonly string[]).includes(value);
}
function validTargetType(value:unknown):value is WorkCalendarTargetType {
  return value === "PROJECT" || value === "RESOURCE_GROUP" || value === "RESOURCE";
}
function validUuid(value:string):boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function dateYear(date:string):number { return Number(date.slice(0,4)); }
function yearRange(from:string,to:string):number[] {
  const years:number[]=[];
  for(let year=dateYear(from);year<=dateYear(to);year+=1) years.push(year);
  return years;
}
function taskDtos(tasks:readonly TaskRecord[]):ProjectTaskDto[] {
  const externalById=new Map(tasks.map((task)=>[task.id,task.externalId]));
  return tasks.map((task)=>({
    taskId:task.publicId,
    externalId:task.externalId,
    name:task.name,
    description:task.description,
    url:task.url,
    type:task.type,
    scheduleMode:task.scheduleMode,
    requestedStart:task.requestedStart,
    start:task.startDate,
    end:task.endDate,
    duration:task.duration,
    progress:task.progress,
    parentExternalId:task.parentId===null?null:externalById.get(task.parentId)??null,
    siblingOrder:task.sortOrder,
  }));
}

function aggregateProjectDates(
  rules:readonly WorkCalendarRuleDto[],
  dates:readonly {calendarRuleId?:number; ruleId?:string; date:string; dayType:"NON_WORKING"|"WORKING"; name:string|null; sourceVersion:string|null}[],
  internalIdToPublicId:ReadonlyMap<number,string>=new Map(),
):WorkCalendarDateDto[] {
  const ruleById=new Map(rules.map((rule)=>[rule.id,rule]));
  const grouped=new Map<string,WorkCalendarDateDto>();
  for(const entry of dates) {
    const publicRuleId=entry.ruleId ?? (entry.calendarRuleId===undefined?undefined:internalIdToPublicId.get(entry.calendarRuleId));
    if(!publicRuleId) continue;
    const rule=ruleById.get(publicRuleId);
    if(!rule || rule.targetType!=="PROJECT") continue;
    const key=entry.date;
    const existing=grouped.get(key);
    if(existing && existing.dayType!==entry.dayType) throw new WorkCalendarConflictError(entry.date);
    const source:WorkCalendarDateSourceDto={
      ruleId:rule.id, ruleName:rule.name, kind:rule.kind, countryCode:rule.countryCode,
      targetType:rule.targetType, targetId:rule.targetId, sourceVersion:entry.sourceVersion ?? rule.sourceVersion,
    };
    if(existing) {
      existing.sources.push(source);
      if(!existing.name && entry.name) existing.name=entry.name;
    } else {
      grouped.set(key,{date:entry.date,dayType:entry.dayType,name:entry.name,sources:[source]});
    }
  }
  return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function mapRule(record:WorkCalendarRuleRecord):WorkCalendarRuleDto {
  return {
    id:record.publicId,kind:record.kind,name:record.name,countryCode:record.countryCode,
    targetType:record.targetType,targetId:record.targetPublicId,scope:record.scope,
    effectiveFrom:record.effectiveFrom,effectiveTo:record.effectiveTo,sourceVersion:record.sourceVersion,
  };
}

function storedCalendarData(
  revision:number,
  rules:readonly WorkCalendarRuleRecord[],
  dates:readonly WorkCalendarDateRecord[],
):ProjectWorkCalendarResponse["data"] {
  const dtoRules=rules.map(mapRule);
  const internalIdToPublicId=new Map(rules.map((rule)=>[rule.id,rule.publicId]));
  return {
    projectRevision:revision,
    rules:dtoRules,
    projectDates:aggregateProjectDates(dtoRules,dates,internalIdToPublicId),
  };
}

export interface WorkCalendarServiceOptions {
  clock?:()=>Date;
  generatePublicId?:()=>string;
}

export class WorkCalendarService {
  private readonly projects:ProjectRepository;
  private readonly sessions:EditSessionRepository;
  private readonly schedules:ScheduleRepository;
  private readonly resources:ResourceCatalogRepository;
  private readonly calendars:WorkCalendarRepository;
  private readonly clock:()=>Date;
  private readonly generatePublicId:()=>string;

  constructor(private readonly database:Database.Database,options:WorkCalendarServiceOptions={}) {
    this.projects=new ProjectRepository(database);
    this.sessions=new EditSessionRepository(database);
    this.schedules=new ScheduleRepository(database);
    this.resources=new ResourceCatalogRepository(database);
    this.calendars=new WorkCalendarRepository(database);
    this.clock=options.clock??(()=>new Date());
    this.generatePublicId=options.generatePublicId??randomUUID;
  }

  listCountries():CountryCalendarListResponse {
    return {data:{countries:listCountryCalendarDescriptors()}};
  }

  get(projectPublicId:string):ProjectWorkCalendarResponse|undefined {
    const project=this.projects.findByPublicId(projectPublicId);
    if(!project) return undefined;
    const rules=this.calendars.listRules(project.id);
    const dates=this.calendars.listDates(project.id);
    return {data:storedCalendarData(project.revision,rules,dates)};
  }

  private assertAuthorization(authorization:AuthorizedEditSession):void {
    const project=this.projects.findById(authorization.projectId);
    const session=this.sessions.findById(authorization.sessionId);
    const now=this.clock().getTime();
    const expiry=session?Date.parse(session.expiresAt):Number.NaN;
    if(
      !project || !session || session.revokedAt!==null ||
      !session.tokenHash.equals(authorization.tokenHash) ||
      project.publicId!==authorization.projectPublicId ||
      project.authVersion!==authorization.projectAuthVersion ||
      session.authVersion!==project.authVersion ||
      !Number.isFinite(expiry) || expiry<=now
    ) throw new WorkCalendarEditSessionInvalidError();
  }

  private validateTarget(targetType:WorkCalendarTargetType,targetId:string|null):void {
    if(targetType==="PROJECT") {
      if(targetId!==null) throw new WorkCalendarInvalidInputError();
      return;
    }
    if(!targetId || !validUuid(targetId)) throw new WorkCalendarInvalidInputError();
    const exists=targetType==="RESOURCE"
      ? this.resources.findResourceByPublicId(targetId)
      : this.resources.findGroupByPublicId(targetId);
    if(!exists) throw new WorkCalendarInvalidInputError();
  }

  private materialize(
    input:ReplaceProjectWorkCalendarRequest,
    tasks:readonly TaskRecord[],
  ):CandidateRule[] {
    if(!isObject(input) || !Array.isArray(input.countryRules) || !Array.isArray(input.customDates)) {
      throw new WorkCalendarInvalidInputError();
    }
    if(input.countryRules.length>MAX_COUNTRY_RULES || input.customDates.length>MAX_CUSTOM_DATES) {
      throw new WorkCalendarInvalidInputError();
    }
    const generated=new Set<string>();
    const nextId=():string=>{
      for(let attempt=0;attempt<5;attempt+=1) {
        const id=this.generatePublicId();
        if(validUuid(id) && !generated.has(id)) { generated.add(id); return id; }
      }
      throw new Error("Unique calendar rule identifier could not be generated.");
    };

    const taskDates=tasks.flatMap((task)=>[task.startDate,task.endDate,task.requestedStart].filter((value):value is string=>value!==null));
    const fallback=this.clock().toISOString().slice(0,10);
    const projectFrom=taskDates.length?taskDates.reduce((a,b)=>a<b?a:b):fallback;
    const projectTo=taskDates.length?taskDates.reduce((a,b)=>a>b?a:b):fallback;
    const candidates:CandidateRule[]=[];

    for(const raw of input.countryRules) {
      if(!isObject(raw) || !validCountryCode(raw.countryCode) || (raw.scope!=="FULL_PROJECT" && raw.scope!=="DATE_RANGE")) {
        throw new WorkCalendarInvalidInputError();
      }
      let effectiveFrom:string|null=null,effectiveTo:string|null=null;
      if(raw.scope==="DATE_RANGE") {
        if(typeof raw.effectiveFrom!=="string" || typeof raw.effectiveTo!=="string") throw new WorkCalendarInvalidInputError();
        effectiveFrom=parseDateOnly(raw.effectiveFrom,"effectiveFrom");
        effectiveTo=parseDateOnly(raw.effectiveTo,"effectiveTo");
        if(effectiveFrom>effectiveTo) throw new WorkCalendarInvalidInputError();
      }
      const logicalFrom=effectiveFrom??projectFrom;
      const logicalTo=effectiveTo??projectTo;
      const rangeFrom=raw.scope==="FULL_PROJECT" ? `${dateYear(logicalFrom)}-01-01` : logicalFrom;
      const rangeTo=raw.scope==="FULL_PROJECT" ? `${dateYear(logicalTo)}-12-31` : logicalTo;
      const datasets=yearRange(rangeFrom,rangeTo).map((year)=>{
        const dataset=getCountryCalendarDataset(raw.countryCode,year);
        if(!dataset) throw new WorkCalendarCountryUnavailableError(raw.countryCode,year);
        return dataset;
      });
      const sourceVersion=datasets.map((dataset)=>dataset.descriptor.sourceVersion).join("+");
      const name=`${datasets[0].descriptor.name} 공휴일`;
      const id=nextId();
      const materialized=datasets.flatMap((dataset)=>dataset.dates)
        .filter((entry)=>entry.date>=rangeFrom && entry.date<=rangeTo)
        .map((entry)=>({
          date:entry.date,dayType:entry.dayType,name:entry.name,sourceKey:entry.sourceKey,
          sourceVersion:datasetVersion(datasets,entry.date),
        }));
      candidates.push({
        dto:{id,kind:"COUNTRY",name,countryCode:raw.countryCode,targetType:"PROJECT",targetId:null,scope:raw.scope,
          effectiveFrom,effectiveTo,sourceVersion},
        dates:materialized,
      });
    }

    for(const raw of input.customDates) {
      if(!isObject(raw) || typeof raw.name!=="string" || raw.name.trim()!==raw.name || raw.name.length<1 || raw.name.length>200 ||
        typeof raw.date!=="string" || !validTargetType(raw.targetType)) throw new WorkCalendarInvalidInputError();
      const date=parseDateOnly(raw.date,"date");
      const targetId=raw.targetType==="PROJECT"?null:(typeof raw.targetId==="string"?raw.targetId:null);
      this.validateTarget(raw.targetType,targetId);
      const id=nextId();
      candidates.push({
        dto:{id,kind:"CUSTOM",name:raw.name,countryCode:null,targetType:raw.targetType,targetId,scope:"DATE_RANGE",
          effectiveFrom:date,effectiveTo:date,sourceVersion:"custom-v1"},
        dates:[{date,dayType:"NON_WORKING",name:raw.name,sourceKey:"custom",sourceVersion:"custom-v1"}],
      });
    }

    // Country overlaps and project custom dates may union only when their day types agree.
    aggregateProjectDates(
      candidates.map((candidate)=>candidate.dto),
      candidates.flatMap((candidate)=>candidate.dates.map((date)=>({...date,ruleId:candidate.dto.id}))),
    );
    return candidates;
  }

  private previewForProject(
    projectId:number,
    projectRevision:number,
    input:ReplaceProjectWorkCalendarRequest,
  ):PreviewInternal {
    const tasks=this.schedules.listTasks(projectId);
    const links=this.schedules.listLinks(projectId);
    if(links.length>0) throw new WorkCalendarScheduleStructureUnsupportedError();
    const candidateRules=this.materialize(input,tasks);
    const rules=candidateRules.map((candidate)=>candidate.dto);
    const projectDates=aggregateProjectDates(
      rules,
      candidateRules.flatMap((candidate)=>candidate.dates.map((date)=>({...date,ruleId:candidate.dto.id}))),
    );
    const calendar=createWorkingCalendar({
      timezone:"Asia/Seoul",weekendDays:[6,0],
      exceptions:projectDates.map((entry)=>({date:entry.date,dayType:entry.dayType,name:entry.name})),
    });
    const before=taskDtos(tasks);
    const staged=before.map((task)=>({...task}));
    const manualConflicts:PreviewProjectWorkCalendarResponse["data"]["manualConflicts"]=[];
    for(const task of staged) {
      if(task.type==="summary") continue;
      if(task.requestedStart===null) throw new WorkCalendarInvalidInputError();
      try {
        const scheduled=scheduleLeaf({
          type:task.type,requestedStart:task.requestedStart,duration:task.duration,scheduleMode:task.scheduleMode,
        },calendar);
        if(task.scheduleMode==="manual") {
          if(scheduled.start!==task.start || scheduled.end!==task.end) {
            manualConflicts.push({taskId:task.taskId,externalId:task.externalId,name:task.name,date:task.requestedStart});
          }
        } else {
          task.start=scheduled.start;
          task.end=scheduled.end;
        }
      } catch(error) {
        if(task.scheduleMode==="manual" && error instanceof SchedulingError) {
          manualConflicts.push({taskId:task.taskId,externalId:task.externalId,name:task.name,date:task.requestedStart});
          continue;
        }
        throw error;
      }
    }
    const after=manualConflicts.length===0?recalculateHierarchy(staged,calendar):staged;
    const afterById=new Map(after.map((task)=>[task.taskId,task]));
    const changedTasks:CalendarTaskChangeDto[]=[];
    for(const original of before) {
      const changed=afterById.get(original.taskId);
      if(!changed) continue;
      if(original.start!==changed.start || original.end!==changed.end) {
        changedTasks.push({
          taskId:original.taskId,externalId:original.externalId,name:original.name,
          beforeStart:original.start,beforeEnd:original.end,afterStart:changed.start,afterEnd:changed.end,
        });
      }
    }
    return {
      candidateRules,
      afterTasks:[...after],
      response:{data:{
        projectRevision,
        calendar:{projectRevision,rules,projectDates},
        changedTasks,
        manualConflicts,
      }},
    };
  }

  preview(projectPublicId:string,input:ReplaceProjectWorkCalendarRequest):PreviewProjectWorkCalendarResponse {
    const project=this.projects.findByPublicId(projectPublicId);
    if(!project) throw new WorkCalendarProjectNotFoundError();
    return this.previewForProject(project.id,project.revision,input).response;
  }

  replace(
    authorization:AuthorizedEditSession,
    expectedRevision:number,
    input:ReplaceProjectWorkCalendarRequest,
  ):ReplaceProjectWorkCalendarResponse {
    const mutate=this.database.transaction(()=>{
      this.assertAuthorization(authorization);
      const project=this.projects.findById(authorization.projectId);
      if(!project) throw new WorkCalendarProjectNotFoundError();
      if(project.revision!==expectedRevision) throw new WorkCalendarRevisionMismatchError();
      const preview=this.previewForProject(project.id,project.revision,input);
      if(preview.response.data.manualConflicts.length>0) {
        throw new WorkCalendarManualConflictError(preview.response.data.manualConflicts);
      }
      const now=this.clock().toISOString();
      this.calendars.deleteAllRules(project.id);
      for(const candidate of preview.candidateRules) {
        const rule=this.calendars.insertRule({
          publicId:candidate.dto.id,projectId:project.id,kind:candidate.dto.kind,name:candidate.dto.name,
          countryCode:candidate.dto.countryCode,targetType:candidate.dto.targetType,targetPublicId:candidate.dto.targetId,
          scope:candidate.dto.scope,effectiveFrom:candidate.dto.effectiveFrom,effectiveTo:candidate.dto.effectiveTo,
          sourceVersion:candidate.dto.sourceVersion,now,
        });
        for(const date of candidate.dates) this.calendars.insertDate({
          calendarRuleId:rule.id,date:date.date,dayType:date.dayType,name:date.name,
          sourceKey:date.sourceKey,sourceVersion:date.sourceVersion,now,
        });
      }

      const persisted=this.schedules.listTasks(project.id);
      const persistedByPublicId=new Map(persisted.map((task)=>[task.publicId,task]));
      for(const task of preview.afterTasks) {
        const current=persistedByPublicId.get(task.taskId);
        if(!current) throw new WorkCalendarInvalidInputError();
        if(task.type==="summary") {
          if(!this.schedules.updateSummarySchedule(project.id,task.taskId,{
            startDate:task.start,endDate:task.end,duration:task.duration,progress:task.progress,updatedAt:now,
          })) throw new WorkCalendarInvalidInputError();
        } else if(task.scheduleMode==="auto") {
          if(!this.schedules.updateTask(project.id,task.taskId,{
            name:current.name,type:current.type,scheduleMode:current.scheduleMode,requestedStart:current.requestedStart,
            startDate:task.start,endDate:task.end,duration:current.duration,progress:current.progress,updatedAt:now,
          })) throw new WorkCalendarInvalidInputError();
        }
      }
      const updated=this.projects.advanceRevision(project.id,expectedRevision,now);
      if(!updated) throw new WorkCalendarRevisionMismatchError();
      const rules=this.calendars.listRules(project.id);
      const dates=this.calendars.listDates(project.id);
      return {
        data:{
          ...preview.response.data,
          projectRevision:updated.revision,
          calendar:storedCalendarData(updated.revision,rules,dates),
        },
      } satisfies ReplaceProjectWorkCalendarResponse;
    });
    return mutate.immediate();
  }
}

function datasetVersion(
  datasets:readonly ReturnType<typeof getCountryCalendarDataset>[],
  date:string,
):string|null {
  const year=dateYear(date);
  const match=datasets.find((dataset)=>dataset?.descriptor.supportedYears.includes(year));
  return match?.descriptor.sourceVersion??null;
}
