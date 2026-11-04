"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { formatLocaleNumber, translate, type MessageParameters } from "./index";
import { LOCALE_FORMATS, type AppLocale } from "./locales";
import { getCurrentLocale, getServerLocale, setCurrentLocale, subscribeLocale } from "./store";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string | null | undefined, parameters?: MessageParameters) => string;
  formatLocale: string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getCurrentLocale, getServerLocale);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: setCurrentLocale,
    t: (key, parameters) => translate(locale, key, parameters),
    formatLocale: LOCALE_FORMATS[locale],
    formatNumber: (number, options) => formatLocaleNumber(number, locale, options),
  }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The fallback also supports isolated fixtures without changing the app tree. */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  const locale = useSyncExternalStore(subscribeLocale, getCurrentLocale, getServerLocale);
  return useMemo(() => context ?? {
    locale, setLocale: setCurrentLocale,
    t: (key: string | null | undefined, parameters?: MessageParameters) => translate(locale, key, parameters),
    formatLocale: LOCALE_FORMATS[locale],
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) => formatLocaleNumber(number, locale, options),
  }, [context, locale]);
}
