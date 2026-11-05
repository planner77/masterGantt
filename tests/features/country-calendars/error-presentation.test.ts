import { describe, expect, it } from "vitest";
import { translate } from "../../../src/lib/i18n";
import { presentCountryCalendarError } from "../../../src/features/country-calendars/error-presentation";
describe("country-calendar error source", () => {
  const english = (key: string) => translate("en", key);
  it("preserves server detail including row paths even if it resembles a UI key", () => {
    const server = "저장\nrow[2].name: 저장";
    expect(presentCountryCalendarError(server, true, english)).toBe(server);
  });
  it("still localizes locally authored static messages", () => {
    expect(presentCountryCalendarError("관리자 인증에 실패했습니다.", false, english)).toBe("Administrator authentication failed.");
  });
});
