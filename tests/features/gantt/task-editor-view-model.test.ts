import { describe, expect, it } from "vitest";
import { taskEditorTabForKey } from "../../../src/features/gantt/task-editor-view-model";

describe("task editor tab keyboard navigation", () => {
  it("moves with arrows and wraps at both ends", () => {
    expect(taskEditorTabForKey("task", "ArrowRight")).toBe("resources");
    expect(taskEditorTabForKey("relations", "ArrowRight")).toBe("task");
    expect(taskEditorTabForKey("task", "ArrowLeft")).toBe("relations");
  });

  it("supports Home and End and ignores unrelated keys", () => {
    expect(taskEditorTabForKey("resources", "Home")).toBe("task");
    expect(taskEditorTabForKey("resources", "End")).toBe("relations");
    expect(taskEditorTabForKey("resources", "Enter")).toBeNull();
  });
});
