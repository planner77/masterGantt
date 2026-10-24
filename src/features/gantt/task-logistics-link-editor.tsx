"use client";

import { useEffect, useRef, useState } from "react";
import type {
  EquipmentDto,
  LogisticsSystemDto,
  ProjectLogisticsResponse,
  ReplaceTaskLogisticsLinksRequest,
  TaskLogisticsLinkScope,
  TaskLogisticsLinksDto,
  TaskLogisticsLinksResponse,
} from "@/contracts/logistics";
import type { ProjectTaskDto } from "../../contracts/projects";
import { descendantTaskCount } from "./task-process-context-model";
import { IdentifierDetails } from "@/components/identifier-details";
import styles from "./project-task-editor.module.css";
import { LegacyBindingScopeEditor } from "./legacy-binding-scope-editor";

interface Props {
  readonly taskId: string;
  readonly tasks?: readonly ProjectTaskDto[];
  readonly taskType: "task" | "summary" | "milestone";
  readonly revision: number;
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly onApplied: () => Promise<void>;
  readonly onUnauthorized?: () => void;
  readonly onPendingChange?: (pending: boolean) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly discardGeneration?: number;
  readonly onSelectionCountChange?: (count: number) => void;
}

function projectIdFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function isValidLogisticsSnapshot(links: TaskLogisticsLinksResponse, logistics: ProjectLogisticsResponse, taskId: string, revision: number): boolean {
  const value = links?.data?.links;
  const masters = logistics?.data?.logistics;
  const strings = (value: unknown): boolean => Array.isArray(value) && value.every((item) => typeof item === "string");
  const sourceEntity = (item: unknown): boolean => item === null || !!item && typeof item === "object" && "id" in item && typeof item.id === "string" && "name" in item && typeof item.name === "string";
  const validLinks = (items: unknown, id: string, inherited = false): boolean => Array.isArray(items) && items.every((item) =>
    item && typeof item === "object" && typeof item[id] === "string" &&
    (item.scope === "self" || item.scope === "subtree") &&
    ["equipmentCode", "equipmentName", "systemCode", "systemName"].every((key) => item[key] === undefined || typeof item[key] === "string") &&
    (!inherited || (typeof item.sourceTaskId === "string" && typeof item.sourceTaskName === "string")));
  return !!value && links.data.taskId === taskId && value.taskId === taskId && value.projectRevision === revision && logistics?.data?.project?.revision === revision &&
    Array.isArray(value.compatibilityLinks) && value.compatibilityLinks.every(item => item && typeof item.sourceId === "string" && ["equipment","system"].includes(item.kind) && typeof item.entityId === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.active === "boolean" && typeof item.sourceTaskId === "string" && typeof item.sourceTaskName === "string" && ["self","subtree"].includes(item.scope) && typeof item.inherited === "boolean" && ["whole","subset"].includes(item.selection) && ["whole","partial","unspecified"].includes(item.coverageMode) && (item.coverage === null || typeof item.coverage === "number" && Number.isSafeInteger(item.coverage) && item.coverage > 0) && item.readonly === true && (item.context === undefined || !!item.context && ["process","project_common"].includes(item.context.scope) && sourceEntity(item.context.process) && sourceEntity(item.context.workArea) && (item.context.occurrenceId === null || typeof item.context.occurrenceId === "string"))) &&
    validLinks(value.directEquipmentLinks, "equipmentId") && validLinks(value.directSystemLinks, "systemId") &&
    validLinks(value.inheritedEquipmentLinks, "equipmentId", true) && validLinks(value.inheritedSystemLinks, "systemId", true) &&
    strings(value.effectiveEquipmentIds) && strings(value.effectiveSystemIds) && !!masters &&
    Array.isArray(masters.equipment) && masters.equipment.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.equipmentType === "string" && Array.isArray(item.resourceRoles) && item.resourceRoles.every((role) => role && typeof role.resourceId === "string" && typeof role.resourceName === "string" && typeof role.role === "string" && typeof role.isPrimary === "boolean")) &&
    Array.isArray(masters.systems) && masters.systems.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.code === "string" && typeof item.systemType === "string" && Array.isArray(item.resourceRoles) && item.resourceRoles.every((role) => role && typeof role.resourceId === "string" && typeof role.resourceName === "string" && typeof role.role === "string" && typeof role.isPrimary === "boolean"));
}

export function TaskLogisticsLinkEditor({
  taskId,
  tasks = [],
  taskType,
  revision,
  editable,
  disabled,
  onApplied,
  onDirtyChange,
  onPendingChange,
  onUnauthorized,
  discardGeneration = 0,
  onSelectionCountChange,
}: Props) {
  const requestReference = useRef(false);
  const epochReference = useRef(0);
  const [stale, setStale] = useState(false);
  const [serverEditable, setServerEditable] = useState(false);
  const [equipmentList, setEquipmentList] = useState<EquipmentDto[]>([]);
  const [systemList, setSystemList] = useState<LogisticsSystemDto[]>([]);
  const [links, setLinks] = useState<TaskLogisticsLinksDto | null>(null);

  // Draft state
  const initialDraft = useRef<string | null>(null);
  const dirtyReference = useRef(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const loadedDiscardGeneration = useRef(discardGeneration);
  const [selectedEquipment, setSelectedEquipment] = useState<
    Map<string, TaskLogisticsLinkScope>
  >(new Map());
  const [selectedSystems, setSelectedSystems] = useState<
    Map<string, TaskLogisticsLinkScope>
  >(new Map());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [legacyScopePending, setLegacyScopePending] = useState(false);
  // Both the direct writer and the inherited legacy source writer can trigger
  // ProjectTaskEditor.reload(true); keep the same parent pending lock until
  // either write and its canonical refresh have settled.
  const pending = saving || legacyScopePending;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [retry, setRetry] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const snapshotKey = `${taskId}:${revision}:${retry}:${discardGeneration}`;
  const ready = loadedKey === snapshotKey && !loading && !stale;

  const isSummary = taskType === "summary";

  useEffect(() => {
    let alive = true;
    const generation = ++epochReference.current;
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      const publicId = projectIdFromPathname(window.location.pathname);
      if (!publicId) {
        setLoading(false);
        setError("프로젝트 경로를 확인할 수 없습니다.");
        return;
      }

      if (dirtyReference.current && loadedDiscardGeneration.current === discardGeneration) { setLoading(false); setError("기준 정보 또는 권한이 변경되었습니다. 물류 초안은 유지됩니다. 최신 정보 다시 불러오기에서 명시적으로 폐기하고 검토해 주세요."); return; }
      loadedDiscardGeneration.current = discardGeneration;
      try {
        setLoading(true);
        setStale(false);
        setLoadedKey(null);
        setSuccessNotice(null);
        setError(null);

        // Fetch task links and project logistics masters in parallel
        const [linksRes, logisticsRes] = await Promise.all([
          fetch(
            `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/logistics-links`,
            { credentials: "same-origin", cache: "no-store", signal: controller.signal },
          ),
          fetch(`/api/projects/${encodeURIComponent(publicId)}/logistics`, {
            credentials: "same-origin",
            cache: "no-store", signal: controller.signal,
          }),
        ]);

        if (!linksRes.ok) throw new Error("links_fetch_failed");
        if (!logisticsRes.ok) throw new Error("logistics_fetch_failed");

        const linksBody = (await linksRes.json()) as TaskLogisticsLinksResponse;
        const logisticsBody = (await logisticsRes.json()) as ProjectLogisticsResponse;

        if (!isValidLogisticsSnapshot(linksBody, logisticsBody, taskId, revision)) throw new Error("invalid_snapshot");
        if (!alive) return;
        setLoadedKey(snapshotKey);

        setServerEditable(linksBody.data.permission === "edit" && logisticsBody.data.permission === "edit");
        setEquipmentList(logisticsBody.data.logistics.equipment);
        setSystemList(logisticsBody.data.logistics.systems);
        setLinks(linksBody.data.links);

        const initialEq = new Map<string, TaskLogisticsLinkScope>();
        for (const item of linksBody.data.links.directEquipmentLinks) {
          initialEq.set(item.equipmentId, item.scope);
        }
        setSelectedEquipment(initialEq);

        const initialSys = new Map<string, TaskLogisticsLinkScope>();
        for (const item of linksBody.data.links.directSystemLinks) {
          initialSys.set(item.systemId, item.scope);
        }
        initialDraft.current = JSON.stringify({ equipment: [...initialEq].sort(), systems: [...initialSys].sort() });
        dirtyReference.current = false;
        onDirtyChange?.(false);
        setSelectedSystems(initialSys);

        const directCount =
          linksBody.data.links.directEquipmentLinks.length +
          linksBody.data.links.directSystemLinks.length;
        onSelectionCountChange?.(directCount);
      } catch {
        if (alive) {
          setError("물류 연결 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      epochReference.current = generation + 1;
      controller.abort();
    };
  }, [taskId, revision, retry, snapshotKey, onSelectionCountChange, onDirtyChange, discardGeneration]);

  useEffect(() => {
    if (ready && initialDraft.current !== null) {
      dirtyReference.current = JSON.stringify({ equipment: [...selectedEquipment].sort(), systems: [...selectedSystems].sort() }) !== initialDraft.current;
      setDraftDirty(dirtyReference.current);
      onDirtyChange?.(dirtyReference.current);
    }
  }, [ready, selectedEquipment, selectedSystems, onDirtyChange]);

  const toggleEquipment = (equipmentId: string) => {
    if (!editable || !serverEditable || disabled || pending || !ready) return;
    setSuccessNotice(null);
    setSelectedEquipment((prev) => {
      const next = new Map(prev);
      if (next.has(equipmentId)) {
        next.delete(equipmentId);
      } else {
        next.set(equipmentId, "self");
      }
      return next;
    });
  };

  const toggleEquipmentScope = (equipmentId: string) => {
    if (!editable || !serverEditable || disabled || pending || !ready || !isSummary) return;
    setSuccessNotice(null);
    setSelectedEquipment((prev) => {
      const next = new Map(prev);
      const currentScope = next.get(equipmentId) ?? "self";
      next.set(equipmentId, currentScope === "subtree" ? "self" : "subtree");
      return next;
    });
  };

  const toggleSystem = (systemId: string) => {
    if (!editable || !serverEditable || disabled || pending || !ready) return;
    setSuccessNotice(null);
    setSelectedSystems((prev) => {
      const next = new Map(prev);
      if (next.has(systemId)) {
        next.delete(systemId);
      } else {
        next.set(systemId, "self");
      }
      return next;
    });
  };

  const toggleSystemScope = (systemId: string) => {
    if (!editable || !serverEditable || disabled || pending || !ready || !isSummary) return;
    setSuccessNotice(null);
    setSelectedSystems((prev) => {
      const next = new Map(prev);
      const currentScope = next.get(systemId) ?? "self";
      next.set(systemId, currentScope === "subtree" ? "self" : "subtree");
      return next;
    });
  };

  const handleSave = async () => {
    if (!editable || !serverEditable || disabled || pending || !ready || requestReference.current) return;
    const publicId = projectIdFromPathname(window.location.pathname);
    if (!publicId) return;

    requestReference.current = true;
    const epoch = epochReference.current;
    setSaving(true);
    setError(null);
    setSuccessNotice(null);

    const payload: ReplaceTaskLogisticsLinksRequest = {
      equipmentLinks: Array.from(selectedEquipment.entries()).map(
        ([equipmentId, scope]) => ({
          equipmentId,
          scope,
        }),
      ),
      systemLinks: Array.from(selectedSystems.entries()).map(([systemId, scope]) => ({
        systemId,
        scope,
      })),
    };

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(publicId)}/tasks/${encodeURIComponent(taskId)}/logistics-links`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "If-Match": `"${revision}"`,
          },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        },
      );

      if (epoch !== epochReference.current) return;
      if (res.status === 412) {
        setStale(true);
        setError("프로젝트 개정(Revision)이 변경되었습니다. 초안은 유지됩니다. 최신 정보 다시 불러오기에서 명시적으로 폐기해 주세요.");
        return;
      }
      if (res.status === 401) {
        setStale(true);
        onUnauthorized?.();
        setError("편집 권한이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (res.status >= 500) { setStale(true); setError("저장 여부를 확인할 수 없습니다. 초안은 유지됩니다. 최신 정보를 다시 불러와 확인해 주세요."); return; }
      if (res.status === 403) { setError("물류 연결 편집 권한이 없습니다. 초안은 유지됩니다."); return; }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "물류 연결 저장에 실패했습니다.");
        return;
      }

      setStale(true);
      const body = await res.json();
      if (epoch !== epochReference.current) return;
      if (body?.data?.operation?.entity !== "taskLogisticsLinks" || body.data.operation.targetPublicId !== taskId || !Number.isSafeInteger(body.data.project?.revision) || body.data.project.revision < revision || body.data.project.revision > revision + 1 || body.data.permission !== "edit") {
        setStale(true); setError("저장 응답을 확인할 수 없습니다. 최신 정보를 다시 조회해 주세요."); return;
      }
      setError("저장 응답을 수신했습니다. 최신 정보 조회에 실패하면 다시 불러와 저장 여부를 확인해 주세요.");
      await onApplied();
      onSelectionCountChange?.(selectedEquipment.size + selectedSystems.size);
    } catch {
      if (epoch === epochReference.current) { setStale(true); setError("네트워크 오류로 물류 연결을 저장하지 못했습니다. 초안은 유지됩니다. 최신 정보를 다시 불러와 저장 여부를 확인해 주세요."); }
    } finally {
      requestReference.current = false;
      setSaving(false);
    }
  };

  if (loading || (loadedKey !== snapshotKey && !error)) {
    return <p className={styles.emptyRelation} role="status">물류 연결 정보를 불러오는 중…</p>;
  }

  return (
    <div className={styles.contextEditor}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {!ready && error && !draftDirty ? <button type="button" className="secondary-button" onClick={() => setRetry((value) => value + 1)}>물류 연결 다시 시도</button> : null}
      {successNotice ? (
        <p className={styles.note} role="status">
          {successNotice}
        </p>
      ) : null}

      {!editable ? <p className={styles.note}>읽기 전용입니다.</p> : disabled ? <p className={styles.note}>다른 영역의 변경을 저장하거나 폐기한 뒤 직접 설비·시스템을 편집해 주세요.</p> : !serverEditable ? <p className={styles.note}>서버의 편집 권한을 확인할 수 없습니다. 최신 정보를 다시 불러와 주세요.</p> : null}
      {/* 안내 문구 */}
      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
        설비 및 제어시스템 연결은 WBS 일정과 독립된 물류 메타데이터입니다.
        {isSummary
          ? " 요약 작업(Summary)은 '하위 작업 포함(subtree)'을 선택해 하위 작업에 일괄 파생할 수 있습니다."
          : ""}
      </div>

      {isSummary ? <p className={styles.note}>하위 작업 포함 선택 시 현재 자손 {descendantTaskCount(taskId, tasks)}개에 파생됩니다. 직접 연결 해제로 상위 출처의 상속 연결을 제거하지 않습니다.</p> : null}
      {links?.compatibilityLinks?.length ? <section className={styles.relationGroup} aria-label="기존 연결 출처">
        <h4>기존 연결 출처 · 원본 보존</h4>
        <p className={styles.note}>직접 연결의 추가·삭제는 이 원본에 영향을 주지 않습니다. 기존 전체 구성은 동적이며, Summary 직접 출처에 한해 적용 범위를 미리 보고 수정할 수 있습니다. 원본 구성/coverage/상속은 별도 승인 전 읽기 전용입니다.</p>
        <ul>{links.compatibilityLinks.map((item,index)=><li key={`${item.sourceId}:${item.kind}:${item.entityId}:${index}`} className={styles.contextRow}>
          <strong>{item.name.trim() || "이름 확인 필요"}</strong> · {item.kind === "equipment" ? "설비" : "물류 시스템"}{!item.active ? " · 비활성" : ""}
          <p className={styles.note}>원본 작업: {item.sourceTaskName || "이름 확인 필요"} · {item.inherited ? "상위 작업에서 상속" : "이 작업 연결"} · {item.scope === "subtree" ? "하위 작업 포함" : "작업 자체"} · {item.selection === "whole" ? "전체 구성" : "선택 구성"} · coverage {item.coverageMode === "whole" ? "전체" : item.coverage === null ? "미지정" : `${item.coverage}`}</p>
          {item.context ? <p className={styles.note}>출처 공정: {item.context.process?.name || (item.context.scope === "project_common" ? "프로젝트 공통" : "이름 확인 필요")} · 출처 WorkArea: {item.context.workArea?.name || "구역 미사용"} · 직접 공정·작업 구역 선택과 별도인 기존 원본 문맥입니다.</p> : null}
          <IdentifierDetails identifiers={[{label:item.kind === "equipment" ? "설비 ID" : "시스템 ID",value:item.entityId},{label:"코드",value:item.code},{label:"원본 작업 ID",value:item.sourceTaskId},{label:"원본 관계 참조",value:item.sourceId},...(item.context?.process ? [{label:"출처 공정 ID",value:item.context.process.id}] : []),...(item.context?.workArea ? [{label:"출처 WorkArea ID",value:item.context.workArea.id}] : [])]}/>
        </li>)}</ul>
        {isSummary && links.compatibilityLinks.some(item => !item.inherited && item.sourceTaskId === taskId) ? (
          <LegacyBindingScopeEditor
            taskId={taskId} revision={revision} editable={editable && serverEditable}
            disabled={disabled || draftDirty || pending || !ready}
            sourceNames={links.compatibilityLinks.filter(item => !item.inherited && item.sourceTaskId === taskId)
              .map(item => ({sourceId:item.sourceId,label:item.name}))}
            onApplied={onApplied} onUnauthorized={onUnauthorized}
            onPendingChange={setLegacyScopePending}
          />
        ) : null}
      </section> : null}
      {/* 설비 연결 섹션 */}
      <fieldset className={styles.relationGroup} style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "0.75rem" }}>
        <legend style={{ fontWeight: 600, padding: "0 0.25rem" }}>
          관련 설비 ({selectedEquipment.size})
        </legend>

        {/* 상속된 설비 표시 */}
        {links?.inheritedEquipmentLinks && links.inheritedEquipmentLinks.length > 0 ? (
          <div style={{ marginBottom: "0.75rem", background: "var(--surface-subtle)", padding: "0.5rem", borderRadius: 4 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
              상위 작업으로부터 상속된 설비 ({links.inheritedEquipmentLinks.length}):
            </span>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.25rem 0 0" }}>
              {links.inheritedEquipmentLinks.map((item) => (
                <li key={`${item.sourceTaskId}:${item.equipmentId}`} style={{ fontSize: "0.8rem", padding: "0.15rem 0" }}>
                  <strong>{item.equipmentName?.trim() || "이름 확인 필요"}</strong>{" "}
                  <IdentifierDetails identifiers={[...(item.equipmentCode ? [{ label: "설비 코드", value: item.equipmentCode }] : []), { label: "설비 ID", value: item.equipmentId }]} />
                  <span style={{ color: "var(--text-muted)" }}>
                    — [상위: {item.sourceTaskName}]에서 하위 적용됨
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 직접 설비 선택 리스트 */}
        {ready && equipmentList.length === 0 ? (
          <p className={styles.emptyRelation}>등록된 설비가 없습니다. 기준정보 → 설비에서 설비를 등록해 주세요.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 180, overflowY: "auto" }}>
            {equipmentList.map((eq) => {
              const isChecked = selectedEquipment.has(eq.id);
              const scope = selectedEquipment.get(eq.id) ?? "self";
              const primaryOwner = eq.resourceRoles?.find((r) => r.isPrimary && r.role === "owner");

              return (
                <li
                  key={eq.id}
                  className={styles.contextRow}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                    minWidth: 0,
                    padding: "0.35rem 0.25rem",
                    borderBottom: "1px solid var(--border-default)",
                    fontSize: "0.85rem",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: editable ? "pointer" : "default" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!editable || !serverEditable || disabled || pending || !ready || (!isChecked && !eq.active)}
                      onChange={() => toggleEquipment(eq.id)}
                    />
                    <span>
                      <strong>{eq.name.trim() || "이름 확인 필요"}</strong>{equipmentList.filter(item => item.id !== eq.id && item.name === eq.name).length ? ` (${eq.code})` : ""} ({eq.equipmentType}){!eq.active ? " · 비활성 (새 연결 불가)" : ""}
                      {primaryOwner ? (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          [담당: {primaryOwner.resourceName}]
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <IdentifierDetails identifiers={[{ label: "설비 코드", value: eq.code }, { label: "설비 ID", value: eq.id }]} />

                  {isChecked && isSummary ? (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={scope === "subtree"}
                        aria-label={`${eq.name} 설비 하위 작업 포함`}
                        disabled={!editable || !serverEditable || disabled || pending || !ready}
                        onChange={() => toggleEquipmentScope(eq.id)}
                      />
                      <span>하위 작업 포함 (파생)</span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* 물류 시스템 연결 섹션 */}
      <fieldset className={styles.relationGroup} style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "0.75rem" }}>
        <legend style={{ fontWeight: 600, padding: "0 0.25rem" }}>
          관련 물류 시스템 ({selectedSystems.size})
        </legend>

        {/* 상속된 시스템 표시 */}
        {links?.inheritedSystemLinks && links.inheritedSystemLinks.length > 0 ? (
          <div style={{ marginBottom: "0.75rem", background: "var(--surface-subtle)", padding: "0.5rem", borderRadius: 4 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
              상위 작업으로부터 상속된 시스템 ({links.inheritedSystemLinks.length}):
            </span>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.25rem 0 0" }}>
              {links.inheritedSystemLinks.map((item) => (
                <li key={`${item.sourceTaskId}:${item.systemId}`} style={{ fontSize: "0.8rem", padding: "0.15rem 0" }}>
                  <strong>{item.systemName?.trim() || "이름 확인 필요"}</strong>{" "}
                  <IdentifierDetails identifiers={[...(item.systemCode ? [{ label: "시스템 코드", value: item.systemCode }] : []), { label: "시스템 ID", value: item.systemId }]} />
                  <span style={{ color: "var(--text-muted)" }}>
                    — [상위: {item.sourceTaskName}]에서 하위 적용됨
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 직접 시스템 선택 리스트 */}
        {ready && systemList.length === 0 ? (
          <p className={styles.emptyRelation}>등록된 물류 시스템이 없습니다. 기준정보 → 물류 시스템에서 시스템을 등록해 주세요.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 180, overflowY: "auto" }}>
            {systemList.map((sys) => {
              const isChecked = selectedSystems.has(sys.id);
              const scope = selectedSystems.get(sys.id) ?? "self";
              const primaryPi = sys.resourceRoles?.find((r) => r.isPrimary && r.role === "pi");

              return (
                <li
                  key={sys.id}
                  className={styles.contextRow}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                    minWidth: 0,
                    padding: "0.35rem 0.25rem",
                    borderBottom: "1px solid var(--border-default)",
                    fontSize: "0.85rem",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: editable ? "pointer" : "default" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!editable || !serverEditable || disabled || pending || !ready || (!isChecked && !sys.active)}
                      onChange={() => toggleSystem(sys.id)}
                    />
                    <span>
                      <strong>{sys.name.trim() || "이름 확인 필요"}</strong>{systemList.filter(item => item.id !== sys.id && item.name === sys.name).length ? ` (${sys.code})` : ""} ({sys.systemType}){!sys.active ? " · 비활성 (새 연결 불가)" : ""}
                      {primaryPi ? (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          [PI: {primaryPi.resourceName}]
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <IdentifierDetails identifiers={[{ label: "시스템 코드", value: sys.code }, { label: "시스템 ID", value: sys.id }]} />

                  {isChecked && isSummary ? (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={scope === "subtree"}
                        aria-label={`${sys.name} 시스템 하위 작업 포함`}
                        disabled={!editable || !serverEditable || disabled || pending || !ready}
                        onChange={() => toggleSystemScope(sys.id)}
                      />
                      <span>하위 작업 포함 (파생)</span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* 저장 버튼 */}
      {editable ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button
            type="button"
            className="primary-button"
            disabled={disabled || !serverEditable || pending || !ready}
            onClick={() => void handleSave()}
          >
            {saving ? "물류 연결 저장 중..." : "물류 연결 저장"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
