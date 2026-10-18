import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { ResourceWorkloadService } from "../../../src/server/resources/resource-workload-service-core";
import { calculateResourceKpi } from "../../../src/domain/resources/resource-kpi";
import { resourceKpiFixture } from "../../fixtures/resource-kpi";

// Reads the real legacy DTO from native SQLite; avoids approximating the adapter in the test.
describe("resource KPI legacy compatibility", () => {
  it("keeps raw fractions separate from legacy per-assignment/total four-place rounding", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db", "migrations") });
    const now = "2026-10-10T00:00:00.000Z";
    try {
      const projects = new ProjectRepository(database);
      const project = projects.insert({ publicId: "P", name: "Precision", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: now, updatedAt: now });
      const schedules = new ScheduleRepository(database);
      const task = schedules.insertTask({ projectId: project.id, externalId: "T1", publicId: "T1", name: "Task", type: "task", scheduleMode: "auto", requestedStart: "2026-10-05", startDate: "2026-10-05", endDate: "2026-10-09", duration: 4, progress: 0, parentId: null, sortOrder: 0, createdAt: now, updatedAt: now });
      schedules.insertHoliday(project.id, "2026-10-06", "Holiday", now);
      const catalog = new ResourceCatalogRepository(database);
      const resource = catalog.insertResource({ publicId: "R2", name: "Resource", code: "R2", developerGrade: null, description: "", now });
      catalog.replaceTaskAssignments({ projectId: project.id, taskId: task.id, targets: [{ kind: "resource", internalId: resource.id, publicId: "R2", assignmentPublicId: "A2", assignmentStart: null, assignmentEnd: null, allocationPercent: 33.333333 }], now });
      const legacy = new ResourceWorkloadService(database, { clock: () => new Date(now) }).get("P", "2026-10-05", "2026-10-09", "19")!.data;
      expect(legacy.grandTotalMd).toBe(1.3333);
      expect(legacy.grandTotalMm).toBe(0.0702);
      expect(legacy.groups[0].resources[0].tasks[0]).toMatchObject({ effortMd: 1.3333, effortMm: 0.0702 });
      const input = resourceKpiFixture(); input.filters = { taskIds: ["T1"], resourceIds: ["R2"] }; input.mdPerMm = 19;
      const raw = calculateResourceKpi(input).total.effort;
      expect(raw.plannedMd).toBe(4 * 33.333333 / 100);
      expect(raw.plannedMd).not.toBe(legacy.grandTotalMd);
      expect(raw.plannedMm).toBe(raw.plannedMd! / 19);
    } finally { database.close(); }
  });
});
