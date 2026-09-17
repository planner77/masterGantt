import type Database from "better-sqlite3";

import type { RequiredMigration } from "../db/migrations";

export type ReadinessResult =
  | { status: "ok" }
  | { status: "unavailable" };

export type ReadinessFailureReason =
  | "DATABASE_CONNECTIVITY_FAILED"
  | "FOREIGN_KEYS_DISABLED"
  | "MIGRATION_MISMATCH";

export type ReadinessDiagnostic =
  | { result: { status: "ok" }; reason?: undefined }
  | { result: { status: "unavailable" }; reason: ReadinessFailureReason };

const READY = Object.freeze({ status: "ok" as const });
const UNAVAILABLE = Object.freeze({ status: "unavailable" as const });

interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
}

export function unavailableReadiness(): ReadinessResult {
  return UNAVAILABLE;
}

export function diagnoseReadiness(
  database: Database.Database,
  requiredMigration: RequiredMigration,
): ReadinessDiagnostic {
  try {
    const connectivity = database
      .prepare("SELECT 1 AS value")
      .get() as { value?: unknown } | undefined;
    if (connectivity?.value !== 1) {
      return { result: UNAVAILABLE, reason: "DATABASE_CONNECTIVITY_FAILED" };
    }
  } catch {
    return { result: UNAVAILABLE, reason: "DATABASE_CONNECTIVITY_FAILED" };
  }

  try {
    if (database.pragma("foreign_keys", { simple: true }) !== 1) {
      return { result: UNAVAILABLE, reason: "FOREIGN_KEYS_DISABLED" };
    }
  } catch {
    return { result: UNAVAILABLE, reason: "DATABASE_CONNECTIVITY_FAILED" };
  }

  try {
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
      return { result: UNAVAILABLE, reason: "MIGRATION_MISMATCH" };
    }
  } catch {
    return { result: UNAVAILABLE, reason: "MIGRATION_MISMATCH" };
  }

  return { result: READY };
}

export function checkReadiness(
  database: Database.Database,
  requiredMigration: RequiredMigration,
): ReadinessResult {
  return diagnoseReadiness(database, requiredMigration).result;
}
