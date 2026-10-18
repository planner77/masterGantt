import { describe, expect, it } from "vitest";
import { registerTaskUrlSnapshot, taskUrlGestureBlocked } from "../../../src/features/gantt/task-context-target";
const id = "00000000-0000-4000-8000-000000000001";
function fakeFrame() {
  const classes = new Set<string>();
  const row = { dataset: {} as Record<string, string>, getAttribute: (key: string) => key === "data-id" ? `:${id}` : null, classList: { add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value) } };
  const frame = { querySelectorAll: () => [row], isConnected: true } as unknown as HTMLElement;
  return { frame, row, classes };
}
describe("#462 canonical URL decoration lifecycle", () => {
  it("updates/removes immediately without reading the API", () => {
    const { frame, row, classes } = fakeFrame();
    const disposeOld = registerTaskUrlSnapshot(frame, [{ taskId: id, url: "https://example.test/a" }]); expect(row.dataset.taskUrl).toBe("https://example.test/a"); expect(classes.has("has-task-url")).toBe(true);
    const disposeLatest = registerTaskUrlSnapshot(frame, [{ taskId: id, url: "http://example.test/b" }]); disposeOld(); expect(row.dataset.taskUrl).toBe("http://example.test/b");
    disposeLatest(); expect(row.dataset.taskUrl).toBeUndefined(); expect(classes.has("has-task-url")).toBe(false);
  });
  it("isolates two frames with identical IDs and rejects unsafe protocols", () => {
    const a = fakeFrame(), b = fakeFrame(); const clearA = registerTaskUrlSnapshot(a.frame, [{ taskId: id, url: "https://example.test/a" }]); const clearB = registerTaskUrlSnapshot(b.frame, [{ taskId: id, url: "https://example.test/b" }]);
    expect(a.row.dataset.taskUrl).toBe("https://example.test/a"); expect(b.row.dataset.taskUrl).toBe("https://example.test/b"); clearA(); expect(b.row.dataset.taskUrl).toBe("https://example.test/b");
    const clearUnsafe = registerTaskUrlSnapshot(b.frame, [{ taskId: id, url: "javascript:alert(1)" }]); clearB(); expect(b.row.dataset.taskUrl).toBeUndefined(); clearUnsafe();
  });
  it.each(["ctrlKey", "metaKey", "shiftKey"] as const)("preserves %s selection gesture exclusion", (modifier) => {
    expect(taskUrlGestureBlocked({ ctrlKey: false, metaKey: false, shiftKey: false, [modifier]: true })).toBe(true);
  });
});
