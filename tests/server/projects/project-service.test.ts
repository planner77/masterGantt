import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";
import {
  hashSessionToken,
} from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-project-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function fixedPasswordHash(marker = 1): PasswordHashRecord {
  return {
    algorithm: "scrypt",
    salt: Buffer.alloc(16, marker),
    hash: Buffer.alloc(32, marker + 1),
    n: 32_768,
    r: 8,
    p: 3,
    keyLength: 32,
  };
}

function createTestService(
  database: Database.Database,
  overrides: ConstructorParameters<typeof ProjectService>[1] = {},
): ProjectService {
  return new ProjectService(database, {
    clock: () => new Date("2026-09-11T01:00:00.000Z"),
    hashPassword: async () => fixedPasswordHash(),
    ...overrides,
  });
}

function insertTask(
  database: Database.Database,
  projectId: number,
  externalId: string,
  parentId: number | null = null,
): number {
  const now = "2026-09-11T01:00:00.000Z";
  const result = database
    .prepare(
      `
        INSERT INTO tasks (
          project_id, external_id, public_id, name, type, schedule_mode,
          requested_start, start_date, end_date, duration, progress,
          parent_id, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'task', 'auto', '2026-09-11',
          '2026-09-11', '2026-09-11', 1, 25, ?, 0, ?, ?)
      `,
    )
    .run(
      projectId,
      externalId,
      randomUUID(),
      `${externalId} name`,
      parentId,
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("ProjectService create", () => {
  it("hashes outside the transaction and atomically stores only derived credentials", async () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory,
    });
    const password = "plain password phrase";
    let observedPassword = "";
    let hashingRanInsideTransaction = true;
    const service = createTestService(database, {
      hashPassword: async (candidate) => {
        observedPassword = candidate;
        hashingRanInsideTransaction = database.inTransaction;
        return fixedPasswordHash(7);
      },
    });

    try {
      const created = await service.create({
        name: "Project name",
        description: "Description",
        editPassword: password,
      });

      expect(observedPassword).toBe(password);
      expect(hashingRanInsideTransaction).toBe(false);
      expect(created.response.data.permission).toBe("edit");
      expect(created.response.data.project).toMatchObject({
        name: "Project name",
        description: "Description",
        revision: 1,
        calendar: {
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: [],
        },
      });
      expect(JSON.stringify(created.response)).not.toContain(password);

      const project = database
        .prepare(
          `
            SELECT password_kdf, password_salt, password_hash,
              scrypt_n, scrypt_r, scrypt_p, scrypt_key_length,
              auth_version, revision
            FROM projects
          `,
        )
        .get() as {
          password_kdf: string;
          password_salt: Buffer;
          password_hash: Buffer;
          scrypt_n: number;
          scrypt_r: number;
          scrypt_p: number;
          scrypt_key_length: number;
          auth_version: number;
          revision: number;
        };
      expect(project).toEqual({
        password_kdf: "scrypt",
        password_salt: Buffer.alloc(16, 7),
        password_hash: Buffer.alloc(32, 8),
        scrypt_n: 32_768,
        scrypt_r: 8,
        scrypt_p: 3,
        scrypt_key_length: 32,
        auth_version: 1,
        revision: 1,
      });

      const session = database
        .prepare(
          "SELECT token_hash, auth_version, created_at, expires_at FROM edit_sessions",
        )
        .get() as {
          token_hash: Buffer;
          auth_version: number;
          created_at: string;
          expires_at: string;
        };
      expect(session.token_hash.equals(hashSessionToken(created.rawSessionToken))).toBe(true);
      expect(session.token_hash.toString("base64url")).not.toBe(
        created.rawSessionToken,
      );
      expect(session).toMatchObject({
        auth_version: 1,
        created_at: "2026-09-11T01:00:00.000Z",
        expires_at: "2026-09-11T09:00:00.000Z",
      });
    } finally {
      database.close();
    }
  });

  it("rolls the Project back when initial session insertion fails", async () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory,
    });
    const service = createTestService(database, {
      generateSessionToken: () => ({
        rawToken: "not-persisted",
        tokenHash: Buffer.alloc(31),
      }),
    });

    try {
      await expect(
        service.create({
          name: "Rollback",
          description: "",
          editPassword: "password phrase",
        }),
      ).rejects.toThrow();
      expect(database.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(0);
      expect(database.prepare("SELECT count(*) FROM edit_sessions").pluck().get()).toBe(0);
    } finally {
      database.close();
    }
  });

  it("retries a colliding public UUID and stops after the bounded attempts", async () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory,
    });
    const collision = "11111111-1111-4111-8111-111111111111";
    const unique = "22222222-2222-4222-8222-222222222222";
    const existingService = createTestService(database, {
      generatePublicId: () => collision,
    });

    try {
      await existingService.create({
        name: "Existing",
        description: "",
        editPassword: "password phrase",
      });
      const identifiers = [collision, unique];
      const retrying = createTestService(database, {
        generatePublicId: () => identifiers.shift() ?? unique,
      });
      const created = await retrying.create({
        name: "Retried",
        description: "",
        editPassword: "password phrase",
      });
      expect(created.response.data.project.publicId).toBe(unique);

      const neverValid = createTestService(database, {
        generatePublicId: () => "not-a-uuid",
      });
      await expect(
        neverValid.create({
          name: "Never stored",
          description: "",
          editPassword: "password phrase",
        }),
      ).rejects.toThrow(/unique project identifier/);
      expect(database.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(2);
    } finally {
      database.close();
    }
  });

  it("persists creation without writing the raw password to the database file", async () => {
    const directory = temporaryDirectory();
    const filename = join(directory, "projects.sqlite3");
    const first = openDatabase({ filename, migrationsDirectory });
    const password = "unique raw password 7uQ!";
    const service = createTestService(first.database);
    const created = await service.create({
      name: "Persistent",
      description: "Stored",
      editPassword: password,
    });
    first.database.close();

    expect(readFileSync(filename).includes(Buffer.from(password, "utf8"))).toBe(false);

    const second = openDatabase({ filename, migrationsDirectory });
    try {
      const snapshot = createTestService(second.database).getReadonlySnapshot(
        created.response.data.project.publicId,
      );
      expect(snapshot?.data.project.name).toBe("Persistent");
      expect(snapshot?.data.permission).toBe("readonly");
    } finally {
      second.database.close();
    }
  });
});

describe("ProjectService direct read", () => {
  it("returns an empty public project collection", () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory,
    });

    try {
      expect(createTestService(database).listProjects()).toEqual({
        data: { projects: [] },
      });
    } finally {
      database.close();
    }
  });

  it("returns only public list fields in latest-update order with a stable tie-break", async () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory,
    });
    const publicIds = [
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
    ];
    const times = [
      new Date("2026-09-11T01:00:00.000Z"),
      new Date("2026-09-12T01:00:00.000Z"),
      new Date("2026-09-12T01:00:00.000Z"),
    ];
    const service = createTestService(database, {
      generatePublicId: () => publicIds.shift() ?? randomUUID(),
      clock: () => times.shift() ?? new Date("2026-09-12T01:00:00.000Z"),
    });

    try {
      await service.create({
        name: "Older",
        description: "First description",
        editPassword: "password phrase",
      });
      await service.create({
        name: "Tie B",
        description: "Third UUID",
        editPassword: "password phrase",
      });
      await service.create({
        name: "Tie A",
        description: "Second UUID",
        editPassword: "password phrase",
      });

      const sessionsBefore = database.prepare(
        `SELECT id, project_id, hex(token_hash) AS token_hash,
                auth_version, created_at, expires_at, revoked_at
         FROM edit_sessions ORDER BY id`,
      ).all();
      const response = service.listProjects();
      expect(response).toEqual({
        data: {
          projects: [
            {
              publicId: "22222222-2222-4222-8222-222222222222",
              name: "Tie A",
              description: "Second UUID",
              createdAt: "2026-09-12T01:00:00.000Z",
              updatedAt: "2026-09-12T01:00:00.000Z",
            },
            {
              publicId: "33333333-3333-4333-8333-333333333333",
              name: "Tie B",
              description: "Third UUID",
              createdAt: "2026-09-12T01:00:00.000Z",
              updatedAt: "2026-09-12T01:00:00.000Z",
            },
            {
              publicId: "11111111-1111-4111-8111-111111111111",
              name: "Older",
              description: "First description",
              createdAt: "2026-09-11T01:00:00.000Z",
              updatedAt: "2026-09-11T01:00:00.000Z",
            },
          ],
        },
      });
      const serialized = JSON.stringify(response);
      for (const forbidden of [
        "password",
        "passwordHash",
        "passwordSalt",
        "authVersion",
        "revision",
        "calendarTimezone",
        "tokenHash",
        "projectId",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(database.prepare(
        `SELECT id, project_id, hex(token_hash) AS token_hash,
                auth_version, created_at, expires_at, revoked_at
         FROM edit_sessions ORDER BY id`,
      ).all()).toEqual(sessionsBefore);
    } finally {
      database.close();
    }
  });

  it("returns one project-scoped public snapshot without internal or secret fields", async () => {
    const { database } = openDatabase({
      filename: ":memory:",
      migrationsDirectory,
    });
    const service = createTestService(database);

    try {
      const first = await service.create({
        name: "First",
        description: "First description",
        editPassword: "password phrase",
      });
      const second = await service.create({
        name: "Second",
        description: "Second description",
        editPassword: "password phrase",
      });
      const firstId = database
        .prepare("SELECT id FROM projects WHERE public_id = ?")
        .pluck()
        .get(first.response.data.project.publicId) as number;
      const secondId = database
        .prepare("SELECT id FROM projects WHERE public_id = ?")
        .pluck()
        .get(second.response.data.project.publicId) as number;
      database
        .prepare(
          "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(firstId, "2026-10-05", "First holiday", "2026-09-11T01:00:00.000Z");
      database
        .prepare(
          "INSERT INTO project_holidays (project_id, holiday_date, name, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(secondId, "2026-10-06", "Second holiday", "2026-09-11T01:00:00.000Z");
      const firstTask = insertTask(database, firstId, "FIRST-1");
      const firstSuccessor = insertTask(database, firstId, "FIRST-2");
      insertTask(database, secondId, "SECOND-1");
      database
        .prepare(
          `
            INSERT INTO links (
              public_id, project_id, predecessor_task_id, successor_task_id,
              type, lag, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'FS', 0, ?, ?)
          `,
        )
        .run(
          randomUUID(),
          firstId,
          firstTask,
          firstSuccessor,
          "2026-09-11T01:00:00.000Z",
          "2026-09-11T01:00:00.000Z",
        );

      const snapshot = service.getReadonlySnapshot(
        first.response.data.project.publicId,
      );
      expect(snapshot?.data).toMatchObject({
        permission: "readonly",
        project: {
          publicId: first.response.data.project.publicId,
          name: "First",
          calendar: {
            holidays: [{ date: "2026-10-05", name: "First holiday" }],
          },
        },
      });
      expect(snapshot?.data.tasks.map((task) => task.externalId)).toEqual([
        "FIRST-1",
        "FIRST-2",
      ]);
      expect(snapshot?.data.links).toHaveLength(1);
      const serialized = JSON.stringify(snapshot);
      for (const forbidden of [
        "Second",
        "SECOND-1",
        "password",
        "passwordHash",
        "passwordSalt",
        "authVersion",
        "tokenHash",
        "projectId",
        '"id":1',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(service.getReadonlySnapshot(randomUUID())).toBeUndefined();
    } finally {
      database.close();
    }
  });
});
