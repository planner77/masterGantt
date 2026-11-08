import { LOCALE_FORMATS, type AppLocale } from "../../lib/i18n/locales";

/** Public Locale/words extension for the installed SVAR Core 2.7.3 contract. */
const ganttTerms: Record<string, readonly [string, string]> = {
  "Task name": ["작업명", "Tên công việc"], "Start date": ["시작일", "Ngày bắt đầu"],
  "Add task": ["작업 추가", "Thêm công việc"], Duration: ["기간", "Thời lượng"],
  Task: ["작업", "Công việc"], Milestone: ["Milestone", "Milestone"], "Summary task": ["요약 작업", "Công việc tổng hợp"],
  Resources: ["리소스", "Nguồn lực"], WBS: ["WBS", "WBS"], Hours: ["시간", "Giờ"],
  Save: ["저장", "Lưu"], Delete: ["삭제", "Xóa"], Name: ["이름", "Tên"], Description: ["설명", "Mô tả"],
  "Select type": ["유형 선택", "Chọn loại"], Type: ["유형", "Loại"], "End date": ["종료일", "Ngày kết thúc"],
  Progress: ["진척률", "Tiến độ"], Predecessors: ["선행 작업", "Công việc trước"], Successors: ["후행 작업", "Công việc sau"],
  "Add task name": ["작업명 입력", "Nhập tên công việc"], "Add description": ["설명 입력", "Nhập mô tả"],
  "Select link type": ["연결 유형 선택", "Chọn loại liên kết"],
  "End-to-start": ["종료 후 시작", "Kết thúc đến bắt đầu"], "Start-to-start": ["시작과 시작", "Bắt đầu đến bắt đầu"],
  "End-to-end": ["종료와 종료", "Kết thúc đến kết thúc"], "Start-to-end": ["시작 후 종료", "Bắt đầu đến kết thúc"],
  "No links": ["연결 없음", "Không có liên kết"], "No assignments": ["배정 없음", "Chưa phân công"],
  "No segments": ["구간 없음", "Không có phân đoạn"], "Add resource": ["리소스 추가", "Thêm nguồn lực"],
  Resource: ["리소스", "Nguồn lực"], General: ["일반", "Chung"], Links: ["연결", "Liên kết"], Lag: ["시차", "Độ trễ"],
  Segments: ["구간", "Phân đoạn"], Ungrouped: ["그룹 없음", "Chưa có nhóm"], Unassigned: ["미배정", "Chưa phân công"],
  Add: ["추가", "Thêm"], "Child task": ["하위 작업", "Công việc con"], "Task above": ["위에 작업 추가", "Thêm công việc bên trên"],
  "Task below": ["아래에 작업 추가", "Thêm công việc bên dưới"], "Convert to": ["유형 변경", "Chuyển thành"],
  Edit: ["수정", "Chỉnh sửa"], Cut: ["잘라내기", "Cắt"], Copy: ["복사", "Sao chép"], Paste: ["붙여넣기", "Dán"],
  Move: ["이동", "Di chuyển"], Up: ["위로", "Lên"], Down: ["아래로", "Xuống"], Indent: ["들여쓰기", "Thụt vào"],
  Outdent: ["내어쓰기", "Thụt ra"], "Split task": ["작업 분할", "Tách công việc"], Segment: ["구간", "Phân đoạn"],
  "New task": ["새 작업", "Công việc mới"], "Move up": ["위로 이동", "Di chuyển lên"], "Move down": ["아래로 이동", "Di chuyển xuống"],
  Undo: ["실행 취소", "Hoàn tác"], Redo: ["다시 실행", "Làm lại"], Week: ["주", "Tuần"], Q: ["분기", "Quý"],
};

// Custom Grid headers use stable source keys. The native Locale adapter may
// reprocess its initial column definitions when words change.
const appColumnTerms: Record<string, readonly [string, string]> = {
  "요약 작업 (일정 미산정)": ["Summary task (unscheduled)", "Công việc tổng hợp (chưa lên lịch)"],
  "선택": ["Select", "Chọn"], "작업": ["Task", "Công việc"],
  "외부 ID": ["External ID", "ID bên ngoài"], "시작": ["Start", "Bắt đầu"],
  "기간": ["Duration", "Thời lượng"], "기준 시작": ["Baseline start", "Bắt đầu cơ sở"],
  "기준 종료": ["Baseline end", "Kết thúc cơ sở"], "작업 추가": ["Add task", "Thêm công việc"],
};

const columnHeaderSources: Readonly<Record<string, string>> = {
  copySelection: "선택", text: "작업", externalId: "외부 ID",
  projectStart: "시작", projectDuration: "기간", baselineStart: "기준 시작",
  baselineEnd: "기준 종료", milestoneStage: "Milestone", "add-task": "작업 추가",
};

/** A native normalized header is presentation data, never a translation key. */
export function ganttColumnHeader(id: string | number, locale: AppLocale): string | undefined {
  if (!Object.hasOwn(columnHeaderSources, id)) return undefined;
  const source = columnHeaderSources[id];
  if (source === "Milestone") return source;
  const words = appColumnTerms[source];
  return locale === "ko" ? source : words[locale === "en" ? 0 : 1];
}

function calendarTerms(locale: AppLocale) {
  const formatLocale = LOCALE_FORMATS[locale];
  const monthFull = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(formatLocale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1))));
  const monthShort = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(formatLocale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1))));
  const dayFull = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(formatLocale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + day))));
  const dayShort = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(formatLocale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + day))));
  const terms = locale === "ko"
    ? { hours: "시간", minutes: "분", done: "완료", clear: "지우기", today: "오늘", am: ["오전", "오전"], pm: ["오후", "오후"] }
    : locale === "vi"
      ? { hours: "Giờ", minutes: "Phút", done: "Xong", clear: "Xóa", today: "Hôm nay", am: ["SA", "SA"], pm: ["CH", "CH"] }
      : { hours: "Hours", minutes: "Minutes", done: "Done", clear: "Clear", today: "Today", am: ["am", "AM"], pm: ["pm", "PM"] };
  // Locale changes must never change effective calendars or Monday week boundaries.
  return { ...terms, monthFull, monthShort, dayFull, dayShort, weekStart: 1, clockFormat: 24 };
}

function createWords(locale: AppLocale) {
  return {
    lang: LOCALE_FORMATS[locale],
    calendar: calendarTerms(locale),
    core: locale === "ko"
      ? { ok: "확인", cancel: "취소", select: "선택", "No data": "자료 없음", "Rows per page": "페이지당 행", "Total pages": "전체 페이지" }
      : locale === "vi"
        ? { ok: "Xác nhận", cancel: "Hủy", select: "Chọn", "No data": "Không có dữ liệu", "Rows per page": "Số dòng mỗi trang", "Total pages": "Tổng số trang" }
        : { ok: "OK", cancel: "Cancel", select: "Select", "No data": "No data", "Rows per page": "Rows per page", "Total pages": "Total pages" },
    formats: { timeFormat: "%H:%i", dateFormat: locale === "en" ? "%m/%d/%Y" : locale === "vi" ? "%d/%m/%Y" : "%Y-%m-%d", monthYearFormat: "%F %Y", yearFormat: "%Y" },
    gantt: Object.fromEntries([
      ...Object.entries(ganttTerms).map(([key, values]) => [key, locale === "en" ? key : values[locale === "ko" ? 0 : 1]] as const),
      ...Object.entries(appColumnTerms).map(([key, values]) => [key, locale === "ko" ? key : values[locale === "en" ? 0 : 1]] as const),
    ]),
  };
}

export const SVAR_LOCALES = { ko: createWords("ko"), en: createWords("en"), vi: createWords("vi") };
