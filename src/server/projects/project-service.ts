import "server-only";

import { getDatabase } from "../db";
import { ProjectService } from "./project-service-core";

export function getProjectService(): ProjectService {
  return new ProjectService(getDatabase());
}
