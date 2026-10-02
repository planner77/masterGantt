import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_TASK_COPY_SOURCES } from "../../../src/contracts/projects";
import { parseTaskHierarchyCommand } from "../../../src/server/projects/task-hierarchy-contract";

describe("multi-source Copy input", () => {
  const first = randomUUID(), second = randomUUID(), anchorTaskId = randomUUID();
  const base = { kind: "copy", anchorTaskId, placement: "child" };
  it("normalizes legacy taskId without changing other commands", () => {
    expect(parseTaskHierarchyCommand({ ...base, taskId: first })).toEqual({
      success: true, data: { ...base, taskIds: [first] },
    });
    expect(parseTaskHierarchyCommand({ kind: "reparent", taskId: first, anchorTaskId, placement: "child" }))
      .toEqual({ success: true, data: { kind: "reparent", taskId: first, anchorTaskId, placement: "child" } });
  });
  it("accepts independent sources and the exact source limit", () => {
    expect(parseTaskHierarchyCommand({ ...base, taskIds: [second, first] })).toEqual({
      success: true, data: { ...base, taskIds: [second, first] },
    });
    expect(parseTaskHierarchyCommand({ ...base, taskIds: Array.from({ length: MAX_TASK_COPY_SOURCES }, () => randomUUID()) }).success).toBe(true);
  });
  it.each([
    {}, { taskIds: [] }, { taskIds: [first, first] },
    { taskIds: ["invalid"] }, { taskId: first, taskIds: [first] },
    { taskId: null }, { taskIds: null }, { taskIds: [first], descendants: [] },
    { taskIds: Array.from({ length: MAX_TASK_COPY_SOURCES + 1 }, () => randomUUID()) },
  ])("rejects malformed, ambiguous or unbounded sources: %j", (sources) => {
    expect(parseTaskHierarchyCommand({ ...base, ...sources }).success).toBe(false);
  });
  it("does not introduce multi-source reparent/cut/delete commands", () => {
    for (const kind of ["reparent", "move", "indent", "outdent", "convert", "delete", "cut"]) {
      expect(parseTaskHierarchyCommand({ ...base, kind, taskIds: [first, second] }).success).toBe(false);
    }
  });
});
