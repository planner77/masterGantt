"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ProjectLinkButton } from "@/components/project-link-button";
import { ProjectCopyEntry } from "@/features/projects/project-copy-entry";
import { ProjectExcelExportButton } from "@/features/projects/project-excel-export-button";
import { ProjectWorkCalendarEditor } from "@/features/projects/project-work-calendar-editor";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import { WorkspaceNotifications, useWorkspaceNotifications } from "@/components/workspace-notifications";
import feedbackStyles from "@/components/workspace-feedback.module.css";
import type { ProjectMetadataMutationResponse, ProjectSnapshotResponse, TaskHierarchyCommandRequest, TaskMutationResponse } from "@/contracts/projects";
import type { ProjectGridColumnVisibility } from "@/features/gantt/project-gantt";
import type { ProjectTaskCreateCommand, ProjectTaskUpdateCommand } from "@/features/gantt/project-task-adapter";
import { ProjectTaskEditor } from "@/features/gantt/project-task-editor";
import { taskEditorReadOnlyReason, type TaskEditorSaveResult, type TaskEditorSession } from "@/features/gantt/task-editor-model";
import { createTaskDeletePlan, type TaskDeletePlan } from "@/features/gantt/task-delete-model";
import { findTaskContextElement } from "@/features/gantt/task-context-target";
import { ProjectResourceWorkload } from "@/features/resources/project-resource-workload";
import { todayLocalDateString } from "@/lib/date-display";

const ProjectGantt = dynamic(
  () => import("@/features/gantt/project-gantt").then((module) => module.ProjectGantt),
  { ssr: false, loading: () => <div className="gantt-loading" role="status">일정을 불러오는 중입니다.</div> },
);
type LoadState = { status: "loading" } | { status: "ready"; snapshot: ProjectSnapshotResponse } | { status: "not-found" } | { status: "error" };
type Permission = "readonly" | "edit";
type PermissionCheckState = "checking" | "complete";
type PendingTaskDelete = TaskDeletePlan & Readonly<{ revision: number }>;
const INITIAL_COLUMN_VISIBILITY: ProjectGridColumnVisibility = { text: true, externalId: false, projectStart: true, projectDuration: true };

function isSnapshot(value: unknown): value is ProjectSnapshotResponse {
  if (typeof value !== "object" || value === null || !("data" in value)) return false;
  const data = value.data;
  if (typeof data !== "object" || data === null || !("project" in data) || typeof data.project !== "object" || data.project === null) return false;
  const project = data.project;
  return "name" in project && typeof project.name === "string" &&
    "description" in project && typeof project.description === "string" &&
    "revision" in project && typeof project.revision === "number" &&
    "calendar" in project && typeof project.calendar === "object" && project.calendar !== null &&
    "timezone" in project.calendar && typeof project.calendar.timezone === "string" &&
    "holidays" in project.calendar && Array.isArray(project.calendar.holidays) &&
    "tasks" in data && Array.isArray(data.tasks) && "links" in data && Array.isArray(data.links);
}
function permissionFrom(value: unknown): Permission {
  if (typeof value === "object" && value !== null && "data" in value &&
    typeof value.data === "object" && value.data !== null &&
    "permission" in value.data && value.data.permission === "edit" &&
    "expiresAt" in value.data && typeof value.data.expiresAt === "string" &&
    value.data.expiresAt.length > 0 && !Number.isNaN(Date.parse(value.data.expiresAt))) return "edit";
  return "readonly";
}
function safeErrorCode(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "code" in value.error && typeof value.error.code === "string") return value.error.code;
  return null;
}
function passwordValid(value: string): boolean { return Array.from(value).length >= 12 && new TextEncoder().encode(value).byteLength <= 1024; }
function revisionTag(revision: number): string { return `"${revision}"`; }
function snapshotFromMetadataMutation(value: unknown): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Partial<ProjectMetadataMutationResponse>).data;
  if (!data || typeof data !== "object" || !data.project || typeof data.project !== "object" || !Array.isArray(data.tasks) ||
    !Array.isArray(data.links) || !Array.isArray(data.warnings) || !data.operation || data.operation.kind !== "projectMetadata" ||
    !Array.isArray(data.operation.changedFields)) return null;
  return { data: { project: data.project, tasks: data.tasks, links: data.links, permission: "readonly" } };
}
function snapshotFromTaskMutation(value: unknown): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Partial<TaskMutationResponse>).data;
  if (!data || typeof data !== "object" || !data.project || typeof data.project !== "object" ||
    !Array.isArray(data.tasks) || !Array.isArray(data.links) || !Array.isArray(data.warnings) ||
    !data.operation || !["taskCreate", "taskUpdate", "taskDelete", "taskHierarchy"].includes(data.operation.kind) ||
    !Array.isArray(data.operation.changedTaskExternalIds) || !Array.isArray(data.operation.deletedTaskExternalIds) ||
    !Array.isArray(data.operation.deletedLinkIds)) return null;
  return { data: { project: data.project, tasks: data.tasks, links: data.links, permission: "readonly" } };
}

type ProjectViewProps = Readonly<{ publicId: string; projectUrl?: string | null; ownerName: string }>;
export function ProjectReadonlyView({ publicId, projectUrl = null, ownerName }: ProjectViewProps) {
  return <WorkspaceNotifications key={publicId} scope={`프로젝트 ${publicId}`}>
    <ProjectWorkspace publicId={publicId} projectUrl={projectUrl} ownerName={ownerName} />
  </WorkspaceNotifications>;
}

function ProjectWorkspace({ publicId, projectUrl = null, ownerName }: ProjectViewProps) {
  const { notify, clearToast } = useWorkspaceNotifications();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [permission, setPermission] = useState<Permission>("readonly");
  const [permissionCheckState, setPermissionCheckState] = useState<PermissionCheckState>("checking");
  const [retryKey, setRetryKey] = useState(0);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<"schedule" | "resources">("schedule");
  const [ganttResetGeneration, setGanttResetGeneration] = useState(0);
  const [metadataName, setMetadataName] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<ProjectGridColumnVisibility>(INITIAL_COLUMN_VISIBILITY);
  const [pendingTaskDelete, setPendingTaskDelete] = useState<PendingTaskDelete | null>(null);
  const taskMutationReference = useRef(false);
  const [editorSession, setEditorSession] = useState<TaskEditorSession | null>(null);
  const editorTriggerReference = useRef<HTMLElement | null>(null);
  const deleteTriggerReference = useRef<HTMLElement | null>(null);
  const unlockTriggerReference = useRef<HTMLButtonElement | null>(null);
  const scheduleTabReference = useRef<HTMLButtonElement | null>(null);
  const resourceTabReference = useRef<HTMLButtonElement | null>(null);
  const actionMenuReference = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 404) { setState({ status: "not-found" }); return; }
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !isSnapshot(body)) {
          setState({ status: "error" });
          notify("error", "프로젝트 정보를 불러올 수 없습니다. 다시 시도해 주세요.", "프로젝트 조회", body);
          return;
        }
        setMetadataName(body.data.project.name); setMetadataDescription(body.data.project.description);
        setState({ status: "ready", snapshot: body });
        try {
          const current = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { credentials: "same-origin", signal: controller.signal });
          const currentBody: unknown = await current.json().catch(() => null);
          if (!controller.signal.aborted) {
            setPermission(current.ok ? permissionFrom(currentBody) : "readonly"); setPermissionCheckState("complete");
            if (!current.ok) notify("error", "편집 권한 조회에 실패했습니다. 읽기 전용으로 표시합니다.", "편집 권한 조회", currentBody);
          }
        } catch {
          if (!controller.signal.aborted) {
            setPermission("readonly"); setPermissionCheckState("complete");
            notify("error", "편집 권한 조회에 실패했습니다. 네트워크 연결을 확인해 주세요.", "편집 권한 조회");
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
          notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "프로젝트 조회");
        }
      }
    })();
    return () => controller.abort();
  }, [publicId, retryKey, notify]);

  function beginRefresh(clearNotice: boolean) {
    if (clearNotice) clearToast();
    setSettingsOpen(false); setUnlockOpen(false); setPendingTaskDelete(null); setPermission("readonly"); setPermissionCheckState("checking");
    setState({ status: "loading" }); setRetryKey((key) => key + 1);
  }
  function applySnapshot(value: unknown): boolean {
    if (!isSnapshot(value)) return false;
    setState({ status: "ready", snapshot: value });
    setMetadataName(value.data.project.name); setMetadataDescription(value.data.project.description);
    return true;
  }
  async function fetchCanonicalSnapshot(): Promise<ProjectSnapshotResponse | null> {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { credentials: "same-origin" });
      const body: unknown = await response.json().catch(() => null);
      return response.ok && isSnapshot(body) && applySnapshot(body) ? body : null;
    } catch { return null; }
  }
  async function reloadCanonicalSnapshot(): Promise<boolean> { return (await fetchCanonicalSnapshot()) !== null; }
  function conflict(operation: string, body?: unknown) {
    setPermission("readonly");
    notify("error", "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 다시 불러옵니다. 내용을 확인한 뒤 다시 저장해 주세요.", operation, body);
    beginRefresh(false);
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking) return;
    if (!passwordValid(unlockPassword)) {
      notify("error", "편집 비밀번호는 최소 12자이며 UTF-8 기준 1,024 bytes 이하여야 합니다.", "편집 잠금 해제");
      setUnlockPassword(""); return;
    }
    clearToast(); setIsUnlocking(true);
    const password = unlockPassword; setUnlockPassword("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editPassword: password }),
      });
      if (response.status === 204) {
        const current = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { credentials: "same-origin" });
        const body: unknown = await current.json().catch(() => null);
        if (current.ok && permissionFrom(body) === "edit") {
          setUnlockOpen(false); setPermission("edit"); setPermissionCheckState("complete"); notify("success", "편집 모드가 활성화되었습니다.", "편집 잠금 해제");
        } else {
          setPermission("readonly"); setPermissionCheckState("complete"); notify("error", "편집 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", "편집 잠금 해제", body);
        }
      } else {
        setPermission("readonly"); setPermissionCheckState("complete");
        const body: unknown = await response.json().catch(() => null);
        notify("error", response.status === 401 ? "편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요."
          : safeErrorCode(body) === "RATE_LIMITED" ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "편집 모드를 활성화할 수 없습니다. 잠시 후 다시 시도해 주세요.", "편집 잠금 해제", body);
      }
    } catch {
      setPermission("readonly"); setPermissionCheckState("complete"); notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "편집 잠금 해제");
    } finally { setUnlockPassword(""); setIsUnlocking(false); }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || isSavingMetadata) return;
    if (!metadataName.trim()) { notify("error", "프로젝트 이름을 입력해 주세요.", "프로젝트 정보 저장"); return; }
    setIsSavingMetadata(true); clearToast();
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(state.snapshot.data.project.revision) },
        body: JSON.stringify({ name: metadataName, description: metadataDescription }),
      });
      const body: unknown = await response.json().catch(() => null);
      const snapshot = snapshotFromMetadataMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        setSettingsOpen(false); notify("success", "프로젝트 정보를 저장했습니다.", "프로젝트 정보 저장");
      } else if (response.status === 401) {
        setPermission("readonly"); setSettingsOpen(false); notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "프로젝트 정보 저장", body);
      } else if (response.status === 412) conflict("프로젝트 정보 저장", body);
      else notify("error", "프로젝트 정보를 저장할 수 없습니다. 입력을 확인한 뒤 다시 시도해 주세요.", "프로젝트 정보 저장", body);
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "프로젝트 정보 저장"); }
    finally { setIsSavingMetadata(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || isChangingPassword) return;
    if (!passwordValid(newPassword)) {
      notify("error", "새 편집 비밀번호는 최소 12자이며 UTF-8 기준 최대 1,024 bytes 이하여야 합니다.", "편집 비밀번호 변경"); setNewPassword(""); return;
    }
    setIsChangingPassword(true); clearToast();
    const password = newPassword; setNewPassword("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-password`, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(state.snapshot.data.project.revision) },
        body: JSON.stringify({ newEditPassword: password }),
      });
      if (response.status === 204) {
        notify("success", "편집 비밀번호를 변경했습니다.", "편집 비밀번호 변경"); beginRefresh(false);
      } else {
        const body: unknown = await response.json().catch(() => null);
        if (response.status === 401) {
          setPermission("readonly"); setSettingsOpen(false); notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "편집 비밀번호 변경", body);
        } else if (response.status === 412) conflict("편집 비밀번호 변경", body);
        else notify("error", "편집 비밀번호를 변경할 수 없습니다. 입력을 확인한 뒤 다시 시도해 주세요.", "편집 비밀번호 변경", body);
      }
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "편집 비밀번호 변경"); }
    finally { setNewPassword(""); setIsChangingPassword(false); }
  }
  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true); clearToast();
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { method: "DELETE", credentials: "same-origin" });
      if (response.status === 204) {
        setPermission("readonly"); setSettingsOpen(false); notify("success", "편집 모드를 종료했습니다.", "편집 모드 종료");
      } else {
        const body: unknown = await response.json().catch(() => null); notify("error", "편집 모드를 종료할 수 없습니다. 잠시 후 다시 시도해 주세요.", "편집 모드 종료", body);
      }
    } catch { notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "편집 모드 종료"); }
    finally { setIsLoggingOut(false); }
  }

  async function handleTaskFailure(status: number | undefined, error: unknown, fallback: string, operation: string): Promise<string> {
    if (status === 401) { setPermission("readonly"); setPermissionCheckState("complete"); }
    const recovered = await reloadCanonicalSnapshot();
    // A successful canonical fetch is synchronized into the existing SVAR instance.
    // Remount only when the fetch itself failed and the last confirmed React snapshot
    // must be used to discard an unconfirmed local drag/resize.
    if (!recovered) setGanttResetGeneration((generation) => generation + 1);
    const code = safeErrorCode(error);
    let message = fallback;
    if (status === 401) message = "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.";
    else if (status === 412) message = recovered
      ? "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 불러왔습니다. 내용을 확인한 뒤 다시 저장해 주세요."
      : "다른 편집 내용이 먼저 저장되었지만 최신 정보를 불러오지 못했습니다. 마지막 확인 일정으로 복구했습니다. 다시 조회해 주세요.";
    else if (status === 400 || status === 409 || status === 422) message = code === "END_DURATION_MISMATCH"
      ? "일정 기간을 확인해 주세요."
      : code === "EMPTY_SUMMARY_NOT_ALLOWED" ? "선택 범위를 삭제하면 상위 요약 작업이 비게 됩니다. 상위 작업 구조를 먼저 변경해 주세요."
        : code === "SUMMARY_DELETE_UNSUPPORTED" ? "하위 작업이 있는 작업은 우클릭 메뉴에서 하위 작업 포함 삭제를 확인해 주세요."
          : code === "PARENT_CONVERSION_REQUIRED" ? "부모 작업 전환을 처리하지 못했습니다. 최신 정보를 확인한 뒤 다시 추가해 주세요."
            : code === "INVALID_PARENT_TASK" ? "마일스톤에는 하위 작업을 추가할 수 없습니다."
              : "작업 정보를 저장할 수 없습니다. 입력과 일정 제약을 확인해 주세요.";
    notify("error", message, operation, error);
    if (!recovered && status !== 412) notify("error", "최신 일정 조회에 실패하여 마지막으로 확인한 일정으로 복구했습니다. 다시 조회해 주세요.", "일정 복구");
    return message;
  }
  async function saveTask(method: "POST" | "PATCH" | "DELETE", taskId: string | null, payload?: unknown, expectedRevision?: number, includeDescendants = false): Promise<TaskEditorSaveResult> {
    if (state.status !== "ready" || taskMutationReference.current) return { status: "failed", message: "다른 작업을 저장 중입니다. 완료 후 다시 시도해 주세요." };
    if (expectedRevision !== undefined && expectedRevision !== state.snapshot.data.project.revision) {
      return { status: "failed", conflict: true, message: "기준 Revision이 변경되었습니다. 최신 정보를 다시 불러온 뒤 검토해 주세요." };
    }
    taskMutationReference.current = true; setIsSavingTask(true); clearToast();
    const operation = method === "POST" ? "작업 추가" : method === "DELETE" ? "작업 삭제" : "작업 저장";
    try {
      const baseEndpoint = taskId === null ? `/api/projects/${encodeURIComponent(publicId)}/tasks` : `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}`;
      const endpoint = method === "DELETE" && includeDescendants ? `${baseEndpoint}?includeDescendants=true` : baseEndpoint;
      const response = await fetch(endpoint, {
        method, credentials: "same-origin",
        headers: { ...(method === "DELETE" ? {} : { "Content-Type": "application/json" }), "If-Match": revisionTag(expectedRevision ?? state.snapshot.data.project.revision) },
        ...(method === "DELETE" ? {} : { body: JSON.stringify(payload) }),
      });
      const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
      const snapshot = snapshotFromTaskMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        const success = method === "POST" ? "작업을 추가했습니다." : method === "DELETE" ? "작업을 삭제했습니다." : "작업을 저장했습니다.";
        const shifted = (body as TaskMutationResponse).data.warnings.some((warning) => warning.code === "NON_WORKING_START_SHIFTED");
        notify("success", shifted ? `${success} 비근무일 시작은 다음 근무일로 조정되었습니다.` : success, operation);
        return { status: "saved" };
      }
      const message = await handleTaskFailure(response.status, body, "작업을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.", operation);
      return { status: "failed", message, conflict: response.status === 412 };
    } catch {
      const message = await handleTaskFailure(undefined, null, "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", operation);
      return { status: "failed", message };
    } finally { taskMutationReference.current = false; setIsSavingTask(false); }
  }

  async function saveTaskHierarchyCommand(command: TaskHierarchyCommandRequest): Promise<void> {
    if (state.status !== "ready" || taskMutationReference.current) return;
    taskMutationReference.current = true; setIsSavingTask(true); clearToast();
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/task-commands`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": revisionTag(state.snapshot.data.project.revision),
        },
        body: JSON.stringify(command),
      });
      const body: unknown = await response.json().catch(() => null);
      const snapshot = snapshotFromTaskMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        notify("success", "작업 구조를 변경했습니다.", "작업 메뉴");
        return;
      }
      await handleTaskFailure(response.status, body, "작업 구조를 변경할 수 없습니다.", "작업 메뉴");
    } catch {
      await handleTaskFailure(undefined, null, "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "작업 메뉴");
    } finally {
      taskMutationReference.current = false;
      setIsSavingTask(false);
    }
  }

  function openTaskEditor(taskId: string) {
    if (state.status !== "ready" || editorSession || settingsOpen || pendingTaskDelete) return;
    const task = state.snapshot.data.tasks.find((entry) => entry.taskId === taskId);
    if (!task) return;
    editorTriggerReference.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditorSession({ task: { ...task }, revision: state.snapshot.data.project.revision });
  }
  function closeTaskEditor() {
    const taskId = editorSession?.task.taskId;
    const trigger = editorTriggerReference.current;
    setEditorSession(null);
    requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>(".project-gantt-scroll");
      const target = trigger?.isConnected ? trigger : root && taskId ? findTaskContextElement(root, taskId) ?? root : root;
      target?.focus({ preventScroll: true });
    });
  }
  async function saveEditorTask(command: ProjectTaskUpdateCommand, revision: number): Promise<TaskEditorSaveResult> {
    if (state.status !== "ready") return { status: "failed", message: "프로젝트 정보를 확인할 수 없습니다." };
    const task = state.snapshot.data.tasks.find((entry) => entry.taskId === command.taskId);
    const restriction = taskEditorReadOnlyReason(task, permission === "edit" && permissionCheckState === "complete", state.snapshot.data.links.length > 0);
    if (restriction) return { status: "failed", message: restriction };
    if (isSavingMetadata || isChangingPassword || isLoggingOut) return { status: "failed", message: "프로젝트 변경을 완료한 뒤 다시 시도해 주세요." };
    return saveTask("PATCH", command.taskId, command.payload, revision);
  }
  async function reloadEditorTask(taskId: string): Promise<TaskEditorSession | null> {
    const snapshot = await fetchCanonicalSnapshot();
    const task = snapshot?.data.tasks.find((entry) => entry.taskId === taskId);
    return task && snapshot ? { task: { ...task }, revision: snapshot.data.project.revision } : null;
  }
  function createNativeTask(command: ProjectTaskCreateCommand) {
    if (state.status !== "ready" || taskMutationReference.current || pendingTaskDelete) return;
    const parent = command.parentTaskId ? state.snapshot.data.tasks.find((task) => task.taskId === command.parentTaskId) : undefined;
    if (command.parentTaskId && !parent) { notify("error", "선택한 작업을 찾을 수 없습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.", "하위 작업 추가"); return; }
    if (parent?.type === "milestone") { notify("error", "마일스톤에는 하위 작업을 추가할 수 없습니다.", "하위 작업 추가"); return; }
    const convert = parent?.type === "task" && !state.snapshot.data.tasks.some((task) => task.parentExternalId === parent.externalId);
    void saveTask("POST", null, { ...command, name: "새 작업", start: todayLocalDateString(), duration: 1,
      ...(convert ? { convertParentToSummary: true } : {}) });
  }
  function requestTaskDelete(taskId: string, trigger: HTMLElement | null) {
    if (state.status !== "ready" || permission !== "edit" || permissionCheckState !== "complete" || taskMutationReference.current || editorSession || settingsOpen || state.snapshot.data.links.length > 0) return;
    const plan = createTaskDeletePlan(state.snapshot.data.tasks, taskId);
    if (!plan) { notify("error", "삭제할 작업을 찾을 수 없습니다. 최신 정보를 다시 확인해 주세요.", "작업 삭제"); return; }
    deleteTriggerReference.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (plan.descendantTaskIds.length === 0) {
      void saveTask("DELETE", taskId);
      return;
    }
    setPendingTaskDelete({ ...plan, revision: state.snapshot.data.project.revision });
  }
  async function confirmTaskDelete() {
    const pending = pendingTaskDelete;
    if (!pending) return;
    const result = await saveTask("DELETE", pending.taskId, undefined, pending.revision, true);
    if (result.status === "saved" || result.conflict) setPendingTaskDelete(null);
  }
  function rejectNativeTaskAdd() { notify("info", "이 화면에서는 하위 작업만 추가할 수 있습니다.", "작업 추가"); }
  const recoverCanonicalGantt = useCallback(() => {
    setGanttResetGeneration((generation) => generation + 1);
    notify("error", "일정 화면을 최신 서버 정보로 복구했습니다.", "일정 화면 복구");
  }, [notify]);
  function saveTaskCommand(command: ProjectTaskUpdateCommand) {
    if (Object.keys(command.payload).length > 0) void saveTask("PATCH", command.taskId, command.payload);
  }

  function activateWorkspaceView(view: "schedule" | "resources") {
    setActiveView(view);
    requestAnimationFrame(() => {
      (view === "schedule" ? scheduleTabReference.current : resourceTabReference.current)?.focus({ preventScroll: true });
    });
  }
  function handleWorkspaceTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, current: "schedule" | "resources") {
    let next: "schedule" | "resources" | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = current === "schedule" ? "resources" : "schedule";
    else if (event.key === "Home") next = "schedule";
    else if (event.key === "End") next = "resources";
    if (!next) return;
    event.preventDefault();
    activateWorkspaceView(next);
  }

  if (state.status === "loading") return <section className="loading-state" aria-busy="true" aria-live="polite"><span className="loading-indicator" aria-hidden="true" /><p>프로젝트 정보를 불러오는 중입니다.</p></section>;
  if (state.status === "not-found") return <section className="status-page" aria-labelledby="project-not-found-heading"><p className="eyebrow">404</p><h1 id="project-not-found-heading">프로젝트를 찾을 수 없습니다.</h1><p>프로젝트 주소를 확인해 주세요.</p></section>;
  if (state.status === "error") return <section className="status-page" aria-labelledby="project-load-error-heading"><p className="eyebrow">PROJECT</p><h1 id="project-load-error-heading">프로젝트를 불러올 수 없습니다.</h1><p>네트워크 또는 서버 상태를 확인한 뒤 다시 시도해 주세요.</p><button className="secondary-button" onClick={() => beginRefresh(true)} type="button">다시 시도</button></section>;
  const { project, tasks, links } = state.snapshot.data;
  const editing = permission === "edit" && permissionCheckState === "complete";
  const busy = isSavingMetadata || isChangingPassword || isLoggingOut || isSavingTask;
  const taskEditingSupported = links.length === 0;
  return <section className="project-readonly" aria-labelledby="project-heading">
    <header className="project-context-bar">
      <div className="project-context-identity">
        <div className="project-title-row">
          <h1 id="project-heading">{project.name}</h1>
          <span className={editing ? "edit-badge" : "readonly-badge"}>{editing ? "편집 중" : "읽기 전용"}</span>
          <details className="project-info-popover">
            <summary aria-label="프로젝트 정보 보기">정보</summary>
            <div className="project-info-panel">
              <dl>
                <div><dt>설명</dt><dd>{project.description || "설명이 없습니다."}</dd></div>
                <div><dt>소유자</dt><dd>{ownerName}</dd></div>
                <div><dt>Revision</dt><dd>{project.revision}</dd></div>
              </dl>
            </div>
          </details>
        </div>
      </div>
      <div className="project-context-actions">
        <ProjectLinkButton projectName={project.name} projectUrl={projectUrl} />
        <ProjectExcelExportButton publicId={publicId} />
        {editing ? <button
          type="button"
          className="secondary-button"
          disabled={busy || editorSession !== null || pendingTaskDelete !== null}
          onClick={() => setSettingsOpen(true)}
        >프로젝트 설정</button> : <button
          ref={unlockTriggerReference}
          type="button"
          className="secondary-button"
          disabled={isUnlocking || permissionCheckState === "checking"}
          onClick={() => setUnlockOpen(true)}
        >{permissionCheckState === "checking" ? "권한 확인 중…" : "편집 잠금 해제"}</button>}
        <details className="project-action-menu" ref={actionMenuReference} open={actionMenuOpen} onToggle={(event) => setActionMenuOpen(event.currentTarget.open)}>
          <summary aria-label="프로젝트 작업 더보기">더보기</summary>
          <div className="project-action-menu-panel">
            <ProjectCopyEntry publicId={publicId} busy={busy || editorSession !== null || pendingTaskDelete !== null} onAutoOpen={() => setActionMenuOpen(true)} />
          </div>
        </details>
      </div>
    </header>

    <div className="project-workspace-tabs" role="tablist" aria-label="프로젝트 작업공간">
      <button
        ref={scheduleTabReference}
        id="project-tab-schedule"
        role="tab"
        type="button"
        aria-controls="project-panel-schedule"
        aria-selected={activeView === "schedule"}
        tabIndex={activeView === "schedule" ? 0 : -1}
        onClick={() => setActiveView("schedule")}
        onKeyDown={(event) => handleWorkspaceTabKeyDown(event, "schedule")}
      >일정</button>
      <button
        ref={resourceTabReference}
        id="project-tab-resources"
        role="tab"
        type="button"
        aria-controls="project-panel-resources"
        aria-selected={activeView === "resources"}
        tabIndex={activeView === "resources" ? 0 : -1}
        onClick={() => setActiveView("resources")}
        onKeyDown={(event) => handleWorkspaceTabKeyDown(event, "resources")}
      >리소스</button>
    </div>

    <div className="project-workspace-panels">
      <section
        id="project-panel-schedule"
        role="tabpanel"
        aria-labelledby="project-tab-schedule"
        hidden={activeView !== "schedule"}
        aria-busy={isSavingTask || undefined}
        className="project-schedule project-workspace-panel"
      >
        <div className="schedule-heading-row"><div><h2 id="schedule-heading">일정</h2><p>{tasks.length === 0 ? "아직 등록된 작업이 없습니다." : "서버의 최신 일정 snapshot을 표시합니다."}</p></div>
          {isSavingTask ? <span className="schedule-saving" role="status">일정 저장 중…</span> : null}</div>
        {editing && !taskEditingSupported ? <p className="schedule-scope-note">연결이 있는 일정 편집은 다음 단계에서 지원합니다. 현재 일정은 읽기 전용으로 표시됩니다.</p> : null}
        <ProjectGantt key={ganttResetGeneration} calendar={project.calendar} editable={editing && taskEditingSupported} mutationLocked={busy || editorSession !== null || pendingTaskDelete !== null}
          onCanonicalSyncFailure={recoverCanonicalGantt} links={links} onTaskAddRejected={rejectNativeTaskAdd} onTaskCreate={createNativeTask} onTaskCommand={saveTaskCommand}
          onTaskHierarchyCommand={(command) => void saveTaskHierarchyCommand(command)} projectRevision={project.revision}
          onTaskEditorOpen={openTaskEditor} onTaskDeleteRequest={requestTaskDelete} columnVisibility={columnVisibility} onColumnVisibilityChange={(columnId) => setColumnVisibility((current) => {
            const visibleColumnCount = Object.values(current).filter(Boolean).length;
            if (current[columnId] && visibleColumnCount === 1) return current;
            return { ...current, [columnId]: !current[columnId] };
          })} tasks={tasks} />
        {editorSession ? <ProjectTaskEditor key={editorSession.task.taskId} session={editorSession}
          latestTask={tasks.find((task) => task.taskId === editorSession.task.taskId)} tasks={tasks} links={links} revision={project.revision}
          editable={editing} hasLinks={links.length > 0} busy={busy} onSave={saveEditorTask} onReload={reloadEditorTask} onClose={closeTaskEditor} /> : null}
      </section>
      <section
        id="project-panel-resources"
        role="tabpanel"
        aria-labelledby="project-tab-resources"
        hidden={activeView !== "resources"}
        className="project-workspace-panel project-resource-panel"
      >
        <ProjectResourceWorkload publicId={publicId} />
      </section>
    </div>

    {unlockOpen && !editing ? <WorkspaceDialog
      title="편집 활성화"
      restoreFocusRef={unlockTriggerReference}
      busy={isUnlocking}
      onClose={() => { if (!isUnlocking) { setUnlockOpen(false); setUnlockPassword(""); } }}
    >
      <form className="project-form compact-form" noValidate onSubmit={unlock}>
        <p>편집 비밀번호를 확인한 뒤 현재 브라우저 세션에서 편집 모드를 활성화합니다.</p>
        <div className="form-field"><label htmlFor="unlock-edit-password">편집 비밀번호</label>
          <input autoFocus autoComplete="current-password" disabled={isUnlocking || permissionCheckState === "checking"} id="unlock-edit-password" onChange={(event) => setUnlockPassword(event.target.value)} type="password" value={unlockPassword} /></div>
        <button className="primary-button" disabled={isUnlocking || permissionCheckState === "checking"} type="submit">{isUnlocking ? "확인 중…" : "편집 활성화"}</button>
      </form>
    </WorkspaceDialog> : null}
    {pendingTaskDelete ? <WorkspaceDialog title="작업 삭제" restoreFocusRef={deleteTriggerReference} busy={isSavingTask}
      onClose={() => { if (!isSavingTask) setPendingTaskDelete(null); }}>
      <div className="project-form compact-form">
        <p><strong>{pendingTaskDelete.taskName}</strong> 작업과 하위 작업 {pendingTaskDelete.descendantTaskIds.length}개, 총 {pendingTaskDelete.descendantTaskIds.length + 1}개 작업을 삭제하시겠습니까?</p>
        <p>접힌 하위 작업을 포함하여 모든 하위 작업이 함께 삭제됩니다. 삭제 후에는 이 화면에서 되돌릴 수 없습니다.</p>
        <div className={feedbackStyles.headingActions}>
          <button autoFocus className="secondary-button" disabled={isSavingTask} onClick={() => setPendingTaskDelete(null)} type="button">취소</button>
          <button className="danger-button" disabled={isSavingTask} onClick={() => void confirmTaskDelete()} type="button">{isSavingTask ? "삭제 중…" : "하위 작업 포함 삭제"}</button>
        </div>
      </div>
    </WorkspaceDialog> : null}
    {settingsOpen && editing ? <WorkspaceDialog title="프로젝트 설정" onClose={() => { if (!busy) { setSettingsOpen(false); setNewPassword(""); } }} busy={busy}>
      <ProjectWorkCalendarEditor publicId={publicId} revision={project.revision} disabled={busy}
        onSaved={reloadCanonicalSnapshot}
        onUnauthorized={() => { setPermission("readonly"); setSettingsOpen(false); notify("error", "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.", "작업 캘린더 저장"); }}
        onConflict={(body) => conflict("작업 캘린더 저장", body)} notify={notify} />
      <form className="project-form compact-form" noValidate onSubmit={saveMetadata}>
        <div className="form-field"><label htmlFor="metadata-name">프로젝트 이름</label><input disabled={busy} id="metadata-name" onChange={(event) => setMetadataName(event.target.value)} value={metadataName} /></div>
        <div className="form-field"><label htmlFor="metadata-description">설명</label><textarea disabled={busy} id="metadata-description" onChange={(event) => setMetadataDescription(event.target.value)} rows={3} value={metadataDescription} /></div>
        <button className="primary-button" disabled={busy} type="submit">{isSavingMetadata ? "저장 중…" : "프로젝트 정보 저장"}</button>
      </form>
      <form className="project-form compact-form" noValidate onSubmit={changePassword}>
        <div className="form-field"><label htmlFor="new-edit-password">새 편집 비밀번호</label><input autoComplete="new-password" disabled={busy} id="new-edit-password" onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} /><p>최소 12자, UTF-8 기준 최대 1,024 bytes입니다.</p></div>
        <button className="secondary-button" disabled={busy} type="submit">{isChangingPassword ? "변경 중…" : "편집 비밀번호 변경"}</button>
      </form>
      <button className="secondary-button logout-button" disabled={busy} onClick={() => void logout()} type="button">{isLoggingOut ? "종료 중…" : "편집 모드 종료"}</button>
    </WorkspaceDialog> : null}
  </section>;
}
