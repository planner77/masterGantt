import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";
import { hashSessionToken } from "../../../src/server/security/session-core";

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

describe("ProjectTemplateService (Issue #195)", () => {
  it("creates template from project, lists/updates/duplicates, and instantiates into new project with recalculated dates and logistics", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });

    try {
      const clockDate = new Date("2026-09-27T00:00:00.000Z");
      const projectService = new ProjectService(database, {
        clock: () => clockDate,
        hashPassword: async () => fixedPasswordHash(1),
        generateSessionToken: () => ({ rawToken: "src-token", tokenHash: hashSessionToken("src-token") }),
      });

      const logisticsService = new LogisticsService(database, {
        clock: () => clockDate,
      });

      const templateService = new ProjectTemplateService(database, {
        clock: () => clockDate,
        hashPassword: async () => fixedPasswordHash(2),
        generateSessionToken: () => ({ rawToken: "inst-token", tokenHash: hashSessionToken("inst-token") }),
      });

      const resourceCatalog = new ResourceCatalogRepository(database);

      // 1. 글로벌 리소스 1명 등록
      const res1 = resourceCatalog.insertResource({
        publicId: randomUUID(),
        code: "RES-TEMP-01",
        name: "템플릿담당자",
        description: "테스트 리소스",
        now: "2026-09-27T00:00:00.000Z",
      });

      // 2. 원본 프로젝트 생성
      const created = await projectService.create({
        name: "물류 표준 템플릿 원본",
        description: "템플릿 등록용 원본 프로젝트",
        editPassword: "password123",
      });
      const sourcePublicId = created.response.data.project.publicId;
      const sourceAuth = projectService.authorize(sourcePublicId, "src-token");
      expect(sourceAuth.kind).toBe("authorized");
      if (sourceAuth.kind !== "authorized") throw new Error("Source auth failed");

      const sourceProjectId = (database.prepare("SELECT id FROM projects WHERE public_id = ?").get(sourcePublicId) as { id: number }).id;
      const now = "2026-09-27T00:00:00.000Z";

      // 3. WBS 태스크 삽입:
      // S1 (Summary: 2026-10-05 ~ 2026-10-09)
      //  - T1 (Task: 2026-10-05 ~ 2026-10-06, 2일, progress 50%)
      //  - T2 (Task: 2026-10-07 ~ 2026-10-08, 2일, progress 100%)
      //  - M1 (Milestone: 2026-10-09, 0일, progress 0%)
      const s1 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES (?, 'task-s1', ?, 'Summary 공정', 'summary', 'auto', NULL, '2026-10-05', '2026-10-09', 5, 50, NULL, 1, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), now, now).lastInsertRowid,
      );

      const t1 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES (?, 'task-t1', ?, '설비 설계', 'task', 'auto', '2026-10-05', '2026-10-05', '2026-10-06', 2, 50, ?, 1, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), s1, now, now).lastInsertRowid,
      );

      const t2 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES (?, 'task-t2', ?, '설비 설치', 'task', 'auto', '2026-10-07', '2026-10-07', '2026-10-08', 2, 100, ?, 2, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), s1, now, now).lastInsertRowid,
      );

      const m1 = Number(
        database
          .prepare(
            `INSERT INTO tasks(project_id, external_id, public_id, name, type, schedule_mode, requested_start, start_date, end_date, duration, progress, parent_id, sort_order, created_at, updated_at)
             VALUES (?, 'task-m1', ?, '설비 가동 개시', 'milestone', 'auto', '2026-10-09', '2026-10-09', '2026-10-09', 0, 0, ?, 3, ?, ?)`,
          )
          .run(sourceProjectId, randomUUID(), s1, now, now).lastInsertRowid,
      );

      // 의존관계: T1 -> T2 (FS), T2 -> M1 (FS)
      database
        .prepare(
          `INSERT INTO links(public_id, project_id, predecessor_task_id, successor_task_id, type, lag, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'FS', 0, ?, ?), (?, ?, ?, ?, 'FS', 0, ?, ?)`,
        )
        .run(randomUUID(), sourceProjectId, t1, t2, now, now, randomUUID(), sourceProjectId, t2, m1, now, now);

      // 리소스 배정: T1에 res1 배정
      resourceCatalog.replaceTaskAssignments({
        projectId: sourceProjectId,
        taskId: t1,
        targets: [
          {
            assignmentPublicId: randomUUID(),
            kind: "resource",
            internalId: res1.id,
            publicId: res1.publicId,
            assignmentStart: "2026-10-05",
            assignmentEnd: "2026-10-06",
            allocationPercent: 80,
          },
        ],
        now,
      });

      // 물류 데이터 등록: 프로세스, 시스템, 장비
      const p1Res = logisticsService.createProcess(sourceAuth.authorization, 1, {
        code: "INB",
        name: "입고 프로세스",
      });
      const p1PublicId = p1Res.data.logistics.processes[0].id;

      const sys1Res = logisticsService.createSystem(sourceAuth.authorization, 2, {
        code: "WMS",
        name: "창고관리시스템",
        systemType: "scs",
        layer: "controller",
        scope: "processes",
        processIds: [p1PublicId],
      });
      const sys1PublicId = sys1Res.data.logistics.systems[0].id;

      logisticsService.setSystemResourceRoles(sourceAuth.authorization, 3, sys1PublicId, {
        roles: [{ resourceId: res1.publicId, role: "developer", isPrimary: false }],
      });

      const eq1Res = logisticsService.createEquipment(sourceAuth.authorization, 4, {
        code: "CONV-01",
        name: "입고 컨베이어",
        equipmentType: "conveyor",
        managementUnit: "unit",
        processId: p1PublicId,
        quantity: 1,
      });
      const eq1PublicId = eq1Res.data.logistics.equipment[0].id;

      logisticsService.setEquipmentSystems(sourceAuth.authorization, 5, eq1PublicId, {
        systems: [{ systemId: sys1PublicId, controlRole: "primary" }],
      });

      logisticsService.setEquipmentResourceRoles(sourceAuth.authorization, 6, eq1PublicId, {
        roles: [{ resourceId: res1.publicId, role: "owner", isPrimary: true }],
      });

      // 태스크-물류 링크 연결: T1 -> CONV-01, T1 -> WMS
      const t1PublicId = (database.prepare("SELECT public_id FROM tasks WHERE id = ?").get(t1) as { public_id: string }).public_id;
      logisticsService.replaceTaskLogisticsLinks(sourceAuth.authorization, 7, t1PublicId, {
        equipmentLinks: [{ equipmentId: eq1PublicId, scope: "self" }],
        systemLinks: [{ systemId: sys1PublicId, scope: "self" }],
      });

      // 4. 프로젝트로부터 템플릿 생성 테스트
      const template = templateService.createTemplateFromProject(
        sourceAuth.authorization,
        8, // revision
        {
          name: "표준 입고 자동화 템플릿",
          description: "물류 입고 자동화 표준 일정 및 설비 템플릿",
        },
      );

      expect(template.id).toBeDefined();
      expect(template.name).toBe("표준 입고 자동화 템플릿");
      expect(template.taskCount).toBe(3);
      expect(template.milestoneCount).toBe(1);
      expect(template.processCount).toBe(1);
      expect(template.equipmentCount).toBe(1);
      expect(template.systemCount).toBe(1);
      expect(template.previewTasks.length).toBe(4);

      // 오프셋 검증: 2026-10-05(월)이 기준 시작일이므로 T1의 offsetDays는 0일이어야 함
      const previewT1 = template.previewTasks.find((t) => t.externalId === "task-t1");
      expect(previewT1).toBeDefined();
      expect(previewT1?.offsetDays).toBe(0);
      expect(previewT1?.duration).toBe(2);

      // 2026-10-05(월)은 개천절 대체공휴일이므로 실제 refStart는 2026-10-06(화)
      // T2는 2026-10-07(수) 시작이므로 10-06~10-07 근무일은 2일 -> offsetDays는 1일
      const previewT2 = template.previewTasks.find((t) => t.externalId === "task-t2");
      expect(previewT2).toBeDefined();
      expect(previewT2?.offsetDays).toBe(1);
      expect(previewT2?.duration).toBe(2);

      // 5. 템플릿 목록 및 검색 조회 테스트
      const list = templateService.listTemplates({ activeOnly: true });
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(template.id);

      const searched = templateService.listTemplates({ query: "입고" });
      expect(searched.length).toBe(1);

      const notFoundSearch = templateService.listTemplates({ query: "존재하지않음" });
      expect(notFoundSearch.length).toBe(0);

      // 6. 템플릿 수정 테스트 (이름 변경)
      const updated = templateService.updateTemplate(template.id, {
        name: "수정된 입고 템플릿",
        description: "수정된 설명",
      });
      expect(updated.name).toBe("수정된 입고 템플릿");

      // 7. 템플릿 복제 테스트
      const duplicated = templateService.duplicateTemplate(template.id, {
        name: "복제된 입고 템플릿",
      });
      expect(duplicated.id).not.toBe(template.id);
      expect(duplicated.name).toBe("복제된 입고 템플릿");
      expect(duplicated.taskCount).toBe(3);

      // 8. 템플릿 기반 새 프로젝트 생성 (인스턴스화) 테스트
      // 시작일을 2026-11-02(월)로 지정하여 생성
      const instantiated = await templateService.instantiateProject(template.id, {
        name: "용인 물류센터 신규 구축",
        ownerName: "김팀장",
        editPassword: "pass1234",
        projectStartDate: "2026-11-02",
      });

      expect(instantiated.rawSessionToken).toBe("inst-token");
      const newProject = instantiated.response.data.project;
      expect(newProject.name).toBe("용인 물류센터 신규 구축");
      expect(newProject.publicId).not.toBe(sourcePublicId);

      // 태스크 검증: 4개 생성, 진척률 0으로 리셋, 날짜 재계산
      const newTasks = instantiated.response.data.tasks;
      expect(newTasks.length).toBe(4);
      for (const t of newTasks) {
        expect(t.progress).toBe(0); // 모든 진척률 0 리셋
      }

      // T1: 2026-11-02(월) ~ 2026-11-03(화) (2일)
      const newT1 = newTasks.find((t) => t.name === "설비 설계");
      expect(newT1).toBeDefined();
      expect(newT1?.start).toBe("2026-11-02");
      expect(newT1?.end).toBe("2026-11-03");

      // T2: 2026-11-04(수) ~ 2026-11-05(목) (2일, T1 FS 의존성 반영)
      const newT2 = newTasks.find((t) => t.name === "설비 설치");
      expect(newT2).toBeDefined();
      expect(newT2?.start).toBe("2026-11-04");
      expect(newT2?.end).toBe("2026-11-05");

      // M1: 2026-11-06(금) (0일, T2 FS 의존성 반영)
      const newM1 = newTasks.find((t) => t.name === "설비 가동 개시");
      expect(newM1).toBeDefined();
      expect(newM1?.start).toBe("2026-11-06");
      expect(newM1?.end).toBe("2026-11-06");

      // Summary(S1): 전체 기간(2026-11-02 ~ 2026-11-06) 반영
      const newS1 = newTasks.find((t) => t.name === "Summary 공정");
      expect(newS1).toBeDefined();
      expect(newS1?.start).toBe("2026-11-02");
      expect(newS1?.end).toBe("2026-11-06");

      // 링크 검증: 2개 FS 링크 존재
      const newLinks = instantiated.response.data.links;
      expect(newLinks.length).toBe(2);

      // 리소스 배정 검증: newT1에 res1 배정 유지
      const newAssignments = instantiated.response.data.assignments;
      expect(newAssignments).toBeDefined();
      expect(newAssignments?.length).toBe(1);
      expect(newAssignments?.[0].target.id).toBe(res1.publicId);

      // 물류 복제 검증: 새 프로젝트에 프로세스, 장비, 시스템 및 태스크 링크 존재
      const newProjectId = (database.prepare("SELECT id FROM projects WHERE public_id = ?").get(newProject.publicId) as { id: number }).id;
      const newLogistics = logisticsService.getLogisticsDto(newProjectId);
      expect(newLogistics.processes.length).toBe(1);
      expect(newLogistics.processes[0].code).toBe("INB");
      expect(newLogistics.systems.length).toBe(1);
      expect(newLogistics.systems[0].code).toBe("WMS");
      expect(newLogistics.equipment.length).toBe(1);
      expect(newLogistics.equipment[0].code).toBe("CONV-01");

      const newTaskEquipLinks = database.prepare("SELECT * FROM task_equipment_links WHERE project_id = ?").all(newProjectId);
      expect(newTaskEquipLinks.length).toBe(1);

      const newTaskSysLinks = database.prepare("SELECT * FROM task_system_links WHERE project_id = ?").all(newProjectId);
      expect(newTaskSysLinks.length).toBe(1);

      // 9. 원본 프로젝트 삭제 후에도 템플릿과 인스턴스화된 프로젝트는 정상 작동하는지 독립성 확인
      database.prepare("DELETE FROM projects WHERE id = ?").run(sourceProjectId);

      const templateAfterSourceDeleted = templateService.getTemplate(template.id);
      expect(templateAfterSourceDeleted.id).toBe(template.id);

      // 템플릿 삭제 후에도 이미 인스턴스화된 프로젝트는 정상 유지
      templateService.deleteTemplate(template.id);
      expect(() => templateService.getTemplate(template.id)).toThrow("Project template not found.");

      const projectAfterTemplateDeleted = projectService.getReadonlySnapshot(newProject.publicId);
      expect(projectAfterTemplateDeleted?.data.project.name).toBe("용인 물류센터 신규 구축");
    } finally {
      database.close();
    }
  });
});
