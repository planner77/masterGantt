import "server-only";

import { getDatabase } from "../db";
import { TaskFieldProjectService } from "../projects/task-field-project-service";
import { LogisticsService } from "./logistics-service-core";

export function getLogisticsService() {
  const database = getDatabase();
  const project = new TaskFieldProjectService(database);
  const logistics = new LogisticsService(database);
  return {
    logistics,
    project,
    authorize: project.authorize.bind(project),
  };
}
