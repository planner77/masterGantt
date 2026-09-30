import type { WorkCalendarCountryCode, WorkCalendarDayType } from "./work-calendar";

export const COUNTRY_CALENDAR_MANAGED_YEARS = [
  2026, 2027, 2028, 2029, 2030, 2031,
  2032, 2033, 2034, 2035, 2036, 2037,
] as const;

export type CountryCalendarManagedYear = typeof COUNTRY_CALENDAR_MANAGED_YEARS[number];
export type CountryCalendarDatasetStatus = "OFFICIAL" | "UNAVAILABLE" | "SUPERSEDED";
export type CountryCalendarDatasetOrigin = "BUILT_IN" | "OVERRIDE" | "EMPTY";

export interface CountryCalendarAdminDateDto {
  date: string;
  name: string;
  dayType: WorkCalendarDayType;
  sourceKey: string;
}

export interface CountryCalendarAdminDatasetDto {
  countryCode: WorkCalendarCountryCode;
  countryName: string;
  year: number;
  status: CountryCalendarDatasetStatus;
  origin: CountryCalendarDatasetOrigin;
  sourceVersion: string | null;
  sourceUrl: string | null;
  dateCount: number;
  updatedAt: string | null;
}

export interface CountryCalendarAdminResponse {
  data: {
    revision: number;
    dataset: CountryCalendarAdminDatasetDto;
    dates: CountryCalendarAdminDateDto[];
  };
}

export interface CountryCalendarImportSummary {
  additions: number;
  changes: number;
  deletions: number;
  unchanged: number;
}

export interface CountryCalendarImportPreviewResponse {
  data: {
    revision: number;
    dataset: CountryCalendarAdminDatasetDto;
    importDataset: {
      countryCode: WorkCalendarCountryCode;
      year: number;
      status: "OFFICIAL";
      sourceVersion: string;
      sourceUrl: string;
      dateCount: number;
    };
    summary: CountryCalendarImportSummary;
  };
}

export interface CountryCalendarImportEnvelope {
  format: "json" | "csv";
  content: string;
}

export interface CountryCalendarImportDataset {
  countryCode: WorkCalendarCountryCode;
  year: number;
  status: "OFFICIAL";
  sourceVersion: string;
  sourceUrl: string;
  dates: CountryCalendarAdminDateDto[];
}

export interface UpdateCountryCalendarMetadataRequest {
  status?: CountryCalendarDatasetStatus;
  sourceVersion?: string | null;
  sourceUrl?: string | null;
}

export interface CreateCountryCalendarDateRequest {
  date: string;
  name: string;
  dayType: WorkCalendarDayType;
  sourceKey: string;
}

export interface UpdateCountryCalendarDateRequest {
  date?: string;
  name?: string;
  dayType?: WorkCalendarDayType;
  sourceKey?: string;
}
