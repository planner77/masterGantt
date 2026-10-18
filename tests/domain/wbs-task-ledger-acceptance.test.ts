import { describe, expect, it } from "vitest";
import {
  calculateWbsTaskLedgerKpi,
  projectWbsTaskLedger,
  resolveWbsTaskLedger,
  selectWbsTaskLedger,
  selectWbsTaskLedgerPlanScope,
  summarizeWbsTaskLedger,
  type WbsTaskLedgerInput,
  type WbsTaskLedgerSelector,
} from "../../src/domain/resources/wbs-task-ledger";
import { calculateResourceKpi } from "../../src/domain/resources/resource-kpi";
import { calculateResourceTargetKpi } from "../../src/domain/resources/resource-target-kpi";
import { calculateResourcePlan } from "../../src/domain/resources/resource-plan";
import { ledgerFromKpi, wbsTaskLedgerFixture } from "../fixtures/wbs-task-ledger";
import { issue623TargetResourceFixture } from "../fixtures/issue-623-target-resource";

const selector = (dimension: WbsTaskLedgerSelector["dimension"], id: string | null): WbsTaskLedgerSelector => ({ dimension, id });
const report = (input: WbsTaskLedgerInput, selectors: readonly WbsTaskLedgerSelector[] = []) => {
  const snapshot = resolveWbsTaskLedger(input);
  return summarizeWbsTaskLedger(snapshot, selectWbsTaskLedger(snapshot, selectors));
};

function mixedTypes() {
  const input = wbsTaskLedgerFixture();
  input.kpi.logistics = { ...input.kpi.logistics, instances: input.kpi.logistics.instances.map(row =>
    row.entityId === "E5" ? { ...row, typeCode: "conveyor" } : row) };
  return input;
}

function freezeDeep(value: unknown) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
}

describe("#728 independent acceptance oracles (Agent pre-testing, not final QA)", () => {
  it("AC3 direct-only raw Assignment and member sets agree with both existing calculators", () => {
    const input = mixedTypes();
    input.kpi.filters = { taskIds: ["T3"], resourceIds: ["R1"] };
    const totals = report(input);
    const resource = calculateResourceKpi(input.kpi);
    const target = calculateResourceTargetKpi(input.kpi);
    expect(totals.tasks.taskIds).toEqual(["T3"]);
    expect(totals.assignments.assignmentIds).toEqual(["A3"]);
    expect(totals.assignments.effort.knownMd).toBe(5);
    expect(totals.assignments).toEqual(resource.total);
    expect(totals.assignments).toEqual(target.kpi.total);
    expect(totals.relatedMembers).toEqual(target.relatedMembers);
  });

  it.each([
    ["equipment", "E10", "equipmentType", "conveyor"],
    ["system", "MCS", "systemType", "acs"],
  ] as const)("AC4/6 %s instance and %s type must refer to the same member in either axis order", (dimension, id, typeDimension, typeId) => {
    const snapshot = resolveWbsTaskLedger(mixedTypes());
    const incompatible = [selector(dimension, id), selector(typeDimension, typeId)];
    for (const selectors of [incompatible, [...incompatible].reverse()]) {
      const selection = selectWbsTaskLedger(snapshot, selectors);
      expect(selection.taskIds).toEqual([]);
      expect(selection.assignmentIds).toEqual([]);
    }
    for (const order of [[dimension, typeDimension], [typeDimension, dimension]]) {
      const tree = projectWbsTaskLedger(snapshot, order);
      const first = tree.children.find(row => row.selector.id === (order[0] === dimension ? id : typeId));
      expect(first).toBeDefined();
      expect(first!.children.map(row => row.selector.id)).not.toContain(order[1] === dimension ? id : typeId);
    }
  });

  it("AC4/6 type-only member quantities narrow without changing shared Task effort", () => {
    const input = mixedTypes();
    const equipment = report(input, [selector("equipmentType", "conveyor")]);
    expect(equipment.tasks.taskIds).toEqual(["T3"]);
    expect(equipment.assignments.effort.knownMd).toBe(5);
    expect(equipment.relatedMembers.equipmentIds).toEqual(["E5"]);
    expect(equipment.relatedMembers.equipmentQuantity).toBe(5);
    const systems = report(input, [selector("systemType", "mcs")]);
    expect(systems.tasks.taskIds).toEqual(["T0", "T1", "T2", "T3"]);
    expect(systems.assignments.effort.knownMd).toBe(14);
    expect(systems.relatedMembers.systemIds).toEqual(["MCS"]);
    expect(systems.relatedMembers.systemCount).toBe(1);
  });

  it("AC3/4 independent Target paths of one Task cannot join another Target's member", () => {
    const input = ledgerFromKpi(issue623TargetResourceFixture());
    const snapshot = resolveWbsTaskLedger(input);
    const crossPath = [selector("wbs", "SHARED"), selector("target", "TARGET-A"), selector("equipment", "AMR-B")];
    for (const selectors of [crossPath, [...crossPath].reverse()]) {
      expect(selectWbsTaskLedger(snapshot, selectors).taskIds).toEqual([]);
    }
    const samePath = report(input, [selector("wbs", "SHARED"), selector("target", "TARGET-A"), selector("equipment", "AMR-A")]);
    expect(samePath.tasks.taskIds).toEqual(["SHARED"]);
    expect(samePath.assignments.assignmentIds).toEqual(["SHARED-R1"]);
    expect(samePath.relatedMembers.equipmentIds).toEqual(["AMR-A"]);
    expect(samePath.assignments.effort.knownMd).toBe(5);
    const directMcs = report(input, [selector("wbs", "LEGACY"), selector("system", "MCS-1"), selector("target", "TARGET-A")]);
    expect(directMcs.tasks.taskIds).toEqual([]);
  });

  it("AC3 ACS-only subset never acquires AMR or another ACS from the shared Target", () => {
    const input = ledgerFromKpi(issue623TargetResourceFixture());
    const base = [selector("wbs", "ACS_ONLY"), selector("target", "TARGET-A")];
    expect(report(input, base).relatedMembers).toMatchObject({ equipmentIds: [], equipmentQuantity: 0, systemIds: ["ACS-A"], systemCount: 1 });
    expect(report(input, [...base, selector("equipment", "AMR-A")]).tasks.taskIds).toEqual([]);
    expect(report(input, [...base, selector("system", "ACS-B")]).assignments.assignmentIds).toEqual([]);
    expect(report(input, [...base, selector("system", "ACS-A")]).assignments.effort.knownMd).toBe(5);
  });

  it("AC3/8 explicit-v1 and legacy-v0 retain distinct process populations with the same Project union", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics,
      targets: [{ id: "OLD-A", scope: "process", projectProcessId: "PA", occurrenceId: "OA", workAreaId: null,
        members: [{ id: "OLD-A-E10", kind: "equipment", entityId: "E10" }] }],
      bindings: ["T0", "T3"].map(taskId => ({ id: `OLD-${taskId}`, taskId, targetId: "OLD-A", scope: "self", selection: "whole", memberIds: [] })),
    };
    const legacy = { ...input, contextSourceVersion: "legacy-target-context:v0" as const };
    const explicitA = report(input, [selector("process", "PA")]);
    const legacyA = report(legacy, [selector("process", "PA")]);
    expect(explicitA.tasks.taskIds).toEqual(["T1", "T3"]);
    expect(explicitA.assignments.effort.knownMd).toBe(8);
    expect(legacyA.tasks.taskIds).toEqual(["T0", "T3"]);
    expect(legacyA.assignments.effort.knownMd).toBe(7);
    expect(report(input).assignments).toEqual(report(legacy).assignments);
    expect(report(input).assignments.effort.knownMd).toBe(14);
    expect(calculateWbsTaskLedgerKpi(input).metadata.contextSourceVersion).toBe("explicit-task-context:v1");
    expect(calculateWbsTaskLedgerKpi(legacy).metadata.contextSourceVersion).toBe("legacy-target-context:v0");
  });

  it("AC8/10 process edits only change the selected work union, not Assignment IDs or equipment configuration", () => {
    const input = wbsTaskLedgerFixture();
    const configurationBefore = JSON.stringify([input.equipmentWorkAreas, input.equipment, input.systems]);
    const before = calculateWbsTaskLedgerKpi(input);
    input.taskContexts = input.taskContexts.map(row => row.taskId === "T3" ? { ...row,
      processLinks: [{ processId: "PA", scope: "self" }], workAreaLinks: [{ processId: "PA", workAreaId: "WA", scope: "self" }],
    } : row);
    expect(report(input, [selector("process", "PB")]).assignments.effort.knownMd).toBe(4);
    expect(report(input, [selector("process", "PA")]).assignments.effort.knownMd).toBe(8);
    const after = calculateWbsTaskLedgerKpi(input);
    expect(after.taskIds).toEqual(before.taskIds);
    expect(after.assignmentIds).toEqual(before.assignmentIds);
    expect(after.totals.assignments.effort.knownMd).toBe(14);
    expect(JSON.stringify([input.equipmentWorkAreas, input.equipment, input.systems])).toBe(configurationBefore);
  });

  it("AC5/10 null personal branch retains unassigned and Group-only work without fabricating personal demand", () => {
    const input = wbsTaskLedgerFixture();
    const empty = report(input, [selector("resource", null)]);
    expect(empty.tasks.taskIds).toEqual(["GROUP_ONLY", "UNASSIGNED"]);
    expect(empty.assignments.assignmentIds).toEqual([]);
    expect(empty.assignments.effort).toMatchObject({ state: "empty", knownMd: 0 });
    expect(empty.participation).toMatchObject({ registeredCount: 2, assignedCount: 0 });
    expect(empty.diagnostics.completelyUnassigned.taskIds).toEqual(["UNASSIGNED"]);
    expect(empty.diagnostics.groupOnly.taskIds).toEqual(["GROUP_ONLY"]);
    const snapshot = resolveWbsTaskLedger(input);
    expect(selectWbsTaskLedgerPlanScope(snapshot, selectWbsTaskLedger(snapshot, [selector("resource", null)])).capacityResourceIds).toEqual([]);
  });

  it("AC5 nonworking configured0, unset effort, absent M/M and empty duration denominator remain distinct", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.to = "2026-10-11";
    input.kpi.mdPerMm = null;
    input.kpi.tasks = input.kpi.tasks.map(row => row.taskId === "T0" ? { ...row,
      end: "2026-10-11",
    } : row);
    input.kpi.assignments = input.kpi.assignments.map(row => row.taskId === "T0" ? { ...row, start: "2026-10-10", end: "2026-10-11", allocationPercent: 100 } : row);
    const zero = report(input, [selector("wbs", "T0")]);
    expect(zero.tasks).toMatchObject({ taskCount: 1, progress: { denominator: 5, percent: 0 } });
    expect(report(input, [selector("wbs", "M")]).tasks.progress).toMatchObject({ denominator: 0, percent: null });
    expect(zero.assignments.effort).toMatchObject({ state: "configured", knownMd: 0, plannedMd: 0, plannedMm: null });
    input.kpi.assignments = input.kpi.assignments.map(row => row.taskId === "T0" ? { ...row, allocationPercent: null } : row);
    expect(report(input, [selector("wbs", "T0")]).assignments.effort).toMatchObject({ state: "unset", plannedMd: null, plannedMm: null });
    input.kpi.tasks = input.kpi.tasks.map(row => row.taskId === "T0" ? { ...row, duration: 0 } : row);
    expect(() => resolveWbsTaskLedger(input)).toThrow("Invalid canonical task schedule");
  });

  it("AC5/6 personal-axis selectors preserve same-R selected80/Project140 in either order", () => {
    const input = ledgerFromKpi(issue623TargetResourceFixture());
    const snapshot = resolveWbsTaskLedger(input);
    const selectors = [selector("target", "TARGET-A"), selector("resource", "R4"), selector("group", "G2")];
    for (const order of [selectors, [...selectors].reverse()]) {
      const scope = selectWbsTaskLedgerPlanScope(snapshot, selectWbsTaskLedger(snapshot, order));
      expect(scope.capacityResourceIds).toEqual(["R4"]);
      expect(scope.selectedAssignments.map(row => row.assignmentId)).toEqual(["SELECTED-R4"]);
      expect(scope.fullProjectAssignments.map(row => row.assignmentId).sort()).toEqual(["OUTSIDE-R4", "SELECTED-R4"]);
      const plan = calculateResourcePlan({ ...scope, projectPublicId: input.kpi.projectPublicId, from: input.kpi.from, to: input.kpi.to,
        asOfDate: input.kpi.asOfDate, projectCalendar: input.kpi.projectCalendar, resources: input.kpi.resources,
        mdPerMm: input.kpi.mdPerMm ?? null, granularity: "week", limits: { resourceDays: 1000, assignmentDays: 10000, matrixCells: 1000 } });
      expect(plan.totals.summary.selected).toMatchObject({ capacityMd: 5, loadPercent: 80 });
      expect(plan.totals.summary.project.loadPercent).toBeCloseTo(140, 12);
    }
  });

  it("AC1/7/10 task0 configuration quantity remains visible separately from related work quantity", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics, instances: [...input.kpi.logistics.instances,
      { kind: "equipment", entityId: "IDLE-E", typeCode: "amr", quantity: 7, projectProcessId: "PA" },
      { kind: "system", entityId: "IDLE-S", typeCode: "acs", quantity: 1 },
    ] };
    input.equipment = [...input.equipment, { id: "IDLE-E", controlSystems: [], resourceRoles: [] }];
    input.systems = [...input.systems, { id: "IDLE-S", layer: "controller", scope: "project", processIds: [], coordinatedSystemIds: [], resourceRoles: [] }];
    const full = report(input);
    expect(full.configurationReference).toMatchObject({ equipmentQuantity: 22, systemCount: 4 });
    expect(full.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 3 });
    const idle = report(input, [selector("equipment", "IDLE-E")]);
    expect(idle.tasks.taskCount).toBe(0);
    expect(idle.assignments.assignmentIds).toEqual([]);
    expect(idle.relatedMembers.equipmentQuantity).toBe(0);
    expect(idle.configurationReference).toMatchObject({ equipmentQuantity: 7, equipmentIds: ["IDLE-E"] });
    const tree = projectWbsTaskLedger(resolveWbsTaskLedger(input), ["equipment"]);
    expect(tree.children.find(row => row.selector.id === "IDLE-E")!.totals.tasks.taskCount).toBe(0);
    const noWork = report(input, [selector("wbs", "M"), selector("resource", "R2")]);
    expect(noWork.tasks.taskCount).toBe(0);
    expect(noWork.configurationReference).toMatchObject({ equipmentQuantity: 22, systemCount: 4 });
    expect(noWork.relatedMembers).toMatchObject({ equipmentQuantity: 0, systemCount: 0 });
  });

  it("AC6/10 frozen DTOs support repeated reordered queries with zero source mutation", () => {
    const input = mixedTypes();
    const before = JSON.stringify(input);
    freezeDeep(input);
    const snapshot = resolveWbsTaskLedger(input);
    const full = projectWbsTaskLedger(snapshot, []);
    const first = projectWbsTaskLedger(snapshot, ["systemType", "system", "process", "resource"]);
    const second = projectWbsTaskLedger(snapshot, ["resource", "process", "system", "systemType"]);
    expect(first.totals).toEqual(full.totals);
    expect(second.totals).toEqual(full.totals);
    expect(report(input, [selector("wbs", "T3")]).assignments.assignmentIds).toEqual(["A3"]);
    expect(projectWbsTaskLedger(snapshot, []).totals).toEqual(full.totals);
    expect(JSON.stringify(input)).toBe(before);
  });
});
