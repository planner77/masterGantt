import { describe, expect, it } from "vitest";
import { calculateResourceKpi, prepareResourceKpiSnapshot, selectResourceKpiAssignments, type ResourceKpiFilters, type ResourceKpiInput } from "../../src/domain/resources/resource-kpi";
import { calculateResourceTargetKpi, selectResourceTargetPlanScope } from "../../src/domain/resources/resource-target-kpi";
import { calculateResourcePlan, getResourcePlanDailyPage, getResourcePlanDayAssignments, ResourcePlanLimitError, type ResourcePlanInput } from "../../src/domain/resources/resource-plan";
import { ResourceKpiTargetLimitError } from "../../src/domain/resources/resource-kpi-targets";
import { endFromStart, isWorkingDay, nextWorkingDay } from "../../src/domain/scheduling/calendar";
import { ISSUE_623_TARGET_RESOURCE as c, issue623TargetResourceFixture, issue623Resource530Fixture } from "../fixtures/issue-623-target-resource";
import { resourceKpiIntegrationFixture } from "../fixtures/resource-kpi-integration";

const page = { offset: 0, limit: 100 };
function planInput(input: ResourceKpiInput, granularity: ResourcePlanInput["granularity"] = "week"): ResourcePlanInput {
  const prepared = prepareResourceKpiSnapshot(input);
  return { ...selectResourceTargetPlanScope(prepared), resources: prepared.resources,
    projectPublicId: input.projectPublicId, from: input.from, to: input.to, asOfDate: input.asOfDate,
    granularity, mdPerMm: prepared.mdPerMm, projectCalendar: input.projectCalendar,
    calendarExceptions: input.calendarExceptions,
    limits: { resourceDays: 200000, assignmentDays: 1000000, matrixCells: 5000 } };
}
function assertPlanRawIdentity(input: ResourceKpiInput) {
  const report = calculateResourceTargetKpi(input), rawIds = report.kpi.total.assignmentIds;
  for (const granularity of ["week", "month"] as const) {
    const plan = planInput(input, granularity), result = calculateResourcePlan(plan);
    expect(result.totals.summary.selected.knownMd).toBeCloseTo(report.kpi.total.effort.knownMd, 14);
    expect(result.totals.summary.selected.assignmentCount).toBe(rawIds.length);
    expect(result.totals.summary.selected.state).toBe(report.kpi.total.effort.state);
    expect(result.totals.summary.selected.unknownAssignmentCount).toBe(report.kpi.total.effort.unsetCount);
    const daily = getResourcePlanDailyPage(plan, { row: { kind: "total" }, periodKey: "all", demandScope: "selected" }, page).rows;
    const assignments = daily.flatMap(day => getResourcePlanDayAssignments(plan, { row: { kind: "total" }, date: day.date, demandScope: "selected" }, page).rows);
    expect([...new Set(assignments.map(row => row.assignmentId))].sort()).toEqual([...rawIds].sort());
    expect(assignments.reduce((sum, row) => sum + row.knownMd, 0)).toBeCloseTo(report.kpi.total.effort.knownMd, 14);
    expect(daily.reduce((sum, day) => sum + day.metrics.knownMd, 0)).toBeCloseTo(report.kpi.total.effort.knownMd, 14);
    expect(result.totals.cells.reduce((sum, cell) => sum + cell.selected.knownMd, 0)).toBeCloseTo(report.kpi.total.effort.knownMd, 14);
  }
  return report;
}

describe("#623 Q1 shared Target/Resource acceptance oracle", () => {
  it("AC1 joins canonical provenance,15 equipment,2 ACS/1 MCS and A5/B5/union5 to the same period/daily ledger", () => {
    const input = issue623TargetResourceFixture(); input.filters = c.sharedFilters;
    // The shared HTTP/Domain oracle must itself satisfy persisted scheduling rules.
    for (const task of input.tasks) {
      if (task.type === "task") expect(task.end).toBe(endFromStart(task.start!, task.duration!, input.projectCalendar));
      if (task.type === "milestone") expect(isWorkingDay(task.start!, input.projectCalendar)).toBe(true);
    }
    expect(input.tasks.find(task => task.taskId === "M2")!.start).toBe(nextWorkingDay(input.tasks.find(task => task.taskId === "M1")!.end!, input.projectCalendar, false));
    const report = assertPlanRawIdentity(input), expected = c.expected.shared;
    expect(report.kpi.total).toMatchObject({ taskIds: [c.sharedTaskId], assignmentIds: expected.assignmentIds,
      effort: { knownMd: expected.knownMd, plannedMm: expected.plannedMm } });
    expect(report.projection.children.map(row => [row.id, row.totals.effort.knownMd, row.totals.assignmentIds])).toEqual([
      ["TARGET-A", 5, [c.sharedAssignmentId]], ["TARGET-B", 5, [c.sharedAssignmentId]],
    ]);
    expect(report.relatedMembers).toMatchObject({ equipmentIds: expected.equipmentIds, equipmentQuantity: expected.equipmentQuantity,
      systemIds: expected.systemIds, systemCount: expected.systemCount });
    expect(report.relatedMembers.members.filter(row => row.typeCode === "acs")).toHaveLength(2);
    expect(report.relatedMembers.members.find(row => row.entityId === "MCS-1")!.provenance.map(source => source.bindingId)).toEqual(expected.mcsBindingIds);
    expect(report.taskSources[0].effectiveTargetIds).toEqual(c.targetIds);
    expect(report.projection.children.reduce((sum, row) => sum + row.totals.effort.knownMd, 0)).toBe(10);
    expect(calculateResourcePlan(planInput(input)).totals.summary.selected.capacityMd).toBe(expected.capacityMd);
  });

  it("AC1 preserves the separate #53011.5 oracle under added Target context and exact selected Task union", () => {
    const input = issue623Resource530Fixture(), baseline = resourceKpiIntegrationFixture();
    expect(calculateResourceKpi(input)).toEqual(calculateResourceKpi(baseline));
    const full = assertPlanRawIdentity(input);
    expect(full.kpi.total.effort).toMatchObject({ knownMd: c.expected.resource530.knownMd, plannedMm: c.expected.resource530.plannedMm });
    input.filters = { targetIds: c.targetIds };
    const selected = assertPlanRawIdentity(input), plan = calculateResourcePlan(planInput(input));
    expect(selected.kpi.total.assignmentIds).toEqual(["T1-A", "T1-B"]);
    expect(selected.projection.children.map(row => row.totals.effort.knownMd)).toEqual([7.5, 7.5]);
    expect(plan.totals.summary.selected.knownMd).toBe(7.5);
    expect(plan.totals.summary.project.knownMd).toBeCloseTo(11.5, 14);
    expect(plan.totals.summary.selected.capacityMd).toBe(10);
  });

  it("AC1 distinguishes ACS-only same-binding scope from shared MCS legacy links across report and Plan", () => {
    const base = issue623TargetResourceFixture();
    const acs = assertPlanRawIdentity({ ...base, filters: { taskIds: ["ACS_ONLY"], targetIds: ["TARGET-A"], memberSystemIds: ["ACS-A"] } });
    expect(acs.kpi.total.assignmentIds).toEqual(["ACS_ONLY-R2"]);
    expect(acs.relatedMembers).toMatchObject({ equipmentQuantity: 0, equipmentIds: [], systemIds: ["ACS-A"], systemCount: 1 });
    const conflict = { ...base, filters: { taskIds: ["ACS_ONLY"], targetIds: ["TARGET-A"], memberEquipmentIds: ["AMR-A"] } };
    expect(assertPlanRawIdentity(conflict).kpi.total.assignmentIds).toEqual([]);
    expect(calculateResourcePlan(planInput(conflict)).population.resourceIds).toEqual(c.capacityResourceIds);
    const legacy = assertPlanRawIdentity({ ...base, filters: { targetIds: [null], directSystemIds: ["MCS-1"] } });
    expect(legacy.kpi.total.assignmentIds).toEqual(["LEGACY-R1"]);
    expect(legacy.taskSources[0]).toMatchObject({ taskId: "LEGACY", effectiveTargetIds: [], legacySources: [{ sourceKind: "legacy_direct", kind: "system", entityId: "MCS-1" }] });
    expect(legacy.projection.children.map(row => [row.id, row.sourceKinds])).toEqual([[null, ["legacy_direct"]]]);
  });

  it("AC1 uses T0 diagnostics before personal filtering and preserves null/known0/partial at the daily ledger", () => {
    const input = issue623TargetResourceFixture(), full = assertPlanRawIdentity(input), expected = c.expected.all;
    expect(full.kpi.total).toMatchObject({ taskCount: expected.taskCount, assignmentCount: expected.assignmentCount,
      resourceCount: expected.resourceCount, effort: { knownMd: expected.knownMd, plannedMm: expected.plannedMm, state: "partial", unsetAssignmentIds: expected.unknownAssignmentIds } });
    expect(full.diagnostics).toMatchObject({ denominator: expected.diagnosticTaskCount,
      completelyUnassigned: { taskIds: ["UNASSIGNED"] }, groupOnly: { taskIds: ["GROUP_ONLY"] }, unsetAssignmentIds: expected.unknownAssignmentIds });
    expect(full.kpi.groups.reduce((sum, group) => sum + group.effort.knownMd, 0)).toBe(expected.groupSubtotalSum);
    expect(calculateResourcePlan(planInput(input)).totals.summary.selected.capacityMd).toBe(expected.capacityMd);
    const personal = { ...input, filters: { taskIds: ["PARTIAL", "GROUP_ONLY", "UNASSIGNED"], resourceIds: ["R1"] } };
    const empty = assertPlanRawIdentity(personal);
    expect(empty.kpi.total.assignmentCount).toBe(0);
    expect(empty.diagnostics).toMatchObject({ denominator: 3, unsetAssignmentIds: ["PARTIAL-R3"] });
    expect(calculateResourcePlan(planInput(personal)).population.resourceIds).toEqual(["R1"]);
    expect(calculateResourcePlan(planInput(personal)).totals.summary.selected.capacityMd).toBe(5);
    const zero = assertPlanRawIdentity({ ...input, filters: { taskIds: ["ZERO"] } });
    expect(zero.kpi.total.effort).toMatchObject({ state: "configured", knownMd: 0, plannedMd: 0, partial: false });
    const unset = assertPlanRawIdentity({ ...input, mdPerMm: null, filters: { taskIds: ["UNSET"] } });
    expect(unset.kpi.total.effort).toMatchObject({ state: "unset", plannedMd: null, plannedMm: null, knownMd: 0 });
  });

  it("AC1 distinguishes full-Project KPI reference from same-R Plan reference with outside-Target140 reasons", () => {
    const input = issue623TargetResourceFixture(); input.filters = c.overloadFilters;
    const report = assertPlanRawIdentity(input), plan = planInput(input), result = calculateResourcePlan(plan), expected = c.expected.overload;
    expect(report.kpi.total.assignmentIds).toEqual(expected.selectedAssignmentIds);
    expect(report.projectReference.total.effort.knownMd).toBe(c.expected.all.knownMd);
    expect(result.population.resourceIds).toEqual(expected.resourceIds);
    expect(result.totals.summary.selected).toMatchObject({ knownMd: expected.selectedKnownMd, capacityMd: expected.capacityMd, loadPercent: expected.selectedLoadPercent });
    expect(result.totals.summary.project.knownMd).toBeCloseTo(expected.projectKnownMd, 14);
    expect(result.totals.summary.project.loadPercent).toBeCloseTo(expected.projectLoadPercent, 14);
    expect(result.totals.summary.project.excessMd).toBeCloseTo(expected.excessMd, 14);
    const reasons = getResourcePlanDayAssignments(plan, { row: { kind: "resource", resourceId: "R4" }, date: input.from, demandScope: "project" }, page).rows;
    expect(reasons.map(row => row.assignmentId)).toEqual(expected.projectAssignmentIds);
    const outside = prepareResourceKpiSnapshot(input).logistics!.resolved.get(reasons[0].taskId)!;
    expect(outside.effectiveTargetIds).toEqual(["TARGET-B"]);
    const full = calculateResourcePlan(planInput({ ...input, filters: {} }));
    expect(full.groups.find(group => group.groupId === "G1")!.summary.project).toMatchObject({ loadPercent: 100, overAllocatedResourceCount: 3, knownPeakResourceDailyLoadPercent: 140 });
    expect(full.totals.summary.project.excessMd).toBeCloseTo(5, 14);
  });

  it("AC1 reuses one prepared snapshot in changing query order without leaking cached Target/personal scopes", () => {
    const input = issue623TargetResourceFixture(), original = JSON.stringify(input), prepared = prepareResourceKpiSnapshot(input);
    const filters: ResourceKpiFilters[] = [
      c.sharedFilters, c.overloadFilters, { targetIds: [null] },
      { targetIds: ["TARGET-A"], memberSystemIds: ["ACS-A"], resourceIds: ["R2"] },
      { taskIds: ["GROUP_ONLY", "UNASSIGNED", "UNSET"] }, {},
    ];
    for (const order of [filters, [...filters].reverse(), [...filters.slice(2), ...filters.slice(0, 2)]]) for (const filter of order) {
      const selection = selectResourceKpiAssignments(prepared, filter), scope = selectResourceTargetPlanScope(prepared, selection);
      const fresh = planInput({ ...input, filters: filter });
      expect(scope.selectedAssignments).toEqual(fresh.selectedAssignments);
      expect(scope.fullProjectAssignments).toEqual(fresh.fullProjectAssignments);
      expect(scope.capacityResourceIds).toEqual(fresh.capacityResourceIds);
      expect(selection.assignments.map(row => row.assignmentId)).toEqual(calculateResourceTargetKpi({ ...input, filters: filter }).kpi.total.assignmentIds);
    }
    expect(JSON.stringify(input)).toBe(original);
  });

  it("AC1 separates graph-only, allocation-only and progress-only changes while retaining canonical IDs and full Milestone gates", () => {
    const input = issue623TargetResourceFixture(); input.filters = c.sharedFilters;
    const original = JSON.stringify(input), before = assertPlanRawIdentity(input);
    const subset = { ...input, logistics: { ...input.logistics, bindings: input.logistics.bindings.map(binding => binding.id === "SHARED-B"
      ? { ...binding, selection: "subset" as const, memberIds: ["MEM-B-MCS"] } : binding) } };
    const changedGraph = assertPlanRawIdentity(subset);
    expect(changedGraph.kpi.total).toEqual(before.kpi.total);
    expect(changedGraph.relatedMembers).toMatchObject({ equipmentQuantity: 10, systemIds: ["ACS-A", "MCS-1"] });
    expect(changedGraph.kpi.fullMilestones).toEqual(before.kpi.fullMilestones);
    const changedAllocation = assertPlanRawIdentity({ ...subset, assignments: subset.assignments.map(row => row.assignmentId === c.sharedAssignmentId ? { ...row, allocationPercent: 50 } : row) });
    expect(changedAllocation.kpi.total.assignmentIds).toEqual(c.expected.shared.assignmentIds);
    expect(changedAllocation.projection.children.map(row => row.totals.effort.knownMd)).toEqual([2.5, 2.5]);
    expect(changedAllocation.projection.totals.effort.knownMd).toBe(2.5);
    const complete = { ...subset, tasks: subset.tasks.map(task => task.taskId === c.sharedTaskId ? { ...task, progress: 100, status: "completed" as const } : task) };
    const completed = assertPlanRawIdentity(complete);
    expect(completed.kpi.total.effort).toEqual(before.kpi.total.effort);
    expect(completed.kpi.total.completed.taskIds).toEqual([c.sharedTaskId]);
    expect(completed.kpi.fullMilestones.find(row => row.milestoneTaskId === "M1")!.stageGate.incompleteMemberTaskIds).toEqual(["UNASSIGNED"]);
    expect(completed.kpi.fullMilestones.find(row => row.milestoneTaskId === "M2")!.stageGate).toMatchObject({ blocked: true, incompletePredecessorMilestoneTaskIds: ["M1"] });
    expect(JSON.stringify(input)).toBe(original);
  });

  it("AC4 rejects Target fan-out and Plan budgets without returning a truncated or newly recomputed partial total", () => {
    const input = issue623TargetResourceFixture(); input.filters = c.sharedFilters;
    const expected = assertPlanRawIdentity(input), original = JSON.stringify(input);
    expect(() => calculateResourceTargetKpi({ ...input, logistics: { ...input.logistics, limits: { projectionCells: 1 } } })).toThrow(ResourceKpiTargetLimitError);
    const plan = planInput(input); plan.limits.resourceDays = 27;
    expect(() => calculateResourcePlan(plan)).toThrow(ResourcePlanLimitError);
    plan.limits.resourceDays = 28;
    expect(calculateResourcePlan(plan).totals.summary.selected.knownMd).toBe(c.expected.shared.knownMd);
    expect(assertPlanRawIdentity(input)).toEqual(expected);
    expect(JSON.stringify(input)).toBe(original);
  });
});
