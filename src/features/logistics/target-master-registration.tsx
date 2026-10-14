"use client";

import { useEffect, useRef, useState } from "react";
import type { ProcessCatalogResponse, ProcessContextResponse, ProjectProcessMappingResponse } from "@/contracts/process-catalog";
import type { LogisticsTypeCatalogResponse, ProcessDto, LogisticsMutationResponse } from "@/contracts/logistics";
import styles from "./target-ui.module.css";

type RegistrationKind = "equipment-type" | "system-type" | "process-type" | "occurrence" | "work-area" | "project-process";
export interface TargetMasterRegistrationResult { kind: RegistrationKind; id?: string; code?: string; projectRevision?: number }
export interface TargetMasterRegistrationProps {
  publicId: string;
  revision: number;
  processId: string | null;
  context: ProcessContextResponse["data"];
  disabled?: boolean;
  processes?: ProcessDto[];
  onRegistered: (result: TargetMasterRegistrationResult) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}
function processCatalog(value: unknown): value is ProcessCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "processCatalogRevision" in data && Number.isSafeInteger(data.processCatalogRevision) &&
    "types" in data && Array.isArray(data.types) && "standards" in data && Array.isArray(data.standards) &&
    "occurrences" in data && Array.isArray(data.occurrences) && "workAreas" in data && Array.isArray(data.workAreas);
}
function logisticsCatalog(value: unknown): value is LogisticsTypeCatalogResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" && "revision" in data && Number.isSafeInteger(data.revision) &&
    "equipmentTypes" in data && Array.isArray(data.equipmentTypes) && "systemTypes" in data && Array.isArray(data.systemTypes);
}

/** Global master writes are separate transactions and never part of Target draft rollback. */
export function TargetMasterRegistration({ publicId, revision, processId, context, processes = [], disabled, onRegistered, onBusyChange, onDirtyChange }: TargetMasterRegistrationProps) {
  const [process, setProcess] = useState<ProcessCatalogResponse | null>(null);
  const [logistics, setLogistics] = useState<LogisticsTypeCatalogResponse | null>(null);
  const [selectedProcess, setSelectedProcess] = useState(processId ?? "");
  const [selectedOccurrence, setSelectedOccurrence] = useState("");
  const [createdProcess, setCreatedProcess] = useState<{ id: string; revision: number } | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<RegistrationKind>("equipment-type");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const dirtyCallback = useRef(onDirtyChange);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { dirtyCallback.current = onDirtyChange; busyCallback.current = onBusyChange; }, [onDirtyChange, onBusyChange]);
  useEffect(() => { dirtyCallback.current?.(!!(code || name || typeId || selectedOccurrence)); }, [code, name, typeId, selectedOccurrence]);
  useEffect(() => () => { request.current?.abort(); busyCallback.current?.(false); dirtyCallback.current?.(false); }, []);
  function begin() {
    if (pending.current || disabled) return null;
    const controller = new AbortController();
    request.current = controller; pending.current = true; setBusy(true); busyCallback.current?.(true); setError(null); setNotice(null);
    return controller;
  }
  function end(controller: AbortController) {
    if (controller.signal.aborted) return;
    pending.current = false; setBusy(false); busyCallback.current?.(false);
  }
  async function check() {
    const controller = begin(); if (!controller) return;
    try {
      const results = await Promise.allSettled([
        fetch("/api/process-catalog/admin", { credentials: "same-origin", cache: "no-store", signal: controller.signal }),
        fetch("/api/logistics-catalog/admin/equipment-types", { credentials: "same-origin", cache: "no-store", signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      const [p, l] = results;
      const pv: unknown = p.status === "fulfilled" ? await p.value.json().catch(() => null) : null;
      const lv: unknown = l.status === "fulfilled" ? await l.value.json().catch(() => null) : null;
      if (controller.signal.aborted) return;
      const validP = p.status === "fulfilled" && p.value.ok && processCatalog(pv);
      const validL = l.status === "fulfilled" && l.value.ok && logisticsCatalog(lv);
      setProcess(validP ? pv as ProcessCatalogResponse : null);
      setLogistics(validL ? lv as LogisticsTypeCatalogResponse : null);
      setChecked(true);
      if (!validP || !validL) setError("일부 관리자 권한을 확인하지 못했습니다. 초안은 유지됩니다. 해당 관리자 화면에서 인증한 뒤 다시 확인하세요.");
    } catch { if (!controller.signal.aborted) setError("관리자 권한 조회에 실패했습니다. 입력을 유지한 채 다시 시도하세요."); }
    finally { end(controller); }
  }
  const needsLogistics = kind === "equipment-type" || kind === "system-type";
  const authorized = needsLogistics ? !!logistics : !!process;
  const occurrenceId = context.mappings.find(mapping => mapping.processId === processId && mapping.active)?.occurrenceId;
  const mappedOccurrence = process?.data.occurrences.find(item => item.id === occurrenceId && item.active);
  const selection = context.selection;
  const validSelection = context.selectionValid && !!selection.businessUnitId && !!selection.productId && !!selection.siteEntityId;
  const canRegister = authorized && (kind === "project-process" ? context.permission === "edit" && !!selectedOccurrence && (!!selectedProcess || !!name.trim()) : !!code.trim() && !!name.trim()) &&
    (kind !== "occurrence" || (validSelection && !!typeId)) && (kind !== "work-area" || !!mappedOccurrence);
  async function register() {
    if (!canRegister) return;
    const controller = begin(); if (!controller) return;
    if (kind === "project-process") {
      let actualRevision = revision;
      let localId = selectedProcess;
      let created = false;
      try {
        if (!localId) {
          const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/processes`, {
            method: "POST", credentials: "same-origin", signal: controller.signal,
            headers: { "Content-Type": "application/json", "If-Match": `"${revision}"` }, body: JSON.stringify({ name: name.trim(), ...(code.trim() ? { code: code.trim() } : {}) }),
          });
          if (!response.ok) throw new Error(`프로젝트 공정 생성 실패 (${response.status}). 입력은 유지됩니다. 권한과 최신 프로젝트 정보를 확인하세요.`);
          const value = await response.json() as LogisticsMutationResponse;
          localId = value.data.operation.targetPublicId ?? "";
          actualRevision = value.data.project.revision;
          if (!localId || !Number.isSafeInteger(actualRevision)) throw new Error("생성 응답을 확인할 수 없습니다. 기존 공정 관리에서 결과를 확인하세요.");
          if (controller.signal.aborted) return;
          created = true;
          setCreatedProcess({ id: localId, revision: actualRevision }); setSelectedProcess(localId);
        }
        const response = await fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics/process-mappings/${encodeURIComponent(localId)}`, {
          method: "PUT", credentials: "same-origin", signal: controller.signal,
          headers: { "Content-Type": "application/json", "If-Match": `"${actualRevision}"` },
          body: JSON.stringify({ occurrenceId: selectedOccurrence, processCatalogRevision: process!.data.processCatalogRevision }),
        });
        if (!response.ok) throw new Error(`공정 매핑 실패 (${response.status}). ${created ? "프로젝트 공정은 이미 별도로 저장되어 남습니다. 변경된 기준정보를 적용한 뒤 같은 공정의 매핑을 다시 시도하세요." : "프로젝트 편집 권한과 최신 기준정보를 확인한 뒤 다시 시도하세요."}`);
        const value = await response.json() as ProjectProcessMappingResponse;
        actualRevision = value.data.project.revision;
        if (controller.signal.aborted) return;
        setCode(""); setName(""); setSelectedOccurrence(""); setCreatedProcess(null);
        setNotice("유효한 프로젝트 공정을 저장했습니다. 변경된 기준정보 적용 후 Target의 공정을 선택하세요. 이 별도 저장은 Target 취소로 되돌아가지 않습니다.");
        await onRegistered({ kind, id: localId, projectRevision: actualRevision });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "공정 저장 결과를 확인할 수 없습니다. 기존 공정 관리에서 확인하세요.");
          if (created) {
            try { await onRegistered({ kind, id: localId, projectRevision: actualRevision }); }
            catch { setError("공정은 별도로 저장되었지만 목록 갱신에 실패했습니다. 최신 프로젝트 정보를 조회한 뒤 같은 공정의 매핑을 확인하세요."); }
          }
        }
      } finally { end(controller); }
      return;
    }
    const endpoint = needsLogistics ? `/api/logistics-catalog/admin/${kind === "equipment-type" ? "equipment-types" : "system-types"}` :
      `/api/process-catalog/admin/${kind === "process-type" ? "types" : kind === "occurrence" ? "occurrences" : "work-areas"}`;
    const catalogRevision = needsLogistics ? logistics!.data.revision : process!.data.processCatalogRevision;
    const body = { code: code.trim(), name: name.trim(), ...(kind === "occurrence" ? { ...selection, processTypeId: typeId } : {}),
      ...(kind === "work-area" ? { occurrenceId } : {}) };
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json", "If-Match": `"${catalogRevision}"` }, body: JSON.stringify(body) });
      const value: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 412) {
          if (needsLogistics) setLogistics(null); else setProcess(null);
          setError(response.status === 401 ? "관리자 인증이 만료되었습니다. 초안은 유지됩니다. 관리자 화면에서 인증한 뒤 권한을 다시 확인하세요." :
            "기준정보가 변경되었습니다. 입력을 유지한 채 관리자 권한 확인으로 최신 목록을 조회하고 다시 검토하세요.");
        } else setError(`기준정보를 등록하지 못했습니다 (${response.status}). 코드 중복과 입력값을 확인하세요.`);
        return;
      }
      if (needsLogistics && logisticsCatalog(value)) setLogistics(value);
      else if (!needsLogistics && processCatalog(value)) setProcess(value);
      else {
        if (needsLogistics) setLogistics(null); else setProcess(null);
        setError("저장 응답을 확인할 수 없습니다. 중복 저장하지 말고 관리자 화면에서 결과를 확인한 뒤 권한을 다시 조회하세요.");
        return;
      }
      const savedCode = code.trim();
      const id = !needsLogistics && processCatalog(value) ?
        (kind === "process-type" ? value.data.types : kind === "occurrence" ? value.data.occurrences : value.data.workAreas).find(item => item.code === savedCode && (kind !== "work-area" || ("occurrenceId" in item && item.occurrenceId === occurrenceId)))?.id : undefined;
      setCode(""); setName(""); setTypeId(""); setNotice("기준정보를 저장했습니다. 이 저장은 Target 취소로 되돌아가지 않습니다.");
      try { await onRegistered({ kind, code: savedCode, id }); }
      catch { if (!controller.signal.aborted) setError("기준정보는 저장되었지만 프로젝트 목록 갱신에 실패했습니다. 초안을 유지하고 최신 목록을 다시 조회하세요."); }
    } catch { if (!controller.signal.aborted) {
      if (needsLogistics) setLogistics(null); else setProcess(null);
      setError("저장 결과를 확인할 수 없습니다. 중복 저장하지 말고 관리자 화면에서 결과를 확인하세요. 입력은 유지됩니다.");
    } } finally { end(controller); }
  }
  return <section className={styles.group} aria-label="기준정보 inline 등록" aria-busy={busy}>
    <strong>기준정보가 없나요?</strong>
    <p className={styles.note}>프로젝트 편집 권한과 관리자 권한은 별도입니다. 실제 관리자 세션을 확인한 경우에만 여기에서 등록합니다. 저장된 기준정보는 Target 취소로 되돌아가지 않습니다.</p>
    <div className={styles.toolbar}><button type="button" className="secondary-button" disabled={disabled || busy} onClick={() => void check()}>{busy ? "처리 중…" : "관리자 권한 확인"}</button>
      <a aria-disabled={disabled || busy} tabIndex={disabled || busy ? -1 : undefined} onClick={event => { if (disabled || busy) event.preventDefault(); }} href="/project-master-admin" target="_blank" rel="noopener noreferrer">공정 관리자 화면 (새 탭)</a>
      <a aria-disabled={disabled || busy} tabIndex={disabled || busy ? -1 : undefined} onClick={event => { if (disabled || busy) event.preventDefault(); }} href="/logistics-admin" target="_blank" rel="noopener noreferrer">유형 관리자 화면 (새 탭)</a></div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {notice ? <p role="status" className={styles.note}>{notice}</p> : null}
    {checked && (process || logistics) ? <fieldset className={styles.group} disabled={disabled || busy}><legend>관리자 기준정보 등록</legend>
      <div className={styles.fields}>
        <label className={styles.field}>등록할 기준정보<select style={{ minHeight: 44 }} value={kind} onChange={event => { setKind(event.target.value as RegistrationKind); setTypeId(""); }}>
          <option value="equipment-type" disabled={!logistics}>설비 유형</option><option value="system-type" disabled={!logistics}>System 유형</option>
          <option value="project-process" disabled={!process}>프로젝트 유효 공정</option><option value="process-type" disabled={!process}>공정 유형</option><option value="occurrence" disabled={!process}>현장 공정 기준정보</option><option value="work-area" disabled={!process}>선택 공정 작업 구역</option>
        </select></label>
        {kind === "project-process" ? <><label className={styles.field}>프로젝트 공정<select style={{ minHeight: 44 }} value={selectedProcess} onChange={event => setSelectedProcess(event.target.value)}><option value="">새 프로젝트 공정 만들기</option>{processes.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}{createdProcess && !processes.some(item => item.id === createdProcess.id) ? <option value={createdProcess.id}>이미 생성한 공정 (매핑 재시도)</option> : null}</select></label><label className={styles.field}>매핑할 현장 공정<select style={{ minHeight: 44 }} value={selectedOccurrence} onChange={event => setSelectedOccurrence(event.target.value)}><option value="">현장 공정 선택</option>{process?.data.occurrences.filter(item => item.active && item.businessUnitId === selection.businessUnitId && item.productId === selection.productId && item.siteEntityId === selection.siteEntityId && process.data.types.some(type => type.id === item.processTypeId && type.active)).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></> : null}
        {kind === "occurrence" ? <label className={styles.field}>공정 유형<select style={{ minHeight: 44 }} value={typeId} onChange={event => setTypeId(event.target.value)}><option value="">공정 유형 선택</option>{process?.data.types.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
        {authorized ? <><label className={styles.field}>기준정보 코드<input style={{ minHeight: 44 }} value={code} maxLength={64} onChange={event => setCode(event.target.value)}/></label>
          <label className={styles.field}>기준정보 이름<input style={{ minHeight: 44 }} value={name} maxLength={200} onChange={event => setName(event.target.value)}/></label></> : null}
      </div>
      {kind === "project-process" ? <p className={styles.note}>프로젝트 공정 생성과 현장 공정 매핑은 순서대로 별도 저장됩니다. 매핑 실패 시 생성된 공정은 남습니다. 현장 공정이 없다면 먼저 현장 공정 기준정보를 등록하세요.</p> : null}
      {kind === "occurrence" ? <p className={styles.note}>{validSelection ? "현재 프로젝트의 사업부·제품·사업장에 현장 공정 기준정보를 등록합니다. 등록 후 이 패널의 프로젝트 유효 공정에서 프로젝트 공정을 만들고 매핑하세요." : "유효한 사업부·제품·사업장 선택이 필요합니다. 프로젝트 설정에서 먼저 선택하세요."}</p> : null}
      {kind === "work-area" ? <p className={styles.note}>{mappedOccurrence ? `선택 공정: ${mappedOccurrence.name}` : "먼저 유효하게 매핑된 프로젝트 공정을 선택하세요."}</p> : null}
      {!authorized ? <p className={styles.note}>이 종류의 관리자 권한을 먼저 확인하세요.</p> : null}
      <button type="button" className="secondary-button" disabled={!canRegister} onClick={() => void register()}>기준정보 등록</button>
    </fieldset> : null}
  </section>;
}
