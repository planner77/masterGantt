import { describe, expect, it } from "vitest";

import type { ProjectCalendarDto, ProjectTaskDto } from "../../../src/contracts/projects";
import { localDateFromDateOnly } from "../../../src/features/gantt/date-adapter";
import {
  projectLinksToSvarLinks,
  projectTasksToSvarTasks,
  normalizeInlineTaskName,
  translateProjectTaskUpdate,
} from "../../../src/features/gantt/project-task-adapter";

const calendar: ProjectCalendarDto = {
  timezone: "Asia/Seoul",
  weekendDays: [6, 0],
  holidays: [{ date: "2026-09-14", name: "Holiday" }],
};

const task: ProjectTaskDto = {
  taskId: "task-a",
  externalId: "A",
  name: "Build",
  type: "task",
  scheduleMode: "auto",
  requestedStart: "2026-09-15",
  start: "2026-09-15",
  end: "2026-09-17",
  duration: 3,
  progress: 20,
  parentExternalId: null,
  siblingOrder: 0,
};

describe("Project task SVAR adapter", () => {
  it("normalizes Grid names with the Task Editor Unicode and length boundary", () => {
    expect(normalizeInlineTaskName("  001  ")).toEqual({ name: "001", error: null });
    expect(normalizeInlineTaskName(" ")).toMatchObject({ name: null });
    expect(normalizeInlineTaskName("a".repeat(200))).toMatchObject({ name: "a".repeat(200) });
    expect(normalizeInlineTaskName("a".repeat(201))).toMatchObject({ name: null });
    expect(normalizeInlineTaskName("\ud800")).toMatchObject({ name: null });
    expect(normalizeInlineTaskName("😀")).toMatchObject({ name: "😀" });
  });

  it("allows summary name only while refusing scheduling or hierarchy changes", () => {
    const summary = { ...task, type: "summary" as const };
    const nameOnly = { kind: "update-task" as const, taskId: task.taskId, changes: { text: "  Renamed  ", start: undefined, end: undefined, progress: undefined, parent: undefined } };
    expect(translateProjectTaskUpdate(nameOnly, summary, calendar)).toEqual({ taskId: task.taskId, payload: { name: "Renamed" } });
    expect(translateProjectTaskUpdate({ ...nameOnly, changes: { ...nameOnly.changes, parent: "other" } }, summary, calendar)).toBeNull();
    expect(translateProjectTaskUpdate({ ...nameOnly, changes: { ...nameOnly.changes, start: localDateFromDateOnly("2026-09-16") } }, summary, calendar)).toBeNull();
  });
  it("maps stable task IDs and external dependency references separately", () => {
    const second = { ...task, taskId: "task-b", externalId: "B", name: "Test" };
    const tasks = projectTasksToSvarTasks([task, second]);
    expect(tasks[0]).toMatchObject({ id: "task-a", text: "Build", externalId: "A", parent: 0, open: false });
    expect(tasks[0].end?.getDate()).toBe(18);
    expect(projectLinksToSvarLinks([{ id: "link-1", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: 0 }], [task, second]))
      .toEqual([{ id: "link-1", source: "task-a", target: "task-b", type: "e2s" }]);
  });

  it("preserves snapshot order and maps supplied summary hierarchy for rendering", () => {
    const summary = { ...task, taskId: "summary-a", externalId: "SUMMARY", type: "summary" as const, siblingOrder: 0 };
    const child = { ...task, taskId: "child-a", externalId: "CHILD", parentExternalId: "SUMMARY", siblingOrder: 1 };

    const mapped = projectTasksToSvarTasks([summary, child]);

    expect(mapped.map((entry) => entry.id)).toEqual(["summary-a", "child-a"]);
    expect(mapped).toMatchObject([
      { id: "summary-a", type: "summary", parent: 0, open: true },
      { id: "child-a", type: "task", parent: "summary-a", open: false },
    ]);
  });

  it("turns a final bar move into start only, preserving server duration", () => {
    expect(translateProjectTaskUpdate({
      kind: "update-task", taskId: "task-a", diff: 2,
      changes: { text: "Build", start: localDateFromDateOnly("2026-09-17"), end: localDateFromDateOnly("2026-09-20"), progress: 20, parent: 0 },
    }, task, calendar)).toEqual({ taskId: "task-a", payload: { start: "2026-09-17" } });
  });

  it("uses the rendered move as the new request after a non-working start was normalized", () => {
    const shifted = {
      ...task,
      requestedStart: "2026-09-12",
      start: "2026-09-15",
      end: "2026-09-17",
    };
    expect(translateProjectTaskUpdate({
      kind: "update-task", taskId: "task-a", diff: 1,
      changes: { text: "Build", start: localDateFromDateOnly("2026-09-16"), end: localDateFromDateOnly("2026-09-19"), progress: 20, parent: 0 },
    }, shifted, calendar)).toEqual({ taskId: "task-a", payload: { start: "2026-09-16" } });
  });

  it("distinguishes full-state left and right resize callbacks from a move", () => {
    expect(translateProjectTaskUpdate({
      kind: "update-task", taskId: "task-a", diff: 1,
      changes: { text: "Build", start: localDateFromDateOnly("2026-09-16"), end: localDateFromDateOnly("2026-09-18"), progress: 20, parent: 0 },
    }, task, calendar)).toEqual({ taskId: "task-a", payload: { start: "2026-09-16", duration: 2 } });
    expect(translateProjectTaskUpdate({
      kind: "update-task", taskId: "task-a", diff: 2,
      changes: { text: "Build", start: localDateFromDateOnly("2026-09-15"), end: localDateFromDateOnly("2026-09-20"), progress: 20, parent: 0 },
    }, task, calendar)).toEqual({ taskId: "task-a", payload: { duration: 4 } });
  });

  it("does not emit a command for an unchanged full task callback", () => {
    expect(translateProjectTaskUpdate({
      kind: "update-task", taskId: "task-a", diff: 0,
      changes: { text: "Build", start: localDateFromDateOnly("2026-09-15"), end: localDateFromDateOnly("2026-09-18"), progress: 20, parent: 0 },
    }, task, calendar)).toBeNull();
  });

  it("allows a milestone move but never derives a duration", () => {
    const milestone = { ...task, taskId: "milestone-a", type: "milestone" as const, duration: 0, end: "2026-09-15" };
    expect(translateProjectTaskUpdate({
      kind: "update-task", taskId: "milestone-a", diff: 1,
      changes: { text: "Build", start: localDateFromDateOnly("2026-09-16"), end: localDateFromDateOnly("2026-09-16"), progress: 20, parent: 0 },
    }, milestone, calendar)).toEqual({ taskId: "milestone-a", payload: { start: "2026-09-16" } });
  });
});
