import { messages } from "../lib/i18n";

const errorMessages: Readonly<Record<string, string>> = {
  UNAUTHORIZED: "인증이 필요합니다.",
  FORBIDDEN: "이 작업을 수행할 권한이 없습니다.",
  PROJECT_NOT_FOUND: "프로젝트를 찾을 수 없습니다.",
  NOT_FOUND: "요청한 항목을 찾을 수 없습니다.",
  PRECONDITION_FAILED: "다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.",
  REVISION_CONFLICT: "다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.",
  RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};

/** Preserve approved domain messages; unknown responses retain the caller's context. */
export function safeApiError(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object" || !("error" in value) ||
      !value.error || typeof value.error !== "object") return fallback;
  const error = value.error;
  if ("message" in error && typeof error.message === "string" && Object.hasOwn(messages, error.message)) return error.message;
  if ("code" in error && typeof error.code === "string" && Object.hasOwn(errorMessages, error.code)) return errorMessages[error.code]!;
  return fallback;
}

/** Diagnostics expose contract codes and field paths, never arbitrary message text. */
export function safeDiagnosticIdentifiers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(detail => {
    if (!detail || typeof detail !== "object") return [];
    const code = "code" in detail && typeof detail.code === "string" && /^[A-Z][A-Z_0-9]{0,63}$/.test(detail.code) ? detail.code : null;
    const path = "path" in detail && typeof detail.path === "string" && /^[A-Za-z_][A-Za-z_0-9.[\]]{0,159}$/.test(detail.path) ? detail.path : null;
    return code ? [path ? `${path} · ${code}` : code] : [];
  });
}
