"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { WorkspaceDialog } from "../../components/workspace-dialog";
import type { TaskEditorSaveResult } from "../gantt/task-editor-model";

interface Props {
  pending: boolean;
  editable: boolean;
  stale: boolean;
  restoreFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onCreate: (name: string, start: string) => Promise<TaskEditorSaveResult>;
}

export function MilestoneCreateDialog({ pending, editable, stale, restoreFocusRef, onClose, onCreate }: Props) {
  const [name, setName] = useState(""), [start, setStart] = useState(""), [error, setError] = useState<string | null>(null);
  const [discardRequested, setDiscardRequested] = useState(false);
  const [createConflict, setCreateConflict] = useState(false);
  const continueReference = useRef<HTMLButtonElement>(null), decisionTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => { if (discardRequested) continueReference.current?.focus({ preventScroll: true }); }, [discardRequested]);
  function requestClose() {
    if (pending) return;
    if (!name && !start) { onClose(); return; }
    decisionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDiscardRequested(true);
  }
  function continueInput() { setDiscardRequested(false); requestAnimationFrame(() => decisionTrigger.current?.focus({ preventScroll: true })); }
  return <WorkspaceDialog title="Milestone 추가" busy={pending} restoreFocusRef={restoreFocusRef} onClose={requestClose} onEscape={() => discardRequested ? continueInput() : requestClose()}>
    <form className="project-form compact-form" onSubmit={async event => {
      event.preventDefault();
      if (pending || !editable || stale || createConflict || discardRequested) return;
      setError(null);
      const result = await onCreate(name, start);
      if (result.status === "failed") { setError(result.message); if (result.conflict) setCreateConflict(true); }
    }}>
      {discardRequested ? <div role="alert"><p>입력한 Milestone 초안을 버리고 닫을까요?</p><div className="form-actions"><button ref={continueReference} type="button" className="secondary-button" onClick={continueInput}>계속 입력</button><button type="button" className="secondary-button" onClick={onClose}>초안 버리고 닫기</button></div></div> : null}
      <p>프로젝트 최상위에 Milestone을 추가합니다. 현재 선택한 Summary와 Gantt WBS 범위는 부모로 사용하지 않습니다. 생성 후 기존 작업 Editor에서 소속·관계·상태를 관리합니다.</p>
      <div className="form-field"><label htmlFor="milestone-create-name">Milestone 이름</label><input autoFocus id="milestone-create-name" required maxLength={200} disabled={pending || discardRequested} value={name} onChange={event => setName(event.target.value)} /></div>
      <div className="form-field"><label htmlFor="milestone-create-start">요청 시작일</label><input id="milestone-create-start" type="date" required min="1900-01-01" max="2199-12-31" disabled={pending || discardRequested} value={start} onChange={event => setStart(event.target.value)} /></div>
      <p>기간은 0일입니다. 적용 예정일은 기존 프로젝트 캘린더와 관계 검증 후 확정됩니다.</p>
      {(stale || createConflict) ? <p role="alert">기준 Revision이 변경되었습니다. 입력은 유지됩니다. 취소 후 최신 정보를 확인하여 다시 추가해 주세요.</p> : null}
      {!editable ? <p role="alert">편집 권한이 없습니다. 입력은 유지됩니다.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="form-actions"><button type="button" className="secondary-button" disabled={pending || discardRequested} onClick={requestClose}>취소</button><button type="submit" className="primary-button" disabled={pending || !editable || stale || createConflict || discardRequested}>{pending ? "생성 중…" : "Milestone 생성"}</button></div>
    </form>
  </WorkspaceDialog>;
}
