import { describe, expect, it } from "vitest";
import { taskUrlGestureBlocked } from "../../../src/features/gantt/task-context-target";
describe("Issue #384 URL selection gesture guard", () => {
  it.each([
    { ctrlKey: true, metaKey: false, shiftKey: false },
    { ctrlKey: false, metaKey: true, shiftKey: false },
    { ctrlKey: false, metaKey: false, shiftKey: true },
    { ctrlKey: true, metaKey: true, shiftKey: true },
  ])("blocks selection modifiers %j", (event) => expect(taskUrlGestureBlocked(event)).toBe(true));
  it("retains ordinary pointer URL launches", () => {
    expect(taskUrlGestureBlocked({ ctrlKey: false, metaKey: false, shiftKey: false })).toBe(false);
  });
});
