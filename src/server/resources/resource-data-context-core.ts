import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { RESOURCE_DASHBOARD_LIMITS as LIMITS } from "../../contracts/resource-dashboard";
import { resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";
import { PublicApiError } from "../http/api-error-core";
import { MilestoneMembershipRepository } from "../repositories/milestone-membership-repository-core";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ResourceDashboardRepository } from "../repositories/resource-dashboard-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";

export const resourceFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Called inside the consumer's read transaction. No clock, period projection or mutations. */
export function readResourceDataSnapshot(database: Database.Database, publicId: string) {
  const project = new ProjectRepository(database).findByPublicId(publicId);
  if (!project) return undefined;
  const repository = new ResourceDashboardRepository(database), counts = repository.counts(project.id);
  for (const key of ["tasks", "assignments", "links", "calendarRules", "calendarDates", "catalogMemberships"] as const) {
    if (counts[key] > LIMITS[key]) throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "원본 데이터 조회 한도를 초과했습니다. 프로젝트의 Task·관계·Group 소속 범위를 정리해 주세요.", [{ path: `snapshot.${key}`, code: "REPORT_LIMIT_EXCEEDED", message: key }]);
  }
  const schedule = new ScheduleRepository(database), catalog = new ResourceCatalogRepository(database), calendars = new WorkCalendarRepository(database);
  const storedTasks = schedule.listTasks(project.id).sort((a, b) => a.publicId.localeCompare(b.publicId));
  const assignments = catalog.listAssignments(project.id).sort((a, b) => a.publicId.localeCompare(b.publicId));
  const { resources, groups } = repository.catalog(project.id);
  const memberships = new MilestoneMembershipRepository(database).list(project.id).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const links = schedule.listLinks(project.id).sort((a, b) => a.publicId.localeCompare(b.publicId));
  const calendarRules = calendars.listRules(project.id).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const calendarDates = calendars.listDates(project.id).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const projectCalendar = resolveProjectWorkingCalendar(database, project.id);
  const catalogRevision = catalog.getRevision(), calendarRevision = resourceFingerprint({ projectCalendar, rules: calendarRules, dates: calendarDates });
  const dataSnapshotId = resourceFingerprint({ projectPublicId: publicId, projectRevision: project.revision, catalogRevision, calendarRevision, storedTasks, assignments, resources, groups, memberships, links });
  const context = { projectPublicId: publicId, projectRevision: project.revision, catalogRevision, calendarRevision, dataSnapshotId };
  return { project, storedTasks, assignments, resources, groups, memberships, links, calendarRules, calendarDates, projectCalendar, context };
}
