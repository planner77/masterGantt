import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { ProjectCopyService, LogisticsCopyNotSupportedYetError } from "../../../src/server/projects/project-copy-service-core";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../../../src/server/repositories/project-repository-core";
import {
  createSessionToken,
  sessionExpiry,
} from "../../../src/server/security/session-core";
import type { AuthorizedEditSession } from "../../../src/server/projects/project-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function createTestDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-copy-guard-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "test.sqlite3");
  const { database } = openDatabase({ filename: dbPath, migrationsDirectory });
  return database;
}

afterEach(() => {
  for (const dir of temporaryDirectories) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  temporaryDirectories.length = 0;
});

function setupProjectWithSession(database: Database.Database, publicId: string) {
  const projectRepo = new ProjectRepository(database);
  const sessionRepo = new EditSessionRepository(database);
  const token = createSessionToken();
  const now = new Date("2026-09-27T00:00:00.000Z");

  const project = projectRepo.insert({
    publicId,
    name: "Copy Guard Test Project",
    description: "Testing copy guard",
    status: "planned",
    passwordKdf: "scrypt",
    passwordSalt: Buffer.alloc(16, 1),
    passwordHash: Buffer.alloc(32, 2),
    scryptN: 32768,
    scryptR: 8,
    scryptP: 3,
    scryptKeyLength: 32,
    calendarTimezone: "Asia/Seoul",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const sessionId = sessionRepo.insert({
    projectId: project.id,
    tokenHash: token.tokenHash,
    authVersion: project.authVersion,
    createdAt: now.toISOString(),
    expiresAt: sessionExpiry(now).toISOString(),
  });

  const authSession: AuthorizedEditSession = {
    projectId: project.id,
    projectPublicId: project.publicId,
    projectRevision: project.revision,
    projectAuthVersion: project.authVersion,
    sessionId,
    tokenHash: token.tokenHash,
    expiresAt: sessionExpiry(now).toISOString(),
  };

  return { project, authSession, token, now };
}

describe("Logistics Copy Guard (LG-01)", () => {
  it("allows copying a project without logistics data", async () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(
      db,
      "33333333-3333-4333-8333-333333333333",
    );
    const copyService = new ProjectCopyService(db, {
      clock: () => now,
      hashPassword: async () => ({
        algorithm: "scrypt",
        salt: Buffer.alloc(16, 1),
        hash: Buffer.alloc(32, 2),
        n: 32768,
        r: 8,
        p: 3,
        keyLength: 32,
      }),
    });

    const copied = await copyService.copy(authSession, 1, {
      name: "Copied Project",
      description: "Copied description",
      editPassword: "ValidPassword123!",
    });

    expect(copied.response.data.project.publicId).toBeDefined();
    expect(copied.response.data.project.name).toBe("Copied Project");
  });

  it("blocks copying a project with logistics data with LogisticsCopyNotSupportedYetError", async () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(
      db,
      "44444444-4444-4444-8444-444444444444",
    );
    const logisticsService = new LogisticsService(db, { clock: () => now });
    const copyService = new ProjectCopyService(db, {
      clock: () => now,
      hashPassword: async () => ({
        algorithm: "scrypt",
        salt: Buffer.alloc(16, 1),
        hash: Buffer.alloc(32, 2),
        n: 32768,
        r: 8,
        p: 3,
        keyLength: 32,
      }),
    });

    // Add logistics data
    logisticsService.createProcess(authSession, 1, {
      code: "PACKING",
      name: "포장 공정",
    });

    // Try to copy project with logistics data (revision is now 2)
    await expect(
      copyService.copy(authSession, 2, {
        name: "Attempted Copy",
        description: "Should fail",
        editPassword: "ValidPassword123!",
      }),
    ).rejects.toThrow(LogisticsCopyNotSupportedYetError);
  });
});
