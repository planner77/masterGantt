import { describe, expect, it } from "vitest";
import { calculateResourcePlan, getResourcePlanDailyPage, getResourcePlanDayResources, getResourcePlanDayAssignments, ResourcePlanLimitError } from "../../src/domain/resources/resource-plan";
import { calculateResourceKpi, prepareResourceKpiSnapshot, selectResourceKpiAssignments } from "../../src/domain/resources/resource-kpi";
import { resourceKpiFixture } from "../fixtures/resource-kpi";
import { resourcePlanFixture, resourcePlanAssignment as a, resourcePlanResource as r } from "../fixtures/resource-plan";
const total = (input = resourcePlanFixture()) => calculateResourcePlan(input).totals.summary;
const page = { offset: 0, limit: 100 };
describe("Resource Plan pure daily demand and capacity", () => {
  it("calculates five days at 50%=2.5MD and explicit MM with period/raw parity", () => {
    const output = calculateResourcePlan(resourcePlanFixture());
    expect(output.totals.summary.selected).toMatchObject({ capacityMd: 5, knownMd: 2.5, plannedMd: 2.5, plannedMm: 0.125, loadPercent: 50, peakDailyLoadPercent: 50, state: "configured" });
    expect(output.totals.cells.reduce((sum, cell) => sum + cell.selected.knownMd, 0)).toBe(2.5);
    expect(output.resources[0].milestones[0]).toMatchObject({ capacityReferenceOnly: true, projectReferenceOnly: true, projectReferenceRow: { kind: "resource", resourceId: "R1" } });
  });
  it("uses identical existing KPI raw Assignment arithmetic and full Group calendars", () => {
    const raw = resourceKpiFixture(); raw.calendarExceptions = [{ date: "2026-10-06", dayType: "WORKING", targetType: "RESOURCE", targetId: "R1", ruleId: "X", ruleName: "work" }];
    const prepared = prepareResourceKpiSnapshot(raw), selected = selectResourceKpiAssignments(prepared).assignments;
    const plan = resourcePlanFixture({ from: raw.from, to: raw.to, mdPerMm: prepared.mdPerMm, projectCalendar: raw.projectCalendar, calendarExceptions: raw.calendarExceptions, resources: raw.resources, capacityResourceIds: ["R1", "R2"], selectedAssignments: selected, fullProjectAssignments: selected });
    expect(total(plan).selected.knownMd).toBeCloseTo(calculateResourceKpi(raw).total.effort.knownMd, 12);
    expect(total(plan).selected.state).toBe("partial");
  });
  it("keeps peak150 and excess0.5 when two-day average is75", () => {
    const rows = [a("A", "R1", 100, { to: "2026-10-05" }), a("B", "R1", 50, { to: "2026-10-05" })];
    expect(total(resourcePlanFixture({ to: "2026-10-06", selectedAssignments: rows, fullProjectAssignments: rows })).project).toMatchObject({ capacityMd: 2, loadPercent: 75, peakDailyLoadPercent: 150, overAllocatedDayCount: 1, overAllocatedResourceDayCount: 1, overAllocatedResourceCount: 1, excessMd: 0.5 });
  });
  it("preserves full Project140 while selected Milestone80 and makes reference drill explicit", () => {
    const rows = [a("A", "R1", 80, { to: "2026-10-05" }), a("B", "R1", 60, { to: "2026-10-05", milestoneTaskId: "M2" })];
    const input = resourcePlanFixture({ to: "2026-10-05", selectedAssignments: rows.slice(0, 1), fullProjectAssignments: rows });
    expect(total(input).selected.loadPercent).toBe(80); expect(total(input).project.loadPercent).toBe(140); expect(total(input).project.excessMd).toBeCloseTo(0.4);
    expect(getResourcePlanDayAssignments(input, { row: { kind: "resource", resourceId: "R1" }, date: input.from, demandScope: "project" }, page).rows).toHaveLength(2);
    expect(getResourcePlanDayAssignments(input, { row: { kind: "resourceMilestone", resourceId: "R1", milestoneTaskId: "M1" }, date: input.from, demandScope: "project" }, page).rows).toHaveLength(1);
  });
  it("finds individual150 behind Group75 and pages numeric individuals including zero load", () => {
    const rows = [a("A", "R1", 100, { to: "2026-10-05" }), a("B", "R1", 50, { to: "2026-10-05" })];
    const input = resourcePlanFixture({ to: "2026-10-05", capacityResourceIds: ["R1", "R2"], resources: [r("R1"), r("R2")], selectedAssignments: rows, fullProjectAssignments: rows });
    const group = calculateResourcePlan(input).groups[0].summary.project;
    expect(group).toMatchObject({ capacityMd: 2, peakDailyLoadPercent: 75, peakResourceDailyLoadPercent: 150, excessMd: 0.5, overAllocatedResourceCount: 1 });
    const daily = getResourcePlanDayResources(input, { row: { kind: "group", groupId: "G1" }, date: input.from, demandScope: "project" }, { offset: 0, limit: 1 });
    expect(daily).toMatchObject({ totalCount: 2, nextOffset: 1 }); expect(daily.rows[0].metrics.loadPercent).toBe(150);
    expect(getResourcePlanDayResources(input, { row: { kind: "group", groupId: "G1" }, date: input.from, demandScope: "project" }, { offset: 1, limit: 1 }).rows[0].metrics).toMatchObject({ state: "empty", loadPercent: 0, capacityMd: 1 });
  });
  it("deduplicates Grand capacity/resource-days across Group Role Milestone classifications", () => {
    const rows = [a("A"), a("B", "R1", 50, { milestoneTaskId: null })];
    const output = calculateResourcePlan(resourcePlanFixture({ selectedAssignments: rows, fullProjectAssignments: rows }));
    expect(output.totals.summary.project.capacityMd).toBe(5); expect(output.groups.reduce((sum, g) => sum + g.summary.project.capacityMd, 0)).toBe(10);
    expect(output.resources[0].milestones.reduce((sum, m) => sum + m.summary.selected.knownMd, 0)).toBe(output.totals.summary.selected.knownMd);
    expect(output.metadata.groupSubtotalsAdditive).toBe(false); expect(output.metadata.milestoneCapacityAdditive).toBe(false);
  });
  it("counts unique over-dates separately from resource-days and people", () => {
    const rows = [a("A", "R1", 100), a("B", "R1", 50), a("C", "R2", 100), a("D", "R2", 50)];
    expect(total(resourcePlanFixture({ capacityResourceIds: ["R1", "R2"], resources: [r("R1"), r("R2")], selectedAssignments: rows, fullProjectAssignments: rows })).project).toMatchObject({ overAllocatedDayCount: 5, overAllocatedResourceDayCount: 10, overAllocatedResourceCount: 2, excessMd: 5 });
  });
  it("keeps null weekend assignments distinct across monthly boundaries even at zero capacity", () => {
    const rows = [a("U", "R1", null, { from: "2026-10-31", to: "2026-11-01" })];
    const input = resourcePlanFixture({ from: "2026-10-31", to: "2026-11-01", granularity: "month", selectedAssignments: rows, fullProjectAssignments: rows });
    const output = calculateResourcePlan(input);
    for (const cell of output.totals.cells) expect(cell.selected).toMatchObject({ capacityMd: 0, plannedMd: null, state: "unset", unknownAssignmentCount: 1, unknownResourceDayCount: 0, loadPercent: null, peakDailyLoadPercent: null });
    expect(output.totals.summary.selected.unknownAssignmentCount).toBe(1);
    const configured = a("K", "R1", 50, { from: input.from, to: input.to }); input.selectedAssignments = input.fullProjectAssignments = [...rows, configured];
    expect(total(input).selected).toMatchObject({ knownMd: 0, plannedMd: 0, state: "partial", unknownAssignmentCount: 1, loadPercent: null });
    input.calendarExceptions = [{ date: input.from, dayType: "WORKING", targetType: "RESOURCE", targetId: "R1", ruleId: "W", ruleName: "work" }];
    expect(total(input).selected).toMatchObject({ capacityMd: 1, knownMd: 0.5, unknownResourceDayCount: 1, state: "partial" });
  });
  it("distinguishes all unset, partial known overload, no selected work, no population, no MM basis", () => {
    const rows = [a("U", "R1", null)];
    expect(total(resourcePlanFixture({ selectedAssignments: rows, fullProjectAssignments: rows })).selected).toMatchObject({ plannedMd: null, loadPercent: null, knownLoadPercent: 0, state: "unset", unknownResourceDayCount: 5 });
    const partial = [...rows, a("K1", "R1", 100), a("K2", "R1", 50)];
    expect(total(resourcePlanFixture({ selectedAssignments: partial, fullProjectAssignments: partial })).selected).toMatchObject({ plannedMd: 7.5, partial: true, state: "partial", loadPercent: 150, overAllocatedDayCount: 5 });
    expect(total(resourcePlanFixture({ selectedAssignments: [] })).selected).toMatchObject({ capacityMd: 5, state: "empty", plannedMd: 0, loadPercent: 0 });
    expect(total(resourcePlanFixture({ capacityResourceIds: [], selectedAssignments: [], fullProjectAssignments: [] })).selected).toMatchObject({ capacityMd: 0, state: "empty", loadPercent: null });
    expect(total(resourcePlanFixture({ mdPerMm: null })).selected.plannedMm).toBeNull();
  });
  it("applies Group and Resource overrides, preserves other Group holiday and same-layer conflict", () => {
    const input = resourcePlanFixture(); input.calendarExceptions = [{ date: input.from, dayType: "NON_WORKING", targetType: "RESOURCE_GROUP", targetId: "G2", ruleId: "G", ruleName: "off" }];
    expect(total(input).project.capacityMd).toBe(4);
    input.calendarExceptions = [...input.calendarExceptions, { date: input.from, dayType: "WORKING", targetType: "RESOURCE", targetId: "R1", ruleId: "R", ruleName: "work" }]; expect(total(input).project.capacityMd).toBe(5);
    input.calendarExceptions = [input.calendarExceptions[0], { date: input.from, dayType: "WORKING", targetType: "RESOURCE_GROUP", targetId: "G1", ruleId: "G1", ruleName: "work" }]; expect(() => total(input)).toThrow("Conflicting resource calendar");
  });
  it("suppresses floating-point phantom overload without rounding raw demand", () => {
    const rows = Array.from({ length: 10 }, (_, i) => a(String(i), "R1", 10));
    const metrics = total(resourcePlanFixture({ selectedAssignments: rows, fullProjectAssignments: rows })).project;
    expect(metrics.knownMd).toBeCloseTo(5, 14); expect(metrics.overAllocatedDayCount).toBe(0); expect(metrics.excessMd).toBe(0);
    const slightlyOver = [...rows, a("tiny", "R1", 0.00001)]; expect(total(resourcePlanFixture({ selectedAssignments: slightlyOver, fullProjectAssignments: slightlyOver })).project.overAllocatedDayCount).toBe(5);
  });
  it("pages calendar dates and separate stable bounded contribution IDs including unknown non-workdays", () => {
    const input = resourcePlanFixture(); const daily = getResourcePlanDailyPage(input, { row: { kind: "total" }, periodKey: "all", demandScope: "project" }, { offset: 1, limit: 2 });
    expect(daily).toMatchObject({ totalCount: 5, nextOffset: 3 }); expect(daily.rows.map((r) => r.date)).toEqual(["2026-10-06", "2026-10-07"]);
    const empty = getResourcePlanDayAssignments(input, { row: { kind: "resourceMilestone", resourceId: "R1", milestoneTaskId: null }, date: input.from, demandScope: "selected" }, page); expect(empty.totalCount).toBe(0);
    expect(() => getResourcePlanDailyPage(input, { row: { kind: "total" }, periodKey: "bad", demandScope: "project" }, page)).toThrow();
    expect(() => getResourcePlanDayResources(input, { row: { kind: "group", groupId: "foreign" }, date: input.from, demandScope: "project" }, page)).toThrow();
    expect(() => getResourcePlanDayAssignments(input, { row: { kind: "resource", resourceId: "foreign" }, date: input.from, demandScope: "project" }, page)).toThrow();
    expect(() => getResourcePlanDayAssignments(input, { row: { kind: "total" }, date: "2026-10-01", demandScope: "project" }, page)).toThrow();
    expect(() => getResourcePlanDailyPage(input, { row: { kind: "total" }, periodKey: "all", demandScope: "project" }, { offset: 0, limit: 101 })).toThrow();
  });
  it("rejects budget overflow before dense projection and matching-subset/finite input violations", () => {
    for (const dimension of ["resourceDays", "assignmentDays", "matrixCells"] as const) {
      const input = resourcePlanFixture(); input.limits[dimension] = 1; expect(() => calculateResourcePlan(input)).toThrow(ResourcePlanLimitError);
    }
    expect(() => calculateResourcePlan(resourcePlanFixture({ selectedAssignments: [a("missing")] }))).toThrow("matching subset");
    expect(() => calculateResourcePlan(resourcePlanFixture({ selectedAssignments: [a("A1", "R1", 51)] }))).toThrow("matching subset");
    expect(() => calculateResourcePlan(resourcePlanFixture({ fullProjectAssignments: [a("bad", "R1", 0)], selectedAssignments: [] }))).toThrow("allocation");
    expect(() => calculateResourcePlan(resourcePlanFixture({ mdPerMm: NaN }))).toThrow();
    expect(() => calculateResourcePlan(resourcePlanFixture({ capacityResourceIds: ["R1", "R1"] }))).toThrow();
    expect(() => calculateResourcePlan(resourcePlanFixture({ resources: [r("R1"), r("R1")] }))).toThrow("Resource metadata");
    expect(() => getResourcePlanDailyPage(resourcePlanFixture(), { row: { kind: "invalid" } as never, periodKey: "all", demandScope: "project" }, page)).toThrow("row selector");
  });
  it("compares matching row values independently of property order and rejects duplicate grains", () => {
    const original = a("A1");
    const reversed = Object.fromEntries(Object.entries(original).reverse()) as typeof original;
    expect(total(resourcePlanFixture({ selectedAssignments: [reversed], fullProjectAssignments: [original] })).selected.knownMd).toBe(2.5);
    expect(() => total(resourcePlanFixture({ selectedAssignments: [original, original] }))).toThrow("matching subset");
    expect(() => total(resourcePlanFixture({ fullProjectAssignments: [original, original] }))).toThrow("Duplicate Resource Plan Assignment");
  });
  it("never mutates input or silently adds global resources to authoritative population", () => {
    const input = resourcePlanFixture({ resources: [r("R1"), r("UNASSIGNED")], selectedAssignments: [] });
    const before = JSON.stringify(input); const output = calculateResourcePlan(input); expect(JSON.stringify(input)).toBe(before); expect(output.population.resourceIds).toEqual(["R1"]);
  });
});
