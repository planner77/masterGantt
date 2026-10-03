import { describe, expect, it } from "vitest";

import type { ProjectTaskDto } from "../../../src/contracts/projects";
import {
  canEditGridStartDate,
  createGridStartDateCommand,
  gridStartDateValue,
  selectedGridStartDate,
} from "../../../src/features/gantt/grid-start-date-editor";
import { localDateFromDateOnly } from "../../../src/features/gantt/date-adapter";

const task: ProjectTaskDto = {
  taskId: "task-a",
  externalId: "A",
  name: "Task A",
  type: "task",
  scheduleMode: "auto",
  requestedStart: "2026-10-01",
  start: "2026-10-02",
  end: "2026-10-06",
  duration: 3,
  progress: 0,
  parentExternalId: null,
  siblingOrder: 0,
};

describe("Grid start-date editor", () => {
  it("uses the effective canonical start as the picker value without changing the request", () => {
    expect(gridStartDateValue(task)).toEqual(localDateFromDateOnly("2026-10-02"));
    expect(selectedGridStartDate(gridStartDateValue(task))).toBe("2026-10-02");
  });

  it("allows leaf tasks and milestones only while editable", () => {
    expect(canEditGridStartDate(task, true)).toBe(true);
    expect(canEditGridStartDate({ ...task, type: "milestone", duration: 0, end: task.start }, true)).toBe(true);
    expect(canEditGridStartDate({ ...task, type: "summary" }, true)).toBe(false);
    expect(canEditGridStartDate({ ...task, start: null, end: null, duration: null }, true)).toBe(false);
    expect(canEditGridStartDate(task, false)).toBe(false);
  });

  it("creates a start-only command and compares no-op against requestedStart", () => {
    expect(createGridStartDateCommand(task, "2026-10-05")).toEqual({
      taskId: "task-a",
      payload: { start: "2026-10-05" },
    });
    expect(createGridStartDateCommand(task, "2026-10-02")).toEqual({
      taskId: "task-a",
      payload: { start: "2026-10-02" },
    });
    expect(createGridStartDateCommand(task, "2026-10-01")).toBeNull();
    expect(createGridStartDateCommand({ ...task, requestedStart: null }, "2026-10-02")).toBeNull();
    expect(createGridStartDateCommand({ ...task, type: "summary" }, "2026-10-05")).toBeNull();
  });

  it("rejects invalid picker values before command creation", () => {
    expect(selectedGridStartDate(new Date(Number.NaN))).toBeNull();
    expect(selectedGridStartDate("2026-10-05")).toBeNull();
    expect(selectedGridStartDate(null)).toBeNull();
  });
});
