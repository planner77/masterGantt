import "server-only";

import { getDatabase } from "../db";
import { ProjectTemplateService } from "./project-template-service-core";

export function getProjectTemplateService(): ProjectTemplateService {
  return new ProjectTemplateService(getDatabase());
}
