import { describe, expect, it } from "vitest";
import { translate } from "../../../src/lib/i18n";
import { presentCountryCalendarError, resolveCountryCalendarError } from "../../../src/features/country-calendars/error-presentation";
describe("country-calendar error source", () => {
  const english = (key: string) => translate("en", key);
  it("preserves server detail including row paths even if it resembles a UI key", () => {
    const server = "저장\nrow[2].name: 저장";
    expect(presentCountryCalendarError(server, true, english)).toBe(server);
  });
  it("still localizes locally authored static messages", () => {
    expect(presentCountryCalendarError("관리자 인증에 실패했습니다.", false, english)).toBe("Administrator authentication failed.");
  });
  it.each(["en", "vi"] as const)("resolves local fallback and opaque lines independently in %s", locale => {
    const local = (key: string) => translate(locale, key);
    const fallback = "관리자 인증에 실패했습니다.";
    for (const body of [null, {}, { error: {} }, { error: { message: null } }, { error: { message: 42 } }, { error: { message: {} } }, { error: { message: "" } }, { error: { message: "  " } }, { error: { details: "invalid" } }]) {
      const resolved = resolveCountryCalendarError(body, fallback);
      expect(presentCountryCalendarError(resolved.text, resolved.opaque, local)).toBe(local(fallback));
    }
    const mixed = resolveCountryCalendarError({ error: { details: [null, 42, {}, { path: "row[2].name", message: "저장\n관리자 인증에 실패했습니다." }, { path: "US 2032", message: "원본 상세" }] } }, fallback);
    expect(presentCountryCalendarError(mixed.text, mixed.opaque, local)).toBe(`${local(fallback)}\nrow[2].name: 저장\n관리자 인증에 실패했습니다.\nUS 2032: 원본 상세`);
    const opaque = resolveCountryCalendarError({ error: { message: "저장\n관리자 인증에 실패했습니다.", details: [{ path: "row[2]", message: "US 2032" }] } }, fallback);
    expect(presentCountryCalendarError(opaque.text, opaque.opaque, local)).toBe("저장\n관리자 인증에 실패했습니다.\nrow[2]: US 2032");
  });
});
