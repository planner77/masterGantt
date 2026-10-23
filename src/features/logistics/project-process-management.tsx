"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { ProcessCatalogItemDto, ProcessCatalogKind, ProcessCatalogResponse, ProcessStandardDiffResponse, ProcessContextResponse, ProjectProcessMappingResponse } from "@/contracts/process-catalog";
import type { ProjectMasterSelectionResponse } from "@/contracts/project-master";
import type { ProjectLogisticsDto } from "@/contracts/logistics";
import type { ProjectDto } from "@/contracts/projects";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import styles from "./project-process-management.module.css";

const labels: Record<ProcessCatalogKind, string> = { types: "공정 유형", standards: "제품 표준 공정", occurrences: "현장 공정", workAreas: "작업 구역" };
const paths: Record<ProcessCatalogKind, string> = { types: "types", standards: "standards", occurrences: "occurrences", workAreas: "work-areas" };
function validCatalog(value: unknown): value is ProcessCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data as ProcessCatalogResponse["data"] | undefined;
  return !!data && Number.isSafeInteger(data.processCatalogRevision) && [data.types, data.standards, data.occurrences, data.workAreas].every(items => Array.isArray(items) && items.every(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.active === "boolean" && Number.isSafeInteger(item.usageCount)));
}
function errorText(status: number): string {
  if (status === 412) return "다른 사용자의 변경이 먼저 저장되었습니다. 최신 목록을 확인한 뒤 다시 시도해 주세요.";
  if (status === 409) return "사용 중이거나 중복되는 항목입니다. 연결 관계를 확인하거나 비활성화를 사용해 주세요.";
  if (status === 401 || status === 403) return "권한을 확인할 수 없습니다. 해당 편집 권한을 다시 활성화해 주세요.";
  return "저장하지 못했습니다. 필수 항목과 활성 상태를 확인한 뒤 다시 시도해 주세요.";
}

export function ProjectProcessManagement(props: Parameters<typeof LegacyProjectProcessManagement>[0]) {
  const [expanded,setExpanded]=useState(false);
  return <details hidden={!props.active} className={styles.admin} open={props.wbsWorkAreaOpenRequest ? true : undefined} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>기존 공용 기준정보 및 연결 (고급)</summary>{expanded || props.wbsWorkAreaOpenRequest?<LegacyProjectProcessManagement {...props}/>:null}</details>;
}

export function LegacyProjectProcessManagement({ publicId, revision, editable, active, busy: externalBusy, logistics, onMutated, onRequireRefresh, onUnauthorized, onNotice, wbsWorkAreaOpenRequest, onWbsWorkAreaRequestHandled }: {
  wbsWorkAreaOpenRequest?: {id:string;sequence:number;trigger:HTMLElement} | null; onWbsWorkAreaRequestHandled?: () => void;
  publicId: string; revision: number; editable: boolean; active: boolean; busy: boolean; logistics: ProjectLogisticsDto;
  onMutated: (logistics: ProjectLogisticsDto, project: ProjectDto) => void;
  onRequireRefresh: () => void; onUnauthorized: () => void; onNotice: (message: string) => void;
}) {
  const [context, setContext] = useState<ProcessContextResponse["data"] | null>(null);
  const [contextKey, setContextKey] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapping, setMapping] = useState<{ processId: string; occurrenceId: string; workAreaId: string; revision: number; catalogRevision: number } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const pending = useRef(false);
  const initialMapping = useRef("");
  const [discardMapping, setDiscardMapping] = useState(false);
  function closeMapping() { if (JSON.stringify(mapping) !== initialMapping.current) setDiscardMapping(true); else setMapping(null); }
  const key = `${publicId}:${revision}:${editable}`;
  const loadContext = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/process-context`, { credentials: "same-origin", cache: "no-store", signal });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !validCatalog(value) || !("permission" in value.data) || !("mappings" in value.data) || !Array.isArray(value.data.mappings)) throw new Error("context");
    if (signal?.aborted) return;
    setContext(value.data as ProcessContextResponse["data"]); setContextKey(key);
  }, [publicId, key]);
  useEffect(() => { if (!active || contextKey === key) return; const c = new AbortController(); void Promise.resolve().then(() => loadContext(c.signal)).catch(() => { if (!c.signal.aborted) { setContext(null); setError("현장 공정 정보를 불러오지 못했습니다. 다시 불러오기를 선택해 주세요."); } }); return () => c.abort(); }, [loadContext, active, contextKey, key]);
  const current = !!context && contextKey === key && context.projectRevision === revision;
  const mappingCurrent = current && (!mapping || (mapping.revision === revision && mapping.catalogRevision === context?.processCatalogRevision));
  async function saveMapping(event: FormEvent) {
    event.preventDefault();
    if (!mapping || !context || !mappingCurrent || pending.current || !editable || context.permission !== "edit") return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/process-mappings/${encodeURIComponent(mapping.processId)}`, {
        method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": `"${mapping.revision}"` },
        body: JSON.stringify({ occurrenceId: mapping.occurrenceId || null, workAreaId: mapping.workAreaId || null, processCatalogRevision: mapping.catalogRevision }),
      });
      const value = await response.json().catch(() => null) as ProjectProcessMappingResponse | null;
      if (!response.ok || !value?.data?.project || !value.data.logistics || !Number.isSafeInteger(value.data.project.revision) || !Array.isArray(value.data.mappings) || value.data.processCatalogRevision !== mapping.catalogRevision) {
        if (response.status === 401 || response.status === 403) onUnauthorized();
        if (response.status === 412) { onRequireRefresh(); setContextKey(""); }
        setError(errorText(response.status)); return;
      }
      // The mapping transaction returns the matching project/context snapshot.
      // Publish it with the parent revision so the dialog's original trigger
      // remains enabled when WorkspaceDialog restores focus on close.
      setContext({ ...context, projectRevision: value.data.project.revision, mappings: value.data.mappings, processCatalogRevision: value.data.processCatalogRevision });
      setContextKey(`${publicId}:${value.data.project.revision}:${editable}`);
      onMutated(value.data.logistics, value.data.project); setMapping(null);
    } catch { setError("공정 연결 서버에 연결할 수 없습니다. 입력 내용은 유지됩니다."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.section} aria-labelledby="project-process-mapping-title" aria-busy={busy} hidden={!active}>
    <div className={styles.heading}><h2 id="project-process-mapping-title">공정 &amp; 작업 구역 관리</h2><button type="button" className="secondary-button" disabled={busy || externalBusy} onClick={() => { setError(null); setNotice(null); void loadContext().catch(() => setError("현장 공정 정보를 불러오지 못했습니다.")); }}>현장 공정 다시 불러오기</button></div>
    <p className={styles.note}>프로젝트 공정은 아래 목록에서 관리합니다. 현장 공정 연결은 프로젝트 편집 권한으로, 공용 기준정보는 별도 관리자 권한으로 저장합니다.</p>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {!context ? <p role="status">현장 공정 정보를 불러오는 중이거나 사용할 수 없습니다.</p> : <>
      {!context.selectionValid ? <p className={styles.note}>프로젝트 분류가 지정되지 않았습니다. 기존 프로젝트 공정은 계속 편집할 수 있으며, 현장 공정 연결에는 유효한 사업부·제품·현장 분류가 필요합니다.</p> : null}
      <div className={styles.tableScroll}><table><caption>프로젝트 공정별 현장 공정 연결</caption><thead><tr><th>프로젝트 공정</th><th>현장 공정</th><th>기본 구역 (호환)</th><th>관리</th></tr></thead><tbody>
        {logistics.processes.map(process => { const selected = context.mappings.find(item => item.processId === process.id); const occurrence = context.occurrences.find(item => item.id === selected?.occurrenceId); const area = context.workAreas.find(item => item.id === selected?.workAreaId); return <tr key={process.id}><th scope="row">{process.name}<span className={styles.code}>{process.code}</span>{!process.active ? " · 비활성" : ""}</th><td>{occurrence?.name ?? (selected ? "기존 연결 (현재 분류 밖)" : "미연결")}{selected && !selected.active ? " · 비활성" : ""}</td><td>{area?.name ?? (selected?.workAreaId ? `기존 기본 구역 (현재 분류 밖/확인 불가) · ${selected.workAreaId}` : "미지정")}</td><td><button type="button" className="secondary-button" disabled={busy || externalBusy || !editable || context.permission !== "edit" || !current || (!context.selectionValid && !selected)} onClick={event => { trigger.current = event.currentTarget; const next = { processId: process.id, occurrenceId: selected?.occurrenceId ?? "", workAreaId: selected?.workAreaId ?? "", revision, catalogRevision: context.processCatalogRevision }; initialMapping.current = JSON.stringify(next); setMapping(next); }}>연결 설정<span className={styles.srOnly}> {process.name}</span></button></td></tr>; })}
        {!logistics.processes.length ? <tr><td colSpan={4}>등록된 프로젝트 공정이 없습니다. 아래에서 공정을 추가하세요.</td></tr> : null}
      </tbody></table></div>
    </>}
    {discardMapping ? <WorkspaceDialog title="공정 연결 변경 내용 버리기" onClose={() => setDiscardMapping(false)}><p>저장하지 않은 연결 변경 내용이 있습니다.</p><div className={styles.actions}><button type="button" className="secondary-button" onClick={() => setDiscardMapping(false)}>계속 편집</button><button type="button" className="danger-button" onClick={() => { setDiscardMapping(false); setMapping(null); }}>변경 내용 버리기</button></div></WorkspaceDialog> : null}
    <ProcessCatalogAdmin active={active} openWorkAreaRequest={wbsWorkAreaOpenRequest} onWorkAreaRequestHandled={onWbsWorkAreaRequestHandled} onChanged={() => { const message = "공용 기준정보가 저장되었습니다. 현재 프로젝트에는 아직 미적용입니다. 현장 공정 다시 불러오기를 선택해 주세요."; setNotice(message); onNotice(message); }} />
    {mapping && context ? <WorkspaceDialog title="프로젝트 공정 연결 설정" busy={busy} restoreFocusRef={trigger} onClose={closeMapping}><form onSubmit={event => void saveMapping(event)} className={styles.form}>
      <p className={styles.note}>현장 공정과 선택 작업 구역을 연결합니다. 기존 연결은 명시적으로 해제할 수 있습니다.</p>
      <label>현장 공정<select ref={element => { element?.setAttribute("autofocus", ""); }} value={mapping.occurrenceId} disabled={busy || !mappingCurrent} onChange={event => setMapping({ ...mapping, occurrenceId: event.target.value, workAreaId: "" })}><option value="">연결 해제</option>{!context.occurrences.some(item => item.id === mapping.occurrenceId) && mapping.occurrenceId ? <option value={mapping.occurrenceId}>기존 연결 (현재 분류 밖)</option> : null}{context.occurrences.map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== mapping.occurrenceId}>{item.code} · {item.name}{!item.active ? " · 비활성" : ""}</option>)}</select></label>
      <label>공정 매핑 기본 구역 (호환)<select value={mapping.workAreaId} disabled={busy || !mappingCurrent || !mapping.occurrenceId} onChange={event => setMapping({ ...mapping, workAreaId: event.target.value })}><option value="">미지정</option>{mapping.workAreaId && !context.workAreas.some(item => item.id === mapping.workAreaId) ? <option value={mapping.workAreaId}>기존 기본 구역 (현재 분류 밖/확인 불가) · {mapping.workAreaId}</option> : null}{context.workAreas.filter(item => item.occurrenceId === mapping.occurrenceId).map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== mapping.workAreaId}>{item.code} · {item.name}{!item.active ? " · 비활성" : ""}</option>)}</select></label>
      {!mappingCurrent ? <p role="alert">프로젝트 정보가 변경되었습니다. 닫은 뒤 최신 연결을 확인해 주세요.</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}<div className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={closeMapping}>취소</button><button type="submit" className="primary-button" disabled={busy || externalBusy || !editable || !mappingCurrent}>{busy ? "저장 중…" : "연결 저장"}</button></div>
    </form></WorkspaceDialog> : null}
  </section>;
}

function ProcessCatalogAdmin({ onChanged, active, openWorkAreaRequest, onWorkAreaRequestHandled }: { onChanged: () => void; active: boolean; openWorkAreaRequest?: {id:string;sequence:number;trigger:HTMLElement} | null; onWorkAreaRequestHandled?: () => void }) {
  const [catalog, setCatalog] = useState<ProcessCatalogResponse["data"] | null>(null);
  const [master, setMaster] = useState<ProjectMasterSelectionResponse["data"] | null>(null);
  const [password, setPassword] = useState("");
  const [kind, setKind] = useState<ProcessCatalogKind>("types");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("order");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; code: string; name: string; sortOrder: number; active: boolean; productId: string; processTypeId: string; businessUnitId: string; siteEntityId: string; occurrenceId: string } | null>(null);
  const [deleting, setDeleting] = useState<ProcessCatalogItemDto | null>(null);
  const [triple, setTriple] = useState({ businessUnitId: "", productId: "", siteEntityId: "" });
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [standardDiff, setStandardDiff] = useState<ProcessStandardDiffResponse["data"] | null>(null);
  const [diffKey, setDiffKey] = useState("");
  const pending = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const initialDraft = useRef("");
  const [draftRevision, setDraftRevision] = useState(0);
  const [catalogStale, setCatalogStale] = useState(false);
  const [draftInvalidated, setDraftInvalidated] = useState(false);
  const [discardDraft, setDiscardDraft] = useState(false);
  function closeDraft() { if (JSON.stringify(draft) !== initialDraft.current) setDiscardDraft(true); else setDraft(null); }
  async function load(signal?: AbortSignal) {
    const [response, masterResponse] = await Promise.all([fetch("/api/process-catalog/admin", { credentials: "same-origin", cache: "no-store", signal }), fetch("/api/project-master/admin/items", { credentials: "same-origin", cache: "no-store", signal })]);
    const value: unknown = await response.json().catch(() => null);
    const masters = await masterResponse.json().catch(() => null) as ProjectMasterSelectionResponse | null;
    if (!response.ok || !validCatalog(value)) { if (response.status === 401 || response.status === 403) setCatalog(null); else setError("공정 기준정보를 조회하지 못했습니다. 관리자 인증 상태를 확인하고 다시 조회해 주세요."); throw new Error("catalog"); }
    if (signal?.aborted) return;
    setCatalog(value.data);
    if (masterResponse.ok && masters?.data && Array.isArray(masters.data.products)) setMaster(masters.data);
  }
  useEffect(() => { if (!active || catalog) return; const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)).catch(() => {}); return () => controller.abort(); }, [active, catalog]);
  async function login(event: FormEvent) {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError(null);
    const submitted = password; setPassword("");
    try { const response = await fetch("/api/project-master/admin-sessions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: submitted }) }); if (!response.ok) { setError("공정 기준정보 관리자 인증에 실패했습니다."); return; } await load(); }
    catch { setError("공정 기준정보를 불러오지 못했습니다."); } finally { pending.current = false; setBusy(false); }
  }
  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    if (!catalog || catalogStale || pending.current) return false; pending.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/process-catalog/admin/${path}`, { method, credentials: "same-origin", headers: { "If-Match": `"${catalog.processCatalogRevision}"`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok || !validCatalog(value)) { if (response.status === 401 || response.status === 403) { setCatalog(null); setCatalogStale(true); setDraftInvalidated(true); } if (response.status === 412) { setCatalogStale(true); setDraftInvalidated(true); setDeleting(null); } setError(errorText(response.status)); return false; }
      setCatalog(value.data); setNotice("공정 기준정보를 저장했습니다."); onChanged(); return true;
    } catch { setError("서버에 연결할 수 없습니다. 입력 내용은 유지됩니다."); return false; } finally { pending.current = false; setBusy(false); }
  }
  async function checkStandardDiff() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setStandardDiff(null);
    try {
      const response = await fetch(`/api/process-catalog/admin/standard-diff?${new URLSearchParams(triple)}`, { credentials: "same-origin", cache: "no-store" });
      const value = await response.json().catch(() => null) as ProcessStandardDiffResponse | null;
      if (!response.ok || !value?.data?.standardDiff || !Array.isArray(value.data.standardDiff.changed)) { setError("표준 변경점을 확인할 수 없습니다. 분류와 관리자 권한을 확인해 주세요."); return; }
      setStandardDiff(value.data); setDiffKey(JSON.stringify(triple));
    } catch { setError("표준 변경점을 불러오지 못했습니다. 다시 시도해 주세요."); }
    finally { pending.current = false; setBusy(false); }
  }
  function beginEdit(event: MouseEvent<HTMLButtonElement>, item?: ProcessCatalogItemDto) {
    openCatalogDraft(event.currentTarget, item);
  }
  const openCatalogDraft = useCallback((element: HTMLElement, item?: ProcessCatalogItemDto) => {
    trigger.current = element;
    setDraftRevision(catalog?.processCatalogRevision ?? 0); setDraftInvalidated(false);
    const full = item as (ProcessCatalogItemDto & Partial<{ productId: string; processTypeId: string; businessUnitId: string; siteEntityId: string; occurrenceId: string }>) | undefined;
    const next = { id: item?.id, code: item?.code ?? "", name: item?.name ?? "", sortOrder: item?.sortOrder ?? 0, active: item?.active ?? true, productId: full?.productId ?? "", processTypeId: full?.processTypeId ?? "", businessUnitId: full?.businessUnitId ?? "", siteEntityId: full?.siteEntityId ?? "", occurrenceId: full?.occurrenceId ?? "" }; initialDraft.current = JSON.stringify(next); setDraft(next);
  }, [catalog?.processCatalogRevision]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || catalogStale || draftInvalidated || draftRevision !== catalog?.processCatalogRevision) return;
    const { id, code, name, sortOrder, active, productId, processTypeId, businessUnitId, siteEntityId, occurrenceId } = draft;
    const body = { code: code.trim(), name: name.trim(), sortOrder, active, ...(kind === "standards" || kind === "occurrences" ? { productId, processTypeId } : {}), ...(kind === "occurrences" ? { businessUnitId, siteEntityId } : {}), ...(kind === "workAreas" ? { occurrenceId } : {}) };
    if (await mutate(`${paths[kind]}${id ? `/${encodeURIComponent(id)}` : ""}`, id ? "PATCH" : "POST", body)) setDraft(null);
  }
  function occurrenceLabel(item: ProcessCatalogResponse["data"]["occurrences"][number]) {
    return `${item.name} · ${item.code} · ${master?.siteEntities.find(row => row.id === item.siteEntityId)?.name ?? item.siteEntityId} / ${master?.products.find(row => row.id === item.productId)?.name ?? item.productId} / ${catalog?.types.find(row => row.id === item.processTypeId)?.name ?? item.processTypeId}`;
  }
  const handledWorkArea = useRef<number | null>(null);
  const workAreaDraftOpen = useRef(false);
  const workAreaDraftObserved = useRef(false);
  useEffect(() => {
    if (!active || !openWorkAreaRequest || !catalog || busy || draft || catalogStale || handledWorkArea.current === openWorkAreaRequest.sequence) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      handledWorkArea.current = openWorkAreaRequest.sequence;
      const item = catalog.workAreas.find(row => row.id === openWorkAreaRequest.id);
      if (!item) {setError("선택한 작업 구역 원본을 확인할 수 없습니다. 최신 조회에서 다시 선택해 주세요.");return;}
      setKind("workAreas"); setSearch(""); setStatus("all");
      workAreaDraftOpen.current = true;
      openCatalogDraft(openWorkAreaRequest.trigger,item);
    });
    return () => {cancelled=true;};
  }, [active,openWorkAreaRequest,catalog,busy,draft,catalogStale,openCatalogDraft]);
  useEffect(() => {
    if (draft && workAreaDraftOpen.current) workAreaDraftObserved.current=true;
    if (!draft && workAreaDraftOpen.current && workAreaDraftObserved.current) {workAreaDraftOpen.current=false;workAreaDraftObserved.current=false;onWorkAreaRequestHandled?.();}
  }, [draft,onWorkAreaRequestHandled]);
  function parentLabel(item: ProcessCatalogItemDto) {
    if (!catalog) return "";
    if (kind === "workAreas" && "occurrenceId" in item) return (() => { const owner = catalog.occurrences.find(row => row.id === item.occurrenceId); return owner ? occurrenceLabel(owner) : "현장 공정"; })();
    if (kind === "occurrences" && "siteEntityId" in item) return occurrenceLabel(item as ProcessCatalogResponse["data"]["occurrences"][number]);
    if (kind === "standards" && "processTypeId" in item && "productId" in item) return `${master?.products.find(row => row.id === item.productId)?.name ?? item.productId} / ${catalog.types.find(row => row.id === item.processTypeId)?.name ?? "공정 유형"}`;
    return "—";
  }
  const filtered = (catalog?.[kind] ?? []).filter(item => (status === "all" || item.active === (status === "active")) && `${item.code} ${item.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "ko") : a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  return <details className={styles.admin} open={openWorkAreaRequest ? true : undefined}><summary>공용 공정 기준정보 관리 (관리자)</summary>
    {openWorkAreaRequest ? <p role="status">선택한 작업 구역 원본을 엽니다. 공용 기준정보 변경에는 별도 관리자 인증이 필요합니다. <button type="button" className="secondary-button" disabled={busy || !!draft} onClick={onWorkAreaRequestHandled}>원래 계층 조회로 돌아가기</button></p> : null}
    <p className={styles.note}>공정 유형 → 제품 표준 공정 → 현장 공정 → 작업 구역을 관리합니다. 작업 구역은 하나의 현장 공정에 속합니다. 프로젝트 편집 권한과 관리자 권한은 별도입니다.</p>
    {catalogStale ? <p role="alert">기준정보가 변경되어 저장을 잠갔습니다. 최신 기준정보를 확인한 뒤 기존 편집 창을 닫고 항목을 다시 열어 변경 내용을 검토해 주세요.</p> : null}
    {catalogStale ? <button type="button" className="secondary-button" disabled={busy} onClick={() => { setBusy(true); void load().then(() => { setCatalogStale(false); setNotice("최신 기준정보를 조회했습니다. 기존 편집 창은 닫고 최신 항목을 다시 열어 주세요."); }).catch(() => setError("최신 기준정보 조회에 실패했습니다.")).finally(() => setBusy(false)); }}>최신 기준정보 확인</button> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {!catalog ? <form className={styles.toolbar} onSubmit={event => void login(event)}><label>기준정보 관리자 비밀번호<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label><button type="submit" className="primary-button" disabled={busy || !password}>{busy ? "인증 중…" : "관리자 로그인"}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setBusy(true); void load().catch(() => setError("관리자 권한 또는 연결 상태를 확인하고 다시 시도해 주세요.")).finally(() => setBusy(false)); }}>기준정보 다시 조회</button></form> : <>
      <div className={styles.toolbar}><label>관리 범주<select value={kind} disabled={busy} onChange={event => { setKind(event.target.value as ProcessCatalogKind); setSearch(""); }} >{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>공정 기준정보 검색<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label><label>활성 상태<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">전체</option><option value="active">활성</option><option value="inactive">비활성</option></select></label><label>정렬<select value={sort} onChange={event => setSort(event.target.value)}><option value="order">정렬 순서</option><option value="name">이름순</option></select></label><button type="button" className="primary-button" disabled={busy} onClick={event => beginEdit(event)}>{labels[kind]} 추가</button></div>
      <div className={styles.tableScroll}><table><caption>{labels[kind]} 목록 · {filtered.length}개</caption><thead><tr><th>코드 · 이름</th><th>상위 기준정보</th><th>순서</th><th>상태</th><th>사용량</th><th>관리</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><th scope="row">{item.name}<span className={styles.code}>{item.code}</span></th><td>{parentLabel(item)}</td><td>{item.sortOrder}</td><td>{item.active ? "활성" : "비활성"}</td><td>{item.usageCount}</td><td className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={event => beginEdit(event, item)}>수정<span className={styles.srOnly}> {item.name}</span></button><button type="button" className="secondary-button" disabled={busy} onClick={() => void mutate(`${paths[kind]}/${encodeURIComponent(item.id)}`, "PATCH", { active: !item.active })}>{item.active ? "비활성화" : "활성화"}<span className={styles.srOnly}> {item.name}</span></button><button type="button" className="secondary-button" disabled={busy || item.usageCount > 0} title={item.usageCount > 0 ? "사용 중인 항목은 삭제할 수 없습니다." : undefined} onClick={event => { trigger.current = event.currentTarget; setDeleting(item); }}>삭제<span className={styles.srOnly}> {item.name}</span></button></td></tr>)}{!filtered.length ? <tr><td colSpan={6}>조건에 맞는 기준정보가 없습니다.</td></tr> : null}</tbody></table></div>
      {kind === "occurrences" ? <form className={styles.form} onSubmit={event => { event.preventDefault(); void mutate("occurrences/apply-standard", "POST", { ...triple, standardIds }).then(ok => { if (ok) setStandardIds([]); }); }}><h3>제품 표준 공정을 현장에 적용</h3><p className={styles.note}>적용할 표준을 명시적으로 선택합니다. 사용 중인 현장 공정의 변경은 서버에서 보호합니다.</p><div className={styles.toolbar}>{(["businessUnitId", "productId", "siteEntityId"] as const).map(field => <label key={field}>{field === "businessUnitId" ? "사업부" : field === "productId" ? "제품" : "현장"}<select required disabled={busy} value={triple[field]} onChange={event => { setTriple({ ...triple, [field]: event.target.value }); setStandardIds([]); setStandardDiff(null); }}><option value="">선택</option>{(field === "businessUnitId" ? master?.businessUnits : field === "productId" ? master?.products : master?.siteEntities)?.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>)}</div><button type="button" className="secondary-button" disabled={busy || !triple.businessUnitId || !triple.productId || !triple.siteEntityId} onClick={() => void checkStandardDiff()}>표준 변경점 확인</button>{standardDiff && diffKey === JSON.stringify(triple) ? <p role="status">신규 {standardDiff.standardDiff.missingStandardIds.length}개 · 변경 {standardDiff.standardDiff.changed.length}개 · 퇴역 {standardDiff.standardDiff.retiredOccurrenceIds.length}개 · 기준정보 revision {standardDiff.processCatalogRevision}. 퇴역 항목은 자동 삭제하지 않습니다.</p> : <p className={styles.note}>사업부·제품·현장을 선택한 뒤 변경점을 확인하세요.</p>}<div className={styles.checks}>{catalog.standards.filter(item => item.productId === triple.productId && item.active).map(item => <label key={item.id}><input type="checkbox" disabled={busy || !standardDiff || diffKey !== JSON.stringify(triple) || standardDiff.processCatalogRevision !== catalog.processCatalogRevision || (!standardDiff.standardDiff.missingStandardIds.includes(item.id) && !standardDiff.standardDiff.changed.some(change => change.standardId === item.id && change.canApply))} checked={standardIds.includes(item.id)} onChange={event => setStandardIds(event.target.checked ? [...standardIds, item.id] : standardIds.filter(id => id !== item.id))} />{item.code} · {item.name}</label>)}</div><button type="submit" className="secondary-button" disabled={busy || !standardDiff || standardDiff.processCatalogRevision !== catalog.processCatalogRevision || diffKey !== JSON.stringify(triple) || !standardIds.length || !triple.businessUnitId || !triple.productId || !triple.siteEntityId}>선택 표준 적용</button></form> : null}
    </>}
    {draft && catalog ? <WorkspaceDialog title={`${labels[kind]} ${draft.id ? "수정" : "추가"}`} busy={busy} restoreFocusRef={trigger} onClose={closeDraft}><form data-canonical-catalog-id={draft.id} data-catalog-kind={kind} className={styles.form} onSubmit={event => void save(event)}><fieldset disabled={busy} className={styles.fields}>
      <label>코드<input ref={element => { element?.setAttribute("autofocus", ""); }} required maxLength={64} value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} /></label><label>이름<input required maxLength={200} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>정렬 순서<input type="number" required min={0} step={1} value={draft.sortOrder} onChange={event => setDraft({ ...draft, sortOrder: event.target.valueAsNumber })} /></label><label className={styles.check}><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} />활성</label>
      {kind === "standards" || kind === "occurrences" ? <><label>제품<select required value={draft.productId} onChange={event => setDraft({ ...draft, productId: event.target.value })}><option value="">제품 선택</option>{master?.products.map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== draft.productId}>{item.code} · {item.name}</option>)}</select></label><label>공정 유형<select required value={draft.processTypeId} onChange={event => setDraft({ ...draft, processTypeId: event.target.value })}><option value="">공정 유형 선택</option>{catalog.types.map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== draft.processTypeId}>{item.code} · {item.name}</option>)}</select></label></> : null}
      {kind === "occurrences" ? <>{(["businessUnitId", "siteEntityId"] as const).map(field => <label key={field}>{field === "businessUnitId" ? "사업부" : "현장"}<select required value={draft[field]} onChange={event => setDraft({ ...draft, [field]: event.target.value })}><option value="">선택</option>{(field === "businessUnitId" ? master?.businessUnits : master?.siteEntities)?.map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== draft[field]}>{item.code} · {item.name}</option>)}</select></label>)}</> : null}
      {kind === "workAreas" ? <label>소유 현장 공정<select required value={draft.occurrenceId} onChange={event => setDraft({ ...draft, occurrenceId: event.target.value })}><option value="">현장 공정 선택</option>{catalog.occurrences.map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== draft.occurrenceId}>{occurrenceLabel(item)}</option>)}</select></label> : null}
    </fieldset>{catalogStale || draftInvalidated || draftRevision !== catalog.processCatalogRevision ? <p role="alert">기준정보 충돌로 이 초안은 저장할 수 없습니다. 입력 내용을 보존한 뒤 취소하고 최신 기준정보 확인 후 항목을 다시 열어 주세요.</p> : null}{catalogStale ? <button type="button" className="secondary-button" disabled={busy} onClick={() => { setBusy(true); void load().then(() => setCatalogStale(false)).catch(() => setError("최신 기준정보 조회에 실패했습니다.")).finally(() => setBusy(false)); }}>최신 기준정보 확인</button> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}<div className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={closeDraft}>취소</button><button type="submit" className="primary-button" disabled={busy || catalogStale || draftInvalidated || draftRevision !== catalog.processCatalogRevision || !draft.code.trim() || !draft.name.trim()}>{busy ? "저장 중…" : "저장"}</button></div></form></WorkspaceDialog> : null}
    {discardDraft ? <WorkspaceDialog title="기준정보 변경 내용 버리기" onClose={() => setDiscardDraft(false)}><p>저장하지 않은 변경 내용이 있습니다.</p><div className={styles.actions}><button type="button" className="secondary-button" onClick={() => setDiscardDraft(false)}>계속 편집</button><button type="button" className="danger-button" onClick={() => { setDiscardDraft(false); setDraft(null); }}>변경 내용 버리기</button></div></WorkspaceDialog> : null}
    {deleting ? <WorkspaceDialog title={`${labels[kind]} 삭제 확인`} busy={busy} restoreFocusRef={trigger} onClose={() => setDeleting(null)}><p>{deleting.code} · {deleting.name} 항목을 삭제하시겠습니까? 서버에서 사용 여부를 다시 확인합니다.</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}<div className={styles.actions}><button type="button" className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>취소</button><button type="button" className="danger-button" disabled={busy} onClick={() => void mutate(`${paths[kind]}/${encodeURIComponent(deleting.id)}`, "DELETE").then(ok => { if (ok) setDeleting(null); })}>삭제 확인</button></div></WorkspaceDialog> : null}
  </details>;
}
