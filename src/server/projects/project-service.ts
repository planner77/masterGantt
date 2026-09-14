import "server-only";

import { getDatabase } from "../db";
import { ProjectService } from "./project-service-core";
import { TaskSubtreeDeleteService } from "./task-subtree-delete-service-core";

export function getProjectService(): ProjectService {
  return new ProjectService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskSubtreeDeleteService {
  return new TaskSubtreeDeleteService(getDatabase());
}
