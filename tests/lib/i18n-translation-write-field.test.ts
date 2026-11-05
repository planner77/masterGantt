import { describe, expect, it } from "vitest";
import { displayNameTranslationWriteField } from "../../src/lib/i18n/translation-write-field";

describe("Issue #866 — optional display-name write contract", () => {
  it("omits untouched values on new or existing owner writes", () => {
    expect(displayNameTranslationWriteField(undefined, {})).toEqual({});
    expect(displayNameTranslationWriteField(undefined, { en: "" })).toEqual({});
    expect(displayNameTranslationWriteField({ en: "Robot" }, { en: "Robot" })).toEqual({});
    expect(displayNameTranslationWriteField({ en: "Robot" }, { en: " Robot " })).toEqual({});
  });

  it("submits new and changed KO/EN/VI values as explicit replacement", () => {
    expect(displayNameTranslationWriteField(undefined, { en: "Robot", vi: "Rô-bốt" }))
      .toEqual({ translations: { en: "Robot", vi: "Rô-bốt" } });
    expect(displayNameTranslationWriteField({ en: "Robot" }, { en: "Robot", ko: "로봇" }))
      .toEqual({ translations: { en: "Robot", ko: "로봇" } });
  });

  it("keeps other languages on a partial clear and clears all with an explicit empty object", () => {
    expect(displayNameTranslationWriteField({ en: "Robot", vi: "Rô-bốt" }, { en: "Robot", vi: "" }))
      .toEqual({ translations: { en: "Robot" } });
    expect(displayNameTranslationWriteField({ en: "Robot", vi: "Rô-bốt" }, { en: "", vi: " " }))
      .toEqual({ translations: {} });
  });

  it("compares NFC-equivalent inputs but keeps nonblank raw text for the server validator", () => {
    expect(displayNameTranslationWriteField({ en: "é" }, { en: "e\u0301" })).toEqual({});
    expect(displayNameTranslationWriteField(undefined, { en: " Robot " }))
      .toEqual({ translations: { en: " Robot " } });
    expect(displayNameTranslationWriteField(undefined, { en: "Robot\nUnsafe" }))
      .toEqual({ translations: { en: "Robot\nUnsafe" } });
  });
});
