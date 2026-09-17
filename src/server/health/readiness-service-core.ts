import Database from "better-sqlite3";

import { validateDatabasePath } from "../db/config";
import { getRequiredMigration } from "../db/migrations";
import { parseApplicationBaseUrl } from "../security/origin-core";
import {
  diagnoseReadiness,
  type ReadinessFailureReason,
  type ReadinessResult,
} from "./readiness-core";

export type ConfiguredReadinessFailureReason =
  | ReadinessFailureReason
  | "DATABASE_PATH_MISSING"
  | "APPLICATION_CONFIGURATION_INVALID"
  | "DATABASE_PATH_INVALID"
  | "MIGRATION_CONFIGURATION_INVALID"
  | "DATABASE_OPEN_FAILED";

export type ConfiguredReadinessDiagnostic =
  | { result: { status: "ok" }; reason?: undefined }
  | { result: { status: "unavailable" }; reason: ConfiguredReadinessFailureReason };

export interface ReadinessServiceOptions {
  databasePath: string | undefined;
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  migrationsDirectory: string;
  openDatabase?: (filename: string) => Database.Database;
}

function openReadonlyDatabase(filename: string): Database.Database {
  return new Database(filename, {
    readonly: true,
    fileMustExist: true,
  });
}

export function diagnoseConfiguredReadiness(
  options: ReadinessServiceOptions,
): ConfiguredReadinessDiagnostic {
  let database: Database.Database | undefined;

  if (!options.databasePath) {
    return { result: { status: "unavailable" }, reason: "DATABASE_PATH_MISSING" };
  }

  try {
    parseApplicationBaseUrl(
      options.applicationBaseUrl,
      options.environment,
      options.allowInsecureHttp,
    );
  } catch {
    return { result: { status: "unavailable" }, reason: "APPLICATION_CONFIGURATION_INVALID" };
  }

  let filename: string;
  try {
    filename = validateDatabasePath(options.databasePath, options.environment);
  } catch {
    return { result: { status: "unavailable" }, reason: "DATABASE_PATH_INVALID" };
  }

  let requiredMigration: ReturnType<typeof getRequiredMigration>;
  try {
    requiredMigration = getRequiredMigration(options.migrationsDirectory);
  } catch {
    return { result: { status: "unavailable" }, reason: "MIGRATION_CONFIGURATION_INVALID" };
  }

  try {
    database = (options.openDatabase ?? openReadonlyDatabase)(filename);
  } catch {
    return { result: { status: "unavailable" }, reason: "DATABASE_OPEN_FAILED" };
  }

  try {
    // Foreign-key enforcement is connection-local in SQLite. Enabling it on
    // this readonly probe connection does not mutate the database file.
    database.pragma("foreign_keys = ON");
    return diagnoseReadiness(database, requiredMigration);
  } catch {
    return { result: { status: "unavailable" }, reason: "DATABASE_OPEN_FAILED" };
  } finally {
    database.close();
  }
}

export function checkConfiguredReadiness(
  options: ReadinessServiceOptions,
): ReadinessResult {
  return diagnoseConfiguredReadiness(options).result;
}
