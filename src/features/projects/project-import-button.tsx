"use client";

import { useRef, useState } from "react";
import { useWorkspaceNotifications } from "@/components/workspace-notifications";
import { WorkspaceDialog } from "@/components/workspace-dialog";

type PreviewResult = {
  tasks: number;
  links: number;
};

export function ProjectImportButton({
  publicId,
  expectedRevision,
  onImportSuccess,
  disabled = false,
}: {
  publicId: string;
  expectedRevision: number;
  onImportSuccess: () => void;
  disabled?: boolean;
}) {
  const { notify } = useWorkspaceNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsOpen(true);
    setPreview(null);
    setPreviewError(null);
    setIsPreviewing(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/imports/preview`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setPreviewError(body?.error?.message || "파일을 미리보는 중 오류가 발생했습니다.");
      } else {
        const body = await response.json();
        setPreview({
          tasks: body.data.tasks,
          links: body.data.links,
        });
      }
    } catch {
      setPreviewError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCommit() {
    if (!file || isCommitting) return;
    setIsCommitting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/imports`, {
        method: "POST",
        headers: {
          "If-Match": `"${expectedRevision}"`,
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        notify("error", "JSON 가져오기에 실패했습니다.", "JSON 가져오기", body);
      } else {
        notify("success", "JSON 가져오기가 완료되었습니다.", "JSON 가져오기");
        setIsOpen(false);
        onImportSuccess();
      }
    } catch {
      notify("error", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", "JSON 가져오기");
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <>
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="secondary-button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        가져오기 (JSON)
      </button>

      {isOpen && (
        <WorkspaceDialog
          title="JSON 파일 가져오기"
          onClose={() => {
            if (!isCommitting) {
              setIsOpen(false);
              setFile(null);
            }
          }}
        >
          <div className="workspace-dialog-content">
            {isPreviewing ? (
              <p>파일을 분석하는 중입니다...</p>
            ) : previewError ? (
              <div>
                <p style={{ color: "var(--color-danger)" }}>오류: {previewError}</p>
                <div style={{ marginTop: "1rem", textAlign: "right" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsOpen(false)}
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : preview ? (
              <div>
                <p>파일 검증이 완료되었습니다.</p>
                <ul>
                  <li>작업(Task): {preview.tasks}개</li>
                  <li>연결(Link): {preview.links}개</li>
                </ul>
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsOpen(false)}
                    disabled={isCommitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleCommit}
                    disabled={isCommitting}
                  >
                    {isCommitting ? "가져오는 중..." : "확인 (Commit)"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </WorkspaceDialog>
      )}
    </>
  );
}
