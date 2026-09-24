import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { projectCalendarDto } from "../calendars/calendar-resolution-core";
import { seedDefaultProjectCalendar } from "../calendars/default-calendar-core";

import type {
  CreateTaskRequest,
  ProjectListResponse,
  ProjectMetadataMutationResponse,
  ProjectSnapshotResponse,
  ProjectTaskDto,
  TaskMutationResponse,
  UpdateProjectRequest,
  UpdateTaskRequest,
} from "../../contracts/projects";
import type { ProjectAssignmentDto } from "../../contracts/resources";
import { ProjectOwnerRepository } from "../repositories/project-owner-repository-core";
import { EditSessionRepository, ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import { hashEditPassword, type PasswordHashRecord } from "../security/password-core";
import {
  createSessionToken,
  sessionExpiry,
  type NewSessionToken,
} from "../security/session-core";
import { isCanonicalUuidV4, type CreateProjectInput } from "./project-contract";
import {
  InvalidTaskInputError,
  ProjectService,
  type AuthorizedEditSession,
  type CreatedProject,
  type ProjectServiceOptions,
} from "./project-service-core";

const PUBLIC_ID_ATTEMPTS = 3;

function enrichTasks(tasks: readonly ProjectTaskDto[], records: readonly TaskRecord[]): ProjectTaskDto[] {
  const details = new Map(records.map((task) => [task.publicId, task]));
  return tasks.map((task) => {
    const record = details.get(task.taskId);
    if (!record) return { ...task, description: null, url: null };
    return { ...task, description: record.description, url: record.url };
  });
}

function assignmentDtos(repository: ResourceCatalogRepository, projectId: number): ProjectAssignmentDto[] {
  return repository.listAssignments(projectId).map((assignment) => ({
    id: assignment.publicId,
    taskId: assignment.taskPublicId,
    target: { kind: assignment.kind, id: assignment.targetPublicId },
    allocation: assignment.kind === "resource"
      ? { start: assignment.assignmentStart, end: assignment.assignmentEnd, percent: assignment.allocationPercent }
      : null,
  }));
}

/**
 * Extends the scheduling-focused ProjectService with non-scheduling Task fields,
 * display-only Project owner metadata, and application-owned resource assignment
 * references. Project owner is not an authorization identity.
 */
export class TaskFieldProjectService extends ProjectService {
  private readonly projectsForFields: ProjectRepository;
  private readonly ownersForFields: ProjectOwnerRepository;
  private readonly sessionsForFields: EditSessionRepository;
  private readonly schedulesForFields: ScheduleRepository;
  private readonly resourcesForFields: ResourceCatalogRepository;
  private readonly createClock: () => Date;
  private readonly createPublicId: () => string;
  private readonly createHashPassword: (password: string) => Promise<PasswordHashRecord>;
  private readonly createSession: () => NewSessionToken;

  constructor(
    private readonly fieldDatabase: Database.Database,
    options: ProjectServiceOptions = {},
  ) {
    super(fieldDatabase, options);
    this.projectsForFields = new ProjectRepository(fieldDatabase);
    this.ownersForFields = new ProjectOwnerRepository(fieldDatabase);
    this.sessionsForFields = new EditSessionRepository(fieldDatabase);
    this.schedulesForFields = new ScheduleRepository(fieldDatabase);
    this.resourcesForFields = new ResourceCatalogRepository(fieldDatabase);
    this.createClock = options.clock ?? (() => new Date());
    this.createPublicId = options.generatePublicId ?? randomUUID;
    this.createHashPassword = options.hashPassword ?? hashEditPassword;
    this.createSession = options.generateSessionToken ?? createSessionToken;
  }

  private ownerByProjectId(projectId: number): string | null {
    return this.ownersForFields.findById(projectId) ?? null;
  }

  private enrichMutation<T extends TaskMutationResponse | ProjectMetadataMutationResponse>(
    response: T,
    projectId: number,
  ): T {
    return {
      ...response,
      data: {
        ...response.data,
        project: {
          ...response.data.project,
          ownerName: this.ownerByProjectId(projectId),
        },
        tasks: enrichTasks(response.data.tasks, this.schedulesForFields.listTasks(projectId)),
        assignments: assignmentDtos(this.resourcesForFields, projectId),
      },
    } as T;
  }

  override async create(input: CreateProjectInput): Promise<CreatedProject> {
    const password = await this.createHashPassword(input.editPassword);
    const sessionToken = this.createSession();
    const createdAt = this.createClock();
    const createdAtText = createdAt.toISOString();
    const expiresAtText = sessionExpiry(createdAt).toISOString();
    const ownerName = input.ownerName ?? null;

    for (let attempt = 0; attempt < PUBLIC_ID_ATTEMPTS; attempt += 1) {
      const publicId = this.createPublicId();
      if (!isCanonicalUuidV4(publicId)) continue;

      const createAggregate = this.fieldDatabase.transaction(() => {
        const project = this.projectsForFields.insert({
          publicId,
          name: input.name,
          description: input.description,
          status: input.status ?? "planned",
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
        if (!this.ownersForFields.setByPublicId(publicId, ownerName)) {
          throw new Error("Created project owner metadata could not be persisted.");
        }
        seedDefaultProjectCalendar(
          this.fieldDatabase,
          project.id,
          createdAtText,
          createdAt.getUTCFullYear(),
        );
        this.sessionsForFields.insert({
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
              project: {
                publicId: project.publicId,
                name: project.name,
                description: project.description,
                status: project.status,
                ownerName,
                revision: project.revision,
                calendar: projectCalendarDto(this.fieldDatabase, project.id),
              },
              permission: "edit",
            },
          },
          rawSessionToken: sessionToken.rawToken,
        };
      } catch (error) {
        if (this.projectsForFields.findByPublicId(publicId)) continue;
        throw error;
      }
    }

    throw new Error("A unique project identifier could not be generated.");
  }

  override listProjects(): ProjectListResponse {
    const response = super.listProjects();
    const owners = this.ownersForFields.list();
    return {
      data: {
        projects: response.data.projects.map((project) => ({
          ...project,
          ownerName: owners.get(project.publicId) ?? null,
        })),
      },
    };
  }

  override getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined {
    const response = super.getReadonlySnapshot(publicId);
    if (!response) return undefined;
    const project = this.projectsForFields.findByPublicId(publicId);
    if (!project) return undefined;
    return {
      ...response,
      data: {
        ...response.data,
        project: {
          ...response.data.project,
          ownerName: this.ownersForFields.findByPublicId(publicId) ?? null,
        },
        tasks: enrichTasks(response.data.tasks, this.schedulesForFields.listTasks(project.id)),
        assignments: assignmentDtos(this.resourcesForFields, project.id),
      },
    };
  }

  override createTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateTaskRequest,
  ): TaskMutationResponse {
    const mutation = this.fieldDatabase.transaction(() => {
      const response = super.createTask(authorization, expectedRevision, input);
      if (input.description !== undefined || input.url !== undefined) {
        const createdExternalId = response.data.operation.changedTaskExternalIds[0];
        const created = createdExternalId
          ? this.schedulesForFields.findTaskByExternalId(authorization.projectId, createdExternalId)
          : undefined;
        if (!created || !this.schedulesForFields.updateTaskDetails(authorization.projectId, created.publicId, {
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.url !== undefined ? { url: input.url } : {}),
        })) {
          throw new Error("Created task details could not be persisted.");
        }
      }
      return this.enrichMutation(response, authorization.projectId);
    });
    return mutation.immediate();
  }

  override updateTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
    input: UpdateTaskRequest,
  ): TaskMutationResponse {
    const mutation = this.fieldDatabase.transaction(() => {
      const response = super.updateTask(authorization, expectedRevision, taskPublicId, input);
      const updatedSchedule = this.schedulesForFields.findTaskByPublicId(authorization.projectId, taskPublicId);
    if (!updatedSchedule) throw new Error("Updated task schedule could not be read back.");
    if (updatedSchedule.type === "task") {
      const invalidAllocation = this.resourcesForFields.listAssignments(authorization.projectId).some((assignment) =>
        assignment.kind === "resource" && assignment.taskPublicId === taskPublicId &&
        ((assignment.assignmentStart !== null && (assignment.assignmentStart < updatedSchedule.startDate || assignment.assignmentStart > updatedSchedule.endDate)) ||
          (assignment.assignmentEnd !== null && (assignment.assignmentEnd < updatedSchedule.startDate || assignment.assignmentEnd > updatedSchedule.endDate))),
      );
      if (invalidAllocation) throw new InvalidTaskInputError();
    }
      if (input.description !== undefined || input.url !== undefined) {
        const updated = this.schedulesForFields.updateTaskDetails(authorization.projectId, taskPublicId, {
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.url !== undefined ? { url: input.url } : {}),
        });
        if (!updated) throw new Error("Updated task details could not be persisted.");
      }
      return this.enrichMutation(response, authorization.projectId);
    });
    return mutation.immediate();
  }

  override deleteTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
  ): TaskMutationResponse {
    return this.enrichMutation(
      super.deleteTask(authorization, expectedRevision, taskPublicId),
      authorization.projectId,
    );
  }

  override updateMetadata(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: UpdateProjectRequest,
  ): ProjectMetadataMutationResponse {
    return this.enrichMutation(
      super.updateMetadata(authorization, expectedRevision, input),
      authorization.projectId,
    );
  }
}
