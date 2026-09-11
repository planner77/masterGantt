import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type Database from "better-sqlite3";

const MIGRATION_FILE_PATTERN = /^(\d{4,})_([a-z0-9_]+)\.sql$/;

interface MigrationFile {
  version: number;
  name: string;
  checksum: string;
  sql: string;
}

interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
}

export class MigrationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MigrationError";
  }
}

function checksum(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function loadMigrationFiles(directory: string): MigrationFile[] {
  const migrations = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => {
      const match = MIGRATION_FILE_PATTERN.exec(entry.name);

      if (!match) {
        throw new MigrationError(
          `Invalid migration filename: ${entry.name}. Expected NNNN_name.sql.`,
        );
      }

      const version = Number.parseInt(match[1], 10);
      const contents = readFileSync(join(directory, entry.name));

      return {
        version,
        name: entry.name,
        checksum: checksum(contents),
        sql: contents.toString("utf8"),
      };
    })
    .sort((left, right) => left.version - right.version);

  if (migrations.length === 0) {
    throw new MigrationError(`No SQL migrations were found in ${directory}.`);
  }

  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;

    if (migration.version !== expectedVersion) {
      throw new MigrationError(
        `Migration sequence is incomplete: expected version ${expectedVersion}, found ${migration.version}.`,
      );
    }

    if (
      index > 0 &&
      migrations[index - 1].version === migration.version
    ) {
      throw new MigrationError(
        `Duplicate migration version: ${migration.version}.`,
      );
    }
  });

  return migrations;
}

function ensureLedger(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL CHECK (length(checksum) = 64),
      applied_at TEXT NOT NULL
    ) STRICT
  `);
}

function readLedger(database: Database.Database): AppliedMigration[] {
  return database
    .prepare(
      `
        SELECT version, name, checksum
        FROM schema_migrations
        ORDER BY version
      `,
    )
    .all() as AppliedMigration[];
}

function validateLedger(
  files: MigrationFile[],
  appliedMigrations: AppliedMigration[],
): void {
  for (const [index, applied] of appliedMigrations.entries()) {
    const file = files[index];

    if (!file) {
      throw new MigrationError(
        `Applied migration ${applied.version} (${applied.name}) is missing from disk.`,
      );
    }

    if (applied.version !== file.version) {
      throw new MigrationError(
        `Migration ledger is not a contiguous prefix: expected applied version ${file.version}, found ${applied.version}.`,
      );
    }

    if (file.name !== applied.name) {
      throw new MigrationError(
        `Applied migration ${applied.version} was renamed from ${applied.name} to ${file.name}.`,
      );
    }

    if (file.checksum !== applied.checksum) {
      throw new MigrationError(
        `Checksum mismatch for applied migration ${applied.version} (${applied.name}).`,
      );
    }
  }
}

export interface MigrationResult {
  applied: readonly string[];
}

export function runMigrations(
  database: Database.Database,
  migrationsDirectory: string,
): MigrationResult {
  let files: MigrationFile[];

  try {
    files = loadMigrationFiles(migrationsDirectory);
  } catch (error) {
    if (error instanceof MigrationError) {
      throw error;
    }

    throw new MigrationError(
      `Unable to read migrations from ${migrationsDirectory}.`,
      { cause: error },
    );
  }

  const migrate = database.transaction((): readonly string[] => {
    ensureLedger(database);
    const appliedMigrations = readLedger(database);
    validateLedger(files, appliedMigrations);
    const pending = files.slice(appliedMigrations.length);
    const insertLedgerRow = database.prepare(`
      INSERT INTO schema_migrations (version, name, checksum, applied_at)
      VALUES (@version, @name, @checksum, @appliedAt)
    `);

    for (const migration of pending) {
      database.exec(migration.sql);
      insertLedgerRow.run({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        appliedAt: new Date().toISOString(),
      });
    }

    return pending.map((migration) => migration.name);
  });

  try {
    return { applied: migrate.immediate() };
  } catch (error) {
    if (error instanceof MigrationError) {
      throw error;
    }

    throw new MigrationError("Database migration failed; changes were rolled back.", {
      cause: error,
    });
  }
}
