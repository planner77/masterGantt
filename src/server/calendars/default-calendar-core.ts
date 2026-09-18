import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";
import { getCountryCalendarDataset } from "./country-calendar-data";

export function seedDefaultProjectCalendar(
  database:Database.Database,
  projectId:number,
  now:string,
  year:number,
  generatePublicId:()=>string=randomUUID,
):void {
  const dataset=getCountryCalendarDataset("KR",year);
  if(!dataset) throw new Error(`Default Korean calendar is unavailable for ${year}.`);
  const repo=new WorkCalendarRepository(database);
  const rule=repo.insertRule({
    publicId:generatePublicId(),
    projectId,
    kind:"COUNTRY",
    name:"대한민국 공휴일",
    countryCode:"KR",
    targetType:"PROJECT",
    targetPublicId:null,
    scope:"FULL_PROJECT",
    effectiveFrom:null,
    effectiveTo:null,
    sourceVersion:dataset.descriptor.sourceVersion,
    now,
  });
  for(const entry of dataset.dates) {
    repo.insertDate({
      calendarRuleId:rule.id,
      date:entry.date,
      dayType:entry.dayType,
      name:entry.name,
      sourceKey:entry.sourceKey,
      sourceVersion:dataset.descriptor.sourceVersion,
      now,
    });
  }
}
