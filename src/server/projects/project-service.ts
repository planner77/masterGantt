import "server-only";

import { getDatabase } from "../db";
import { TaskFieldProjectCopyService, TaskFieldSubtreeDeleteService } from "./task-field-companion-services";
import { TaskFieldProjectService } from "./task-field-project-service";

export function getProjectService(): TaskFieldProjectService {
  return new TaskFieldProjectService(getDatabase());
}

export function getProjectCopyService(): TaskFieldProjectCopyService {
  return new TaskFieldProjectCopyService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskFieldSubtreeDeleteService {
  return new TaskFieldSubtreeDeleteService(getDatabase());
}
