import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import { runMigrations, type MigrationResult } from "./migrations";

export interface OpenDatabaseOptions {
  filename: string;
  migrationsDirectory: string;
  createParentDirectory?: boolean;
  migrate?: boolean;
}

export interface OpenDatabaseResult {
  database: Database.Database;
  migrations: MigrationResult;
}

function prepareDatabaseDirectory(
  filename: string,
  createParentDirectory: boolean,
): void {
  if (!createParentDirectory || filename === ":memory:" || filename.startsWith("file:")) {
    return;
  }

  mkdirSync(dirname(resolve(filename)), { recursive: true });
}

function configureConnection(
  database: Database.Database,
  isMemoryDatabase: boolean,
): void {
  database.pragma("foreign_keys = ON");

  const foreignKeys = database.pragma("foreign_keys", { simple: true });
  if (foreignKeys !== 1) {
    throw new Error("SQLite foreign key enforcement could not be enabled.");
  }

  database.pragma("busy_timeout = 5000");
  const journalMode = database.pragma("journal_mode = WAL", { simple: true });
  if (journalMode !== "wal" && !(isMemoryDatabase && journalMode === "memory")) {
    throw new Error(`SQLite WAL mode could not be enabled (actual: ${journalMode}).`);
  }
  database.pragma("synchronous = FULL");
}

function assertForeignKeyIntegrity(database: Database.Database): void {
  const violations = database.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    throw new Error("SQLite foreign key integrity check failed.");
  }
}

export function openDatabase(options: OpenDatabaseOptions): OpenDatabaseResult {
  if (options.filename.trim().length === 0) {
    throw new Error("A non-empty SQLite database filename is required.");
  }

  if (options.migrationsDirectory.trim().length === 0) {
    throw new Error("A non-empty migrations directory is required.");
  }

  prepareDatabaseDirectory(
    options.filename,
    options.createParentDirectory ?? true,
  );

  const database = new Database(options.filename);

  try {
    configureConnection(database, options.filename === ":memory:");
    const migrations = options.migrate === false
      ? { applied: [] }
      : runMigrations(database, options.migrationsDirectory);
    assertForeignKeyIntegrity(database);

    return { database, migrations };
  } catch (error) {
    database.close();
    throw error;
  }
}
