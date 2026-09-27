import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import {
  calculateLogisticsDashboardPure,
  LogisticsDashboardService,
  type CalculateDashboardInput,
} from "../../../src/server/logistics/logistics-dashboard-service";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import type { ProjectDto, ProjectTaskDto } from "../../../src/contracts/projects";
import type { ProjectLogisticsDto } from "../../../src/contracts/logistics";
import type { ProjectAssignmentDto, ResourceDto, ResourceGroupDto } from "../../../src/contracts/resources";
import { createWorkingCalendar, type WorkingCalendar } from "../../../src/domain/scheduling/calendar";

describe("Logistics Dashboard Engine (Deterministic Synthetic Fixture & Edge Cases)", () => {
  // 섹션 7 Deterministic Synthetic Fixture
  const createDeterministicFixture = (): CalculateDashboardInput => {
    const project: ProjectDto = {
      publicId: "proj-det-01",
      name: "물류 대시보드 합성 검증 프로젝트",
      description: "LOGISTICS_DASHBOARD.md 섹션 7 결정적 합성 검증",
      status: "in_progress",
      ownerName: "Logistics Team",
      revision: 1,
      calendar: {
        timezone: "Asia/Seoul",
        weekendDays: [6, 0], // 토/일 휴무
        holidays: [], // 국가 공휴일 없음 (10월 9일도 근무일)
      },
    };

    const tasks: ProjectTaskDto[] = [
      {
        taskId: "s1",
        externalId: "S1",
        name: "구역 1 요약 작업",
        type: "summary",
        scheduleMode: "auto",
        start: "2026-10-05",
        end: "2026-10-08",
        duration: 4,
        progress: 67,
        parentExternalId: null,
        siblingOrder: 0,
        requestedStart: null,
      },
      {
        taskId: "t1",
        externalId: "T1",
        name: "스토커 설치",
        type: "task",
        scheduleMode: "auto",
        start: "2026-10-05",
        end: "2026-10-08", // 4 working days (Mon~Thu)
        duration: 4,
        progress: 50,
        parentExternalId: "S1",
        siblingOrder: 0,
        requestedStart: null,
      },
      {
        taskId: "t2",
        externalId: "T2",
        name: "AGV 시운전 1차",
        type: "task",
        scheduleMode: "auto",
        start: "2026-10-07",
        end: "2026-10-08", // 2 working days (Wed~Thu)
        duration: 2,
        progress: 100,
        parentExternalId: "S1",
        siblingOrder: 1,
        requestedStart: null,
      },
      {
        taskId: "t3",
        externalId: "T3",
        name: "AGV 시운전 2차",
        type: "task",
        scheduleMode: "auto",
        start: "2026-10-09",
        end: "2026-10-12", // 2 working days: Fri(10-09), Mon(10-12)
        duration: 2,
        progress: 0,
        parentExternalId: null,
        siblingOrder: 1,
        requestedStart: null,
      },
      {
        taskId: "m1",
        externalId: "M1",
        name: "중간 점검 마일스톤",
        type: "milestone",
        scheduleMode: "auto",
        start: "2026-10-08",
        end: "2026-10-08",
        duration: 0,
        progress: 0,
        parentExternalId: null,
        siblingOrder: 2,
        requestedStart: null,
      },
    ];

    const logistics: ProjectLogisticsDto = {
      processes: [
        { id: "p1", code: "P1", name: "보관공정", parentProcessId: null, sortOrder: 1, active: true, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
        { id: "p2", code: "P2", name: "이송공정", parentProcessId: null, sortOrder: 2, active: true, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
        { id: "p3", code: "P3", name: "분류공정", parentProcessId: null, sortOrder: 3, active: true, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
      ],
      equipment: [
        {
          id: "e1",
          code: "E1",
          name: "Stocker unit1",
          equipmentType: "stocker",
          managementUnit: "unit",
          quantity: 1,
          manufacturer: "",
          model: "",
          description: "",
          processId: "p1",
          active: true,
          controlSystems: [{ systemId: "c1", controlRole: "primary" }],
          resourceRoles: [{ resourceId: "r1", resourceCode: "R1", resourceName: "홍길동", role: "owner", isPrimary: true, active: true }],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "e2",
          code: "E2",
          name: "AGV fleet4",
          equipmentType: "agv",
          managementUnit: "fleet",
          quantity: 4,
          manufacturer: "",
          model: "",
          description: "",
          processId: "p2",
          active: true,
          controlSystems: [{ systemId: "c2", controlRole: "primary" }],
          resourceRoles: [{ resourceId: "r1", resourceCode: "R1", resourceName: "홍길동", role: "owner", isPrimary: true, active: true }],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "e3",
          code: "E3",
          name: "AMR fleet3",
          equipmentType: "amr",
          managementUnit: "fleet",
          quantity: 3,
          manufacturer: "",
          model: "",
          description: "",
          processId: "p3",
          active: true,
          controlSystems: [{ systemId: "c2", controlRole: "primary" }],
          resourceRoles: [{ resourceId: "r1", resourceCode: "R1", resourceName: "홍길동", role: "owner", isPrimary: true, active: true }],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      systems: [
        {
          id: "c1",
          code: "C1",
          name: "SCS",
          systemType: "scs",
          layer: "controller",
          scope: "processes",
          vendor: "",
          description: "",
          active: true,
          processIds: ["p1"],
          coordinatedSystemIds: [],
          resourceRoles: [
            { resourceId: "r1", resourceCode: "R1", resourceName: "홍길동", role: "pi", isPrimary: true, active: true },
            { resourceId: "r2", resourceCode: "R2", resourceName: "김철수", role: "developer", isPrimary: false, active: true },
          ],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "c2",
          code: "C2",
          name: "ACS",
          systemType: "acs",
          layer: "controller",
          scope: "processes",
          vendor: "",
          description: "",
          active: true,
          processIds: ["p2", "p3"],
          coordinatedSystemIds: [],
          resourceRoles: [
            { resourceId: "r1", resourceCode: "R1", resourceName: "홍길동", role: "pi", isPrimary: true, active: true },
            { resourceId: "r2", resourceCode: "R2", resourceName: "김철수", role: "developer", isPrimary: false, active: true },
          ],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "c3",
          code: "C3",
          name: "MCS",
          systemType: "mcs",
          layer: "coordinator",
          scope: "project",
          vendor: "",
          description: "",
          active: true,
          processIds: [],
          coordinatedSystemIds: ["c1", "c2"],
          resourceRoles: [{ resourceId: "r1", resourceCode: "R1", resourceName: "홍길동", role: "pi", isPrimary: true, active: true }],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      systemLinks: [
        { sourceSystemId: "c3", targetSystemId: "c1", relationType: "coordinates" },
        { sourceSystemId: "c3", targetSystemId: "c2", relationType: "coordinates" },
      ],
      taskEquipmentLinks: [
        { taskId: "s1", equipmentId: "e1", scope: "subtree" },
        { taskId: "t1", equipmentId: "e1", scope: "self" }, // 중복 연결 (subtree 상속 + 직접)
        { taskId: "t2", equipmentId: "e2", scope: "self" },
        { taskId: "t3", equipmentId: "e2", scope: "self" },
      ],
      taskSystemLinks: [
        { taskId: "t1", systemId: "c1", scope: "self" },
        { taskId: "t2", systemId: "c2", scope: "self" },
        { taskId: "t3", systemId: "c2", scope: "self" },
        { taskId: "m1", systemId: "c3", scope: "self" },
      ],
    };

    const resources: ResourceDto[] = [
      { id: "r1", name: "홍길동 PI", code: "R1", description: "책임자", active: true },
      { id: "r2", name: "이순신 개발자", code: "R2", description: "담당 개발자", active: true },
    ];

    const groups: ResourceGroupDto[] = [];

    const assignments: ProjectAssignmentDto[] = [
      {
        id: "a1",
        taskId: "t1",
        target: { kind: "resource", id: "r2" },
        allocation: { start: "2026-10-05", end: "2026-10-08", percent: 50 }, // 4일 * 50% = 2 MD
      },
      {
        id: "a2",
        taskId: "t2",
        target: { kind: "resource", id: "r2" },
        allocation: { start: "2026-10-07", end: "2026-10-08", percent: 100 }, // 2일 * 100% = 2 MD
      },
      {
        id: "a3",
        taskId: "t3",
        target: { kind: "resource", id: "r2" },
        allocation: { start: "2026-10-09", end: "2026-10-12", percent: null }, // 미설정
      },
    ];

    const weekendOnlyCalendar: WorkingCalendar = createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
    });

    return {
      project,
      catalogRevision: 1,
      tasks,
      logistics,
      assignments,
      resources,
      groups,
      calendarForResource: () => weekendOnlyCalendar,
      filter: {
        asOfDate: "2026-10-09",
        horizonDays: 14,
      },
      now: new Date("2026-10-09T09:00:00Z"),
    };
  };

  it("calculates Section 7 deterministic synthetic fixture correctly", () => {
    const fixture = createDeterministicFixture();
    const dashboard = calculateLogisticsDashboardPure(fixture);

    // 1. 전체 Project 진척률: (4*50 + 2*100 + 2*0) / (4 + 2 + 2) = 400 / 8 = 50%
    expect(dashboard.kpi.progressPercent).toBe(50);
    expect(dashboard.kpi.totalDuration).toBe(8);
    expect(dashboard.kpi.taskCount).toBe(3);

    // 2. 일반 지연: T1만 1개 (T1 end 10-08 < 10-09, T2는 100% 완료, T3는 end 10-12)
    expect(dashboard.kpi.overdueTaskCount).toBe(1);
    expect(dashboard.kpi.overdueTaskIds).toEqual(["t1"]);

    // 3. Milestone 지연: M1만 1개 (due 10-08 < 10-09)
    expect(dashboard.kpi.milestoneTotalCount).toBe(1);
    expect(dashboard.kpi.milestoneOverdueCount).toBe(1);
    expect(dashboard.kpi.milestoneOverdueIds).toEqual(["m1"]);
    expect(dashboard.kpi.milestoneUpcomingCount).toBe(0);

    // 4. 계획 공수: T1(2MD) + T2(2MD) + T3(미설정) = 총 4MD, 미설정 1건
    expect(dashboard.effort.plannedMd).toBe(4);
    expect(dashboard.effort.unsetAllocationCount).toBe(1);

    // 5. 설비 등록/수량
    expect(dashboard.quality.totalEquipmentMasterCount).toBe(3);
    expect(dashboard.quality.totalEquipmentQuantity).toBe(8); // 1 + 4 + 3

    // 6. E1 설비 breakdown 진척률:
    // T1(4일, 50%), T2(2일, 100% - S1 상속) -> (4*50 + 2*100) / 6 = 400 / 6 = 66.6667%
    const e1Row = dashboard.breakdowns.equipment.find((e) => e.code === "E1");
    expect(e1Row).toBeDefined();
    expect(e1Row?.taskCount).toBe(2);
    expect(e1Row?.progressPercent).toBeCloseTo(66.6667, 3);
  });

  it("handles C3 coordinator direct view vs coordination view correctly without double counting", () => {
    const fixture = createDeterministicFixture();

    // Direct view: C3만 필터링
    const directResult = calculateLogisticsDashboardPure({
      ...fixture,
      filter: {
        asOfDate: "2026-10-09",
        systemIds: ["c3"],
        systemView: "direct",
      },
    });

    // C3 직접 연결은 M1(Milestone)뿐이므로 일반 Task 없음
    expect(directResult.kpi.taskCount).toBe(0);
    expect(directResult.kpi.progressPercent).toBeNull();
    expect(directResult.kpi.milestoneTotalCount).toBe(1);
    expect(directResult.kpi.milestoneOverdueCount).toBe(1);

    // Coordination view: C3 조율 범위 roll-up
    // C3 자손 시스템: C1, C2
    // C1, C2가 제어하는 설비: E1, E2, E3
    // C1/C2 또는 E1/E2/E3에 연결된 작업: T1, T2, T3, M1 전체
    const coordResult = calculateLogisticsDashboardPure({
      ...fixture,
      filter: {
        asOfDate: "2026-10-09",
        systemIds: ["c3"],
        systemView: "coordination",
      },
    });

    expect(coordResult.kpi.taskCount).toBe(3);
    expect(coordResult.kpi.progressPercent).toBe(50);
    expect(coordResult.kpi.overdueTaskCount).toBe(1);
    expect(coordResult.kpi.milestoneTotalCount).toBe(1);
    expect(coordResult.effort.plannedMd).toBe(4);
  });

  it("uses the project timezone for the default as-of date and the documented 20 MD/MM default", () => {
    const fixture = createDeterministicFixture();
    const result = calculateLogisticsDashboardPure({
      ...fixture,
      filter: {},
      now: new Date("2026-10-08T16:30:00.000Z"),
    });

    expect(result.asOfDate).toBe("2026-10-09");
    expect(result.timezone).toBe("Asia/Seoul");
    expect(result.effort.plannedMd).toBe(4);
    expect(result.effort.plannedMm).toBe(0.2);
    expect(result.effort.mdPerMm).toBe(20);
  });

  it("treats inactive primary resources as missing and removes inactive rows from active-only breakdowns", () => {
    const fixture = createDeterministicFixture();
    const inactiveResources = fixture.resources.map((resource) =>
      resource.id === "r1" ? { ...resource, active: false } : resource,
    );
    const inactiveLogistics = {
      ...fixture.logistics,
      processes: fixture.logistics.processes.map((process) =>
        process.id === "p3" ? { ...process, active: false } : process,
      ),
      equipment: fixture.logistics.equipment.map((equipment) =>
        equipment.id === "e3" ? { ...equipment, active: false } : equipment,
      ),
      systems: fixture.logistics.systems.map((system) =>
        system.id === "c3" ? { ...system, active: false } : system,
      ),
    };

    const result = calculateLogisticsDashboardPure({
      ...fixture,
      resources: inactiveResources,
      logistics: inactiveLogistics,
      filter: { asOfDate: "2026-10-09", activeOnly: true },
    });

    expect(result.quality.equipmentWithoutOwnerCount).toBe(2);
    expect(result.quality.systemsWithoutPrimaryPICount).toBe(2);
    expect(result.breakdowns.processes.some((row) => row.id === "p3")).toBe(false);
    expect(result.breakdowns.equipment.some((row) => row.id === "e3")).toBe(false);
    expect(result.breakdowns.systems.some((row) => row.id === "c3")).toBe(false);
  });

  it("handles edge case: denominator 0 (no tasks) returns null progress", () => {
    const fixture = createDeterministicFixture();
    const result = calculateLogisticsDashboardPure({
      ...fixture,
      tasks: [],
    });

    expect(result.kpi.progressPercent).toBeNull();
    expect(result.kpi.totalDuration).toBe(0);
    expect(result.kpi.taskCount).toBe(0);
    expect(result.kpi.overdueTaskCount).toBe(0);
  });

  it("handles edge case: tasks ending on asOfDate are not overdue (inclusive end)", () => {
    const fixture = createDeterministicFixture();
    // T1의 종료일을 asOfDate인 2026-10-09로 변경
    const modifiedTasks = fixture.tasks.map((t) =>
      t.taskId === "t1" ? { ...t, end: "2026-10-09" } : t,
    );

    const result = calculateLogisticsDashboardPure({
      ...fixture,
      tasks: modifiedTasks,
    });

    // 당일 종료는 지연이 아님
    expect(result.kpi.overdueTaskIds).not.toContain("t1");
    expect(result.kpi.overdueTaskCount).toBe(0);
  });

  it("handles edge case: upcoming milestones within horizonDays", () => {
    const fixture = createDeterministicFixture();
    // M1의 날짜를 asOfDate(2026-10-09) + 5일 = 2026-10-14로 변경
    const modifiedTasks = fixture.tasks.map((t) =>
      t.taskId === "m1" ? { ...t, start: "2026-10-14", end: "2026-10-14" } : t,
    );

    const result = calculateLogisticsDashboardPure({
      ...fixture,
      tasks: modifiedTasks,
      filter: {
        asOfDate: "2026-10-09",
        horizonDays: 14,
      },
    });

    expect(result.kpi.milestoneOverdueCount).toBe(0);
    expect(result.kpi.milestoneUpcomingCount).toBe(1);
    expect(result.kpi.milestoneUpcomingIds).toEqual(["m1"]);
  });
});

describe("LogisticsDashboardService SQLite Integration", () => {
  it("queries SQLite database in a single read transaction and returns accurate dashboard DTO", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "mastergantt-dashboard-integration-"));
    try {
      const dbPath = join(tmpDir, "test.sqlite3");
      const { database } = openDatabase({
        filename: dbPath,
        migrationsDirectory: join(process.cwd(), "db", "migrations"),
      });

      const now = new Date("2026-10-09T09:00:00.000Z");
      const projectRepo = new ProjectRepository(database);
      const scheduleRepo = new ScheduleRepository(database);
      const logisticsRepo = new LogisticsRepository(database);

      const project = projectRepo.insert({
        publicId: "44444444-5555-4666-8777-888888888888",
        name: "통합 테스트 물류 프로젝트",
        description: "통합 테스트",
        status: "in_progress",
        passwordKdf: "scrypt",
        passwordSalt: Buffer.alloc(16),
        passwordHash: Buffer.alloc(32),
        scryptN: 16384,
        scryptR: 8,
        scryptP: 1,
        scryptKeyLength: 32,
        calendarTimezone: "Asia/Seoul",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      const proc = logisticsRepo.insertProcess({
        projectId: project.id,
        publicId: "proc-test-1",
        code: "P-01",
        name: "공정 1",
        parentId: null,
        now: now.toISOString(),
      });

      const eq = logisticsRepo.insertEquipment({
        projectId: project.id,
        processId: proc.id,
        publicId: "eq-test-1",
        code: "EQ-01",
        name: "설비 1",
        equipmentType: "conveyor",
        managementUnit: "fleet",
        quantity: 5,
        now: now.toISOString(),
      });

      const task = scheduleRepo.insertTask({
        projectId: project.id,
        externalId: "T-01",
        publicId: "task-test-1",
        name: "설비 설치",
        type: "task",
        scheduleMode: "auto",
        requestedStart: null,
        startDate: "2026-10-05",
        endDate: "2026-10-08",
        duration: 4,
        progress: 75,
        parentId: null,
        sortOrder: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      logisticsRepo.replaceTaskEquipmentLinks(
        project.id,
        task.id,
        [{ equipmentId: eq.id, scope: "self" }],
        now.toISOString(),
      );

      const service = new LogisticsDashboardService(database, { clock: () => now });
      const dashboard = service.getDashboard("44444444-5555-4666-8777-888888888888", {
        asOfDate: "2026-10-09",
      });

      expect(dashboard).toBeDefined();
      expect(dashboard?.projectRevision).toBe(project.revision);
      expect(dashboard?.asOfDate).toBe("2026-10-09");
      expect(dashboard?.kpi.taskCount).toBe(1);
      expect(dashboard?.kpi.progressPercent).toBe(75);
      expect(dashboard?.kpi.overdueTaskCount).toBe(1); // 10-08 < 10-09 (75% < 100%)
      expect(dashboard?.quality.totalEquipmentMasterCount).toBe(1);
      expect(dashboard?.quality.totalEquipmentQuantity).toBe(5);

      // Non-existent project
      const notFound = service.getDashboard("99999999-9999-4999-8999-999999999999");
      expect(notFound).toBeUndefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

