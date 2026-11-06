"use client";

import { useI18n } from "../../lib/i18n/provider";


import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { WorkspaceDialog } from "../../components/workspace-dialog";
import type { ProjectStatus, ProjectVisibility, ProjectWorkspaceTabs } from "../../contracts/projects";
import type { ProjectMasterItemDto } from "../../contracts/project-master";
import { PROJECT_STATUS_OPTIONS } from "./project-status";
import { ProjectWorkCalendarEditor } from "./project-work-calendar-editor";
import styles from "./project-settings-dialog.module.css";
import { ProjectMasterSelectFields, useProjectMasterSelectionCatalog, type ProjectMasterSelectionValue } from "./project-master-select-fields";

export type ProjectSettingsTabId = "general" | "calendar" | "security" | "display";

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
  metadataVisibility: ProjectVisibility;
  metadataWorkspaceTabs: ProjectWorkspaceTabs;
  onMetadataWorkspaceTabsChange: (value: ProjectWorkspaceTabs) => void;
  onSaveWorkspaceTabs: (event: FormEvent<HTMLFormElement>) => void;
  onMetadataNameChange: (value: string) => void;
  onMetadataDescriptionChange: (value: string) => void;
  onMetadataStatusChange: (value: ProjectStatus) => void;
  onMetadataVisibilityChange: (value: ProjectVisibility) => void;
  masterSelection: ProjectMasterSelectionValue;
  onMasterSelectionChange: (value: ProjectMasterSelectionValue) => void;
  currentMaster: { businessUnit?: ProjectMasterItemDto | null; product?: ProjectMasterItemDto | null; siteEntity?: ProjectMasterItemDto | null };
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
  { id: "display", label: "화면 표시" },
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
  metadataVisibility,
  metadataWorkspaceTabs,
  onMetadataWorkspaceTabsChange,
  onSaveWorkspaceTabs,
  onMetadataNameChange,
  onMetadataDescriptionChange,
  onMetadataStatusChange,
  onMetadataVisibilityChange,
  masterSelection,
  onMasterSelectionChange,
  currentMaster,
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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ProjectSettingsTabId>("general");
  const tabListReference = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const masterCatalog = useProjectMasterSelectionCatalog();

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
      title={t("프로젝트 설정")}
      size="wide"
      restoreFocusRef={restoreFocusRef}
      busy={busy}
      onClose={onClose}
    >
      <div className={styles.container}>
        <div
          ref={tabListReference}
          role="tablist"
          aria-label={t("프로젝트 설정 범주")}
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
                {t(tab.label)}
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
                <label htmlFor="metadata-name">{t("프로젝트 이름")}</label>
                <input
                  disabled={busy}
                  id="metadata-name"
                  value={metadataName}
                  onChange={(event) => onMetadataNameChange(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="metadata-status">{t("프로젝트 상태")}</label>
                <select
                  disabled={busy}
                  id="metadata-status"
                  value={metadataStatus}
                  onChange={(event) => onMetadataStatusChange(event.target.value as ProjectStatus)}
                >
                  {PROJECT_STATUS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.fullWidthField}>
                {masterCatalog.state === "ready" && masterCatalog.catalog ? (
                  <ProjectMasterSelectFields
                    value={masterSelection}
                    onChange={onMasterSelectionChange}
                    disabled={busy}
                    catalog={masterCatalog.catalog}
                    current={currentMaster}
                  />
                ) : (
                  <div className="form-error" role={masterCatalog.state === "error" ? "alert" : "status"}>
                    <span>{masterCatalog.state === "loading" ? t("프로젝트 기준정보를 불러오는 중…") : t("프로젝트 기준정보를 불러오지 못했습니다.")}</span>
                    {masterCatalog.state === "error" ? <button className="secondary-button" type="button" onClick={masterCatalog.reload}>{t("다시 시도")}</button> : null}
                  </div>
                )}
              </div>
              <div className={`form-field ${styles.fullWidthField}`}>
                <label htmlFor="metadata-description">{t("설명")}</label>
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
                {isSavingMetadata ? t("저장 중…") : t("프로젝트 정보 저장")}
              </button>
            </div>
          </form>
        </div>

        {/* Issue #881: server-persisted, project-wide display settings. */}
        <div id={`${baseId}-panel-display`} role="tabpanel" aria-labelledby={`${baseId}-tab-display`}
          hidden={activeTab !== "display"} className={styles.panel}>
          <form className="project-form compact-form" noValidate onSubmit={onSaveWorkspaceTabs}>
            <p>{t("이 프로젝트의 모든 조회자에게 적용되는 화면 표시 설정입니다.")}</p>
            {([{ key: "issue", label: "Issue" }, { key: "dashboard", label: "대시보드" }, { key: "master", label: "기준정보" }] as const).map(({ key, label }) => (
              <label key={key} className="form-field">
                <span><input type="checkbox" disabled={busy} checked={metadataWorkspaceTabs[key]}
                  onChange={event => onMetadataWorkspaceTabsChange({ ...metadataWorkspaceTabs, [key]: event.target.checked })} /> {t(label)}</span>
              </label>
            ))}
            <p>{t("일정은 항상 표시됩니다. 이 설정은 접근 권한이나 데이터를 변경하지 않습니다.")}</p>
            <div className={styles.formActions}>
              <button type="submit" className="primary-button" disabled={busy}>
                {isSavingMetadata ? t("저장 중…") : t("화면 표시 저장")}
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
            <form className="project-form compact-form" noValidate onSubmit={onSaveMetadata}>
              <div className="form-field">
                <label htmlFor="metadata-visibility">{t("공개범위")}</label>
                <select id="metadata-visibility" disabled={busy} value={metadataVisibility}
                  onChange={event => onMetadataVisibilityChange(event.target.value as ProjectVisibility)}>
                  <option value="public">{t("공개 — 비밀번호 없이 일정 조회")}</option>
                  <option value="private">{t("비공개 — 비밀번호 인증 후 조회 및 편집")}</option>
                </select>
                <p>{t("공개범위 변경은 현재 편집 세션과 최신 프로젝트 Revision이 필요합니다.")}</p>
              </div>
              <div className={styles.formActions}><button className="secondary-button" type="submit" disabled={busy}>
                {isSavingMetadata ? t("저장 중…") : t("공개범위 저장")}
              </button></div>
            </form>
            <form className="project-form compact-form" noValidate onSubmit={onChangePassword}>
              <div className="form-field">
                <label htmlFor="new-edit-password">{t("새 편집 비밀번호")}</label>
                <input
                  autoComplete="new-password"
                  disabled={busy}
                  id="new-edit-password"
                  minLength={1}
                  type="password"
                  value={newPassword}
                  onChange={(event) => onNewPasswordChange(event.target.value)}
                />
                <p>{t("1~12자로 입력해 주세요.")}</p>
              </div>
              <div className={styles.formActions}>
                <button className="secondary-button" disabled={busy} type="submit">
                  {isChangingPassword ? t("변경 중…") : t("편집 비밀번호 변경")}
                </button>
              </div>
            </form>

            <div className={styles.sessionCard}>
              <h4>{t("편집 세션 관리")}</h4>
              <p>
                {t("현재 브라우저 세션에서 편집 모드가 활성화되어 있습니다. 작업을 완료한 후 편집 모드를 종료하면 안전하게 읽기 전용 상태로 전환됩니다.")}</p>
              <div className={styles.sessionCardActions}>
                <button
                  className="secondary-button logout-button"
                  disabled={busy}
                  type="button"
                  onClick={onLogout}
                >
                  {isLoggingOut ? t("종료 중…") : t("편집 모드 종료")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
