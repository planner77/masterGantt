import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourceDashboardDto, ResourceDashboardFilterInput, ResourcePlanDayAssignmentsDto } from "../../../src/contracts/resource-dashboard";
import type { ResourceExcelExportOptions } from "../../../src/contracts/resource-excel-export";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { handleProjectExcelExport } from "../../../src/server/exports/project-excel-export-handler-core";
import { handleGetResourceDashboard, handleGetResourcePlan } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { parseResourceExcelOptions } from "../../../src/server/exports/project-excel-export-contract";
import { TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { resourceDashboardTargetsFixture } from "../../fixtures/resource-dashboard-targets";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";
const fixtures: ReturnType<typeof resourceDashboardTargetsFixture>[] = [];
afterEach(() => fixtures.splice(0).forEach(f => f.database.close()));
const legacy = { includeDependencies: false, scope: "project" as const, scale: "day" as const, hierarchyDisplay: "expanded" as const, layout: { columns: [{ id: "text" as const, widthPx: 224 }] } };
function fixture() {
  const f = resourceDashboardTargetsFixture(); fixtures.push(f);
  const bindings = new TaskTargetBindingRepository(f.database);
  f.database.transaction(() => {
    f.database.prepare("DELETE FROM task_assignments WHERE project_id=?").run(f.project.id);
    for (const [key, target, allocation] of [["T1", f.targets[0], 80], ["T2", f.targets[1], 60]] as const) {
      const task = f.tasks.get(key)!, resource = f.resources.get("R1")!;
      f.database.prepare("UPDATE tasks SET start_date='2026-10-05',end_date='2026-10-05',requested_start='2026-10-05',duration=1 WHERE id=?").run(task.id);
      bindings.replace(f.project.id, task.id, [{ id: randomUUID(), taskId: task.publicId, targetId: target.id, selection: "whole", scope: "self", memberIds: [] }], now);
      f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [{ publicId: resource.publicId, internalId: resource.id, kind: "resource", assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: allocation }] });
    }
    const task = f.tasks.get("T5")!, resource = f.resources.get("R2")!;
    f.database.prepare("UPDATE tasks SET start_date='2025-10-06',end_date='2025-10-06',requested_start='2025-10-06',duration=1 WHERE id=?").run(task.id);
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [{ publicId: resource.publicId, internalId: resource.id, kind: "resource", assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 50 }] });
  })();
  const filters: ResourceDashboardFilterInput = { from: "2026-10-05", to: "2026-10-05", granularity: "week", targetIds: [f.targets[0].id] };
  return { ...f, filters };
}
const detail = (report: ResourceDashboardDto, resourceId: string, demandScope: "selected" | "project") => ({ snapshotId: report.snapshotId, granularity: "week" as const, periodId: "all", selector: { kind: "resource" as const, resourceId }, demandScope, date: "2026-10-05", offset: 0, limit: 100 });
function options(f: ReturnType<typeof fixture>, filters = f.filters): ResourceExcelExportOptions { const report = f.service.getDashboard(f.project.publicId, filters)!; return { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters }, granularities: ["week", "month"] }; }
function extract(bytes: Uint8Array) { const b = Buffer.from(bytes), entries = new Map<string, string>(); let offset = 0; while (offset + 30 <= b.length && b.readUInt32LE(offset) === 0x04034b50) { const length = b.readUInt32LE(offset + 18), nameLength = b.readUInt16LE(offset + 26), start = offset + 30 + nameLength + b.readUInt16LE(offset + 28); entries.set(b.toString("utf8", offset + 30, offset + 30 + nameLength), inflateRawSync(b.subarray(start, start + length)).toString()); offset = start + length; } return entries; }
/** Inspect actual OOXML cell types and column positions, including blank vs numeric zero. */
function table(xml: string): Record<string, string | number | boolean | null>[] {
  const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row => {
    const values: (string | number | boolean | null)[] = [];
    for (const match of row[1].matchAll(/<c\b[^>]*?r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const index = [...match[1]].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1, content = match[2] ?? "";
      const text = /<t[^>]*>([\s\S]*?)<\/t>/.exec(content), value = /<v>(.*?)<\/v>/.exec(content);
      values[index] = text ? text[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&") : value ? (/t="b"/.test(match[0]) ? value[1] === "1" : Number(value[1])) : null;
    }
    return values;
  });
  const headers = rows.shift() ?? [];
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [String(header), row[index] ?? null])));
}
function assertWorkbookParity(a: ReturnType<typeof archive>) {
  for (const [name, dto] of [["Resource Assignments", a.bundle.assignments], ["Resource Project Assignments", a.bundle.targetData!.projectAssignments]] as const) {
    const rows = table(a.sheet(name));
    expect(rows).toHaveLength(dto.length);
    for (const detail of dto) {
      const row = rows.find(row => row.assignmentId === detail.assignment.assignmentId)!;
      expect(row, `${name}: exact Assignment identity`).toBeDefined();
      expect(row.taskId).toBe(detail.taskId); expect(row.resourceId).toBe(detail.assignment.resourceId);
      expect(row.plannedMd).toBe(detail.assignment.plannedMd); expect(row.plannedMm).toBe(detail.assignment.plannedMm);
      expect(row["allocationPercent (0-100)"]).toBe(detail.assignment.allocationPercent);
      expect(row.effectiveWorkingDays).toBe(detail.assignment.effectiveWorkingDays);
    }
  }
  const rows = table(a.sheet("Resource Plan"));
  const metrics = ["capacityMd", "knownMd", "plannedMd", "plannedMm", "state", "partial", "assignmentCount", "unknownAssignmentCount", "unknownResourceDayCount", "loadPercent", "knownLoadPercent", "peakDailyLoadPercent", "peakResourceDailyLoadPercent", "knownPeakDailyLoadPercent", "knownPeakResourceDailyLoadPercent", "overAllocatedDayCount", "overAllocatedResourceDayCount", "overAllocatedResourceCount", "excessMd"] as const;
  for (const [granularity, plan] of Object.entries(a.bundle.plans)) for (const cell of [{ periodKey: "all", ...plan!.totals.summary }, ...plan!.totals.cells]) for (const scope of ["selected", "project"] as const) {
    const row = rows.find(row => row.granularity === granularity && row.dimension === "total" && row.periodId === cell.periodKey && row.demandScope === scope)!;
    expect(row).toBeDefined();
    for (const key of metrics) expect(row[key.includes("Percent") ? `${key} (0-100)` : key], `${granularity}/${cell.periodKey}/${scope}/${key}`).toBe(typeof cell[scope][key] === "boolean" ? String(cell[scope][key]) : cell[scope][key]);
  }
  const sourceRows = table(a.sheet("Resource Target Sources"));
  for (const row of sourceRows.filter(row => row.relation === "AssignmentScope")) {
    expect(row.sourceTaskId).toBeNull();
    const assignment = [...a.bundle.assignments, ...a.bundle.targetData!.projectAssignments].find(source => source.assignment.assignmentId === row.assignmentId)!;
    expect(row.taskId).toBe(assignment.taskId);
  }
}
function archive(f: ReturnType<typeof fixture>, opts: ResourceExcelExportOptions) {
  const service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(now), mdPerMmEnvironment: "21" });
  const bundle = service.get(f.project.publicId, false, opts)!;
  bundle.resourceDashboard!.canonicalProjectUrl = `https://gantt.example/projects/${f.project.publicId}`;
  const bytes = buildProjectExcelWorkbook(bundle.snapshot, { ...legacy, resourceDashboard: opts }, undefined, bundle.stageDashboard, bundle.resourceDashboard);
  const entries = extract(bytes), names = [...entries.get("xl/workbook.xml")!.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
  return { bundle: bundle.resourceDashboard!, bytes, entries, names, sheet: (name: string) => entries.get(`xl/worksheets/sheet${names.indexOf(name) + 1}.xml`)! };
}

describe("#622 SQLite Target Plan and Resource workbook", () => {
  it("keeps selected80/Project140, same R/capacity, Group70 vs individual140 and exact daily causes/context", async () => {
    const f = fixture(), before = f.state(), report = f.service.getDashboard(f.project.publicId, f.filters)!;
    const r1 = f.resources.get("R1")!.publicId, row = report.plan!.resources.find(row => row.resourceId === r1)!;
    expect(report.plan!.population.resourceCount).toBe(2);
    expect(report.plan!.targetContext).toMatchObject({ filters: { targetIds: [f.targets[0].id] }, subtotalsAdditive: false });
    expect(row.summary.selected).toMatchObject({ capacityMd: 1, plannedMd: .8, loadPercent: 80 });
    expect(row.summary.project.plannedMd).toBeCloseTo(1.4, 12);
    expect(row.summary.project).toMatchObject({ overAllocatedDayCount: 1, peakDailyLoadPercent: 140 });
    expect(report.plan!.groups.find(row => row.groupId === f.groups.get("G1")!.publicId)!.summary.project.loadPercent).toBeCloseTo(70);
    for (const demandScope of ["selected", "project"] as const) {
      const input = detail(report, r1, demandScope), data = f.service.getPlanDetails(f.project.publicId, f.filters, input, "day-assignments") as ResourcePlanDayAssignmentsDto;
      expect(data.resourceScopeContext).toEqual(report.resourceScopeContext);
      expect(data.filters.targetIds).toEqual([f.targets[0].id]);
      expect(data.rows.map(row => row.taskName).sort()).toEqual(demandScope === "selected" ? ["T1"] : ["T1", "T2"]);
      expect(data.rows.every(row => row.resourceActive && row.targetSources?.taskId === row.taskId)).toBe(true);
      const scope = f.service.getScope(f.project.publicId, { view: "plan", filters: f.filters, detail: input })!;
      expect("assignmentIds" in scope && [...scope.assignmentIds].sort()).toEqual(data.rows.map(row => row.assignmentId).sort());
    }
    const p = new URLSearchParams({ from: "2026-10-05", to: "2026-10-05", granularity: "week", targetIds: f.targets[0].id, snapshotId: report.snapshotId, periodId: "all", row: "resource", resourceId: r1, demandScope: "project", date: "2026-10-05" });
    const response = await handleGetResourcePlan(new Request(`https://gantt.example/test?${p}`), f.project.publicId, { service: f.service }, "day-assignments");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("set-cookie")).toBeNull(); expect(f.state()).toEqual(before);
  });
  it("keeps exact-source selection separate from same-R Project evidence and exports raw API parity", () => {
    const f = fixture(), unscoped = f.service.getDashboard(f.project.publicId, f.filters)!;
    const selected = f.service.getDetails(f.project.publicId, f.filters, { snapshotId: unscoped.snapshotId, selector: { dimension: "all", id: null, metric: "all" }, view: "assignments", offset: 0, limit: 100 })!;
    const scope = { kind: "exactAssignments" as const, assignmentIds: selected.rows.map(row => row.assignment!.assignmentId) };
    const report = f.service.getDashboard(f.project.publicId, f.filters, scope)!;
    const opts: ResourceExcelExportOptions = { ...options(f), basis: "current", binding: { sourceContext: unscoped.resourceScopeContext!, scope }, expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters: f.filters } };
    const a = archive(f, opts), bundle = a.bundle;
    expect(bundle.assignments.map(row => row.assignment.assignmentId)).toEqual(scope.assignmentIds);
    expect(bundle.assignments[0].assignment.plannedMd).toBe(.8); expect(bundle.assignments[0].assignment.plannedMm).toBe(.8 / 21);
    expect(bundle.targetData!.projectAssignments).toHaveLength(2);
    for (const plan of Object.values(bundle.plans)) { expect(plan!.totals.summary.selected.knownMd).toBe(.8); expect(plan!.totals.summary.project.knownMd).toBeCloseTo(1.4); expect(plan!.totals.cells.reduce((n, c) => n + c.selected.knownMd, 0)).toBe(.8); }
    assertWorkbookParity(a);
    expect(a.names).toContain("Resource Target Sources"); expect(a.names).toContain("Resource Project Assignments");
    expect(a.sheet("Resource Assignments")).toContain(`<v>0.8</v>`);
    expect(a.sheet("Resource Project Assignments")).toContain(f.tasks.get("T2")!.publicId);
    expect(a.sheet("Resource Target Sources")).toContain(f.targets[0].memberIds[0]);
    expect(a.sheet("Resource Targets")).toContain("수량을 공수에 곱하지 않음");
    const all = archive(f, { basis: "project", expectedReport: { context: report.resourceScopeContext! }, originalSourceContext: unscoped.resourceScopeContext, granularities: ["week", "month"] }).bundle;
    expect(all.report.filters.targetIds).toBeUndefined(); expect(all.assignments).toHaveLength(2); expect(all.report.summary.effort.knownMd).toBeCloseTo(1.4); expect(all.targetData!.taskSources).toHaveLength(4);
  });
  it("retains plain schedule Target rejection and export security while explicit Resource workbook accepts literal Target labels", async () => {
    const f = fixture(), service = new ProjectExportSnapshotService(f.database, { clock: () => new Date(now), mdPerMmEnvironment: "21" });
    expect(() => service.get(f.project.publicId)).toThrow(expect.objectContaining({ code: "TASK_TARGET_EXPORT_UNSUPPORTED" }));
    f.database.prepare("UPDATE logistics_targets SET name=? WHERE public_id=?").run("=SUM(1,2)<&", f.targets[0].id);
    const opts = options(f), a = archive(f, opts);
    expect(a.sheet("Resource Target Catalog")).toContain("=SUM(1,2)&lt;&amp;");
    expect(a.sheet("Resource Target Catalog")).not.toContain("<f>");
    const http = (origin: string) => handleProjectExcelExport(new Request(`https://gantt.example/api/projects/${f.project.publicId}/exports/excel`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "If-Match": '"1"' }, body: JSON.stringify({ ...legacy, resourceDashboard: opts }) }), f.project.publicId, { service: { getReadonlySnapshot: () => undefined }, applicationBaseUrl: "https://gantt.example", environment: "production", getExportBundle: (...args) => service.get(...args) });
    expect((await http("https://hostile.example")).status).toBe(403);
    const response = await http("https://gantt.example"); expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBeNull();
    for (const filters of [{ targetIds: ["bad"] }, { targetIds: [f.targets[0].id], extra: "bad" }, { projectionOrder: ["target", "target"] }]) expect(() => parseResourceExcelOptions({ ...opts, expectedReport: { ...(opts.basis === "current" ? opts.expectedReport : {}), filters } })).toThrow();
  });
  it("exports overlapping Target subtotals once in raw Assignment totals and preserves unknown/known0 nullable states", () => {
    const f = resourceDashboardTargetsFixture(); fixtures.push(f);
    const filters = { from: "2026-10-05", to: "2026-10-16", projectionOrder: ["target" as const] }, opts = options({ ...f, filters }, filters);
    const a = archive({ ...f, filters }, opts), b = a.bundle;
    assertWorkbookParity(a);
    expect(b.report.summary.effort.state).toBe("partial");
    const nodes = b.targetData!.projection.children.filter(row => row.id !== null);
    expect(nodes.reduce((n, row) => n + row.summary.effort.knownMd, 0)).toBeGreaterThan(b.report.summary.effort.knownMd);
    expect(new Set(b.assignments.map(row => row.assignment.assignmentId)).size).toBe(b.assignments.length);
    expect(b.assignments.reduce((n, row) => n + (row.assignment.plannedMd ?? 0), 0)).toBe(b.report.summary.effort.knownMd);
    expect(b.assignments.filter(row => row.assignment.allocationPercent === null).every(row => row.assignment.plannedMd === null && row.assignment.plannedMm === null)).toBe(true);
    const unsetFilters = { ...filters, taskIds: [f.tasks.get("T2")!.publicId] };
    const unset = archive({ ...f, filters: unsetFilters }, options({ ...f, filters: unsetFilters }, unsetFilters));
    assertWorkbookParity(unset);
    expect(unset.bundle.plans.week!.totals.summary.selected).toMatchObject({ state: "unset", plannedMd: null, plannedMm: null });
    expect(a.sheet("Resource Plan")).toContain("partial"); expect(a.sheet("Resource Assignments")).not.toContain("<f>");
    const weekendFilters = { ...filters, from: "2026-10-10", to: "2026-10-11", taskIds: [f.tasks.get("T5")!.publicId] };
    const weekendArchive = archive({ ...f, filters: weekendFilters }, options({ ...f, filters: weekendFilters }, weekendFilters));
    assertWorkbookParity(weekendArchive);
    const weekend = weekendArchive.bundle;
    expect(weekend.plans.week!.totals.summary.selected).toMatchObject({ state: "configured", plannedMd: 0, capacityMd: 0, loadPercent: null });
  });
  it("rejects stale Target/member/classification data before Plan selector or current/project workbook materialization", () => {
    const f = fixture(), opts = options(f), report = f.service.getDashboard(f.project.publicId, f.filters)!;
    f.database.prepare("UPDATE logistics_targets SET name='Changed' WHERE public_id=?").run(f.targets[1].id);
    expect(() => f.service.getPlanDetails(f.project.publicId, f.filters, detail(report, f.resources.get("R1")!.publicId, "project"), "day-assignments")).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
    expect(() => f.service.getExcelReport(f.project.publicId, opts)).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
    expect(() => f.service.getExcelReport(f.project.publicId, { basis: "project", expectedReport: { context: report.resourceScopeContext! }, granularities: ["week"] })).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
  });
  it("records actual Target Plan/export time and bytes for a multi-Target fixture", async () => {
    const f = fixture(), bindings = new TaskTargetBindingRepository(f.database);
    f.database.transaction(() => {
      for (let i = 0; i < 120; i++) {
        const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `BENCH${i}`, name: `Bench ${i}`, type: "task", parentId: null, sortOrder: 100 + i, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 1, progress: 0, createdAt: now, updatedAt: now });
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now, targets: [...f.resources.values()].map(resource => ({ publicId: resource.publicId, internalId: resource.id, kind: "resource" as const, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 50 })) });
        bindings.replace(f.project.id, task.id, f.targets.map(target => ({ id: randomUUID(), taskId: task.publicId, targetId: target.id, scope: "self", selection: "whole", memberIds: [] })), now);
      }
    })();
    const sql = vi.spyOn(f.database, "prepare"), start = performance.now();
    const response = await handleGetResourceDashboard(f.request(new URLSearchParams({ from: "2026-10-05", to: "2026-10-05", granularity: "week", targetIds: f.targets[0].id }).toString()), f.project.publicId, { service: f.service });
    const body = await response.text(), reportMs = performance.now() - start, queryCount = sql.mock.calls.length;
    sql.mockRestore(); expect(response.status).toBe(200);
    const report: ResourceDashboardDto = JSON.parse(body).data;
    const opts: ResourceExcelExportOptions = { basis: "current", expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters: f.filters }, granularities: ["week", "month"] };
    const exportStart = performance.now(), a = archive(f, opts);
    const evidence = { tasks: f.schedules.listTasks(f.project.id).length, assignments: a.bundle.assignments.length, projectAssignments: a.bundle.targetData!.projectAssignments.length, targets: 2, queryCount, reportMs, exportMs: performance.now() - exportStart, reportBytes: Buffer.byteLength(body), workbookBytes: a.bytes.length };
    if (process.env.RESOURCE_TARGET_PLAN_BENCHMARK_OUTPUT) writeFileSync(process.env.RESOURCE_TARGET_PLAN_BENCHMARK_OUTPUT, JSON.stringify(evidence, null, 2));
    expect(evidence.assignments).toBe(241); expect(evidence.projectAssignments).toBe(242); expect(queryCount).toBeLessThan(85);
    expect(evidence.reportBytes).toBeLessThan(2 * 1024 * 1024); expect(evidence.workbookBytes).toBeLessThan(16 * 1024 * 1024);
  });
});
