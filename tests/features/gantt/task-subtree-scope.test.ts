import { describe, expect, it } from "vitest";

import type { ProjectTaskDto } from "../../../src/contracts/projects";
import {
  canOpenTaskAsSubtreeRoot,
  resolveTaskSubtreeScope,
} from "../../../src/features/gantt/task-subtree-scope";

function task(
  taskId: string,
  externalId: string,
  name: string,
  type: ProjectTaskDto["type"],
  parentExternalId: string | null,
  siblingOrder: number,
): ProjectTaskDto {
  return {
    taskId,
    externalId,
    name,
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
  task("root", "WBS-1", "Root", "summary", null, 0),
  task("child", "WBS-1.1", "Child", "task", "WBS-1", 0),
  task("nested", "WBS-1.2", "Nested", "summary", "WBS-1", 1),
  task("grandchild", "WBS-1.2.1", "Grandchild", "milestone", "WBS-1.2", 0),
  task("empty", "WBS-2", "Empty", "summary", null, 1),
  task("sibling", "WBS-3", "Sibling", "task", null, 2),
];

describe("Issue #373 task subtree scope", () => {
  it("opens only summaries that currently have children from the context menu", () => {
    expect(canOpenTaskAsSubtreeRoot(tasks, "root")).toBe(true);
    expect(canOpenTaskAsSubtreeRoot(tasks, "nested")).toBe(true);
    expect(canOpenTaskAsSubtreeRoot(tasks, "empty")).toBe(false);
    expect(canOpenTaskAsSubtreeRoot(tasks, "child")).toBe(false);
    expect(canOpenTaskAsSubtreeRoot(tasks, "missing")).toBe(false);
  });

  it("resolves the selected summary plus descendants without ancestors or siblings", () => {
    const scope = resolveTaskSubtreeScope(tasks, "nested");
    expect(scope.kind).toBe("valid");
    if (scope.kind !== "valid") throw new Error("expected valid scope");
    expect(scope.root.taskId).toBe("nested");
    expect(scope.taskIds).toEqual(["nested", "grandchild"]);
  });

  it("keeps an empty summary as a valid deep-link root after its children are removed", () => {
    const scope = resolveTaskSubtreeScope(tasks, "empty");
    expect(scope.kind).toBe("valid");
    if (scope.kind !== "valid") throw new Error("expected valid scope");
    expect(scope.taskIds).toEqual(["empty"]);
  });

  it("distinguishes missing and non-summary deep links and supports the unscoped view", () => {
    expect(resolveTaskSubtreeScope(tasks, null)).toEqual({ kind: "all", root: null, taskIds: null });
    expect(resolveTaskSubtreeScope(tasks, "missing")).toEqual({ kind: "missing", root: null, taskIds: [] });
    const leaf = resolveTaskSubtreeScope(tasks, "child");
    expect(leaf.kind).toBe("not-summary");
    if (leaf.kind !== "not-summary") throw new Error("expected non-summary scope");
    expect(leaf.root.taskId).toBe("child");
  });
});
