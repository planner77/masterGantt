"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectTaskDto } from "../../contracts/projects";
import type { ProjectLogisticsResponse } from "../../contracts/logistics";
import type { ProcessContextResponse } from "../../contracts/process-catalog";
import type { TaskProcessContextResponse, TaskProcessLink, TaskWorkAreaLink } from "../../contracts/process-context";
import { ancestorProcessSources, descendantTaskCount, processDraftError, processDraftKey, validTaskProcessContext } from "./task-process-context-model";
import { projectWorkareaOptions, validProjectWorkareas } from "@/features/logistics/project-workarea-options";
import styles from "./project-task-editor.module.css";

interface Props {
  taskId: string; taskType: ProjectTaskDto["type"]; tasks: readonly ProjectTaskDto[]; revision: number;
  editable: boolean; disabled: boolean; discardGeneration: number;
  onApplied: () => Promise<void>; onUnauthorized?: () => void;
  onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void;
}
interface Snapshot { context: TaskProcessContextResponse["data"]; catalog: ProcessContextResponse["data"]; logistics: ProjectLogisticsResponse["data"]["logistics"] }
export function TaskProcessContextEditor(props: Props) {
  const { taskId, taskType, tasks, revision, editable, disabled, discardGeneration, onDirtyChange, onPendingChange, onUnauthorized, onApplied } = props;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [processes, setProcesses] = useState<TaskProcessLink[] | null>(null);
  const [areas, setAreas] = useState<TaskWorkAreaLink[] | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [initial, setInitial] = useState(""); const dirty = useRef(false); const discard = useRef(discardGeneration);
  const request = useRef(false); const epoch = useRef(0);
  const key = `${taskId}:${revision}:${discardGeneration}:${retry}`;
  const ready = key === loadedKey && !stale;
  const publicId = () => /^\/projects\/([^/]+)\/?$/.exec(window.location.pathname)?.[1];
  useEffect(() => {
    const controller = new AbortController(); const generation = ++epoch.current;
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      if (dirty.current && discard.current === discardGeneration) { setError("기준 정보 또는 권한이 변경되었습니다. 초안은 유지됩니다. 최신 정보 다시 불러오기에서 명시적으로 폐기해 주세요."); setStale(true); return; }
      discard.current = discardGeneration; setError(null); setNotice(null); setStale(false); setLoadedKey("");
      try {
        const id = publicId(); if (!id) throw new Error();
        const base = `/api/projects/${id}`;
        const responses = await Promise.all([fetch(`${base}/tasks/${encodeURIComponent(taskId)}/process-context`, { signal: controller.signal, credentials: "same-origin", cache: "no-store" }), fetch(`${base}/logistics/process-context`, { signal: controller.signal, credentials: "same-origin", cache: "no-store" }), fetch(`${base}/logistics`, { signal: controller.signal, credentials: "same-origin", cache: "no-store" })]);
        if (responses.some(response => !response.ok)) throw new Error();
        const [context, catalog, logistics] = await Promise.all(responses.map(response => response.json())) as [TaskProcessContextResponse, ProcessContextResponse, ProjectLogisticsResponse];
        const value = context.data.context;
        const catalogItem = (item: { id: string; name: string; code: string; active: boolean }) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.active === "boolean";
        const permission = (value: unknown) => value === "edit" || value === "readonly";
        if (context.data.projectRevision !== revision || catalog.data.projectRevision !== revision || logistics.data.project.revision !== revision || !Number.isSafeInteger(context.data.processCatalogRevision) || context.data.processCatalogRevision !== catalog.data.processCatalogRevision || !validTaskProcessContext(value) || value.taskId !== taskId || !permission(context.data.permission) || !permission(catalog.data.permission) || (catalog.data.projectWorkAreas !== undefined && !validProjectWorkareas(catalog.data.projectWorkAreas)) || !Array.isArray(catalog.data.mappings) || !catalog.data.mappings.every(row => row && typeof row.processId === "string" && typeof row.occurrenceId === "string" && typeof row.active === "boolean") || !Array.isArray(catalog.data.workAreas) || !catalog.data.workAreas.every(row => catalogItem(row) && typeof row.occurrenceId === "string") || !Array.isArray(logistics.data.logistics.processes) || !logistics.data.logistics.processes.every(catalogItem) || !Array.isArray(logistics.data.logistics.taskProcessContexts) || !logistics.data.logistics.taskProcessContexts.every(validTaskProcessContext) || (value.processLinks ?? []).some(link => !logistics.data.logistics.processes.some(row => row.id === link.processId))) throw new Error();
        if (controller.signal.aborted || generation !== epoch.current) return;
        setSnapshot({ context: context.data, catalog: catalog.data, logistics: logistics.data.logistics }); setProcesses(value.processLinks); setAreas(value.workAreaLinks);
        setInitial(processDraftKey(value.processLinks, value.workAreaLinks)); dirty.current = false; onDirtyChange(false); setLoadedKey(key);
      } catch { if (!controller.signal.aborted) setError("직접 공정·작업 구역을 불러오지 못했습니다. 선택 0개로 처리하지 않습니다."); }
    })();
    return () => { controller.abort(); epoch.current = generation + 1; };
  }, [taskId, revision, discardGeneration, retry, key, onDirtyChange]);
  const isDirty = snapshot !== null && processDraftKey(processes, areas) !== initial;
  useEffect(() => { dirty.current = isDirty; onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => { onPendingChange(saving); }, [saving, onPendingChange]);
  const canEdit = ready && editable && snapshot?.context.permission === "edit" && snapshot.catalog.permission === "edit" && !disabled && !saving;
  function change(nextProcesses: TaskProcessLink[], nextAreas: TaskWorkAreaLink[]) {
    if (!canEdit) return;
    const invalid = processDraftError(nextProcesses, nextAreas); if (invalid) { setError(invalid); return; }
    setProcesses(nextProcesses); setAreas(nextAreas); setError(null); setNotice(null);
  }
  async function save() {
    if (!canEdit || !isDirty || request.current || !snapshot) return;
    request.current = true; setSaving(true); setError(null); const generation = epoch.current;
    try {
      const response = await fetch(`/api/projects/${publicId()}/tasks/${encodeURIComponent(taskId)}/process-context`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "If-Match": `"${revision}"` }, body: JSON.stringify({ processCatalogRevision: snapshot.context.processCatalogRevision, processLinks: processes ?? [], workAreaLinks: areas ?? [] }) });
      if (generation !== epoch.current) return;
      if (response.status === 401) { onUnauthorized?.(); setStale(true); throw new Error("편집 권한이 만료되었습니다. 초안은 유지됩니다."); }
      if (response.status === 412) { setStale(true); throw new Error("프로젝트 또는 공정 기준정보가 변경되었습니다. 초안을 확인하고 최신 정보 다시 불러오기에서 명시적으로 폐기해 주세요."); }
      if (response.status >= 500) { setStale(true); throw new Error("서버 응답이 불확실합니다. 초안은 유지됩니다. 최신 정보를 다시 불러와 저장 여부를 확인해 주세요."); }
      if (!response.ok) throw new Error(response.status === 403 ? "공정 문맥 편집 권한이 없습니다. 초안은 유지됩니다." : "공정·작업 구역 저장이 거부되었습니다. 소유 공정·활성 상태와 범위를 확인해 주세요. 초안은 유지됩니다.");
      // A lost/malformed success receipt may already have committed; require a canonical reload.
      setStale(true);
      const body = await response.json();
      if (generation !== epoch.current) return;
      if (body?.data?.operation?.kind !== "taskProcessContext" || body.data.operation.taskId !== taskId || body.data.context?.taskId !== taskId || !validTaskProcessContext(body.data.context) || processDraftKey(body.data.context.processLinks, body.data.context.workAreaLinks) !== processDraftKey(processes ?? [], areas ?? []) || body.data.permission !== "edit" || body.data.processCatalogRevision !== snapshot.context.processCatalogRevision || typeof body.data.operation.changed !== "boolean" || body.data.project?.revision !== revision + (body.data.operation.changed ? 1 : 0)) { setStale(true); throw new Error("저장 응답을 확인할 수 없습니다. 최신 정보를 다시 조회해 주세요."); }
      setError("저장 응답을 수신했습니다. 최신 정보 조회에 실패하면 다시 불러와 저장 여부를 확인해 주세요.");
      await onApplied();
    } catch (reason) {
      if (generation === epoch.current) {
        const uncertain = reason instanceof TypeError || reason instanceof SyntaxError;
        if (uncertain) setStale(true);
        setError(uncertain || !(reason instanceof Error) ? "저장 응답을 확인할 수 없습니다. 초안은 유지됩니다. 최신 정보를 다시 불러와 저장 여부를 확인해 주세요." : reason.message);
      }
    }
    finally { request.current = false; setSaving(false); }
  }
  const processName = (id: string) => snapshot?.logistics.processes.find(row => row.id === id)?.name ?? `기존 공정 참조 ${id}`;
  const areaName = (id: string) => (snapshot ? projectWorkareaOptions(snapshot.catalog, snapshot.logistics.processes).find(row => row.id === id)?.name : undefined) ?? `기존 작업 구역 참조 ${id}`;
  const sources = ancestorProcessSources(taskId, tasks, snapshot?.logistics.taskProcessContexts ?? []);
  return <section className={styles.contextEditor} aria-label="직접 공정·작업 구역">
    <h3>직접 공정·작업 구역</h3>
    <p className={styles.note}>공정은 0개 이상 직접 선택합니다. 설비·시스템에서 자동 지정하지 않습니다. 각 영역은 별도로 저장합니다.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!ready && !error ? <p role="status">공정·작업 구역을 불러오는 중…</p> : null}
    {!ready && error && !isDirty ? <button type="button" className="secondary-button" onClick={() => setRetry(value => value + 1)}>공정 문맥 다시 시도</button> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {snapshot ? <>
      <p className={styles.note}>{processes === null ? "직접 공정 미설정 (기존 데이터)" : `직접 공정 ${processes.length}개 · 직접 작업 구역 ${areas?.length ?? 0}개`}</p>
      {!editable ? <p className={styles.note}>읽기 전용입니다.</p> : snapshot.context.permission !== "edit" || snapshot.catalog.permission !== "edit" ? <p className={styles.note}>서버에서 읽기 전용으로 확인되었습니다. 편집 권한을 다시 인증한 뒤 최신 정보를 불러와 주세요.</p> : disabled ? <p className={styles.note}>다른 영역의 변경을 저장하거나 폐기한 뒤 편집해 주세요.</p> : null}
      {processes === null && editable ? <button type="button" className="secondary-button" disabled={!canEdit} onClick={() => change([], [])}>공정 0개로 명시 설정</button> : null}
      {!snapshot.logistics.processes.length ? <p className={styles.emptyRelation}>등록된 공정이 없습니다. 기준정보 → 공정&amp;WorkArea에서 공정을 등록해 주세요.</p> : null}
      {snapshot.logistics.processes.map(process => {
        const selected = processes?.find(row => row.processId === process.id);
        const eligible = process.active;
        const areaEligible = eligible;
        const ownerAreas = projectWorkareaOptions(snapshot.catalog,snapshot.logistics.processes).filter(row => row.processId === process.id);
        return <fieldset className={styles.contextGroup} key={process.id}>
          <div className={styles.contextRow}><label><input type="checkbox" checked={!!selected} disabled={!canEdit || (!selected && !eligible)} onChange={() => change(selected ? (processes ?? []).filter(row => row.processId !== process.id) : [...(processes ?? []), { processId: process.id, scope: "self" }], areas ?? [])}/><span>{process.name} <small>{process.code}</small>{!eligible ? " · 비활성 (새 연결 불가)" : ""}</span></label>
          {selected && taskType === "summary" ? <label><input type="checkbox" aria-label={`${process.name} 공정 하위 작업 포함`} checked={selected.scope === "subtree"} disabled={!canEdit} onChange={() => change((processes ?? []).map(row => row.processId === process.id ? { ...row, scope: row.scope === "self" ? "subtree" : "self" } : row), areas ?? [])}/>하위 작업 포함 (파생)</label> : selected ? <span>이 작업만</span> : null}</div>
          {selected ? <div className={styles.contextAreas}>{!ownerAreas.length ? <p className={styles.note}>등록된 작업 구역이 없습니다. 구역 없이 공정을 선택하거나 기준정보 → 공정&amp;WorkArea에서 구역을 등록해 주세요.</p> : null}{ownerAreas.map(area => { const chosen = areas?.find(row => row.processId === process.id && row.workAreaId === area.id); return <div className={styles.contextRow} key={area.id}><label><input type="checkbox" disabled={!canEdit || (!chosen && (!area.active || !areaEligible))} checked={!!chosen} onChange={() => change(processes ?? [], chosen ? (areas ?? []).filter(row => row !== chosen) : [...(areas ?? []), { processId: process.id, workAreaId: area.id, scope: "self" }])}/><span>{area.name}{area.source === "legacy" ? " · 기존 공유 구역" : ""} <small>{area.code}</small>{!area.active ? " · 비활성" : ""}</span></label>{chosen && taskType === "summary" ? <label><input type="checkbox" aria-label={`${process.name} ${area.name} 작업 구역 하위 작업 포함`} disabled={!canEdit || (chosen.scope !== "subtree" && selected.scope !== "subtree")} checked={chosen.scope === "subtree"} onChange={() => change(processes ?? [], (areas ?? []).map(row => row === chosen ? { ...row, scope: row.scope === "self" ? "subtree" : "self" } : row))}/>하위 작업 포함 (공정도 하위 적용 필요)</label> : null}</div>; })}</div> : null}
        </fieldset>;
      })}
      {(areas ?? []).filter(area => !projectWorkareaOptions(snapshot.catalog,snapshot.logistics.processes).some(row => row.id === area.workAreaId && row.processId === area.processId)).map(area => <div key={`${area.processId}:${area.workAreaId}`} className={styles.contextRow}><span>{processName(area.processId)} · {areaName(area.workAreaId)} · 현재 분류 밖</span><button type="button" className="secondary-button" disabled={!canEdit} onClick={() => change(processes ?? [], (areas ?? []).filter(row => row !== area))}>기존 작업 구역 해제</button></div>)}
      {sources.length ? <div className={styles.contextGroup}><h4>상위 작업의 subtree 설정 (참고·읽기 전용)</h4>{sources.map(row => <p className={styles.note} key={row.source.taskId}>{row.source.name} → {row.processLinks.map(link => processName(link.processId)).join(", ")}{row.workAreaLinks.length ? ` · 작업 구역: ${row.workAreaLinks.map(link => areaName(link.workAreaId)).join(", ")}` : ""}</p>)}<p className={styles.note}>상위 원본 설정을 보여 주며 현재 Task의 공정 선택·유효 범위를 자동 추가하지 않습니다. 명시 0개는 그대로 유지됩니다.</p></div> : null}
      {taskType === "summary" ? <p className={styles.note}>하위 작업 포함은 현재 자손 {descendantTaskCount(taskId, tasks)}개에 대한 설정이며 각 Task의 명시 선택을 자동 채우지 않습니다.</p> : null}
      {editable ? <button type="button" className="primary-button" disabled={!canEdit || !isDirty} onClick={() => void save()}>{saving ? "직접 공정·작업 구역 저장 중…" : "직접 공정·작업 구역 저장"}</button> : null}
    </> : null}
  </section>;
}
