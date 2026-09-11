import type Database from "better-sqlite3";

import type { RequiredMigration } from "../db/migrations";

export type ReadinessResult =
  | { status: "ok" }
  | { status: "unavailable" };

const READY: ReadinessResult = Object.freeze({ status: "ok" });
const UNAVAILABLE: ReadinessResult = Object.freeze({ status: "unavailable" });

interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
}

export function unavailableReadiness(): ReadinessResult {
  return UNAVAILABLE;
}

export function checkReadiness(
  database: Database.Database,
  requiredMigration: RequiredMigration,
): ReadinessResult {
  try {
    const connectivity = database
      .prepare("SELECT 1 AS value")
      .get() as { value?: unknown } | undefined;
    if (connectivity?.value !== 1) {
      return UNAVAILABLE;
    }

    if (database.pragma("foreign_keys", { simple: true }) !== 1) {
      return UNAVAILABLE;
    }

    const appliedMigration = database
      .prepare(
        `
          SELECT version, name, checksum
          FROM schema_migrations
          WHERE version = ?
        `,
      )
      .get(requiredMigration.version) as AppliedMigrationRow | undefined;

    if (
      appliedMigration?.version !== requiredMigration.version ||
      appliedMigration.name !== requiredMigration.name ||
      appliedMigration.checksum !== requiredMigration.checksum
    ) {
      return UNAVAILABLE;
    }

    return READY;
  } catch {
    return UNAVAILABLE;
  }
}
