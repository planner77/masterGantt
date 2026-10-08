"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";

import { WorkspaceDialog } from "@/components/workspace-dialog";
import type { ProjectJsonExportRequest } from "@/contracts/project-json-export";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";
import { resourceExportFilterNames, captureResourceExportLease, resourceExportBodyBudget, resourceExportCanDeliver, resourceExportDownloadToken,
  resourceExportGuardReason, resourceExportCanReconfirm, resourceExportIntent, type ResourceExportRejectedProof, type ResourceExportBasis, type ResourceExportEvidence,
  type ResourceExportGranularity, type ResourceExportLease } from "@/features/resources/resource-export-model";
import styles from "./project-export.module.css";

type ExportFormat = "excel" | "svg" | "png" | "json";
type JsonReview = { publicId:string; revision:number; parentRevision:number; mixedCount:number };
function mixedLinksFromSnapshot(value:unknown):number|null {
  if (!value || typeof value !== "object" || !("data" in value) || !value.data || typeof value.data !== "object") return null;
  const d=value.data as Record<string,unknown>; if(!Array.isArray(d.tasks)||!Array.isArray(d.links)) return null;
  const types=new Map<string,string>(); for(const t of d.tasks){if(!t||typeof t!=="object"||typeof t.externalId!=="string"||!["task","summary","milestone"].includes(t.type))return null;types.set(t.externalId,t.type);}
  let count=0;for(const link of d.links){if(!link||typeof link!=="object"||!types.has(link.predecessorExternalId)||!types.has(link.successorExternalId))return null;if(types.get(link.predecessorExternalId)!==types.get(link.successorExternalId))count++;}
  return count;
}
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

function downloadFilename(response: Response, publicId: string, revision: number, extension: "xlsx" | "svg" | "json"): string {
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

function ResourceReportEvidence({ lease, basis }: { lease: ResourceExportLease; basis: ResourceExportBasis }) {
  const report = lease.report, filters = report.filters;
  const names = resourceExportFilterNames;
  const rows = [
    ["개인", names(filters.resourceIds, report.catalog.resources)], ["Group", names(filters.groupIds, report.catalog.groups)],
    ["Milestone", names(filters.milestoneIds, report.catalog.milestones)],
    ["Task", names(filters.taskIds, report.catalog.wbsRoots)], ["WBS", names(filters.wbsRootIds, report.catalog.wbsRoots)],
    ["Role / Grade", `${filters.roles.join(", ") || "전체"} / ${filters.developerGrades.join(", ") || "전체"}`],
    ["검색 / Task 검색", `${filters.search || "없음"} / ${filters.taskSearch || "없음"}`],
    ["상태 / 개인·Group 활성", `${filters.statuses.join(", ") || "전체"} / ${filters.resourceActivity} · ${filters.groupActivity}`],
    ["시간대", report.timezone], ["Project / Catalog / Calendar revision", `${report.projectRevision} / ${report.catalogRevision} / ${report.calendarRevision}`],
    ["대상 범위", `고유 Task ${report.summary.taskCount} · Assignment ${report.summary.assignmentCount}`],
    ["이동 범위", lease.binding ? JSON.stringify(lease.binding.scope) : "이동 제한 없음"],
    ["대상 snapshot", report.snapshotId], ["대상 원장 fingerprint", report.resourceScopeContext?.dataSnapshotId ?? "없음"],
  ];
  return <details className={styles.evidence}>
    <summary>현재 조건과 원장 확인</summary>
    <p>{basis === "project" ? "아래 조회 조건과 exact 이동 범위는 추가 보고서의 Project 전체 선택에서 제외합니다. 기간·기준일·환산 정책은 유지합니다." : "현재 대상 보고서의 조건과 exact 이동 범위를 적용합니다."}</p>
    <dl>{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    {lease.binding ? <><p>원래 출발 문맥 (대상 보고서와 별도)</p><pre>{JSON.stringify(lease.binding.sourceContext, null, 2)}</pre></> : null}
  </details>;
}

export interface ProjectExportHandle { openResource: (trigger: HTMLButtonElement) => void }
export function ProjectExportButton({ publicId, expectedRevision = 0, ref, getResourceEvidence }: Readonly<{
  publicId: string; expectedRevision?: number; ref?: Ref<ProjectExportHandle>;
  getResourceEvidence?: () => ResourceExportEvidence | null;
}>) {
  const [includeResourceDashboard, setIncludeResourceDashboard] = useState(false);
  const [resourceBasis, setResourceBasis] = useState<ResourceExportBasis>("current");
  const [resourcePeriods, setResourcePeriods] = useState<ResourceExportGranularity[]>(["week", "month"]);
  const [rejectedProof, setRejectedProof] = useState<ResourceExportRejectedProof | null>(null);
  const [resourceLease, setResourceLease] = useState<ResourceExportLease | null>(null);
  const resourceOpened = useRef(false);
  const resourceLatest = useRef(getResourceEvidence);
  useLayoutEffect(() => { resourceLatest.current = getResourceEvidence; }, [getResourceEvidence]);
  const [jsonReview,setJsonReview]=useState<JsonReview|null>(null);
  const exportPending=useRef(false), exportGeneration=useRef(0), exportController=useRef<AbortController|null>(null), context=useRef({publicId,expectedRevision});
  useLayoutEffect(()=>{context.current={publicId,expectedRevision};},[publicId,expectedRevision]);
  useEffect(()=>()=>{exportGeneration.current++;exportController.current?.abort();},[]);
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
  const generalTriggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const origin = triggerRef.current, general = generalTriggerRef.current;
    return () => {
      requestAnimationFrame(() => {
        const visible = (node: HTMLElement | null): node is HTMLElement => !!node && node.isConnected &&
          !node.closest("[hidden], [inert]") && node.getClientRects().length > 0 && !node.matches(":disabled");
        if (visible(origin)) return;
        const activeTab = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')).find(visible);
        const fallback = activeTab ?? general;
        if (visible(fallback)) fallback.focus({ preventScroll: true });
      });
    };
  }, [open]);
  useImperativeHandle(ref, () => ({ openResource(trigger) {
    if (exportPending.current) return;
    triggerRef.current = trigger;
    if (!resourceOpened.current) {
      const lease = resourceLatest.current?.()?.lease;
      setResourceLease(lease ? captureResourceExportLease(lease) : null);
      setResourceBasis("current");
      resourceOpened.current = true;
    }
    setFormat("excel"); setIncludeResourceDashboard(true);
    setMessage(null); setDateError(false); setOpen(true);
  } }), []);
  const formatRef = useRef<HTMLSelectElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => formatRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  async function exportFile(acknowledgeMixed = false) {
    if (exportPending.current) return;
    if ((format === "svg" || format === "png") && scope === "range" && (!startDate || !endDate || startDate > endDate)) {
      setMessage("시작일과 종료일을 올바른 순서로 입력해 주세요.");
      setDateError(true);
      return;
    }
    const resourceExport = format === "excel" && includeResourceDashboard;
    const evidence = resourceLatest.current?.();
    if (resourceExport && rejectedProof !== null) { setMessage("새 보고서를 조회하고 명시적으로 확인해 주세요."); return; }
    if (resourceExport && (!resourceLease || !evidence || resourceExportGuardReason(resourceLease, evidence.live) !== null)) {
      setMessage("현재 리소스 보고서가 변경되었거나 조회가 완료되지 않았습니다. 보고서를 다시 조회하고 확인해 주세요.");
      return;
    }
    if (resourceExport && !resourcePeriods.length) { setMessage("주 또는 월을 하나 이상 선택해 주세요."); return; }
    const resourceOptions = resourceExport && resourceLease ? resourceExportIntent(resourceLease, resourceBasis, resourcePeriods) : undefined;
    exportPending.current=true;
    const id=++exportGeneration.current, request=new AbortController();exportController.current=request;
    const token = resourceOptions && resourceLease ? resourceExportDownloadToken(id, resourceLease, resourceOptions) : null;
    const current=()=> {
      if (request.signal.aborted || exportGeneration.current !== id || context.current.publicId !== publicId) return false;
      if (!token || !resourceOptions) return true;
      const latest = resourceLatest.current?.();
      return !!latest && resourceExportCanDeliver(token, id, true, false, latest.lease, latest.live, resourceOptions);
    };
    setBusy(true);
    setMessage(null);
    setDateError(false);
    try {
      let revision:number|null=null;
      if (resourceOptions && resourceLease) {
        revision = resourceLease.report.projectRevision;
      } else if(format === "json" && acknowledgeMixed && jsonReview){
        if(jsonReview.publicId!==publicId||jsonReview.parentRevision!==expectedRevision){setJsonReview(null);setMessage("프로젝트가 변경되어 JSON 검토가 만료되었습니다. 다시 내보내 주세요.");return;}
        revision=jsonReview.revision;
      }else{
        const snapshotResponse=await fetch(`/api/projects/${encodeURIComponent(publicId)}`,{credentials:"same-origin",cache:"no-store",signal:request.signal});
        const snapshot:unknown=await snapshotResponse.json().catch(()=>null);
        if(!current())return;
        revision=snapshotResponse.ok?revisionFromSnapshot(snapshot):null;
        if(format === "json" && revision!==null){
          const mixed=mixedLinksFromSnapshot(snapshot);
          if(mixed===null){setMessage("최신 관계 정보를 안전하게 확인할 수 없습니다. 다시 시도해 주세요.");return;}
          if(mixed>0){setJsonReview({publicId,revision,parentRevision:expectedRevision,mixedCount:mixed});return;}
        }
      }
      if(revision===null){setMessage("최신 프로젝트 정보를 확인할 수 없습니다. 다시 시도해 주세요.");return;}
      const body = format === "excel"
        ? { includeDependencies, includeLogistics, includeResourceEffort, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: exportLayout, ...(resourceOptions ? { resourceDashboard: resourceOptions } : {}) } satisfies ProjectExcelExportRequest
        : format === "json" ? { scope:"project" } satisfies ProjectJsonExportRequest
        : scope === "range"
          ? { scope, startDate, endDate, scale, hierarchyDisplay: "expanded" }
          : { scope, scale, hierarchyDisplay: "expanded" };
      if (!resourceExportBodyBudget(body).allowed) {
        setMessage("내보내기 요청이 8 KiB 한도를 초과했습니다. 범위를 줄여 다시 확인해 주세요. 전체 요청을 취소했습니다.");
        return;
      }
      if (!current()) { setMessage("보고서 조건이 변경되어 내보내기를 취소했습니다. 다시 조회하고 확인해 주세요."); return; }
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/exports/${format === "excel" ? "excel" : format === "json" ? "json" : "gantt-svg"}`, {
        method: "POST",
        signal:request.signal,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${revision}"`,
        },
        body: JSON.stringify(body),
      });
      if(!current()){setMessage("보고서 조건이 변경되어 늦게 도착한 파일을 폐기했습니다. 다시 조회하고 확인해 주세요.");return;}
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const code = errorCode(result);
        if (code === "EXPORT_RANGE_NO_OVERLAP") setDateError(true);
        if(response.status === 412)setJsonReview(null);
        if (resourceOptions && (response.status === 409 || response.status === 412))
          {
            const rejected = resourceLatest.current?.()?.lease ?? resourceLease!;
            setRejectedProof({ projectPublicId: rejected.report.projectPublicId, visitId: rejected.visitId, queryKey: rejected.queryKey, bindingKey: rejected.bindingKey,
              confirmationId: rejected.confirmationId });
          }
        setMessage(resourceOptions && (response.status === 409 || response.status === 412)
          ? "리소스 보고서의 원장 또는 환산 정책이 변경되었습니다. 보고서를 다시 조회하고 확인해 주세요."
          : response.status === 412
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
      const filename = downloadFilename(response, publicId, revision, format === "excel" ? "xlsx" : format === "json" ? "json" : "svg");
      if (format === "png") {
        const png = await rasterizeSvg(blob);
        if(!current())return;
        download(png, filename.replace(/\.svg$/i, ".png"));
      } else {
        if (!current()) { setMessage("보고서 조건이 변경되어 파일을 폐기했습니다. 다시 조회하고 확인해 주세요."); return; }
        download(blob, filename);
      }
      setOpen(false);
    } catch (error) {
      if(!current())return;
      setMessage(error instanceof Error && error.message === "IMAGE_TOO_LARGE"
        ? "이미지가 브라우저 PNG 생성 한도를 초과했습니다. 날짜 범위를 줄이거나 SVG로 내보내 주세요."
        : format === "png"
          ? "PNG 파일을 만들 수 없습니다. 범위를 줄이거나 SVG로 내보내 주세요."
          : "네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      if(exportGeneration.current===id){exportPending.current=false;setBusy(false);}
    }
  }

  return <>
    <button ref={generalTriggerRef} className="secondary-button" type="button" disabled={busy}
      onClick={(event) => { triggerRef.current = event.currentTarget;
        const lease = resourceLatest.current?.()?.lease;
        setResourceLease(lease ? captureResourceExportLease(lease) : null);
        setIncludeResourceDashboard(false); setMessage(null); setDateError(false); setOpen(true); }}>내보내기</button>
    {open ? <WorkspaceDialog title="내보내기" busy={busy} feedback={false} restoreFocusRef={triggerRef}
      onClose={() => { if (!exportPending.current) setOpen(false); }}>
      <div className={`project-form compact-form ${styles.form}`}>
        <label htmlFor="project-export-format">형식</label>
        <select id="project-export-format" ref={formatRef} value={format} disabled={busy} onChange={(event) => {
          setFormat(event.target.value as ExportFormat); setJsonReview(null); setMessage(null); setDateError(false);
        }}>
          <option value="excel">Excel (.xlsx)</option>
          <option value="json">JSON (.json)</option>
          <option value="svg">SVG (.svg)</option>
          <option value="png">PNG (.png)</option>
        </select>
        {format === "excel" ? <fieldset disabled={busy}>
          <legend>일정 Dependency</legend>
          <label><input type="radio" name="excel-dependencies" checked={includeDependencies}
            onChange={() => setIncludeDependencies(true)} /> 일정 Dependency 포함</label>
          <label><input type="radio" name="excel-dependencies" checked={!includeDependencies}
            onChange={() => setIncludeDependencies(false)} /> 일정 Dependency 제외</label>
          <p>일정 Dependency를 포함하면 Gantt 화살표와 관계 정보 시트가 생성됩니다. 명시·유효 단계 및 상속 출처는 이 선택과 관계없이 출력합니다.</p>
          <p>단계 요약은 서버 기본 프로젝트 전체 공수·오늘 Project timezone 기준·임박 14일·서버 환산 기준입니다. 현재 Dashboard의 검색·선택·공수 조건·수동 기준일은 적용하지 않습니다.</p>
          <label><input type="checkbox" checked={includeLogistics} disabled={busy}
            onChange={(event) => setIncludeLogistics(event.target.checked)} /> 물류 구성 보고서 포함 (공정·설비·시스템·연결 시트)</label>
          <label><input type="checkbox" checked={includeResourceDashboard}
            onChange={event => { setIncludeResourceDashboard(event.target.checked); setMessage(null); }} /> 리소스 현황 보고서 포함 (7개 시트)</label>
          {includeResourceDashboard ? <div className={styles.resourceReport}>
            <p>아래 범위는 추가 리소스 7개 시트에만 적용합니다. 기존 일정·단계·물류·견적 시트는 Project 전체 기준입니다.</p>
            <label><input type="radio" name="resource-report-basis" checked={resourceBasis === "current"}
              onChange={() => setResourceBasis("current")} /> 현재 선택 조건</label>
            <label><input type="radio" name="resource-report-basis" checked={resourceBasis === "project"}
              onChange={() => setResourceBasis("project")} /> Project 전체 (확인된 기간·기준일·환산 정책 유지)</label>
            <p>Project 전체는 분류·Task·WBS·Milestone·검색·상태·이동 배정 범위를 제외합니다. 화면 조건과 이동 기록은 유지합니다.</p>
            {resourceLease?.report.resourceScopeContext ? <>
              <p>대상 보고서: {resourceLease.report.range.from} ~ {resourceLease.report.range.to} · 기준일 {resourceLease.report.asOfDate}
                {" · "}환산 {resourceLease.report.mdPerMm ?? "미설정"} ({resourceLease.report.mdPerMmSource})</p>
              {resourceLease.binding ? <p>원래 이동 출발: {resourceLease.binding.sourceContext.range.from} ~ {resourceLease.binding.sourceContext.range.to}
                {" · "}기준일 {resourceLease.binding.sourceContext.asOfDate} · 환산 {resourceLease.binding.sourceContext.mdPerMm ?? "미설정"}
                {" "}({resourceLease.binding.sourceContext.mdPerMmSource})</p> : null}
            </> : <p role="status">Resource 화면에서 보고서 조회를 완료한 뒤 다시 확인해 주세요.</p>}
            {resourceLease ? <ResourceReportEvidence lease={resourceLease} basis={resourceBasis} /> : null}
            <div role="group" aria-label="리소스 계획 기간">
              {(["week", "month"] as const).map(period => <label key={period}>
                <input type="checkbox" checked={resourcePeriods.includes(period)} onChange={event => setResourcePeriods(previous =>
                  event.target.checked ? [...previous, period] : previous.filter(value => value !== period))} /> {period === "week" ? "주 계획" : "월 계획"}
              </label>)}
            </div>
            <button type="button" className="secondary-button" disabled={busy}
              onClick={() => { const latest = resourceLatest.current?.(); latest?.refresh(); setMessage("보고서를 다시 조회했습니다. 조회가 완료되면 현재 보고서 확인을 눌러 주세요."); }}>보고서 다시 조회</button>
            <button type="button" className="secondary-button" disabled={busy}
              onClick={() => { const latest = resourceLatest.current?.();
                if (latest?.lease && resourceExportCanReconfirm(rejectedProof, latest.lease, latest.live)) {
                  setResourceLease(captureResourceExportLease(latest.lease)); setRejectedProof(null); setMessage(null);
                } else setMessage("현재 Resource 보기에서 조회를 완료한 뒤 확인해 주세요."); }}>현재 보고서 확인</button>
          </div> : null}
          <label><input type="checkbox" checked={includeResourceEffort} disabled={busy}
            onChange={(event) => setIncludeResourceEffort(event.target.checked)} /> 리소스 공수 견적 포함 (역할·개발자 Summary/Detail)</label>
        </fieldset> : format === "json" ? <>
          <p>JSON 1.1은 프로젝트 전체 일정·일정 Dependency·명시 단계 소속을 보존합니다. Description·URL·Baseline을 포함하며 Resource·Logistics는 제외합니다.</p>
          <p>작업 UUID는 원본 참고 metadata입니다. 가져오기 대상의 Task UUID는 새로 생성하고 대상 Calendar를 적용합니다.</p>
          {jsonReview ? <p role="alert">검토 revision {jsonReview.revision}: 서로 다른 유형의 기존 Dependency {jsonReview.mixedCount}개를 원형대로 내보냅니다. 이 파일은 현재 JSON 가져오기의 유형 제한으로 다시 가져올 수 없습니다. 관계를 삭제하지 않습니다.</p> : null}
        </> : <>
          <p>이미지의 전체 Grid는 작업명·시작일·기간 고정 열입니다. 화면의 선택 열 전체나 단계 소속 상세는 포함하지 않으며, 단계 정보는 Excel·JSON으로 내보내 주세요.</p>
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
          <button className="primary-button" type="button" disabled={busy || (format === "excel" && includeResourceDashboard && rejectedProof !== null)} onClick={() => void exportFile(format === "json" && jsonReview !== null)}>
            {busy ? "생성 중…" : format === "json" && jsonReview ? "원본 관계를 포함하여 JSON 다운로드" : "내보내기"}
          </button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => { if(!exportPending.current)setOpen(false); }}>취소</button>
        </div>
      </div>
    </WorkspaceDialog> : null}
  </>;
}
