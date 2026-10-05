import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { ResourceWorkloadService } from "../../../src/server/resources/resource-workload-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const NOW = "2026-09-15T12:00:00.000Z";

function fixture() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
  const projects = new ProjectRepository(database);
  const sessions = new EditSessionRepository(database);
  const schedules = new ScheduleRepository(database);
  const project = projects.insert({
    publicId: randomUUID(),
    name: "Workload fixture",
    description: "",
    passwordKdf: "scrypt",
    passwordSalt: Buffer.alloc(16, 1),
    passwordHash: Buffer.alloc(32, 2),
    scryptN: 32768,
    scryptR: 8,
    scryptP: 3,
    scryptKeyLength: 32,
    calendarTimezone: "Asia/Seoul",
    createdAt: NOW,
    updatedAt: NOW,
  });
  const token = createSessionToken();
  const sessionId = sessions.insert({
    projectId: project.id,
    tokenHash: token.tokenHash,
    authVersion: project.authVersion,
    createdAt: NOW,
    expiresAt: "2026-10-01T00:00:00.000Z",
  });
  const addTask = (name: string, type: "task" | "summary") => schedules.insertTask({
    projectId: project.id,
    externalId: randomUUID(),
    publicId: randomUUID(),
    name,
    type,
    scheduleMode: "auto",
    requestedStart: type === "summary" ? null : "2026-09-14",
    startDate: "2026-09-14",
    endDate: "2026-09-20",
    duration: 4,
    progress: 0,
    parentId: null,
    sortOrder: schedules.nextRootSortOrder(project.id),
    createdAt: NOW,
    updatedAt: NOW,
  });
  const first = addTask("First", "task");
  const second = addTask("Second", "task");
  const legacy = addTask("Legacy", "task");
  const summary = addTask("Summary reference", "summary");
  schedules.insertHoliday(project.id, "2026-09-16", "Company holiday", NOW);
  return {
    database,
    project,
    first,
    second,
    legacy,
    summary,
    authorization: {
      projectId: project.id,
      projectPublicId: project.publicId,
      projectRevision: 1,
      projectAuthVersion: project.authVersion,
      sessionId,
      tokenHash: token.tokenHash,
      expiresAt: "2026-10-01T00:00:00.000Z",
    },
  };
}

describe("ResourceWorkloadService", () => {
  it("calculates working-day effort, clips ranges, detects overlap, keeps legacy unset and deduplicates multi-group totals", () => {
    const f = fixture();
    try {
      const resources = new ResourceCatalogService(f.database, { clock: () => new Date(NOW) });
      const admin = resources.unlockAdmin("Admin123456!", "Admin123456!");
      if (!admin) throw new Error("admin session not created");

      let catalog = resources.createTarget("resource", admin.rawToken, 1, { name: "Resource A", code: "R-A" });
      const resourceA = catalog.data.resources.find((resource) => resource.code === "R-A")!;
      catalog = resources.createTarget("resource", admin.rawToken, catalog.data.revision, { name: "Resource B", code: "R-B" });
      const resourceB = catalog.data.resources.find((resource) => resource.code === "R-B")!;
      catalog = resources.createTarget("group", admin.rawToken, catalog.data.revision, { name: "Group A" });
      const groupA = catalog.data.groups.find((group) => group.name === "Group A")!;
      catalog = resources.createTarget("group", admin.rawToken, catalog.data.revision, { name: "Group B" });
      const groupB = catalog.data.groups.find((group) => group.name === "Group B")!;
      catalog = resources.replaceGroupMembers(groupA.id, admin.rawToken, catalog.data.revision, { resourceIds: [resourceA.id] });
      catalog = resources.replaceGroupMembers(groupB.id, admin.rawToken, catalog.data.revision, { resourceIds: [resourceA.id] });

      let revision = 1;
      revision = resources.replaceTaskAssignments(f.authorization, revision, f.first.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resourceA.id, allocation: { percent: 50 } }],
      }).data.projectRevision;
      revision = resources.replaceTaskAssignments(f.authorization, revision, f.second.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resourceA.id, allocation: { start: "2026-09-15", end: "2026-09-20", percent: 60 } }],
      }).data.projectRevision;
      revision = resources.replaceTaskAssignments(f.authorization, revision, f.legacy.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resourceB.id }],
      }).data.projectRevision;
      resources.replaceTaskAssignments(f.authorization, revision, f.summary.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: resourceB.id, allocation: { start: "2026-09-14", end: "2026-09-20", percent: 80 } }],
      });

      const service = new ResourceWorkloadService(f.database);
      const full = service.get(f.project.publicId, "2026-09-14", "2026-09-20", "20")!;
      expect(full.data.grandTotalMd).toBe(3.8);
      expect(full.data.grandTotalMm).toBe(0.19);
      expect(full.data.unsetCount).toBe(1);
      const groupResultA = full.data.groups.find((group) => group.name === "Group A")!;
      const groupResultB = full.data.groups.find((group) => group.name === "Group B")!;
      expect(groupResultA.effortMd).toBe(3.8);
      expect(groupResultB.effortMd).toBe(3.8);
      expect(groupResultA.resources[0].overAllocated).toBe(true);
      const ungrouped = full.data.groups.find((group) => group.name === "미분류 리소스")!;
      expect(ungrouped.unsetCount).toBe(1);
      expect(ungrouped.resources[0].tasks).toHaveLength(1);
      expect(ungrouped.resources[0].tasks[0].taskName).toBe("Legacy");

      const clipped = service.get(f.project.publicId, "2026-09-15", "2026-09-17", "20")!;
      expect(clipped.data.grandTotalMd).toBe(2.2);
      expect(clipped.data.grandTotalMm).toBe(0.11);
    } finally {
      f.database.close();
    }
  });

  it("Issue #414 aggregates assignment roles without changing the #56 effort contract", () => {
    const f = fixture();
    try {
      const resources = new ResourceCatalogService(f.database, { clock: () => new Date(NOW) });
      const schedules = new ScheduleRepository(f.database);
      const admin = resources.unlockAdmin("Admin123456!", "Admin123456!");
      if (!admin) throw new Error("admin session not created");

      let catalog = resources.createTarget("resource", admin.rawToken, 1, {
        name: "Multi role", code: "R-MULTI", developerGrade: "ADVANCED", roles: ["PI", "DEVELOPER"],
      });
      const multi = catalog.data.resources.find((resource) => resource.code === "R-MULTI")!;
      catalog = resources.createTarget("resource", admin.rawToken, catalog.data.revision, {
        name: "Developer", code: "R-DEV", developerGrade: "INTERMEDIATE", roles: ["DEVELOPER"],
      });
      const developer = catalog.data.resources.find((resource) => resource.code === "R-DEV")!;
      catalog = resources.createTarget("resource", admin.rawToken, catalog.data.revision, {
        name: "Equipment owner", code: "R-EQ", roles: ["EQUIPMENT_OWNER"],
      });
      const equipmentOwner = catalog.data.resources.find((resource) => resource.code === "R-EQ")!;
      catalog = resources.createTarget("resource", admin.rawToken, catalog.data.revision, {
        name: "Legacy developer", code: "R-LEGACY-DEV", developerGrade: "BEGINNER", roles: ["DEVELOPER"],
      });
      const legacyDeveloper = catalog.data.resources.find((resource) => resource.code === "R-LEGACY-DEV")!;
      catalog = resources.createTarget("group", admin.rawToken, catalog.data.revision, { name: "Group A" });
      const groupA = catalog.data.groups.find((group) => group.name === "Group A")!;
      catalog = resources.createTarget("group", admin.rawToken, catalog.data.revision, { name: "Group B" });
      const groupB = catalog.data.groups.find((group) => group.name === "Group B")!;
      catalog = resources.replaceGroupMembers(groupA.id, admin.rawToken, catalog.data.revision, { resourceIds: [multi.id] });
      catalog = resources.replaceGroupMembers(groupB.id, admin.rawToken, catalog.data.revision, { resourceIds: [multi.id] });

      const addLeaf = (name: string) => schedules.insertTask({
        projectId: f.project.id,
        externalId: randomUUID(),
        publicId: randomUUID(),
        name,
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-09-14",
        startDate: "2026-09-14",
        endDate: "2026-09-20",
        duration: 4,
        progress: 0,
        parentId: null,
        sortOrder: schedules.nextRootSortOrder(f.project.id),
        createdAt: NOW,
        updatedAt: NOW,
      });
      const equipmentTask = addLeaf("Equipment setup");
      const unspecifiedTask = addLeaf("Legacy role");

      let revision = 1;
      revision = resources.replaceTaskAssignments(f.authorization, revision, f.first.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: multi.id, role: "PI", allocation: { percent: 50 } }],
      }).data.projectRevision;
      revision = resources.replaceTaskAssignments(f.authorization, revision, f.second.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: multi.id, role: "DEVELOPER", allocation: { percent: 100 } }],
      }).data.projectRevision;
      revision = resources.replaceTaskAssignments(f.authorization, revision, f.legacy.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: developer.id, role: "DEVELOPER", allocation: { percent: 100 } }],
      }).data.projectRevision;
      revision = resources.replaceTaskAssignments(f.authorization, revision, equipmentTask.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: equipmentOwner.id, role: "EQUIPMENT_OWNER", allocation: { percent: 75 } }],
      }).data.projectRevision;
      resources.replaceTaskAssignments(f.authorization, revision, unspecifiedTask.publicId, {
        catalogRevision: catalog.data.revision,
        targets: [{ kind: "resource", id: legacyDeveloper.id }],
      });

      f.database.prepare("UPDATE tasks SET progress = 50, status = 'in_progress' WHERE id = ?").run(f.first.id);

      const service = new ResourceWorkloadService(f.database, { clock: () => new Date("2026-09-21T03:00:00.000Z") });
      const result = service.get(f.project.publicId, "2026-09-14", "2026-09-20", "20")!;
      expect(result.data.grandTotalMd).toBe(13);
      expect(result.data.grandTotalMm).toBe(0.65);
      expect(result.data.unsetCount).toBe(1);
      expect(result.data.unspecifiedRoleCount).toBe(1);
      expect(result.data.overAllocatedResourceCount).toBe(1);
      expect(result.data.roleTotals).toEqual([
        { role: "PI", assignmentCount: 1, effortMd: 2, effortMm: 0.1, unsetCount: 0 },
        { role: "DEVELOPER", assignmentCount: 2, effortMd: 8, effortMm: 0.4, unsetCount: 0 },
        { role: "EQUIPMENT_OWNER", assignmentCount: 1, effortMd: 3, effortMm: 0.15, unsetCount: 0 },
        { role: "UNSPECIFIED", assignmentCount: 1, effortMd: 0, effortMm: 0, unsetCount: 1 },
      ]);
      expect(result.data.roleTotals!.reduce((sum, total) => sum + total.effortMd, 0)).toBe(result.data.grandTotalMd);

      const groupResultA = result.data.groups.find((group) => group.name === "Group A")!;
      const groupResultB = result.data.groups.find((group) => group.name === "Group B")!;
      expect(groupResultA.effortMd).toBe(6);
      expect(groupResultB.effortMd).toBe(6);
      expect(result.data.grandTotalMd).toBe(13);

      const multiRow = groupResultA.resources.find((resource) => resource.id === multi.id)!;
      expect(multiRow.developerGrade).toBe("ADVANCED");
      expect(multiRow.overAllocated).toBe(true);
      const piTask = multiRow.tasks.find((task) => task.taskId === f.first.publicId)!;
      expect(piTask).toMatchObject({
        role: "PI",
        effectiveWorkingDays: 4,
        effortMd: 2,
        progress: 50,
        status: "in_progress",
        delayed: true,
        taskStart: "2026-09-14",
        taskEnd: "2026-09-20",
      });
      const legacyRoleTask = result.data.groups.flatMap((group) => group.resources)
        .flatMap((resource) => resource.tasks)
        .find((task) => task.taskId === unspecifiedTask.publicId)!;
      expect(legacyRoleTask.role).toBe("UNSPECIFIED");

      const withoutMm = service.get(f.project.publicId, "2026-09-14", "2026-09-20")!;
      expect(withoutMm.data.grandTotalMd).toBe(13);
      expect(withoutMm.data.grandTotalMm).toBeNull();
      expect(withoutMm.data.roleTotals?.every((total) => total.effortMm === null)).toBe(true);
    } finally {
      f.database.close();
    }
  });
});
