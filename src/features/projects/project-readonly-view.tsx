"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type {
  ProjectMetadataMutationResponse,
  ProjectSnapshotResponse,
  TaskMutationResponse,
} from "@/contracts/projects";
import type {
  ProjectGridColumnVisibility,
} from "@/features/gantt/project-gantt";
import type {
  ProjectTaskCreateCommand,
  ProjectTaskUpdateCommand,
} from "@/features/gantt/project-task-adapter";
import { ProjectTaskEditor } from "@/features/gantt/project-task-editor";
import { taskEditorReadOnlyReason, type TaskEditorSaveResult, type TaskEditorSession } from "@/features/gantt/task-editor-model";
import { findTaskContextElement } from "@/features/gantt/task-context-target";
import { todayLocalDateString } from "@/lib/date-display";

const ProjectGantt = dynamic(
  () => import("@/features/gantt/project-gantt").then((module) => module.ProjectGantt),
  { ssr: false, loading: () => <div className="gantt-loading" role="status">일정을 불러오는 중입니다.</div> },
);

type LoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: ProjectSnapshotResponse }
  | { status: "not-found" }
  | { status: "error" };
type Permission = "readonly" | "edit";
type PermissionCheckState = "checking" | "complete";

const PASSWORD_MINIMUM_LENGTH = 12;
const PASSWORD_MAXIMUM_BYTES = 1024;
const INITIAL_COLUMN_VISIBILITY: ProjectGridColumnVisibility = {
  text: true,
  externalId: false,
  projectStart: true,
  projectDuration: true,
};

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
  if (
    typeof value === "object" && value !== null && "data" in value &&
    typeof value.data === "object" && value.data !== null &&
    "permission" in value.data && value.data.permission === "edit" &&
    "expiresAt" in value.data && typeof value.data.expiresAt === "string" &&
    value.data.expiresAt.length > 0 && !Number.isNaN(Date.parse(value.data.expiresAt))
  ) {
    return "edit";
  }
  return "readonly";
}

function safeErrorCode(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "code" in value.error && typeof value.error.code === "string") return value.error.code;
  return null;
}

function passwordValid(value: string): boolean {
  return Array.from(value).length >= PASSWORD_MINIMUM_LENGTH && new TextEncoder().encode(value).byteLength <= PASSWORD_MAXIMUM_BYTES;
}

function revisionTag(revision: number): string { return `"${revision}"`; }

function snapshotFromMetadataMutation(
  value: unknown,
): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as Partial<ProjectMetadataMutationResponse>;
  const data = response.data;
  if (
    !data || typeof data !== "object" || !data.project ||
    typeof data.project !== "object" || !Array.isArray(data.tasks) ||
    !Array.isArray(data.links) || !Array.isArray(data.warnings) ||
    !data.operation || data.operation.kind !== "projectMetadata" ||
    !Array.isArray(data.operation.changedFields)
  ) {
    return null;
  }
  return {
    data: {
      project: data.project,
      tasks: data.tasks,
      links: data.links,
      permission: "readonly",
    },
  };
}

function snapshotFromTaskMutation(value: unknown): ProjectSnapshotResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as Partial<TaskMutationResponse>;
  const data = response.data;
  if (
    !data || typeof data !== "object" || !data.project || typeof data.project !== "object" ||
    !Array.isArray(data.tasks) || !Array.isArray(data.links) || !Array.isArray(data.warnings) ||
    !data.operation || !["taskCreate", "taskUpdate", "taskDelete"].includes(data.operation.kind) ||
    !Array.isArray(data.operation.changedTaskExternalIds) || !Array.isArray(data.operation.deletedTaskExternalIds) ||
    !Array.isArray(data.operation.deletedLinkIds)
  ) return null;
  return { data: { project: data.project, tasks: data.tasks, links: data.links, permission: "readonly" } };
}

export function ProjectReadonlyView({ publicId }: Readonly<{ publicId: string }>) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [permission, setPermission] = useState<Permission>("readonly");
  const [permissionCheckState, setPermissionCheckState] =
    useState<PermissionCheckState>("checking");
  const [retryKey, setRetryKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [ganttResetGeneration, setGanttResetGeneration] = useState(0);
  const [metadataName, setMetadataName] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [pendingChildTask, setPendingChildTask] = useState<ProjectTaskCreateCommand | null>(null);
  const [parentConversionConfirmed, setParentConversionConfirmed] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<ProjectGridColumnVisibility>(INITIAL_COLUMN_VISIBILITY);
  const nativeTaskDialogReference = useRef<HTMLDialogElement>(null);
  const nativeTaskTriggerReference = useRef<HTMLElement | null>(null);
  const taskMutationReference = useRef(false);
  const [editorSession, setEditorSession] = useState<TaskEditorSession | null>(null);
  const editorTriggerReference = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = nativeTaskDialogReference.current;
    if (!dialog || !pendingChildTask || dialog.open) return;
    dialog.showModal();
  }, [pendingChildTask]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(publicId)}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isSnapshot(body)) {
          setState({ status: "error" });
          return;
        }
        setMetadataName(body.data.project.name);
        setMetadataDescription(body.data.project.description);
        setState({ status: "ready", snapshot: body });
        // A direct snapshot is deliberately always readonly. Only this endpoint
        // enables edit controls; any error continues to mean readonly.
        try {
          const current = await fetch(
            `/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`,
            { credentials: "same-origin", signal: controller.signal },
          );
          const currentBody: unknown = await current.json().catch(() => null);
          if (!controller.signal.aborted) {
            setPermission(current.ok ? permissionFrom(currentBody) : "readonly");
            setPermissionCheckState("complete");
          }
        } catch {
          if (!controller.signal.aborted) {
            setPermission("readonly");
            setPermissionCheckState("complete");
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    })();
    return () => controller.abort();
  }, [publicId, retryKey]);

  function beginRefresh(clearNotice: boolean) {
    if (clearNotice) setNotice(null);
    setPermission("readonly");
    setPermissionCheckState("checking");
    setState({ status: "loading" });
    setRetryKey((key) => key + 1);
  }

  function retry() {
    beginRefresh(true);
  }

  function refreshKeepingNotice() {
    beginRefresh(false);
  }
  function applySnapshot(value: unknown): boolean {
    if (!isSnapshot(value)) return false;
    setState({ status: "ready", snapshot: value });
    setMetadataName(value.data.project.name);
    setMetadataDescription(value.data.project.description);
    return true;
  }
  async function fetchCanonicalSnapshot(): Promise<ProjectSnapshotResponse | null> {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
        credentials: "same-origin",
      });
      const body: unknown = await response.json().catch(() => null);
      return response.ok && isSnapshot(body) && applySnapshot(body) ? body : null;
    } catch {
      return null;
    }
  }
  async function reloadCanonicalSnapshot(): Promise<boolean> {
    return (await fetchCanonicalSnapshot()) !== null;
  }
  function conflict() {
    setPermission("readonly");
    setNotice(
      "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 불러왔습니다. 내용을 확인한 뒤 다시 저장해 주세요.",
    );
    refreshKeepingNotice();
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking) return;
    if (!passwordValid(unlockPassword)) {
      setNotice("편집 비밀번호는 최소 12자이며 UTF-8 기준 1,024 bytes 이하여야 합니다.");
      setUnlockPassword("");
      return;
    }
    setNotice(null);
    setIsUnlocking(true);
    const password = unlockPassword;
    setUnlockPassword("");
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(publicId)}/edit-sessions`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editPassword: password }),
        },
      );
      if (response.status === 204) {
        const current = await fetch(
          `/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`,
          { credentials: "same-origin" },
        );
        const body: unknown = await current.json().catch(() => null);
        if (current.ok && permissionFrom(body) === "edit") {
          setPermission("edit");
          setPermissionCheckState("complete");
          setNotice("편집 모드가 활성화되었습니다.");
        } else {
          setPermission("readonly");
          setPermissionCheckState("complete");
          setNotice("편집 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        }
      } else if (response.status === 401) {
        setPermission("readonly");
        setPermissionCheckState("complete");
        setNotice("편집 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.");
      } else {
        setPermission("readonly");
        setPermissionCheckState("complete");
        const error = await response.json().catch(() => null);
        setNotice(safeErrorCode(error) === "RATE_LIMITED" ? "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." : "편집 모드를 활성화할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setPermission("readonly");
      setPermissionCheckState("complete");
      setNotice("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setUnlockPassword("");
      setIsUnlocking(false);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || isSavingMetadata) return;
    if (!metadataName.trim()) { setNotice("프로젝트 이름을 입력해 주세요."); return; }
    setIsSavingMetadata(true); setNotice(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(state.snapshot.data.project.revision) }, body: JSON.stringify({ name: metadataName, description: metadataDescription }) });
      const body: unknown = await response.json().catch(() => null);
      const snapshot = snapshotFromMetadataMutation(body);
      if (response.ok && snapshot && applySnapshot(snapshot)) {
        setNotice("프로젝트 정보를 저장했습니다.");
      }
      else if (response.status === 401) { setPermission("readonly"); setNotice("편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요."); }
      else if (response.status === 412) conflict();
      else setNotice("프로젝트 정보를 저장할 수 없습니다. 입력을 확인한 뒤 다시 시도해 주세요.");
    } catch { setNotice("네트워크 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { setIsSavingMetadata(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || isChangingPassword) return;
    if (!passwordValid(newPassword)) { setNotice("새 편집 비밀번호는 최소 12자이며 UTF-8 기준 1,024 bytes 이하여야 합니다."); setNewPassword(""); return; }
    setIsChangingPassword(true); setNotice(null);
    const password = newPassword; setNewPassword("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-password`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": revisionTag(state.snapshot.data.project.revision) }, body: JSON.stringify({ newEditPassword: password }) });
      if (response.status === 204) { setNotice("편집 비밀번호를 변경했습니다."); refreshKeepingNotice(); }
      else if (response.status === 401) { setPermission("readonly"); setNotice("편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요."); }
      else if (response.status === 412) conflict();
      else setNotice("편집 비밀번호를 변경할 수 없습니다. 입력을 확인한 뒤 다시 시도해 주세요.");
    } catch { setNotice("네트워크 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { setNewPassword(""); setIsChangingPassword(false); }
  }

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true); setNotice(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, { method: "DELETE", credentials: "same-origin" });
      if (response.status === 204) { setPermission("readonly"); setNotice("편집 모드를 종료했습니다."); }
      else setNotice("편집 모드를 종료할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } catch { setNotice("네트워크 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { setIsLoggingOut(false); }
  }

  async function handleTaskFailure(status: number | undefined, error: unknown, fallback: string): Promise<string> {
    if (status === 401) {
      setPermission("readonly");
      setPermissionCheckState("complete");
      await reloadCanonicalSnapshot();
      setGanttResetGeneration((generation) => generation + 1);
      const message = "편집 권한이 만료되었습니다. 다시 잠금을 해제해 주세요.";
      setNotice(message);
      return message;
    }
    const code = safeErrorCode(error);
    await reloadCanonicalSnapshot();
    // Preserve the existing failed-pointer recovery; the editor is outside this key.
    setGanttResetGeneration((generation) => generation + 1);
    let message = fallback;
    if (status === 412) {
      message = "다른 편집 내용이 먼저 저장되었습니다. 최신 정보를 불러왔습니다. 내용을 확인한 뒤 다시 저장해 주세요.";
    } else if (status === 400 || status === 409 || status === 422) {
      message = code === "END_DURATION_MISMATCH"
        ? "일정 기간을 확인해 주세요."
        : code === "EMPTY_SUMMARY_NOT_ALLOWED"
          ? "요약 작업의 마지막 하위 작업은 삭제할 수 없습니다. 먼저 요약 작업 구조를 변경해 주세요."
          : code === "PARENT_CONVERSION_REQUIRED"
            ? "첫 하위 작업을 추가하려면 부모 작업을 요약 작업으로 전환하는 데 동의해야 합니다."
            : code === "INVALID_PARENT_TASK"
              ? "마일스톤에는 하위 작업을 추가할 수 없습니다."
              : "작업 정보를 저장할 수 없습니다. 입력과 일정 제약을 확인해 주세요.";
    }
    setNotice(message);
    return message;
  }

  async function saveTask(method: "POST" | "PATCH" | "DELETE", taskId: string | null, payload?: unknown, expectedRevision?: number): Promise<TaskEditorSaveResult> {
    if (state.status !== "ready" || taskMutationReference.current) return { status: "failed", message: "다른 작업을 저장 중입니다. 완료 후 다시 시도해 주세요." };
    if (expectedRevision !== undefined && expectedRevision !== state.snapshot.data.project.revision) {
      return { status: "failed", conflict: true, message: "기준 Revision이 변경되었습니다. 최신 정보를 다시 불러온 뒤 검토해 주세요." };
    }
    taskMutationReference.current = true;
    setIsSavingTask(true);
    setNotice(null);
    let response: Response | undefined;
    try {
      const endpoint = taskId === null
        ? `/api/projects/${encodeURIComponent(publicId)}/tasks`
        : `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}`;
      response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: {
          ...(method === "DELETE" ? {} : { "Content-Type": "application/json" }),
          "If-Match": revisionTag(expectedRevision ?? state.snapshot.data.project.revision),
        },
        ...(method === "DELETE" ? {} : { body: JSON.stringify(payload) }),
      });
      const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
      const canonicalSnapshot = snapshotFromTaskMutation(body);
      if (response.ok && canonicalSnapshot !== null && applySnapshot(canonicalSnapshot)) {
        const successNotice = method === "POST"
          ? "작업을 추가했습니다."
          : method === "DELETE" ? "작업을 삭제했습니다." : "작업을 저장했습니다.";
        const shifted = (body as TaskMutationResponse).data.warnings.some(
          (warning) => warning.code === "NON_WORKING_START_SHIFTED",
        );
        setNotice(shifted
          ? `${successNotice} 비근무일 시작은 다음 근무일로 조정되었습니다.`
          : successNotice);
        return { status: "saved" };
      }
      const message = await handleTaskFailure(response.status, body, "작업을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      return { status: "failed", message, conflict: response.status === 412 };
    } catch {
      const message = await handleTaskFailure(undefined, null, "네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      return { status: "failed", message };
    } finally {
      taskMutationReference.current = false;
      setIsSavingTask(false);
    }
  }

  function openTaskEditor(taskId: string) {
    // A modal editor owns its draft until explicit save/discard; never switch it silently.
    if (state.status !== "ready" || editorSession || pendingChildTask) return;
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
    if (state.status !== "ready" || taskMutationReference.current) return;
    const activeElement = document.activeElement;
    nativeTaskTriggerReference.current = activeElement instanceof HTMLElement ? activeElement : null;
    if (!command.parentTaskId) {
      void saveTask("POST", null, {
        ...command,
        name: "새 작업",
        start: todayLocalDateString(),
        duration: 1,
      });
      return;
    }

    const parent = state.snapshot.data.tasks.find((task) => task.taskId === command.parentTaskId);
    if (!parent) {
      setNotice("선택한 작업을 찾을 수 없습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.");
      return;
    }
    if (parent.type === "milestone") {
      setNotice("마일스톤에는 하위 작업을 추가할 수 없습니다.");
      return;
    }
    if (!nativeParentRequiresConversion(command)) {
      void saveTask("POST", null, {
        ...command,
        name: "새 작업",
        start: todayLocalDateString(),
        duration: 1,
      });
      return;
    }
    setParentConversionConfirmed(false);
    setPendingChildTask(command);
  }

  function nativeParentRequiresConversion(command: ProjectTaskCreateCommand): boolean {
    if (state.status !== "ready" || !command.parentTaskId) return false;
    const parent = state.snapshot.data.tasks.find((task) => task.taskId === command.parentTaskId);
    if (!parent || parent.type !== "task") return false;
    return !state.snapshot.data.tasks.some(
      (task) => task.parentExternalId === parent.externalId,
    );
  }

  function confirmNativeTaskAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingChildTask) return;
    if (nativeParentRequiresConversion(pendingChildTask) && !parentConversionConfirmed) return;
    const command = {
      ...pendingChildTask,
      name: "새 작업",
      start: todayLocalDateString(),
      duration: 1,
      ...(nativeParentRequiresConversion(pendingChildTask)
        ? { convertParentToSummary: true as const }
        : {}),
    };
    closeNativeTaskDialog();
    void saveTask("POST", null, command);
  }

  function closeNativeTaskDialog() {
    nativeTaskDialogReference.current?.close();
    setPendingChildTask(null);
    setParentConversionConfirmed(false);
    requestAnimationFrame(() => nativeTaskTriggerReference.current?.focus());
  }

  function rejectNativeTaskAdd() {
    setNotice("이 화면에서는 하위 작업만 추가할 수 있습니다.");
  }

  const recoverCanonicalGantt = useCallback(() => {
    setGanttResetGeneration((generation) => generation + 1);
    setNotice("일정 화면을 최신 서버 정보로 복구했습니다.");
  }, []);

  function saveTaskCommand(command: ProjectTaskUpdateCommand) {
    if (Object.keys(command.payload).length === 0) return;
    void saveTask("PATCH", command.taskId, command.payload);
  }

  if (state.status === "loading") {
    return <section className="loading-state" aria-busy="true" aria-live="polite"><span className="loading-indicator" aria-hidden="true" /><p>프로젝트 정보를 불러오는 중입니다.</p></section>;
  }
  if (state.status === "not-found") {
    return <section className="status-page" aria-labelledby="project-not-found-heading"><p className="eyebrow">404</p><h1 id="project-not-found-heading">프로젝트를 찾을 수 없습니다.</h1><p>프로젝트 주소를 확인해 주세요.</p></section>;
  }
  if (state.status === "error") {
    return <section className="status-page" aria-labelledby="project-load-error-heading"><p className="eyebrow">PROJECT</p><h1 id="project-load-error-heading">프로젝트를 불러올 수 없습니다.</h1><p>네트워크 또는 서버 상태를 확인한 뒤 다시 시도해 주세요.</p><button className="secondary-button" onClick={retry} type="button">다시 시도</button></section>;
  }

  const { project, tasks, links } = state.snapshot.data;
  const editing = permission === "edit" && permissionCheckState === "complete";
  const busy = isSavingMetadata || isChangingPassword || isLoggingOut || isSavingTask;
  const taskEditingSupported = links.length === 0;
  const taskEditing = editing && taskEditingSupported;
  return <section className="project-readonly" aria-labelledby="project-heading">
    <div className="project-readonly-heading">
      <div>
        <p className="eyebrow">PROJECT</p>
        <h1 id="project-heading">{project.name}</h1>
        <p className="page-description">{project.description || "설명이 없습니다."}</p>
      </div>
      <span className={editing ? "edit-badge" : "readonly-badge"}>
        {editing ? "편집 가능" : "읽기 전용"}
      </span>
    </div>
    {notice ? <div className="form-status" role="status">{notice}</div> : null}
    <dl className="project-facts">
      <div><dt>Revision</dt><dd>{project.revision}</dd></div>
      <div><dt>시간대</dt><dd>{project.calendar.timezone}</dd></div>
      <div><dt>휴일</dt><dd>{project.calendar.holidays.length}일</dd></div>
      <div><dt>작업</dt><dd>{tasks.length}개</dd></div>
      <div><dt>연결</dt><dd>{links.length}개</dd></div>
    </dl>
    {editing ? <details className="edit-panels">
      <summary>프로젝트 설정</summary>
      <form className="project-form compact-form" noValidate onSubmit={saveMetadata}>
        <div className="form-field">
          <label htmlFor="metadata-name">프로젝트 이름</label>
          <input disabled={busy} id="metadata-name" onChange={(event) => setMetadataName(event.target.value)} value={metadataName} />
        </div>
        <div className="form-field">
          <label htmlFor="metadata-description">설명</label>
          <textarea disabled={busy} id="metadata-description" onChange={(event) => setMetadataDescription(event.target.value)} rows={3} value={metadataDescription} />
        </div>
        <button className="primary-button" disabled={busy} type="submit">{isSavingMetadata ? "저장 중…" : "프로젝트 정보 저장"}</button>
      </form>
      <form className="project-form compact-form" noValidate onSubmit={changePassword}>
        <div className="form-field">
          <label htmlFor="new-edit-password">새 편집 비밀번호</label>
          <input autoComplete="new-password" disabled={busy} id="new-edit-password" onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
          <p>최소 12자, UTF-8 기준 최대 1,024 bytes입니다.</p>
        </div>
        <button className="secondary-button" disabled={busy} type="submit">{isChangingPassword ? "변경 중…" : "편집 비밀번호 변경"}</button>
      </form>
      <button className="secondary-button logout-button" disabled={busy} onClick={() => void logout()} type="button">{isLoggingOut ? "종료 중…" : "편집 모드 종료"}</button>
    </details> : <form className="unlock-form" noValidate onSubmit={unlock}>
      <div className="form-field">
        <label htmlFor="unlock-edit-password">편집 비밀번호</label>
        <input autoComplete="current-password" disabled={isUnlocking || permissionCheckState === "checking"} id="unlock-edit-password" onChange={(event) => setUnlockPassword(event.target.value)} type="password" value={unlockPassword} />
      </div>
      <button className="primary-button" disabled={isUnlocking || permissionCheckState === "checking"} type="submit">{isUnlocking ? "확인 중…" : permissionCheckState === "checking" ? "권한 확인 중…" : "편집 잠금 해제"}</button>
    </form>}
    <section aria-busy={isSavingTask || undefined} className="project-schedule" aria-labelledby="schedule-heading">
      <div className="schedule-heading-row">
        <div>
          <h2 id="schedule-heading">일정</h2>
          <p>{tasks.length === 0 ? "아직 등록된 작업이 없습니다." : "서버의 최신 일정 snapshot을 표시합니다."}</p>
        </div>
        {isSavingTask ? <span className="schedule-saving" role="status">일정 저장 중…</span> : null}
      </div>
      {editing && !taskEditingSupported ? <p className="schedule-scope-note">연결이 있는 일정 편집은 다음 단계에서 지원합니다. 현재 일정은 읽기 전용으로 표시됩니다.</p> : null}
      <ProjectGantt
        key={ganttResetGeneration}
        calendar={project.calendar}
        editable={taskEditing}
        mutationLocked={busy || editorSession !== null}
        onCanonicalSyncFailure={recoverCanonicalGantt}
        links={links}
        onTaskAddRejected={rejectNativeTaskAdd}
        onTaskCreate={createNativeTask}
        onTaskCommand={saveTaskCommand}
        onTaskEditorOpen={openTaskEditor}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={(columnId) => setColumnVisibility((current) => {
          const visibleColumnCount = Object.values(current).filter(Boolean).length;
          if (current[columnId] && visibleColumnCount === 1) return current;
          return { ...current, [columnId]: !current[columnId] };
        })}
        tasks={tasks}
      />
      {editorSession ? <ProjectTaskEditor
        key={editorSession.task.taskId}
        session={editorSession}
        latestTask={tasks.find((task) => task.taskId === editorSession.task.taskId)}
        revision={project.revision}
        editable={editing}
        hasLinks={links.length > 0}
        busy={busy}
        onSave={saveEditorTask}
        onReload={reloadEditorTask}
        onClose={closeTaskEditor}
      /> : null}
      <dialog aria-labelledby="child-task-confirm-title" className="task-confirm-dialog" onCancel={(event) => { event.preventDefault(); closeNativeTaskDialog(); }} ref={nativeTaskDialogReference}>
        {pendingChildTask ? <div className="task-confirm-dialog-card">
          <p className="eyebrow">{pendingChildTask.parentTaskId ? "하위 작업 추가" : "작업 추가"}</p>
          <h3 id="child-task-confirm-title">부모 작업을 요약 작업으로 전환할까요?</h3>
          <p>기존 작업의 시작일, 종료일과 진척도는 하위 작업을 기준으로 다시 계산됩니다.</p>
          <form className="task-confirm-form" onSubmit={confirmNativeTaskAdd}>
            <label className="task-conversion-confirmation"><input autoFocus checked={parentConversionConfirmed} onChange={(event) => setParentConversionConfirmed(event.target.checked)} type="checkbox" />부모 작업을 요약 작업으로 전환하는 데 동의합니다.</label>
            <div className="task-confirm-dialog-actions">
              <button className="secondary-button" onClick={closeNativeTaskDialog} type="button">취소</button>
              <button className="primary-button" disabled={!parentConversionConfirmed} type="submit">전환하고 하위 작업 추가</button>
            </div>
          </form>
        </div> : null}
      </dialog>
    </section>
  </section>;
}
