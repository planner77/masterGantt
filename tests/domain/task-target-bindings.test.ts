import { describe, expect, it } from "vitest";
import {
  compareTaskTargetImpact, countTaskTargetUsage, resolveAllTaskTargetBindings,
  resolveTaskTargetBindings, type TaskTargetResolutionInput,
} from "../../src/domain/logistics/task-target-bindings";
import {
  logisticsTargetBase as base, logisticsTargetLinkCases, logisticsTargetCoverageCase,
  type F0LinkCase,
} from "../fixtures/logistics-targets";

function snapshot(input: Pick<F0LinkCase, "bindings" | "legacy">): TaskTargetResolutionInput {
  return {
    tasks: base.tasks.map(task => ({ ...task, type: task.type as "task" | "summary" | "milestone" })),
    targets: base.targets.map(target => ({ ...target, members: target.members.map(member => ({ ...member,
      quantity: member.kind === "system" ? 1 : base.equipment.find(equipment => equipment.id === member.entityId)!.quantity,
    })) })),
    bindings: structuredClone(input.bindings), legacy: structuredClone(input.legacy),
  };
}

function projection(input: F0LinkCase): F0LinkCase["expected"] {
  try {
    const result = resolveTaskTargetBindings(input.taskId, snapshot(input));
    return {
      members: result.effectiveMembers.map(({ kind, entityId, provenance }) => ({ kind, entityId,
        provenance: provenance.map(source => ({ bindingId: source.bindingId, sourceTaskId: source.sourceTaskId,
          targetId: source.targetId, memberId: source.memberId, selection: source.selection,
          scope: source.scope, inherited: source.inherited })),
      })),
      legacyEntityIds: [...new Set(result.legacySources.map(source => source.entityId))].sort(),
      legacySources: result.legacySources,
    };
  } catch (error) { return { error: (error as { code: string }).code }; }
}

describe("Issue #617 production Target resolver consumes F0 golden contract", () => {
  it.each(logisticsTargetLinkCases)("$id preserves selection, union and all source paths", input => {
    expect(projection(input)).toEqual(input.expected);
  });

  it("resolves live whole membership without broadening explicit subset", () => {
    const whole = snapshot(logisticsTargetLinkCases[0]);
    const subset = snapshot(logisticsTargetLinkCases[1]);
    const extra = { id: "NEW-MEMBER", kind: "system" as const, entityId: "NEW-SYSTEM", quantity: 1 };
    const add = (value: TaskTargetResolutionInput) => ({ ...value,
      targets: value.targets.map(target => ({ ...target, members: target.id === "TARGET-A" ? [...target.members, extra] : target.members })),
    });
    expect(resolveTaskTargetBindings("T", add(whole)).effectiveSystemIds).toContain("NEW-SYSTEM");
    expect(resolveTaskTargetBindings("T", add(subset)).effectiveSystemIds).toEqual(["ACS-A"]);
    const removed = { ...subset, targets: subset.targets.map(target => ({ ...target, members: target.members.filter(member => member.id !== "MEM-A-ACS") })) };
    expect(() => resolveTaskTargetBindings("T", removed)).toThrow("SUBSET_MEMBER_UNAVAILABLE");
  });

  it("is immutable and invariant under task/member/binding/legacy permutation and repeated joins", () => {
    const fixture = logisticsTargetLinkCases.find(input => input.id === "F0-L04")!;
    const initial = snapshot({ ...fixture, legacy: [
      { taskId: "S", kind: "system", entityId: "ACS-A", scope: "subtree" },
      { taskId: "T", kind: "system", entityId: "ACS-A", scope: "self" },
    ] });
    const original = JSON.stringify(initial);
    const expected = [...resolveAllTaskTargetBindings(initial)];
    // Exercise all six permutations of the three overlapping binding rows.
    for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      const permuted = {
        ...initial, tasks: [...initial.tasks].reverse(),
        targets: [...initial.targets].reverse().map(target => ({ ...target, members: [...target.members].reverse() })),
        bindings: order.flatMap(index => [initial.bindings[index], { ...initial.bindings[index], memberIds: [...initial.bindings[index].memberIds, ...initial.bindings[index].memberIds] }]),
        legacy: [...initial.legacy].reverse().concat(initial.legacy),
      };
      expect([...resolveAllTaskTargetBindings(permuted)]).toEqual(expected);
    }
    expect(JSON.stringify(initial)).toBe(original);
  });

  it("never infers Target usage from shared legacy MCS and deduplicates overlapping instances", () => {
    const legacyOnly = snapshot(logisticsTargetLinkCases.find(input => input.id === "F0-L06")!);
    expect(resolveTaskTargetBindings("T", legacyOnly)).toMatchObject({ effectiveSystemIds: ["MCS-1"], effectiveTargetIds: [], effectiveMembers: [] });
    expect(countTaskTargetUsage(legacyOnly, "TARGET-A")).toMatchObject({ taskCount: 0, summaryCount: 0 });
    const mixed = snapshot(logisticsTargetLinkCases.find(input => input.id === "F0-L05")!);
    mixed.legacy = [{ taskId: "S", kind: "system", entityId: "MCS-1", scope: "subtree" }];
    const result = resolveTaskTargetBindings("T", mixed);
    expect(result.effectiveSystemIds).toEqual(["MCS-1"]);
    expect(result.effectiveMembers[0].provenance).toHaveLength(2);
    expect(result.legacySources).toHaveLength(1);
  });

  it("counts distinct regular Tasks and Summary context separately, including inherited-only Tasks", () => {
    const input = snapshot({ bindings: [
      { id: "PARENT", taskId: "S", targetId: "TARGET-A", selection: "whole", scope: "subtree", memberIds: [] },
      { id: "CHILD", taskId: "T", targetId: "TARGET-A", selection: "subset", scope: "self", memberIds: ["MEM-A-ACS"] },
    ], legacy: [] });
    const count = countTaskTargetUsage(input, "TARGET-A");
    expect(count).toEqual({ taskIds: ["T"], summaryTaskIds: ["S", "S-CHILD"], milestoneTaskIds: [], taskCount: 1, summaryCount: 2, milestoneCount: 0 });
    expect(countTaskTargetUsage(input, "TARGET-B").taskCount).toBe(0);
    expect(countTaskTargetUsage(input, "TARGET-A", "MEM-A-ACS")).toEqual(count);
    expect(resolveTaskTargetBindings("S-CHILD", input)).toMatchObject({ bindings: [], inheritedBindings: [{ id: "PARENT" }] });
    const self = { ...input, bindings: [{ ...input.bindings[0], scope: "self" as const }] };
    expect(countTaskTargetUsage(self, "TARGET-A")).toMatchObject({ taskCount: 0, summaryCount: 1 });
  });

  it("preserves conflicting coverage per source rather than summing physical fleet quantities", () => {
    const input = snapshot({ bindings: logisticsTargetCoverageCase.bindings, legacy: [] });
    const result = resolveTaskTargetBindings("T", input).effectiveMembers[0];
    expect(result).toMatchObject({ entityId: "AMR-A", coverageState: "multiple" });
    expect(result.provenance.map(({ bindingId, coverage, coverageMode }) => ({ bindingId, coverage, coverageMode })))
      .toEqual([{ bindingId: "C1", coverage: 2, coverageMode: "partial" }, { bindingId: "C2", coverage: 3, coverageMode: "partial" }]);
    expect(input.targets[0].members[0].quantity).toBe(10);
    const single = { ...input, bindings: [{ ...input.bindings[0], coverageByMember: [{ memberId: "MEM-A-AMR", coverage: 10 }] }] };
    expect(resolveTaskTargetBindings("T", single).effectiveMembers[0].provenance[0].coverageMode).toBe("whole");
    const unspecified = { ...input, bindings: [{ ...input.bindings[0], coverageByMember: [] }] };
    expect(resolveTaskTargetBindings("T", unspecified).effectiveMembers[0]).toMatchObject({ coverageState: "unspecified", provenance: [{ coverage: null, coverageMode: "unspecified" }] });
  });

  it.each([0, -1, 1.5, 11, Number.POSITIVE_INFINITY, Number.NaN])("rejects invalid coverage %s and fleet shrink", coverage => {
    const input = snapshot({ bindings: logisticsTargetCoverageCase.bindings, legacy: [] });
    const invalid = { ...input, bindings: [{ ...input.bindings[0], coverageByMember: [{ memberId: "MEM-A-AMR", coverage }] }] };
    expect(() => resolveTaskTargetBindings("T", invalid)).toThrow("INVALID_MEMBER_COVERAGE");
    const shrink = { ...input, targets: input.targets.map(target => ({ ...target, members: target.members.map(member => ({ ...member, quantity: 1 })) })) };
    expect(() => resolveTaskTargetBindings("T", shrink)).toThrow("INVALID_MEMBER_COVERAGE");
  });

  it("rejects System coverage, whole coverage, and coverage outside explicit member selection", () => {
    const input = snapshot(logisticsTargetLinkCases[1]);
    expect(() => resolveTaskTargetBindings("T", { ...input, bindings: [{ ...input.bindings[0], coverageByMember: [{ memberId: "MEM-A-ACS", coverage: 1 }] }] })).toThrow("INVALID_MEMBER_COVERAGE");
    expect(() => resolveTaskTargetBindings("T", { ...input, bindings: [{ ...input.bindings[0], coverageByMember: [{ memberId: "MEM-A-AMR", coverage: 1 }] }] })).toThrow("COVERAGE_MEMBER_UNAVAILABLE");
    const whole = snapshot(logisticsTargetLinkCases[0]);
    expect(() => resolveTaskTargetBindings("T", { ...whole, bindings: [{ ...whole.bindings[0], coverageByMember: [{ memberId: "MEM-A-AMR", coverage: null }] }] })).toThrow("WHOLE_COVERAGE_UNSUPPORTED");
  });

  it("compares reparent effects while preserving explicit binding IDs", () => {
    const input = snapshot({ bindings: [
      { id: "PARENT", taskId: "S", targetId: "TARGET-A", selection: "whole", scope: "subtree", memberIds: [] },
      { id: "DIRECT", taskId: "T", targetId: "TARGET-B", selection: "whole", scope: "self", memberIds: [] },
    ], legacy: [] });
    const after = { ...input, tasks: input.tasks.map(task => task.id === "S-CHILD" ? { ...task, parentId: null } : task) };
    expect(compareTaskTargetImpact(input, after)).toMatchObject({ changedTaskIds: ["S-CHILD", "T"], before: { taskCount: 1, summaryCount: 1 }, after: { taskCount: 1, summaryCount: 1 } });
    expect(resolveTaskTargetBindings("T", after)).toMatchObject({ bindings: [{ id: "DIRECT" }], inheritedBindings: [], effectiveTargetIds: ["TARGET-B"] });
    expect(input.bindings).toEqual(after.bindings);
  });

  it("fails closed on circular/missing parents instead of hanging or dropping inheritance", () => {
    const input = snapshot({ bindings: [], legacy: [] });
    const cycle = { ...input, tasks: input.tasks.map(task => task.id === "S" ? { ...task, parentId: "T" } : task) };
    const missing = { ...input, tasks: input.tasks.map(task => task.id === "S" ? { ...task, parentId: "MISSING" } : task) };
    expect(() => resolveTaskTargetBindings("T", cycle)).toThrow("CIRCULAR_PARENT");
    expect(() => resolveTaskTargetBindings("T", missing)).toThrow("MISSING_PARENT");
  });
});
