import type Database from "better-sqlite3";

import { projectCalendarDto, resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";

import type {
  ProjectLinkDto,
  ProjectTaskDto,
  TaskMutationResponse,
} from "../../contracts/projects";
import { recalculateHierarchy } from "../../domain/scheduling";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../repositories/project-repository-core";
import {
  ScheduleRepository,
  type LinkRecord,
  type TaskRecord,
} from "../repositories/schedule-repository-core";
import {
  EditSessionInvalidError,
  EmptySummaryNotAllowedError,
  PersistedScheduleInvalidError,
  recalculatePersistedHierarchy,
  RevisionMismatchError,
  TaskNotFoundError,
  UnsupportedScheduleStructureError,
  type AuthorizedEditSession,
} from "./project-service-core";

export interface TaskSubtreeDeleteServiceOptions {
  clock?: () => Date;
}


function taskDtos(tasks: readonly TaskRecord[]): ProjectTaskDto[] {
  const externalIdsByInternalId = new Map(tasks.map((task) => [task.id, task.externalId]));
  return tasks.map((task) => {
    const parentExternalId = task.parentId === null ? null : externalIdsByInternalId.get(task.parentId);
    if (task.parentId !== null && parentExternalId === undefined) {
      throw new PersistedScheduleInvalidError();
    }
    return {
      taskId: task.publicId,
      externalId: task.externalId,
      name: task.name,
      type: task.type,
      scheduleMode: task.scheduleMode,
      requestedStart: task.requestedStart,
      start: task.startDate,
      end: task.endDate,
      duration: task.duration,
      progress: task.progress,
      parentExternalId: parentExternalId ?? null,
      siblingOrder: task.sortOrder,
    };
  });
}

function linkDtos(links: readonly LinkRecord[], tasks: readonly TaskRecord[]): ProjectLinkDto[] {
  const externalIdsByInternalId = new Map(tasks.map((task) => [task.id, task.externalId]));
  return links.map((link) => {
    const predecessorExternalId = externalIdsByInternalId.get(link.predecessorTaskId);
    const successorExternalId = externalIdsByInternalId.get(link.successorTaskId);
    if (!predecessorExternalId || !successorExternalId) {
      throw new PersistedScheduleInvalidError();
    }
    return {
      id: link.publicId,
      predecessorExternalId,
      successorExternalId,
      type: link.type,
      lag: link.lag,
    };
  });
}


function postOrderSubtree(root: TaskRecord, tasks: readonly TaskRecord[]): TaskRecord[] {
  const childrenByParent = new Map<number, TaskRecord[]>();
  for (const task of tasks) {
    if (task.parentId === null) continue;
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const result: TaskRecord[] = [];
  const visit = (task: TaskRecord) => {
    if (visiting.has(task.id)) throw new PersistedScheduleInvalidError();
    if (visited.has(task.id)) return;
    visiting.add(task.id);
    for (const child of childrenByParent.get(task.id) ?? []) visit(child);
    visiting.delete(task.id);
    visited.add(task.id);
    result.push(task);
  };
  visit(root);
  return result;
}

export class TaskSubtreeDeleteService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly clock: () => Date;

  constructor(private readonly database: Database.Database, options: TaskSubtreeDeleteServiceOptions = {}) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.clock = options.clock ?? (() => new Date());
  }

  deleteTaskSubtree(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
  ): TaskMutationResponse {
    const mutate = this.database.transaction(() => {
      const now = this.clock();
      const nowText = now.toISOString();
      const session = this.sessions.findById(authorization.sessionId);
      const project = this.projects.findCredentialById(authorization.projectId);
      const expiresAt = session ? Date.parse(session.expiresAt) : Number.NaN;
      if (
        !session || !project || session.revokedAt !== null ||
        !session.tokenHash.equals(authorization.tokenHash) ||
        session.projectId !== project.id || session.authVersion !== project.authVersion ||
        project.publicId !== authorization.projectPublicId ||
        project.authVersion !== authorization.projectAuthVersion ||
        !Number.isFinite(expiresAt) || expiresAt <= now.getTime()
      ) {
        throw new EditSessionInvalidError();
      }
      if (project.revision !== expectedRevision) throw new RevisionMismatchError();

      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const calendar = resolveProjectWorkingCalendar(this.database, project.id);
      recalculatePersistedHierarchy(tasks, calendar, links);
      const current = tasks.find((task) => task.publicId === taskPublicId);
      if (!current) throw new TaskNotFoundError();

      const deleteOrder = postOrderSubtree(current, tasks);
      const deleteIds = new Set(deleteOrder.map((task) => task.id));
      if (links.some((link) => deleteIds.has(link.predecessorTaskId) || deleteIds.has(link.successorTaskId))) {
        throw new UnsupportedScheduleStructureError();
      }
      if (
        current.parentId !== null &&
        !tasks.some((task) => task.parentId === current.parentId && !deleteIds.has(task.id))
      ) {
        throw new EmptySummaryNotAllowedError();
      }

      for (const task of deleteOrder) {
        if (!this.schedules.deleteTask(project.id, task.publicId)) throw new TaskNotFoundError();
      }

      const remainingTasks = this.schedules.listTasks(project.id);
      let derived: readonly ProjectTaskDto[];
      try {
        derived = recalculateHierarchy(taskDtos(remainingTasks), calendar);
      } catch {
        throw new PersistedScheduleInvalidError();
      }
      const persistedByPublicId = new Map(remainingTasks.map((task) => [task.publicId, task]));
      const changedSummaryExternalIds: string[] = [];
      for (const task of derived) {
        if (task.type !== "summary") continue;
        const persisted = persistedByPublicId.get(task.taskId);
        if (!persisted) throw new PersistedScheduleInvalidError();
        const changed = persisted.startDate !== task.start || persisted.endDate !== task.end ||
          persisted.duration !== task.duration || persisted.progress !== task.progress;
        if (!changed) continue;
        if (!this.schedules.updateSummarySchedule(project.id, task.taskId, {
          startDate: task.start,
          endDate: task.end,
          duration: task.duration,
          progress: task.progress,
          updatedAt: nowText,
        })) {
          throw new PersistedScheduleInvalidError();
        }
        changedSummaryExternalIds.push(task.externalId);
      }

      const updatedProject = this.projects.advanceRevision(project.id, expectedRevision, nowText);
      if (!updatedProject) throw new RevisionMismatchError();
      const latestTasks = this.schedules.listTasks(project.id);
      const latestLinks = this.schedules.listLinks(project.id);
      return {
        data: {
          project: {
            publicId: updatedProject.publicId,
            name: updatedProject.name,
            description: updatedProject.description,
            revision: updatedProject.revision,
            calendar: projectCalendarDto(this.database, project.id),
          },
          tasks: taskDtos(latestTasks),
          links: linkDtos(latestLinks, latestTasks),
          warnings: [],
          operation: {
            kind: "taskDelete",
            changedTaskExternalIds: changedSummaryExternalIds,
            deletedTaskExternalIds: deleteOrder.map((task) => task.externalId),
            deletedLinkIds: [],
          },
        },
      } satisfies TaskMutationResponse;
    });
    return mutate.immediate();
  }
}
