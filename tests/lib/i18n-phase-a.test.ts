import { afterEach, describe, expect, it, vi } from "vitest";
import {
  displayName, formatLocaleNumber, messages, translate, translateErrorCode,
} from "../../src/lib/i18n";
import {
  LOCALE_STORAGE_KEY, normalizeLocale, resolveLocale, SUPPORTED_LOCALES,
} from "../../src/lib/i18n/locales";
import { SVAR_LOCALES } from "../../src/features/gantt/svar-locales";
import { SSR_DATE_LOCALE, formatLocaleDateOnly } from "../../src/lib/date-display";

describe("Issue #866 Phase A locale foundation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("prioritizes valid user choice, then browser preferences, then Korean", () => {
    expect(resolveLocale("vi", ["en-US", "ko-KR"])).toBe("vi");
    expect(resolveLocale(null, ["fr-FR", "vi-VN", "en-GB"])).toBe("vi");
    expect(resolveLocale("en-US", ["ko-KR"])).toBe("ko");
    expect(resolveLocale(undefined, ["ja-JP"])).toBe("ko");
    expect(normalizeLocale("VI-vn")).toBe("vi");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("unknown-LATN")).toBeUndefined();
    expect(SUPPORTED_LOCALES).toEqual(["ko", "en", "vi"]);
  });

  it("keeps SSR stable and tolerates disabled localStorage", async () => {
    const store = await import("../../src/lib/i18n/store");
    expect(store.getServerLocale()).toBe("ko");
    expect(store.getCurrentLocale()).toBe("ko");
    const browser = new EventTarget();
    Object.defineProperty(browser, "localStorage", { get() { throw new Error("denied"); } });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("navigator", { languages: ["vi-VN"], language: "vi-VN" });
    expect(store.getCurrentLocale()).toBe("vi");
    const listener = vi.fn();
    const unsubscribe = store.subscribeLocale(listener);
    store.setCurrentLocale("en");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getCurrentLocale()).toBe("en");
    unsubscribe();
    store.setCurrentLocale("ko");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("persists only the display language and restores it on module reload", async () => {
    const saved = new Map<string, string>();
    const browser = Object.assign(new EventTarget(), {
      localStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    const store = await import("../../src/lib/i18n/store");
    expect(store.getCurrentLocale()).toBe("en");
    store.setCurrentLocale("vi");
    expect([...saved]).toEqual([[LOCALE_STORAGE_KEY, "vi"]]);
    vi.resetModules();
    const restored = await import("../../src/lib/i18n/store");
    expect(restored.getCurrentLocale()).toBe("vi");
  });

  it("has non-empty English/Vietnamese plain-text catalog values with consistent placeholders", () => {
    for (const [key, entry] of Object.entries(messages)) {
      const expected = key.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.sort() ?? [];
      for (const locale of ["en", "vi"] as const) {
        expect(entry[locale].trim(), `${key}:${locale}`).not.toBe("");
        // ICU plural forms may spell a count as a word ("one day") instead of {count}.
        const variants = entry.plural?.[locale];
        if (variants) {
          expect(variants.one.trim(), `${key}:${locale}:one`).not.toBe("");
          expect(variants.other.trim(), `${key}:${locale}:other`).not.toBe("");
        } else {
          expect(entry[locale].match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.sort() ?? [], `${key}:${locale}`).toEqual(expected);
        }
      }
    }
    expect(translate("en", "주요 메뉴")).toBe("Main navigation");
    expect(translate("vi", "프로젝트")).toBe("Dự án");
    expect(translate("vi", "표시 언어")).toBe("Ngôn ngữ hiển thị");
  });

  it("preserves user input, original names, and safe error-code boundaries", () => {
    const userText = "<script>user text</script> & input";
    for (const locale of SUPPORTED_LOCALES) {
      expect(translate(locale, userText)).toBe(userText);
      expect(displayName({ name: userText }, locale)).toBe(userText);
      expect(displayName({ name: userText, translations: { en: "Assembly" } }, locale))
        .toBe(locale === "en" ? "Assembly" : userText);
    }
    expect(translateErrorCode("en", "UNAUTHORIZED")).toBe("Authentication is required.");
    expect(translateErrorCode("vi", "Authorization: PRIVATE SECRET"))
      .toBe("Không thể hoàn tất yêu cầu. Vui lòng thử lại.");
    expect(formatLocaleNumber(1234, "en")).toBe("1,234");
  });

  it("keeps calendar weekStart Monday and only changes visible SVAR words", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const words = SVAR_LOCALES[locale];
      expect(words.lang).toBe({ ko: "ko-KR", en: "en-US", vi: "vi-VN" }[locale]);
      expect(words.calendar.weekStart).toBe(1);
      expect(words.calendar.monthFull).toHaveLength(12);
      expect(words.calendar.dayShort).toHaveLength(7);
      expect(Object.keys(words.gantt).sort()).toEqual(Object.keys(SVAR_LOCALES.ko.gantt).sort());
    }
    expect(SVAR_LOCALES.vi.gantt["Task name"]).toBe("Tên công việc");
    expect(SVAR_LOCALES.ko.gantt["Add task"]).toBe("작업 추가");
    expect(SSR_DATE_LOCALE).toBe("ko-KR");
    for (const locale of ["ko-KR", "en-US", "vi-VN"]) {
      const text = formatLocaleDateOnly("2026-01-05", locale);
      expect(text).toContain("2026");
      expect(formatLocaleDateOnly("2026-02-30", locale)).toBe("—");
    }
  });
});
