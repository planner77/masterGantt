import type Database from "better-sqlite3";

import type { ProjectTaskDto, TaskMutationResponse } from "../../contracts/projects";
import { ScheduleRepository, type TaskRecord } from "../repositories/schedule-repository-core";
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
