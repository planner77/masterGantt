import type { AppLocale } from "../lib/i18n/locales";
/** Optional manual display names. Original `name`, IDs and codes remain canonical. */
export type DisplayNameTranslations = Partial<Record<AppLocale, string>>;
