import type Database from "better-sqlite3";

import type { CopyProjectRequest, ProjectTaskDto, TaskMutationResponse } from "../../contracts/projects";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
import {
  ProjectCopyService,
  type CopiedProject,
  type ProjectCopyServiceOptions,
} from "./project-copy-service-core";
import {
  TaskSubtreeDeleteService,
  type TaskSubtreeDeleteServiceOptions,
} from "./task-subtree-delete-service-core";
import type { AuthorizedEditSession } from "./project-service-core";

function enrichTasks(tasks: readonly ProjectTaskDto[], records: readonly TaskRecord[]): ProjectTaskDto[] {
  const details = new Map(records.map((task) => [task.publicId, task]));
  return tasks.map((task) => {
    const record = details.get(task.taskId);
    return { ...task, description: record?.description ?? null, url: record?.url ?? null };
  });
}

export class TaskFieldProjectCopyService extends ProjectCopyService {
  private readonly projectsForFields: ProjectRepository;
  private readonly schedulesForFields: ScheduleRepository;

  constructor(
    private readonly fieldDatabase: Database.Database,
    options: ProjectCopyServiceOptions = {},
  ) {
    super(fieldDatabase, options);
    this.projectsForFields = new ProjectRepository(fieldDatabase);
    this.schedulesForFields = new ScheduleRepository(fieldDatabase);
  }

  override async copy(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CopyProjectRequest,
  ): Promise<CopiedProject> {
    const sourceDetails = new Map(
      this.schedulesForFields.listTasks(authorization.projectId)
        .map((task) => [task.externalId, { description: task.description, url: task.url }] as const),
    );
    const copied = await super.copy(authorization, expectedRevision, input);
    const targetProject = this.projectsForFields.findByPublicId(copied.response.data.project.publicId);
    if (!targetProject) throw new Error("Copied project could not be read back.");

    const persistDetails = this.fieldDatabase.transaction(() => {
      for (const task of this.schedulesForFields.listTasks(targetProject.id)) {
        const details = sourceDetails.get(task.externalId);
        if (!details) continue;
        if (!this.schedulesForFields.updateTaskDetails(targetProject.id, task.publicId, details)) {
          throw new Error("Copied task details could not be persisted.");
        }
      }
      return this.schedulesForFields.listTasks(targetProject.id);
    });
    const records = persistDetails.immediate();
    return {
      ...copied,
      response: {
        ...copied.response,
        data: {
          ...copied.response.data,
          tasks: enrichTasks(copied.response.data.tasks, records),
        },
      },
    };
  }
}

export class TaskFieldSubtreeDeleteService extends TaskSubtreeDeleteService {
  private readonly schedulesForFields: ScheduleRepository;

  constructor(
    fieldDatabase: Database.Database,
    options: TaskSubtreeDeleteServiceOptions = {},
  ) {
    super(fieldDatabase, options);
    this.schedulesForFields = new ScheduleRepository(fieldDatabase);
  }

  override deleteTaskSubtree(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
  ): TaskMutationResponse {
    const response = super.deleteTaskSubtree(authorization, expectedRevision, taskPublicId);
    return {
      ...response,
      data: {
        ...response.data,
        tasks: enrichTasks(response.data.tasks, this.schedulesForFields.listTasks(authorization.projectId)),
      },
    };
  }
}
