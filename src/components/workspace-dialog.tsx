"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./workspace-feedback.module.css";

export function WorkspaceDialog({ title, children, onClose, busy = false }: Readonly<{
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}>) {
  const reference = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = reference.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    const { scrollX, scrollY } = window;
    dialog.showModal();
    window.scrollTo(scrollX, scrollY);
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={reference} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.dialogHeading}>
      <h2 id={titleId}>{title}</h2>
      <button className="secondary-button" type="button" disabled={busy} onClick={onClose} aria-label={`${title} 닫기`}>닫기</button>
    </div>
    {children}
  </dialog>;
}
