import { createHmac, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

import { CountryCalendarRepository, type CountryCalendarDatasetRecord } from "../repositories/country-calendar-repository-core";

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
export class CountryCalendarCatalogPreviewMismatchError extends Error {}

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

function importPreviewToken(
  secret: Buffer,
  revision: number,
  envelope: CountryCalendarImportEnvelope,
  incoming: CountryCalendarImportDataset,
): string {
  return createHmac("sha256", secret)
    .update(String(revision))
    .update("\0")
    .update(incoming.countryCode)
    .update("\0")
    .update(String(incoming.year))
    .update("\0")
    .update(envelope.format)
    .update("\0")
    .update(envelope.content)
    .digest("base64url");
}

function safeTokenEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export class CountryCalendarCatalogService {
  private readonly repository: CountryCalendarRepository;

  constructor(
    database: Database.Database,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.repository = new CountryCalendarRepository(database);
  }

  private revision(): number {
    return this.repository.getRevision();
  }

  private datasetRow(code: WorkCalendarCountryCode, year: number): CountryCalendarDatasetRecord | undefined {
    return this.repository.findDataset(code, year);
  }

  private dateRows(datasetId: number): CountryCalendarAdminDateDto[] {
    return this.repository.listDates(datasetId);
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
      const latest = supported.at(-1)?.dataset.descriptor;
      return {
        code,
        name: baseline.name,
        supportedYears: supported.map((entry) => entry.year),
        sourceVersion: latest?.sourceVersion ?? null,
        sourceUrl: latest?.sourceUrl ?? null,
      };
    });
  }

  private assertRevision(expectedRevision: number): void {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || this.revision() !== expectedRevision) {
      throw new CountryCalendarCatalogRevisionMismatchError();
    }
  }

  private advance(expectedRevision: number, now: string): void {
    if (!this.repository.advanceRevision(expectedRevision, now)) {
      throw new CountryCalendarCatalogRevisionMismatchError();
    }
  }

  private ensureOverride(code: WorkCalendarCountryCode, year: number, now: string): CountryCalendarDatasetRecord {
    const existing = this.datasetRow(code, year);
    if (existing) return existing;
    const builtIn = getCountryCalendarDataset(code, year);
    const row = this.repository.insertDataset({
      countryCode: code,
      year,
      status: builtIn ? "OFFICIAL" : "UNAVAILABLE",
      sourceVersion: builtIn?.descriptor.sourceVersion ?? null,
      sourceUrl: builtIn?.descriptor.sourceUrl ?? null,
      now,
    });
    if (builtIn) {
      for (const entry of builtIn.dates) {
        this.repository.insertDate(row.id, entry, now);
      }
    }
    return row;
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
    return this.repository.transactionImmediate(() => {
      this.assertRevision(expectedRevision);
      const current = this.getAdminDataset(code, year);
      const status = input.status ?? current.data.dataset.status;
      if (!["OFFICIAL","UNAVAILABLE","SUPERSEDED"].includes(status)) throw new CountryCalendarCatalogInvalidInputError();
      let sourceVersion: string | null = current.data.dataset.sourceVersion;
      if (input.sourceVersion === null) sourceVersion = null;
      else if (input.sourceVersion !== undefined) {
        const normalized = text(input.sourceVersion, 200);
        if (!normalized) throw new CountryCalendarCatalogInvalidInputError();
        sourceVersion = normalized;
      }
      let sourceUrl: string | null = current.data.dataset.sourceUrl;
      if (input.sourceUrl === null) sourceUrl = null;
      else if (input.sourceUrl !== undefined) {
        const normalized = validSourceUrl(input.sourceUrl);
        if (!normalized) throw new CountryCalendarCatalogInvalidInputError();
        sourceUrl = normalized;
      }
      if (status === "OFFICIAL" && (!sourceVersion || !sourceUrl || current.data.dates.length === 0)) {
        throw new CountryCalendarCatalogConflictError();
      }
      if (status === current.data.dataset.status &&
          sourceVersion === current.data.dataset.sourceVersion &&
          sourceUrl === current.data.dataset.sourceUrl) {
        return current;
      }
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      this.repository.updateDatasetMetadata(row.id, { status, sourceVersion, sourceUrl, now });
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
  }

  addDate(
    code: WorkCalendarCountryCode,
    year: number,
    expectedRevision: number,
    input: CreateCountryCalendarDateRequest,
  ): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    const normalized = normalizeDate(input, year);
    return this.repository.transactionImmediate(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      try {
        this.repository.insertDate(row.id, normalized, now);
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new CountryCalendarCatalogConflictError();
        throw error;
      }
      this.repository.invalidateDatasetProvenance(row.id, now);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
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
    const keys = Object.keys(input);
    const raw = input as Record<string, unknown>;
    if (keys.length === 0 ||
        keys.some((key) => !["date","name","dayType","sourceKey"].includes(key) || raw[key] === null)) {
      throw new CountryCalendarCatalogInvalidInputError();
    }
    return this.repository.transactionImmediate(() => {
      this.assertRevision(expectedRevision);
      const currentSnapshot = this.getAdminDataset(code, year);
      const current = currentSnapshot.data.dates.find((entry) => entry.date === originalDate);
      if (!current) throw new CountryCalendarCatalogNotFoundError();
      const merged = normalizeDate({
        date: input.date ?? current.date,
        name: input.name ?? current.name,
        dayType: input.dayType ?? current.dayType,
        sourceKey: input.sourceKey ?? current.sourceKey,
      }, year);
      if (sameDate(current, merged)) return currentSnapshot;
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      try {
        this.repository.updateDate(row.id, originalDate, merged, now);
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new CountryCalendarCatalogConflictError();
        throw error;
      }
      this.repository.invalidateDatasetProvenance(row.id, now);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
  }

  deleteDate(
    code: WorkCalendarCountryCode,
    year: number,
    date: string,
    expectedRevision: number,
  ): CountryCalendarAdminResponse {
    this.validateSlot(code, year);
    if (!validDate(date, year)) throw new CountryCalendarCatalogInvalidInputError();
    return this.repository.transactionImmediate(() => {
      this.assertRevision(expectedRevision);
      const now = this.clock().toISOString();
      const row = this.ensureOverride(code, year, now);
      if (!this.repository.deleteDate(row.id, date)) throw new CountryCalendarCatalogNotFoundError();
      this.repository.invalidateDatasetProvenance(row.id, now);
      this.advance(expectedRevision, now);
      return this.getAdminDataset(code, year);
    });
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
      previewToken: importPreviewToken(this.repository.getPreviewSecret(), current.data.revision, envelope, incoming),
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

  applyImport(
    expectedRevision: number,
    previewToken: string,
    envelope: CountryCalendarImportEnvelope,
  ): CountryCalendarAdminResponse {
    const incoming = parseCountryCalendarImport(envelope);
    return this.repository.transactionImmediate(() => {
      this.assertRevision(expectedRevision);
      const expectedToken = importPreviewToken(this.repository.getPreviewSecret(), expectedRevision, envelope, incoming);
      if (typeof previewToken !== "string" || !safeTokenEquals(previewToken, expectedToken)) {
        throw new CountryCalendarCatalogPreviewMismatchError();
      }
      const now = this.clock().toISOString();
      const row = this.repository.upsertOfficialDataset({
        countryCode: incoming.countryCode,
        year: incoming.year,
        sourceVersion: incoming.sourceVersion,
        sourceUrl: incoming.sourceUrl,
        now,
      });
      this.repository.deleteDates(row.id);
      for (const entry of incoming.dates) {
        this.repository.insertDate(row.id, entry, now);
      }
      this.advance(expectedRevision, now);
      return this.getAdminDataset(incoming.countryCode, incoming.year);
    });
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
