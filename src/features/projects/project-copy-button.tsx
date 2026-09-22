"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { CopyProjectResponse, ProjectSnapshotResponse } from "@/contracts/projects";

type Props = Readonly<{ publicId: string; autoOpen?: boolean; busy?: boolean; onAutoOpen?: () => void }>;

function validPassword(value: string): boolean {
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
    "revision" in value.data.project && typeof value.data.project.revision === "number" &&
    "name" in value.data.project && typeof value.data.project.name === "string" &&
    "description" in value.data.project && typeof value.data.project.description === "string" &&
    "calendar" in value.data.project && typeof value.data.project.calendar === "object" && value.data.project.calendar !== null &&
    "holidays" in value.data.project.calendar && Array.isArray(value.data.project.calendar.holidays) &&
    "tasks" in value.data && Array.isArray(value.data.tasks) &&
    "links" in value.data && Array.isArray(value.data.links);
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
  const trigger = useRef<HTMLButtonElement | null>(null);
  const autoOpened = useRef(false);

  async function refreshForCopy(): Promise<ProjectSnapshotResponse | null> {
    setLoading(true);
    setError(null);
    try {
      const [projectResponse, sessionResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions/current`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);
      const projectBody: unknown = await projectResponse.json().catch(() => null);
      const sessionBody: unknown = await sessionResponse.json().catch(() => null);
      if (!projectResponse.ok || !isSnapshot(projectBody)) {
        setError("복사할 프로젝트의 최신 정보를 읽을 수 없습니다.");
        return null;
      }
      const canEdit = sessionResponse.ok && hasEditPermission(sessionBody);
      setSnapshot(projectBody);
      setAuthorized(canEdit);
      setName(suggestedName(projectBody.data.project.name));
      setOwnerName(projectBody.data.project.ownerName ?? "");
      setDescription(projectBody.data.project.description);
      setSourcePassword("");
      setPassword("");
      setConfirm("");
      setResetProgress(false);
      return projectBody;
    } catch {
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function show(): Promise<void> {
    setOpen(true);
    await refreshForCopy();
  }

  useEffect(() => {
    if (!autoOpen || autoOpened.current || busy) return;
    autoOpened.current = true;
    onAutoOpen?.();
    void show();
  }, [autoOpen, busy, onAutoOpen]);

  function close() {
    if (!copying) setOpen(false);
  }

  async function unlockSource(): Promise<boolean> {
    if (authorized) return true;
    if (!validPassword(sourcePassword)) {
      setError("원본 프로젝트의 편집 비밀번호를 입력해 주세요.");
      return false;
    }
    const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/edit-sessions`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editPassword: sourcePassword }),
    });
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
    if (!validPassword(password) || password !== confirm) {
      setError("새 편집 비밀번호는 1~12자이며 확인 값과 일치해야 합니다.");
      return;
    }

    setCopying(true);
    setError(null);
    try {
      if (!(await unlockSource())) return;

      const latestResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const latestBody: unknown = await latestResponse.json().catch(() => null);
      if (!latestResponse.ok || !isSnapshot(latestBody)) {
        setError("원본 프로젝트의 최신 상태를 확인할 수 없습니다.");
        return;
      }
      setSnapshot(latestBody);

      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/copy`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${latestBody.data.project.revision}"`,
        },
        body: JSON.stringify({
          name: normalizedName,
          ownerName: normalizedOwnerName,
          description,
          editPassword: password,
          resetProgress,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      const data = typeof body === "object" && body !== null && "data" in body
        ? (body as CopyProjectResponse).data
        : null;
      if (response.status === 201 && data?.operation.kind === "projectCopy") {
        notify("success", "프로젝트 복사본을 생성했습니다. 새 프로젝트로 이동합니다.", "프로젝트 복사");
        router.push(`/projects/${encodeURIComponent(data.project.publicId)}`);
        return;
      }
      setError(response.status === 412
        ? "원본 프로젝트가 다시 변경되었습니다. 최신 정보를 확인한 뒤 재시도해 주세요."
        : response.status === 401
          ? "편집 권한이 만료되었습니다. 원본 비밀번호를 다시 확인해 주세요."
          : "프로젝트를 복사하지 못했습니다.");
      notify("error", "프로젝트를 복사하지 못했습니다.", "프로젝트 복사", body);
    } catch {
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setCopying(false);
      setSourcePassword("");
      setPassword("");
      setConfirm("");
    }
  }

  const project = snapshot?.data.project;
  const tasks = snapshot?.data.tasks ?? [];
  const links = snapshot?.data.links ?? [];

  return <>
    <button ref={trigger} type="button" className="secondary-button" disabled={busy || loading || copying} onClick={() => void show()}>
      {loading ? "확인 중…" : "프로젝트 복사"}
    </button>
    {open ? <WorkspaceDialog title="프로젝트 복사" onClose={close} busy={copying || loading} restoreFocusRef={trigger}>
      {project ? <p>작업 {tasks.length} · 연결 {links.length} · 휴일 {project.calendar.holidays.length}. 서버에 저장된 최신 일정과 계층을 독립 복사합니다.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {project ? <form className="project-form compact-form" noValidate onSubmit={submit}>
        {!authorized ? <div className="form-field"><label htmlFor="detail-copy-source-password">원본 편집 비밀번호</label><input id="detail-copy-source-password" type="password" autoComplete="current-password" value={sourcePassword} disabled={copying} onChange={(event) => setSourcePassword(event.target.value)} /></div> : null}
        <div className="form-field"><label htmlFor="detail-copy-name">새 프로젝트명</label><input id="detail-copy-name" value={name} disabled={copying} onChange={(event) => setName(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-owner">소유자</label><input id="detail-copy-owner" value={ownerName} disabled={copying} onChange={(event) => setOwnerName(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-description">설명</label><textarea id="detail-copy-description" rows={3} value={description} disabled={copying} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-password">새 편집 비밀번호</label><input id="detail-copy-password" type="password" autoComplete="new-password" minLength={1} maxLength={12} value={password} disabled={copying} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="detail-copy-password-confirm">새 편집 비밀번호 확인</label><input id="detail-copy-password-confirm" type="password" autoComplete="new-password" minLength={1} maxLength={12} value={confirm} disabled={copying} onChange={(event) => setConfirm(event.target.value)} /></div>
        <label><input type="checkbox" checked={resetProgress} disabled={copying} onChange={(event) => setResetProgress(event.target.checked)} /> 진척률 0%로 초기화</label>
        <button className="primary-button" type="submit" disabled={copying}>{copying ? "복사 중…" : "복사본 생성"}</button>
      </form> : null}
    </WorkspaceDialog> : null}
  </>;
}
