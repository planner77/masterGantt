import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { handleGetResourceDashboard } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { parseResourceDashboardDetails, parseResourceDashboardGroupChildren } from "../../../src/server/resources/resource-dashboard-query-core";
import { resourceDashboardFixture, RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";
import { ROUTE_SECURITY_INVENTORY } from "../../../src/server/security/route-security-inventory";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { WorkCalendarRepository } from "../../../src/server/repositories/work-calendar-repository-core";

const fixtures: ReturnType<typeof resourceDashboardFixture>[] = [];
function fixture() { const f = resourceDashboardFixture(); fixtures.push(f); return f; }
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach((f) => f.database.close()); });
const children = (snapshotId: string, groupId: string | null, extra = {}) => ({ snapshotId, groupId, offset: 0, limit: 50, ...extra });
const query = (snapshotId: string, groupId: string) => new URLSearchParams({ snapshotId, groupId }).toString();

function resolve(f: ReturnType<typeof fixture>, snapshotId: string, selector: Parameters<ResourceDashboardService["getDetails"]>[2]["selector"], filter = {}) {
  return f.service.getDetails(f.project.publicId, filter, { snapshotId, selector, view: "assignments", offset: 0, limit: 100 })!;
}

describe("Issue #526 server Milestone rollup", () => {
  it("recalculates selected/reference/excluded raw sets instead of subtracting non-additive Resource counts and progress", () => {
    const f = fixture(), filter = { milestoneIds: [f.tasks.get("M1")!.publicId] }, report = f.service.getDashboard(f.project.publicId, filter)!;
    expect(report.summary).toMatchObject({ taskCount: 2, resourceCount: 2, assignmentCount: 4, effort: { state: "partial", unsetCount: 2 } });
    expect(report.reference).toMatchObject({ taskCount: 3, resourceCount: 2, assignmentCount: 5 });
    expect(report.excluded).toMatchObject({ taskCount: 1, resourceCount: 1, assignmentCount: 1, assignedTaskProgress: { numerator: 0, denominator: 2, percent: 0 }, effort: { state: "configured", plannedMd: 0 } });
    expect(report.reference!.resourceCount - report.summary.resourceCount).toBe(0);
    expect(report.excluded!.resourceCount).toBe(1);
    const selected = resolve(f, report.snapshotId, report.summary.selector, filter), reference = resolve(f, report.snapshotId, report.reference!.selector, filter), excluded = resolve(f, report.snapshotId, report.excluded!.selector, filter);
    expect(selected.totalCount).toBe(report.summary.assignmentCount); expect(reference.totalCount).toBe(report.reference!.assignmentCount); expect(excluded.totalCount).toBe(report.excluded!.assignmentCount);
    expect(excluded.rows.map((row) => row.taskName)).toEqual(["T5"]);
    const selectedIds = new Set(selected.rows.map((row) => row.assignment!.assignmentId));
    expect(excluded.rows.every((row) => !selectedIds.has(row.assignment!.assignmentId))).toBe(true);
    expect(report.stages.find((row) => row.milestoneTaskId === f.tasks.get("M1")!.publicId)!.full.ready).toBe(false);
  });
  it("removes only Milestone filters for reference and always returns empty excluded when no Milestone restriction", () => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    expect(report.milestoneSelection!.applied).toBe(false); expect(report.reference!.assignmentCount).toBe(report.summary.assignmentCount); expect(report.excluded!.effort.state).toBe("empty");
    const filter = { milestoneIds: [f.tasks.get("M3")!.publicId], taskIds: [f.tasks.get("T1")!.publicId], resourceIds: [f.resources.get("R1")!.publicId], groupIds: [f.groups.get("G2")!.publicId], statuses: ["completed" as const], search: "Alice", taskSearch: "T1", mdPerMm: null };
    const scoped = f.service.getDashboard(f.project.publicId, filter)!;
    expect(scoped.summary.assignmentCount).toBe(0); expect(scoped.reference).toMatchObject({ taskCount: 1, resourceCount: 1, assignmentCount: 1, effort: { plannedMd: 2, plannedMm: null } });
    expect(scoped.excluded).toMatchObject({ taskCount: 1, assignmentCount: 1 });
    expect(resolve(f, scoped.snapshotId, scoped.excluded!.selector, filter).rows[0].taskName).toBe("T1");
  });
  it("returns one Group intersection for both G→M→R and G→R→M with stable bounded pages and raw totals", () => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!, groupId = f.groups.get("G1")!.publicId;
    const before = f.state();
    const first = f.service.getGroupChildren(f.project.publicId, {}, children(report.snapshotId, groupId, { limit: 1 }))!;
    expect(first).toMatchObject({ filters: report.filters, range: report.range, asOfDate: report.asOfDate, mdPerMm: report.mdPerMm, mdPerMmSource: report.mdPerMmSource, projectRevision: report.projectRevision, catalogRevision: report.catalogRevision, calendarRevision: report.calendarRevision, totalCount: 2, nextOffset: 1 });
    expect(first).not.toHaveProperty("milestoneTaskId"); expect(first.rows).toHaveLength(1); expect(first.summary.assignmentCount).toBe(5);
    const second = f.service.getGroupChildren(f.project.publicId, {}, children(report.snapshotId, groupId, { limit: 1, offset: 1 }))!;
    expect(second.nextOffset).toBeNull(); expect(first.rows[0].id!.localeCompare(second.rows[0].id!)).toBeLessThan(0);
    expect(first.summary).toEqual(second.summary);
    const m1 = f.service.getGroupChildren(f.project.publicId, {}, children(report.snapshotId, groupId, { milestoneTaskId: f.tasks.get("M1")!.publicId }))!;
    expect(m1.summary).toMatchObject({ taskCount: 2, assignmentCount: 4 });
    for (const row of m1.rows) {
      expect(row.summary.selector).toMatchObject({ dimension: "group", id: groupId, resourceId: row.id, milestoneTaskId: m1.milestoneTaskId, assignmentScope: "selected" });
      expect(row.milestones.reduce((sum, cell) => sum + cell.summary.effort.knownMd, 0)).toBeCloseTo(row.summary.effort.knownMd, 14);
      expect(resolve(f, report.snapshotId, row.summary.selector).totalCount).toBe(row.summary.assignmentCount);
      expect(resolve(f, report.snapshotId, { ...row.summary.selector, metric: "completed" }).totalCount).toBe(1);
    }
    const unassigned = f.service.getGroupChildren(f.project.publicId, {}, children(report.snapshotId, groupId, { milestoneTaskId: null }))!;
    expect(unassigned.milestoneTaskId).toBeNull(); expect(unassigned.summary).toMatchObject({ assignmentCount: 1, effort: { plannedMd: 0, state: "configured" } });
    expect(f.state()).toEqual(before);
  });
  it("keeps a filtered valid member empty, rejects wrong Group/foreign Resource and preserves activity intersection", () => {
    const f = fixture(), groupId = f.groups.get("G2")!.publicId, r1 = f.resources.get("R1")!.publicId, r2 = f.resources.get("R2")!.publicId;
    const filter = { roles: ["EQUIPMENT_OWNER" as const] }, report = f.service.getDashboard(f.project.publicId, filter)!;
    const selector = { dimension: "group" as const, id: groupId, resourceId: r1, metric: "all" as const };
    expect(resolve(f, report.snapshotId, selector, filter).totalCount).toBe(0);
    expect(f.service.getGroupChildren(f.project.publicId, filter, children(report.snapshotId, groupId))!.totalCount).toBe(0);
    expect(() => resolve(f, report.snapshotId, { ...selector, resourceId: r2 }, filter)).toThrow("현재 프로젝트");
    expect(() => resolve(f, report.snapshotId, { ...selector, resourceId: randomUUID() }, filter)).toThrow("현재 프로젝트");
    expect(() => resolve(f, report.snapshotId, { ...selector, id: null }, filter)).toThrow("현재 프로젝트");
    f.catalog.updateGroup(f.groups.get("G2")!.id, { active: false }, RESOURCE_DASHBOARD_NOW);
    const activeFilter = { groupIds: [groupId], groupActivity: "inactive" as const }, inactive = f.service.getDashboard(f.project.publicId, activeFilter)!;
    expect(f.service.getGroupChildren(f.project.publicId, activeFilter, children(inactive.snapshotId, groupId))!.rows.map((row) => row.id)).toEqual([r1]);
  });
  it("resolves ungrouped actual members and retains overall totals on an empty page", () => {
    const f = fixture(), r1 = f.resources.get("R1")!;
    f.catalog.replaceGroupMembers(f.groups.get("G1")!.id, [f.resources.get("R2")!.id], RESOURCE_DASHBOARD_NOW);
    f.catalog.replaceGroupMembers(f.groups.get("G2")!.id, [], RESOURCE_DASHBOARD_NOW);
    const report = f.service.getDashboard(f.project.publicId)!;
    const page = f.service.getGroupChildren(f.project.publicId, {}, children(report.snapshotId, null))!;
    expect(page).toMatchObject({ groupId: null, totalCount: 1, summary: { resourceCount: 1, assignmentCount: 3 } });
    expect(page.rows[0].id).toBe(r1.publicId);
    expect(resolve(f, report.snapshotId, page.rows[0].summary.selector).rows.every((row) => row.assignment!.resourceId === r1.publicId)).toBe(true);
    const empty = f.service.getGroupChildren(f.project.publicId, {}, children(report.snapshotId, null, { offset: 1 }))!;
    expect(empty.rows).toEqual([]); expect(empty.summary).toEqual(page.summary); expect(empty.nextOffset).toBeNull();
  });
  it("orders dates then stable IDs and leaves unassigned last without changing full Ready or sums", () => {
    const f = fixture();
    f.database.prepare("UPDATE tasks SET start_date='2026-10-19',end_date='2026-10-19' WHERE id=?").run(f.tasks.get("M1")!.id);
    const report = f.service.getDashboard(f.project.publicId)!;
    const expected = [f.tasks.get("M2")!.publicId, f.tasks.get("M3")!.publicId].sort(); expected.push(f.tasks.get("M1")!.publicId);
    expect(report.stages.map((row) => row.milestoneTaskId)).toEqual(expected); expect(report.catalog.milestones.map((row) => row.id)).toEqual(expected);
    expect(report.milestones.at(-1)!.milestoneTaskId).toBeNull(); expect(report.resources.every((row) => row.milestones.at(-1)!.milestoneTaskId === null)).toBe(true);
    expect(report.summary.effort.knownMd).toBe(2 + 4 * 33.333333 / 100);
  });
  it("public group-child HTTP validates query, echoes scope, hides global members and refuses changed snapshots", async () => {
    const f = fixture(), group = f.groups.get("G1")!, hidden = f.catalog.insertResource({ publicId: randomUUID(), name: "SECRET PERSON", code: "secret", description: "", now: RESOURCE_DASHBOARD_NOW });
    f.catalog.replaceGroupMembers(group.id, [f.resources.get("R1")!.id, f.resources.get("R2")!.id, hidden.id], RESOURCE_DASHBOARD_NOW);
    const report = f.service.getDashboard(f.project.publicId)!, before = f.state();
    const response = await handleGetResourceDashboard(f.request(query(report.snapshotId, group.publicId)), f.project.publicId, { service: f.service }, "group-children");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff"); expect(response.headers.get("set-cookie")).toBeNull();
    const serialized = await response.text(); expect(serialized).not.toContain(hidden.publicId); expect(serialized).not.toContain("SECRET PERSON"); expect(f.state()).toEqual(before);
    expect(ROUTE_SECURITY_INVENTORY.find((row) => row.template.endsWith("/resource-dashboard/group-children"))).toMatchObject({ policy: "public-read", mutatesState: false });
    f.database.prepare("UPDATE tasks SET name='changed' WHERE id=?").run(f.tasks.get("T1")!.id);
    const stale = await handleGetResourceDashboard(f.request(query(report.snapshotId, group.publicId)), f.project.publicId, { service: f.service }, "group-children");
    expect(stale.status).toBe(409); expect((await stale.json()).error.code).toBe("REPORT_STALE");
  });
  it.each(["", "groupId=bad", "groupId=unassigned", "groupId=ungrouped&groupId=ungrouped", "groupId=ungrouped&metric=completed", "groupId=ungrouped&limit=101", "groupId=ungrouped&offset=8001", "groupId=ungrouped&milestoneTaskId=bad", "groupId=ungrouped&resourceId=bad", "groupId=ungrouped&assignmentScope=selected"]) ("rejects malformed group children query %s", async (suffix) => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    const response = await handleGetResourceDashboard(f.request(`snapshotId=${report.snapshotId}&${suffix}`), f.project.publicId, { service: f.service }, "group-children");
    expect(response.status).toBe(400); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("normalizes selected scope and distinguishes optional null/omitted Milestone while restricting group Resource selectors", () => {
    const snapshotId = "a".repeat(64), id = randomUUID();
    expect(parseResourceDashboardDetails(new URLSearchParams({ snapshotId, dimension: "group", id, resourceId: id })).selector).toMatchObject({ resourceId: id, assignmentScope: "selected" });
    const invalidSelectors: Record<string, string>[] = [{ dimension: "resource", id, resourceId: id }, { dimension: "group", id, resourceId: "null" }, { dimension: "all", assignmentScope: "wrong" }, { dimension: "diagnostic", metric: "unset", assignmentScope: "milestoneReference" }];
    for (const extra of invalidSelectors) expect(() => parseResourceDashboardDetails(new URLSearchParams({ snapshotId, ...extra }))).toThrow();
    expect(parseResourceDashboardGroupChildren(new URLSearchParams({ snapshotId, groupId: "ungrouped" }))).not.toHaveProperty("milestoneTaskId");
    expect(parseResourceDashboardGroupChildren(new URLSearchParams({ snapshotId, groupId: "ungrouped", milestoneTaskId: "unassigned" })).milestoneTaskId).toBeNull();
  });
  it("uses one DB snapshot/clock and shares bulk calendars across reference and selected calculations", () => {
    const f = fixture(), clock = vi.fn(() => new Date(RESOURCE_DASHBOARD_NOW)), rules = vi.spyOn(WorkCalendarRepository.prototype, "listRules");
    const service = new ResourceDashboardService(f.database, { clock });
    const report = service.getDashboard(f.project.publicId, { milestoneIds: [f.tasks.get("M1")!.publicId] })!;
    expect(clock).toHaveBeenCalledTimes(1); expect(rules).toHaveBeenCalledTimes(3);
    clock.mockClear(); rules.mockClear(); service.getGroupChildren(f.project.publicId, { milestoneIds: [f.tasks.get("M1")!.publicId] }, children(report.snapshotId, f.groups.get("G1")!.publicId));
    expect(clock).toHaveBeenCalledTimes(1); expect(rules).toHaveBeenCalledTimes(3);
  });
  it("computes reference/excluded totals without materializing a reference matrix beyond the cell budget", () => {
    const f = fixture();
    const resources = Array.from({ length: 100 }, (_, index) => f.catalog.insertResource({ publicId: randomUUID(), name: `wide ${index}`, code: `wide${index}`, description: "", now: RESOURCE_DASHBOARD_NOW }));
    const ids: string[] = [];
    f.database.transaction(() => {
      for (let index = 0; index < 50; index++) {
        const mile = f.schedules.insertTask({ publicId: randomUUID(), externalId: `Mwide${index}`, name: `Mwide${index}`, projectId: f.project.id, type: "milestone", parentId: null, sortOrder: index + 100, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 0, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW }); ids.push(mile.publicId);
        const task = f.schedules.insertTask({ publicId: randomUUID(), externalId: `Twide${index}`, name: `Twide${index}`, projectId: f.project.id, type: "task", parentId: null, sortOrder: index + 200, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 1, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
        new MilestoneMembershipRepository(f.database).set(f.project.id, task.id, mile.id);
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: resources.map((r) => ({ kind: "resource", publicId: r.publicId, internalId: r.id, assignmentPublicId: randomUUID(), allocationPercent: 50, assignmentStart: null, assignmentEnd: null })) });
      }
    })();
    const report = f.service.getDashboard(f.project.publicId, { milestoneIds: [ids[0]] })!;
    expect(report.summary).toMatchObject({ taskCount: 1, resourceCount: 100, assignmentCount: 100 });
    expect(report.reference!.assignmentCount).toBe(5005); expect(report.excluded!.assignmentCount).toBe(4905);
    expect(() => f.service.getDashboard(f.project.publicId)).toThrow("projection.cells");
  });
});
