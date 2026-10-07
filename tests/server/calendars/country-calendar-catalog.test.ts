import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type Database from "better-sqlite3";
import type { CountryCalendarImportDataset, CountryCalendarImportEnvelope } from "../../../src/contracts/country-calendar-admin";
import { openDatabase } from "../../../src/server/db/core";
import { CountryCalendarCatalog } from "../../../src/server/calendars/country-calendar-catalog-core";
import { CountryCalendarAdminService } from "../../../src/server/calendars/country-calendar-admin-service-core";
import { handleCountryCalendarAdmin } from "../../../src/server/calendars/country-calendar-admin-handlers-core";
import { parseCountryCalendarImport } from "../../../src/server/calendars/country-calendar-validation-core";
import { PublicApiError } from "../../../src/server/http/api-error-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { CountryCalendarRepository } from "../../../src/server/repositories/country-calendar-repository-core";
import { createSessionToken } from "../../../src/server/security/session-core";
import { getCountryCalendarDataset } from "../../../src/server/calendars/country-calendar-data";

const databases: Database.Database[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });
function fixture() {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
  databases.push(database);
  let now = new Date("2026-10-07T13:00:00Z");
  const adminRepo = new ProjectMasterRepository(database);
  const login = (expiresAt = "2026-10-07T21:00:00Z") => {
    const session = createSessionToken();
    const id = adminRepo.insertAdminSession({ tokenHash: session.tokenHash, createdAt: now.toISOString(), expiresAt });
    return { ...session, id };
  };
  const admin = login();
  const service = new CountryCalendarAdminService(database, { clock: () => now });
  const catalog = new CountryCalendarCatalog(database);
  const deps = { service, applicationBaseUrl: "http://localhost:3000", environment: "test", requestId: () => "calendar-test" };
  const request = (body: unknown, headers: Record<string, string> = {}, method = "POST") => new Request("http://localhost:3000/api/admin/work-calendars/import/preview", { method, headers: { Origin: "http://localhost:3000", Cookie: `mastergantt_project_master_admin=${admin.rawToken}`, "Content-Type": "application/json", "If-Match": `"${catalog.repository.getRevision()}"`, ...headers }, ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify(body) }) });
  return { database, service, catalog, admin, adminRepo, login, deps, request, setNow: (value: string) => { now = new Date(value); } };
}
const dates = [{ date: "2032-01-01", name: "Official holiday", dayType: "NON_WORKING" as const, sourceKey: "holiday" }, { date: "2032-01-03", name: "Makeup workday", dayType: "WORKING" as const, sourceKey: "makeup" }];
const incoming: CountryCalendarImportDataset = { countryCode: "CN", year: 2032, status: "OFFICIAL", sourceVersion: "CN-2032-notice-1", sourceUrl: "https://www.gov.cn/example", dates };
function envelope(input = incoming): CountryCalendarImportEnvelope { return { countryCode: input.countryCode, year: input.year, format: "json", content: JSON.stringify(input) }; }
function audit(db: Database.Database) { return [db.prepare("SELECT revision,updated_at FROM country_calendar_catalog_state").all(), db.prepare("SELECT * FROM country_calendar_datasets ORDER BY id").all(), db.prepare("SELECT * FROM country_calendar_dates ORDER BY dataset_id,date").all()]; }
function expectCode(action: () => unknown, code: string) { try { action(); throw new Error("Expected rejection"); } catch (error) { expect(error).toBeInstanceOf(PublicApiError); expect((error as PublicApiError).code).toBe(code); } }

describe("country calendar validation", () => {
  it("keeps documented complete JSON/CSV examples equivalent to the official US2030 fixture", () => {
    const json = parseCountryCalendarImport({countryCode:"US",year:2030,format:"json",content:readFileSync(join(process.cwd(),"docs/examples/country-calendar-us-2030.json"),"utf8")});
    const csv = parseCountryCalendarImport({countryCode:"US",year:2030,format:"csv",content:readFileSync(join(process.cwd(),"docs/examples/country-calendar-us-2030.csv"),"utf8")});
    expect(csv).toEqual(json);
    const builtin=getCountryCalendarDataset("US",2030)!;
    expect(json.dates).toHaveLength(11);
    expect(json.dates).toEqual(builtin.dates);
    expect(json.sourceVersion).toBe(builtin.descriptor.sourceVersion);
    expect(json.sourceUrl).toBe(builtin.descriptor.sourceUrl);
  });
  it("parses exact JSON and quoted CSV including literal commas and escaped quotes", () => {
    expect(parseCountryCalendarImport(envelope())).toEqual(incoming);
    const csv = 'countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl\r\nCN,2032,2032-01-01,"Holiday, \"\"day\"\"",NON_WORKING,key,CN-2032-notice-1,https://www.gov.cn/example\r\n';
    expect(parseCountryCalendarImport({ countryCode: "CN", year: 2032, format: "csv", content: csv }).dates[0].name).toBe('Holiday, "day"');
  });
  it.each([
    { ...incoming, countryCode: "XX" }, { ...incoming, year: "2032" }, { ...incoming, status: null }, { ...incoming, status: "UNAVAILABLE" },
    { ...incoming, unknown: 1 }, { ...incoming, sourceVersion: "bad version" }, { ...incoming, sourceUrl: "javascript:alert(1)" },
    { ...incoming, sourceUrl: "https://user:password@example.com" }, { ...incoming, dates: [] },
    { ...incoming, dates: [{ ...dates[0], date: "2031-01-01" }] }, { ...incoming, dates: [{ ...dates[0], date: "2032-02-30" }] },
    { ...incoming, dates: [{ ...dates[0], name: null }] }, { ...incoming, dates: [{ ...dates[0], dayType: null }] },
    { ...incoming, dates: [{ ...dates[0], extra: true }] }, { ...incoming, dates: [dates[0], dates[0]] },
    { ...incoming, dates: [dates[0], { ...dates[0], dayType: "WORKING" }] },
  ])("rejects strict invalid input %#", (value) => {
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: JSON.stringify(value) }), "INVALID_COUNTRY_CALENDAR_INPUT");
  });
  it("rejects malformed JSON, duplicate decoded keys, oversized content, invalid surrogates and non-leading BOM", () => {
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: '{"countryCode":"CN","countryCode":"KR"}' }), "INVALID_COUNTRY_CALENDAR_INPUT");
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: "{" }), "INVALID_COUNTRY_CALENDAR_INPUT");
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: "x".repeat(1024 * 1024 + 1) }), "IMPORT_TOO_LARGE");
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: "\uD800" }), "INVALID_COUNTRY_CALENDAR_INPUT");
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: "\uFEFF\uFEFF" + envelope().content }), "INVALID_COUNTRY_CALENDAR_INPUT");
    expectCode(() => parseCountryCalendarImport({ ...envelope(), content: envelope().content + "\uFEFF" }), "INVALID_COUNTRY_CALENDAR_INPUT");
    expect(parseCountryCalendarImport({ ...envelope(), content: "\uFEFF" + envelope().content })).toEqual(incoming);
    expect(parseCountryCalendarImport(envelope({ ...incoming, year: 2032, dates: [{ ...dates[0], date: "2032-02-29" }] })).dates).toHaveLength(1);
  });
  it.each([
    'CN,2032,2032-01-01,"bad"tail,NON_WORKING,key,v1,https://gov.cn',
    'CN,2032,2032-01-01,"bad,NON_WORKING,key,v1,https://gov.cn',
    'CN,2032,2032-01-01,abc"x,NON_WORKING,key,v1,https://gov.cn',
    'CN,2032,2032-01-01,ok,NON_WORKING,key,v1,https://gov.cn,extra',
    'CN,2032,2032-01-01,ok,NON_WORKING,key,v1,https://gov.cn\nKR,2032,2032-01-02,ok,WORKING,key,v1,https://gov.cn',
  ])("rejects unsafe CSV syntax and inconsistent metadata %#", (rows) => {
    expectCode(() => parseCountryCalendarImport({ ...envelope(), format: "csv", content: "countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl\n" + rows }), "INVALID_COUNTRY_CALENDAR_INPUT");
  });
});

describe("country calendar catalog atomic operations", () => {
  it("exposes exactly 84 slots, never guesses future datasets, and respects override masking", () => {
    const f = fixture(), countries = f.catalog.listCountries().data.countries;
    expect(countries.flatMap((c) => c.datasets ?? [])).toHaveLength(84);
    expect(countries.flatMap((c) => c.datasets ?? []).filter((dataset)=>dataset.status==="OFFICIAL")).toHaveLength(12);
    expect(countries.find((c) => c.code === "US")!.supportedYears).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(f.catalog.effectiveDataset("KR", 2032)).toBeUndefined();
    expect(f.catalog.snapshot("US", 2027).data.dates.every((date)=>Object.keys(date).sort().join(",")==="date,dayType,name,sourceKey")).toBe(true);
    f.service.updateMetadata(f.admin.rawToken, "KR", 2026, 1, { status: "SUPERSEDED" });
    expect(f.catalog.effectiveDataset("KR", 2026)).toBeUndefined();
    expect(f.catalog.snapshot("KR", 2026).data.dataset.origin).toBe("OVERRIDE");
  });
  it("Preview is write0, counts agree with full Apply, and repeated stale Apply fails", () => {
    const f = fixture(), before = audit(f.database), raw = envelope();
    const preview = f.service.previewImport(f.admin.rawToken, 1, raw);
    expect(preview.data.summary).toEqual({ additions: 2, changes: 0, deletions: 0, unchanged: 0, metadataChanged: true });
    expect(audit(f.database)).toEqual(before);
    const result = f.service.applyImport(f.admin.rawToken, 1, { envelope: raw, previewToken: preview.data.previewToken });
    expect(result.data.revision).toBe(2); expect(result.data.dates).toEqual(dates);
    expect(f.catalog.effectiveDataset("CN", 2032)?.dates).toEqual(dates);
    expectCode(() => f.service.applyImport(f.admin.rawToken, 1, { envelope: raw, previewToken: preview.data.previewToken }), "COUNTRY_CALENDAR_REVISION_MISMATCH");
    const replacement = envelope({ ...incoming, dates: [{ ...dates[0], name: "Changed" }, { ...dates[1], date: "2032-01-04" }] });
    const second = f.service.previewImport(f.admin.rawToken, 2, replacement);
    expect(second.data.summary).toEqual({ additions: 1, changes: 1, deletions: 1, unchanged: 0, metadataChanged: false });
    expect(f.service.applyImport(f.admin.rawToken, 2, { envelope: replacement, previewToken: second.data.previewToken }).data.dates).toHaveLength(2);
  });
  it("date and metadata no-op preserve DB, source provenance and updatedAt, actual edits require reconfirmation", () => {
    const f = fixture(), original = f.service.getAdminDataset(f.admin.rawToken, "KR", 2026), before = audit(f.database);
    f.service.updateDate(f.admin.rawToken, "KR", 2026, original.data.dates[0].date, 1, { name: original.data.dates[0].name });
    f.service.updateMetadata(f.admin.rawToken, "KR", 2026, 1, { status: "OFFICIAL" });
    const raw = envelope({ ...incoming, countryCode: "KR", year: 2026, sourceVersion: original.data.dataset.sourceVersion!, sourceUrl: original.data.dataset.sourceUrl!, dates: original.data.dates });
    const preview = f.service.previewImport(f.admin.rawToken, 1, raw); expect(preview.data.changed).toBe(false);
    f.service.applyImport(f.admin.rawToken, 1, { envelope: raw, previewToken: preview.data.previewToken });
    expect(audit(f.database)).toEqual(before);
    const edited = f.service.updateDate(f.admin.rawToken, "KR", 2026, original.data.dates[0].date, 1, { name: "Corrected" });
    expect(edited.data.dataset).toMatchObject({ status: "UNAVAILABLE", sourceVersion: null, sourceUrl: null });
    expect(f.catalog.effectiveDataset("KR", 2026)).toBeUndefined();
    expectCode(() => f.service.updateMetadata(f.admin.rawToken, "KR", 2026, 2, { status: "OFFICIAL" }), "COUNTRY_CALENDAR_CONFLICT");
    expect(f.service.updateMetadata(f.admin.rawToken, "KR", 2026, 2, { status: "OFFICIAL", sourceVersion: "KR-2026-corrected-v2", sourceUrl: "https://law.go.kr/" }).data.revision).toBe(3);
  });
  it("creates, moves, changes day type and deletes a date atomically; duplicate and null updates fail", () => {
    const f = fixture();
    const row = { ...dates[0], date: "2032-01-02" };
    f.service.addDate(f.admin.rawToken, "CN", 2032, 1, row);
    const before = audit(f.database);
    expectCode(() => f.service.addDate(f.admin.rawToken, "CN", 2032, 2, row), "COUNTRY_CALENDAR_CONFLICT");
    expectCode(() => f.service.updateDate(f.admin.rawToken, "CN", 2032, row.date, 2, { date: null }), "INVALID_COUNTRY_CALENDAR_INPUT");
    expect(audit(f.database)).toEqual(before);
    expect(f.service.updateDate(f.admin.rawToken, "CN", 2032, row.date, 2, { date: "2032-01-03", dayType: "WORKING", sourceKey: "changed" }).data.dates).toContainEqual({ ...row, date: "2032-01-03", dayType: "WORKING", sourceKey: "changed" });
    expect(f.service.deleteDate(f.admin.rawToken, "CN", 2032, "2032-01-03", 3).data.dates).toEqual([]);
    expectCode(() => f.service.updateMetadata(f.admin.rawToken, "CN", 2032, 4, { status: "OFFICIAL", sourceUrl: "https://gov.cn", sourceVersion: "v1" }), "COUNTRY_CALENDAR_CONFLICT");
  });
  it.each(["insert", "revision"])("rolls back every catalog row on injected %s failure", (failure) => {
    const f = fixture(), raw = envelope(), preview = f.service.previewImport(f.admin.rawToken, 1, raw), before = audit(f.database);
    if (failure === "insert") {
      const original = CountryCalendarRepository.prototype.insertDate;
      vi.spyOn(CountryCalendarRepository.prototype, "insertDate").mockImplementation(function (this: CountryCalendarRepository, id, date, now) { original.call(this, id, date, now); if (date.date === dates[1].date) throw new Error("Injected insert failure after row storage"); });
    } else vi.spyOn(CountryCalendarRepository.prototype, "advanceRevision").mockReturnValue(false);
    expect(() => f.service.applyImport(f.admin.rawToken, 1, { envelope: raw, previewToken: preview.data.previewToken })).toThrow();
    expect(audit(f.database)).toEqual(before);
  });
  it("binds signed Preview to raw whitespace, BOM, format, target, exact session and expiry", () => {
    const f = fixture(), raw = envelope(), token = f.service.previewImport(f.admin.rawToken, 1, raw).data.previewToken, before = audit(f.database);
    for (const altered of [{ ...raw, content: raw.content + " " }, { ...raw, content: "\uFEFF" + raw.content }, { ...raw, countryCode: "KR" as const, content: raw.content.replace('"CN"', '"KR"') }]) {
      expectCode(() => f.service.applyImport(f.admin.rawToken, 1, { envelope: altered, previewToken: token }), "COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH");
    }
    const csv = "countryCode,year,date,name,dayType,sourceKey,sourceVersion,sourceUrl\nCN,2032,2032-01-01,Official holiday,NON_WORKING,holiday,CN-2032-notice-1,https://www.gov.cn/example\nCN,2032,2032-01-03,Makeup workday,WORKING,makeup,CN-2032-notice-1,https://www.gov.cn/example";
    expectCode(() => f.service.applyImport(f.admin.rawToken, 1, { envelope: { ...raw, format: "csv", content: csv }, previewToken: token }), "COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH");
    const other = f.login();
    expectCode(() => f.service.applyImport(other.rawToken, 1, { envelope: raw, previewToken: token }), "COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH");
    f.setNow("2026-10-07T13:10:00Z");
    expectCode(() => f.service.applyImport(f.admin.rawToken, 1, { envelope: raw, previewToken: token }), "COUNTRY_CALENDAR_IMPORT_PREVIEW_MISMATCH");
    expect(audit(f.database)).toEqual(before);
  });
});

describe("country calendar HTTP authorization", () => {
  it("requires the correct admin cookie, exact Origin and strong revision; no leak in response", async () => {
    const f = fixture();
    expect((await handleCountryCalendarAdmin(f.request(envelope(), { Cookie: "" }), "preview", {}, f.deps)).status).toBe(401);
    expect((await handleCountryCalendarAdmin(f.request(envelope(), { Cookie: `mastergantt_resource_admin=${f.admin.rawToken}` }), "preview", {}, f.deps)).status).toBe(401);
    expect((await handleCountryCalendarAdmin(f.request(envelope(), { Origin: "http://evil.test" }), "preview", {}, f.deps)).status).toBe(403);
    expect((await handleCountryCalendarAdmin(f.request(envelope(), { "If-Match": 'W/"1"' }), "preview", {}, f.deps)).status).toBe(400);
    const preview = await handleCountryCalendarAdmin(f.request(envelope()), "preview", {}, f.deps);
    expect(preview.status).toBe(200); expect(preview.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await preview.json(); expect(JSON.stringify(body)).not.toContain(f.admin.rawToken); expect(JSON.stringify(body)).not.toContain("preview_secret");
    const applied = await handleCountryCalendarAdmin(f.request({ envelope: envelope(), previewToken: body.data.previewToken }), "apply", {}, f.deps);
    expect(applied.status).toBe(200); expect(applied.headers.get("ETag")).toBe('"2"');
  });
  it.each(["preview", "apply", "metadata", "createDate"] as const)("reauthorizes %s after delayed body when the administrator logs out", async (operation) => {
    const f = fixture(), raw=envelope(), preview=f.service.previewImport(f.admin.rawToken,1,raw).data.previewToken, before=audit(f.database);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream=new ReadableStream<Uint8Array>({start(value){controller=value;}});
    const request=new Request("http://localhost:3000/api/admin/work-calendars",{method:"POST",headers:f.request(raw).headers,body:stream,duplex:"half"} as RequestInit);
    const pending=handleCountryCalendarAdmin(request,operation,{countryCode:"CN",year:"2032"},f.deps);
    await Promise.resolve();
    f.adminRepo.revokeAdminSession(f.admin.id,"2026-10-07T13:00:01Z");
    const body=operation==="preview"?raw:operation==="apply"?{envelope:raw,previewToken:preview}:operation==="metadata"?{status:"UNAVAILABLE"}:dates[0];
    controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));controller.close();
    expect((await pending).status).toBe(401);expect(audit(f.database)).toEqual(before);
  });

  it.each(["expired", "corrupt"])("reauthorizes after delayed request body when session becomes %s", async (kind) => {
    const f = fixture(), before = audit(f.database);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const request = new Request("http://localhost:3000/api/admin/work-calendars/import/preview", { method: "POST", headers: f.request(envelope()).headers, body: stream, duplex: "half" } as RequestInit);
    const pending = handleCountryCalendarAdmin(request, "preview", {}, f.deps);
    await Promise.resolve();
    if (kind === "revoked") f.adminRepo.revokeAdminSession(f.admin.id, "2026-10-07T13:00:01Z");
    else if (kind === "expired") f.setNow("2026-10-07T21:00:00Z");
    else f.database.prepare("UPDATE project_master_admin_sessions SET expires_at='invalid' WHERE id=?").run(f.admin.id);
    controller.enqueue(new TextEncoder().encode(JSON.stringify(envelope()))); controller.close();
    expect((await pending).status).toBe(401); expect(audit(f.database)).toEqual(before);
  });
});
