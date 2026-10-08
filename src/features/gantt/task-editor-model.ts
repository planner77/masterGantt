import type { ProjectCalendarDto, ProjectTaskDto, TaskStatus } from "../../contracts/projects";
import { normalizeTaskStatusProgress, taskStatusFromProgress } from "../../domain/task-status";
import { endFromStart, isWorkingDay, MAX_TASK_DURATION, nextWorkingDay, workingDaysBetween } from "../../domain/scheduling/calendar";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import {
  workingCalendarFromProjectCalendar,
  type ProjectTaskUpdateCommand,
  type ProjectTaskUpdatePayload,
} from "./project-task-adapter";

export interface TaskEditorSession {
  readonly task: ProjectTaskDto;
  readonly calendar: ProjectCalendarDto;
  readonly revision: number;
}
export interface TaskEditorDraft {
  readonly name: string;
  readonly explicitMilestoneTaskId: string | null;
  readonly start: string;
  readonly duration: string;
  readonly requestedEnd: string;
  readonly scheduleMode: "auto" | "manual";
  readonly progress: string;
  readonly status: TaskStatus;
  readonly description: string;
  readonly url: string;
  readonly baselineStart: string;
  readonly baselineDuration: string;
  readonly baselineEnd: string;
}
export type TaskEditorSaveResult = { readonly status: "saved" } | { readonly status: "failed"; readonly message: string; readonly conflict?: boolean };
export type TaskEditorScheduleBasis = "duration" | "end";
export type TaskEditorScheduleField = "start" | "duration" | "requestedEnd";
export interface TaskEditorScheduleIssue {
  readonly field: TaskEditorScheduleField;
  readonly message: string;
}

function normalizedDescription(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

function normalizedUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function taskDetailChanges(
  task: ProjectTaskDto,
  draft: Pick<TaskEditorDraft, "description" | "url">,
): { readonly payload: Partial<Pick<ProjectTaskUpdatePayload, "description" | "url">>; readonly error: string | null } {
  if (Array.from(draft.description).length > 10_000) {
    return { payload: {}, error: "Description은 10,000자 이하로 입력해 주세요." };
  }
  const description = normalizedDescription(draft.description);
  const url = normalizedUrl(draft.url);
  if (url !== null && (!validHttpUrl(url) || Array.from(url).length > 4_096)) {
    return { payload: {}, error: "URL은 http:// 또는 https:// 형식으로 입력해 주세요." };
  }
  return {
    payload: {
      ...(description !== (task.description ?? null) ? { description } : {}),
      ...(url !== (task.url ?? null) ? { url } : {}),
    },
    error: null,
  };
}

function scheduleIssue(field: TaskEditorScheduleField, message: string): TaskEditorScheduleIssue {
  return { field, message };
}

function normalizedRequestedStart(
  draft: Pick<TaskEditorDraft, "start" | "scheduleMode">,
  calendar: ProjectCalendarDto,
): { readonly value: string | null; readonly issue: TaskEditorScheduleIssue | null } {
  try {
    parseDateOnly(draft.start);
  } catch {
    return { value: null, issue: scheduleIssue("start", "요청 시작일은 1900-01-01~2199-12-31 범위의 올바른 날짜여야 합니다.") };
  }
  const workingCalendar = workingCalendarFromProjectCalendar(calendar);
  if (isWorkingDay(draft.start, workingCalendar)) return { value: draft.start, issue: null };
  if (draft.scheduleMode === "manual") {
    return { value: null, issue: scheduleIssue("start", "수동 일정의 요청 시작일은 현재 프로젝트 캘린더의 근무일이어야 합니다.") };
  }
  try {
    return { value: nextWorkingDay(draft.start, workingCalendar, true), issue: null };
  } catch {
    return { value: null, issue: scheduleIssue("start", "요청 시작일 이후의 근무일을 지원 날짜 범위에서 찾을 수 없습니다.") };
  }
}

function parsedDuration(value: string): number | null {
  const duration = Number(value);
  return value.trim().length > 0 && Number.isSafeInteger(duration) && duration >= 1 && duration <= MAX_TASK_DURATION
    ? duration
    : null;
}

function endIssue(
  requestedEnd: string,
  normalizedStart: string,
  calendar: ProjectCalendarDto,
): { readonly duration: number | null; readonly issue: TaskEditorScheduleIssue | null } {
  try {
    parseDateOnly(requestedEnd);
  } catch {
    return { duration: null, issue: scheduleIssue("requestedEnd", "요청 종료일은 1900-01-01~2199-12-31 범위의 올바른 날짜여야 합니다.") };
  }
  if (requestedEnd < normalizedStart) {
    return { duration: null, issue: scheduleIssue("requestedEnd", "요청 종료일은 캘린더 보정 후 요청 시작일보다 빠를 수 없습니다.") };
  }
  const workingCalendar = workingCalendarFromProjectCalendar(calendar);
  if (!isWorkingDay(requestedEnd, workingCalendar)) {
    return { duration: null, issue: scheduleIssue("requestedEnd", "요청 종료일은 현재 프로젝트 캘린더의 근무일이어야 합니다.") };
  }
  const duration = workingDaysBetween(normalizedStart, requestedEnd, workingCalendar);
  if (duration < 1 || duration > MAX_TASK_DURATION) {
    return { duration: null, issue: scheduleIssue("requestedEnd", "요청 시작일과 종료일 사이의 기간은 1~10,000 근무일이어야 합니다.") };
  }
  return { duration, issue: null };
}

export function synchronizeTaskEditorScheduleDraft(
  task: ProjectTaskDto,
  draft: TaskEditorDraft,
  calendar: ProjectCalendarDto,
  basis: TaskEditorScheduleBasis,
): TaskEditorDraft {
  if (task.type !== "task") return draft;
  const normalized = normalizedRequestedStart(draft, calendar);
  if (!normalized.value) {
    return basis === "duration" ? { ...draft, requestedEnd: "" } : { ...draft, duration: "" };
  }
  if (basis === "end") {
    const result = endIssue(draft.requestedEnd, normalized.value, calendar);
    return result.duration === null ? { ...draft, duration: "" } : { ...draft, duration: String(result.duration) };
  }
  const duration = parsedDuration(draft.duration);
  if (duration === null) return { ...draft, requestedEnd: "" };
  try {
    return {
      ...draft,
      requestedEnd: endFromStart(normalized.value, duration, workingCalendarFromProjectCalendar(calendar)),
    };
  } catch {
    return { ...draft, requestedEnd: "" };
  }
}

export function validateTaskEditorSchedule(
  task: ProjectTaskDto,
  draft: TaskEditorDraft,
  calendar: ProjectCalendarDto,
  basis: TaskEditorScheduleBasis,
): TaskEditorScheduleIssue | null {
  if (task.type !== "task") return null;
  const normalized = normalizedRequestedStart(draft, calendar);
  if (!normalized.value) return normalized.issue;

  if (basis === "end") {
    const requestedEnd = endIssue(draft.requestedEnd, normalized.value, calendar);
    if (requestedEnd.issue) return requestedEnd.issue;
    const duration = parsedDuration(draft.duration);
    if (duration === null) return scheduleIssue("duration", "기간은 1~10,000 사이의 정수 근무일로 입력해 주세요.");
    if (duration !== requestedEnd.duration) return scheduleIssue("duration", "기간과 요청 종료일이 현재 프로젝트 캘린더 기준으로 일치하지 않습니다.");
    return null;
  }

  const duration = parsedDuration(draft.duration);
  if (duration === null) return scheduleIssue("duration", "기간은 1~10,000 사이의 정수 근무일로 입력해 주세요.");
  let expectedEnd: string;
  try {
    expectedEnd = endFromStart(normalized.value, duration, workingCalendarFromProjectCalendar(calendar));
  } catch {
    return scheduleIssue("requestedEnd", "계산된 요청 종료일이 지원 날짜 범위를 벗어났습니다.");
  }
  const requestedEnd = endIssue(draft.requestedEnd, normalized.value, calendar);
  if (requestedEnd.issue) return requestedEnd.issue;
  return draft.requestedEnd === expectedEnd
    ? null
    : scheduleIssue("requestedEnd", "기간과 요청 종료일이 현재 프로젝트 캘린더 기준으로 일치하지 않습니다.");
}

export function createTaskEditorDraft(task: ProjectTaskDto, calendar?: ProjectCalendarDto): TaskEditorDraft {
  const draft: TaskEditorDraft = {
    name: task.name,
    explicitMilestoneTaskId: task.membership?.explicitMilestoneTaskId ?? null,
    start: task.requestedStart ?? task.start ?? "",
    duration: task.duration === null ? "" : String(task.duration),
    requestedEnd: task.type === "task" ? task.end ?? "" : "",
    scheduleMode: task.scheduleMode,
    progress: task.progress === null ? "" : String(task.progress),
    status: task.status ?? taskStatusFromProgress(task.progress),
    description: task.description ?? "",
    url: task.url ?? "",
    baselineStart: task.baselineStart ?? "",
    baselineDuration: task.baselineDuration !== null && task.baselineDuration !== undefined ? String(task.baselineDuration) : "",
    baselineEnd: task.baselineEnd ?? "",
  };
  return calendar ? synchronizeTaskEditorScheduleDraft(task, draft, calendar, "duration") : draft;
}

export function updateTaskEditorDraft(
  draft: TaskEditorDraft,
  field: keyof TaskEditorDraft,
  value: string | null,
): TaskEditorDraft {
  if (value === null) return field === "explicitMilestoneTaskId" ? { ...draft, explicitMilestoneTaskId: null } : draft;
  if (field === "status") {
    if (value !== "not_started" && value !== "in_progress" && value !== "completed") return draft;
    const currentProgress = Number(draft.progress);
    const normalized = normalizeTaskStatusProgress({
      currentStatus: draft.status,
      currentProgress: Number.isFinite(currentProgress) ? currentProgress : 0,
      status: value,
    });
    return { ...draft, status: normalized.status, progress: String(normalized.progress) };
  }
  if (field === "progress") {
    const progress = Number(value);
    if (value.trim() && Number.isFinite(progress) && progress >= 0 && progress <= 100) {
      const currentProgress = Number(draft.progress);
      const normalized = normalizeTaskStatusProgress({
        currentStatus: draft.status,
        currentProgress: Number.isFinite(currentProgress) ? currentProgress : 0,
        progress,
      });
      return { ...draft, progress: value, status: normalized.status };
    }
  }
  return { ...draft, [field]: value } as TaskEditorDraft;
}

export function copyScheduleToBaseline(draft: TaskEditorDraft, task: ProjectTaskDto): TaskEditorDraft {
  return {
    ...draft,
    baselineStart: task.start ?? "",
    baselineDuration: task.duration === null ? "" : String(task.duration),
    baselineEnd: task.end ?? "",
  };
}

export function clearBaseline(draft: TaskEditorDraft): TaskEditorDraft {
  return {
    ...draft,
    baselineStart: "",
    baselineDuration: "",
    baselineEnd: "",
  };
}

export function taskEditorIsDirty(task: ProjectTaskDto, draft: TaskEditorDraft): boolean {
  const initial = createTaskEditorDraft(task);
  const persistedFields: readonly (keyof TaskEditorDraft)[] = [
    "explicitMilestoneTaskId", "name", "start", "duration", "scheduleMode", "progress", "status", "description", "url",
    "baselineStart", "baselineDuration", "baselineEnd",
  ];
  return persistedFields.some((field) => initial[field] !== draft[field]);
}

export function taskEditorReadOnlyReason(task: ProjectTaskDto | undefined, editable: boolean, _hasLinks: boolean): string | null {
  // Dependency endpoints use the same field policy as other leaf tasks.
  void _hasLinks;
  if (!task) return "작업을 찾을 수 없습니다. 삭제되었거나 최신 정보가 필요합니다.";
  if (!editable) return "편집 권한이 없습니다. 프로젝트 편집 잠금을 해제한 후 다시 열어 주세요.";
  return null;
}

export function prepareTaskEditorCommand(task: ProjectTaskDto, draft: TaskEditorDraft): { readonly command: ProjectTaskUpdateCommand | null; readonly error: string | null } {
  const invalid = (error: string) => ({ command: null, error });
  const name = draft.name.trim();
  const characters = Array.from(name);
  if (characters.length < 1 || characters.length > 200 || characters.some((character) => { const code = character.charCodeAt(0); return character.length === 1 && code >= 0xd800 && code <= 0xdfff; })) return invalid("작업명은 올바른 문자로 1~200자까지 입력해 주세요.");
  const membership = draft.explicitMilestoneTaskId !== (task.membership?.explicitMilestoneTaskId ?? null) ? { explicitMilestoneTaskId: draft.explicitMilestoneTaskId } : {};
  if (task.type === "summary") {
    const details = taskDetailChanges(task, draft);
    if (details.error) return invalid(details.error);
    const payload: ProjectTaskUpdatePayload = {
      ...(name !== task.name ? { name } : {}),
      ...details.payload,
      ...membership,
    };
    return { command: Object.keys(payload).length ? { taskId: task.taskId, payload } : null, error: null };
  }
  try { parseDateOnly(draft.start); } catch { return invalid("시작일은 1900-01-01~2199-12-31 범위의 올바른 날짜여야 합니다."); }
  if (draft.scheduleMode !== "auto" && draft.scheduleMode !== "manual") return invalid("일정 모드를 확인해 주세요.");
  const duration = Number(draft.duration);
  if (!draft.duration.trim() || !Number.isSafeInteger(duration) || (task.type === "milestone" ? duration !== 0 : duration < 1 || duration > MAX_TASK_DURATION)) return invalid(task.type === "milestone" ? "Milestone의 기간은 0일입니다." : "기간은 1~10,000 사이의 정수 근무일로 입력해 주세요.");
  const progress = Number(draft.progress);
  if (!draft.progress.trim() || !Number.isFinite(progress) || progress < 0 || progress > 100 || (progress !== task.progress && !Number.isInteger(progress))) {
    return invalid("진행률은 0~100 사이의 1% 단위 값으로 입력해 주세요.");
  }
  const details = taskDetailChanges(task, draft);
  if (details.error) return invalid(details.error);

  let nextBaselineStart: string | null = null;
  let nextBaselineDuration: number | null = null;
  let nextBaselineEnd: string | null = null;
  const rawBaselineStart = draft.baselineStart.trim();
  const rawBaselineDuration = draft.baselineDuration.trim();
  const rawBaselineEnd = draft.baselineEnd.trim();

  const baselineChanged = rawBaselineStart !== (task.baselineStart ?? "") ||
    rawBaselineDuration !== (task.baselineDuration !== null && task.baselineDuration !== undefined ? String(task.baselineDuration) : "") ||
    rawBaselineEnd !== (task.baselineEnd ?? "");

  if (baselineChanged) {
    if (rawBaselineStart.length > 0) {
      try { parseDateOnly(rawBaselineStart); } catch { return invalid("기준 일정 시작일은 올바른 날짜여야 합니다."); }
      const bDuration = Number(rawBaselineDuration);
      if (!rawBaselineDuration || !Number.isSafeInteger(bDuration) || (task.type === "milestone" ? bDuration !== 0 : bDuration < 1 || bDuration > MAX_TASK_DURATION)) {
        return invalid(task.type === "milestone" ? "Milestone의 기준 일정 기간은 0일입니다." : "기준 일정 기간은 1~10,000 사이의 정수 근무일로 입력해 주세요.");
      }
      nextBaselineStart = rawBaselineStart;
      nextBaselineDuration = bDuration;
      nextBaselineEnd = rawBaselineEnd.length > 0 ? rawBaselineEnd : null;
    } else {
      nextBaselineStart = null;
      nextBaselineDuration = null;
      nextBaselineEnd = null;
    }
  }

  const initialStatus = task.status ?? taskStatusFromProgress(task.progress);
  const payload: ProjectTaskUpdatePayload = {
    ...membership,
    ...(name !== task.name ? { name } : {}),
    ...(draft.start !== (task.requestedStart ?? task.start) ? { start: draft.start } : {}),
    ...(task.type === "task" && duration !== task.duration ? { duration } : {}),
    ...(draft.scheduleMode !== task.scheduleMode ? { scheduleMode: draft.scheduleMode } : {}),
    ...(progress !== task.progress ? { progress } : {}),
    ...(draft.status !== initialStatus ? { status: draft.status } : {}),
    ...details.payload,
    ...(baselineChanged ? {
      baselineStart: nextBaselineStart,
      baselineDuration: nextBaselineDuration,
      baselineEnd: nextBaselineEnd,
    } : {}),
  };
  return { command: Object.keys(payload).length ? { taskId: task.taskId, payload } : null, error: null };
}
