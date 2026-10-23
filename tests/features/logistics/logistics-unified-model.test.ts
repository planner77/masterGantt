import { describe, expect, it } from "vitest";
import { configuredLogisticsInventory, currentLogisticsDetail, fullMilestoneGateLabel, LOGISTICS_PERSPECTIVES } from "../../../src/features/logistics/logistics-unified-model";
import type { ProjectLogisticsDto } from "../../../src/contracts/logistics";
import type { ResourceDashboardStage } from "../../../src/contracts/resource-dashboard";

function inventory(equipment: Array<{id:string;quantity:number}>, systems: string[]) {
  return configuredLogisticsInventory({
    equipment: equipment.map(row => ({...row} as ProjectLogisticsDto["equipment"][number])),
    systems: systems.map(id => ({ id } as ProjectLogisticsDto["systems"][number])),
  });
}
describe("Issue #624 Logistics read-only perspectives", () => {
  it("uses only existing supported dimensions without authoring a synthetic hierarchy", () => {
    expect(LOGISTICS_PERSPECTIVES.process.order).toEqual(["processType", "process", "workArea"]);
    expect(LOGISTICS_PERSPECTIVES.equipment.order).toEqual(["equipmentType", "equipment"]);
    expect(LOGISTICS_PERSPECTIVES.system.order).toEqual(["systemType", "system"]);
    for (const view of Object.values(LOGISTICS_PERSPECTIVES)) {
      expect(new Set(view.order).size).toBe(view.order.length);
    }
  });
  it("deduplicates shared instances at Project level, never sums Target subtotals", () => {
    const result = inventory([{id:"amr-fleet",quantity:15},{id:"amr-fleet",quantity:15},{id:"acs",quantity:2}], ["mcs","mcs","acs-system"]);
    expect(result.equipmentIds).toEqual(["acs","amr-fleet"]);
    expect(result.equipmentQuantity).toBe(17);
    expect(result.systemIds).toEqual(["acs-system","mcs"]);
    expect(result.conflictingEquipmentIds).toEqual([]);
  });
  it("reports inconsistent duplicate canonical identity rather than accepting it silently", () => {
    expect(inventory([{id:"amr",quantity:15},{id:"amr",quantity:16}], []).conflictingEquipmentIds).toEqual(["amr"]);
  });
  it("does not infer equipment quantity from system count", () => {
    const result = inventory([], ["mcs"]);
    expect(result.equipmentQuantity).toBe(0);
    expect(result.systemIds).toEqual(["mcs"]);
  });
  it("invalidates exact detail on query, snapshot or missing data without mutating canonical selection", () => {
    const selection = { snapshotId: "snap-1", queryKey: "process", selector: { dimension: "targetProjection" } };
    expect(currentLogisticsDetail(selection, "snap-1", "process")).toBe(selection);
    expect(currentLogisticsDetail(selection, "snap-2", "process")).toBeNull();
    expect(currentLogisticsDetail(selection, "snap-1", "equipment")).toBeNull();
    expect(currentLogisticsDetail(selection, undefined, "process")).toBeNull();
    expect(currentLogisticsDetail(selection, "", "process")).toBeNull();
    expect(currentLogisticsDetail(null, "snap-1", "process")).toBeNull();
    expect(selection).toEqual({ snapshotId: "snap-1", queryKey: "process", selector: { dimension: "targetProjection" } });
  });
  it("keeps the full Ready/Blocked gate independent from the selected Task summary", () => {
    const stage = { full: { ready: true, blocked: false }, selected: { taskCount: 0 } } as ResourceDashboardStage;
    expect(fullMilestoneGateLabel(stage)).toBe("Ready");
    expect(fullMilestoneGateLabel({...stage, full: {...stage.full, blocked:true}})).toBe("Blocked");
    expect(fullMilestoneGateLabel({...stage, full: {...stage.full, ready:null}})).toBe("미판정");
  });
});
