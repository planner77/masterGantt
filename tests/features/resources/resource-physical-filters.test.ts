import { describe, expect, it } from "vitest";
import { migrateResourcePhysicalFilters } from "../../../src/features/resources/resource-physical-filters";

describe("#785 persisted resource filter transition", () => {
  it("preserves Task/Assignment/resource constraints but never treats an archived group ID as a real instance", () => {
    const input={targetIds:["old-domain-id"],memberEquipmentIds:["old-member"],projectionOrder:["target" as const,"resource" as const],taskIds:["task"],resourceIds:["person"],systemIds:["physical-system"],from:"2026-10-14"};
    const result=migrateResourcePhysicalFilters(input);
    expect(result.changed).toBe(true);
    expect(result.filters).toEqual({taskIds:["task"],resourceIds:["person"],systemIds:["physical-system"],from:"2026-10-14"});
    expect(input.targetIds).toEqual(["old-domain-id"]);
  });
  it("keeps current direct/archived union instance predicates and nullable conversion without a false migration alert", () => {
    const input={equipmentIds:["equipment"],physicalEquipmentTypeCodes:["amr"],mdPerMm:null,targetIds:[]};
    expect(migrateResourcePhysicalFilters(input)).toEqual({filters:{equipmentIds:["equipment"],physicalEquipmentTypeCodes:["amr"],mdPerMm:null},changed:false});
  });
});
