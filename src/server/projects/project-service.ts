import "server-only";

import { getDatabase } from "../db";
import { EnhancedProjectService } from "./enhanced-project-service-core";
import { TaskSubtreeDeleteService } from "./task-subtree-delete-service-core";

export function getProjectService(): EnhancedProjectService {
  return new EnhancedProjectService(getDatabase());
}

export function getTaskSubtreeDeleteService(): TaskSubtreeDeleteService {
  return new TaskSubtreeDeleteService(getDatabase());
}
