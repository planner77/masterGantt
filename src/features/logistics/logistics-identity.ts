type NamedLogisticsItem = { name: string; code: string; sortOrder?: number };
type NameGroup = { count: number; sortOrders: Map<number, number> };

// Lists are immutable API snapshots. Index each snapshot once for large native selectors.
const nameIndexes = new WeakMap<readonly NamedLogisticsItem[], Map<string, NameGroup>>();

/** Native selects use existing context first, and a full code only when still ambiguous. */
export function logisticsName(item: NamedLogisticsItem, peers: readonly NamedLogisticsItem[]): string {
  const name = item.name.trim();
  if (!name) return `이름 확인 필요 (${item.code})`;
  let index = nameIndexes.get(peers);
  if (!index) {
    index = new Map();
    for (const peer of peers) {
      const key = peer.name.trim();
      const group = index.get(key) ?? { count: 0, sortOrders: new Map<number, number>() };
      group.count += 1;
      if (peer.sortOrder !== undefined) group.sortOrders.set(peer.sortOrder, (group.sortOrders.get(peer.sortOrder) ?? 0) + 1);
      index.set(key, group);
    }
    nameIndexes.set(peers, index);
  }
  const group = index.get(name);
  if (!group || group.count < 2) return item.name;
  if (item.sortOrder !== undefined && group.sortOrders.get(item.sortOrder) === 1) {
    return `${item.name} (정렬 ${item.sortOrder})`;
  }
  return `${item.name} (${item.code})`;
}

/** Search display fields and the canonical ID without changing the stored instance. */
export function logisticsMatchesQuery(item: { name: string; code: string; id: string }, query: string): boolean {
  return `${item.name} ${item.code} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}
