import type Database from "better-sqlite3";

import type {
  CreateTaskRequest,
  ProjectMetadataMutationResponse,
  ProjectSnapshotResponse,
  ProjectTaskDto,
  TaskMutationResponse,
  UpdateProjectRequest,
  UpdateTaskRequest,
} from "../../contracts/projects";
import type { ProjectAssignmentDto } from "../../contracts/resources";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import {
  ProjectService,
  type AuthorizedEditSession,
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
 * Extends the scheduling-focused ProjectService with non-scheduling Task fields
 * and application-owned resource assignment references. Resource assignment is
 * deliberately independent from the scheduler and SVAR PRO resource APIs.
 */
export class TaskFieldProjectService extends ProjectService {
  private readonly projectsForFields: ProjectRepository;
  private readonly schedulesForFields: ScheduleRepository;
  private readonly resourcesForFields: ResourceCatalogRepository;

  constructor(
    private readonly fieldDatabase: Database.Database,
    options: ProjectServiceOptions = {},
  ) {
    super(fieldDatabase, options);
    this.projectsForFields = new ProjectRepository(fieldDatabase);
    this.schedulesForFields = new ScheduleRepository(fieldDatabase);
    this.resourcesForFields = new ResourceCatalogRepository(fieldDatabase);
  }

  private enrichMutation<T extends TaskMutationResponse | ProjectMetadataMutationResponse>(
    response: T,
    projectId: number,
  ): T {
    return {
      ...response,
      data: {
        ...response.data,
        tasks: enrichTasks(response.data.tasks, this.schedulesForFields.listTasks(projectId)),
        assignments: assignmentDtos(this.resourcesForFields, projectId),
      },
    } as T;
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
