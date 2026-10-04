"use client";

import { useEffect, useRef, useState } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";
import styles from "./project-export.module.css";

type ExportFormat = "excel" | "svg" | "png";
type ExportScope = "project" | "range";

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

function downloadFilename(response: Response, publicId: string, revision: number, extension: "xlsx" | "svg"): string {
  const disposition = response.headers.get("content-disposition");
  const match = disposition ? /filename="([A-Za-z0-9._-]+)"/.exec(disposition) : null;
  return match?.[1] ?? `mastergantt-${publicId}-r${revision}.${extension}`;
}

function download(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  }
}

async function rasterizeSvg(svg: Blob): Promise<Blob> {
  const markup = await svg.text();
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.localName !== "svg" || parsed.querySelector("parsererror")) throw new Error("INVALID_SVG");
  const width = Number(root.getAttribute("width"));
  const height = Number(root.getAttribute("height"));
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
    width > 16384 || height > 16384 || width * height > 32_000_000) throw new Error("IMAGE_TOO_LARGE");
  const href = URL.createObjectURL(svg);
  try {
    const image = new Image();
    image.src = href;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG_UNAVAILABLE");
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } finally {
    URL.revokeObjectURL(href);
  }
}

const exportLayout: ProjectExcelExportRequest["layout"] = {
  columns: [
    { id: "text", widthPx: 224 },
    { id: "projectStart", widthPx: 128 },
    { id: "projectDuration", widthPx: 84 },
  ],
};

export function ProjectExportButton({ publicId }: Readonly<{ publicId: string }>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dateError, setDateError] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [includeDependencies, setIncludeDependencies] = useState(true);
  const [includeLogistics, setIncludeLogistics] = useState(true);
  const [includeResourceEffort, setIncludeResourceEffort] = useState(false);
  const [scope, setScope] = useState<ExportScope>("project");
  const [scale, setScale] = useState<"day" | "week">("day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const formatRef = useRef<HTMLSelectElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => formatRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  async function exportFile() {
    if (busy) return;
    if (format !== "excel" && scope === "range" && (!startDate || !endDate || startDate > endDate)) {
      setMessage("시작일과 종료일을 올바른 순서로 입력해 주세요.");
      setDateError(true);
      return;
    }
    setBusy(true);
    setMessage(null);
    setDateError(false);
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
      const body = format === "excel"
        ? { includeDependencies, includeLogistics, includeResourceEffort, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: exportLayout } satisfies ProjectExcelExportRequest
        : scope === "range"
          ? { scope, startDate, endDate, scale, hierarchyDisplay: "expanded" }
          : { scope, scale, hierarchyDisplay: "expanded" };
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/exports/${format === "excel" ? "excel" : "gantt-svg"}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${revision}"`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const code = errorCode(result);
        if (code === "EXPORT_RANGE_NO_OVERLAP") setDateError(true);
        setMessage(response.status === 412
          ? "내보내기 중 프로젝트가 변경되었습니다. 다시 실행해 주세요."
          : code === "EXPORT_LIMIT_EXCEEDED"
            ? "선택한 일정이 내보내기 한도를 초과했습니다. 범위를 줄여 다시 시도해 주세요."
            : code === "EXPORT_RANGE_NO_OVERLAP"
              ? "선택한 날짜 범위가 프로젝트 일정과 겹치지 않습니다. 다른 날짜를 선택해 주세요."
            : code === "EXPORT_UNSUPPORTED"
              ? "현재 일정 구조를 안전하게 내보낼 수 없습니다."
              : "파일을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const blob = await response.blob();
      const filename = downloadFilename(response, publicId, revision, format === "excel" ? "xlsx" : "svg");
      if (format === "png") {
        const png = await rasterizeSvg(blob);
        download(png, filename.replace(/\.svg$/i, ".png"));
      } else download(blob, filename);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error && error.message === "IMAGE_TOO_LARGE"
        ? "이미지가 브라우저 PNG 생성 한도를 초과했습니다. 날짜 범위를 줄이거나 SVG로 내보내 주세요."
        : format === "png"
          ? "PNG 파일을 만들 수 없습니다. 범위를 줄이거나 SVG로 내보내 주세요."
          : "네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button ref={triggerRef} className="secondary-button" type="button" disabled={busy}
      onClick={() => { setMessage(null); setDateError(false); setOpen(true); }}>내보내기</button>
    {open ? <WorkspaceDialog title="내보내기" busy={busy} feedback={false} restoreFocusRef={triggerRef}
      onClose={() => { if (!busy) setOpen(false); }}>
      <div className={`project-form compact-form ${styles.form}`}>
        <label htmlFor="project-export-format">형식</label>
        <select id="project-export-format" ref={formatRef} value={format} disabled={busy} onChange={(event) => {
          setFormat(event.target.value as ExportFormat); setMessage(null); setDateError(false);
        }}>
          <option value="excel">Excel (.xlsx)</option>
          <option value="svg">SVG (.svg)</option>
          <option value="png">PNG (.png)</option>
        </select>
        {format === "excel" ? <fieldset disabled={busy}>
          <legend>작업 관계</legend>
          <label><input type="radio" name="excel-dependencies" checked={includeDependencies}
            onChange={() => setIncludeDependencies(true)} /> 관계 포함</label>
          <label><input type="radio" name="excel-dependencies" checked={!includeDependencies}
            onChange={() => setIncludeDependencies(false)} /> 관계 제외</label>
          <p>관계를 포함하면 Gantt 화살표와 관계 정보 시트가 생성됩니다.</p>
          <label><input type="checkbox" checked={includeLogistics} disabled={busy}
            onChange={(event) => setIncludeLogistics(event.target.checked)} /> 물류 구성 보고서 포함 (공정·설비·시스템·연결 시트)</label>
          <label><input type="checkbox" checked={includeResourceEffort} disabled={busy}
            onChange={(event) => setIncludeResourceEffort(event.target.checked)} /> 리소스 공수 견적 포함 (역할·개발자 Summary/Detail)</label>
        </fieldset> : <>
          <fieldset disabled={busy}>
            <legend>범위</legend>
            <label><input type="radio" name="gantt-export-scope" checked={scope === "project"}
              onChange={() => setScope("project")} /> 프로젝트 전체 (Grid와 차트)</label>
            <label><input type="radio" name="gantt-export-scope" checked={scope === "range"}
              onChange={() => setScope("range")} /> 날짜 범위 (차트만)</label>
          </fieldset>
          {scope === "range" ? <>
            <p>모든 작업 행을 유지하고 선택한 날짜의 차트만 잘라냅니다.</p>
            <label htmlFor="gantt-export-start">시작일</label>
            <input id="gantt-export-start" type="date" value={startDate} disabled={busy}
              aria-invalid={dateError} aria-describedby={dateError ? "gantt-export-error" : undefined}
              onChange={(event) => { setStartDate(event.target.value); setDateError(false); setMessage(null); }} />
            <label htmlFor="gantt-export-end">종료일</label>
            <input id="gantt-export-end" type="date" value={endDate} disabled={busy}
              aria-invalid={dateError} aria-describedby={dateError ? "gantt-export-error" : undefined}
              onChange={(event) => { setEndDate(event.target.value); setDateError(false); setMessage(null); }} />
          </> : null}
          <label htmlFor="gantt-export-scale">시간 단위</label>
          <select id="gantt-export-scale" value={scale} disabled={busy}
            onChange={(event) => setScale(event.target.value as "day" | "week")}>
            <option value="day">일</option><option value="week">주</option>
          </select>
        </>}
        {message ? <p id="gantt-export-error" role="alert">{message}</p> : null}
        <div className="form-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={() => void exportFile()}>
            {busy ? "생성 중…" : "내보내기"}
          </button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setOpen(false)}>취소</button>
        </div>
      </div>
    </WorkspaceDialog> : null}
  </>;
}
