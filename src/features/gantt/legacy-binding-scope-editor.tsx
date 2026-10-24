"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./project-task-editor.module.css";

interface Source {
  sourceId: string;
  sourceTaskId: string;
  scope: "self" | "subtree";
  selection: "whole" | "subset";
  memberCount: number;
  sourceFingerprint: string;
  canEditScope: boolean;
}
interface Impact {
  projectRevision: number;
  sourceId: string;
  beforeScope: "self" | "subtree";
  afterScope: "self" | "subtree";
  selection: "whole" | "subset";
  memberCount: number;
  affectedTaskIds: string[];
  impactToken: string;
}
interface Props {
  taskId: string;
  revision: number;
  editable: boolean;
  disabled: boolean;
  sourceNames: ReadonlyArray<{sourceId: string; label: string}>;
  onApplied: () => Promise<void>;
  onUnauthorized?: () => void;
  /** Lock the surrounding Task Editor for the entire PATCH + canonical reload. */
  onPendingChange?: (pending: boolean) => void;
}

/** Opt-in, independent of the ordinary direct Equipment/System editor draft. */
export function LegacyBindingScopeEditor({taskId, revision, editable, disabled, sourceNames, onApplied, onUnauthorized, onPendingChange}: Props) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [scope, setScope] = useState<"self" | "subtree">("self");
  const [preview, setPreview] = useState<Impact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current += 1;
    setOpen(false); setSources([]); setSelectedId(""); setPreview(null); setBusy(false); setError(null);
  }, [taskId, revision]);
  const selected = sources.find(source => source.sourceId === selectedId);
  const sourceNamesById = new Map<string, string>(sourceNames.map(source => [source.sourceId, source.label] as const));
  const path = () => {
    const match = /^\/projects\/([^/]+)\/?$/.exec(window.location.pathname);
    if (!match) throw new Error("프로젝트 경로를 확인할 수 없습니다.");
    return `/api/projects/${encodeURIComponent(decodeURIComponent(match[1]))}/tasks/${encodeURIComponent(taskId)}/legacy-binding-sources`;
  };
  const report = (status: number, body: unknown) => {
    if (status === 401) onUnauthorized?.();
    const code = (body as {error?:{code?:string}} | null)?.error?.code;
    setPreview(null);
    setError(status === 409 || status === 412
      ? `원본 또는 프로젝트가 변경되었습니다(${code ?? status}). 최신 정보를 다시 불러온 후 재검토하세요.`
      : `기존 관계 요청이 차단되었습니다(${code ?? status}). 편집 권한·원본 무결성을 확인하세요.`);
  };
  async function refresh() {
    const generation = ++epoch.current;
    setBusy(true); setError(null); setPreview(null);
    try {
      const response = await fetch(path(), {cache:"no-store"});
      const body = await response.json();
      if (generation !== epoch.current) return;
      if (!response.ok) { report(response.status, body); return; }
      if (body?.data?.projectRevision !== revision || !Array.isArray(body.data.sourceBindings)) {
        setError("원본 Revision을 확인할 수 없습니다. 최신 정보를 다시 불러오세요."); return;
      }
      const allowed = new Set(sourceNames.map(source => source.sourceId));
      const entries = (body.data.sourceBindings as Source[]).filter(item =>
        allowed.has(item.sourceId) && item.sourceTaskId === taskId && item.canEditScope === true);
      if (!entries.length) { setError("수정 가능한 직접 원본이 없습니다."); return; }
      setSources(entries); setSelectedId(entries[0].sourceId); setScope(entries[0].scope); setOpen(true);
    } catch { if (generation === epoch.current) setError("기존 관계를 조회할 수 없습니다. 연결 상태를 확인하세요."); }
    finally { if (generation === epoch.current) setBusy(false); }
  }
  async function mutate(mode: "preview" | "apply") {
    if (!selected || busy || disabled || !editable) return;
    const generation = ++epoch.current;
    const expected = preview;
    // A confirmed source mutation can refresh the whole Task Editor. Hold its
    // shared pending lock before issuing PATCH, through onApplied/reload.
    if (mode === "apply") onPendingChange?.(true);
    setBusy(true); setError(null);
    if (mode === "preview") setPreview(null);
    try {
      const response = await fetch(path(), {
        method: mode === "preview" ? "POST" : "PATCH",
        headers: {"If-Match":`"${revision}"`,"Content-Type":"application/json"},
        body: JSON.stringify({sourceId:selected.sourceId,scope,sourceFingerprint:selected.sourceFingerprint,
          ...(mode === "apply" ? {confirmImpact:true,impactToken:expected?.impactToken} : {})}),
      });
      const body = await response.json();
      if (generation !== epoch.current) return;
      if (!response.ok) { report(response.status, body); return; }
      if (mode === "preview") {
        if (body?.data?.projectRevision !== revision || body.data.sourceId !== selected.sourceId ||
            body.data.afterScope !== scope || typeof body.data.impactToken !== "string" ||
            !Array.isArray(body.data.affectedTaskIds)) {
          setError("영향 분석 결과를 확인할 수 없습니다."); return;
        }
        setPreview(body.data as Impact);
      } else {
        if (body?.data?.projectRevision !== revision+1 || body.data.sourceId !== selected.sourceId) {
          setError("응답을 확인할 수 없습니다. 최신 상태를 다시 조회해 변경 여부를 확인하세요."); return;
        }
        setOpen(false); setSources([]); setPreview(null);
        await onApplied();
      }
    } catch { if (generation === epoch.current) {
      setPreview(null); setError("네트워크 오류 또는 저장 확인 실패입니다. 최신 자료를 다시 조회해 중복 적용을 방지하세요.");
    }}
    finally {
      if (mode === "apply") onPendingChange?.(false);
      if (generation === epoch.current) setBusy(false);
    }
  }
  return <div className={styles.contextRow}>
    {!open ? <button type="button" className="secondary-button"
      disabled={!editable || disabled || busy} onClick={() => void refresh()}>
      기존 관계 적용 범위 수정
    </button> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {open ? <section aria-label="기존 관계 범위 안전 편집">
      <p className={styles.note}>원본 UUID·whole/subset·coverage·출처 공정/구역은 변경하지 않습니다. 상위 Summary의 적용 범위만 변경하며, 영향 확인 후 저장합니다.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",alignItems:"center"}}>
        <label>원본 관계
          <select value={selectedId} disabled={busy} onChange={event=>{
            const id=event.target.value, source=sources.find(item=>item.sourceId===id);
            setSelectedId(id); setScope(source?.scope ?? "self"); setPreview(null);
          }}>
            {sources.map((source,index)=><option key={source.sourceId} value={source.sourceId}>
              {sourceNamesById.get(source.sourceId)?.trim() || "기존 연결"} {index+1} · {source.selection === "whole" ? "전체 구성" : "선택 구성"}
            </option>)}
          </select>
        </label>
        <label>적용 범위
          <select value={scope} disabled={busy} onChange={event=>{
            setScope(event.target.value as "self" | "subtree"); setPreview(null);
          }}>
            <option value="self">이 작업만</option><option value="subtree">하위 작업 포함</option>
          </select>
        </label>
        <button type="button" className="secondary-button" disabled={busy || disabled || scope === selected?.scope}
          onClick={()=>void mutate("preview")}>영향 미리보기</button>
        <button type="button" className="secondary-button" disabled={busy}
          onClick={()=>{ epoch.current+=1; setBusy(false); setOpen(false);setPreview(null);setError(null);}}>취소</button>
      </div>
      {preview ? <div role="status" aria-live="polite">
        <p className={styles.note}>영향 작업 {preview.affectedTaskIds.length}개 · 구성원 {preview.memberCount}개 · {preview.beforeScope === "self" ? "자체" : "하위 포함"} → {preview.afterScope === "self" ? "자체" : "하위 포함"}. 직접 연결·coverage 및 원본 식별자는 보존됩니다.</p>
        <button type="button" className="primary-button" disabled={busy || disabled || scope !== preview.afterScope}
          onClick={()=>void mutate("apply")}>영향을 확인하고 적용</button>
      </div> : null}
    </section> : null}
  </div>;
}
