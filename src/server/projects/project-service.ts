import "server-only";

import { getDatabase } from "../db";
import { ProjectCopyService } from "./project-copy-service-core";
import { TaskFieldSubtreeDeleteService } from "./task-field-companion-services";
import { TaskFieldProjectService } from "./task-field-project-service";
import { TaskHierarchyService } from "./task-hierarchy-service-core";

export function getProjectService(): TaskFieldProjectService {
  return new TaskFieldProjectService(getDatabase());
}

export function getProjectCopyService(): ProjectCopyService {
  return new ProjectCopyService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskFieldSubtreeDeleteService {
  return new TaskFieldSubtreeDeleteService(getDatabase());
}

export function getTaskHierarchyService(): TaskHierarchyService {
  return new TaskHierarchyService(getDatabase());
}
