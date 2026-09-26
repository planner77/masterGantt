import { describe, expect, it } from "vitest";

import type { ProjectAssignmentDto } from "../../../src/contracts/resources";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import {
  EMPTY_TASK_FILTER,
  applyTaskQuickView,
  filterTasksWithAncestors,
  getTaskQuickView,
  taskMatchesFilter,
} from "../../../src/features/projects/project-search-filter";

const tasks: ProjectTaskDto[] = [
  {
    taskId: "summary",
    externalId: "WBS-1",
    name: "Summary",
    description: "parent",
    type: "summary",
    scheduleMode: "auto",
    requestedStart: null,
    start: "2026-09-01",
    end: "2026-09-30",
    duration: 22,
    progress: 50,
    parentExternalId: null,
    siblingOrder: 0,
  },
  {
    taskId: "child",
    externalId: "WBS-1.1",
    name: "Install AMR",
    description: "Vietnam line",
    type: "task",
    scheduleMode: "manual",
    requestedStart: null,
    start: "2026-09-10",
    end: "2026-09-15",
    duration: 4,
    progress: 20,
    parentExternalId: "WBS-1",
    siblingOrder: 0,
  },
  {
    taskId: "milestone",
    externalId: "M1",
    name: "Acceptance",
    description: null,
    type: "milestone",
    scheduleMode: "manual",
    requestedStart: null,
    start: "2026-10-01",
    end: "2026-10-01",
    duration: 0,
    progress: 0,
    parentExternalId: null,
    siblingOrder: 1,
  },
];

const assignments: ProjectAssignmentDto[] = [
  { id: "a1", taskId: "child", target: { kind: "resource", id: "r1" } },
  { id: "a2", taskId: "child", target: { kind: "group", id: "g1" } },
];

describe("Issue #83 project task filters", () => {
  it("normalizes text and keeps ancestor context outside match count", () => {
    const result = filterTasksWithAncestors(tasks, { ...EMPTY_TASK_FILTER, query: " vietnam " }, assignments);
    expect(result.matchCount).toBe(1);
    expect(result.tasks.map((task) => task.taskId)).toEqual(["summary", "child"]);
  });

  it("supports field-specific text operators", () => {
    const byName = filterTasksWithAncestors(tasks, { ...EMPTY_TASK_FILTER, nameQuery: "install", nameOperator: "contains" }, assignments);
    expect(byName.matchCount).toBe(1);
    const excludes = filterTasksWithAncestors(tasks, { ...EMPTY_TASK_FILTER, descriptionQuery: "vietnam", descriptionOperator: "not-contains" }, assignments);
    expect(excludes.matchCount).toBe(2);
    const external = filterTasksWithAncestors(tasks, { ...EMPTY_TASK_FILTER, externalIdQuery: "M1", externalIdOperator: "equals" }, assignments);
    expect(external.tasks.map((task) => task.taskId)).toEqual(["milestone"]);
  });

  it("uses inclusive effective-date overlap including milestones", () => {
    const result = filterTasksWithAncestors(tasks, {
      ...EMPTY_TASK_FILTER,
      dateFrom: "2026-09-30",
      dateTo: "2026-10-01",
      dateOperator: "overlap",
    }, assignments);
    expect(result.matchCount).toBe(2);
    expect(result.tasks.map((task) => task.taskId)).toContain("milestone");
  });

  it("supports contained, start-in and end-in operators", () => {
    for (const dateOperator of ["contained", "start-in", "end-in"] as const) {
      const result = filterTasksWithAncestors(tasks, {
        ...EMPTY_TASK_FILTER,
        dateFrom: "2026-09-10",
        dateTo: "2026-09-15",
        dateOperator,
      }, assignments);
      expect(result.matchCount).toBe(1);
      expect(result.tasks.some((task) => task.taskId === "child")).toBe(true);
    }
  });

  it("separates assigned/unassigned and direct resource/group ANY/ALL", () => {
    const assignedMap = new Map([["child", new Set(["resource:r1", "group:g1"])]]);
    expect(taskMatchesFilter(tasks[1], { ...EMPTY_TASK_FILTER, assignmentState: "assigned" }, assignedMap)).toBe(true);
    expect(taskMatchesFilter(tasks[2], { ...EMPTY_TASK_FILTER, assignmentState: "unassigned" }, assignedMap)).toBe(true);
    expect(taskMatchesFilter(tasks[1], { ...EMPTY_TASK_FILTER, targetIds: ["resource:r1", "group:g1"], targetMode: "all" }, assignedMap)).toBe(true);
    expect(taskMatchesFilter(tasks[1], { ...EMPTY_TASK_FILTER, targetIds: ["resource:r2", "group:g1"], targetMode: "all" }, assignedMap)).toBe(false);
    expect(taskMatchesFilter(tasks[1], { ...EMPTY_TASK_FILTER, targetIds: ["resource:r2", "group:g1"], targetMode: "any" }, assignedMap)).toBe(true);
  });

  it("handles 5,000 deterministic tasks without changing the source collection", () => {
    const many = Array.from({ length: 5000 }, (_, index): ProjectTaskDto => ({
      ...tasks[1],
      taskId: `task-${index}`,
      externalId: `WBS-${index}`,
      name: index % 10 === 0 ? `AMR target ${index}` : `Other ${index}`,
      parentExternalId: null,
      siblingOrder: index,
    }));
    const result = filterTasksWithAncestors(many, { ...EMPTY_TASK_FILTER, query: "amr target" }, []);
    expect(result.matchCount).toBe(500);
    expect(many).toHaveLength(5000);
  });

  it("supports type, schedule mode, progress and duration ranges", () => {
    const result = filterTasksWithAncestors(tasks, {
      ...EMPTY_TASK_FILTER,
      types: ["task"],
      scheduleModes: ["manual"],
      progressMin: 10,
      progressMax: 30,
      durationMin: 3,
      durationMax: 5,
    }, assignments);
    expect(result.matchCount).toBe(1);
    expect(result.tasks.map((task) => task.taskId)).toEqual(["summary", "child"]);
  });
});

describe("Issue #196 Task/Milestone quick view helpers", () => {
  it("determines correct quick view mode from types array", () => {
    expect(getTaskQuickView([])).toBe("all");
    expect(getTaskQuickView(["task"])).toBe("task");
    expect(getTaskQuickView(["milestone"])).toBe("milestone");
    expect(getTaskQuickView(["summary"])).toBe("custom");
    expect(getTaskQuickView(["task", "milestone"])).toBe("custom");
  });

  it("applies quick view mode while preserving other filter properties", () => {
    const baseFilter = {
      ...EMPTY_TASK_FILTER,
      query: "AMR",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      progressMin: 20,
    };

    const taskView = applyTaskQuickView(baseFilter, "task");
    expect(taskView.types).toEqual(["task"]);
    expect(taskView.query).toBe("AMR");
    expect(taskView.dateFrom).toBe("2026-09-01");
    expect(taskView.progressMin).toBe(20);

    const milestoneView = applyTaskQuickView(taskView, "milestone");
    expect(milestoneView.types).toEqual(["milestone"]);
    expect(milestoneView.query).toBe("AMR");

    const allView = applyTaskQuickView(milestoneView, "all");
    expect(allView.types).toEqual([]);
    expect(allView.query).toBe("AMR");
  });

  it("filters tasks correctly with quick view types and keeps ancestor context", () => {
    const taskResult = filterTasksWithAncestors(tasks, applyTaskQuickView(EMPTY_TASK_FILTER, "task"), assignments);
    expect(taskResult.matchCount).toBe(1);
    expect(taskResult.tasks.map((task) => task.taskId)).toEqual(["summary", "child"]);

    const milestoneFilter = applyTaskQuickView(EMPTY_TASK_FILTER, "milestone");
    const milestoneResult = filterTasksWithAncestors(tasks, milestoneFilter, assignments);
    expect(milestoneResult.matchCount).toBe(1);
    expect(milestoneResult.tasks.map((task) => task.taskId)).toEqual(["milestone"]);

    const allResult = filterTasksWithAncestors(tasks, applyTaskQuickView(milestoneFilter, "all"), assignments);
    expect(allResult.matchCount).toBe(3);
    expect(allResult.tasks.map((task) => task.taskId)).toEqual(["summary", "child", "milestone"]);
  });
});
