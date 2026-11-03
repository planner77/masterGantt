import { isAppLocale, SUPPORTED_LOCALES, type AppLocale } from "../../lib/i18n/locales";
import type Database from "better-sqlite3";
import type { DisplayNameTranslations } from "../../contracts/display-name-translations";

const OWNERS = {
  project_master_items: "owner_id",
  logistics_equipment_types: "owner_code",
  logistics_system_types: "owner_code",
  process_types: "owner_id",
  product_standard_processes: "owner_id",
  site_product_processes: "owner_id",
  work_areas: "owner_id",
  project_work_areas: "owner_id",
  project_processes: "owner_id",
  project_equipment: "owner_id",
  project_logistics_systems: "owner_id",
  resource_groups: "owner_id",
} as const;
export type DisplayNameOwner = keyof typeof OWNERS;

/** Explicit replacement: omitted preserves; an empty object removes every translation. */
export function parseDisplayNameTranslations(value: unknown, invalid: () => never): DisplayNameTranslations | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return invalid();
  const result: DisplayNameTranslations = {};
  for (const [locale, raw] of Object.entries(value)) {
    if (!isAppLocale(locale)) return invalid();
    if (typeof raw !== "string") return invalid();
    const name = raw.trim().normalize("NFC");
    if (Array.from(name).length > 200 || /[\u0000-\u001f\u007f]/u.test(raw) ||
      Array.from(raw).some(char => char.length === 1 && /[\ud800-\udfff]/u.test(char))) return invalid();
    if (name) result[locale] = name;
  }
  return result;
}

/** Identifiers are a closed compile-time map; owner identity must be authorized by the domain service. */
export function readDisplayNameTranslations(db: Database.Database, owner: DisplayNameOwner, id: number | string): DisplayNameTranslations {
  const rows = db.prepare(`SELECT locale,name FROM ${owner}_translations WHERE ${OWNERS[owner]}=? ORDER BY locale`).all(id) as Array<{ locale: AppLocale; name: string }>;
  return Object.fromEntries(rows.map(row => [row.locale, row.name]));
}
export function displayNameTranslationFields(db: Database.Database, owner: DisplayNameOwner, id: number | string): { translations?: DisplayNameTranslations } {
  const translations = readDisplayNameTranslations(db, owner, id);
  return Object.keys(translations).length ? { translations } : {};
}
/** Called only inside the owning service's existing authorization/revision transaction. */
export function writeDisplayNameTranslations(db: Database.Database, owner: DisplayNameOwner, id: number | string, translations: DisplayNameTranslations | undefined): void {
  if (translations === undefined) return;
  db.prepare(`DELETE FROM ${owner}_translations WHERE ${OWNERS[owner]}=?`).run(id);
  const insert = db.prepare(`INSERT INTO ${owner}_translations(${OWNERS[owner]},locale,name) VALUES(?,?,?)`);
  for (const [locale, name] of Object.entries(translations)) insert.run(id, locale, name);
}
export function sameDisplayNameTranslations(left: DisplayNameTranslations | undefined, right: DisplayNameTranslations | undefined): boolean {
  return SUPPORTED_LOCALES.every(locale => left?.[locale] === right?.[locale]);
}
/** One bounded query for a domain reader's already selected owners; avoids per-row queries. */
export function displayNameTranslationFieldMap(db: Database.Database, owner: DisplayNameOwner, ids: readonly (string | number)[]): Map<string, { translations?: DisplayNameTranslations }> {
  const unique = [...new Set(ids.map(String))];
  const rows = db.prepare(`SELECT ${OWNERS[owner]} owner,locale,name FROM ${owner}_translations WHERE ${unique.length ? `${OWNERS[owner]} IN (${unique.map(() => "?").join(",")})` : "0"} ORDER BY locale`).all(...unique) as Array<{ owner: string | number; locale: AppLocale; name: string }>;
  const result = new Map<string, { translations: DisplayNameTranslations }>();
  for (const row of rows) {
    const key = String(row.owner), entry = result.get(key) ?? { translations: {} };
    entry.translations[row.locale] = row.name;
    result.set(key, entry);
  }
  return result;
}
/** Snapshot label projections use public identities and the same authorized owner set. */
export function displayNameTranslationPublicIdMap(db: Database.Database, owner: DisplayNameOwner, publicIds: readonly string[]): Map<string, { translations?: DisplayNameTranslations }> {
  if (OWNERS[owner] === "owner_code") return displayNameTranslationFieldMap(db, owner, publicIds);
  const unique = [...new Set(publicIds)];
  const rows = db.prepare(`SELECT o.public_id owner,tr.locale,tr.name FROM ${owner}_translations tr JOIN ${owner} o ON o.id=tr.owner_id WHERE ${unique.length ? `o.public_id IN (${unique.map(() => "?").join(",")})` : "0"} ORDER BY tr.locale`).all(...unique) as Array<{ owner: string; locale: AppLocale; name: string }>;
  const result = new Map<string, { translations: DisplayNameTranslations }>();
  for (const row of rows) {
    const entry = result.get(row.owner) ?? { translations: {} }; entry.translations[row.locale] = row.name; result.set(row.owner, entry);
  }
  return result;
}
