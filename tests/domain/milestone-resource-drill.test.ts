import { describe, expect, it } from "vitest";
import type { ResourceWorkloadTaskDto } from "../../src/contracts/resources";
import { resourceDrillMatches, resourceDrillRevisionMatches, type MilestoneResourceDrill } from "../../src/features/resources/milestone-resource-drill";

const scope: MilestoneResourceDrill = { projectRevision: 4, catalogRevision: 7, resourceIds: ["r1"], taskIds: ["t1"], assignmentIds: ["a1"], from: "2026-10-05", to: "2026-10-07", plannedMd: 2.5, plannedMm: null };
const task = { assignmentId: "a1", taskId: "t1", start: "2026-10-01", end: "2026-10-05" } as ResourceWorkloadTaskDto;
describe("confirmed milestone resource drill", () => {
  it("requires resource, task and assignment identity together with inclusive period overlap", () => {
    expect(resourceDrillMatches(scope, "r1", task)).toBe(true);
    expect(resourceDrillMatches(scope, "r2", task)).toBe(false);
    expect(resourceDrillMatches(scope, "r1", { ...task, taskId: "t2" })).toBe(false);
    expect(resourceDrillMatches(scope, "r1", { ...task, assignmentId: "a2" })).toBe(false);
    expect(resourceDrillMatches(scope, "r1", { ...task, end: "2026-10-04" })).toBe(false);
    expect(resourceDrillMatches(scope, "r1", { ...task, start: "2026-10-08", end: "2026-10-09" })).toBe(false);
  });
  it.each(["resourceIds", "taskIds", "assignmentIds"] as const)("empty %s preserves an empty drill instead of all rows", (key) => {
    expect(resourceDrillMatches({ ...scope, [key]: [] }, "r1", task)).toBe(false);
  });
  it("requires both exact snapshot revisions", () => {
    expect(resourceDrillRevisionMatches(scope, { projectRevision: 4, catalogRevision: 7 })).toBe(true);
    expect(resourceDrillRevisionMatches(scope, { projectRevision: 5, catalogRevision: 7 })).toBe(false);
    expect(resourceDrillRevisionMatches(scope, { projectRevision: 4, catalogRevision: 8 })).toBe(false);
  });
});
