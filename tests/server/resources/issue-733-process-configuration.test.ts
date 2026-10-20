import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { WbsViewNode, WbsViewReportDto, WbsViewSpec } from "../../../src/contracts/wbs-dashboard-views";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";

const filters = { from: "2026-10-05", to: "2026-10-09", mdPerMm: 20 };
const spec: WbsViewSpec = { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root: "process", levels: ["workArea", { kind: "siblings", dimensions: ["equipment", "system"] }] };
const child = (parent: Pick<WbsViewNode, "children">, dimension: string, id: string | null) => {
  const node = parent.children.find(row => row.selector.dimension === dimension && row.selector.id === id);
  expect(node, `${dimension}:${id}`).toBeDefined(); return node!;
};

describe("#733 registered process/WorkArea configuration through the shared #729 snapshot", () => {
  it("preserves nested idle WorkArea/equipment/system with exact catalog names and zero Task population", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const areaId = randomUUID();
      const internalArea = Number(f.database.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(areaId, f.areaA.occurrenceId, "IDLE-WA", "작업 없는 구역", now, now).lastInsertRowid);
      f.contexts.replaceEquipment(f.project.id, f.idleEquipment.id, [{ ...f.areaA, workAreaId: internalArea }]);
      const idleSystem = f.logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: "PROCESS-IDLE", name: "공정 등록만 시스템", systemType: "mcs", layer: "coordinator", scope: "processes", now });
      f.database.prepare("INSERT INTO project_system_processes(project_id,system_id,process_id,created_at) VALUES(?,?,?,?)").run(f.project.id, idleSystem.id, f.processA.id, now);
      const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
      const process = child(data, "process", f.processA.publicId);
      const area = child(process, "workArea", areaId), equipment = child(area, "equipment", f.idleEquipment.publicId);
      expect(equipment.taskIds).toEqual([]); expect(equipment.assignmentIds).toEqual([]);
      expect(equipment.totals.configurationReference.equipmentQuantity).toBe(7);
      expect(equipment.totals.relatedMembers.equipmentQuantity).toBe(0);
      expect(equipment.totals.assignments.effort.knownMd).toBe(0);
      expect(area.children.some(row => row.selector.id === idleSystem.publicId)).toBe(false);
      const direct = f.service.queryWbsView(f.project.publicId, { spec: { ...spec, levels: [{ kind: "siblings", dimensions: ["equipment", "system"] }] }, filters }) as WbsViewReportDto;
      expect(child(child(direct, "process", f.processA.publicId), "system", idleSystem.publicId).taskIds).toEqual([]);
      expect(child(child(process, "workArea", null), "system", idleSystem.publicId).taskIds).toEqual([]);
      expect(child(direct, "process", f.processA.publicId).children.some(row => row.selector.id === f.idleSystem.publicId)).toBe(false);
      expect(child(child(direct, "process", null), "system", f.idleSystem.publicId).taskIds).toEqual([]);
      expect(data.configurationCatalog.workAreas.find(row => row.id === areaId)).toEqual({ id: areaId, name: "작업 없는 구역", occurrenceId: f.occurrenceId, processIds: [f.processA.publicId] });
      expect(data.configurationCatalog.instances).toContainEqual({ kind: "equipment", id: f.idleEquipment.publicId, name: "등록만 설비" });
      const scope = f.service.queryWbsView(f.project.publicId, { spec, filters, projection: { kind: "scope", snapshotId: data.snapshotId, path: equipment.path } })!;
      expect(scope.projection).toBe("scope");
      if (scope.projection === "scope") { expect(scope.taskIds).toEqual([]); expect(scope.assignmentIds).toEqual([]); }
    } finally { f.database.close(); }
  });


  it("restricts a shared-occurrence WorkArea to its exact project process through equipment and controller", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const occurrenceId = f.areaA.occurrenceId;
      const occurrence = f.database.prepare("SELECT business_unit_id AS bu, product_id AS product, site_entity_id AS site FROM site_product_processes WHERE id=?")
        .get(occurrenceId) as { bu: number; product: number; site: number };
      const processC = f.logistics.insertProcess({ publicId: randomUUID(), projectId: f.project.id, code: "PC-SHARED", name: "공유 발생 공정", parentId: null, active: 1, now });
      f.database.prepare("INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(f.project.id, processC.id, occurrenceId, occurrence.bu, occurrence.product, occurrence.site, now, now);
      const foreignAreaId = randomUUID();
      const foreignArea = Number(f.database.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)")
        .run(foreignAreaId, occurrenceId, "C-ONLY", "공유 발생 C 전용 WorkArea", now, now).lastInsertRowid);
      f.contexts.replaceEquipment(f.project.id, f.equipment[0].id, [{ processId: processC.id, occurrenceId, workAreaId: foreignArea }]);
      f.logistics.setEquipmentSystems(f.project.id, f.equipment[0].id, [{ systemId: f.systems[2].id, controlRole: "primary" }], now);
      f.database.prepare("INSERT INTO project_system_processes(project_id,system_id,process_id,created_at) VALUES(?,?,?,?)")
        .run(f.project.id, f.systems[2].id, processC.id, now);
      const byInstance: WbsViewSpec = { ...spec, levels: [{ kind: "siblings", dimensions: ["equipment", "system"] }, "workArea"] };
      const report = f.service.queryWbsView(f.project.publicId, { spec: byInstance, filters }) as WbsViewReportDto;
      const a = child(report, "process", f.processA.publicId), c = child(report, "process", processC.publicId);
      for (const [dimension, instanceId] of [["equipment", f.equipment[0].publicId], ["system", f.systems[2].publicId]] as const) {
        const aInstance = child(a, dimension, instanceId), cInstance = child(c, dimension, instanceId);
        expect(aInstance.children.some(row => row.selector.dimension === "workArea" && row.selector.id === foreignAreaId)).toBe(false);
        const actual = child(cInstance, "workArea", foreignAreaId);
        expect(actual.totals.configurationReference.equipmentIds).toContain(f.equipment[0].publicId);
        expect(actual.taskIds).toEqual([]);
        expect(actual.assignmentIds).toEqual([]);
      }
    } finally { f.database.close(); }
  });

  it("keeps a Task0 process-scoped System in the null-area state even when every equipment has a real WorkArea", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      f.database.prepare("DELETE FROM tasks WHERE project_id=?").run(f.project.id);
      for (const equipment of [...f.equipment, f.idleEquipment]) f.contexts.replaceEquipment(f.project.id, equipment.id, [f.areaA]);
      const system = f.logistics.insertSystem({ publicId: randomUUID(), projectId: f.project.id, code: "NO-WA", name: "구역 관계 없는 시스템", systemType: "mcs", layer: "coordinator", scope: "processes", now });
      f.database.prepare("INSERT INTO project_system_processes(project_id,system_id,process_id,created_at) VALUES(?,?,?,?)").run(f.project.id, system.id, f.processA.id, now);
      const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
      const process = child(data, "process", f.processA.publicId);
      const unlinked = child(child(process, "workArea", null), "system", system.publicId);
      expect(unlinked.taskIds).toEqual([]); expect(unlinked.assignmentIds).toEqual([]);
      expect(child(process, "workArea", f.areaId).children.some(row => row.selector.id === system.publicId)).toBe(false);
    } finally { f.database.close(); }
  });

  it("W1 cross-process WorkArea membership preserves original quantity without widening Task identities", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      f.contexts.replaceEquipment(f.project.id, f.idleEquipment.id, [f.areaA, f.areaB]);
      const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
      const a = child(child(child(data, "process", f.processA.publicId), "workArea", f.areaId), "equipment", f.idleEquipment.publicId);
      const b = child(child(child(data, "process", f.processB.publicId), "workArea", f.areaBPublicId), "equipment", f.idleEquipment.publicId);
      expect(a.totals.configurationReference.equipmentQuantity).toBe(7); expect(b.totals.configurationReference.equipmentQuantity).toBe(7);
      expect(data.totals.configurationReference.equipmentIds.filter(id => id === f.idleEquipment.publicId)).toHaveLength(1);
      expect(a.taskIds).toEqual([]); expect(b.taskIds).toEqual([]);
      const standalone = f.service.queryWbsView(f.project.publicId, { spec: { ...spec, levels: [] }, filters }) as WbsViewReportDto;
      expect(child(standalone, "process", f.processA.publicId).totals.configurationReference.equipmentIds).toContain(f.idleEquipment.publicId);
      expect(child(standalone, "process", f.processB.publicId).totals.configurationReference.equipmentIds).toContain(f.idleEquipment.publicId);
      const priorId = data.snapshotId;
      f.contexts.replaceEquipment(f.project.id, f.idleEquipment.id, [f.areaB]);
      expect((f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto).snapshotId).not.toBe(priorId);
      expect(() => f.service.queryWbsView(f.project.publicId, { spec, filters, projection: { kind: "scope", snapshotId: priorId, path: a.path } })).toThrowError(expect.objectContaining({ status: 409 }));
    } finally { f.database.close(); }
  });

  it("keeps equipment managed in A but linked only to B in A's null-area configuration state", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      f.contexts.replaceEquipment(f.project.id, f.idleEquipment.id, [f.areaB]);
      const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
      const parent = child(data, "process", f.processA.publicId);
      const a = child(child(parent, "workArea", null), "equipment", f.idleEquipment.publicId);
      const b = child(child(child(data, "process", f.processB.publicId), "workArea", f.areaBPublicId), "equipment", f.idleEquipment.publicId);
      expect(parent.totals.configurationReference.equipmentIds).toContain(f.idleEquipment.publicId);
      expect(a.totals.configurationReference.equipmentQuantity).toBe(7); expect(b.totals.configurationReference.equipmentQuantity).toBe(7);
      expect(a.taskIds).toEqual([]); expect(a.assignmentIds).toEqual([]);
      expect(data.totals.configurationReference.equipmentIds.filter(id => id === f.idleEquipment.publicId)).toHaveLength(1);
      const global = f.service.queryWbsView(f.project.publicId, { spec: { ...spec, root: "workArea", levels: [] }, filters }) as WbsViewReportDto;
      expect(child(global, "workArea", null).totals.configurationReference.equipmentIds).not.toContain(f.idleEquipment.publicId);
    } finally { f.database.close(); }
  });

  it("preserves members0 WorkArea and project-common system in a Project with no Tasks", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      f.database.prepare("DELETE FROM tasks WHERE project_id=?").run(f.project.id);
      const data = f.service.queryWbsView(f.project.publicId, { spec, filters }) as WbsViewReportDto;
      expect(data.taskIds).toEqual([]); expect(data.assignmentIds).toEqual([]);
      expect(child(child(data, "process", f.processB.publicId), "workArea", f.areaBPublicId).taskIds).toEqual([]);
      expect(child(data, "process", null).totals.configurationReference.systemIds).toContain(f.idleSystem.publicId);
    } finally { f.database.close(); }
  });
});
