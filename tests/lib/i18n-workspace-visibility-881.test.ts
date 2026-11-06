import { describe, expect, it } from "vitest";
import { translate } from "../../src/lib/i18n";

describe("Issue #881 screen visibility messages", () => {
  it("localizes fixed labels to Korean, English and Vietnamese", () => {
    expect(translate("ko", "화면 표시")).toBe("화면 표시");
    expect(translate("en", "화면 표시")).toBe("Screen visibility");
    expect(translate("vi", "화면 표시")).toBe("Hiển thị màn hình");
    for (const locale of ["en", "vi"] as const) {
      expect(translate(locale, "화면 표시 저장")).not.toBe("화면 표시 저장");
      expect(translate(locale, "일정은 항상 표시됩니다. 이 설정은 접근 권한이나 데이터를 변경하지 않습니다.")).not.toContain("일정은");
    }
  });
});
