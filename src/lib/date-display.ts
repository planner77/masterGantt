/**
 * Browser-facing date formatting helpers.
 *
 * Client components must render the same value during SSR and their first
 * hydration pass. Use SSR_DATE_LOCALE initially, then pass browserLocales()
 * after mount to honour the user's locale preferences.
 */
export const SSR_DATE_LOCALE = "en-CA";
export const SSR_TIME_ZONE = "UTC";

export type DisplayLocales = Intl.LocalesArgument | undefined;

export function browserLocales(): DisplayLocales {
  if (typeof navigator === "undefined") return SSR_DATE_LOCALE;

  // Do not return navigator.languages itself here. Some browsers expose it as
  // a fresh array-like object on every read, which is not a stable external
  // store snapshot during hydration. The first preference is the browser's
  // resolved locale and is the locale Intl uses for ordinary UI formatting.
  return navigator.languages[0] || navigator.language || SSR_DATE_LOCALE;
}

export function browserTimeZone(): string {
  if (typeof Intl === "undefined") return SSR_TIME_ZONE;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || SSR_TIME_ZONE;
}

function validDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatLocaleDateTime(
  value: string,
  locales: DisplayLocales = SSR_DATE_LOCALE,
  timeZone = SSR_TIME_ZONE,
): string {
  const date = validDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(locales, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** Format YYYY-MM-DD as a local calendar date, never as a UTC timestamp. */
export function formatLocaleDateOnly(
  value: string,
  locales: DisplayLocales = SSR_DATE_LOCALE,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "—";

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    return "—";
  }

  return new Intl.DateTimeFormat(locales, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: SSR_TIME_ZONE,
  }).format(date);
}

/** Produce a YYYY-MM-DD date using local calendar components, not UTC. */
export function todayLocalDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
