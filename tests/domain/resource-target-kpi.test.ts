import { describe, expect, it } from "vitest";
import { calculateResourceKpi, prepareResourceKpiSnapshot, selectResourceKpiAssignments } from "../../src/domain/resources/resource-kpi";
import { calculateResourceTargetKpi, projectResourceKpiTargets, selectResourceTargetPlanScope, type ResourceKpiTargetDimension, type ResourceKpiTargetProjectionNode } from "../../src/domain/resources/resource-target-kpi";
import { ResourceKpiTargetInputError, ResourceKpiTargetLimitError } from "../../src/domain/resources/resource-kpi-targets";
import { calculateResourcePlan } from "../../src/domain/resources/resource-plan";
import { resourceTargetKpiFixture } from "../fixtures/resource-target-kpi";
import { resourceKpiFixture } from "../fixtures/resource-kpi";
import { resourceKpiIntegrationFixture } from "../fixtures/resource-kpi-integration";
import { logisticsTargetResourceCases, logisticsTargetFilterCases, logisticsTargetKindFilterCases } from "../fixtures/logistics-targets";

const fixture = resourceTargetKpiFixture;
function only(taskIds: string[]) { const input = fixture(); input.filters = { taskIds }; return input; }
function leafScopes(nodes: ResourceKpiTargetProjectionNode[], path: Record<string, string | null> = {}): unknown[] {
  return nodes.flatMap(node => {
    const next = { ...path, [node.dimension]: node.id };
    return node.children.length ? leafScopes(node.children, next) : [{ path: Object.fromEntries(Object.entries(next).sort()), totals: node.totals }];
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function permutations<T>(rows: T[]): T[][] { return rows.length ? rows.flatMap((row, index) => permutations(rows.filter((_, i) => i !== index)).map(rest => [row, ...rest])) : [[]]; }

describe("#619 Target Resource KPI contract", () => {
  it("AC1 keeps #523 output byte-for-byte when graph is omitted or Target filters are empty", () => {
    const baseline = resourceKpiFixture(), expected = calculateResourceKpi(baseline);
    expect(calculateResourceKpi({ ...baseline, filters: { targetIds: [], workAreaIds: [], equipmentTypeCodes: [] } })).toEqual(expected);
    const input = fixture(); const legacy = { ...input, logistics: undefined };
    expect(calculateResourceKpi(input)).toEqual(calculateResourceKpi(legacy));
  });

  it("AC1 #530 fixed integration oracle remains 11.5 M/D; Target A/B T1 each7.5 union7.5", () => {
    const baseline = resourceKpiIntegrationFixture();
    const input = { ...baseline, logistics: { ...fixture().logistics, legacy: [], bindings: [
      { id: "530-A", taskId: "T1", targetId: "TARGET-A", scope: "self" as const, selection: "whole" as const, memberIds: [] },
      { id: "530-B", taskId: "T1", targetId: "TARGET-B", scope: "self" as const, selection: "whole" as const, memberIds: [] },
    ] } };
    expect(calculateResourceKpi(input)).toEqual(calculateResourceKpi(baseline));
    expect(calculateResourceTargetKpi(input).kpi.total.effort.knownMd).toBe(11.5);
    const selected = calculateResourceTargetKpi({ ...input, filters: { targetIds: ["TARGET-A", "TARGET-B"] } });
    expect(selected.kpi.total.effort.knownMd).toBe(7.5);
    expect(selected.projection.children.map(row => row.totals.effort.knownMd)).toEqual([7.5, 7.5]);
    expect(selected.projectReference.total.effort.knownMd).toBe(11.5);
  });

  it("AC2 every Target/Group/Resource ordering preserves exact leaf raw scope and totals", () => {
    const input = only(["INTEGRATED"]);
    input.assignments = [...input.assignments, { assignmentId: "CO", taskId: "INTEGRATED", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const prepared = prepareResourceKpiSnapshot(input), selected = selectResourceKpiAssignments(prepared);
    const reference = projectResourceKpiTargets(prepared, selected, ["target", "group", "resource"]);
    for (const order of permutations<ResourceKpiTargetDimension>(["target", "group", "resource"])) {
      const result = projectResourceKpiTargets(prepared, selected, order);
      expect(result.totals).toEqual(reference.totals);
      expect(leafScopes(result.children)).toEqual(leafScopes(reference.children));
    }
  });

  it("AC3 F0-Q01/R07: shared whole + direct/inherited duplicate: A5 B5 union5 and distinct quantity", () => {
    const input = only(["INTEGRATED"]), original = JSON.stringify(input);
    const result = calculateResourceTargetKpi(input);
    expect(result.projection.totals.effort.plannedMd).toBe(5);
    expect(result.projection.children.map(row => [row.id, row.totals.effort.plannedMd])).toEqual([["TARGET-A", 5], ["TARGET-B", 5]]);
    expect(result.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 3, equipmentIds: ["AMR-A", "AMR-B"], systemIds: ["ACS-A", "ACS-B", "MCS-1"] });
    expect(result.relatedMembers.members.find(row => row.entityId === "AMR-A")!.provenance.map(source => source.bindingId)).toEqual(["B-DIRECT", "B-INHERITED"]);
    expect(JSON.stringify(input)).toEqual(original);
  });

  it("AC3 coassignees and overlapping Group/Role/Target retain raw 7.5, not subtotal sum", () => {
    const input = only(["INTEGRATED"]);
    input.assignments = [...input.assignments,
      { assignmentId: "CO", taskId: "INTEGRATED", kind: "resource", targetId: "R2", allocationPercent: 50 },
      { assignmentId: "GROUP-REF", taskId: "INTEGRATED", kind: "group", targetId: "G1", allocationPercent: null }];
    const result = calculateResourceTargetKpi(input);
    expect(result.kpi.total).toMatchObject({ taskCount: 1, resourceCount: 2, assignmentCount: 2, effort: { knownMd: 7.5, assignmentIds: ["A1", "CO"] } });
    expect(result.projection.children.map(row => row.totals.effort.knownMd)).toEqual([7.5, 7.5]);
    expect(result.projectReference.total.assignmentCount).toBeGreaterThan(result.kpi.total.assignmentCount);
    expect(result.projectReference.total.effort.knownMd).toBeGreaterThan(7.5);
    expect(result.kpi.groups.map(row => row.effort.knownMd)).toEqual([7.5, 5, 0]);
    expect(result.kpi.roles.find(row => row.id === "PI")!.effort.knownMd).toBe(5);
  });

  it.each(logisticsTargetFilterCases)("AC4 $id production same-binding selected-member golden", test => {
    const input = only(["ACS-ONLY"]);
    input.logistics.bindings = [...input.logistics.bindings, { id: "B-COUNTER", taskId: "ACS-ONLY", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] }];
    input.filters = { ...input.filters, targetIds: test.targetIds, workAreaIds: test.workAreaIds };
    // F0's simplified memberEntityIds is split into the public typed Equipment/System axes.
    const id = test.memberEntityIds[0];
    if (id?.startsWith("AMR")) input.filters.memberEquipmentIds = test.memberEntityIds;
    else if (id) input.filters.memberSystemIds = test.memberEntityIds;
    expect(calculateResourceTargetKpi(input).kpi.total.taskCount > 0).toBe(test.expected);
  });

  it.each(logisticsTargetKindFilterCases)("AC4 $id Equipment and System meet at the same binding", test => {
    const input = only(["ACS-ONLY"]);
    input.logistics.bindings = [...input.logistics.bindings, { id: "B-COUNTER", taskId: "ACS-ONLY", targetId: "TARGET-B", scope: "self", selection: "whole", memberIds: [] }];
    input.filters = { ...input.filters, targetIds: test.targetIds, memberEquipmentIds: test.equipmentEntityIds, memberSystemIds: test.systemEntityIds };
    expect(calculateResourceTargetKpi(input).kpi.total.taskCount > 0).toBe(test.expected);
  });

  it("AC4 legacy stays unlinked, mixed legacy stays visible in instance axes without Target inference", () => {
    const input = only(["LEGACY"]); input.filters = { ...input.filters, targetIds: [null] };
    const result = calculateResourceTargetKpi(input, ["system"]);
    expect(result.diagnostics.targetUnlinkedTaskIds).toEqual(["LEGACY"]);
    expect(result.relatedMembers.systemIds).toEqual(["MCS-1"]);
    expect(result.projection.children.map(row => row.id)).toEqual(["MCS-1"]);
    expect(result.taskSources[0].effectiveTargetIds).toEqual([]);
    input.filters = { taskIds: ["LEGACY"], targetIds: ["TARGET-A"] };
    expect(calculateResourceTargetKpi(input).kpi.total.taskCount).toBe(0);
    const mixed = calculateResourceTargetKpi(only(["MIXED"]), ["equipment", "target"]);
    const amr = mixed.projection.children.find(row => row.id === "AMR-B")!;
    expect(amr.children.map(row => row.id)).toEqual([null]);
    expect(amr.children[0].sourceKinds).toEqual(["legacy_direct"]);
    expect(amr.children[0].targetUnlinkedTaskIds).toEqual([]);
    expect(amr.relatedMembers.equipmentIds).toEqual(["AMR-B"]);
    expect(mixed.diagnostics.targetUnlinkedTaskIds).toEqual([]);
  });

  it.each(logisticsTargetResourceCases)("AC4 $id empty/unset/partial/configured0 preserves existing effort semantics", test => {
    const result = calculateResourceTargetKpi(only([...test.taskIds]));
    expect(result.kpi.total.effort).toMatchObject(test.expected);
  });

  it("AC4 T0 is preserved under same-Assignment personal classification and Group/PI never creates effort", () => {
    const input = fixture();
    input.filters = { taskIds: ["GROUP-ONLY", "UNASSIGNED", "UNSET", "PARTIAL"], resourceIds: ["R1"], roles: ["DEVELOPER"], developerGrades: ["ADVANCED"] };
    const result = calculateResourceTargetKpi(input);
    expect(result.kpi.total.assignmentCount).toBe(0);
    expect(result.diagnostics).toMatchObject({ denominator: 4, groupOnly: { taskIds: ["GROUP-ONLY"] }, completelyUnassigned: { taskIds: ["UNASSIGNED"] }, unsetAssignmentIds: ["AP2", "AU1"] });
    input.filters = { taskIds: ["PARTIAL"], resourceIds: ["R2"], developerGrades: ["ADVANCED"] };
    expect(calculateResourceTargetKpi(input).kpi.total.assignmentCount).toBe(0);
  });

  it("AC4 separates unused/common/no WorkArea/unmapped and OR within axis, AND across axes", () => {
    const input = fixture(); input.filters = { workAreaIds: [null], targetScopes: ["process", "project_common"] };
    const result = calculateResourceTargetKpi(input);
    expect(result.kpi.total.taskIds).toEqual(["COMMON", "NOAREA"]);
    expect(result.diagnostics).toMatchObject({ unusedTargetIds: ["TARGET-UNUSED"], projectCommonTargetIds: ["TARGET-COMMON"], noWorkAreaTargetIds: ["TARGET-NOAREA", "TARGET-UNUSED"], unmappedProjectProcessIds: ["LEGACY-PROCESS"] });
    input.filters = { targetIds: ["TARGET-A", "TARGET-B"], processOccurrenceIds: ["OCC-A-ASSEMBLY"], workAreaIds: ["WA-B"] };
    expect(calculateResourceTargetKpi(input).kpi.total.taskIds).toEqual(["INTEGRATED"]);
  });

  it("AC4 Summary self-only / Milestone context references never count as unused Targets", () => {
    const input = fixture();
    input.tasks = [...input.tasks, { ...input.tasks[0], taskId: "CONTEXT-M", parentTaskId: null, type: "milestone", duration: 0, start: "2026-10-05", end: "2026-10-05" }];
    input.logistics.bindings = [...input.logistics.bindings,
      { id: "SUMMARY-SELF", taskId: "SUMMARY", targetId: "TARGET-UNUSED", scope: "self", selection: "whole", memberIds: [] },
      { id: "MILESTONE-SELF", taskId: "CONTEXT-M", targetId: "TARGET-NOAREA", scope: "self", selection: "whole", memberIds: [] },
    ];
    const report = calculateResourceTargetKpi(input);
    expect(report.diagnostics.unusedTargetIds).toEqual([]);
    expect(report.targetUsage.find(row => row.targetId === "TARGET-UNUSED")).toEqual({ targetId: "TARGET-UNUSED", taskIds: [], summaryTaskIds: ["SUMMARY"], milestoneTaskIds: [] });
    expect(report.targetUsage.find(row => row.targetId === "TARGET-NOAREA")!.milestoneTaskIds).toEqual(["CONTEXT-M"]);
    expect(report.kpi.total.effort).toEqual(calculateResourceTargetKpi(fixture()).kpi.total.effort);
  });

  it("AC4 rejects unknown/foreign IDs and null Target + member conflict instead of empty success", () => {
    const input = fixture(); input.filters = { targetIds: [null], systemTypeCodes: ["mcs"] };
    expect(() => calculateResourceTargetKpi(input)).toThrow("UNLINKED_TARGET_MEMBER_FILTER_CONFLICT");
    for (const filters of [{ targetIds: ["FOREIGN"] }, { workAreaIds: ["FOREIGN"] }, { memberSystemIds: ["FOREIGN"] }, { equipmentTypeCodes: ["FOREIGN"] }]) {
      expect(() => calculateResourceTargetKpi({ ...input, filters })).toThrow("INVALID_TARGET_SELECTION");
    }
    const missing = { ...input, logistics: undefined };
    expect(() => calculateResourceKpi({ ...missing, filters: { targetIds: ["TARGET-A"] } })).toThrow("TARGET_SNAPSHOT_REQUIRED");
  });

  it("AC5 calendar precedence, null M/M and progress changes never discount planned effort", () => {
    const input = only(["INTEGRATED"]); input.mdPerMm = null;
    input.calendarExceptions = [
      { ruleId: "GROUP", ruleName: "off", targetType: "RESOURCE_GROUP", targetId: "G2", date: "2026-10-05", dayType: "NON_WORKING" },
      { ruleId: "RESOURCE", ruleName: "on", targetType: "RESOURCE", targetId: "R1", date: "2026-10-05", dayType: "WORKING" },
      { ruleId: "RESOURCE2", ruleName: "off", targetType: "RESOURCE", targetId: "R1", date: "2026-10-06", dayType: "NON_WORKING" },
    ];
    const before = calculateResourceTargetKpi(input);
    expect(before.kpi.total.effort).toMatchObject({ plannedMd: 4, plannedMm: null });
    input.tasks = input.tasks.map(task => task.taskId === "INTEGRATED" ? { ...task, progress: 100, status: "completed" } : task);
    expect(calculateResourceTargetKpi(input).kpi.total.effort).toEqual(before.kpi.total.effort);
    expect(calculateResourceTargetKpi(input).kpi.total.assignedTaskProgress.percent).toBe(100);
  });

  it("AC5 preserves full canonical Milestone readiness outside Target scope", () => {
    const input = fixture();
    input.tasks = [...input.tasks, { ...input.tasks[1], taskId: "M", parentTaskId: null, type: "milestone", start: "2026-10-11", end: "2026-10-11", duration: 0 }];
    input.memberships = [{ taskId: "INTEGRATED", milestoneTaskId: "M" }, { taskId: "UNASSIGNED", milestoneTaskId: "M" }];
    const full = calculateResourceKpi(input).fullMilestones;
    input.filters = { targetIds: ["TARGET-A"] };
    expect(calculateResourceTargetKpi(input).kpi.fullMilestones).toEqual(full);
    expect(calculateResourceTargetKpi(input).kpi.diagnostics.taskIds).not.toContain("UNASSIGNED");
  });

  it("AC5 R4 handoff keeps same-R Project140% outside selected Target80%", () => {
    const input = only(["OVER-SELECTED", "OVER-OUTSIDE"]);
    input.assignments = input.assignments.filter(row => row.taskId.startsWith("OVER"));
    input.logistics.bindings = [{ id: "OVER-B", taskId: "OVER-SELECTED", targetId: "TARGET-A", selection: "whole", scope: "self", memberIds: [] }];
    input.filters = { targetIds: ["TARGET-A"] };
    const p = prepareResourceKpiSnapshot(input), scope = selectResourceTargetPlanScope(p);
    expect(scope.capacityResourceIds).toEqual(["R1"]);
    expect(scope.selectedAssignments.map(row => row.assignmentId)).toEqual(["AO1"]);
    expect(scope.fullProjectAssignments.map(row => row.assignmentId)).toEqual(["AO1", "AO2"]);
    const plan = calculateResourcePlan({ ...scope, resources: p.resources, projectPublicId: input.projectPublicId, from: input.from, to: input.to, asOfDate: input.asOfDate, granularity: "week", mdPerMm: p.mdPerMm, projectCalendar: input.projectCalendar, limits: { resourceDays: 1000, assignmentDays: 1000, matrixCells: 1000 } });
    expect(plan.totals.summary.selected.loadPercent).toBeCloseTo(80);
    expect(plan.totals.summary.project.loadPercent).toBeCloseTo(140);
    expect(plan.totals.summary.project.excessMd).toBeCloseTo(2);
  });

  it("AC5 Target filtering never removes another Resource from R or its Project load", () => {
    const input = fixture(); input.filters = { targetIds: ["TARGET-B"] };
    const scope = selectResourceTargetPlanScope(prepareResourceKpiSnapshot(input));
    expect(scope.capacityResourceIds).toEqual(["R1", "R2", "R3"]);
    expect(scope.selectedAssignments.map(row => row.assignmentId)).toEqual(["A1"]);
    expect(scope.fullProjectAssignments.some(row => row.resourceId === "R2")).toBe(true);
    expect(scope.fullProjectAssignments.some(row => row.resourceId === "R3")).toBe(true);
  });

  it("AC6 permutation/exact duplicate joins preserve report; repeated joins never copy effort", () => {
    const input = fixture(), expected = calculateResourceTargetKpi(input);
    for (let i = 0; i < 8; i++) {
      const rotate = <T,>(rows: readonly T[]) => { const n = i % Math.max(1, rows.length); return [...rows.slice(n), ...rows.slice(0, n)].reverse(); };
      const changed = { ...input, tasks: rotate(input.tasks).concat(input.tasks), assignments: rotate(input.assignments).concat(input.assignments),
        logistics: { ...input.logistics, instances: rotate(input.logistics.instances).concat(input.logistics.instances), targets: [...rotate(input.logistics.targets).map(target => ({ ...target, members: rotate(target.members).concat(target.members) })), ...input.logistics.targets],
          bindings: rotate(input.logistics.bindings).concat(input.logistics.bindings), legacy: rotate(input.logistics.legacy).concat(input.logistics.legacy) } };
      expect(calculateResourceTargetKpi(changed)).toEqual(expected);
    }
  });

  it("AC6 rejects conflicting Target/member/instance/binding/Task/Assignment IDs in both orders", () => {
    const input = fixture();
    const cases = [
      { ...input, tasks: [...input.tasks, { ...input.tasks[1], progress: 60 }] },
      { ...input, assignments: [...input.assignments, { ...input.assignments[0], allocationPercent: 50 }] },
      { ...input, logistics: { ...input.logistics, targets: [...input.logistics.targets, { ...input.logistics.targets[0], active: true }] } },
      { ...input, logistics: { ...input.logistics, instances: [...input.logistics.instances, { ...input.logistics.instances[0], quantity: 1 }] } },
      { ...input, logistics: { ...input.logistics, bindings: [...input.logistics.bindings, { ...input.logistics.bindings[0], scope: "self" as const }] } },
    ];
    for (const value of cases) {
      expect(() => calculateResourceTargetKpi(value)).toThrow(/Conflicting KPI|CONFLICTING_LOGISTICS/);
      expect(() => calculateResourceTargetKpi({ ...value, tasks: [...value.tasks].reverse(), assignments: [...value.assignments].reverse(), logistics: { ...value.logistics, targets: [...value.logistics.targets].reverse(), instances: [...value.logistics.instances].reverse(), bindings: [...value.logistics.bindings].reverse() } })).toThrow(/Conflicting KPI|CONFLICTING_LOGISTICS/);
    }
    const memberConflict = structuredClone(input);
    memberConflict.logistics.targets = memberConflict.logistics.targets.map((target, index) => index === 1 ? { ...target, members: [{ ...target.members[0], id: "MEM-A-AMR" }] } : target);
    expect(() => calculateResourceTargetKpi(memberConflict)).toThrow("CONFLICTING_TARGET_MEMBER_OWNER");
  });

  it("AC6 NaN/Infinity coverage cannot compare equal to null and escape through duplicate collapse", () => {
    for (const coverage of [NaN, Infinity, -Infinity]) for (const reverse of [false, true]) {
      const input = fixture();
      const source = { id: "COV", taskId: "ACS-ONLY", targetId: "TARGET-A", scope: "self" as const, selection: "subset" as const, memberIds: ["MEM-A-AMR"], coverageByMember: [{ memberId: "MEM-A-AMR", coverage: null as number | null }] };
      const rows = [source, { ...source, coverageByMember: [{ memberId: "MEM-A-AMR", coverage }] }];
      input.logistics.bindings = rows[reverse ? "reverse" : "slice"]();
      expect(() => calculateResourceTargetKpi(input)).toThrow("CONFLICTING_LOGISTICS_ID");
    }
  });


  it("AC6 resolver-rejected scope, whole/member, subset and subtree bindings use the documented KPI error type", () => {
    const baseline = fixture();
    const malformedBindings = [
      { code: "INVALID_BINDING_SCOPE", binding: { ...baseline.logistics.bindings[1], scope: "invalid" as "self" } },
      { code: "WHOLE_MEMBERS_MUST_BE_EMPTY", binding: { ...baseline.logistics.bindings[1], memberIds: ["MEM-A-ACS"] } },
      { code: "SUBSET_MEMBER_UNAVAILABLE", binding: { ...baseline.logistics.bindings[3], memberIds: ["NOT-A-TARGET-MEMBER"] } },
      { code: "SUBTREE_REQUIRES_SUMMARY", binding: { ...baseline.logistics.bindings[1], scope: "subtree" as const } },
    ];
    for (const { code, binding } of malformedBindings) {
      const input = fixture();
      input.logistics.bindings = input.logistics.bindings.map(row => row.id === binding.id ? binding : row);
      expect(() => calculateResourceTargetKpi(input)).toThrow(ResourceKpiTargetInputError);
      expect(() => calculateResourceTargetKpi(input)).toThrow(code);
    }
    const input = fixture();
    input.logistics.legacy = input.logistics.legacy.map((row, index) => index === 0 ? { ...row, scope: "invalid" as "self" } : row);
    expect(() => calculateResourceTargetKpi(input)).toThrow(ResourceKpiTargetInputError);
    expect(() => calculateResourceTargetKpi(input)).toThrow("INVALID_LEGACY_SCOPE");
  });

  it("AC6 explicit input/lineage/provenance/projection budget errors never return clipped totals", () => {
    for (const dimension of ["inputRows", "lineageEdges", "provenancePaths", "projectionCells"] as const) {
      const input = fixture(); input.logistics.limits = { [dimension]: 1 };
      expect(() => calculateResourceTargetKpi(input)).toThrow(ResourceKpiTargetLimitError);
    }
    expect(() => calculateResourceTargetKpi({ ...fixture(), logistics: { ...fixture().logistics, limits: { inputRows: NaN } } })).toThrow("INVALID_TARGET_BUDGET");
  });

  it("AC6 F0-Q02 keeps physical quantity10 and separate coverage2/3 with multiple state", () => {
    const input = only(["INTEGRATED"]);
    input.logistics.bindings = [
      { id: "C1", taskId: "SUMMARY", targetId: "TARGET-A", scope: "subtree", selection: "subset", memberIds: ["MEM-A-AMR"], coverageByMember: [{ memberId: "MEM-A-AMR", coverage: 2 }] },
      { id: "C2", taskId: "INTEGRATED", targetId: "TARGET-A", scope: "self", selection: "subset", memberIds: ["MEM-A-AMR"], coverageByMember: [{ memberId: "MEM-A-AMR", coverage: 3 }] },
    ];
    const report = calculateResourceTargetKpi(input);
    expect(report.relatedMembers.equipmentQuantity).toBe(10);
    expect(report.relatedMembers.members[0]).toMatchObject({ coverageState: "multiple", quantity: 10 });
    expect(report.relatedMembers.members[0].provenance.map(source => [source.bindingId, source.coverage])).toEqual([["C1", 2], ["C2", 3]]);
    expect(report.kpi.total.effort.knownMd).toBe(5);
  });

  it("AC6 same-kind instance→type / type→instance projections never join different members", () => {
    const input = only(["INTEGRATED"]);
    input.logistics.instances = [...input.logistics.instances, { kind: "equipment", entityId: "CONVEYOR", typeCode: "conveyor", quantity: 2, projectProcessId: "P1" }];
    input.logistics.targets = input.logistics.targets.map(target => target.id === "TARGET-A" ? { ...target, members: [...target.members, { id: "MEM-CONVEYOR", kind: "equipment", entityId: "CONVEYOR" }] } : target);
    const result = calculateResourceTargetKpi(input, ["equipment", "equipmentType"]);
    expect(result.projection.children.map(row => [row.id, row.children.map(child => child.id)])).toEqual([["AMR-A", ["amr"]], ["AMR-B", ["amr"]], ["CONVEYOR", ["conveyor"]]]);
    const reverse = calculateResourceTargetKpi(input, ["equipmentType", "equipment"]);
    expect(reverse.projection.children.map(row => [row.id, row.children.map(child => child.id)])).toEqual([["amr", ["AMR-A", "AMR-B"]], ["conveyor", ["CONVEYOR"]]]);
    input.filters = { taskIds: ["INTEGRATED"], memberEquipmentIds: ["AMR-A"], equipmentTypeCodes: ["conveyor"] };
    expect(calculateResourceTargetKpi(input).kpi.total.taskCount).toBe(0);
  });
});
