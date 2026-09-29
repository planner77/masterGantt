import { describe, expect, it } from "vitest";

import type { ProjectTaskDto } from "../../../src/contracts/projects";
import {
  buildChartReorderCommand,
  resolveChartDragIntent,
  resolveChartVerticalDrop,
} from "../../../src/features/gantt/chart-vertical-dnd";

function task(taskId: string, siblingOrder: number, parentExternalId: string | null = null): ProjectTaskDto {
  return {
    taskId,
    externalId: `EXT-${taskId}`,
    name: taskId,
    type: "task",
    scheduleMode: "auto",
    requestedStart: "2026-09-29",
    start: "2026-09-29",
    end: "2026-09-29",
    duration: 1,
    progress: 0,
    parentExternalId,
    siblingOrder,
  };
}

describe("chart vertical DnD", () => {
  it("locks a vertical gesture before SVAR's horizontal drag threshold", () => {
    expect(resolveChartDragIntent(2, 9)).toBe("vertical");
    expect(resolveChartDragIntent(13, 8)).toBe("horizontal");
    expect(resolveChartDragIntent(4, 4)).toBe("pending");
  });

  it("maps the pointer to before/after of the nearest visible row", () => {
    const rows = [
      { taskId: "A", parentExternalId: null, top: 10, bottom: 30 },
      { taskId: "B", parentExternalId: null, top: 40, bottom: 60 },
      { taskId: "C", parentExternalId: null, top: 70, bottom: 90 },
    ];
    expect(resolveChartVerticalDrop("C", null, 42, rows)).toEqual({ anchorTaskId: "B", placement: "before" });
    expect(resolveChartVerticalDrop("A", null, 88, rows)).toEqual({ anchorTaskId: "C", placement: "after" });
  });

  it("does not silently cross a hierarchy level", () => {
    const rows = [
      { taskId: "A", parentExternalId: null, top: 10, bottom: 30 },
      { taskId: "CHILD", parentExternalId: "SUMMARY", top: 40, bottom: 60 },
    ];
    expect(resolveChartVerticalDrop("A", null, 50, rows)).toBeNull();
  });

  it("builds one canonical reparent command only when sibling order changes", () => {
    const tasks = [task("A", 0), task("B", 1), task("C", 2)];
    expect(buildChartReorderCommand(tasks, "C", "B", "before")).toEqual({
      kind: "reparent",
      taskId: "C",
      anchorTaskId: "B",
      placement: "before",
    });
    expect(buildChartReorderCommand(tasks, "A", "B", "before")).toBeNull();
  });
});
