import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCalendarDto } from "../../src/contracts/projects";
import { displayName, formatLocaleNumber, messages, translate, translateErrorCode } from "../../src/lib/i18n";
import { LOCALE_STORAGE_KEY, normalizeLocale, resolveLocale, SUPPORTED_LOCALES } from "../../src/lib/i18n/locales";
import { weekCalendarInterval } from "../../src/features/gantt/week-calendar-interval";
import { weekTimelineTooltip } from "../../src/features/gantt/week-timeline-tooltip";
import { SVAR_LOCALES } from "../../src/features/gantt/svar-locales";

// ADD: language preference and static messages have no existing locale registry seam.
// KEEP_UNIQUE: date-display.test.ts still owns date-only/instant timezone invariants.
describe("display language registry and catalogs", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it("uses a valid explicit selection before browser languages and resolves the first supported regional tag", () => {
    expect(resolveLocale("vi", ["en-US", "ko-KR"])).toBe("vi");
    expect(resolveLocale(null, ["fr-FR", "vi-VN", "en-US"])).toBe("vi");
    expect(resolveLocale("invalid", ["de-DE", "en-GB"])).toBe("en");
    expect(resolveLocale("en-US", ["ko-KR"])).toBe("ko");
    expect(resolveLocale(undefined, ["ja-JP"])).toBe("ko");
    expect(resolveLocale("", [])).toBe("ko");
    expect(normalizeLocale("VI-vn")).toBe("vi");
    expect(normalizeLocale("viNotARealLanguage")).toBeUndefined();
  });

  it("keeps Korean SSR deterministic and tolerates unavailable browser storage", async () => {
    const store = await import("../../src/lib/i18n/store");
    expect(store.getServerLocale()).toBe("ko");
    expect(store.getCurrentLocale()).toBe("ko");
    const browser = new EventTarget();
    Object.defineProperty(browser, "localStorage", { get() { throw new Error("denied"); } });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("navigator", { languages: ["vi-VN", "en-US"], language: "vi-VN" });
    expect(store.getCurrentLocale()).toBe("vi");
    const listener = vi.fn();
    const unsubscribe = store.subscribeLocale(listener);
    store.setCurrentLocale("en");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getCurrentLocale()).toBe("en");
    vi.stubGlobal("navigator", { languages: ["ko-KR"], language: "ko-KR" });
    expect(store.getCurrentLocale()).toBe("en");
    unsubscribe();
    store.setCurrentLocale("ko");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("persists an explicit choice without reading or sending domain data", async () => {
    const saved = new Map<string, string>();
    const browser = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    const store = await import("../../src/lib/i18n/store");
    expect(store.getCurrentLocale()).toBe("en");
    store.setCurrentLocale("vi");
    expect(saved.get(LOCALE_STORAGE_KEY)).toBe("vi");
    expect([...saved.keys()]).toEqual([LOCALE_STORAGE_KEY]);
    vi.resetModules();
    const reloaded = await import("../../src/lib/i18n/store");
    expect(reloaded.getCurrentLocale()).toBe("vi");
  });

  it("requires both translations and matching interpolation parameters for every registered static key", () => {
    for (const [key, entry] of Object.entries(messages)) {
      const parameters = key.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.sort() ?? [];
      for (const locale of ["en", "vi"] as const) {
        expect(entry[locale].trim(), `${key}:${locale}`).not.toBe("");
        expect(entry[locale].match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.sort() ?? [], `${key}:${locale}`).toEqual(parameters);
      }
    }
    expect(translate("en", "선택 {count}개", { count: 1000 })).toBe("1,000 selected");
    expect(translate("en", "{count}일", { count: 1 })).toBe("1 day");
    expect(translate("en", "{count}일", { count: 2 })).toBe("2 days");
    expect(translate("vi", "{count}일", { count: 1 })).toBe("1 ngày");
    expect(translate("vi", "등록하지 않은 키")).toBe("등록하지 않은 키");
    expect(translate("en", "{name} 복사 대상으로 선택", { name: "<script>alert(1)</script>" })).toBe("Select <script>alert(1)</script> for copying");
  });

  it("uses plain process headings, readonly apostrophes and setup hints in all display languages", () => {
    const heading = "공정 & 작업 구역 관리";
    const readonly = "조회 전용 모드입니다. 편집을 수행하려면 작업공간 상단의 '편집 잠금 해제'를 진행해 주세요.";
    const hint = "설비를 추가하려면 기준정보의 공정&WorkArea에서 주 관리 공정을 먼저 등록해 주세요.";
    const expected = {
      ko: [heading, readonly, hint],
      en: ["Process & WorkArea management", "Read-only mode. Unlock editing at the top of the workspace to make changes.", "Before adding equipment, register its primary process under Master data → Process & WorkArea."],
      vi: ["Quản lý công đoạn và khu vực làm việc", "Chế độ chỉ đọc. Mở khóa chỉnh sửa ở đầu không gian làm việc để thay đổi.", "Trước khi thêm thiết bị, đăng ký công đoạn chính tại Danh mục → Công đoạn & Khu vực."],
    };
    for (const locale of SUPPORTED_LOCALES) {
      expect([heading, readonly, hint].map(key => translate(locale, key))).toEqual(expected[locale]);
    }
  });

  it("preserves authored entity spelling in unknown text, display names and interpolation", () => {
    const authored = "Tên &amp; 사용자 &gt; literal &apos; unchanged";
    for (const locale of SUPPORTED_LOCALES) {
      expect(translate(locale, authored)).toBe(authored);
      expect(displayName({ name: authored }, locale)).toBe(authored);
      expect(displayName({ name: "Original", translations: { [locale]: authored } }, locale)).toBe(authored);
      expect(translate(locale, "{name} 복사 대상으로 선택", { name: authored })).toContain(authored);
    }
  });

  it("uses only the selected name translation and otherwise preserves the exact original", () => {
    const item = { name: "  조립 & Assembly  ", translations: { en: "Assembly", vi: "" } };
    expect(displayName(item, "en")).toBe("Assembly");
    expect(displayName(item, "vi")).toBe(item.name);
    expect(displayName(item, "ko")).toBe(item.name);
    expect(displayName({ name: "Original" }, "vi")).toBe("Original");
    expect(item.name).toBe("  조립 & Assembly  ");
  });

  it("maps whitelisted error codes and never reveals raw exception strings", () => {
    expect(translateErrorCode("en", "UNAUTHORIZED")).toBe("Authentication is required.");
    expect(translateErrorCode("vi", "Authorization: SECRET traceback")).toBe("Không thể hoàn tất yêu cầu. Vui lòng thử lại.");
    expect(translateErrorCode("ko", { message: "private exception" })).not.toContain("private");
    expect(formatLocaleNumber(1234.5, "vi")).toBe(new Intl.NumberFormat("vi-VN").format(1234.5));
  });

  it("localizes week descriptions without changing ISO boundaries or effective working days", () => {
    const date = new Date(2026, 8, 16);
    const calendar: ProjectCalendarDto = { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [{ date: "2026-09-15", name: "원문 휴일" }] };
    const original = weekCalendarInterval(date);
    const originalTooltip = weekTimelineTooltip("2026-09-14", calendar);
    for (const locale of SUPPORTED_LOCALES) {
      const interval = weekCalendarInterval(date, locale);
      expect([interval.start, interval.end, interval.last, interval.label]).toEqual([original.start, original.end, original.last, original.label]);
      const tooltip = weekTimelineTooltip("2026-09-14", calendar, locale);
      expect([tooltip.workingDays, tooltip.start, tooltip.end, tooltip.holidays]).toEqual([originalTooltip.workingDays, originalTooltip.start, originalTooltip.end, originalTooltip.holidays]);
      expect(tooltip.ariaLabel).toContain("원문 휴일");
      expect(tooltip.ariaLabel).toContain("ISO 2026-W38");
    }
    expect(weekTimelineTooltip("2026-09-14", calendar, "en").ariaLabel).toContain("working days");
    expect(weekTimelineTooltip("2026-09-14", calendar, "vi").ariaLabel).toContain("ngày làm việc");
  });

  it("provides complete installed SVAR gantt/core/calendar dictionaries without changing Monday week semantics", () => {
    const ganttKeys = Object.keys(SVAR_LOCALES.en.gantt).sort();
    for (const locale of SUPPORTED_LOCALES) {
      const words = SVAR_LOCALES[locale];
      expect(Object.keys(words.gantt).sort()).toEqual(ganttKeys);
      expect(words.calendar.weekStart).toBe(1);
      expect(words.calendar.monthFull).toHaveLength(12);
      expect(words.calendar.dayShort).toHaveLength(7);
      expect(Object.keys(words.core).sort()).toEqual(Object.keys(SVAR_LOCALES.en.core).sort());
      for (const value of Object.values(words.gantt)) expect(value.trim()).not.toBe("");
    }
    expect(SVAR_LOCALES.vi.gantt["Task name"]).toBe("Tên công việc");
    expect(SVAR_LOCALES.ko.gantt["Add task"]).toBe("작업 추가");
  });
});
