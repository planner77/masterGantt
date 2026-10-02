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
  it("keeps multi Copy and single Cut contracts separate", () => {
    expect(createPasteCommand({ mode: "copy", taskIds: ["a", "b"], revision: 3 }, "target", "before"))
      .toEqual({ kind: "copy", taskIds: ["a", "b"], anchorTaskId: "target", placement: "before" });
    expect(createPasteCommand({ mode: "cut", taskId: "a", revision: 3 }, "target"))
      .toEqual({ kind: "reparent", taskId: "a", anchorTaskId: "target", placement: "after" });
    const tasks = [task("a", "A", null, 0), task("b", "B", null, 1), task("c", "C", null, 2)];
    const clipboard = { mode: "copy", taskIds: ["a", "b"], revision: 3 } as const;
    expect(taskContextCapabilities(tasks, "b", true, false, noLinks, clipboard).canPaste).toBe(false);
    expect(taskContextCapabilities(tasks, "c", true, false, noLinks, clipboard).canPaste).toBe(true);
  });
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

  it("keeps hierarchy mutations fail-closed for links while allowing safe copy-paste targets", () => {
    const tasks = [task("a", "A", null, 0), task("b", "B", null, 1)];
    const links: ProjectLinkDto[] = [
      { id: "link", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: 0 },
    ];
    expect(taskContextCapabilities(tasks, "a", false, false, noLinks, null).canMoveDown).toBe(false);
    expect(taskContextCapabilities(tasks, "a", true, true, noLinks, null).canMoveDown).toBe(false);

    const linkedCopyTarget = taskContextCapabilities(tasks, "a", true, false, links, {
      mode: "copy",
      taskIds: ["b"],
      revision: 1,
    });
    expect(linkedCopyTarget).toMatchObject({
      canAddChild: false,
      canMoveDown: false,
      canIndent: false,
      canPaste: true,
    });

    expect(taskContextCapabilities(tasks, "a", true, false, links, {
      mode: "cut",
      taskId: "b",
      revision: 1,
    }).canPaste).toBe(false);
    expect(taskContextCapabilities(tasks, "a", true, false, noLinks, {
      mode: "copy",
      taskIds: ["a"],
      revision: 1,
    }).canPaste).toBe(false);
  });

  it("keeps an unrelated task mutable when other tasks have a dependency", () => {
    const tasks = [task("a", "A", null, 0), task("b", "B", null, 1), task("c", "C", null, 2)];
    const links: ProjectLinkDto[] = [
      { id: "link-ab", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: 0 },
    ];

    expect(taskContextCapabilities(tasks, "c", true, false, links, null)).toMatchObject({
      canAddChild: true,
      canMoveUp: true,
      canIndent: true,
    });
    expect(taskContextCapabilities(tasks, "a", true, false, links, null)).toMatchObject({
      canAddChild: false,
      canMoveDown: false,
      canIndent: false,
    });
  });

  it("disables move/outdent controls that would cross a scoped root boundary", () => {
    const tasks = [
      task("root", "ROOT", null, 0, "summary"),
      task("child-a", "A", "ROOT", 0),
      task("child-b", "B", "ROOT", 1, "summary"),
      task("grandchild", "B1", "B", 0),
    ];

    expect(taskContextCapabilities(tasks, "root", true, false, noLinks, null, "root")).toMatchObject({
      canMoveUp: false,
      canMoveDown: false,
      canIndent: false,
      canOutdent: false,
      canAddChild: true,
    });
    expect(taskContextCapabilities(tasks, "child-a", true, false, noLinks, null, "root")).toMatchObject({
      canMoveDown: true,
      canOutdent: false,
    });
    expect(taskContextCapabilities(tasks, "grandchild", true, false, noLinks, null, "root")).toMatchObject({
      canOutdent: true,
    });
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
    expect(createPasteCommand({ mode: "copy", taskIds: ["a"], revision: 3 }, "b", "child")).toEqual({
      kind: "copy",
      taskIds: ["a"],
      anchorTaskId: "b",
      placement: "child",
    });
  });
});
