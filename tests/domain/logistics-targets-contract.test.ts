import { describe, expect, it } from "vitest";
import { calculateResourceKpi } from "../../src/domain/resources/resource-kpi";
import { calculateResourcePlan } from "../../src/domain/resources/resource-plan";
import {
  logisticsTargetBase as base, logisticsTargetLinkCases, logisticsTargetLocationCases,
  logisticsTargetResourceFixture, logisticsTargetResourceCases, logisticsTargetQuantityCase,
  logisticsTargetEffortUnionCase, logisticsTargetCoAssigneeCase, logisticsTargetOverloadCase,
  logisticsTargetCoverageCase, logisticsTargetFilterCases, logisticsTargetFilterBindings, logisticsTargetMmUnsetCase,
  logisticsTargetRemapCase, logisticsTargetKindFilterCases,
  type F0EffectiveMember, type F0LinkCase, type F0LegacySource,
} from "../fixtures/logistics-targets";

/** Test-only reference oracle for the proposed F0 contract. No product DTO/storage/API is added. */
function normalizeLinks(input: F0LinkCase): F0LinkCase["expected"] {
  const taskIds = new Set<string>();
  let task = base.tasks.find((row) => row.id === input.taskId);
  while (task) {
    taskIds.add(task.id);
    task = base.tasks.find((row) => row.id === task!.parentId);
  }
  const members = new Map<string, F0EffectiveMember>();
  for (const binding of input.bindings) {
    const source = base.tasks.find((row) => row.id === binding.taskId);
    if (binding.scope === "subtree" && source?.type !== "summary") return { error: "SUBTREE_REQUIRES_SUMMARY" };
    const inherited = binding.taskId !== input.taskId;
    if (!taskIds.has(binding.taskId) || inherited && binding.scope !== "subtree") continue;
    const target = base.targets.find((row) => row.id === binding.targetId);
    if (!target) return { error: "TARGET_UNAVAILABLE" };
    if (binding.selection === "whole" && binding.memberIds.length) return { error: "WHOLE_MEMBERS_MUST_BE_EMPTY" };
    if (binding.selection === "subset" && !binding.memberIds.length) return { error: "EMPTY_SUBSET" };
    if (binding.selection === "subset" && binding.memberIds.some((id) => !target.members.some((row) => row.id === id))) return { error: "SUBSET_MEMBER_UNAVAILABLE" };
    for (const member of target.members.filter((row) => binding.selection === "whole" || binding.memberIds.includes(row.id))) {
      const key = `${member.kind}:${member.entityId}`;
      const value = members.get(key) ?? { kind: member.kind, entityId: member.entityId, provenance: [] };
      const provenance = { bindingId: binding.id, sourceTaskId: binding.taskId, targetId: binding.targetId, memberId: member.id, selection: binding.selection, scope: binding.scope, inherited };
      if (!value.provenance.some((row) => JSON.stringify(row) === JSON.stringify(provenance))) value.provenance.push(provenance);
      value.provenance.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      members.set(key, value);
    }
  }
  const legacySources = new Map<string, F0LegacySource>();
  for (const link of input.legacy) {
    const sourceTask = base.tasks.find((row) => row.id === link.taskId);
    if (link.scope === "subtree" && sourceTask?.type !== "summary") return { error: "LEGACY_SUBTREE_REQUIRES_SUMMARY" };
    const inherited = link.taskId !== input.taskId;
    if (!taskIds.has(link.taskId) || inherited && link.scope !== "subtree") continue;
    const source: F0LegacySource = { sourceKind: "legacy_direct", sourceTaskId: link.taskId, kind: link.kind, entityId: link.entityId, scope: link.scope, inherited };
    legacySources.set(JSON.stringify(source), source);
  }
  return { members: [...members.values()].sort((a, b) => `${a.kind}:${a.entityId}`.localeCompare(`${b.kind}:${b.entityId}`)),
    legacyEntityIds: [...new Set([...legacySources.values()].map((row) => row.entityId))].sort(),
    legacySources: [...legacySources.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
}

describe("Issue #614 F0 synthetic Target contract (not production implementation)", () => {
  it.each(logisticsTargetLinkCases)("$id normalizes whole/subset/union/provenance and legacy boundaries", (input) => {
    expect(normalizeLinks(input)).toEqual(input.expected);
  });

  it("F0-L12 whole is live while subset remains an explicit member reference", () => {
    const fixture = structuredClone(logisticsTargetLinkCases[0]);
    const subset = structuredClone(logisticsTargetLinkCases[1]);
    // Simulate a membership change in the specification data, never a persisted API mutation.
    const target = base.targets[0];
    const original = target.members;
    try {
      target.members = [...original, { id: "MEM-A-NEW", kind: "system", entityId: "NEW-SYSTEM" }];
      expect(normalizeLinks(fixture)).toMatchObject({ members: expect.arrayContaining([expect.objectContaining({ entityId: "NEW-SYSTEM" })]) });
      expect(normalizeLinks(subset)).toEqual(subset.expected);
      target.members = original.filter((row) => row.id !== "MEM-A-ACS");
      expect(normalizeLinks(subset)).toEqual({ error: "SUBSET_MEMBER_UNAVAILABLE" });
    } finally { target.members = original; }
  });

  it("F0-L15 produces a stable provenance set under duplicate joins and permutations", () => {
    const fixture = logisticsTargetLinkCases.find((row) => row.id === "F0-L04")!;
    const duplicate = structuredClone(fixture);
    duplicate.bindings = [...duplicate.bindings.reverse(), ...fixture.bindings];
    duplicate.bindings = duplicate.bindings.map((binding) => ({ ...binding, memberIds: [...binding.memberIds, ...binding.memberIds] }));
    expect(normalizeLinks(duplicate)).toEqual(fixture.expected);
  });

  it(`${logisticsTargetRemapCase.id} explicitly remaps an unavailable subset without whole broadening`, () => {
    const removed = logisticsTargetLinkCases.find((row) => row.id === "F0-L07")!;
    expect(normalizeLinks(removed)).toEqual({ error: "SUBSET_MEMBER_UNAVAILABLE" });
    expect(logisticsTargetRemapCase.bindings[0]).toMatchObject({ id: removed.bindings[0].id, selection: "subset", memberIds: ["MEM-A-ACS"] });
    expect(normalizeLinks(logisticsTargetRemapCase)).toEqual(logisticsTargetRemapCase.expected);
  });

  it("F0-L20 preserves a stable legacy source set with overlapping direct and inherited references", () => {
    const inherited = structuredClone(logisticsTargetLinkCases.find((row) => row.id === "F0-L16")!);
    const direct = logisticsTargetLinkCases.find((row) => row.id === "F0-L14")!;
    inherited.legacy.push(...direct.legacy);
    const before = normalizeLinks(inherited);
    inherited.legacy = [...inherited.legacy.reverse(), ...inherited.legacy];
    expect(normalizeLinks(inherited)).toEqual(before);
    expect(before).toMatchObject({ legacyEntityIds: ["ACS-A"], legacySources: [
      { sourceTaskId: "S", inherited: true, scope: "subtree" }, { sourceTaskId: "T", inherited: false, scope: "self" },
    ] });
    if ("error" in before) throw new Error(before.error);
    expect(before.members).toHaveLength(1);
    expect(before.members[0].provenance).toHaveLength(1);
    expect(new Set([...before.members, ...before.legacySources].map((row) => `${row.kind}:${row.entityId}`)).size).toBe(1);
    const whole = structuredClone(logisticsTargetLinkCases.find((row) => row.id === "F0-L01")!);
    whole.legacy = [{ taskId: "S", kind: "system", entityId: "MCS-1", scope: "subtree" }];
    const wholeOutput = normalizeLinks(whole);
    if ("error" in wholeOutput) throw new Error(wholeOutput.error);
    expect(wholeOutput.members).toHaveLength(3);
    expect(wholeOutput.legacySources).toEqual([{ sourceKind: "legacy_direct", sourceTaskId: "S", kind: "system", entityId: "MCS-1", scope: "subtree", inherited: true }]);
    expect(new Set([...wholeOutput.members, ...wholeOutput.legacySources].map((row) => `${row.kind}:${row.entityId}`)).size).toBe(3);
  });

  it.each(logisticsTargetLocationCases)("$id validates site-product occurrence and exclusive WorkArea", (input) => {
    let result: string = "VALID";
    const occurrence = base.occurrences.find((row) => row.id === input.occurrenceId);
    const workArea = base.workAreas.find((row) => row.id === input.workAreaId);
    if (input.scope === "project_common") {
      if (input.occurrenceId !== null || input.workAreaId !== null) result = "PROJECT_COMMON_LOCATION_FORBIDDEN";
    } else if (!occurrence) result = "PROCESS_REQUIRED";
    else if (occurrence.siteId !== input.projectSiteId || occurrence.productId !== "PRODUCT-P") result = "PROJECT_SITE_PRODUCT_MISMATCH";
    else if (input.workAreaId !== null && workArea?.occurrenceId !== occurrence.id) result = "WORK_AREA_OCCURRENCE_MISMATCH";
    expect(result).toBe(input.expected);
  });

  it("F0-P08 shares product standards across sites and keeps site additions distinct", () => {
    expect(base.occurrences.filter((row) => row.standardId === "STANDARD-ASSEMBLY").map((row) => row.siteId)).toEqual(["SITE-A", "SITE-B"]);
    expect(base.occurrences.filter((row) => row.standardId === "STANDARD-INSPECTION").map((row) => row.siteId)).toEqual(["SITE-A", "SITE-B"]);
    expect(base.occurrences.find((row) => row.id === "OCC-B-SPECIAL")).toMatchObject({ standardId: null, siteId: "SITE-B" });
    expect(base.workAreas.filter((row) => row.occurrenceId === "OCC-A-INSPECTION")).toEqual([]);
  });

  it(`${logisticsTargetQuantityCase.id} counts distinct physical IDs, not repeated Target membership`, () => {
    const members = base.targets.flatMap((row) => row.members);
    const equipmentIds = new Set(members.filter((row) => row.kind === "equipment").map((row) => row.entityId));
    const systemIds = new Set(members.filter((row) => row.kind === "system").map((row) => row.entityId));
    expect({ equipmentQuantity: base.equipment.filter((row) => equipmentIds.has(row.id)).reduce((sum, row) => sum + row.quantity, 0),
      systemInstances: systemIds.size, acsInstances: base.systems.filter((row) => systemIds.has(row.id) && row.systemType === "acs").length,
      mcsInstances: base.systems.filter((row) => systemIds.has(row.id) && row.systemType === "mcs").length }).toEqual(logisticsTargetQuantityCase.expected);
  });

  it(`${logisticsTargetCoverageCase.id} separates work coverage from physical quantity`, () => {
    const input = logisticsTargetCoverageCase;
    const quantity = base.equipment.find((row) => row.id === input.equipmentId)!.quantity;
    const coverageByBinding = input.bindings.map((binding) => ({ bindingId: binding.id, coverage: binding.coverageByMember[0].coverage }));
    for (const source of coverageByBinding) {
      expect(source.coverage).toBeGreaterThan(0);
      expect(source.coverage).toBeLessThanOrEqual(quantity);
    }
    expect({ equipmentQuantity: quantity, coverageState: new Set(coverageByBinding.map((row) => row.coverage)).size > 1 ? "multiple" : "single", coverageByBinding }).toEqual(input.expected);
  });

  it.each(logisticsTargetFilterCases)("$id intersects filters on one binding/member path", (input) => {
    const effective = normalizeLinks({ id: input.id, taskId: "T", bindings: logisticsTargetFilterBindings, legacy: [], expected: { members: [], legacyEntityIds: [], legacySources: [] } });
    if ("error" in effective) throw new Error(effective.error);
    const matches = effective.members.some((member) => (!input.memberEntityIds.length || (input.memberEntityIds as readonly string[]).includes(member.entityId)) &&
      member.provenance.some((path) => {
        const target = base.targets.find((row) => row.id === path.targetId)!;
        return (!input.targetIds.length || (input.targetIds as readonly string[]).includes(path.targetId)) &&
          (!input.workAreaIds.length || (input.workAreaIds as readonly string[]).includes(target.workAreaId!));
      }));
    expect(matches).toBe(input.expected);
  });

  it.each(logisticsTargetKindFilterCases)("$id requires Equipment and System conditions within the same effective binding", (input) => {
    const effective = normalizeLinks({ id: input.id, taskId: "T", bindings: logisticsTargetFilterBindings, legacy: [], expected: { members: [], legacyEntityIds: [], legacySources: [] } });
    if ("error" in effective) throw new Error(effective.error);
    const matches = logisticsTargetFilterBindings.some((binding) => {
      if (input.targetIds.length && !(input.targetIds as readonly string[]).includes(binding.targetId)) return false;
      const selected = effective.members.filter((member) => member.provenance.some((path) => path.bindingId === binding.id));
      return selected.some((member) => member.kind === "equipment" && (input.equipmentEntityIds as readonly string[]).includes(member.entityId)) &&
        selected.some((member) => member.kind === "system" && (input.systemEntityIds as readonly string[]).includes(member.entityId));
    });
    expect(matches).toBe(input.expected);
  });

  it.each(logisticsTargetResourceCases)("$id uses the existing Resource engine for raw/null effort", (input) => {
    const fixture = logisticsTargetResourceFixture(); fixture.filters = { taskIds: [...input.taskIds] };
    expect(calculateResourceKpi(fixture).total.effort).toMatchObject(input.expected);
  });

  it(`${logisticsTargetEffortUnionCase.id} recomputes overlapping Target totals from distinct assignments`, () => {
    const input = logisticsTargetEffortUnionCase;
    const fixture = logisticsTargetResourceFixture();
    const calculate = (taskIds: string[]) => calculateResourceKpi({ ...fixture, filters: { taskIds } }).total.effort.knownMd;
    expect({ targetA: calculate(input.targetTaskIds["TARGET-A"]), targetB: calculate(input.targetTaskIds["TARGET-B"]),
      union: calculate([...new Set(Object.values(input.targetTaskIds).flat())]) }).toEqual(input.expected);
  });

  it(`${logisticsTargetCoAssigneeCase.id} preserves personal assignment grain and non-additive Groups`, () => {
    const fixture = logisticsTargetResourceFixture(); fixture.filters = { taskIds: ["INTEGRATED"] };
    fixture.assignments = [...fixture.assignments, ...logisticsTargetCoAssigneeCase.extraAssignments];
    const output = calculateResourceKpi(fixture);
    expect({ rawPersonalAssignmentIds: output.total.assignmentIds, taskCount: output.total.taskCount, assignmentCount: output.total.assignmentCount,
      knownMd: output.total.effort.knownMd, g1Md: output.groups.find((row) => row.id === "G1")!.effort.knownMd,
      g2Md: output.groups.find((row) => row.id === "G2")!.effort.knownMd }).toEqual(logisticsTargetCoAssigneeCase.expected);
  });

  it("F0-R10 keeps T0 diagnostics independent of personal A/R filters", () => {
    const fixture = logisticsTargetResourceFixture(); fixture.filters = { taskIds: ["GROUP-ONLY", "UNASSIGNED"], resourceIds: ["R1"] };
    const output = calculateResourceKpi(fixture);
    expect(output.total.assignmentIds).toEqual([]);
    expect(output.diagnostics).toMatchObject({ denominator: 2, completelyUnassigned: { taskIds: ["UNASSIGNED"] }, groupOnly: { taskIds: ["GROUP-ONLY"] }, personallyUnassigned: { count: 2 } });
  });

  it(`${logisticsTargetMmUnsetCase.id} leaves M/M null without an explicit conversion basis`, () => {
    const fixture = logisticsTargetResourceFixture();
    delete fixture.mdPerMm;
    fixture.filters = { taskIds: logisticsTargetMmUnsetCase.taskIds };
    const output = calculateResourceKpi(fixture);
    expect(output.total.effort).toMatchObject(logisticsTargetMmUnsetCase.expected);
    expect(output.mdPerMm).toBeNull();
    expect(output.mdPerMmSource).toBe("unset");
  });

  it(`${logisticsTargetOverloadCase.id} retains full Project140 behind selected Target80`, () => {
    const fixture = logisticsTargetResourceFixture();
    const input = logisticsTargetOverloadCase;
    const selected = calculateResourceKpi({ ...fixture, filters: { taskIds: input.selectedTaskIds } });
    const full = calculateResourceKpi({ ...fixture, filters: { taskIds: input.projectTaskIds } });
    const output = calculateResourcePlan({ projectPublicId: fixture.projectPublicId, from: fixture.from, to: fixture.to, asOfDate: fixture.asOfDate,
      granularity: "week", mdPerMm: 20, projectCalendar: fixture.projectCalendar, capacityResourceIds: ["R1"], resources: fixture.resources,
      selectedAssignments: selected.assignments, fullProjectAssignments: full.assignments,
      limits: { resourceDays: 100, assignmentDays: 100, matrixCells: 100 } });
    expect(output.totals.summary.selected.loadPercent).toBe(input.expected.selectedLoadPercent);
    expect(output.totals.summary.project.loadPercent).toBe(input.expected.projectLoadPercent);
    expect(output.totals.summary.project.excessMd).toBeCloseTo(input.expected.projectExcessMd, 12);
    expect(output.totals.summary.selected.overAllocatedResourceCount).toBe(0);
    expect(output.totals.summary.project.overAllocatedResourceCount).toBe(1);
  });
});
