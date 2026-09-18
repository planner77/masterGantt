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

export interface ProjectWorkCalendarResponse {
  data: {
    projectRevision: number;
    rules: WorkCalendarRuleDto[];
    projectDates: WorkCalendarDateDto[];
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
  };
}

export interface ReplaceProjectWorkCalendarResponse extends PreviewProjectWorkCalendarResponse {
  data: PreviewProjectWorkCalendarResponse["data"] & {
    projectRevision: number;
  };
}
