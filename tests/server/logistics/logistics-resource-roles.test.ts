import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import {
  handleSetEquipmentResourceRoles,
  handleSetSystemResourceRoles,
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
import type { AuthorizedEditSession } from "../../../src/server/projects/project-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function createTestDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-logistics-roles-test-"));
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
} {
  const now = new Date("2026-10-01T00:00:00.000Z");
  const projectRepo = new ProjectRepository(database);
  const sessionRepo = new EditSessionRepository(database);
  const token = createSessionToken();

  const projectRecord = projectRepo.insert({
    publicId,
    name: "Logistics Roles Project",
    description: "Testing roles",
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

  return { authSession, rawToken: token.rawToken, now };
}

function insertResource(
  database: Database.Database,
  publicId: string,
  name: string,
  code: string,
  active = 1,
  developerGrade: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | null = "ADVANCED",
): number {
  const now = "2026-10-01T00:00:00.000Z";
  const result = database
    .prepare(
      `
        INSERT INTO resources (
          public_id, name, code, description, developer_grade, active, created_at, updated_at
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?)
      `,
    )
    .run(publicId, name, code, developerGrade, active, now, now);
  return Number(result.lastInsertRowid);
}

describe("Logistics Resource Roles (LG-02)", () => {
  it("assigns owner/contributor to equipment and PI/developer to system with primary limits", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    // Setup resources
    insertResource(db, "res-owner-1", "홍길동", "R_HGD");
    insertResource(db, "res-contrib-1", "김철수", "R_KCS");
    insertResource(db, "res-pi-1", "이영희", "R_LYH");
    insertResource(db, "res-dev-1", "박민수", "R_PMS");

    // Setup process, equipment, and system
    const procRes = service.createProcess(authSession, 1, {
      code: "INBOUND",
      name: "입고 공정",
    });
    const procId = procRes.data.logistics.processes[0].id;

    const eqRes = service.createEquipment(authSession, 2, {
      processId: procId,
      code: "STK_01",
      name: "Stocker 1",
      equipmentType: "stocker",
      managementUnit: "unit",
      quantity: 1,
    });
    const eqId = eqRes.data.logistics.equipment[0].id;

    const sysRes = service.createSystem(authSession, 3, {
      code: "SCS_01",
      name: "Stocker Control System",
      systemType: "scs",
      layer: "controller",
      scope: "project",
    });
    const sysId = sysRes.data.logistics.systems[0].id;

    // 1. Assign roles to equipment
    const eqRoleRes = service.setEquipmentResourceRoles(authSession, 4, eqId, {
      roles: [
        { resourceId: "res-owner-1", role: "owner", isPrimary: true },
        { resourceId: "res-contrib-1", role: "contributor" },
      ],
    });

    expect(eqRoleRes.data.project.revision).toBe(5);
    const updatedEq = eqRoleRes.data.logistics.equipment.find((e) => e.id === eqId)!;
    expect(updatedEq.resourceRoles.length).toBe(2);
    expect(updatedEq.resourceRoles).toContainEqual({
      resourceId: "res-owner-1",
      resourceCode: "R_HGD",
      resourceName: "홍길동",
      role: "owner",
      isPrimary: true,
      active: true,
    });
    expect(updatedEq.resourceRoles).toContainEqual({
      resourceId: "res-contrib-1",
      resourceCode: "R_KCS",
      resourceName: "김철수",
      role: "contributor",
      isPrimary: false,
      active: true,
    });

    // 2. Assign roles to system
    const sysRoleRes = service.setSystemResourceRoles(authSession, 5, sysId, {
      roles: [
        { resourceId: "res-pi-1", role: "pi", isPrimary: true },
        { resourceId: "res-dev-1", role: "developer" },
      ],
    });

    expect(sysRoleRes.data.project.revision).toBe(6);
    const updatedSys = sysRoleRes.data.logistics.systems.find((s) => s.id === sysId)!;
    expect(updatedSys.resourceRoles.length).toBe(2);
    expect(updatedSys.resourceRoles).toContainEqual({
      resourceId: "res-pi-1",
      resourceCode: "R_LYH",
      resourceName: "이영희",
      role: "pi",
      isPrimary: true,
      active: true,
    });
    expect(updatedSys.resourceRoles).toContainEqual({
      resourceId: "res-dev-1",
      resourceCode: "R_PMS",
      resourceName: "박민수",
      role: "developer",
      isPrimary: false,
      active: true,
    });
  });

  it("allows same resource across multiple equipment and systems with different roles", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    insertResource(db, "res-multi-1", "올라운더", "R_ALL");

    const procRes = service.createProcess(authSession, 1, {
      code: "MAIN",
      name: "메인 공정",
    });
    const procId = procRes.data.logistics.processes[0].id;

    const eq1 = service.createEquipment(authSession, 2, {
      processId: procId,
      code: "EQ1",
      name: "Equipment 1",
      equipmentType: "conveyor",
      managementUnit: "unit",
      quantity: 1,
    }).data.logistics.equipment[0];

    const eq2 = service.createEquipment(authSession, 3, {
      processId: procId,
      code: "EQ2",
      name: "Equipment 2",
      equipmentType: "agv",
      managementUnit: "fleet",
      quantity: 2,
    }).data.logistics.equipment.find((e) => e.code === "EQ2")!;

    const s1 = service.createSystem(authSession, 4, {
      code: "SYS1",
      name: "System 1",
      systemType: "lcs",
      layer: "controller",
      scope: "project",
    }).data.logistics.systems[0];

    const s2 = service.createSystem(authSession, 5, {
      code: "SYS2",
      name: "System 2",
      systemType: "mcs",
      layer: "coordinator",
      scope: "project",
    }).data.logistics.systems.find((s) => s.code === "SYS2")!;

    // res-multi-1 as:
    // EQ1: owner (primary)
    // EQ2: contributor
    // SYS1: pi (primary)
    // SYS2: developer
    service.setEquipmentResourceRoles(authSession, 6, eq1.id, {
      roles: [{ resourceId: "res-multi-1", role: "owner", isPrimary: true }],
    });
    service.setEquipmentResourceRoles(authSession, 7, eq2.id, {
      roles: [{ resourceId: "res-multi-1", role: "contributor" }],
    });
    service.setSystemResourceRoles(authSession, 8, s1.id, {
      roles: [{ resourceId: "res-multi-1", role: "pi", isPrimary: true }],
    });
    const finalRes = service.setSystemResourceRoles(authSession, 9, s2.id, {
      roles: [{ resourceId: "res-multi-1", role: "developer" }],
    });

    expect(finalRes.data.project.revision).toBe(10);
    const dto = finalRes.data.logistics;
    expect(dto.equipment.find((e) => e.code === "EQ1")!.resourceRoles[0].role).toBe("owner");
    expect(dto.equipment.find((e) => e.code === "EQ2")!.resourceRoles[0].role).toBe("contributor");
    expect(dto.systems.find((s) => s.code === "SYS1")!.resourceRoles[0].role).toBe("pi");
    expect(dto.systems.find((s) => s.code === "SYS2")!.resourceRoles[0].role).toBe("developer");
  });

  it("blocks newly assigning inactive resource but allows preserving already-assigned inactive resource", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    insertResource(db, "res-active-1", "활성 인력", "R_ACT", 1);
    insertResource(db, "res-inactive-1", "퇴사 인력", "R_INACT", 0);

    const proc = service.createProcess(authSession, 1, {
      code: "P",
      name: "Process",
    }).data.logistics.processes[0];

    const eq = service.createEquipment(authSession, 2, {
      processId: proc.id,
      code: "EQ",
      name: "Equipment",
      equipmentType: "other",
      managementUnit: "unit",
      quantity: 1,
    }).data.logistics.equipment[0];

    // Attempting to newly assign inactive resource must fail with RESOURCE_INACTIVE (409)
    expect(() => {
      service.setEquipmentResourceRoles(authSession, 3, eq.id, {
        roles: [{ resourceId: "res-inactive-1", role: "owner" }],
      });
    }).toThrowError(/Cannot newly assign inactive resource/);

    // Assign active resource first
    service.setEquipmentResourceRoles(authSession, 3, eq.id, {
      roles: [{ resourceId: "res-active-1", role: "owner", isPrimary: true }],
    });

    // Inactivate the resource in database directly (simulating admin deactivation later)
    db.prepare("UPDATE resources SET active = 0 WHERE public_id = ?").run("res-active-1");

    // Preserving the already-assigned inactive resource is allowed
    const preservedRes = service.setEquipmentResourceRoles(authSession, 4, eq.id, {
      roles: [{ resourceId: "res-active-1", role: "owner", isPrimary: true }],
    });
    expect(preservedRes.data.project.revision).toBe(5);
    expect(preservedRes.data.logistics.equipment[0].resourceRoles[0].active).toBe(false);
  });

  it("enforces database foreign key preventing hard deletion of referenced resource", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    const resourceDbId = insertResource(db, "res-fk-1", "보호 대상 인력", "R_FK", 1);

    const proc = service.createProcess(authSession, 1, { code: "P", name: "Process" }).data.logistics.processes[0];
    const eq = service.createEquipment(authSession, 2, {
      processId: proc.id,
      code: "EQ",
      name: "Equipment",
      equipmentType: "other",
      managementUnit: "unit",
      quantity: 1,
    }).data.logistics.equipment[0];

    service.setEquipmentResourceRoles(authSession, 3, eq.id, {
      roles: [{ resourceId: "res-fk-1", role: "owner" }],
    });

    // Attempting to hard-delete resource from resources table must be blocked by SQLite foreign key
    expect(() => {
      db.prepare("DELETE FROM resources WHERE id = ?").run(resourceDbId);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("handles HTTP PUT for equipment and system resource roles", async () => {
    const db = createTestDatabase();
    const { authSession, rawToken, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });
    const projectService = new TaskFieldProjectService(db, { clock: () => now });

    insertResource(db, "res-http-1", "HTTP 담당자", "R_HTTP", 1);

    const proc = service.createProcess(authSession, 1, { code: "P", name: "Proc" }).data.logistics.processes[0];
    const eq = service.createEquipment(authSession, 2, {
      processId: proc.id,
      code: "EQ",
      name: "Eq",
      equipmentType: "stocker",
      managementUnit: "unit",
      quantity: 1,
    }).data.logistics.equipment[0];

    const dependencies = {
      logisticsService: service,
      projectService,
      applicationBaseUrl: "https://gantt.example.com",
      environment: "test" as const,
    };

    // Valid PUT request
    const req = new Request(
      `https://gantt.example.com/api/projects/${authSession.projectPublicId}/logistics/equipment/${eq.id}/resource-roles`,
      {
        method: "PUT",
        headers: {
          Origin: "https://gantt.example.com",
          "If-Match": '"3"',
          Cookie: `mastergantt_edit=${rawToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roles: [{ resourceId: "res-http-1", role: "owner", isPrimary: true }],
        }),
      },
    );

    const res = await handleSetEquipmentResourceRoles(
      req,
      authSession.projectPublicId,
      eq.id,
      dependencies,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"4"');
    const json = await res.json();
    expect(json.data.logistics.equipment[0].resourceRoles[0].resourceName).toBe("HTTP 담당자");

    const sys = service.createSystem(authSession, 4, {
      code: "SYS",
      name: "System",
      systemType: "mcs",
      layer: "controller",
      scope: "project",
    }).data.logistics.systems[0];

    const sysReq = new Request(
      `https://gantt.example.com/api/projects/${authSession.projectPublicId}/logistics/systems/${sys.id}/resource-roles`,
      {
        method: "PUT",
        headers: {
          Origin: "https://gantt.example.com",
          "If-Match": '"5"',
          Cookie: `mastergantt_edit=${rawToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roles: [{ resourceId: "res-http-1", role: "pi", isPrimary: true }],
        }),
      },
    );

    const sysRes = await handleSetSystemResourceRoles(
      sysReq,
      authSession.projectPublicId,
      sys.id,
      dependencies,
    );
    expect(sysRes.status).toBe(200);
    expect(sysRes.headers.get("ETag")).toBe('"6"');
    const sysJson = await sysRes.json();
    expect(sysJson.data.logistics.systems[0].resourceRoles[0].resourceName).toBe("HTTP 담당자");
  });

  it("requires a developer grade for a new developer role, preserves legacy ungraded assignments, and keeps grade after role removal", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    insertResource(db, "res-ungraded-1", "등급 미지정", "R_UNG", 1, null);
    insertResource(db, "res-graded-1", "등급 보유", "R_GRD", 1, "EXPERT");

    const system = service.createSystem(authSession, 1, {
      code: "SYS_GRADE",
      name: "Grade System",
      systemType: "mcs",
      layer: "controller",
      scope: "project",
    }).data.logistics.systems[0];

    expect(() =>
      service.setSystemResourceRoles(authSession, 2, system.id, {
        roles: [{ resourceId: "res-ungraded-1", role: "developer" }],
      }),
    ).toThrowError(/Developer grade is required/);

    service.setSystemResourceRoles(authSession, 2, system.id, {
      roles: [{ resourceId: "res-graded-1", role: "developer" }],
    });
    db.prepare("UPDATE resources SET developer_grade = NULL WHERE public_id = ?").run("res-graded-1");

    const preserved = service.setSystemResourceRoles(authSession, 3, system.id, {
      roles: [{ resourceId: "res-graded-1", role: "developer" }],
    });
    expect(preserved.data.project.revision).toBe(4);

    db.prepare("UPDATE resources SET developer_grade = 'EXPERT' WHERE public_id = ?").run("res-graded-1");
    service.setSystemResourceRoles(authSession, 4, system.id, { roles: [] });
    const row = db.prepare("SELECT developer_grade FROM resources WHERE public_id = ?").get("res-graded-1") as { developer_grade: string | null };
    expect(row.developer_grade).toBe("EXPERT");
  });

});
