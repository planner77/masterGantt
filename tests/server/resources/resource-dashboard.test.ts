import { dateToOrdinal, ordinalToDate } from "../../../src/domain/scheduling/date-only";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RESOURCE_DASHBOARD_LIMITS } from "../../../src/contracts/resource-dashboard";
import { workingDaysBetween } from "../../../src/domain/scheduling/calendar";
import { calculateResourceKpi } from "../../../src/domain/resources/resource-kpi";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ResourceDashboardRepository } from "../../../src/server/repositories/resource-dashboard-repository-core";
import { WorkCalendarRepository } from "../../../src/server/repositories/work-calendar-repository-core";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { handleGetResourceDashboard } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { normalizeResourceDashboardFilters, parseResourceDashboardDetails, parseResourceDashboardQuery } from "../../../src/server/resources/resource-dashboard-query-core";
import { ROUTE_SECURITY_INVENTORY } from "../../../src/server/security/route-security-inventory";
import { resourceDashboardFixture, RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";

const fixtures: ReturnType<typeof resourceDashboardFixture>[] = [], directories: string[] = [];
function fixture(filename?: string) { const f = resourceDashboardFixture(filename); fixtures.push(f); return f; }
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach((f) => { if (f.database.open) f.database.close(); }); directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });
const detail = (snapshotId: string, changes: Partial<Parameters<ResourceDashboardService["getDetails"]>[2]> = {}) => ({ snapshotId, selector: { dimension: "all" as const, id: null, metric: "all" as const }, view: "assignments" as const, offset: 0, limit: 50, ...changes });

describe("resource dashboard native SQLite and direct HTTP", () => {
  it("matches #523 raw fixture, distinct counts, all partition sums and readonly snapshot", async () => {
    const f = fixture(), before = f.state(), clock = vi.fn(() => new Date(RESOURCE_DASHBOARD_NOW));
    const service = new ResourceDashboardService(f.database, { clock, mdPerMmEnvironment: "21" });
    const original = ProjectRepository.prototype.findByPublicId;
    vi.spyOn(ProjectRepository.prototype, "findByPublicId").mockImplementation(function (this: ProjectRepository, id) { expect(f.database.inTransaction).toBe(true); return original.call(this, id); });
    const response = await handleGetResourceDashboard(f.request(), f.project.publicId, { service });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const data = (await response.json()).data;
    const raw = calculateResourceKpi(f.source);
    expect(data.summary).toMatchObject({ taskCount: raw.total.taskCount, resourceCount: 2, assignmentCount: 5, effort: { plannedMd: raw.total.effort.plannedMd, partial: true, unsetCount: 2 } });
    expect(data).toMatchObject({ schema: "resource-dashboard/1", projectRevision: 1, catalogRevision: f.catalog.getRevision(), asOfDate: "2026-10-17", timezone: "Asia/Seoul", calculatedAt: RESOURCE_DASHBOARD_NOW, mdPerMm: 21, mdPerMmSource: "environment" });
    expect(data.snapshotId).toMatch(/^[a-f0-9]{64}$/); expect(data.calendarRevision).toMatch(/^[a-f0-9]{64}$/); expect(clock).toHaveBeenCalledTimes(1);
    for (const row of [...data.resources, ...data.groups]) expect(row.milestones.reduce((sum: number, cell: { summary: { effort: { knownMd: number } } }) => sum + cell.summary.effort.knownMd, 0)).toBeCloseTo(row.summary.effort.knownMd, 14);
    expect(data.groups.find((row: { name: string }) => row.name === "G1").summary.taskCount).toBe(3);
    expect(data.groups.reduce((sum: number, row: { summary: { effort: { knownMd: number } } }) => sum + row.summary.effort.knownMd, 0)).toBeGreaterThan(data.summary.effort.knownMd);
    expect(data.resources.find((row: { id: string }) => row.id === f.resources.get("R1")!.publicId).assignmentRange).toEqual({ from: "2026-10-05", to: "2026-10-16" });
    expect(f.state()).toEqual(before);
    expect(JSON.stringify(data)).not.toMatch(/password|scrypt|tokenHash|private description|memberResourceIds|assignmentIds|incompleteMemberTaskIds/);
  });
  it("applies Resource/Group/Role/Grade/Milestone/date to the same assignment with 2-person Task1/Assignment2", () => {
    const f = fixture(), taskId = f.tasks.get("T1")!.publicId;
    expect(f.service.getDashboard(f.project.publicId, { taskIds: [taskId] })!.summary).toMatchObject({ taskCount: 1, resourceCount: 2, assignmentCount: 2 });
    const filter = { taskIds: [taskId], groupIds: [f.groups.get("G2")!.publicId], resourceIds: [f.resources.get("R1")!.publicId], roles: ["DEVELOPER" as const], developerGrades: ["ADVANCED" as const], milestoneIds: [f.tasks.get("M1")!.publicId], from: "2026-10-07", to: "2026-10-08" };
    expect(f.service.getDashboard(f.project.publicId, filter)!.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { plannedMd: 1 } });
    expect(f.service.getDashboard(f.project.publicId, { ...filter, roles: ["EQUIPMENT_OWNER"] })!.summary.assignmentCount).toBe(0);
  });
  it("keeps search A-only, taskSearch/status T0, explicit normalized null, and mode snapshot invariant", () => {
    const f = fixture();
    const filter = parseResourceDashboardQuery(new URLSearchParams(`search=%20Alice%20&resourceIds=${f.resources.get("R1")!.publicId},${f.resources.get("R1")!.publicId}&mdPerMm=null`));
    const data = f.service.getDashboard(f.project.publicId, filter)!;
    expect(data.filters.search).toBe("Alice"); expect(data.filters.resourceIds).toHaveLength(1); expect(data.mdPerMm).toBeNull(); expect(data.mdPerMmSource).toBe("query");
    expect(data.diagnostics.denominator).toBe(5); expect(data.diagnostics.inapplicableFilters).toContain("search");
    expect(data.summary.assignmentCount).toBe(3);
    const mode = f.service.getDashboard(f.project.publicId, { ...filter, mode: "group" })!;
    expect(mode.snapshotId).toBe(data.snapshotId); expect(mode.summary).toEqual(data.summary);
    const task = f.service.getDashboard(f.project.publicId, { taskSearch: "S2", statuses: ["completed"] })!;
    expect(task.diagnostics.denominator).toBe(1); expect(task.summary.taskCount).toBe(1);
    expect(f.service.getDashboard(f.project.publicId, { search: "R2" })!.summary.assignmentCount).toBe(2);
    expect(f.service.getDashboard(f.project.publicId, { search: "G2" })!.summary.assignmentCount).toBe(3);
    expect(f.service.getDashboard(f.project.publicId, { search: "G2" })!.diagnostics.denominator).toBe(5);
    expect(f.service.getDashboard(f.project.publicId, { search: "T1" })!.summary.assignmentCount).toBe(2);
    expect(f.service.getDashboard(f.project.publicId, { groupIds: ["ungrouped"] })!.summary.assignmentCount).toBe(0);
    expect(f.service.getDashboard(f.project.publicId, { milestoneIds: ["unassigned"] })!.summary.assignmentCount).toBe(1);
  });
  it("preserves full Milestone state and bounded diagnostic/detail target sets and inherited paths", async () => {
    const f = fixture(), filter = { taskIds: [f.tasks.get("T1")!.publicId] };
    const report = f.service.getDashboard(f.project.publicId, filter)!;
    expect(report.summary.assignedTaskProgress.percent).toBe(100);
    expect(report.stages.find((row) => row.milestoneTaskId === f.tasks.get("M1")!.publicId)!.full).toMatchObject({ memberCount: 2, ready: false });
    const first = f.service.getDetails(f.project.publicId, filter, detail(report.snapshotId, { limit: 1 }))!;
    expect(first.totalCount).toBe(2); expect(first.rows).toHaveLength(1); expect(first.nextOffset).toBe(1);
    expect(first.rows[0]).toMatchObject({ taskName: "T1", effectiveMilestoneTaskId: f.tasks.get("M1")!.publicId, explicitMilestoneTaskId: f.tasks.get("M1")!.publicId });
    expect(first.rows[0].wbsPath.map((row) => row.name)).toEqual(["S", "S2", "T1"]);
    f.schedules.insertLink({ publicId: randomUUID(), projectId: f.project.id, predecessorTaskId: f.tasks.get("M2")!.id, successorTaskId: f.tasks.get("M1")!.id, type: "FS", lag: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
    expect(f.service.getDashboard(f.project.publicId, filter)!.stages.find((row) => row.milestoneTaskId === f.tasks.get("M1")!.publicId)!.full.blocked).toBe(true);
    f.database.prepare("DELETE FROM links WHERE project_id=?").run(f.project.id);
    const next = f.service.getDetails(f.project.publicId, filter, detail(report.snapshotId, { offset: 1, limit: 1 }))!;
    expect(next.rows[0].assignment!.assignmentId).not.toBe(first.rows[0].assignment!.assignmentId);
    const all = f.service.getDashboard(f.project.publicId)!;
    const unassigned = f.service.getDetails(f.project.publicId, {}, detail(all.snapshotId, { selector: all.diagnostics.personallyUnassigned.selector, view: "tasks" }))!;
    expect(unassigned.totalCount).toBe(2); expect(unassigned.rows.every((row) => row.assignment === null)).toBe(true);
    expect(unassigned.rows.map((row) => row.taskName).sort()).toEqual(["T3", "T4"]);
    const params = new URLSearchParams({ snapshotId: all.snapshotId, dimension: "all", view: "tasks", metric: "completed" });
    const response = await handleGetResourceDashboard(f.request(params.toString(), true), f.project.publicId, { service: f.service }, true);
    expect(response.status).toBe(200); expect((await response.json()).data.totalCount).toBe(1);
  });
  it("distinguishes empty/unset/partial/configured zero and query/ENV M/M policies", () => {
    const f = fixture();
    const unset = f.service.getDashboard(f.project.publicId, { taskIds: [f.tasks.get("T2")!.publicId] })!;
    expect(unset.summary.effort).toMatchObject({ knownMd: 0, plannedMd: null, plannedMm: null, state: "unset", unsetCount: 2 });
    const zero = f.service.getDashboard(f.project.publicId, { taskIds: [f.tasks.get("T5")!.publicId] })!;
    expect(zero.summary.effort).toMatchObject({ plannedMd: 0, state: "configured", partial: false });
    const empty = f.service.getDashboard(f.project.publicId, { roles: ["UNSPECIFIED"] })!;
    expect(empty.summary.effort.state).toBe("empty"); expect(empty.summary.completion.percent).toBeNull();
    expect(f.service.getDashboard(f.project.publicId, { mdPerMm: 19 })!.summary.effort.plannedMm).toBe(f.service.getDashboard(f.project.publicId)!.summary.effort.knownMd / 19);
    const missing = new ResourceDashboardService(f.database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "bad" }).getDashboard(f.project.publicId)!;
    expect(missing.mdPerMm).toBeNull(); expect(missing.mdPerMmSource).toBe("unset");
  });
  it("projects only connected people/groups, preserves inactive assignments and public-read inventory", async () => {
    const f = fixture(), hidden = f.catalog.insertResource({ publicId: randomUUID(), name: "GLOBAL PRIVATE PERSON", code: "PRIVATE", description: "SECRET", now: RESOURCE_DASHBOARD_NOW });
    f.catalog.replaceGroupMembers(f.groups.get("G1")!.id, [f.resources.get("R1")!.id, f.resources.get("R2")!.id, hidden.id], RESOURCE_DASHBOARD_NOW);
    f.catalog.updateResource(f.resources.get("R1")!.id, { active: false }, RESOURCE_DASHBOARD_NOW);
    const response = await handleGetResourceDashboard(f.request(), f.project.publicId, { service: f.service });
    expect(response.status).toBe(200); const data = (await response.json()).data;
    expect(JSON.stringify(data)).not.toContain(hidden.publicId); expect(JSON.stringify(data)).not.toContain("GLOBAL PRIVATE PERSON");
    expect(data.resources.find((row: { id: string }) => row.id === f.resources.get("R1")!.publicId).active).toBe(false);
    for (const template of ["/api/projects/{publicId}/resource-dashboard", "/api/projects/{publicId}/resource-dashboard/details"]) expect(ROUTE_SECURITY_INVENTORY.find((row) => row.template === template)).toMatchObject({ policy: "public-read", mutatesState: false });
    const rejected = await handleGetResourceDashboard(f.request(`resourceIds=${hidden.publicId}`), f.project.publicId, { service: f.service }); expect(rejected.status).toBe(400);
    const missing = await handleGetResourceDashboard(f.request(), randomUUID(), { service: f.service }); expect(missing.status).toBe(404);
  });
  it.each(["unknown=1", "from=2026-02-30", "from=2026-10-20&to=2026-10-10", "mdPerMm=0", "mdPerMm=", "mdPerMm=bad", "mdPerMm=Infinity", "mdPerMm=20&mdPerMm=null", "search=x&search=y", "mode=bad", "statuses=unknown", "resourceIds=no", "taskIds=", "groupIds=unassigned", "milestoneIds=ungrouped", "roles=bad", "developerGrades=senior"]) ("rejects malformed HTTP query %s with safe readonly error", async (query) => {
    const f = fixture(), before = f.state(); const response = await handleGetResourceDashboard(f.request(query), f.project.publicId, { service: f.service });
    expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(f.state()).toEqual(before);
  });
  it("rejects stale/foreign Task/Milestone and unconnected Resource IDs instead of legacy empty matching", async () => {
    const f = fixture(), other = f.createProject();
    const task = f.schedules.insertTask({ projectId: other.id, publicId: randomUUID(), externalId: "FOREIGN", name: "FOREIGN", type: "task", parentId: null, sortOrder: 0, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 1, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
    for (const query of [`taskIds=${task.publicId}`, `milestoneIds=${task.publicId}`, `resourceIds=${randomUUID()}`, `groupIds=${randomUUID()}`, `wbsRootIds=${randomUUID()}`]) {
      const response = await handleGetResourceDashboard(f.request(query), f.project.publicId, { service: f.service }); expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_SELECTION");
    }
    const empty = f.service.getDashboard(other.publicId)!; expect(empty.catalog.resources).toEqual([]); expect(empty.summary.assignmentCount).toBe(0);
  });
  it.each(["task", "membership", "calendar", "catalog", "assignment", "revision", "link"]) ("refuses stale detail after %s changes, including writes without revision bump", (kind) => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    if (kind === "link") f.schedules.insertLink({ publicId: randomUUID(), projectId: f.project.id, predecessorTaskId: f.tasks.get("M2")!.id, successorTaskId: f.tasks.get("M1")!.id, type: "FS", lag: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
    if (kind === "task") f.database.prepare("UPDATE tasks SET name='Changed' WHERE id=?").run(f.tasks.get("T1")!.id);
    if (kind === "membership") new MilestoneMembershipRepository(f.database).set(f.project.id, f.tasks.get("T1")!.id, f.tasks.get("M2")!.id);
    if (kind === "calendar") f.schedules.insertHoliday(f.project.id, "2026-10-08", "New holiday", RESOURCE_DASHBOARD_NOW);
    if (kind === "catalog") f.catalog.updateResource(f.resources.get("R1")!.id, { name: "Changed" }, RESOURCE_DASHBOARD_NOW);
    if (kind === "assignment") f.database.prepare("UPDATE task_assignments SET allocation_percent=51 WHERE public_id=?").run(f.assignmentIds.get("A1"));
    if (kind === "revision") f.database.prepare("UPDATE projects SET revision=revision+1 WHERE id=?").run(f.project.id);
    expect(() => f.service.getDetails(f.project.publicId, {}, detail(report.snapshotId))).toThrow("기준 데이터");
  });
  it("returns 409 when selected Task is deleted or filter/conversion changes before detail", async () => {
    const f = fixture(), taskId = f.tasks.get("T1")!.publicId, filter = { taskIds: [taskId] };
    const report = f.service.getDashboard(f.project.publicId, filter)!;
    f.database.prepare("DELETE FROM tasks WHERE id=?").run(f.tasks.get("T1")!.id);
    const params = new URLSearchParams({ taskIds: taskId, snapshotId: report.snapshotId, dimension: "all" });
    const response = await handleGetResourceDashboard(f.request(params.toString(), true), f.project.publicId, { service: f.service }, true);
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("REPORT_STALE");
    const current = f.service.getDashboard(f.project.publicId)!;
    expect(() => f.service.getDetails(f.project.publicId, { mdPerMm: 19 }, detail(current.snapshotId))).toThrow("기준 데이터");
    expect(() => f.service.getDetails(f.project.publicId, { search: "Alice" }, detail(current.snapshotId))).toThrow("기준 데이터");
  });
  it("supports empty Project date fallback without storing synthetic schedule and masks backend errors", async () => {
    const f = fixture(), empty = f.createProject(), before = f.projects.findById(empty.id);
    const report = f.service.getDashboard(empty.publicId)!;
    expect(report.rangeFallback).toBe(true); expect(report.range).toEqual({ from: "2026-10-17", to: "2026-10-17" }); expect(report.summary.taskCount).toBe(0); expect(f.projects.findById(empty.id)).toEqual(before);
    expect(f.service.getDashboard(empty.publicId, { from: "2026-10-01", to: "2026-10-02" })!.rangeFallback).toBe(false);
    const response = await handleGetResourceDashboard(f.request(), f.project.publicId, { service: { getDashboard: () => { throw new Error("SQL password /private/db"); }, getDetails: () => undefined } });
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("/private/db");
  });
  it("bounds raw tokens/search/page/selector and full snapshot/period before materialization", async () => {
    const f = fixture();
    expect(() => parseResourceDashboardQuery(new URLSearchParams({ resourceIds: Array.from({ length: 201 }, () => f.resources.get("R1")!.publicId).join(",") }))).toThrow();
    expect(() => normalizeResourceDashboardFilters({ search: "x".repeat(201) })).toThrow();
    for (const query of ["limit=101", "limit=0", "offset=8001", "snapshotId=bad", "dimension=diagnostic&metric=all", "dimension=resource", "dimension=all&id=unassigned", "dimension=all&metric=groupOnly"]) expect(() => parseResourceDashboardDetails(new URLSearchParams(`snapshotId=${"a".repeat(64)}&${query}`))).toThrow();
    const counts = new ResourceDashboardRepository(f.database).counts(f.project.id);
    for (const key of ["tasks", "assignments", "links", "calendarRules", "calendarDates", "catalogMemberships"] as const) {
      const spy = vi.spyOn(ResourceDashboardRepository.prototype, "counts").mockReturnValue({ ...counts, [key]: RESOURCE_DASHBOARD_LIMITS[key] + 1 });
      const response = await handleGetResourceDashboard(f.request(), f.project.publicId, { service: f.service }); expect(response.status).toBe(422); expect((await response.json()).error.details[0].path).toBe(`snapshot.${key}`); spy.mockRestore();
    }
    const period = await handleGetResourceDashboard(f.request("from=2026-01-01&to=2027-01-02"), f.project.publicId, { service: f.service }); expect(period.status).toBe(422);
  });
  it("keeps same WAL read snapshot during another connection's change and verifies restart persistence", () => {
    const directory = mkdtempSync(join(tmpdir(), "resource-dashboard-")); directories.push(directory);
    const filename = join(directory, "test.sqlite3"), f = fixture(filename), baseline = f.service.getDashboard(f.project.publicId)!;
    const other = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
    try {
      const clock = vi.fn(() => { other.prepare("UPDATE task_assignments SET allocation_percent=99 WHERE public_id=?").run(f.assignmentIds.get("A1")); return new Date(RESOURCE_DASHBOARD_NOW); });
      const service = new ResourceDashboardService(f.database, { clock, mdPerMmEnvironment: "21" });
      expect(service.getDashboard(f.project.publicId)!.summary).toEqual(baseline.summary); expect(clock).toHaveBeenCalledTimes(1);
      expect(f.service.getDashboard(f.project.publicId)!.snapshotId).not.toBe(baseline.snapshotId);
    } finally { other.close(); }
    const current = f.service.getDashboard(f.project.publicId)!; f.database.close();
    const reopened = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
    try { expect(new ResourceDashboardService(reopened, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }).getDashboard(f.project.publicId)).toEqual(current); } finally { reopened.close(); }
  });
  it("reuses full Group calendars, supports WORKING override and avoids per-resource calendar reads", async () => {
    const f = fixture(), repository = new WorkCalendarRepository(f.database);
    const rule = repository.insertRule({ publicId: randomUUID(), projectId: f.project.id, kind: "CUSTOM", name: "Resource working", countryCode: null, targetType: "RESOURCE", targetPublicId: f.resources.get("R1")!.publicId, scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    repository.insertDate({ calendarRuleId: rule.id, date: "2026-10-06", dayType: "WORKING", name: "Working", sourceKey: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    const spy = vi.spyOn(WorkCalendarRepository.prototype, "listRules");
    const data = f.service.getDashboard(f.project.publicId, { taskIds: [f.tasks.get("T1")!.publicId], resourceIds: [f.resources.get("R1")!.publicId] })!;
    expect(data.summary.effort.plannedMd).toBe(2.5); expect(spy.mock.calls.length).toBeLessThanOrEqual(3);
    const groupRule = repository.insertRule({ publicId: randomUUID(), projectId: f.project.id, kind: "CUSTOM", name: "G2 nonworking", countryCode: null, targetType: "RESOURCE_GROUP", targetPublicId: f.groups.get("G2")!.publicId, scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    repository.insertDate({ calendarRuleId: groupRule.id, date: "2026-10-05", dayType: "NON_WORKING", name: null, sourceKey: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    expect(f.service.getDashboard(f.project.publicId, { taskIds: [f.tasks.get("T1")!.publicId], resourceIds: [f.resources.get("R1")!.publicId], groupIds: [f.groups.get("G1")!.publicId] })!.summary.effort.plannedMd).toBe(2);
    const conflicting = repository.insertRule({ publicId: randomUUID(), projectId: f.project.id, kind: "CUSTOM", name: "G1 working", countryCode: null, targetType: "RESOURCE_GROUP", targetPublicId: f.groups.get("G1")!.publicId, scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    repository.insertDate({ calendarRuleId: conflicting.id, date: "2026-10-05", dayType: "WORKING", name: null, sourceKey: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    const response = await handleGetResourceDashboard(f.request(), f.project.publicId, { service: f.service }); expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("RESOURCE_CALENDAR_EXCEPTION_CONFLICT");
  });
  it("benchmarks actual SQLite wide multi-group report and rejects repetition/cell/path budgets without truncation", () => {
    const f = fixture(), resource = f.resources.get("R1")!;
    const extraGroups = Array.from({ length: 6 }, (_, index) => f.catalog.insertGroup({ publicId: randomUUID(), name: `Benchmark G${index}`, code: null, description: "", now: RESOURCE_DASHBOARD_NOW }));
    for (const group of extraGroups) f.catalog.replaceGroupMembers(group.id, [resource.id], RESOURCE_DASHBOARD_NOW);
    f.database.transaction(() => {
      for (let index = 0; index < 1000; index++) {
        const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `B${index}`, name: `Benchmark ${index}`, type: "task", parentId: null, sortOrder: index + 100, scheduleMode: "auto", requestedStart: "2026-01-01", startDate: "2026-01-01", endDate: "2026-12-31", duration: workingDaysBetween("2026-01-01", "2026-12-31", f.source.projectCalendar), progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: [{ publicId: resource.publicId, kind: "resource", internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 33.333333 }] });
      }
    })();
    const started = performance.now(), result = f.service.getDashboard(f.project.publicId)!, elapsed = performance.now() - started;
    expect(result.summary.assignmentCount).toBe(1005); expect(result.summary.taskCount).toBe(1003); expect(result.groups).toHaveLength(8);
    expect(result.summary.effort.knownMd).toBeCloseTo(2 + 4 * 33.333333 / 100 + 1000 * workingDaysBetween("2026-01-01", "2026-12-31", f.source.projectCalendar) * 33.333333 / 100, 8);
    const evidence = { tasks: f.schedules.listTasks(f.project.id).length, assignments: 1005, groups: 8, rangeDays: 365, effectiveWorkingDays: workingDaysBetween("2026-01-01", "2026-12-31", f.source.projectCalendar), elapsedMs: Number(elapsed.toFixed(2)), reportBytes: Buffer.byteLength(JSON.stringify(result)), maxLocalMs: 3000 };
    if (process.env.RESOURCE_DASHBOARD_BENCHMARK_OUTPUT) writeFileSync(process.env.RESOURCE_DASHBOARD_BENCHMARK_OUTPUT, JSON.stringify(evidence, null, 2));
    expect(elapsed).toBeLessThan(3000);
    for (let index = 0; index < 10; index++) {
      const group = f.catalog.insertGroup({ publicId: randomUUID(), name: `Overflow G${index}`, code: null, description: "", now: RESOURCE_DASHBOARD_NOW });
      f.catalog.replaceGroupMembers(group.id, [resource.id], RESOURCE_DASHBOARD_NOW);
    }
    expect(() => f.service.getDashboard(f.project.publicId)).toThrow("snapshot.groupAssignmentRows");
  });
  it("applies activity filters to the same Group membership and keeps T0/full-stage state", () => {
    const f = fixture();
    f.catalog.updateGroup(f.groups.get("G2")!.id, { active: false }, RESOURCE_DASHBOARD_NOW);
    f.catalog.updateResource(f.resources.get("R1")!.id, { active: false }, RESOURCE_DASHBOARD_NOW);
    expect(f.service.getDashboard(f.project.publicId, { resourceActivity: "active" })!.summary.assignmentCount).toBe(2);
    expect(f.service.getDashboard(f.project.publicId, { resourceActivity: "inactive" })!.summary.assignmentCount).toBe(3);
    const empty = f.service.getDashboard(f.project.publicId, { groupIds: [f.groups.get("G1")!.publicId], groupActivity: "inactive" })!;
    expect(empty.summary.assignmentCount).toBe(0); expect(empty.diagnostics.denominator).toBe(5);
    expect(f.service.getDashboard(f.project.publicId, { groupIds: [f.groups.get("G2")!.publicId], groupActivity: "inactive" })!.summary.assignmentCount).toBe(3);
    const all = f.service.getDashboard(f.project.publicId)!;
    expect(empty.stages.map((row) => row.full)).toEqual(all.stages.map((row) => row.full));
    expect(empty.filters.groupActivity).toBe("inactive");
    expect(() => normalizeResourceDashboardFilters({ resourceActivity: "bad" as "active" })).toThrow();
  });
  it("rejects actual matrix cell explosion before materializing cell summaries", () => {
    const f = fixture();
    f.database.transaction(() => {
      const people = Array.from({ length: 100 }, (_, index) => f.catalog.insertResource({ publicId: randomUUID(), name: `Cell resource ${index}`, code: null, description: "", now: RESOURCE_DASHBOARD_NOW }));
      for (let index = 0; index < 50; index++) {
        const milestone = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `CM${index}`, name: `CM${index}`, type: "milestone", parentId: null, sortOrder: 100 + index, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 0, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
        const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `CT${index}`, name: `CT${index}`, type: "task", parentId: null, sortOrder: 200 + index, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 1, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
        new MilestoneMembershipRepository(f.database).set(f.project.id, task.id, milestone.id);
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: people.map((resource) => ({ publicId: resource.publicId, kind: "resource", internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 1 })) });
      }
    })();
    const before = f.state(); expect(() => f.service.getDashboard(f.project.publicId)).toThrow("projection.cells"); expect(f.state()).toEqual(before);
  });
  it("rejects actual deep hierarchy path and excessive Resource memberships", () => {
    const f = fixture(); let parentId: number | null = null;
    f.database.transaction(() => {
      for (let index = 0; index < 320; index++) {
        const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `DEEP${index}`, name: `D${index}`, type: "summary", parentId, sortOrder: 100 + index, scheduleMode: "auto", requestedStart: null, startDate: null, endDate: null, duration: null, progress: null, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW }); parentId = task.id;
      }
    })();
    expect(() => f.service.getDashboard(f.project.publicId)).toThrow("snapshot.wbsPathEntries");
    const g = fixture();
    for (let index = 0; index < 31; index++) { const group = g.catalog.insertGroup({ publicId: randomUUID(), name: `G${index}`, code: null, description: "", now: RESOURCE_DASHBOARD_NOW }); g.catalog.replaceGroupMembers(group.id, [g.resources.get("R1")!.id], RESOURCE_DASHBOARD_NOW); }
    expect(() => g.service.getDashboard(g.project.publicId)).toThrow("snapshot.groupsPerResource");
  });

});


describe("#529 raw unset diagnostic compatibility", () => {
  it("counts raw pre-person Assignments and preserves within/outside effort ranges across details and scope", () => {
    const f = fixture(), filters = { from: "2026-10-07", to: "2026-10-08", resourceIds: [f.resources.get("R1")!.publicId] };
    f.database.prepare("UPDATE task_assignments SET assignment_start='2026-10-12', assignment_end='2026-10-16' WHERE public_id=?").run(f.assignmentIds.get("A3"));
    const report = f.service.getDashboard(f.project.publicId, filters)!; expect(report.diagnostics.unsetAssignmentCount).toBe(2);
    const selector = report.diagnostics.unsetTasks.selector;
    const parsed = parseResourceDashboardDetails(new URLSearchParams({ snapshotId: report.snapshotId, dimension: "diagnostic", metric: "unset", view: "assignments" }));
    const rows = f.service.getDetails(f.project.publicId, filters, parsed)!; expect(rows.totalCount).toBe(2);
    const outside = rows.rows.find(row => row.assignment!.assignmentId === f.assignmentIds.get("A3"))!.assignment!;
    const inside = rows.rows.find(row => row.assignment!.assignmentId === f.assignmentIds.get("A4"))!.assignment!;
    expect(outside).toMatchObject({ from: "2026-10-12", to: "2026-10-16", effectiveWorkingDays: 5, allocationOverlapsReport: false, effortRangeBasis: "raw-allocation", plannedMd: null, plannedMm: null });
    expect(inside).toMatchObject({ from: "2026-10-07", to: "2026-10-08", effectiveWorkingDays: 2, allocationOverlapsReport: true, effortRangeBasis: "report-overlap", plannedMd: null, plannedMm: null });
    const scope = f.service.getScope(f.project.publicId, { view: "dashboard", filters, snapshotId: report.snapshotId, selector })!;
    expect("assignmentIds" in scope && scope.assignmentIds).toEqual([f.assignmentIds.get("A3")!, f.assignmentIds.get("A4")!].sort());
    expect(() => parseResourceDashboardDetails(new URLSearchParams({ snapshotId: report.snapshotId, dimension: "diagnostic", metric: "completelyUnassigned", view: "assignments" }))).toThrow();
    const selected = f.service.getDetails(f.project.publicId, filters, detail(report.snapshotId))!; expect(selected.rows.some(row => row.assignment?.assignmentId === f.assignmentIds.get("A3"))).toBe(false);
  });
  it("keeps original exact Assignment intersection without co-assignee expansion", () => {
    const f = fixture(), filters = { resourceIds: [f.resources.get("R2")!.publicId] }, scope = { kind: "exactAssignments" as const, assignmentIds: [f.assignmentIds.get("A3")!] };
    const report = f.service.getDashboard(f.project.publicId, filters, scope)!;
    expect(report.summary.assignmentCount).toBe(0); expect(report.diagnostics.unsetAssignmentCount).toBe(1);
    const rows = f.service.getDetails(f.project.publicId, filters, detail(report.snapshotId, { selector: report.diagnostics.unsetTasks.selector }), scope)!;
    expect(rows.totalCount).toBe(1); expect(rows.rows[0].assignment!.assignmentId).toBe(f.assignmentIds.get("A3"));
    const result = f.service.getScope(f.project.publicId, { view: "dashboard", filters, snapshotId: report.snapshotId, selector: report.diagnostics.unsetTasks.selector }, scope)!;
    expect("assignmentIds" in result && result.assignmentIds).toEqual([f.assignmentIds.get("A3")!]);
  });
  it("accepts aggregate original allocation 1000000 days without an individual 366-day cap and rejects 1000001", () => {
    const f = fixture(), first = "2000-01-01", last = ordinalToDate(dateToOrdinal(first) + 49999);
    f.database.prepare("DELETE FROM task_assignments WHERE project_id=?").run(f.project.id);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `LONG${i}`, name: `LONG${i}`, type: "task", parentId: null, sortOrder: i + 100, scheduleMode: "auto", requestedStart: first, startDate: first, endDate: last, duration: 10000, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
      const id = randomUUID(); ids.push(id); f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: [{ kind: "resource", publicId: f.resources.get("R1")!.publicId, internalId: f.resources.get("R1")!.id, assignmentPublicId: id, assignmentStart: first, assignmentEnd: last, allocationPercent: null }] });
    }
    const filters = { from: "2026-10-07", to: "2026-10-08" }, report = f.service.getDashboard(f.project.publicId, filters)!;
    const input = detail(report.snapshotId, { selector: report.diagnostics.unsetTasks.selector }); expect(f.service.getDetails(f.project.publicId, filters, input)!.totalCount).toBe(20);
    const taskId = f.database.prepare("SELECT task_id FROM task_assignments WHERE public_id=?").get(ids[0]) as { task_id: number };
    f.database.prepare("UPDATE tasks SET end_date=? WHERE id=?").run(ordinalToDate(dateToOrdinal(last) + 1), taskId.task_id);
    f.database.prepare("UPDATE task_assignments SET assignment_end=? WHERE public_id=?").run(ordinalToDate(dateToOrdinal(last) + 1), ids[0]);
    const fresh = f.service.getDashboard(f.project.publicId, filters)!; expect(() => f.service.getDetails(f.project.publicId, filters, { ...input, snapshotId: fresh.snapshotId })).toThrowError(expect.objectContaining({ status: 422 }));
  });
});
