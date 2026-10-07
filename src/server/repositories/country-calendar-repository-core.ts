import type Database from "better-sqlite3";
import type { CountryCalendarAdminDateDto, CountryCalendarDatasetStatus } from "../../contracts/country-calendar-admin";
import type { WorkCalendarCountryCode } from "../../contracts/work-calendar";

export interface CountryCalendarDatasetRecord {
  id: number;
  countryCode: WorkCalendarCountryCode;
  year: number;
  status: CountryCalendarDatasetStatus;
  sourceVersion: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}

export class CountryCalendarRepository {
  constructor(private readonly database: Database.Database) {}

  getRevision(): number {
    return this.database.prepare("SELECT revision FROM country_calendar_catalog_state WHERE id = 1").pluck().get() as number;
  }

  getPreviewSecret(): Buffer {
    return this.database.prepare("SELECT preview_secret FROM country_calendar_catalog_state WHERE id = 1").pluck().get() as Buffer;
  }

  advanceRevision(expected: number, now: string): boolean {
    return this.database.prepare("UPDATE country_calendar_catalog_state SET revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?").run(now, expected).changes === 1;
  }

  findDataset(code: WorkCalendarCountryCode, year: number): CountryCalendarDatasetRecord | undefined {
    return this.database.prepare("SELECT id, country_code AS countryCode, year, status, source_version AS sourceVersion, source_url AS sourceUrl, updated_at AS updatedAt FROM country_calendar_datasets WHERE country_code = ? AND year = ?").get(code, year) as CountryCalendarDatasetRecord | undefined;
  }

  listDates(id: number): CountryCalendarAdminDateDto[] {
    return this.database.prepare("SELECT date, name, day_type AS dayType, source_key AS sourceKey FROM country_calendar_dates WHERE dataset_id = ? ORDER BY date").all(id) as CountryCalendarAdminDateDto[];
  }

  saveMetadata(code: WorkCalendarCountryCode, year: number, value: { status: CountryCalendarDatasetStatus; sourceVersion: string | null; sourceUrl: string | null }, now: string): number {
    this.database.prepare(`INSERT INTO country_calendar_datasets (country_code, year, status, source_version, source_url, created_at, updated_at)
      VALUES (@code, @year, @status, @sourceVersion, @sourceUrl, @now, @now)
      ON CONFLICT(country_code, year) DO UPDATE SET status = excluded.status, source_version = excluded.source_version, source_url = excluded.source_url, updated_at = excluded.updated_at`).run({ code, year, ...value, now });
    return this.findDataset(code, year)!.id;
  }

  deleteDates(id: number): void {
    this.database.prepare("DELETE FROM country_calendar_dates WHERE dataset_id = ?").run(id);
  }

  insertDate(id: number, entry: CountryCalendarAdminDateDto, now: string): void {
    this.database.prepare("INSERT INTO country_calendar_dates (dataset_id, date, name, day_type, source_key, created_at, updated_at) VALUES (@id, @date, @name, @dayType, @sourceKey, @now, @now)").run({ id, ...entry, now });
  }
}
