import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { canonicalTaskOrder, normalizeCopySelection, selectTaskGesture, hiddenSelectedCount } from "../../../src/features/gantt/task-selection-model";
function task(taskId: string, parentExternalId: string | null, siblingOrder: number, type: ProjectTaskDto["type"] = "task"): ProjectTaskDto {
  return { taskId, externalId: taskId.toUpperCase(), parentExternalId, siblingOrder, name: taskId, type, scheduleMode: "auto",
    requestedStart: type === "summary" ? null : "2026-10-01", start: type === "summary" ? null : "2026-10-01",
    end: type === "summary" ? null : "2026-10-01", duration: type === "summary" ? null : 1, progress: type === "summary" ? null : 0 };
}
const tasks = [task("b", "S", 1), task("s", null, 0, "summary"), task("e", null, 1, "summary"),
  task("a", "S", 0), task("nested", "S", 2, "summary"), task("leaf", "NESTED", 0), task("outside", null, 2)];
describe("Issue #384 Copy selection", () => {
  it("range excludes contextual ancestors while explicit single selection stays available", () => {
    const contextual = [...tasks, task("e-child", "E", 0)];
    const visible = contextual.map((task) => task.taskId), matching = ["s", "e-child", "outside"];
    expect(selectTaskGesture(contextual, ["s"], "s", "outside", "range", visible, matching)).toEqual(["s", "outside"]);
    expect(selectTaskGesture(contextual, [], null, "e", "single", visible, matching)).toEqual(["e"]);
    expect(selectTaskGesture(contextual, ["s"], "s", "e", "range", visible, matching)).toEqual(["e"]);
  });
  it("uses canonical hierarchy order", () => {
    expect(canonicalTaskOrder(tasks).map((task) => task.taskId)).toEqual(["s", "a", "b", "nested", "leaf", "e", "outside"]);
    expect(normalizeCopySelection(tasks, ["b", "a"])).toEqual(["a", "b"]);
  });
  it("prunes descendants and duplicates under selected ancestors", () => {
    expect(normalizeCopySelection(tasks, ["leaf", "s", "a", "s", "e"])).toEqual(["s", "e"]);
    expect(normalizeCopySelection(tasks, ["leaf", "nested", "a"])).toEqual(["a", "nested"]);
  });
  it("ignores unknown IDs and retains empty Summary roots", () => {
    expect(normalizeCopySelection(tasks, ["missing", "e", "a"])).toEqual(["a", "e"]);
  });
  it("plain selection replaces the group", () => {
    expect(selectTaskGesture(tasks, ["a", "b"], "a", "e", "single")).toEqual(["e"]);
  });
  it("toggle adds and removes once in canonical order", () => {
    expect(selectTaskGesture(tasks, ["b"], "b", "a", "toggle")).toEqual(["a", "b"]);
    expect(selectTaskGesture(tasks, ["a", "b"], "b", "b", "toggle")).toEqual(["a"]);
    expect(selectTaskGesture(tasks, ["b"], "b", "b", "toggle")).toEqual([]);
  });
  it("range contains visible siblings only", () => {
    expect(selectTaskGesture(tasks, ["a"], "a", "nested", "range")).toEqual(["a", "b", "nested"]);
    expect(selectTaskGesture(tasks, ["a"], "a", "nested", "range", ["s", "a", "nested", "leaf"])).toEqual(["a", "nested"]);
  });
  it("range in another parent becomes a singleton", () => {
    expect(selectTaskGesture(tasks, ["a"], "a", "outside", "range")).toEqual(["outside"]);
  });
  it("rejects out-of-scope gestures and prunes stale IDs", () => {
    expect(selectTaskGesture(tasks, ["a", "outside", "missing"], "a", "outside", "toggle", ["s", "a", "b"])).toEqual(["a"]);
  });
  it("retains hidden selections while adding a visible task", () => {
    expect(selectTaskGesture(tasks, ["leaf"], "leaf", "a", "toggle", ["s", "a", "b"])).toEqual(["a", "leaf"]);
  });
  it("collapse counts hidden descendants without discarding Copy roots", () => {
    const selected = ["a", "leaf", "e"];
    expect(hiddenSelectedCount(tasks, selected, new Map([["s", true]]))).toBe(2);
    expect(hiddenSelectedCount(tasks, selected, new Map([["nested", true]]))).toBe(1);
    expect(normalizeCopySelection(tasks, selected)).toEqual(["a", "leaf", "e"]);
  });
  it("keeps canonical input immutable", () => {
    const before = JSON.stringify(tasks);
    normalizeCopySelection(tasks, ["s", "leaf"]); selectTaskGesture(tasks, ["a"], "a", "b", "toggle");
    expect(JSON.stringify(tasks)).toBe(before);
  });
});
