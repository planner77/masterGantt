import type { WorkCalendarCountryCode, WorkCalendarDayType } from "./work-calendar";

export const COUNTRY_CALENDAR_MANAGED_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037] as const;
export const COUNTRY_CALENDAR_IMPORT_LIMIT_BYTES = 1024 * 1024;
export const COUNTRY_CALENDAR_MAX_DATES = 366;
export type CountryCalendarDatasetStatus = "OFFICIAL" | "UNAVAILABLE" | "SUPERSEDED";
export interface CountryCalendarAdminDateDto {
  date: string;
  name: string;
  dayType: WorkCalendarDayType;
  sourceKey: string;
}
export interface CountryCalendarDatasetDto {
  countryCode: WorkCalendarCountryCode;
  countryName: string;
  year: number;
  status: CountryCalendarDatasetStatus;
  origin: "BUILT_IN" | "OVERRIDE" | "EMPTY";
  sourceVersion: string | null;
  sourceUrl: string | null;
  dateCount: number;
  updatedAt: string | null;
}
export interface CountryCalendarAdminResponse {
  data: { revision: number; dataset: CountryCalendarDatasetDto; dates: CountryCalendarAdminDateDto[] };
}
export interface CountryCalendarImportDataset {
  countryCode: WorkCalendarCountryCode;
  year: number;
  status: "OFFICIAL";
  sourceVersion: string;
  sourceUrl: string;
  dates: CountryCalendarAdminDateDto[];
}
export interface CountryCalendarImportEnvelope {
  countryCode: WorkCalendarCountryCode;
  year: number;
  format: "json" | "csv";
  content: string;
}
export interface CountryCalendarImportApplyRequest {
  envelope: CountryCalendarImportEnvelope;
  previewToken: string;
}
export interface CountryCalendarImportPreviewResponse {
  data: {
    revision: number;
    previewToken: string;
    expiresAt: string;
    dataset: CountryCalendarDatasetDto;
    importDataset: Omit<CountryCalendarImportDataset, "dates"> & { dateCount: number };
    summary: { additions: number; changes: number; deletions: number; unchanged: number; metadataChanged: boolean };
    changed: boolean;
  };
}
export type CreateCountryCalendarDateRequest = CountryCalendarAdminDateDto;
export type UpdateCountryCalendarDateRequest = Partial<CountryCalendarAdminDateDto>;
export interface UpdateCountryCalendarMetadataRequest {
  status?: CountryCalendarDatasetStatus;
  sourceVersion?: string | null;
  sourceUrl?: string | null;
}
