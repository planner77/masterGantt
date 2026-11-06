"use client";

import { translate } from "../../lib/i18n";
import { type AppLocale } from "../../lib/i18n/locales";
import { formatLocaleDateOnly } from "../../lib/date-display";
import { useI18n } from "../../lib/i18n/provider";

import { IdentifierDetails } from "../../components/identifier-details";

import React, { useId, useMemo, useRef, useState } from "react";
import type { DependencyType, ProjectLinkDto, ProjectTaskDto } from "@/contracts/projects";
import {
  DEPENDENCY_TYPE_LABELS,
  MIXED_LINK_EXPLANATION,
  canCreateSchedulingLink,
  linkStructureLocked,
  COMPLETED_LINK_EXPLANATION,
  findNextRelatedLink,
  getRelatedLinksForAnchor,
  searchCandidateTasks,
} from "./relation-editor-model";
import { WorkspaceDialog } from "../../components/workspace-dialog";
import "./relation-editor-dialog.css";

type RelationEditorEntryProps =
  | { readonly linkId: string; readonly anchorTaskId?: never }
  | { readonly linkId?: never; readonly anchorTaskId: string };

export type RelationEditorDialogProps = RelationEditorEntryProps & {
  readonly links: readonly ProjectLinkDto[];
  readonly tasks: readonly ProjectTaskDto[];
  readonly editable: boolean;
  readonly onClose: () => void;
  readonly onUpdateLink: (linkId: string, patch: { type: DependencyType; lag: number }) => Promise<boolean>;
  readonly onDeleteLink: (linkId: string) => Promise<boolean>;
  readonly onCreateLink: (
    sourceTaskId: string,
    targetTaskId: string,
    options: { type: DependencyType; lag: number },
  ) => Promise<boolean>;
};

/** Resolve duplicate names against the context actually visible to the user. */
export function relationCandidateContext(
  task: ProjectTaskDto,
  tasks: readonly ProjectTaskDto[],
  byExternalId = new Map(tasks.map(item => [item.externalId, item])),
  locale: AppLocale = "ko",
): string {
  const visibleContext = (item: ProjectTaskDto) => {
    const parent = item.parentExternalId ? byExternalId.get(item.parentExternalId)?.name : translate(locale, "프로젝트 최상위");
    return `${parent ?? translate(locale, "상위 작업 정보 없음")} · ${item.start ? locale === "ko" ? item.start : formatLocaleDateOnly(item.start, locale) : translate(locale, "일정 미정")}`;
  };
  const context = visibleContext(task);
  const ambiguous = tasks.some(other => other.taskId !== task.taskId && other.name === task.name && visibleContext(other) === context);
  return ambiguous ? `${context} · ${task.externalId}` : context;
}

export function RelationEditorDialog({
  linkId: initialLinkId,
  anchorTaskId: initialAnchorTaskId,
  links,
  tasks,
  editable,
  onClose,
  onUpdateLink,
  onDeleteLink,
  onCreateLink,
}: RelationEditorDialogProps) {
  const { t, locale } = useI18n();
  const dialogId = useId();
  const pendingRef = useRef(false);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const confirmationTrigger = useRef<HTMLElement | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: "close" } | { kind: "select" | "delete"; linkId: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const restoringSearchFocus = useRef(false);

  // Active link state
  const initialAnchorTask = initialAnchorTaskId ? tasks.find((task) => task.taskId === initialAnchorTaskId) : undefined;
  const [activeLinkId, setActiveLinkId] = useState<string | null>(initialLinkId ?? null);
  const activeLink = activeLinkId ? links.find((l) => l.id === activeLinkId) : undefined;

  const tasksByExternalId = useMemo(() => new Map(tasks.map((t) => [t.externalId, t])), [tasks]);

  const candidateContext = (task: ProjectTaskDto) => relationCandidateContext(task, tasks, tasksByExternalId, locale);

  // Anchor task externalId state
  const [anchorExternalId, setAnchorExternalId] = useState<string>(() => {
    return activeLink?.predecessorExternalId ?? initialAnchorTask?.externalId ?? "";
  });

  const effectiveAnchorExternalId = activeLink
    ? anchorExternalId === activeLink.predecessorExternalId || anchorExternalId === activeLink.successorExternalId
      ? anchorExternalId
      : activeLink.predecessorExternalId
    : anchorExternalId;

  // Selected link edit state
  const [type, setType] = useState<DependencyType>(activeLink?.type ?? "FS");
  const [lag, setLag] = useState<number>(activeLink?.lag ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Sync edit state when activeLink changes
  const [prevLinkId, setPrevLinkId] = useState<string | null>(activeLinkId);
  if (prevLinkId !== activeLinkId && activeLink) {
    setPrevLinkId(activeLinkId);
    setType(activeLink.type);
    setLag(activeLink.lag);
    setLinkError(null);
  }

  // Related links for the current anchor
  const related = useMemo(() => {
    return getRelatedLinksForAnchor(effectiveAnchorExternalId, links, tasks);
  }, [effectiveAnchorExternalId, links, tasks]);

  // Add new relation state
  const [addDirection, setAddDirection] = useState<"predecessor" | "successor">("successor");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<ProjectTaskDto | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [newType, setNewType] = useState<DependencyType>("FS");
  const [newLag, setNewLag] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    if (!effectiveAnchorExternalId) return [];
    return searchCandidateTasks({
      anchorExternalId: effectiveAnchorExternalId,
      direction: addDirection,
      query: searchQuery,
      tasks,
      links,
    });
  }, [effectiveAnchorExternalId, addDirection, searchQuery, tasks, links]);

  const isDirty = activeLink ? type !== activeLink.type || lag !== activeLink.lag : false;
  const draftDirty = isDirty || selectedCandidate !== null || searchQuery !== "" || newType !== "FS" || newLag !== 0 || addDirection !== "successor";
  const mutationPending = isSaving || isDeleting || isCreating;

  function requestConfirmation(next: NonNullable<typeof confirmation>) {
    if (pendingRef.current) return;
    confirmationTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsSearchOpen(false);
    setConfirmation(next);
    requestAnimationFrame(() => confirmCancelRef.current?.focus());
  }
  function cancelConfirmation() {
    if (pendingRef.current) return;
    setConfirmation(null);
    requestAnimationFrame(() => confirmationTrigger.current?.focus());
  }
  function resetNewDraft() {
    setSelectedCandidate(null); setSearchQuery(""); setNewType("FS"); setNewLag(0); setAddDirection("successor"); setIsSearchOpen(false); setCreateError(null);
  }
  function selectLink(id: string) {
    if (pendingRef.current || confirmation) return;
    if (draftDirty) { requestConfirmation({ kind: "select", linkId: id }); return; }
    resetNewDraft(); setActiveLinkId(id);
  }
  function closeSearchPopup() {
    setIsSearchOpen(false);
    requestAnimationFrame(() => { restoringSearchFocus.current = true; searchInputRef.current?.focus(); restoringSearchFocus.current = false; });
  }
  function requestClose() {
    if (pendingRef.current) return;
    if (confirmation) { cancelConfirmation(); return; }
    if (draftDirty) { requestConfirmation({ kind: "close" }); return; }
    onClose();
  }
  function requestEscapeClose() {
    if (pendingRef.current) return;
    if (isSearchOpen) { closeSearchPopup(); return; }
    requestClose();
  }
  function confirmAction() {
    if (pendingRef.current || !confirmation) return;
    const action = confirmation;
    setConfirmation(null);
    if (action.kind === "delete") { void handleDeleteLink(action.linkId); return; }
    if (action.kind === "close") { onClose(); return; }
    resetNewDraft(); setActiveLinkId(action.linkId);
  }
  function handleEscape(event: React.KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (pendingRef.current) { event.preventDefault(); event.stopPropagation(); return; }
    if (isSearchOpen) {
      event.preventDefault(); event.stopPropagation(); closeSearchPopup();
    }
  }

  async function handleSaveActiveLink(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || linkStructureLocked(activeLink, tasks) || !activeLink || !isDirty || pendingRef.current || confirmation !== null) return;
    pendingRef.current = true;
    setIsSaving(true);
    setLinkError(null);
    try {
      const saved = await onUpdateLink(activeLink.id, { type, lag });
      if (!saved) throw new Error("관계 수정에 실패했습니다.");
    } catch {
      setLinkError("관계 수정에 실패했습니다.");
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleDeleteLink(linkToDeleteId: string) {
    if (!editable || linkStructureLocked(links.find((link) => link.id === linkToDeleteId), tasks) || pendingRef.current) return;
    pendingRef.current = true;
    setIsDeleting(true);
    setLinkError(null);
    try {
      const deleted = await onDeleteLink(linkToDeleteId);
      if (!deleted) throw new Error("관계 삭제에 실패했습니다.");
      if (linkToDeleteId === activeLinkId) {
        const nextLink = findNextRelatedLink(linkToDeleteId, effectiveAnchorExternalId, links);
        if (nextLink) {
          setActiveLinkId(nextLink.id);
        } else if (initialAnchorTask) {
          setActiveLinkId(null);
          setAnchorExternalId(initialAnchorTask.externalId);
        } else {
          onClose();
        }
      }
    } catch {
      setLinkError("관계 삭제에 실패했습니다.");
    } finally {
      pendingRef.current = false;
      setIsDeleting(false);
    }
  }

  async function handleCreateLink(event: React.FormEvent) {
    event.preventDefault();
    if (!canCreateSchedulingLink(tasksByExternalId.get(effectiveAnchorExternalId), tasks.find((task) => task.taskId === selectedCandidate?.taskId)) || !editable || !effectiveAnchorExternalId || !selectedCandidate || pendingRef.current || confirmation !== null) return;
    const anchorTask = tasksByExternalId.get(effectiveAnchorExternalId);
    if (!anchorTask) return;

    pendingRef.current = true;
    setIsCreating(true);
    setCreateError(null);
    try {
      const sourceTaskId = addDirection === "predecessor" ? selectedCandidate.taskId : anchorTask.taskId;
      const targetTaskId = addDirection === "predecessor" ? anchorTask.taskId : selectedCandidate.taskId;
      const created = await onCreateLink(sourceTaskId, targetTaskId, { type: newType, lag: newLag });
      if (!created) throw new Error("새 관계 추가에 실패했습니다.");
      resetNewDraft();
    } catch {
      setCreateError("새 관계 추가에 실패했습니다.");
    } finally {
      pendingRef.current = false;
      setIsCreating(false);
    }
  }

  const predecessorTask = activeLink ? tasksByExternalId.get(activeLink.predecessorExternalId) : undefined;
  const successorTask = activeLink ? tasksByExternalId.get(activeLink.successorExternalId) : undefined;
  const anchorTask = tasksByExternalId.get(effectiveAnchorExternalId);

  const activeLocked = linkStructureLocked(activeLink, tasks);
  const deleteTarget = confirmation?.kind === "delete" ? links.find((link) => link.id === confirmation.linkId) : undefined;
  const relationName = (link: ProjectLinkDto) => `${tasksByExternalId.get(link.predecessorExternalId)?.name ?? link.predecessorExternalId} → ${tasksByExternalId.get(link.successorExternalId)?.name ?? link.successorExternalId}`;

  return (
    <WorkspaceDialog title={t("작업 관계 관리 (Relation Editor)")} onClose={requestClose} onEscape={requestEscapeClose} busy={mutationPending} size="wide" feedback={false}>
      <div onKeyDownCapture={handleEscape}>
        {confirmation ? (
          <div className="relation-editor-confirmation" role="alert">
            <p>{confirmation.kind === "delete" && deleteTarget ? t("관계 '{value0}'를 삭제하시겠습니까?{value1}", { value0: relationName(deleteTarget), value1: draftDirty ? " 마지막 관계가 삭제되어 창이 닫히면 저장하지 않은 변경도 버려집니다." : "" }) : t("저장하지 않은 변경이 있습니다. 변경을 버리시겠습니까?")}</p>
            <div className="relation-editor-btn-group">
              <button ref={confirmCancelRef} className="relation-editor-btn relation-editor-btn-secondary" type="button" disabled={mutationPending} onClick={cancelConfirmation}>{confirmation.kind === "delete" ? t("삭제 취소") : t("계속 편집")}</button>
              <button className="relation-editor-btn relation-editor-btn-danger" type="button" disabled={mutationPending} onClick={confirmAction}>{confirmation.kind === "delete" ? t("삭제 확인") : t("변경 버리기")}</button>
            </div>
          </div>
        ) : null}
        {/* Body */}
        <div className="relation-editor-body" inert={confirmation !== null}>
          <p className="relation-editor-hint">{MIXED_LINK_EXPLANATION}</p>{activeLocked ? <p className="relation-editor-hint">{COMPLETED_LINK_EXPLANATION}</p> : null}
          {/* Section 1: Selected Relation */}
          {activeLink ? (
            <div className="relation-editor-section">
              <div className="relation-editor-section-title">
                <span>{t("선택된 관계 설정")}</span>{activeLocked ? <span className="relation-editor-badge">{t("Milestone 잠금")}</span> : null}
                {!editable && <span className="relation-editor-badge">{t("읽기 전용")}</span>}
              </div>

              <div className="relation-editor-card">
                <div className="relation-editor-endpoints-grid">
                  {/* Predecessor Box */}
                  <div className={`relation-editor-endpoint-box ${effectiveAnchorExternalId === activeLink.predecessorExternalId ? "is-anchor" : ""}`}>
                    <div className="relation-editor-endpoint-tag">
                      <span>{t("선행 작업 (Predecessor)")}</span>
                      {effectiveAnchorExternalId === activeLink.predecessorExternalId && (
                        <span className="relation-editor-badge relation-editor-badge-primary">{t("기준 작업 (Anchor)")}</span>
                      )}
                    </div>
                    <div className="relation-editor-endpoint-name" title={predecessorTask?.name ?? activeLink.predecessorExternalId}>
                      {predecessorTask?.name ?? activeLink.predecessorExternalId}
                    </div>
                    <div className="relation-editor-endpoint-dates">
                      {predecessorTask ? t("{value0} ~ {value1} ({value2}일)", { value0: predecessorTask.start ? locale === "ko" ? predecessorTask.start : formatLocaleDateOnly(predecessorTask.start, locale) : "—", value1: predecessorTask.end ? locale === "ko" ? predecessorTask.end : formatLocaleDateOnly(predecessorTask.end, locale) : "—", value2: predecessorTask.duration }) : "-"}
                    </div>
                    <button
                      className="relation-editor-anchor-btn"
                      disabled={mutationPending}
                      onClick={() => { if (!pendingRef.current) setAnchorExternalId(activeLink.predecessorExternalId); }}
                      type="button"
                    >
                      {effectiveAnchorExternalId === activeLink.predecessorExternalId ? t("기준 작업으로 선택됨") : t("선행 작업을 기준으로 보기")}
                    </button>
                  </div>

                  {/* Successor Box */}
                  <div className={`relation-editor-endpoint-box ${effectiveAnchorExternalId === activeLink.successorExternalId ? "is-anchor" : ""}`}>
                    <div className="relation-editor-endpoint-tag">
                      <span>{t("후행 작업 (Successor)")}</span>
                      {effectiveAnchorExternalId === activeLink.successorExternalId && (
                        <span className="relation-editor-badge relation-editor-badge-primary">{t("기준 작업 (Anchor)")}</span>
                      )}
                    </div>
                    <div className="relation-editor-endpoint-name" title={successorTask?.name ?? activeLink.successorExternalId}>
                      {successorTask?.name ?? activeLink.successorExternalId}
                    </div>
                    <div className="relation-editor-endpoint-dates">
                      {successorTask ? t("{value0} ~ {value1} ({value2}일)", { value0: successorTask.start ? locale === "ko" ? successorTask.start : formatLocaleDateOnly(successorTask.start, locale) : "—", value1: successorTask.end ? locale === "ko" ? successorTask.end : formatLocaleDateOnly(successorTask.end, locale) : "—", value2: successorTask.duration }) : "-"}
                    </div>
                    <button
                      className="relation-editor-anchor-btn"
                      disabled={mutationPending}
                      onClick={() => { if (!pendingRef.current) setAnchorExternalId(activeLink.successorExternalId); }}
                      type="button"
                    >
                      {effectiveAnchorExternalId === activeLink.successorExternalId ? t("기준 작업으로 선택됨") : t("후행 작업을 기준으로 보기")}
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleSaveActiveLink}>
                  <div className="relation-editor-form-row">
                    <div className="relation-editor-form-group">
                      <label className="relation-editor-label" htmlFor={`${dialogId}-type`}>
                        {t("관계 유형 (Type)")}</label>
                      <select
                        className="relation-editor-select"
                        disabled={!editable || activeLocked || mutationPending}
                        id={`${dialogId}-type`}
                        onChange={(e) => { if (!pendingRef.current) setType(e.target.value as DependencyType); }}
                        value={type}
                      >
                        {(Object.keys(DEPENDENCY_TYPE_LABELS) as DependencyType[]).map((t) => (
                          <option key={t} value={t}>
                            {DEPENDENCY_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relation-editor-form-group">
                      <label className="relation-editor-label" htmlFor={`${dialogId}-lag`}>
                        {t("지연 시간 (Lag, 일 단위)")}</label>
                      <input
                        className="relation-editor-input"
                        disabled={!editable || activeLocked || mutationPending}
                        id={`${dialogId}-lag`}
                        onChange={(e) => { if (!pendingRef.current) setLag(parseInt(e.target.value, 10) || 0); }}
                        step={1}
                        type="number"
                        value={lag}
                      />
                    </div>

                    {editable && (
                      <div className="relation-editor-btn-group">
                        <button
                          className="relation-editor-btn relation-editor-btn-primary"
                          disabled={activeLocked || !isDirty || mutationPending}
                          type="submit"
                        >
                          {isSaving ? t("저장 중...") : t("수정 저장")}
                        </button>
                        <button
                          className="relation-editor-btn relation-editor-btn-danger"
                          disabled={activeLocked || mutationPending}
                          onClick={() => { if (!activeLocked) requestConfirmation({ kind: "delete", linkId: activeLink.id }); }}
                          type="button"
                        >
                          {isDeleting ? t("삭제 중...") : t("관계 삭제")}
                        </button>
                      </div>
                    )}
                  </div>
                  {linkError && <div className="relation-editor-error" role="alert">{t(linkError)}</div>}
                </form>
              </div>
            </div>
          ) : (
            <div className="relation-editor-section">
              <p>{initialAnchorTask ? t("기준 작업 [{value0}]에서 관계를 선택하거나 새 관계를 추가하세요.", { value0: initialAnchorTask.name }) : t("선택된 관계가 없습니다.")}</p>
            </div>
          )}

          {/* Section 2: Related Links for Anchor */}
          {anchorTask && (
            <div className="relation-editor-section">
              <div className="relation-editor-section-title">
                <span>
                  {t("기준 작업 ")}<strong>[{anchorTask.name}]</strong>{t("의 연결된 관계")}</span>
                <span className="relation-editor-badge">
                  {t("선행 {before}개 / 후행 {after}개", { before: related.predecessors.length, after: related.successors.length })}</span>
              </div>

              {/* Predecessors list */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", marginBottom: "0.375rem" }}>
                  {t("선행 작업 목록 (다른 작업 → [")}{anchorTask.name}])
                </div>
                {related.predecessors.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.375rem 0" }}>{t("연결된 선행 작업이 없습니다.")}</div>
                ) : (
                  <div className="relation-editor-links-list">
                    {related.predecessors.map((item) => {
                      const isItemActive = item.link.id === activeLinkId;
                      return (
                        <div
                          className={`relation-editor-link-item ${isItemActive ? "is-selected" : ""}`}
                          key={item.link.id}
                        >
                          <div className="relation-editor-link-info">
                            <span className="relation-editor-badge">{item.link.type}</span>
                            {item.link.lag !== 0 && (
                              <span className="relation-editor-badge">{item.link.lag > 0 ? t("+{value0}일", { value0: item.link.lag }) : t("{value0}일", { value0: item.link.lag })}</span>
                            )}
                            <span className="relation-editor-link-task-name" title={item.targetTask?.name ?? item.link.predecessorExternalId}>
                              {item.targetTask?.name ?? item.link.predecessorExternalId}
                            </span>
                            {isItemActive && <span className="relation-editor-badge relation-editor-badge-primary">{t("선택됨")}</span>}
                          </div>
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            {!isItemActive && (
                              <button
                                className="relation-editor-btn relation-editor-btn-secondary"
                                disabled={mutationPending}
                                onClick={() => selectLink(item.link.id)}
                                type="button"
                              >
                                {t("선택")}</button>
                            )}
                            {editable && (
                              <button
                                className="relation-editor-btn relation-editor-btn-danger"
                                disabled={linkStructureLocked(item.link, tasks) || mutationPending}
                                onClick={() => { if (!linkStructureLocked(item.link, tasks)) requestConfirmation({ kind: "delete", linkId: item.link.id }); }}
                                type="button"
                              >
                                {t("삭제")}</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Successors list */}
              <div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", marginBottom: "0.375rem" }}>
                  {t("후행 작업 목록 ([")}{anchorTask.name}{t("] → 다른 작업)")}</div>
                {related.successors.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.375rem 0" }}>{t("연결된 후행 작업이 없습니다.")}</div>
                ) : (
                  <div className="relation-editor-links-list">
                    {related.successors.map((item) => {
                      const isItemActive = item.link.id === activeLinkId;
                      return (
                        <div
                          className={`relation-editor-link-item ${isItemActive ? "is-selected" : ""}`}
                          key={item.link.id}
                        >
                          <div className="relation-editor-link-info">
                            <span className="relation-editor-badge">{item.link.type}</span>
                            {item.link.lag !== 0 && (
                              <span className="relation-editor-badge">{item.link.lag > 0 ? t("+{value0}일", { value0: item.link.lag }) : t("{value0}일", { value0: item.link.lag })}</span>
                            )}
                            <span className="relation-editor-link-task-name" title={item.targetTask?.name ?? item.link.successorExternalId}>
                              {item.targetTask?.name ?? item.link.successorExternalId}
                            </span>
                            {isItemActive && <span className="relation-editor-badge relation-editor-badge-primary">{t("선택됨")}</span>}
                          </div>
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            {!isItemActive && (
                              <button
                                className="relation-editor-btn relation-editor-btn-secondary"
                                disabled={mutationPending}
                                onClick={() => selectLink(item.link.id)}
                                type="button"
                              >
                                {t("선택")}</button>
                            )}
                            {editable && (
                              <button
                                className="relation-editor-btn relation-editor-btn-danger"
                                disabled={linkStructureLocked(item.link, tasks) || mutationPending}
                                onClick={() => { if (!linkStructureLocked(item.link, tasks)) requestConfirmation({ kind: "delete", linkId: item.link.id }); }}
                                type="button"
                              >
                                {t("삭제")}</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Add New Relation */}
          {editable && anchorTask && (
            <div className="relation-editor-section">
              <div className="relation-editor-section-title">
                <span>{t("새 관계 추가")}</span>
              </div>

              <form onSubmit={handleCreateLink}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  {/* Direction */}
                  <div className="relation-editor-form-group">
                    <label className="relation-editor-label" htmlFor={`${dialogId}-direction`}>
                      {t("연결 방향")}</label>
                    <select
                      className="relation-editor-select"
                      disabled={mutationPending}
                      id={`${dialogId}-direction`}
                      onChange={(e) => {
                        if (pendingRef.current) return;
                        setAddDirection(e.target.value as "predecessor" | "successor");
                        setSelectedCandidate(null);
                      }}
                      value={addDirection}
                    >
                      <option value="successor">{t("후행 작업으로 추가 (기준 → 대상)")}</option>
                      <option value="predecessor">{t("선행 작업으로 추가 (대상 → 기준)")}</option>
                    </select>
                  </div>

                  {/* Search candidate */}
                  <div className="relation-editor-form-group relation-editor-search-container">
                    <label className="relation-editor-label" htmlFor={`${dialogId}-search`}>
                      {t("연결할 작업 검색")}</label>
                    {selectedCandidate ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div
                          style={{
                            flex: 1,
                            padding: "0.375rem 0.5rem",
                            border: "1px solid #2563eb",
                            borderRadius: "0.25rem",
                            background: "#eff6ff",
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span className="relation-editor-selected-candidate-name">{selectedCandidate.name}</span>
                          <span className="relation-editor-selected-candidate-ids">
                            <span>{candidateContext(selectedCandidate)}</span>
                          </span>
                        </div>
                        <IdentifierDetails label={t("{value0} 식별 정보", { value0: selectedCandidate.name })} identifiers={[{label: t("외부 ID"), value: selectedCandidate.externalId}, {label: t("작업 ID"), value: selectedCandidate.taskId}]} />
                        <button
                          className="relation-editor-btn relation-editor-btn-secondary"
                          disabled={mutationPending}
                          onClick={() => {
                            if (pendingRef.current) return;
                            setSelectedCandidate(null);
                            setSearchQuery("");
                            setTimeout(() => searchInputRef.current?.focus(), 0);
                          }}
                          type="button"
                        >
                          {t("변경")}</button>
                      </div>
                    ) : (
                      <>
                        <input
                          autoComplete="off"
                          className="relation-editor-input"
                          disabled={mutationPending}
                          id={`${dialogId}-search`}
                          onChange={(e) => {
                            if (pendingRef.current) return;
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => { if (!pendingRef.current && !restoringSearchFocus.current) setIsSearchOpen(true); }}
                          placeholder={t("작업명 / 외부 ID / 작업 ID 검색...")}
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                        />
                        {isSearchOpen && (
                          <div
                            className="relation-editor-candidates-dropdown"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {candidates.length === 0 ? (
                              <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                                {searchQuery ? t("검색 결과가 없습니다.") : t("연결 가능한 작업이 없습니다.")}
                              </div>
                            ) : (
                              candidates.slice(0, 15).map((candidate) => (
                                <button
                                  type="button"
                                  disabled={mutationPending}
                                  className="relation-editor-candidate-item"
                                  key={candidate.taskId}
                                  onClick={() => {
                                    if (pendingRef.current) return;
                                    setSelectedCandidate(candidate);
                                    setIsSearchOpen(false);
                                  }}
                                >
                                  <span className="relation-editor-candidate-name">{candidate.name}</span>
                                  <span className="relation-editor-candidate-ids">
                                    <span>{candidateContext(candidate)}</span>
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Type and Lag for new relation */}
                <div className="relation-editor-form-row">
                  <div className="relation-editor-form-group">
                    <label className="relation-editor-label" htmlFor={`${dialogId}-new-type`}>
                      {t("관계 유형 (Type)")}</label>
                    <select
                      className="relation-editor-select"
                      disabled={mutationPending}
                      id={`${dialogId}-new-type`}
                      onChange={(e) => { if (!pendingRef.current) setNewType(e.target.value as DependencyType); }}
                      value={newType}
                    >
                      {(Object.keys(DEPENDENCY_TYPE_LABELS) as DependencyType[]).map((t) => (
                        <option key={t} value={t}>
                          {DEPENDENCY_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relation-editor-form-group">
                    <label className="relation-editor-label" htmlFor={`${dialogId}-new-lag`}>
                      {t("지연 시간 (Lag, 일 단위)")}</label>
                    <input
                      className="relation-editor-input"
                      disabled={mutationPending}
                      id={`${dialogId}-new-lag`}
                      onChange={(e) => { if (!pendingRef.current) setNewLag(parseInt(e.target.value, 10) || 0); }}
                      step={1}
                      type="number"
                      value={newLag}
                    />
                  </div>

                  <div className="relation-editor-btn-group">
                    <button
                      className="relation-editor-btn relation-editor-btn-primary"
                      disabled={!selectedCandidate || !canCreateSchedulingLink(anchorTask, tasks.find((task) => task.taskId === selectedCandidate.taskId)) || mutationPending}
                      type="submit"
                    >
                      {isCreating ? t("추가 중...") : t("관계 추가")}
                    </button>
                  </div>
                </div>

                {createError && <div className="relation-editor-error" role="alert">{t(createError)}</div>}
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relation-editor-footer">
          <button
            className="relation-editor-btn relation-editor-btn-secondary"
            disabled={mutationPending}
            onClick={requestClose}
            type="button"
          >
            {t("닫기")}</button>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
