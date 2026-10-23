import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { ResourceDashboardFilterInput } from "../../../src/contracts/resource-dashboard";
import type { LogisticsDashboardDto } from "../../../src/contracts/logistics-dashboard";
import type { WbsResourceExcelExportOptions } from "../../../src/contracts/resource-excel-export";
import type { WbsViewDetailsDto, WbsViewNode, WbsViewQueryInput, WbsViewReportDto, WbsViewScopeDto, WbsViewSpec } from "../../../src/contracts/wbs-dashboard-views";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { handleGetLogisticsKpi } from "../../../src/server/logistics/logistics-kpi-handlers-core";
import { LogisticsKpiService } from "../../../src/server/logistics/logistics-kpi-service-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { handleWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-handlers-core";
import { issue623Table, issue623WorkbookEntries } from "../../fixtures/issue-623-backend-fixture";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";

type Fixture = ReturnType<typeof wbsDashboardViewsFixture>;
const fixtures: Fixture[] = [];
afterEach(() => { for (const f of fixtures.splice(0)) f.database.close(); });
function fixture(mode: "direct" | "target" | "mixed" = "direct") {
  const f = wbsDashboardViewsFixture(mode); fixtures.push(f); return f;
}
const filters: ResourceDashboardFilterInput = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
const spec = (root: WbsViewSpec["root"], levels: WbsViewSpec["levels"] = []): WbsViewSpec => ({ version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels });
const views = [
  spec("process", [{ kind: "siblings", dimensions: ["equipment", "system"] }, "resource"]),
  spec("process", [{ kind: "siblings", dimensions: ["system", "equipment"] }, "resource"]),
  spec("equipment", ["process", "system", "resource"]),
  spec("equipment", ["milestone", "process"]),
  spec("system", ["process", "workArea", "resource"]),
  spec("milestone", ["resource", "process", "equipment"]),
  spec("resource", ["milestone", "process", { kind: "siblings", dimensions: ["equipment", "system"] }]),
];
const sorted = (ids: readonly string[]) => [...ids].sort();
const taskIds = (f: Fixture, ...names: string[]) => names.map(name => f.tasks.get(name)!.publicId).sort();
const child = (parent: Pick<WbsViewNode, "children">, dimension: string, id: string | null) => {
  const row = parent.children.find(row => row.selector.dimension === dimension && row.selector.id === id);
  expect(row, `${dimension}:${id}`).toBeDefined(); return row!;
};
const changes = (f: Fixture) => f.database.prepare("SELECT total_changes() AS count").pluck().get() as number;

/** IDs come from persisted rows, independently of the projection and KPI adapters. */
function rawIdentity(f: Fixture) {
  const tasks = f.database.prepare("SELECT public_id FROM tasks WHERE project_id=? AND type='task' ORDER BY public_id").all(f.project.id) as Array<{ public_id: string }>;
  const assignments = f.database.prepare("SELECT a.public_id FROM task_assignments a JOIN tasks t ON t.id=a.task_id WHERE a.project_id=? AND a.resource_id IS NOT NULL AND t.type='task' ORDER BY a.public_id").all(f.project.id) as Array<{ public_id: string }>;
  return { taskIds: tasks.map(row => row.public_id), assignmentIds: assignments.map(row => row.public_id) };
}
async function request(f: Fixture, body: WbsViewQueryInput) {
  return handleWbsViewQuery(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard/views`, {
    method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), f.project.publicId, { service: f.service, applicationBaseUrl: "https://gantt.example", environment: "production" });
}
async function data<T>(f: Fixture, body: WbsViewQueryInput) {
  const response = await request(f, body);
  const text = await response.text(); expect(response.status, text).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  return JSON.parse(text).data as T;
}
const report = (f: Fixture, view: WbsViewSpec, selected = filters) => data<WbsViewReportDto>(f, { spec: view, filters: selected });
async function kpi(f: Fixture, query = "") {
  const response = await handleGetLogisticsKpi(new Request(`https://gantt.example/api/projects/${f.project.publicId}/logistics/kpi?source=integrated&asOfDate=2026-10-12&mdPerMm=20${query}`), f.project.publicId, {
    dashboardService: new LogisticsKpiService(f.database, { clock: () => new Date(now) }),
    logisticsService: new LogisticsService(f.database),
    projectService: { authorize() { throw new Error("Readonly KPI must not create an edit session"); } },
    applicationBaseUrl: "https://gantt.example", environment: "production",
  });
  const text = await response.text(); expect(response.status, text).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  return JSON.parse(text).data as LogisticsDashboardDto;
}
async function assignmentPages(f: Fixture, source: WbsViewReportDto, path: WbsViewNode["path"] = []) {
  const rows: WbsViewDetailsDto["rows"] = [];
  let offset = 0;
  for (;;) {
    const page = await data<WbsViewDetailsDto>(f, { spec: source.spec, filters: source.filters, projection: { kind: "details", snapshotId: source.snapshotId, path, view: "assignments", offset, limit: 1 } });
    expect(page.rows.length).toBeLessThanOrEqual(1); rows.push(...page.rows);
    if (page.nextOffset === null) { expect(rows).toHaveLength(page.totalCount); return rows; }
    expect(page.nextOffset).toBeGreaterThan(offset); offset = page.nextOffset;
  }
}
async function excelResponse(f: Fixture, source: WbsViewReportDto, selection: WbsViewScopeDto, basis: "current" | "project") {
  const resourceDashboard: WbsResourceExcelExportOptions = basis === "current"
    ? { basis, expectedReport: { context: selection.sourceContext, snapshotId: source.snapshotId, filters: source.filters }, granularities: ["week", "month"] }
    : { basis, expectedReport: { context: selection.sourceContext, filters: source.filters }, granularities: ["week", "month"] };
  const service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(now) });
  return handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, {
    method: "POST", headers: { Origin: "https://gantt.example", "Content-Type": "application/json", "If-Match": `"${source.projectRevision}"` },
    body: JSON.stringify({ includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 224 }] }, resourceDashboard }),
  }), f.project.publicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) });
}

describe("#737 cross-feature acceptance through migrated SQLite, production handlers and OOXML", () => {
  it.each(["direct", "target", "mixed"] as const)("%s raw identity survives seven dynamic views, paginated details and the existing same-scope KPI", async mode => {
    const f = fixture(mode), raw = rawIdentity(f), before = f.state(), writes = changes(f);
    expect(raw.taskIds).toEqual(taskIds(f, "T0", "T1", "T2", "T3", "UNASSIGNED", "GROUP_ONLY"));
    expect(raw.assignmentIds).toHaveLength(4);
    const all = await report(f, spec("process"));
    expect(all.totals.tasks).toMatchObject({ taskCount: 6, completed: { count: 1 }, delayed: { count: 5 }, progress: { numerator: 500, denominator: 30 } });
    expect(all.totals.assignments.effort.knownMd).toBe(14);
    expect(all.fullMilestones).toHaveLength(1);
    expect(sorted(all.fullMilestones[0].stageGate.memberTaskIds)).toEqual(taskIds(f, "T1", "T2", "T3"));
    expect(all.fullMilestones[0].stageGate).toMatchObject({ memberCount: 3, completedMemberCount: 1, membersCompleted: false, ready: false });
    const integrated = await kpi(f);
    expect(sorted(integrated.includedTaskIds)).toEqual(raw.taskIds);
    expect(sorted(integrated.integrated!.assignmentIds)).toEqual(raw.assignmentIds);
    expect(integrated.effort.plannedMd).toBe(all.totals.assignments.effort.knownMd);
    expect(integrated.kpi.taskCount).toBe(all.totals.tasks.taskCount);
    expect(integrated.kpi.overdueTaskCount).toBe(all.totals.tasks.delayed.count);
    expect(integrated.kpi.progressPercent).toBeCloseTo(all.totals.tasks.progress.percent!, 1);

    for (const view of views) {
      const current = await report(f, view);
      expect(sorted(current.taskIds)).toEqual(raw.taskIds);
      expect(sorted(current.assignmentIds)).toEqual(raw.assignmentIds);
      expect(current.totals.tasks).toEqual(all.totals.tasks);
      expect(current.totals.assignments).toEqual(all.totals.assignments);
      expect(current.fullMilestones).toEqual(all.fullMilestones);
      const rows = await assignmentPages(f, current);
      expect(rows.map(row => row.assignment!.assignmentId).sort()).toEqual(raw.assignmentIds);
      const scoped = f.service.getDashboard(f.project.publicId, filters, { kind: "exactAssignments", assignmentIds: current.assignmentIds })!;
      expect(current.totals.assignments.effort).toMatchObject(scoped.summary.effort);
      expect(scoped.summary.assignedTaskProgress).toEqual({ numerator: 500, denominator: 20, percent: 25 });
    }
    const systems = await report(f, spec("system", ["process"]));
    const mcs = child(systems, "system", f.systems[2].publicId);
    const a = child(mcs, "process", f.processA.publicId), b = child(mcs, "process", f.processB.publicId), unlinked = child(mcs, "process", null);
    expect(a.taskIds.sort()).toEqual(taskIds(f, "T1", "T3"));
    expect(b.taskIds.sort()).toEqual(taskIds(f, "T2", "T3"));
    expect(unlinked.taskIds).toEqual(taskIds(f, "T0"));
    expect([a, b, unlinked].map(row => row.totals.assignments.effort.knownMd)).toEqual([8, 9, 2]);
    for (const row of [a, b]) {
      const process = integrated.breakdowns.processes.find(process => process.id === row.selector.id)!;
      expect(sorted(process.taskIds)).toEqual(sorted(row.taskIds));
      expect(process.plannedMd).toBe(row.totals.assignments.effort.knownMd);
    }
    expect(mcs.totals.assignments.effort.knownMd).toBe(14); // Child19 is non-additive.
    const resources = await report(f, spec("resource"));
    expect(child(resources, "resource", null).taskIds.sort()).toEqual(taskIds(f, "UNASSIGNED", "GROUP_ONLY"));
    const idle = child(resources, "resource", f.resources.get("R2")!.publicId);
    expect(idle.taskIds).toEqual([]); expect(idle.assignmentIds).toEqual([]);
    expect(resources.totals.participation).toMatchObject({ registeredCount: 2, assignedCount: 1 });
    expect(changes(f)).toBe(writes); expect(f.state()).toEqual(before);
    expect(f.database.prepare("SELECT COUNT(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id)).toBe(mode === "direct" ? 0 : 2);
  });

  it("Target0 same Task co-assignees remain7.5 across views while exact-person details and current Excel remain5", async () => {
    const f = fixture(), t3 = f.tasks.get("T3")!, r1 = f.resources.get("R1")!, r2 = f.resources.get("R2")!, coassignment = randomUUID();
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: t3.id, now, targets: [
      { kind: "resource", internalId: r1.id, publicId: r1.publicId, assignmentPublicId: f.assignmentIds.get("A3")!, assignmentStart: null, assignmentEnd: null, allocationPercent: 100 },
      { kind: "resource", internalId: r2.id, publicId: r2.publicId, assignmentPublicId: coassignment, assignmentStart: null, assignmentEnd: null, allocationPercent: 50 },
    ] });
    f.logistics.replaceTaskEquipmentLinks(f.project.id, t3.id, f.equipment.map(equipment => ({ equipmentId: equipment.id, scope: "self" })), now);
    const before = f.state(), writes = changes(f), selected = { ...filters, taskIds: [t3.publicId], granularity: "week" as const };
    const canonical = await report(f, spec("milestone"));
    const integrated = await kpi(f, `&taskAssigneeResourceIds=${r2.publicId}`);
    expect(integrated.includedTaskIds).toEqual([t3.publicId]);
    expect(sorted(integrated.integrated!.assignmentIds)).toEqual([f.assignmentIds.get("A3")!, coassignment].sort());
    expect(integrated.effort.plannedMd).toBe(7.5);
    for (const view of views) {
      const current = await report(f, view, selected);
      expect(current.taskIds).toEqual([t3.publicId]);
      expect(sorted(current.assignmentIds)).toEqual([f.assignmentIds.get("A3")!, coassignment].sort());
      expect(current.totals.assignments.effort).toMatchObject({ knownMd: 7.5, plannedMd: 7.5, plannedMm: .375 });
      expect(current.fullMilestones).toEqual(canonical.fullMilestones);
    }
    const equipment = await report(f, spec("equipment", ["workArea"]), selected), e1 = child(equipment, "equipment", f.equipment[0].publicId);
    for (const area of [f.areaId, f.areaBPublicId]) {
      const row = child(e1, "workArea", area);
      expect(row.totals.configurationReference.equipmentQuantity).toBe(10);
      expect(row.totals.assignments.effort.knownMd).toBe(7.5);
    }
    expect(e1.totals.configurationReference.equipmentQuantity).toBe(10);
    expect(e1.totals.assignments.effort.knownMd).toBe(7.5);
    expect(equipment.totals.relatedMembers.equipmentQuantity).toBe(15);

    const source = await report(f, spec("resource", ["milestone", "process"]), selected);
    const person = child(source, "resource", r1.publicId), milestone = child(person, "milestone", f.tasks.get("M")!.publicId), process = child(milestone, "process", f.processA.publicId);
    const scope = await data<WbsViewScopeDto>(f, { spec: source.spec, filters: source.filters, projection: { kind: "scope", snapshotId: source.snapshotId, path: process.path } });
    expect(scope.taskIds).toEqual([t3.publicId]); expect(scope.assignmentIds).toEqual([f.assignmentIds.get("A3")!]);
    expect((await assignmentPages(f, source, process.path)).map(row => row.assignment!.assignmentId)).toEqual(scope.assignmentIds);
    expect(source.resourceAdapter!.report.summary.effort.knownMd).toBe(7.5);
    const raw = rawIdentity(f);
    for (const basis of ["current", "project"] as const) {
      const response = await excelResponse(f, source, scope, basis);
      expect(response.status, response.status === 200 ? "" : await response.text()).toBe(200);
      const workbook = issue623WorkbookEntries(new Uint8Array(await response.arrayBuffer()));
      const rows = issue623Table(workbook.sheet("Resource Assignments"));
      expect(rows.map(row => row.assignmentId).sort()).toEqual(basis === "current" ? scope.assignmentIds : raw.assignmentIds);
      expect(rows.reduce((sum, row) => sum + Number(row.plannedMd), 0)).toBe(basis === "current" ? 5 : 16.5);
      expect(workbook.sheet("Resource Relations")).toContain(t3.publicId);
      expect([...workbook.entries.values()].join("\n")).toContain(`https://gantt.example/projects/${f.project.publicId}`);
    }
    expect(changes(f)).toBe(writes); expect(f.state()).toEqual(before);
    expect(f.database.prepare("SELECT COUNT(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id)).toBe(0);
  });

  it("non-Resource views reject Excel explicitly instead of exporting an unrelated legacy scope", async () => {
    const f = fixture(), before = f.state(), writes = changes(f);
    for (const root of ["process", "equipment", "system", "milestone"] as const) {
      const source = await report(f, spec(root));
      expect(source.metadata.excel.supported).toBe(false);
      const scope = await data<WbsViewScopeDto>(f, { spec: source.spec, filters: source.filters, projection: { kind: "scope", snapshotId: source.snapshotId, path: [] } });
      const response = await excelResponse(f, source, scope, "current");
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("WBS_VIEW_EXPORT_UNSUPPORTED");
      expect(response.headers.get("content-disposition")).toBeNull();
    }
    expect(changes(f)).toBe(writes); expect(f.state()).toEqual(before);
  });

  it("one source mutation invalidates every old root detail/drill and the same-source Excel without a revision bump", async () => {
    const f = fixture("mixed"), sources = await Promise.all(views.map(view => report(f, view)));
    const resource = sources.find(source => source.spec.root === "resource")!;
    const path = child(resource, "resource", f.resources.get("R1")!.publicId).path;
    const scope = await data<WbsViewScopeDto>(f, { spec: resource.spec, filters: resource.filters, projection: { kind: "scope", snapshotId: resource.snapshotId, path } });
    f.database.prepare("UPDATE task_assignments SET allocation_percent=50 WHERE public_id=?").run(f.assignmentIds.get("A3"));
    const writes = changes(f);
    expect(f.projects.findById(f.project.id)!.revision).toBe(resource.projectRevision);
    for (const source of sources) for (const kind of ["scope", "details"] as const) {
      const projection = kind === "scope" ? { kind, snapshotId: source.snapshotId, path: [] } : { kind, snapshotId: source.snapshotId, path: [], view: "assignments" as const, offset: 0, limit: 1 };
      const response = await request(f, { spec: source.spec, filters: source.filters, projection });
      expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("REPORT_STALE");
    }
    const excel = await excelResponse(f, resource, scope, "current");
    expect(excel.status).toBe(412); expect(excel.headers.get("content-disposition")).toBeNull();
    const fresh = await report(f, resource.spec);
    expect(fresh.snapshotId).not.toBe(resource.snapshotId);
    expect(fresh.totals.assignments.effort.knownMd).toBe(11.5);
    expect(changes(f)).toBe(writes);
  });
});
