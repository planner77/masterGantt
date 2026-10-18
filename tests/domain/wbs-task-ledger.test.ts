import { describe, expect, it } from "vitest";
import { resolveWbsTaskLedger, selectWbsTaskLedger, summarizeWbsTaskLedger, projectWbsTaskLedger, calculateWbsTaskLedgerKpi, selectWbsTaskLedgerPlanScope,
  summarizeWbsTaskLedgerConfiguration, WbsTaskLedgerInputError, type WbsTaskLedgerInput, type WbsTaskLedgerSelector } from "../../src/domain/resources/wbs-task-ledger";
import { calculateResourceKpi } from "../../src/domain/resources/resource-kpi";
import { calculateResourcePlan } from "../../src/domain/resources/resource-plan";
import { calculateResourceTargetKpi } from "../../src/domain/resources/resource-target-kpi";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import { ledgerFromKpi, wbsTaskLedgerFixture, ledgerMembership } from "../fixtures/wbs-task-ledger";
import { issue623TargetResourceFixture } from "../fixtures/issue-623-target-resource";

const select = (dimension: WbsTaskLedgerSelector["dimension"], id: string | null): WbsTaskLedgerSelector => ({ dimension, id });
const summary = (input: WbsTaskLedgerInput, selectors: WbsTaskLedgerSelector[] = []) => { const snapshot = resolveWbsTaskLedger(input); return summarizeWbsTaskLedger(snapshot, selectWbsTaskLedger(snapshot, selectors)); };
const md = (input: WbsTaskLedgerInput, selectors: WbsTaskLedgerSelector[] = []) => summary(input, selectors).assignments.effort.knownMd;

function error(input: WbsTaskLedgerInput, code: string) {
  expect(() => resolveWbsTaskLedger(input)).toThrowError(expect.objectContaining({ code }));
}

describe("#728 WBS Task ledger — explicit W1/W2 source boundary", () => {
  it("AC1/7/8/10 keeps Target0, unique quantities and MCS14/A8/B9/unlinked2 without mandatory allocation", () => {
    const input = wbsTaskLedgerFixture(), snapshot = resolveWbsTaskLedger(input);
    const mcs = summarizeWbsTaskLedger(snapshot, selectWbsTaskLedger(snapshot, [select("system", "MCS")]));
    expect(mcs.tasks).toMatchObject({ taskIds: ["T0", "T1", "T2", "T3"], taskCount: 4 });
    expect(mcs.assignments.effort.knownMd).toBe(14);
    expect(md(input, [select("process", "PA")])).toBe(8);
    expect(md(input, [select("process", "PB")])).toBe(9);
    expect(md(input, [select("system", "MCS"), select("process", null)])).toBe(2);
    expect(mcs.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 1 });
    expect(mcs.configurationReference).toMatchObject({ systemCount: 1 });
    const full = summary(input);
    expect(full.tasks.taskCount).toBe(6);
    expect(full.relatedMembers).toMatchObject({ equipmentQuantity: 15, systemCount: 3 });
    expect(full.configurationReference).toMatchObject({ equipmentQuantity: 15, systemCount: 3 });
    expect(full.diagnostics.completelyUnassigned.taskIds).toEqual(["UNASSIGNED"]);
    expect(full.diagnostics.groupOnly.taskIds).toEqual(["GROUP_ONLY"]);
    expect(full.participation).toMatchObject({ registeredCount: 2, assignedCount: 1 });
    const resourceRoot = projectWbsTaskLedger(snapshot, ["resource"]);
    expect(resourceRoot.children.find(row => row.selector.id === "R2")!.totals.assignments.effort).toMatchObject({ knownMd: 0, state: "empty" });
    expect(snapshot.configuration.equipmentWorkAreas.filter(row => row.equipmentId === "E10")).toHaveLength(2);
    const wa = projectWbsTaskLedger(snapshot, ["equipment", "workArea"]);
    const e10 = wa.children.find(row => row.selector.id === "E10")!;
    expect(e10.totals.relatedMembers.equipmentQuantity).toBe(10);
    expect(e10.children.map(row => row.totals.relatedMembers.equipmentQuantity)).toEqual([10, 10]);
    expect(e10.totals.assignments.effort.knownMd).toBe(5);
    expect(e10.children.map(row => row.totals.assignments.effort.knownMd)).toEqual([5, 5]);
  });

  it("W2 excludes parent/Target/Equipment/System fallbacks for explicit0 and distinguishes legacy null", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics, targets: [{ id: "OLD", scope: "process", projectProcessId: "PB", occurrenceId: "OB", workAreaId: "WB", members: [{ id: "OLD-M", kind: "system", entityId: "MCS" }] }],
      bindings: [{ id: "OLD-B", taskId: "S", targetId: "OLD", scope: "subtree", selection: "whole", memberIds: [] }] };
    const snapshot = resolveWbsTaskLedger(input), row = snapshot.rows.find(row => row.taskId === "T0")!;
    expect(row.processIds).toEqual([]); expect(row.workAreaIds).toEqual([]);
    expect(row.targetSources.effectiveTargetIds).toEqual(["OLD"]);
    expect(row.sources).toContainEqual(expect.objectContaining({ sourceKind: "ancestor-task-context", entityId: "PB", effective: false }));
    const legacy = resolveWbsTaskLedger({ ...input, contextSourceVersion: "legacy-target-context:v0" });
    expect(legacy.rows.find(row => row.taskId === "T0")!.processIds).toEqual(["PB"]);
    input.taskContexts = input.taskContexts.map(row => row.taskId === "T0" ? { taskId: row.taskId, processLinks: null, workAreaLinks: null } : row);
    const legacyNull = resolveWbsTaskLedger(input);
    expect(legacyNull.rows.find(row => row.taskId === "T0")!.processIds).toEqual([]);
    expect(legacyNull.diagnostics.legacyContextTaskIds).toEqual(["T0"]);
    expect(snapshot.diagnostics.explicitEmptyProcessTaskIds).toContain("T0");
  });

  it("AC2 counts a five-day Assignment once across equipment/areas/groups and adds a real 50% colleague to7.5", () => {
    const input = wbsTaskLedgerFixture();
    const snapshot = resolveWbsTaskLedger(input), projection = projectWbsTaskLedger(snapshot, ["equipment", "workArea", "group"], [select("wbs", "T3")]);
    expect(projection.totals.assignments.effort.knownMd).toBe(5);
    expect(projection.totals.assignments.assignmentIds).toEqual(["A3"]);
    input.kpi.assignments = [...input.kpi.assignments, { assignmentId: "COLLEAGUE", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    expect(md(input, [select("wbs", "T3")])).toBe(7.5);
  });

  it("AC3 direct-only/Target-only/mixed preserve same Task+Assignment oracle, ACS subset and provenance", () => {
    const base = issue623TargetResourceFixture(), input = ledgerFromKpi(base);
    const existing = calculateResourceKpi(base), result = summary(input);
    expect(result.assignments).toEqual(existing.total);
    expect(result.tasks.taskCount).toBe(10);
    const direct = wbsTaskLedgerFixture();
    const target = wbsTaskLedgerFixture();
    target.kpi.logistics = { ...target.kpi.logistics, targets: [{ id: "A", scope: "process", projectProcessId: "PA", occurrenceId: "OA", workAreaId: null,
      members: [{ id: "M-E", kind: "equipment", entityId: "E10" }, { id: "M-S", kind: "system", entityId: "MCS" }] }],
      bindings: [{ id: "B", taskId: "T3", targetId: "A", scope: "self", selection: "whole", memberIds: [] }], legacy: target.kpi.logistics.legacy.filter(row => row.taskId !== "T3").concat([{ taskId: "T3", kind: "equipment", entityId: "E5", scope: "self" }, ...["ACS-A", "ACS-B"].map(entityId => ({ taskId: "T3", kind: "system" as const, entityId, scope: "self" as const }))]) };
    expect(summary(target, [select("wbs", "T3")]).assignments).toEqual(summary(direct, [select("wbs", "T3")]).assignments);
    const mixed = { ...target, kpi: { ...target.kpi, logistics: { ...target.kpi.logistics, legacy: direct.kpi.logistics.legacy } } };
    expect(summary(mixed, [select("wbs", "T3")]).relatedMembers.equipmentQuantity).toBe(15);
    expect(resolveWbsTaskLedger(mixed).rows.find(row => row.taskId === "T3")!.targetSources.legacySources).toContainEqual(expect.objectContaining({ entityId: "E10" }));
    const subset = ledgerFromKpi({ ...base, filters: { taskIds: ["ACS_ONLY"], targetIds: ["TARGET-A"], memberSystemIds: ["ACS-A"] } });
    expect(summary(subset).relatedMembers).toMatchObject({ equipmentQuantity: 0, systemIds: ["ACS-A"] });
    expect(summary(subset).assignments).toEqual(calculateResourceTargetKpi(subset.kpi).kpi.total);
  });

  it("AC3 keeps summary self/subtree equipment union and recomputes lineage after a Task move", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics, legacy: [...input.kpi.logistics.legacy, { taskId: "S", kind: "equipment", entityId: "E10", scope: "subtree" }] };
    expect(resolveWbsTaskLedger(input).rows.find(row => row.taskId === "T0")!.equipmentIds).toEqual(["E10"]);
    input.kpi.tasks = input.kpi.tasks.map(row => row.taskId === "T0" ? { ...row, parentTaskId: null } : row);
    expect(resolveWbsTaskLedger(input).rows.find(row => row.taskId === "T0")!.equipmentIds).toEqual([]);
  });

  it("AC4 validates typed ownership/missing snapshots but allows same-Task cross-process association", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics, legacy: [...input.kpi.logistics.legacy, { taskId: "T1", kind: "equipment", entityId: "E5", scope: "self" }] };
    // E5 belongs to PB; the work explicitly selected PA. These facts coexist.
    expect(summary(input, [select("equipment", "E5"), select("process", "PA")]).tasks.taskIds).toEqual(["T1", "T3"]);
    expect(resolveWbsTaskLedger(input).diagnostics.inactiveInstanceIds).toEqual([{ kind: "equipment", id: "E5" }]);
    error({ ...input, snapshotProjectPublicId: "FOREIGN" }, "PROJECT_SNAPSHOT_MISMATCH");
    error({ ...input, taskContexts: input.taskContexts.slice(1) }, "TASK_CONTEXT_SNAPSHOT_INCOMPLETE");
    error({ ...input, equipmentWorkAreas: [{ equipmentId: "E10", processId: "PB", occurrenceId: "OB", workAreaId: "WA" }] }, "WORK_AREA_OWNERSHIP_MISMATCH");
    error({ ...input, equipmentWorkAreas: [{ equipmentId: "DELETED", processId: "PA", occurrenceId: "OA", workAreaId: "WA" }] }, "INSTANCE_REFERENCE_UNAVAILABLE");
    expect(() => selectWbsTaskLedger(resolveWbsTaskLedger(input), [select("process", "OA")])).toThrowError(WbsTaskLedgerInputError);
    expect(() => resolveWbsTaskLedger({ ...input, equipment: undefined } as unknown as WbsTaskLedgerInput)).toThrowError(expect.objectContaining({ code: "SNAPSHOT_COLLECTION_MISSING" }));
  });

  it("AC4 distinguishes task-association/membership/controls/coordinates/assignment with both endpoints", () => {
    const snapshot = resolveWbsTaskLedger(wbsTaskLedgerFixture());
    expect(snapshot.configuration.sources.filter(row => row.sourceKind === "equipment-work-area").map(row => [row.entityId, row.relatedEntityId])).toEqual([["E10", "WA"], ["E10", "WB"]]);
    expect(snapshot.configuration.sources).toContainEqual(expect.objectContaining({ relationKind: "controls", entityId: "E10", relatedEntityId: "ACS-A" }));
    expect(snapshot.configuration.sources).toContainEqual(expect.objectContaining({ relationKind: "coordinates", entityId: "MCS", relatedEntityId: "ACS-B" }));
    const selection = selectWbsTaskLedger(snapshot, [select("systemCoordination", "MCS")]);
    expect(selection.taskIds).toEqual(["T0", "T1", "T2", "T3"]);
    expect(snapshot.rows.find(row => row.taskId === "T3")!.sources.some(row => row.relationKind === "assignment")).toBe(true);
  });

  it("AC5 reuses all-unset/partial/configured0/M/M and same-R selected80/project140 capacity", () => {
    const input = ledgerFromKpi(issue623TargetResourceFixture());
    for (const [taskId, state, plannedMd] of [["UNSET", "unset", null], ["PARTIAL", "partial", 2], ["ZERO", "configured", 0]] as const) {
      expect(summary(input, [select("wbs", taskId)]).assignments.effort).toMatchObject({ state, plannedMd });
    }
    const noMm = { ...input, kpi: { ...input.kpi, mdPerMm: null } };
    expect(summary(noMm).assignments.effort.plannedMm).toBeNull();
    expect(summary(input, [select("process", null)]).tasks.taskCount).toBe(10);
    const empty = summary(input, [select("wbs", "M1")]);
    expect(empty.tasks.progress.percent).toBeNull(); expect(empty.tasks.completion.percent).toBeNull();
    input.kpi.filters = { resourceIds: ["R4"] };
    const snapshot = resolveWbsTaskLedger(input), selection = selectWbsTaskLedger(snapshot, [select("target", "TARGET-A")]), scope = selectWbsTaskLedgerPlanScope(snapshot, selection);
    const result = calculateResourcePlan({ ...scope, projectPublicId: input.kpi.projectPublicId, from: input.kpi.from, to: input.kpi.to, asOfDate: input.kpi.asOfDate,
      projectCalendar: input.kpi.projectCalendar, resources: input.kpi.resources, mdPerMm: 20, granularity: "week", limits: { resourceDays: 1000, assignmentDays: 10000, matrixCells: 1000 } });
    expect(scope.capacityResourceIds).toEqual(["R4"]);
    expect(result.totals.summary.selected).toMatchObject({ capacityMd: 5, loadPercent: 80 });
    expect(result.totals.summary.project.loadPercent).toBeCloseTo(140, 12);
    expect(result.totals.summary.project.excessMd).toBeCloseTo(2, 12);
  });

  it("AC5 role/registration/Group-only do not manufacture assignments, effort or Capacity R", () => {
    const input = wbsTaskLedgerFixture();
    input.equipment = input.equipment.map(row => ({ ...row, resourceRoles: [{ resourceId: "R2", resourceCode: "R2", resourceName: "R2", role: "owner", isPrimary: true, active: true }] }));
    input.resourceMemberships = [ledgerMembership("R1", false), ledgerMembership("R2")];
    const snapshot = resolveWbsTaskLedger(input), total = summary(input);
    expect(total.participation).toMatchObject({ registeredCount: 1, assignedCount: 1 });
    expect(selectWbsTaskLedgerPlanScope(snapshot).capacityResourceIds).toEqual(["R1"]);
    const r2 = summary(input, [select("resource", "R2")]);
    expect(r2.assignments.effort.knownMd).toBe(0);
    expect(r2.diagnostics.completelyUnassigned.taskIds).toEqual(["UNASSIGNED"]);
    expect(summary(input, [select("group", "G1")]).assignments.assignmentIds).not.toContain("GROUP");
  });

  it("AC6/9 preserves t1 Task and Assignment identity at E1→Milestone→process and never shrinks full Gate", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics, legacy: [...input.kpi.logistics.legacy, { taskId: "T1", kind: "equipment", entityId: "E10", scope: "self" }, { taskId: "T2", kind: "equipment", entityId: "E5", scope: "self" }] };
    input.kpi.assignments = input.kpi.assignments.map(row => row.taskId === "T2" ? { ...row, targetId: "R2" } : row);
    const snapshot = resolveWbsTaskLedger(input), selectors = [select("equipment", "E10"), select("milestone", "M")];
    const narrowed = selectWbsTaskLedger(snapshot, selectors);
    expect(narrowed.taskIds).toEqual(["T1"]); expect(narrowed.assignmentIds).toEqual(["A1"]);
    expect(selectWbsTaskLedger(snapshot, [...selectors, select("process", "PB")]).taskIds).toEqual([]);
    const fullGate = summary(input).fullMilestones.find(row => row.milestoneTaskId === "M")!.stageGate;
    expect(summarizeWbsTaskLedger(snapshot, narrowed).fullMilestones.find(row => row.milestoneTaskId === "M")!.stageGate).toEqual(fullGate);
    expect(fullGate).toMatchObject({ memberCount: 2, completedMemberCount: 1, ready: false });
    const tree = projectWbsTaskLedger(snapshot, ["equipment", "milestone", "process"]);
    const path = tree.children.find(row => row.selector.id === "E10")!.children.find(row => row.selector.id === "M")!;
    expect(path.children.map(row => row.selector.id)).toEqual(["PA"]);
  });

  it("AC6/10 is invariant under duplicate joins/input order/axes/selector order, and never mutates source", () => {
    const input = wbsTaskLedgerFixture(), serialized = JSON.stringify(input), baseline = calculateWbsTaskLedgerKpi(input);
    const duplicate = { ...input, taskContexts: [...input.taskContexts].reverse().concat(input.taskContexts), equipmentWorkAreas: [...input.equipmentWorkAreas].reverse().concat(input.equipmentWorkAreas),
      kpi: { ...input.kpi, tasks: [...input.kpi.tasks].reverse().concat(input.kpi.tasks), assignments: [...input.kpi.assignments].reverse().concat(input.kpi.assignments),
        logistics: { ...input.kpi.logistics, legacy: [...input.kpi.logistics.legacy].reverse().concat(input.kpi.logistics.legacy) } } };
    expect(calculateWbsTaskLedgerKpi(duplicate).totals).toEqual(baseline.totals);
    const snapshot = resolveWbsTaskLedger(input);
    for (const order of [["process", "system", "group"], ["system", "group", "process"], ["group", "process", "system"]] as const) expect(projectWbsTaskLedger(snapshot, order).totals).toEqual(baseline.totals);
    const selectors = [select("process", "PA"), select("system", "MCS"), select("group", "G2")];
    expect(selectWbsTaskLedger(snapshot, selectors).assignmentIds).toEqual(selectWbsTaskLedger(snapshot, [...selectors].reverse()).assignmentIds);
    expect(JSON.stringify(input)).toBe(serialized);
    // Caller edits after resolution cannot rewrite the captured canonical snapshot.
    input.taskContexts[0].processLinks!.push({ processId: "PA", scope: "self" });
    expect(snapshot.rows.find(row => row.taskId === input.taskContexts[0].taskId)!.processIds).toEqual(["PB"]);
  });

  it("retains holiday overrides and validates context malformed states/coordination cycles/budgets", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.projectCalendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-10-06" }] });
    expect(md(input)).toBeCloseTo(14 * 4 / 5, 12);
    const malformed = { ...input, taskContexts: input.taskContexts.map(row => row.taskId === "T0" ? { ...row, processLinks: null } : row) };
    error(malformed, "INVALID_TASK_CONTEXT_STATE");
    const cycle = { ...input, systems: input.systems.map(row => row.id === "MCS" ? { ...row, coordinatedSystemIds: ["MCS"] } : row) };
    error(cycle, "CIRCULAR_COORDINATION");
    expect(() => projectWbsTaskLedger(resolveWbsTaskLedger({ ...input, maxProjectionCells: 1 }), ["process"])).toThrowError(expect.objectContaining({ code: "LEDGER_PROJECTION_LIMIT_EXCEEDED" }));
    const foreign = { ...input, taskContexts: input.taskContexts.map(row => row.taskId === "T0" ? { ...row, processLinks: [{ processId: "foreign", scope: "self" as const }] } : row) };
    error(foreign, "PROCESS_REFERENCE_UNAVAILABLE");
  });
  it("rejects #725 duplicate process scopes/milestone contexts and preserves inactive catalogs", () => {
    const input = wbsTaskLedgerFixture();
    error({ ...input, taskContexts: input.taskContexts.map(row => row.taskId === "S" ? { ...row, processLinks: [{ processId: "PA", scope: "self" }, { processId: "PA", scope: "subtree" }] } : row) }, "DUPLICATE_TASK_PROCESS");
    error({ ...input, taskContexts: input.taskContexts.map(row => row.taskId === "M" ? { ...row, processLinks: [{ processId: "PA", scope: "self" }] } : row) }, "MILESTONE_CONTEXT_UNSUPPORTED");
    const snapshot = resolveWbsTaskLedger({ ...input, processActivity: [{ id: "PA", active: false }], workAreaActivity: [{ id: "WA", active: false }] });
    expect(snapshot.diagnostics.inactiveProcessIds).toEqual(["PA"]);
    expect(snapshot.diagnostics.inactiveWorkAreaIds).toEqual(["WA"]);
    expect(selectWbsTaskLedger(snapshot, [select("process", "PA")]).taskIds).toEqual(["T1", "T3"]);
    expect(snapshot.rows.find(row => row.taskId === "S")!.sources).toContainEqual(expect.objectContaining({ scope: "subtree", entityId: "PB" }));
  });

  it("bounds complete snapshot inputs before cloning and iterative coordination ancestry before fanout", () => {
    const input = wbsTaskLedgerFixture();
    error({ ...input, kpi: { ...input.kpi, logistics: { ...input.kpi.logistics, limits: { inputRows: 10 } } } }, "LEDGER_INPUT_LIMIT_EXCEEDED");
    const count = 200, systems = Array.from({ length: count }, (_, index) => ({ id: `C${index}`, layer: "coordinator" as const, scope: "project" as const, processIds: [], coordinatedSystemIds: index + 1 < count ? [`C${index + 1}`] : [], resourceRoles: [] }));
    const deep = { ...input, systems: [...input.systems, ...systems], kpi: { ...input.kpi, logistics: { ...input.kpi.logistics, instances: [...input.kpi.logistics.instances, ...systems.map(row => ({ kind: "system" as const, entityId: row.id, quantity: 1, typeCode: "mcs" }))], limits: { lineageEdges: 1000 } } } };
    expect(() => resolveWbsTaskLedger(deep)).toThrowError(expect.objectContaining({ name: "ResourceKpiTargetLimitError", dimension: "lineageEdges" }));
    expect(() => resolveWbsTaskLedger({ ...deep, kpi: { ...deep.kpi, logistics: { ...deep.kpi.logistics, limits: { lineageEdges: 25000 } } } })).not.toThrow();
  });

  it("configuration reference binds instance/type and local process/occurrence on the same fact", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.logistics = { ...input.kpi.logistics, instances: input.kpi.logistics.instances.map(row => row.entityId === "E5" ? { ...row, typeCode: "conveyor" } : row) };
    input.equipment = input.equipment.map(row => ({ ...row, controlSystems: [{ systemId: "ACS-A", controlRole: "primary" }] }));
    const snapshot = resolveWbsTaskLedger(input);
    expect(summarizeWbsTaskLedgerConfiguration(snapshot, [select("equipment", "E10"), select("equipmentType", "conveyor")])).toMatchObject({ equipmentQuantity: 0, systemCount: 0 });
    expect(summarizeWbsTaskLedgerConfiguration(snapshot, [select("process", "PA"), select("processOccurrence", "OB")])).toMatchObject({ equipmentQuantity: 0, systemCount: 0 });
    expect(summarizeWbsTaskLedgerConfiguration(snapshot, [select("workArea", "WA")]).equipmentQuantity).toBe(10);
  });

  it("rejects an incomplete #727 resource-membership snapshot instead of silently undercounting registration", () => {
    const input = wbsTaskLedgerFixture();
    const incomplete = { ...input, resourceMemberships: input.resourceMemberships.filter(row => row.id !== "R2") };
    error(incomplete, "RESOURCE_MEMBERSHIP_SNAPSHOT_INCOMPLETE");
    error({ ...input, resourceMemberships: [...input.resourceMemberships, ledgerMembership("FOREIGN")] }, "RESOURCE_REFERENCE_UNAVAILABLE");
    expect(resolveWbsTaskLedger(input).configuration.resourceMemberships.map(row => row.id)).toEqual(["R1", "R2"]);
  });

  it("keeps unclassified personal assignments under role:null and explicit UNSPECIFIED without losing Task identity", () => {
    const input = wbsTaskLedgerFixture();
    input.kpi.assignments = [...input.kpi.assignments,
      { assignmentId: "UNCLASSIFIED", taskId: "T3", kind: "resource", targetId: "R2", allocationPercent: 50 }];
    const snapshot = resolveWbsTaskLedger(input);
    const unlinked = selectWbsTaskLedger(snapshot, [select("role", null)]);
    expect(unlinked.assignmentIds).toEqual(["UNCLASSIFIED"]);
    expect(unlinked.taskIds).toContain("T3");
    expect(unlinked.taskIds).toContain("UNASSIGNED");
    expect(unlinked.taskIds).toContain("GROUP_ONLY");
    expect(summarizeWbsTaskLedger(snapshot, unlinked).assignments.effort.knownMd).toBe(2.5);
    expect(selectWbsTaskLedger(snapshot, [select("role", "UNSPECIFIED")]).assignmentIds).toEqual(["UNCLASSIFIED"]);
    expect(selectWbsTaskLedger(snapshot, [select("role", "DEVELOPER")]).assignmentIds).not.toContain("UNCLASSIFIED");
    const path = [select("wbs", "T3"), select("role", null)];
    expect(selectWbsTaskLedger(snapshot, path).assignmentIds).toEqual(["UNCLASSIFIED"]);
    expect(selectWbsTaskLedger(snapshot, [...path].reverse()).assignmentIds).toEqual(["UNCLASSIFIED"]);
  });

});
