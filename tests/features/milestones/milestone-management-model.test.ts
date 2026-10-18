import { describe, expect, it } from "vitest";
import type { MilestoneDashboardStageDto } from "../../../src/contracts/milestone-dashboard";
import type { TaskMutationResponse } from "../../../src/contracts/projects";
import { milestoneTimelineFixture } from "../../fixtures/milestone-timeline";
import { buildMilestoneTimelineModel } from "../../../src/features/milestones/milestone-timeline-model";
import { milestoneManagementDate, milestoneRootPayload, resolveCreatedMilestone, sortMilestoneManagementRows } from "../../../src/features/milestones/milestone-management-model";

describe("Milestone management canonical bridge", () => {
  it("shares timeline ordering for date ties/missing/invalid, retains report population and source references", () => {
    const fixture = milestoneTimelineFixture(), before = JSON.stringify(fixture);
    const rows = fixture.tasks.filter(task => task.type === "milestone").reverse().map(task => ({ milestoneTaskId: task.taskId, externalId: `REPORT-${task.taskId}` }) as MilestoneDashboardStageDto);
    const expected = buildMilestoneTimelineModel(fixture).timeline.milestones.map(row => row.task.taskId);
    const sorted = sortMilestoneManagementRows(rows, fixture.tasks);
    expect(sorted.map(row => row.milestoneTaskId)).toEqual(expected);
    expect(new Set(sorted)).toEqual(new Set(rows));
    expect(JSON.stringify(fixture)).toBe(before);
    expect(rows[0].milestoneTaskId).toBe("M5");
    expect(sortMilestoneManagementRows(rows.filter(row => row.milestoneTaskId !== "M2"), fixture.tasks).map(row => row.milestoneTaskId)).toEqual(expected.filter(id => id !== "M2"));
  });
  it("keeps canonical applied date separate from report/request dates and fails closed", () => {
    const task = milestoneTimelineFixture().tasks.find(task => task.taskId === "M1")!;
    expect(milestoneManagementDate(task)).toBe("2026-10-12");
    expect(milestoneManagementDate({ ...task, start: "2026-02-30" })).toBeNull();
    expect(milestoneManagementDate({ ...task, start: null })).toBeNull();
  });
  it("creates an explicit root Milestone payload without parentTaskId or duration1", () => {
    expect(milestoneRootPayload("  새 단계  ", "2026-10-09")).toEqual({ name: "새 단계", type: "milestone", start: "2026-10-09", duration: 0, progress: 0, parentExternalId: null });
    expect(() => milestoneRootPayload("새 단계", "2026-02-30")).toThrow();
  });
  it("resolves only a unique new canonical ID with the create operation, never name or array order", () => {
    const previous = milestoneTimelineFixture().tasks;
    const created = { ...previous.find(task => task.type === "milestone")!, taskId: "NEW", externalId: "NEW", name: previous[0].name };
    const response = { data: { tasks: [created, ...previous], operation: { kind: "taskCreate", changedTaskExternalIds: ["S1", "NEW"] } } } as TaskMutationResponse;
    expect(resolveCreatedMilestone(previous, response)).toBe(created);
    expect(resolveCreatedMilestone(previous, { data: { ...response.data, operation: { ...response.data.operation, kind: "taskUpdate" } } })).toBeNull();
    expect(resolveCreatedMilestone(previous, { data: { ...response.data, operation: { ...response.data.operation, changedTaskExternalIds: ["S1"] } } })).toBeNull();
    expect(resolveCreatedMilestone(previous, { data: { ...response.data, tasks: [...response.data.tasks, { ...created, taskId: "NEW2" }] } })).toBeNull();
    expect(resolveCreatedMilestone(previous, { data: { ...response.data, tasks: previous } })).toBeNull();
  });
});
