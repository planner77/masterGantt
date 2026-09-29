"use client";

import { useContext, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { WorkspaceMessageContext } from "./workspace-message-context";
import styles from "./workspace-feedback.module.css";

export function WorkspaceDialog({ title, children, onClose, onEscape, busy = false, feedback = true, restoreFocusRef, size = "standard" }: Readonly<{
  title: string; children: ReactNode; onClose: () => void; onEscape?: () => void; busy?: boolean; feedback?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  size?: "standard" | "wide";
}>) {
  const reference = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const message = useContext(WorkspaceMessageContext);
  useEffect(() => {
    const dialog = reference.current;
    // 비동기 조회 중 호출 버튼이 disabled 되면 activeElement가 이미 바뀔 수 있다.
    // 호출 시점에 보존한 버튼을 우선하고, 동기 모달은 기존 activeElement를 사용한다.
    const trigger = restoreFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!dialog) return;
    const { scrollX, scrollY } = window;
    dialog.showModal();
    window.scrollTo(scrollX, scrollY);
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [restoreFocusRef]);
  return <dialog ref={reference} className={`${styles.dialog} ${size === "wide" ? styles.dialogWide : ""}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) (onEscape ?? onClose)(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab" || !(event.target instanceof HTMLElement) || event.target.closest("dialog") !== event.currentTarget) return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]'))
        .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) { event.preventDefault(); event.currentTarget.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <div className={styles.dialogHeading}>
      <h2 id={titleId}>{title}</h2>
      <button className="secondary-button" type="button" disabled={busy} onClick={onClose} aria-label={`${title} 닫기`}>닫기</button>
    </div>
    {children}
    {feedback ? <div className={`${styles.toast} ${message ? styles.toastVisible : ""}`} role="status" aria-live="polite" aria-atomic="true">{message}</div> : null}
  </dialog>;
}
