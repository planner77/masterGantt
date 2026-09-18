import type Database from "better-sqlite3";
import type {
  WorkCalendarCountryCode,
  WorkCalendarDayType,
  WorkCalendarRuleKind,
  WorkCalendarScope,
  WorkCalendarTargetType,
} from "../../contracts/work-calendar";

export interface WorkCalendarRuleRecord {
  id: number;
  publicId: string;
  projectId: number;
  kind: WorkCalendarRuleKind;
  name: string;
  countryCode: WorkCalendarCountryCode | null;
  targetType: WorkCalendarTargetType;
  targetPublicId: string | null;
  scope: WorkCalendarScope;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkCalendarDateRecord {
  id: number;
  calendarRuleId: number;
  date: string;
  dayType: WorkCalendarDayType;
  name: string | null;
  sourceKey: string | null;
  sourceVersion: string | null;
  createdAt: string;
}

type RuleRow = {
  id:number; public_id:string; project_id:number; kind:WorkCalendarRuleKind; name:string;
  country_code:WorkCalendarCountryCode|null; target_type:WorkCalendarTargetType; target_public_id:string|null;
  scope:WorkCalendarScope; effective_from:string|null; effective_to:string|null; source_version:string|null;
  created_at:string; updated_at:string;
};
type DateRow = {
  id:number; calendar_rule_id:number; date:string; day_type:WorkCalendarDayType; name:string|null;
  source_key:string|null; source_version:string|null; created_at:string;
};

function mapRule(row:RuleRow):WorkCalendarRuleRecord {
  return {
    id:row.id, publicId:row.public_id, projectId:row.project_id, kind:row.kind, name:row.name,
    countryCode:row.country_code, targetType:row.target_type, targetPublicId:row.target_public_id,
    scope:row.scope, effectiveFrom:row.effective_from, effectiveTo:row.effective_to,
    sourceVersion:row.source_version, createdAt:row.created_at, updatedAt:row.updated_at,
  };
}
function mapDate(row:DateRow):WorkCalendarDateRecord {
  return {
    id:row.id, calendarRuleId:row.calendar_rule_id, date:row.date, dayType:row.day_type,
    name:row.name, sourceKey:row.source_key, sourceVersion:row.source_version, createdAt:row.created_at,
  };
}

export class WorkCalendarRepository {
  constructor(private readonly database:Database.Database) {}

  listRules(projectId:number):WorkCalendarRuleRecord[] {
    return (this.database.prepare(`
      SELECT * FROM work_calendar_rules
      WHERE project_id=?
      ORDER BY target_type, target_public_id, kind, country_code, effective_from, id
    `).all(projectId) as RuleRow[]).map(mapRule);
  }

  listDates(projectId:number):WorkCalendarDateRecord[] {
    return (this.database.prepare(`
      SELECT d.* FROM work_calendar_dates d
      JOIN work_calendar_rules r ON r.id=d.calendar_rule_id
      WHERE r.project_id=?
      ORDER BY d.date, d.day_type, d.id
    `).all(projectId) as DateRow[]).map(mapDate);
  }

  listDatesForRules(ruleIds:readonly number[]):WorkCalendarDateRecord[] {
    if (ruleIds.length===0) return [];
    const placeholders=ruleIds.map(()=>"?").join(",");
    return (this.database.prepare(`SELECT * FROM work_calendar_dates WHERE calendar_rule_id IN (${placeholders}) ORDER BY date,id`).all(...ruleIds) as DateRow[]).map(mapDate);
  }

  deleteAllRules(projectId:number):void {
    this.database.prepare("DELETE FROM work_calendar_rules WHERE project_id=?").run(projectId);
  }

  insertRule(input:{
    publicId:string; projectId:number; kind:WorkCalendarRuleKind; name:string;
    countryCode:WorkCalendarCountryCode|null; targetType:WorkCalendarTargetType; targetPublicId:string|null;
    scope:WorkCalendarScope; effectiveFrom:string|null; effectiveTo:string|null; sourceVersion:string|null;
    now:string;
  }):WorkCalendarRuleRecord {
    const result=this.database.prepare(`
      INSERT INTO work_calendar_rules(
        public_id,project_id,kind,name,country_code,target_type,target_public_id,scope,
        effective_from,effective_to,source_version,created_at,updated_at
      ) VALUES(
        @publicId,@projectId,@kind,@name,@countryCode,@targetType,@targetPublicId,@scope,
        @effectiveFrom,@effectiveTo,@sourceVersion,@now,@now
      )
    `).run(input);
    const row=this.database.prepare("SELECT * FROM work_calendar_rules WHERE id=?").get(Number(result.lastInsertRowid)) as RuleRow|undefined;
    if(!row) throw new Error("Inserted work calendar rule could not be read back.");
    return mapRule(row);
  }

  insertDate(input:{
    calendarRuleId:number; date:string; dayType:WorkCalendarDayType; name:string|null;
    sourceKey:string|null; sourceVersion:string|null; now:string;
  }):void {
    this.database.prepare(`
      INSERT INTO work_calendar_dates(calendar_rule_id,date,day_type,name,source_key,source_version,created_at)
      VALUES(@calendarRuleId,@date,@dayType,@name,@sourceKey,@sourceVersion,@now)
    `).run(input);
  }
}
