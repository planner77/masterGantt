import { describe, expect, it } from "vitest";
import { calculateResourceKpi, RESOURCE_KPI_DICTIONARY } from "../../src/domain/resources/resource-kpi";
import { projectStageGates } from "../../src/domain/milestones/stage-gates";
import { resolveMdPerMm as legacyConversion } from "../../src/server/resources/md-per-mm-core";
import { resolveMdPerMm } from "../../src/domain/resources/md-per-mm";
import { resourceKpiFixture } from "../fixtures/resource-kpi";

const calc = () => calculateResourceKpi(resourceKpiFixture());
describe("resource KPI common raw domain", () => {
  it("deduplicates task/resource/assignment grains, keeps multi-classification subtotals non-additive", () => {
    const input = resourceKpiFixture(); input.filters = { taskIds: ["T1"] };
    const output = calculateResourceKpi(input);
    expect(output.total).toMatchObject({ taskCount: 1, resourceCount: 2, assignmentCount: 2 });
    expect(output.assignments[0]).toMatchObject({ effectiveWorkingDays: 4, plannedMd: 2 });
    expect(output.total.effort.plannedMd).toBe(2 + 4 * 33.333333 / 100);
    expect(output.groups.find((row) => row.id === "G1")!.taskCount).toBe(1);
    expect(output.groups.reduce((sum, row) => sum + row.effort.knownMd, 0)).toBeGreaterThan(output.total.effort.knownMd);
    expect(output.roles.reduce((sum, row) => sum + row.effort.knownMd, 0)).toBeGreaterThan(output.total.effort.knownMd);
    expect(output.metadata.groupRoleSubtotalsAdditive).toBe(false);
  });
  it("reuses effective Resource WORKING overrides without AND-ing the Task calendar", () => {
    const input = resourceKpiFixture(); input.filters = { taskIds: ["T1"], resourceIds: ["R1"], groupIds: ["G1"] };
    input.calendarExceptions = [
      { date: "2026-10-05", dayType: "NON_WORKING", targetType: "RESOURCE_GROUP", targetId: "G2", ruleId: "g", ruleName: "holiday" },
      { date: "2026-10-06", dayType: "WORKING", targetType: "RESOURCE", targetId: "R1", ruleId: "r", ruleName: "work" },
    ];
    expect(calculateResourceKpi(input).assignments[0]).toMatchObject({ effectiveWorkingDays: 4, plannedMd: 2 });
    input.calendarExceptions = input.calendarExceptions.slice(1);
    expect(calculateResourceKpi(input).assignments[0].effectiveWorkingDays).toBe(5);
    input.calendarExceptions = [
      { date: "2026-10-06", dayType: "WORKING", targetType: "RESOURCE_GROUP", targetId: "G1", ruleId: "g1", ruleName: "work" },
      { date: "2026-10-06", dayType: "NON_WORKING", targetType: "RESOURCE_GROUP", targetId: "G2", ruleId: "g2", ruleName: "holiday" },
      ...input.calendarExceptions,
    ];
    expect(() => calculateResourceKpi(input)).toThrow("Conflicting resource calendar exceptions");
  });
  it("matches explicit/inherited/override/clear/empty/unassigned membership against the full projector", () => {
    const input = resourceKpiFixture();
    for (const remove of [null, "T1", "S2", "S"]) {
      if (remove) input.memberships = input.memberships.filter((row) => row.taskId !== remove);
      const projected = projectStageGates({ tasks: [...input.tasks], memberships: [...input.memberships], links: [...input.links] });
      const output = calculateResourceKpi(input);
      for (const row of output.assignments) expect(row.milestoneTaskId).toBe(projected.membership.get(row.taskId)!.effectiveMilestoneTaskId);
      expect(output.fullMilestones.find((row) => row.milestoneTaskId === "M3")!.stageGate).toMatchObject({ memberCount: 0, ready: null });
    }
    expect(calculateResourceKpi(input).assignments.every((row) => row.milestoneTaskId === null)).toBe(true);
  });
  it("conserves raw effort across every Resource/Group Milestone partition and unassigned bucket", () => {
    const output = calc();
    for (const row of [...output.resources, ...output.groups, { ...output.total, milestones: output.milestones }]) {
      expect(row.milestones.reduce((sum, bucket) => sum + bucket.effort.knownMd, 0)).toBeCloseTo(row.effort.knownMd, 14);
      expect(row.milestones.reduce((sum, bucket) => sum + bucket.effort.unsetCount, 0)).toBe(row.effort.unsetCount);
      expect(row.milestones.at(-1)!.milestoneTaskId).toBeNull();
    }
  });
  it("keeps planned effort unchanged by Task status/progress and uses distinct duration-weighted tasks", () => {
    const input = resourceKpiFixture(); const before = calculateResourceKpi(input);
    expect(before.total.assignedTaskProgress.denominator).toBe(15);
    expect(before.total.assignedTaskProgress.numerator).toBe(4 * 100 + 9 * 99.999);
    expect(before.total.completed.count).toBe(1);
    expect(before.total.delayed.taskIds).toEqual(["T2", "T5"]);
    input.tasks = input.tasks.map((task) => task.type === "task" ? { ...task, status: "completed", progress: 100 } : task);
    const after = calculateResourceKpi(input);
    expect(after.total.effort).toEqual(before.total.effort);
    expect(after.total.completed.count).toBe(3);
    expect(after.total.delayed.count).toBe(0);
  });
  it("preserves full-stage Ready/Blocked/progress even when incomplete members are filtered out", () => {
    const input = resourceKpiFixture(); input.filters = { taskIds: ["T1"] };
    let output = calculateResourceKpi(input);
    expect(output.total.assignedTaskProgress.percent).toBe(100);
    const stage = output.fullMilestones.find((row) => row.milestoneTaskId === "M1")!.stageGate;
    expect(Math.round(stage.memberProgressPercent!)).toBe(100);
    expect(stage).toMatchObject({ ready: false, incompleteMemberTaskIds: ["T2"] });
    input.links = [{ id: "task-link", predecessorTaskId: "T2", successorTaskId: "T1", type: "FS", lag: 0 }];
    expect(calculateResourceKpi(input).fullMilestones.find((row) => row.milestoneTaskId === "M1")!.stageGate.blocked).toBe(false);
    input.links = [{ id: "stage-link", predecessorTaskId: "M2", successorTaskId: "M1", type: "SS", lag: -2 }];
    output = calculateResourceKpi(input);
    expect(output.fullMilestones.find((row) => row.milestoneTaskId === "M1")!.stageGate).toMatchObject({ blocked: true, predecessorMilestoneTaskIds: ["M2"] });
  });
  it("distinguishes empty/all unset/partial/configured non-working zero and ratio denominator zero", () => {
    const input = resourceKpiFixture();
    input.filters = { taskIds: ["missing"] }; let output = calculateResourceKpi(input);
    expect(output.total.effort).toMatchObject({ plannedMd: 0, state: "empty", partial: false });
    expect(output.total.completion.percent).toBeNull(); expect(output.total.assignedTaskProgress.percent).toBeNull();
    input.filters = { taskIds: ["T2"] }; output = calculateResourceKpi(input);
    expect(output.total.effort).toMatchObject({ knownMd: 0, plannedMd: null, plannedMm: null, state: "unset", partial: true, unsetCount: 2 });
    input.filters = {}; output = calculateResourceKpi(input);
    expect(output.total.effort).toMatchObject({ state: "partial", partial: true, unsetCount: 2 });
    input.filters = { taskIds: ["T5"] }; output = calculateResourceKpi(input);
    expect(output.total.effort).toMatchObject({ plannedMd: 0, plannedMm: 0, state: "configured", partial: false });
    input.assignments = input.assignments.map((row) => row.assignmentId === "A5" ? { ...row, allocationPercent: 0 } : row);
    expect(() => calculateResourceKpi(input)).toThrow("Invalid KPI allocation");
  });
  it("diagnoses T0 completely unassigned/group-only/unset Task and Assignment IDs independently of A", () => {
    const input = resourceKpiFixture(); input.filters = { resourceIds: ["R1"], roles: ["EQUIPMENT_OWNER"] };
    const output = calculateResourceKpi(input);
    expect(output.total.assignmentCount).toBe(0);
    expect(output.diagnostics).toMatchObject({ denominator: 5, personalFiltersAppliedToA: true,
      completelyUnassigned: { count: 1, taskIds: ["T3"] }, groupOnly: { count: 1, taskIds: ["T4"] },
      personallyUnassigned: { count: 2, taskIds: ["T3", "T4"] }, unsetTasks: { count: 1, taskIds: ["T2"] }, unsetAssignmentCount: 2, unsetAssignmentIds: ["A3", "A4"] });
    expect(output.responsibilityReferences.map((row) => row.assignmentId)).toEqual(["GROUP", "MILESTONE", "SUMMARY"]);
    input.from = "2026-10-09"; input.to = "2026-10-09";
    input.assignments = input.assignments.map((row) => row.assignmentId === "A1" || row.assignmentId === "A2" ? { ...row, end: "2026-10-08" } : row);
    const dated = calculateResourceKpi(input);
    expect(dated.diagnostics.personallyUnassigned.taskIds).toEqual(["T3", "T4"]);
    expect(dated.diagnostics.taskIds).toContain("T1");
  });
  it("applies WBS/Task/Milestone/Resource/Group/Role/grade filters to the same assignment intersection", () => {
    const input = resourceKpiFixture(); input.filters = { wbsRootIds: ["S2"], taskIds: ["T1", "T2"], milestoneIds: ["M1"], resourceIds: ["R1"], groupIds: ["G2"], roles: ["DEVELOPER"], developerGrades: ["ADVANCED"] };
    expect(calculateResourceKpi(input).total.assignmentIds).toEqual(["A1"]);
    expect(calculateResourceKpi(input).diagnostics.taskIds).toEqual(["T1"]);
    input.filters.developerGrades = ["INTERMEDIATE"];
    expect(calculateResourceKpi(input).total.assignmentCount).toBe(0);
    input.filters = { milestoneIds: [null] };
    expect(calculateResourceKpi(input).diagnostics.taskIds).toEqual(["T3", "T4", "T5"]);
  });
  it.each([undefined, null, 17, 21])("uses explicit/ENV/unset M/M with raw precision (%s)", (query) => {
    const input = resourceKpiFixture(); input.mdPerMm = query; input.mdPerMmEnvironment = "19";
    const output = calculateResourceKpi(input);
    const conversion = query === undefined ? 19 : query;
    expect(output.mdPerMm).toBe(conversion);
    expect(output.mdPerMmSource).toBe(query === undefined ? "environment" : "query");
    expect(output.total.effort.plannedMm).toBe(conversion === null ? null : output.total.effort.knownMd / conversion);
    expect(legacyConversion(query, "19")).toBe(resolveMdPerMm(query, "19"));
    expect(output.assignments.find((row) => row.assignmentId === "A2")!.plannedMd).toBe(4 * 33.333333 / 100);
  });
  it.each([0, -1, Infinity, NaN, "", "bad", "null"]) ("rejects invalid query %s without ENV fallback", (query) => {
    const input = resourceKpiFixture(); input.mdPerMm = query as number; input.mdPerMmEnvironment = "21";
    expect(() => calculateResourceKpi(input)).toThrow("Invalid mdPerMm query");
  });
  it.each([undefined, "", "bad", "0", "-1", "Infinity"]) ("invalid/unset ENV %s means no conversion", (environment) => {
    const input = resourceKpiFixture(); input.mdPerMm = undefined; input.mdPerMmEnvironment = environment;
    expect(calculateResourceKpi(input)).toMatchObject({ mdPerMm: null, mdPerMmSource: "unset", mdPerMmProvided: false });
  });
  it("is deterministic for permutations/exact duplicated joins and fails conflicting identities", () => {
    const input = resourceKpiFixture(); const baseline = calculateResourceKpi(input);
    const permuted = { ...input, tasks: [...input.tasks].reverse(), assignments: [...input.assignments, ...input.assignments].reverse(), resources: [...input.resources].reverse(), memberships: [...input.memberships, ...input.memberships].reverse() };
    expect(calculateResourceKpi(permuted)).toEqual(baseline);
    expect(input.filters).toBeUndefined();
    expect(() => calculateResourceKpi({ ...input, assignments: [...input.assignments, { ...input.assignments[0], allocationPercent: 99 }] })).toThrow("Conflicting KPI input");
  });
  it("fixes complete KPI dictionaries and rejects invalid dates, references and assignment schedules", () => {
    expect(RESOURCE_KPI_DICTIONARY).toHaveLength(17);
    for (const entry of RESOURCE_KPI_DICTIONARY) expect(Object.values(entry).filter((value) => value === "")).toHaveLength(0);
    const input = resourceKpiFixture();
    expect(() => calculateResourceKpi({ ...input, asOfDate: "2026-02-30" })).toThrow();
    expect(() => calculateResourceKpi({ ...input, from: "2026-10-19" })).toThrow();
    expect(() => calculateResourceKpi({ ...input, assignments: [{ ...input.assignments[0], targetId: "missing" }] })).toThrow("Invalid KPI assignment reference");
    expect(() => calculateResourceKpi({ ...input, assignments: [{ ...input.assignments[0], start: "2026-10-01" }] })).toThrow("Invalid KPI assignment range");
  });
});
