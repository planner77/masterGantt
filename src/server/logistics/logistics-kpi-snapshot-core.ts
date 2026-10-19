import type Database from "better-sqlite3";
import type { LogisticsDashboardFilterInput } from "../../contracts/logistics-dashboard";
import type { ProjectTaskDto } from "../../contracts/projects";
import { resolveWbsTaskLedger } from "../../domain/resources/wbs-task-ledger";
import { readResourceDataSnapshot } from "../resources/resource-data-context-core";
import { LogisticsService } from "./logistics-service-core";
import { loadResourceCalendarExceptions, resolveResourceWorkingCalendar } from "../calendars/calendar-resolution-core";
import { readStageSnapshot } from "../projects/milestone-stage-core";
import type { CalculateDashboardInput } from "./logistics-dashboard-service";

/** The caller owns the transaction. Reuse #729's bounded, complete Project read. */
export function readLogisticsKpiSnapshot(database: Database.Database, publicId: string, filter: LogisticsDashboardFilterInput, now: Date, mdPerMmEnvironment?: string) {
  const raw = readResourceDataSnapshot(database, publicId, true);
  if (!raw) return undefined;
  const { project, storedTasks, assignments, resources, groups, memberships, projectCalendar, targetSnapshot } = raw;
  const byId = new Map(storedTasks.map(task => [task.id, task]));
  const orderedTasks = [...storedTasks].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null) || (a.parentId ?? 0) - (b.parentId ?? 0) || a.sortOrder - b.sortOrder || a.id - b.id);
  const tasks: ProjectTaskDto[] = orderedTasks.map(task => ({ taskId: task.publicId, externalId: task.externalId, name: task.name,
    type: task.type, scheduleMode: task.scheduleMode, requestedStart: task.requestedStart, start: task.startDate, end: task.endDate,
    duration: task.duration, progress: task.progress, status: task.status,
    parentExternalId: task.parentId === null ? null : byId.get(task.parentId)!.externalId, siblingOrder: task.sortOrder }));
  const logistics = new LogisticsService(database).getLogisticsDto(project.id);
  const calendarCache = new Map<string, ReturnType<typeof resolveResourceWorkingCalendar>>();
  const calendarForResource = (id: string) => {
    if (!calendarCache.has(id)) calendarCache.set(id, resolveResourceWorkingCalendar(database, project.id, id));
    return calendarCache.get(id)!;
  };
  const input: CalculateDashboardInput = { stageSnapshot: readStageSnapshot(database, project.id), mdPerMmEnvironment,
    project: { publicId, name: project.name, description: project.description, status: project.status, revision: project.revision, ownerName: null,
      calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] } },
    catalogRevision: raw.context.catalogRevision, tasks, logistics,
    assignments: assignments.map(a => ({ id: a.publicId, taskId: a.taskPublicId, target: { kind: a.kind, id: a.targetPublicId }, role: null,
      allocation: { start: a.assignmentStart, end: a.assignmentEnd, percent: a.allocationPercent } })),
    resources: resources.map(resource => ({ id: resource.publicId, name: resource.name, code: resource.code, description: "", active: resource.active, developerGrade: resource.developerGrade })),
    groups: groups.map(group => ({ id: group.publicId, name: group.name, code: group.code, description: "", active: group.active, memberResourceIds: group.memberResourceIds })),
    calendarForResource, filter, now };
  const asOfDate = filter.asOfDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const dates = storedTasks.filter(task => task.type === "task").flatMap(task => [task.startDate, task.endDate]).filter((date): date is string => date !== null).sort();
  const ledger = resolveWbsTaskLedger({ ...raw.wbsContext!, version: "wbs-task-ledger:v1", contextSourceVersion: "explicit-task-context:v1", snapshotProjectPublicId: publicId,
    processActivity: targetSnapshot.identity.processes.map(row => ({ id: row.id, active: row.active === 1 })),
    workAreaActivity: targetSnapshot.identity.workAreas.map(row => ({ id: row.id, active: row.active === 1 })),
    kpi: { projectPublicId: publicId, timezone: "Asia/Seoul", asOfDate, from: dates[0] ?? asOfDate, to: dates.at(-1) ?? asOfDate,
      tasks: storedTasks.map(task => ({ taskId: task.publicId, parentTaskId: task.parentId === null ? null : byId.get(task.parentId)!.publicId,
        type: task.type, duration: task.duration, progress: task.progress, status: task.status, start: task.startDate, end: task.endDate })),
      memberships, links: raw.links.map(link => ({ id: link.publicId, predecessorTaskId: byId.get(link.predecessorTaskId)!.publicId,
        successorTaskId: byId.get(link.successorTaskId)!.publicId, type: link.type, lag: link.lag })),
      resources: resources.map(resource => ({ resourceId: resource.publicId, groupIds: groups.filter(group => group.memberResourceIds.includes(resource.publicId)).map(group => group.publicId),
        roles: resource.roles, developerGrade: resource.developerGrade })),
      assignments: assignments.map(a => ({ assignmentId: a.publicId, taskId: a.taskPublicId, kind: a.kind, targetId: a.targetPublicId,
        start: a.assignmentStart, end: a.assignmentEnd, allocationPercent: a.allocationPercent })),
      projectCalendar, calendarExceptions: loadResourceCalendarExceptions(database, project.id), logistics: targetSnapshot.logistics, mdPerMm: filter.mdPerMm, mdPerMmEnvironment } });
  return { input, ledger, raw };
}
