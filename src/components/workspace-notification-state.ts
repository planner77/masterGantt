export const MAX_NOTIFICATIONS = 50;
export const TOAST_DURATION_MS = 5_000;
export type NoticeKind = "success" | "info" | "error";
export type WorkspaceNotice = Readonly<{
  id: number;
  kind: NoticeKind;
  message: string;
  operation: string;
  occurredAt: string;
  code?: string;
  requestId?: string;
  read: boolean;
}>;
export type NotificationState = Readonly<{
  toast: WorkspaceNotice | null;
  errors: readonly WorkspaceNotice[];
  open: boolean;
  discarded: number;
}>;
export const INITIAL_NOTIFICATION_STATE: NotificationState = {
  toast: null, errors: [], open: false, discarded: 0,
};
export type NotificationAction =
  | { type: "publish"; notice: WorkspaceNotice }
  | { type: "clear-toast"; id?: number }
  | { type: "open" }
  | { type: "close" }
  | { type: "clear-read" };

export function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "publish": {
      const notice = { ...action.notice, read: state.open };
      if (notice.kind !== "error") return { ...state, toast: notice };
      const errors = [notice, ...state.errors];
      return { ...state, toast: notice, errors: errors.slice(0, MAX_NOTIFICATIONS),
        discarded: state.discarded + Math.max(0, errors.length - MAX_NOTIFICATIONS) };
    }
    case "clear-toast":
      return action.id !== undefined && state.toast?.id !== action.id
        ? state : { ...state, toast: null };
    case "open":
      return { ...state, open: true, errors: state.errors.map((notice) => ({ ...notice, read: true })) };
    case "close": return { ...state, open: false };
    case "clear-read": return { ...state, errors: state.errors.filter((notice) => !notice.read), discarded: 0 };
  }
}

const SAFE_CODES = new Set([
  "RATE_LIMITED", "REVISION_MISMATCH", "END_DURATION_MISMATCH", "EMPTY_SUMMARY_NOT_ALLOWED",
  "PARENT_CONVERSION_REQUIRED", "INVALID_PARENT_TASK", "ORIGIN_NOT_ALLOWED", "INVALID_INPUT",
  "VALIDATION_ERROR", "PROJECT_NOT_FOUND", "TASK_NOT_FOUND", "UNAUTHORIZED", "INVALID_PASSWORD",
  "EDIT_SESSION_REQUIRED", "INTERNAL_ERROR", "INVALID_CONTENT_TYPE", "PAYLOAD_TOO_LARGE",
]);

/** Only allow contract metadata, never raw response messages or exception details. */
export function safeNotificationMetadata(value: unknown): { code?: string; requestId?: string } {
  if (typeof value !== "object" || value === null) return {};
  const body = value as Record<string, unknown>;
  const error = typeof body.error === "object" && body.error !== null
    ? body.error as Record<string, unknown> : {};
  const code = typeof error.code === "string" && SAFE_CODES.has(error.code) ? error.code : undefined;
  const id = error.requestId ?? body.requestId;
  const requestId = typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id : undefined;
  return { ...(code ? { code } : {}), ...(requestId ? { requestId } : {}) };
}

export function formatNotification(notice: WorkspaceNotice, scope: string): string {
  return [
    `대상: ${scope}`,
    `발생 시각: ${new Date(notice.occurredAt).toLocaleString()}`,
    `작업: ${notice.operation}`,
    `내용: ${notice.message}`,
    ...(notice.code ? [`오류 코드: ${notice.code}`] : []),
    ...(notice.requestId ? [`요청 ID: ${notice.requestId}`] : []),
  ].join("\n");
}
