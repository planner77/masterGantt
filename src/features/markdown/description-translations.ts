import type { AppLocale } from "@/lib/i18n/locales";

export const descriptionUi: Record<AppLocale, Record<string, string>> = {
  ko: { convert: "Markdown 편집으로 전환", markdown: "Markdown · 시각적 / 원문 전환", plain: "기존 일반 텍스트 · 원문 유지", length: "Description 길이 제한을 초과했습니다. 본문을 줄인 후 저장해 주세요.", recover: "원문 모드에서 수정할 수 있습니다." },
  en: { convert: "Switch to Markdown editor", markdown: "Markdown · Visual / Source", plain: "Legacy plain text · Original preserved", length: "Description exceeds the length limit. Shorten it before saving.", recover: "Correct the text in Source mode." },
  vi: { convert: "Chuyển sang trình soạn thảo Markdown", markdown: "Markdown · Trực quan / Mã nguồn", plain: "Văn bản thuần cũ · Giữ nguyên bản gốc", length: "Mô tả vượt giới hạn độ dài. Hãy rút ngắn trước khi lưu.", recover: "Có thể sửa trong chế độ mã nguồn." }
};
const translations: Record<string, [string,string]> = {
  "toolbar.richText": ["시각적 편집", "Chỉnh sửa trực quan"], "toolbar.source": ["원문 모드", "Chế độ mã nguồn"],
  "toolbar.undo": ["실행 취소 {{shortcut}}", "Hoàn tác {{shortcut}}"], "toolbar.redo": ["다시 실행 {{shortcut}}", "Làm lại {{shortcut}}"],
  "toolbar.bold": ["굵게", "Đậm"], "toolbar.removeBold": ["굵게 해제", "Bỏ đậm"],
  "toolbar.italic": ["기울임", "Nghiêng"], "toolbar.removeItalic": ["기울임 해제", "Bỏ nghiêng"],
  "toolbar.underline": ["밑줄", "Gạch chân"], "toolbar.removeUnderline": ["밑줄 해제", "Bỏ gạch chân"],
  "toolbar.strikethrough": ["취소선", "Gạch ngang"], "toolbar.removeStrikethrough": ["취소선 해제", "Bỏ gạch ngang"],
  "toolbar.inlineCode": ["인라인 코드", "Mã nội dòng"], "toolbar.removeInlineCode": ["코드 형식 해제", "Bỏ định dạng mã"],
  "toolbar.bulletedList": ["글머리표 목록", "Danh sách dấu đầu dòng"], "toolbar.numberedList": ["번호 목록", "Danh sách đánh số"],
  "toolbar.checkList": ["체크 목록", "Danh sách kiểm tra"], "toolbar.table": ["표 삽입", "Chèn bảng"],
  "toolbar.codeBlock": ["코드 블록 삽입", "Chèn khối mã"], "toolbar.thematicBreak": ["구분선 삽입", "Chèn đường phân cách"],
  "toolbar.link": ["링크 만들기", "Tạo liên kết"],
  "toolbar.blockTypes.paragraph": ["문단", "Đoạn văn"], "toolbar.blockTypes.quote": ["인용", "Trích dẫn"],
  "toolbar.blockTypes.heading": ["제목 {{level}}", "Tiêu đề {{level}}"],
  "toolbar.blockTypeSelect.selectBlockTypeTooltip": ["블록 유형 선택", "Chọn kiểu khối"],
  "toolbar.blockTypeSelect.placeholder": ["블록 유형", "Kiểu khối"],
  "toolbar.toggleGroup": ["편집 도구 그룹", "Nhóm công cụ chỉnh sửa"]
};

export function translateMarkdownToolbar(locale: AppLocale, key: string, fallback: string, vars?: Record<string, unknown>): string {
  const pair = translations[key];
  const translated = locale === "en" || !pair ? fallback : pair[locale === "ko" ? 0 : 1];
  return translated.replace(/\{\{(\w+)\}\}/g, (match, name: string) => vars?.[name] === undefined ? match : String(vars[name]));
}
