import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { WbsViewNode, WbsViewQueryInput, WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";
import { handleWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-handlers-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";
import { wbsTaskLedgerFixture } from "../../fixtures/wbs-task-ledger";
import { resolveWbsTaskLedger } from "../../../src/domain/resources/wbs-task-ledger";

const fixtures: ReturnType<typeof wbsDashboardViewsFixture>[] = [];
afterEach(() => { for (const f of fixtures.splice(0)) f.database.close(); });
const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
function fixture(mode: "direct" | "target" | "mixed" = "direct") {
  const f = wbsDashboardViewsFixture(mode); fixtures.push(f);
  f.logistics.setCoordinatedSystems(f.project.id, f.systems[2].id, [f.systems[0].id, f.systems[1].id], now);
  // The same controller is reachable through two registered coordinator roots.
  f.logistics.setCoordinatedSystems(f.project.id, f.idleSystem.id, [f.systems[0].id], now);
  for (let i = 0; i < 2; i++) f.logistics.setEquipmentSystems(f.project.id, f.equipment[i].id, [{ systemId: f.systems[i].id, controlRole: "primary" }], now);
  if (mode !== "target") {
    f.logistics.replaceTaskSystemLinks(f.project.id, f.tasks.get("T1")!.id, [{ systemId: f.systems[0].id, scope: "self" }], now);
    f.logistics.replaceTaskSystemLinks(f.project.id, f.tasks.get("T2")!.id, [], now);
    f.logistics.replaceTaskSystemLinks(f.project.id, f.tasks.get("T3")!.id, [f.systems[2], f.systems[0]].map(system => ({ systemId: system.id, scope: "self" })), now);
  }
  const spec = (systemView: "direct" | "coordination", ids?: string[], levels: WbsViewQueryInput["spec"]["levels"] = []): WbsViewQueryInput["spec"] => ({ version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "system", systemView, ...(ids === undefined ? {} : { systemIds: ids }), levels });
  const report = (view: WbsViewQueryInput["spec"], extras = {}) => f.service.queryWbsView(f.project.publicId, { spec: view, filters, ...extras }) as WbsViewReportDto;
  const taskIds = (...names: string[]) => names.map(name => f.tasks.get(name)!.publicId).sort();
  return { ...f, spec, report, taskIds };
}
function child(parent: { children: WbsViewNode[] }, dimension: string, id: string | null) {
  const row = parent.children.find(row => row.selector.dimension === dimension && row.selector.id === id);
  expect(row, `${dimension}:${id}`).toBeDefined(); return row!;
}

describe("#735 System-root read-only API", () => {
  it("retains the existing domain guard against foreign coordinates and controls references", () => {
    const input = wbsTaskLedgerFixture();
    expect(() => resolveWbsTaskLedger({ ...input, systems: input.systems.map(system => system.id === "MCS" ? { ...system, coordinatedSystemIds: ["FOREIGN"] } : system) })).toThrowError(expect.objectContaining({ code: "SYSTEM_REFERENCE_UNAVAILABLE" }));
    expect(() => resolveWbsTaskLedger({ ...input, equipment: input.equipment.map((equipment, index) => index ? equipment : { ...equipment, controlSystems: [{ systemId: "FOREIGN", controlRole: "primary" }] }) })).toThrowError(expect.objectContaining({ code: "INSTANCE_REFERENCE_UNAVAILABLE" }));
  });

  it("direct and actual coordination select exact Tasks/Assignments without inferring process or duplicate effort", () => {
    const f = fixture(), mcs = f.systems[2].publicId;
    const direct = f.report(f.spec("direct", [mcs], ["process"]));
    expect(direct.taskIds.sort()).toEqual(f.taskIds("T0", "T3"));
    expect(direct.totals.assignments.effort.knownMd).toBe(7);
    expect(f.report(f.spec("direct", [f.systems[0].publicId])).totals.configurationReference).toMatchObject({ equipmentQuantity: 10, equipmentIds: [f.equipment[0].publicId] });
    const coordination = f.report(f.spec("coordination", [mcs, f.idleSystem.publicId], ["process", "workArea", "equipment", "resource"]));
    expect(coordination.taskIds.sort()).toEqual(f.taskIds("T0", "T1", "T2", "T3"));
    expect(coordination.assignmentIds).toHaveLength(4);
    expect(coordination.totals.assignments.effort.knownMd).toBe(14);
    expect(coordination.totals.configurationReference).toMatchObject({ systemCount: 4, equipmentQuantity: 15 });
    const system = child(coordination, "system", mcs);
    expect(child(system, "process", f.processA.publicId).taskIds.sort()).toEqual(f.taskIds("T1", "T3"));
    expect(child(system, "process", f.processB.publicId).taskIds.sort()).toEqual(f.taskIds("T2", "T3"));
    expect(child(system, "process", null).taskIds).toEqual(f.taskIds("T0"));
    expect(child(system, "process", f.processA.publicId).totals.assignments.effort.knownMd).toBe(8);
    expect(child(system, "process", f.processB.publicId).totals.assignments.effort.knownMd).toBe(9);
    // No Task-to-system coincidence creates controls or coordinates.
    expect(direct.configuration.equipment.flatMap(row => row.controlSystems).every(row => row.systemId !== mcs)).toBe(true);
    expect(direct.configuration.systems.find(row => row.id === f.systems[0].publicId)!.coordinatedSystemIds).toEqual([]);
  });

  it.each(["direct", "target", "mixed"] as const)("%s source preserves raw unions, full Gate and Task0 configuration", mode => {
    const f = fixture(mode), mcs = f.systems[2].publicId;
    const report = f.report(f.spec("coordination", [mcs], ["milestone", "process"]));
    expect(report.taskIds.sort()).toEqual(f.taskIds("T0", "T1", "T2", "T3"));
    expect(report.totals.assignments.effort.knownMd).toBe(14);
    const system = child(report, "system", mcs), milestone = child(system, "milestone", f.tasks.get("M")!.publicId);
    expect(child(milestone, "process", f.processA.publicId).taskIds.sort()).toEqual(f.taskIds("T1", "T3"));
    expect(report.fullMilestones).toEqual(f.report(f.spec("direct", [])).fullMilestones);
    const idle = child(f.report(f.spec("direct", [f.idleSystem.publicId])), "system", f.idleSystem.publicId);
    expect(idle.taskIds).toEqual([]); expect(idle.totals.configurationReference.systemCount).toBe(1);
    expect(idle.totals.configurationReference.equipmentQuantity).toBe(0);
    expect(f.database.prepare("SELECT COUNT(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id)).toBe(mode === "direct" ? 0 : 2);
  });

  it("empty filter selects none; legacy absent fields preserve all-task behavior and mode/ids bind snapshot", () => {
    const f = fixture(), view = f.spec("direct", [f.systems[2].publicId]);
    const legacy = { ...view }; delete legacy.systemView; delete legacy.systemIds;
    expect(f.report(legacy).taskIds).toHaveLength(6);
    const none = f.report(f.spec("coordination", []));
    expect(none.taskIds).toEqual([]); expect(none.assignmentIds).toEqual([]); expect(none.children).toEqual([]);
    expect(none.totals.configurationReference).toMatchObject({ systemCount: 0, equipmentQuantity: 0 });
    expect(f.report(view).snapshotId).not.toBe(f.report(f.spec("coordination", [f.systems[2].publicId])).snapshotId);
    expect(f.report(view).sourceContext.spec).toMatchObject({ systemView: "direct", systemIds: [f.systems[2].publicId] });
    expect(f.report(view).metadata.systemSelection).toEqual({ systemView: "direct", systemIds: [f.systems[2].publicId] });
  });

  it("bounds root selector scans even when most registered systems have no Task", () => {
    const f = fixture();
    f.database.transaction(() => {
      for (let index = 0; index < 230; index++) f.logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: `EMPTY-${index}`, name: `등록 시스템 ${index}`, systemType: "acs", layer: "controller", scope: "project", now });
    })();
    expect(() => f.report(f.spec("coordination"))).toThrowError(expect.objectContaining({ code: "REPORT_LIMIT_EXCEEDED", status: 422 }));
    // A narrow selection uses the same data without bypassing the limit.
    expect(f.report(f.spec("coordination", [f.systems[2].publicId])).taskIds).toHaveLength(4);
  });

  it("scope/details retain coordinated raw provenance and reject stale or filtered-out paths", () => {
    const f = fixture(), view = f.spec("coordination", [f.systems[2].publicId], ["process"]), report = f.report(view);
    const node = child(child(report, "system", f.systems[2].publicId), "process", f.processA.publicId);
    for (const kind of ["scope", "details"] as const) {
      const data = f.service.queryWbsView(f.project.publicId, { spec: view, filters, projection: { kind, snapshotId: report.snapshotId, path: node.path, ...(kind === "details" ? { view: "tasks" } : {}) } })!;
      if (data.projection === "scope") expect(data.taskIds.sort()).toEqual(node.taskIds.sort());
      if (data.projection === "details") {
        expect(data.rows).toHaveLength(2);
        const t1 = data.rows.find(row => row.taskSources.taskId === f.tasks.get("T1")!.publicId)!;
        expect(t1.selectedSources.some(source => source.entityKind === "system" && source.entityId === f.systems[0].publicId)).toBe(true);
        expect(t1.instancePaths.some(path => path.instanceId === f.equipment[0].publicId)).toBe(true);
      }
    }
    expect(() => f.report(f.spec("direct", view.systemIds), { projection: { kind: "scope", snapshotId: report.snapshotId, path: [] } })).toThrowError(expect.objectContaining({ code: "REPORT_STALE" }));
    expect(() => f.report(view, { projection: { kind: "scope", snapshotId: report.snapshotId, path: [{ dimension: "system", id: f.systems[0].publicId }] } })).toThrowError(expect.objectContaining({ code: "INVALID_SELECTION" }));
    f.database.prepare("UPDATE projects SET revision=revision+1 WHERE id=?").run(f.project.id);
    expect(() => f.report(view, { projection: { kind: "scope", snapshotId: report.snapshotId, path: [] } })).toThrowError(expect.objectContaining({ code: "REPORT_STALE" }));
  });

  it("production handler accepts readonly queries without mutation; invalid mode/root/foreign IDs and cycles fail closed", async () => {
    const f = fixture(), view = f.spec("coordination", [f.systems[2].publicId]), before = f.state();
    const request = (spec: unknown, origin = "http://localhost:3000") => handleWbsViewQuery(new Request("http://localhost:3000/api/projects/test/resource-dashboard/views", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ spec, filters }) }), f.project.publicId, { service: f.service, applicationBaseUrl: "http://localhost:3000", environment: "production", allowInsecureHttp: "true" });
    const good = await request(view); expect(good.status).toBe(200); expect(good.headers.get("set-cookie")).toBeNull(); expect(good.headers.get("cache-control")).toBe("private, no-store");
    expect(f.state()).toEqual(before);
    expect((await request(view, "https://foreign.invalid")).status).toBe(403);
    for (const invalid of [{ ...view, root: "process" }, { ...view, systemView: "guess" }, { ...view, systemIds: ["unknown"] }]) expect((await request(invalid)).status).toBe(400);
    const foreign = fixture();
    const bad = await request({ ...view, systemIds: [foreign.systems[2].publicId] });
    expect(bad.status).toBe(400); expect((await bad.json()).error.code).toBe("INVALID_SELECTION");
    f.logistics.setCoordinatedSystems(f.project.id, f.idleSystem.id, [f.systems[2].id], now);
    f.logistics.setCoordinatedSystems(f.project.id, f.systems[2].id, [f.idleSystem.id], now);
    expect((await request(view)).status).toBe(400);
    expect((await request({ ...view, systemIds: [randomUUID()] })).status).toBe(400);
  });
});
