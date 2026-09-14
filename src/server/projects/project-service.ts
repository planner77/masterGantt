import "server-only";

import { getDatabase } from "../db";
import { ProjectCopyService } from "./project-copy-service-core";
import { ProjectService } from "./project-service-core";
import { TaskSubtreeDeleteService } from "./task-subtree-delete-service-core";

export function getProjectService(): ProjectService {
  return new ProjectService(getDatabase());
}

export function getProjectCopyService(): ProjectCopyService {
  return new ProjectCopyService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskSubtreeDeleteService {
  return new TaskSubtreeDeleteService(getDatabase());
}
