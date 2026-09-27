"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DependencyType, ProjectLinkDto, ProjectTaskDto } from "@/contracts/projects";
import {
  DEPENDENCY_TYPE_LABELS,
  getRelatedLinksForAnchor,
  searchCandidateTasks,
} from "./relation-editor-model";
import "./relation-editor-dialog.css";

export interface RelationEditorDialogProps {
  readonly linkId: string;
  readonly links: readonly ProjectLinkDto[];
  readonly tasks: readonly ProjectTaskDto[];
  readonly editable: boolean;
  readonly onClose: () => void;
  readonly onUpdateLink: (linkId: string, patch: { type: DependencyType; lag: number }) => Promise<void>;
  readonly onDeleteLink: (linkId: string) => Promise<void>;
  readonly onCreateLink: (
    sourceTaskId: string,
    targetTaskId: string,
    options: { type: DependencyType; lag: number },
  ) => Promise<void>;
}

export function RelationEditorDialog({
  linkId: initialLinkId,
  links,
  tasks,
  editable,
  onClose,
  onUpdateLink,
  onDeleteLink,
  onCreateLink,
}: RelationEditorDialogProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active link state
  const [activeLinkId, setActiveLinkId] = useState<string>(initialLinkId);
  const activeLink = links.find((l) => l.id === activeLinkId);

  const tasksByExternalId = useMemo(() => new Map(tasks.map((t) => [t.externalId, t])), [tasks]);

  // Anchor task externalId state
  const [anchorExternalId, setAnchorExternalId] = useState<string>(() => {
    return activeLink ? activeLink.predecessorExternalId : "";
  });

  const effectiveAnchorExternalId = activeLink
    ? anchorExternalId === activeLink.predecessorExternalId || anchorExternalId === activeLink.successorExternalId
      ? anchorExternalId
      : activeLink.predecessorExternalId
    : "";

  // Selected link edit state
  const [type, setType] = useState<DependencyType>(activeLink?.type ?? "FS");
  const [lag, setLag] = useState<number>(activeLink?.lag ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Sync edit state when activeLink changes
  const [prevLinkId, setPrevLinkId] = useState(activeLinkId);
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

  // Keyboard accessibility: Escape to close and focus trap
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const isDirty = activeLink ? type !== activeLink.type || lag !== activeLink.lag : false;

  async function handleSaveActiveLink(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || !activeLink || !isDirty || isSaving) return;
    setIsSaving(true);
    setLinkError(null);
    try {
      await onUpdateLink(activeLink.id, { type, lag });
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "관계 수정에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteLink(linkToDeleteId: string) {
    if (!editable || isDeleting) return;
    setIsDeleting(true);
    setLinkError(null);
    try {
      await onDeleteLink(linkToDeleteId);
      if (linkToDeleteId === activeLinkId) {
        // If we deleted the active link, fallback to another related link or close if none
        const remaining = links.filter((l) => l.id !== linkToDeleteId);
        const nextLink = remaining.find((l) => l.predecessorExternalId === effectiveAnchorExternalId || l.successorExternalId === effectiveAnchorExternalId) ?? remaining[0];
        if (nextLink) {
          setActiveLinkId(nextLink.id);
        } else {
          onClose();
        }
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "관계 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreateLink(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || !effectiveAnchorExternalId || !selectedCandidate || isCreating) return;
    const anchorTask = tasksByExternalId.get(effectiveAnchorExternalId);
    if (!anchorTask) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const sourceTaskId = addDirection === "predecessor" ? selectedCandidate.taskId : anchorTask.taskId;
      const targetTaskId = addDirection === "predecessor" ? anchorTask.taskId : selectedCandidate.taskId;
      await onCreateLink(sourceTaskId, targetTaskId, { type: newType, lag: newLag });
      // Reset form
      setSelectedCandidate(null);
      setSearchQuery("");
      setNewLag(0);
      setNewType("FS");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "새 관계 추가에 실패했습니다.");
    } finally {
      setIsCreating(false);
    }
  }

  const predecessorTask = activeLink ? tasksByExternalId.get(activeLink.predecessorExternalId) : undefined;
  const successorTask = activeLink ? tasksByExternalId.get(activeLink.successorExternalId) : undefined;
  const anchorTask = tasksByExternalId.get(effectiveAnchorExternalId);

  return (
    <div
      className="relation-editor-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relation-editor-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="relation-editor-header">
          <div>
            <h2 className="relation-editor-title" id={titleId}>
              작업 관계 관리 (Relation Editor)
            </h2>
          </div>
          <button
            aria-label="닫기"
            className="relation-editor-close-btn"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="relation-editor-body">
          {/* Section 1: Selected Relation */}
          {activeLink ? (
            <div className="relation-editor-section">
              <div className="relation-editor-section-title">
                <span>선택된 관계 설정</span>
                {!editable && <span className="relation-editor-badge">읽기 전용</span>}
              </div>

              <div className="relation-editor-card">
                <div className="relation-editor-endpoints-grid">
                  {/* Predecessor Box */}
                  <div className={`relation-editor-endpoint-box ${effectiveAnchorExternalId === activeLink.predecessorExternalId ? "is-anchor" : ""}`}>
                    <div className="relation-editor-endpoint-tag">
                      <span>선행 작업 (Predecessor)</span>
                      {effectiveAnchorExternalId === activeLink.predecessorExternalId && (
                        <span className="relation-editor-badge relation-editor-badge-primary">기준 작업 (Anchor)</span>
                      )}
                    </div>
                    <div className="relation-editor-endpoint-name" title={predecessorTask?.name ?? activeLink.predecessorExternalId}>
                      {predecessorTask?.name ?? activeLink.predecessorExternalId}
                    </div>
                    <div className="relation-editor-endpoint-dates">
                      {predecessorTask ? `${predecessorTask.start} ~ ${predecessorTask.end} (${predecessorTask.duration}일)` : "-"}
                    </div>
                    <button
                      className="relation-editor-anchor-btn"
                      onClick={() => setAnchorExternalId(activeLink.predecessorExternalId)}
                      type="button"
                    >
                      {effectiveAnchorExternalId === activeLink.predecessorExternalId ? "기준 작업으로 선택됨" : "선행 작업을 기준으로 보기"}
                    </button>
                  </div>

                  {/* Successor Box */}
                  <div className={`relation-editor-endpoint-box ${effectiveAnchorExternalId === activeLink.successorExternalId ? "is-anchor" : ""}`}>
                    <div className="relation-editor-endpoint-tag">
                      <span>후행 작업 (Successor)</span>
                      {effectiveAnchorExternalId === activeLink.successorExternalId && (
                        <span className="relation-editor-badge relation-editor-badge-primary">기준 작업 (Anchor)</span>
                      )}
                    </div>
                    <div className="relation-editor-endpoint-name" title={successorTask?.name ?? activeLink.successorExternalId}>
                      {successorTask?.name ?? activeLink.successorExternalId}
                    </div>
                    <div className="relation-editor-endpoint-dates">
                      {successorTask ? `${successorTask.start} ~ ${successorTask.end} (${successorTask.duration}일)` : "-"}
                    </div>
                    <button
                      className="relation-editor-anchor-btn"
                      onClick={() => setAnchorExternalId(activeLink.successorExternalId)}
                      type="button"
                    >
                      {effectiveAnchorExternalId === activeLink.successorExternalId ? "기준 작업으로 선택됨" : "후행 작업을 기준으로 보기"}
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleSaveActiveLink}>
                  <div className="relation-editor-form-row">
                    <div className="relation-editor-form-group">
                      <label className="relation-editor-label" htmlFor={`${dialogId}-type`}>
                        관계 유형 (Type)
                      </label>
                      <select
                        className="relation-editor-select"
                        disabled={!editable || isSaving}
                        id={`${dialogId}-type`}
                        onChange={(e) => setType(e.target.value as DependencyType)}
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
                        지연 시간 (Lag, 일 단위)
                      </label>
                      <input
                        className="relation-editor-input"
                        disabled={!editable || isSaving}
                        id={`${dialogId}-lag`}
                        onChange={(e) => setLag(parseInt(e.target.value, 10) || 0)}
                        step={1}
                        type="number"
                        value={lag}
                      />
                    </div>

                    {editable && (
                      <div className="relation-editor-btn-group">
                        <button
                          className="relation-editor-btn relation-editor-btn-primary"
                          disabled={!isDirty || isSaving || isDeleting}
                          type="submit"
                        >
                          {isSaving ? "저장 중..." : "수정 저장"}
                        </button>
                        <button
                          className="relation-editor-btn relation-editor-btn-danger"
                          disabled={isSaving || isDeleting}
                          onClick={() => handleDeleteLink(activeLink.id)}
                          type="button"
                        >
                          {isDeleting ? "삭제 중..." : "관계 삭제"}
                        </button>
                      </div>
                    )}
                  </div>
                  {linkError && <div className="relation-editor-error">{linkError}</div>}
                </form>
              </div>
            </div>
          ) : (
            <div className="relation-editor-section">
              <p>선택된 관계가 없습니다.</p>
            </div>
          )}

          {/* Section 2: Related Links for Anchor */}
          {anchorTask && (
            <div className="relation-editor-section">
              <div className="relation-editor-section-title">
                <span>
                  기준 작업 <strong>[{anchorTask.name}]</strong>의 연결된 관계
                </span>
                <span className="relation-editor-badge">
                  선행 {related.predecessors.length}개 / 후행 {related.successors.length}개
                </span>
              </div>

              {/* Predecessors list */}
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", marginBottom: "0.375rem" }}>
                  선행 작업 목록 (다른 작업 → [{anchorTask.name}])
                </div>
                {related.predecessors.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.375rem 0" }}>연결된 선행 작업이 없습니다.</div>
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
                              <span className="relation-editor-badge">{item.link.lag > 0 ? `+${item.link.lag}일` : `${item.link.lag}일`}</span>
                            )}
                            <span className="relation-editor-link-task-name" title={item.targetTask?.name ?? item.link.predecessorExternalId}>
                              {item.targetTask?.name ?? item.link.predecessorExternalId}
                            </span>
                            {isItemActive && <span className="relation-editor-badge relation-editor-badge-primary">선택됨</span>}
                          </div>
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            {!isItemActive && (
                              <button
                                className="relation-editor-btn relation-editor-btn-secondary"
                                onClick={() => setActiveLinkId(item.link.id)}
                                type="button"
                              >
                                선택
                              </button>
                            )}
                            {editable && (
                              <button
                                className="relation-editor-btn relation-editor-btn-danger"
                                disabled={isDeleting}
                                onClick={() => handleDeleteLink(item.link.id)}
                                type="button"
                              >
                                삭제
                              </button>
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
                  후행 작업 목록 ([{anchorTask.name}] → 다른 작업)
                </div>
                {related.successors.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", padding: "0.375rem 0" }}>연결된 후행 작업이 없습니다.</div>
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
                              <span className="relation-editor-badge">{item.link.lag > 0 ? `+${item.link.lag}일` : `${item.link.lag}일`}</span>
                            )}
                            <span className="relation-editor-link-task-name" title={item.targetTask?.name ?? item.link.successorExternalId}>
                              {item.targetTask?.name ?? item.link.successorExternalId}
                            </span>
                            {isItemActive && <span className="relation-editor-badge relation-editor-badge-primary">선택됨</span>}
                          </div>
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            {!isItemActive && (
                              <button
                                className="relation-editor-btn relation-editor-btn-secondary"
                                onClick={() => setActiveLinkId(item.link.id)}
                                type="button"
                              >
                                선택
                              </button>
                            )}
                            {editable && (
                              <button
                                className="relation-editor-btn relation-editor-btn-danger"
                                disabled={isDeleting}
                                onClick={() => handleDeleteLink(item.link.id)}
                                type="button"
                              >
                                삭제
                              </button>
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
                <span>새 관계 추가</span>
              </div>

              <form onSubmit={handleCreateLink}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  {/* Direction */}
                  <div className="relation-editor-form-group">
                    <label className="relation-editor-label" htmlFor={`${dialogId}-direction`}>
                      연결 방향
                    </label>
                    <select
                      className="relation-editor-select"
                      disabled={isCreating}
                      id={`${dialogId}-direction`}
                      onChange={(e) => {
                        setAddDirection(e.target.value as "predecessor" | "successor");
                        setSelectedCandidate(null);
                      }}
                      value={addDirection}
                    >
                      <option value="successor">후행 작업으로 추가 (기준 → 대상)</option>
                      <option value="predecessor">선행 작업으로 추가 (대상 → 기준)</option>
                    </select>
                  </div>

                  {/* Search candidate */}
                  <div className="relation-editor-form-group relation-editor-search-container">
                    <label className="relation-editor-label" htmlFor={`${dialogId}-search`}>
                      연결할 작업 검색
                    </label>
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
                          {selectedCandidate.name} ({selectedCandidate.externalId})
                        </div>
                        <button
                          className="relation-editor-btn relation-editor-btn-secondary"
                          onClick={() => {
                            setSelectedCandidate(null);
                            setSearchQuery("");
                            setTimeout(() => searchInputRef.current?.focus(), 0);
                          }}
                          type="button"
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          autoComplete="off"
                          className="relation-editor-input"
                          disabled={isCreating}
                          id={`${dialogId}-search`}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => setIsSearchOpen(true)}
                          placeholder="작업 이름 또는 ID 검색..."
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
                                {searchQuery ? "검색 결과가 없습니다." : "연결 가능한 작업이 없습니다."}
                              </div>
                            ) : (
                              candidates.slice(0, 15).map((candidate) => (
                                <div
                                  className="relation-editor-candidate-item"
                                  key={candidate.taskId}
                                  onClick={() => {
                                    setSelectedCandidate(candidate);
                                    setIsSearchOpen(false);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <span>{candidate.name}</span>
                                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{candidate.externalId}</span>
                                </div>
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
                      관계 유형 (Type)
                    </label>
                    <select
                      className="relation-editor-select"
                      disabled={isCreating}
                      id={`${dialogId}-new-type`}
                      onChange={(e) => setNewType(e.target.value as DependencyType)}
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
                      지연 시간 (Lag, 일 단위)
                    </label>
                    <input
                      className="relation-editor-input"
                      disabled={isCreating}
                      id={`${dialogId}-new-lag`}
                      onChange={(e) => setNewLag(parseInt(e.target.value, 10) || 0)}
                      step={1}
                      type="number"
                      value={newLag}
                    />
                  </div>

                  <div className="relation-editor-btn-group">
                    <button
                      className="relation-editor-btn relation-editor-btn-primary"
                      disabled={!selectedCandidate || isCreating}
                      type="submit"
                    >
                      {isCreating ? "추가 중..." : "관계 추가"}
                    </button>
                  </div>
                </div>

                {createError && <div className="relation-editor-error">{createError}</div>}
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relation-editor-footer">
          <button
            className="relation-editor-btn relation-editor-btn-secondary"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
