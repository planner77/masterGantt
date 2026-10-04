import { describe, expect, it } from "vitest";

import type { ProjectLinkDto, ProjectTaskDto } from "../../../src/contracts/projects";
import {
  taskSubtreeHasDependencyLinks,
  taskSubtreeHasExternalDependencyLinks,
} from "../../../src/features/gantt/task-link-scope";

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
    scheduleMode: "auto",
    requestedStart: type === "summary" ? null : "2026-10-05",
    start: type === "summary" ? null : "2026-10-05",
    end: type === "summary" ? null : "2026-10-05",
    duration: type === "summary" ? null : type === "milestone" ? 0 : 1,
    progress: type === "summary" ? null : 0,
    parentExternalId,
    siblingOrder,
  };
}

const tasks = [
  task("summary", "S", null, 0, "summary"),
  task("child-a", "A", "S", 0),
  task("child-b", "B", "S", 1),
  task("outside-x", "X", null, 1),
  task("outside-y", "Y", null, 2),
];

function link(id: string, predecessorExternalId: string, successorExternalId: string): ProjectLinkDto {
  return { id, predecessorExternalId, successorExternalId, type: "FS", lag: 0 };
}

describe("task link scope", () => {
  it("distinguishes internal subtree dependencies from boundary-crossing dependencies", () => {
    const internal = link("internal", "A", "B");

    expect(taskSubtreeHasDependencyLinks(tasks, "summary", [internal])).toBe(true);
    expect(taskSubtreeHasExternalDependencyLinks(tasks, "summary", [internal])).toBe(false);
  });

  it("detects incoming and outgoing links that cross the subtree boundary", () => {
    expect(taskSubtreeHasExternalDependencyLinks(tasks, "summary", [
      link("incoming", "X", "A"),
    ])).toBe(true);
    expect(taskSubtreeHasExternalDependencyLinks(tasks, "summary", [
      link("outgoing", "B", "Y"),
    ])).toBe(true);
    expect(taskSubtreeHasExternalDependencyLinks(tasks, "summary", [
      link("internal", "A", "B"),
      link("outgoing", "B", "Y"),
    ])).toBe(true);
  });

  it("ignores dependencies that are fully outside the selected subtree", () => {
    expect(taskSubtreeHasDependencyLinks(tasks, "summary", [
      link("outside", "X", "Y"),
    ])).toBe(false);
    expect(taskSubtreeHasExternalDependencyLinks(tasks, "summary", [
      link("outside", "X", "Y"),
    ])).toBe(false);
  });

  it("returns false when the requested task does not exist", () => {
    expect(taskSubtreeHasDependencyLinks(tasks, "missing", [
      link("incoming", "X", "A"),
    ])).toBe(false);
    expect(taskSubtreeHasExternalDependencyLinks(tasks, "missing", [
      link("incoming", "X", "A"),
    ])).toBe(false);
  });
});
