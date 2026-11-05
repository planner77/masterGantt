import type { ViewportStamp } from "./viewport-coordinator";

/** Admission for the two public layout writes immediately after Core's Locale
 * init. Only its column normalization may differ; a newer gesture, intent,
 * scope, filter, scale, API, or canonical geometry revokes this admission.
 * Callers must resume the original strict lease before any further restore.
 */
export function canRestoreLocaleInitColumns(source: ViewportStamp, current: ViewportStamp): boolean {
  if (source.contextEpoch !== current.contextEpoch || source.gesture !== current.gesture || source.intent !== current.intent) return false;
  try {
    const before: unknown = JSON.parse(source.context), after: unknown = JSON.parse(current.context);
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== 7 || after.length !== 7) return false;
    return before.every((value, index) => index === 5 || value === after[index]);
  } catch { return false; }
}
