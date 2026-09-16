"use client";

import { useRef, useState } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";

function revisionFromSnapshot(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("data" in value)) return null;
  const data = value.data;
  if (typeof data !== "object" || data === null || !("project" in data)) return null;
  const project = data.project;
  if (typeof project !== "object" || project === null || !("revision" in project)) return null;
  return typeof project.revision === "number" && Number.isSafeInteger(project.revision) && project.revision > 0
    ? project.revision
    : null;
}

function errorCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error = value.error;
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

function downloadFilename(response: Response, publicId: string, revision: number): string {
  const disposition = response.headers.get("content-disposition");
  const match = disposition ? /filename="([A-Za-z0-9._-]+)"/.exec(disposition) : null;
  return match?.[1] ?? `mastergantt-${publicId}-r${revision}.xlsx`;
}

const exportLayout: ProjectExcelExportRequest["layout"] = {
  columns: [
    { id: "text", widthPx: 224 },
    { id: "projectStart", widthPx: 128 },
    { id: "projectDuration", widthPx: 84 },
  ],
};

export function ProjectExcelExportButton({ publicId }: Readonly<{ publicId: string }>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  async function exportExcel(includeDependencies: boolean) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const snapshotResponse = await fetch(`/api/projects/${encodeURIComponent(publicId)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const snapshot: unknown = await snapshotResponse.json().catch(() => null);
      const revision = snapshotResponse.ok ? revisionFromSnapshot(snapshot) : null;
      if (revision === null) {
        setMessage("최신 프로젝트 정보를 확인할 수 없습니다. 다시 시도해 주세요.");
        return;
      }

      const request: ProjectExcelExportRequest = {
        includeDependencies,
        scope: "project",
        scale: "day",
        hierarchyDisplay: "expanded",
        layout: exportLayout,
      };
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/exports/excel`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${revision}"`,
        },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code = errorCode(body);
        setMessage(
          response.status === 412
            ? "내보내기 중 프로젝트가 변경되었습니다. 다시 실행해 주세요."
            : code === "EXPORT_LIMIT_EXCEEDED"
              ? "프로젝트 크기가 Excel 내보내기 한도를 초과했습니다."
              : code === "EXPORT_UNSUPPORTED"
                ? "현재 일정 구조를 안전하게 Excel로 변환할 수 없습니다."
                : "Excel 파일을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = downloadFilename(response, publicId, revision);
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setOpen(false);
    } catch {
      setMessage("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button
      ref={triggerRef}
      className="secondary-button"
      type="button"
      disabled={busy}
      onClick={() => { setMessage(null); setOpen(true); }}
    >Excel 내보내기</button>
    {open ? <WorkspaceDialog
      title="Excel 내보내기"
      busy={busy}
      feedback={false}
      restoreFocusRef={triggerRef}
      onClose={() => { if (!busy) setOpen(false); }}
    >
      <div className="project-form compact-form">
        <p>작업 간 관계를 Excel 파일에 포함하시겠습니까?</p>
        <p>포함하면 Gantt 관계 화살표와 관계 정보 시트가 생성됩니다. 제외하면 관계 정보는 파일에 기록되지 않습니다.</p>
        {message ? <p role="status" aria-live="polite">{message}</p> : null}
        <div className="form-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={() => void exportExcel(true)}>
            {busy ? "생성 중…" : "관계 포함"}
          </button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void exportExcel(false)}>관계 제외</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setOpen(false)}>취소</button>
        </div>
      </div>
    </WorkspaceDialog> : null}
  </>;
}
