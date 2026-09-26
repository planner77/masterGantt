import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import {
  handleCreateProcess,
  handleGetProjectLogistics,
} from "../../../src/server/logistics/logistics-handlers-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../../../src/server/repositories/project-repository-core";
import {
  createSessionToken,
  sessionExpiry,
} from "../../../src/server/security/session-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function createTestDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-logistics-handler-test-"));
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

function setupProject(database: Database.Database) {
  const projectRepo = new ProjectRepository(database);
  const sessionRepo = new EditSessionRepository(database);
  const token = createSessionToken();
  const now = new Date("2026-09-27T00:00:00.000Z");

  const project = projectRepo.insert({
    publicId: "55555555-5555-4555-8555-555555555555",
    name: "Handler Test Project",
    description: "Testing logistics handlers",
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

  return { project, token, sessionId, now };
}

describe("Logistics HTTP Handlers", () => {
  const appBaseUrl = "https://gantt.example.com";
  const appUrl = new URL(appBaseUrl);

  it("handles GET /logistics in readonly mode without cookies", async () => {
    const db = createTestDatabase();
    const { project, now } = setupProject(db);
    const logisticsService = new LogisticsService(db, { clock: () => now });
    const projectService = new TaskFieldProjectService(db, { clock: () => now });

    const request = new Request(`${appBaseUrl}/api/projects/${project.publicId}/logistics`, {
      method: "GET",
      headers: {
        Origin: appBaseUrl,
      },
    });

    const response = await handleGetProjectLogistics(request, project.publicId, {
      logisticsService,
      projectService,
      applicationBaseUrl: appBaseUrl,
      environment: "production",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.project.publicId).toBe(project.publicId);
    expect(body.data.permission).toBe("readonly");
    expect(body.data.logistics.processes).toEqual([]);
  });

  it("handles POST /processes with origin, session cookie, and If-Match", async () => {
    const db = createTestDatabase();
    const { project, token, now } = setupProject(db);
    const logisticsService = new LogisticsService(db, { clock: () => now });
    const projectService = new TaskFieldProjectService(db, { clock: () => now });

    const cookieHeader = `${editSessionCookieName("production", appUrl)}=${token.rawToken}`;

    // 1. Missing Origin should return 403
    const reqNoOrigin = new Request(`${appBaseUrl}/api/projects/${project.publicId}/logistics/processes`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "If-Match": `"${project.revision}"`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "TEST_PROC", name: "테스트 공정" }),
    });
    const resNoOrigin = await handleCreateProcess(reqNoOrigin, project.publicId, {
      logisticsService,
      projectService,
      applicationBaseUrl: appBaseUrl,
      environment: "production",
    });
    expect(resNoOrigin.status).toBe(403);

    // 2. Missing If-Match should return 428
    const reqNoIfMatch = new Request(`${appBaseUrl}/api/projects/${project.publicId}/logistics/processes`, {
      method: "POST",
      headers: {
        Origin: appBaseUrl,
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "TEST_PROC", name: "테스트 공정" }),
    });
    const resNoIfMatch = await handleCreateProcess(reqNoIfMatch, project.publicId, {
      logisticsService,
      projectService,
      applicationBaseUrl: appBaseUrl,
      environment: "production",
    });
    expect(resNoIfMatch.status).toBe(428);

    // 3. Valid request should return 201 and new revision
    const validReq = new Request(`${appBaseUrl}/api/projects/${project.publicId}/logistics/processes`, {
      method: "POST",
      headers: {
        Origin: appBaseUrl,
        Cookie: cookieHeader,
        "If-Match": `"${project.revision}"`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "TEST_PROC", name: "테스트 공정" }),
    });
    const validRes = await handleCreateProcess(validReq, project.publicId, {
      logisticsService,
      projectService,
      applicationBaseUrl: appBaseUrl,
      environment: "production",
    });
    expect(validRes.status).toBe(201);
    const body = await validRes.json();
    expect(body.data.project.revision).toBe(2);
    expect(body.data.logistics.processes.length).toBe(1);
    expect(body.data.logistics.processes[0].code).toBe("TEST_PROC");
  });
});
