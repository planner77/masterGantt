import { describe, expect, it } from "vitest";

import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { createTaskDeletePlan } from "../../../src/features/gantt/task-delete-model";

function task(
  taskId: string,
  externalId: string,
  parentExternalId: string | null,
): ProjectTaskDto {
  return {
    taskId,
    externalId,
    name: externalId,
    type: parentExternalId === null ? "summary" : "task",
    scheduleMode: "auto",
    requestedStart: parentExternalId === null ? null : "2026-09-14",
    start: "2026-09-14",
    end: "2026-09-14",
    duration: 1,
    progress: 0,
    parentExternalId,
    siblingOrder: 0,
  };
}

describe("createTaskDeletePlan", () => {
  it("collects all descendant depths without including siblings", () => {
    const tasks = [
      task("root", "ROOT", null),
      task("child", "CHILD", "ROOT"),
      task("grandchild", "GRANDCHILD", "CHILD"),
      task("sibling", "SIBLING", "ROOT"),
    ];

    expect(createTaskDeletePlan(tasks, "child")).toEqual({
      taskId: "child",
      taskName: "CHILD",
      descendantTaskIds: ["grandchild"],
    });
    expect(createTaskDeletePlan(tasks, "root")?.descendantTaskIds)
      .toEqual(["grandchild", "child", "sibling"]);
  });

  it("returns an empty descendant list for a leaf and null for an unknown task", () => {
    const tasks = [task("root", "ROOT", null), task("child", "CHILD", "ROOT")];
    expect(createTaskDeletePlan(tasks, "child")?.descendantTaskIds).toEqual([]);
    expect(createTaskDeletePlan(tasks, "missing")).toBeNull();
  });
});
