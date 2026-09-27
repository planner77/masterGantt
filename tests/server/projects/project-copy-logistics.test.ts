import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";
import { hashSessionToken } from "../../../src/server/security/session-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { resolveProjectWorkingCalendar } from "../../../src/server/calendars/calendar-resolution-core";
import { recalculateHierarchy, recalculateFinishStartDependencies } from "../../../src/domain/scheduling";

const migrationsDirectory = join(process.cwd(), "db", "migrations");

function fixedPasswordHash(marker: number): PasswordHashRecord {
  return {
    algorithm: "scrypt",
    salt: Buffer.alloc(16, marker),
    hash: Buffer.alloc(32, marker + 1),
    n: 32768,
    r: 8,
    p: 3,
    keyLength: 32,
  };
}

describe("ProjectCopyService with Logistics (Issue #189 LG-06)", () => {
  it("copies logistics processes, systems, equipment, roles, and task links into independent IDs", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });

    try {
      const sourceService = new ProjectService(database, {
        clock: () => new Date("2026-09-27T00:00:00.000Z"),
        hashPassword: async () => fixedPasswordHash(1),
        generateSessionToken: () => ({ rawToken: "src-token", tokenHash: hashSessionToken("src-token") }),
      });

      const logisticsService = new LogisticsService(database, {
        clock: () => new Date("2026-09-27T00:00:00.000Z"),
      });

      const resourceCatalog = new ResourceCatalogRepository(database);

      // 1. 글로벌 리소스 2명 등록 (r1: 홍길동 PI/Owner, r2: 김철수 Dev)
      const res1 = resourceCatalog.insertResource({
        publicId: randomUUID(),
        code: "RES-01",
        name: "홍길동",
        description: "PI 및 책임자",
        now: "2026-09-27T00:00:00.000Z",
      });
      const res2 = resourceCatalog.insertResource({
        publicId: randomUUID(),
        code: "RES-02",
        name: "김철수",
        description: "개발자",
        now: "2026-09-27T00:00:00.000Z",
      });

      // 2. 소스 프로젝트 생성
      const created = await sourceService.create({
        name: "스마트 물류센터 원본",
        description: "물류 복사 원본 프로젝트",
        editPassword: "password123",
      });
      const sourcePublicId = created.response.data.project.publicId;
      const sourceAuth = sourceService.authorize(sourcePublicId, "src-token");
      expect(sourceAuth.kind).toBe("authorized");
      if (sourceAuth.kind !== "authorized") throw new Error("Source auth failed");

      // 3. 소스 WBS 생성: Summary(S1) -> Task(T1, T2) 및 Milestone(M1)
      const now = "2026-09-27T00:00:00.000Z";
      const sourceProjectId = (database.prepare("SELECT id FROM projects WHERE public_id = ?").get(sourcePublicId) as { id: number }).id;

      const s1 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES(?, 'S1', ?, '전체 공정 Summary', 'summary', 'auto', NULL, '2026-11-02', '2026-11-12', 9, 60, NULL, 0, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), now, now).lastInsertRowid,
      );

      const t1 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES(?, 'T1', ?, '보관 및 입고 작업', 'task', 'auto', '2026-11-02', '2026-11-02', '2026-11-05', 4, 80, ?, 0, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), s1, now, now).lastInsertRowid,
      );

      const t2 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES(?, 'T2', ?, '이송 및 분류 작업', 'task', 'auto', '2026-11-06', '2026-11-06', '2026-11-11', 4, 40, ?, 1, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), s1, now, now).lastInsertRowid,
      );

      const m1 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES(?, 'M1', ?, '시운전 마일스톤', 'milestone', 'auto', '2026-11-12', '2026-11-12', '2026-11-12', 0, 0, ?, 2, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), s1, now, now).lastInsertRowid,
      );

      // 의존성 링크: T1 -> T2 -> M1
      database
        .prepare(`INSERT INTO links(public_id, project_id, predecessor_task_id, successor_task_id, type, lag, created_at, updated_at) VALUES(?, ?, ?, ?, 'FS', 0, ?, ?)`)
        .run(randomUUID(), sourceProjectId, t1, t2, now, now);
      database
        .prepare(`INSERT INTO links(public_id, project_id, predecessor_task_id, successor_task_id, type, lag, created_at, updated_at) VALUES(?, ?, ?, ?, 'FS', 0, ?, ?)`)
        .run(randomUUID(), sourceProjectId, t2, m1, now, now);

      // 소스 WBS 일정 정규화 (recalculatePersistedHierarchy 통과 보장)
      const calendar = resolveProjectWorkingCalendar(database, sourceProjectId);
      const scheduleRepo = new ScheduleRepository(database);
      const srcTasks = scheduleRepo.listTasks(sourceProjectId);
      const srcLinks = scheduleRepo.listLinks(sourceProjectId);
      const taskMap = new Map(srcTasks.map((t) => [t.id, t.externalId]));
      const taskDtoList = srcTasks.map((t) => ({
        taskId: t.publicId,
        externalId: t.externalId,
        name: t.name,
        type: t.type,
        scheduleMode: t.scheduleMode,
        requestedStart: t.requestedStart,
        start: t.startDate,
        end: t.endDate,
        duration: t.duration,
        progress: t.progress,
        parentExternalId: t.parentId ? taskMap.get(t.parentId) ?? null : null,
        siblingOrder: t.sortOrder,
      }));
      const linkDtoList = srcLinks.map((l) => ({
        id: l.publicId,
        predecessorExternalId: taskMap.get(l.predecessorTaskId)!,
        successorExternalId: taskMap.get(l.successorTaskId)!,
        type: l.type,
        lag: l.lag,
      }));
      const derived = recalculateHierarchy(
        recalculateFinishStartDependencies(
          recalculateHierarchy(taskDtoList, calendar),
          linkDtoList,
          calendar,
        ).tasks,
        calendar,
      );
      for (const d of derived) {
        database.prepare(`UPDATE tasks SET start_date = ?, end_date = ?, duration = ?, progress = ? WHERE public_id = ?`)
          .run(d.start, d.end, d.duration, d.progress, d.taskId);
      }

      // 리소스 배정: T1에 r2 배정
      resourceCatalog.replaceTaskAssignments({
        projectId: sourceProjectId,
        taskId: t1,
        targets: [
          {
            assignmentPublicId: randomUUID(),
            kind: "resource",
            internalId: res2.id,
            publicId: res2.publicId,
            assignmentStart: "2026-11-02",
            assignmentEnd: "2026-11-05",
            allocationPercent: 50,
          },
        ],
        now,
      });

      // 4. 물류 마스터 생성
      // 4.1 공정: P1(상위) -> P2(하위)
      const p1Res = logisticsService.createProcess(sourceAuth.authorization, 1, {
        code: "P1",
        name: "메인 물류공정",
        sortOrder: 1,
      });
      const p1PublicId = p1Res.data.logistics.processes.find((p) => p.code === "P1")!.id;

      const p2Res = logisticsService.createProcess(sourceAuth.authorization, 2, {
        code: "P2",
        name: "하위 입고공정",
        parentProcessId: p1PublicId,
        sortOrder: 2,
      });
      const p2PublicId = p2Res.data.logistics.processes.find((p) => p.code === "P2")!.id;

      // 4.2 물류 시스템: SCS(Controller), ACS(Controller), MCS(Coordinator)
      const scsRes = logisticsService.createSystem(sourceAuth.authorization, 3, {
        code: "SCS",
        name: "스토커 제어 시스템",
        systemType: "scs",
        layer: "controller",
        scope: "processes",
      });
      const scsPublicId = scsRes.data.logistics.systems.find((s) => s.code === "SCS")!.id;

      const acsRes = logisticsService.createSystem(sourceAuth.authorization, 4, {
        code: "ACS",
        name: "AGV 제어 시스템",
        systemType: "acs",
        layer: "controller",
        scope: "processes",
      });
      const acsPublicId = acsRes.data.logistics.systems.find((s) => s.code === "ACS")!.id;

      const mcsRes = logisticsService.createSystem(sourceAuth.authorization, 5, {
        code: "MCS",
        name: "통합 조율 시스템",
        systemType: "mcs",
        layer: "coordinator",
        scope: "project",
      });
      const mcsPublicId = mcsRes.data.logistics.systems.find((s) => s.code === "MCS")!.id;

      // 시스템 조율 링크: MCS -> SCS, ACS
      logisticsService.setCoordinatedSystems(sourceAuth.authorization, 6, mcsPublicId, {
        targetSystemIds: [scsPublicId, acsPublicId],
      });

      // 시스템 담당자 배정: MCS에 r1(PI), SCS에 r2(developer)
      logisticsService.setSystemResourceRoles(sourceAuth.authorization, 7, mcsPublicId, {
        roles: [{ resourceId: res1.publicId, role: "pi", isPrimary: true }],
      });
      logisticsService.setSystemResourceRoles(sourceAuth.authorization, 8, scsPublicId, {
        roles: [{ resourceId: res2.publicId, role: "developer", isPrimary: false }],
      });

      // 4.3 설비: Stocker(unit1), AGV(fleet4), AMR(fleet3)
      const eqStockerRes = logisticsService.createEquipment(sourceAuth.authorization, 9, {
        processId: p1PublicId,
        code: "STK-01",
        name: "Stocker unit1",
        equipmentType: "stocker",
        managementUnit: "unit",
        quantity: 1,
      });
      const stkPublicId = eqStockerRes.data.logistics.equipment.find((e) => e.code === "STK-01")!.id;

      const eqAgvRes = logisticsService.createEquipment(sourceAuth.authorization, 10, {
        processId: p2PublicId,
        code: "AGV-01",
        name: "AGV fleet4",
        equipmentType: "agv",
        managementUnit: "fleet",
        quantity: 4,
      });
      const agvPublicId = eqAgvRes.data.logistics.equipment.find((e) => e.code === "AGV-01")!.id;

      // 설비-시스템 매핑: Stocker -> SCS, AGV -> ACS
      logisticsService.setEquipmentSystems(sourceAuth.authorization, 11, stkPublicId, {
        systems: [{ systemId: scsPublicId, controlRole: "primary" }],
      });
      logisticsService.setEquipmentSystems(sourceAuth.authorization, 12, agvPublicId, {
        systems: [{ systemId: acsPublicId, controlRole: "primary" }],
      });

      // 설비 담당자 배정: Stocker에 r1(owner)
      logisticsService.setEquipmentResourceRoles(sourceAuth.authorization, 13, stkPublicId, {
        roles: [{ resourceId: res1.publicId, role: "owner", isPrimary: true }],
      });

      // 4.4 작업 물류 연결
      const s1PublicId = (database.prepare("SELECT public_id FROM tasks WHERE id = ?").get(s1) as { public_id: string }).public_id;
      const t1PublicId = (database.prepare("SELECT public_id FROM tasks WHERE id = ?").get(t1) as { public_id: string }).public_id;
      const m1PublicId = (database.prepare("SELECT public_id FROM tasks WHERE id = ?").get(m1) as { public_id: string }).public_id;

      // Summary(S1)에 Stocker subtree 연결
      logisticsService.replaceTaskLogisticsLinks(sourceAuth.authorization, 14, s1PublicId, {
        equipmentLinks: [{ equipmentId: stkPublicId, scope: "subtree" }],
        systemLinks: [],
      });

      // T1에 AGV self 연결 및 SCS self 연결
      logisticsService.replaceTaskLogisticsLinks(sourceAuth.authorization, 15, t1PublicId, {
        equipmentLinks: [{ equipmentId: agvPublicId, scope: "self" }],
        systemLinks: [{ systemId: scsPublicId, scope: "self" }],
      });

      // M1에 MCS self 연결
      logisticsService.replaceTaskLogisticsLinks(sourceAuth.authorization, 16, m1PublicId, {
        equipmentLinks: [],
        systemLinks: [{ systemId: mcsPublicId, scope: "self" }],
      });

      const sourceLatestSnapshot = sourceService.getReadonlySnapshot(sourcePublicId);
      const sourceLatestRev = sourceLatestSnapshot!.data.project.revision; // 17

      // 5. 프로젝트 복사 실행
      const copyService = new ProjectCopyService(database, {
        clock: () => new Date("2026-09-27T01:00:00.000Z"),
        hashPassword: async () => fixedPasswordHash(9),
        generateSessionToken: () => ({ rawToken: "copy-token", tokenHash: hashSessionToken("copy-token") }),
      });

      const copied = await copyService.copy(sourceAuth.authorization, sourceLatestRev, {
        name: "스마트 물류센터 복사본",
        description: "복사된 프로젝트",
        editPassword: "copyPassword123",
        resetProgress: true, // resetProgress 검증 포함
      });

      // 6. 복사본 검증
      const copyData = copied.response.data;
      expect(copyData.project.name).toBe("스마트 물류센터 복사본");
      expect(copyData.project.revision).toBe(1);
      expect(copyData.project.status).toBe("planned");
      expect(copyData.operation.counts).toMatchObject({
        tasks: 4,
        links: 2,
        assignments: 1,
        processes: 2,
        equipment: 2,
        systems: 3,
      });

      // 6.1 ID 독립성 검증: 새 project_id, 새 public_id
      const copyPublicId = copyData.project.publicId;
      expect(copyPublicId).not.toBe(sourcePublicId);

      const copyProjectId = (database.prepare("SELECT id FROM projects WHERE public_id = ?").get(copyPublicId) as { id: number }).id;
      expect(copyProjectId).not.toBe(sourceProjectId);

      // 원본 local ID들이 복사본에 남아있지 않음을 DB 쿼리로 직접 검증
      const sourceTaskPublicIds = database.prepare("SELECT public_id FROM tasks WHERE project_id = ?").pluck().all(sourceProjectId) as string[];
      const copiedTaskPublicIds = database.prepare("SELECT public_id FROM tasks WHERE project_id = ?").pluck().all(copyProjectId) as string[];
      for (const id of copiedTaskPublicIds) {
        expect(sourceTaskPublicIds).not.toContain(id);
      }

      const sourceProcessPublicIds = database.prepare("SELECT public_id FROM project_processes WHERE project_id = ?").pluck().all(sourceProjectId) as string[];
      const copiedProcessPublicIds = database.prepare("SELECT public_id FROM project_processes WHERE project_id = ?").pluck().all(copyProjectId) as string[];
      for (const id of copiedProcessPublicIds) {
        expect(sourceProcessPublicIds).not.toContain(id);
      }

      const sourceEquipPublicIds = database.prepare("SELECT public_id FROM project_equipment WHERE project_id = ?").pluck().all(sourceProjectId) as string[];
      const copiedEquipPublicIds = database.prepare("SELECT public_id FROM project_equipment WHERE project_id = ?").pluck().all(copyProjectId) as string[];
      for (const id of copiedEquipPublicIds) {
        expect(sourceEquipPublicIds).not.toContain(id);
      }

      const sourceSysPublicIds = database.prepare("SELECT public_id FROM project_logistics_systems WHERE project_id = ?").pluck().all(sourceProjectId) as string[];
      const copiedSysPublicIds = database.prepare("SELECT public_id FROM project_logistics_systems WHERE project_id = ?").pluck().all(copyProjectId) as string[];
      for (const id of copiedSysPublicIds) {
        expect(sourceSysPublicIds).not.toContain(id);
      }

      // 6.2 글로벌 리소스 ID 동일 참조 검증
      const copiedEqRoles = database.prepare("SELECT resource_id FROM project_equipment_resource_roles WHERE project_id = ?").pluck().all(copyProjectId) as number[];
      expect(copiedEqRoles).toContain(res1.id);

      const copiedSysRoles = database.prepare("SELECT resource_id FROM project_system_resource_roles WHERE project_id = ?").pluck().all(copyProjectId) as number[];
      expect(copiedSysRoles).toContain(res1.id);
      expect(copiedSysRoles).toContain(res2.id);

      const copiedAssignments = database.prepare("SELECT resource_id FROM task_assignments WHERE project_id = ?").pluck().all(copyProjectId) as number[];
      expect(copiedAssignments).toContain(res2.id);

      // 6.3 resetProgress 검증: leaf task는 0, summary는 재계산됨
      const copiedTasks = copyData.tasks;
      const copiedT1 = copiedTasks.find((t) => t.externalId === "T1");
      const copiedT2 = copiedTasks.find((t) => t.externalId === "T2");
      const copiedS1 = copiedTasks.find((t) => t.externalId === "S1");
      expect(copiedT1?.progress).toBe(0);
      expect(copiedT2?.progress).toBe(0);
      expect(copiedS1?.progress).toBe(0);

      // 6.4 물류 데이터 aggregate 및 연결 검증
      const copiedLogistics = copyData.logistics!;
      expect(copiedLogistics.processes).toHaveLength(2);
      expect(copiedLogistics.systems).toHaveLength(3);
      expect(copiedLogistics.equipment).toHaveLength(2);

      // 공정 계층 검증: P2의 부모가 P1
      const copiedP1 = copiedLogistics.processes.find((p) => p.code === "P1")!;
      const copiedP2 = copiedLogistics.processes.find((p) => p.code === "P2")!;
      expect(copiedP2.parentProcessId).toBe(copiedP1.id);

      // 시스템 조율 링크 검증: MCS -> SCS, ACS
      const copiedMCS = copiedLogistics.systems.find((s) => s.code === "MCS")!;
      const copiedSCS = copiedLogistics.systems.find((s) => s.code === "SCS")!;
      const copiedACS = copiedLogistics.systems.find((s) => s.code === "ACS")!;
      expect(copiedMCS.coordinatedSystemIds).toContain(copiedSCS.id);
      expect(copiedMCS.coordinatedSystemIds).toContain(copiedACS.id);

      // 설비-시스템 매핑 검증
      const copiedStocker = copiedLogistics.equipment.find((e) => e.code === "STK-01")!;
      expect(copiedStocker.controlSystems).toEqual([{ systemId: copiedSCS.id, controlRole: "primary" }]);
      expect(copiedStocker.resourceRoles[0].resourceId).toBe(res1.publicId);

      // 태스크 물류 연결 검증
      expect(copiedLogistics.taskEquipmentLinks).toHaveLength(2); // S1 -> Stocker(subtree), T1 -> AGV(self)
      expect(copiedLogistics.taskSystemLinks).toHaveLength(2); // T1 -> SCS(self), M1 -> MCS(self)

      // 7. 삭제 독립성 검증:
      // 7.1 복사본 삭제 시 원본 및 글로벌 리소스 보존
      const copyDeleted = database.prepare("DELETE FROM projects WHERE id = ?").run(copyProjectId);
      expect(copyDeleted.changes).toBe(1);

      // 원본 프로젝트 및 물류 데이터 건재함 확인
      const sourceAfterCopyDelete = logisticsService.getLogisticsDto(sourceProjectId);
      expect(sourceAfterCopyDelete?.equipment).toHaveLength(2);
      expect(sourceAfterCopyDelete?.systems).toHaveLength(3);
      expect(sourceAfterCopyDelete?.processes).toHaveLength(2);

      // 글로벌 리소스 건재함 확인
      expect(resourceCatalog.findResourceByPublicId(res1.publicId)).toBeDefined();
      expect(resourceCatalog.findResourceByPublicId(res2.publicId)).toBeDefined();
    } finally {
      database.close();
    }
  });

  it("warns about inactive masters and resources during project copy", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });

    try {
      const sourceService = new ProjectService(database, {
        clock: () => new Date("2026-09-27T00:00:00.000Z"),
        hashPassword: async () => fixedPasswordHash(1),
        generateSessionToken: () => ({ rawToken: "src-token", tokenHash: hashSessionToken("src-token") }),
      });

      const logisticsService = new LogisticsService(database, {
        clock: () => new Date("2026-09-27T00:00:00.000Z"),
      });

      const resourceCatalog = new ResourceCatalogRepository(database);

      // 비활성 리소스 등록
      const inactiveRes = resourceCatalog.insertResource({
        publicId: randomUUID(),
        code: "RES-INACTIVE",
        name: "퇴사자",
        description: "비활성",
        now: "2026-09-27T00:00:00.000Z",
      });
      database.prepare("UPDATE resources SET active = 0 WHERE id = ?").run(inactiveRes.id);

      const created = await sourceService.create({
        name: "비활성 포함 원본",
        description: "",
        editPassword: "password123",
      });
      const sourcePublicId = created.response.data.project.publicId;
      const sourceAuth = sourceService.authorize(sourcePublicId, "src-token");
      if (sourceAuth.kind !== "authorized") throw new Error("Auth failed");

      // 공정 생성 후 비활성화
      const pRes = logisticsService.createProcess(sourceAuth.authorization, 1, {
        code: "P-OFF",
        name: "비활성 공정",
      });
      const pId = pRes.data.logistics.processes[0].id;
      logisticsService.updateProcess(sourceAuth.authorization, 2, pId, { active: false });

      const copyService = new ProjectCopyService(database, {
        clock: () => new Date("2026-09-27T01:00:00.000Z"),
        hashPassword: async () => fixedPasswordHash(9),
        generateSessionToken: () => ({ rawToken: "copy-token", tokenHash: hashSessionToken("copy-token") }),
      });

      const copied = await copyService.copy(sourceAuth.authorization, 3, {
        name: "복사본",
        description: "",
        editPassword: "password123",
      });

      expect(copied.response.data.warnings).toContain("비활성화된 공정·설비·시스템 마스터가 원본 관계를 보존하여 복사되었습니다.");
    } finally {
      database.close();
    }
  });
});