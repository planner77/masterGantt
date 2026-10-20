import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { WbsViewNode, WbsViewQueryInput, WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { TaskTargetBindingRepository } from "../../../src/server/repositories/task-target-binding-repository-core";
import { handleWbsViewQuery } from "../../../src/server/resources/wbs-dashboard-views-handlers-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";

const filters = { from: "2026-10-05", to: "2026-10-09", mdPerMm: 20 };
const spec: WbsViewQueryInput["spec"] = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "equipment" };
type Fixture = ReturnType<typeof wbsDashboardViewsFixture>;
const report = (f: Fixture, input: Partial<WbsViewQueryInput> = {}) => f.service.queryWbsView(f.project.publicId, { spec, filters, ...input }) as WbsViewReportDto;
const child = (parent: Pick<WbsViewNode, "children">, dimension: string, id: string | null) => {
  const row = parent.children.find(row => row.selector.dimension === dimension && row.selector.id === id);
  expect(row, `${dimension}:${id}`).toBeDefined(); return row!;
};
const ids = (f: Fixture, ...names: string[]) => names.map(name => f.tasks.get(name)!.publicId).sort();
const assignmentIds = (f: Fixture, ...names: string[]) => names.map(name => f.assignmentIds.get(name)!).sort();
function assertScope(f: Fixture, row: WbsViewNode, tasks: string[], assignments: string[], md: number) {
  expect([...row.taskIds].sort()).toEqual(ids(f, ...tasks));
  expect([...row.assignmentIds].sort()).toEqual(assignmentIds(f, ...assignments));
  expect(row.totals.assignments.effort.knownMd).toBe(md);
}
function typeB(f: Fixture) {
  f.database.prepare("INSERT INTO logistics_equipment_types(code,name,active,sort_order,created_at,updated_at) VALUES('test734','다른 유형',1,50,?,?)").run(now, now);
  f.database.prepare("UPDATE project_equipment SET equipment_type='test734' WHERE id=?").run(f.equipment[1].id);
}
async function query(f: Fixture, body: unknown, origin = "https://example.test") {
  return handleWbsViewQuery(new Request(`https://example.test/api/projects/${f.project.publicId}/resource-dashboard/views`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), f.project.publicId, { service: f.service, applicationBaseUrl: "https://example.test", environment: "production" });
}

describe("#734 same-snapshot registered Equipment and exact common-ledger scope", () => {
  it("returns original inactive/idle metadata, explicit owner and actual controls without Task-derived relationships", async () => {
    const f = wbsDashboardViewsFixture("mixed");
    try {
      f.database.prepare("UPDATE project_equipment SET active=0 WHERE id=?").run(f.idleEquipment.id);
      f.logistics.replaceEquipmentResourceRoles(f.project.id, f.idleEquipment.id, [{ resourceId: f.resources.get("R2")!.id, role: "owner", isPrimary: 1 }], now);
      f.logistics.setEquipmentSystems(f.project.id, f.idleEquipment.id, [{ systemId: f.systems[0].id, controlRole: "primary" }], now);
      const before = f.state(), response = await query(f, { spec, filters });
      expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const data = (await response.json()).data as WbsViewReportDto;
      const original = data.configurationCatalog.equipment.find(row => row.id === f.idleEquipment.publicId)!;
      expect(original).toMatchObject({ name: "등록만 설비", active: false, equipmentType: "amr", equipmentTypeName: "AMR (자율이동로봇)", managementUnit: "fleet", quantity: 7, primaryProcessId: f.processA.publicId, workAreaLinks: [],
        resourceRoles: [{ resourceId: f.resources.get("R2")!.publicId, resourceName: f.resources.get("R2")!.name, role: "owner", isPrimary: true, active: true }],
        controlSystems: [{ systemId: f.systems[0].publicId, systemName: "ACS-A", controlRole: "primary" }] });
      expect(data.configurationCatalog.equipment.find(row => row.id === f.equipment[0].publicId)!.workAreaLinks).toHaveLength(2);
      expect(data.configurationCatalog.equipment.find(row => row.id === f.equipment[0].publicId)!.controlSystems).toEqual([]);
      assertScope(f, child(data, "equipment", f.idleEquipment.publicId), [], [], 0);
      const unassigned = child(data, "equipment", null);
      expect(unassigned.taskIds).toEqual(expect.arrayContaining(ids(f, "UNASSIGNED", "GROUP_ONLY")));
      expect(f.state()).toEqual(before);
    } finally { f.database.close(); }
  });

  it("keeps AMR10+5 distinct15 and shared-MCS scope across direct, Target and mixed sources", () => {
    for (const mode of ["direct", "target", "mixed"] as const) {
      const f = wbsDashboardViewsFixture(mode);
      try {
        f.database.prepare("DELETE FROM project_equipment WHERE id=?").run(f.idleEquipment.id);
        const data = report(f);
        expect(data.totals.configurationReference.equipmentQuantity).toBe(15);
        expect(data.configurationCatalog.equipment.map(row => row.quantity).sort((a, b) => a - b)).toEqual([5, 10]);
        const systems = report(f, { spec: { ...spec, root: "system", levels: ["process"] } });
        const mcs = child(systems, "system", f.systems[2].publicId);
        assertScope(f, mcs, ["T0", "T1", "T2", "T3"], ["A0", "A1", "A2", "A3"], 14);
        assertScope(f, child(mcs, "process", f.processA.publicId), ["T1", "T3"], ["A1", "A3"], 8);
        assertScope(f, child(mcs, "process", f.processB.publicId), ["T2", "T3"], ["A2", "A3"], 9);
      } finally { f.database.close(); }
    }
  });

  it("preserves ancestor/direct/subset provenance and multiple milestones without shared-instance Task leakage", () => {
    const f = wbsDashboardViewsFixture("mixed");
    try {
      f.logistics.replaceTaskEquipmentLinks(f.project.id, f.tasks.get("S")!.id, [{ equipmentId: f.equipment[0].id, scope: "subtree" }], now);
      f.database.transaction(() => new TaskTargetBindingRepository(f.database).replace(f.project.id, f.tasks.get("T2")!.id, [{ id: randomUUID(), taskId: f.tasks.get("T2")!.publicId, targetId: f.targets[0].id, selection: "subset", scope: "self", memberIds: [f.targets[0].memberIds[1]] }], now))();
      const second = f.schedules.insertTask({ projectId: f.project.id, publicId: randomUUID(), externalId: "M2", name: "두 번째 단계", type: "milestone", parentId: null, scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-05", duration: 0, progress: 0, status: "not_started", sortOrder: 99, createdAt: now, updatedAt: now });
      f.contexts.replaceTask(f.project.id, second.id, { processLinks: [], workAreaLinks: [] });
      new MilestoneMembershipRepository(f.database).set(f.project.id, f.tasks.get("T3")!.id, second.id);
      const data = report(f, { spec: { ...spec, levels: ["milestone", "process"] } });
      const equipment = child(data, "equipment", f.equipment[0].publicId);
      expect(equipment.taskIds).toEqual(expect.arrayContaining(ids(f, "T0", "T1", "T3")));
      expect(equipment.taskIds).not.toContain(f.tasks.get("T2")!.publicId);
      const milestone = child(equipment, "milestone", f.tasks.get("M")!.publicId);
      assertScope(f, milestone, ["T1"], ["A1"], 3);
      expect(milestone.children.some(row => row.selector.id === f.processB.publicId)).toBe(false);
      expect(child(equipment, "milestone", second.publicId).taskIds).toEqual(ids(f, "T3"));
      expect(data.taskSources.find(row => row.taskId === f.tasks.get("T0")!.publicId)!.sources.some(source => source.inherited && source.entityId === f.equipment[0].publicId)).toBe(true);
      expect(data.fullMilestones).toHaveLength(2);
    } finally { f.database.close(); }
  });

  it("retains E10 in two WorkAreas at10 each and unique parent10/5M-D despite duplicate Target and direct paths", () => {
    const f = wbsDashboardViewsFixture("mixed");
    try {
      f.logistics.replaceTaskEquipmentLinks(f.project.id, f.tasks.get("T3")!.id, [{ equipmentId: f.equipment[0].id, scope: "self" }], now);
      const data = report(f, { spec: { ...spec, levels: ["workArea"] }, filters: { ...filters, taskIds: ids(f, "T3") } });
      const equipment = child(data, "equipment", f.equipment[0].publicId);
      expect(equipment.totals.configurationReference.equipmentQuantity).toBe(10);
      for (const areaId of [f.areaId, f.areaBPublicId]) {
        const area = child(equipment, "workArea", areaId);
        expect(area.totals.configurationReference.equipmentQuantity).toBe(10);
        assertScope(f, area, ["T3"], ["A3"], 5);
      }
      assertScope(f, equipment, ["T3"], ["A3"], 5);
      expect(data.totals.assignments.effort.knownMd).toBe(5);
    } finally { f.database.close(); }
  });

  it.each(["direct", "target", "mixed"] as const)("filters %s Equipment types by OR raw union, including inactive registration and exact details", mode => {
    const f = wbsDashboardViewsFixture(mode);
    try {
      typeB(f); f.database.prepare("UPDATE project_equipment SET active=0 WHERE id=?").run(f.idleEquipment.id);
      const all = report(f), filtered = report(f, { filters: { ...filters, equipmentTypeCodes: ["test734"] } });
      expect(filtered.children.map(row => row.selector.id)).toEqual([f.equipment[1].publicId]);
      expect(filtered.totals.configurationReference.equipmentQuantity).toBe(5);
      expect(filtered.taskIds).toEqual(mode === "direct" ? ids(f, "T2") : ids(f, "T0", "T2", "T3"));
      expect(filtered.snapshotId).not.toBe(all.snapshotId);
      const both = report(f, { filters: { ...filters, equipmentTypeCodes: ["test734", "amr"] } });
      expect(both.totals.configurationReference.equipmentQuantity).toBe(22);
      expect(both.totals.assignments.effort.knownMd).toBe(mode === "direct" ? 7 : 14);
      expect(both.children.some(row => row.selector.id === f.idleEquipment.publicId)).toBe(true);
      const path = child(filtered, "equipment", f.equipment[1].publicId).path;
      const details = f.service.queryWbsView(f.project.publicId, { spec, filters: { ...filters, equipmentTypeCodes: ["test734"] }, projection: { kind: "details", snapshotId: filtered.snapshotId, path, view: "assignments", offset: 0, limit: 100 } })!;
      expect(details.projection).toBe("details");
      if (details.projection === "details") expect(details.rows.map(row => row.assignment!.assignmentId).sort()).toEqual([...filtered.assignmentIds].sort());
      expect(() => f.service.queryWbsView(f.project.publicId, { spec, filters: { ...filters, equipmentTypeCodes: ["amr"] }, projection: { kind: "scope", snapshotId: filtered.snapshotId, path } })).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
    } finally { f.database.close(); }
  });

  it("unions one direct Task linked to two types once and keeps other-root exact Task scopes", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      typeB(f);
      f.logistics.replaceTaskEquipmentLinks(f.project.id, f.tasks.get("T3")!.id, f.equipment.map(row => ({ equipmentId: row.id, scope: "self" })), now);
      const typeFilters = { ...filters, taskIds: ids(f, "T3"), equipmentTypeCodes: ["test734", "amr"] };
      const data = report(f, { filters: typeFilters });
      expect(data.taskIds).toEqual(ids(f, "T3")); expect(data.assignmentIds).toEqual(assignmentIds(f, "A3"));
      expect(data.totals.assignments.effort.knownMd).toBe(5);
      expect(data.children.reduce((sum, row) => sum + row.totals.assignments.effort.knownMd, 0)).toBe(10);
      const before = report(f);
      for (const root of ["process", "workArea", "system", "milestone", "resource"] as const) {
        const projected = report(f, { spec: { ...spec, root }, filters: typeFilters });
        expect(projected.taskIds).toEqual(ids(f, "T3"));
        expect(projected.totals.assignments.effort.knownMd).toBe(5);
        expect(projected.totals.configurationReference.equipmentQuantity).toBe(22);
        expect(projected.fullMilestones).toEqual(before.fullMilestones);
      }
    } finally { f.database.close(); }
  });

  it.each(["name", "quantity", "active", "owner", "controls"] as const)("invalidates an old scope when original Equipment %s metadata changes without revision bumps", field => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const before = report(f), path = child(before, "equipment", f.idleEquipment.publicId).path;
      const changes = {
        name: () => f.database.prepare("UPDATE project_equipment SET name='새 원본 이름' WHERE id=?").run(f.idleEquipment.id),
        quantity: () => f.database.prepare("UPDATE project_equipment SET quantity=11 WHERE id=?").run(f.idleEquipment.id),
        active: () => f.database.prepare("UPDATE project_equipment SET active=0 WHERE id=?").run(f.idleEquipment.id),
        owner: () => f.logistics.replaceEquipmentResourceRoles(f.project.id, f.idleEquipment.id, [{ resourceId: f.resources.get("R2")!.id, role: "owner", isPrimary: 1 }], now),
        controls: () => f.logistics.setEquipmentSystems(f.project.id, f.idleEquipment.id, [{ systemId: f.systems[0].id, controlRole: "supporting" }], now),
      };
      changes[field]();
      expect(report(f).snapshotId).not.toBe(before.snapshotId);
      expect(() => f.service.queryWbsView(f.project.publicId, { spec, filters, projection: { kind: "scope", snapshotId: before.snapshotId, path } })).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
      expect(f.projects.findById(f.project.id)!.revision).toBe(1);
    } finally { f.database.close(); }
  });

  it("rejects unknown/malformed types and stale excluded paths, preserving readonly Origin and snapshot metadata", async () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      typeB(f);
      for (const equipmentTypeCodes of [["unknown"], "amr", [1], {}, ["amr", ""]]) {
        const response = await query(f, { spec, filters: { ...filters, equipmentTypeCodes } });
        expect(response.status).toBe(400);
      }
      expect((await query(f, { spec, filters }, "https://foreign.test")).status).toBe(403);
      const before = report(f, { filters: { ...filters, equipmentTypeCodes: ["test734"] } });
      expect(() => f.service.queryWbsView(f.project.publicId, { spec, filters: { ...filters, equipmentTypeCodes: ["test734"] }, projection: { kind: "scope", snapshotId: before.snapshotId, path: [{ dimension: "equipment", id: f.equipment[0].publicId }] } })).toThrow(expect.objectContaining({ code: "INVALID_SELECTION" }));
      f.database.prepare("UPDATE logistics_equipment_types SET name='이름 변경' WHERE code='test734'").run();
      const after = report(f, { filters: { ...filters, equipmentTypeCodes: ["test734"] } });
      expect(after.configurationCatalog.equipment.find(row => row.id === f.equipment[1].publicId)!.equipmentTypeName).toBe("이름 변경");
      expect(after.snapshotId).not.toBe(before.snapshotId);
      expect(() => f.service.queryWbsView(f.project.publicId, { spec, filters: { ...filters, equipmentTypeCodes: ["test734"] }, projection: { kind: "scope", snapshotId: before.snapshotId, path: after.children[0].path } })).toThrow(expect.objectContaining({ code: "REPORT_STALE" }));
    } finally { f.database.close(); }
  });
});
