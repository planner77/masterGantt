import { describe, expect, it } from "vitest";
import { INITIAL_NOTIFICATION_STATE, MAX_NOTIFICATIONS, TOAST_DURATION_MS, formatNotification, notificationReducer, safeNotificationMetadata, type WorkspaceNotice } from "../../src/components/workspace-notification-state";

const notice = (id: number, kind: WorkspaceNotice["kind"] = "error"): WorkspaceNotice => ({
  id, kind, message: "안전한 안내", operation: "작업 저장", occurredAt: "2026-09-13T12:00:00Z", read: false,
});
describe("작업공간 알림 정책", () => {
  it("성공 안내가 이전 오류를 지우지 않는다", () => {
    let state = notificationReducer(INITIAL_NOTIFICATION_STATE, { type: "publish", notice: notice(1) });
    state = notificationReducer(state, { type: "publish", notice: notice(2, "success") });
    expect(state.errors.map((entry) => entry.id)).toEqual([1]);
    expect(state.toast?.id).toBe(2);
    expect(state.errors[0].read).toBe(false);
  });
  it("토스트 자동 닫힘은 5초이며 늦게 종료된 타이머는 새 알림을 지우지 않는다", () => {
    expect(TOAST_DURATION_MS).toBe(5000);
    const state = notificationReducer(INITIAL_NOTIFICATION_STATE, { type: "publish", notice: notice(2) });
    expect(notificationReducer(state, { type: "clear-toast", id: 1 })).toBe(state);
    const cleared = notificationReducer(state, { type: "clear-toast", id: 2 });
    expect(cleared.toast).toBeNull(); expect(cleared.errors).toHaveLength(1);
  });
  it("열 때 읽음 처리하고 이후 닫힌 상태의 새 오류는 미확인으로 남긴다", () => {
    let state = notificationReducer(INITIAL_NOTIFICATION_STATE, { type: "publish", notice: notice(1) });
    state = notificationReducer(state, { type: "open" });
    expect(state.open).toBe(true); expect(state.errors[0].read).toBe(true);
    state = notificationReducer(state, { type: "publish", notice: notice(2) });
    expect(state.errors.every((entry) => entry.read)).toBe(true);
    state = notificationReducer(state, { type: "close" });
    state = notificationReducer(state, { type: "publish", notice: notice(3) });
    expect(state.errors[0].read).toBe(false);
    state = notificationReducer(state, { type: "clear-read" });
    expect(state.errors.map((entry) => entry.id)).toEqual([3]);
  });
  it("보관 상한 초과를 조용히 숨기지 않고 제외 건수를 남긴다", () => {
    let state = INITIAL_NOTIFICATION_STATE;
    for (let id = 1; id <= MAX_NOTIFICATIONS + 3; id++) state = notificationReducer(state, { type: "publish", notice: notice(id) });
    expect(state.errors).toHaveLength(MAX_NOTIFICATIONS); expect(state.discarded).toBe(3);
    expect(state.errors[0].id).toBe(MAX_NOTIFICATIONS + 3);
  });
  it("서버 메시지·비밀번호·세션·스택·알 수 없는 코드는 복사 메타데이터에 포함하지 않는다", () => {
    const metadata = safeNotificationMetadata({ error: { code: "INTERNAL_ERROR", message: "secret-password", stack: "SQL", requestId: "00000000-0000-4000-8000-000000000001" }, cookie: "secret-session" });
    expect(metadata).toEqual({ code: "INTERNAL_ERROR", requestId: "00000000-0000-4000-8000-000000000001" });
    expect(safeNotificationMetadata({ error: { code: "secret-password", requestId: "Bearer token" } })).toEqual({});
    for (const input of [null, false, 123, "raw response"]) expect(safeNotificationMetadata(input)).toEqual({});
  });
  it("locale 시각과 안전한 내용을 출력하며 없는 요청 ID를 만들지 않는다", () => {
    const text = formatNotification(notice(1), "프로젝트 A");
    expect(text).toContain("대상: 프로젝트 A");
    expect(text).toContain(new Date(notice(1).occurredAt).toLocaleString());
    expect(text).toContain("작업: 작업 저장"); expect(text).not.toContain("요청 ID:");
  });
});
