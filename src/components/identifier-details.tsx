"use client";

import { useI18n } from "../lib/i18n/provider";


import { useState, type ReactNode } from "react";
import styles from "./identifier-details.module.css";

export interface IdentifierDetailsProps {
  label?: string;
  identifiers: readonly { label: string; value: string }[];
  children?: ReactNode;
}

/** Keep raw identity available without making it the navigation label. */
export function IdentifierDetails({ label = "식별 정보", identifiers, children }: IdentifierDetailsProps) {
  const { t } = useI18n();
  const scope = JSON.stringify(identifiers);
  const [feedback, setFeedback] = useState<{ scope: string; message: string; name?: string } | null>(null);
  const currentFeedback = feedback?.scope === scope ? feedback : null;
  const message = currentFeedback ? t(currentFeedback.message, { name: t(currentFeedback.name ?? "") }) : "";
  async function copy(name: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ scope, message: "{name} 복사 완료", name });
    } catch {
      setFeedback({ scope, message: "복사할 수 없습니다. 원문 필드를 선택해 직접 복사해 주세요." });
    }
  }
  return <details className={styles.root}>
    <summary>{t(label)}</summary>
    <div className={styles.content}>
      {children}
      {identifiers.map((identifier, index) => <div className={styles.entry} key={`${identifier.label}:${index}`}>
        <label>{t(identifier.label)}<textarea aria-label={t(identifier.label)} readOnly rows={2} value={identifier.value} onFocus={event => event.currentTarget.select()} /></label>
        <button type="button" onClick={() => void copy(identifier.label, identifier.value)}>{t(identifier.label)} {t(" 복사")}</button>
      </div>)}
      <span role="status" aria-live="polite">{message}</span>
    </div>
  </details>;
}
