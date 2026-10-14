import { describe, expect, it } from "vitest";
import { prepareResourceKpiSnapshot, selectResourceKpiAssignments, type ResourceKpiInput } from "../../src/domain/resources/resource-kpi";
import { selectResourceTargetPlanScope } from "../../src/domain/resources/resource-target-kpi";
import { calculateResourcePlan, getResourcePlanDailyPage, getResourcePlanDayAssignments, getResourcePlanDayResources, type ResourcePlanInput } from "../../src/domain/resources/resource-plan";
import { resourceTargetPlanFixture } from "../fixtures/resource-target-plan";

const page = { offset: 0, limit: 100 };
function planInput(input: ResourceKpiInput, granularity: ResourcePlanInput["granularity"] = "week"): ResourcePlanInput {
  const prepared = prepareResourceKpiSnapshot(input);
  return { ...selectResourceTargetPlanScope(prepared), resources: prepared.resources,
    projectPublicId: input.projectPublicId, from: input.from, to: input.to, asOfDate: input.asOfDate,
    granularity, mdPerMm: prepared.mdPerMm, projectCalendar: input.projectCalendar,
    calendarExceptions: input.calendarExceptions,
    limits: { resourceDays: 200000, assignmentDays: 1000000, matrixCells: 5000 } };
}

describe("#622 existing Resource Plan with canonical Target selection", () => {
  it("AC1 preserves R, same-R Project140 and exact outside-Target daily Assignment reasons", () => {
    const input = resourceTargetPlanFixture(), baseline = calculateResourcePlan(planInput(input));
    input.filters = { targetIds: ["TARGET-A"] };
    const plan = planInput(input), output = calculateResourcePlan(plan), resource = output.resources.find(row => row.resourceId === "R1")!;
    expect(output.population).toEqual(baseline.population);
    expect(output.totals.summary.project).toEqual(baseline.totals.summary.project);
    expect(resource.summary.selected).toMatchObject({ capacityMd: 5, knownMd: 4, loadPercent: 80, overAllocatedDayCount: 0 });
    expect(resource.summary.project).toMatchObject({ capacityMd: 5, knownMd: 7, loadPercent: 140, overAllocatedDayCount: 5, overAllocatedResourceCount: 1 });
    expect(resource.summary.project.excessMd).toBeCloseTo(2);
    const selector = { row: { kind: "resource" as const, resourceId: "R1" }, date: input.from };
    expect(getResourcePlanDayAssignments(plan, { ...selector, demandScope: "selected" }, page).rows.map(row => row.assignmentId)).toEqual(["A80"]);
    const outside = getResourcePlanDayAssignments(plan, { ...selector, demandScope: "project" }, page).rows;
    expect(outside.map(row => [row.assignmentId, row.taskId, row.allocationPercent, row.knownMd])).toEqual([
      ["A60", "OUTSIDE", 60, 0.6], ["A80", "SELECTED", 80, 0.8],
    ]);
    expect(output.resources.find(row => row.resourceId === "R2")!.summary.selected).toMatchObject({ state: "empty", capacityMd: 5, knownMd: 0 });
    const prepared = prepareResourceKpiSnapshot(input);
    expect(prepared.logistics!.resolved.get("SELECTED")!.effectiveMembers.find(row => row.entityId === "MCS-1")!.provenance.map(row => row.bindingId)).toEqual(["DIRECT-A", "DIRECT-B", "INHERITED-A"]);
    expect(prepared.logistics!.resolved.get("OUTSIDE")).toMatchObject({ effectiveTargetIds: [], legacySources: [{ sourceKind: "legacy_direct", entityId: "MCS-1" }] });
  });

  it("AC2 shows overloaded individuals behind a normal Group average without offsetting excess", () => {
    const input = resourceTargetPlanFixture(); input.filters = { targetIds: ["TARGET-A"] };
    const plan = planInput(input), output = calculateResourcePlan(plan);
    expect(output.groups.find(row => row.groupId === "G1")!.summary.project).toMatchObject({ loadPercent: 95, peakResourceDailyLoadPercent: 140, overAllocatedResourceCount: 1 });
    const individuals = getResourcePlanDayResources(plan, { row: { kind: "group", groupId: "G1" }, date: input.from, demandScope: "project" }, page);
    expect(individuals.rows.map(row => [row.resourceId, row.metrics.loadPercent])).toEqual([["R1", 140], ["R2", 50]]);
    expect(individuals.rows[0].metrics.excessMd).toBeCloseTo(0.4);
    const daily = getResourcePlanDailyPage(plan, { row: { kind: "group", groupId: "G1" }, periodKey: "all", demandScope: "project" }, page);
    expect(daily.rows[0].metrics).toMatchObject({ loadPercent: 95, overAllocatedResourceDayCount: 1 });
    expect(daily.rows[0].metrics.excessMd).toBeCloseTo(0.4);
  });

  it("AC2 keeps a150% day visible when the next day's demand is0 and the average is75%", () => {
    const input = resourceTargetPlanFixture(); input.to = "2026-10-06";
    input.assignments = input.assignments.filter(row => row.targetId === "R1").map(row => ({ ...row, end: input.from, allocationPercent: row.assignmentId === "A60" ? 70 : 80 }));
    input.filters = { targetIds: ["TARGET-A"] };
    const plan = planInput(input), output = calculateResourcePlan(plan);
    expect(output.totals.summary.project).toMatchObject({ loadPercent: 75, peakDailyLoadPercent: 150, overAllocatedDayCount: 1, excessMd: 0.5 });
    expect(getResourcePlanDailyPage(plan, { row: { kind: "total" }, periodKey: "all", demandScope: "project" }, page).rows.map(row => row.metrics.loadPercent)).toEqual([150, 0]);
  });

  it("AC2/3 recomputes shared Target and multi-Group union rather than summing overlapping rows", () => {
    const input = resourceTargetPlanFixture();
    const one = calculateResourcePlan(planInput({ ...input, filters: { targetIds: ["TARGET-A"] } }));
    const two = calculateResourcePlan(planInput({ ...input, filters: { targetIds: ["TARGET-B"] } }));
    const union = calculateResourcePlan(planInput({ ...input, filters: { targetIds: ["TARGET-A", "TARGET-B"] } }));
    expect(one.totals.summary.selected).toEqual(two.totals.summary.selected);
    expect(union.totals.summary.selected).toEqual(one.totals.summary.selected);
    expect(union.totals.summary.selected).toMatchObject({ assignmentCount: 1, knownMd: 4, capacityMd: 10 });
    expect(union.groups.reduce((sum, row) => sum + row.summary.selected.knownMd, 0)).toBe(8);
    expect(union.groups.reduce((sum, row) => sum + row.summary.project.overAllocatedResourceDayCount, 0)).toBe(10);
    expect(union.totals.summary.project.overAllocatedResourceDayCount).toBe(5);
    expect(union.totals.summary.project.overAllocatedResourceCount).toBe(1);
    expect(union.metadata.groupSubtotalsAdditive).toBe(false);
  });

  it("AC2/3 preserves hidden Group calendars, null MM and unknown allocations across clipped month/week periods", () => {
    const input = resourceTargetPlanFixture(); input.from = "2026-10-30"; input.to = "2026-11-02"; input.mdPerMm = null;
    input.tasks = input.tasks.map(task => ({ ...task, start: input.from, end: input.to }));
    input.assignments = [...input.assignments, { assignmentId: "UNKNOWN", taskId: "UNKNOWN", kind: "resource", targetId: "R1", allocationPercent: null }];
    input.logistics.bindings = [...input.logistics.bindings, { id: "UNKNOWN-A", taskId: "UNKNOWN", targetId: "TARGET-A", scope: "self", selection: "whole", memberIds: [] }];
    input.filters = { targetIds: ["TARGET-A"], groupIds: ["G1"] };
    input.calendarExceptions = [
      { date: "2026-10-30", dayType: "NON_WORKING", targetType: "RESOURCE_GROUP", targetId: "G2", ruleId: "HIDDEN", ruleName: "hidden holiday" },
      { date: "2026-10-31", dayType: "WORKING", targetType: "RESOURCE", targetId: "R1", ruleId: "OVERRIDE", ruleName: "resource working Saturday" },
    ];
    const before = JSON.stringify(input), weekly = calculateResourcePlan({ ...planInput(input), projectionGroupIds: ["G1"] });
    const monthly = calculateResourcePlan({ ...planInput(input, "month"), projectionGroupIds: ["G1"] });
    expect(monthly.totals.summary).toEqual(weekly.totals.summary);
    expect(monthly.totals.summary.selected).toMatchObject({ capacityMd: 4, knownMd: 1.6, plannedMm: null, state: "partial", unknownAssignmentCount: 1, unknownResourceDayCount: 2 });
    expect(monthly.totals.cells.map(cell => cell.selected.knownMd)).toEqual([0.8, 0.8]);
    expect(monthly.totals.cells.reduce((sum, cell) => sum + cell.selected.knownMd, 0)).toBe(monthly.totals.summary.selected.knownMd);
    expect(monthly.totals.cells.reduce((sum, cell) => sum + cell.selected.unknownAssignmentCount, 0)).toBe(2);
    expect(monthly.totals.summary.selected.unknownAssignmentCount).toBe(1);
    const nonworking = getResourcePlanDayAssignments(planInput(input), { row: { kind: "resource", resourceId: "R1" }, date: "2026-10-30", demandScope: "selected" }, page);
    expect(nonworking.rows.map(row => [row.assignmentId, row.working, row.knownMd, row.plannedMd])).toEqual([["A80", false, 0, 0], ["UNKNOWN", false, 0, null]]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("AC2/3 preserves leap-day and ISO-year clipping with exact period/daily raw parity", () => {
    for (const [from, to, expectedWeekKeys, expectedMonthKeys] of [
      ["2024-02-28", "2024-03-01", ["2024-W09"], ["2024-02", "2024-03"]],
      ["2026-12-31", "2027-01-04", ["2026-W53", "2027-W01"], ["2026-12", "2027-01"]],
    ] as const) {
      const input = resourceTargetPlanFixture(); input.from = from; input.to = to;
      input.tasks = input.tasks.map(task => ({ ...task, start: from, end: to }));
      input.filters = { targetIds: ["TARGET-A", "TARGET-B"] };
      const weeklyInput = planInput(input), weekly = calculateResourcePlan(weeklyInput), monthly = calculateResourcePlan(planInput(input, "month"));
      expect(weekly.periods.map(period => period.key)).toEqual(expectedWeekKeys);
      expect(monthly.periods.map(period => period.key)).toEqual(expectedMonthKeys);
      expect(monthly.totals.summary).toEqual(weekly.totals.summary);
      const prepared = prepareResourceKpiSnapshot(input), raw = selectResourceKpiAssignments(prepared).assignments;
      expect(weekly.totals.summary.selected.knownMd).toBeCloseTo(raw.reduce((sum, row) => sum + row.plannedMd!, 0), 14);
      for (const scope of ["selected", "project"] as const) {
        const daily = getResourcePlanDailyPage(weeklyInput, { row: { kind: "total" }, periodKey: "all", demandScope: scope }, page).rows;
        expect(monthly.totals.cells.reduce((sum, cell) => sum + cell[scope].knownMd, 0)).toBeCloseTo(weekly.totals.summary[scope].knownMd, 14);
        expect(daily.reduce((sum, row) => sum + row.metrics.knownMd, 0)).toBeCloseTo(weekly.totals.summary[scope].knownMd, 14);
      }
      expect(monthly.totals.summary.project.overAllocatedResourceCount).toBe(1);
      expect(monthly.totals.cells.reduce((sum, cell) => sum + cell.project.overAllocatedResourceCount, 0)).toBe(2);
    }
  });

  it("AC2/6 keeps zero-capacity configured/unset/empty states distinct and Target omission backward compatible", () => {
    const input = resourceTargetPlanFixture(); input.from = "2026-10-10"; input.to = "2026-10-11";
    const baseline = calculateResourcePlan(planInput(input));
    expect(calculateResourcePlan(planInput({ ...input, logistics: undefined }))).toEqual(baseline);
    expect(calculateResourcePlan(planInput({ ...input, filters: { targetIds: [], workAreaIds: [], memberSystemIds: [] } }))).toEqual(baseline);
    const configured = calculateResourcePlan(planInput({ ...input, filters: { targetIds: ["TARGET-A"] } })).totals.summary.selected;
    expect(configured).toMatchObject({ capacityMd: 0, state: "configured", plannedMd: 0, loadPercent: null, peakDailyLoadPercent: null });
    input.assignments = input.assignments.map(row => row.assignmentId === "A80" ? { ...row, allocationPercent: null } : row);
    expect(calculateResourcePlan(planInput({ ...input, filters: { targetIds: ["TARGET-A"] } })).totals.summary.selected).toMatchObject({ capacityMd: 0, state: "unset", plannedMd: null, unknownAssignmentCount: 1, unknownResourceDayCount: 0 });
    expect(calculateResourcePlan(planInput({ ...input, filters: { targetIds: ["TARGET-UNUSED"] } })).totals.summary.selected).toMatchObject({ capacityMd: 0, state: "empty", plannedMd: 0, assignmentCount: 0, loadPercent: null });
  });
});
