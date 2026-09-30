import type Database from "better-sqlite3";

import {
  COUNTRY_CALENDAR_MANAGED_YEARS,
  type CountryCalendarAdminDateDto,
  type CountryCalendarAdminResponse,
  type CountryCalendarDatasetStatus,
  type CountryCalendarImportDataset,
  type CountryCalendarImportEnvelope,
  type CountryCalendarImportPreviewResponse,
  type CreateCountryCalendarDateRequest,
  type UpdateCountryCalendarDateRequest,
  type UpdateCountryCalendarMetadataRequest,
} from "../../contracts/country-calendar-admin";
import {
  WORK_CALENDAR_COUNTRY_CODES,
  type CountryCalendarDescriptorDto,
  type WorkCalendarCountryCode,
  type WorkCalendarDayType,
} from "../../contracts/work-calendar";
import {
  getCountryCalendarDataset,
  listCountryCalendarDescriptors,
  type CountryCalendarDataset,
} from "./country-calendar-data";

export class CountryCalendarCatalogInvalidInputError extends Error {}
export class CountryCalendarCatalogRevisionMismatchError extends Error {}
export class CountryCalendarCatalogNotFoundError extends Error {}
export class CountryCalendarCatalogConflictError extends Error {}

interface DatasetRow {
  id: number;
  countryCode: WorkCalendarCountryCode;
  year: number;
  status: CountryCalendarDatasetStatus;
  sourceVersion: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}

interface DateRow {
  date: string;
  name: string;
  dayType: WorkCalendarDayType;
  sourceKey: string;
}

const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_DATES = 500;
const COUNTRY_CODES = new Set<string>(WORK_CALENDAR_COUNTRY_CODES);
const MANAGED_YEARS = new Set<number>(COUNTRY_CALENDAR_MANAGED_YEARS);

function validCountryCode(value: unknown): value is WorkCalendarCountryCode {
  return typeof value === "string" && COUNTRY_CODES.has(value);
}

function validYear(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && MANAGED_YEARS.has(value);
}

function validDayType(value: unknown): value is WorkCalendarDayType {
  return value === "NON_WORKING" || value === "WORKING";
}

function wellFormed(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function text(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string" || !wellFormed(value)) return undefined;
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  return length >= 1 && length <= maximum ? normalized : undefined;
}

function validDate(value: unknown, year: number): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) !== year) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validSourceUrl(value: unknown): string | undefined {
  const normalized = text(value, 2048);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function normalizeDate(value: unknown, year: number): CountryCalendarAdminDateDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CountryCalendarCatalogInvalidInputError();
  const input = value as Record<string, unknown>;
  if (!validDate(input.date, year) || !validDayType(input.dayType)) throw new CountryCalendarCatalogInvalidInputError();
  const name = text(input.name, 200);
  const sourceKey = text(input.sourceKey, 120);
  if (!name || !sourceKey) throw new CountryCalendarCatalogInvalidInputError();
  return { date: input.date, name, dayType: input.dayType, sourceKey };
}

function normalizeImport(value: unknown): CountryCalendarImportDataset {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CountryCalendarCatalogInvalidInputError();
  const input = value as Record<string, unknown>;
  if (!validCountryCode(input.countryCode) || !validYear(input.year)) throw new CountryCalendarCatalogInvalidInputError();
  const countryCode = input.countryCode;
  const year = input.year;
  const status = input.status === undefined ? "OFFICIAL" : input.status;
  if (status !== "OFFICIAL") throw new CountryCalendarCatalogInvalidInputError();
  const sourceVersion = text(input.sourceVersion, 200);
  const sourceUrl = validSourceUrl(input.sourceUrl);
  if (!sourceVersion || !sourceUrl || !Array.isArray(input.dates) || input.dates.length < 1 || input.dates.length > MAX_IMPORT_DATES) {
    throw new CountryCalendarCatalogInvalidInputError();
  }
  const dates = input.dates.map((entry) => normalizeDate(entry, year));
  const unique = new Set(dates.map((entry) => entry.date));
  if (unique.size !== dates.length) throw new CountryCalendarCatalogInvalidInputError();
  dates.sort((left, right) => left.date.localeCompare(right.date));
  return { countryCode, year, status: "OFFICIAL", sourceVersion, sourceUrl, dates };
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      if (field.length !== 0) throw new CountryCalendarCatalogInvalidInputError();
      quoted = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new CountryCalendarCatalogInvalidInputError();
  if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((entry) => entry.some((cell) => cell.length > 0));
}

function importFromCsv(content: string): CountryCalendarImportDataset {
  const rows = parseCsvRows(content);
  if (rows.length < 2) throw new CountryCalendarCatalogInvalidInputError();
  const header = rows[0].map((value) => value.trim());
  const expected = ["countryCode","year","date","name","dayType","sourceKey","sourceVersion","sourceUrl"];
  if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
    throw new CountryCalendarCatalogInvalidInputError();
  }
  const records = rows.slice(1).map((cells) => {
    if (cells.length !== expected.length) throw new CountryCalendarCatalogInvalidInputError();
    return Object.fromEntries(expected.map((key, index) => [key, cells[index]]));
  });
  const first = records[0];
  if (!first) throw new CountryCalendarCatalogInvalidInputError();
  const year = Number(first.year);
  return normalizeImport({
    countryCode: first.countryCode,
    year,
    status: "OFFICIAL",
    sourceVersion: first.sourceVersion,
    sourceUrl: first.sourceUrl,
    dates: records.map((record) => {
      if (record.countryCode !== first.countryCode || record.year !== first.year ||
          record.sourceVersion !== first.sourceVersion || record.sourceUrl !== first.sourceUrl) {
        throw new CountryCalendarCatalogInvalidInputError();
      }
      return { date: record.date, name: record.name, dayType: record.dayType, sourceKey: record.sourceKey };
    }),
  });
}

export function parseCountryCalendarImport(envelope: CountryCalendarImportEnvelope): CountryCalendarImportDataset {
  if (!envelope || (envelope.format !== "json" && envelope.format !== "csv") || typeof envelope.content !== "string" ||
      Buffer.byteLength(envelope.content, "utf8") > MAX_IMPORT_BYTES) {
    throw new CountryCalendarCatalogInvalidInputError();
  }
  if (envelope.format === "csv") return importFromCsv(envelope.content);
  try {
    return normalizeImport(JSON.parse(envelope.content) as unknown);
  } catch (error) {
    if (error instanceof CountryCalendarCatalogInvalidInputError) throw error;
    throw new CountryCalendarCatalogInvalidInputError();
  }
}

function countryName(code: WorkCalendarCountryCode): string {
  return listCountryCalendarDescriptors().find((entry) => entry.code === code)?.name ?? code;
}

function sameDate(left: CountryCalendarAdminDateDto, right: CountryCalendarAdminDateDto): boolean {
  return left.date === right.date && left.name === right.name && left.dayType === right.dayType && left.sourceKey === right.sourceKey;
}

export class CountryCalendarCatalogService {
  constructor(
    private readonly database: Database.Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private revision(): number {
    const row = this.database.prepare("SELECT revision FROM country_calendar_catalog_state WHERE id = 1").get() as { revision: number } | undefined;
    if (!row) throw new Error("Country calendar catalog state is missing.");
    return row.revision;
  }

  private datasetRow(code: WorkCalendarCountryCode, year: number): DatasetRow | undefined {
    return this.database.prepare(`
      SELECT id, country_code AS countryCode, calendar_year AS year, status,
             source_version AS sourceVersion, source_url AS sourceUrl, updated_at AS updatedAt
      FROM country_calendar_datasets
      WHERE country_code = ? AND calendar_year = ?
    `).get(code, year) as DatasetRow | undefined;
  }

  private dateRows(datasetId: number): DateRow[] {
    return this.database.prepare(`
      SELECT holiday_date AS date, name, day_type AS dayType, source_key AS sourceKey
      FROM country_calendar_dates
      WHERE dataset_id = ?
      ORDER BY holiday_date
    `).all(datasetId) as DateRow[];
  }

  private validateSlot(code: unknown, year: unknown): asserts code is WorkCalendarCountryCode {
    if (!validCountryCode(code) || !validYear(year)) throw new CountryCalendarCatalogInvalidInputError();
  }

  getAdminDataset(code: WorkCalendarCountryCode, year: number): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    const row = this.datasetRow(code, year);
    if (row) {
      const dates = this.dateRows(row.id);
      return { data: {
        revision: this.revision(),
        dataset: {
          countryCode: code, countryName: countryName(code), year, status: row.status, origin: "OVERRIDE",
          sourceVersion: row.sourceVersion, sourceUrl: row.sourceUrl, dateCount: dates.length, updatedAt: row.updatedAt,
        },
        dates,
      } };
    }
    const builtIn = getCountryCalendarDataset(code, year);
    if (builtIn) {
      return { data: {
        revision: this.revision(),
        dataset: {
          countryCode: code, countryName: builtIn.descriptor.name, year, status: "OFFICIAL", origin: "BUILT_IN",
          sourceVersion: builtIn.descriptor.sourceVersion, sourceUrl: builtIn.descriptor.sourceUrl,
          dateCount: builtIn.dates.length, updatedAt: null,
        },
        dates: builtIn.dates.map(({ date, name, dayType, sourceKey }) => ({ date, name, dayType, sourceKey })),
      } };
    }
    return { data: {
      revision: this.revision(),
      dataset: {
        countryCode: code, countryName: countryName(code), year, status: "UNAVAILABLE", origin: "EMPTY",
        sourceVersion: null, sourceUrl: null, dateCount: 0, updatedAt: null,
      },
      dates: [],
    } };
  }

  getEffectiveDataset(code: WorkCalendarCountryCode, year: number): CountryCalendarDataset | undefined {
    if (!validCountryCode(code) || !validYear(year)) return undefined;
    const row = this.datasetRow(code, year);
    if (!row) return getCountryCalendarDataset(code, year);
    if (row.status !== "OFFICIAL") return undefined;
    const dates = this.dateRows(row.id);
    if (dates.length === 0 || !row.sourceVersion || !row.sourceUrl) return undefined;
    return {
      descriptor: { code, name: countryName(code), supportedYears: [year], sourceVersion: row.sourceVersion, sourceUrl: row.sourceUrl },
      dates,
    };
  }

  listEffectiveDescriptors(): CountryCalendarDescriptorDto[] {
    return WORK_CALENDAR_COUNTRY_CODES.map((code) => {
      const supported: Array<{ year: number; dataset: CountryCalendarDataset }> = [];
      for (const year of COUNTRY_CALENDAR_MANAGED_YEARS) {
        const dataset = this.getEffectiveDataset(code, year);
        if (dataset) supported.push({ year, dataset });
      }
      const baseline = listCountryCalendarDescriptors().find((entry) => entry.code === code)!;
      const latest = supported.at(-1)?.dataset.descriptor ?? baseline;
      return {
        code,
        name: baseline.name,
        supportedYears: supported.map((entry) => entry.year),
        sourceVersion: latest.sourceVersion,
        sourceUrl: latest.sourceUrl,
      };
    });
  }

  private assertRevision(expectedRevision: number): void {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || this.revision() !== expectedRevision) {
      throw new CountryCalendarCatalogRevisionMismatchError();
    }
  }

  private advance(expectedRevision: number, now: string): void {
    const result = this.database.prepare(`
      UPDATE country_calendar_catalog_state
      SET revision = revision + 1, updated_at = ?
      WHERE id = 1 AND revision = ?
    `).run(now, expectedRevision);
    if (result.changes !== 1) throw new CountryCalendarCatalogRevisionMismatchError();
  }

  private ensureOverride(code: WorkCalendarCountryCode, year: number, now: string): DatasetRow {
    const existing = this.datasetRow(code, year);
    if (existing) return existing;
    const builtIn = getCountryCalendarDataset(code, year);
    const result = this.database.prepare(`
      INSERT INTO country_calendar_datasets
        (country_code, calendar_year, status, source_version, source_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      code, year, builtIn ? "OFFICIAL" : "UNAVAILABLE",
      builtIn?.descriptor.sourceVersion ?? null, builtIn?.descriptor.sourceUrl ?? null, now,
    );
    const id = Number(result.lastInsertRowid);
    if (builtIn) {
      const insert = this.database.prepare(`
        INSERT INTO country_calendar_dates
          (dataset_id, holiday_date, name, day_type, source_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const entry of builtIn.dates) {
        insert.run(id, entry.date, entry.name, entry.dayType, entry.sourceKey, now, now);
      }
    }
    return this.datasetRow(code, year)!;
  }

  updateMetadata(
    code: WorkCalendarCountryCode,
    year: number,
    expectedRevision: number,
    input: UpdateCountryCalendarMetadataRequest,
  ): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new CountryCalendarCatalogInvalidInputError();
    const keys = Object.keys(input);
    if (keys.length === 0 || keys.some((key) => !["status","sourceVersion","sourceUrl"].includes(key))) {
      throw new CountryCalendarCatalogInvalidInputError();
    }
    const transaction = this.database.transaction(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      const status = input.status ?? row.status;
      if (!["OFFICIAL","UNAVAILABLE","SUPERSEDED"].includes(status)) throw new CountryCalendarCatalogInvalidInputError();
      const sourceVersion = input.sourceVersion === undefined
        ? row.sourceVersion
        : input.sourceVersion === null ? null : text(input.sourceVersion, 200);
      const sourceUrl = input.sourceUrl === undefined
        ? row.sourceUrl
        : input.sourceUrl === null ? null : validSourceUrl(input.sourceUrl);
      if ((input.sourceVersion !== undefined && input.sourceVersion !== null && !sourceVersion) ||
          (input.sourceUrl !== undefined && input.sourceUrl !== null && !sourceUrl)) {
        throw new CountryCalendarCatalogInvalidInputError();
      }
      if (status === "OFFICIAL" && (!sourceVersion || !sourceUrl || this.dateRows(row.id).length === 0)) {
        throw new CountryCalendarCatalogConflictError();
      }
      this.database.prepare(`
        UPDATE country_calendar_datasets
        SET status = ?, source_version = ?, source_url = ?, updated_at = ?
        WHERE id = ?
      `).run(status, sourceVersion, sourceUrl, now, row.id);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
    return transaction.immediate();
  }

  addDate(
    code: WorkCalendarCountryCode,
    year: number,
    expectedRevision: number,
    input: CreateCountryCalendarDateRequest,
  ): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    const normalized = normalizeDate(input, year);
    const transaction = this.database.transaction(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      try {
        this.database.prepare(`
          INSERT INTO country_calendar_dates
            (dataset_id, holiday_date, name, day_type, source_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(row.id, normalized.date, normalized.name, normalized.dayType, normalized.sourceKey, now, now);
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new CountryCalendarCatalogConflictError();
        throw error;
      }
      this.database.prepare("UPDATE country_calendar_datasets SET updated_at = ? WHERE id = ?").run(now, row.id);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
    return transaction.immediate();
  }

  updateDate(
    code: WorkCalendarCountryCode,
    year: number,
    originalDate: string,
    expectedRevision: number,
    input: UpdateCountryCalendarDateRequest,
  ): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    if (!validDate(originalDate, year) || !input || typeof input !== "object" || Array.isArray(input)) {
      throw new CountryCalendarCatalogInvalidInputError();
    }
    const transaction = this.database.transaction(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      const current = this.database.prepare(`
        SELECT holiday_date AS date, name, day_type AS dayType, source_key AS sourceKey
        FROM country_calendar_dates WHERE dataset_id = ? AND holiday_date = ?
      `).get(row.id, originalDate) as DateRow | undefined;
      if (!current) throw new CountryCalendarCatalogNotFoundError();
      const merged = normalizeDate({
        date: input.date ?? current.date,
        name: input.name ?? current.name,
        dayType: input.dayType ?? current.dayType,
        sourceKey: input.sourceKey ?? current.sourceKey,
      }, year);
      try {
        this.database.prepare(`
          UPDATE country_calendar_dates
          SET holiday_date = ?, name = ?, day_type = ?, source_key = ?, updated_at = ?
          WHERE dataset_id = ? AND holiday_date = ?
        `).run(merged.date, merged.name, merged.dayType, merged.sourceKey, now, row.id, originalDate);
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new CountryCalendarCatalogConflictError();
        throw error;
      }
      this.database.prepare("UPDATE country_calendar_datasets SET updated_at = ? WHERE id = ?").run(now, row.id);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
    return transaction.immediate();
  }

  deleteDate(
    code: WorkCalendarCountryCode,
    year: number,
    date: string,
    expectedRevision: number,
  ): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    if (!validDate(date, year)) throw new CountryCalendarCatalogInvalidInputError();
    const transaction = this.database.transaction(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      const count = this.dateRows(row.id).length;
      if (row.status === "OFFICIAL" && count <= 1) throw new CountryCalendarCatalogConflictError();
      const result = this.database.prepare("DELETE FROM country_calendar_dates WHERE dataset_id = ? AND holiday_date = ?").run(row.id, date);
      if (result.changes !== 1) throw new CountryCalendarCatalogNotFoundError();
      this.database.prepare("UPDATE country_calendar_datasets SET updated_at = ? WHERE id = ?").run(now, row.id);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
    return transaction.immediate();
  }

  previewImport(envelope: CountryCalendarImportEnvelope): CountryCalendarImportPreviewResponse {
    const incoming = parseCountryCalendarImport(envelope);
    const current = this.getAdminDataset(incoming.countryCode, incoming.year);
    const currentByDate = new Map(current.data.dates.map((entry) => [entry.date, entry]));
    const incomingByDate = new Map(incoming.dates.map((entry) => [entry.date, entry]));
    let additions = 0, changes = 0, unchanged = 0;
    for (const entry of incoming.dates) {
      const existing = currentByDate.get(entry.date);
      if (!existing) additions += 1;
      else if (sameDate(existing, entry)) unchanged += 1;
      else changes += 1;
    }
    const deletions = current.data.dates.filter((entry) => !incomingByDate.has(entry.date)).length;
    return { data: {
      revision: current.data.revision,
      dataset: current.data.dataset,
      importDataset: {
        countryCode: incoming.countryCode,
        year: incoming.year,
        status: "OFFICIAL",
        sourceVersion: incoming.sourceVersion,
        sourceUrl: incoming.sourceUrl,
        dateCount: incoming.dates.length,
      },
      summary: { additions, changes, deletions, unchanged },
    } };
  }

  applyImport(expectedRevision: number, envelope: CountryCalendarImportEnvelope): CountryCalendarAdminResponse {
    const incoming = parseCountryCalendarImport(envelope);
    const transaction = this.database.transaction(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      this.database.prepare(`
        INSERT INTO country_calendar_datasets
          (country_code, calendar_year, status, source_version, source_url, updated_at)
        VALUES (?, ?, 'OFFICIAL', ?, ?, ?)
        ON CONFLICT(country_code, calendar_year) DO UPDATE SET
          status = 'OFFICIAL',
          source_version = excluded.source_version,
          source_url = excluded.source_url,
          updated_at = excluded.updated_at
      `).run(incoming.countryCode, incoming.year, incoming.sourceVersion, incoming.sourceUrl, now);
      const row = this.datasetRow(incoming.countryCode, incoming.year)!;
      this.database.prepare("DELETE FROM country_calendar_dates WHERE dataset_id = ?").run(row.id);
      const insert = this.database.prepare(`
        INSERT INTO country_calendar_dates
          (dataset_id, holiday_date, name, day_type, source_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const entry of incoming.dates) {
        insert.run(row.id, entry.date, entry.name, entry.dayType, entry.sourceKey, now, now);
      }
      this.advance(expectedRevision, now);
      return this.getAdminDataset(incoming.countryCode, incoming.year);
    });
    return transaction.immediate();
  }
}

export function getEffectiveCountryCalendarDataset(
  database: Database.Database,
  code: WorkCalendarCountryCode,
  year: number,
): CountryCalendarDataset | undefined {
  return new CountryCalendarCatalogService(database).getEffectiveDataset(code, year);
}

export function listEffectiveCountryCalendarDescriptors(database: Database.Database): CountryCalendarDescriptorDto[] {
  return new CountryCalendarCatalogService(database).listEffectiveDescriptors();
}
