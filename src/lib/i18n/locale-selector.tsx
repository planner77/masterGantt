"use client";

import { useId } from "react";
import { useI18n } from "./provider";
import { isAppLocale, LOCALE_LABELS, SUPPORTED_LOCALES } from "./locales";

export function LocaleSelector({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const id = useId();
  return <label className={className} htmlFor={id}>
    <span className="sr-only">{t("표시 언어")}</span>
    <select id={id} aria-label={t("표시 언어")} value={locale} onChange={event => {
      if (isAppLocale(event.target.value)) setLocale(event.target.value);
    }}>
      {SUPPORTED_LOCALES.map(value => <option key={value} value={value} lang={value}>{LOCALE_LABELS[value]}</option>)}
    </select>
  </label>;
}
