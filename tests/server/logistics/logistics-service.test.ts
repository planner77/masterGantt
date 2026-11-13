import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ProcessContextRepository } from "../../../src/server/repositories/process-context-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
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
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-logistics-svc-test-"));
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

function setupProjectWithSession(database: Database.Database) {
  const projectRepo = new ProjectRepository(database);
  const sessionRepo = new EditSessionRepository(database);
  const token = createSessionToken();
  const now = new Date("2026-09-27T00:00:00.000Z");

  const project = projectRepo.insert({
    publicId: "22222222-2222-4222-8222-222222222222",
    name: "Logistics Service Test",
    description: "Testing logistics service",
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

describe("LogisticsService Core", () => {
  it("generates stable unique process codes when create input omits code", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const generatedIds = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ];
    const service = new LogisticsService(db, {
      clock: () => now,
      generatePublicId: () => generatedIds.shift()!,
    });

    const first = service.createProcess(authSession, 1, { name: "자동 코드 공정 1" });
    const firstProcess = first.data.logistics.processes[0];
    expect(firstProcess.code).toBe("PROC-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(firstProcess.code.length).toBeLessThanOrEqual(64);

    const second = service.createProcess(authSession, 2, { name: "자동 코드 공정 2" });
    const autoCodes = second.data.logistics.processes.map((process) => process.code);
    expect(autoCodes).toContain("PROC-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(autoCodes).toContain("PROC-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(new Set(autoCodes).size).toBe(autoCodes.length);

    const legacy = service.createProcess(authSession, 3, {
      code: "LEGACY-PROC",
      name: "명시 코드 공정",
    });
    expect(legacy.data.logistics.processes.find((process) => process.name === "명시 코드 공정")?.code).toBe(
      "LEGACY-PROC",
    );
  });

  it("creates, updates, and soft-deletes process with revision increment", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    // 1. Create process
    const res1 = service.createProcess(authSession, 1, {
      code: "INBOUND",
      name: "입고 공정",
      sortOrder: 1,
    });

    expect(res1.data.project.revision).toBe(2);
    expect(res1.data.logistics.processes.length).toBe(1);
    const proc = res1.data.logistics.processes[0];
    expect(proc.code).toBe("INBOUND");
    expect(proc.active).toBe(true);

    // 2. Duplicate code should fail
    expect(() => {
      service.createProcess(authSession, 2, {
        code: "INBOUND",
        name: "중복 입고",
      });
    }).toThrowError(/already exists/);

    // 3. Update process
    const res2 = service.updateProcess(authSession, 2, proc.id, {
      name: "입고 및 검수 공정",
    });
    expect(res2.data.project.revision).toBe(3);
    expect(res2.data.logistics.processes[0].name).toBe("입고 및 검수 공정");

    // 4. Soft delete process
    const res3 = service.deleteProcess(authSession, 3, proc.id, false);
    expect(res3.data.project.revision).toBe(4);
    expect(res3.data.logistics.processes[0].active).toBe(false);
  });

  it("prevents self and cyclic hierarchy in processes", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    const p1Res = service.createProcess(authSession, 1, { code: "P1", name: "Process 1" });
    const p1Id = p1Res.data.logistics.processes[0].id;

    const p2Res = service.createProcess(authSession, 2, { code: "P2", name: "Process 2", parentProcessId: p1Id });
    const p2Id = p2Res.data.logistics.processes.find((p) => p.code === "P2")!.id;

    // Self parent should fail
    expect(() => {
      service.updateProcess(authSession, 3, p1Id, { parentProcessId: p1Id });
    }).toThrowError(/cannot be its own parent/);

    // Cycle: setting P1's parent to P2 should fail
    expect(() => {
      service.updateProcess(authSession, 3, p1Id, { parentProcessId: p2Id });
    }).toThrowError(/cycle/);
  });

  it("blocks permanent delete if process or system is in use", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    const pRes = service.createProcess(authSession, 1, { code: "P1", name: "Process 1" });
    const pId = pRes.data.logistics.processes[0].id;

    service.createEquipment(authSession, 2, {
      processId: pId,
      code: "EQ1",
      name: "Equipment 1",
      equipmentType: "agv",
      managementUnit: "unit",
      quantity: 1,
    });

    // Hard delete of process with equipment should throw 409 PROCESS_IN_USE
    expect(() => {
      service.deleteProcess(authSession, 3, pId, true);
    }).toThrowError(/Cannot permanently delete process with 1 equipment/);
  });

  it("enforces controller layer for equipment control and at most one primary", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    const pRes = service.createProcess(authSession, 1, { code: "P1", name: "Process 1" });
    const pId = pRes.data.logistics.processes[0].id;

    const eqRes = service.createEquipment(authSession, 2, {
      processId: pId,
      code: "EQ1",
      name: "Equipment 1",
      equipmentType: "conveyor",
      managementUnit: "unit",
      quantity: 1,
    });
    const eqId = eqRes.data.logistics.equipment[0].id;

    const mcsRes = service.createSystem(authSession, 3, {
      code: "MCS1",
      name: "MCS Coordinator",
      systemType: "mcs",
      layer: "coordinator",
      scope: "project",
    });
    const mcsId = mcsRes.data.logistics.systems[0].id;

    const lcsRes = service.createSystem(authSession, 4, {
      code: "LCS1",
      name: "LCS Controller",
      systemType: "lcs",
      layer: "controller",
      scope: "project",
    });
    const lcsId = lcsRes.data.logistics.systems.find((s) => s.code === "LCS1")!.id;

    // Coordinator cannot directly control equipment
    expect(() => {
      service.setEquipmentSystems(authSession, 5, eqId, {
        systems: [{ systemId: mcsId, controlRole: "primary" }],
      });
    }).toThrowError(/Only controller systems can directly control equipment/);

    // Controller can control equipment
    const setRes = service.setEquipmentSystems(authSession, 5, eqId, {
      systems: [{ systemId: lcsId, controlRole: "primary" }],
    });
    expect(setRes.data.project.revision).toBe(6);
    expect(setRes.data.logistics.equipment[0].controlSystems).toEqual([
      { systemId: lcsId, controlRole: "primary" },
    ]);
  });

  it("enforces coordinator DAG rules and prevents cycles", () => {
    const db = createTestDatabase();
    const { authSession, now } = setupProjectWithSession(db);
    const service = new LogisticsService(db, { clock: () => now });

    const processRes = service.createProcess(authSession, 1, {
      code: "P1",
      name: "Process 1",
    });
    const processId = processRes.data.logistics.processes[0].id;

    const s1Res = service.createSystem(authSession, 2, {
      code: "MCS_TOP",
      name: "Top MCS",
      systemType: "mcs",
      layer: "coordinator",
      scope: "project",
    });
    const s1Id = s1Res.data.logistics.systems[0].id;

    const s2Res = service.createSystem(authSession, 3, {
      code: "MCS_SUB",
      name: "Sub Coordinator",
      systemType: "mcs",
      layer: "coordinator",
      scope: "processes",
      processIds: [processId],
    });
    const s2Id = s2Res.data.logistics.systems.find((s) => s.code === "MCS_SUB")!.id;

    const s3Res = service.createSystem(authSession, 4, {
      code: "ACS",
      name: "ACS Controller",
      systemType: "acs",
      layer: "controller",
      scope: "processes",
      processIds: [processId],
    });
    const s3Id = s3Res.data.logistics.systems.find((s) => s.code === "ACS")!.id;

    // S1 coordinates S2
    service.setCoordinatedSystems(authSession, 5, s1Id, { targetSystemIds: [s2Id] });
    // S2 coordinates S3
    service.setCoordinatedSystems(authSession, 6, s2Id, { targetSystemIds: [s3Id] });

    // S2 cannot coordinate S1 (would create cycle S1 -> S2 -> S1)
    expect(() => {
      service.setCoordinatedSystems(authSession, 7, s2Id, { targetSystemIds: [s3Id, s1Id] });
    }).toThrowError(/cycle/);

    // Controller cannot coordinate systems
    expect(() => {
      service.setCoordinatedSystems(authSession, 7, s3Id, { targetSystemIds: [s1Id] });
    }).toThrowError(/Only coordinator layer systems can coordinate other systems/);
  });

  it("integrates with TaskFieldProjectService snapshot and mutation enrichment", () => {
    const db = createTestDatabase();
    const { project, authSession, now } = setupProjectWithSession(db);
    const logisticsService = new LogisticsService(db, { clock: () => now });
    const projectService = new TaskFieldProjectService(db, {
      clock: () => now,
    });

    // Add logistics data
    logisticsService.createProcess(authSession, 1, { code: "PROC_A", name: "Process A" });

    // Verify getReadonlySnapshot contains logistics
    const snapshot = projectService.getReadonlySnapshot(project.publicId);
    expect(snapshot).toBeDefined();
    expect(snapshot!.data.logistics).toBeDefined();
    expect(snapshot!.data.logistics!.processes.length).toBe(1);
    expect(snapshot!.data.logistics!.processes[0].code).toBe("PROC_A");

    // Verify task mutation preserves logistics
    const taskMutation = projectService.createTask(authSession, 2, {
      name: "New Task",
      type: "task",
      scheduleMode: "auto",
      start: "2026-10-01",
      end: "2026-10-05",
      duration: 3,
      progress: 0,
    });
    expect(taskMutation.data.logistics).toBeDefined();
    expect(taskMutation.data.logistics!.processes.length).toBe(1);
  });
});

describe("Issue #917 optional equipment primary process", () => {
  it("registers unit/fleet without processes and preserves omission versus null across late assignment", () => {
    const db = createTestDatabase();
    try {
      const { authSession, now, project } = setupProjectWithSession(db);
      const service = new LogisticsService(db, { clock: () => now });
      const unit = service.createEquipment(authSession, 1, { code: "UNIT", name: "Unit", equipmentType: "amr", managementUnit: "unit" });
      const unitId = unit.data.operation.targetPublicId!;
      expect(unit.data.logistics.equipment[0]).toMatchObject({ id: unitId, processId: null, quantity: 1 });
      const fleet = service.createEquipment(authSession, 2, { processId: null, code: "FLEET", name: "Fleet", equipmentType: "amr", managementUnit: "fleet", quantity: 7 });
      expect(fleet.data.logistics.equipment.find(e => e.code === "FLEET")).toMatchObject({ processId: null, quantity: 7 });
      for (const table of ["project_processes", "project_work_areas", "tasks", "logistics_targets"]) {
        expect(db.prepare(`SELECT count(*) FROM ${table} WHERE project_id=?`).pluck().get(project.id)).toBe(0);
      }
      const first = service.createProcess(authSession, 3, { name: "A" }).data.operation.targetPublicId!;
      const second = service.createProcess(authSession, 4, { name: "B" }).data.operation.targetPublicId!;
      const updated = (revision: number, input: Parameters<LogisticsService["updateEquipment"]>[3]) => service.updateEquipment(authSession, revision, unitId, input).data.logistics.equipment.find(e => e.id === unitId)!;
      expect(updated(5, { processId: first }).processId).toBe(first);
      expect(updated(6, { name: "Renamed" }).processId).toBe(first);
      expect(updated(7, { processId: second }).processId).toBe(second);
      expect(updated(8, { processId: null }).processId).toBeNull();
      expect(updated(9, { processId: first }).processId).toBe(first);
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally { db.close(); }
  });

  it("rejects new inactive and foreign process references while retaining an existing inactive assignment", () => {
    const db = createTestDatabase();
    try {
      const { authSession, now, project } = setupProjectWithSession(db);
      const service = new LogisticsService(db, { clock: () => now });
      const id = service.createProcess(authSession, 1, { name: "Inactive later" }).data.operation.targetPublicId!;
      const equipment = service.createEquipment(authSession, 2, { processId: id, code: "E", name: "E", equipmentType: "amr", managementUnit: "unit" }).data.logistics.equipment[0];
      service.updateProcess(authSession, 3, id, { active: false });
      expect(service.updateEquipment(authSession, 4, equipment.id, { processId: id, name: "Retained" }).data.logistics.equipment[0].processId).toBe(id);
      const input = { code: "NEW", name: "New", equipmentType: "amr", managementUnit: "unit" as const };
      expect(() => service.createEquipment(authSession, 5, { ...input, processId: id })).toThrowError(expect.objectContaining({ code: "PROCESS_INACTIVE" }));
      const nullable = service.createEquipment(authSession, 5, input).data.logistics.equipment.find(e => e.code === "NEW")!;
      expect(() => service.updateEquipment(authSession, 6, nullable.id, { processId: id, name: "ROLLBACK" })).toThrowError(expect.objectContaining({ code: "PROCESS_INACTIVE" }));
      expect(() => service.updateEquipment(authSession, 6, nullable.id, { processId: "11111111-1111-4111-8111-111111111111" })).toThrow();
      expect(new ProjectRepository(db).findById(project.id)!.revision).toBe(6);
      expect(service.getLogisticsDto(project.id).equipment.find(e => e.id === nullable.id)).toMatchObject({ processId: null, name: "New" });
    } finally { db.close(); }
  });
});

describe("Issue #917 independent equipment relationships", () => {
  it("retains multi-process WorkAreas, owner/System/direct Task links when primary process is assigned and cleared", () => {
    const db = createTestDatabase();
    try {
      const { authSession: auth, now, project } = setupProjectWithSession(db);
      const service = new LogisticsService(db, { clock: () => now }), repo = new LogisticsRepository(db);
      const revision = () => new ProjectRepository(db).findById(project.id)!.revision;
      const a = service.createProcess(auth, revision(), { name: "A" }).data.operation.targetPublicId!;
      const b = service.createProcess(auth, revision(), { name: "B" }).data.operation.targetPublicId!;
      const area = (owner: string) => service.mutateWorkArea(auth, revision(), "create", owner, { name: "Area" }).data.operation.targetPublicId!;
      const links = [{ processId: a, workAreaId: area(a) }, { processId: b, workAreaId: area(b) }];
      const catalogRevision = new ProcessContextRepository(db).revision();
      const e = service.createEquipment(auth, revision(), { code: "INDEPENDENT", name: "Fleet", equipmentType: "amr", managementUnit: "fleet", quantity: 9, workAreaLinks: links, processCatalogRevision: catalogRevision }).data.logistics.equipment[0];
      expect(e).toMatchObject({ processId: null, workAreaLinks: expect.arrayContaining(links) });
      const system = repo.insertSystem({ projectId: project.id, publicId: randomUUID(), code: "S", name: "S", systemType: "acs", layer: "controller", scope: "project", now: now.toISOString() });
      service.setEquipmentSystems(auth, revision(), e.id, { systems: [{ systemId: system.publicId, controlRole: "primary" }] });
      const person = new ResourceCatalogRepository(db).insertResource({ publicId: randomUUID(), name: "Owner", code: "OWNER", description: "", now: now.toISOString() });
      service.setEquipmentResourceRoles(auth, revision(), e.id, { roles: [{ resourceId: person.publicId, role: "owner", isPrimary: true }] });
      const task = new ScheduleRepository(db).insertTask({ projectId: project.id, publicId: randomUUID(), externalId: "TASK", name: "Task", type: "task", parentId: null, scheduleMode: "auto", requestedStart: "2026-09-28", startDate: "2026-09-28", endDate: "2026-09-28", duration: 1, progress: 0, sortOrder: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() });
      service.replaceTaskLogisticsLinks(auth, revision(), task.publicId, { equipmentLinks: [{ equipmentId: e.id, scope: "self" }], systemLinks: [] });
      const relationships = () => ["equipment_project_work_areas", "project_equipment_systems", "project_equipment_resource_roles", "task_equipment_links"].map(table => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
      const before = relationships();
      for (const processId of [b, null, a, null]) service.updateEquipment(auth, revision(), e.id, { processId });
      expect(relationships()).toEqual(before);
      expect(service.getLogisticsDto(project.id).equipment[0]).toMatchObject({ processId: null, quantity: 9, controlSystems: [{ systemId: system.publicId, controlRole: "primary" }], resourceRoles: [expect.objectContaining({ resourceId: person.publicId })] });
      const rev = revision();
      expect(() => service.updateEquipment(auth, rev, e.id, { name: "ROLLBACK", workAreaLinks: [{ processId: b, workAreaId: links[0].workAreaId }], processCatalogRevision: catalogRevision })).toThrow();
      expect(revision()).toBe(rev); expect(relationships()).toEqual(before);
      expect(db.prepare("SELECT COUNT(*) FROM logistics_targets").pluck().get()).toBe(0);
    } finally { db.close(); }
  });

  it("fails explicitly for a corrupt nonnull primary process rather than exporting it as unassigned", () => {
    const db = createTestDatabase();
    try {
      const { authSession, now, project } = setupProjectWithSession(db);
      const service = new LogisticsService(db, { clock: () => now });
      service.createEquipment(authSession, 1, { code: "BROKEN", name: "Broken", equipmentType: "amr", managementUnit: "unit" });
      db.pragma("foreign_keys=OFF");
      db.prepare("UPDATE project_equipment SET process_id=999999 WHERE project_id=?").run(project.id);
      db.pragma("foreign_keys=ON");
      expect(() => service.getLogisticsDto(project.id)).toThrowError(expect.objectContaining({ code: "EQUIPMENT_PROCESS_REFERENCE_INVALID" }));
    } finally { db.close(); }
  });
});
