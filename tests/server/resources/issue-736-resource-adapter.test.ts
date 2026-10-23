import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { ResourceDashboardFilterInput, ResourcePlanDayAssignmentsDto } from "../../../src/contracts/resource-dashboard";
import type { WbsResourceExcelExportOptions } from "../../../src/contracts/resource-excel-export";
import type { WbsViewReportDto, WbsViewScopeDto, WbsViewSpec } from "../../../src/contracts/wbs-dashboard-views";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { parseProjectExcelExportInput } from "../../../src/server/exports/project-excel-export-contract";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";
import { issue623BackendFixture, issue623Table, issue623WorkbookEntries } from "../../fixtures/issue-623-backend-fixture";
const close: Array<() => void> = [];
afterEach(() => close.splice(0).reverse().forEach(fn => fn()));
function fixture(mode: "direct" | "mixed" = "direct") { const f = wbsDashboardViewsFixture(mode); close.push(() => f.database.close()); return f; }
const filters: ResourceDashboardFilterInput = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: null, granularity: "week" };
const spec: WbsViewSpec = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "resource", levels: ["process", "workArea", { kind: "siblings", dimensions: ["equipment", "system"] }] };
const legacy = { includeDependencies: false, scope: "project" as const, scale: "day" as const, hierarchyDisplay: "expanded" as const, layout: { columns: [{ id: "text" as const, widthPx: 224 }] } };
function query(f: ReturnType<typeof fixture>, selected = filters, view = spec) { return f.service.queryWbsView(f.project.publicId, { spec: view, filters: selected }) as WbsViewReportDto; }
function options(report: WbsViewReportDto, context = report.sourceContext): WbsResourceExcelExportOptions { return { basis: "current", expectedReport: { context, snapshotId: report.snapshotId, filters: report.filters }, granularities: ["week", "month"] }; }
async function http(f: ReturnType<typeof fixture>, resourceDashboard: WbsResourceExcelExportOptions, headers: Record<string, string> = {}) {
  const service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(now), mdPerMmEnvironment: "21" });
  return handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, { method: "POST", headers: { Origin: "https://gantt.example", "If-Match": '"1"', "Content-Type": "application/json", ...headers }, body: JSON.stringify({ ...legacy, resourceDashboard }) }), f.project.publicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) });
}
async function workbook(f: ReturnType<typeof fixture>, input: WbsResourceExcelExportOptions) {
  const response = await http(f, input);
  expect(response.status, response.status === 200 ? "" : await response.text()).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  return issue623WorkbookEntries(new Uint8Array(await response.arrayBuffer()));
}

describe("#736 Resource-root existing Plan and Excel adapters", () => {
  it("Target0 preserves two dynamic hierarchies, membership-only0, same-assignment filters and co-assignee7.5", async () => {
    const f = fixture(), task = f.tasks.get("T3")!, r1 = f.resources.get("R1")!, r2 = f.resources.get("R2")!, other = randomUUID();
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [
      { kind: "resource", internalId: r1.id, publicId: r1.publicId, assignmentPublicId: f.assignmentIds.get("A3")!, assignmentStart: null, assignmentEnd: null, allocationPercent: 100 },
      { kind: "resource", internalId: r2.id, publicId: r2.publicId, assignmentPublicId: other, assignmentStart: null, assignmentEnd: null, allocationPercent: 50 },
    ] });
    const idle = f.catalog.insertResource({ publicId: randomUUID(), name: "등록만", code: "REGISTERED", description: "", now });
    f.database.prepare("INSERT INTO project_resource_memberships(project_id,resource_id,created_at) VALUES(?,?,?)").run(f.project.id, idle.id, now);
    expect(f.database.prepare("SELECT COUNT(*) FROM logistics_targets").pluck().get()).toBe(0);
    for (const view of [spec, { ...spec, levels: ["milestone", "process"] as const }]) {
      const report = query(f, { ...filters, taskIds: [task.publicId] }, view as WbsViewSpec);
      expect(report.totals.assignments.effort).toMatchObject({ knownMd: 7.5, plannedMm: null });
      expect(report.assignmentIds.sort()).toEqual([f.assignmentIds.get("A3"), other].sort());
      expect(report.children.find(row => row.selector.id === idle.publicId)).toMatchObject({ taskIds: [], assignmentIds: [], totals: { assignments: { effort: { knownMd: 0, state: "empty" } } } });
      expect(report.plan!.population.resourceIds).not.toContain(idle.publicId);
      expect(report.resourceAdapter!.report.plan!.totals.summary.selected.knownMd).toBe(7.5);
    }
    const selected = query(f, { ...filters, taskIds: [task.publicId], resourceIds: [r1.publicId] });
    expect(selected.totals.assignments.effort.knownMd).toBe(5);
    expect(selected.children.find(row => row.selector.id === r2.publicId)!.assignmentIds).toEqual([]);
    const selectedWorkbook = await workbook(f, options(selected));
    expect(issue623Table(selectedWorkbook.sheet("Resource Assignments"))).toMatchObject([{ assignmentId: f.assignmentIds.get("A3"), plannedMd: 5, plannedMm: null }]);
    const combinedWorkbook = await workbook(f, options(query(f, { ...filters, taskIds: [task.publicId] })));
    const combinedRows = issue623Table(combinedWorkbook.sheet("Resource Assignments"));
    expect(combinedRows).toHaveLength(2); expect(combinedRows.reduce((sum, row) => sum + Number(row.plannedMd), 0)).toBe(7.5);
    const roleMismatch = query(f, { ...filters, resourceIds: [r1.publicId], roles: ["EQUIPMENT_OWNER"] });
    expect(roleMismatch.taskIds).toEqual([]); expect(roleMismatch.assignmentIds).toEqual([]);
    expect(roleMismatch.totals.tasks.taskCount).toBe(0);
    for (const mismatch of [
      { resourceIds: [r1.publicId], developerGrades: ["INTERMEDIATE" as const] },
      { resourceIds: [r2.publicId], groupIds: [f.groups.get("G2")!.publicId] },
      { resourceIds: [r2.publicId], roles: ["DEVELOPER" as const] },
    ]) {
      const result = query(f, { ...filters, taskIds: [task.publicId], ...mismatch });
      expect(result.taskIds).toEqual([]); expect(result.assignmentIds).toEqual([]);
    }
    const noFilter = query(f);
    expect(noFilter.taskIds).toContain(f.tasks.get("UNASSIGNED")!.publicId);
    const noPlan = query(f, { from: filters.from, to: filters.to });
    expect(noPlan.plan).toBeUndefined(); expect(noPlan.resourceAdapter).toBeUndefined();
    const responsibility = f.catalog.insertResource({ publicId: randomUUID(), name: "역할만", code: "ROLE", description: "", now });
    f.logistics.replaceEquipmentResourceRoles(f.project.id, f.equipment[0].id, [{ resourceId: responsibility.id, role: "owner", isPrimary: 1 }], now);
    const roleOnly = query(f);
    expect(roleOnly.children.find(row => row.selector.id === responsibility.publicId)!.assignmentIds).toEqual([]);
    expect(roleOnly.plan!.population.resourceIds).not.toContain(responsibility.publicId);
  });

  it("same Milestone cannot reintroduce another resource's equipment/process Task", () => {
    const f = fixture(), r2 = f.resources.get("R2")!, task = f.tasks.get("T2")!;
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [{ kind: "resource", internalId: r2.id, publicId: r2.publicId, assignmentPublicId: f.assignmentIds.get("A2")!, assignmentStart: null, assignmentEnd: null, allocationPercent: 80 }] });
    const data = query(f, { ...filters, resourceIds: [f.resources.get("R1")!.publicId] }, { ...spec, levels: ["milestone", "process", "equipment"] });
    expect(data.taskIds).not.toContain(task.publicId);
    const person = data.children.find(row => row.selector.id === f.resources.get("R1")!.publicId)!;
    const milestone = person.children.find(row => row.selector.id === f.tasks.get("M")!.publicId)!;
    expect(milestone.taskIds).not.toContain(task.publicId);
    expect(milestone.assignmentIds).not.toContain(f.assignmentIds.get("A2"));
    expect(data.fullMilestones).toEqual(query(f).fullMilestones);
  });

  it.each(["direct", "mixed"] as const)("%s shared5 is emitted once per raw Assignment with repeated path evidence and nullable M/M", async mode => {
    const f = fixture(mode), before = f.state(), report = query(f, { ...filters, taskIds: [f.tasks.get("T3")!.publicId] });
    expect(report.totals.assignments.effort.knownMd).toBe(5);
    const a = await workbook(f, options(report)), rows = issue623Table(a.sheet("Resource Assignments"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ assignmentId: f.assignmentIds.get("A3"), taskId: f.tasks.get("T3")!.publicId, plannedMd: 5, plannedMm: null });
    const evidence = a.sheet("Resource Relations");
    expect(evidence).toContain("WbsSelectedTask"); expect(evidence).toContain("WbsViewRow (non-additive)");
    expect(evidence.split(f.assignmentIds.get("A3")!).length - 1).toBeGreaterThan(2);
    expect(a.sheet("Resource Report")).toContain(report.snapshotId);
    expect(a.sheet("Resource Report")).toContain("WBS ordinary Task count");
    expect(f.state()).toEqual(before);
  });

  it("current exact selector excludes co-assignees; project removes all restrictions while retaining source provenance", async () => {
    const f = fixture(), report = query(f), resource = report.children.find(row => row.selector.id === f.resources.get("R1")!.publicId)!;
    const process = resource.children.find(row => row.selector.id === f.processA.publicId)!;
    const selected = f.service.queryWbsView(f.project.publicId, { spec, filters, projection: { kind: "scope", snapshotId: report.snapshotId, path: process.path } }) as WbsViewScopeDto;
    const opts = options(report, selected.sourceContext), current = await workbook(f, opts);
    const rows = issue623Table(current.sheet("Resource Assignments"));
    expect(rows.map(row => row.assignmentId).sort()).toEqual([...selected.assignmentIds].sort());
    expect(current.sheet("Resource Report")).toContain("WBS selected path");
    const projectOptions: WbsResourceExcelExportOptions = { basis: "project", expectedReport: { context: selected.sourceContext, filters: report.filters }, granularities: ["month"] };
    const whole = await workbook(f, projectOptions), all = issue623Table(whole.sheet("Resource Assignments"));
    expect(all).toHaveLength(4); expect(all.reduce((sum, row) => sum + Number(row.plannedMd), 0)).toBe(14);
    const bundle = f.service.getExcelReport(f.project.publicId, projectOptions)!;
    expect(bundle.wbsView!.selection.path).toEqual([]); expect(bundle.wbsView!.selection.sourceContext.scope).toBeUndefined();
    expect(bundle.report.filters.taskIds).toEqual([]); expect(bundle.report.mdPerMm).toBeNull();
    expect(bundle.wbsView!.request.expectedReport.context.path).toEqual(process.path);
  });

  it("preserves unset, configured nonworking0 and unassigned raw Task evidence", async () => {
    const f = fixture(), assignment = f.assignmentIds.get("A0")!;
    f.database.prepare("UPDATE task_assignments SET allocation_percent=NULL WHERE public_id=?").run(assignment);
    const report = query(f), a = await workbook(f, options(report));
    expect(issue623Table(a.sheet("Resource Assignments")).find(row => row.assignmentId === assignment)).toMatchObject({ plannedMd: null, plannedMm: null });
    expect(a.sheet("Resource Relations")).toContain(f.tasks.get("UNASSIGNED")!.publicId);
    f.database.prepare("UPDATE tasks SET end_date='2026-10-11' WHERE public_id=?").run(f.tasks.get("T0")!.publicId);
    f.database.prepare("UPDATE task_assignments SET assignment_start='2026-10-10',assignment_end='2026-10-11',allocation_percent=100 WHERE public_id=?").run(assignment);
    const zero = query(f, { ...filters, to: "2026-10-11", taskIds: [f.tasks.get("T0")!.publicId] }), b = await workbook(f, options(zero));
    expect(issue623Table(b.sheet("Resource Assignments"))[0]).toMatchObject({ plannedMd: 0, plannedMm: null });
  });

  it("fails exact Origin/revision, foreign/tampered/stale source and unsupported root without a workbook", async () => {
    const f = fixture(), report = query(f), opts = options(report);
    expect((await http(f, opts, { Origin: "https://foreign.example" })).status).toBe(403);
    expect((await http(f, opts, { "If-Match": '"2"' })).status).toBe(412);
    const project: WbsResourceExcelExportOptions = { basis: "project", expectedReport: { context: report.sourceContext, filters: report.filters }, granularities: ["month"] };
    for (const change of [
      { ...report.sourceContext, snapshotId: "0".repeat(64) },
      { ...report.sourceContext, path: [{ dimension: "resource" as const, id: randomUUID() }] },
    ]) expect([400, 412]).toContain((await http(f, { ...project, expectedReport: { context: change, filters: report.filters } })).status);
    expect((await http(f, { ...project, expectedReport: { context: report.sourceContext, filters: { ...report.filters, resourceIds: [f.resources.get("R2")!.publicId] } } })).status).toBe(412);
    const foreignScope = await http(f, { ...project, expectedReport: { context: { ...report.sourceContext, scope: { kind: "exactAssignments", assignmentIds: [randomUUID()] } }, filters: report.filters } });
    expect(foreignScope.status).toBe(412);
    expect(foreignScope.headers.get("content-type")).toContain("application/json");
    expect(foreignScope.headers.get("content-disposition")).toBeNull();
    expect((await foreignScope.json()).error.code).toBe("REVISION_MISMATCH");
    for (const mutate of [
      (v: WbsResourceExcelExportOptions) => { v.expectedReport.context.projectPublicId = randomUUID(); },
      (v: WbsResourceExcelExportOptions) => { v.expectedReport.context.catalogRevision++; },
      (v: WbsResourceExcelExportOptions) => { v.expectedReport.context.path = [{ dimension: "resource", id: randomUUID() }]; },
      (v: WbsResourceExcelExportOptions) => { if (v.basis === "current") v.expectedReport.filters = { ...filters, resourceIds: [f.resources.get("R2")!.publicId] }; },
    ]) {
      const changed = structuredClone(opts); mutate(changed); const response = await http(f, changed);
      expect([400, 412]).toContain(response.status); expect(response.headers.get("content-type")).toContain("json");
    }
    const other = query(f, filters, { ...spec, root: "process", levels: ["resource"] });
    expect(other.metadata.excel.supported).toBe(false);
    expect((await http(f, options(other))).status).toBe(409);
    expect(parseProjectExcelExportInput({ ...legacy, resourceDashboard: { ...opts, ignoredFilter: true } }).success).toBe(false);
    f.database.prepare("UPDATE tasks SET name='changed without revision' WHERE public_id=?").run(f.tasks.get("T3")!.publicId);
    expect((await http(f, opts)).status).toBe(412);
  });

  it("Target0 explicit-context-only Excel retains same-R project raw causes", async () => {
    const f = fixture();
    f.database.prepare("DELETE FROM task_equipment_links WHERE project_id=?").run(f.project.id);
    f.database.prepare("DELETE FROM task_system_links WHERE project_id=?").run(f.project.id);
    const data = query(f, { ...filters, taskIds: [f.tasks.get("T3")!.publicId] });
    const bundle = f.service.getExcelReport(f.project.publicId, options(data))!;
    expect(bundle.targetData).toBeUndefined(); expect(bundle.wbsView!.projectAssignments).toHaveLength(4);
    const a = await workbook(f, options(data)), project = issue623Table(a.sheet("Resource Project Assignments"));
    expect(project.map(row => row.assignmentId).sort()).toEqual([...f.assignmentIds.values()].sort());
    expect(issue623Table(a.sheet("Resource Assignments"))).toHaveLength(1);
  });

  it("keeps selected80/Project140 and exact project daily cause with the original Calendar/Capacity R", () => {
    const f = issue623BackendFixture(); close.push(() => f.db.close());
    const selectedFilters = { ...f.filters, resourceIds: [f.id("R4")], taskIds: [f.id("SELECTED")], mdPerMm: null };
    const data = f.service.queryWbsView(f.project.publicId, { spec, filters: selectedFilters }) as WbsViewReportDto;
    const adapter = data.resourceAdapter!, plan = adapter.report.plan!;
    expect(plan.population.resourceIds).toEqual([f.id("R4")]);
    expect(plan.totals.summary.selected).toMatchObject({ capacityMd: 5, knownMd: 4, loadPercent: 80, plannedMm: null });
    expect(plan.totals.summary.project).toMatchObject({ knownMd: 7, loadPercent: 140, plannedMm: null });
    expect(data.plan!.totals).toEqual(plan.totals);
    const input = { snapshotId: adapter.report.snapshotId, granularity: "week" as const, periodId: "all", selector: { kind: "resource" as const, resourceId: f.id("R4") }, demandScope: "project" as const, date: "2026-10-05", offset: 0, limit: 100 };
    const details = f.service.getPlanDetails(f.project.publicId, selectedFilters, input, "day-assignments", adapter.binding.scope) as ResourcePlanDayAssignmentsDto;
    expect(details.rows.map(row => row.assignmentId).sort()).toEqual([f.id("SELECTED-R4"), f.id("OUTSIDE-R4")].sort());
    expect(plan.resources[0].summary.project.peakDailyLoadPercent).toBe(140);
    const bundle = f.service.getExcelReport(f.project.publicId, options(data))!;
    expect(bundle.plans.week!.totals.summary.selected.knownMd).toBe(4);
    expect(bundle.plans.week!.totals.summary.project.knownMd).toBe(7);
  });
});
