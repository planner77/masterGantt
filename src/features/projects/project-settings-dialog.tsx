"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { WorkspaceDialog } from "../../components/workspace-dialog";
import type { ProjectStatus } from "../../contracts/projects";
import { PROJECT_STATUS_OPTIONS } from "./project-status";
import { ProjectWorkCalendarEditor } from "./project-work-calendar-editor";
import styles from "./project-settings-dialog.module.css";

export type ProjectSettingsTabId = "general" | "calendar" | "security";

interface ProjectSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  publicId: string;
  revision: number;
  metadataName: string;
  metadataDescription: string;
  metadataStatus: ProjectStatus;
  onMetadataNameChange: (value: string) => void;
  onMetadataDescriptionChange: (value: string) => void;
  onMetadataStatusChange: (value: ProjectStatus) => void;
  onSaveMetadata: (event: FormEvent<HTMLFormElement>) => void;
  isSavingMetadata: boolean;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onChangePassword: (event: FormEvent<HTMLFormElement>) => void;
  isChangingPassword: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
  onCalendarSaved: () => Promise<boolean>;
  onCalendarUnauthorized: () => void;
  onCalendarConflict: (body: unknown) => void;
  notify: (kind: "success" | "error" | "info", message: string, operation: string, serverBody?: unknown) => void;
}

const TABS: Array<{ id: ProjectSettingsTabId; label: string }> = [
  { id: "general", label: "기본 정보" },
  { id: "calendar", label: "작업 캘린더" },
  { id: "security", label: "편집·보안" },
];

export function ProjectSettingsDialog({
  open,
  onClose,
  busy,
  restoreFocusRef,
  publicId,
  revision,
  metadataName,
  metadataDescription,
  metadataStatus,
  onMetadataNameChange,
  onMetadataDescriptionChange,
  onMetadataStatusChange,
  onSaveMetadata,
  isSavingMetadata,
  newPassword,
  onNewPasswordChange,
  onChangePassword,
  isChangingPassword,
  onLogout,
  isLoggingOut,
  onCalendarSaved,
  onCalendarUnauthorized,
  onCalendarConflict,
  notify,
}: Readonly<ProjectSettingsDialogProps>) {
  const [activeTab, setActiveTab] = useState<ProjectSettingsTabId>("general");
  const tabListReference = useRef<HTMLDivElement>(null);
  const baseId = useId();

  if (!open) return null;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let targetIndex = -1;
    if (event.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = TABS.length - 1;
    }

    if (targetIndex >= 0) {
      event.preventDefault();
      const nextTab = TABS[targetIndex];
      if (nextTab) {
        setActiveTab(nextTab.id);
        const buttons = tabListReference.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
        buttons?.[targetIndex]?.focus();
      }
    }
  }

  return (
    <WorkspaceDialog
      title="프로젝트 설정"
      size="wide"
      restoreFocusRef={restoreFocusRef}
      busy={busy}
      onClose={onClose}
    >
      <div className={styles.container}>
        <div
          ref={tabListReference}
          role="tablist"
          aria-label="프로젝트 설정 범주"
          className={styles.tabList}
        >
          {TABS.map((tab, index) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`${baseId}-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                className={`${styles.tab} ${isSelected ? styles.tabSelected : ""}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 기본 정보 패널 */}
        <div
          id={`${baseId}-panel-general`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-general`}
          hidden={activeTab !== "general"}
          className={styles.panel}
        >
          <form className="project-form compact-form" noValidate onSubmit={onSaveMetadata}>
            <div className={styles.generalFormGrid}>
              <div className="form-field">
                <label htmlFor="metadata-name">프로젝트 이름</label>
                <input
                  disabled={busy}
                  id="metadata-name"
                  value={metadataName}
                  onChange={(event) => onMetadataNameChange(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="metadata-status">프로젝트 상태</label>
                <select
                  disabled={busy}
                  id="metadata-status"
                  value={metadataStatus}
                  onChange={(event) => onMetadataStatusChange(event.target.value as ProjectStatus)}
                >
                  {PROJECT_STATUS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`form-field ${styles.fullWidthField}`}>
                <label htmlFor="metadata-description">설명</label>
                <textarea
                  disabled={busy}
                  id="metadata-description"
                  rows={3}
                  value={metadataDescription}
                  onChange={(event) => onMetadataDescriptionChange(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button className="primary-button" disabled={busy} type="submit">
                {isSavingMetadata ? "저장 중…" : "프로젝트 정보 저장"}
              </button>
            </div>
          </form>
        </div>

        {/* 작업 캘린더 패널 */}
        <div
          id={`${baseId}-panel-calendar`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-calendar`}
          hidden={activeTab !== "calendar"}
          className={styles.panel}
        >
          <ProjectWorkCalendarEditor
            publicId={publicId}
            revision={revision}
            disabled={busy}
            onSaved={onCalendarSaved}
            onUnauthorized={onCalendarUnauthorized}
            onConflict={onCalendarConflict}
            notify={notify}
          />
        </div>

        {/* 편집·보안 패널 */}
        <div
          id={`${baseId}-panel-security`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-security`}
          hidden={activeTab !== "security"}
          className={styles.panel}
        >
          <div className={styles.securitySection}>
            <form className="project-form compact-form" noValidate onSubmit={onChangePassword}>
              <div className="form-field">
                <label htmlFor="new-edit-password">새 편집 비밀번호</label>
                <input
                  autoComplete="new-password"
                  disabled={busy}
                  id="new-edit-password"
                  minLength={1}
                  type="password"
                  value={newPassword}
                  onChange={(event) => onNewPasswordChange(event.target.value)}
                />
                <p>1~12자로 입력해 주세요.</p>
              </div>
              <div className={styles.formActions}>
                <button className="secondary-button" disabled={busy} type="submit">
                  {isChangingPassword ? "변경 중…" : "편집 비밀번호 변경"}
                </button>
              </div>
            </form>

            <div className={styles.sessionCard}>
              <h4>편집 세션 관리</h4>
              <p>
                현재 브라우저 세션에서 편집 모드가 활성화되어 있습니다. 작업을 완료한 후 편집 모드를 종료하면 안전하게 읽기 전용 상태로 전환됩니다.
              </p>
              <div className={styles.sessionCardActions}>
                <button
                  className="secondary-button logout-button"
                  disabled={busy}
                  type="button"
                  onClick={onLogout}
                >
                  {isLoggingOut ? "종료 중…" : "편집 모드 종료"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
