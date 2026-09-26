"use client";

import { useRef, useState, type FormEvent } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import type { ProjectSnapshotResponse } from "@/contracts/projects";

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
    typeof value.data.project.revision === "number" &&
    "name" in value.data.project &&
    typeof value.data.project.name === "string"
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
  const trigger = useRef<HTMLButtonElement | null>(null);

  async function show() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setSourcePassword("");

    try {
      const [snapRes, sessionRes] = await Promise.all([
        fetch(`/api/projects/${publicId}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/projects/${publicId}/edit-sessions`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (!isSnapshot(snapRes)) {
        setError("프로젝트 정보를 불러올 수 없습니다.");
        return;
      }
      setSnapshot(snapRes);
      setName(`${snapRes.data.project.name} 템플릿`);
      setDescription(snapRes.data.project.description ?? "");
      setAuthorized(hasEditPermission(sessionRes));
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !snapshot) return;

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("템플릿 이름을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 세션 권한이 없으면 입력받은 비밀번호로 인증 시도
      if (!authorized) {
        if (!sourcePassword) {
          setError("프로젝트 편집 권한 확인을 위해 편집 비밀번호를 입력해 주세요.");
          setSaving(false);
          return;
        }
        const unlockRes = await fetch(`/api/projects/${publicId}/edit-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: sourcePassword }),
        });
        if (!unlockRes.ok) {
          setError("편집 비밀번호가 일치하지 않습니다.");
          setSaving(false);
          return;
        }
        setAuthorized(true);
      }

      const res = await fetch("/api/project-templates", {
        method: "POST",
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

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const msg = errorJson?.error?.message ?? "템플릿을 저장하지 못했습니다.";
        setError(msg);
        setSaving(false);
        return;
      }

      notify(
        "success",
        `"${trimmedName}" 템플릿으로 저장되었습니다. 새 프로젝트 생성 시 템플릿을 선택할 수 있습니다.`,
        "project_template_save",
      );
      setOpen(false);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
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
          onClose={() => {
            if (!saving) {
              setOpen(false);
            }
          }}
          busy={saving}
          restoreFocusRef={trigger}
        >
          <p className="dialog-description">
            현재 프로젝트의 작업 일정(상대 오프셋), 의존관계, 리소스 배정 및 물류 마스터/연결 정보를 템플릿으로 보관합니다.
          </p>
        {loading ? (
          <p className="dialog-empty-message">프로젝트 정보를 확인하고 있습니다…</p>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit}>
            {error && (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            )}

            <div className="form-field">
              <label htmlFor="template-name-input">템플릿 이름</label>
              <input
                id="template-name-input"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
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
                disabled={saving}
              />
            </div>

            {!authorized && (
              <div className="form-field">
                <label htmlFor="template-source-password-input">프로젝트 편집 비밀번호</label>
                <input
                  id="template-source-password-input"
                  type="password"
                  required
                  placeholder="편집 권한 인증용"
                  value={sourcePassword}
                  onChange={(e) => setSourcePassword(e.target.value)}
                  disabled={saving}
                />
              </div>
            )}

            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                취소
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "저장 중…" : "템플릿 저장"}
              </button>
            </div>
          </form>
        )}
      </WorkspaceDialog>
      )}
    </>
  );
}
