import { describe, expect, it } from "vitest";
import { translateErrorCode } from "../../src/lib/i18n";
import { safeApiError, safeDiagnosticIdentifiers } from "../../src/components/safe-ui-error";

describe("safe UI API error boundary", () => {
  it("maps known codes without exposing arbitrary response messages", () => {
    const message = safeApiError({ error: { code: "UNAUTHORIZED", message: "token-secret", stack: "private-stack" } }, "작업 실패");
    expect(message).toBe("인증이 필요합니다.");
    expect(message).not.toMatch(/secret|stack/);
  });
  it("preserves the project-not-found meaning without exposing upstream prose", () => {
    expect(safeApiError({ error: { code: "PROJECT_NOT_FOUND", message: "token-secret private-stack" } }, "작업 실패"))
      .toBe("프로젝트를 찾을 수 없습니다.");
    expect(translateErrorCode("en", "PROJECT_NOT_FOUND")).toBe("The project could not be found.");
    expect(translateErrorCode("vi", "PROJECT_NOT_FOUND")).toBe("Không tìm thấy dự án.");
  });
  it("uses safe defaults for unknown codes and malformed bodies", () => {
    expect(safeApiError({ error: { code: "secret-key", message: "private" } }, "작업 실패")).toBe("요청을 처리하지 못했습니다. 다시 시도해 주세요.");
    expect(safeApiError({ message: "private" }, "작업 실패")).toBe("작업 실패");
  });
  it("retains bounded technical validation identifiers but drops detail prose", () => {
    expect(safeDiagnosticIdentifiers([{ path: "tasks[0].name", code: "INVALID_INPUT", message: "private" }, { path: "https://secret", code: "PRIVATE" }, { code: "secret value" }])).toEqual(["tasks[0].name · INVALID_INPUT", "PRIVATE"]);
  });
});
