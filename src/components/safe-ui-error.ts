const errorMessages: Readonly<Record<string, string>> = {
  UNAUTHORIZED: "인증이 필요합니다.",
  FORBIDDEN: "이 작업을 수행할 권한이 없습니다.",
  PROJECT_NOT_FOUND: "프로젝트를 찾을 수 없습니다.",
  NOT_FOUND: "요청한 항목을 찾을 수 없습니다.",
  PRECONDITION_FAILED: "다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.",
  REVISION_CONFLICT: "다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.",
  RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};

/** Preserve only explicitly approved code/message pairs. */
const approvedDomainMessages: Readonly<Record<string, readonly string[]>> = {
  REVISION_CONFLICT: ["다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 불러왔습니다. 초안을 확인한 후 다시 저장해 주세요."],
};

/** Preserve approved domain messages; unknown responses retain the caller's context. */
export function safeApiError(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object" || !("error" in value) ||
      !value.error || typeof value.error !== "object") return fallback;
  const error = value.error;
  if ("code" in error && typeof error.code === "string") {
    const code = error.code;
    if (Object.hasOwn(approvedDomainMessages, code) && "message" in error &&
        typeof error.message === "string" && approvedDomainMessages[code]!.includes(error.message)) return error.message;
    if (Object.hasOwn(errorMessages, code)) return errorMessages[code]!;
  }
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
