import type { ProjectTaskDto } from "../../contracts/projects";
import { MAX_TASK_DURATION } from "../../domain/scheduling/calendar";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import type { ProjectTaskUpdateCommand, ProjectTaskUpdatePayload } from "./project-task-adapter";

export interface TaskEditorSession { readonly task: ProjectTaskDto; readonly revision: number; }
export interface TaskEditorDraft { readonly name: string; readonly start: string; readonly duration: string; readonly progress: string; }
export type TaskEditorSaveResult = { readonly status: "saved" } | { readonly status: "failed"; readonly message: string; readonly conflict?: boolean };
export function createTaskEditorDraft(task: ProjectTaskDto): TaskEditorDraft { return { name: task.name, start: task.start, duration: String(task.duration), progress: String(task.progress) }; }
export function taskEditorIsDirty(task: ProjectTaskDto, draft: TaskEditorDraft): boolean {
  const initial = createTaskEditorDraft(task);
  return (Object.keys(initial) as (keyof TaskEditorDraft)[]).some((field) => initial[field] !== draft[field]);
}
export function taskEditorReadOnlyReason(task: ProjectTaskDto | undefined, editable: boolean, hasLinks: boolean): string | null {
  if (!task) return "작업을 찾을 수 없습니다. 삭제되었거나 최신 정보가 필요합니다.";
  if (task.type === "summary") return "요약 작업은 하위 작업으로 계산되므로 읽기 전용입니다.";
  if (!editable) return "편집 권한이 없습니다. 프로젝트 편집 잠금을 해제한 후 다시 열어 주세요.";
  if (hasLinks) return "연결이 있는 일정의 편집은 아직 지원하지 않습니다. 읽기 전용으로 표시합니다.";
  return null;
}
export function prepareTaskEditorCommand(task: ProjectTaskDto, draft: TaskEditorDraft): { readonly command: ProjectTaskUpdateCommand | null; readonly error: string | null } {
  const invalid = (error: string) => ({ command: null, error });
  if (task.type === "summary") return invalid("요약 작업은 직접 수정할 수 없습니다.");
  const name = draft.name.trim();
  const characters = Array.from(name);
  if (characters.length < 1 || characters.length > 200 || characters.some((character) => { const code = character.charCodeAt(0); return character.length === 1 && code >= 0xd800 && code <= 0xdfff; })) return invalid("작업명은 올바른 문자로 1~200자까지 입력해 주세요.");
  try { parseDateOnly(draft.start); } catch { return invalid("시작일은 1900-01-01~2199-12-31 범위의 올바른 날짜여야 합니다."); }
  const duration = Number(draft.duration);
  if (!draft.duration.trim() || !Number.isSafeInteger(duration) || (task.type === "milestone" ? duration !== 0 : duration < 1 || duration > MAX_TASK_DURATION)) return invalid(task.type === "milestone" ? "마일스톤의 기간은 0일입니다." : "기간은 1~10,000 사이의 정수 근무일로 입력해 주세요.");
  const progress = Number(draft.progress);
  if (!draft.progress.trim() || !Number.isInteger(progress) || progress < 0 || progress > 100) return invalid("진행률은 0~100 사이의 정수로 입력해 주세요.");
  const payload: ProjectTaskUpdatePayload = {
    ...(name !== task.name ? { name } : {}),
    ...(draft.start !== task.start ? { start: draft.start } : {}),
    ...(task.type === "task" && duration !== task.duration ? { duration } : {}),
    ...(progress !== task.progress ? { progress } : {}),
  };
  return { command: Object.keys(payload).length ? { taskId: task.taskId, payload } : null, error: null };
}
