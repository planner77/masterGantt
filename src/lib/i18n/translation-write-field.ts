import type { DisplayNameTranslations } from "../../contracts/display-name-translations";
import { SUPPORTED_LOCALES } from "./locales";

/** Omission preserves stored translations; an explicit empty object clears them. */
export function displayNameTranslationWriteField(
  previous: DisplayNameTranslations | undefined,
  draft: DisplayNameTranslations,
): { translations?: DisplayNameTranslations } {
  const replacement: DisplayNameTranslations = {};
  let changed = false;
  for (const locale of SUPPORTED_LOCALES) {
    const raw = draft[locale];
    const next = raw?.trim().normalize("NFC") ?? "";
    const before = previous?.[locale]?.trim().normalize("NFC") ?? "";
    if (next) replacement[locale] = raw!;
    if (next !== before) changed = true;
  }
  // Preserve untrimmed nonblank input for the server's validation boundary.
  return changed ? { translations: replacement } : {};
}
