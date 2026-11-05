import { displayName, formatLocaleNumber, translate } from "../../lib/i18n";
import type { AppLocale } from "../../lib/i18n/locales";

type NamedLogisticsItem = { name: string; code: string; sortOrder?: number; translations?: Partial<Record<AppLocale, string>> };
type NameGroup = { count: number; sortOrders: Map<number, number> };

// API snapshots are immutable; locale is part of the display-name index key.
const nameIndexes = new WeakMap<readonly NamedLogisticsItem[], Map<AppLocale, Map<string, NameGroup>>>();

/** Native selects retain canonical IDs and disambiguate equal translated display names. */
export function logisticsName(item: NamedLogisticsItem, peers: readonly NamedLogisticsItem[], locale: AppLocale = "ko"): string {
  const displayed = displayName(item, locale);
  const name = displayed.trim();
  if (!name) return `${translate(locale, "이름 확인 필요")} (${item.code})`;
  let locales = nameIndexes.get(peers);
  if (!locales) { locales = new Map(); nameIndexes.set(peers, locales); }
  let index = locales.get(locale);
  if (!index) {
    index = new Map();
    for (const peer of peers) {
      const key = displayName(peer, locale).trim();
      const group = index.get(key) ?? { count: 0, sortOrders: new Map<number, number>() };
      group.count += 1;
      if (peer.sortOrder !== undefined) group.sortOrders.set(peer.sortOrder, (group.sortOrders.get(peer.sortOrder) ?? 0) + 1);
      index.set(key, group);
    }
    locales.set(locale, index);
  }
  const group = index.get(name);
  if (!group || group.count < 2) return displayed;
  if (item.sortOrder !== undefined && group.sortOrders.get(item.sortOrder) === 1) {
    return `${displayed} (${translate(locale, "정렬")} ${formatLocaleNumber(item.sortOrder, locale)})`;
  }
  return `${displayed} (${item.code})`;
}

/** Search the original and current display name without changing the stored instance. */
export function logisticsMatchesQuery(item: { name: string; code: string; id: string; translations?: Partial<Record<AppLocale, string>> }, query: string, locale: AppLocale = "ko"): boolean {
  return `${item.name} ${displayName(item, locale)} ${item.code} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}
