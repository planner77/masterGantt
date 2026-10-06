import { describe, expect, it } from "vitest";
import type { ProjectTaskDto, ProjectLinkDto } from "../../../src/contracts/projects";
import { EMPTY_TASK_FILTER, activeTaskFilterCount, applyTaskQuickView, filterTasksWithAncestors, stageFilterCandidates } from "../../../src/features/projects/project-search-filter";
import { canCreateSchedulingLink, getRelatedLinksForAnchor, linkStructureLocked, searchCandidateTasks } from "../../../src/features/gantt/relation-editor-model";
const task = (id: string, type: ProjectTaskDto["type"] = "task", parentExternalId: string | null = null, target?: string): ProjectTaskDto => ({ taskId: id, externalId: id, name: id, type, parentExternalId, siblingOrder: 0, start: "2026-10-05", end: "2026-10-05", requestedStart: null, duration: type === "milestone" ? 0 : 1, progress: 0, scheduleMode: "auto", status: "not_started", ...(target ? { membership: { explicitMilestoneTaskId: target, effectiveMilestoneTaskId: target, inheritedFromTaskId: null } } : {}) });
const tasks = [task("M1", "milestone"), task("M2", "milestone"), task("Parent", "summary", null, "M1"), task("Child", "task", "Parent"), task("Override", "task", "Parent", "M2"), task("Empty", "summary", null, "M1"), task("Free")];
const filter = (milestoneTaskId: string, types: readonly ProjectTaskDto["type"][] = []) => ({ ...EMPTY_TASK_FILTER, milestoneTaskId, types });
describe("#462 stage projection and same-type scheduling boundary", () => {
  it("keeps M and inherited ordinary matches separate from Summary context", () => {
    const result = filterTasksWithAncestors(tasks, filter("M1"), []);
    expect(result.matchingTaskIds).toEqual(["M1", "Child"]); expect(result.ordinaryMatchCount).toBe(1);
    expect(result.tasks.map((row) => row.taskId)).toEqual(["M1", "Parent", "Child", "Empty"]);
  });
  it("Task-only hides M but keeps configured empty Summary as non-matching context", () => {
    const result = filterTasksWithAncestors(tasks, filter("M1", ["task"]), []);
    expect(result.matchingTaskIds).toEqual(["Child"]); expect(result.tasks.map((row) => row.taskId)).toEqual(["Parent", "Child", "Empty"]);
  });
  it("Milestone-only does not count members as visible ordinary matches", () => {
    const result = filterTasksWithAncestors(tasks, filter("M1", ["milestone"]), []);
    expect(result.matchingTaskIds).toEqual(["M1"]); expect(result.ordinaryMatchCount).toBe(0); expect(result.tasks.map((row) => row.taskId)).toEqual(["M1"]);
  });
  it("scoped display inherits from full canonical ancestor without pulling outside rows", () => {
    const result = filterTasksWithAncestors(tasks.filter((row) => row.taskId === "Child"), filter("M1"), [], undefined, tasks);
    expect(result.tasks.map((row) => row.taskId)).toEqual(["Child"]);
    expect(filterTasksWithAncestors(tasks.filter((row) => row.taskId === "Child"), filter("unassigned"), [], undefined, tasks).tasks).toEqual([]);
  });
  it("unassigned means effective ordinary absence, not lack of explicit setting", () => {
    const result = filterTasksWithAncestors(tasks, filter("unassigned"), []);
    expect(result.matchingTaskIds).toEqual(["Free"]); expect(result.ordinaryMatchCount).toBe(1);
  });
  it("empty Summary context applies all remaining conditions", () => {
    const result = filterTasksWithAncestors(tasks, { ...filter("M1"), query: "Child" }, []);
    expect(result.tasks.map((row) => row.taskId)).toEqual(["Parent", "Child"]);
    expect(filterTasksWithAncestors(tasks, { ...filter("M1"), assignmentState: "assigned" }, []).tasks).toEqual([]);
  });
  it("quick view and stage reset preserve independent conditions", () => {
    const original = { ...filter("M1"), query: "Child", dateFrom: "2026-10-01", dateTo: "2026-10-10" };
    const quick = applyTaskQuickView(original, "task"); expect(quick.milestoneTaskId).toBe("M1"); expect(quick.query).toBe("Child");
    expect(activeTaskFilterCount(quick)).toBe(4); expect({ ...quick, milestoneTaskId: "all" }.types).toEqual(["task"]);
  });
  it("stable canonical date ordering supports trim/casefold UUID and duplicate names", () => {
    const milestones = [task("b", "milestone"), { ...task("a", "milestone"), requestedStart: "2020-01-01" }, { ...task("z", "milestone"), start: "2026-10-01" }];
    expect(stageFilterCandidates(milestones).map((row) => row.taskId)).toEqual(["z", "a", "b"]);
    expect(stageFilterCandidates(milestones, " A ").map((row) => row.taskId)).toEqual(["a"]); expect(milestones[0].taskId).toBe("b");
  });
  it.each(["predecessor", "successor"] as const)("same-type candidates in %s direction keep membership independent", (direction) => {
    expect(searchCandidateTasks({ tasks, links: [], anchorExternalId: "Child", query: "", direction }).map((row) => row.taskId)).toEqual(["Override", "Free"]);
    expect(searchCandidateTasks({ tasks, links: [], anchorExternalId: "M1", query: "", direction }).map((row) => row.taskId)).toEqual(["M2"]);
    expect(searchCandidateTasks({ tasks, links: [], anchorExternalId: "missing", query: "", direction })).toEqual([]);
  });
  it("legacy mixed relation remains visible and mutable unless a Milestone endpoint is completed", () => {
    const legacy: ProjectLinkDto = { id: "legacy", predecessorExternalId: "Child", successorExternalId: "M1", type: "FS", lag: 0, legacyMixed: true };
    expect(getRelatedLinksForAnchor("Child", [legacy], tasks).successors[0].link).toEqual(legacy);
    expect(linkStructureLocked(legacy, tasks)).toBe(false); expect(canCreateSchedulingLink(tasks[3], tasks[0])).toBe(false);
    const completed = tasks.map((row) => row.taskId === "M1" ? { ...row, status: "completed" as const } : row);
    expect(linkStructureLocked(legacy, completed)).toBe(true); expect(canCreateSchedulingLink(completed[0], tasks[1])).toBe(false);
    expect(canCreateSchedulingLink({ ...tasks[3], status: "completed" }, tasks[4])).toBe(true);
  });
});
