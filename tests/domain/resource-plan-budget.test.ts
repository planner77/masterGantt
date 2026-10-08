import { describe, expect, it } from "vitest";
import { calculateResourcePlan, ResourcePlanLimitError } from "../../src/domain/resources/resource-plan";
import { resourcePlanFixture, resourcePlanAssignment as a, resourcePlanResource as r } from "../fixtures/resource-plan";
describe("Resource Plan finite admission budgets", () => {
  it.each(["resourceDays", "assignmentDays", "matrixCells"] as const)("admits exact %s boundary and rejects one below", (dimension) => {
    const input = resourcePlanFixture(); input.limits[dimension] = 5;
    expect(calculateResourcePlan(input).totals.summary.selected.knownMd).toBe(2.5);
    input.limits[dimension] = 4;
    expect(() => calculateResourcePlan(input)).toThrow(expect.objectContaining({ dimension, actual: 5, limit: 4 }));
  });
  it("budgets only displayed Group rows while preserving a hidden Group calendar", () => {
    const input = resourcePlanFixture({ projectionGroupIds: ["G1"], selectedAssignments: [], calendarExceptions: [{ date: "2026-10-05", dayType: "NON_WORKING", targetType: "RESOURCE_GROUP", targetId: "G2", ruleId: "H", ruleName: "hidden holiday" }] });
    input.limits.matrixCells = 3;
    const output = calculateResourcePlan(input);
    expect(output.groups.map((group) => group.groupId)).toEqual(["G1"]);
    expect(output.totals.summary.project).toMatchObject({ capacityMd: 4, knownMd: 2 });
    expect(output.resources[0].summary.project.capacityMd).toBe(4);
    input.limits.matrixCells = 2;
    expect(() => calculateResourcePlan(input)).toThrow(expect.objectContaining({ dimension: "matrixCells", actual: 3, limit: 2 }));
    input.projectionGroupIds = [];
    const withoutGroups = calculateResourcePlan(input);
    expect(withoutGroups.groups).toEqual([]);
    expect(withoutGroups.population.resourceIds).toEqual(["R1"]);
    expect(withoutGroups.totals.summary.project.capacityMd).toBe(4);
  });
  it("does not charge 32 non-displayed memberships and validates explicit projection IDs", () => {
    const input = resourcePlanFixture({ resources: [r("R1", Array.from({ length: 32 }, (_, i) => `G${i}`))], projectionGroupIds: ["G0"] });
    input.limits.matrixCells = 4;
    expect(calculateResourcePlan(input).groups).toHaveLength(1);
    input.projectionGroupIds = undefined;
    expect(() => calculateResourcePlan(input)).toThrow(expect.objectContaining({ dimension: "matrixCells", actual: 35 }));
    input.projectionGroupIds = ["missing"];
    expect(() => calculateResourcePlan(input)).toThrow("Unknown Resource Plan Group projection");
    input.projectionGroupIds = ["G0", "G0"];
    expect(() => calculateResourcePlan(input)).toThrow("Duplicate Resource Plan Group projection");
    input.projectionGroupIds = [null];
    expect(calculateResourcePlan(input).groups).toEqual([]);
    input.resources = [...input.resources, r("R2", ["KNOWN_OUTSIDE_R"])];
    input.projectionGroupIds = ["KNOWN_OUTSIDE_R"];
    expect(calculateResourcePlan(input).groups).toEqual([]);
  });
  it("rejects actual resource-days before computing calendars", () => {
    const resources = Array.from({ length: 547 }, (_, i) => r(String(i)));
    const input = resourcePlanFixture({ from: "2024-01-01", to: "2024-12-31", resources, capacityResourceIds: resources.map((r) => r.resourceId), selectedAssignments: [], fullProjectAssignments: [] });
    expect(() => calculateResourcePlan(input)).toThrow(expect.objectContaining({ dimension: "resourceDays", actual: 200202, limit: 200000 }));
  });
  it("counts each full Assignment day once and rejects >1000000 before buffers", () => {
    const rows = Array.from({ length: 2740 }, (_, i) => a(String(i), "R1", 50, { from: "2026-01-01", to: "2026-12-31" }));
    expect(() => calculateResourcePlan(resourcePlanFixture({ from: "2026-01-01", to: "2026-12-31", selectedAssignments: rows, fullProjectAssignments: rows }))).toThrow(expect.objectContaining({ dimension: "assignmentDays", actual: 1000100 }));
  });
  it("rejects whole period projection instead of silently cutting periods or rows", () => {
    const resources = Array.from({ length: 100 }, (_, i) => r(String(i)));
    const input = resourcePlanFixture({ from: "2026-01-01", to: "2026-12-31", resources, capacityResourceIds: resources.map((r) => r.resourceId), selectedAssignments: [], fullProjectAssignments: [] });
    expect(() => calculateResourcePlan(input)).toThrow(ResourcePlanLimitError);
  });
  it("materializes 985500 Assignment-days with complete month/resource/Milestone totals", () => {
    const resources = Array.from({ length: 40 }, (_, i) => r(`R${String(i).padStart(3, "0")}`, [`G${i % 5}`]));
    const rows = Array.from({ length: 2700 }, (_, i) => a(`A${i}`, resources[i % 40].resourceId, 50, { from: "2026-01-01", to: "2026-12-31", milestoneTaskId: `M${Math.floor(i / 40) % 2}`, groupIds: [...resources[i % 40].groupIds] }));
    const input = resourcePlanFixture({ from: "2026-01-01", to: "2026-12-31", granularity: "month", resources, capacityResourceIds: resources.map((r) => r.resourceId), selectedAssignments: rows, fullProjectAssignments: rows });
    const started = performance.now(), result = calculateResourcePlan(input), elapsedMs = performance.now() - started;
    const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
    expect(result.periods).toHaveLength(12); expect(result.resources).toHaveLength(40); expect(result.groups).toHaveLength(5);
    expect(result.totals.summary.project.capacityMd).toBe(10440);
    expect(result.totals.summary.selected.knownMd).toBe(352350);
    expect(result.totals.cells.reduce((n, cell) => n + cell.selected.knownMd, 0)).toBe(result.totals.summary.selected.knownMd);
    console.info(JSON.stringify({ resourcePlanBenchmark: { resources: 40, groups: 5, assignments: 2700, days: 365, resourceDays: 14600, assignmentDays: 985500, matrixCells: 1512, elapsedMs, bytes } }));
  });
});
