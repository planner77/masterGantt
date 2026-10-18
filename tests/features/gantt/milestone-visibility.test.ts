import { describe, expect, it } from "vitest";
import { milestoneTimelineStorageKey, readMilestoneTimelinePreference, writeMilestoneTimelinePreference } from "../../../src/features/milestones/milestone-timeline-preference";
import { adaptMilestoneTimelineTypeFilter, buildMilestoneTimelineModel, milestoneTimelineDisplayState } from "../../../src/features/milestones/milestone-timeline-model";
import { EMPTY_TASK_FILTER, filterTasksWithAncestors } from "../../../src/features/projects/project-search-filter";
import { wbsClipboardRootIds } from "../../../src/features/gantt/task-selection-model";
import { milestoneTimelineFixture } from "../../fixtures/milestone-timeline";

describe("project-specific Milestone visibility authority", () => {
  it.each([null, "invalid", '{"version":2,"showMilestones":false}', '{"version":1,"showMilestones":"false"}'])("uses default ON for absent/malformed schema %s", raw => {
    expect(readMilestoneTimelinePreference("A", { getItem: () => raw, setItem: () => {} })).toEqual({ preference: { version: 1, showMilestones: true }, storageFailed: false });
  });
  it("reads explicit OFF without migrating Task-only types", () => {
    expect(readMilestoneTimelinePreference("A", { getItem: () => '{"version":1,"showMilestones":false}', setItem: () => {} }).preference.showMilestones).toBe(false);
    expect(milestoneTimelineDisplayState(undefined).showMilestones).toBe(true);
  });
  it("only explicit persistence uses the project key and normalized v1", () => {
    const writes: unknown[] = [];
    expect(writeMilestoneTimelinePreference("A", { version: 1, showMilestones: false }, { getItem: () => null, setItem: (...args) => { writes.push(args); } })).toBe(true);
    expect(writes).toEqual([[milestoneTimelineStorageKey("A"), '{"version":1,"showMilestones":false}']]);
    expect(milestoneTimelineStorageKey("A")).not.toBe(milestoneTimelineStorageKey("B"));
  });
  it("reports storage read/write errors without throwing or redefining memory authority", () => {
    const storage = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("quota"); } };
    expect(readMilestoneTimelinePreference("A", storage)).toEqual({ preference: { version: 1, showMilestones: true }, storageFailed: true });
    expect(writeMilestoneTimelinePreference("A", { version: 1, showMilestones: false }, storage)).toBe(false);
    expect(milestoneTimelineDisplayState({ version: 1, showMilestones: false }, true)).toMatchObject({ showMilestones: true, preference: { showMilestones: false } });
  });
});

describe("WBS display and canonical roots", () => {
  it("retains full context membership while the input/display includes ordinary rows only", () => {
    const fixture = milestoneTimelineFixture(), before = JSON.stringify(fixture);
    const ordinary = fixture.tasks.filter(task => task.type !== "milestone");
    const result = filterTasksWithAncestors(ordinary, { ...EMPTY_TASK_FILTER, milestoneTaskId: "M1" }, [], undefined, fixture.tasks);
    expect(result.matchingTaskIds).toEqual(["T1", "T2", "T4"]);
    expect(result.tasks.map(task => task.taskId)).toEqual(["S1", "T1", "T2", "S2", "T4"]);
    expect(result.ordinaryMatchCount).toBe(3); expect(JSON.stringify(fixture)).toBe(before);
    expect(buildMilestoneTimelineModel(fixture).canonical.links).toBe(fixture.links);
  });
  it("preserves M-only condition identity and leaves WBS empty until an explicit choice", () => {
    const fixture = milestoneTimelineFixture(), filter = { ...EMPTY_TASK_FILTER, types: ["milestone" as const], query: "동일" };
    const adapted = adaptMilestoneTimelineTypeFilter(filter);
    expect(adapted.filter).toBe(filter); expect(adapted.compatibility).toBe("milestone-only");
    expect(filterTasksWithAncestors(fixture.tasks.filter(task => task.type !== "milestone"), adapted.filter, [], undefined, fixture.tasks).tasks).toEqual([]);
  });
  it("removes only M from mixed type projections and retains every other condition", () => {
    const filter = { ...EMPTY_TASK_FILTER, types: ["task" as const, "milestone" as const], query: "T", taskIds: ["T1"], milestoneTaskId: "M1" };
    expect(adaptMilestoneTimelineTypeFilter(filter).filter).toEqual({ ...filter, types: ["task"] });
  });
  it("prunes explicit M/stale clipboard roots and keeps Summary full subtree meaning", () => {
    const fixture = milestoneTimelineFixture();
    expect(wbsClipboardRootIds(fixture.tasks, ["S1", "M2", "T5", "deleted"])).toEqual(["S1", "T5"]);
    expect(fixture.tasks.find(task => task.taskId === "M1")?.parentExternalId).toBe("S1");
  });
});
