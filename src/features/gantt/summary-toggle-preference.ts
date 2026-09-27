export interface SummaryTogglePreferenceV1 {
  version: 1;
  collapsedSummaryIds: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function getSummaryToggleStorageKey(projectPublicId: string): string {
  return `mastergantt:summary-toggle:${projectPublicId}`;
}

/**
 * Parses and validates raw storage string.
 * Filters out invalid entries and stale IDs if currentSummaryIds is provided.
 */
export function parseSummaryTogglePreference(
  raw: string | null,
  currentSummaryIds?: ReadonlySet<string>,
): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (
      !data ||
      typeof data !== "object" ||
      !("version" in data) ||
      (data as { version: unknown }).version !== 1 ||
      !("collapsedSummaryIds" in data) ||
      !Array.isArray((data as { collapsedSummaryIds: unknown }).collapsedSummaryIds)
    ) {
      return [];
    }

    const rawList = (data as { collapsedSummaryIds: unknown[] }).collapsedSummaryIds;
    const uniqueIds = Array.from(
      new Set(rawList.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
    );

    if (currentSummaryIds) {
      return uniqueIds.filter((id) => currentSummaryIds.has(id));
    }
    return uniqueIds;
  } catch {
    return [];
  }
}

/**
 * Serializes collapsed summary IDs into v1 JSON payload.
 */
export function serializeSummaryTogglePreference(collapsedSummaryIds: readonly string[]): string {
  const uniqueIds = Array.from(
    new Set(collapsedSummaryIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)),
  );
  const payload: SummaryTogglePreferenceV1 = {
    version: 1,
    collapsedSummaryIds: uniqueIds,
  };
  return JSON.stringify(payload);
}

/**
 * Loads preference from storage safely. Never throws.
 */
export function loadSummaryTogglePreference(
  projectPublicId: string,
  currentSummaryIds?: ReadonlySet<string>,
  storage?: StorageLike,
): string[] {
  if (!projectPublicId || typeof projectPublicId !== "string") return [];
  try {
    const targetStorage = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!targetStorage) return [];
    const key = getSummaryToggleStorageKey(projectPublicId);
    const raw = targetStorage.getItem(key);
    const collapsedSummaryIds = parseSummaryTogglePreference(raw, currentSummaryIds);

    if (raw !== null && currentSummaryIds) {
      const normalized = serializeSummaryTogglePreference(collapsedSummaryIds);
      if (normalized !== raw) {
        targetStorage.setItem(key, normalized);
      }
    }

    return collapsedSummaryIds;
  } catch {
    return [];
  }
}

/**
 * Saves preference to storage safely. Never throws (QuotaExceededError, SecurityError ignored).
 */
export function saveSummaryTogglePreference(
  projectPublicId: string,
  collapsedSummaryIds: readonly string[],
  storage?: StorageLike,
): void {
  if (!projectPublicId || typeof projectPublicId !== "string") return;
  try {
    const targetStorage = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!targetStorage) return;
    const serialized = serializeSummaryTogglePreference(collapsedSummaryIds);
    targetStorage.setItem(getSummaryToggleStorageKey(projectPublicId), serialized);
  } catch {
    // Non-fatal error (e.g. Storage quota exceeded, disabled cookies/storage)
  }
}

/**
 * Extracts collapsed summary IDs from summary toggle state Map.
 * Only includes keys that exist in currentSummaryIds.
 */
export function extractCollapsedSummaryIds(
  summaryToggleState: ReadonlyMap<string, boolean>,
  currentSummaryIds: ReadonlySet<string>,
): string[] {
  const result: string[] = [];
  for (const [taskId, collapsed] of summaryToggleState) {
    if (collapsed && currentSummaryIds.has(taskId)) {
      result.push(taskId);
    }
  }
  return result;
}
