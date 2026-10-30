"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import styles from "./milestone-conversion-feedback.module.css";

const subscribeFullscreen = (changed: () => void) => {
  document.addEventListener("fullscreenchange", changed);
  return () => document.removeEventListener("fullscreenchange", changed);
};
const fullscreenHost = () => document.querySelector<HTMLElement>(".project-gantt-frame:fullscreen");
const serverHost = () => null;

function FullscreenFeedback({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(subscribeFullscreen, fullscreenHost, serverHost);
  return host ? createPortal(children, host) : children;
}

export function MilestoneConversionConfirm({ name, pending, editable, current, legacy, error, restoreFocusRef, onClose, onAfterClose, onConfirm }: Readonly<{
  name: string; pending: boolean; editable: boolean; current: boolean; legacy: boolean; error: string | null;
  restoreFocusRef: RefObject<HTMLElement | null>; onClose: () => void; onAfterClose: () => void; onConfirm: () => void;
}>) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus({ preventScroll: true }); }, []);
  return <FullscreenFeedback><WorkspaceDialog title="Milestone으로 변경" busy={pending} restoreFocusRef={restoreFocusRef} onClose={onClose} onAfterClose={onAfterClose}>
    <form className="project-form compact-form" aria-busy={pending} onSubmit={event => { event.preventDefault(); if (!pending && editable && current && !error) onConfirm(); }}>
      <p><strong className={styles.name}>{name}</strong> 작업을 Milestone으로 변경할까요?</p>
      <p>{legacy ? "현재 legacy 복구 모드에서는 일정 Grid와 Chart의 Milestone 표시를 유지합니다. 대시보드 → Milestone에서도 관리할 수 있습니다." : "변경 후 일정 Grid와 Chart에서 숨겨지며 대시보드 → Milestone에서 관리합니다."}</p>
      <p>기간은 0일이 됩니다. 적용 날짜는 프로젝트 캘린더와 기존 일정 규칙에 따라 결정됩니다.</p>
      <p>링크·하위 작업이 있거나 소속·직접 연결 제약으로 지원하지 않는 변경은 서버에서 거부합니다.</p>
      {!current ? <p role="alert">검토 이후 프로젝트가 변경되었습니다. 취소 후 최신 일정에서 다시 확인해 주세요.</p> : null}
      {!editable ? <p role="alert">편집 권한이 없습니다. 원본을 자동으로 변경하지 않습니다.</p> : null}
      {error ? <p role="alert">{error} 자동으로 다시 보내지 않습니다. 취소 후 최신 상태를 확인해 주세요.</p> : null}
      <div className="form-actions">
        <button ref={cancel} autoFocus type="button" className="secondary-button" disabled={pending} onClick={onClose}>취소</button>
        <button type="submit" className="primary-button" disabled={pending || !editable || !current || Boolean(error)}>{pending ? "변경 중…" : "Milestone으로 변경"}</button>
      </div>
    </form>
  </WorkspaceDialog></FullscreenFeedback>;
}

export function MilestoneConversionNotice({ name, disabled, onOpen, onDismiss }: Readonly<{
  name: string; disabled: boolean; onOpen: (trigger: HTMLElement) => void; onDismiss: () => void;
}>) {
  const descriptionId = useId();
  const description = "현재 조회 조건에서 목록에 보이지 않아도 같은 Milestone의 상세에서 날짜·소속·상태를 확인합니다.";
  return <div className={styles.notice} role="status" data-testid="milestone-conversion-notice">
    <p className={styles.summary}><strong>Milestone으로 변경했습니다.</strong> <span className={styles.name}>{name}</span></p>
    <p id={descriptionId} className="sr-only">{description}</p>
    <div className={styles.actions}>
      <button className="secondary-button" type="button" aria-describedby={descriptionId} title={description} disabled={disabled} onClick={event => onOpen(event.currentTarget)}>Milestone 대시보드에서 보기</button>
      <button className="secondary-button" type="button" onClick={onDismiss}>변경 안내 닫기</button>
    </div>
  </div>;
}
