import "server-only";

import { join } from "node:path";

import type Database from "better-sqlite3";

import { validateDatabasePath } from "./config";
import { openDatabase } from "./core";
import { installE2eSqlObserver } from "./e2e-sql-observer-core";

let applicationDatabase: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (applicationDatabase) {
    return applicationDatabase;
  }

  const filename = process.env.DATABASE_PATH;
  if (!filename) {
    throw new Error("DATABASE_PATH is required to open the application database.");
  }

  applicationDatabase = openDatabase({
    filename: validateDatabasePath(filename, process.env.NODE_ENV),
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  }).database;

  // Opt-in only inside disposable, test-scoped Next development servers.
  if (process.env.NODE_ENV === "development" && process.env.ISSUE_751_SQL_METRICS === "true") {
    installE2eSqlObserver(applicationDatabase);
  }

  return applicationDatabase;
}

export function closeDatabase(): void {
  applicationDatabase?.close();
  applicationDatabase = undefined;
}
