import "server-only";

import { getDatabase } from "../db";
import { ProjectMasterService } from "./project-master-service-core";

export function getProjectMasterService(): ProjectMasterService {
  return new ProjectMasterService(getDatabase());
}
