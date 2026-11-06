import { shellMessages } from "./catalogs/shell";
import { domainsMessages } from "./catalogs/domains";
import { domainErrorsMessages } from "./catalogs/domain-errors";
import { coreMessages } from "./catalogs/core";
import { phaseCMessages } from "./catalogs/phase-c";
import { workspaceVisibilityMessages } from "./catalogs/workspace-visibility";
import { LOCALE_FORMATS, type AppLocale } from "./locales";

export type MessageParameters = Readonly<Record<string, string | number | null | undefined>>;
export type MessageEntry = Readonly<{
  ko?: string;
  en: string;
  vi: string;
  plural?: Partial<Record<AppLocale, Readonly<{ one: string; other: string }>>>;
}>;
export type MessageCatalog = Readonly<Record<string, MessageEntry>>;
const catalogs: MessageCatalog[] = [workspaceVisibilityMessages, phaseCMessages, coreMessages, shellMessages, domainsMessages, domainErrorsMessages];
export const messages: MessageCatalog = Object.assign({}, ...catalogs);

/** Values are plain text. Callers render through React, never as HTML. */
export function translate(locale: AppLocale, key: string | null | undefined, parameters: MessageParameters = {}): string {
  const source = key ?? "";
  const entry = messages[source];
  const variants = entry?.plural?.[locale];
  const plural = variants && typeof parameters.count === "number"
    ? variants[new Intl.PluralRules(LOCALE_FORMATS[locale]).select(parameters.count) === "one" ? "one" : "other"]
    : undefined;
  const message = locale === "ko" ? entry?.ko ?? source : plural ?? entry?.[locale] ?? entry?.ko ?? source;
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) =>
    Object.hasOwn(parameters, name) ? (typeof parameters[name] === "number" ? formatLocaleNumber(parameters[name], locale) : String(parameters[name] ?? "")) : placeholder);
}

export function displayName(item: { name: string; translations?: Partial<Record<AppLocale, string>> }, locale: AppLocale): string {
  const translated = item.translations?.[locale];
  return typeof translated === "string" && translated.trim().length > 0 ? translated : item.name;
}

export function formatLocaleNumber(value: number, locale: AppLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_FORMATS[locale], options).format(value);
}

const safeErrors: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: "입력값을 확인해 주세요.", INVALID_REQUEST: "입력값을 확인해 주세요.",
  UNAUTHORIZED: "인증이 필요합니다.", FORBIDDEN: "이 작업을 수행할 권한이 없습니다.",
  PROJECT_NOT_FOUND: "프로젝트를 찾을 수 없습니다.",
  NOT_FOUND: "요청한 항목을 찾을 수 없습니다.", REVISION_CONFLICT: "다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.",
  PRECONDITION_FAILED: "다른 변경사항이 있습니다. 최신 정보를 확인해 주세요.", RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};
/** Unknown upstream exceptions never become user-visible text through this mapper. */
export function translateErrorCode(locale: AppLocale, code: unknown): string {
  return translate(locale, typeof code === "string" && Object.hasOwn(safeErrors, code) ? safeErrors[code] : "요청을 처리하지 못했습니다. 다시 시도해 주세요.");
}

export type MessageKey = keyof typeof coreMessages | keyof typeof shellMessages | keyof typeof domainsMessages | keyof typeof domainErrorsMessages | keyof typeof phaseCMessages | keyof typeof workspaceVisibilityMessages;
