import { describe, expect, it } from "vitest";

import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { resolveNativeTaskAddIntent } from "../../../src/features/gantt/native-task-add-intent";

function task(
  taskId: string,
  externalId: string,
  type: ProjectTaskDto["type"],
  parentExternalId: string | null,
  siblingOrder: number,
): ProjectTaskDto {
  return {
    taskId,
    externalId,
    name: taskId,
    description: null,
    type,
    scheduleMode: "manual",
    requestedStart: type === "summary" ? null : "2026-10-01",
    start: type === "summary" ? null : "2026-10-01",
    end: type === "summary" ? null : "2026-10-01",
    duration: type === "milestone" ? 0 : type === "summary" ? null : 1,
    progress: type === "summary" ? null : 0,
    parentExternalId,
    siblingOrder,
  };
}

const tasks: ProjectTaskDto[] = [
  task("root", "WBS-1", "summary", null, 0),
  task("leaf", "WBS-1.1", "task", "WBS-1", 0),
  task("nested", "WBS-1.2", "summary", "WBS-1", 1),
  task("milestone", "WBS-1.2.1", "milestone", "WBS-1.2", 0),
  task("outside", "WBS-2", "task", null, 1),
];

describe("Issue #418 native add intent", () => {
  it("maps the full-project header to a project root create", () => {
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: null, source: "header",
    })).toEqual({ kind: "create", source: "header" });
  });

  it("maps a scoped header to the active Summary immediate child", () => {
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "header",
    })).toEqual({
      kind: "create",
      source: "header",
      parentTaskId: "root",
      targetTaskId: "root",
      mode: "child",
    });
  });

  it("maps scoped root and descendant row controls to child creates", () => {
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "row", targetTaskId: "root", mode: "child",
    })).toMatchObject({ kind: "create", parentTaskId: "root" });
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "row", targetTaskId: "nested", mode: "child",
    })).toMatchObject({ kind: "create", parentTaskId: "nested" });
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "row", targetTaskId: "leaf", mode: "child",
    })).toMatchObject({ kind: "create", parentTaskId: "leaf" });
  });

  it("fails closed for milestones, outside rows, before/after and invalid scopes", () => {
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "row", targetTaskId: "milestone", mode: "child",
    })).toEqual({ kind: "reject", source: "row", reason: "milestone" });
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "row", targetTaskId: "outside", mode: "child",
    })).toEqual({ kind: "reject", source: "row", reason: "scope" });
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "root", source: "row", targetTaskId: "nested", mode: "after",
    })).toEqual({ kind: "reject", source: "row", reason: "scope" });
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "missing", source: "header",
    })).toEqual({ kind: "reject", source: "header", reason: "scope" });
    expect(resolveNativeTaskAddIntent({
      tasks, rootTaskId: "leaf", source: "header",
    })).toEqual({ kind: "reject", source: "header", reason: "scope" });
  });
});
