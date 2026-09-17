import { join } from "node:path";

import { validateDatabasePath } from "../src/server/db/config";
import { openDatabase } from "../src/server/db/core";
import { createStructuredLogger, type StructuredLogSink } from "../src/server/logging/logger-core";

const stderrSink: StructuredLogSink = {
  debug: (line) => process.stderr.write(`${line}\n`),
  info: (line) => process.stderr.write(`${line}\n`),
  warn: (line) => process.stderr.write(`${line}\n`),
  error: (line) => process.stderr.write(`${line}\n`),
};

const logger = createStructuredLogger({
  level: process.env.LOG_LEVEL,
  environment: process.env.NODE_ENV,
  component: "database_migration",
  sink: stderrSink,
});

function main(): void {
  const configuredPath = process.env.DATABASE_PATH;
  logger.info("database_migration_started", {
    databaseConfigured: Boolean(configuredPath),
  });

  if (!configuredPath) {
    throw new Error("DATABASE_PATH is required.");
  }

  const filename = validateDatabasePath(configuredPath, process.env.NODE_ENV);
  const { database, migrations } = openDatabase({
    filename,
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  });

  try {
    logger.info("database_migration_completed", {
      appliedCount: migrations.applied.length,
      applied: migrations.applied,
    });
    process.stdout.write(`${JSON.stringify({ status: "ok", applied: migrations.applied })}\n`);
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  logger.error("database_migration_failed", {
    errorType: error instanceof Error ? error.name : typeof error,
    databaseConfigured: Boolean(process.env.DATABASE_PATH),
  });
  process.exitCode = 1;
}
