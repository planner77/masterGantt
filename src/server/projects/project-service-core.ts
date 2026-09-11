import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  CreateProjectResponse,
  ProjectDto,
  ProjectLinkDto,
  ProjectSnapshotResponse,
  ProjectTaskDto,
} from "../../contracts/projects";
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
  hashEditPassword,
  type PasswordHashRecord,
} from "../security/password-core";
import {
  createSessionToken,
  sessionExpiry,
  type NewSessionToken,
} from "../security/session-core";
import {
  isCanonicalUuidV4,
  type CreateProjectInput,
} from "./project-contract";

const PUBLIC_ID_ATTEMPTS = 3;

export interface ProjectServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  hashPassword?: (password: string) => Promise<PasswordHashRecord>;
  generateSessionToken?: () => NewSessionToken;
}

export interface CreatedProject {
  response: CreateProjectResponse;
  rawSessionToken: string;
}

function projectDto(
  project: {
    publicId: string;
    name: string;
    description: string;
    revision: number;
    calendarTimezone: string;
  },
  holidays: { holidayDate: string; name: string | null }[] = [],
): ProjectDto {
  if (project.calendarTimezone !== "Asia/Seoul") {
    throw new Error("Unsupported persisted project timezone.");
  }

  return {
    publicId: project.publicId,
    name: project.name,
    description: project.description,
    revision: project.revision,
    calendar: {
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: holidays.map((holiday) => ({
        date: holiday.holidayDate,
        name: holiday.name,
      })),
    },
  };
}

function taskDtos(tasks: TaskRecord[]): ProjectTaskDto[] {
  const externalIdsByInternalId = new Map(
    tasks.map((task) => [task.id, task.externalId]),
  );

  return tasks.map((task) => {
    const parentExternalId = task.parentId === null
      ? null
      : externalIdsByInternalId.get(task.parentId);
    if (task.parentId !== null && parentExternalId === undefined) {
      throw new Error("Persisted task parent is outside the project snapshot.");
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

function linkDtos(
  links: LinkRecord[],
  tasks: TaskRecord[],
): ProjectLinkDto[] {
  const externalIdsByInternalId = new Map(
    tasks.map((task) => [task.id, task.externalId]),
  );

  return links.map((link) => {
    const predecessorExternalId = externalIdsByInternalId.get(
      link.predecessorTaskId,
    );
    const successorExternalId = externalIdsByInternalId.get(
      link.successorTaskId,
    );
    if (!predecessorExternalId || !successorExternalId) {
      throw new Error("Persisted dependency is outside the project snapshot.");
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

export class ProjectService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly hashPassword: (
    password: string,
  ) => Promise<PasswordHashRecord>;
  private readonly generateSessionToken: () => NewSessionToken;

  constructor(
    private readonly database: Database.Database,
    options: ProjectServiceOptions = {},
  ) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.hashPassword = options.hashPassword ?? hashEditPassword;
    this.generateSessionToken =
      options.generateSessionToken ?? createSessionToken;
  }

  async create(input: CreateProjectInput): Promise<CreatedProject> {
    const password = await this.hashPassword(input.editPassword);
    const sessionToken = this.generateSessionToken();
    const createdAt = this.clock();
    const createdAtText = createdAt.toISOString();
    const expiresAtText = sessionExpiry(createdAt).toISOString();

    for (let attempt = 0; attempt < PUBLIC_ID_ATTEMPTS; attempt += 1) {
      const publicId = this.generatePublicId();
      if (!isCanonicalUuidV4(publicId)) {
        continue;
      }

      const createAggregate = this.database.transaction(() => {
        const project = this.projects.insert({
          publicId,
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
          createdAt: createdAtText,
          updatedAt: createdAtText,
        });
        this.sessions.insert({
          projectId: project.id,
          tokenHash: sessionToken.tokenHash,
          authVersion: project.authVersion,
          createdAt: createdAtText,
          expiresAt: expiresAtText,
        });
        return project;
      });

      try {
        const project = createAggregate.immediate();
        return {
          response: {
            data: {
              project: projectDto(project),
              permission: "edit",
            },
          },
          rawSessionToken: sessionToken.rawToken,
        };
      } catch (error) {
        if (this.projects.findByPublicId(publicId)) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("A unique project identifier could not be generated.");
  }

  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined {
    const readSnapshot = this.database.transaction(() => {
      const project = this.projects.findByPublicId(publicId);
      if (!project) {
        return undefined;
      }

      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const holidays = this.schedules.listHolidays(project.id);

      return {
        data: {
          project: projectDto(project, holidays),
          tasks: taskDtos(tasks),
          links: linkDtos(links, tasks),
          permission: "readonly" as const,
        },
      };
    });

    return readSnapshot.deferred();
  }
}
