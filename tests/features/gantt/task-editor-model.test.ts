import { describe, expect, it } from "vitest";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { createTaskEditorDraft, prepareTaskEditorCommand, taskEditorIsDirty, taskEditorReadOnlyReason } from "../../../src/features/gantt/task-editor-model";
import { taskIdFromElement } from "../../../src/features/gantt/task-context-target";

const task: ProjectTaskDto = {
  taskId: "00000000-0000-4000-8000-000000000003", externalId: "LEAF", name: "Task",
  description: null, url: null,
  type: "task", scheduleMode: "auto", requestedStart: "2026-09-19", start: "2026-09-22",
  end: "2026-09-22", duration: 1, progress: 10, parentExternalId: null, siblingOrder: 0,
};

describe("explicit task editor commands", () => {
  it("does not send a request when opening or saving an unchanged draft", () => {
    const draft = createTaskEditorDraft(task);
    expect(taskEditorIsDirty(task, draft)).toBe(false);
    expect(prepareTaskEditorCommand(task, draft)).toEqual({ command: null, error: null });
  });
  it("sends only a direct working-day duration, without recalculating an end date", () => {
    const result = prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), duration: "3" });
    expect(result.command).toEqual({ taskId: task.taskId, payload: { duration: 3 } });
  });
  it("keeps dates unchanged on name/progress edits", () => {
    const draft = { ...createTaskEditorDraft(task), name: "  Edited  ", progress: "12" };
    expect(taskEditorIsDirty(task, draft)).toBe(true);
    expect(prepareTaskEditorCommand(task, draft).command?.payload).toEqual({ name: "Edited", progress: 12 });
  });
  it("normalizes blank description/url and permits multiline plus internal http URL", () => {
    const populated = { ...task, description: "old", url: "https://example.test/old" };
    expect(prepareTaskEditorCommand(populated, {
      ...createTaskEditorDraft(populated),
      description: "첫 줄\n둘째 줄",
      url: "  http://10.10.20.30:8080/redmine/issues/123  ",
    }).command?.payload).toEqual({
      description: "첫 줄\n둘째 줄",
      url: "http://10.10.20.30:8080/redmine/issues/123",
    });
    expect(prepareTaskEditorCommand(populated, {
      ...createTaskEditorDraft(populated), description: "   ", url: "   ",
    }).command?.payload).toEqual({ description: null, url: null });
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "file:///tmp/a", "vbscript:msgbox(1)", "not-a-url"])("rejects unsafe URL %s", (url) => {
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), url }).error).toContain("http://");
  });
  it("whitelists changed supported fields without leaking extra draft fields", () => {
    const draft = { ...createTaskEditorDraft(task), start: "2026-09-18", duration: "4", name: "Changed", progress: "100", description: "note", url: "https://example.test/x", end: "2099-01-01", taskId: "wrong", type: "summary" };
    expect(prepareTaskEditorCommand(task, draft).command).toEqual({
      taskId: task.taskId,
      payload: { start: "2026-09-18", duration: 4, name: "Changed", progress: 100, description: "note", url: "https://example.test/x" },
    });
  });
  it("sends start-only requests without changing duration", () => {
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), start: "2026-09-20" }).command?.payload).toEqual({ start: "2026-09-20" });
  });
  it.each(["", " ", "0", "-1", "1.5", "NaN", "Infinity", "10001"])("rejects invalid leaf duration %s", (duration) => {
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), duration }).error).toBeTruthy();
  });
  it.each(["", " ", "-1", "1.5", "101", "Infinity", "NaN"])("rejects invalid progress %s", (progress) => {
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), progress }).error).toBeTruthy();
  });
  it.each(["2026-02-30", "2026-9-18", "2026-09-18T00:00:00Z", "1899-12-31", "2200-01-01", ""])("rejects invalid date-only input %s", (start) => {
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), start }).error).toBeTruthy();
  });
  it.each(["2024-02-29", "1900-01-01", "2199-12-31"])("keeps date-only input unchanged: %s", (start) => {
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), start }).command?.payload).toEqual({ start });
  });
  it("validates Unicode code points and rejects empty or malformed names", () => {
    for (const name of ["", "   ", "x".repeat(201), "\ud800"]) expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), name }).error).toBeTruthy();
    expect(prepareTaskEditorCommand(task, { ...createTaskEditorDraft(task), name: "😀".repeat(200) }).error).toBeNull();
  });
  it("makes summaries readonly and does not permit a summary command", () => {
    const summary = { ...task, type: "summary" as const };
    expect(taskEditorReadOnlyReason(summary, true, false)).toContain("하위 작업");
    expect(prepareTaskEditorCommand(summary, { ...createTaskEditorDraft(summary), name: "No" }).error).toBeTruthy();
  });
  it("enforces milestone zero duration and omits it from allowed updates", () => {
    const milestone = { ...task, type: "milestone" as const, duration: 0 };
    expect(prepareTaskEditorCommand(milestone, { ...createTaskEditorDraft(milestone), start: "2026-09-18", progress: "50" }).command?.payload).toEqual({ start: "2026-09-18", progress: 50 });
    expect(prepareTaskEditorCommand(milestone, { ...createTaskEditorDraft(milestone), duration: "1" }).error).toBeTruthy();
  });
  it("reports readonly, dependency and deleted-task restrictions", () => {
    expect(taskEditorReadOnlyReason(task, false, false)).toContain("권한");
    expect(taskEditorReadOnlyReason(task, true, true)).toContain("연결");
    expect(taskEditorReadOnlyReason(undefined, true, false)).toContain("찾을 수");
    expect(taskEditorReadOnlyReason(task, true, false)).toBeNull();
  });
  it("decodes only a canonical task ID, never a row number or label", () => {
    const element = (raw: string) => ({ getAttribute: (attribute: string) => attribute === "data-id" ? raw : null }) as unknown as Element;
    expect(taskIdFromElement(element(`:${task.taskId}`))).toBe(task.taskId);
    expect(taskIdFromElement(element(task.taskId))).toBe(task.taskId);
    for (const raw of ["1", "Task", "", `::${task.taskId}`, "00000000-0000-0000-0000-000000000000"]) expect(taskIdFromElement(element(raw))).toBeNull();
  });
});
