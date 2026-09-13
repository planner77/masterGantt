"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { WorkspaceDialog } from "./workspace-dialog";
import {
  formatNotification, INITIAL_NOTIFICATION_STATE, notificationReducer,
  safeNotificationMetadata, TOAST_DURATION_MS, type NoticeKind,
} from "./workspace-notification-state";
import styles from "./workspace-feedback.module.css";

type NotificationApi = {
  notify: (kind: NoticeKind, message: string, operation: string, serverBody?: unknown) => void;
  clearToast: () => void;
};
const NotificationContext = createContext<NotificationApi | null>(null);

export function useWorkspaceNotifications(): NotificationApi {
  const api = useContext(NotificationContext);
  if (!api) throw new Error("WorkspaceNotifications provider is required.");
  return api;
}

export function WorkspaceNotifications({ scope, children }: Readonly<{ scope: string; children: ReactNode }>) {
  const [state, dispatch] = useReducer(notificationReducer, INITIAL_NOTIFICATION_STATE);
  const sequence = useRef(0);
  const [copyHint, setCopyHint] = useState("");
  const notify = useCallback<NotificationApi["notify"]>((kind, message, operation, serverBody) => {
    dispatch({ type: "publish", notice: {
      id: ++sequence.current, kind, message, operation,
      occurredAt: new Date().toISOString(), read: false, ...safeNotificationMetadata(serverBody),
    } });
  }, []);
  const clearToast = useCallback(() => dispatch({ type: "clear-toast" }), []);
  const api = useMemo(() => ({ notify, clearToast }), [notify, clearToast]);
  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const timer = window.setTimeout(() => dispatch({ type: "clear-toast", id }), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [state.toast]);
  const unread = state.errors.filter((notice) => !notice.read).length;

  async function copy(text: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopyHint("알림 내용을 복사했습니다.");
    } catch {
      setCopyHint("자동 복사를 사용할 수 없습니다. 아래 읽기 전용 텍스트를 선택해 수동으로 복사해 주세요.");
    }
  }

  return <NotificationContext.Provider value={api}>
    {children}
    <button type="button" className={styles.bell} aria-haspopup="dialog" aria-expanded={state.open}
      aria-label={unread ? `알림함, 미확인 ${unread}건` : "알림함"}
      onClick={() => { setCopyHint(""); dispatch({ type: "open" }); }}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" /></svg>
      {unread > 0 ? <span className={styles.badge} aria-hidden="true">{unread}</span> : null}
    </button>
    <div className={`${styles.toast} ${state.toast ? styles.toastVisible : ""}`} role="status" aria-live="polite" aria-atomic="true" data-testid="workspace-toast">
      {state.toast?.message ?? ""}
    </div>
    {state.open ? <WorkspaceDialog title="오류 알림함" onClose={() => dispatch({ type: "close" })}>
      <p className={styles.scope}>{scope} · 현재 화면에서 발생한 오류를 최대 50건 보관합니다.</p>
      <p role="status" className={styles.copyHint}>{copyHint}</p>
      {state.discarded > 0 ? <p>보관 한도로 이전 알림 {state.discarded}건이 제외되었습니다.</p> : null}
      {state.errors.length === 0 ? <p>확인할 오류가 없습니다.</p> : <>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "clear-read" })}>읽은 알림 지우기</button>
        <ol className={styles.errorList}>{state.errors.map((notice, index) => {
          const text = formatNotification(notice, scope);
          return <li key={notice.id}>
            <strong>{notice.operation}</strong>
            <textarea aria-label={`알림 ${index + 1} 내용`} readOnly rows={6} value={text} />
            <button className="secondary-button" type="button" onClick={() => void copy(text)}>내용 복사</button>
          </li>;
        })}</ol>
      </>}
    </WorkspaceDialog> : null}
  </NotificationContext.Provider>;
}
