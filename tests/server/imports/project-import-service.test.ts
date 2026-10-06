import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { validateProjectImportPayload } from "../../../src/contracts/import";
import { resolveProjectWorkingCalendar } from "../../../src/server/calendars/calendar-resolution-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ProjectImportService } from "../../../src/server/imports/project-import-service-core";
import { handleProjectImport } from "../../../src/server/imports/project-import-handlers-core";
import { ProjectJsonExportService, buildProjectJsonExport } from "../../../src/server/exports/project-json-export-core";
import { handleProjectJsonExport } from "../../../src/server/exports/project-json-export-handler-core";
import type { ImportPayload11 } from "../../../src/contracts/import";
import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
const clock = () => new Date("2026-10-06T01:00:00.000Z");
const hashPassword = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const databases: ReturnType<typeof openDatabase>["database"][] = [], directories: string[] = [];
afterEach(() => { databases.splice(0).forEach(db => { if (db.open) db.close(); }); directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
const leaf = (externalId = "T", extra: object = {}) => ({ externalId, name: externalId, type: "task", parentExternalId: null, requestedStart: "2026-10-05", duration: 2, progress: 0, status: "not_started", predecessors: [], ...extra });
const bytes = (tasks: object[] = [leaf()], extra: object = {}) => new TextEncoder().encode(JSON.stringify({ schemaVersion: "1.1", project: { name: "Import source", description: "advisory" }, tasks, ...extra }));
async function fixture(filename = ":memory:") {
  const db = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database; databases.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword });
  const created = await projects.create({ name: "Target", description: "unchanged", editPassword: "test", ownerName: "owner" });
  const publicId = created.response.data.project.publicId, token = created.rawSessionToken;
  const service = new ProjectImportService(db, { clock, projectService: projects });
  const snapshot = () => projects.getReadonlySnapshot(publicId)!;
  const state = () => ({ tasks: db.prepare("SELECT * FROM tasks ORDER BY id").all(), links: db.prepare("SELECT * FROM links ORDER BY id").all(), memberships: db.prepare("SELECT * FROM task_milestone_memberships ORDER BY member_task_id").all(), revision: snapshot().data.project.revision });
  const request = (body: Uint8Array, headers: Record<string, string> = {}) => new Request(`https://gantt.example.com/api/projects/${publicId}/imports`, { method: "POST", headers: { Origin: "https://gantt.example.com", Cookie: `__Host-mastergantt_edit=${token}`, "Content-Type": "application/json", ...headers }, body: new Uint8Array(body).buffer });
  const deps = { service, environment: "production", applicationBaseUrl: "https://gantt.example.com" };
  const preview = (file: Uint8Array) => service.preview(publicId, token, file);
  const commit = (file: Uint8Array) => { const p = preview(file); return service.commit(publicId, token, p.baseRevision, p.previewDigest, file); };
  return { db, projects, service, publicId, token, snapshot, state, request, deps, preview, commit };
}
describe("project import HTTP and SQLite atomic contract", () => {
  it("creates forward references and inherited/override membership atomically using new UUIDs", async () => {
    const f = await fixture(), sourceId = randomUUID();
    const file = bytes([leaf("C", { parentExternalId: "S", sourceTaskId: sourceId, description: " detail ", url: " https://example.com/a ", baseline: { start: "2026-10-08", duration: 2 } }), { externalId: "S", name: "Summary", type: "summary", parentExternalId: null, predecessors: [] }, leaf("M", { type: "milestone", duration: 0 })], { memberships: [{ taskExternalId: "S", milestoneExternalId: "M" }, { taskExternalId: "C", milestoneExternalId: null }] });
    const before = f.state(), p = f.preview(file); expect(f.state()).toEqual(before); expect(p.summary).toEqual({ taskCreates: 3, linkCreates: 0, explicitMembershipCreates: 1 });
    expect(p.normalizedTasks.find(t => t.externalId === "C")?.membership).toMatchObject({ effectiveMilestoneExternalId: "M", inheritedFromExternalId: "S" });
    const response = await handleProjectImport(f.request(file, { "If-Match": `"${p.baseRevision}"`, "X-Import-Preview-Digest": p.previewDigest }), f.publicId, f.deps);
    expect(response.status).toBe(201); const result = await response.json() as ProjectSnapshotResponse; expect(result.data.permission).toBe("edit"); expect(result.data.project).toMatchObject({ revision: 2, name: "Target", description: "unchanged" });
    const c = result.data.tasks.find(t => t.externalId === "C")!, s = result.data.tasks.find(t => t.externalId === "S")!, m = result.data.tasks.find(t => t.externalId === "M")!;
    expect(c.taskId).not.toBe(sourceId); expect(c.taskId).toMatch(/^[a-f0-9-]{36}$/); expect(c.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: m.taskId, inheritedFromTaskId: s.taskId });
    expect(c).toMatchObject({ description: " detail ", url: "https://example.com/a", baselineStart: "2026-10-08", baselineDuration: 2, baselineEnd: "2026-10-12" });
    expect(f.db.prepare("SELECT count(*) FROM task_milestone_memberships").pluck().get()).toBe(1);
  });
  it("roundtrips schedule-stage JSON with requestedStart/status/baseline/links and independent new IDs", async () => {
    const a = await fixture(); a.commit(bytes([leaf("T1", { progress: 100, status: "completed", baseline: { start: "2026-10-08", duration: 2 } }), leaf("T2", { status: "in_progress", predecessors: [{ externalId: "T1", type: "SS", lag: 1 }] }), leaf("M", { type: "milestone", duration: 0 })], { memberships: [{ taskExternalId: "T2", milestoneExternalId: "M" }] }));
    const file = new ProjectJsonExportService(a.db, { clock }).get(a.publicId, 2)!;
    const exported = JSON.parse(new TextDecoder().decode(file)) as ImportPayload11; expect(exported.source).toMatchObject({ projectPublicId: a.publicId, projectRevision: 2, contentScope: "schedule-stage" }); expect(exported.tasks.find(t => t.externalId === "T2")).toMatchObject({ requestedStart: "2026-10-05", status: "in_progress" });
    const b = await fixture(); const imported = b.commit(file); const from = a.snapshot();
    expect(imported.data.links.map(l => ({ predecessorExternalId: l.predecessorExternalId, successorExternalId: l.successorExternalId, type: l.type, lag: l.lag }))).toEqual(from.data.links.map(l => ({ predecessorExternalId: l.predecessorExternalId, successorExternalId: l.successorExternalId, type: l.type, lag: l.lag })));
    for (const task of imported.data.tasks) { const original = from.data.tasks.find(t => t.externalId === task.externalId)!; expect(task.taskId).not.toBe(original.taskId); expect({ ...task, taskId: null, membership: null, stageGate: null }).toEqual({ ...original, taskId: null, membership: null, stageGate: null }); }
    expect(imported.data.tasks.find(t => t.externalId === "M")?.stageGate).toMatchObject({ ready: false, memberCount: 1 });
  });
  it.each(["missing-cookie", "bad-origin", "stale", "weak", "missing-digest", "different-bytes"])("rejects commit %s without writes", async kind => {
    const f = await fixture(), file = bytes(), p = f.preview(file), before = f.state();
    const headers: Record<string, string> = { "If-Match": `"${p.baseRevision}"`, "X-Import-Preview-Digest": p.previewDigest };
    if (kind === "missing-cookie") headers.Cookie = ""; if (kind === "bad-origin") headers.Origin = "https://other.example.com"; if (kind === "stale") headers["If-Match"] = '"2"'; if (kind === "weak") headers["If-Match"] = 'W/"1"'; if (kind === "missing-digest") delete headers["X-Import-Preview-Digest"];
    const r = await handleProjectImport(f.request(kind === "different-bytes" ? new TextEncoder().encode(new TextDecoder().decode(file) + " ") : file, headers), f.publicId, f.deps);
    expect(r.status).toBe(({ "missing-cookie": 401, "bad-origin": 403, stale: 412, weak: 400, "missing-digest": 428, "different-bytes": 409 })[kind]); expect(f.state()).toEqual(before);
  });
  it("preview requires session and leaves revision unchanged, with no If-Match requirement", async () => { const f = await fixture(); expect((await handleProjectImport(f.request(bytes(), { Cookie: "" }), f.publicId, f.deps, true)).status).toBe(401); const r = await handleProjectImport(f.request(bytes()), f.publicId, f.deps, true); expect(r.status).toBe(200); expect((await r.json()).data.baseRevision).toBe(1); expect(f.state().revision).toBe(1); });
  it("rejects invalid metadata and foreign explicit references before any writes", async () => { const f = await fixture(), before = f.state(); for (const file of [bytes([leaf("T", { url: "javascript:alert(1)" })]), bytes(undefined, { memberships: [{ taskExternalId: "T", milestoneExternalId: randomUUID() }] })]) expect(() => f.preview(file)).toThrow(); expect(f.state()).toEqual(before); });
  it("rejects stale target identity digest and rechecks DB external ID collision", async () => { const a = await fixture(), b = await fixture(), file = bytes(), p = a.preview(file); expect(() => b.service.commit(b.publicId, b.token, 1, p.previewDigest, file)).toThrow("target Project"); a.commit(file); expect(() => a.preview(file)).toThrow("external ID"); expect(a.state().tasks).toHaveLength(1); });
  it("enforces Completed Milestone full member/predecessor guard and preserves manual empty events", async () => {
    const f = await fixture(), before = f.state();
    const notReady = bytes([leaf("T"), leaf("M", { type: "milestone", duration: 0, progress: 100, status: "completed" })], { memberships: [{ taskExternalId: "T", milestoneExternalId: "M" }] });
    expect(() => f.preview(notReady)).toThrow("MILESTONE_NOT_READY"); expect(f.state()).toEqual(before);
    const blocked = bytes([leaf("P", { type: "milestone", duration: 0 }), leaf("M", { type: "milestone", duration: 0, progress: 100, status: "completed", predecessors: [{ externalId: "P" }] })]); expect(() => f.preview(blocked)).toThrow("MILESTONE_NOT_READY");
    const valid = f.commit(bytes([leaf("M", { type: "milestone", duration: 0, progress: 100, status: "completed" })])); expect(valid.data.tasks[0].stageGate).toMatchObject({ memberProgressPercent: null, ready: null });
  });
  it("rejects incoming legacy mixed whole batches in both versions, while exports preserve every source link", async () => {
    const f = await fixture(), file = bytes([leaf("T"), leaf("M", { type: "milestone", duration: 0, predecessors: [{ externalId: "T" }] })]), before = f.state(); expect(() => f.preview(file)).toThrow("mixed Task/Milestone"); expect(f.state()).toEqual(before);
    const legacy = JSON.parse(new TextDecoder().decode(file)); legacy.schemaVersion = "1.0"; for (const task of legacy.tasks) { task.start = task.requestedStart; delete task.requestedStart; delete task.status; } expect(() => f.preview(new TextEncoder().encode(JSON.stringify(legacy)))).toThrow("mixed Task/Milestone");
    f.commit(bytes([leaf("T"), leaf("M", { type: "milestone", duration: 0 })])); const repo = new ScheduleRepository(f.db), auth = f.projects.authorize(f.publicId, f.token); if (auth.kind !== "authorized") throw new Error("auth"); const tasks = repo.listTasks(auth.authorization.projectId);
    repo.insertLink({ projectId: auth.authorization.projectId, publicId: randomUUID(), predecessorTaskId: tasks.find(t => t.externalId === "T")!.id, successorTaskId: tasks.find(t => t.externalId === "M")!.id, type: "FS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    const exported = buildProjectJsonExport(f.snapshot(), clock().toISOString()); expect(exported.tasks.find(t => t.externalId === "M")?.predecessors).toEqual([{ externalId: "T", type: "FS", lag: 0 }]); const g = await fixture(); const gBefore = g.state(); expect(() => g.preview(new TextEncoder().encode(JSON.stringify(exported)))).toThrow("mixed Task/Milestone"); expect(g.state()).toEqual(gBefore);
  });
  it("rolls back Task, membership and link writes if revision update fails", async () => { const f = await fixture(), file = bytes([leaf("T1"), leaf("T2", { predecessors: [{ externalId: "T1" }] }), leaf("M", { type: "milestone", duration: 0 })], { memberships: [{ taskExternalId: "T1", milestoneExternalId: "M" }] }), p = f.preview(file), before = f.state(); f.db.exec("CREATE TRIGGER fail_import_revision BEFORE UPDATE OF revision ON projects BEGIN SELECT RAISE(ABORT,'forced'); END;"); expect(() => f.service.commit(f.publicId, f.token, p.baseRevision, p.previewDigest, file)).toThrow("forced"); expect(f.state()).toEqual(before); });
  it("returns empty export/preview but rejects empty commit with no revision change", async () => { const f = await fixture(), json = new ProjectJsonExportService(f.db, { clock }).get(f.publicId, 1)!, p = f.preview(json); expect(p).toMatchObject({ canCommit: false, summary: { taskCreates: 0, linkCreates: 0, explicitMembershipCreates: 0 } }); expect(() => f.service.commit(f.publicId, f.token, 1, p.previewDigest, json)).toThrow("no Tasks"); expect(f.state()).toMatchObject({ tasks: [], revision: 1 }); });
  it("rechecks revoked session inside transaction and rejects invalid bodies before parsing when readonly", async () => { const f = await fixture(), file = bytes(), p = f.preview(file), before = f.state(); f.db.prepare("UPDATE edit_sessions SET revoked_at=?").run(clock().toISOString()); const r = await handleProjectImport(f.request(new Uint8Array([0xff]), { "If-Match": '"1"', "X-Import-Preview-Digest": p.previewDigest }), f.publicId, f.deps); expect(r.status).toBe(401); expect(f.state()).toEqual(before); });
  it("does not use advisory source UUID as foreign key or source calendar as target authority", async () => { const f = await fixture(), file = bytes([leaf("T", { sourceTaskId: randomUUID(), baseline: { start: "2026-10-08", duration: 2 } })], { source: { projectPublicId: randomUUID(), projectRevision: 4, exportedAt: clock().toISOString(), contentScope: "schedule-stage", calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [], exceptions: [{ date: "2026-10-09", dayType: "WORKING", name: "source Friday" }] } } }); const p = f.preview(file); expect(p.changedTasks[0]).toMatchObject({ before: { baselineEnd: "2026-10-09" }, after: { baselineEnd: "2026-10-12" } }); expect(p.warnings.map(w => w.code)).toContain("SOURCE_CALENDAR_IGNORED"); expect(f.commit(file).data.tasks[0].baselineEnd).toBe("2026-10-12"); });
  it("rejects task budgets and never widens the target to fit a file", async () => {
    const f = await fixture(), before = f.state(); expect(() => f.preview(bytes(Array.from({ length: 5001 }, (_, i) => leaf(`N${i}`))))).toThrow("budget"); expect(f.state()).toEqual(before);
    f.commit(bytes()); const current = f.state(); expect(() => f.preview(bytes(Array.from({ length: 5000 }, (_, i) => leaf(`N${i}`))))).toThrow("limits"); expect(f.state()).toEqual(current);
  });
  it("1.0 omitted status follows existing progress normalization and Completed M guard", async () => {
    const f = await fixture(), source = { schemaVersion: "1.0", project: { name: "P", description: "" }, tasks: [{ externalId: "T", name: "T", type: "task", parentExternalId: null, start: "2026-10-06", duration: 1, progress: 100, predecessors: [] }] };
    expect(f.commit(new TextEncoder().encode(JSON.stringify(source))).data.tasks[0].status).toBe("completed");
    source.tasks = [{ externalId: "M1", name: "M1", type: "milestone", parentExternalId: null, start: "2026-10-06", duration: 0, progress: 0, predecessors: [] }, { externalId: "M2", name: "M2", type: "milestone", parentExternalId: null, start: "2026-10-06", duration: 0, progress: 100, predecessors: [{ externalId: "M1" }] }] as unknown as typeof source.tasks;
    expect(() => f.preview(new TextEncoder().encode(JSON.stringify(source)))).toThrow("MILESTONE_NOT_READY");
  });
  it("rolls back when allocated UUIDs collide and never reuses source IDs", async () => {
    const f = await fixture(); const original = f.commit(bytes()).data.tasks[0], before = f.state(), file = bytes([leaf("new")]);
    const collisionService = new ProjectImportService(f.db, { clock, projectService: f.projects, generatePublicId: () => original.taskId }); const p = collisionService.preview(f.publicId, f.token, file);
    expect(() => collisionService.commit(f.publicId, f.token, p.baseRevision, p.previewDigest, file)).toThrow("identity allocation"); expect(f.state()).toEqual(before);
  });
  it("HTTP enforces malformed UTF-8, duplicate keys and request bounds after authorization", async () => {
    const f = await fixture(), before = f.state();
    const cases = [{ body: new Uint8Array([0xff]), status: 400 }, { body: new TextEncoder().encode('{"x":1,"\\u0078":2}'), status: 400 }, { body: new Uint8Array(5 * 1024 * 1024 + 1), status: 413 }];
    for (const { body, status } of cases) expect((await handleProjectImport(f.request(body), f.publicId, f.deps, true)).status).toBe(status); expect(f.state()).toEqual(before);
  });
  it("persists across SQLite close/reopen and creates only one revision", async () => { const dir = mkdtempSync(join(tmpdir(), "import-test-")); directories.push(dir); const filename = join(dir, "test.sqlite"), f = await fixture(filename); f.commit(bytes()); f.db.close(); const db = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database; databases.push(db); expect(new TaskFieldProjectService(db, { clock }).getReadonlySnapshot(f.publicId)?.data.project.revision).toBe(2); expect(db.prepare("SELECT count(*) FROM tasks").pluck().get()).toBe(1); });
});
describe("readonly JSON export HTTP contract", () => {
  it("exports full empty JSON without session, with Origin and strong revision", async () => { const f = await fixture(); const service = new ProjectJsonExportService(f.db, { clock }); const r = await handleProjectJsonExport(f.request(new TextEncoder().encode('{"scope":"project"}'), { Cookie: "", "If-Match": '"1"' }), f.publicId, { ...f.deps, service }); expect(r.status).toBe(200); expect(r.headers.get("etag")).toBe('"1"'); expect(r.headers.get("content-type")).toContain("import+json"); expect((await r.json()).tasks).toEqual([]); expect(f.state().revision).toBe(1); });
  it("exports and revalidates 100 incoming links but rejects canonical 101 without a partial file or writes", async () => {
    const f = await fixture(); f.commit(bytes([...Array.from({ length: 101 }, (_, i) => leaf(`P${i}`)), leaf("Join")]));
    const auth = f.projects.authorize(f.publicId, f.token); if (auth.kind !== "authorized") throw new Error("auth");
    const links = new LinkService(f.db, clock);
    for (let i = 0; i < 100; i++) links.create(auth.authorization, f.snapshot().data.project.revision, { predecessorExternalId: `P${i}`, successorExternalId: "Join", type: "SS", lag: 0 });
    const service = new ProjectJsonExportService(f.db, { clock });
    const output = JSON.parse(new TextDecoder().decode(service.get(f.publicId, f.snapshot().data.project.revision)));
    expect(output.tasks.find((t: { externalId: string }) => t.externalId === "Join").predecessors).toHaveLength(100);
    expect(validateProjectImportPayload(output, resolveProjectWorkingCalendar(f.db, auth.authorization.projectId)).success).toBe(true);
    links.create(auth.authorization, f.snapshot().data.project.revision, { predecessorExternalId: "P100", successorExternalId: "Join", type: "SS", lag: 0 });
    const before = f.state(), revision = f.snapshot().data.project.revision;
    const response = await handleProjectJsonExport(f.request(new TextEncoder().encode('{"scope":"project"}'), { "If-Match": `"${revision}"` }), f.publicId, { ...f.deps, service });
    expect(response.status).toBe(422); expect(response.headers.get("Content-Disposition")).toBeNull(); expect(response.headers.get("Content-Type")).not.toContain("import+json");
    const rejected = await response.json(); expect(rejected.error.code).toBe("EXPORT_LIMIT_EXCEEDED"); expect(rejected.data).toBeUndefined(); expect(rejected.tasks).toBeUndefined(); expect(f.state()).toEqual(before);
  });
  it("rejects a legitimate large JSON export instead of truncating schedule rows", async () => {
    const f = await fixture(); f.commit(bytes());
    const auth = f.projects.authorize(f.publicId, f.token); if (auth.kind !== "authorized") throw new Error("auth");
    const repo = new ScheduleRepository(f.db), original = repo.listTasks(auth.authorization.projectId)[0];
    f.db.transaction(() => { for (let i = 0; i < 530; i++) repo.insertTask({ projectId: auth.authorization.projectId, publicId: randomUUID(), externalId: `large-${i}`, name: `large-${i}`, description: "x".repeat(10000), url: null, type: "task", scheduleMode: original.scheduleMode, requestedStart: original.requestedStart, startDate: original.startDate, endDate: original.endDate, duration: original.duration, progress: 0, status: "not_started", parentId: null, sortOrder: i + 1, createdAt: clock().toISOString(), updatedAt: clock().toISOString() }); })();
    const before = f.state(); expect(() => new ProjectJsonExportService(f.db, { clock }).get(f.publicId, 2)).toThrow("5 MiB"); expect(f.state()).toEqual(before);
  });
  it("captures one clock inside the JSON read snapshot and exports no secrets", async () => {
    const f = await fixture(); let calls = 0;
    const service = new ProjectJsonExportService(f.db, { clock: () => { calls++; expect(f.db.inTransaction).toBe(true); return clock(); } });
    const value = new TextDecoder().decode(service.get(f.publicId, 1)); expect(calls).toBe(1);
    expect(value).not.toMatch(/password|session|tokenHash|salt|assignment|logistics/i);
    expect(JSON.parse(value).source.exportedAt).toBe(clock().toISOString()); expect(f.state().revision).toBe(1);
  });
  it.each(["bad-origin", "stale", "weak", "unknown", "scope"])("rejects export %s", async kind => { const f = await fixture(); const input = kind === "unknown" ? { scope: "project", filters: {} } : { scope: kind === "scope" ? "visible" : "project" }; const r = await handleProjectJsonExport(f.request(new TextEncoder().encode(JSON.stringify(input)), { "If-Match": kind === "stale" ? '"2"' : kind === "weak" ? 'W/"1"' : '"1"', Origin: kind === "bad-origin" ? "https://other.example.com" : "https://gantt.example.com" }), f.publicId, { ...f.deps, service: new ProjectJsonExportService(f.db, { clock }) }); expect(r.status).toBe(kind === "bad-origin" ? 403 : kind === "stale" ? 412 : 400); expect(f.state().revision).toBe(1); });
});
