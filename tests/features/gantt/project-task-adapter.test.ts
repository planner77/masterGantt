import { describe, expect, it } from "vitest";

import type { ProjectCalendarDto, ProjectTaskDto } from "../../../src/contracts/projects";
import { localDateFromDateOnly } from "../../../src/features/gantt/date-adapter";
import {
  projectLinksToSvarLinks,
  projectTasksToSvarTasks,
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
  it("maps stable task IDs and external dependency references separately", () => {
    const second = { ...task, taskId: "task-b", externalId: "B", name: "Test" };
    const tasks = projectTasksToSvarTasks([task, second]);
    expect(tasks[0]).toMatchObject({ id: "task-a", text: "Build", externalId: "A", parent: 0, open: false });
    expect(tasks[0].end?.getDate()).toBe(18);
    expect(projectLinksToSvarLinks([{ id: "link-1", predecessorExternalId: "A", successorExternalId: "B", type: "FS", lag: 0 }], [task, second]))
      .toEqual([{ id: "link-1", source: "task-a", target: "task-b", type: "e2s" }]);
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
