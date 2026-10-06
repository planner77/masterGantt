import type Database from "better-sqlite3";

import type { CountryCalendarDatasetStatus } from "../../contracts/country-calendar-admin";
import type { WorkCalendarCountryCode, WorkCalendarDayType } from "../../contracts/work-calendar";

export interface CountryCalendarDatasetRecord {
  id: number;
  countryCode: WorkCalendarCountryCode;
  year: number;
  status: CountryCalendarDatasetStatus;
  sourceVersion: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}

export interface CountryCalendarDateRecord {
  date: string;
  name: string;
  dayType: WorkCalendarDayType;
  sourceKey: string;
}

interface DatasetRow {
  id: number;
  country_code: WorkCalendarCountryCode;
  calendar_year: number;
  status: CountryCalendarDatasetStatus;
  source_version: string | null;
  source_url: string | null;
  updated_at: string;
}

interface DateRow {
  holiday_date: string;
  name: string;
  day_type: WorkCalendarDayType;
  source_key: string;
}

function mapDataset(row: DatasetRow): CountryCalendarDatasetRecord {
  return {
    id: row.id,
    countryCode: row.country_code,
    year: row.calendar_year,
    status: row.status,
    sourceVersion: row.source_version,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
  };
}

function mapDate(row: DateRow): CountryCalendarDateRecord {
  return { date: row.holiday_date, name: row.name, dayType: row.day_type, sourceKey: row.source_key };
}

export class CountryCalendarRepository {
  constructor(private readonly database: Database.Database) {}

  transactionImmediate<T>(operation: () => T): T {
    return this.database.transaction(operation).immediate();
  }

  getRevision(): number {
    const row = this.database.prepare("SELECT revision FROM country_calendar_catalog_state WHERE id = 1").get() as { revision: number } | undefined;
    if (!row) throw new Error("Country calendar catalog state is missing.");
    return row.revision;
  }

  advanceRevision(expectedRevision: number, updatedAt: string): boolean {
    return this.database.prepare("UPDATE country_calendar_catalog_state SET revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?").run(updatedAt, expectedRevision).changes === 1;
  }

  findDataset(code: WorkCalendarCountryCode, year: number): CountryCalendarDatasetRecord | undefined {
    const row = this.database.prepare("SELECT id, country_code, calendar_year, status, source_version, source_url, updated_at FROM country_calendar_datasets WHERE country_code = ? AND calendar_year = ?").get(code, year) as DatasetRow | undefined;
    return row ? mapDataset(row) : undefined;
  }

  insertDataset(input: {
    countryCode: WorkCalendarCountryCode;
    year: number;
    status: CountryCalendarDatasetStatus;
    sourceVersion: string | null;
    sourceUrl: string | null;
    now: string;
  }): CountryCalendarDatasetRecord {
    const result = this.database.prepare("INSERT INTO country_calendar_datasets (country_code, calendar_year, status, source_version, source_url, updated_at) VALUES (@countryCode, @year, @status, @sourceVersion, @sourceUrl, @now)").run(input);
    const row = this.database.prepare("SELECT id, country_code, calendar_year, status, source_version, source_url, updated_at FROM country_calendar_datasets WHERE id = ?").get(Number(result.lastInsertRowid)) as DatasetRow | undefined;
    if (!row) throw new Error("Inserted country calendar dataset could not be read back.");
    return mapDataset(row);
  }

  upsertOfficialDataset(input: {
    countryCode: WorkCalendarCountryCode;
    year: number;
    sourceVersion: string;
    sourceUrl: string;
    now: string;
  }): CountryCalendarDatasetRecord {
    this.database.prepare("INSERT INTO country_calendar_datasets (country_code, calendar_year, status, source_version, source_url, updated_at) VALUES (@countryCode, @year, 'OFFICIAL', @sourceVersion, @sourceUrl, @now) ON CONFLICT(country_code, calendar_year) DO UPDATE SET status = 'OFFICIAL', source_version = excluded.source_version, source_url = excluded.source_url, updated_at = excluded.updated_at").run(input);
    const row = this.findDataset(input.countryCode, input.year);
    if (!row) throw new Error("Upserted country calendar dataset could not be read back.");
    return row;
  }

  updateDatasetMetadata(id: number, input: {
    status: CountryCalendarDatasetStatus;
    sourceVersion: string | null;
    sourceUrl: string | null;
    now: string;
  }): void {
    this.database.prepare("UPDATE country_calendar_datasets SET status = @status, source_version = @sourceVersion, source_url = @sourceUrl, updated_at = @now WHERE id = @id").run({ id, ...input });
  }

  invalidateDatasetProvenance(id: number, now: string): void {
    this.database.prepare("UPDATE country_calendar_datasets SET status = 'UNAVAILABLE', source_version = NULL, source_url = NULL, updated_at = ? WHERE id = ?").run(now, id);
  }

  listDates(datasetId: number): CountryCalendarDateRecord[] {
    return (this.database.prepare("SELECT holiday_date, name, day_type, source_key FROM country_calendar_dates WHERE dataset_id = ? ORDER BY holiday_date").all(datasetId) as DateRow[]).map(mapDate);
  }

  findDate(datasetId: number, date: string): CountryCalendarDateRecord | undefined {
    const row = this.database.prepare("SELECT holiday_date, name, day_type, source_key FROM country_calendar_dates WHERE dataset_id = ? AND holiday_date = ?").get(datasetId, date) as DateRow | undefined;
    return row ? mapDate(row) : undefined;
  }

  insertDate(datasetId: number, input: CountryCalendarDateRecord, now: string): void {
    this.database.prepare("INSERT INTO country_calendar_dates (dataset_id, holiday_date, name, day_type, source_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(datasetId, input.date, input.name, input.dayType, input.sourceKey, now, now);
  }

  updateDate(datasetId: number, originalDate: string, input: CountryCalendarDateRecord, now: string): void {
    this.database.prepare("UPDATE country_calendar_dates SET holiday_date = ?, name = ?, day_type = ?, source_key = ?, updated_at = ? WHERE dataset_id = ? AND holiday_date = ?").run(input.date, input.name, input.dayType, input.sourceKey, now, datasetId, originalDate);
  }

  deleteDate(datasetId: number, date: string): boolean {
    return this.database.prepare("DELETE FROM country_calendar_dates WHERE dataset_id = ? AND holiday_date = ?").run(datasetId, date).changes === 1;
  }

  deleteDates(datasetId: number): void {
    this.database.prepare("DELETE FROM country_calendar_dates WHERE dataset_id = ?").run(datasetId);
  }
}
