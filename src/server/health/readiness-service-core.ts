import Database from "better-sqlite3";

import { validateDatabasePath } from "../db/config";
import { getRequiredMigration } from "../db/migrations";
import { parseApplicationBaseUrl } from "../security/origin-core";
import {
  checkReadiness,
  unavailableReadiness,
  type ReadinessResult,
} from "./readiness-core";

export interface ReadinessServiceOptions {
  databasePath: string | undefined;
  applicationBaseUrl: string | undefined;
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

export function checkConfiguredReadiness(
  options: ReadinessServiceOptions,
): ReadinessResult {
  let database: Database.Database | undefined;

  try {
    if (!options.databasePath) {
      return unavailableReadiness();
    }

    parseApplicationBaseUrl(
      options.applicationBaseUrl,
      options.environment,
    );
    const filename = validateDatabasePath(
      options.databasePath,
      options.environment,
    );
    const requiredMigration = getRequiredMigration(
      options.migrationsDirectory,
    );
    database = (options.openDatabase ?? openReadonlyDatabase)(filename);

    // Foreign-key enforcement is connection-local in SQLite. Enabling it on
    // this readonly probe connection does not mutate the database file.
    database.pragma("foreign_keys = ON");

    return checkReadiness(database, requiredMigration);
  } catch {
    return unavailableReadiness();
  } finally {
    database?.close();
  }
}
