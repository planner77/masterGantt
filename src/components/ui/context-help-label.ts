import { messages, translate } from "../../lib/i18n";
import { SUPPORTED_LOCALES, type AppLocale } from "../../lib/i18n/locales";

const HELP_LABEL_TEMPLATE = "{name} 도움말";
const completeHelpSources = Object.entries(messages).filter(([key]) => key.endsWith("도움말"));
const registeredCompleteLabels = new Map(SUPPORTED_LOCALES.map(locale => [
  locale, new Set(completeHelpSources.map(([key, values]) => locale === "ko" ? key : values[locale])),
] as const));

/** Callers may supply either a topic or an already localized complete help label. */
export function contextHelpLabel(label: string, locale: AppLocale): string {
  const translated = translate(locale, label);
  const template = translate(locale, HELP_LABEL_TEMPLATE);
  const marker = template.indexOf("{name}");
  const prefix = template.slice(0, marker);
  const suffix = template.slice(marker + "{name}".length);
  const completeLocalizedLabel = marker >= 0 && (prefix.length > 0 || suffix.length > 0) &&
    translated.startsWith(prefix) && translated.endsWith(suffix);
  // Full source labels also keep the normal Korean fallback when a key is missing.
  if (label.endsWith("도움말") || registeredCompleteLabels.get(locale)?.has(translated) || completeLocalizedLabel) return translated;
  return translate(locale, HELP_LABEL_TEMPLATE, { name: translated });
}
