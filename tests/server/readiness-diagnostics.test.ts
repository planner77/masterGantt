import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/server/db/core";
import { getRequiredMigration } from "../../src/server/db/migrations";
import { diagnoseReadiness } from "../../src/server/health/readiness-core";
import { diagnoseConfiguredReadiness } from "../../src/server/health/readiness-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");

describe("readiness diagnostics", () => {
  it("classifies foreign-key and migration failures without changing the public result", () => {
    const foreignKeysDisabled = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
    foreignKeysDisabled.pragma("foreign_keys = OFF");
    expect(diagnoseReadiness(foreignKeysDisabled, getRequiredMigration(migrationsDirectory))).toEqual({
      result: { status: "unavailable" },
      reason: "FOREIGN_KEYS_DISABLED",
    });
    foreignKeysDisabled.close();

    const migrationMismatch = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
    const required = getRequiredMigration(migrationsDirectory);
    migrationMismatch.prepare("DELETE FROM schema_migrations WHERE version = ?").run(required.version);
    expect(diagnoseReadiness(migrationMismatch, required)).toEqual({
      result: { status: "unavailable" },
      reason: "MIGRATION_MISMATCH",
    });
    migrationMismatch.close();
  });

  it("classifies missing database and invalid application configuration before opening SQLite", () => {
    expect(diagnoseConfiguredReadiness({
      databasePath: undefined,
      applicationBaseUrl: "https://gantt.example.com",
      environment: "production",
      migrationsDirectory,
    })).toEqual({
      result: { status: "unavailable" },
      reason: "DATABASE_PATH_MISSING",
    });

    expect(diagnoseConfiguredReadiness({
      databasePath: "/data/mastergantt.sqlite3",
      applicationBaseUrl: undefined,
      environment: "production",
      migrationsDirectory,
    })).toEqual({
      result: { status: "unavailable" },
      reason: "APPLICATION_CONFIGURATION_INVALID",
    });
  });
});
