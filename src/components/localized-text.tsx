"use client";

import { useI18n } from "../lib/i18n/provider";

/** Client presentation for fixed Server Component labels, with deterministic SSR. */
export function LocalizedText({ text }: { text: string }) {
  const { t } = useI18n();
  return t(text);
}
