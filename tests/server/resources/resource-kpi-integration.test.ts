import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { calculateResourceKpi } from "../../../src/domain/resources/resource-kpi";
import type { ResourceDashboardDto, ResourceDashboardFilterInput } from "../../../src/contracts/resource-dashboard";
import type { ResourceRole } from "../../../src/contracts/resources";
import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { handleGetResourceDashboard, handleGetResourcePlan, handleResourceDrill } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { RESOURCE_KPI_INTEGRATION as c, resourceKpiIntegrationFixture } from "../../fixtures/resource-kpi-integration";

const databases: ReturnType<typeof openDatabase>["database"][] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function fixture() {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database; databases.push(db);
  const projects = new ProjectRepository(db), schedules = new ScheduleRepository(db), catalog = new ResourceCatalogRepository(db), memberships = new MilestoneMembershipRepository(db), source = resourceKpiIntegrationFixture();
  const project = projects.insert({ publicId: randomUUID(), name: "#530 synthetic", description: "private", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: source.timezone, createdAt: c.now, updatedAt: c.now });
  const tasks = new Map<string, ReturnType<typeof schedules.insertTask>>(), resources = new Map<string, ReturnType<typeof catalog.insertResource>>(), groups = new Map<string, ReturnType<typeof catalog.insertGroup>>(), assignments = new Map<string, string>();
  for (const row of source.tasks) tasks.set(row.taskId, schedules.insertTask({ projectId: project.id, publicId: randomUUID(), externalId: row.taskId, name: row.name ?? row.taskId, type: row.type, parentId: null, scheduleMode: "auto", requestedStart: row.start, startDate: row.start, endDate: row.end, duration: row.duration, progress: row.progress, status: row.status, sortOrder: tasks.size, createdAt: c.now, updatedAt: c.now }));
  for (const row of source.resources) { const stored = catalog.insertResource({ publicId: randomUUID(), name: row.name!, code: row.code ?? null, description: "private synthetic", developerGrade: row.developerGrade as "ADVANCED" | "INTERMEDIATE", now: c.now }); catalog.replaceResourceRoles(stored.id, row.roles as ResourceRole[], c.now); resources.set(row.resourceId, stored); }
  for (const id of [...new Set(source.resources.flatMap(r => [...r.groupIds]))]) { const stored = catalog.insertGroup({ publicId: randomUUID(), name: id, code: id, description: "private synthetic", now: c.now }); catalog.replaceGroupMembers(stored.id, source.resources.filter(r => r.groupIds.includes(id)).map(r => resources.get(r.resourceId)!.id), c.now); groups.set(id, stored); }
  for (const row of source.memberships) memberships.set(project.id, tasks.get(row.taskId)!.id, tasks.get(row.milestoneTaskId)!.id);
  for (const row of source.tasks) { const a = source.assignments.filter(a => a.taskId === row.taskId); if (!a.length) continue;
    catalog.replaceTaskAssignments({ projectId: project.id, taskId: tasks.get(row.taskId)!.id, now: c.now, targets: a.map(a => { const target = (a.kind === "resource" ? resources : groups).get(a.targetId)!; const id = randomUUID(); assignments.set(a.assignmentId, id); return { kind: a.kind, publicId: target.publicId, internalId: target.id, assignmentPublicId: id, allocationPercent: a.allocationPercent, assignmentStart: a.start ?? null, assignmentEnd: a.end ?? null }; }) }); }
  const input = { ...source, projectPublicId: project.publicId, tasks: source.tasks.map(t => ({ ...t, taskId: tasks.get(t.taskId)!.publicId })), memberships: source.memberships.map(m => ({ taskId: tasks.get(m.taskId)!.publicId, milestoneTaskId: tasks.get(m.milestoneTaskId)!.publicId })), resources: source.resources.map(r => ({ ...r, resourceId: resources.get(r.resourceId)!.publicId, groupIds: r.groupIds.map(id => groups.get(id)!.publicId) })), assignments: source.assignments.map(a => ({ ...a, assignmentId: assignments.get(a.assignmentId)!, taskId: tasks.get(a.taskId)!.publicId, targetId: (a.kind === "resource" ? resources : groups).get(a.targetId)!.publicId })) };
  const service = new ResourceDashboardService(db, { clock: () => new Date(c.now) });
  const state = () => ({ project: projects.findById(project.id), tasks: schedules.listTasks(project.id), links: schedules.listLinks(project.id), assignments: catalog.listAssignments(project.id), memberships: memberships.list(project.id), catalogRevision: catalog.getRevision(), rules: db.prepare("SELECT * FROM work_calendar_rules").all(), dates: db.prepare("SELECT * FROM work_calendar_dates").all() });
  return { db, project, projects, schedules, catalog, service, tasks, resources, groups, assignments, input, state };
}
const filters: ResourceDashboardFilterInput = { from: c.from, to: c.to, asOfDate: c.asOfDate, mdPerMm: c.mdPerMm };
function params(extra: Record<string, string> = {}) { return new URLSearchParams({ from: c.from, to: c.to, asOfDate: c.asOfDate, mdPerMm: String(c.mdPerMm), ...extra }); }
async function report(f: ReturnType<typeof fixture>, extra: Record<string, string> = {}) { const response = await handleGetResourceDashboard(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard?${params(extra)}`), f.project.publicId, { service: f.service }); expect(response.status).toBe(200); return (await response.json()).data as ResourceDashboardDto; }
function unzip(b: Uint8Array) { const bytes = Buffer.from(b), result = new Map<string, string>(); let at = 0; while (at + 30 <= bytes.length && bytes.readUInt32LE(at) === 0x04034b50) { const size = bytes.readUInt32LE(at + 18), nameLength = bytes.readUInt16LE(at + 26), start = at + 30 + nameLength + bytes.readUInt16LE(at + 28); result.set(bytes.toString("utf8", at + 30, at + 30 + nameLength), inflateRawSync(bytes.subarray(start, start + size)).toString()); at = start + size; } return result; }
function xmlRows(xml: string): (string | number | null)[][] {
  return [...xml.matchAll(/<row[^>]*>(.*?)<\/row>/g)].map(row => [...row[1].matchAll(/<c\s[^>]*?(?:\/>|>(.*?)<\/c>)/g)].map(cell => {
    const numeric = /<v>([^<]+)<\/v>/.exec(cell[1] ?? ""); if (numeric) return Number(numeric[1]);
    const text = /<t[^>]*>(.*?)<\/t>/.exec(cell[1] ?? ""); return text ? text[1].replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&") : null;
  }));
}
async function workbook(f: ReturnType<typeof fixture>, r: ResourceDashboardDto, ifMatch = `"${r.projectRevision}"`) {
  const service = new ProjectExportSnapshotService(f.db, { clock: () => new Date(c.now) });
  const input: ProjectExcelExportRequest = { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard: { basis: "current", expectedReport: { context: r.resourceScopeContext!, snapshotId: r.snapshotId, filters }, granularities: ["week", "month"] } };
  return handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, { method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json", "If-Match": ifMatch }, body: JSON.stringify(input) }), f.project.publicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) });
}

describe("#530 native SQLite → HTTP → raw projection → actual XLSX", () => {
  it("maps the common ledger raw IDs/date/status/classification/Calendar into report and detail without writes", async () => {
    const f = fixture(), before = f.state(), domain = calculateResourceKpi(f.input), r = await report(f);
    expect(r.summary).toMatchObject({ taskCount: domain.total.taskCount, assignmentCount: domain.total.assignmentCount, resourceCount: domain.total.resourceCount, effort: { knownMd: 11.5, plannedMm: 0.575, unsetCount: 1, state: "partial" } });
    expect(r.range).toEqual(domain.range); expect(r.asOfDate).toBe(domain.asOfDate); expect(r.timezone).toBe(domain.timezone); expect(r.mdPerMmSource).toBe("query");
    const detailParams = params({ snapshotId: r.snapshotId, dimension: "all", metric: "all", view: "assignments", limit: "100" });
    const response = await handleGetResourceDashboard(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/details?${detailParams}`), f.project.publicId, { service: f.service }, true);
    expect(response.status).toBe(200); const d = (await response.json()).data;
    expect(d.rows.map((row: { assignment: { assignmentId: string } }) => row.assignment.assignmentId).sort()).toEqual(domain.total.assignmentIds);
    for (const row of d.rows) { const a = domain.assignments.find(a => a.assignmentId === row.assignment.assignmentId)!; expect(row.assignment).toMatchObject({ resourceId: a.resourceId, groupIds: a.groupIds, roles: a.roles, from: a.from, to: a.to, plannedMd: a.plannedMd, plannedMm: a.plannedMm }); expect(row.taskStart).toBe(c.from); expect(row.taskEnd).toBe(c.to); expect(row.status).toBe("not_started"); }
    for (const stage of r.stages) expect(stage.full.ready).toBe(domain.fullMilestones.find(m => m.milestoneTaskId === stage.milestoneTaskId)!.stageGate.ready);
    expect(r.diagnostics).toMatchObject({ denominator: 6, completelyUnassigned: { count: 1 }, groupOnly: { count: 1 }, unsetAssignmentCount: 1 });
    expect(f.state()).toEqual(before);
  });
  it("keeps raw same report across week/month/Group, daily pagination and exact drill scope", async () => {
    const f = fixture(), before = f.state(), base = await report(f);
    for (const granularity of ["week", "month"]) { const r = await report(f, { granularity, mode: "group" }); expect(r.snapshotId).toBe(base.snapshotId); expect(r.summary).toEqual(base.summary); expect(r.plan!.totals.summary.selected.capacityMd).toBe(10); expect(r.plan!.totals.summary.selected.knownMd).toBeCloseTo(11.5, 14); expect(r.groups.reduce((n, g) => n + g.summary.effort.knownMd, 0)).toBe(17);
      const query = params({ granularity, snapshotId: r.snapshotId, periodId: "all", row: "total", demandScope: "selected", limit: "2" });
      const daily = await handleGetResourcePlan(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/plan/daily?${query}`), f.project.publicId, { service: f.service }, "daily"); expect(daily.status).toBe(200); expect((await daily.json()).data).toMatchObject({ totalCount: 5, nextOffset: 2 }); }
    const selected = f.assignments.get("T1-A")!, body = { sourceContext: base.resourceScopeContext, scope: { kind: "exactAssignments", assignmentIds: [selected] }, filters, projection: { kind: "report" } };
    const response = await handleResourceDrill(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/query`, { method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json" }, body: JSON.stringify(body) }), f.project.publicId, { service: f.service, applicationBaseUrl: "https://gantt.example", environment: "production" }, true);
    expect(response.status).toBe(200); const scoped = (await response.json()).data; expect(scoped.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { knownMd: 2.5 } });
    expect(scoped.plan).toBeUndefined(); expect(f.state()).toEqual(before);
  });
  it("reads API-created XLSX raw numbers, unknown blank, ID partitions and validated no-secret hyperlink", async () => {
    const f = fixture(), before = f.state(), r = await report(f), response = await workbook(f, r);
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("cache-control")).toBe("private, no-store");
    const xml = unzip(new Uint8Array(await response.arrayBuffer())), names = [...xml.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
    expect(names.slice(-7)).toEqual(["Resource Report", "Resource Milestones", "Group Milestones", "Resource Plan", "Resource Assignments", "Resource Quality", "Resource Relations"]);
    const sheet = (name: string) => xml.get(`xl/worksheets/sheet${names.indexOf(name) + 1}.xml`)!;
    const assignments = sheet("Resource Assignments"); expect([...assignments.matchAll(/<row /g)]).toHaveLength(6);
    for (const a of calculateResourceKpi(f.input).assignments) { const row = [...assignments.matchAll(/<row[^>]*>(.*?)<\/row>/g)].find(row => row[1].includes(a.assignmentId))![1]; const value = /<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/.exec(row); if (a.plannedMd === null) expect(row).toMatch(/<c r="Y\d+"[^>]*\/>/); else expect(Number(value![1])).toBe(a.plannedMd); }
    const known = [...assignments.matchAll(/<c r="Y\d+"[^>]*><v>([^<]+)<\/v><\/c>/g)].reduce((n, m) => n + Number(m[1]), 0); expect(known).toBe(r.summary.effort.knownMd);
    const metadata = xmlRows(sheet("Resource Report"));
    for (const [key, value] of Object.entries({ projectPublicId: r.projectPublicId, projectRevision: r.projectRevision, catalogRevision: r.catalogRevision, calendarRevision: r.calendarRevision, snapshotId: r.snapshotId, from: r.range.from, to: r.range.to, asOfDate: r.asOfDate, mdPerMm: r.mdPerMm, mdPerMmSource: r.mdPerMmSource })) expect(metadata.find(row => row[0] === key)![1]).toBe(value);
    for (const [name, data] of [["Resource Milestones", r.resources], ["Group Milestones", r.groups]] as const) {
      const rows = xmlRows(sheet(name)), header = rows.shift()!;
      for (const entity of data) for (const cell of entity.milestones) { const row = rows.find(row => row[0] === entity.id && row[2] === cell.milestoneTaskId)!;
        expect(row).toBeDefined(); expect(row[header.indexOf("knownMd")]).toBe(cell.summary.effort.knownMd); expect(row[header.indexOf("plannedMm")]).toBe(cell.summary.effort.plannedMm); expect(row[header.indexOf("taskCount")]).toBe(cell.summary.taskCount); expect(row[header.indexOf("assignmentCount")]).toBe(cell.summary.assignmentCount);
      }
    }
    const planRows = xmlRows(sheet("Resource Plan")), planHeader = planRows.shift()!;
    for (const granularity of ["week", "month"] as const) { const expected = f.service.getDashboard(f.project.publicId, { ...filters, granularity })!.plan!;
      const rows = planRows.filter(row => row[0] === granularity && row[1] === "total" && row[6] === "all" && row[14] === "selected"); expect(rows).toHaveLength(1); const row = rows[0];
      expect(row[planHeader.indexOf("knownMd")]).toBe(expected.totals.summary.selected.knownMd); expect(row[planHeader.indexOf("capacityMd")]).toBe(10); expect(row[planHeader.indexOf("unknownAssignmentCount")]).toBe(1);
    }
    expect(sheet("Resource Report")).toContain(r.snapshotId); expect(sheet("Resource Plan")).toContain("capacityMd"); expect(sheet("Resource Quality")).toContain(f.tasks.get("T4")!.publicId);
    const links = [...xml.values()].filter(s => s.includes('TargetMode="External"')); expect(links).toHaveLength(1); expect(links[0]).toContain(`Target="https://gantt.example/projects/${f.project.publicId}"`); expect([...xml.values()].join("")).not.toMatch(/<f>|passwordHash|passwordSalt|tokenHash/); expect(f.state()).toEqual(before);
  });
  it("rejects stale report/If-Match and cross-project selections with no partial file or writes", async () => {
    const f = fixture(), r = await report(f), before = f.state();
    expect((await workbook(f, r, '"999"')).status).toBe(412);
    const foreign = await handleGetResourceDashboard(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard?${params({ taskIds: randomUUID() })}`), f.project.publicId, { service: f.service }); expect(foreign.status).toBe(400); expect((await foreign.json()).error.code).toBe("INVALID_SELECTION");
    expect(f.state()).toEqual(before); f.catalog.updateResource(f.resources.get("A")!.id, { name: "changed" }, c.now);
    const changed = f.state(), stale = await workbook(f, r); expect(stale.status).toBe(412); expect(stale.headers.get("content-type")).toContain("json"); expect(f.state()).toEqual(changed);
  });
  it("enforces Origin/finite range limits before serving even a synthetic tiny ledger", async () => {
    const f = fixture(), r = await report(f), before = f.state();
    const body = { sourceContext: r.resourceScopeContext, scope: { kind: "exactAssignments", assignmentIds: [f.assignments.get("T1-A")] }, filters, projection: { kind: "report" } };
    for (const origin of [null, "https://evil.example"]) { const headers: Record<string, string> = { "Content-Type": "application/json" }; if (origin) headers.Origin = origin;
      const response = await handleResourceDrill(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/query`, { method: "POST", headers, body: JSON.stringify(body) }), f.project.publicId, { service: f.service, applicationBaseUrl: "https://gantt.example", environment: "production" }, true); expect(response.status).toBe(403); }
    const wide = await handleGetResourceDashboard(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard?${params({ from: "2026-01-01", to: "2027-01-02" })}`), f.project.publicId, { service: f.service }); expect(wide.status).toBe(422); expect((await wide.json()).error.code).toBe("REPORT_LIMIT_EXCEEDED"); expect(f.state()).toEqual(before);
  });
});
