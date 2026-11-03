import { translateErrorCode } from "../lib/i18n";

/** Raw API message/detail fields are never a presentation contract. */
export function safeApiError(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object" || !("error" in value) ||
      !value.error || typeof value.error !== "object" || !("code" in value.error)) return fallback;
  return translateErrorCode("ko", value.error.code);
}

/** Only contract identifiers can be shown alongside a safe validation message. */
export function safeDiagnosticIdentifiers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(detail => {
    if (!detail || typeof detail !== "object") return [];
    const code = "code" in detail && typeof detail.code === "string" && /^[A-Z][A-Z_0-9]{0,63}$/.test(detail.code) ? detail.code : null;
    const path = "path" in detail && typeof detail.path === "string" && /^[A-Za-z_][A-Za-z_0-9.[\]]{0,159}$/.test(detail.path) ? detail.path : null;
    return code ? [path ? `${path} · ${code}` : code] : [];
  });
}
