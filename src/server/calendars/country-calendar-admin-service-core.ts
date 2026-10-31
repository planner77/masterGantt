import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import type { CountryCalendarAdminDateDto, CountryCalendarAdminResponse, CountryCalendarDatasetStatus, CountryCalendarImportApplyRequest, CountryCalendarImportEnvelope, CountryCalendarImportPreviewResponse, UpdateCountryCalendarMetadataRequest } from "../../contracts/country-calendar-admin";
import type { WorkCalendarCountryCode } from "../../contracts/work-calendar";
import { PublicApiError } from "../http/api-error-core";
import { ProjectMasterService } from "../project-master/project-master-service-core";
import { hashSessionToken } from "../security/session-core";
import { CountryCalendarCatalog } from "./country-calendar-catalog-core";
import { calendarCountry, calendarDate, calendarDateEntry, calendarObject, calendarSourceUrl, calendarSourceVersion, calendarYear, invalidCountryCalendar, parseCountryCalendarEnvelope, parseCountryCalendarImport } from "./country-calendar-validation-core";

type AdminSession = { id: number; expiresAt: string };
export interface CountryCalendarAdminServiceOptions {
  clock?: () => Date;
  authorizeAdmin?: (rawToken: string | undefined) => AdminSession | undefined;
}
const conflict = (message: string): never => { throw new PublicApiError(409, "COUNTRY_CALENDAR_CONFLICT", message); };
const previewMismatch = (): never => { throw new PublicApiError(409, "COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH", "The file, format, target, revision, administrator session or preview expiry changed. Preview again."); };
const sameDate = (left: CountryCalendarAdminDateDto, right: CountryCalendarAdminDateDto) => left.date === right.date && left.name === right.name && left.dayType === right.dayType && left.sourceKey === right.sourceKey;

export class CountryCalendarAdminService {
  private readonly catalog: CountryCalendarCatalog;
  private readonly clock: () => Date;
  private readonly authorize: (rawToken: string | undefined) => AdminSession | undefined;

  constructor(private readonly database: Database.Database, options: CountryCalendarAdminServiceOptions = {}) {
    this.catalog = new CountryCalendarCatalog(database);
    this.clock = options.clock ?? (() => new Date());
    const master = new ProjectMasterService(database, { clock: this.clock });
    this.authorize = options.authorizeAdmin ?? master.authorizeAdmin.bind(master);
  }

  requireAdmin(rawToken: string | undefined): AdminSession {
    const authorized = this.authorize(rawToken), expiry = authorized ? Date.parse(authorized.expiresAt) : NaN;
    if (!authorized || !Number.isFinite(expiry) || expiry <= this.clock().getTime()) throw new PublicApiError(401, "PROJECT_MASTER_ADMIN_REQUIRED", "A valid project master administrator session is required.");
    return authorized;
  }

  private requireRevision(expected: number): void {
    if (!Number.isSafeInteger(expected) || expected < 1 || this.catalog.repository.getRevision() !== expected) throw new PublicApiError(412, "COUNTRY_CALENDAR_REVISION_MISMATCH", "Country calendar catalog changed. Reload and preview again.");
  }

  getAdminDataset(rawToken: string | undefined, code: WorkCalendarCountryCode, year: number): CountryCalendarAdminResponse {
    return this.database.transaction(() => { this.requireAdmin(rawToken); return this.catalog.snapshot(code, year); }).deferred();
  }

  private save(code: WorkCalendarCountryCode, year: number, expected: number, metadata: { status: CountryCalendarDatasetStatus; sourceVersion: string | null; sourceUrl: string | null }, dates: CountryCalendarAdminDateDto[]): CountryCalendarAdminResponse {
    const now = this.clock().toISOString(), repo = this.catalog.repository;
    const id = repo.saveMetadata(code, year, metadata, now);
    repo.deleteDates(id);
    for (const date of dates) repo.insertDate(id, date, now);
    if (!repo.advanceRevision(expected, now)) throw new PublicApiError(412, "COUNTRY_CALENDAR_REVISION_MISMATCH", "Country calendar catalog changed.");
    return this.catalog.snapshot(code, year);
  }

  updateMetadata(rawToken: string | undefined, code: WorkCalendarCountryCode, year: number, expected: number, input: UpdateCountryCalendarMetadataRequest): CountryCalendarAdminResponse {
    calendarCountry(code); calendarYear(year);
    const object = calendarObject(input, ["status", "sourceVersion", "sourceUrl"], "metadata", true);
    return this.database.transaction(() => {
      this.requireAdmin(rawToken); this.requireRevision(expected);
      const current = this.catalog.snapshot(code, year), old = current.data.dataset;
      const status = object.status === undefined ? old.status : object.status;
      if (status !== "OFFICIAL" && status !== "UNAVAILABLE" && status !== "SUPERSEDED") invalidCountryCalendar("status", "Use OFFICIAL, UNAVAILABLE or SUPERSEDED.");
      const sourceVersion = object.sourceVersion === undefined ? old.sourceVersion : object.sourceVersion === null ? null : calendarSourceVersion(object.sourceVersion);
      const sourceUrl = object.sourceUrl === undefined ? old.sourceUrl : object.sourceUrl === null ? null : calendarSourceUrl(object.sourceUrl);
      if (status === "OFFICIAL" && (!sourceVersion || !sourceUrl || !current.data.dates.length)) conflict("OFFICIAL requires at least one date and confirmed source metadata.");
      if (status === old.status && sourceVersion === old.sourceVersion && sourceUrl === old.sourceUrl) return current;
      return this.save(code, year, expected, { status, sourceVersion, sourceUrl }, current.data.dates);
    }).immediate();
  }

  addDate(rawToken: string | undefined, code: WorkCalendarCountryCode, year: number, expected: number, input: unknown): CountryCalendarAdminResponse {
    calendarCountry(code); calendarYear(year);
    const incoming = calendarDateEntry(input, year);
    return this.database.transaction(() => {
      this.requireAdmin(rawToken); this.requireRevision(expected);
      const current = this.catalog.snapshot(code, year);
      if (current.data.dates.some((date) => date.date === incoming.date)) conflict("The date already exists.");
      return this.save(code, year, expected, { status: "UNAVAILABLE", sourceVersion: null, sourceUrl: null }, [...current.data.dates, incoming]);
    }).immediate();
  }

  updateDate(rawToken: string | undefined, code: WorkCalendarCountryCode, year: number, originalDate: string, expected: number, input: unknown): CountryCalendarAdminResponse {
    calendarCountry(code); calendarYear(year); calendarDate(originalDate, year);
    const update = calendarObject(input, ["date", "name", "dayType", "sourceKey"], "date", true);
    return this.database.transaction(() => {
      this.requireAdmin(rawToken); this.requireRevision(expected);
      const current = this.catalog.snapshot(code, year), old = current.data.dates.find((date) => date.date === originalDate);
      if (!old) throw new PublicApiError(404, "COUNTRY_CALENDAR_DATE_NOT_FOUND", "Country calendar date was not found.");
      const incoming = calendarDateEntry({ ...old, ...update }, year);
      if (sameDate(old, incoming)) return current;
      if (current.data.dates.some((date) => date.date !== originalDate && date.date === incoming.date)) conflict("The replacement date already exists.");
      return this.save(code, year, expected, { status: "UNAVAILABLE", sourceVersion: null, sourceUrl: null }, current.data.dates.map((date) => date.date === originalDate ? incoming : date));
    }).immediate();
  }

  deleteDate(rawToken: string | undefined, code: WorkCalendarCountryCode, year: number, dateValue: string, expected: number): CountryCalendarAdminResponse {
    calendarCountry(code); calendarYear(year); calendarDate(dateValue, year);
    return this.database.transaction(() => {
      this.requireAdmin(rawToken); this.requireRevision(expected);
      const current = this.catalog.snapshot(code, year);
      if (!current.data.dates.some((date) => date.date === dateValue)) throw new PublicApiError(404, "COUNTRY_CALENDAR_DATE_NOT_FOUND", "Country calendar date was not found.");
      return this.save(code, year, expected, { status: "UNAVAILABLE", sourceVersion: null, sourceUrl: null }, current.data.dates.filter((date) => date.date !== dateValue));
    }).immediate();
  }

  private binding(rawToken: string, session: AdminSession, expected: number, envelope: CountryCalendarImportEnvelope, expires: number): string {
    return JSON.stringify(["country-calendar-preview:v1", envelope.countryCode, envelope.year, envelope.format, expected, session.id, hashSessionToken(rawToken).toString("hex"), createHash("sha256").update(envelope.content, "utf8").digest("hex"), expires]);
  }

  private token(rawToken: string, session: AdminSession, expected: number, envelope: CountryCalendarImportEnvelope, expires: number): string {
    const seal = createHmac("sha256", this.catalog.repository.getPreviewSecret()).update(this.binding(rawToken, session, expected, envelope, expires)).digest("base64url");
    return `${expires}.${seal}`;
  }

  previewImport(rawToken: string | undefined, expected: number, input: CountryCalendarImportEnvelope): CountryCalendarImportPreviewResponse {
    this.requireAdmin(rawToken);
    const envelope = parseCountryCalendarEnvelope(input), incoming = parseCountryCalendarImport(envelope);
    return this.database.transaction(() => {
      const session = this.requireAdmin(rawToken); this.requireRevision(expected);
      const current = this.catalog.snapshot(envelope.countryCode, envelope.year), byDate = new Map(current.data.dates.map((date) => [date.date, date]));
      const summary = { additions: 0, changes: 0, deletions: 0, unchanged: 0, metadataChanged: current.data.dataset.status !== incoming.status || current.data.dataset.sourceVersion !== incoming.sourceVersion || current.data.dataset.sourceUrl !== incoming.sourceUrl };
      for (const date of incoming.dates) {
        const old = byDate.get(date.date);
        if (!old) summary.additions++; else if (sameDate(old, date)) summary.unchanged++; else summary.changes++;
        byDate.delete(date.date);
      }
      summary.deletions = byDate.size;
      const expires = Math.min(this.clock().getTime() + 10 * 60 * 1000, Date.parse(session.expiresAt));
      return { data: { revision: expected, previewToken: this.token(rawToken!, session, expected, envelope, expires), expiresAt: new Date(expires).toISOString(), dataset: current.data.dataset, importDataset: { countryCode: incoming.countryCode, year: incoming.year, status: incoming.status, sourceVersion: incoming.sourceVersion, sourceUrl: incoming.sourceUrl, dateCount: incoming.dates.length }, summary, changed: !!(summary.additions || summary.changes || summary.deletions || summary.metadataChanged) } };
    }).deferred();
  }

  applyImport(rawToken: string | undefined, expected: number, input: CountryCalendarImportApplyRequest): CountryCalendarAdminResponse {
    this.requireAdmin(rawToken);
    const body = calendarObject(input, ["envelope", "previewToken"], "apply");
    const envelope = parseCountryCalendarEnvelope(body.envelope), incoming = parseCountryCalendarImport(envelope);
    if (typeof body.previewToken !== "string" || !/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(body.previewToken)) previewMismatch();
    const token = body.previewToken as string;
    return this.database.transaction(() => {
      const session = this.requireAdmin(rawToken); this.requireRevision(expected);
      const expires = Number(token.split(".")[0]), currentTime = this.clock().getTime();
      if (!Number.isSafeInteger(expires) || expires <= currentTime || expires > Date.parse(session.expiresAt)) previewMismatch();
      const expectedToken = this.token(rawToken!, session, expected, envelope, expires);
      if (!timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) previewMismatch();
      const current = this.catalog.snapshot(envelope.countryCode, envelope.year), old = current.data.dataset;
      if (old.status === incoming.status && old.sourceVersion === incoming.sourceVersion && old.sourceUrl === incoming.sourceUrl && current.data.dates.length === incoming.dates.length && current.data.dates.every((date, index) => sameDate(date, incoming.dates[index]))) return current;
      return this.save(envelope.countryCode, envelope.year, expected, incoming, incoming.dates);
    }).immediate();
  }
}
