import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ResourceRole } from "../../src/contracts/resources";
import { openDatabase } from "../../src/server/db/core";
import { MilestoneMembershipRepository } from "../../src/server/repositories/milestone-membership-repository-core";
import { ProjectRepository } from "../../src/server/repositories/project-repository-core";
import { ResourceCatalogRepository } from "../../src/server/repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../../src/server/repositories/schedule-repository-core";
import { ResourceDashboardService } from "../../src/server/resources/resource-dashboard-service-core";
import { resourceKpiFixture } from "./resource-kpi";

export const RESOURCE_DASHBOARD_NOW = "2026-10-16T15:00:00.000Z";
export function resourceDashboardFixture(filename = ":memory:") {
  const database = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
  const projects = new ProjectRepository(database), schedules = new ScheduleRepository(database), catalog = new ResourceCatalogRepository(database);
  const createProject = () => projects.insert({ publicId: randomUUID(), name: "Resource dashboard", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
  const project = createProject(), source = resourceKpiFixture();
  const tasks = new Map<string, ReturnType<ScheduleRepository["insertTask"]>>();
  for (const row of source.tasks) {
    const stored = schedules.insertTask({ projectId: project.id, publicId: randomUUID(), externalId: row.taskId, name: row.taskId, type: row.type,
      parentId: row.parentTaskId === null ? null : tasks.get(row.parentTaskId)!.id, scheduleMode: "auto", requestedStart: row.type === "summary" ? null : row.start,
      startDate: row.start, endDate: row.end, duration: row.duration, progress: row.progress, status: row.status,
      sortOrder: schedules.nextSiblingSortOrder(project.id, row.parentTaskId === null ? null : tasks.get(row.parentTaskId)!.id), createdAt: RESOURCE_DASHBOARD_NOW, updatedAt: RESOURCE_DASHBOARD_NOW });
    tasks.set(row.taskId, stored);
  }
  for (const row of source.memberships) new MilestoneMembershipRepository(database).set(project.id, tasks.get(row.taskId)!.id, tasks.get(row.milestoneTaskId)!.id);
  schedules.insertHoliday(project.id, "2026-10-06", "Holiday", RESOURCE_DASHBOARD_NOW);
  const resources = new Map<string, ReturnType<ResourceCatalogRepository["insertResource"]>>();
  const groups = new Map<string, ReturnType<ResourceCatalogRepository["insertGroup"]>>();
  for (const row of source.resources) {
    const stored = catalog.insertResource({ publicId: randomUUID(), name: row.resourceId === "R1" ? "Alice" : "Bob", code: row.resourceId, description: "private description omitted", developerGrade: row.developerGrade as "ADVANCED" | "INTERMEDIATE", now: RESOURCE_DASHBOARD_NOW });
    catalog.replaceResourceRoles(stored.id, row.roles as ResourceRole[], RESOURCE_DASHBOARD_NOW); resources.set(row.resourceId, stored);
  }
  for (const id of ["G1", "G2"]) {
    const group = catalog.insertGroup({ publicId: randomUUID(), name: id, code: id, description: "private group description", now: RESOURCE_DASHBOARD_NOW });
    catalog.replaceGroupMembers(group.id, source.resources.filter((resource) => resource.groupIds.includes(id)).map((resource) => resources.get(resource.resourceId)!.id), RESOURCE_DASHBOARD_NOW); groups.set(id, group);
  }
  const assignmentIds = new Map(source.assignments.map((row) => [row.assignmentId, randomUUID()]));
  for (const row of source.tasks) {
    const selected = source.assignments.filter((assignment) => assignment.taskId === row.taskId);
    if (!selected.length) continue;
    catalog.replaceTaskAssignments({ projectId: project.id, taskId: tasks.get(row.taskId)!.id, now: RESOURCE_DASHBOARD_NOW, targets: selected.map((assignment) => ({
      publicId: (assignment.kind === "resource" ? resources : groups).get(assignment.targetId)!.publicId,
      kind: assignment.kind, internalId: (assignment.kind === "resource" ? resources : groups).get(assignment.targetId)!.id,
      assignmentPublicId: assignmentIds.get(assignment.assignmentId)!, assignmentStart: assignment.start ?? null, assignmentEnd: assignment.end ?? null, allocationPercent: assignment.allocationPercent })) });
  }
  const service = new ResourceDashboardService(database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "21" });
  const request = (query = "", details = false) => new Request(`https://gantt.example/api/projects/${project.publicId}/resource-dashboard${details ? "/details" : ""}?${query}`);
  const state = () => ({ project: projects.findById(project.id), tasks: schedules.listTasks(project.id), links: schedules.listLinks(project.id), assignments: catalog.listAssignments(project.id), membership: new MilestoneMembershipRepository(database).list(project.id), catalogRevision: catalog.getRevision(), calendars: database.prepare("SELECT * FROM work_calendar_rules WHERE project_id=?").all(project.id), dates: database.prepare("SELECT d.* FROM work_calendar_dates d JOIN work_calendar_rules r ON r.id=d.calendar_rule_id WHERE r.project_id=?").all(project.id) });
  return { database, projects, project, schedules, catalog, tasks, resources, groups, assignmentIds, service, source, request, state, createProject };
}
