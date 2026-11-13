import { describe, expect, it } from "vitest";
import { parseCreateEquipmentInput, parseUpdateEquipmentRequest } from "../../../src/server/logistics/logistics-contract";

const base = { code: "E", name: "Equipment", equipmentType: "amr", managementUnit: "unit" };
describe("Issue #917 optional primary process parser", () => {
  it("normalizes create omission/null and preserves PATCH omission/null distinction", () => {
    for (const input of [base, { ...base, processId: null }]) {
      expect(parseCreateEquipmentInput(input)).toMatchObject({ success: true, data: { processId: null } });
    }
    expect(parseCreateEquipmentInput({ ...base, processId: " p " })).toMatchObject({ success: true, data: { processId: "p" } });
    expect(parseUpdateEquipmentRequest({ name: "Changed" })).toEqual({ success: true, data: { name: "Changed" } });
    expect(parseUpdateEquipmentRequest({ processId: null })).toEqual({ success: true, data: { processId: null } });
    expect(parseUpdateEquipmentRequest({ processId: " p " })).toEqual({ success: true, data: { processId: "p" } });
  });
  it.each(["", "  ", 0, 1, false, [], {}])("rejects invalid process reference %j rather than converting to unassigned", processId => {
    expect(parseCreateEquipmentInput({ ...base, processId }).success).toBe(false);
    expect(parseUpdateEquipmentRequest({ processId }).success).toBe(false);
  });
});
