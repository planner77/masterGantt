import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourceDashboardDto, ResourceDashboardFilterInput, ResourceDashboardDetailsDto } from "../../../src/contracts/resource-dashboard";
import type { ResourceExcelExportOptions } from "../../../src/contracts/resource-excel-export";
import { handleGetResourceDashboard } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { issue623BackendFixture, ISSUE_623_NOW, issue623WorkbookEntries, issue623Table } from "../../fixtures/issue-623-backend-fixture";
import { ISSUE_623_TARGET_RESOURCE as oracle, issue623Resource530Fixture } from "../../fixtures/issue-623-target-resource";
const fixtures: ReturnType<typeof issue623BackendFixture>[] = [];
const fixture = (input?: Parameters<typeof issue623BackendFixture>[0]) => { const f = issue623BackendFixture(input); fixtures.push(f); return f; };
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach(f => f.db.close()); });
const legacy = { includeDependencies: false, scope: "project" as const, scale: "day" as const, hierarchyDisplay: "expanded" as const, layout: { columns: [{ id: "text" as const, widthPx: 224 }] } };
function params(filter: ResourceDashboardFilterInput) { const p = new URLSearchParams(); for (const [key, value] of Object.entries(filter)) if (value !== undefined) p.set(key, Array.isArray(value) ? value.join(",") : value === null ? "null" : String(value)); return p; }
async function report(f: ReturnType<typeof fixture>, filters: ResourceDashboardFilterInput) {
  const response = await handleGetResourceDashboard(new Request(`https://gantt.example/api/projects/${f.project.publicId}/resource-dashboard?${params(filters)}`), f.project.publicId, { service: f.service });
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("set-cookie")).toBeNull();
  const body = await response.text(); return { data: JSON.parse(body).data as ResourceDashboardDto, bytes: Buffer.byteLength(body) };
}
async function workbook(f: ReturnType<typeof fixture>, data: ResourceDashboardDto, filters: ResourceDashboardFilterInput) {
  const started = performance.now();
  const options: ResourceExcelExportOptions = { basis: "current", expectedReport: { context: data.resourceScopeContext!, snapshotId: data.snapshotId, filters }, granularities: ["week", "month"] };
  const service = new ProjectExportSnapshotService(f.db, { clock: () => ISSUE_623_NOW });
  const response = await handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://gantt.example", "If-Match": `"${data.projectRevision}"` }, body: JSON.stringify({ ...legacy, resourceDashboard: options }) }), f.project.publicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) });
  expect(response.status, await (response.status === 200 ? Promise.resolve("") : response.text())).toBe(200);
  const bytes = new Uint8Array(await response.arrayBuffer()), httpMs = performance.now() - started; return { ...issue623WorkbookEntries(bytes), httpMs, bytes: bytes.length, bundle: f.service.getExcelReport(f.project.publicId, options)! };
}
const details = (snapshotId: string) => ({ snapshotId, selector: { dimension: "all" as const, id: null, metric: "all" as const }, view: "assignments" as const, offset: 0, limit: 100 });
function parity(a: Awaited<ReturnType<typeof workbook>>) {
  const assignments = issue623Table(a.sheet("Resource Assignments")); expect(assignments).toHaveLength(a.bundle.assignments.length);
  for (const source of a.bundle.assignments) {
    const row = assignments.find(row => row.assignmentId === source.assignment.assignmentId)!;
    expect(row.taskId).toBe(source.taskId); expect(row.resourceId).toBe(source.assignment.resourceId);
    expect(row.plannedMd).toBe(source.assignment.plannedMd); expect(row.plannedMm).toBe(source.assignment.plannedMm); expect(row["allocationPercent (0-100)"]).toBe(source.assignment.allocationPercent);
  }
  const plans = issue623Table(a.sheet("Resource Plan"));
  for (const [granularity, plan] of Object.entries(a.bundle.plans)) for (const cell of [{ periodKey: "all", ...plan!.totals.summary }, ...plan!.totals.cells]) for (const scope of ["selected", "project"] as const) {
    const row = plans.find(row => row.granularity === granularity && row.dimension === "total" && row.periodId === cell.periodKey && row.demandScope === scope)!;
    for (const key of ["capacityMd", "knownMd", "plannedMd", "plannedMm", "state", "assignmentCount", "unknownAssignmentCount", "excessMd"] as const) expect(row[key]).toBe(cell[scope][key]);
  }
}
describe("#623 shared canonical oracle through SQLite/public HTTP/details/Plan/OOXML", () => {
  it("proves shared5/A5/B5/distinct5,15equipment/ACS2/sharedMCS1 and all three direct/inherited provenance paths", async () => {
    const f = fixture(), filters = { ...f.filters, taskIds: [f.id(oracle.sharedTaskId)], projectionOrder: ["target" as const] }, { data } = await report(f, filters);
    expect(data.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { knownMd: 5, plannedMd: 5, plannedMm: .25, state: "configured" } });
    expect(data.targetProjection!.children.map(node => [node.id, node.summary.effort.knownMd]).sort()).toEqual(oracle.targetIds.map(id => [f.id(id), 5]).sort());
    expect(data.targetProjection!.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 3 });
    expect(data.plan!.totals.summary.selected).toMatchObject({ knownMd: 5, plannedMm: .25, capacityMd: 20 });
    const p = params(filters); for (const [key, value] of Object.entries({ snapshotId: data.snapshotId, dimension: "all", metric: "all", view: "assignments" })) p.set(key, value);
    const response = await handleGetResourceDashboard(new Request(`https://gantt.example/details?${p}`), f.project.publicId, { service: f.service }, true); expect(response.status).toBe(200);
    const page = (await response.json()).data as ResourceDashboardDetailsDto, row = page.rows[0];
    expect(page.snapshotId).toBe(data.snapshotId); expect(row.assignment).toMatchObject({ assignmentId: f.id(oracle.sharedAssignmentId), resourceId: f.id(oracle.sharedResourceId), plannedMd: 5, plannedMm: .25 });
    const mcs = row.targetSources!.effectiveMembers.find(member => member.entityId === f.id("MCS-1"))!;
    expect(new Set(mcs.provenance.map(path => path.bindingId))).toEqual(new Set(oracle.expected.shared.mcsBindingIds.map(f.id)));
    const a = await workbook(f, data, filters); parity(a);
    const sourceRows = issue623Table(a.sheet("Resource Target Sources"));
    const mcsRows = sourceRows.filter(row => row.relation === "MemberProvenance" && row.taskId === f.id("SHARED") && row.entityId === f.id("MCS-1"));
    expect(new Set(mcsRows.map(row => row.bindingId))).toEqual(new Set(oracle.expected.shared.mcsBindingIds.map(f.id)));
    const memberRows = sourceRows.filter(row => row.relation === "TargetMember");
    expect(memberRows.filter(row => row.kind === "equipment").reduce((n, row) => n + Number(row["quantity (not effort multiplier)"]), 0)).toBe(15);
    expect(new Set(memberRows.filter(row => row.kind === "system").map(row => row.entityId)).size).toBe(3);
    expect(f.db.prepare("SELECT COUNT(*) FROM project_logistics_systems WHERE code='MCS-1'").pluck().get()).toBe(1);
  });
  it("keeps ACS-only subset, legacy-unlinked, overlapping Groups and the original530 ledger with raw nullable workbook parity", async () => {
    const f = fixture(), all = await report(f, { ...f.filters, projectionOrder: ["target"] });
    expect(all.data.summary).toMatchObject({ taskCount: 8, assignmentCount: 9, resourceCount: 4, effort: { knownMd: 20, plannedMm: 1, state: "partial", unsetCount: 2 } });
    expect(all.data.diagnostics.denominator).toBe(10); expect(all.data.groups.reduce((n, row) => n + row.summary.effort.knownMd, 0)).toBe(33);
    const a = await workbook(f, all.data, { ...f.filters, projectionOrder: ["target"] }); parity(a);
    const unset = issue623Table(a.sheet("Resource Assignments")).filter(row => oracle.expected.all.unknownAssignmentIds.map(f.id).includes(String(row.assignmentId)));
    expect(unset).toHaveLength(2); for (const row of unset) { expect(row.plannedMd).toBeNull(); expect(row.plannedMm).toBeNull(); }
    expect(issue623Table(a.sheet("Resource Assignments")).find(row => row.assignmentId === f.id("ZERO-R3"))!.plannedMd).toBe(0);
    const acsFilters = { ...f.filters, taskIds: [f.id("ACS_ONLY")], targetIds: [f.id("TARGET-A")], memberEquipmentIds: [f.id("AMR-A")] };
    expect((await report(f, acsFilters)).data.summary.assignmentCount).toBe(0);
    expect((await report(f, { ...f.filters, targetIds: ["unassigned"], directSystemIds: [f.id("MCS-1")] })).data.summary.assignmentCount).toBe(1);
    const old = fixture(issue623Resource530Fixture()), filters = { ...old.filters, projectionOrder: ["target" as const] }, legacyReport = await report(old, filters);
    expect(legacyReport.data.summary).toMatchObject({ taskCount: 4, assignmentCount: 5, resourceCount: 2, effort: { knownMd: 11.5, plannedMm: .575, unsetCount: 1 } });
    expect(legacyReport.data.plan!.totals.summary.selected.capacityMd).toBe(10); parity(await workbook(old, legacyReport.data, filters));
  });
  it("separates80selected/140same-RProject causes from20MD full canonical Target reference with an unspecified M/M basis", async () => {
    const f = fixture(), filters: ResourceDashboardFilterInput = { ...f.filters, resourceIds: [f.id("R4")], targetIds: [f.id("TARGET-A")], projectionOrder: ["target"] };
    delete filters.mdPerMm;
    const { data } = await report(f, filters);
    expect(data.mdPerMmSource).toBe("unset");
    expect(data.plan!.population.resourceIds).toEqual([f.id("R4")]);
    expect(data.plan!.totals.summary.selected).toMatchObject({ knownMd: 4, loadPercent: 80, capacityMd: 5, plannedMm: null });
    expect(data.plan!.totals.summary.project).toMatchObject({ knownMd: 7, loadPercent: 140, plannedMm: null });
    expect(data.plan!.totals.summary.project.excessMd).toBeCloseTo(2, 12);
    expect(data.targetProjection!.projectReference.effort.knownMd).toBe(20);
    const input = { snapshotId: data.snapshotId, granularity: "week" as const, periodId: "all", selector: { kind: "resource" as const, resourceId: f.id("R4") }, demandScope: "project" as const, date: "2026-10-05", offset: 0, limit: 100 };
    const page = f.service.getPlanDetails(f.project.publicId, filters, input, "day-assignments")!;
    expect(page.rows.map(row => "assignmentId" in row ? row.assignmentId : "").sort()).toEqual(oracle.expected.overload.projectAssignmentIds.map(f.id).sort());
    const a = await workbook(f, data, filters); parity(a);
    expect(issue623Table(a.sheet("Resource Project Assignments")).map(row => row.assignmentId).sort()).toEqual(oracle.expected.overload.projectAssignmentIds.map(f.id).sort());
  });
  it.each(["master", "target", "binding", "member", "instanceQuantity", "calendar", "resource", "task", "assignment"] as const)("rejects mixed report/detail/Plan/current-and-project workbook after raw %s change even without revision increments", async axis => {
    const f = fixture(), filters = { ...f.filters, targetIds: [f.id("TARGET-A")] }, { data } = await report(f, filters), oldRevision = data.projectRevision;
    const changes = {
      master: () => f.db.prepare("UPDATE process_types SET name='New name' WHERE public_id=?").run(f.id("TYPE")),
      target: () => f.db.prepare("UPDATE logistics_targets SET name='New name' WHERE public_id=?").run(f.id("TARGET-A")),
      binding: () => f.db.prepare("UPDATE task_target_bindings SET scope='self' WHERE public_id=?").run(f.id("SUMMARY-A")),
      member: () => f.db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,system_id,created_at) VALUES(?,?,(SELECT id FROM logistics_targets WHERE public_id=?),'system',(SELECT id FROM project_logistics_systems WHERE public_id=?),?)").run(randomUUID(), f.project.id, f.id("TARGET-A"), f.id("ACS-B"), ISSUE_623_NOW.toISOString()),
      instanceQuantity: () => f.db.prepare("UPDATE project_equipment SET quantity=11 WHERE public_id=?").run(f.id("AMR-A")),
      calendar: () => f.schedules.insertHoliday(f.project.id, "2026-10-06", "New calendar", ISSUE_623_NOW.toISOString()),
      resource: () => f.db.prepare("UPDATE resources SET developer_grade='EXPERT' WHERE public_id=?").run(f.id("R1")),
      task: () => f.db.prepare("UPDATE tasks SET name='New Task name' WHERE public_id=?").run(f.id("SHARED")),
      assignment: () => f.db.prepare("UPDATE task_assignments SET allocation_percent=90 WHERE public_id=?").run(f.id("SHARED-R1")),
    }; changes[axis]();
    const options: ResourceExcelExportOptions = { basis: "current", expectedReport: { context: data.resourceScopeContext!, snapshotId: data.snapshotId, filters }, granularities: ["week"] };
    for (const operation of [
      () => f.service.query(f.project.publicId, { sourceContext: data.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [f.id("SHARED-R1")] }, filters, projection: { kind: "report" } }),
      () => f.service.getDetails(f.project.publicId, filters, details(data.snapshotId)),
      () => f.service.getPlanDetails(f.project.publicId, filters, { snapshotId: data.snapshotId, granularity: "week", periodId: "all", selector: { kind: "total" }, demandScope: "selected", offset: 0, limit: 100 }, "daily"),
      () => f.service.getExcelReport(f.project.publicId, options),
      () => f.service.getExcelReport(f.project.publicId, { basis: "project", expectedReport: { context: data.resourceScopeContext! }, granularities: ["month"] }),
    ]) expect(operation).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
    const fresh = await report(f, filters); expect(fresh.data.snapshotId).not.toBe(data.snapshotId); expect(fresh.data.projectRevision).toBe(oldRevision);
  });
  it("records real bulk HTTP and OOXML metrics and rejects ranges beyond366days without truncation", async () => {
    const f = fixture(), bindings = new TaskTargetBindingRepository(f.db), stamp = ISSUE_623_NOW.toISOString();
    f.db.transaction(() => { for (let i = 0; i < 120; i++) {
      const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `BENCH${i}`, name: `Bench ${i}`, type: "task", parentId: null, sortOrder: 100 + i, scheduleMode: "auto", requestedStart: oracle.from, startDate: oracle.from, endDate: oracle.to, duration: 5, progress: 0, createdAt: stamp, updatedAt: stamp });
      f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: stamp, targets: [...f.resources.values()].map(resource => ({ kind: "resource" as const, publicId: resource.publicId, internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 50 })) });
      bindings.replace(f.project.id, task.id, oracle.targetIds.map(target => ({ id: randomUUID(), taskId: task.publicId, targetId: f.id(target), scope: "self", selection: "whole", memberIds: [] })), stamp);
    } })();
    const filters = { ...f.filters, projectionOrder: ["target" as const, "group" as const, "resource" as const] }, sql = vi.spyOn(f.db, "prepare"), start = performance.now(), result = await report(f, filters), elapsedMs = performance.now() - start, queryCount = sql.mock.calls.length; sql.mockRestore();
    const a = await workbook(f, result.data, filters), exportMs = a.httpMs;
    expect(result.data.summary.assignmentCount).toBe(489); expect(result.data.summary.effort.knownMd).toBe(1220);
    expect(a.bundle.assignments).toHaveLength(489); expect(queryCount).toBeLessThan(85); expect(result.bytes).toBeLessThan(2 * 1024 * 1024); expect(a.bytes).toBeLessThan(16 * 1024 * 1024);
    const evidence = { tasks: f.tasks.size + 120, assignments: 489, targets: 2, resourceCount: 4, queryCount, elapsedMs, responseBytes: result.bytes, exportMs, workbookBytes: a.bytes };
    if (process.env.ISSUE_623_BACKEND_BENCHMARK_OUTPUT) writeFileSync(process.env.ISSUE_623_BACKEND_BENCHMARK_OUTPUT, JSON.stringify(evidence, null, 2));
    f.db.prepare("UPDATE tasks SET name=? WHERE project_id=? AND external_id LIKE 'BENCH%'").run("長".repeat(200), f.project.id);
    expect(() => f.service.getDashboard(f.project.publicId, { ...filters, from: "2025-01-01", to: "2026-12-31" })).toThrow(expect.objectContaining({ code: "REPORT_LIMIT_EXCEEDED" }));
  });
});
