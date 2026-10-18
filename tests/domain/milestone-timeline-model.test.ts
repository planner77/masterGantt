import { describe, expect, it } from "vitest";
import { stageSnapshotFromProject } from "../../src/domain/milestones/project-stage-model";
import { projectStageGates } from "../../src/domain/milestones/stage-gates";
import {
  adaptMilestoneTimelineTypeFilter, buildMilestoneTimelineModel, canonicalSubtreeImpact,
  milestoneTimelineDisplayState, normalizeMilestoneTimelinePreference,
  returnFromMilestoneTimelineDate, revealMilestoneTimelineDate, toggleMilestoneTimelineDisplay,
} from "../../src/features/milestones/milestone-timeline-model";
import { EMPTY_TASK_FILTER, filterTasksWithAncestors } from "../../src/features/projects/project-search-filter";
import { milestoneTimelineFixture } from "../fixtures/milestone-timeline";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("Milestone Timeline canonical display model", () => {
  it("preserves frozen canonical object identity, schedule, summary roll-up, links and memberships", () => {
    const fixture = deepFreeze(milestoneTimelineFixture());
    const original = JSON.stringify(fixture);
    const input = deepFreeze({ ...fixture, matchedTaskIds: ["T1"], activeMilestoneTaskId: "M1", preference: { version: 1, showMilestones: false } });
    const model = buildMilestoneTimelineModel(input);
    expect(model.canonical.tasks).toBe(fixture.tasks);
    expect(model.canonical.links).toBe(fixture.links);
    expect(model.wbs.tasks.find((task) => task.taskId === "S1")).toBe(fixture.tasks[0]);
    expect(model.timeline.milestones.find((row) => row.task.taskId === "M1")!.task).toBe(fixture.tasks[3]);
    expect(model.wbs.tasks[0]).toMatchObject({ start: "2026-10-01", end: "2026-10-12", duration: 8, progress: 25 });
    expect(model.canonical.links.map((link) => link.id)).toEqual(["M-LINK", "T-LINK", "LEGACY"]);
    expect(JSON.stringify(fixture)).toBe(original);
  });

  it("separates ordinary matches, matched summaries and ancestor-only context", () => {
    const model = buildMilestoneTimelineModel({ ...milestoneTimelineFixture(), matchedTaskIds: ["T1", "S2", "M1"], ancestorContextTaskIds: ["EMPTY", "T5", "M2"] });
    expect(model.wbs.tasks.map((task) => task.taskId)).toEqual(["S1", "T1", "S2", "EMPTY"]);
    expect(model.wbs).toMatchObject({ matchedTaskIds: ["T1", "S2"], ancestorContextTaskIds: ["S1", "EMPTY"], matchCount: 1, matchedSummaryCount: 1, contextSummaryCount: 2 });
    expect(buildMilestoneTimelineModel({ ...milestoneTimelineFixture(), matchedTaskIds: [] }).wbs.tasks).toEqual([]);
  });

  it("uses full canonical inheritance and E/P even when the assigning summary, members and predecessors are outside scope", () => {
    const fixture = milestoneTimelineFixture();
    const expected = projectStageGates(stageSnapshotFromProject(fixture.tasks, fixture.links));
    const model = buildMilestoneTimelineModel({ ...fixture, scopeTaskIds: ["S2", "T3", "T4"], matchedTaskIds: ["T4"], activeMilestoneTaskId: "M1" });
    expect(model.wbs.tasks.map((task) => task.taskId)).toEqual(["S2", "T4"]);
    expect(model.membership).toEqual(expected.membership);
    expect(model.gates).toEqual(expected.gates);
    expect(model.membership.get("T1")).toMatchObject({ effectiveMilestoneTaskId: "M1", inheritedFromTaskId: "S1" });
    expect(model.gates.get("M1")).toMatchObject({ memberTaskIds: ["T1", "T2", "T4"], memberProgressPercent: 300 / 13, ready: false });
    expect(model.gates.get("M2")).toMatchObject({ memberCount: 1, predecessorMilestoneTaskIds: ["M1"], completionInconsistent: true });
    expect(model.gates.get("M3")).toMatchObject({ ready: null, manualEvent: true, predecessorMilestoneTaskIds: [] });
    expect(model.membership.get("T5")!.effectiveMilestoneTaskId).toBeNull();
    expect(model.timeline.milestones).toHaveLength(5);
  });

  it("uses canonical start and stable identity keys rather than names, WBS order or requestedStart", () => {
    const fixture = milestoneTimelineFixture();
    const expected = ["M1", "M2", "M3", "M4", "M5"];
    const original = buildMilestoneTimelineModel(fixture);
    const reversed = buildMilestoneTimelineModel({ tasks: [...fixture.tasks].reverse(), links: [...fixture.links].reverse() });
    expect(original.timeline.milestones.map((row) => row.task.taskId)).toEqual(expected);
    expect(reversed.timeline.milestones.map((row) => row.task.taskId)).toEqual(expected);
    expect(original.timeline.datedMilestones[0].date).toBe("2026-10-12");
    expect(original.timeline.undatedMilestones.map((row) => [row.task.taskId, row.dateState, row.date])).toEqual([["M4", "missing", null], ["M5", "invalid", null]]);
    const tied = fixture.tasks.filter((task) => task.type === "milestone").slice(0, 2).map((task) => ({ ...task, externalId: "SAME", parentExternalId: null }));
    expect(buildMilestoneTimelineModel({ tasks: tied.reverse(), links: [] }).timeline.milestones.map((row) => row.task.taskId)).toEqual(["M1", "M2"]);
  });

  it.each(["1899-12-31", "2200-01-01", "2026-2-02", "2026-02-29", "invalid"])("keeps unsupported date %s undated", (start) => {
    const task = milestoneTimelineFixture().tasks.find((task) => task.taskId === "M3")!;
    const row = buildMilestoneTimelineModel({ tasks: [{ ...task, start, parentExternalId: null }], links: [] }).timeline.undatedMilestones[0];
    expect(row).toMatchObject({ date: null, dateState: "invalid" });
    expect(row.task.start).toBe(start);
  });

  it("handles no milestones, empty scope, milestone-only project and a milestone-only summary without inventing tasks or dates", () => {
    expect(buildMilestoneTimelineModel({ tasks: [], links: [] }).timeline.milestones).toEqual([]);
    const fixture = milestoneTimelineFixture();
    const emptyScope = buildMilestoneTimelineModel({ ...fixture, scopeTaskIds: [] });
    expect(emptyScope.wbs.tasks).toEqual([]);
    expect(emptyScope.timeline.milestones).toHaveLength(5);
    const onlyTasks = fixture.tasks.filter((task) => ["M-ONLY", "M3", "EMPTY"].includes(task.taskId));
    const only = buildMilestoneTimelineModel({ tasks: onlyTasks, links: [] });
    expect(only.wbs).toMatchObject({ matchCount: 0, matchedSummaryCount: 2 });
    expect(only.wbs.tasks.map((task) => task.taskId)).toEqual(["M-ONLY", "EMPTY"]);
    expect(only.wbs.tasks[0].start).toBe("2026-11-02");
    expect(only.gates.get("M3")).toMatchObject({ ready: null, memberCount: 0, manualEvent: true });
    expect(buildMilestoneTimelineModel({ tasks: [{ ...onlyTasks[1], parentExternalId: null }], links: [] }).wbs.matchCount).toBe(0);
  });

  it("consumes the current membership filter result while keeping all timeline milestones and hidden full subtree impact", () => {
    const fixture = milestoneTimelineFixture();
    const resolved = filterTasksWithAncestors(fixture.tasks, { ...EMPTY_TASK_FILTER, milestoneTaskId: "M1" }, []);
    const model = buildMilestoneTimelineModel({ ...fixture, matchedTaskIds: resolved.matchingTaskIds, ancestorContextTaskIds: resolved.tasks.map((task) => task.taskId) });
    expect(model.wbs.matchCount).toBe(resolved.ordinaryMatchCount);
    expect(model.timeline.milestones).toHaveLength(5);
    expect(canonicalSubtreeImpact(fixture.tasks, ["S1", "T1", "M-ONLY", "missing", "missing"])).toEqual({ taskIds: ["S1", "T1", "T2", "M1", "M-ONLY", "M3"], milestoneTaskIds: ["M1", "M3"], missingRootTaskIds: ["missing"] });
    expect(canonicalSubtreeImpact(fixture.tasks, ["EMPTY", "M2"])).toEqual({ taskIds: ["M2", "EMPTY"], milestoneTaskIds: ["M2"], missingRootTaskIds: [] });
  });

  it("keeps milestone inspection separate from native task selection and highlights visible ordinary members only", () => {
    const fixture = milestoneTimelineFixture();
    const model = buildMilestoneTimelineModel({ ...fixture, matchedTaskIds: ["S1", "T1", "T3", "M1"], activeMilestoneTaskId: "M1", preference: { version: 1, showMilestones: false } });
    expect(model.selection).toEqual({ activeMilestoneTaskId: "M1", highlightedMemberTaskIds: ["T1"] });
    expect(model.display.showMilestones).toBe(false);
    for (const id of ["T1", "missing", null]) expect(buildMilestoneTimelineModel({ ...fixture, activeMilestoneTaskId: id }).selection).toEqual({ activeMilestoneTaskId: null, highlightedMemberTaskIds: [] });
  });

  it("delegates malformed full hierarchy rejection to the existing domain projector even for an empty WBS scope", () => {
    const fixture = milestoneTimelineFixture();
    fixture.tasks[0].parentExternalId = "S1";
    expect(() => buildMilestoneTimelineModel({ ...fixture, scopeTaskIds: [] })).toThrow("INVALID_STAGE_HIERARCHY");
    fixture.tasks[0].parentExternalId = "missing";
    expect(() => buildMilestoneTimelineModel({ ...fixture, scopeTaskIds: [] })).toThrow("INVALID_STAGE_HIERARCHY");
  });
});

describe("Milestone Timeline preference and type compatibility", () => {
  it.each([undefined, null, "invalid JSON", [], false, {}, { version: 2, showMilestones: false }, { version: 1, showMilestones: "false" }])("falls back to ON for unsupported preference %j", (raw) => {
    expect(normalizeMilestoneTimelinePreference(raw)).toEqual({ version: 1, showMilestones: true });
  });

  it("keeps explicit OFF independent from old types and filters, and returns from ephemeral reveal to OFF", () => {
    const fixture = milestoneTimelineFixture();
    const preference = deepFreeze({ version: 1, showMilestones: false });
    const state = milestoneTimelineDisplayState(preference);
    const revealed = revealMilestoneTimelineDate(state);
    expect(revealed).toEqual({ preference, temporaryOverride: true, showMilestones: true });
    expect(returnFromMilestoneTimelineDate(revealed)).toEqual(state);
    expect(toggleMilestoneTimelineDisplay(false)).toEqual(state);
    expect(toggleMilestoneTimelineDisplay(true)).toMatchObject({ temporaryOverride: false, showMilestones: true });
    const ordinary = buildMilestoneTimelineModel({ ...fixture, matchedTaskIds: ["T1"], preference });
    const cleared = buildMilestoneTimelineModel({ ...fixture, preference, temporaryDisplayOverride: true });
    expect(ordinary.preference).toEqual(preference);
    expect(cleared.preference).toEqual(preference);
    expect(cleared.timeline.milestones).toEqual(ordinary.timeline.milestones);
    expect(revealMilestoneTimelineDate(toggleMilestoneTimelineDisplay(true)).temporaryOverride).toBe(false);
  });

  it("removes only Milestone from mixed type conditions and preserves all other active conditions", () => {
    const filter = deepFreeze({ ...EMPTY_TASK_FILTER, types: ["milestone", "summary", "task"] as const, query: "needle", milestoneTaskId: "M1", taskIds: ["T1"], targetIds: ["resource:1"], equipmentIds: ["EQ1"], dateFrom: "2026-10-01", dateTo: "2026-10-31" });
    const adapted = adaptMilestoneTimelineTypeFilter(filter);
    expect(adapted).toMatchObject({ compatibility: "milestone-removed", suggestedActions: [] });
    expect(adapted.filter).toEqual({ ...filter, types: ["summary", "task"] });
    expect(adapted.filter.targetIds).toBe(filter.targetIds);
    expect(adapted.filter.taskIds).toBe(filter.taskIds);
    expect(filter.types).toEqual(["milestone", "summary", "task"]);
    const unchanged = { ...filter, types: ["task"] as const };
    expect(adaptMilestoneTimelineTypeFilter(unchanged).filter).toBe(unchanged);
    expect(adaptMilestoneTimelineTypeFilter(EMPTY_TASK_FILTER).compatibility).toBe("unchanged");
  });

  it("preserves Milestone-only conditions and requires an explicit compatibility action rather than expanding Task matches", () => {
    const filter = { ...EMPTY_TASK_FILTER, types: ["milestone"] as const, query: "same", progressMin: 50 };
    expect(adaptMilestoneTimelineTypeFilter(filter)).toEqual({ filter, compatibility: "milestone-only", suggestedActions: ["open-milestone-dashboard", "clear-type-filter"] });
    expect(adaptMilestoneTimelineTypeFilter(filter).filter).toBe(filter);
    expect(normalizeMilestoneTimelinePreference(filter)).toEqual({ version: 1, showMilestones: true });
  });
});
