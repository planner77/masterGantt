import { describe, expect, it } from "vitest";
import { translate } from "../../src/lib/i18n";
import type { ReplaceProjectWorkCalendarRequest } from "../../src/contracts/work-calendar";
import { COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE, readUnavailableCountryCalendarError, readResourceCalendarConflict, formatResourceCalendarConflictEntry, type ResourceCalendarConflictEntry } from "../../src/features/projects/project-work-calendar-errors";

const rules: ReplaceProjectWorkCalendarRequest["countryRules"] = [
  { countryCode: "US", scope: "DATE_RANGE", effectiveFrom: "2032-01-01", effectiveTo: "2032-12-31" },
];
const detail = (message: unknown) => ({ path: "countryRules", code: "COUNTRY_CALENDAR_UNAVAILABLE", message });
const body = (details: unknown) => ({ error: { code: "COUNTRY_CALENDAR_UNAVAILABLE", message: "private upstream prose", details } });

describe("unavailable country calendar identifiers", () => {
  it("recovers the actual API identifier without upstream prose", () => {
    expect(readUnavailableCountryCalendarError(body([detail("US 2032")]), rules)).toEqual({
      messageKey: COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE, identifiers: [{ countryCode: "US", year: "2032" }],
    });
  });
  it.each(["ko", "en", "vi"] as const)("retranslates only the fixed message in %s and keeps identifiers opaque", (locale) => {
    const result = readUnavailableCountryCalendarError(body([detail("US 2032")]), rules)!;
    const identifier = result.identifiers.map(({ countryCode, year }) => `${countryCode} ${year}`).join(", ");
    expect(identifier).toBe("US 2032");
    const message = translate(locale, result.messageKey);
    expect(message).toBe(translate(locale, COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE));
    if (locale !== "ko") expect(message).not.toBe(COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE);
    expect(`${message} (${identifier})`).not.toMatch(/private|2,032|2\.032/);
  });
  it("keeps only selected countries and years intersecting date ranges, with stable deduplication", () => {
    const submitted: typeof rules = [
      ...rules,
      { countryCode: "KR", scope: "DATE_RANGE", effectiveFrom: "2031-12-31", effectiveTo: "2033-01-01" },
      { countryCode: "VN", scope: "FULL_PROJECT" },
    ];
    expect(readUnavailableCountryCalendarError(body([
      detail("US 2031"), detail("US 2032"), detail("US 2033"), detail("KR 2031"), detail("KR 2033"),
      detail("KR 2034"), detail("CN 2032"), detail("VN 2040"), detail("US 2032"),
    ]), submitted)?.identifiers).toEqual([
      { countryCode: "US", year: "2032" }, { countryCode: "KR", year: "2031" },
      { countryCode: "KR", year: "2033" }, { countryCode: "VN", year: "2040" },
    ]);
  });
  it.each([
    "US 2032 private", "US 2032\n", " US 2032", "US 2032 ", "us 2032", "XX 2032", "US 0000",
    "US 1899", "US 2200", "US 10000", "US 20３2", "US\t2032", "<script>US 2032</script>",
    "US 2032\u0000", "US 2,032", "US 2032\ud800", null, 2032, {},
  ])("rejects nonidentifier or unsupported year %j", (message) => {
    expect(readUnavailableCountryCalendarError(body([detail(message)]), [{ countryCode: "US", scope: "FULL_PROJECT" }])?.identifiers).toEqual([]);
  });
  it.each([null, {}, [], "US 2032", { message: "US 2032" },
    { ...detail("US 2032"), path: "other" }, { ...detail("US 2032"), code: "OTHER" },
  ])("rejects invalid details entries %j", (value) => {
    expect(readUnavailableCountryCalendarError(body([value]), rules)?.identifiers).toEqual([]);
  });
  it.each([null, {}, [], { error: [] }, { error: { code: "OTHER", message: "US 2032" } }])("rejects invalid response envelopes %j", (value) => {
    expect(readUnavailableCountryCalendarError(value, rules)).toBeNull();
  });
  it.each([null, {}, "US 2032", { 0: detail("US 2032") }])("retains only generic guidance when details is not an array %j", (value) => {
    expect(readUnavailableCountryCalendarError(body(value), rules)).toEqual({ messageKey: COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE, identifiers: [] });
  });
  it.each([
    { effectiveFrom: "2032-02-30", effectiveTo: "2032-12-31" },
    { effectiveFrom: "2033-01-01", effectiveTo: "2032-12-31" },
    { effectiveFrom: null, effectiveTo: null },
  ])("rejects malformed or reversed submitted date ranges %j", (range) => {
    expect(readUnavailableCountryCalendarError(body([detail("US 2032")]), [{ countryCode: "US", scope: "DATE_RANGE", ...range }])?.identifiers).toEqual([]);
  });
  it("accepts the supported calendar bounds for a selected full-project rule", () => {
    expect(readUnavailableCountryCalendarError(body([detail("US 1900"), detail("US 2199")]), [{ countryCode: "US", scope: "FULL_PROJECT" }])?.identifiers)
      .toEqual([{ countryCode: "US", year: "1900" }, { countryCode: "US", year: "2199" }]);
  });

  it("preserves the Korean preview summary and translates its count placeholders", () => {
    const key = "현재 입력 기준 미리보기 계산 완료. 일정 변경 작업 {value0}개, 수동 작업 충돌 {value1}개. 리소스 예외 적용 {value2}개, 현재 효과 없음 {value3}개.";
    const counts = { value0: 2, value1: 1, value2: 3, value3: 0 };
    expect(translate("ko", key, counts)).toBe("현재 입력 기준 미리보기 계산 완료. 일정 변경 작업 2개, 수동 작업 충돌 1개. 리소스 예외 적용 3개, 현재 효과 없음 0개.");
    expect(translate("en", key, counts)).toBe("Preview calculated for the current input. Schedule changes: 2 tasks, manual task conflicts: 1. Resource exceptions applied: 3, no current effect: 0.");
    expect(translate("vi", key, counts)).toBe("Đã tính bản xem trước theo dữ liệu nhập hiện tại. Thay đổi lịch trình: 2 công việc, xung đột công việc thủ công: 1. Ngoại lệ nguồn lực được áp dụng: 3, hiện không có tác động: 0.");
  });

});

describe("resource calendar conflict structured state", () => {
  it("stores scoped local values and enum descriptors instead of translated sentences", () => {
    const response = { error: { code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", message: "private prose", details: [
      { path: "date", code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", message: "2032-01-01" },
      { path: "layer", code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", message: "RESOURCE_GROUP" },
      { path: "resourceId", code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", message: "resource-1" },
      { path: "groupIds", code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", message: "group-1" },
      { path: "rules.local-rule", code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", message: "private rule prose" },
    ] } };
    expect(readResourceCalendarConflict(response, [
      { id: "resource-1", kind: "resource", name: "날짜" },
      { id: "group-1", kind: "group", name: "Original group" },
    ], [{ key: "local-rule", name: "Original exception", date: "2032-01-01", dayType: "WORKING" }])).toEqual({
      dates: ["2032-01-01"], entries: [
        { kind: "date", date: "2032-01-01" }, { kind: "layer", layer: "RESOURCE_GROUP" },
        { kind: "target", labelKey: "영향받는 리소스", name: "날짜" },
        { kind: "target", labelKey: "충돌 대상 그룹", name: "Original group" },
        { kind: "rule", name: "Original exception", date: "2032-01-01", dayType: "WORKING" },
      ],
    });
  });
  it("retranslates every fixed label after a live locale switch without translating user names", () => {
    const entries: ResourceCalendarConflictEntry[] = [
      { kind: "date", date: "2032-01-01" }, { kind: "layer", layer: "RESOURCE_GROUP" },
      { kind: "target", labelKey: "영향받는 리소스", name: "날짜" },
      { kind: "target", labelKey: "충돌 대상 그룹", name: "Original group 2032" },
      { kind: "rule", name: "근무일", date: "2032-01-01", dayType: "NON_WORKING" },
    ];
    const render = (locale: "ko" | "en" | "vi") => entries.map((entry) => formatResourceCalendarConflictEntry(entry, (key) => translate(locale, key)));
    expect(render("ko")).toEqual(["날짜: 2032-01-01", "충돌 단계: 리소스 그룹", "영향받는 리소스: 날짜", "충돌 대상 그룹: Original group 2032", "충돌 규칙: 근무일 · 2032-01-01 · 휴무일"]);
    expect(render("en")).toEqual(["Date: 2032-01-01", "Conflict layer: Resource groups", "Affected resource: 날짜", "Conflicting group: Original group 2032", "Conflicting rule: 근무일 · 2032-01-01 · Nonworking day"]);
    expect(render("vi")).toEqual(["Ngày: 2032-01-01", "Cấp xung đột: Nhóm nguồn lực", "Nguồn lực bị ảnh hưởng: 날짜", "Nhóm xung đột: Original group 2032", "Quy tắc xung đột: 근무일 · 2032-01-01 · Ngày nghỉ"]);
    expect(render("ko")[0]).toBe("날짜: 2032-01-01");
  });
  it.each([null, {}, [], "private", { 0: { path: "date", message: "2032-01-01" } }])("handles malformed details safely %j", (details) => {
    expect(readResourceCalendarConflict({ error: { code: "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", details } }, [], []))
      .toEqual({ dates: [], entries: [] });
  });
  it("rejects untrusted prose, unknown IDs, incorrect target kinds and generated rule UUIDs", () => {
    const code = "RESOURCE_CALENDAR_EXCEPTION_CONFLICT";
    const details = [null, [], "private", { path: "date", code, message: "2032-01-01 private" },
      { path: "date", code, message: "2032-01-01\n" }, { path: "date", code, message: "2032-02-30" },
      { path: "date", code: "OTHER", message: "2032-01-01" }, { path: "date", code, message: 2032 },
      { path: "layer", code, message: "private-layer" }, { path: "resourceId", code, message: "unknown-private-id" },
      { path: "resourceId", code, message: "group-1" }, { path: "groupIds", code, message: "resource-1" },
      { path: "rules.generated-server-uuid", code, message: "private rule prose" },
      { path: "ruleIds", code, message: "generated-server-uuid" }];
    const result = readResourceCalendarConflict({ error: { code, message: "private", details } }, [
      { id: "group-1", name: "Group", kind: "group" }, { id: "resource-1", name: "Resource", kind: "resource" },
    ], [{ key: "local-rule", name: "Local rule", date: "2032-01-01", dayType: "WORKING" }]);
    expect(result).toEqual({ dates: [], entries: [] });
    expect(JSON.stringify(result)).not.toMatch(/private|uuid/);
  });
  it.each([null, [], {}, { error: [] }, { error: { code: "OTHER" } }])("ignores other or malformed response envelopes %j", (response) => {
    expect(readResourceCalendarConflict(response, [], [])).toBeNull();
  });

});
