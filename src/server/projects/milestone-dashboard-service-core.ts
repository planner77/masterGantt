import type Database from "better-sqlite3";
import type { MilestoneDashboardFilterInput } from "../../contracts/milestone-dashboard";
import type { ProjectTaskDto } from "../../contracts/projects";
import type { WorkingCalendar } from "../../domain/scheduling/calendar";
import { projectCalendarDto, resolveResourceWorkingCalendar } from "../calendars/calendar-resolution-core";
import { LogisticsService } from "../logistics/logistics-service-core";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import { calculateMilestoneDashboard } from "./milestone-dashboard-calculation-core";
import { readStageSnapshot } from "./milestone-stage-core";

export class MilestoneDashboardService {
  constructor(private readonly database: Database.Database, private readonly options: { clock?: () => Date; mdPerMmEnvironment?: string } = {}) {}

  getDashboard(publicId: string, filter: MilestoneDashboardFilterInput = {}) {
    // The project row, revisions, catalogs and calendars belong to this same read snapshot.
    return this.database.transaction(() => {
      const project = new ProjectRepository(this.database).findByPublicId(publicId);
      if (!project) return undefined;
      const now = (this.options.clock ?? (() => new Date()))();
      const schedule = new ScheduleRepository(this.database), catalog = new ResourceCatalogRepository(this.database);
      const storedTasks = schedule.listTasks(project.id), byInternalId = new Map(storedTasks.map((task) => [task.id, task.externalId]));
      const tasks: ProjectTaskDto[] = storedTasks.map((task) => ({
        taskId: task.publicId, externalId: task.externalId, name: task.name, type: task.type, scheduleMode: task.scheduleMode,
        requestedStart: task.requestedStart, start: task.startDate, end: task.endDate, duration: task.duration, progress: task.progress, status: task.status,
        parentExternalId: task.parentId === null ? null : byInternalId.get(task.parentId)!, siblingOrder: task.sortOrder,
      }));
      const calendars = new Map<string, WorkingCalendar>();
      return calculateMilestoneDashboard({
        project: { publicId: project.publicId, name: project.name, description: project.description, status: project.status, revision: project.revision, calendar: projectCalendarDto(this.database, project.id) },
        tasks, stageSnapshot: readStageSnapshot(this.database, project.id), catalogRevision: catalog.getRevision(),
        logistics: new LogisticsService(this.database).getLogisticsDto(project.id),
        assignments: catalog.listAssignments(project.id).map((row) => ({ id: row.publicId, taskId: row.taskPublicId, target: { kind: row.kind, id: row.targetPublicId }, role: row.assignmentRole,
          allocation: { start: row.assignmentStart, end: row.assignmentEnd, percent: row.allocationPercent } })),
        resources: catalog.listResources().map((row) => ({ id: row.publicId, name: row.name, code: row.code, description: row.description, active: row.active, developerGrade: row.developerGrade })),
        groups: [],
        calendarForResource: (id) => {
          if (!calendars.has(id)) calendars.set(id, resolveResourceWorkingCalendar(this.database, project.id, id));
          return calendars.get(id)!;
        },
        filter, now, mdPerMmEnvironment: this.options.mdPerMmEnvironment,
      });
    })();
  }
}
