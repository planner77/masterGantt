"use client";

import { useId, useState } from "react";
import { useI18n } from "../lib/i18n/provider";
import styles from "./translation-fields.module.css";

export type DisplayNameTranslations = Partial<Record<"ko" | "en" | "vi", string>>;

/** Optional display names never replace the canonical name used by writes/exports. */
export function TranslationFields({ value, onChange, disabled = false }: {
  value: DisplayNameTranslations;
  onChange: (value: DisplayNameTranslations) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return <fieldset disabled={disabled} className={styles.fields}>
    <legend>{t("언어별 표시명 (선택)")}</legend>
    <p id={`${id}-hint`} className={styles.hint}>{t("비워 두면 원본 이름을 표시합니다. 다른 언어 번역은 사용하지 않습니다.")}</p>
    <div className={styles.grid}>
      {([ ["ko", "한국어"], ["en", "English"], ["vi", "Tiếng Việt"] ] as const).map(([locale, label]) =>
        <label key={locale} htmlFor={`${id}-${locale}`} className={styles.field}>{label}
          <input id={`${id}-${locale}`} lang={locale} maxLength={200} value={value[locale] ?? ""} aria-describedby={`${id}-hint`} onChange={event => onChange({ ...value, [locale]: event.target.value })} />
        </label>)}
    </div>
  </fieldset>;
}

/** An explicit save/cancel boundary for master tables without a name-edit dialog. */
export function TranslationEditor({ item, disabled = false, onSave, cachedDraft, onDraftChange }: {
  item: { name: string; translations?: DisplayNameTranslations };
  disabled?: boolean;
  onSave: (translations: DisplayNameTranslations) => Promise<boolean>;
  cachedDraft?: DisplayNameTranslations;
  onDraftChange: (draft: DisplayNameTranslations | undefined) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DisplayNameTranslations>({});
  const [pending, setPending] = useState(false);
  if (!open) return <button className="secondary-button" type="button" disabled={disabled} onClick={() => { setDraft({ ...(cachedDraft ?? item.translations) }); setOpen(true); }}>{t(cachedDraft !== undefined ? "보존한 초안 계속 편집" : "표시명 번역")}</button>;
  return <div className={styles.editor}>
    <p >{t("원본 이름")}: {item.name}</p>
    <TranslationFields value={draft} onChange={value => { onDraftChange({ ...value }); setDraft(value); }} disabled={disabled || pending} />
    <div className={styles.actions}>
      <button type="button" className="secondary-button" disabled={pending} onClick={() => { onDraftChange(undefined); setOpen(false); }}>{t("취소")}</button>
      <button type="button" className="primary-button" disabled={disabled || pending} onClick={async () => {
        setPending(true);
        try { if (await onSave(draft)) { onDraftChange(undefined); setOpen(false); } } finally { setPending(false); }
      }}>{t("번역 저장")}</button>
    </div>
  </div>;
}
