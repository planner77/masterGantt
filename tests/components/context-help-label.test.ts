import { describe, expect, it } from "vitest";
import { contextHelpLabel } from "../../src/components/ui/context-help-label";
import { translate } from "../../src/lib/i18n";
import { SUPPORTED_LOCALES } from "../../src/lib/i18n/locales";

describe("context help accessible labels", () => {
  it("keeps the complete Korean Server Component label without a second suffix", () => {
    expect(contextHelpLabel("프로젝트 기준정보 관리 도움말", "ko")).toBe("프로젝트 기준정보 관리 도움말");
  });

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}: retains the complete source label when its translation is unavailable`, () => {
      expect(contextHelpLabel("등록되지 않은 화면 도움말", locale)).toBe("등록되지 않은 화면 도움말");
    });

    it(`${locale}: formats a topic once and preserves an already translated complete label`, () => {
      const topic = translate(locale, "프로젝트");
      const expected = translate(locale, "{name} 도움말", { name: topic });
      expect(contextHelpLabel("프로젝트", locale)).toBe(expected);
      expect(contextHelpLabel(expected, locale)).toBe(expected);
    });

    it(`${locale}: preserves an existing catalog label using a help prefix`, () => {
      const expected = translate(locale, "Milestone 선택 작업과 전체 Gate 도움말");
      expect(contextHelpLabel(expected, locale)).toBe(expected);
    });

    it(`${locale}: preserves a registered source label and its translated form`, () => {
      const expected = translate(locale, "물류 구성 도움말");
      expect(contextHelpLabel("물류 구성 도움말", locale)).toBe(expected);
      expect(contextHelpLabel(expected, locale)).toBe(expected);
    });
  }
});
