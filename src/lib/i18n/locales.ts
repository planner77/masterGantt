/** Display languages only: stored domain values and calendar calculations stay unchanged. */
export const SUPPORTED_LOCALES = ["ko", "en", "vi"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "ko";
export const LOCALE_STORAGE_KEY = "mastergantt.ui.locale";
export const LOCALE_CHANGE_EVENT = "mastergantt:locale-change";
export const LOCALE_FORMATS: Record<AppLocale, string> = { ko: "ko-KR", en: "en-US", vi: "vi-VN" };
export const LOCALE_LABELS: Record<AppLocale, string> = { ko: "한국어", en: "English", vi: "Tiếng Việt" };

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Browser regional tags are normalized; persisted choices must be exact supported IDs. */
export function normalizeLocale(value: unknown): AppLocale | undefined {
  if (typeof value !== "string") return undefined;
  const language = value.trim().toLowerCase().split("-")[0];
  return isAppLocale(language) ? language : undefined;
}

export function resolveLocale(saved: unknown, browserLanguages: readonly string[] = []): AppLocale {
  if (isAppLocale(saved)) return saved;
  for (const candidate of browserLanguages) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
