import { describe, expect, it } from "vitest";
import { calculateResourceKpi, getResourceKpiDiagnostics, prepareResourceKpiSnapshot, renderResourceKpi, selectResourceKpiAssignments, summarizeResourceKpiAssignments } from "../../src/domain/resources/resource-kpi";
import { resourceKpiFixture } from "../fixtures/resource-kpi";

describe("shared Resource KPI snapshot/selection/totals helpers", () => {
  it("reuses full membership and Resource calendars/raw rows across selected and reference scopes without input writes", () => {
    const input = resourceKpiFixture(); input.filters = { milestoneIds: ["M1"], groupIds: ["G1"] };
    input.calendarExceptions = [{ date: "2026-10-05", targetType: "RESOURCE_GROUP", targetId: "G2", dayType: "NON_WORKING", ruleId: "override", ruleName: "full Group" }];
    const before = JSON.stringify(input), prepared = prepareResourceKpiSnapshot(input);
    const reference = selectResourceKpiAssignments(prepared, { ...input.filters, milestoneIds: [] }), selected = selectResourceKpiAssignments(prepared);
    expect(prepared.calendars.size).toBe(2); expect(prepared.assignmentRows.size).toBe(5);
    expect(selected.assignments[0].effectiveWorkingDays).toBe(3);
    expect(selected.assignments.every((row) => reference.assignments.includes(row))).toBe(true);
    expect(renderResourceKpi(prepared, selected)).toEqual(calculateResourceKpi(input)); expect(JSON.stringify(input)).toBe(before);
    expect(prepared.projection.gates.get("M1")!.ready).toBe(false);
  });
  it("computes exact excluded-set distinct/raw metrics and canonical Assignment deduplication", () => {
    const prepared = prepareResourceKpiSnapshot(resourceKpiFixture());
    const all = selectResourceKpiAssignments(prepared), selected = selectResourceKpiAssignments(prepared, { milestoneIds: ["M1"] });
    const selectedIds = new Set(selected.assignments.map((row) => row.assignmentId));
    const excluded = all.assignments.filter((row) => !selectedIds.has(row.assignmentId));
    expect(summarizeResourceKpiAssignments(prepared, excluded)).toMatchObject({ taskCount: 1, resourceCount: 1, assignmentCount: 1, assignedTaskProgress: { numerator: 0, denominator: 2, percent: 0 }, effort: { plannedMd: 0, state: "configured" } });
    expect(summarizeResourceKpiAssignments(prepared, [...all.assignments, ...all.assignments])).toEqual(summarizeResourceKpiAssignments(prepared, all.assignments));
    expect(() => summarizeResourceKpiAssignments(prepared, [...all.assignments, { ...all.assignments[0], plannedMd: 999 }])).toThrow("Conflicting KPI input");
  });
  it("supports totals-only reference beyond selected cell budgets and T0 diagnostics without building cells", () => {
    const input = resourceKpiFixture(); input.maxProjectionCells = 2;
    const prepared = prepareResourceKpiSnapshot(input), scope = selectResourceKpiAssignments(prepared);
    expect(summarizeResourceKpiAssignments(prepared, scope.assignments).assignmentCount).toBe(5);
    expect(getResourceKpiDiagnostics(prepared, scope)).toMatchObject({ denominator: 5, personallyUnassigned: { count: 2 } });
    expect(() => renderResourceKpi(prepared, scope)).toThrow("cell limit");
    expect(summarizeResourceKpiAssignments(prepared, []).completion.percent).toBeNull();
  });
});
