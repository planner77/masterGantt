import { createHash, randomUUID } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { validateDatabasePath } from "../../../src/server/db/config";
import { openDatabase } from "../../../src/server/db/core";
import {
  MigrationError,
  runMigrations,
} from "../../../src/server/db/migrations";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";

const sourceMigrations = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-db-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function copiedMigrations(): string {
  const directory = join(temporaryDirectory(), "migrations");
  cpSync(sourceMigrations, directory, { recursive: true });
  return directory;
}

function insertProject(database: Database.Database, name: string): number {
  const now = new Date().toISOString();
  const result = database
    .prepare(
      `
        INSERT INTO projects (
          public_id, name, description, password_kdf, password_salt,
          password_hash, scrypt_n, scrypt_r, scrypt_p, scrypt_key_length,
          calendar_timezone, created_at, updated_at
        ) VALUES (?, ?, '', 'scrypt', ?, ?, 32768, 8, 3, 32, 'Asia/Seoul', ?, ?)
      `,
    )
    .run(randomUUID(), name, Buffer.alloc(16, 1), Buffer.alloc(32, 2), now, now);

  return Number(result.lastInsertRowid);
}

interface InsertTaskOptions {
  projectId: number;
  name: string;
  type?: "task" | "summary" | "milestone";
  parentId?: number | null;
  progress?: number;
}

function insertTask(
  database: Database.Database,
  options: InsertTaskOptions,
): number {
  const now = new Date().toISOString();
  const type = options.type ?? "task";
  const isMilestone = type === "milestone";
  const isSummary = type === "summary";
  const date = "2026-09-14";
  const result = database
    .prepare(
      `
        INSERT INTO tasks (
          project_id, external_id, public_id, name, type, schedule_mode,
          requested_start, start_date, end_date, duration, progress,
          parent_id, sort_order, created_at, updated_at
        ) VALUES (
          @projectId, @externalId, @publicId, @name, @type, 'auto',
          @requestedStart, @startDate, @endDate, @duration, @progress,
          @parentId, 0, @createdAt, @updatedAt
        )
      `,
    )
    .run({
      projectId: options.projectId,
      externalId: randomUUID(),
      publicId: randomUUID(),
      name: options.name,
      type,
      requestedStart: isSummary ? null : date,
      startDate: date,
      endDate: date,
      duration: isMilestone || isSummary ? 0 : 1,
      progress: options.progress ?? 0,
      parentId: options.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    });

  return Number(result.lastInsertRowid);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite connection and schema", () => {
  it("applies the schema with the required connection pragmas and indexes", () => {
    const directory = temporaryDirectory();
    const filename = join(directory, "application.sqlite3");
    const { database, migrations } = openDatabase({
      filename,
      migrationsDirectory: sourceMigrations,
    });

    try {
      expect(migrations.applied).toEqual([
        "0001_initial_schema.sql",
        "0002_task_description_url.sql",
        "0003_resource_catalog.sql",
      ]);
      expect(database.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(database.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(database.pragma("synchronous", { simple: true })).toBe(2);
      expect(database.pragma("busy_timeout", { simple: true })).toBe(5000);

      const tables = database
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name",
        )
        .pluck()
        .all();
      expect(tables).toEqual([
        "edit_sessions",
        "links",
        "project_holidays",
        "projects",
        "resource_catalog_admin_sessions",
        "resource_catalog_state",
        "resource_group_members",
        "resource_groups",
        "resources",
        "schema_migrations",
        "task_assignments",
        "tasks",
      ]);

      const indexes = database
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%' ORDER BY name",
        )
        .pluck()
        .all();
      expect(indexes).toEqual([
        "edit_sessions_project_expires_idx",
        "links_project_predecessor_idx",
        "links_project_successor_idx",
        "resource_admin_sessions_expiry_idx",
        "resource_group_members_resource_idx",
        "task_assignments_group_idx",
        "task_assignments_group_unique_idx",
        "task_assignments_project_task_idx",
        "task_assignments_resource_idx",
        "task_assignments_resource_unique_idx",
        "tasks_project_parent_idx",
        "tasks_project_sort_order_idx",
      ]);
    } finally {
      database.close();
    }
  });

  it("persists rows when a file database is closed and reopened", () => {
    const directory = temporaryDirectory();
    const filename = join(directory, "persistent.sqlite3");
    const first = openDatabase({
      filename,
      migrationsDirectory: sourceMigrations,
    });
    const projectId = insertProject(first.database, "Persistent project");
    first.database.close();

    const second = openDatabase({
      filename,
      migrationsDirectory: sourceMigrations,
    });
    try {
      expect(second.migrations.applied).toEqual([]);
      expect(
        second.database
          .prepare("SELECT name FROM projects WHERE id = ?")
          .pluck()
          .get(projectId),
      ).toBe("Persistent project");
    } finally {
      second.database.close();
    }
  });

  it("preserves computed summary spans beyond the leaf duration limit", () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory: sourceMigrations,
    });

    try {
      const projectId = insertProject(database, "Duration bounds");
      const summaryId = insertTask(database, {
        projectId,
        name: "Long summary",
        type: "summary",
      });
      database
        .prepare("UPDATE tasks SET duration = 10001 WHERE id = ?")
        .run(summaryId);
      expect(
        database.prepare("SELECT duration FROM tasks WHERE id = ?").pluck().get(summaryId),
      ).toBe(10001);

      const taskId = insertTask(database, {
        projectId,
        name: "Bounded leaf",
      });
      expect(() =>
        database.prepare("UPDATE tasks SET duration = 10001 WHERE id = ?").run(taskId),
      ).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});

describe("migration safety", () => {
  it("rolls back the ledger and every pending migration when one fails", () => {
    const directory = temporaryDirectory();
    writeFileSync(join(directory, "0001_first.sql"), "CREATE TABLE first_table (id INTEGER);\n");
    writeFileSync(
      join(directory, "0002_broken.sql"),
      "CREATE TABLE partial_table (id INTEGER);\nTHIS IS NOT SQL;\n",
    );
    const database = new Database(":memory:");

    try {
      expect(() => runMigrations(database, directory)).toThrow(MigrationError);
      const tables = database
        .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
        .pluck()
        .all();
      expect(tables).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("fails closed when an applied migration checksum changes", () => {
    const directory = copiedMigrations();
    const database = new Database(":memory:");

    try {
      runMigrations(database, directory);
      const migrationPath = join(directory, "0001_initial_schema.sql");
      writeFileSync(
        migrationPath,
        `${readFileSync(migrationPath, "utf8")}\n-- changed after application\n`,
      );

      expect(() => runMigrations(database, directory)).toThrow(
        /Checksum mismatch/,
      );
    } finally {
      database.close();
    }
  });

  it("fails closed when an applied migration file is missing", () => {
    const directory = temporaryDirectory();
    writeFileSync(join(directory, "0001_first.sql"), "CREATE TABLE first_table (id INTEGER);\n");
    writeFileSync(join(directory, "0002_second.sql"), "CREATE TABLE second_table (id INTEGER);\n");
    const database = new Database(":memory:");

    try {
      runMigrations(database, directory);
      unlinkSync(join(directory, "0002_second.sql"));
      expect(() => runMigrations(database, directory)).toThrow(
        /missing from disk/,
      );
    } finally {
      database.close();
    }
  });

  it("rejects a sequence gap before creating the migration ledger", () => {
    const directory = temporaryDirectory();
    writeFileSync(join(directory, "0001_first.sql"), "SELECT 1;\n");
    writeFileSync(join(directory, "0003_third.sql"), "SELECT 3;\n");
    const database = new Database(":memory:");

    try {
      expect(() => runMigrations(database, directory)).toThrow(
        /sequence is incomplete/,
      );
      expect(
        database
          .prepare(
            "SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'",
          )
          .pluck()
          .get(),
      ).toBe(0);
    } finally {
      database.close();
    }
  });

  it("rejects renaming an applied migration", () => {
    const directory = temporaryDirectory();
    const original = join(directory, "0001_original.sql");
    const renamed = join(directory, "0001_renamed.sql");
    writeFileSync(original, "CREATE TABLE renamed_test (id INTEGER);\n");
    const database = new Database(":memory:");

    try {
      runMigrations(database, directory);
      renameSync(original, renamed);
      expect(() => runMigrations(database, directory)).toThrow(/was renamed/);
    } finally {
      database.close();
    }
  });

  it("rejects an empty migration directory and a non-prefix ledger", () => {
    const emptyDirectory = temporaryDirectory();
    const emptyDatabase = new Database(":memory:");
    expect(() => runMigrations(emptyDatabase, emptyDirectory)).toThrow(
      /No SQL migrations/,
    );
    emptyDatabase.close();

    const directory = temporaryDirectory();
    writeFileSync(join(directory, "0001_first.sql"), "SELECT 1;\n");
    writeFileSync(join(directory, "0002_second.sql"), "SELECT 2;\n");
    writeFileSync(join(directory, "0003_third.sql"), "SELECT 3;\n");
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL CHECK (length(checksum) = 64),
        applied_at TEXT NOT NULL
      ) STRICT
    `);
    const firstDigest = createHash("sha256")
      .update(readFileSync(join(directory, "0001_first.sql")))
      .digest("hex");
    const thirdDigest = createHash("sha256")
      .update(readFileSync(join(directory, "0003_third.sql")))
      .digest("hex");
    database
      .prepare("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)")
      .run(1, "0001_first.sql", firstDigest, new Date().toISOString());
    database
      .prepare("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)")
      .run(3, "0003_third.sql", thirdDigest, new Date().toISOString());

    try {
      expect(() => runMigrations(database, directory)).toThrow(
        /not a contiguous prefix/,
      );
      expect(
        database
          .prepare("SELECT version FROM schema_migrations ORDER BY version")
          .pluck()
          .all(),
      ).toEqual([1, 3]);
    } finally {
      database.close();
    }
  });
});

describe("project isolation and lifecycle", () => {
  it("rejects cross-project task parents and dependency endpoints", () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory: sourceMigrations,
    });

    try {
      const firstProjectId = insertProject(database, "First");
      const secondProjectId = insertProject(database, "Second");
      const firstSummaryId = insertTask(database, {
        projectId: firstProjectId,
        name: "First summary",
        type: "summary",
      });
      const firstTaskId = insertTask(database, {
        projectId: firstProjectId,
        name: "First task",
      });
      const secondTaskId = insertTask(database, {
        projectId: secondProjectId,
        name: "Second task",
      });

      let crossProjectInsertReachedCallbackEnd = false;
      const insertCrossProjectChild = database.transaction(() => {
        insertTask(database, {
          projectId: secondProjectId,
          name: "Cross-project child",
          parentId: firstSummaryId,
        });
        crossProjectInsertReachedCallbackEnd = true;
      });
      expect(() => insertCrossProjectChild.immediate()).toThrow(
        /FOREIGN KEY constraint failed/,
      );
      expect(crossProjectInsertReachedCallbackEnd).toBe(true);
      expect(
        database
          .prepare("SELECT count(*) FROM tasks WHERE name = 'Cross-project child'")
          .pluck()
          .get(),
      ).toBe(0);

      const now = new Date().toISOString();
      expect(() =>
        database
          .prepare(
            `
              INSERT INTO links (
                public_id, project_id, predecessor_task_id,
                successor_task_id, type, lag, created_at, updated_at
              ) VALUES (?, ?, ?, ?, 'FS', 0, ?, ?)
            `,
          )
          .run(
            randomUUID(),
            firstProjectId,
            firstTaskId,
            secondTaskId,
            now,
            now,
          ),
      ).toThrow(/FOREIGN KEY constraint failed/);
    } finally {
      database.close();
    }
  });

  it("keeps repository reads parameter-bound and scoped to one project", () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory: sourceMigrations,
    });

    try {
      const projects = new ProjectRepository(database);
      const firstProjectPublicId = randomUUID();
      const now = new Date().toISOString();
      const insertedProject = projects.insert({
        publicId: firstProjectPublicId,
        name: "Repository '); DELETE FROM projects; --",
        description: "Bound parameter",
        passwordKdf: "scrypt",
        passwordSalt: Buffer.alloc(16, 4),
        passwordHash: Buffer.alloc(32, 5),
        scryptN: 32768,
        scryptR: 8,
        scryptP: 3,
        scryptKeyLength: 32,
        calendarTimezone: "Asia/Seoul",
        createdAt: now,
        updatedAt: now,
      });
      const firstProjectId = insertedProject.id;
      const secondProjectId = insertProject(database, "Repository second");
      expect(database.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(2);
      const firstTaskId = insertTask(database, {
        projectId: firstProjectId,
        name: "Fractional task",
        progress: 100 / 3,
      });
      const secondTaskId = insertTask(database, {
        projectId: secondProjectId,
        name: "Other project task",
      });
      const firstTaskPublicId = database
        .prepare("SELECT public_id FROM tasks WHERE id = ?")
        .pluck()
        .get(firstTaskId) as string;
      const secondTaskPublicId = database
        .prepare("SELECT public_id FROM tasks WHERE id = ?")
        .pluck()
        .get(secondTaskId) as string;
      database
        .prepare(
          "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(firstProjectId, "2026-10-05", "First holiday", now);
      database
        .prepare(
          "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(secondProjectId, "2026-10-06", "Second holiday", now);
      database
        .prepare(
          "INSERT INTO links (public_id, project_id, predecessor_task_id, successor_task_id, type, lag, created_at, updated_at) VALUES (?, ?, ?, ?, 'FS', 0, ?, ?)",
        )
        .run(
          randomUUID(),
          firstProjectId,
          firstTaskId,
          insertTask(database, {
            projectId: firstProjectId,
            name: "First successor",
          }),
          now,
          now,
        );

      const schedule = new ScheduleRepository(database);
      const project = projects.findByPublicId(firstProjectPublicId);

      expect(project).toMatchObject({
        id: firstProjectId,
        name: "Repository '); DELETE FROM projects; --",
      });
      for (const secretField of [
        "passwordHash",
        "passwordSalt",
        "password_hash",
        "password_salt",
      ]) {
        expect(project).not.toHaveProperty(secretField);
      }
      expect(
        projects.findByPublicId(`${firstProjectPublicId}' OR 1=1 --`),
      ).toBeUndefined();

      const firstTasks = schedule.listTasks(firstProjectId);
      expect(firstTasks.map((task) => task.name)).toEqual([
        "Fractional task",
        "First successor",
      ]);
      expect(firstTasks[0].progress).toBe(100 / 3);
      expect(schedule.listTasks(secondProjectId).map((task) => task.name)).toEqual([
        "Other project task",
      ]);
      expect(
        schedule.findTaskByPublicId(firstProjectId, secondTaskPublicId),
      ).toBeUndefined();
      expect(
        schedule.findTaskByPublicId(firstProjectId, firstTaskPublicId)?.name,
      ).toBe("Fractional task");
      expect(schedule.listLinks(firstProjectId)).toHaveLength(1);
      expect(schedule.listLinks(secondProjectId)).toEqual([]);
      expect(schedule.listHolidays(firstProjectId).map((holiday) => holiday.name)).toEqual([
        "First holiday",
      ]);
    } finally {
      database.close();
    }
  });

  it("lists only public project fields in deterministic latest-update order", () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory: sourceMigrations,
    });

    try {
      const projects = new ProjectRepository(database);
      expect(projects.listPublic()).toEqual([]);

      const insert = (
        publicId: string,
        name: string,
        createdAt: string,
        updatedAt: string,
      ) => projects.insert({
        publicId,
        name,
        description: `${name} description`,
        passwordKdf: "scrypt",
        passwordSalt: Buffer.alloc(16, 4),
        passwordHash: Buffer.alloc(32, 5),
        scryptN: 32768,
        scryptR: 8,
        scryptP: 3,
        scryptKeyLength: 32,
        calendarTimezone: "Asia/Seoul",
        createdAt,
        updatedAt,
      });

      insert(
        "11111111-1111-4111-8111-111111111111",
        "Older",
        "2026-09-10T01:00:00.000Z",
        "2026-09-11T01:00:00.000Z",
      );
      insert(
        "33333333-3333-4333-8333-333333333333",
        "Tie B",
        "2026-09-12T01:00:00.000Z",
        "2026-09-12T01:00:00.000Z",
      );
      insert(
        "22222222-2222-4222-8222-222222222222",
        "Tie A",
        "2026-09-12T01:00:00.000Z",
        "2026-09-12T01:00:00.000Z",
      );

      const listed = projects.listPublic();
      expect(listed.map(({ publicId }) => publicId)).toEqual([
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "11111111-1111-4111-8111-111111111111",
      ]);
      expect(listed[0]).toEqual({
        publicId: "22222222-2222-4222-8222-222222222222",
        name: "Tie A",
        description: "Tie A description",
        createdAt: "2026-09-12T01:00:00.000Z",
        updatedAt: "2026-09-12T01:00:00.000Z",
      });
      for (const project of listed) {
        expect(Object.keys(project).sort()).toEqual([
          "createdAt",
          "description",
          "name",
          "publicId",
          "updatedAt",
        ]);
      }
    } finally {
      database.close();
    }
  });

  it("cascades a project aggregate while retaining direct parent-delete protection", () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory: sourceMigrations,
    });

    try {
      const projectId = insertProject(database, "Cascade");
      const parentId = insertTask(database, {
        projectId,
        name: "Summary",
        type: "summary",
      });
      const childId = insertTask(database, {
        projectId,
        name: "Child",
        parentId,
      });
      const successorId = insertTask(database, {
        projectId,
        name: "Milestone",
        type: "milestone",
      });
      const now = new Date().toISOString();
      database
        .prepare(
          "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (?, '2026-10-05', 'Holiday', ?)",
        )
        .run(projectId, now);
      database
        .prepare(
          "INSERT INTO links (public_id, project_id, predecessor_task_id, successor_task_id, type, lag, created_at, updated_at) VALUES (?, ?, ?, ?, 'FS', 0, ?, ?)",
        )
        .run(randomUUID(), projectId, childId, successorId, now, now);
      database
        .prepare(
          "INSERT INTO edit_sessions (project_id, token_hash, auth_version, created_at, expires_at) VALUES (?, ?, 1, ?, ?)",
        )
        .run(projectId, Buffer.alloc(32, 3), now, "2026-09-15T00:00:00.000Z");

      expect(() =>
        database.prepare("DELETE FROM tasks WHERE id = ?").run(parentId),
      ).toThrow(/FOREIGN KEY constraint failed/);

      database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
      for (const table of [
        "projects",
        "project_holidays",
        "tasks",
        "links",
        "edit_sessions",
      ]) {
        expect(
          database.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),
        ).toBe(0);
      }
    } finally {
      database.close();
    }
  });
});

describe("database path policy", () => {
  it("allows development paths and restricts production to canonical /data children", () => {
    expect(validateDatabasePath(".data/mastergantt.sqlite3", "development")).toBe(
      ".data/mastergantt.sqlite3",
    );
    expect(validateDatabasePath("/data/mastergantt.sqlite3", "production")).toBe(
      "/data/mastergantt.sqlite3",
    );
    expect(() => validateDatabasePath(":memory:", "production")).toThrow();
    expect(() =>
      validateDatabasePath("/tmp/mastergantt.sqlite3", "production"),
    ).toThrow();
    expect(() =>
      validateDatabasePath("/data/../tmp/mastergantt.sqlite3", "production"),
    ).toThrow();
  });
});
