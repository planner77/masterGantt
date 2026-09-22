import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runCli(
  filename: string | undefined,
  environment: NodeJS.ProcessEnv["NODE_ENV"] = "test",
) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: environment, LOG_LEVEL: "info" };
  delete env.DATABASE_PATH;
  if (filename !== undefined) env.DATABASE_PATH = filename;
  return spawnSync(
    process.execPath,
    ["--import", "tsx", resolve("scripts/migrate.ts")],
    { cwd: process.cwd(), env, encoding: "utf8", timeout: 15_000 },
  );
}

function diagnosticEvents(stderr: string): Array<Record<string, unknown>> {
  return stderr
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("migration CLI", () => {
  it("persists the schema across processes and is safe to rerun", () => {
    const directory = mkdtempSync(join(tmpdir(), "mastergantt-cli-"));
    temporaryDirectories.push(directory);
    const filename = join(directory, "nested", "app.sqlite3");

    const first = runCli(filename);
    expect(first.error).toBeUndefined();
    expect(first.status, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout)).toEqual({
      status: "ok",
      applied: [
        "0001_initial_schema.sql",
        "0002_task_description_url.sql",
        "0003_resource_catalog.sql",
        "0004_project_owner.sql",
        "0005_resource_workload.sql",
        "0006_work_calendars.sql",
        "0007_resource_admin_credentials.sql",
      ],
    });
    expect(diagnosticEvents(first.stderr).map((entry) => entry.event)).toEqual([
      "database_migration_started",
      "database_migration_completed",
    ]);

    const second = runCli(filename);
    expect(second.status, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout)).toEqual({ status: "ok", applied: [] });
    expect(diagnosticEvents(second.stderr).map((entry) => entry.event)).toEqual([
      "database_migration_started",
      "database_migration_completed",
    ]);

    const database = new Database(filename, { readonly: true });
    try {
      expect(database.prepare("SELECT count(*) AS count FROM schema_migrations").get())
        .toEqual({ count: 7 });
      expect(database.prepare("SELECT count(*) AS count FROM projects").get())
        .toEqual({ count: 0 });
      expect(database.prepare("SELECT revision FROM resource_catalog_state WHERE id = 1").get())
        .toEqual({ revision: 1 });
      const ownerColumn = database.prepare("SELECT name, \"notnull\" AS required FROM pragma_table_info('projects') WHERE name = 'owner_name'").get();
      expect(ownerColumn).toEqual({ name: "owner_name", required: 0 });
      const allocationColumn = database.prepare("SELECT name, type FROM pragma_table_info('task_assignments') WHERE name = 'allocation_percent'").get();
      expect(allocationColumn).toEqual({ name: "allocation_percent", type: "REAL" });
    } finally {
      database.close();
    }
  });

  it("fails without an explicit path and emits a safe structured diagnostic", () => {
    const result = runCli(undefined);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    const events = diagnosticEvents(result.stderr);
    expect(events.map((entry) => entry.event)).toEqual([
      "database_migration_started",
      "database_migration_failed",
    ]);
    expect(result.stderr).not.toContain("DATABASE_PATH is required");
  });

  it("rejects a production path outside /data without exposing it", () => {
    const filename = "/tmp/private-deployment-location.sqlite3";
    const result = runCli(filename, "production");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain(filename);
    expect(diagnosticEvents(result.stderr).at(-1)?.event).toBe("database_migration_failed");
  });
});
