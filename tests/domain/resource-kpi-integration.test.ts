import { describe, expect, it } from "vitest";
import { calculateResourceKpi, prepareResourceKpiSnapshot, selectResourceKpiAssignments } from "../../src/domain/resources/resource-kpi";
import { calculateResourcePlan, getResourcePlanDailyPage, getResourcePlanDayAssignments, type ResourcePlanInput } from "../../src/domain/resources/resource-plan";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import { RESOURCE_KPI_INTEGRATION as c, resourceKpiIntegrationFixture } from "../fixtures/resource-kpi-integration";

function plan(input = resourceKpiIntegrationFixture(), granularity: "week" | "month" = "week"): ResourcePlanInput {
  const prepared = prepareResourceKpiSnapshot(input), all = selectResourceKpiAssignments(prepared, {}).assignments;
  return { ...input, mdPerMm: prepared.mdPerMm, granularity, capacityResourceIds: input.resources.map(r => r.resourceId),
    selectedAssignments: selectResourceKpiAssignments(prepared).assignments, fullProjectAssignments: all,
    limits: { resourceDays: 200000, assignmentDays: 1000000, matrixCells: 5000 } };
}

describe("#530 named six-Task cross-projection oracle", () => {
  it("keeps the exact named Task/Assignment/Milestone and nonadditive raw totals", () => {
    const input = resourceKpiIntegrationFixture(), before = JSON.stringify(input), report = calculateResourceKpi(input);
    expect(report.total).toMatchObject({ taskCount: 4, resourceCount: 2, assignmentCount: 5, effort: { knownMd: 11.5, plannedMd: 11.5, plannedMm: 0.575, unsetCount: 1, state: "partial" } });
    expect(report.assignments.map(r => [r.assignmentId, r.plannedMd])).toEqual([["T1-A", 2.5], ["T1-B", 5], ["T2-A", 3], ["T3-B", 1], ["T6-A", null]]);
    expect(report.milestones.map(m => [m.milestoneTaskId, m.effort.knownMd])).toEqual([["M1", 7.5], ["M2", 3], [null, 1]]);
    expect(report.resources.map(r => [r.id, r.effort.knownMd])).toEqual([["A", 5.5], ["B", 6]]);
    expect(report.groups.reduce((n, g) => n + g.effort.knownMd, 0)).toBe(17);
    expect(report.diagnostics).toMatchObject({ denominator: 6, completelyUnassigned: { taskIds: ["T4"] }, groupOnly: { taskIds: ["T5"] }, unsetAssignmentIds: ["T6-A"] });
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(["week", "month"] as const)("matches %s period, daily, individual and Assignment raw metrics", granularity => {
    const input = plan(undefined, granularity), result = calculateResourcePlan(input);
    expect(result.totals.summary.selected).toMatchObject({ capacityMd: 10, plannedMm: 0.575, unknownAssignmentCount: 1, unknownResourceDayCount: 5, partial: true, knownPeakResourceDailyLoadPercent: 120 });
    expect(result.totals.summary.selected.knownMd).toBeCloseTo(11.5, 14);
    expect(result.totals.summary.selected.excessMd).toBeCloseTo(1.5, 14);
    expect(result.totals.cells.reduce((n, row) => n + row.selected.knownMd, 0)).toBeCloseTo(11.5, 14);
    const daily = getResourcePlanDailyPage(input, { row: { kind: "total" }, periodKey: "all", demandScope: "selected" }, { offset: 0, limit: 100 });
    expect(daily.rows.map(row => row.date)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(daily.rows.reduce((n, row) => n + row.metrics.knownMd, 0)).toBeCloseTo(11.5, 14);
    const raw = getResourcePlanDayAssignments(input, { row: { kind: "resource", resourceId: "A" }, date: c.from, demandScope: "selected" }, { offset: 0, limit: 100 });
    expect(raw.rows.map(row => [row.assignmentId, row.plannedMd])).toEqual([["T1-A", 0.5], ["T2-A", 0.6], ["T6-A", null]]);
  });
  it("uses OR within and AND across on the same personal Assignment", () => {
    const input = resourceKpiIntegrationFixture(); input.filters = { resourceIds: ["A", "B"], roles: ["DEVELOPER", "EQUIPMENT_OWNER"], developerGrades: ["INTERMEDIATE"] };
    expect(calculateResourceKpi(input).total.assignmentIds).toEqual(["T1-B", "T3-B"]);
    input.filters = { roles: ["DEVELOPER"], developerGrades: ["INTERMEDIATE"] };
    const empty = calculateResourceKpi(input); expect(empty.total.assignmentCount).toBe(0); expect(empty.total.completion.percent).toBeNull();
    expect(empty.diagnostics.denominator).toBe(6); expect(empty.diagnostics.personallyUnassigned.taskIds).toEqual(["T4", "T5"]);
  });
  it("keeps full-stage Ready and planned demand invariant under personal/status filters", () => {
    const input = resourceKpiIntegrationFixture(), base = calculateResourceKpi(input); input.filters = { taskIds: ["T2"], resourceIds: ["A"] };
    expect(calculateResourceKpi(input).fullMilestones).toEqual(base.fullMilestones);
    input.filters = {}; input.tasks = input.tasks.map(t => t.type === "task" ? { ...t, progress: 100, status: "completed" } : t);
    expect(calculateResourceKpi(input).total.effort).toEqual(base.total.effort);
    expect(calculateResourcePlan(plan(input)).totals.summary.selected.knownMd).toBeCloseTo(11.5, 14);
  });
  it("distinguishes omitted/explicit null M/M, all unset, configured zero and empty", () => {
    const input = resourceKpiIntegrationFixture(); delete input.mdPerMm;
    expect(calculateResourceKpi(input).total.effort.plannedMm).toBeNull(); input.mdPerMmEnvironment = "21";
    expect(calculateResourceKpi(input).total.effort.plannedMm).toBe(11.5 / 21); input.mdPerMm = null;
    expect(calculateResourceKpi(input).total.effort.plannedMm).toBeNull(); input.filters = { taskIds: ["T6"] };
    expect(calculateResourceKpi(input).total.effort).toMatchObject({ plannedMd: null, state: "unset", knownMd: 0 });
    input.filters = { taskIds: ["T4"] }; expect(calculateResourceKpi(input).total.effort).toMatchObject({ plannedMd: 0, state: "empty" });
    const zero = resourceKpiIntegrationFixture(); zero.projectCalendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [5, 6, 7, 8, 9].map(day => ({ date: `2026-10-0${day}` })) }); zero.filters = { taskIds: ["T3"] };
    expect(calculateResourceKpi(zero).total.effort).toMatchObject({ plannedMd: 0, state: "configured", partial: false });
  });
  it("preserves all Group calendar layers, Resource priority and rejects sibling conflicts", () => {
    const input = resourceKpiIntegrationFixture(); input.filters = { groupIds: ["G1"] };
    input.calendarExceptions = [{ date: c.from, targetType: "RESOURCE_GROUP", targetId: "G2", dayType: "NON_WORKING", ruleId: "G2-off", ruleName: "off" }];
    expect(calculateResourceKpi(input).total.effort.knownMd).toBe(10.4); expect(calculateResourcePlan(plan(input)).totals.summary.selected.capacityMd).toBe(9);
    input.calendarExceptions = [...input.calendarExceptions, { date: c.from, targetType: "RESOURCE", targetId: "A", dayType: "WORKING", ruleId: "A-on", ruleName: "on" }];
    expect(calculateResourceKpi(input).total.effort.knownMd).toBe(11.5);
    input.calendarExceptions = [...input.calendarExceptions, { date: c.from, targetType: "RESOURCE_GROUP", targetId: "G1", dayType: "WORKING", ruleId: "G1-on", ruleName: "on" }];
    expect(() => calculateResourceKpi(input)).toThrow("Conflicting resource calendar");
  });
  it("keeps peak150/excess0.5 when a derived two-day plan averages75", () => {
    const input = resourceKpiIntegrationFixture(); input.to = "2026-10-06"; input.resources = input.resources.slice(0, 1);
    input.assignments = input.assignments.filter(a => a.targetId === "A" && a.allocationPercent !== null).map((a, i) => ({ ...a, allocationPercent: i === 0 ? 100 : 50, end: c.from }));
    const metrics = calculateResourcePlan(plan(input)).totals.summary.selected;
    expect(metrics).toMatchObject({ capacityMd: 2, knownMd: 1.5, loadPercent: 75, peakDailyLoadPercent: 150, excessMd: 0.5, overAllocatedDayCount: 1 });
  });
  it("keeps hidden incomplete members and predecessor blocking in a selected completed slice", () => {
    const input = resourceKpiIntegrationFixture(); input.tasks = input.tasks.map(t => t.taskId === "T2" ? { ...t, progress: 100, status: "completed" } : t);
    input.links = [{ id: "stage-order", predecessorTaskId: "M1", successorTaskId: "M2", type: "FS", lag: 0 }];
    input.filters = { taskIds: ["T2"], resourceIds: ["A"] };
    const report = calculateResourceKpi(input), m2 = report.fullMilestones.find(m => m.milestoneTaskId === "M2")!.stageGate;
    expect(report.total.completed.count).toBe(1); expect(report.total.completion.percent).toBe(100);
    expect(m2).toMatchObject({ ready: false, blocked: true, incompleteMemberTaskIds: ["T6"], incompletePredecessorMilestoneTaskIds: ["M1"] });
    expect(report.total.effort.knownMd).toBe(3);
  });
  it("enforces finite preallocation budgets rather than silently truncating", () => {
    const input = resourceKpiIntegrationFixture(); input.maxProjectionCells = 1;
    expect(() => calculateResourceKpi(input)).toThrow("cell limit");
    const p = plan(); p.limits.resourceDays = 9; expect(() => calculateResourcePlan(p)).toThrow("resourceDays");
    p.limits.resourceDays = 10; expect(calculateResourcePlan(p).totals.summary.selected.capacityMd).toBe(10);
  });
});
