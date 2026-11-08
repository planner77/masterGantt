import type { ViewportStamp } from "./viewport-coordinator";
import type { IApi, IColumnConfig, ITask } from "@svar-ui/react-gantt";
import type { AppLocale } from "@/lib/i18n/locales";
import { ganttColumnHeader } from "../svar-locales";

export type CanonicalSortField = "start" | "duration" | "baselineStart" | "baselineEnd";
type SortFieldValue = Readonly<{ ok: true; value: string | number | null }> | Readonly<{ ok: false }>;
const unavailableSortField: SortFieldValue = Object.freeze({ ok: false });
const sortSources = new WeakMap<ITask, { key: string; values: Readonly<Record<CanonicalSortField, SortFieldValue>> }>();
const canonicalSortFields = ["start", "duration", "baselineStart", "baselineEnd"] as const;

/** Getters may display today's DTO/locale, but sorting an older Core must
 * read that row's own canonical generation. Cache only these four scalars.
 */
export function canonicalTaskSortValue(task: ITask, field: CanonicalSortField): SortFieldValue {
  const key = task.projectDisplayKey;
  if (typeof key !== "string") return unavailableSortField;
  const cached = sortSources.get(task);
  if (cached?.key === key) return cached.values[field];
  let source: unknown;
  try { source = JSON.parse(key); } catch { return unavailableSortField; }
  if (source === null || typeof source !== "object" || Array.isArray(source)) return unavailableSortField;
  if (Reflect.get(source, "taskId") !== String(task.id)) return unavailableSortField;
  const values = Object.fromEntries(canonicalSortFields.map(name => {
    if (!Object.hasOwn(source, name)) return [name, unavailableSortField];
    const value: unknown = Reflect.get(source, name);
    const valid = value === null || (name === "duration" ? typeof value === "number" && Number.isFinite(value) && value >= 0 :
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
    return [name, valid ? Object.freeze({ ok: true, value }) : unavailableSortField];
  })) as Record<CanonicalSortField, SortFieldValue>;
  sortSources.set(task, { key, values });
  return values[field];
}

export function compareCanonicalTaskField(first: ITask, second: ITask, field: CanonicalSortField): -1 | 0 | 1 {
  const left = canonicalTaskSortValue(first, field), right = canonicalTaskSortValue(second, field);
  if (!left.ok || !right.ok) throw new Error("CANONICAL_SORT_SOURCE_UNAVAILABLE");
  if (left.value === null || right.value === null) return left.value === right.value ? 0 : left.value === null ? 1 : -1;
  return left.value === right.value ? 0 : left.value < right.value ? -1 : 1;
}

/** Core's Grid translates normalized header-line objects in place. Restore
 * layout by id, but give every fixed header a fresh current-language value.
 * Neither the captured columns nor their native header objects are mutated.
 */
export function currentLocaleColumns(columns: readonly IColumnConfig[], locale: AppLocale): IColumnConfig[] {
  return columns.map(column => ({ ...column,
    header: (column.id === undefined ? undefined : ganttColumnHeader(column.id, locale)) ?? column.header,
  }));
}

export const LOCALE_SORT_EVENT_SOURCE = "project-locale-presentation";
export type LocaleSort = NonNullable<ReturnType<IApi["getState"]>["_sort"]>[number];

/** Reapply the user's ordered native sort with public actions only. Every
 * awaited action retains the original locale/projection/input admission.
 */
export async function restoreLocaleSort(api: Pick<IApi, "exec">, sort: readonly LocaleSort[], current: () => boolean, effective: readonly LocaleSort[] = sort): Promise<void> {
  if (!sort.length) return;
  const activeKeys = new Set(sort.map(descriptor => descriptor.key));
  // A later stable sort retains ties from earlier, now inactive columns.
  // Rebuild that baseline from low priority upward before restoring the
  // current public clauses (and their visible priority markers).
  const ties = effective.filter(descriptor => !activeKeys.has(descriptor.key));
  for (const descriptor of [...ties].reverse()) {
    if (!current()) return;
    await api.exec("sort-tasks", { ...descriptor, order: descriptor.order ?? "desc", add: false, eventSource: LOCALE_SORT_EVENT_SOURCE });
  }
  for (const [index, descriptor] of sort.entries()) {
    if (!current()) return;
    await api.exec("sort-tasks", { ...descriptor, order: descriptor.order ?? "desc", add: index > 0, eventSource: LOCALE_SORT_EVENT_SOURCE });
  }
}

/** Admission for the two public layout writes immediately after Core's Locale
 * init. Only its column normalization may differ; a newer gesture, intent,
 * scope, filter, scale, API, or canonical geometry revokes this admission.
 * Callers must resume the original strict lease before any further restore.
 */
export function canRestoreLocaleInitColumns(source: ViewportStamp, current: ViewportStamp): boolean {
  if (source.contextEpoch !== current.contextEpoch || source.gesture !== current.gesture || source.intent !== current.intent) return false;
  try {
    const before: unknown = JSON.parse(source.context), after: unknown = JSON.parse(current.context);
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== 7 || after.length !== 7) return false;
    return before.every((value, index) => index === 5 || value === after[index]);
  } catch { return false; }
}
