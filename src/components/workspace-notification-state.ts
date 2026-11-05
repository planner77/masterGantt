import { translate, type MessageParameters } from "../lib/i18n";
import { LOCALE_FORMATS, type AppLocale } from "../lib/i18n/locales";
export const MAX_NOTIFICATIONS = 50;
export const TOAST_DURATION_MS = 5_000;
export type NoticeKind = "success" | "info" | "error";
export type NoticeSegment = Readonly<{ key: string; parameters?: MessageParameters; labels?: Readonly<Record<string, string>> }>;
export type NoticePresentation = Readonly<{ parameters?: MessageParameters; labels?: Readonly<Record<string, string>>; segments?: readonly NoticeSegment[] }>;
export type WorkspaceNotice = Readonly<{
  id: number;
  kind: NoticeKind;
  message: string;
  operation: string;
  occurredAt: string;
  code?: string;
  requestId?: string;
  read: boolean;
  presentation?: NoticePresentation;
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
  "VALIDATION_ERROR", "PROJECT_NOT_FOUND", "TASK_NOT_FOUND", "UNAUTHORIZED", "INVALID_CREDENTIALS",
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

/** Resolve only fixed labels; names and other supplied parameters remain opaque. */
export function localizedNoticeText(notice: WorkspaceNotice, locale: AppLocale): string {
  const render = (key: string, presentation?: Pick<NoticePresentation, "parameters" | "labels">) => translate(locale, key, { ...presentation?.parameters,
    ...Object.fromEntries(Object.entries(presentation?.labels ?? {}).map(([name, label]) => [name, translate(locale, label)])),
  });
  return render(notice.message, notice.presentation) + (notice.presentation?.segments ?? []).map(segment => render(segment.key, segment)).join("");
}

export function formatNotification(notice: WorkspaceNotice, scope: string, locale: AppLocale = "ko"): string {
  return [
    `${translate(locale, "대상")}: ${scope}`,
    `${translate(locale, "발생 시각")}: ${new Date(notice.occurredAt).toLocaleString(LOCALE_FORMATS[locale])}`,
    `${translate(locale, "작업")}: ${translate(locale, notice.operation)}`,
    `${translate(locale, "내용")}: ${localizedNoticeText(notice, locale)}`,
    ...(notice.code ? [`${translate(locale, "오류 코드")}: ${notice.code}`] : []),
    ...(notice.requestId ? [`${translate(locale, "요청 ID")}: ${notice.requestId}`] : []),
  ].join("\n");
}
