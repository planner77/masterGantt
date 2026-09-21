"use client";

import { useRef, useState } from "react";
import { WorkspaceDialog } from "./workspace-dialog";
import { useWorkspaceNotifications } from "./workspace-notifications";
import styles from "./workspace-feedback.module.css";

export function ProjectLinkButton({ projectName, projectUrl, className, role, onActionComplete }: Readonly<{
  projectName: string;
  projectUrl: string | null;
  className?: string;
  role?: "menuitem";
  onActionComplete?: () => void;
}>) {
  const { notify } = useWorkspaceNotifications();
  const [fallback, setFallback] = useState(false);
  const pending = useRef(false);

  async function copy() {
    if (pending.current) return;
    if (!projectUrl) {
      notify("error", "공유 주소가 설정되지 않았거나 올바르지 않습니다. 관리자에게 앱 기준 URL 설정을 확인해 주세요.", "프로젝트 링크 복사");
      onActionComplete?.();
      return;
    }
    pending.current = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(projectUrl);
      setFallback(false);
      notify("success", "프로젝트 링크를 복사했습니다.", "프로젝트 링크 복사");
      onActionComplete?.();
    } catch {
      setFallback(true);
    } finally {
      pending.current = false;
    }
  }

  return <>
    <button type="button" className={className ?? `secondary-button ${styles.linkButton}`}
      role={role}
      aria-label={`${projectName} 프로젝트 링크 복사`}
      onClick={(event) => { event.stopPropagation(); void copy(); }}>링크 복사</button>
    {fallback && projectUrl ? <WorkspaceDialog title="프로젝트 링크 수동 복사" onClose={() => { setFallback(false); onActionComplete?.(); }}>
      <p>자동 복사를 사용할 수 없습니다. 아래 주소를 선택해 수동으로 복사해 주세요.</p>
      <input aria-label="프로젝트 바로 가기 URL" className={styles.copyValue} readOnly value={projectUrl}
        onFocus={(event) => event.currentTarget.select()} />
      <button className="secondary-button" type="button" onClick={() => void copy()}>복사 다시 시도</button>
    </WorkspaceDialog> : null}
  </>;
}
