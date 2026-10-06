import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MilestoneDashboardDto } from "../../../src/contracts/milestone-dashboard";
import { openDatabase } from "../../../src/server/db/core";
import { LogisticsDashboardService } from "../../../src/server/logistics/logistics-dashboard-service";
import { handleGetLogisticsDashboard } from "../../../src/server/logistics/logistics-handlers-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { handleGetMilestoneDashboard, parseMilestoneDashboardQuery } from "../../../src/server/projects/milestone-dashboard-handlers-core";
import { MilestoneDashboardService } from "../../../src/server/projects/milestone-dashboard-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { WorkCalendarRepository } from "../../../src/server/repositories/work-calendar-repository-core";
import { ResourceWorkloadService } from "../../../src/server/resources/resource-workload-service-core";
import { ROUTE_SECURITY_INVENTORY } from "../../../src/server/security/route-security-inventory";

const NOW = "2026-10-06T15:00:00.000Z", migrationsDirectory = join(process.cwd(), "db/migrations");
const databases: ReturnType<typeof openDatabase>["database"][] = [], directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); databases.splice(0).forEach((db) => { if (db.open) db.close(); }); directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });
function fixture(filename = ":memory:") {
  const db = openDatabase({ filename, migrationsDirectory }).database; databases.push(db);
  const projects = new ProjectRepository(db), schedules = new ScheduleRepository(db), catalog = new ResourceCatalogRepository(db);
  const createProject = () => projects.insert({ publicId: randomUUID(), name: "Dashboard", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16), passwordHash: Buffer.alloc(32), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: NOW, updatedAt: NOW });
  const project = createProject();
  const addTask = (name: string, type: "task" | "summary" | "milestone" = "task", parentId: number | null = null) => schedules.insertTask({ projectId: project.id, publicId: randomUUID(), externalId: name, name, type, parentId, sortOrder: schedules.nextSiblingSortOrder(project.id, parentId), scheduleMode: "auto", requestedStart: type === "summary" ? null : "2026-10-05", startDate: "2026-10-05", endDate: type === "milestone" ? "2026-10-05" : "2026-10-09", duration: type === "milestone" ? 0 : 5, progress: 0, createdAt: NOW, updatedAt: NOW });
  const milestone = addTask("M", "milestone"), summary = addTask("S", "summary"), task = addTask("T", "task", summary.id), unassigned = addTask("U");
  new MilestoneMembershipRepository(db).set(project.id, summary.id, milestone.id);
  const resource = catalog.insertResource({ publicId: randomUUID(), name: "R", code: "R", description: "", developerGrade: "EXPERT", now: NOW });
  catalog.replaceResourceRoles(resource.id, ["DEVELOPER"], NOW);
  const group1 = catalog.insertGroup({ publicId: randomUUID(), name: "G1", code: "G1", description: "", now: NOW });
  const group2 = catalog.insertGroup({ publicId: randomUUID(), name: "G2", code: "G2", description: "", now: NOW });
  catalog.replaceGroupMembers(group1.id, [resource.id], NOW); catalog.replaceGroupMembers(group2.id, [resource.id], NOW);
  const assign = (target: typeof task, percent: number | null) => catalog.replaceTaskAssignments({ projectId: project.id, taskId: target.id, now: NOW, targets: [{ publicId: resource.publicId, kind: "resource", internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: percent, assignmentRole: "DEVELOPER" }] });
  assign(task, 50); assign(unassigned, null);
  const clock = vi.fn(() => new Date(NOW));
  const service = new MilestoneDashboardService(db, { clock, mdPerMmEnvironment: "20" });
  const request = (query = "") => new Request(`https://gantt.example/api/projects/${project.publicId}/milestone-dashboard?${query}`);
  const state = () => ({ project: projects.findById(project.id), tasks: schedules.listTasks(project.id), assignments: catalog.listAssignments(project.id), links: schedules.listLinks(project.id), memberships: new MilestoneMembershipRepository(db).list(project.id), catalog: catalog.getRevision() });
  return { db, projects, project, schedules, catalog, milestone, summary, task, unassigned, resource, group1, group2, service, clock, request, state, createProject };
}

describe("milestone dashboard SQLite readonly HTTP contract", () => {
  it("reads one transaction and one clock, returns minimal catalog without secrets and never mutates", async () => {
    const f = fixture(), before = f.state();
    const original = ProjectRepository.prototype.findByPublicId;
    const spy = vi.spyOn(ProjectRepository.prototype, "findByPublicId").mockImplementation(function (this: ProjectRepository, id) { expect(f.db.inTransaction).toBe(true); return original.call(this, id); });
    const response = await handleGetMilestoneDashboard(f.request(), f.project.publicId, { service: f.service });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("set-cookie")).toBeNull();
    const data = (await response.json()).data as MilestoneDashboardDto;
    expect(spy).toHaveBeenCalled(); expect(f.clock).toHaveBeenCalledTimes(1);
    expect(data).toMatchObject({ projectRevision: 1, catalogRevision: f.catalog.getRevision(), asOfDate: "2026-10-07", timezone: "Asia/Seoul", mdPerMm: 20, mdPerMmSource: "environment", calculatedAt: NOW });
    expect(data.rows[0].stageGate.memberTaskIds).toEqual([f.task.publicId]); expect(data.effort.plannedMd).toBe(2.5); expect(data.effort.unsetAllocationCount).toBe(1);
    expect(data.catalog.resources).toEqual([{ id: f.resource.publicId, name: "R", code: "R", active: true, developerGrade: "EXPERT" }]);
    expect(JSON.stringify(data)).not.toMatch(/password|scrypt|tokenHash|salt|session/i); expect(f.state()).toEqual(before);
  });
  it("uses hierarchy Group/Resource calendars and matches workload totals with M buckets", () => {
    const f = fixture(), calendars = new WorkCalendarRepository(f.db);
    const rule = (targetType: "RESOURCE_GROUP" | "RESOURCE", targetPublicId: string, date: string, dayType: "NON_WORKING" | "WORKING") => {
      const stored = calendars.insertRule({ publicId: randomUUID(), projectId: f.project.id, kind: "CUSTOM", name: targetType, countryCode: null, targetType, targetPublicId, scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now: NOW });
      calendars.insertDate({ calendarRuleId: stored.id, date, dayType, name: targetType, sourceKey: null, sourceVersion: null, now: NOW });
    };
    rule("RESOURCE_GROUP", f.group1.publicId, "2026-10-06", "NON_WORKING"); rule("RESOURCE", f.resource.publicId, "2026-10-07", "NON_WORKING");
    const data = f.service.getDashboard(f.project.publicId)!;
    const workload = new ResourceWorkloadService(f.db).get(f.project.publicId, "2026-10-05", "2026-10-09", "20")!.data;
    expect(data.effort.plannedMd).toBe(1.5); expect(data.effort.plannedMd).toBe(workload.grandTotalMd); expect(data.effort.unsetAllocationCount).toBe(workload.unsetCount);
    expect(data.effort.buckets.reduce((sum, row) => sum + row.plannedMd, 0)).toBe(data.effort.plannedMd);
    expect(data.effort.assignments.find((row) => row.taskId === f.task.publicId)!.effectiveWorkingDays).toBe(3);
  });
  it("echoes normalized arrays, explicit null and actual range; search does not alter totals", async () => {
    const f = fixture(), query = `search=%20M%20&resourceIds=${f.resource.publicId},${f.resource.publicId}&resourceIds=${f.resource.publicId}&assignmentRoles=DEVELOPER&mdPerMm=null&from=2026-10-05&to=2026-10-05`;
    const response = await handleGetMilestoneDashboard(f.request(query), f.project.publicId, { service: f.service });
    const data = (await response.json()).data as MilestoneDashboardDto;
    expect(data.filters).toMatchObject({ search: "M", resourceIds: [f.resource.publicId], mdPerMm: null, mdPerMmProvided: true, from: "2026-10-05", to: "2026-10-05" });
    expect(data.mdPerMmSource).toBe("query"); expect(data.mdPerMm).toBeNull(); expect(data.effort.plannedMm).toBeNull(); expect(data.effort.plannedMd).toBe(0.5);
  });
  it("isolates projects and matches unknown catalog selections as empty rather than expanding", async () => {
    const f = fixture(), other = f.createProject();
    expect(f.service.getDashboard(other.publicId)!.rows).toEqual([]); expect(f.service.getDashboard(other.publicId)!.catalog.resources).toEqual([]);
    const response = await handleGetMilestoneDashboard(f.request(`resourceIds=${randomUUID()}`), f.project.publicId, { service: f.service });
    expect(response.status).toBe(200); const data = (await response.json()).data; expect(data.scope.taskIds).toEqual([]); expect(data.rows).toEqual([]);
    const absent = await handleGetMilestoneDashboard(f.request(), randomUUID(), { service: f.service }); expect(absent.status).toBe(404);
  });
  it("tracks Project/Catalog revisions and recomputes dates on fresh reads rather than caching", () => {
    const f = fixture(); expect(f.service.getDashboard(f.project.publicId)!.projectRevision).toBe(1);
    f.db.prepare("UPDATE projects SET revision=revision+1 WHERE id=?").run(f.project.id); f.catalog.advanceRevision(f.catalog.getRevision(), NOW);
    f.clock.mockReturnValue(new Date("2026-10-07T15:00:00Z"));
    const data = f.service.getDashboard(f.project.publicId)!;
    expect(data.projectRevision).toBe(2); expect(data.catalogRevision).toBe(f.catalog.getRevision()); expect(data.asOfDate).toBe("2026-10-08");
  });
  it.each(["unknown=true", "horizonDays=0", "horizonDays=91", "horizonDays=1.5", "horizonDays=2&horizonDays=3", "asOfDate=2026-02-30", "from=2026-10-10&to=2026-10-01", "systemView=bad", "activeOnly=1", "resourceIds=not-a-uuid", "resourceIds=", "assignmentRoles=owner", "developerGrades=senior", "mdPerMm=", "mdPerMm=0", "mdPerMm=NaN", "mdPerMm=Infinity", "mdPerMm=20&mdPerMm=null", "search=x&search=y", "from=2026-11-01", "to=2026-09-01"])("rejects invalid %s with 400, no writes", async (query) => {
    const f = fixture(), before = f.state(); const response = await handleGetMilestoneDashboard(f.request(query), f.project.publicId, { service: f.service });
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_REQUEST"); expect(f.state()).toEqual(before);
  });
  it("bounds filter count/query/search length and masks unexpected backend errors", async () => {
    expect(() => parseMilestoneDashboardQuery(new URLSearchParams({ resourceIds: Array.from({ length: 501 }, () => randomUUID()).join(",") }))).toThrow();
    expect(() => parseMilestoneDashboardQuery(new URLSearchParams({ search: "x".repeat(201) }))).toThrow();
    const f = fixture(); const response = await handleGetMilestoneDashboard(f.request(), f.project.publicId, { service: { getDashboard: () => { throw new Error("SQL sensitive path /private/db"); } } });
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("/private/db");
  });
  it.each(["mdPerMm=bad", "mdPerMm=", "mdPerMm=-1", "mdPerMm=20&mdPerMm=30"])("logistics also rejects conversion %s", async (query) => {
    const f = fixture(); const response = await handleGetLogisticsDashboard(f.request(query), f.project.publicId, { logisticsService: new LogisticsService(f.db), projectService: new TaskFieldProjectService(f.db), dashboardService: new LogisticsDashboardService(f.db), applicationBaseUrl: "https://gantt.example", environment: "production" });
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
  it("logistics shares conversion policy and full-stage projection while keeping prior KPI/effort scope", async () => {
    const f = fixture(), dashboard = new LogisticsDashboardService(f.db, { clock: f.clock, mdPerMmEnvironment: "20" });
    const deps = { logisticsService: new LogisticsService(f.db), projectService: new TaskFieldProjectService(f.db), dashboardService: dashboard, applicationBaseUrl: "https://gantt.example", environment: "production" };
    const normal = (await (await handleGetLogisticsDashboard(f.request(), f.project.publicId, deps)).json()).data;
    const unset = (await (await handleGetLogisticsDashboard(f.request("mdPerMm=null"), f.project.publicId, deps)).json()).data;
    expect(normal.effort).toMatchObject({ plannedMd: 2.5, mdPerMm: 20, plannedMm: 0.125, mdPerMmSource: "environment" });
    expect(unset.effort).toMatchObject({ plannedMd: 2.5, mdPerMm: null, plannedMm: null, mdPerMmSource: "query" });
    expect(normal.kpi).toEqual(unset.kpi); expect(normal.includedTaskIds).toEqual(unset.includedTaskIds);
    expect(unset.milestoneStages.rows[0].stageGate.memberTaskIds).toEqual([f.task.publicId]);
    expect((await handleGetLogisticsDashboard(f.request("asOfDate=2199-12-31&horizonDays=90"), f.project.publicId, deps)).status).toBe(200);
    expect((await handleGetMilestoneDashboard(f.request("asOfDate=2199-12-31&horizonDays=90"), f.project.publicId, { service: f.service })).status).toBe(200);
  });
  it("keeps persisted memberships and planned effort across actual SQLite close/reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "stage-dashboard-")); directories.push(directory);
    const filename = join(directory, "project.sqlite3"), f = fixture(filename), before = f.service.getDashboard(f.project.publicId)!;
    f.db.close(); const reopened = openDatabase({ filename, migrationsDirectory }).database; databases.push(reopened);
    const after = new MilestoneDashboardService(reopened, { clock: () => new Date(NOW), mdPerMmEnvironment: "20" }).getDashboard(f.project.publicId)!;
    expect(after).toEqual(before);
  });
  it("registers only a public readonly GET and rejects noncanonical public IDs", async () => {
    expect(ROUTE_SECURITY_INVENTORY.filter((entry) => entry.template === "/api/projects/{publicId}/milestone-dashboard")).toEqual([{ template: "/api/projects/{publicId}/milestone-dashboard", method: "GET", policy: "public-read", mutatesState: false }]);
    const f = fixture(); expect((await handleGetMilestoneDashboard(f.request(), "bad-id", { service: f.service })).status).toBe(404);
  });
});
