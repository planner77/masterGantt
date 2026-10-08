import { describe, expect, it } from "vitest";
import { buildResourcePlanPeriods } from "../../src/domain/resources/resource-plan-periods";
describe("Resource Plan date-only periods", () => {
  it.each([["1900-01-01", "1900-W01"], ["2021-01-01", "2020-W53"], ["2025-12-29", "2026-W01"], ["2199-12-31", "2200-W01"]])("maps %s to ISO %s without out-of-range date parsing", (date, key) => { expect(buildResourcePlanPeriods(date, date, "week")).toEqual([expect.objectContaining({ key, from: date, to: date, partial: true })]); });
  it("clips partial weeks and leap month boundaries without gaps", () => {
    expect(buildResourcePlanPeriods("2024-02-28", "2024-03-02", "month")).toEqual([
      { key: "2024-02", label: "2024-02", year: 2024, month: 2, from: "2024-02-28", to: "2024-02-29", partial: true },
      { key: "2024-03", label: "2024-03", year: 2024, month: 3, from: "2024-03-01", to: "2024-03-02", partial: true },
    ]);
    expect(buildResourcePlanPeriods("2026-10-09", "2026-10-13", "week").map((p) => [p.from, p.to])).toEqual([["2026-10-09", "2026-10-11"], ["2026-10-12", "2026-10-13"]]);
  });
  it("marks complete periods and rejects invalid or oversized dates", () => {
    expect(buildResourcePlanPeriods("2026-10-05", "2026-10-11", "week")[0].partial).toBe(false);
    expect(buildResourcePlanPeriods("2024-02-01", "2024-02-29", "month")[0].partial).toBe(false);
    for (const [from, to] of [["2026-10-09", "2026-10-05"], ["2026-01-01", "2027-01-02"], ["2200-01-01", "2200-01-02"]]) expect(() => buildResourcePlanPeriods(from, to, "week")).toThrow();
    expect(() => buildResourcePlanPeriods("2026-01-01", "2026-01-01", "day" as "week")).toThrow();
  });
});
