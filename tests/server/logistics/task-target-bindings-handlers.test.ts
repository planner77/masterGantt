import { LegacyBindingScopeService } from "../../../src/server/logistics/legacy-binding-scope-service-core";
import { handleGetLegacyBindingSources, handleLegacyBindingScopeMutation } from "../../../src/server/logistics/legacy-binding-scope-handlers-core";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { handleGetTarget, handleMutateTarget } from "../../../src/server/logistics/logistics-targets-handlers-core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { TaskTargetBindingService } from "../../../src/server/logistics/task-target-bindings-service-core";
import { handleGetTaskTargetBindings, handlePreviewTargetUpdate, handleReplaceTaskTargetBindings } from "../../../src/server/logistics/task-target-bindings-handlers-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";

const now = new Date("2026-10-14T01:00:00Z");
const stamp = now.toISOString();
const baseUrl = "https://gantt.example.com";
const databases: Database.Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function setup() {
  const { database: db } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") });
  databases.push(db);
  const project = new ProjectRepository(db).insert({ publicId: randomUUID(), name: "Bindings HTTP", description: "", status: "planned",
    passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2),
    scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: stamp, updatedAt: stamp });
  const token = createSessionToken();
  const sessionId = new EditSessionRepository(db).insert({ projectId: project.id, tokenHash: token.tokenHash,
    authVersion: project.authVersion, createdAt: stamp, expiresAt: sessionExpiry(now).toISOString() });
  const projectService = new TaskFieldProjectService(db, { clock: () => now });
  const authorization = projectService.authorize(project.publicId, token.rawToken);
  if (authorization.kind !== "authorized") throw new Error("Missing fixture authorization");
  const logistics = new LogisticsRepository(db);
  const system = logistics.insertSystem({ publicId: randomUUID(), projectId: project.id, code: "MCS", name: "MCS", systemType: "mcs",
    layer: "coordinator", scope: "project", now: stamp });
  const secondSystem = logistics.insertSystem({ publicId: randomUUID(), projectId: project.id, code: "MCS2", name: "MCS2", systemType: "mcs",
    layer: "coordinator", scope: "project", now: stamp });
  const targets = new LogisticsTargetService(db, { clock: () => now });
  const target = targets.create(authorization.authorization, 1, { code: "A", name: "A", scope: "project_common",
    members: [{ kind: "system", entityId: system.publicId }] }).data.target!;
  const schedule = new ScheduleRepository(db);
  const addTask = (type: "task" | "summary", parentId: number | null = null) => schedule.insertTask({ projectId: project.id,
    publicId: randomUUID(), externalId: randomUUID(), name: type, type, scheduleMode: "auto", requestedStart: null,
    startDate: "2026-10-14", endDate: "2026-10-14", duration: 1, progress: 0, parentId, sortOrder: 1, createdAt: stamp, updatedAt: stamp });
  const summary = addTask("summary");
  const task = addTask("task", summary.id);
  const bindingService = new TaskTargetBindingService(db, { clock: () => now });
  const config = { projectService, applicationBaseUrl: baseUrl, environment: "production" };
  return { db, project, token, sessionId, auth: authorization.authorization, targets, target, task, summary, addTask,
    system, secondSystem, bindingService, config, deps: { ...config, service: bindingService }, targetDeps: { ...config, service: targets } };
}
type Fixture = ReturnType<typeof setup>;
const revision = (f: Fixture) => new ProjectRepository(f.db).findByPublicId(f.project.publicId)!.revision;
const whole = (f: Fixture, scope = "self") => ({ bindings: [{ targetId: f.target.id, selection: "whole", scope, memberIds: [] }] });
function request(f: Fixture, method = "PUT", body: unknown = whole(f), overrides: Record<string, string | null> = {}, query = "") {
  const headers = new Headers({ Origin: baseUrl, Cookie: `${editSessionCookieName("production", new URL(baseUrl))}=${f.token.rawToken}`,
    "If-Match": `"${revision(f)}"`, "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(overrides)) { if (value === null) headers.delete(key); else headers.set(key, value); }
  return new Request(`${baseUrl}/api/projects/${f.project.publicId}/tasks/${f.task.publicId}/target-bindings${query}`,
    { method, headers, ...(method === "GET" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
}
const snapshot = (f: Fixture) => ({ revision: revision(f), bindings: f.db.prepare("SELECT * FROM task_target_bindings ORDER BY id").all(),
  members: f.db.prepare("SELECT * FROM task_target_binding_members ORDER BY binding_id,member_id").all() });
const changes = (f: Fixture) => (f.db.prepare("SELECT total_changes() AS count").get() as { count: number }).count;

describe("Issue #617 binding HTTP authorization and atomicity (AC4/AC6/AC8)", () => {
  it.each([
    ["missing Origin", { Origin: null }, 403],
    ["foreign Origin", { Origin: "https://foreign.example" }, 403],
    ["missing edit session", { Cookie: null }, 401],
    ["forged edit session", { Cookie: "__Host-mastergantt_edit=forged" }, 401],
    ["missing revision", { "If-Match": null }, 428],
    ["weak revision", { "If-Match": 'W/"2"' }, 400],
    ["revision wildcard", { "If-Match": "*" }, 400],
    ["multiple revisions", { "If-Match": '"2", "3"' }, 400],
    ["stale revision", { "If-Match": '"1"' }, 412],
    ["wrong content type", { "Content-Type": "text/plain" }, 415],
    ["encoded body", { "Content-Encoding": "gzip" }, 415],
    ["oversized declared body", { "Content-Length": "32769" }, 413],
  ] as const)("rejects %s without changing persistent bindings", async (_name, overrides, status) => {
    const f = setup(), before = snapshot(f);
    const response = await handleReplaceTaskTargetBindings(request(f, "PUT", whole(f), overrides), f.project.publicId, f.task.publicId, f.deps);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(snapshot(f)).toEqual(before);
  });

  it("reads readonly/edit permissions, all sources, and current strong revision without creating rows", async () => {
    const f = setup();
    f.bindingService.replace(f.auth, revision(f), f.summary.publicId, whole(f, "subtree"));
    const before = snapshot(f);
    const beforeChanges = changes(f);
    const readonly = handleGetTaskTargetBindings(request(f, "GET", undefined, { Cookie: null }), f.project.publicId, f.task.publicId, f.deps);
    expect(readonly.status).toBe(200);
    expect(readonly.headers.get("ETag")).toBe(`"${before.revision}"`);
    const body = await readonly.json();
    expect(body.data.permission).toBe("readonly");
    expect(body.data.bindings).toEqual([]);
    expect(body.data.effective.inheritedBindings).toHaveLength(1);
    const edit = handleGetTaskTargetBindings(request(f, "GET"), f.project.publicId, f.task.publicId, f.deps);
    expect((await edit.json()).data.permission).toBe("edit");
    expect(snapshot(f)).toEqual(before);
    expect(changes(f)).toBe(beforeChanges);
  });

  it("replaces and clears explicit rows, retaining inherited rows and incrementing revision once", async () => {
    const f = setup();
    f.bindingService.replace(f.auth, revision(f), f.summary.publicId, whole(f, "subtree"));
    const before = revision(f);
    const replace = await handleReplaceTaskTargetBindings(request(f), f.project.publicId, f.task.publicId, f.deps);
    expect(replace.status).toBe(200);
    expect(replace.headers.get("ETag")).toBe(`"${before + 1}"`);
    expect((await replace.json()).data.bindings).toHaveLength(1);
    const clear = await handleReplaceTaskTargetBindings(request(f, "PUT", { bindings: [] }), f.project.publicId, f.task.publicId, f.deps);
    expect(clear.status).toBe(200);
    const body = await clear.json();
    expect(body.data.bindings).toEqual([]);
    expect(body.data.effective.inheritedBindings).toHaveLength(1);
    expect(revision(f)).toBe(before + 2);
  });

  it("rejects malformed/unknown parameters and unavailable IDs without a mutation", async () => {
    const f = setup(), before = snapshot(f);
    for (const raw of ["{", JSON.stringify({ bindings: [], ignored: true }), JSON.stringify({ bindings: [{ ...whole(f).bindings[0], targetId: randomUUID() }] }),
      JSON.stringify({ bindings: [{ ...whole(f).bindings[0], selection: "subset", memberIds: [randomUUID()] }] }), " ".repeat(32769)]) {
      const response = await handleReplaceTaskTargetBindings(request(f, "PUT", raw), f.project.publicId, f.task.publicId, f.deps);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(snapshot(f)).toEqual(before);
    }
    expect((await handleReplaceTaskTargetBindings(request(f, "PUT", whole(f), {}, "?ignored=1"), f.project.publicId, f.task.publicId, f.deps)).status).toBe(400);
    expect(handleGetTaskTargetBindings(request(f, "GET", undefined, {}, "?ignored=1"), f.project.publicId, f.task.publicId, f.deps).status).toBe(400);
    expect(handleGetTaskTargetBindings(request(f, "GET"), randomUUID(), f.task.publicId, f.deps).status).toBe(404);
    expect(handleGetTaskTargetBindings(request(f, "GET"), f.project.publicId, randomUUID(), f.deps).status).toBe(404);
    expect(snapshot(f)).toEqual(before);
  });

  it("rejects an existing foreign-project Task and a valid foreign-project edit cookie", async () => {
    const f = setup();
    const foreignProject = new ProjectRepository(f.db).insert({ publicId: randomUUID(), name: "Other project", description: "", status: "planned",
      passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2),
      scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: stamp, updatedAt: stamp });
    const foreignTask = new ScheduleRepository(f.db).insertTask({ projectId: foreignProject.id, publicId: randomUUID(), externalId: randomUUID(),
      name: "Foreign Task", type: "task", scheduleMode: "auto", requestedStart: null, startDate: "2026-10-14", endDate: "2026-10-14",
      duration: 1, progress: 0, parentId: null, sortOrder: 1, createdAt: stamp, updatedAt: stamp });
    const foreignToken = createSessionToken();
    new EditSessionRepository(f.db).insert({ projectId: foreignProject.id, tokenHash: foreignToken.tokenHash, authVersion: foreignProject.authVersion,
      createdAt: stamp, expiresAt: sessionExpiry(now).toISOString() });
    const before = snapshot(f);
    expect(handleGetTaskTargetBindings(request(f, "GET"), f.project.publicId, foreignTask.publicId, f.deps).status).toBe(404);
    expect((await handleReplaceTaskTargetBindings(request(f), f.project.publicId, foreignTask.publicId, f.deps)).status).toBe(404);
    const cookie = `${editSessionCookieName("production", new URL(baseUrl))}=${foreignToken.rawToken}`;
    expect((await handleReplaceTaskTargetBindings(request(f, "PUT", whole(f), { Cookie: cookie }), f.project.publicId, f.task.publicId, f.deps)).status).toBe(401);
    expect(snapshot(f)).toEqual(before);
  });

  it("rechecks revision after asynchronous request body consumption", async () => {
    const f = setup(), old = revision(f);
    const raw = JSON.stringify(whole(f));
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      f.bindingService.replace(f.auth, old, f.summary.publicId, whole(f));
      controller.enqueue(new TextEncoder().encode(raw)); controller.close();
    } });
    const req = new Request(request(f).url, { method: "PUT", headers: request(f).headers, body: stream, duplex: "half" } as RequestInit);
    const result = await handleReplaceTaskTargetBindings(req, f.project.publicId, f.task.publicId, f.deps);
    expect(result.status).toBe(412);
    expect(f.bindingService.get(f.project.publicId, f.task.publicId).bindings).toEqual([]);
    expect(revision(f)).toBe(old + 1);
  });

  it("rechecks revoked edit session after asynchronous request body consumption", async () => {
    const f = setup(), before = snapshot(f);
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      f.db.prepare("UPDATE edit_sessions SET revoked_at=? WHERE id=?").run(stamp, f.sessionId);
      controller.enqueue(new TextEncoder().encode(JSON.stringify(whole(f)))); controller.close();
    } });
    const req = new Request(request(f).url, { method: "PUT", headers: request(f).headers, body: stream, duplex: "half" } as RequestInit);
    const result = await handleReplaceTaskTargetBindings(req, f.project.publicId, f.task.publicId, f.deps);
    expect(result.status).toBe(401);
    expect(snapshot(f)).toEqual(before);
  });

  it("requires revision/edit/Origin for a stateless Target impact preview and rejects stale confirmation", async () => {
    const f = setup();
    f.bindingService.replace(f.auth, revision(f), f.task.publicId, whole(f));
    const patch = { members: [{ kind: "system", entityId: f.system.publicId }, { kind: "system", entityId: f.secondSystem.publicId }] };
    const before = snapshot(f);
    const beforeChanges = changes(f);
    for (const [headers, status] of [[{ Cookie: null }, 401], [{ Origin: null }, 403], [{ "If-Match": null }, 428], [{ "If-Match": '"1"' }, 412]] as const) {
      expect((await handlePreviewTargetUpdate(request(f, "POST", patch, headers), f.project.publicId, f.target.id, f.targetDeps)).status).toBe(status);
      expect(snapshot(f)).toEqual(before);
    }
    const preview = await handlePreviewTargetUpdate(request(f, "POST", patch), f.project.publicId, f.target.id, f.targetDeps);
    expect(preview.status).toBe(200);
    const receipt = (await preview.json()).data;
    expect(receipt.impactToken).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.affectedTaskIds).toContain(f.task.publicId);
    expect(snapshot(f)).toEqual(before);
    expect(changes(f)).toBe(beforeChanges);
    f.bindingService.replace(f.auth, revision(f), f.summary.publicId, whole(f));
    const stale = await handleMutateTarget(request(f, "PATCH", { ...patch, impactToken: receipt.impactToken, confirmImpact: true }), f.project.publicId,
      f.targetDeps, "update", f.target.id);
    expect(stale.status).toBe(412);
    expect((await stale.json()).error.code).toBe("TARGET_IMPACT_STALE");
    expect(f.targets.get(f.project.publicId, f.target.id).members).toHaveLength(1);
  });

  it("preserves nullable unsupport semantics at HTTP boundary and reports calculated distinct zero/N separately from Summary", async () => {
    const f = setup();
    const getUsage = () => handleGetTarget(request(f, "GET"), f.project.publicId, f.target.id, f.targetDeps, true);
    let value = (await getUsage().json()).data;
    expect(value.referencedByTaskCount).toBe(0);
    expect(value.referencedBySummaryCount).toBe(0);
    f.bindingService.replace(f.auth, revision(f), f.summary.publicId, whole(f, "subtree"));
    f.bindingService.replace(f.auth, revision(f), f.task.publicId, whole(f));
    value = (await getUsage().json()).data;
    expect(value.referencedByTaskCount).toBe(1);
    expect(value.referencedBySummaryCount).toBe(1);
    const original = f.targets.usage.bind(f.targets);
    f.targets.usage = (projectId, targetId) => ({ ...original(projectId, targetId), referencedByTaskCount: null, referencedBySummaryCount: null });
    value = (await getUsage().json()).data;
    expect(value.referencedByTaskCount).toBeNull();
    expect(value.referencedBySummaryCount).toBeNull();
  });
});

/** #792 extends the actual SQLite/HTTP archive tests instead of creating a duplicate fixture. */
describe("Issue #792 protected legacy binding scope writer", () => {
  function legacyRequest(f: Fixture, taskId: string, method: "GET" | "POST" | "PATCH",
    body?: unknown, overrides: Record<string,string|null> = {}, query = "") {
    const seed = request(f, "PUT", {}, overrides);
    const headers = new Headers(seed.headers);
    const url = seed.url.replace(f.task.publicId, taskId).replace("/target-bindings", "/legacy-binding-sources") + query;
    return new Request(url, { method, headers, ...(method === "GET" ? {} : {
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) });
  }
  function deps(f: Fixture) {
    return { ...f.config, service: new LegacyBindingScopeService(f.db, () => now) };
  }
  it.each(["whole", "subset"] as const)("previews then edits %s original scope in place, preserving identity, dynamic selection and member rows", async selection => {
    const f = setup();
    const memberId = f.target.members[0].id;
    f.bindingService.replace(f.auth, revision(f), f.summary.publicId, { bindings: [{
      targetId:f.target.id,scope:"self",selection,
      memberIds:selection === "whole" ? [] : [memberId],
      ...(selection === "whole" ? {} : {coverageByMember:[{memberId,coverage:null}]}),
    }] });
    const d = deps(f), oldRevision = revision(f), oldSnapshot = snapshot(f);
    const get = handleGetLegacyBindingSources(legacyRequest(f,f.summary.publicId,"GET"),f.project.publicId,f.summary.publicId,d);
    expect(get.status).toBe(200);
    const original = (await get.json()).data.sourceBindings[0];
    expect(original).toMatchObject({scope:"self",selection,canEditScope:true,memberCount:1});
    expect(snapshot(f)).toEqual(oldSnapshot);
    const patch = {sourceId:original.sourceId,scope:"subtree",sourceFingerprint:original.sourceFingerprint};
    const preview = await handleLegacyBindingScopeMutation(legacyRequest(f,f.summary.publicId,"POST",patch),
      f.project.publicId,f.summary.publicId,d,"preview");
    expect(preview.status).toBe(200);
    const proposal=(await preview.json()).data;
    expect(proposal.affectedTaskIds).toContain(f.task.publicId);
    expect(proposal.memberCount).toBe(1);
    expect(snapshot(f)).toEqual(oldSnapshot);
    const wrong = await handleLegacyBindingScopeMutation(legacyRequest(f,f.summary.publicId,"PATCH",
      {...patch,confirmImpact:true,impactToken:"0".repeat(64)}),f.project.publicId,f.summary.publicId,d,"apply");
    expect(wrong.status).toBe(409);
    expect(snapshot(f)).toEqual(oldSnapshot);
    const applied = await handleLegacyBindingScopeMutation(legacyRequest(f,f.summary.publicId,"PATCH",
      {...patch,confirmImpact:true,impactToken:proposal.impactToken}),f.project.publicId,f.summary.publicId,d,"apply");
    expect(applied.status).toBe(200);
    expect(applied.headers.get("ETag")).toBe(`"${oldRevision+1}"`);
    const after=snapshot(f);
    expect(after.revision).toBe(oldRevision+1);
    expect(after.members).toEqual(oldSnapshot.members);
    expect(after.bindings).toEqual(oldSnapshot.bindings.map((binding: Record<string,unknown>) =>
      binding.public_id === original.sourceId ? {...binding,scope:"subtree"} : binding));
    expect(f.bindingService.get(f.project.publicId,f.task.publicId).effective.inheritedBindings[0].id)
      .toBe(original.sourceId);
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });

  it("rejects unconfirmed, stale, foreign, invalid and unauthorized changes without touching any row", async () => {
    const f=setup(),d=deps(f);
    f.bindingService.replace(f.auth,revision(f),f.summary.publicId,whole(f,"self"));
    const source=(await handleGetLegacyBindingSources(legacyRequest(f,f.summary.publicId,"GET"),
      f.project.publicId,f.summary.publicId,d).json()).data.sourceBindings[0];
    const patch={sourceId:source.sourceId,scope:"subtree",sourceFingerprint:source.sourceFingerprint};
    const preview=(await (await handleLegacyBindingScopeMutation(legacyRequest(f,f.summary.publicId,"POST",patch),
      f.project.publicId,f.summary.publicId,d,"preview")).json()).data;
    const baseline=snapshot(f);
    const tries = [
      {method:"PATCH",body:patch,headers:{},status:422},
      {method:"PATCH",body:{...patch,confirmImpact:true,impactToken:"f".repeat(64)},headers:{},status:409},
      {method:"PATCH",body:{...patch,confirmImpact:true,impactToken:preview.impactToken},headers:{Origin:null},status:403},
      {method:"PATCH",body:{...patch,confirmImpact:true,impactToken:preview.impactToken},headers:{Cookie:null},status:401},
      {method:"PATCH",body:{...patch,confirmImpact:true,impactToken:preview.impactToken},headers:{"If-Match":null},status:428},
      {method:"PATCH",body:{...patch,confirmImpact:true,impactToken:preview.impactToken},headers:{"If-Match":'"1"'},status:412},
      {method:"POST",body:{...patch,ignored:true},headers:{},status:422},
      {method:"POST",body:{...patch,sourceFingerprint:"a".repeat(64)},headers:{},status:409},
      {method:"POST",body:{...patch,sourceId:randomUUID()},headers:{},status:404},
      {method:"POST",body:{...patch,scope:"changed"},headers:{},status:422},
    ] as const;
    for (const entry of tries) {
      const result=await handleLegacyBindingScopeMutation(legacyRequest(f,f.summary.publicId,entry.method,entry.body,
        entry.headers),f.project.publicId,f.summary.publicId,d,entry.method === "POST" ? "preview":"apply");
      expect(result.status).toBe(entry.status);
      expect(snapshot(f)).toEqual(baseline);
    }
    expect(handleGetLegacyBindingSources(legacyRequest(f,f.summary.publicId,"GET",undefined,{}, "?bad=1"),
      f.project.publicId,f.summary.publicId,d).status).toBe(400);
    expect(handleGetLegacyBindingSources(legacyRequest(f,f.summary.publicId,"GET"),
      randomUUID(),f.summary.publicId,d).status).toBe(404);
    expect(handleGetLegacyBindingSources(legacyRequest(f,randomUUID(),"GET"),
      f.project.publicId,randomUUID(),d).status).toBe(404);
    const childSource=(await handleGetLegacyBindingSources(legacyRequest(f,f.task.publicId,"GET"),
      f.project.publicId,f.task.publicId,d).json()).data.sourceBindings;
    expect(childSource).toEqual([]); // inherited sources are never rewritten as direct child rows
    f.db.prepare("UPDATE edit_sessions SET revoked_at=? WHERE id=?").run(stamp,f.sessionId);
    const revoked=await handleLegacyBindingScopeMutation(legacyRequest(f,f.summary.publicId,"PATCH",
      {...patch,confirmImpact:true,impactToken:preview.impactToken}),f.project.publicId,f.summary.publicId,d,"apply");
    expect(revoked.status).toBe(401);
    expect(snapshot(f)).toEqual(baseline);
  });
});
