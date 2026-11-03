"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../lib/i18n/provider";
import styles from "./translation-fields.module.css";
import { WorkspaceDialog } from "./workspace-dialog";

export type DisplayNameTranslations = Partial<Record<"ko" | "en" | "vi", string>>;

/** Optional display names never replace the canonical name used by writes/exports. */
export function TranslationFields({ value, onChange, disabled = false, autoFocus = false }: {
  value: DisplayNameTranslations;
  onChange: (value: DisplayNameTranslations) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return <fieldset disabled={disabled} className={styles.fields}>
    <legend>{t("언어별 표시명 (선택)")}</legend>
    <p id={`${id}-hint`} className={styles.hint}>{t("비워 두면 원본 이름을 표시합니다. 다른 언어 번역은 사용하지 않습니다.")}</p>
    <div className={styles.grid}>
      {([ ["ko", "한국어"], ["en", "English"], ["vi", "Tiếng Việt"] ] as const).map(([locale, label]) =>
        <label key={locale} htmlFor={`${id}-${locale}`} className={styles.field}>{label}
          <input autoFocus={autoFocus && locale === "ko"} id={`${id}-${locale}`} lang={locale} maxLength={200} value={value[locale] ?? ""} aria-describedby={`${id}-hint`} onChange={event => onChange({ ...value, [locale]: event.target.value })} />
        </label>)}
    </div>
  </fieldset>;
}

/** An explicit save/cancel boundary for master tables without a name-edit dialog. */
export function TranslationEditor({ item, disabled = false, onSave, cachedDraft, onDraftChange, presentation = "inline", compactTrigger = false }: {
  item: { name: string; translations?: DisplayNameTranslations };
  disabled?: boolean;
  onSave: (translations: DisplayNameTranslations) => Promise<boolean>;
  cachedDraft?: DisplayNameTranslations;
  onDraftChange: (draft: DisplayNameTranslations | undefined) => void;
  presentation?: "inline" | "dialog";
  compactTrigger?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DisplayNameTranslations>({});
  const [pending, setPending] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || presentation !== "dialog") return;
    const frame = requestAnimationFrame(() => editor.current?.querySelector<HTMLInputElement>('input[lang="ko"]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, presentation]);
  const label = t(cachedDraft !== undefined ? "보존한 초안 계속 편집" : "표시명 번역");
  function close() {
    if (pending) return;
    onDraftChange(undefined);
    setOpen(false);
  }
  const control = <button ref={trigger} className={`secondary-button ${compactTrigger ? styles.compactTrigger : ""}`} type="button" disabled={disabled || pending}
    aria-label={label} title={compactTrigger ? label : undefined} aria-haspopup={presentation === "dialog" ? "dialog" : undefined}
    onClick={() => { setDraft({ ...(cachedDraft ?? item.translations) }); setOpen(true); }}>
    {compactTrigger ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 8 6 6m-7 0 6-6 2-3H2m5-3v3m6 16 5-11 5 11m-8-4h6"/></svg> : label}
  </button>;
  const content = <div ref={editor} className={styles.editor}>
    <p>{t("원본 이름")}: {item.name}</p>
    <TranslationFields value={draft} onChange={value => { onDraftChange({ ...value }); setDraft(value); }} disabled={disabled || pending} autoFocus={presentation === "dialog"} />
    <div className={styles.actions}>
      <button type="button" className="secondary-button" disabled={pending} onClick={close}>{t("취소")}</button>
      <button type="button" className="primary-button" disabled={disabled || pending} onClick={async () => {
        setPending(true);
        try { if (await onSave(draft)) { onDraftChange(undefined); setOpen(false); } } finally { setPending(false); }
      }}>{t("번역 저장")}</button>
    </div>
  </div>;
  if (presentation === "dialog") return <>{control}{open ? <WorkspaceDialog title={t("표시명 번역")} restoreFocusRef={trigger} busy={pending} controlledEscape onClose={close}>{content}</WorkspaceDialog> : null}</>;
  return open ? content : control;
}
