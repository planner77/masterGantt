import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtempSync, readdirSync, copyFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { ProjectTemplateRepository } from "../../../src/server/repositories/project-template-repository-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";
import { CountryCalendarAdminService } from "../../../src/server/calendars/country-calendar-admin-service-core";
import { WorkCalendarCountryUnavailableError, WorkCalendarService } from "../../../src/server/calendars/work-calendar-service-core";
import { handlePreviewProjectWorkCalendar, handleReplaceProjectWorkCalendar } from "../../../src/server/calendars/work-calendar-handlers-core";
import { parseCountryCalendarImport } from "../../../src/server/calendars/country-calendar-validation-core";
import { getCountryCalendarDataset } from "../../../src/server/calendars/country-calendar-data";
import { parseProjectImportBytes } from "../../../src/server/imports/project-import-parser-core";
import type { CountryCalendarImportEnvelope } from "../../../src/contracts/country-calendar-admin";

const databases: Database.Database[] = [], directories: string[] = [];
const sourceMigrations = join(process.cwd(), "db/migrations");
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const hash = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
function setup(date = "2026-10-07T13:00:00Z") {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory: sourceMigrations }).database; databases.push(database);
  const clock = () => new Date(date), projects = new ProjectService(database, { clock, hashPassword: hash });
  const token = createSessionToken();
  new ProjectMasterRepository(database).insertAdminSession({ tokenHash: token.tokenHash, createdAt: date, expiresAt: new Date(clock().getTime() + 28800000).toISOString() });
  const admin = new CountryCalendarAdminService(database, { clock });
  return { database, clock, projects, admin, token: token.rawToken, calendar: new WorkCalendarService(database, { clock }) };
}
const create = (projects: ProjectService) => projects.create({ name: "Country snapshot", description: "", editPassword: "ExamplePassword" });
function uploaded(date: string): CountryCalendarImportEnvelope {
  const year = Number(date.slice(0, 4));
  return { countryCode: "KR", year, format: "json", content: JSON.stringify({ countryCode: "KR", year, status: "OFFICIAL", sourceVersion: `KR-${year}-confirmed-v2`, sourceUrl: "https://law.go.kr/", dates: [{ date, name: "Confirmed holiday", dayType: "NON_WORKING", sourceKey: "confirmed" }] }) };
}

describe("catalog and materialized calendar boundaries", () => {
  it("stored Template holidays survive an UNAVAILABLE catalog change and instantiate without changing the source Project", async () => {
    const f = setup(), file = uploaded("2026-10-07"), importPreview = f.admin.previewImport(f.token, 1, file);
    f.admin.applyImport(f.token, 1, { envelope: file, previewToken: importPreview.data.previewToken });
    const created = await create(f.projects), publicId = created.response.data.project.publicId;
    const authorized = f.projects.authorize(publicId, created.rawSessionToken);
    if (authorized.kind !== "authorized") throw new Error("Missing authorization");
    const stamp = f.clock().toISOString();
    new ScheduleRepository(f.database).insertTask({ projectId: authorized.authorization.projectId, publicId: randomUUID(), externalId: "TEMPLATE-TASK", name: "Stored calendar work", type: "task", scheduleMode: "auto", requestedStart: "2026-10-08", startDate: "2026-10-08", endDate: "2026-10-08", duration: 1, progress: 0, status: "not_started", parentId: null, sortOrder: 0, createdAt: stamp, updatedAt: stamp });
    const before = f.projects.getReadonlySnapshot(publicId)!, storedCalendar = f.calendar.get(publicId)!;
    expect(before.data.project.calendar.holidays).toEqual([{ date: "2026-10-07", name: "Confirmed holiday" }]);
    const templates = new ProjectTemplateService(f.database, { clock: f.clock, hashPassword: hash });
    const template = templates.createTemplateFromProject(authorized.authorization, before.data.project.revision, { name: "Stored calendar template" });
    const repository = new ProjectTemplateRepository(f.database);
    const contentBefore = repository.findTemplateByPublicId(template.id)!.contentJson;
    expect(template).toMatchObject({ sourceProjectId: publicId, sourceRevision: before.data.project.revision });
    expect(f.projects.getReadonlySnapshot(publicId)).toEqual(before);
    f.admin.updateMetadata(f.token, "KR", 2026, 2, { status: "UNAVAILABLE" });
    expect(() => f.calendar.preview(publicId, { countryRules: [{ countryCode: "KR", scope: "FULL_PROJECT" }], customDates: [] })).toThrow(WorkCalendarCountryUnavailableError);
    expect(templates.getTemplate(template.id)).toEqual(template);
    expect(repository.findTemplateByPublicId(template.id)!.contentJson).toBe(contentBefore);
    const instantiated = await templates.instantiateProject(template.id, { name: "Instantiated stored calendar", ownerName: "Template owner", editPassword: "TemplatePass", projectStartDate: "2026-10-07" });
    expect(instantiated.response.data.project.calendar.holidays).toEqual(before.data.project.calendar.holidays);
    expect(instantiated.response.data.tasks[0]).toMatchObject({ externalId: "TEMPLATE-TASK", start: "2026-10-08", end: "2026-10-08" });
    const newCalendar = f.calendar.get(instantiated.response.data.project.publicId)!;
    expect(newCalendar.data.projectDates.map(({ date, dayType, name }) => ({ date, dayType, name }))).toEqual(storedCalendar.data.projectDates.map(({ date, dayType, name }) => ({ date, dayType, name })));
    expect(newCalendar.data.rules).toEqual([expect.objectContaining({ kind: "CUSTOM", countryCode: null })]);
    expect(templates.getTemplate(template.id)).toEqual(template);
    expect(repository.findTemplateByPublicId(template.id)!.contentJson).toBe(contentBefore);
    expect(f.projects.getReadonlySnapshot(publicId)).toEqual(before);
    expect(f.calendar.get(publicId)).toEqual(storedCalendar);
  });

  it("FULL_PROJECT materializes both official US years and applies the cross-year observed holiday only on explicit Save", async () => {
    const f = setup(), created = await create(f.projects), publicId = created.response.data.project.publicId;
    const authorized = f.projects.authorize(publicId, created.rawSessionToken);
    if (authorized.kind !== "authorized") throw new Error("Missing authorization");
    const stamp = f.clock().toISOString(), seedCalendar = f.calendar.get(publicId);
    expect(seedCalendar?.data.rules).toEqual([expect.objectContaining({ countryCode: "KR", sourceVersion: getCountryCalendarDataset("KR", 2026)!.descriptor.sourceVersion })]);
    new ScheduleRepository(f.database).insertTask({ projectId: authorized.authorization.projectId, publicId: randomUUID(), externalId: "US-CROSS-YEAR", name: "Year-end work", type: "task", scheduleMode: "auto", requestedStart: "2027-12-30", startDate: "2027-12-30", endDate: "2028-01-03", duration: 3, progress: 0, status: "not_started", parentId: null, sortOrder: 0, createdAt: stamp, updatedAt: stamp });
    const before = f.projects.getReadonlySnapshot(publicId)!;
    expect(f.calendar.get(publicId)).toEqual(seedCalendar);
    expect(before.data.tasks[0]).toMatchObject({ start: "2027-12-30", end: "2028-01-03" });
    const us2027 = getCountryCalendarDataset("US", 2027)!, us2028 = getCountryCalendarDataset("US", 2028)!;
    const candidate = { countryRules: [{ countryCode: "US" as const, scope: "FULL_PROJECT" as const }], customDates: [] };
    const preview = f.calendar.preview(publicId, candidate);
    expect(preview.data.calendar.projectDates).toHaveLength(22);
    expect(preview.data.calendar.rules[0]).toMatchObject({ countryCode: "US", scope: "FULL_PROJECT", sourceVersion: `${us2027.descriptor.sourceVersion}+${us2028.descriptor.sourceVersion}` });
    for (const [year, dataset] of [[2027, us2027], [2028, us2028]] as const) {
      const dates = preview.data.calendar.projectDates.filter((entry) => entry.date.startsWith(`${year}-`));
      expect(dates.map((entry) => entry.date)).toEqual(dataset.dates.map((entry) => entry.date));
      for (const entry of dates) expect(entry.sources).toEqual([expect.objectContaining({ countryCode: "US", sourceVersion: dataset.descriptor.sourceVersion })]);
    }
    expect(preview.data.calendar.projectDates.find((entry) => entry.date === "2027-12-31")).toMatchObject({ dayType: "NON_WORKING", name: "New Year's Day", sources: [expect.objectContaining({ sourceVersion: us2027.descriptor.sourceVersion })] });
    expect(preview.data.changedTasks).toEqual([expect.objectContaining({ externalId: "US-CROSS-YEAR", beforeStart: "2027-12-30", beforeEnd: "2028-01-03", afterStart: "2027-12-30", afterEnd: "2028-01-04" })]);
    expect(f.calendar.get(publicId)).toEqual(seedCalendar);
    expect(f.projects.getReadonlySnapshot(publicId)).toEqual(before);
    const saved = f.calendar.replace(authorized.authorization, before.data.project.revision, { ...candidate, countryCatalogRevision: preview.data.countryCatalogRevision });
    expect(saved.data.projectRevision).toBe(before.data.project.revision + 1);
    expect(f.projects.getReadonlySnapshot(publicId)?.data.tasks[0]).toMatchObject({ start: "2027-12-30", end: "2028-01-04" });
    expect(f.calendar.get(publicId)?.data.projectDates).toEqual(preview.data.calendar.projectDates.map((entry) => ({ ...entry, sources: [expect.objectContaining({ countryCode: "US", sourceVersion: entry.sources[0].sourceVersion })] })));
  });

  it("catalog changes preserve all existing Project Calendar/Task/revision; explicit preview/save adopts latest data", async () => {
    const f = setup(), created = await create(f.projects), publicId = created.response.data.project.publicId;
    const authorization = f.projects.authorize(publicId, created.rawSessionToken);
    if (authorization.kind !== "authorized") throw new Error("Missing authorization");
    const projectId = authorization.authorization.projectId, stamp = f.clock().toISOString();
    new ScheduleRepository(f.database).insertTask({ projectId, publicId: randomUUID(), externalId: "T", name: "Work", type: "task", scheduleMode: "auto", requestedStart: "2026-10-07", startDate: "2026-10-07", endDate: "2026-10-07", duration: 1, progress: 0, status: "not_started", parentId: null, sortOrder: 0, createdAt: stamp, updatedAt: stamp });
    const before = f.projects.getReadonlySnapshot(publicId), storedCalendar = f.calendar.get(publicId);
    const file = uploaded("2026-10-07"), preview = f.admin.previewImport(f.token, 1, file);
    f.admin.applyImport(f.token, 1, { envelope: file, previewToken: preview.data.previewToken });
    expect(f.projects.getReadonlySnapshot(publicId)).toEqual(before);
    expect(f.calendar.get(publicId)).toEqual(storedCalendar);
    const candidate = { countryRules: [{ countryCode: "KR" as const, scope: "FULL_PROJECT" as const }], customDates: [] };
    const calendarPreview = f.calendar.preview(publicId, candidate);
    expect(calendarPreview.data.countryCatalogRevision).toBe(2);
    expect(calendarPreview.data.changedTasks[0]).toMatchObject({ beforeStart: "2026-10-07", afterStart: "2026-10-08" });
    f.calendar.replace(authorization.authorization, 1, { ...candidate, countryCatalogRevision: 2 });
    expect(f.projects.getReadonlySnapshot(publicId)?.data.tasks[0].start).toBe("2026-10-08");
    expect(f.calendar.get(publicId)?.data.projectDates[0].sources[0].sourceVersion).toBe("KR-2026-confirmed-v2");
    expect(f.projects.getReadonlySnapshot(publicId)?.data.project.revision).toBe(2);
    const saved = f.projects.getReadonlySnapshot(publicId);
    f.admin.updateDate(f.token, "KR", 2026, "2026-10-07", 2, { name: "New title" });
    expect(f.projects.getReadonlySnapshot(publicId)).toEqual(saved);
    expect(() => f.calendar.preview(publicId, candidate)).toThrow(WorkCalendarCountryUnavailableError);
    const copy = await new ProjectCopyService(f.database, { clock: f.clock, hashPassword: hash }).copy(authorization.authorization, 2, { name: "Copied", description: "", editPassword: "AnotherPassword" });
    expect(copy.response.data.project.calendar).toEqual(saved!.data.project.calendar);
  });

  it("rejects a stale catalog revision even with no countryRules, while omitted legacy requests recompute", async () => {
    const f = setup(), created = await create(f.projects), id = created.response.data.project.publicId, result = f.projects.authorize(id, created.rawSessionToken);
    if (result.kind !== "authorized") throw new Error("Missing authorization");
    const empty = { countryRules: [], customDates: [] }, before = f.projects.getReadonlySnapshot(id);
    const preview = f.calendar.preview(id, empty);
    f.admin.addDate(f.token, "CN", 2032, 1, { date: "2032-01-01", name: "Pending", dayType: "NON_WORKING", sourceKey: "pending" });
    expect(() => f.calendar.replace(result.authorization, 1, { ...empty, countryCatalogRevision: preview.data.countryCatalogRevision })).toThrowError(expect.objectContaining({ code: "COUNTRY_CALENDAR_REVISION_MISMATCH" }));
    expect(f.projects.getReadonlySnapshot(id)).toEqual(before);
    expect(f.calendar.replace(result.authorization, 1, empty).data.projectRevision).toBe(2);
  });

  it("returns detailed country/year errors with preserved Origin/session/revision guards", async () => {
    const f = setup(), created = await create(f.projects), id = created.response.data.project.publicId;
    const deps = { calendarService: f.calendar, projectService: f.projects, applicationBaseUrl: "http://localhost:3000", environment: "test" };
    const request = () => new Request(`http://localhost:3000/api/projects/${id}/work-calendar/preview`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `mastergantt_edit=${created.rawSessionToken}`, Origin: "http://localhost:3000", "If-Match": '"1"' }, body: JSON.stringify({ countryRules: [{ countryCode: "KR", scope: "DATE_RANGE", effectiveFrom: "2037-01-01", effectiveTo: "2037-12-31" }], customDates: [] }) });
    const response = await handlePreviewProjectWorkCalendar(request(), id, deps);
    expect(response.status).toBe(422); expect((await response.json()).error).toMatchObject({ code: "COUNTRY_CALENDAR_UNAVAILABLE", message: expect.stringContaining("KR 2037"), details: [{ path: "countryRules", code: "COUNTRY_CALENDAR_UNAVAILABLE", message: "KR 2037" }] });
    f.admin.addDate(f.token, "CN", 2032, 1, { date: "2032-01-01", name: "Pending", dayType: "NON_WORKING", sourceKey: "pending" });
    const body = { countryRules: [], customDates: [], countryCatalogRevision: 1 };
    const stale = new Request(`http://localhost:3000/api/projects/${id}/work-calendar`, { method: "PUT", headers: request().headers, body: JSON.stringify(body) });
    expect((await handleReplaceProjectWorkCalendar(stale, id, deps)).status).toBe(412);
  });

  it("new Project uses current KR, same-year immutable fallback when masked, and weekly defaults for unannounced years", async () => {
    const f = setup(), file = uploaded("2026-10-07"), preview = f.admin.previewImport(f.token, 1, file);
    f.admin.applyImport(f.token, 1, { envelope: file, previewToken: preview.data.previewToken });
    const current = await create(f.projects);
    expect(current.response.data.project.calendar.holidays).toEqual([{ date: "2026-10-07", name: "Confirmed holiday" }]);
    f.admin.updateMetadata(f.token, "KR", 2026, 2, { status: "UNAVAILABLE" });
    const fallback = await create(f.projects);
    expect(fallback.response.data.project.calendar.holidays).toHaveLength(getCountryCalendarDataset("KR", 2026)!.dates.length);
    expect(f.calendar.get(fallback.response.data.project.publicId)?.data.rules[0].sourceVersion).toBe(getCountryCalendarDataset("KR", 2026)!.descriptor.sourceVersion);
    const future = setup("2037-03-01T13:00:00Z"), empty = await create(future.projects);
    expect(future.calendar.get(empty.response.data.project.publicId)?.data.rules).toEqual([]);
    expect(empty.response.data.project.calendar).toMatchObject({ weekendDays: [6, 0], holidays: [], exceptions: [] });
    expect(future.projects.authorize(empty.response.data.project.publicId, empty.rawSessionToken).kind).toBe("authorized");
    expect(() => future.calendar.preview(empty.response.data.project.publicId, { countryRules: [{ countryCode: "KR", scope: "FULL_PROJECT" }], customDates: [] })).toThrow(WorkCalendarCountryUnavailableError);
  });

  it("migration 23→24 preserves aggregate bytes and catalog override survives reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "country-migration-")); directories.push(directory);
    const legacyDir = join(directory, "legacy");
    mkdirSync(legacyDir);
    for (const name of readdirSync(sourceMigrations).filter((name) => Number(name.slice(0, 4)) <= 23)) copyFileSync(join(sourceMigrations, name), join(legacyDir, name));
    const filename = join(directory, "catalog.sqlite3"), legacy = openDatabase({ filename, migrationsDirectory: legacyDir }).database;
    const repo = new ProjectMasterRepository(legacy), token = createSessionToken(); repo.insertAdminSession({ tokenHash: token.tokenHash, createdAt: "2026-10-07T13:00:00Z", expiresAt: "2026-10-07T21:00:00Z" });
    const before = legacy.prepare("SELECT * FROM project_master_admin_sessions").all(); legacy.close();
    const upgraded = openDatabase({ filename, migrationsDirectory: sourceMigrations });
    expect(upgraded.migrations.applied).toEqual(["0024_country_calendar_catalog.sql"]);
    expect(upgraded.database.prepare("SELECT * FROM project_master_admin_sessions").all()).toEqual(before);
    expect(upgraded.database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const service = new CountryCalendarAdminService(upgraded.database, { clock: () => new Date("2026-10-07T13:00:00Z") }), file = uploaded("2026-10-07"), preview = service.previewImport(token.rawToken, 1, file);
    service.applyImport(token.rawToken, 1, { envelope: file, previewToken: preview.data.previewToken }); upgraded.database.close();
    const reopened = openDatabase({ filename, migrationsDirectory: sourceMigrations }).database; databases.push(reopened);
    expect(new CountryCalendarAdminService(reopened, { clock: () => new Date("2026-10-07T13:00:00Z") }).getAdminDataset(token.rawToken, "KR", 2026).data.dates).toEqual(parseCountryCalendarImport(file).dates);
  });

  it("enforces country depth32 without changing the Project JSON depth64 contract", () => {
    const raw = { ...uploaded("2026-10-07"), content: "[".repeat(33) + "0" + "]".repeat(33) };
    expect(() => parseCountryCalendarImport(raw)).toThrowError(expect.objectContaining({ status: 413, code: "IMPORT_TOO_LARGE" }));
    expect(() => parseProjectImportBytes(Buffer.from(raw.content))).not.toThrow();
  });
});
