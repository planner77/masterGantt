import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RESOURCE_DASHBOARD_LIMITS, RESOURCE_TARGET_LIMITS, type ResourceDashboardFilterInput } from "../../../src/contracts/resource-dashboard";
import { ResourceDashboardService, assertResourcePlanResponseBytes } from "../../../src/server/resources/resource-dashboard-service-core";
import { handleGetResourceDashboard } from "../../../src/server/resources/resource-dashboard-handlers-core";
import { parseResourceDashboardDetails, parseResourceDashboardQuery } from "../../../src/server/resources/resource-dashboard-query-core";
import { openDatabase } from "../../../src/server/db/core";
import * as targetDomain from "../../../src/domain/resources/resource-kpi-targets";
import { parseResourceExcelOptions } from "../../../src/server/exports/project-excel-export-contract";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { resourceDashboardTargetsFixture } from "../../fixtures/resource-dashboard-targets";
import { RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";

const fixtures: ReturnType<typeof resourceDashboardTargetsFixture>[] = [], dirs: string[] = [];
const fixture = (filename?: string) => { const f = resourceDashboardTargetsFixture(filename); fixtures.push(f); return f; };
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach(f => { if (f.database.open) f.database.close(); }); dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
const detail = (snapshotId: string) => ({ snapshotId, selector: { dimension: "all" as const, id: null, metric: "all" as const }, view: "assignments" as const, offset: 0, limit: 100 });

describe("#620 canonical SQLite Target Resource report", () => {
  it("uses overlapping raw Assignment unions, same-binding/member filters and full Project reference without changing legacy shape", () => {
    const f = fixture(), all = f.service.getDashboard(f.project.publicId)!;
    expect(all.targetProjection).toBeUndefined(); expect(all.filters).not.toHaveProperty("targetIds");
    const filters: ResourceDashboardFilterInput = { projectionOrder: ["target", "group", "resource"] };
    const report = f.service.getDashboard(f.project.publicId, filters)!, target = report.targetProjection!;
    expect(report.summary).toEqual(all.summary); expect(target.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 3 });
    const a = target.children.find(row => row.id === f.targets[0].id)!, b = target.children.find(row => row.id === f.targets[1].id)!;
    expect(a.summary.effort.knownMd).toBeCloseTo(3.33333332); expect(b.summary.effort.knownMd).toBeCloseTo(3.33333332);
    expect(a.summary.effort.knownMd + b.summary.effort.knownMd).toBeGreaterThan(report.summary.effort.knownMd);
    expect(a.summary.effort.state).toBe("partial");
    const page = f.service.getDetails(f.project.publicId, filters, { ...detail(report.snapshotId), selector: a.summary.selector })!;
    expect(page.totalCount).toBe(a.summary.assignmentCount); expect(page.rows[0].targetSources?.effectiveTargetIds).toBeDefined();
    expect(JSON.stringify(target.children)).not.toMatch(/assignmentIds|taskIds|provenance|bindingId/);
    expect(f.service.getDashboard(f.project.publicId, { targetIds: [f.targets[0].id], memberEquipmentIds: [f.equipment[1].publicId] })!.summary.assignmentCount).toBe(0);
    expect(f.service.getDashboard(f.project.publicId, { memberEquipmentIds: [f.equipment[0].publicId], equipmentTypeCodes: ["amr"] })!.summary.assignmentCount).toBe(2);
    expect(f.service.getDashboard(f.project.publicId, { targetIds: [f.targets[0].id], memberSystemIds: [f.systems[1].publicId] })!.summary.assignmentCount).toBe(0);
    expect(f.service.getDashboard(f.project.publicId, { memberSystemIds: [f.systems[2].publicId] })!.summary.assignmentCount).toBe(2);
    // A valid type used by a different member must not satisfy AMR-A's identity.
    f.logistics.insertEquipment({ publicId: randomUUID(), projectId: f.project.id, processId: f.process.id, code: "OTHER", name: "OTHER", equipmentType: "conveyor", managementUnit: "unit", quantity: 1, now: RESOURCE_DASHBOARD_NOW });
    expect(f.service.getDashboard(f.project.publicId, { memberEquipmentIds: [f.equipment[0].publicId], equipmentTypeCodes: ["conveyor"] })!.summary.assignmentCount).toBe(0);
    expect(f.service.getDashboard(f.project.publicId, { directSystemIds: [f.systems[2].publicId] })!.summary.assignmentCount).toBe(1);
    expect(target.metadata.limits).toEqual(RESOURCE_TARGET_LIMITS);
  });
  it("reproduces the #619 golden A5/B5/distinct5 M-D oracle through SQLite report and exact detail", () => {
    const f = fixture(), task = f.tasks.get("T1")!, resource = f.resources.get("R1")!;
    f.database.prepare("DELETE FROM work_calendar_dates WHERE calendar_rule_id IN (SELECT id FROM work_calendar_rules WHERE project_id=?)").run(f.project.id);
    f.database.prepare("UPDATE tasks SET duration=5 WHERE id=?").run(task.id);
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: [{ publicId: resource.publicId, internalId: resource.id, kind: "resource", assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 100 }] });
    const filters: ResourceDashboardFilterInput = { taskIds: [task.publicId], projectionOrder: ["target"] }, report = f.service.getDashboard(f.project.publicId, filters)!;
    expect(report.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { plannedMd: 5, state: "configured" } });
    const nodes = report.targetProjection!.children.filter(node => node.id !== null); expect(nodes).toHaveLength(2);
    for (const node of nodes) {
      expect(node.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { plannedMd: 5 } });
      const page = f.service.getDetails(f.project.publicId, filters, { ...detail(report.snapshotId), selector: node.summary.selector })!;
      expect(page.totalCount).toBe(1); expect(page.rows.reduce((sum, row) => sum + row.assignment!.plannedMd!, 0)).toBe(5);
    }
    expect(nodes.reduce((sum, node) => sum + node.summary.effort.plannedMd!, 0)).toBe(10);
    expect(report.summary.effort.plannedMd).toBe(5);
  });
  it("maps Process Type, occurrence, optional WorkArea and null axes through explicit project mapping", () => {
    const f = fixture();
    for (const filter of [{ processTypeIds: [f.processTypeId] }, { processOccurrenceIds: [f.occurrenceId] }, { projectProcessIds: [f.process.publicId] }]) {
      const report = f.service.getDashboard(f.project.publicId, filter)!;
      expect(report.summary.assignmentCount).toBe(4); expect(report.diagnostics.denominator).toBe(4);
    }
    expect(f.service.getDashboard(f.project.publicId, { workAreaIds: [f.areaId] })!.summary.assignmentCount).toBe(4);
    expect(f.service.getDashboard(f.project.publicId, { workAreaIds: ["unassigned"] })!.summary.assignmentCount).toBe(2);
    const unlinked = f.service.getDashboard(f.project.publicId, { targetIds: ["unassigned"] })!;
    expect(unlinked.summary.assignmentCount).toBe(1); expect(unlinked.targetProjection!.diagnostics.legacyOnlyTaskCount).toBe(1);
    const byType = f.service.getDashboard(f.project.publicId, { projectionOrder: ["processType", "target"] })!;
    expect(byType.targetProjection!.children.find(row => row.id === f.processTypeId)!.name).toBe("Assembly");
    expect(() => f.service.getDashboard(f.project.publicId, { processTypeIds: [randomUUID()] })).toThrowError(expect.objectContaining({ status: 400, code: "INVALID_SELECTION" }));
    const foreign = fixture();
    expect(() => f.service.getDashboard(f.project.publicId, { processTypeIds: [foreign.processTypeId] })).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it("keeps T0 unassigned/group-only diagnostics and exact Assignment source intersection including full reference", () => {
    const f = fixture(), filters: ResourceDashboardFilterInput = { targetIds: [f.targets[0].id], resourceIds: [f.resources.get("R1")!.publicId] };
    const report = f.service.getDashboard(f.project.publicId, filters)!;
    expect(report.diagnostics.denominator).toBe(3); expect(report.diagnostics.completelyUnassigned.count).toBe(1);
    expect(report.diagnostics.unsetAssignmentCount).toBe(2); expect(report.summary.assignmentCount).toBe(2);
    const scope = { kind: "exactAssignments" as const, assignmentIds: [f.assignmentIds.get("A1")!] };
    const exact = f.service.getDashboard(f.project.publicId, { targetIds: [f.targets[0].id] }, scope)!;
    expect(exact.summary).toMatchObject({ taskCount: 1, assignmentCount: 1, effort: { plannedMd: 2 } });
    expect(exact.diagnostics.denominator).toBe(1);
    expect(exact.targetProjection!.projectReference.assignmentCount).toBe(5);
    expect(f.service.getDetails(f.project.publicId, { targetIds: [f.targets[0].id] }, { ...detail(exact.snapshotId), selector: exact.targetProjection!.projectReference.selector }, scope)!.totalCount).toBe(5);
    const empty = f.service.getDashboard(f.project.publicId, { targetIds: [f.targets[1].id], memberSystemIds: [f.systems[0].publicId] }, scope)!;
    expect(empty.summary.assignmentCount).toBe(0); expect(empty.diagnostics.denominator).toBe(0);
    const reordered = f.service.getDashboard(f.project.publicId, { projectionOrder: ["resource", "target"] })!;
    const normal = f.service.getDashboard(f.project.publicId, { projectionOrder: ["target", "resource"] })!;
    expect(reordered.snapshotId).toBe(normal.snapshotId); expect(reordered.summary).toEqual(normal.summary);
  });
  it("strictly rejects malformed/new unknown/crossproject selection even if exact source is empty; preserves HTTP read security", async () => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    for (const params of ["targetIds=unlinked", "targetIds=unassigned&memberSystemIds=" + f.systems[2].publicId, "projectionOrder=target,target", "projectionOrder=nope", "targetScopes=nope", "equipmentTypeCodes=" + "x".repeat(65)]) expect(() => parseResourceDashboardQuery(new URLSearchParams(params))).toThrowError(expect.objectContaining({ status: 400 }));
    for (const key of ["targetIds", "projectProcessIds", "processOccurrenceIds", "processTypeIds", "workAreaIds", "memberEquipmentIds", "memberSystemIds", "directEquipmentIds", "directSystemIds", "equipmentTypeCodes", "systemTypeCodes"]) {
      const filter = { [key]: [key.endsWith("Codes") ? "UNKNOWN" : randomUUID()] };
      expect(() => f.service.query(f.project.publicId, { sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [] }, filters: filter, projection: { kind: "details", ...detail(report.snapshotId) } })).toThrowError(expect.objectContaining({ status: 400, code: "INVALID_SELECTION" }));
    }
    for (const assignmentScope of ["milestoneReference", "milestoneExcluded", "projectReference"]) expect(() => parseResourceDashboardDetails(new URLSearchParams({ snapshotId: report.snapshotId, dimension: "targetProjection", targetPath: JSON.stringify([{ dimension: "target", id: f.targets[0].id }]), assignmentScope }))).toThrowError(expect.objectContaining({ status: 400 }));
    const before = f.state();
    const response = await handleGetResourceDashboard(f.request("projectionOrder=target"), f.project.publicId, { service: f.service });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(f.state()).toEqual(before);
    const foreign = fixture();
    expect(() => f.service.getDashboard(f.project.publicId, { targetIds: [foreign.targets[0].id] })).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it.each([
    ["logistics_targets", "name", "Changed Target", "public_id", "target"],
    ["project_equipment", "active", 0, "public_id", "equipment"],
    ["process_types", "name", "Changed Type", "public_id", "processType"],
    ["site_product_processes", "active", 0, "public_id", "occurrence"],
    ["work_areas", "name", "Changed WorkArea", "public_id", "area"],
    ["logistics_equipment_types", "name", "Changed AMR", "code", "amr"],
    ["project_process_occurrence_mappings", "work_area_id", 1, "project_id", "project"],
  ] as const)("fingerprints raw %s.%s changes without relying on revision increments", (table, field, value, column, entity) => {
    const f = fixture(), filters = { targetIds: [f.targets[0].id] }, report = f.service.getDashboard(f.project.publicId, filters)!;
    const ids = { target: f.targets[0].id, equipment: f.equipment[0].publicId, processType: f.processTypeId, occurrence: f.occurrenceId, area: f.areaId, amr: "amr", project: f.project.id };
    const revised = column === "project_id" ? (f.database.prepare("SELECT id FROM work_areas WHERE public_id=?").get(f.areaId) as { id: number }).id : value;
    f.database.prepare(`UPDATE ${table} SET ${field}=? WHERE ${column}=?`).run(revised, ids[entity]);
    expect(f.service.getDashboard(f.project.publicId, filters)!.snapshotId).not.toBe(report.snapshotId);
    expect(() => f.service.getDetails(f.project.publicId, filters, detail(report.snapshotId))).toThrowError(expect.objectContaining({ status: 409, code: "REPORT_STALE" }));
    expect(() => f.service.query(f.project.publicId, { sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [] }, filters: { targetIds: [randomUUID()] }, projection: { kind: "report" } })).toThrowError(expect.objectContaining({ status: 409 }));
  });
  it("reads graph and master names from one WAL transaction and reproduces fingerprint after persisted reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "resource-target-")); dirs.push(dir);
    const filename = join(dir, "data.sqlite3"), f = fixture(filename), filter: ResourceDashboardFilterInput = { projectionOrder: ["processType", "target"] }, baseline = f.service.getDashboard(f.project.publicId, filter)!;
    const other = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
    try {
      const clock = vi.fn(() => { other.prepare("UPDATE process_types SET name='Concurrent Type' WHERE public_id=?").run(f.processTypeId); return new Date(RESOURCE_DASHBOARD_NOW); });
      const snapshot = new ResourceDashboardService(f.database, { clock, mdPerMmEnvironment: "21" }).getDashboard(f.project.publicId, filter)!;
      expect(snapshot.snapshotId).toBe(baseline.snapshotId); expect(snapshot.targetProjection).toEqual(baseline.targetProjection);
    } finally { other.close(); }
    const current = f.service.getDashboard(f.project.publicId, filter)!; expect(current.snapshotId).not.toBe(baseline.snapshotId); f.database.close();
    const reopened = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
    try { expect(new ResourceDashboardService(reopened, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" }).getDashboard(f.project.publicId, filter)).toEqual(current); } finally { reopened.close(); }
  });
  it("keeps exact JSON byte boundary, raw graph bounds before load and page provenance before DTO allocation", () => {
    const f = fixture();
    const exact = { text: "x".repeat(RESOURCE_DASHBOARD_LIMITS.reportBytes - Buffer.byteLength(JSON.stringify({ text: "" }))) };
    expect(() => assertResourcePlanResponseBytes(exact)).not.toThrow(); expect(() => assertResourcePlanResponseBytes({ text: exact.text + "x" })).toThrowError(expect.objectContaining({ status: 422 }));
    const filters: ResourceDashboardFilterInput = { projectionOrder: ["target"] }, report = f.service.getDashboard(f.project.publicId, filters)!;
    // A legal raw graph can still exceed repeated page provenance after Assignment fan-out.
    const task = f.tasks.get("T1")!;
    const addSystems = new LogisticsRepository(f.database);
    f.database.transaction(() => {
      for (let i = 0; i < 52; i++) {
        const system = addSystems.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: `MORE${i}`, name: `MORE${i}`, systemType: "mcs", layer: "coordinator", scope: "project", now: RESOURCE_DASHBOARD_NOW });
        f.database.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,system_id,created_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), f.project.id, f.targets[0].internalId, "system", system.id, RESOURCE_DASHBOARD_NOW);
      }
      const people = Array.from({ length: 60 }, (_, i) => f.catalog.insertResource({ publicId: randomUUID(), name: `Person${i}`, code: null, description: "", now: RESOURCE_DASHBOARD_NOW }));
      f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: people.map(resource => ({ publicId: resource.publicId, internalId: resource.id, kind: "resource" as const, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 100 })) });
    })();
    const fresh = f.service.getDashboard(f.project.publicId, filters)!; expect(fresh.snapshotId).not.toBe(report.snapshotId);
    expect(() => f.service.getDetails(f.project.publicId, filters, detail(fresh.snapshotId))).toThrowError(expect.objectContaining({ status: 422, details: [expect.objectContaining({ path: "projection.detailTargetSources" })] }));
  });
  it("checks raw graph counts before loading graph rows and maps each pure fan-out limit to HTTP422", () => {
    const f = fixture(), original = f.database.prepare.bind(f.database);
    const spy = vi.spyOn(f.database, "prepare").mockImplementation((sql: string) => {
      if (sql === "SELECT COUNT(*) count FROM logistics_targets WHERE project_id=?") return { get: () => ({ count: RESOURCE_TARGET_LIMITS.snapshotRows + 1 }) } as unknown as ReturnType<typeof original>;
      return original(sql);
    });
    expect(() => f.service.getDashboard(f.project.publicId)).toThrowError(expect.objectContaining({ status: 422, details: [expect.objectContaining({ path: "snapshot.targetRows" })] }));
    expect(spy.mock.calls.some(([sql]) => sql.startsWith("SELECT t.public_id id,t.code,t.name,t.active,t.scope"))).toBe(false);
    spy.mockRestore();
    for (const dimension of ["inputRows", "lineageEdges", "provenancePaths", "projectionCells"] as const) {
      const domain = vi.spyOn(targetDomain, "prepareResourceKpiTargets").mockImplementation(() => { throw new targetDomain.ResourceKpiTargetLimitError(dimension, 50001, 50000); });
      expect(() => f.service.getDashboard(f.project.publicId, { projectionOrder: ["target"] })).toThrowError(expect.objectContaining({ status: 422, details: [expect.objectContaining({ path: `projection.target.${dimension}` })] }));
      domain.mockRestore();
    }
  });
  it("fingerprints membership and bindings and rejects stale legacy Excel without adding Target Excel support", () => {
    const f = fixture(), report = f.service.getDashboard(f.project.publicId)!;
    const options = { basis: "current" as const, expectedReport: { context: report.resourceScopeContext!, snapshotId: report.snapshotId, filters: {} }, granularities: ["month" as const] };
    expect(f.service.getExcelReport(f.project.publicId, options)).toBeDefined();
    for (const binding of [undefined, { sourceContext: report.resourceScopeContext!, scope: { kind: "exactAssignments", assignmentIds: [f.assignmentIds.get("A1")!] } }]) {
      for (const filters of [{ targetIds: [f.targets[0].id] }, { projectionOrder: ["target"] }]) expect(() => parseResourceExcelOptions({ ...options, ...(binding ? { binding } : {}), expectedReport: { ...options.expectedReport, filters } })).toThrow("unsupported");
    }
    const extra = f.logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: "NEW", name: "NEW", systemType: "mcs", layer: "coordinator", scope: "project", now: RESOURCE_DASHBOARD_NOW });
    f.database.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,system_id,created_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), f.project.id, f.targets[0].internalId, "system", extra.id, RESOURCE_DASHBOARD_NOW);
    expect(() => f.service.getExcelReport(f.project.publicId, options)).toThrowError(expect.objectContaining({ status: 409, code: "REPORT_STALE" }));
    const afterMember = f.service.getDashboard(f.project.publicId)!;
    f.database.transaction(() => new TaskTargetBindingRepository(f.database).replace(f.project.id, f.tasks.get("T1")!.id, [{ id: randomUUID(), taskId: f.tasks.get("T1")!.publicId, targetId: f.targets[0].id, selection: "whole", scope: "self", memberIds: [] }], RESOURCE_DASHBOARD_NOW))();
    expect(f.service.getDashboard(f.project.publicId)!.snapshotId).not.toBe(afterMember.snapshotId);
    expect(() => f.service.getDetails(f.project.publicId, {}, detail(afterMember.snapshotId))).toThrowError(expect.objectContaining({ status: 409 }));
  });
  it("records bounded bulk-query plans/time/bytes for a representative multi-Target SQLite graph", () => {
    const f = fixture(), assignments = new TaskTargetBindingRepository(f.database);
    f.database.transaction(() => {
      for (let i = 0; i < 120; i++) {
        const task = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: `BENCH${i}`, name: `Bench ${i}`, type: "task", parentId: null, sortOrder: 100 + i, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-09", duration: 4, progress: 0, createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
        f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: task.id, now: RESOURCE_DASHBOARD_NOW, targets: [...f.resources.values()].map(resource => ({ publicId: resource.publicId, internalId: resource.id, kind: "resource" as const, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 50 })) });
        assignments.replace(f.project.id, task.id, f.targets.map(target => ({ id: randomUUID(), taskId: task.publicId, targetId: target.id, scope: "self", selection: "whole", memberIds: [] })), RESOURCE_DASHBOARD_NOW);
      }
    })();
    const sql = vi.spyOn(f.database, "prepare"), started = performance.now(), result = f.service.getDashboard(f.project.publicId, { projectionOrder: ["target", "resource"] })!, elapsedMs = performance.now() - started;
    const queryCount = sql.mock.calls.length; sql.mockRestore();
    const plans = ["SELECT * FROM logistics_targets WHERE project_id=?", "SELECT * FROM task_target_bindings WHERE project_id=?", "SELECT * FROM logistics_target_members WHERE project_id=?"].map(statement => f.database.prepare(`EXPLAIN QUERY PLAN ${statement}`).all(f.project.id));
    const evidence = { tasks: f.schedules.listTasks(f.project.id).length, assignments: result.summary.assignmentCount, targets: 2, members: 6, bindings: (f.database.prepare("SELECT COUNT(*) n FROM task_target_bindings WHERE project_id=?").get(f.project.id) as { n: number }).n, queryCount, elapsedMs: Number(elapsedMs.toFixed(2)), responseBytes: Buffer.byteLength(JSON.stringify({ data: result })), plans };
    if (process.env.RESOURCE_TARGET_BENCHMARK_OUTPUT) writeFileSync(process.env.RESOURCE_TARGET_BENCHMARK_OUTPUT, JSON.stringify(evidence, null, 2));
    expect(evidence.assignments).toBe(245); expect(queryCount).toBeLessThan(85); expect(elapsedMs).toBeLessThan(3000); expect(evidence.responseBytes).toBeLessThan(RESOURCE_DASHBOARD_LIMITS.reportBytes);
    expect(JSON.stringify(plans)).toMatch(/USING.*INDEX/); expect(JSON.stringify(plans)).not.toMatch(/SCAN (logistics_targets|task_target_bindings|logistics_target_members)/);
  });
});
