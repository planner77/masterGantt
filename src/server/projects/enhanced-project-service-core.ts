import type Database from "better-sqlite3";

import type {
  CreateTaskRequest,
  ProjectSnapshotResponse,
  ProjectTaskDto,
  TaskMutationResponse,
  UpdateTaskRequest,
} from "../../contracts/projects";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import {
  ProjectService,
  type AuthorizedEditSession,
  type ProjectServiceOptions,
} from "./project-service-core";

function enrichTasks(tasks: readonly ProjectTaskDto[], records: readonly TaskRecord[]): ProjectTaskDto[] {
  const details = new Map(records.map((record) => [record.publicId, record]));
  return tasks.map((task) => {
    const record = details.get(task.taskId);
    return { ...task, description: record?.description ?? null, url: record?.url ?? null };
  });
}

/** Keeps Issue #36 detail fields inside the same SQLite transaction/revision as the existing scheduler mutation. */
export class EnhancedProjectService extends ProjectService {
  private readonly detailDatabase: Database.Database;
  private readonly detailProjects: ProjectRepository;
  private readonly detailSchedules: ScheduleRepository;

  constructor(database: Database.Database, options: ProjectServiceOptions = {}) {
    super(database, options);
    this.detailDatabase = database;
    this.detailProjects = new ProjectRepository(database);
    this.detailSchedules = new ScheduleRepository(database);
  }

  override getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined {
    const snapshot = super.getReadonlySnapshot(publicId);
    if (!snapshot) return undefined;
    const project = this.detailProjects.findByPublicId(publicId);
    if (!project) return undefined;
    return { data: { ...snapshot.data, tasks: enrichTasks(snapshot.data.tasks, this.detailSchedules.listTasks(project.id)) } };
  }

  private enrichMutation(response: TaskMutationResponse, projectId: number): TaskMutationResponse {
    return { data: { ...response.data, tasks: enrichTasks(response.data.tasks, this.detailSchedules.listTasks(projectId)) } };
  }

  override createTask(authorization: AuthorizedEditSession, expectedRevision: number, input: CreateTaskRequest): TaskMutationResponse {
    return this.detailDatabase.transaction(() => {
      const response = super.createTask(authorization, expectedRevision, input);
      if (input.description !== undefined || input.url !== undefined) {
        const externalId = response.data.operation.changedTaskExternalIds[0];
        const created = this.detailSchedules.findTaskByExternalId(authorization.projectId, externalId);
        if (!created) throw new Error("Created task details could not be applied.");
        const updated = this.detailSchedules.updateTaskDetails(
          authorization.projectId,
          created.publicId,
          { description: input.description, url: input.url },
          new Date().toISOString(),
        );
        if (!updated) throw new Error("Created task details could not be applied.");
      }
      return this.enrichMutation(response, authorization.projectId);
    }).immediate();
  }

  override updateTask(authorization: AuthorizedEditSession, expectedRevision: number, taskPublicId: string, input: UpdateTaskRequest): TaskMutationResponse {
    return this.detailDatabase.transaction(() => {
      const response = super.updateTask(authorization, expectedRevision, taskPublicId, input);
      if (input.description !== undefined || input.url !== undefined) {
        const updated = this.detailSchedules.updateTaskDetails(
          authorization.projectId,
          taskPublicId,
          { description: input.description, url: input.url },
          new Date().toISOString(),
        );
        if (!updated) throw new Error("Updated task details could not be applied.");
      }
      return this.enrichMutation(response, authorization.projectId);
    }).immediate();
  }
}
