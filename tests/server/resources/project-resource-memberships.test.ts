import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";
import { resourceDashboardTargetsFixture } from "../../fixtures/resource-dashboard-targets";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { openDatabase } from "../../../src/server/db/core";
import { runMigrations } from "../../../src/server/db/migrations";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { insertHistoricalPublicProject } from "../../fixtures/legacy-project";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { ResourceCatalogService, ResourceCatalogTargetInUseError } from "../../../src/server/resources/resource-catalog-service-core";
import { ProjectResourceMembershipService } from "../../../src/server/resources/project-resource-membership-service-core";
import { handleProjectResourceMembership } from "../../../src/server/resources/project-resource-membership-handlers-core";
import { ProjectResourceMembershipRepository } from "../../../src/server/repositories/project-resource-membership-repository-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { ResourceWorkloadService } from "../../../src/server/resources/resource-workload-service-core";
import { ProjectJsonExportService } from "../../../src/server/exports/project-json-export-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { parseProjectImportBytes } from "../../../src/server/imports/project-import-parser-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
const now = "2026-10-18T01:00:00.000Z", clock = () => new Date(now);
const migrationsDirectory = join(process.cwd(), "db/migrations");
const hashPassword = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const connections: Database.Database[] = [], servers: Server[] = [], directories: string[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>((resolve, reject) => s.close(e => e ? reject(e) : resolve())))); connections.splice(0).forEach(db => { if (db.open)
  db.close(); }); directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
async function fixture(filename = ":memory:") {
  const db = openDatabase({ filename, migrationsDirectory }).database;
  connections.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword });
  const create = async (name: string) => {
    const created = await projects.create({ name, description: "", editPassword: "test" });
    const publicId = created.response.data.project.publicId, auth = projects.authorize(publicId, created.rawSessionToken);
    if (auth.kind !== "authorized")
      throw new Error("fixture auth");
    return { publicId, token: created.rawSessionToken, authorization: auth.authorization, revision: () => projects.getReadonlySnapshot(publicId)!.data.project.revision };
  };
  const a = await create("A"), b = await create("B");
  const catalog = new ResourceCatalogService(db, { clock }), admin = catalog.unlockAdmin("test", "test")!;
  const resource = (name: string) => { const before = catalog.getCatalog(admin.rawToken); const result = catalog.createTarget("resource", admin.rawToken, before.data.revision, { name, roles: ["DEVELOPER"], developerGrade: "ADVANCED" }); return result.data.resources.find(r => r.name === name)!; };
  const r = resource("참여자");
  const membership = new ProjectResourceMembershipService(db, { clock });
  const register = (p = a, id = r.id) => membership.mutate(p.authorization, p.revision(), id, true, catalog.getCatalog(admin.rawToken).data.revision);
  const task = () => projects.createTask(a.authorization, a.revision(), { name: "Assigned", externalId: "T", type: "task", start: "2026-10-19", duration: 2, progress: 0 }).data.tasks.find(t => t.externalId === "T")!;
  return { db, projects, create, a, b, catalog, admin, resource, r, membership, register, task };
}
async function httpFixture() {
  const f = await fixture();
  let base = "";
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req)
        chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks), url = new URL(req.url!, base), segments = url.pathname.split("/"), publicId = segments[3], resourceId = segments[5];
      const request = new Request(url, { method: req.method, headers: req.headers as Record<string, string>, ...(body.length ? { body } : {}) });
      const result = await handleProjectResourceMembership(request, publicId, { service: f.membership, projectService: f.projects, applicationBaseUrl: base, environment: "test" }, resourceId);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    }
    catch {
      res.writeHead(500);
      res.end();
    }
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as {
    port: number;
  }).port}`;
  const request = (p = f.a, method = "GET", options: {
    body?: unknown;
    query?: string;
    resourceId?: string;
    token?: string | null;
    origin?: string;
    revision?: number;
  } = {}) => fetch(`${base}/api/projects/${p.publicId}/resource-memberships${options.resourceId ? `/${options.resourceId}` : ""}${options.query ?? ""}`, { method, headers: { Origin: options.origin ?? base, Cookie: `${editSessionCookieName("test", new URL(base))}=${options.token === null ? "" : options.token ?? p.token}`, "If-Match": `"${options.revision ?? p.revision()}"`, ...(options.body ? { "Content-Type": "application/json" } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  const post = (p = f.a, revision = p.revision(), id = f.r.id) => request(p, "POST", { revision, body: { resourceId: id, catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision } });
  return { ...f, base, request, post };
}
describe("Issue727 persisted Project participation", () => {
  it("registers one global ID independently in two Projects without creating effort or assignments", async () => {
    const f = await fixture(), before = new ResourceWorkloadService(f.db, { clock }).get(f.a.publicId, "2026-10-19", "2026-10-20");
    expect(f.register().data.counts).toEqual({ registered: 1, assigned: 0, roleOnly: 0, inactive: 0 });
    f.register(f.b);
    const revision = f.a.revision();
    expect(f.register().data.operation?.changed).toBe(false);
    expect(f.a.revision()).toBe(revision);
    expect(f.db.prepare("SELECT COUNT(*) FROM resources").pluck().get()).toBe(1);
    expect(f.db.prepare("SELECT COUNT(*) FROM task_assignments").pluck().get()).toBe(0);
    const after = new ResourceWorkloadService(f.db, { clock }).get(f.a.publicId, "2026-10-19", "2026-10-20");
    expect({ ...after!.data, projectRevision: 0 }).toEqual({ ...before!.data, projectRevision: 0 });
    f.membership.mutate(f.a.authorization, f.a.revision(), f.r.id, false);
    expect(f.membership.get(f.a.publicId).data.resources).toEqual([]);
    expect(f.membership.get(f.b.publicId).data.resources[0].id).toBe(f.r.id);
  });
  it("keeps nonempty ordinary Assignment effort and Plan Capacity R unchanged through participation changes", async () => {
    const f = await fixture(), task = f.task(), extra = f.resource("등록만인 사람");
    f.catalog.replaceTaskAssignments(f.a.authorization, f.a.revision(), task.taskId, { catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision, targets: [{ kind: "resource", id: f.r.id, allocation: { start: "2026-10-19", end: "2026-10-20", percent: 50 } }] });
    const report = new ResourceDashboardService(f.db, { clock }), filter = { from: "2026-10-19", to: "2026-10-20", asOfDate: "2026-10-18", granularity: "month" as const };
    const read = () => { const data = report.getDashboard(f.a.publicId, filter)!; return { summary: data.summary, population: data.plan!.population, totals: data.plan!.totals, resources: data.plan!.resources }; };
    const baseline = read(), assignments = f.db.prepare("SELECT * FROM task_assignments").all();
    expect(baseline.summary).toMatchObject({ assignmentCount: 1, resourceCount: 1, notStarted: 1, effort: { plannedMd: 1 } });
    expect(baseline.population.resourceCount).toBe(1);
    f.register(f.a, extra.id);
    expect(read()).toEqual(baseline);
    expect(f.membership.get(f.a.publicId).data.counts).toMatchObject({ registered: 1, assigned: 1 });
    f.membership.mutate(f.a.authorization, f.a.revision(), extra.id, false);
    expect(read()).toEqual(baseline);
    expect(f.db.prepare("SELECT * FROM task_assignments").all()).toEqual(assignments);
  });
  it("exposes existing assignment and equipment/system roles without enrolling unrelated people or deleting usage", async () => {
    const f = await fixture(), task = f.task(), role = f.resource("역할만"), unrelated = f.resource("다른 프로젝트");
    const id = (pid: string) => f.db.prepare("SELECT id FROM resources WHERE public_id=?").pluck().get(pid) as number;
    f.catalog.replaceTaskAssignments(f.a.authorization, f.a.revision(), task.taskId, { catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision, targets: [{ kind: "resource", id: f.r.id }] });
    const process = Number(f.db.prepare("INSERT INTO project_processes(public_id,project_id,code,name,sort_order,active,created_at,updated_at) VALUES(?,?,'P','P',0,1,?,?)").run(randomUUID(), f.a.authorization.projectId, now, now).lastInsertRowid);
    const equipment = Number(f.db.prepare("INSERT INTO project_equipment(public_id,project_id,process_id,code,name,equipment_type,management_unit,quantity,manufacturer,model,description,active,created_at,updated_at) VALUES(?,?,?,'E','E','stocker','unit',1,'','','',1,?,?)").run(randomUUID(), f.a.authorization.projectId, process, now, now).lastInsertRowid);
    const system = Number(f.db.prepare("INSERT INTO project_logistics_systems(public_id,project_id,code,name,system_type,layer,scope,vendor,description,active,created_at,updated_at) VALUES(?,?,'S','S','mcs','coordinator','project','','',1,?,?)").run(randomUUID(), f.a.authorization.projectId, now, now).lastInsertRowid);
    f.db.prepare("INSERT INTO project_equipment_resource_roles(project_id,equipment_id,resource_id,role,is_primary,created_at,updated_at) VALUES(?,?,?,'owner',1,?,?)").run(f.a.authorization.projectId, equipment, id(role.id), now, now);
    f.db.prepare("INSERT INTO project_system_resource_roles(project_id,system_id,resource_id,role,is_primary,created_at,updated_at) VALUES(?,?,?,'developer',0,?,?)").run(f.a.authorization.projectId, system, id(role.id), now, now);
    f.register(f.b, unrelated.id);
    const result = f.membership.get(f.a.publicId).data;
    expect(result.resources.map(r => r.id).sort()).toEqual([f.r.id, role.id].sort());
    expect(result.resources.find(r => r.id === role.id)).toMatchObject({ registered: false, sources: { membership: false, taskAssignments: false, equipmentRoles: true, systemRoles: true }, usage: { taskAssignments: 0, equipmentRoles: 1, systemRoles: 1 } });
    expect(result.counts).toEqual({ registered: 0, assigned: 1, roleOnly: 1, inactive: 0 });
    const revisionBeforeNoop = f.a.revision();
    expect(f.membership.mutate(f.a.authorization, revisionBeforeNoop, f.r.id, false).data.operation).toMatchObject({ registered: false, changed: false });
    expect(f.a.revision()).toBe(revisionBeforeNoop);
    f.register();
    const before = f.db.prepare("SELECT * FROM task_assignments").all();
    expect(() => f.membership.mutate(f.a.authorization, f.a.revision(), f.r.id, false)).toThrow("작업 배정");
    const revisionBeforeRoleNoop = f.a.revision();
    expect(f.membership.mutate(f.a.authorization, revisionBeforeRoleNoop, role.id, false).data.operation).toMatchObject({ registered: false, changed: false });
    expect(f.a.revision()).toBe(revisionBeforeRoleNoop);
    expect(f.db.prepare("SELECT * FROM task_assignments").all()).toEqual(before);
  });
  it("keeps inactive registrations, filters grade/role/group and blocks global deletion", async () => {
    const f = await fixture();
    f.register();
    let catalog = f.catalog.getCatalog(f.admin.rawToken);
    catalog = f.catalog.createTarget("group", f.admin.rawToken, catalog.data.revision, { name: "팀" });
    const group = catalog.data.groups[0];
    catalog = f.catalog.replaceGroupMembers(group.id, f.admin.rawToken, catalog.data.revision, { resourceIds: [f.r.id] });
    expect(f.membership.get(f.a.publicId, { role: "DEVELOPER", grade: "ADVANCED", groupId: group.id, registration: "registered", usage: "unassigned" }).data.resources[0].groups).toEqual([{ id: group.id, name: "팀", active: true }]);
    expect(() => f.catalog.deleteTarget("resource", f.r.id, f.admin.rawToken, catalog.data.revision)).toThrow(ResourceCatalogTargetInUseError);
    catalog = f.catalog.updateTarget("resource", f.r.id, f.admin.rawToken, catalog.data.revision, { active: false });
    expect(f.membership.get(f.a.publicId, { active: false }).data.resources[0]).toMatchObject({ active: false, registered: true });
    expect(() => f.register(f.b)).toThrow("비활성");
    f.membership.mutate(f.a.authorization, f.a.revision(), f.r.id, false);
    expect(f.a.revision()).toBe(3);
  });
  it("counts Summary/Milestone personal references as responsibility, never ordinary Task assignment", async () => {
    const f = await fixture();
    const task = f.projects.createTask(f.a.authorization, f.a.revision(), { name: "Stage", externalId: "M", type: "milestone", start: "2026-10-19", duration: 0, progress: 0 }).data.tasks[0];
    f.catalog.replaceTaskAssignments(f.a.authorization, f.a.revision(), task.taskId, { catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision, targets: [{ kind: "resource", id: f.r.id }] });
    const data = f.membership.get(f.a.publicId).data;
    expect(data.counts).toEqual({ registered: 0, assigned: 0, roleOnly: 1, inactive: 0 });
    expect(data.resources[0]).toMatchObject({ sources: { taskAssignments: false, responsibilityAssignments: true }, usage: { taskAssignments: 0, responsibilityAssignments: 1 } });
    expect(f.membership.get(f.a.publicId, { usage: "assigned" }).data.total).toBe(0);
    expect(f.membership.get(f.a.publicId, { usage: "roleOnly" }).data.total).toBe(1);
    const beforeNoop = f.a.revision();
    expect(f.membership.mutate(f.a.authorization, beforeNoop, f.r.id, false).data.operation).toMatchObject({ kind: "resourceMembership", resourceId: f.r.id, registered: false, changed: false });
    expect(f.a.revision()).toBe(beforeNoop);
    f.register();
    const registeredRevision = f.a.revision();
    expect(f.membership.get(f.a.publicId).data.counts.registered).toBe(1);
    expect(() => f.membership.mutate(f.a.authorization, registeredRevision, f.r.id, false)).toThrow("책임");
    expect(f.a.revision()).toBe(registeredRevision);
    expect(f.membership.get(f.a.publicId).data.resources[0].registered).toBe(true);
  });
  it("fails closed for excessive groups and response bytes and rolls back oversized mutation responses", async () => {
    const f = await fixture(), catalog = new ResourceCatalogRepository(f.db);
    const people = [f.r, ...Array.from({ length: 50 }, (_, i) => catalog.insertResource({ publicId: randomUUID(), name: `Person${i}`, code: null, description: "", now }))];
    const resourceIds = people.map(person => f.db.prepare("SELECT id FROM resources WHERE public_id=?").pluck().get("publicId" in person ? person.publicId : person.id) as number);
    f.db.transaction(() => {
      for (let i = 0; i < 200; i++) {
        const group = catalog.insertGroup({ publicId: randomUUID(), name: `${String(i).padStart(3, "0")}${"가".repeat(190)}`, code: null, description: "", now });
        for (const resourceId of resourceIds)
          f.db.prepare("INSERT INTO resource_group_members(group_id,resource_id,created_at) VALUES(?,?,?)").run(group.id, resourceId, now);
      }
      for (const resourceId of resourceIds.slice(0, 50))
        f.db.prepare("INSERT INTO project_resource_memberships(project_id,resource_id,created_at) VALUES(?,?,?)").run(f.a.authorization.projectId, resourceId, now);
    })();
    expect(f.membership.get(f.a.publicId, { limit: 1 }).data.resources).toHaveLength(1);
    expect(() => f.membership.get(f.a.publicId)).toThrow("응답");
    const revision = f.a.revision(), before = f.db.prepare("SELECT * FROM project_resource_memberships ORDER BY resource_id").all();
    expect(() => f.membership.mutate(f.a.authorization, revision, (people.at(-1) as {
      publicId: string;
    }).publicId, true, catalog.getRevision())).toThrow("응답");
    expect(f.a.revision()).toBe(revision);
    expect(f.db.prepare("SELECT * FROM project_resource_memberships ORDER BY resource_id").all()).toEqual(before);
    f.db.transaction(() => { for (let i = 200; i < 1001; i++)
      catalog.insertGroup({ publicId: randomUUID(), name: `Group${i}`, code: null, description: "", now }); })();
    expect(() => f.membership.get(f.b.publicId, { q: "missing", limit: 1 })).toThrow("한도");
  });
  it("rolls back membership/revision together on a failed revision write", async () => {
    const f = await fixture(), before = f.a.revision();
    f.db.exec("CREATE TRIGGER reject_membership_revision BEFORE UPDATE OF revision ON projects BEGIN SELECT RAISE(ABORT,'revision-failed'); END");
    expect(() => f.register()).toThrow("revision-failed");
    expect(f.a.revision()).toBe(before);
    expect(f.membership.get(f.a.publicId).data.total).toBe(0);
  });
  it("preserves global references in Copy and Template, inactive members and legacy templates; missing references roll back", async () => {
    const f = await fixture(), task = f.task();
    f.register();
    f.catalog.replaceTaskAssignments(f.a.authorization, f.a.revision(), task.taskId, { catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision, targets: [{ kind: "resource", id: f.r.id, allocation: { start: "2026-10-19", end: "2026-10-20", percent: 40 } }] });
    const originalAssignments = f.db.prepare("SELECT * FROM task_assignments ORDER BY id").all();
    const before = f.db.prepare("SELECT * FROM resources").all();
    const copy = await new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.a.authorization, f.a.revision(), { name: "Copy", description: "", editPassword: "test" });
    expect(f.membership.get(copy.response.data.project.publicId).data.resources[0]).toMatchObject({ id: f.r.id, usage: { taskAssignments: 1 } });
    expect(copy.response.data.assignments).toMatchObject([{ target: { kind: "resource", id: f.r.id }, allocation: { start: "2026-10-19", end: "2026-10-20", percent: 40 } }]);
    expect(f.db.prepare("SELECT * FROM task_assignments WHERE project_id=? ORDER BY id").all(f.a.authorization.projectId)).toEqual(originalAssignments);
    const templates = new ProjectTemplateService(f.db, { clock, hashPassword }), saved = templates.createTemplateFromProject(f.a.authorization, f.a.revision(), { name: "Saved" });
    const snapshot = JSON.parse(f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(saved.id) as string);
    expect(snapshot.resourceMemberships).toEqual([f.r.id]);
    f.catalog.updateTarget("resource", f.r.id, f.admin.rawToken, f.catalog.getCatalog(f.admin.rawToken).data.revision, { active: false });
    const instantiate = () => templates.instantiateProject(saved.id, { name: "New", ownerName: "owner", editPassword: "test", projectStartDate: "2026-11-02" });
    const created = await instantiate();
    expect(f.membership.get(created.response.data.project.publicId).data.resources[0]).toMatchObject({ id: f.r.id, active: false, usage: { taskAssignments: 1 } });
    expect(created.response.data.assignments).toMatchObject([{ target: { kind: "resource", id: f.r.id }, allocation: { percent: 40 } }]);
    expect(f.db.prepare("SELECT * FROM task_assignments WHERE project_id=? ORDER BY id").all(f.a.authorization.projectId)).toEqual(originalAssignments);
    expect(f.db.prepare("SELECT COUNT(*) FROM resources").pluck().get()).toBe(before.length);
    const count = f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get();
    snapshot.resourceMemberships = [randomUUID()];
    f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(snapshot), saved.id);
    await expect(instantiate()).rejects.toThrow("등록 리소스");
    expect(f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get()).toBe(count);
    delete snapshot.resourceMemberships;
    f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(snapshot), saved.id);
    expect(f.membership.get((await instantiate()).response.data.project.publicId).data.resources[0]).toMatchObject({ id: f.r.id, registered: false, usage: { taskAssignments: 1 } });
  });
  it("rejects unsupported JSON/Excel exchange and forward import fields without partial loss", async () => {
    const f = await fixture();
    f.task();
    f.register();
    expect(() => new ProjectJsonExportService(f.db, { clock }).get(f.a.publicId, f.a.revision())).toThrow("JSON 일정");
    expect(() => new ProjectExportSnapshotService(f.db, { clock }).get(f.a.publicId)).toThrow("일정 Excel");
    for (const key of ["resourceMemberships", "projectResourceMemberships", "resource_memberships", "project_resource_memberships"])
      expect(() => parseProjectImportBytes(new TextEncoder().encode(JSON.stringify({ schemaVersion: "1.1", [key]: [f.r.id] })))).toThrow("교환 형식");
  });
  it("preserves explicit Resource Effort estimate and Resource reports without weakening plain Excel or Target guards", async () => {
    const f = await fixture(), task = f.task(), extra = f.resource("등록만인 사람");
    f.catalog.replaceTaskAssignments(f.a.authorization, f.a.revision(), task.taskId, {
      catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision,
      targets: [{ kind: "resource", id: f.r.id, allocation: { start: "2026-10-19", end: "2026-10-20", percent: 40 } }],
    });
    const service = new ProjectExportSnapshotService(f.db, { clock, mdPerMmEnvironment: "20" });
    const before = service.get(f.a.publicId, true)!;
    const request = {
      includeDependencies: false, includeResourceEffort: true, scope: "project" as const, scale: "day" as const,
      hierarchyDisplay: "expanded" as const, layout: { columns: [{ id: "text" as const, widthPx: 224 }] },
    };
    const sheets = (bundle: typeof before) => {
      const archive = Buffer.from(buildProjectExcelWorkbook(bundle.snapshot, request, bundle.resourceWorkload, bundle.stageDashboard));
      const entries = new Map<string, string>();
      let offset = 0;
      while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
        const size = archive.readUInt32LE(offset + 18), nameLength = archive.readUInt16LE(offset + 26);
        const start = offset + 30 + nameLength + archive.readUInt16LE(offset + 28);
        entries.set(archive.toString("utf8", offset + 30, offset + 30 + nameLength), inflateRawSync(archive.subarray(start, start + size)).toString());
        offset = start + size;
      }
      const names = [...entries.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(match => match[1]);
      return { names, detail: entries.get(`xl/worksheets/sheet${names.indexOf("Resource Effort Detail") + 1}.xml`)! };
    };
    const originalSheets = sheets(before);
    expect(before.resourceWorkload!.data.grandTotalMd).toBe(0.8);
    const assignments = f.db.prepare("SELECT * FROM task_assignments ORDER BY id").all();
    f.register(f.a, extra.id);
    const after = service.get(f.a.publicId, true)!;
    expect({ ...after.resourceWorkload!.data, projectRevision: 0 }).toEqual({ ...before.resourceWorkload!.data, projectRevision: 0 });
    expect(sheets(after)).toEqual(originalSheets);
    expect(originalSheets.names).toContain("Resource Effort Summary");
    expect(originalSheets.detail).toContain("<v>0.8</v>");
    expect(originalSheets.detail).not.toContain(extra.id);
    expect(() => service.get(f.a.publicId)).toThrow(expect.objectContaining({ code: "RESOURCE_MEMBERSHIP_EXPORT_UNSUPPORTED" }));
    const report = new ResourceDashboardService(f.db, { clock, mdPerMmEnvironment: "20" }).getDashboard(f.a.publicId, { from: "2026-10-19", to: "2026-10-20" })!;
    const resourceReport = service.get(f.a.publicId, false, {
      basis: "project", expectedReport: { context: report.resourceScopeContext! }, granularities: ["month"],
    })!.resourceDashboard!;
    expect(resourceReport.report.summary.effort.plannedMd).toBe(0.8);
    expect(resourceReport.plans.month!.population.resourceCount).toBe(1);
    expect(f.db.prepare("SELECT * FROM task_assignments ORDER BY id").all()).toEqual(assignments);
    const targets = resourceDashboardTargetsFixture();
    connections.push(targets.database);
    new ProjectResourceMembershipRepository(targets.database).register(targets.project.id, targets.resources.get("R1")!.id, now);
    expect(() => new ProjectExportSnapshotService(targets.database, { clock }).get(targets.project.publicId, true))
      .toThrow(expect.objectContaining({ code: "TASK_TARGET_EXPORT_UNSUPPORTED" }));
  });
  it("migrates an existing DB with assignment preservation and restores unassigned participants after restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "issue727-"));
    directories.push(dir);
    const old = join(dir, "old");
    rmSync(old, { recursive: true, force: true });
    const fs = await import("node:fs");
    fs.mkdirSync(old);
    for (const name of readdirSync(migrationsDirectory))
      if (name.endsWith(".sql") && Number(name.slice(0,4))<29)
        copyFileSync(join(migrationsDirectory, name), join(old, name));
    const filename = join(dir, "app.sqlite3"), initial = openDatabase({ filename, migrationsDirectory: old }).database;
    expect(initial.prepare("SELECT name FROM sqlite_schema WHERE name='project_resource_memberships'").get()).toBeUndefined();
    const legacyProject = insertHistoricalPublicProject(initial, { publicId: randomUUID(), name: "Before migration", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: now, updatedAt: now });
    const legacyTask = new ScheduleRepository(initial).insertTask({ projectId: legacyProject.id, publicId: randomUUID(), externalId: "Legacy", name: "Legacy", type: "task", scheduleMode: "auto", requestedStart: "2026-10-19", startDate: "2026-10-19", endDate: "2026-10-19", duration: 1, progress: 0, parentId: null, sortOrder: 0, createdAt: now, updatedAt: now });
    const catalog = new ResourceCatalogRepository(initial), legacyResource = catalog.insertResource({ publicId: randomUUID(), name: "Legacy person", code: null, description: "", now });
    catalog.replaceTaskAssignments({ projectId: legacyProject.id, taskId: legacyTask.id, now, targets: [{ kind: "resource", publicId: legacyResource.publicId, internalId: legacyResource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: null }] });
    const logistics = new LogisticsRepository(initial);
    const legacySystem = logistics.insertSystem({ projectId: legacyProject.id, publicId: randomUUID(), code: "SYS", name: "SYS", systemType: "mcs", layer: "coordinator", scope: "project", now });
    logistics.replaceSystemResourceRoles(legacyProject.id, legacySystem.id, [{ resourceId: legacyResource.id, role: "developer", isPrimary: 0 }], now);
    const tables = ["projects", "tasks", "task_assignments", "resources", "project_system_resource_roles"];
    // Compare every historical value except the newly introduced public-default column.
    const snapshotRows = () => tables.map(table => {
      const rows = initial.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Array<Record<string, unknown>>;
      return { table, rows: table === "projects"
        ? rows.map(row => Object.fromEntries(Object.entries(row).filter(([name]) => name !== "visibility")))
        : rows };
    });
    const legacyRows = snapshotRows();
    expect(runMigrations(initial, migrationsDirectory).applied).toEqual(["0029_project_resource_memberships.sql", "0030_project_work_areas.sql", "0031_project_visibility.sql", "0032_project_issues.sql", "0033_project_issue_credentials_soft_delete.sql", "0034_project_issue_business_status.sql", "0035_country_calendar_catalog.sql"]);
    expect(snapshotRows()).toEqual(legacyRows);
    expect(initial.prepare("SELECT visibility FROM projects WHERE id = ?").pluck().get(legacyProject.id)).toBe("public");
    expect(new ProjectResourceMembershipService(initial, { clock }).get(legacyProject.publicId).data.resources).toMatchObject([{ id: legacyResource.publicId, registered: false, usage: { taskAssignments: 1, systemRoles: 1 } }]);
    expect(runMigrations(initial, migrationsDirectory).applied).toEqual([]);
    initial.close();
    const f = await fixture(filename);
    f.register();
    const publicId = f.a.publicId, id = f.r.id;
    f.db.close();
    const reopened = openDatabase({ filename, migrationsDirectory });
    connections.push(reopened.database);
    expect(reopened.migrations.applied).toEqual([]);
    expect(new ProjectResourceMembershipService(reopened.database, { clock }).get(publicId).data.resources).toMatchObject([{ id, registered: true, usage: { taskAssignments: 0 } }]);
    expect(new ProjectResourceMembershipService(reopened.database, { clock }).get(legacyProject.publicId).data.resources[0]).toMatchObject({ id: legacyResource.publicId, registered: false, usage: { taskAssignments: 1, systemRoles: 1 } });
    for (const { table, rows } of legacyRows) {
      const observed = reopened.database.prepare(`SELECT * FROM ${table} WHERE id<=? ORDER BY id`)
        .all((rows as Array<{ id: number }>).at(-1)?.id ?? 0) as Array<Record<string, unknown>>;
      if (table === "projects") {
        // Every original project retains its full legacy row plus the 0031 public default.
        expect(observed.map(row => row.visibility)).toEqual(rows.map(() => "public"));
        expect(observed.map(row => Object.fromEntries(
          Object.entries(row).filter(([name]) => name !== "visibility"),
        ))).toEqual(rows);
      } else {
        expect(observed).toEqual(rows);
      }
    }
    expect(reopened.database.pragma("foreign_key_check")).toEqual([]);
  });
});
describe("Issue727 real SQLite and HTTP authorization/concurrency", () => {
  it("enforces401/403/412 and Project isolation; catalog is protected but Project union stays readonly", async () => {
    const f = await httpFixture(), body = { resourceId: f.r.id, catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision };
    expect((await f.request(f.a, "POST", { body, token: null })).status).toBe(401);
    expect((await f.request(f.a, "POST", { body, origin: "https://other.example" })).status).toBe(403);
    expect((await f.request(f.b, "POST", { body, token: f.a.token })).status).toBe(401);
    expect((await f.request(f.a, "GET", { query: "?scope=catalog", token: null })).status).toBe(401);
    expect((await f.request(f.a, "GET", { token: null })).status).toBe(200);
    expect((await f.post()).status).toBe(200);
    expect((await f.post(f.a, 1)).status).toBe(412);
    expect((await f.request(f.b)).status).toBe(200);
    expect((await (await f.request(f.b)).json()).data.total).toBe(0);
    expect((await f.request(f.a, "GET", { query: "?limit=101" })).status).toBe(400);
    expect((await f.request(f.a, "GET", { query: "?q=x&q=y" })).status).toBe(400);
    expect((await f.request(f.a, "GET", { query: "?scope=catalog&limit=1" })).headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("enforces catalog stale412, inactive409, strict payload limits and revoked session revalidation", async () => {
    const f = await httpFixture();
    const staleCatalog = f.catalog.getCatalog(f.admin.rawToken).data.revision;
    f.resource("New catalog row");
    const stale = await f.request(f.a, "POST", { body: { resourceId: f.r.id, catalogRevision: staleCatalog } });
    expect(stale.status).toBe(412);
    expect((await stale.json()).error.code).toBe("CATALOG_REVISION_MISMATCH");
    f.catalog.updateTarget("resource", f.r.id, f.admin.rawToken, f.catalog.getCatalog(f.admin.rawToken).data.revision, { active: false });
    const inactive = await f.post();
    expect(inactive.status).toBe(409);
    expect((await inactive.json()).error.code).toBe("RESOURCE_INACTIVE");
    expect((await f.request(f.a, "POST", { body: { resourceId: f.r.id, catalogRevision: 1, ignored: true } })).status).toBe(400);
    expect((await f.request(f.a, "POST", { body: { resourceId: "a".repeat(5000), catalogRevision: 1 } })).status).toBe(413);
    expect(f.a.revision()).toBe(1);
    expect(f.membership.get(f.a.publicId).data.total).toBe(0);
    f.db.prepare("UPDATE edit_sessions SET revoked_at=? WHERE id=?").run(now, f.a.authorization.sessionId);
    expect(() => f.membership.mutate(f.a.authorization, f.a.revision(), f.r.id, false)).toThrow("편집 세션");
    expect((await f.request(f.a, "DELETE", { resourceId: f.r.id })).status).toBe(401);
  });
  it("serializes concurrent same-revision mutations and reports fresh409 usage without deleting assignments", async () => {
    const f = await httpFixture(), other = f.resource("Other"), revision = f.a.revision();
    const results = await Promise.all([f.post(f.a, revision), f.post(f.a, revision, other.id)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 412]);
    expect(f.membership.get(f.a.publicId).data.counts.registered).toBe(1);
    expect(f.a.revision()).toBe(revision + 1);
    const task = f.task();
    f.catalog.replaceTaskAssignments(f.a.authorization, f.a.revision(), task.taskId, { catalogRevision: f.catalog.getCatalog(f.admin.rawToken).data.revision, targets: [{ kind: "resource", id: f.r.id }] });
    const before = f.db.prepare("SELECT * FROM task_assignments").all(), rev = f.a.revision();
    const response = await f.request(f.a, "DELETE", { resourceId: f.r.id });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("PROJECT_RESOURCE_IN_USE");
    expect(f.a.revision()).toBe(rev);
    expect(f.db.prepare("SELECT * FROM task_assignments").all()).toEqual(before);
    expect(new ProjectResourceMembershipRepository(f.db).inUse(f.b.authorization.projectId, (f.db.prepare("SELECT id FROM resources WHERE public_id=?").pluck().get(f.r.id) as number))).toBe(false);
  });
});
