import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { ProcessCatalogService } from "../../../src/server/process-catalog/process-catalog-service-core";
import { handleApplyProcessStandards, handleGetProcessCatalog, handleGetProcessStandardDiff, handleGetProjectProcessContext, handleMapProjectProcess, handleMutateProcessCatalog, type ProcessCatalogKind } from "../../../src/server/process-catalog/process-catalog-handlers-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { handleUpdateProject } from "../../../src/server/projects/project-handlers-core";
import { handleCreateTemplateFromProject } from "../../../src/server/templates/project-template-handlers-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { projectMasterAdminCookieName } from "../../../src/server/security/project-master-admin-cookie-core";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";

const base = "https://gantt.example.test";
const now = new Date("2026-10-12T01:00:00Z");
const databases: Database.Database[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

function setup() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") });
  databases.push(database);
  const master = new ProjectMasterRepository(database);
  const adminToken = createSessionToken();
  master.insertAdminSession({ tokenHash: adminToken.tokenHash, createdAt: now.toISOString(), expiresAt: sessionExpiry(now).toISOString() });
  const masterItem = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) => master.insertItem({ publicId: randomUUID(), category, code, name: code, active: true, sortOrder: 0, now: now.toISOString() });
  const businessUnit = masterItem("BUSINESS_UNIT", "BU");
  const product = masterItem("PRODUCT", "PRODUCT");
  const site = masterItem("SITE_ENTITY", "SITE");
  database.prepare("INSERT INTO business_unit_products VALUES (?,?)").run(businessUnit.id, product.id);
  database.prepare("INSERT INTO business_unit_product_sites VALUES (?,?,?)").run(businessUnit.id, product.id, site.id);
  const triple = { businessUnitId: businessUnit.publicId, productId: product.publicId, siteEntityId: site.publicId };
  const project = new ProjectRepository(database).insert({ publicId: randomUUID(), name: "HTTP Project", description: "", status: "planned", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: now.toISOString(), updatedAt: now.toISOString() });
  database.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?").run(businessUnit.id, product.id, site.id, project.id);
  const editorToken = createSessionToken();
  new EditSessionRepository(database).insert({ projectId: project.id, tokenHash: editorToken.tokenHash, authVersion: project.authVersion, createdAt: now.toISOString(), expiresAt: sessionExpiry(now).toISOString() });
  const adminCookie = `${projectMasterAdminCookieName("production", new URL(base))}=${adminToken.rawToken}`;
  const editorCookie = `${editSessionCookieName("production", new URL(base))}=${editorToken.rawToken}`;
  const service = new ProcessCatalogService(database, { clock: () => now });
  const projectService = new TaskFieldProjectService(database, { clock: () => now });
  const d = { service, projectService, applicationBaseUrl: base, environment: "production", requestId: () => "process-catalog-http" };
  const request = (body: unknown, revision: number, cookie = adminCookie, overrides: Record<string, string> = {}) => new Request(`${base}/api/process-catalog/admin/types`, { method: "POST", headers: { Origin: base, Cookie: cookie, "If-Match": `"${revision}"`, "Content-Type": "application/json", ...overrides }, body: JSON.stringify(body) });
  const revision = () => service.getCatalog(adminToken.rawToken).data.processCatalogRevision;
  const create = async (kind: ProcessCatalogKind, body: unknown) => {
    const response = await handleMutateProcessCatalog(request(body, revision()), kind, "create", null, d);
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
    return response.json();
  };
  const projectRevision = () => (database.prepare("SELECT revision FROM projects WHERE id=?").get(project.id) as { revision: number }).revision;
  return { database, service, d, adminToken, adminCookie, editorCookie, triple, project, projectService, request, revision, create, projectRevision };
}

async function seedContext(f: ReturnType<typeof setup>) {
  const typeResponse = await f.create("types", { code: "ASSEMBLY", name: "조립" });
  const type = typeResponse.data.types[0];
  const standardResponse = await f.create("standards", { code: "STANDARD", name: "조립", productId: f.triple.productId, processTypeId: type.id });
  const standard = standardResponse.data.standards[0];
  const applied = await handleApplyProcessStandards(f.request({ ...f.triple, standardIds: [standard.id] }, f.revision()), f.d);
  expect(applied.status, JSON.stringify(await applied.clone().json())).toBe(200);
  const occurrence = (await applied.json()).data.occurrences[0];
  const workResponse = await f.create("workAreas", { code: "AREA", name: "동일 이름", occurrenceId: occurrence.id });
  const workArea = workResponse.data.workAreas[0];
  const auth = f.projectService.authorize(f.project.publicId, f.editorCookie.split("=")[1]);
  if (auth.kind !== "authorized") throw new Error("Fixture project authorization failed.");
  const process = new LogisticsService(f.database, { clock: () => now }).createProcess(auth.authorization, f.projectRevision(), { code: "LEGACY", name: "기존 공정" }).data.logistics.processes[0];
  return { type, standard, occurrence, workArea, process };
}

function delayedRequest(cookie: string, revision: number) {
  let finish!: (body: unknown) => void;
  const body = new ReadableStream<Uint8Array>({ start(controller) { finish = value => { controller.enqueue(new TextEncoder().encode(JSON.stringify(value))); controller.close(); }; } });
  const request = new Request(`${base}/api/process-catalog/admin/types`, { method: "POST", headers: { Origin: base, Cookie: cookie, "If-Match": `"${revision}"`, "Content-Type": "application/json" }, body, duplex: "half" } as RequestInit & { duplex: "half" });
  return { request, finish };
}

describe("Process catalog native SQLite HTTP security and atomicity", () => {
  it("requires master admin, exact Origin, and a strong catalog If-Match", async () => {
    const f = setup();
    const input = { code: "A", name: "A" };
    expect((await handleMutateProcessCatalog(f.request(input, 1, ""), "types", "create", null, f.d)).status).toBe(401);
    expect((await handleMutateProcessCatalog(f.request(input, 1, f.editorCookie), "types", "create", null, f.d)).status).toBe(401);
    expect((await handleMutateProcessCatalog(f.request(input, 1, f.adminCookie, { Origin: "https://evil.test" }), "types", "create", null, f.d)).status).toBe(403);
    expect((await handleMutateProcessCatalog(f.request(input, 1, f.adminCookie, { "If-Match": 'W/"1"' }), "types", "create", null, f.d)).status).toBe(400);
    const missing = f.request(input, 1); missing.headers.delete("if-match");
    expect((await handleMutateProcessCatalog(missing, "types", "create", null, f.d)).status).toBe(428);
    expect(f.revision()).toBe(1);
    expect(f.projectRevision()).toBe(1);
  });

  it("rejects strict scalar/body/UUID/query errors without writes and caps raw bodies", async () => {
    const f = setup();
    for (const body of [null, [], { code: "A", name: "A", extra: true }, { code: "A", name: null }, { code: "A", name: "A", active: "true" }, { code: "A", name: "A", sortOrder: 1.5 }]) {
      expect((await handleMutateProcessCatalog(f.request(body, 1), "types", "create", null, f.d)).status).toBe(400);
    }
    expect((await handleMutateProcessCatalog(f.request({ name: "A" }, 1), "types", "update", "invalid", f.d)).status).toBe(400);
    expect((await handleMutateProcessCatalog(f.request({ code: "A", name: "x".repeat(33000) }, 1), "types", "create", null, f.d)).status).toBe(413);
    for (const suffix of ["?limit=201", "?limit=1&limit=2", "?active=1", "?search=", "?unknown=1"]) {
      const response = handleGetProcessCatalog(new Request(`${base}/api/process-catalog/admin${suffix}`, { headers: { Cookie: f.adminCookie } }), f.d);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(f.revision()).toBe(1);
  });

  it("preserves duplicate failure, exact ETag, and concurrent single-winner catalog writes", async () => {
    const f = setup();
    const initial = f.revision();
    const pending = delayedRequest(f.adminCookie, initial);
    const loser = handleMutateProcessCatalog(pending.request, "types", "create", null, f.d);
    const winner = await handleMutateProcessCatalog(f.request({ code: "A", name: "A" }, initial), "types", "create", null, f.d);
    expect(winner.status).toBe(201);
    expect(winner.headers.get("etag")).toBe('"2"');
    pending.finish({ code: "B", name: "B" });
    expect((await loser).status).toBe(412);
    expect((await handleMutateProcessCatalog(f.request({ code: "A", name: "duplicate" }, 2), "types", "create", null, f.d)).status).toBe(409);
    expect(f.service.getCatalog(f.adminToken.rawToken).data.types.map(item => item.code)).toEqual(["A"]);
    expect(f.revision()).toBe(2);
  });

  it("reauthorizes an administrator revoked while request body is delayed", async () => {
    const f = setup();
    const pending = delayedRequest(f.adminCookie, f.revision());
    const result = handleMutateProcessCatalog(pending.request, "types", "create", null, f.d);
    new ProjectMasterRepository(f.database).revokeAllAdminSessions(now.toISOString());
    pending.finish({ code: "A", name: "A" });
    expect((await result).status).toBe(401);
    expect(f.database.prepare("SELECT count(*) AS n FROM process_types").get()).toEqual({ n: 0 });
  });

  it("exposes readonly bounded project context and explicit standard diff without mutation", async () => {
    const f = setup(); const { occurrence, workArea, standard } = await seedContext(f);
    const before = f.projectRevision();
    const context = handleGetProjectProcessContext(new Request(`${base}/api/projects/${f.project.publicId}/logistics/process-context`), f.project.publicId, f.d);
    expect(context.status).toBe(200);
    const body = await context.json();
    expect(body.data.permission).toBe("readonly");
    expect(body.data.occurrences[0].id).toBe(occurrence.id);
    expect(body.data.workAreas[0].id).toBe(workArea.id);
    const params = new URLSearchParams(f.triple);
    const diff = handleGetProcessStandardDiff(new Request(`${base}/api/process-catalog/admin/standard-diff?${params}`, { headers: { Cookie: f.adminCookie } }), f.d);
    expect(diff.status).toBe(200);
    expect((await diff.json()).data.standardDiff.missingStandardIds).not.toContain(standard.id);
    expect(f.projectRevision()).toBe(before);
  });

  it("maps only within project context, rejects foreign WorkArea atomically, and keeps separate revisions", async () => {
    const f = setup(); const { type, occurrence, workArea, process } = await seedContext(f);
    const second = await f.create("occurrences", { ...f.triple, processTypeId: type.id, code: "EXTRA", name: "추가" });
    const otherOccurrence = second.data.occurrences.find((item: { id: string }) => item.id !== occurrence.id);
    const extra = await f.create("workAreas", { code: "FOREIGN", name: "동일 이름", occurrenceId: otherOccurrence.id });
    const foreign = extra.data.workAreas.find((item: { id: string }) => item.id !== workArea.id);
    const projectRevision = f.projectRevision(); const catalogRevision = f.revision();
    const mapping = { processCatalogRevision: catalogRevision, occurrenceId: occurrence.id, workAreaId: workArea.id };
    expect((await handleMapProjectProcess(f.request(mapping, projectRevision, ""), f.project.publicId, process.id, f.d)).status).toBe(401);
    const bad = await handleMapProjectProcess(f.request({ ...mapping, workAreaId: foreign.id }, projectRevision, f.editorCookie), f.project.publicId, process.id, f.d);
    expect(bad.status).toBe(400);
    expect(f.projectRevision()).toBe(projectRevision);
    const good = await handleMapProjectProcess(f.request(mapping, projectRevision, f.editorCookie), f.project.publicId, process.id, f.d);
    expect(good.status, JSON.stringify(await good.clone().json())).toBe(200);
    expect(good.headers.get("etag")).toBe(`"${projectRevision + 1}"`);
    const canonical = await good.json();
    expect(canonical.data.project.revision).toBe(projectRevision + 1);
    expect(canonical.data.logistics.processes[0].id).toBe(process.id);
    expect(canonical.data.mappings[0]).toMatchObject({ processId: process.id, occurrenceId: occurrence.id, workAreaId: workArea.id });
    expect(f.revision()).toBe(catalogRevision);
    expect((await handleMapProjectProcess(f.request(mapping, projectRevision, f.editorCookie), f.project.publicId, process.id, f.d)).status).toBe(412);
    const removed = await handleMutateProcessCatalog(new Request(`${base}/api/process-catalog/admin/occurrences/${occurrence.id}`, { method: "DELETE", headers: { Origin: base, Cookie: f.adminCookie, "If-Match": `"${catalogRevision}"` } }), "occurrences", "delete", occurrence.id, f.d);
    expect(removed.status).toBe(409);
    expect(f.revision()).toBe(catalogRevision);
  });

  it("rechecks catalog and project sessions after delayed mapping bodies", async () => {
    const f = setup(); const { occurrence, process } = await seedContext(f);
    const revision = f.projectRevision();
    const pending = delayedRequest(f.editorCookie, revision);
    const result = handleMapProjectProcess(pending.request, f.project.publicId, process.id, f.d);
    const oldCatalogRevision = f.revision();
    await f.create("types", { code: "RACE", name: "RACE" });
    pending.finish({ processCatalogRevision: oldCatalogRevision, occurrenceId: occurrence.id });
    expect((await result).status).toBe(412);
    expect(f.projectRevision()).toBe(revision);
    const revoked = delayedRequest(f.editorCookie, revision);
    const revokedResult = handleMapProjectProcess(revoked.request, f.project.publicId, process.id, f.d);
    f.database.prepare("UPDATE edit_sessions SET revoked_at=? WHERE project_id=?").run(now.toISOString(), f.project.id);
    revoked.finish({ processCatalogRevision: f.revision(), occurrenceId: occurrence.id });
    expect((await revokedResult).status).toBe(401);
    expect(f.projectRevision()).toBe(revision);
  });

  it("gives concurrent project mapping writes one winner and rejects malformed nullable selections", async () => {
    const f = setup(); const { occurrence, workArea, process } = await seedContext(f);
    const revision = f.projectRevision();
    for (const body of [
      { processCatalogRevision: null, occurrenceId: occurrence.id },
      { processCatalogRevision: f.revision(), occurrenceId: "not-a-uuid" },
      { processCatalogRevision: f.revision(), occurrenceId: null, workAreaId: workArea.id },
      { processCatalogRevision: f.revision(), occurrenceId: occurrence.id, unknown: true },
    ]) expect((await handleMapProjectProcess(f.request(body, revision, f.editorCookie), f.project.publicId, process.id, f.d)).status).toBe(400);
    const pending = delayedRequest(f.editorCookie, revision);
    const losing = handleMapProjectProcess(pending.request, f.project.publicId, process.id, f.d);
    const winning = await handleMapProjectProcess(f.request({ processCatalogRevision: f.revision(), occurrenceId: occurrence.id, workAreaId: workArea.id }, revision, f.editorCookie), f.project.publicId, process.id, f.d);
    expect(winning.status).toBe(200);
    pending.finish({ processCatalogRevision: f.revision(), occurrenceId: null });
    expect((await losing).status).toBe(412);
    expect(f.projectRevision()).toBe(revision + 1);
    const context = f.service.context(f.project.publicId);
    expect(context.data.mappings).toHaveLength(1);
    expect(context.data.mappings[0]).toMatchObject({ occurrenceId: occurrence.id, workAreaId: workArea.id });
  });

  it("returns explicit 409 for mapped project classification changes and unsupported template snapshots", async () => {
    const f = setup(); const { occurrence, process } = await seedContext(f);
    const mapped = await handleMapProjectProcess(f.request({ processCatalogRevision: f.revision(), occurrenceId: occurrence.id }, f.projectRevision(), f.editorCookie), f.project.publicId, process.id, f.d);
    expect(mapped.status).toBe(200);
    const revision = f.projectRevision();
    const changed = await handleUpdateProject(f.request({ siteEntityId: null }, revision, f.editorCookie), f.project.publicId, { ...f.d, service: f.projectService });
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe("PROJECT_PROCESS_MAPPING_IN_USE");
    const template = await handleCreateTemplateFromProject(f.request({ sourceProjectPublicId: f.project.publicId, name: "무손실 지원 전 거부" }, revision, f.editorCookie), { ...f.d, templateService: new ProjectTemplateService(f.database, { clock: () => now }) });
    expect(template.status).toBe(409);
    expect((await template.json()).error.code).toBe("PROCESS_MAPPING_TEMPLATE_NOT_SUPPORTED");
    expect(f.projectRevision()).toBe(revision);
    expect(f.database.prepare("SELECT count(*) AS n FROM project_templates").get()).toEqual({ n: 0 });
  });
});
