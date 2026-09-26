import React, { useEffect, useId, useRef, useState } from "react";
import type { DependencyType, ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";

export interface RelationContextMenuProps {
  readonly linkId: string;
  readonly links: readonly ProjectLinkDto[];
  readonly tasks: readonly ProjectTaskDto[];
  readonly position: { left: number; top: number };
  readonly editable: boolean;
  readonly onSave: (linkId: string, patch: { type: DependencyType; lag: number }) => Promise<void>;
  readonly onDelete: (linkId: string) => Promise<void>;
  readonly onClose: () => void;
}

const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: "FS (Finish-to-Start, 완료 후 시작)",
  SS: "SS (Start-to-Start, 동시 시작)",
  FF: "FF (Finish-to-Finish, 동시 완료)",
  SF: "SF (Start-to-Finish, 시작 후 완료)",
};

export function RelationContextMenu({
  linkId,
  links,
  tasks,
  position,
  editable,
  onSave,
  onDelete,
  onClose,
}: RelationContextMenuProps) {
  const titleId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);

  const link = links.find((l) => l.id === linkId);
  const tasksByExternalId = new Map(tasks.map((t) => [t.externalId, t]));
  const predecessor = link ? tasksByExternalId.get(link.predecessorExternalId) : undefined;
  const successor = link ? tasksByExternalId.get(link.successorExternalId) : undefined;

  const [type, setType] = useState<DependencyType>(link?.type ?? "FS");
  const [lag, setLag] = useState<number>(link?.lag ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevLinkId, setPrevLinkId] = useState(linkId);

  if (prevLinkId !== linkId) {
    setPrevLinkId(linkId);
    setType(link?.type ?? "FS");
    setLag(link?.lag ?? 0);
  }

  useEffect(() => {
    typeSelectRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!link) return null;

  const isDirty = type !== link.type || lag !== link.lag;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || !isDirty || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(linkId, { type, lag });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editable || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onDelete(linkId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="project-relation-context-menu"
      ref={menuRef}
      role="dialog"
      style={{
        position: "fixed",
        left: Math.min(position.left, window.innerWidth - 320),
        top: Math.min(position.top, window.innerHeight - 380),
        zIndex: 1050,
      }}
      tabIndex={-1}
    >
      <div className="project-relation-context-menu-header">
        <h3 id={titleId} style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
          작업 관계 설정
        </h3>
        <button
          aria-label="닫기"
          className="project-relation-context-menu-close"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>

      <div className="project-relation-context-menu-body">
        <div className="project-relation-endpoints">
          <div className="project-relation-endpoint">
            <span className="project-relation-endpoint-label">선행 작업</span>
            <span className="project-relation-endpoint-name" title={predecessor?.name ?? link.predecessorExternalId}>
              {predecessor?.name ?? link.predecessorExternalId}
            </span>
          </div>
          <div className="project-relation-arrow" aria-hidden="true">→</div>
          <div className="project-relation-endpoint">
            <span className="project-relation-endpoint-label">후행 작업</span>
            <span className="project-relation-endpoint-name" title={successor?.name ?? link.successorExternalId}>
              {successor?.name ?? link.successorExternalId}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="project-relation-field">
            <label htmlFor="relation-type-select">관계 종류</label>
            <select
              disabled={!editable || isSubmitting}
              id="relation-type-select"
              onChange={(e) => setType(e.target.value as DependencyType)}
              ref={typeSelectRef}
              value={type}
            >
              {(Object.keys(DEPENDENCY_TYPE_LABELS) as DependencyType[]).map((t) => (
                <option key={t} value={t}>
                  {DEPENDENCY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="project-relation-field">
            <label htmlFor="relation-lag-input">
              Lag (근무일수, 음수는 Lead)
            </label>
            <input
              disabled={!editable || isSubmitting}
              id="relation-lag-input"
              max={10000}
              min={-10000}
              onChange={(e) => setLag(Number.parseInt(e.target.value, 10) || 0)}
              step={1}
              type="number"
              value={lag}
            />
          </div>

          {error && <div className="project-relation-error" role="alert">{error}</div>}

          <div className="project-relation-actions">
            {editable ? (
              <>
                <button
                  className="project-relation-delete-btn"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                  type="button"
                >
                  관계 삭제
                </button>
                <div style={{ flex: 1 }} />
                <button
                  className="project-relation-cancel-btn"
                  disabled={isSubmitting}
                  onClick={onClose}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="project-relation-save-btn"
                  disabled={!isDirty || isSubmitting}
                  type="submit"
                >
                  저장
                </button>
              </>
            ) : (
              <div style={{ width: "100%", textAlign: "right" }}>
                <span className="project-relation-readonly-badge">읽기 전용</span>
                <button
                  className="project-relation-cancel-btn"
                  onClick={onClose}
                  style={{ marginLeft: 8 }}
                  type="button"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
