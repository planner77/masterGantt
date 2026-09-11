import { join } from "node:path";
import {
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../src/server/db/core";
import { getRequiredMigration } from "../../src/server/db/migrations";
import { handleReadiness } from "../../src/server/health/readiness-handler-core";
import { checkReadiness } from "../../src/server/health/readiness-core";
import { checkConfiguredReadiness } from "../../src/server/health/readiness-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const databases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-ready-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function migratedDatabase(): Database.Database {
  const { database } = openDatabase({
    filename: ":memory:",
    migrationsDirectory,
  });
  databases.push(database);
  return database;
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    if (database.open) {
      database.close();
    }
  }

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("readiness", () => {
  it("is ready only when SQLite, foreign keys, and the required migration are healthy", () => {
    const database = migratedDatabase();

    expect(
      checkReadiness(database, getRequiredMigration(migrationsDirectory)),
    ).toEqual({ status: "ok" });
  });

  it("fails closed when foreign key enforcement is disabled", () => {
    const database = migratedDatabase();
    database.pragma("foreign_keys = OFF");

    expect(
      checkReadiness(database, getRequiredMigration(migrationsDirectory)),
    ).toEqual({ status: "unavailable" });
  });

  it("fails closed when the required migration is missing or does not match", () => {
    const requiredMigration = getRequiredMigration(migrationsDirectory);
    const missing = migratedDatabase();
    missing
      .prepare("DELETE FROM schema_migrations WHERE version = ?")
      .run(requiredMigration.version);

    expect(checkReadiness(missing, requiredMigration)).toEqual({
      status: "unavailable",
    });

    const mismatched = migratedDatabase();
    mismatched
      .prepare("UPDATE schema_migrations SET checksum = ? WHERE version = ?")
      .run("0".repeat(64), requiredMigration.version);

    expect(checkReadiness(mismatched, requiredMigration)).toEqual({
      status: "unavailable",
    });
  });

  it("fails closed when the SQLite connection cannot execute SELECT 1", () => {
    const database = migratedDatabase();
    database.close();

    expect(
      checkReadiness(database, getRequiredMigration(migrationsDirectory)),
    ).toEqual({ status: "unavailable" });
  });

  it("does not create a database or migration ledger when the configured file is missing", () => {
    const filename = join(temporaryDirectory(), "missing.sqlite3");

    expect(
      checkConfiguredReadiness({
        databasePath: filename,
        applicationBaseUrl: "http://127.0.0.1:3000",
        environment: "test",
        migrationsDirectory,
      }),
    ).toEqual({ status: "unavailable" });
    expect(existsSync(filename)).toBe(false);
  });

  it("opens an existing database readonly and closes the successful probe connection", () => {
    const filename = join(temporaryDirectory(), "application.sqlite3");
    const writable = openDatabase({ filename, migrationsDirectory }).database;
    writable.close();
    let probe: Database.Database | undefined;

    expect(
      checkConfiguredReadiness({
        databasePath: filename,
        applicationBaseUrl: "http://127.0.0.1:3000",
        environment: "test",
        migrationsDirectory,
        openDatabase: (validatedFilename) => {
          probe = new Database(validatedFilename, {
            readonly: true,
            fileMustExist: true,
          });
          return probe;
        },
      }),
    ).toEqual({ status: "ok" });
    expect(probe?.open).toBe(false);
  });

  it("fails closed before opening SQLite when APP_BASE_URL is missing or invalid", () => {
    const filename = join(temporaryDirectory(), "application.sqlite3");
    const writable = openDatabase({ filename, migrationsDirectory }).database;
    writable.close();
    let opens = 0;

    for (const applicationBaseUrl of [
      undefined,
      "http://gantt.example.com",
      "https://user@gantt.example.com",
      "https://gantt.example.com/path",
    ]) {
      expect(
        checkConfiguredReadiness({
          databasePath: filename,
          applicationBaseUrl,
          environment: "production",
          migrationsDirectory,
          openDatabase: () => {
            opens += 1;
            throw new Error("SQLite must not be opened");
          },
        }),
      ).toEqual({ status: "unavailable" });
    }

    expect(opens).toBe(0);
  });

  it("returns a no-store 200 response for a ready service", async () => {
    const response = handleReadiness(() => ({ status: "ok" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("sanitizes provider failures into a no-store 503 response", async () => {
    const response = handleReadiness(() => {
      throw new Error("secret database path and migration detail");
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
