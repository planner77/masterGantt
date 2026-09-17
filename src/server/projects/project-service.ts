import "server-only";

import { getDatabase } from "../db";
import { ProjectOwnerCopyService } from "./project-owner-copy-service";
import { TaskFieldSubtreeDeleteService } from "./task-field-companion-services";
import { TaskFieldProjectService } from "./task-field-project-service";

export function getProjectService(): TaskFieldProjectService {
  return new TaskFieldProjectService(getDatabase());
}

export function getProjectCopyService(): ProjectOwnerCopyService {
  return new ProjectOwnerCopyService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskFieldSubtreeDeleteService {
  return new TaskFieldSubtreeDeleteService(getDatabase());
}
