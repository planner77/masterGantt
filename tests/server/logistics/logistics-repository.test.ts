import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const temporaryDirectories: string[] = [];

function createTestDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-logistics-repo-test-"));
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

function insertTestProject(database: Database.Database, publicId = "11111111-1111-4111-8111-111111111111") {
  const repo = new ProjectRepository(database);
  return repo.insert({
    publicId,
    name: "Logistics Test Project",
    description: "Testing logistics repository",
    status: "planned",
    passwordKdf: "scrypt",
    passwordSalt: Buffer.alloc(16, 1),
    passwordHash: Buffer.alloc(32, 2),
    scryptN: 32768,
    scryptR: 8,
    scryptP: 3,
    scryptKeyLength: 32,
    calendarTimezone: "Asia/Seoul",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  });
}

describe("LogisticsRepository Core", () => {
  it("applies migration 0009 and foreign_key_check passes", () => {
    const db = createTestDatabase();
    const fks = db.prepare("PRAGMA foreign_key_check").all();
    expect(fks).toEqual([]);
  });

  it("handles process tree CRUD and unique code constraint", () => {
    const db = createTestDatabase();
    const project = insertTestProject(db);
    const repo = new LogisticsRepository(db);

    const p1 = repo.insertProcess({
      publicId: "proc-1",
      projectId: project.id,
      code: "INBOUND",
      name: "입고 공정",
      parentId: null,
      sortOrder: 1,
      now: "2026-09-27T00:00:00.000Z",
    });

    const p2 = repo.insertProcess({
      publicId: "proc-2",
      projectId: project.id,
      code: "IN_UNLOAD",
      name: "하역 세부공정",
      parentId: p1.id,
      sortOrder: 2,
      now: "2026-09-27T00:00:00.000Z",
    });

    expect(p1.id).toBeDefined();
    expect(p2.parentId).toBe(p1.id);

    const list = repo.listProcesses(project.id);
    expect(list.length).toBe(2);
    expect(list[0].code).toBe("INBOUND");
    expect(list[1].code).toBe("IN_UNLOAD");

    // Duplicate code within same project should throw
    expect(() => {
      repo.insertProcess({
        publicId: "proc-3",
        projectId: project.id,
        code: "INBOUND",
        name: "중복 입고",
        parentId: null,
        now: "2026-09-27T00:00:00.000Z",
      });
    }).toThrow();

    // Count children
    expect(repo.countChildProcesses(project.id, p1.id)).toBe(1);
    expect(repo.countChildProcesses(project.id, p2.id)).toBe(0);
  });

  it("handles equipment CRUD, management unit checks, and unique code", () => {
    const db = createTestDatabase();
    const project = insertTestProject(db);
    const repo = new LogisticsRepository(db);

    const proc = repo.insertProcess({
      publicId: "proc-1",
      projectId: project.id,
      code: "STORAGE",
      name: "보관 공정",
      parentId: null,
      now: "2026-09-27T00:00:00.000Z",
    });

    // unit management unit must have quantity = 1
    const eq1 = repo.insertEquipment({
      publicId: "eq-1",
      projectId: project.id,
      processId: proc.id,
      code: "STK-01",
      name: "Stocker 1호기",
      equipmentType: "stocker",
      managementUnit: "unit",
      quantity: 1,
      manufacturer: "Daifuku",
      now: "2026-09-27T00:00:00.000Z",
    });
    expect(eq1.id).toBeDefined();
    expect(eq1.quantity).toBe(1);

    // fleet management unit can have quantity >= 1
    const eq2 = repo.insertEquipment({
      publicId: "eq-2",
      projectId: project.id,
      processId: proc.id,
      code: "AGV-FLEET",
      name: "AGV 운송군",
      equipmentType: "agv",
      managementUnit: "fleet",
      quantity: 10,
      now: "2026-09-27T00:00:00.000Z",
    });
    expect(eq2.quantity).toBe(10);

    // unit with quantity > 1 should fail CHECK constraint
    expect(() => {
      repo.insertEquipment({
        publicId: "eq-invalid",
        projectId: project.id,
        processId: proc.id,
        code: "STK-INVALID",
        name: "Invalid Stocker",
        equipmentType: "stocker",
        managementUnit: "unit",
        quantity: 2,
        now: "2026-09-27T00:00:00.000Z",
      });
    }).toThrow();

    expect(repo.countEquipmentForProcess(project.id, proc.id)).toBe(2);
  });

  it("handles logistics systems and system links", () => {
    const db = createTestDatabase();
    const project = insertTestProject(db);
    const repo = new LogisticsRepository(db);

    const mcs = repo.insertSystem({
      publicId: "sys-mcs",
      projectId: project.id,
      code: "MCS-01",
      name: "통합 MCS",
      systemType: "mcs",
      layer: "coordinator",
      scope: "project",
      now: "2026-09-27T00:00:00.000Z",
    });

    const acs = repo.insertSystem({
      publicId: "sys-acs",
      projectId: project.id,
      code: "ACS-01",
      name: "AGV 제어시스템",
      systemType: "acs",
      layer: "controller",
      scope: "processes",
      now: "2026-09-27T00:00:00.000Z",
    });

    // Set coordination link: MCS -> ACS
    repo.setCoordinatedSystems(project.id, mcs.id, [acs.id], "2026-09-27T00:00:00.000Z");
    const children = repo.listCoordinatedSystems(project.id, mcs.id);
    expect(children).toEqual([acs.id]);
    expect(repo.countCoordinatedTargets(project.id, mcs.id)).toBe(1);
    expect(repo.countCoordinatingSources(project.id, acs.id)).toBe(1);
  });

  it("enforces at most one primary control system per equipment", () => {
    const db = createTestDatabase();
    const project = insertTestProject(db);
    const repo = new LogisticsRepository(db);

    const proc = repo.insertProcess({
      publicId: "proc-1",
      projectId: project.id,
      code: "P1",
      name: "공정 1",
      parentId: null,
      now: "2026-09-27T00:00:00.000Z",
    });

    const eq = repo.insertEquipment({
      publicId: "eq-1",
      projectId: project.id,
      processId: proc.id,
      code: "E1",
      name: "설비 1",
      equipmentType: "conveyor",
      managementUnit: "unit",
      quantity: 1,
      now: "2026-09-27T00:00:00.000Z",
    });

    const sys1 = repo.insertSystem({
      publicId: "s1",
      projectId: project.id,
      code: "SYS1",
      name: "시스템 1",
      systemType: "lcs",
      layer: "controller",
      scope: "project",
      now: "2026-09-27T00:00:00.000Z",
    });

    const sys2 = repo.insertSystem({
      publicId: "s2",
      projectId: project.id,
      code: "SYS2",
      name: "시스템 2",
      systemType: "other",
      layer: "controller",
      scope: "project",
      now: "2026-09-27T00:00:00.000Z",
    });

    // 1 primary and 1 supporting is allowed
    repo.setEquipmentSystems(
      project.id,
      eq.id,
      [
        { systemId: sys1.id, controlRole: "primary" },
        { systemId: sys2.id, controlRole: "supporting" },
      ],
      "2026-09-27T00:00:00.000Z",
    );

    const eqSystems = repo.listEquipmentSystems(project.id, eq.id);
    expect(eqSystems.length).toBe(2);

    // 2 primaries should throw due to UNIQUE index on primary
    expect(() => {
      repo.setEquipmentSystems(
        project.id,
        eq.id,
        [
          { systemId: sys1.id, controlRole: "primary" },
          { systemId: sys2.id, controlRole: "primary" },
        ],
        "2026-09-27T00:00:00.000Z",
      );
    }).toThrow();
  });

  it("cascades logistics records on project deletion", () => {
    const db = createTestDatabase();
    const project = insertTestProject(db);
    const repo = new LogisticsRepository(db);

    const proc = repo.insertProcess({
      publicId: "p1",
      projectId: project.id,
      code: "PROC",
      name: "공정",
      parentId: null,
      now: "2026-09-27T00:00:00.000Z",
    });
    repo.insertEquipment({
      publicId: "eq1",
      projectId: project.id,
      processId: proc.id,
      code: "EQ",
      name: "설비",
      equipmentType: "agv",
      managementUnit: "unit",
      quantity: 1,
      now: "2026-09-27T00:00:00.000Z",
    });
    repo.insertSystem({
      publicId: "sys1",
      projectId: project.id,
      code: "SYS",
      name: "시스템",
      systemType: "acs",
      layer: "controller",
      scope: "project",
      now: "2026-09-27T00:00:00.000Z",
    });

    expect(repo.hasLogisticsData(project.id)).toBe(true);

    // Delete project
    db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);

    expect(repo.listProcesses(project.id)).toEqual([]);
    expect(repo.listEquipment(project.id)).toEqual([]);
    expect(repo.listSystems(project.id)).toEqual([]);
    expect(repo.hasLogisticsData(project.id)).toBe(false);

    // Verify foreign_key_check passes after cascade
    const fks = db.prepare("PRAGMA foreign_key_check").all();
    expect(fks).toEqual([]);
  });
});
