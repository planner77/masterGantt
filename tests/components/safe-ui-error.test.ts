import { describe, expect, it } from "vitest";
import { safeApiError, safeDiagnosticIdentifiers } from "../../src/components/safe-ui-error";

const fallback = "Excel 보고서를 만들지 못했습니다. 다시 조회 후 시도하세요.";

describe("safe UI error presentation", () => {
  it("keeps specific approved domain context before using a generic code", () => {
    const message = "다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 불러왔습니다. 초안을 확인한 후 다시 저장해 주세요.";
    expect(safeApiError({ error: { code: "REVISION_CONFLICT", message } }, fallback)).toBe(message);
    expect(safeApiError({ error: { code: "UNAUTHORIZED", message: "token=PRIVATE" } }, fallback)).toBe("인증이 필요합니다.");
    expect(safeApiError({ error: { code: "PRECONDITION_FAILED" } }, fallback)).toBe("다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.");
  });

  it.each([
    null, undefined, "SQLITE_ERROR: SELECT password FROM projects", {}, { error: null },
    { error: "Authorization: Bearer PRIVATE" },
    { error: { code: "SQLITE_ERROR", message: "SELECT secret FROM sessions", stack: "/server/private.ts" } },
    { error: { code: "INTERNAL_SERVER_ERROR", message: "password=PRIVATE" } },
    { error: { code: "__proto__", message: "__proto__" } },
    { error: { code: "constructor", message: "constructor" } },
    { error: { code: "toString", message: "toString" } },
  ])("retains caller context for unapproved upstream data (%j)", value => {
    expect(safeApiError(value, fallback)).toBe(fallback);
  });

  it.each(Object.getOwnPropertyNames(Object.prototype).filter(code =>
    !["__proto__", "constructor", "toString"].includes(code),
  ))("rejects the remaining inherited Object.prototype code %s", code => {
    expect(safeApiError({ error: { code, message: "저장" } }, fallback)).toBe(fallback);
  });

  it("does not invoke an inherited approval matcher", () => {
    const code = "UPSTREAM_INHERITED_APPROVAL";
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, code);
    let matcherCalled = false;
    Object.defineProperty(Object.prototype, code, {
      configurable: true,
      value: { includes: () => { matcherCalled = true; return true; } },
    });
    try {
      expect(safeApiError({ error: { code, message: "저장" } }, fallback)).toBe(fallback);
      expect(matcherCalled).toBe(false);
    } finally {
      if (previous) Object.defineProperty(Object.prototype, code, previous);
      else Reflect.deleteProperty(Object.prototype, code);
    }
  });

  it("requires the approved message to belong to its exact code", () => {
    const message = "다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 불러왔습니다. 초안을 확인한 후 다시 저장해 주세요.";
    expect(safeApiError({ error: { code: "UNKNOWN", message } }, fallback)).toBe(fallback);
    expect(safeApiError({ error: { code: "UNAUTHORIZED", message } }, fallback)).toBe("인증이 필요합니다.");
    expect(safeApiError({ error: { code: "REVISION_CONFLICT", message: `${message} 추가 원문` } }, fallback)).toBe("다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.");
  });

  it("never maps an untrusted catalog-shaped error message to an unrelated UI action", () => {
    expect(safeApiError({ error: { code: "SQLITE_ERROR", message: "저장" } }, fallback)).toBe(fallback);
    expect(safeApiError({ error: { code: "REVISION_CONFLICT", message: "저장" } }, fallback)).toBe("다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.");
    expect(safeApiError({ error: { code: "UNAUTHORIZED", message: "저장" } }, fallback)).toBe("인증이 필요합니다.");
    expect(safeApiError({ error: { code: "VALIDATION_ERROR", message: "저장" } }, fallback)).toBe(fallback);
  });

  it("exposes only bounded diagnostic codes and paths, without raw messages", () => {
    const details = [
      { code: "INVALID_DATE", path: "tasks[12].start", message: "SQL: SELECT password", value: "PRIVATE" },
      { code: "REVISION_CONFLICT", path: "credentials/password=PRIVATE" },
      { code: "VALIDATION_ERROR", path: "a".repeat(161) },
      { code: "A".repeat(64), path: "_root.memberIds[0]" },
      { code: "A".repeat(65), path: "tasks" },
      { code: "lowercase_code", path: "tasks" },
      { code: "__proto__", path: "tasks" },
      { code: "SELECT password FROM projects", path: "tasks" },
      { message: "Authorization: Bearer PRIVATE" }, null, "PRIVATE",
    ];
    expect(safeDiagnosticIdentifiers(details)).toEqual([
      "tasks[12].start · INVALID_DATE", "REVISION_CONFLICT", "VALIDATION_ERROR",
      `_root.memberIds[0] · ${"A".repeat(64)}`,
    ]);
    expect(safeDiagnosticIdentifiers({ details })).toEqual([]);
    expect(safeDiagnosticIdentifiers(undefined)).toEqual([]);
  });
});
