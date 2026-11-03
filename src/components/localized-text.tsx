"use client";

import { useI18n } from "../lib/i18n/provider";

/** A server-rendered fixed label that follows the browser's selected language. */
export function LocalizedText({ text }: { text: string }) {
  const { t } = useI18n();
  return t(text);
}
