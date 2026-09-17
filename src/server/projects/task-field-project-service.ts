import type Database from "better-sqlite3";

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
import { ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import type { CreateProjectInput } from "./project-contract";
import {
  ProjectService,
  type AuthorizedEditSession,
  type CreatedProject,
  type ProjectServiceOptions,
} from "./project-service-core";

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
    target: {
      kind: assignment.kind,
      id: assignment.targetPublicId,
    },
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
  private readonly schedulesForFields: ScheduleRepository;
  private readonly resourcesForFields: ResourceCatalogRepository;

  constructor(
    private readonly fieldDatabase: Database.Database,
    options: ProjectServiceOptions = {},
  ) {
    super(fieldDatabase, options);
    this.projectsForFields = new ProjectRepository(fieldDatabase);
    this.ownersForFields = new ProjectOwnerRepository(fieldDatabase);
    this.schedulesForFields = new ScheduleRepository(fieldDatabase);
    this.resourcesForFields = new ResourceCatalogRepository(fieldDatabase);
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
    const created = await super.create(input);
    const publicId = created.response.data.project.publicId;
    const ownerName = input.ownerName ?? null;
    if (!this.ownersForFields.setByPublicId(publicId, ownerName)) {
      throw new Error("Created project owner metadata could not be persisted.");
    }
    return {
      ...created,
      response: {
        ...created.response,
        data: {
          ...created.response.data,
          project: {
            ...created.response.data.project,
            ownerName,
          },
        },
      },
    };
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
