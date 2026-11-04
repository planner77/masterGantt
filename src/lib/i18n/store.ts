import { DEFAULT_LOCALE, isAppLocale, LOCALE_CHANGE_EVENT, LOCALE_STORAGE_KEY, resolveLocale, type AppLocale } from "./locales";

let explicitSessionLocale: AppLocale | undefined;

export function getServerLocale(): AppLocale { return DEFAULT_LOCALE; }

export function getCurrentLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (explicitSessionLocale) return explicitSessionLocale;
  let saved: string | null = null;
  try { saved = window.localStorage.getItem(LOCALE_STORAGE_KEY); } catch { /* Restricted storage still permits an in-memory choice. */ }
  return resolveLocale(saved, navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export function setCurrentLocale(locale: AppLocale): void {
  if (typeof window === "undefined" || !isAppLocale(locale)) return;
  explicitSessionLocale = locale;
  try { window.localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Keep the explicit choice for this tab. */ }
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

export function subscribeLocale(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const storage = (event: StorageEvent) => {
    if (event.key !== LOCALE_STORAGE_KEY && event.key !== null) return;
    explicitSessionLocale = undefined;
    listener();
  };
  window.addEventListener(LOCALE_CHANGE_EVENT, listener);
  window.addEventListener("languagechange", listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(LOCALE_CHANGE_EVENT, listener);
    window.removeEventListener("languagechange", listener);
    window.removeEventListener("storage", storage);
  };
}
