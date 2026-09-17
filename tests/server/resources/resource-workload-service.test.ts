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
      const admin = resources.unlockAdmin("correct-resource-admin-password", "correct-resource-admin-password");
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
});
