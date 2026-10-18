"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { CopyProjectResponse, ProjectSnapshotResponse } from "@/contracts/projects";

type Props = Readonly<{ publicId: string; autoOpen?: boolean; busy?: boolean; onAutoOpen?: () => void }>;

function validSourcePassword(value: string): boolean {
  return Array.from(value).length >= 1 && new TextEncoder().encode(value).byteLength <= 1_024;
}
function validNewPassword(value: string): boolean {
  const length = Array.from(value).length;
  return length >= 1 && length <= 12;
}

function suggestedName(name: string): string {
  const suffix = " (복사본)";
  return `${Array.from(name).slice(0, 200 - Array.from(suffix).length).join("")}${suffix}`;
}

function isSnapshot(value: unknown): value is ProjectSnapshotResponse {
  return typeof value === "object" && value !== null &&
    "data" in value && typeof value.data === "object" && value.data !== null &&
    "project" in value.data && typeof value.data.project === "object" && value.data.project !== null &&
    "revision" in value.data.project && typeof value.data.project.revision === "number" && Number.isSafeInteger(value.data.project.revision) && value.data.project.revision >= 1 &&
    "publicId" in value.data.project && typeof value.data.project.publicId === "string" &&
    "name" in value.data.project && typeof value.data.project.name === "string" &&
    "description" in value.data.project && typeof value.data.project.description === "string" &&
    (!("ownerName" in value.data.project) || value.data.project.ownerName === undefined || value.data.project.ownerName === null || typeof value.data.project.ownerName === "string") &&
    "calendar" in value.data.project && typeof value.data.project.calendar === "object" && value.data.project.calendar !== null &&
    "holidays" in value.data.project.calendar && Array.isArray(value.data.project.calendar.holidays) &&
    value.data.project.calendar.holidays.every((day) => day && typeof day === "object" && typeof day.date === "string" && (day.name === null || typeof day.name === "string")) &&
    "tasks" in value.data && Array.isArray(value.data.tasks) && value.data.tasks.every((task) => task && typeof task === "object" && typeof task.taskId === "string") &&
    "links" in value.data && Array.isArray(value.data.links) && value.data.links.every((link) => link && typeof link === "object" && typeof link.id === "string") &&
    (!("logistics" in value.data) || value.data.logistics === undefined || validLogistics(value.data.logistics));
}

function validLogistics(value: unknown): boolean {
  return !!value && typeof value === "object" && ["processes", "equipment", "systems"].every((key) => {
    const rows = (value as Record<string, unknown>)[key];
    return Array.isArray(rows) && rows.every((row) => row && typeof row === "object" && typeof row.id === "string");
  });
}

function hasEditPermission(value: unknown): boolean {
  return typeof value === "object" && value !== null &&
    "data" in value && typeof value.data === "object" && value.data !== null &&
    "permission" in value.data && value.data.permission === "edit";
}

export function ProjectCopyButton({ publicId, autoOpen = false, busy = false, onAutoOpen }: Props) {
  const router = useRouter();
  const { notify } = useWorkspaceNotifications();
  const [snapshot, setSnapshot] = useState<ProjectSnapshotResponse | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [sourcePassword, setSourcePassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetProgress, setResetProgress] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceState, setSourceState] = useState<"loading" | "ready" | "loadError" | "conflict">("loading");
  const [sourceId, setSourceId] = useState("");
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const autoOpened = useRef(false);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const openRef = useRef(false);
  const currentId = useRef(publicId);
  const initialized = useRef(false);
  const sourceInput = useRef<HTMLInputElement | null>(null);
  const restoreSourceFocus = useRef(false);
  const ready = sourceState === "ready" && sourceId === publicId && !!snapshot;

  useEffect(() => {
    const changed = currentId.current !== publicId;
    currentId.current = publicId;
    pending.current = false;
    let active = true;
    if (changed) queueMicrotask(() => {
      if (active) {
        openRef.current = false;
        setOpen(false); setCopying(false); setLoading(false); clearPasswords();
      }
    });
    const invalidate = () => { request.current?.abort(); generation.current++; };
    return () => { active = false; invalidate(); };
  }, [publicId]);
  useEffect(() => {
    if (open && !copying && !loading && !authorized && restoreSourceFocus.current) {
      sourceInput.current?.focus();
      restoreSourceFocus.current = false;
    }
  }, [open, copying, loading, authorized]);

  function clearPasswords() { setSourcePassword(""); setPassword(""); setConfirm(""); }
  function expireSource() {
    setAuthorized(false); clearPasswords();
    restoreSourceFocus.current = true;
    setError("편집 권한이 만료되었습니다. 원본 편집 비밀번호로 다시 인증해 주세요.");
  }

  async function refreshForCopy(): Promise<ProjectSnapshotResponse | null> {
    if (pending.current) return null;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const token = ++generation.current;
    const id = publicId;
    const current = () => !controller.signal.aborted && generation.current === token && openRef.current && currentId.current === id;
    setLoading(true);
    setSourceState("loading");
    setError(null);
    setSourceNotice(null);
    try {
      const [projectResponse, sessionResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        }),
        fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        }),
      ]);
      const projectBody: unknown = await projectResponse.json().catch(() => null);
      const sessionBody: unknown = await sessionResponse.json().catch(() => null);
      if (!current()) return null;
      if (!projectResponse.ok || !isSnapshot(projectBody) || projectBody.data.project.publicId !== id) {
        setSourceState("loadError");
        setError("복사할 프로젝트의 최신 정보를 읽을 수 없습니다.");
        return null;
      }
      const canEdit = sessionResponse.ok && hasEditPermission(sessionBody);
      setSnapshot(projectBody);
      setSourceId(id); setSourceState("ready");
      setAuthorized(canEdit);
      if (!initialized.current) {
        setName(suggestedName(projectBody.data.project.name));
        setOwnerName(projectBody.data.project.ownerName ?? "");
        setDescription(projectBody.data.project.description);
        setResetProgress(false);
        initialized.current = true;
      } else {
        setSourceNotice(`최신 원본 revision ${projectBody.data.project.revision}을 확인했습니다. 내용을 검토한 후 복사본 생성을 다시 선택해 주세요.`);
      }
      clearPasswords();
      return projectBody;
    } catch {
      if (current()) {
        setSourceState("loadError");
        setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      }
      return null;
    } finally {
      if (current()) setLoading(false);
    }
  }

  async function show(): Promise<void> {
    if (pending.current || openRef.current) return;
    initialized.current = false; openRef.current = true;
    setSnapshot(null); setSourceId(""); setAuthorized(false); clearPasswords();
    setOpen(true);
    await refreshForCopy();
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || !autoOpen || autoOpened.current || busy) return;
      autoOpened.current = true;
      onAutoOpen?.();
      void show();
    });
    return () => { active = false; };
  }, [autoOpen, busy, onAutoOpen]);

  function close() {
    if (pending.current) return;
    request.current?.abort(); generation.current++;
    openRef.current = false;
    setOpen(false); setLoading(false); clearPasswords();
  }

  async function unlockSource(controller: AbortController): Promise<boolean> {
    if (authorized) return true;
    if (!validSourcePassword(sourcePassword)) {
      setError("원본 프로젝트의 편집 비밀번호를 입력해 주세요.");
      return false;
    }
    const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions`, {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editPassword: sourcePassword }),
    });
    if (controller.signal.aborted) return false;
    if (response.status !== 204) {
      setError(response.status === 401
        ? "원본 프로젝트 편집 비밀번호가 올바르지 않습니다."
        : "원본 프로젝트 편집 권한을 확인할 수 없습니다.");
      return false;
    }
    setAuthorized(true);
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || busy || !ready || !snapshot) return;
    const normalizedName = name.trim();
    const normalizedOwnerName = ownerName.trim();
    if (!normalizedName || Array.from(normalizedName).length > 200) {
      setError("새 프로젝트명은 1~200자로 입력해 주세요.");
      return;
    }
    if (!normalizedOwnerName || Array.from(normalizedOwnerName).length > 100) {
      setError("소유자는 Unicode 문자 기준 1~100자로 입력해 주세요.");
      return;
    }
    if (Array.from(description).length > 4_000) {
      setError("설명은 4,000자 이하여야 합니다.");
      return;
    }
    if (!validNewPassword(password) || password !== confirm) {
      setError("새 편집 비밀번호는 1~12자이며 확인 값과 일치해야 합니다.");
      return;
    }

    const reviewedRevision = snapshot.data.project.revision;
    const submittedPassword = password;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const token = ++generation.current;
    const id = publicId;
    const current = () => !controller.signal.aborted && generation.current === token && openRef.current && currentId.current === id;
    pending.current = true;
    setCopying(true);
    setError(null);
    try {
      if (!(await unlockSource(controller)) || !current()) return;

      const latestResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const latestBody: unknown = await latestResponse.json().catch(() => null);
      if (!current()) return;
      if (!latestResponse.ok || !isSnapshot(latestBody) || latestBody.data.project.publicId !== id) {
        setSourceState("loadError");
        setError("원본 프로젝트의 최신 상태를 확인할 수 없습니다.");
        return;
      }
      if (latestBody.data.project.revision !== reviewedRevision) {
        setSourceState("conflict");
        setError("확인한 원본 프로젝트가 변경되었습니다. 최신 원본을 확인한 뒤 다시 제출해 주세요.");
        return;
      }

      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/copy`, {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${reviewedRevision}"`,
        },
        body: JSON.stringify({
          name: normalizedName,
          ownerName: normalizedOwnerName,
          description,
          editPassword: submittedPassword,
          resetProgress,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!current()) return;
      const data = typeof body === "object" && body !== null && "data" in body
        ? (body as CopyProjectResponse).data
        : null;
      if (response.status === 201 && data?.operation?.kind === "projectCopy" && typeof data.project?.publicId === "string" && (!data.warnings || (Array.isArray(data.warnings) && data.warnings.every((warning) => typeof warning === "string")))) {
        notify("success", "프로젝트 복사본을 생성했습니다. 새 프로젝트로 이동합니다.", "프로젝트 복사");
        if (data.warnings && data.warnings.length > 0) {
          for (const warning of data.warnings) {
            notify("info", warning, "복사 경고");
          }
        }
        router.push(`/projects/${encodeURIComponent(data.project.publicId)}`);
        return;
      }
      if (response.status === 401) expireSource();
      else if (response.status === 412) {
        setSourceState("conflict");
        setError("원본 프로젝트가 변경되었습니다. 최신 원본을 확인한 뒤 다시 제출해 주세요.");
      } else setError("프로젝트를 복사하지 못했습니다.");
      notify("error", "프로젝트를 복사하지 못했습니다.", "프로젝트 복사", body);
    } catch {
      if (current()) setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      if (current()) {
        pending.current = false; setCopying(false); clearPasswords();
      }
    }
  }

  const project = sourceId === publicId ? snapshot?.data.project : null;
  const tasks = snapshot?.data.tasks ?? [];
  const links = snapshot?.data.links ?? [];
  const logistics = snapshot?.data.logistics;
  const hasLogistics = Boolean(
    logistics &&
    (logistics.processes.length > 0 || logistics.equipment.length > 0 || logistics.systems.length > 0),
  );

  return <>
    <button ref={trigger} type="button" className="secondary-button" disabled={busy || loading || copying} onClick={() => void show()}>
      {loading ? "확인 중…" : "프로젝트 복사"}
    </button>
    {open ? <WorkspaceDialog title="프로젝트 복사" onClose={close} busy={copying} restoreFocusRef={trigger}>
      {loading ? <p role="status">원본 프로젝트를 확인하는 중…</p> : null}
      {sourceNotice ? <p role="status">{sourceNotice}</p> : null}
      {!loading && (sourceState === "loadError" || sourceState === "conflict") ? <div className="standalone-actions"><button className="secondary-button" type="button" disabled={copying} onClick={() => void refreshForCopy()}>{sourceState === "conflict" ? "최신 원본 확인" : "다시 시도"}</button></div> : null}
      {project ? <p>원본 revision {project.revision}{!ready ? " · 이전 조회 정보 · 최신 상태 확인 필요" : ""} · 작업 {tasks.length} · 연결 {links.length} · 휴일 {project.calendar.holidays.length}{hasLogistics ? ` · 공정 ${logistics?.processes.length} · 설비 ${logistics?.equipment.length} · 시스템 ${logistics?.systems.length}` : ""}. 서버에 저장된 일정·물류 구조를 독립 복사하며, 글로벌 리소스 참조는 그대로 유지됩니다.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {project ? <form className="project-form compact-form" noValidate onSubmit={submit}>
        {!authorized ? <div className="form-field"><label htmlFor="detail-copy-source-password">원본 편집 비밀번호</label><input ref={sourceInput} id="detail-copy-source-password" type="password" autoComplete="current-password" value={sourcePassword} disabled={copying || !ready} onChange={(event) => setSourcePassword(event.target.value)} /></div> : null}
        <div className="form-field"><label htmlFor="detail-copy-name">새 프로젝트명</label><input id="detail-copy-name" value={name} disabled={copying} onChange={(event) => setName(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-owner">소유자</label><input id="detail-copy-owner" value={ownerName} disabled={copying} onChange={(event) => setOwnerName(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-description">설명</label><textarea id="detail-copy-description" rows={3} value={description} disabled={copying} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-password">새 편집 비밀번호</label><input id="detail-copy-password" type="password" autoComplete="new-password" minLength={1} maxLength={12} value={password} disabled={copying} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-password-confirm">새 편집 비밀번호 확인</label><input id="detail-copy-password-confirm" type="password" autoComplete="new-password" minLength={1} maxLength={12} value={confirm} disabled={copying} onChange={(event) => setConfirm(event.target.value)} /></div>
        <label><input type="checkbox" checked={resetProgress} disabled={copying} onChange={(event) => setResetProgress(event.target.checked)} /> 진척률 0%로 초기화</label>
        <button className="primary-button" type="submit" disabled={copying || !ready || busy}>{copying ? "복사 중…" : "복사본 생성"}</button>
      </form> : null}
    </WorkspaceDialog> : null}
  </>;
}
