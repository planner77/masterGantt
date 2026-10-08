import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import type { ResourceDashboardFilterInput, ResourcePlanDetailInput, ResourcePlanDetailKind } from "../../../src/contracts/resource-dashboard";
import { RESOURCE_DASHBOARD_LIMITS } from "../../../src/contracts/resource-dashboard";
import { ResourceDashboardService, assertResourcePlanResponseBytes } from "../../../src/server/resources/resource-dashboard-service-core";
import { handleGetResourceDashboard, handleGetResourcePlan } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { parseResourcePlanDetails } from "../../../src/server/resources/resource-dashboard-query-core";
import { resourceDashboardFixture, RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { WorkCalendarRepository } from "../../../src/server/repositories/work-calendar-repository-core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ROUTE_SECURITY_INVENTORY } from "../../../src/server/security/route-security-inventory";
const fixtures: ReturnType<typeof resourceDashboardFixture>[] = [];
function fixture() { const f = resourceDashboardFixture(); fixtures.push(f); return f; }
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach(f => f.database.close()); });
function detail(snapshotId: string, overrides: Partial<ResourcePlanDetailInput> = {}): ResourcePlanDetailInput { return { snapshotId, granularity: "week", periodId: "all", selector: { kind: "total" }, demandScope: "selected", offset: 0, limit: 50, ...overrides }; }
function task(f: ReturnType<typeof fixture>, name: string, from = "2026-10-19", to = from, projectId = f.project.id, type: "task" | "milestone" = "task") {
  return f.schedules.insertTask({ publicId: randomUUID(), externalId: name, name, projectId, type, parentId: null, sortOrder: f.schedules.nextSiblingSortOrder(projectId, null), scheduleMode: "auto", requestedStart: from, startDate: from, endDate: to, duration: type === "task" ? 1 : 0, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
}
function assign(f: ReturnType<typeof fixture>, taskId: number, resource: ReturnType<typeof f.catalog.insertResource>, percent: number | null, projectId = f.project.id) {
  f.catalog.replaceTaskAssignments({ projectId, taskId, now: RESOURCE_DASHBOARD_NOW, targets: [{ kind: "resource", publicId: resource.publicId, internalId: resource.id, assignmentPublicId: randomUUID(), allocationPercent: percent, assignmentStart: null, assignmentEnd: null }] });
}
function largeFixture(resourceCount = 40, assignmentCount = 2700) {
  const f = fixture(), project = f.createProject(), catalog = f.catalog;
  const resources = Array.from({ length: resourceCount }, (_, i) => catalog.insertResource({ publicId: randomUUID(), name: `Bench ${i}`, code: `B${i}`, description: "hidden", now: RESOURCE_DASHBOARD_NOW }));
  const groups = Array.from({ length: 5 }, (_, i) => catalog.insertGroup({ publicId: randomUUID(), name: `Group ${i}`, code: `BG${i}`, description: "hidden", now: RESOURCE_DASHBOARD_NOW }));
  groups.forEach((group, index) => catalog.replaceGroupMembers(group.id, resources.filter((_, i) => i % 5 === index).map(row => row.id), RESOURCE_DASHBOARD_NOW));
  const milestones = [task(f, "Bench M1", "2026-01-01", "2026-01-01", project.id, "milestone"), task(f, "Bench M2", "2026-01-02", "2026-01-02", project.id, "milestone")];
  const membership = new MilestoneMembershipRepository(f.database);
  f.database.transaction(() => {
    for (let index = 0; index < Math.ceil(assignmentCount / resourceCount); index++) {
      const t = task(f, `Bench task ${index}`, "2026-01-01", "2026-12-31", project.id); membership.set(project.id, t.id, milestones[index % 2].id);
      catalog.replaceTaskAssignments({ projectId: project.id, taskId: t.id, now: RESOURCE_DASHBOARD_NOW, targets: resources.slice(0, Math.min(resourceCount, assignmentCount - index * resourceCount)).map(resource => ({ kind: "resource", publicId: resource.publicId, internalId: resource.id, assignmentPublicId: randomUUID(), allocationPercent: 50, assignmentStart: null, assignmentEnd: null })) });
    }
  })();
  return { f, project, resources, milestones };
}
function overFixture() {
  const f = fixture(), a = task(f, "selected80"), b = task(f, "outside60");
  assign(f, a.id, f.resources.get("R1")!, 80); assign(f, b.id, f.resources.get("R1")!, 60);
  const memberships = new MilestoneMembershipRepository(f.database); memberships.set(f.project.id, a.id, f.tasks.get("M1")!.id); memberships.set(f.project.id, b.id, f.tasks.get("M2")!.id);
  return { f, a, b, filter: { from: "2026-10-19", to: "2026-10-20", granularity: "week" as const, milestoneIds: [f.tasks.get("M1")!.publicId] } };
}
function params(input: ResourcePlanDetailInput, filter: ResourceDashboardFilterInput = {}) {
  const p = new URLSearchParams({ snapshotId: input.snapshotId, granularity: input.granularity, periodId: input.periodId, row: input.selector.kind, demandScope: input.demandScope, offset: String(input.offset), limit: String(input.limit) });
  for (const [key, value] of Object.entries(filter)) if (value !== undefined) p.set(key, Array.isArray(value) ? value.join(",") : value === null ? "null" : String(value));
  if (input.selector.kind === "group") p.set("groupId", input.selector.groupId ?? "ungrouped");
  if (input.selector.kind === "resource" || input.selector.kind === "resourceMilestone") p.set("resourceId", input.selector.resourceId);
  if (input.selector.kind === "resourceMilestone") p.set("milestoneTaskId", input.selector.milestoneTaskId ?? "unassigned");
  if (input.date !== undefined) p.set("date", input.date); return p;
}
async function http(f: ReturnType<typeof fixture>, input: ResourcePlanDetailInput, kind: ResourcePlanDetailKind, filter: ResourceDashboardFilterInput = {}) {
  return handleGetResourcePlan(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/plan/${kind}?${params(input, filter)}`), f.project.publicId, { service: f.service }, kind);
}
describe("Issue #527 Resource Plan SQLite/public HTTP", () => {
  it("preserves legacy report and snapshot bytes across opt-in week/month/mode", () => {
    const f = fixture(), plain = f.service.getDashboard(f.project.publicId)!;
    expect(plain).not.toHaveProperty("plan"); expect(plain.filters).not.toHaveProperty("granularity");
    for (const granularity of ["week", "month"] as const) {
      const report = f.service.getDashboard(f.project.publicId, { granularity, mode: "group" })!;
      expect(report.snapshotId).toBe(plain.snapshotId); expect(report.summary).toEqual(plain.summary); expect(report.reference).toEqual(plain.reference); expect(report.resources).toEqual(plain.resources);
      expect(report.filters.granularity).toBe(granularity); expect(report.plan!.totals.summary.selected.knownMd).toBeCloseTo(plain.summary.effort.knownMd, 12);
    }
  });
  it("fixes R across period/Task/Milestone/search filters, excludes responsibility-only and unassigned global people", () => {
    const f = fixture(), outside = f.catalog.insertResource({ publicId: randomUUID(), name: "Outside history", code: null, description: "private", now: RESOURCE_DASHBOARD_NOW });
    assign(f, task(f, "outside-period", "2025-01-06").id, outside, 50);
    const responsibility = f.catalog.insertResource({ publicId: randomUUID(), name: "Summary only", code: null, description: "private", now: RESOURCE_DASHBOARD_NOW }); assign(f, f.tasks.get("S")!.id, responsibility, null);
    const hidden = f.catalog.insertResource({ publicId: randomUUID(), name: "GLOBAL HIDDEN", code: null, description: "secret", now: RESOURCE_DASHBOARD_NOW });
    f.catalog.replaceGroupMembers(f.groups.get("G1")!.id, [f.resources.get("R1")!.id, f.resources.get("R2")!.id, hidden.id], RESOURCE_DASHBOARD_NOW);
    const filter = { from: "2026-10-19", to: "2026-10-19", granularity: "month" as const, taskSearch: "NO MATCH", search: "NO MATCH", statuses: ["completed" as const], milestoneIds: [f.tasks.get("M3")!.publicId] };
    const report = f.service.getDashboard(f.project.publicId, filter)!;
    expect(report.summary.assignmentCount).toBe(0); expect(report.plan!.population.resourceCount).toBe(3);
    expect(report.plan!.resources.map(row => row.resourceId)).toContain(outside.publicId);
    expect(report.plan!.resources.map(row => row.resourceId)).not.toContain(responsibility.publicId); expect(JSON.stringify(report)).not.toContain(hidden.publicId);
    expect(report.plan!.totals.summary.selected).toMatchObject({ knownMd: 0, capacityMd: 3, state: "empty" });
    const none = f.service.getDashboard(f.project.publicId, { ...filter, roles: ["UNSPECIFIED" as const], resourceIds: [f.resources.get("R1")!.publicId] })!;
    expect(none.plan!.population.resourceIds).toEqual([]); expect(none.plan!.totals.summary.project.capacityMd).toBe(0);
  });
  it("keeps selected80/full140, non-additive Group excess and paged zero-load day Resources with all Project causes", async () => {
    const { f, filter } = overFixture(), before = f.state(), report = f.service.getDashboard(f.project.publicId, filter)!;
    const r = report.plan!.resources.find(row => row.resourceId === f.resources.get("R1")!.publicId)!;
    expect(r.summary.selected).toMatchObject({ knownMd: .8, capacityMd: 2, loadPercent: 40, peakDailyLoadPercent: 80 });
    expect(r.summary.project.knownMd).toBeCloseTo(1.4); expect(r.summary.project).toMatchObject({ overAllocatedDayCount: 1, overAllocatedResourceCount: 1, peakDailyLoadPercent: 140 });
    expect(report.plan!.groups.find(row => row.groupId === f.groups.get("G1")!.publicId)!.summary.project.excessMd).toBeCloseTo(.4); expect(report.plan!.groups.find(row => row.groupId === f.groups.get("G1")!.publicId)!.summary.project.loadPercent).toBeCloseTo(35);
    expect(r.milestones[0]).toMatchObject({ capacityReferenceOnly: true, projectReferenceOnly: true, projectReferenceRow: { kind: "resource", resourceId: r.resourceId } });
    const first = await http(f, detail(report.snapshotId, { selector: { kind: "group", groupId: f.groups.get("G1")!.publicId }, date: "2026-10-19", demandScope: "project", limit: 1 }), "day-resources", filter);
    expect(first.status).toBe(200); const one = (await first.json()).data; expect(one).toMatchObject({ totalCount: 2, nextOffset: 1, filters: report.filters, range: report.range, date: "2026-10-19", periodId: "all", demandScope: "project" });
    const all = f.service.getPlanDetails(f.project.publicId, filter, detail(report.snapshotId, { date: "2026-10-19", demandScope: "project" }), "day-resources")!;
    expect(all.rows).toHaveLength(2); expect(all.rows.some(row => "metrics" in row && row.metrics.knownMd === 0)).toBe(true);
    const causes = await http(f, detail(report.snapshotId, { selector: { kind: "resource", resourceId: r.resourceId }, date: "2026-10-19", demandScope: "project" }), "day-assignments", filter);
    const data = (await causes.json()).data; expect(data.rows.map((row: { taskName: string }) => row.taskName).sort()).toEqual(["outside60", "selected80"]);
    const mDetail = f.service.getPlanDetails(f.project.publicId, filter, detail(report.snapshotId, { selector: { kind: "resourceMilestone", resourceId: r.resourceId, milestoneTaskId: f.tasks.get("M1")!.publicId }, date: "2026-10-19", demandScope: "project" }), "day-assignments")!;
    expect(mDetail.rows).toHaveLength(1); expect(mDetail.rows[0]).toMatchObject({ knownMd: .8 }); expect(f.state()).toEqual(before);
    expect(first.headers.get("cache-control")).toBe("private, no-store"); expect(first.headers.get("x-content-type-options")).toBe("nosniff"); expect(first.headers.get("set-cookie")).toBeNull();
  });
  it("separates visible Group selection from all Group calendar memberships", () => {
    const f = fixture(), calendars = new WorkCalendarRepository(f.database), g2 = f.groups.get("G2")!;
    const rule = calendars.insertRule({ publicId: randomUUID(), projectId: f.project.id, kind: "CUSTOM", name: "G2 off", countryCode: null, targetType: "RESOURCE_GROUP", targetPublicId: g2.publicId, scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    calendars.insertDate({ calendarRuleId: rule.id, date: "2026-10-19", dayType: "NON_WORKING", name: "off", sourceKey: null, sourceVersion: null, now: RESOURCE_DASHBOARD_NOW });
    const report = f.service.getDashboard(f.project.publicId, { from: "2026-10-19", to: "2026-10-19", granularity: "month", groupIds: [f.groups.get("G1")!.publicId] })!;
    expect(report.plan!.groups.map(row => row.groupId)).toEqual([f.groups.get("G1")!.publicId]); expect(report.plan!.totals.summary.project.capacityMd).toBe(1);
    expect(report.plan!.resources.find(row => row.resourceId === f.resources.get("R1")!.publicId)!.groupIds).toContain(g2.publicId);
    f.catalog.updateGroup(g2.id, { active: false }, RESOURCE_DASHBOARD_NOW);
    const inactive = f.service.getDashboard(f.project.publicId, { from: "2026-10-19", to: "2026-10-19", granularity: "month", groupActivity: "inactive" })!;
    expect(inactive.plan!.population.resourceIds).toEqual([f.resources.get("R1")!.publicId]); expect(inactive.plan!.groups.map(row => row.groupId)).toEqual([g2.publicId]);
  });
  it("preserves null on non-working month boundary and rejudges whole distinct unknown IDs", () => {
    const f = fixture(), a = task(f, "unset weekend", "2026-10-30", "2026-11-02"); assign(f, a.id, f.resources.get("R1")!, null);
    f.database.prepare("UPDATE task_assignments SET assignment_start='2026-10-31',assignment_end='2026-11-01' WHERE task_id=?").run(a.id);
    const filter = { from: "2026-10-31", to: "2026-11-01", granularity: "month" as const, taskIds: [a.publicId] }, report = f.service.getDashboard(f.project.publicId, filter)!;
    expect(report.plan!.totals.summary.selected).toMatchObject({ plannedMd: null, state: "unset", unknownAssignmentCount: 1, unknownResourceDayCount: 0, loadPercent: null });
    expect(report.plan!.totals.cells.map(cell => cell.selected.unknownAssignmentCount)).toEqual([1, 1]); expect(report.plan!.totals.cells.map(cell => cell.selected.plannedMd)).toEqual([null, null]);
    expect(() => f.database.prepare("UPDATE task_assignments SET allocation_percent=0 WHERE task_id=?").run(a.id)).toThrow();
  });
  it("reads one transaction/clock and validates stale before current selector/range", async () => {
    const f = fixture(), clock = vi.fn(() => new Date(RESOURCE_DASHBOARD_NOW)), original = ProjectRepository.prototype.findByPublicId;
    vi.spyOn(ProjectRepository.prototype, "findByPublicId").mockImplementation(function (this: ProjectRepository, id) { expect(f.database.inTransaction).toBe(true); return original.call(this, id); });
    const service = new ResourceDashboardService(f.database, { clock }), filter = { granularity: "week" as const }, report = service.getDashboard(f.project.publicId, filter)!;
    expect(clock).toHaveBeenCalledTimes(1); clock.mockClear();
    service.getPlanDetails(f.project.publicId, filter, detail(report.snapshotId), "daily"); expect(clock).toHaveBeenCalledTimes(1);
    f.database.prepare("UPDATE tasks SET name='Changed' WHERE id=?").run(f.tasks.get("T1")!.id);
    const response = await http(f, detail(report.snapshotId, { selector: { kind: "resource", resourceId: randomUUID() }, periodId: "2026-W99" }), "daily", filter);
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("REPORT_STALE");
  });
  it("rejects foreign IDs and wrong period/date contexts while allowing week/month snapshot projections", async () => {
    const f = fixture(), filter = { from: "2026-10-05", to: "2026-10-18", granularity: "week" as const }, report = f.service.getDashboard(f.project.publicId, filter)!;
    for (const override of [{ selector: { kind: "resource" as const, resourceId: randomUUID() } }, { periodId: "2026-W99" }]) expect((await http(f, detail(report.snapshotId, override), "daily", filter)).status).toBe(400);
    const otherProject = f.createProject(), foreignMilestone = task(f, "Foreign Milestone", "2026-10-05", "2026-10-05", otherProject.id, "milestone"), before = f.state();
    for (const milestoneTaskId of [foreignMilestone.publicId, f.tasks.get("T1")!.publicId]) {
      const response = await http(f, detail(report.snapshotId, { selector: { kind: "resourceMilestone", resourceId: f.resources.get("R1")!.publicId, milestoneTaskId } }), "daily", filter);
      expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_SELECTION");
      expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("set-cookie")).toBeNull();
      expect(f.state()).toEqual(before);
    }
    const wrongDate = await http(f, detail(report.snapshotId, { selector: { kind: "resource", resourceId: f.resources.get("R1")!.publicId }, periodId: "2026-W41", date: "2026-10-18" }), "day-assignments", filter); expect(wrongDate.status).toBe(400);
    const month = f.service.getPlanDetails(f.project.publicId, { ...filter, granularity: "month" }, detail(report.snapshotId, { granularity: "month", periodId: "2026-10" }), "daily")!;
    expect(month).toMatchObject({ granularity: "month", periodId: "2026-10", totalCount: 14 });
  });
  it.each(["granularity=day", "granularity=week&granularity=month", "periodId=", "periodId=all&periodId=all", "row=other", "row=total&resourceId=bad", "row=resource", "row=total&groupId=ungrouped", "demandScope=other", "limit=101", "offset=8001", "date=2026-10-05", "view=tasks", "metric=all", "assignmentScope=selected"])("rejects malformed daily query %s", async suffix => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    const p = params(detail(report.snapshotId)); for (const key of new URLSearchParams(suffix).keys()) p.delete(key); const query = `${p}&${suffix}`;
    const response = await handleGetResourcePlan(f.request(query), f.project.publicId, { service: f.service }, "daily"); expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("validates direct callers, masks errors and records stateless public inventory", async () => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    expect(() => f.service.getPlanDetails(f.project.publicId, {}, detail(report.snapshotId, { limit: 101 }), "daily")).toThrow();
    expect(() => parseResourcePlanDetails(params(detail(report.snapshotId, { date: "2026-02-30" })), "day-resources")).toThrow();
    const response = await handleGetResourcePlan(f.request(params(detail(report.snapshotId)).toString()), f.project.publicId, { service: { getPlanDetails: () => { throw new Error("SQL secret /private.sqlite"); } } }, "daily");
    expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/SQL|secret|private.sqlite/);
    for (const kind of ["daily", "day-resources", "day-assignments"]) expect(ROUTE_SECURITY_INVENTORY.find(row => row.template.endsWith(`/resource-dashboard/plan/${kind}`))).toMatchObject({ policy: "public-read", mutatesState: false });
  });
  it("orders canonical Milestone dates before public IDs and keeps unassigned last", () => {
    const { f } = overFixture(), ids = [f.tasks.get("M1")!.publicId, f.tasks.get("M2")!.publicId].sort();
    f.database.prepare("UPDATE tasks SET start_date='2026-10-01',end_date='2026-10-01' WHERE public_id=?").run(ids[1]);
    f.database.prepare("UPDATE tasks SET start_date='2026-10-02',end_date='2026-10-02' WHERE public_id=?").run(ids[0]);
    const report = f.service.getDashboard(f.project.publicId, { from: "2026-10-05", to: "2026-10-20", granularity: "week" })!;
    const row = report.plan!.resources.find(row => row.resourceId === f.resources.get("R1")!.publicId)!;
    expect(row.milestones.map(m => m.milestoneTaskId)).toEqual([ids[1], ids[0], null]);
    expect(row.milestones.at(-1)!.name).toBe("Milestone 미지정");
  });
  it("benchmarks actual SQLite HTTP with 985500 assignment-days and rejects weekly matrix without cutting periods", async () => {
    const { f, project } = largeFixture(), filter = { from: "2026-01-01", to: "2026-12-31", granularity: "month" as const };
    const started = performance.now();
    const response = await handleGetResourceDashboard(new Request(`https://gantt.example/api/projects/${project.publicId}/resource-dashboard?${new URLSearchParams(filter)}`), project.publicId, { service: f.service });
    const body = await response.text(), elapsedMs = performance.now() - started, bytes = Buffer.byteLength(body);
    expect(response.status).toBe(200); const report = JSON.parse(body).data;
    expect(report.plan.resources).toHaveLength(40); expect(report.plan.groups).toHaveLength(5); expect(report.plan.periods).toHaveLength(12);
    expect(report.plan.totals.summary.project).toMatchObject({ capacityMd: 10440, knownMd: 352350, assignmentCount: 2700 });
    expect(report.plan.totals.cells.reduce((n: number, cell: { selected: { knownMd: number } }) => n + cell.selected.knownMd, 0)).toBe(352350);
    expect(bytes).toBeLessThanOrEqual(2097152);
    writeFileSync(join(tmpdir(), "issue-527-native-http-benchmark.json"), JSON.stringify({ resourcePlanNativeHttpBenchmark: { resources: 40, groups: 5, assignments: 2700, days: 365, resourceDays: 14600, assignmentDays: 985500, elapsedMs, bytes } }));
    expect(() => f.service.getDashboard(project.publicId, { ...filter, granularity: "week" })).toThrow(expect.objectContaining({ code: "REPORT_LIMIT_EXCEEDED", details: [expect.objectContaining({ path: "plan.matrixCells" })] }));
  });
  it("rejects full Project assignment-day budget even if Task or Milestone filters hide demand", () => {
    const { f, project, milestones } = largeFixture(40, 2740), filter = { from: "2026-01-01", to: "2026-12-31", granularity: "month" as const, milestoneIds: [milestones[0].publicId], taskSearch: "NO MATCH" };
    expect(() => f.service.getDashboard(project.publicId, filter)).toThrow(expect.objectContaining({ code: "REPORT_LIMIT_EXCEEDED", details: [expect.objectContaining({ path: "plan.assignmentDays" })] }));
  });
  it("rejects actual JSON >2MiB even when the entire matrix is below 5000 cells", () => {
    const { f, project } = largeFixture(60);
    expect(() => f.service.getDashboard(project.publicId, { from: "2026-01-01", to: "2026-12-31", granularity: "month" })).toThrow(expect.objectContaining({ code: "REPORT_LIMIT_EXCEEDED", details: [expect.objectContaining({ path: "plan.bytes" })] }));
  });
  it("bounds historical population resource-days before materializing a sparse selected matrix", () => {
    const { f, project } = largeFixture(547, 547);
    expect(() => f.service.getDashboard(project.publicId, { from: "2024-01-01", to: "2024-12-31", granularity: "month", taskSearch: "NO MATCH" })).toThrow(expect.objectContaining({ code: "REPORT_LIMIT_EXCEEDED", details: [expect.objectContaining({ path: "plan.resourceDays" })] }));
  });
  it("admits exact JSON byte limit and rejects one extra byte without truncation", () => {
    const bytes = RESOURCE_DASHBOARD_LIMITS.reportBytes, value = { data: "x".repeat(bytes - Buffer.byteLength(JSON.stringify({ data: "" }))) };
    expect(Buffer.byteLength(JSON.stringify(value))).toBe(bytes); expect(() => assertResourcePlanResponseBytes(value)).not.toThrow();
    expect(() => assertResourcePlanResponseBytes({ data: value.data + "x" })).toThrow(expect.objectContaining({ status: 422, code: "REPORT_LIMIT_EXCEEDED", details: [expect.objectContaining({ path: "plan.bytes" })] }));
  });
});
