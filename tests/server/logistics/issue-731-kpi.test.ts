import { fromResourcePublicV2 } from "../../../src/contracts/resource-public-v2";
import { integratedKpiValid } from "../../../src/features/logistics/logistics-kpi-validation";
import { TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { createServer } from "node:http";
import { readLogisticsKpiSnapshot } from "../../../src/server/logistics/logistics-kpi-snapshot-core";
import { calculateLogisticsIntegratedKpi } from "../../../src/server/logistics/logistics-kpi-service-core";
import { WorkCalendarRepository } from "../../../src/server/repositories/work-calendar-repository-core";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { LogisticsDashboardService } from "../../../src/server/logistics/logistics-dashboard-service";
import { LogisticsKpiService } from "../../../src/server/logistics/logistics-kpi-service-core";
import { handleGetLogisticsKpi } from "../../../src/server/logistics/logistics-kpi-handlers-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";
import type { LogisticsDashboardDto } from "../../../src/contracts/logistics-dashboard";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
function fixture(mode: "direct" | "target" | "mixed" = "mixed") {
  const f = wbsDashboardViewsFixture(mode);
  cleanups.push(() => f.database.close());
  const options = { clock: () => new Date(now), mdPerMmEnvironment: "20" };
  const service = new LogisticsKpiService(f.database, options);
  const report = (filter = {}) => service.getDashboard(f.project.publicId, { asOfDate: "2026-10-12", ...filter })!;
  const request = (query = "source=integrated", publicId = f.project.publicId) => handleGetLogisticsKpi(new Request(`https://example.test/api/projects/${publicId}/logistics/kpi?${query}`), publicId, {
    dashboardService: service, logisticsService: new LogisticsService(f.database), projectService: { authorize() { throw new Error("Read must not authorize or issue a session"); } },
    applicationBaseUrl: "https://example.test", environment: "production", requestId: () => "issue-731",
  });
  return { ...f, service, report, request, legacy: new LogisticsDashboardService(f.database, options) };
}
const ids = (f: ReturnType<typeof fixture>, names: string[]) => names.map(name => f.tasks.get(name)!.publicId).sort();

describe("#731 explicit integrated logistics KPI consumer", () => {
  it.each(["direct", "target", "mixed"] as const)("%s preserves the14 M/D raw union, W2 process populations and full Gate", mode => {
    const f = fixture(mode), before = f.state(), data = f.report(), integrated = data.integrated!;
    expect(data.kpi.taskCount).toBe(6);
    expect(data.effort.plannedMd).toBe(14);
    expect(integrated.assignmentIds).toHaveLength(4);
    expect(integrated.configuration.equipmentQuantity).toBe(22);
    expect(integrated.configuration.systemIds).toHaveLength(4);
    expect(integrated.configuration.registeredResourceIds).toHaveLength(2);
    expect(integrated.configuration.assignedResourceIds).toHaveLength(1);
    const processA = data.breakdowns.processes.find(row => row.id === f.processA.publicId)!;
    const processB = data.breakdowns.processes.find(row => row.id === f.processB.publicId)!;
    expect(processA.taskIds.sort()).toEqual(ids(f, ["T1", "T3"])); expect(processA.plannedMd).toBe(8);
    expect(processB.taskIds.sort()).toEqual(ids(f, ["T2", "T3"])); expect(processB.plannedMd).toBe(9);
    expect(processA.plannedMd + processB.plannedMd).toBe(17); // A parent cannot add overlapping children.
    expect(data.milestoneStages?.rows[0].stageGate.memberCount).toBe(3);
    const selected = f.report({ processIds: [f.processA.publicId] });
    expect(selected.includedTaskIds.sort()).toEqual(ids(f, ["T1", "T3"]));
    expect(selected.effort.plannedMd).toBe(8);
    expect(selected.milestoneStages?.rows[0].stageGate.memberCount).toBe(3);
    expect(f.state()).toEqual(before);
  });

  it("Target0 direct-only keeps historical headline/filter/effort/quality behavior", () => {
    const f = fixture("direct");
    for (const filter of [{}, { activeOnly: true }, { systemIds: [f.systems[2].publicId] }, { equipmentIds: [f.equipment[0].publicId], horizonDays: 1 }, { systemView: "coordination" as const }]) {
      const input = { asOfDate: "2026-10-12", ...filter };
      const old = f.legacy.getDashboard(f.project.publicId, input)!, current = f.service.getDashboard(f.project.publicId, input)!;
      for (const key of ["kpi", "effort", "quality", "includedTaskIds", "includedMilestoneIds", "milestoneStages"] as const) expect(current[key]).toEqual(old[key]);
      expect(current.breakdowns.equipment).toEqual(old.breakdowns.equipment);
      expect(current.breakdowns.systems).toEqual(old.breakdowns.systems);
    }
  });

  it("Target-only/mixed equipment filters and shared MCS never multiply Task/Assignment totals", () => {
    for (const mode of ["target", "mixed"] as const) {
      const f = fixture(mode);
      const data = f.report({ equipmentIds: [f.equipment[0].publicId] });
      expect(data.includedTaskIds.sort()).toEqual(ids(f, ["T0", "T1", "T3"]));
      expect(data.effort.plannedMd).toBe(10);
      expect(data.integrated!.assignmentIds).toHaveLength(3);
      const shared = f.report({ systemIds: [f.systems[2].publicId] });
      expect(shared.effort.plannedMd).toBe(14); expect(shared.kpi.taskCount).toBe(4);
      const workAreas = shared.integrated!.configuration.workAreas;
      expect(workAreas).toHaveLength(2);
      expect(workAreas.map(row => row.equipmentQuantity)).toEqual([10, 10]);
      expect(shared.integrated!.configuration.equipmentQuantity).toBe(22);
    }
  });

  it.each(["direct", "target", "mixed"] as const)(
    "%s WorkArea configuration drill stays canonical when KPI Task/Assignment filters change", mode => {
      const f = fixture(mode);
      const baseline = f.report().integrated!.configuration.workAreas;
      const taskId = f.tasks.get("T3")!.publicId, assignmentId = f.assignmentIds.get("A3")!;
      expect(baseline).toHaveLength(2);
      for (const area of baseline) {
        expect(area.taskIds).toContain(taskId);
        expect(area.assignmentIds).toContain(assignmentId);
      }
      for (const filter of [
        { processIds: [f.processA.publicId] },
        { equipmentIds: [f.idleEquipment.publicId] },
        { systemIds: [f.idleSystem.publicId] },
        { taskAssigneeResourceIds: [f.resources.get("R2")!.publicId] },
        { roleResourceIds: [f.resources.get("R2")!.publicId] },
      ]) {
        const filtered = f.report(filter);
        expect(filtered.integrated!.configuration.workAreas).toEqual(baseline);
      }
      const excluded = f.report({ systemIds: [f.idleSystem.publicId] });
      expect(excluded.includedTaskIds).not.toContain(taskId);
      expect(excluded.integrated!.assignmentIds).not.toContain(assignmentId);
      expect(excluded.integrated!.configuration.workAreas[0].taskIds).toContain(taskId);
      expect(excluded.integrated!.configuration.workAreas[0].assignmentIds).toContain(assignmentId);
    },
  );

  it("preserves inherited Target provenance and explicit0/legacy-null process diagnostics", () => {
    const f = fixture("target"), summary = f.tasks.get("S")!, task = f.tasks.get("T0")!;
    const bindings = new TaskTargetBindingRepository(f.database);
    bindings.replace(f.project.id, task.id, [], now);
    bindings.replace(f.project.id, summary.id, f.targets.map(target => ({ id: randomUUID(), taskId: summary.publicId, targetId: target.id, scope: "subtree", selection: "whole", memberIds: [] })), now);
    f.database.prepare("DELETE FROM task_process_contexts WHERE task_id=?").run(f.tasks.get("UNASSIGNED")!.id);
    const result = f.report(), source = result.integrated!.taskSources.find(row => row.taskId === task.publicId)!;
    expect(source.sources.some(row => row.sourceKind === "target-binding" && row.inherited && row.sourceTaskId === summary.publicId)).toBe(true);
    expect(source.processIds).toEqual([]);
    expect(source.sources.some(row => row.sourceKind === "ancestor-task-context" && row.effective === false)).toBe(true);
    expect(result.integrated!.diagnostics.legacyContextTaskIds).toContain(f.tasks.get("UNASSIGNED")!.publicId);
    expect(result.integrated!.diagnostics.explicitEmptyProcessTaskIds).toContain(task.publicId);
    expect(result.integrated!.diagnostics.legacyContextTaskIds).not.toContain(task.publicId);
  });

  it("configuration remains visible without normal Tasks and empty progress is null", () => {
    const f = fixture();
    f.database.prepare("DELETE FROM tasks WHERE project_id=?").run(f.project.id);
    const data = f.report();
    expect(data.kpi).toMatchObject({ taskCount: 0, progressPercent: null, totalDuration: 0 });
    expect(data.effort.plannedMd).toBe(0);
    expect(data.integrated!.effortState).toBe("empty");
    expect(data.integrated!.configuration).toMatchObject({ equipmentQuantity: 22 });
    expect(data.integrated!.configuration.processIds).toHaveLength(2);
    expect(data.integrated!.configuration.workAreaIds).toHaveLength(2);
    expect(data.integrated!.configuration.registeredResourceIds).toHaveLength(2);
    expect(data.integrated!.configuration.targets).toHaveLength(2);
    expect(data.integrated!.diagnostics.equipmentWithoutTaskIds).toHaveLength(3);
    expect(data.integrated!.diagnostics.targetWithoutTaskIds).toHaveLength(2);
  });

  it("exact diagnostics distinguish group-only, unassigned and unset personal allocation", () => {
    const f = fixture();
    f.database.prepare("UPDATE task_assignments SET allocation_percent=NULL WHERE public_id=?").run(f.assignmentIds.get("A2"));
    const data = f.report(), diagnostic = data.integrated!.diagnostics;
    expect(diagnostic.completelyUnassignedTaskIds).toEqual(ids(f, ["UNASSIGNED"]));
    expect(diagnostic.personallyUnassignedTaskIds.sort()).toEqual(ids(f, ["UNASSIGNED", "GROUP_ONLY"]));
    expect(diagnostic.groupOnlyTaskIds).toEqual(ids(f, ["GROUP_ONLY"]));
    expect(diagnostic.unsetAllocationTaskIds).toEqual(ids(f, ["T2"]));
    expect(diagnostic.unsetAllocationAssignmentIds).toEqual([f.assignmentIds.get("A2")]);
    expect(data.effort).toMatchObject({ plannedMd: 10, unsetAllocationCount: 1 });
    expect(data.integrated!.effortState).toBe("partial");
    expect(diagnostic.equipmentWithoutOwnerIds).toHaveLength(data.quality.equipmentWithoutOwnerCount);
    expect(diagnostic.equipmentWithoutPrimaryControllerIds).toHaveLength(data.quality.equipmentWithoutPrimaryControllerCount);
    expect(diagnostic.systemsWithoutPrimaryPIIds).toHaveLength(data.quality.systemsWithoutPrimaryPICount);
    expect(diagnostic.equipmentWithoutTaskIds).toContain(f.idleEquipment.publicId);
    expect(diagnostic.systemsWithoutTaskIds).toContain(f.idleSystem.publicId);
    expect(data.integrated!.assignmentRows).toHaveLength(5);
  });

  it("production read handler requires opt-in, validates source and foreign IDs, and returns no-store immutable snapshot", async () => {
    const f = fixture(), before = f.state();
    const response = await f.request("source=integrated&asOfDate=2026-10-12"), data = (await response.json()).data as LogisticsDashboardDto;
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff"); expect(response.headers.get("set-cookie")).toBeNull();
    expect(data.integrated!.snapshotId).toMatch(/^[a-f0-9]{64}$/);
    const good = await f.request(`source=integrated&asOfDate=2026-10-12&snapshotId=${data.integrated!.snapshotId}`); expect(good.status).toBe(200);
    for (const query of ["", "source=direct", "source=integrated&source=integrated", "source=integrated&activeOnly=invalid", "source=integrated&systemView=invalid", "source=integrated&equipmentIds=", "source=integrated&processIds=,", "source=integrated&asOfDate=", `source=integrated&equipmentIds=${randomUUID()}`]) expect((await f.request(query)).status).toBe(400);
    expect((await f.request("source=integrated", randomUUID())).status).toBe(404);
    const one = (await (await f.request(`source=integrated&equipmentIds=${f.equipment[0].publicId}`)).json()).data;
    const duplicate = (await (await f.request(`source=integrated&equipmentIds=${f.equipment[0].publicId}&equipmentIds=${f.equipment[0].publicId}`)).json()).data;
    expect(duplicate.integrated.snapshotId).toBe(one.integrated.snapshotId);
    expect(duplicate.includedTaskIds).toEqual(one.includedTaskIds);
    expect(f.state()).toEqual(before);
    f.database.prepare("UPDATE project_equipment SET quantity=quantity+1 WHERE id=?").run(f.equipment[0].id);
    const stale = await f.request(`source=integrated&asOfDate=2026-10-12&snapshotId=${data.integrated!.snapshotId}`);
    expect(stale.status).toBe(409); expect((await stale.json()).error.code).toBe("STALE_KPI_SOURCE");
  });
  it("coordination opt-in includes controlled Equipment without inventing a direct System Task link", () => {
    const f = fixture("direct");
    f.logistics.replaceTaskSystemLinks(f.project.id, f.tasks.get("T1")!.id, [], now);
    f.logistics.setEquipmentSystems(f.project.id, f.equipment[0].id, [{ systemId: f.systems[0].id, controlRole: "primary" }], now);
    f.logistics.setCoordinatedSystems(f.project.id, f.systems[2].id, [f.systems[0].id, f.systems[1].id], now);
    const direct = f.report({ systemIds: [f.systems[2].publicId] });
    expect(direct.includedTaskIds).not.toContain(f.tasks.get("T1")!.publicId);
    const coordination = f.report({ systemIds: [f.systems[2].publicId], systemView: "coordination" });
    expect(coordination.includedTaskIds).toContain(f.tasks.get("T1")!.publicId);
    expect(coordination.effort.plannedMd).toBe(14);
    expect(coordination.integrated!.taskSources.find(row => row.taskId === f.tasks.get("T1")!.publicId)!.systemIds).toEqual([]);
    f.database.prepare("UPDATE project_equipment SET active=0 WHERE id=?").run(f.equipment[0].id);
    const active = f.report({ activeOnly: true });
    expect(active.integrated!.configuration.equipmentQuantity).toBe(12);
    expect(active.integrated!.configuration.equipmentIds).not.toContain(f.equipment[0].publicId);
    expect(active.includedTaskIds).not.toContain(f.tasks.get("T1")!.publicId);
    expect(f.report().includedTaskIds).toContain(f.tasks.get("T1")!.publicId);
  });

  it("response overflow fails wholly and multi-year schedules retain legacy date semantics", () => {
    const f = fixture(), before = f.state();
    const snapshot = readLogisticsKpiSnapshot(f.database, f.project.publicId, { asOfDate: "2026-10-12" }, new Date(now), "20")!;
    snapshot.input.resources[0].name = "x".repeat(2 * 1024 * 1024);
    expect(() => calculateLogisticsIntegratedKpi(snapshot.input, snapshot.ledger, snapshot.raw.context.dataSnapshotId)).toThrow(expect.objectContaining({ status: 422, code: "REPORT_LIMIT_EXCEEDED" }));
    expect(f.state()).toEqual(before);
    f.database.prepare("UPDATE tasks SET start_date='2024-01-01',end_date='2026-10-09',duration=700 WHERE public_id=?").run(f.tasks.get("T1")!.publicId);
    expect(f.report().effort).toEqual(f.legacy.getDashboard(f.project.publicId, { asOfDate: "2026-10-12" })!.effort);
  });

  it("actual HTTP uses the production handler with migrated SQLite and no write/session", async () => {
    const f = fixture(), before = f.state();
    const server = createServer(async (incoming, outgoing) => {
      const response = await f.request(new URL(incoming.url!, "http://localhost").searchParams.toString());
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const port = (server.address() as { port: number }).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/projects/${f.project.publicId}/logistics/kpi?source=integrated&asOfDate=2026-10-12`);
      expect(response.status).toBe(200);
      const data = (await response.json()).data;
      expect(data.effort.plannedMd).toBe(14);
      expect(data.schema).toBe("logistics-kpi/2");
      expect(data.integrated.source).toBe("physical-connections:v2");
      const decoded=fromResourcePublicV2({data}) as {data:LogisticsDashboardDto};
      expect(integratedKpiValid(decoded.data.integrated)).toBe(true);
      expect(decoded.data.integrated!.snapshotId).toBe(data.integrated.snapshotId);
      expect(decoded.data.integrated!.source).toBe("physical-connections:v2");
      const serialized=JSON.stringify(data);
      expect(serialized).not.toMatch(/"(?:targetIds|targets|targetWithoutTaskIds)"/);
      for(const row of f.targets)expect(serialized).not.toContain(row.id);
      expect(data.integrated.assignmentRows.every((row:{targetKind:string;targetId:string;targetName:string})=>["resource","group"].includes(row.targetKind)&&typeof row.targetId === "string"&&typeof row.targetName === "string")).toBe(true);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(f.state()).toEqual(before);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });

  it("common effort states distinguish all-unset, configured0, partial and empty", () => {
    const f = fixture();
    f.database.prepare("UPDATE task_assignments SET allocation_percent=NULL WHERE project_id=? AND resource_id IS NOT NULL").run(f.project.id);
    expect(f.report().integrated!.effortState).toBe("unset");
    expect(f.report().effort).toMatchObject({ plannedMd: 0, unsetAllocationCount: 4 });
    f.database.prepare("UPDATE task_assignments SET allocation_percent=100 WHERE project_id=? AND resource_id IS NOT NULL").run(f.project.id);
    const calendars = new WorkCalendarRepository(f.database);
    const rule = calendars.insertRule({ publicId: randomUUID(), projectId: f.project.id, kind: "CUSTOM", name: "휴무", countryCode: null,
      targetType: "PROJECT", targetPublicId: null, scope: "FULL_PROJECT", effectiveFrom: null, effectiveTo: null, sourceVersion: null, now });
    for (const day of ["05", "06", "07", "08", "09"]) calendars.insertDate({ calendarRuleId: rule.id, date: `2026-10-${day}`, dayType: "NON_WORKING", name: null, sourceKey: null, sourceVersion: null, now });
    expect(f.report().integrated!.effortState).toBe("configured");
    expect(f.report().effort).toMatchObject({ plannedMd: 0, unsetAllocationCount: 0 });
    f.database.prepare("DELETE FROM task_assignments WHERE project_id=? AND resource_id IS NOT NULL").run(f.project.id);
    expect(f.report().integrated!.effortState).toBe("empty");
  });

  it("equivalent direct process populations preserve legacy fractional rounding and resource calendars", () => {
    const f = fixture("direct");
    for (const task of f.tasks.values()) f.logistics.replaceTaskSystemLinks(f.project.id, task.id, [], now);
    f.database.prepare("UPDATE project_equipment SET process_id=? WHERE id=?").run(f.processB.id, f.equipment[1].id);
    f.logistics.replaceTaskEquipmentLinks(f.project.id, f.tasks.get("T3")!.id, f.equipment.map(row => ({ equipmentId: row.id, scope: "self" })), now);
    f.database.prepare("UPDATE task_assignments SET allocation_percent=33.333333 WHERE project_id=? AND resource_id IS NOT NULL").run(f.project.id);
    const original = f.legacy.getDashboard(f.project.publicId, { asOfDate: "2026-10-12" })!, current = f.report();
    for (const process of [f.processA, f.processB]) {
      const oldRow = original.breakdowns.processes.find(row => row.id === process.publicId)!;
      const newRow = current.breakdowns.processes.find(row => row.id === process.publicId)!;
      expect(newRow).toEqual(oldRow);
      expect(newRow.plannedMd).toBe(3.3333);
    }
    expect(current.effort).toEqual(original.effort);
  });

});
