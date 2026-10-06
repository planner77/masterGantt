import "server-only";
import { getDatabase } from "../db";
import { getProjectService } from "../projects/project-service";
import { ProjectImportService } from "./project-import-service-core";
export function getProjectImportService() {
  return new ProjectImportService(getDatabase(), { projectService: getProjectService() });
}
