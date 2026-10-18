import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import type { ProjectAssignmentDto } from "../../../src/contracts/resources";
import { stageSnapshotFromProject } from "../../../src/domain/milestones/project-stage-model";
import { createWorkingCalendar } from "../../../src/domain/scheduling/calendar";
import { calculateLogisticsDashboardPure } from "../../../src/server/logistics/logistics-dashboard-service";
import { calculateMilestoneDashboard, type MilestoneDashboardCalculationInput } from "../../../src/server/projects/milestone-dashboard-calculation-core";
import { resolveMdPerMm } from "../../../src/server/resources/md-per-mm-core";

function task(id: string, overrides: Partial<ProjectTaskDto> = {}): ProjectTaskDto {
  return { taskId: id, externalId: id.toUpperCase(), name: id, type: "task", scheduleMode: "auto", requestedStart: "2026-10-05", start: "2026-10-05", end: "2026-10-05", duration: 1, progress: 0, status: "not_started", parentExternalId: null, siblingOrder: 0, ...overrides };
}
function fixture(): MilestoneDashboardCalculationInput {
  const tasks = [
    task("m1", { type: "milestone", duration: 0, start: "2026-10-06", end: "2026-10-06" }),
    task("m2", { type: "milestone", duration: 0, start: "2026-10-07", end: "2026-10-07" }),
    task("s", { type: "summary", membership: { explicitMilestoneTaskId: "m1", effectiveMilestoneTaskId: "m1", inheritedFromTaskId: null } }),
    task("t1", { progress: 100, status: "completed", parentExternalId: "S" }),
    task("t2", { duration: 9, end: "2026-10-15", parentExternalId: "S" }),
    task("t3", { membership: { explicitMilestoneTaskId: "m2", effectiveMilestoneTaskId: "m2", inheritedFromTaskId: null } }),
    task("unassigned"),
  ];
  const assignment = (id: string, taskId: string, percent: number | null): ProjectAssignmentDto => ({ id, taskId, target: { kind: "resource", id: "r1" }, role: null, allocation: { start: null, end: null, percent } });
  const assignments = [assignment("a1", "t1", 100), assignment("a2", "t2", 50), assignment("a3", "t3", 100), assignment("a4", "unassigned", 100)];
  return {
    project: { publicId: "project", name: "Project", description: "", status: "in_progress", revision: 7, calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] } },
    catalogRevision: 3, tasks, stageSnapshot: stageSnapshotFromProject(tasks, [{ id: "link", predecessorExternalId: "M2", successorExternalId: "M1", type: "FS", lag: 0 }]),
    assignments, resources: [{ id: "r1", name: "R1", code: "R1", description: "", active: true, developerGrade: "ADVANCED", roles: ["PI", "DEVELOPER"] }],
    groups: [{ id: "g1", name: "G1", code: null, description: "", active: true, memberResourceIds: ["r1"] }, { id: "g2", name: "G2", code: null, description: "", active: true, memberResourceIds: ["r1"] }],
    logistics: { processes: [], equipment: [], systems: [], systemLinks: [] },
    calendarForResource: () => createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] }),
    filter: {}, now: new Date("2026-10-06T01:00:00Z"),
  };
}
function rebuild(input: MilestoneDashboardCalculationInput) {
  input.stageSnapshot = stageSnapshotFromProject(input.tasks, []);
  return input;
}

describe("milestone dashboard full-stage and scoped effort", () => {
  it("retains complete E/P and raw weighted progress when F shows only a completed member", () => {
    const input = fixture(); input.filter = { from: "2026-10-05", to: "2026-10-05", resourceIds: ["r1"] };
    input.assignments = input.assignments.filter((row) => row.taskId !== "t2");
    const result = calculateMilestoneDashboard(input), row = result.rows.find((row) => row.milestoneTaskId === "m1")!;
    expect(row.scopedTaskIds).toEqual(["t1"]);
    expect(row.stageGate).toMatchObject({ memberCount: 2, memberProgressPercent: 10, ready: false, blocked: true, incompleteMemberTaskIds: ["t2"], incompletePredecessorMilestoneTaskIds: ["m2"] });
    expect(row.memberDurationSum).toBe(10); expect(row.memberWeightedProgressSum).toBe(100);
    expect(row.riskTaskIds).toEqual(["t2"]);
  });
  it("search and stage selection restrict S while hidden stages and unassigned remain in F totals", () => {
    const input = fixture(); input.filter = { search: " M1 ", milestoneIds: ["m1"] };
    const data = calculateMilestoneDashboard(input);
    expect(data.rows.map((row) => row.milestoneTaskId)).toEqual(["m1"]);
    expect(data.effort.buckets.map((bucket) => bucket.milestoneTaskId)).toEqual(["m1", "m2", null]);
    expect(data.effort.buckets.reduce((sum, bucket) => sum + bucket.plannedMd, 0)).toBeCloseTo(data.effort.plannedMd, 12);
    expect(data.effort.plannedMd).toBe(7.5); expect(data.rows[0].effort.plannedMd).toBe(5.5);
    expect(data.kpi.coverage).toMatchObject({ numerator: 3, denominator: 4, percent: 75 });
  });
  it("deduplicates configured and unset assignments and never expands Summary/Milestone/group effort", () => {
    const input = fixture(); input.assignments[1].allocation!.percent = null;
    input.assignments.push(input.assignments[0], input.assignments[1], { ...input.assignments[0], id: "summary", taskId: "s" }, { ...input.assignments[0], id: "milestone", taskId: "m1" }, { ...input.assignments[0], id: "group", target: { kind: "group", id: "g1" } });
    const data = calculateMilestoneDashboard(input);
    expect(data.effort.assignmentIds).toEqual(["a1", "a2", "a3", "a4"]);
    expect(data.effort.unsetAssignmentIds).toEqual(["a2"]); expect(data.effort.unsetAllocationCount).toBe(1);
    expect(data.effort.plannedMd).toBe(3); expect(data.effort.assignments.find((row) => row.assignmentId === "a2")!.plannedMd).toBeNull();
  });
  it("requires resource, Global Role and grade on the same Resource rather than combining people", () => {
    const input = fixture();
    input.resources.push({ id: "r2", name: "R2", code: null, description: "", active: true, developerGrade: "BEGINNER", roles: ["EQUIPMENT_OWNER"] });
    input.assignments.push({ ...input.assignments[0], id: "second", target: { kind: "resource", id: "r2" } });
    input.filter = { resourceIds: ["r1"], assignmentRoles: ["EQUIPMENT_OWNER"], developerGrades: ["ADVANCED"] };
    const none = calculateMilestoneDashboard(input);
    expect(none.scope.taskIds).toEqual([]); expect(none.rows).toEqual([]); expect(none.kpi.coverage.percent).toBeNull();

    input.filter = { resourceIds: ["r1"], assignmentRoles: ["PI"], developerGrades: ["ADVANCED"] };
    expect(calculateMilestoneDashboard(input).scope.assignmentIds).toEqual(["a1", "a2", "a3", "a4"]);

    input.assignments = [input.assignments[0]];
    input.resources[0].roles = []; input.resources[0].developerGrade = null;
    input.filter = { assignmentRoles: ["UNSPECIFIED"], developerGrades: ["UNSPECIFIED"] };
    expect(calculateMilestoneDashboard(input).scope.assignmentIds).toEqual(["a1"]);
  });
  it("requires Logistics and Resource filters to match the same ordinary Task before a stage enters S", () => {
    const input = fixture();
    input.resources.push({ id: "r2", name: "R2", code: "R2", description: "", active: true, developerGrade: "ADVANCED", roles: ["DEVELOPER"] });
    input.assignments[0] = { ...input.assignments[0], target: { kind: "resource", id: "r2" } };
    input.logistics.processes = [{ id: "p", code: "P", name: "P", parentProcessId: null, sortOrder: 0, active: true, createdAt: "", updatedAt: "" }];
    input.logistics.equipment = [{ id: "eq", processId: "p", code: "EQ", name: "EQ", equipmentType: "AGV", managementUnit: "unit", quantity: 1, manufacturer: "", model: "", description: "", active: true, controlSystems: [], resourceRoles: [], createdAt: "", updatedAt: "" }];
    input.logistics.taskEquipmentLinks = [{ taskId: "t1", equipmentId: "eq", scope: "self" }];
    input.filter = { equipmentIds: ["eq"], resourceIds: ["r1"] };

    const none = calculateMilestoneDashboard(input);
    expect(none.scope.taskIds).toEqual([]);
    expect(none.rows).toEqual([]);
    expect(none.kpi.completion.denominator).toBe(0);

    input.logistics.taskEquipmentLinks.push({ taskId: "t2", equipmentId: "eq", scope: "self" });
    const matched = calculateMilestoneDashboard(input);
    expect(matched.scope.taskIds).toEqual(["t2"]);
    expect(matched.rows.map((row) => row.milestoneTaskId)).toEqual(["m1"]);
    expect(matched.rows[0].scopedTaskIds).toEqual(["t2"]);
  });
  it("uses inclusive clipping and Resource calendar while retaining unset and zero-day Task coverage", () => {
    const input = fixture(); input.filter = { from: "2026-10-05", to: "2026-10-05", mdPerMm: 3 };
    input.calendarForResource = () => createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-10-05", name: "Resource holiday" }] });
    input.assignments[1].allocation!.percent = null;
    const data = calculateMilestoneDashboard(input);
    expect(data.scope.taskIds).toHaveLength(4); expect(data.effort.plannedMd).toBe(0); expect(data.effort.plannedMm).toBe(0);
    expect(data.effort.unsetAllocationCount).toBe(1); expect(data.kpi.coverage.denominator).toBe(4);
    input.filter = { from: "2026-10-15", to: "2026-10-15" }; input.calendarForResource = fixture().calendarForResource;
    expect(calculateMilestoneDashboard(input).scope.taskIds).toEqual(["t2"]);
    input.assignments[1].allocation!.percent = 50;
    expect(calculateMilestoneDashboard(input).effort.plannedMd).toBe(0.5);
  });
  it("keeps M/M raw and additive across buckets rather than rounding thirds independently", () => {
    const input = fixture(); input.assignments = input.assignments.filter((row) => row.taskId !== "t2"); input.filter.mdPerMm = 3;
    const data = calculateMilestoneDashboard(input);
    expect(data.effort.buckets.reduce((sum, bucket) => sum + bucket.plannedMm!, 0)).toBe(1);
    expect(data.effort.plannedMm).toBe(1);
  });
  it("uses completed status for Ready/counts and preserves completion inconsistencies without writes", () => {
    const input = fixture(); input.tasks[0].status = "completed"; input.tasks[0].progress = 100; rebuild(input);
    const data = calculateMilestoneDashboard(input), row = data.rows[0];
    expect(data.kpi.completion).toMatchObject({ numerator: 1, denominator: 2, percent: 50 });
    expect(row.stageGate.completionInconsistent).toBe(true); expect(row.atRisk).toBe(false); expect(row.stageGate.ready).toBe(false);
    expect(input.tasks[0].status).toBe("completed");
  });
  it("keeps 100% members blocked by a predecessor and reports ready only after that predecessor completes", () => {
    const input = fixture(); input.tasks[4].progress = 100; input.tasks[4].status = "completed";
    input.stageSnapshot = stageSnapshotFromProject(input.tasks, [{ id: "link", predecessorExternalId: "M2", successorExternalId: "M1", type: "FS", lag: 0 }]);
    expect(calculateMilestoneDashboard(input).rows[0].stageGate).toMatchObject({ memberProgressPercent: 100, ready: false, blocked: true });
    input.tasks[1].progress = 100; input.tasks[1].status = "completed";
    input.stageSnapshot = stageSnapshotFromProject(input.tasks, [{ id: "link", predecessorExternalId: "M2", successorExternalId: "M1", type: "FS", lag: 0 }]);
    const ready = calculateMilestoneDashboard(input); expect(ready.kpi.ready.milestoneTaskIds).toEqual(["m1"]);
    input.tasks[0].progress = 100; input.tasks[0].status = "completed"; input.stageSnapshot = stageSnapshotFromProject(input.tasks, []);
    expect(calculateMilestoneDashboard(input).kpi.completion.percent).toBe(100);
  });
  it("preserves explicit Task override and inherited default without counting Summary context twice", () => {
    const input = fixture(); input.tasks[4].membership = { explicitMilestoneTaskId: "m2", effectiveMilestoneTaskId: "m2", inheritedFromTaskId: null }; rebuild(input);
    const data = calculateMilestoneDashboard(input);
    expect(data.rows[0].stageGate.memberTaskIds).toEqual(["t1"]); expect(data.rows[1].stageGate.memberTaskIds).toEqual(["t2", "t3"]);
    expect(data.kpi.coverage.denominator).toBe(4); expect(data.effort.buckets.reduce((sum, row) => sum + row.plannedMd, 0)).toBe(data.effort.plannedMd);
  });
  it("keeps manual events N/A and predecessor blocking separate; mixed Task→M is not P(M)", () => {
    const input = fixture(); input.tasks = input.tasks.filter((row) => row.type === "milestone"); input.assignments = []; rebuild(input);
    input.stageSnapshot.links = [{ id: "p", predecessorTaskId: "m2", successorTaskId: "m1", type: "SF", lag: -2 }];
    const row = calculateMilestoneDashboard(input).rows[0];
    expect(row.stageGate).toMatchObject({ memberProgressPercent: null, ready: null, blocked: true, manualEvent: true });
    const mixed = fixture(); mixed.stageSnapshot.links = [{ id: "mixed", predecessorTaskId: "t2", successorTaskId: "m1", type: "FS", lag: 0 }];
    expect(calculateMilestoneDashboard(mixed).rows[0].stageGate.predecessorMilestoneTaskIds).toEqual([]);
  });
  it("does not turn near-100 weighted progress into completion or flag equal end dates", () => {
    const input = fixture(); input.tasks[4].progress = 99.99999; input.tasks[4].end = "2026-10-06"; rebuild(input);
    const row = calculateMilestoneDashboard(input).rows[0];
    expect(row.stageGate.memberProgressPercent).toBeLessThan(100); expect(row.stageGate.ready).toBe(false); expect(row.atRisk).toBe(false);
  });
  it("selects related M via matching member and evaluates outside-filter members without changing logistics totals", () => {
    const input = fixture(); input.logistics.processes = [{ id: "p", code: "P", name: "P", parentProcessId: null, sortOrder: 0, active: true, createdAt: "", updatedAt: "" }];
    input.logistics.equipment = [{ id: "eq", processId: "p", code: "EQ", name: "EQ", equipmentType: "AGV", managementUnit: "unit", quantity: 1, manufacturer: "", model: "", description: "", active: true, controlSystems: [], resourceRoles: [], createdAt: "", updatedAt: "" }];
    input.logistics.taskEquipmentLinks = [{ taskId: "t1", equipmentId: "eq", scope: "self" }, { taskId: "t1", equipmentId: "eq", scope: "self" }];
    input.filter = { equipmentIds: ["eq"] };
    const before = calculateLogisticsDashboardPure({ ...input, stageSnapshot: undefined });
    const after = calculateLogisticsDashboardPure(input), stage = calculateMilestoneDashboard(input);
    expect(after.includedTaskIds).toEqual(before.includedTaskIds); expect(after.kpi).toEqual(before.kpi); expect(after.effort).toEqual(before.effort);
    expect(after.milestoneStages!.milestoneTaskIds).toEqual(["m1"]); expect(stage.rows[0].stageGate.ready).toBe(false);
    expect(stage.rows[0].scopedTaskIds).toEqual(["t1"]); expect(stage.rows[0].stageGate.incompleteMemberTaskIds).toEqual(["t2"]);
    input.logistics.taskEquipmentLinks.push({ taskId: "m2", equipmentId: "eq", scope: "self" });
    expect(calculateMilestoneDashboard(input).rows.map((row) => row.milestoneTaskId)).toEqual(["m1", "m2"]);
  });
  it.each(["milestoneIds", "resourceIds", "equipmentIds", "processIds", "systemIds", "roleResourceIds"] as const)("unknown valid filter %s matches nothing without expanding scope", (key) => {
    const input = fixture(); input.filter = { [key]: ["missing"] };
    const data = calculateMilestoneDashboard(input); expect(data.rows).toEqual([]);
    if (key !== "milestoneIds") expect(data.scope.taskIds).toEqual([]);
  });
  it("has null ratios on no targets and a display-only date range on an empty project", () => {
    const input = fixture(); input.tasks = []; input.assignments = []; rebuild(input);
    const data = calculateMilestoneDashboard(input);
    expect(data.kpi.completion.percent).toBeNull(); expect(data.kpi.coverage.percent).toBeNull();
    expect(data.kpi.ready.count).toBe(0); expect(data.effort.plannedMd).toBe(0);
    expect(data.workloadRange).toEqual({ from: "2026-10-06", to: "2026-10-06" }); expect(input.tasks).toEqual([]);
  });
  it("uses calendar-day upcoming boundaries including weekend and supported date upper bound", () => {
    const input = fixture(); input.tasks = ["2026-10-05", "2026-10-06", "2026-10-10", "2026-10-11"].map((date, index) => task(`m${index}`, { type: "milestone", duration: 0, start: date, end: date })); input.assignments = []; rebuild(input); input.filter.horizonDays = 5;
    const data = calculateMilestoneDashboard(input);
    expect(data.kpi.overdue.milestoneTaskIds).toEqual(["m0"]); expect(data.kpi.upcoming.milestoneTaskIds).toEqual(["m1", "m2"]);
    input.filter.horizonDays = 1; expect(calculateMilestoneDashboard(input).kpi.upcoming.milestoneTaskIds).toEqual(["m1"]);
    input.filter = { asOfDate: "2199-12-31", horizonDays: 90 }; input.tasks = [task("last", { type: "milestone", duration: 0, start: "2199-12-31", end: "2199-12-31" })]; rebuild(input);
    expect(calculateMilestoneDashboard(input).kpi.upcoming.count).toBe(1);
  });
  it.each([["2026-10-06T14:59:59Z", "2026-10-06"], ["2026-10-06T15:00:00Z", "2026-10-07"]])("default as-of uses Project timezone at %s", (now, expected) => {
    const input = fixture(); input.now = new Date(now); const data = calculateMilestoneDashboard(input);
    expect(data.asOfDate).toBe(expected); expect(data.calculatedAt).toBe(new Date(now).toISOString()); expect(data.filters.asOfDate).toBeNull();
  });
  it.each([[undefined, undefined, null], [undefined, "20", 20], [undefined, "wrong", null], [undefined, " ", null], [null, "20", null], [10, "20", 10], [Infinity, "20", null], [-1, "20", null]] as const)("resolves explicit conversion %s and deployment setting %s", (query, env, expected) => {
    expect(resolveMdPerMm(query, env)).toBe(expected);
    const input = fixture(); input.filter.mdPerMm = query; input.mdPerMmEnvironment = env;
    const data = calculateMilestoneDashboard(input);
    expect(data.mdPerMm).toBe(expected); expect(data.mdPerMmSource).toBe(query !== undefined ? "query" : expected === null ? "unset" : "environment");
    expect(data.filters.mdPerMmProvided).toBe(query !== undefined);
  });
});
