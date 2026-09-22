import { describe, expect, it } from "vitest";

import type { ProjectLinkDto, ProjectTaskDto } from "../../../src/contracts/projects";
import {
  createHierarchyCommand,
  createPasteCommand,
  taskContextCapabilities,
} from "../../../src/features/gantt/task-context-menu-model";

const noLinks: ProjectLinkDto[] = [];

function task(
  taskId: string,
  externalId: string,
  parentExternalId: string | null,
  siblingOrder: number,
  type: ProjectTaskDto["type"] = "task",
): ProjectTaskDto {
  return {
    taskId,
    externalId,
    name: externalId,
    type,
    scheduleMode: type === "summary" ? "auto" : "auto",
    requestedStart: type === "summary" ? null : "2026-09-21",
    start: "2026-09-21",
    end: "2026-09-21",
    duration: type === "milestone" ? 0 : 1,
    progress: 0,
    parentExternalId,
    siblingOrder,
  };
}

describe("task context menu model", () => {
  it("derives sibling move, indent and outdent availability", () => {
    const tasks = [
      task("a", "A", null, 0, "summary"),
      task("b", "B", null, 1),
      task("a1", "A1", "A", 0),
      task("a2", "A2", "A", 1),
    ];

    expect(taskContextCapabilities(tasks, "b", true, false, noLinks, null)).toMatchObject({
      canMoveUp: true,
      canMoveDown: false,
      canIndent: true,
      canOutdent: false,
    });
    expect(taskContextCapabilities(tasks, "a2", true, false, noLinks, null)).toMatchObject({
      canMoveUp: true,
      canOutdent: true,
    });
  });

  it("allows outdent for the only child because parent presence is the hierarchy boundary", () => {
    const tasks = [
      task("a", "A", null, 0, "summary"),
      task("a1", "A1", "A", 0),
    ];

    expect(taskContextCapabilities(tasks, "a1", true, false, noLinks, null)).toMatchObject({
      canMoveUp: false,
      canMoveDown: false,
      canOutdent: true,
    });
  });

  it("fails closed for readonly, busy, links and stale/empty clipboard targets", () => {
    const tasks = [task("a", "A", null, 0), task("b", "B", null, 1)];
    expect(taskContextCapabilities(tasks, "a", false, false, noLinks, null).canMoveDown).toBe(false);
    expect(taskContextCapabilities(tasks, "a", true, true, noLinks, null).canMoveDown).toBe(false);
    expect(taskContextCapabilities(tasks, "a", true, false, [{ id: "link", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: 0 }], null).canMoveDown).toBe(false);
    expect(taskContextCapabilities(tasks, "a", true, false, noLinks, {
      mode: "copy",
      taskId: "a",
      revision: 1,
    }).canPaste).toBe(false);
  });

  it("maps shortcuts/menu intents to atomic hierarchy commands", () => {
    expect(createHierarchyCommand("move-up", "a")).toEqual({
      kind: "move",
      taskId: "a",
      direction: "up",
    });
    expect(createHierarchyCommand("indent", "a")).toEqual({ kind: "indent", taskId: "a" });
    expect(createPasteCommand({ mode: "cut", taskId: "a", revision: 3 }, "b")).toEqual({
      kind: "reparent",
      taskId: "a",
      anchorTaskId: "b",
      placement: "after",
    });
    expect(createPasteCommand({ mode: "copy", taskId: "a", revision: 3 }, "b", "child")).toEqual({
      kind: "copy",
      taskId: "a",
      anchorTaskId: "b",
      placement: "child",
    });
  });
});
