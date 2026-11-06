import { displayName } from "../../lib/i18n";
import type { AppLocale } from "../../lib/i18n/locales";
import type { DisplayNameTranslations } from "../../contracts/display-name-translations";
import { WORK_CALENDAR_COUNTRY_CODES, type ReplaceProjectWorkCalendarRequest, type WorkCalendarCountryCode } from "../../contracts/work-calendar";

import { parseDateOnly } from "../../domain/scheduling/date-only";

export const COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE = "해당 국가·연도 공식 자료가 미확보입니다.";
export interface UnavailableCountryCalendarError {
  messageKey: typeof COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE;
  identifiers: Array<{ countryCode: WorkCalendarCountryCode; year: string }>;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function includesYear(rule: ReplaceProjectWorkCalendarRequest["countryRules"][number], year: string): boolean {
  if (rule.scope === "FULL_PROJECT") return true;
  if (rule.scope !== "DATE_RANGE") return false;
  try {
    const from = parseDateOnly(rule.effectiveFrom), to = parseDateOnly(rule.effectiveTo);
    return from <= to && from.slice(0, 4) <= year && year <= to.slice(0, 4);
  } catch { return false; }
}

/** Recover only scoped country/year identifiers, never upstream explanatory text. */
export function readUnavailableCountryCalendarError(
  body: unknown,
  rules: ReplaceProjectWorkCalendarRequest["countryRules"],
): UnavailableCountryCalendarError | null {
  const error = object(object(body)?.error);
  if (error?.code !== "COUNTRY_CALENDAR_UNAVAILABLE") return null;
  const result: UnavailableCountryCalendarError = {
    messageKey: COUNTRY_CALENDAR_UNAVAILABLE_MESSAGE, identifiers: [],
  };
  if (!Array.isArray(error.details)) return result;
  const seen = new Set<string>();
  for (const value of error.details) {
    const entry = object(value);
    if (entry?.path !== "countryRules" || entry.code !== "COUNTRY_CALENDAR_UNAVAILABLE"
      || typeof entry.message !== "string" || entry.message.length !== 7) continue;
    const match = /^([A-Z]{2}) ([0-9]{4})$/.exec(entry.message);
    if (!match || !(WORK_CALENDAR_COUNTRY_CODES as readonly string[]).includes(match[1])) continue;
    const countryCode = match[1] as WorkCalendarCountryCode, year = match[2];
    try { parseDateOnly(`${year}-01-01`); } catch { continue; }
    if (!rules.some((rule) => rule.countryCode === countryCode && includesYear(rule, year))
      || seen.has(entry.message)) continue;
    seen.add(entry.message);
    result.identifiers.push({ countryCode, year });
  }
  return result;
}

export type ResourceCalendarConflictEntry =
  | { kind: "date"; date: string }
  | { kind: "layer"; layer: "PROJECT" | "RESOURCE_GROUP" | "RESOURCE" }
  | { kind: "target"; labelKey: "영향받는 리소스" | "충돌 대상 그룹"; name: string; translations?: DisplayNameTranslations }
  | { kind: "rule"; name: string; date: string; dayType: "WORKING" | "NON_WORKING" };
export interface ResourceCalendarConflict {
  entries: ResourceCalendarConflictEntry[];
  dates: string[];
}
export interface LocalCalendarConflictRule {
  key: string;
  name: string;
  date: string;
  dayType: "WORKING" | "NON_WORKING";
}
/** Keep only structured conflict identifiers that resolve against the local snapshot. */
export function readResourceCalendarConflict(
  body: unknown,
  targets: ReadonlyArray<{ id: string; name: string; kind: "resource" | "group"; translations?: DisplayNameTranslations }>,
  rules: readonly LocalCalendarConflictRule[],
): ResourceCalendarConflict | null {
  const error = object(object(body)?.error);
  if (error?.code !== "RESOURCE_CALENDAR_EXCEPTION_CONFLICT") return null;
  const result: ResourceCalendarConflict = { entries: [], dates: [] };
  if (!Array.isArray(error.details)) return result;
  for (const value of error.details) {
    const detail = object(value);
    if (detail?.code !== "RESOURCE_CALENDAR_EXCEPTION_CONFLICT"
      || typeof detail.path !== "string" || typeof detail.message !== "string") continue;
    if (detail.path === "date") {
      if (detail.message.length !== 10) continue;
      try {
        const date = parseDateOnly(detail.message);
        result.dates.push(date);
        result.entries.push({ kind: "date", date });
      } catch { /* An arbitrary message is not a calendar date. */ }
    } else if (detail.path === "layer") {
      const layer = detail.message;
      if (layer === "PROJECT" || layer === "RESOURCE_GROUP" || layer === "RESOURCE") {
        result.entries.push({ kind: "layer", layer });
      }
    } else if (detail.path === "resourceId" || detail.path === "groupIds") {
      const kind = detail.path === "resourceId" ? "resource" : "group";
      const target = targets.find((target) => target.id === detail.message && target.kind === kind);
      if (target) result.entries.push({ kind: "target", labelKey: kind === "resource" ? "영향받는 리소스" : "충돌 대상 그룹", name: target.name, ...(kind === "group" && target.translations ? { translations: target.translations } : {}) });
    } else if (detail.path.startsWith("rules.")) {
      // Generated server UUIDs cannot identify unsaved local rules. Never show the raw fallback.
      const key = detail.path.slice(6);
      const rule = rules.find((rule) => rule.key === key);
      if (rule) result.entries.push({ kind: "rule", name: rule.name, date: rule.date, dayType: rule.dayType });
    }
  }
  return result;
}

/** Translate only trusted fixed labels at render time; user names and dates remain opaque. */
export function formatResourceCalendarConflictEntry(
  entry: ResourceCalendarConflictEntry,
  t: (key: string) => string,
  locale: AppLocale = "ko",
): string {
  switch (entry.kind) {
    case "date": return `${t("날짜")}: ${entry.date}`;
    case "layer": return `${t("충돌 단계")}: ${t(entry.layer === "RESOURCE_GROUP" ? "리소스 그룹" : entry.layer === "RESOURCE" ? "리소스" : "프로젝트 전체")}`;
    case "target": return `${t(entry.labelKey)}: ${displayName(entry, locale)}`;
    case "rule": return `${t("충돌 규칙")}: ${entry.name} · ${entry.date} · ${t(entry.dayType === "WORKING" ? "근무일" : "휴무일")}`;
  }
}
