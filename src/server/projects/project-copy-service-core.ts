import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import type {
  CopyProjectRequest,
  CopyProjectResponse,
  ProjectTaskDto,
} from "../../contracts/projects";
import {
  createWorkingCalendar,
  recalculateHierarchy,
} from "../../domain/scheduling";
import {
  EditSessionRepository,
  ProjectRepository,
} from "../repositories/project-repository-core";
import {
  ScheduleRepository,
  type TaskRecord,
} from "../repositories/schedule-repository-core";
import {
  hashEditPassword,
  type PasswordHashRecord,
} from "../security/password-core";
import {
  createSessionToken,
  sessionExpiry,
  type NewSessionToken,
} from "../security/session-core";
import { isCanonicalUuidV4 } from "./project-contract";
import {
  EditSessionInvalidError,
  PersistedScheduleInvalidError,
  RevisionMismatchError,
  recalculatePersistedHierarchy,
  type AuthorizedEditSession,
} from "./project-service-core";

const ID_ATTEMPTS = 3;
const MAX_PROJECT_TASKS = 5_000;

export interface ProjectCopyServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  generateTaskPublicId?: () => string;
  generateLinkPublicId?: () => string;
  hashPassword?: (password: string) => Promise<PasswordHashRecord>;
  generateSessionToken?: () => NewSessionToken;
}

export interface CopiedProject {
  response: CopyProjectResponse;
  rawSessionToken: string;
}

function dtoTasks(tasks: readonly TaskRecord[]): ProjectTaskDto[] {
  const externalById = new Map(tasks.map((task) => [task.id, task.externalId]));
  return tasks.map((task) => ({
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
    parentExternalId: task.parentId === null
      ? null
      : externalById.get(task.parentId) ?? null,
    siblingOrder: task.sortOrder,
  }));
}

function validSession(
  session: ReturnType<EditSessionRepository["findById"]>,
  project: ReturnType<ProjectRepository["findCredentialById"]>,
  authorization: AuthorizedEditSession,
  now: Date,
): boolean {
  if (!session || !project || session.revokedAt !== null) return false;
  const expiry = Date.parse(session.expiresAt);
  return session.projectId === project.id &&
    project.publicId === authorization.projectPublicId &&
    project.authVersion === authorization.projectAuthVersion &&
    session.authVersion === project.authVersion &&
    session.tokenHash.equals(authorization.tokenHash) &&
    Number.isFinite(expiry) &&
    expiry > now.getTime();
}

export class ProjectCopyService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly generateTaskPublicId: () => string;
  private readonly generateLinkPublicId: () => string;
  private readonly hashPassword: (password: string) => Promise<PasswordHashRecord>;
  private readonly generateSessionToken: () => NewSessionToken;

  constructor(
    private readonly database: Database.Database,
    options: ProjectCopyServiceOptions = {},
  ) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.generateTaskPublicId = options.generateTaskPublicId ?? randomUUID;
    this.generateLinkPublicId = options.generateLinkPublicId ?? randomUUID;
    this.hashPassword = options.hashPassword ?? hashEditPassword;
    this.generateSessionToken = options.generateSessionToken ?? createSessionToken;
  }

  async copy(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CopyProjectRequest,
  ): Promise<CopiedProject> {
    const password = await this.hashPassword(input.editPassword);
    const newSession = this.generateSessionToken();

    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
      const newPublicId = this.generatePublicId();
      if (!isCanonicalUuidV4(newPublicId) || this.projects.findByPublicId(newPublicId)) {
        continue;
      }

      const transaction = this.database.transaction((): CopiedProject => {
        const now = this.clock();
        const nowText = now.toISOString();
        const source = this.projects.findCredentialById(authorization.projectId);
        const sourceSession = this.sessions.findById(authorization.sessionId);

        if (!validSession(sourceSession, source, authorization, now)) {
          throw new EditSessionInvalidError();
        }
        if (!source || source.revision !== expectedRevision) {
          throw new RevisionMismatchError();
        }

        const sourceTasks = this.schedules.listTasks(source.id);
        const sourceLinks = this.schedules.listLinks(source.id);
        const sourceHolidays = this.schedules.listHolidays(source.id);
        if (sourceTasks.length > MAX_PROJECT_TASKS) {
          throw new PersistedScheduleInvalidError();
        }

        const calendar = createWorkingCalendar({
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: sourceHolidays.map((holiday) => ({
            date: holiday.holidayDate,
            name: holiday.name,
          })),
        });
        recalculatePersistedHierarchy(sourceTasks, calendar);

        const project = this.projects.insert({
          publicId: newPublicId,
          name: input.name,
          description: input.description,
          passwordKdf: password.algorithm,
          passwordSalt: password.salt,
          passwordHash: password.hash,
          scryptN: password.n,
          scryptR: password.r,
          scryptP: password.p,
          scryptKeyLength: password.keyLength,
          calendarTimezone: "Asia/Seoul",
          createdAt: nowText,
          updatedAt: nowText,
        });

        for (const holiday of sourceHolidays) {
          this.schedules.insertHoliday(
            project.id,
            holiday.holidayDate,
            holiday.name,
            nowText,
          );
        }

        const newBySourceId = new Map<number, TaskRecord>();
        const pending = [...sourceTasks];
        while (pending.length > 0) {
          let insertedThisPass = 0;
          for (let index = pending.length - 1; index >= 0; index -= 1) {
            const sourceTask = pending[index];
            if (
              sourceTask.parentId !== null &&
              !newBySourceId.has(sourceTask.parentId)
            ) {
              continue;
            }

            let taskPublicId = "";
            for (let idAttempt = 0; idAttempt < ID_ATTEMPTS; idAttempt += 1) {
              const candidate = this.generateTaskPublicId();
              if (
                isCanonicalUuidV4(candidate) &&
                !this.schedules.taskPublicIdExists(candidate)
              ) {
                taskPublicId = candidate;
                break;
              }
            }
            if (!taskPublicId) {
              throw new Error("Unique task identifier could not be generated.");
            }

            const inserted = this.schedules.insertTask({
              projectId: project.id,
              externalId: sourceTask.externalId,
              publicId: taskPublicId,
              name: sourceTask.name,
              type: sourceTask.type,
              scheduleMode: sourceTask.scheduleMode,
              requestedStart: sourceTask.requestedStart,
              startDate: sourceTask.startDate,
              endDate: sourceTask.endDate,
              duration: sourceTask.duration,
              progress: input.resetProgress && sourceTask.type !== "summary"
                ? 0
                : sourceTask.progress,
              parentId: sourceTask.parentId === null
                ? null
                : newBySourceId.get(sourceTask.parentId)!.id,
              sortOrder: sourceTask.sortOrder,
              createdAt: nowText,
              updatedAt: nowText,
            });
            newBySourceId.set(sourceTask.id, inserted);
            pending.splice(index, 1);
            insertedThisPass += 1;
          }

          if (insertedThisPass === 0) {
            throw new PersistedScheduleInvalidError();
          }
        }

        if (input.resetProgress) {
          const copiedTasks = this.schedules.listTasks(project.id);
          const derived = recalculateHierarchy(dtoTasks(copiedTasks), calendar);
          for (const task of derived) {
            if (task.type !== "summary") continue;
            if (!this.schedules.updateSummarySchedule(project.id, task.taskId, {
              startDate: task.start,
              endDate: task.end,
              duration: task.duration,
              progress: task.progress,
              updatedAt: nowText,
            })) {
              throw new PersistedScheduleInvalidError();
            }
          }
        }

        for (const sourceLink of sourceLinks) {
          const predecessor = newBySourceId.get(sourceLink.predecessorTaskId);
          const successor = newBySourceId.get(sourceLink.successorTaskId);
          if (!predecessor || !successor) {
            throw new PersistedScheduleInvalidError();
          }

          let linkPublicId = "";
          for (let idAttempt = 0; idAttempt < ID_ATTEMPTS; idAttempt += 1) {
            const candidate = this.generateLinkPublicId();
            if (
              isCanonicalUuidV4(candidate) &&
              !this.schedules.linkPublicIdExists(candidate)
            ) {
              linkPublicId = candidate;
              break;
            }
          }
          if (!linkPublicId) {
            throw new Error("Unique link identifier could not be generated.");
          }

          this.schedules.insertLink({
            publicId: linkPublicId,
            projectId: project.id,
            predecessorTaskId: predecessor.id,
            successorTaskId: successor.id,
            type: sourceLink.type,
            lag: sourceLink.lag,
            createdAt: nowText,
            updatedAt: nowText,
          });
        }

        this.sessions.insert({
          projectId: project.id,
          tokenHash: newSession.tokenHash,
          authVersion: project.authVersion,
          createdAt: nowText,
          expiresAt: sessionExpiry(now).toISOString(),
        });

        const copiedTasks = this.schedules.listTasks(project.id);
        const copiedLinks = this.schedules.listLinks(project.id);
        const externalById = new Map(
          copiedTasks.map((task) => [task.id, task.externalId]),
        );

        const response: CopyProjectResponse = {
          data: {
            project: {
              publicId: project.publicId,
              name: project.name,
              description: project.description,
              revision: project.revision,
              calendar: {
                timezone: "Asia/Seoul",
                weekendDays: [6, 0],
                holidays: sourceHolidays.map((holiday) => ({
                  date: holiday.holidayDate,
                  name: holiday.name,
                })),
              },
            },
            tasks: dtoTasks(copiedTasks),
            links: copiedLinks.map((link) => ({
              id: link.publicId,
              predecessorExternalId: externalById.get(link.predecessorTaskId)!,
              successorExternalId: externalById.get(link.successorTaskId)!,
              type: link.type,
              lag: link.lag,
            })),
            permission: "edit",
            operation: {
              kind: "projectCopy",
              sourcePublicId: source.publicId,
              sourceRevision: source.revision,
              counts: {
                tasks: copiedTasks.length,
                links: copiedLinks.length,
                holidays: sourceHolidays.length,
              },
            },
            warnings: [],
          },
        };

        return {
          response,
          rawSessionToken: newSession.rawToken,
        };
      });

      try {
        return transaction.immediate();
      } catch (error) {
        if (this.projects.findByPublicId(newPublicId)) continue;
        throw error;
      }
    }

    throw new Error("A unique project identifier could not be generated.");
  }
}
