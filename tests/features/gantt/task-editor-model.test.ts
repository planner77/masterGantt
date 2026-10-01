import { describe, expect, it } from "vitest";
import type { ProjectCalendarDto, ProjectTaskDto } from "../../../src/contracts/projects";
import {
  copyScheduleToBaseline,
  createTaskEditorDraft,
  prepareTaskEditorCommand,
  synchronizeTaskEditorScheduleDraft,
  taskEditorIsDirty,
  taskEditorReadOnlyReason,
  validateTaskEditorSchedule,
} from "../../../src/features/gantt/task-editor-model";
import { taskIdFromElement } from "../../../src/features/gantt/task-context-target";

const calendar: ProjectCalendarDto = {
  timezone: "Asia/Seoul",
  weekendDays: [6, 0],
  holidays: [],
  exceptions: [
    { date: "2026-09-21", dayType: "NON_WORKING", name: "Plant holiday" },
    { date: "2026-09-26", dayType: "WORKING", name: "Weekend work" },
  ],
};

const task: ProjectTaskDto = {
  taskId: "00000000-0000-4000-8000-000000000003", externalId: "LEAF", name: "Task",
  description: null, url: null,
  type: "task", scheduleMode: "auto", requestedStart: "2026-09-19", start: "2026-09-22",
  end: "2026-09-22", duration: 1, progress: 10, parentExternalId: null, siblingOrder: 0,
};

describe("Issue #368 requested end draft synchronization", () => {
  it("derives requested end from normalized requested start and working-day duration", () => {
    const draft = createTaskEditorDraft(task, calendar);
    expect(draft.requestedEnd).toBe("2026-09-22");

    const durationBasis = synchronizeTaskEditorScheduleDraft(
      task,
      { ...draft, duration: "4" },
      calendar,
      "duration",
    );
    expect(durationBasis.requestedEnd).toBe("2026-09-25");
    expect(validateTaskEditorSchedule(task, durationBasis, calendar, "duration")).toBeNull();
  });

  it("derives duration from requested end and respects explicit WORKING weekend exceptions", () => {
    const draft = createTaskEditorDraft(task, calendar);
    const endBasis = synchronizeTaskEditorScheduleDraft(
      task,
      { ...draft, requestedEnd: "2026-09-26" },
      calendar,
      "end",
    );
    expect(endBasis.duration).toBe("5");
    expect(endBasis.requestedEnd).toBe("2026-09-26");
    expect(validateTaskEditorSchedule(task, endBasis, calendar, "end")).toBeNull();
  });

  it("keeps the last explicit end date when start changes and recalculates duration", () => {
    const draft = synchronizeTaskEditorScheduleDraft(
      task,
      { ...createTaskEditorDraft(task, calendar), requestedEnd: "2026-09-25" },
      calendar,
      "end",
    );
    const moved = synchronizeTaskEditorScheduleDraft(
      task,
      { ...draft, start: "2026-09-17" },
      calendar,
      "end",
    );
    expect(moved.requestedEnd).toBe("2026-09-25");
    expect(moved.duration).toBe("6");
  });

  it("rejects a non-working requested end without leaking it into the update payload", () => {
    const draft = synchronizeTaskEditorScheduleDraft(
      task,
      { ...createTaskEditorDraft(task, calendar), requestedEnd: "2026-09-21" },
      calendar,
      "end",
    );
    expect(draft.duration).toBe("");
    expect(validateTaskEditorSchedule(task, draft, calendar, "end")).toEqual({
      field: "requestedEnd",
      message: "요청 종료일은 현재 프로젝트 캘린더의 근무일이어야 합니다.",
    });
    expect(prepareTaskEditorCommand(task, draft).command).toBeNull();
  });

  it("keeps requestedEnd UI-only and sends only start plus duration", () => {
    const draft = synchronizeTaskEditorScheduleDraft(
      task,
      { ...createTaskEditorDraft(task, calendar), start: "2026-09-17", duration: "5" },
      calendar,
      "duration",
    );
    expect(draft.requestedEnd).toBe("2026-09-24");
    expect(prepareTaskEditorCommand(task, draft).command?.payload).toEqual({
      start: "2026-09-17",
      duration: 5,
    });
  });
});

describe("explicit task editor commands", () => {
  it("edits requested dates separately and copies only stored effective dates", () => {
    const draft = createTaskEditorDraft(task);
    expect(draft.start).toBe(task.requestedStart);
    expect(prepareTaskEditorCommand(task, { ...draft, start: task.start! }).command?.payload).toEqual({ start: task.start });
    const copied = copyScheduleToBaseline({ ...draft, start: "2026-10-01", duration: "5" }, task);
    expect(copied).toMatchObject({ baselineStart: task.start, baselineDuration: "1", baselineEnd: task.end });
    expect(prepareTaskEditorCommand(task, { ...draft, scheduleMode: "manual" }).command?.payload).toEqual({ scheduleMode: "manual" });
  });
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
    expect(taskEditorReadOnlyReason(task, true, true)).toBeNull();
    expect(taskEditorReadOnlyReason(undefined, true, false)).toContain("찾을 수");
    expect(taskEditorReadOnlyReason(task, true, false)).toBeNull();
  });
  it("decodes only a canonical task ID, never a row number or label", () => {
    const element = (raw: string) => ({ getAttribute: (attribute: string) => attribute === "data-id" ? raw : null }) as unknown as Element;
    expect(taskIdFromElement(element(`:${task.taskId}`))).toBe(task.taskId);
    expect(taskIdFromElement(element(task.taskId))).toBe(task.taskId);
    for (const raw of ["1", "Task", "", `::${task.taskId}`, "00000000-0000-0000-0000-000000000000"]) expect(taskIdFromElement(element(raw))).toBeNull();
  });

  it("handles baseline draft copying, clearing, and payload generation", () => {
    const draft = createTaskEditorDraft(task);
    expect(draft.baselineStart).toBe("");
    expect(draft.baselineDuration).toBe("");
    expect(draft.baselineEnd).toBe("");

    const copied = { ...draft, baselineStart: task.start!, baselineDuration: String(task.duration), baselineEnd: task.end! };
    const prepared = prepareTaskEditorCommand(task, copied);
    expect(prepared.command?.payload).toEqual({
      baselineStart: task.start,
      baselineDuration: task.duration,
      baselineEnd: task.end,
    });

    const populatedTask: ProjectTaskDto = {
      ...task,
      baselineStart: "2026-09-22",
      baselineDuration: 1,
      baselineEnd: "2026-09-22",
    };
    const clearedDraft = { ...createTaskEditorDraft(populatedTask), baselineStart: "", baselineDuration: "", baselineEnd: "" };
    const clearedPrepared = prepareTaskEditorCommand(populatedTask, clearedDraft);
    expect(clearedPrepared.command?.payload).toEqual({
      baselineStart: null,
      baselineDuration: null,
      baselineEnd: null,
    });
  });
});
