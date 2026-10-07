"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { ProjectSnapshotResponse } from "@/contracts/projects";
import styles from "./project-save-as-template.module.css";

type Props = Readonly<{ publicId: string; busy?: boolean }>;

function isSnapshot(value: unknown): value is ProjectSnapshotResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null &&
    "project" in value.data &&
    typeof value.data.project === "object" &&
    value.data.project !== null &&
    "revision" in value.data.project &&
    typeof value.data.project.revision === "number" && Number.isSafeInteger(value.data.project.revision) && value.data.project.revision >= 1 &&
    "publicId" in value.data.project && typeof value.data.project.publicId === "string" &&
    "name" in value.data.project &&
    typeof value.data.project.name === "string" &&
    "description" in value.data.project && typeof value.data.project.description === "string" &&
    "tasks" in value.data && Array.isArray(value.data.tasks) &&
    value.data.tasks.every((task) => task && typeof task === "object" && typeof task.taskId === "string")
  );
}

function hasEditPermission(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null &&
    "permission" in value.data &&
    value.data.permission === "edit"
  );
}

export function ProjectSaveAsTemplateButton({ publicId, busy = false }: Props) {
  const { notify } = useWorkspaceNotifications();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<ProjectSnapshotResponse | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourcePassword, setSourcePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sourceState, setSourceState] = useState<"loading" | "ready" | "loadError" | "conflict">("loading");
  const [sourceId, setSourceId] = useState("");
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
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
        setOpen(false); setSaving(false); setLoading(false); setSourcePassword("");
      }
    });
    const invalidate = () => { request.current?.abort(); generation.current++; };
    return () => { active = false; invalidate(); };
  }, [publicId]);
  useEffect(() => {
    if (open && !saving && !loading && !authorized && restoreSourceFocus.current) {
      sourceInput.current?.focus();
      restoreSourceFocus.current = false;
    }
  }, [open, saving, loading, authorized]);

  function close() {
    if (pending.current) return;
    request.current?.abort(); generation.current++;
    openRef.current = false;
    setOpen(false); setLoading(false); setSourcePassword("");
  }

  async function loadSource() {
    if (pending.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const token = ++generation.current;
    const id = publicId;
    const current = () => !controller.signal.aborted && generation.current === token && openRef.current && currentId.current === id;
    setLoading(true); setSourceState("loading"); setError(null); setSourceNotice(null);
    try {
      const [snapResponse, sessionResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
        fetch(`/api/projects/${encodeURIComponent(id)}/edit-sessions/current`, { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      ]);
      const snapRes: unknown = await snapResponse.json().catch(() => null);
      const sessionRes: unknown = await sessionResponse.json().catch(() => null);
      if (!current()) return;
      if (!snapResponse.ok || !isSnapshot(snapRes) || snapRes.data.project.publicId !== id) {
        setSourceState("loadError");
        setError("프로젝트 정보를 불러올 수 없습니다. 다시 시도해 주세요.");
        return;
      }
      setSnapshot(snapRes); setSourceId(id); setSourceState("ready");
      setAuthorized(sessionResponse.ok && hasEditPermission(sessionRes));
      if (!initialized.current) {
        setName(Array.from(`${snapRes.data.project.name} 템플릿`).slice(0, 200).join(""));
        setDescription(snapRes.data.project.description);
        initialized.current = true;
      } else {
        setSourceNotice(`최신 원본 revision ${snapRes.data.project.revision}을 확인했습니다. 내용을 검토한 후 템플릿 저장을 다시 선택해 주세요.`);
      }
      setSourcePassword("");
    } catch {
      if (current()) { setSourceState("loadError"); setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요."); }
    } finally {
      if (current()) setLoading(false);
    }
  }

  async function show() {
    if (pending.current || openRef.current) return;
    initialized.current = false; openRef.current = true;
    setOpen(true);
    setSnapshot(null); setSourceId(""); setAuthorized(false); setSourcePassword("");
    await loadSource();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current || busy || !ready || !snapshot) return;

    const trimmedName = name.trim();
    if (!trimmedName || Array.from(trimmedName).length > 200 || Array.from(description).length > 4000) {
      setError("템플릿 이름은 1~200자, 설명은 4,000자 이하로 입력해 주세요.");
      return;
    }

    pending.current = true;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const token = ++generation.current;
    const id = publicId;
    const current = () => !controller.signal.aborted && generation.current === token && openRef.current && currentId.current === id;
    setSaving(true);
    setError(null);

    try {
      // 세션 권한이 없으면 입력받은 비밀번호로 인증 시도
      if (!authorized) {
        if (!sourcePassword) {
          setError("프로젝트 편집 권한 확인을 위해 편집 비밀번호를 입력해 주세요.");
          return;
        }
        const unlockRes = await fetch(`/api/projects/${publicId}/edit-sessions`, {
          method: "POST",
          credentials: "same-origin", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editPassword: sourcePassword }),
        });
        if (!current()) return;
        if (unlockRes.status !== 204) {
          setError("편집 비밀번호가 일치하지 않습니다.");
          return;
        }
        setAuthorized(true);
      }

      const res = await fetch("/api/project-templates", {
        method: "POST",
        credentials: "same-origin", signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${snapshot.data.project.revision}"`,
        },
        body: JSON.stringify({
          sourceProjectPublicId: publicId,
          name: trimmedName,
          description: description.trim() || undefined,
        }),
      });
      if (!current()) return;

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        if (!current()) return;
        if (res.status === 401) {
          setAuthorized(false); setSourcePassword(""); restoreSourceFocus.current = true;
          setError("편집 권한이 만료되었습니다. 원본 편집 비밀번호로 다시 인증해 주세요.");
        } else if (res.status === 412) {
          setSourceState("conflict");
          setError("원본 프로젝트가 변경되었습니다. 최신 원본을 확인한 뒤 다시 제출해 주세요.");
        } else setError(typeof errorJson?.error?.message === "string" ? errorJson.error.message : "템플릿을 저장하지 못했습니다.");
        return;
      }

      notify(
        "success",
        `"${trimmedName}" 템플릿으로 저장되었습니다. 새 프로젝트 생성 시 템플릿을 선택할 수 있습니다.`,
        "project_template_save",
      );
      openRef.current = false; setOpen(false);
    } catch {
      if (current()) setError("네트워크 오류가 발생했습니다.");
    } finally {
      if (!controller.signal.aborted && generation.current === token && currentId.current === id) {
        pending.current = false; setSaving(false); setSourcePassword("");
      }
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="menu-button"
        disabled={busy}
        onClick={() => void show()}
      >
        템플릿으로 저장
      </button>

      {open && (
        <WorkspaceDialog
          title="프로젝트 템플릿으로 저장"
          onClose={close}
          busy={saving}
          restoreFocusRef={trigger}
        >
          <p className="dialog-description">
            현재 프로젝트의 작업 일정(상대 오프셋), 의존관계, 리소스 배정 및 물류 마스터/연결 정보를 템플릿으로 보관합니다.
          </p>
        {loading ? <p className="dialog-empty-message" role="status">프로젝트 정보를 확인하고 있습니다…</p> : null}
        {error ? <div className="form-error-banner" role="alert">{error}</div> : null}
        {sourceNotice ? <p role="status">{sourceNotice}</p> : null}
        {!loading && (sourceState === "loadError" || sourceState === "conflict") ? <div className="standalone-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => void loadSource()}>{sourceState === "conflict" ? "최신 원본 확인" : "다시 시도"}</button></div> : null}
        {sourceId === publicId && snapshot ? <p>원본 revision {snapshot.data.project.revision} · 작업 {snapshot.data.tasks.length}{!ready ? " · 이전 조회 정보 · 최신 상태 확인 필요" : ""}</p> : null}
        <form className={`form-grid ${styles.form}`} noValidate onSubmit={handleSubmit}>

            <div className="form-field">
              <label htmlFor="template-name-input">템플릿 이름</label>
              <input
                id="template-name-input"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving || sourceId !== publicId || !snapshot}
              />
            </div>

            <div className="form-field">
              <label htmlFor="template-desc-input">설명 (선택)</label>
              <textarea
                id="template-desc-input"
                rows={3}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving || sourceId !== publicId || !snapshot}
              />
            </div>

            {!authorized && (
              <div className="form-field">
                <label htmlFor="template-source-password-input">프로젝트 편집 비밀번호</label>
                <input
                  ref={sourceInput}
                  id="template-source-password-input"
                  type="password"
                  required
                  placeholder="편집 권한 인증용"
                  value={sourcePassword}
                  onChange={(e) => setSourcePassword(e.target.value)}
                  disabled={saving || !ready}
                />
              </div>
            )}

            <div className={`dialog-actions ${styles.actions}`}>
              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={close}
              >
                취소
              </button>
              <button type="submit" className="primary-button" disabled={saving || !ready || busy}>
                {saving ? "저장 중…" : "템플릿 저장"}
              </button>
            </div>
          </form>
      </WorkspaceDialog>
      )}
    </>
  );
}
