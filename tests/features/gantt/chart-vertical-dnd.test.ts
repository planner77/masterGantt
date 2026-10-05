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
    requestedStart: "2026-10-04",
    start: "2026-10-04",
    end: "2026-10-04",
    duration: 1,
    progress: 0,
    status: "not_started",
    parentExternalId,
    siblingOrder,
  };
}

describe("Chart vertical DnD reorder model", () => {
  it("locks one axis after the drag dead-zone", () => {
    expect(resolveChartDragIntent(2, 9)).toBe("vertical");
    expect(resolveChartDragIntent(13, 8)).toBe("horizontal");
    expect(resolveChartDragIntent(4, 4)).toBe("pending");
  });

  it("maps a vertical pointer to before/after of the nearest visible row", () => {
    const rows = [
      { taskId: "A", parentExternalId: null, top: 10, bottom: 30 },
      { taskId: "B", parentExternalId: null, top: 40, bottom: 60 },
      { taskId: "C", parentExternalId: null, top: 70, bottom: 90 },
    ];
    expect(resolveChartVerticalDrop("C", null, 42, rows)).toEqual({ anchorTaskId: "B", placement: "before" });
    expect(resolveChartVerticalDrop("A", null, 88, rows)).toEqual({ anchorTaskId: "C", placement: "after" });
  });

  it("rejects the nearest row when it is on a different hierarchy level", () => {
    const rows = [
      { taskId: "A", parentExternalId: null, top: 10, bottom: 30 },
      { taskId: "CHILD", parentExternalId: "SUMMARY", top: 40, bottom: 60 },
    ];
    expect(resolveChartVerticalDrop("A", null, 50, rows)).toBeNull();
  });

  it("builds a same-parent canonical reparent command and suppresses no-op", () => {
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
