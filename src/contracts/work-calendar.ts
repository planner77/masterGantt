export const WORK_CALENDAR_COUNTRY_CODES = ["KR","CN","VN","PH","TH","MX","US"] as const;
export type WorkCalendarCountryCode = typeof WORK_CALENDAR_COUNTRY_CODES[number];
export type WorkCalendarRuleKind = "COUNTRY" | "CUSTOM";
export type WorkCalendarTargetType = "PROJECT" | "RESOURCE_GROUP" | "RESOURCE";
export type WorkCalendarScope = "FULL_PROJECT" | "DATE_RANGE";
export type WorkCalendarDayType = "NON_WORKING" | "WORKING";

export interface WorkCalendarRuleDto {
  id: string;
  kind: WorkCalendarRuleKind;
  name: string;
  countryCode: WorkCalendarCountryCode | null;
  targetType: WorkCalendarTargetType;
  targetId: string | null;
  scope: WorkCalendarScope;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceVersion: string | null;
}

export interface WorkCalendarDateSourceDto {
  ruleId: string;
  ruleName: string;
  kind: WorkCalendarRuleKind;
  countryCode: WorkCalendarCountryCode | null;
  targetType: WorkCalendarTargetType;
  targetId: string | null;
  sourceVersion: string | null;
}

export interface WorkCalendarDateDto {
  date: string;
  dayType: WorkCalendarDayType;
  name: string | null;
  sources: WorkCalendarDateSourceDto[];
}

export interface WorkCalendarCustomDateDto {
  id: string;
  name: string;
  date: string;
  targetType: WorkCalendarTargetType;
  targetId: string | null;
  dayType: WorkCalendarDayType;
}

export interface ResourceCalendarExceptionEffectDto {
  ruleId: string;
  customDateIndex: number;
  date: string;
  dayType: WorkCalendarDayType;
  targetType: "RESOURCE_GROUP" | "RESOURCE";
  targetId: string;
  effect: "CHANGED" | "NO_EFFECT";
  warningCode: "REDUNDANT_WORKING_EXCEPTION" | "REDUNDANT_NON_WORKING_EXCEPTION" | null;
  affectedResources: Array<{
    resourceId: string;
    resourceName: string;
    beforeDayType: WorkCalendarDayType;
    effectiveDayType: WorkCalendarDayType;
    effect: "CHANGED" | "NO_EFFECT";
    winningLayer: "BASE" | "PROJECT" | "RESOURCE_GROUP" | "RESOURCE";
    winningSources: WorkCalendarDateSourceDto[];
  }>;
}

export interface ProjectWorkCalendarResponse {
  data: {
    projectRevision: number;
    rules: WorkCalendarRuleDto[];
    projectDates: WorkCalendarDateDto[];
    customDates: WorkCalendarCustomDateDto[];
  };
}

export interface CountryCalendarDescriptorDto {
  code: WorkCalendarCountryCode;
  name: string;
  supportedYears: number[];
  sourceVersion: string;
  sourceUrl: string;
}

export interface CountryCalendarListResponse {
  data: { countries: CountryCalendarDescriptorDto[] };
}

export interface ReplaceProjectWorkCalendarRequest {
  countryRules: Array<{
    id?: string;
    countryCode: WorkCalendarCountryCode;
    scope: WorkCalendarScope;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }>;
  customDates: Array<{
    id?: string;
    name: string;
    date: string;
    targetType: WorkCalendarTargetType;
    targetId?: string | null;
    dayType?: WorkCalendarDayType;
  }>;
}

export type CalendarTaskChangeReason = "CALENDAR" | "DEPENDENCY" | "SUMMARY";

export interface CalendarTaskChangeDto {
  taskId: string;
  externalId: string;
  name: string;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
  reasons: CalendarTaskChangeReason[];
  dependencyPredecessorExternalIds: string[];
}

export interface CalendarManualConflictDto {
  taskId: string;
  externalId: string;
  name: string;
  date: string;
  reason: "CALENDAR" | "DEPENDENCY";
  predecessorExternalIds: string[];
}

export interface PreviewProjectWorkCalendarResponse {
  data: {
    projectRevision: number;
    calendar: ProjectWorkCalendarResponse["data"];
    changedTasks: CalendarTaskChangeDto[];
    manualConflicts: CalendarManualConflictDto[];
    resourceExceptionEffects: ResourceCalendarExceptionEffectDto[];
  };
}

export interface ReplaceProjectWorkCalendarResponse extends PreviewProjectWorkCalendarResponse {
  data: PreviewProjectWorkCalendarResponse["data"] & {
    projectRevision: number;
  };
}
