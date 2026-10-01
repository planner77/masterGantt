import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import {
  handleGetTaskLogisticsLinks,
  handleReplaceTaskLogisticsLinks,
} from "../../../src/server/logistics/logistics-handlers-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import {
  createSessionToken,
  sessionExpiry,
} from "../../../src/server/security/session-core";
import type { AuthorizedEditSession } from "../../../src/server/projects/project-service-core";
import {
  buildTaskEffectiveLogisticsMap,
  filterTasksWithAncestors,
  EMPTY_TASK_FILTER,
} from "../../../src/features/projects/project-search-filter";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import type { ProjectLogisticsDto } from "../../../src/contracts/logistics";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function createTestDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-task-links-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "test.sqlite3");
  const { database } = openDatabase({ filename: dbPath, migrationsDirectory });
  return database;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function setupProjectWithSession(
  database: Database.Database,
  publicId = "11111111-2222-4333-8444-555555555555",
): {
  authSession: AuthorizedEditSession;
  rawToken: string;
  now: Date;
  projectId: number;
} {
  const now = new Date("2026-10-01T00:00:00.000Z");
  const projectRepo = new ProjectRepository(database);
  const sessionRepo = new EditSessionRepository(database);
  const token = createSessionToken();

  const projectRecord = projectRepo.insert({
    publicId,
    name: "Task Logistics Links Project",
    description: "Testing task logistics links",
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

  const expiresAt = sessionExpiry(now).toISOString();

  const sessionId = sessionRepo.insert({
    projectId: projectRecord.id,
    tokenHash: token.tokenHash,
    authVersion: projectRecord.authVersion,
    createdAt: now.toISOString(),
    expiresAt,
  });

  const authSession: AuthorizedEditSession = {
    projectId: projectRecord.id,
    projectPublicId: publicId,
    projectRevision: projectRecord.revision,
    projectAuthVersion: projectRecord.authVersion,
    sessionId,
    tokenHash: token.tokenHash,
    expiresAt,
  };

  return { authSession, rawToken: token.rawToken, now, projectId: projectRecord.id };
}

describe("Task Logistics Links Service & Database Integrity", () => {
  it("allows Summary, Task, Milestone to link multiple equipment and systems", () => {
    const database = createTestDatabase();
    const { authSession, projectId, now } = setupProjectWithSession(database);
    const service = new LogisticsService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);
    const logisticsRepo = new LogisticsRepository(database);

    // Create process
    const proc = logisticsRepo.insertProcess({
      projectId,
      publicId: "proc-1",
      code: "PROC-01",
      name: "입고 공정",
      parentId: null,
      now: now.toISOString(),
    });

    // Create 2 equipment
    const eq1 = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-1",
      code: "EQ-01",
      name: "입고 크레인 1호",
      equipmentType: "stocker",
      managementUnit: "unit",
      quantity: 1,
      now: now.toISOString(),
    });
    const eq2 = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-2",
      code: "EQ-02",
      name: "입고 크레인 2호",
      equipmentType: "stocker",
      managementUnit: "unit",
      quantity: 1,
      now: now.toISOString(),
    });

    // Create 2 systems
    const sys1 = logisticsRepo.insertSystem({
      projectId,
      publicId: "sys-1",
      code: "SYS-01",
      name: "입고 제어기 1호",
      systemType: "scs",
      layer: "controller",
      scope: "project",
      now: now.toISOString(),
    });
    const sys2 = logisticsRepo.insertSystem({
      projectId,
      publicId: "sys-2",
      code: "SYS-02",
      name: "물류 조율기",
      systemType: "mcs",
      layer: "coordinator",
      scope: "project",
      now: now.toISOString(),
    });

    // Create tasks: 1 Summary, 1 Task, 1 Milestone
    const summaryTask = scheduleRepo.insertTask({
      projectId,
      externalId: "SUM-1",
      publicId: "task-sum-1",
      name: "상위 구축 요약",
      type: "summary",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-10",
      duration: 10,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const leafTask = scheduleRepo.insertTask({
      projectId,
      externalId: "TSK-1",
      publicId: "task-leaf-1",
      name: "설비 설치 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      duration: 5,
      progress: 50,
      parentId: summaryTask.id,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const milestoneTask = scheduleRepo.insertTask({
      projectId,
      externalId: "MLS-1",
      publicId: "task-mls-1",
      name: "설비 시운전 완료",
      type: "milestone",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      duration: 0,
      progress: 0,
      parentId: summaryTask.id,
      sortOrder: 2,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // 1. Link Summary with subtree scope
    const res1 = service.replaceTaskLogisticsLinks(authSession, 1, summaryTask.publicId, {
      equipmentLinks: [{ equipmentId: eq1.publicId, scope: "subtree" }],
      systemLinks: [{ systemId: sys1.publicId, scope: "subtree" }],
    });
    expect(res1.data.project.revision).toBe(2);

    // 2. Link Leaf Task with self scope
    const res2 = service.replaceTaskLogisticsLinks(authSession, 2, leafTask.publicId, {
      equipmentLinks: [{ equipmentId: eq2.publicId, scope: "self" }],
      systemLinks: [],
    });
    expect(res2.data.project.revision).toBe(3);

    // 3. Link Milestone with self scope
    const res3 = service.replaceTaskLogisticsLinks(authSession, 3, milestoneTask.publicId, {
      equipmentLinks: [],
      systemLinks: [{ systemId: sys2.publicId, scope: "self" }],
    });
    expect(res3.data.project.revision).toBe(4);

    // Verify Leaf Task inheritance:
    // Direct eq: [eq2], Inherited eq: [eq1] (from summaryTask). Effective: [eq2, eq1]
    // Direct sys: [], Inherited sys: [sys1]. Effective: [sys1]
    const leafLinks = service.getTaskLogisticsLinks(projectId, leafTask.publicId);
    expect(leafLinks.directEquipmentLinks).toHaveLength(1);
    expect(leafLinks.directEquipmentLinks[0].equipmentId).toBe("eq-2");
    expect(leafLinks.inheritedEquipmentLinks).toHaveLength(1);
    expect(leafLinks.inheritedEquipmentLinks[0].equipmentId).toBe("eq-1");
    expect(leafLinks.inheritedEquipmentLinks[0].sourceTaskId).toBe(summaryTask.publicId);
    expect(leafLinks.effectiveEquipmentIds).toEqual(expect.arrayContaining(["eq-1", "eq-2"]));
    expect(leafLinks.inheritedSystemLinks).toHaveLength(1);
    expect(leafLinks.inheritedSystemLinks[0].systemId).toBe("sys-1");
    expect(leafLinks.effectiveSystemIds).toEqual(["sys-1"]);

    // Verify Milestone inheritance:
    const mlsLinks = service.getTaskLogisticsLinks(projectId, milestoneTask.publicId);
    expect(mlsLinks.inheritedEquipmentLinks).toHaveLength(1);
    expect(mlsLinks.inheritedEquipmentLinks[0].equipmentId).toBe("eq-1");
    expect(mlsLinks.directSystemLinks).toHaveLength(1);
    expect(mlsLinks.directSystemLinks[0].systemId).toBe("sys-2");
    expect(mlsLinks.inheritedSystemLinks).toHaveLength(1);
    expect(mlsLinks.inheritedSystemLinks[0].systemId).toBe("sys-1");
    expect(mlsLinks.effectiveSystemIds).toEqual(expect.arrayContaining(["sys-1", "sys-2"]));
  });

  it("rejects subtree scope on leaf Task or Milestone", () => {
    const database = createTestDatabase();
    const { authSession, projectId, now } = setupProjectWithSession(database);
    const service = new LogisticsService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);
    const logisticsRepo = new LogisticsRepository(database);

    const proc = logisticsRepo.insertProcess({
      projectId,
      publicId: "proc-1",
      code: "PROC-01",
      name: "공정",
      parentId: null,
      now: now.toISOString(),
    });
    const eq = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-1",
      code: "EQ-01",
      name: "설비",
      equipmentType: "amr",
      managementUnit: "unit",
      quantity: 1,
      now: now.toISOString(),
    });
    const leafTask = scheduleRepo.insertTask({
      projectId,
      externalId: "TSK-1",
      publicId: "task-leaf-1",
      name: "일반 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      duration: 5,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    expect(() =>
      service.replaceTaskLogisticsLinks(authSession, 1, leafTask.publicId, {
        equipmentLinks: [{ equipmentId: eq.publicId, scope: "subtree" }],
        systemLinks: [],
      }),
    ).toThrow("Subtree scope is only allowed for summary tasks.");
  });

  it("blocks linking inactive equipment or system for newly added links", () => {
    const database = createTestDatabase();
    const { authSession, projectId, now } = setupProjectWithSession(database);
    const service = new LogisticsService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);
    const logisticsRepo = new LogisticsRepository(database);

    const proc = logisticsRepo.insertProcess({
      projectId,
      publicId: "proc-1",
      code: "PROC-01",
      name: "공정",
      parentId: null,
      now: now.toISOString(),
    });
    const inactiveEq = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-inactive",
      code: "EQ-INACTIVE",
      name: "비활성 설비",
      equipmentType: "oht",
      managementUnit: "unit",
      quantity: 1,
      active: 0,
      now: now.toISOString(),
    });

    const leafTask = scheduleRepo.insertTask({
      projectId,
      externalId: "TSK-1",
      publicId: "task-leaf-1",
      name: "일반 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      duration: 5,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    expect(() =>
      service.replaceTaskLogisticsLinks(authSession, 1, leafTask.publicId, {
        equipmentLinks: [{ equipmentId: inactiveEq.publicId, scope: "self" }],
        systemLinks: [],
      }),
    ).toThrow("Cannot link inactive equipment");
  });

  it("prevents hard deletion of equipment/system linked to tasks", () => {
    const database = createTestDatabase();
    const { authSession, projectId, now } = setupProjectWithSession(database);
    const service = new LogisticsService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);
    const logisticsRepo = new LogisticsRepository(database);

    const proc = logisticsRepo.insertProcess({
      projectId,
      publicId: "proc-1",
      code: "PROC-01",
      name: "공정",
      parentId: null,
      now: now.toISOString(),
    });
    const eq = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-1",
      code: "EQ-01",
      name: "설비 1",
      equipmentType: "conveyor",
      managementUnit: "unit",
      quantity: 1,
      now: now.toISOString(),
    });
    const leafTask = scheduleRepo.insertTask({
      projectId,
      externalId: "TSK-1",
      publicId: "task-leaf-1",
      name: "일반 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      duration: 5,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    service.replaceTaskLogisticsLinks(authSession, 1, leafTask.publicId, {
      equipmentLinks: [{ equipmentId: eq.publicId, scope: "self" }],
      systemLinks: [],
    });

    // Try hard delete
    expect(() =>
      service.deleteEquipment(authSession, 2, eq.publicId, true),
    ).toThrow("Cannot permanently delete equipment");
  });

  it("cascades task link deletion on task delete while preserving equipment master", () => {
    const database = createTestDatabase();
    const { authSession, projectId, now } = setupProjectWithSession(database);
    const service = new LogisticsService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);
    const logisticsRepo = new LogisticsRepository(database);

    const proc = logisticsRepo.insertProcess({
      projectId,
      publicId: "proc-1",
      code: "PROC-01",
      name: "공정",
      parentId: null,
      now: now.toISOString(),
    });
    const eq = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-1",
      code: "EQ-01",
      name: "설비 1",
      equipmentType: "agv",
      managementUnit: "fleet",
      quantity: 5,
      now: now.toISOString(),
    });
    const leafTask = scheduleRepo.insertTask({
      projectId,
      externalId: "TSK-1",
      publicId: "task-leaf-1",
      name: "일반 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      duration: 5,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    service.replaceTaskLogisticsLinks(authSession, 1, leafTask.publicId, {
      equipmentLinks: [{ equipmentId: eq.publicId, scope: "self" }],
      systemLinks: [],
    });

    expect(logisticsRepo.countTaskEquipmentLinks(projectId, eq.id)).toBe(1);

    // Delete task directly via scheduleRepo
    scheduleRepo.deleteTask(projectId, leafTask.publicId);

    // Links should be cascaded by SQLite foreign key ON DELETE CASCADE
    expect(logisticsRepo.countTaskEquipmentLinks(projectId, eq.id)).toBe(0);

    // Master equipment is preserved
    const foundEq = logisticsRepo.findEquipmentById(projectId, eq.id);
    expect(foundEq).toBeDefined();
    expect(foundEq?.code).toBe("EQ-01");
  });
});

describe("Task Logistics Links REST API Handlers", () => {
  it("GET returns task logistics links with permission", async () => {
    const database = createTestDatabase();
    const { rawToken, projectId, now } = setupProjectWithSession(
      database,
      "22222222-3333-4444-8555-666666666666",
    );
    const service = new LogisticsService(database, { clock: () => now });
    const projectService = new TaskFieldProjectService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);

    scheduleRepo.insertTask({
      projectId,
      externalId: "T-01",
      publicId: "task-01",
      name: "테스트 작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      duration: 2,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const request = new Request(
      "http://localhost:3000/api/projects/22222222-3333-4444-8555-666666666666/tasks/task-01/logistics-links",
      {
        headers: {
          cookie: `mastergantt_edit=${rawToken}`,
        },
      },
    );

    const response = await handleGetTaskLogisticsLinks(
      request,
      "22222222-3333-4444-8555-666666666666",
      "task-01",
      {
        logisticsService: service,
        projectService,
        applicationBaseUrl: "http://localhost:3000",
        environment: "test",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.taskId).toBe("task-01");
    expect(body.data.permission).toBe("edit");
    expect(body.data.links.directEquipmentLinks).toEqual([]);
    expect(body.data.links.effectiveEquipmentIds).toEqual([]);

    const anonymousResponse = await handleGetTaskLogisticsLinks(
      new Request(
        "http://localhost:3000/api/projects/22222222-3333-4444-8555-666666666666/tasks/task-01/logistics-links",
      ),
      "22222222-3333-4444-8555-666666666666",
      "task-01",
      {
        logisticsService: service,
        projectService,
        applicationBaseUrl: "http://localhost:3000",
        environment: "test",
      },
    );
    expect(anonymousResponse.status).toBe(200);
    const anonymousBody = await anonymousResponse.json();
    expect(anonymousBody.data.permission).toBe("readonly");
  });

  it("PUT requires valid edit session and If-Match header", async () => {
    const database = createTestDatabase();
    const { rawToken, projectId, now } = setupProjectWithSession(
      database,
      "33333333-4444-4555-8666-777777777777",
    );
    const service = new LogisticsService(database, { clock: () => now });
    const projectService = new TaskFieldProjectService(database, { clock: () => now });
    const scheduleRepo = new ScheduleRepository(database);
    const logisticsRepo = new LogisticsRepository(database);

    const proc = logisticsRepo.insertProcess({
      projectId,
      publicId: "proc-1",
      code: "PROC-1",
      name: "공정",
      parentId: null,
      now: now.toISOString(),
    });
    const eq = logisticsRepo.insertEquipment({
      projectId,
      processId: proc.id,
      publicId: "eq-1",
      code: "EQ-1",
      name: "설비",
      equipmentType: "stocker",
      managementUnit: "unit",
      quantity: 1,
      now: now.toISOString(),
    });

    scheduleRepo.insertTask({
      projectId,
      externalId: "T-01",
      publicId: "task-01",
      name: "작업",
      type: "task",
      scheduleMode: "auto",
      requestedStart: null,
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      duration: 2,
      progress: 0,
      parentId: null,
      sortOrder: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const dependencies = {
      logisticsService: service,
      projectService,
      applicationBaseUrl: "http://localhost:3000",
      environment: "test" as const,
    };

    // Request without cookie -> 401
    const noAuthReq = new Request(
      "http://localhost:3000/api/projects/33333333-4444-4555-8666-777777777777/tasks/task-01/logistics-links",
      {
        method: "PUT",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "if-match": '"1"',
        },
        body: JSON.stringify({ equipmentLinks: [], systemLinks: [] }),
      },
    );
    const noAuthRes = await handleReplaceTaskLogisticsLinks(
      noAuthReq,
      "33333333-4444-4555-8666-777777777777",
      "task-01",
      dependencies,
    );
    expect(noAuthRes.status).toBe(401);

    // Request with valid auth and If-Match
    const validReq = new Request(
      "http://localhost:3000/api/projects/33333333-4444-4555-8666-777777777777/tasks/task-01/logistics-links",
      {
        method: "PUT",
        headers: {
          origin: "http://localhost:3000",
          cookie: `mastergantt_edit=${rawToken}`,
          "content-type": "application/json",
          "if-match": '"1"',
        },
        body: JSON.stringify({
          equipmentLinks: [{ equipmentId: eq.publicId, scope: "self" }],
          systemLinks: [],
        }),
      },
    );
    const validRes = await handleReplaceTaskLogisticsLinks(
      validReq,
      "33333333-4444-4555-8666-777777777777",
      "task-01",
      dependencies,
    );
    expect(validRes.status).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.data.project.revision).toBe(2);
    expect(validBody.data.operation.entity).toBe("taskLogisticsLinks");
  });
});

describe("Logistics Scope Filtering (buildTaskEffectiveLogisticsMap & filterTasksWithAncestors)", () => {
  it("keeps hidden ancestor subtree logistics inheritance inside a scoped WBS filter", () => {
    const allTasks: ProjectTaskDto[] = [
      {
        taskId: "ancestor",
        externalId: "ANCESTOR",
        name: "Hidden ancestor",
        type: "summary",
        scheduleMode: "auto",
        requestedStart: null,
        start: "2026-10-01",
        end: "2026-10-10",
        duration: 10,
        progress: 0,
        parentExternalId: null,
        siblingOrder: 0,
      },
      {
        taskId: "scope-root",
        externalId: "SCOPE",
        name: "Scoped summary",
        type: "summary",
        scheduleMode: "auto",
        requestedStart: null,
        start: "2026-10-01",
        end: "2026-10-05",
        duration: 5,
        progress: 0,
        parentExternalId: "ANCESTOR",
        siblingOrder: 0,
      },
      {
        taskId: "scope-leaf",
        externalId: "LEAF",
        name: "Scoped leaf",
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-10-01",
        start: "2026-10-01",
        end: "2026-10-05",
        duration: 5,
        progress: 0,
        parentExternalId: "SCOPE",
        siblingOrder: 0,
      },
    ];
    const logistics: ProjectLogisticsDto = {
      processes: [{
        id: "proc-hidden", code: "P-H", name: "상위 공정", parentProcessId: null,
        sortOrder: 0, active: true, createdAt: "", updatedAt: "",
      }],
      equipment: [{
        id: "eq-hidden", processId: "proc-hidden", code: "EQ-H", name: "상위 설비",
        equipmentType: "stocker", managementUnit: "unit", quantity: 1,
        manufacturer: "", model: "", description: "", active: true,
        controlSystems: [], resourceRoles: [], createdAt: "", updatedAt: "",
      }],
      systems: [],
      systemLinks: [],
      taskEquipmentLinks: [{ taskId: "ancestor", equipmentId: "eq-hidden", scope: "subtree" }],
      taskSystemLinks: [],
    };
    const scopedTasks = allTasks.filter((task) => task.taskId !== "ancestor");
    const result = filterTasksWithAncestors(
      scopedTasks,
      { ...EMPTY_TASK_FILTER, equipmentIds: ["eq-hidden"] },
      [],
      logistics,
      allTasks,
    );

    expect(result.matchCount).toBe(2);
    expect(result.tasks.map((task) => task.taskId)).toEqual(["scope-root", "scope-leaf"]);
  });

  it("filters tasks by effective equipment, system, and process while preserving ancestor summaries as context rows", () => {
    // Construct simulated DTOs
    const mockTasks: ProjectTaskDto[] = [
      {
        taskId: "t-sum-root",
        externalId: "SUM-0",
        name: "프로젝트 최상위 요약",
        type: "summary",
        scheduleMode: "auto",
        start: "2026-10-01",
        end: "2026-10-30",
        duration: 30,
        progress: 10,
        parentExternalId: null,
        siblingOrder: 0,
        requestedStart: null,
      },
      {
        taskId: "t-sum-sub",
        externalId: "SUM-1",
        name: "1구역 공정 요약",
        type: "summary",
        scheduleMode: "auto",
        start: "2026-10-01",
        end: "2026-10-15",
        duration: 15,
        progress: 20,
        parentExternalId: "SUM-0",
        siblingOrder: 0,
        requestedStart: null,
      },
      {
        taskId: "t-leaf-1",
        externalId: "TSK-1",
        name: "1구역 크레인 작업",
        type: "task",
        scheduleMode: "auto",
        start: "2026-10-01",
        end: "2026-10-05",
        duration: 5,
        progress: 50,
        parentExternalId: "SUM-1",
        siblingOrder: 0,
        requestedStart: null,
      },
      {
        taskId: "t-leaf-2",
        externalId: "TSK-2",
        name: "2구역 컨베이어 작업",
        type: "task",
        scheduleMode: "auto",
        start: "2026-10-10",
        end: "2026-10-20",
        duration: 10,
        progress: 0,
        parentExternalId: "SUM-0",
        siblingOrder: 1,
        requestedStart: null,
      },
    ];

    const mockLogistics: ProjectLogisticsDto = {
      processes: [
        {
          id: "proc-1",
          code: "P-01",
          name: "1구역",
          parentProcessId: null,
          sortOrder: 1,
          active: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      equipment: [
        {
          id: "eq-1",
          processId: "proc-1",
          code: "EQ-01",
          name: "크레인 1",
          equipmentType: "stocker",
          managementUnit: "unit",
          quantity: 1,
          manufacturer: "",
          model: "",
          description: "",
          active: true,
          controlSystems: [],
          resourceRoles: [],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "eq-2",
          processId: "",
          code: "EQ-02",
          name: "컨베이어 2",
          equipmentType: "conveyor",
          managementUnit: "unit",
          quantity: 1,
          manufacturer: "",
          model: "",
          description: "",
          active: true,
          controlSystems: [],
          resourceRoles: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
      systems: [],
      systemLinks: [],
      taskEquipmentLinks: [
        // SUM-1 has eq-1 with subtree scope!
        { taskId: "t-sum-sub", equipmentId: "eq-1", scope: "subtree" },
        // TSK-2 has eq-2 directly with self scope
        { taskId: "t-leaf-2", equipmentId: "eq-2", scope: "self" },
      ],
      taskSystemLinks: [],
    };

    // 1. Build map and verify inheritance
    const effectiveMap = buildTaskEffectiveLogisticsMap(mockTasks, mockLogistics);

    // t-leaf-1 inherits eq-1 from t-sum-sub (since SUM-1 is parent and scope is subtree)
    const leaf1Eff = effectiveMap.get("t-leaf-1");
    expect(leaf1Eff?.equipmentIds.has("eq-1")).toBe(true);
    expect(leaf1Eff?.processIds.has("proc-1")).toBe(true);

    // t-leaf-2 only has eq-2
    const leaf2Eff = effectiveMap.get("t-leaf-2");
    expect(leaf2Eff?.equipmentIds.has("eq-2")).toBe(true);
    expect(leaf2Eff?.equipmentIds.has("eq-1")).toBe(false);

    // 2. Filter by equipment EQ-01
    const filterByEq1 = {
      ...EMPTY_TASK_FILTER,
      equipmentIds: ["eq-1"],
    };
    const result1 = filterTasksWithAncestors(mockTasks, filterByEq1, [], mockLogistics);

    // Matching leaf should be TSK-1 (since SUM-1 also has eq-1, both match directly or via inheritance)
    // And ancestors (SUM-0) should be included as context rows
    const visibleIds = result1.tasks.map((t) => t.externalId);
    expect(visibleIds).toContain("TSK-1");
    expect(visibleIds).toContain("SUM-1");
    expect(visibleIds).toContain("SUM-0");
    // TSK-2 should NOT be visible
    expect(visibleIds).not.toContain("TSK-2");

    // 3. Filter by equipment EQ-02
    const filterByEq2 = {
      ...EMPTY_TASK_FILTER,
      equipmentIds: ["eq-2"],
    };
    const result2 = filterTasksWithAncestors(mockTasks, filterByEq2, [], mockLogistics);
    const visibleIds2 = result2.tasks.map((t) => t.externalId);
    expect(visibleIds2).toContain("TSK-2");
    expect(visibleIds2).toContain("SUM-0"); // context row
    expect(visibleIds2).not.toContain("TSK-1");
    expect(visibleIds2).not.toContain("SUM-1");
  });
});
