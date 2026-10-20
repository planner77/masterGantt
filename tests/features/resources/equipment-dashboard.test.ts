import { describe, expect, it } from "vitest";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { EQUIPMENT_DEFAULT_SPEC, EQUIPMENT_PRESETS, equipmentPresentation } from "../../../src/features/resources/equipment-dashboard-model";
import { validateWbsViewSpec } from "../../../src/features/resources/wbs-view-model";
import type { WbsViewReportDto } from "../../../src/contracts/wbs-dashboard-views";

const filters = { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 };
describe("#734 equipment consumer", () => {
  it.each(["direct", "target", "mixed"] as const)("preserves server totals, all configuration and Gate without writes (%s)", mode => {
    const f = wbsDashboardViewsFixture(mode);
    try {
      const before = f.state();
      for (const preset of EQUIPMENT_PRESETS) {
        const spec = { ...EQUIPMENT_DEFAULT_SPEC, levels: preset.levels };
        expect(validateWbsViewSpec(spec).ok).toBe(true);
        const data = f.service.queryWbsView(f.project.publicId, {spec,filters}) as WbsViewReportDto;
        const view = equipmentPresentation(data);
        expect(view.tasks).toBe(data.totals.tasks);
        expect(view.assignments).toBe(data.totals.assignments);
        expect(view.configuration).toBe(data.totals.configurationReference);
        expect(view.tasks.taskCount).toBe(6);
        expect(view.assignments.effort.knownMd).toBe(14);
        expect(view.equipment.find(row=>row.id===f.idleEquipment.publicId)?.quantity).toBe(7);
        expect(view.zeroTaskRows.some(row=>row.selector.id===f.idleEquipment.publicId)).toBe(true);
        expect(view.equipment.find(row=>row.id===f.equipment[0].publicId)?.workAreaLinks).toHaveLength(2);
        expect(view.fullMilestones).toHaveLength(1);
        expect(view.fullMilestones[0].stageGate.memberCount).toBe(3);
        expect(view.fullMilestones[0].stageGate.ready).toBe(false);
      }
      expect(f.state()).toEqual(before);
    } finally { f.database.close(); }
  });

  it("keeps the equipment's exact Task intersection through a shared Milestone", () => {
    const f = wbsDashboardViewsFixture("direct");
    try {
      const data = f.service.queryWbsView(f.project.publicId, {spec:{...EQUIPMENT_DEFAULT_SPEC,levels:["milestone","process"]},filters}) as WbsViewReportDto;
      const equipment = data.children.find(row=>row.selector.id===f.equipment[0].publicId)!;
      const visit = (rows:typeof data.children):void => { for(const row of rows) { expect(row.taskIds).not.toContain(f.tasks.get("T2")!.publicId); visit(row.children); } };
      visit([equipment]);
      expect(equipment.taskIds).toContain(f.tasks.get("T1")!.publicId);
      expect(equipmentPresentation(data).withoutOwner.map(row=>row.id)).toContain(f.idleEquipment.publicId);
    } finally { f.database.close(); }
  });
});
