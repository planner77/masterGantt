import "server-only";

import { getDatabase } from "../db";
import { TaskFieldProjectService } from "../projects/task-field-project-service";
import { LogisticsService } from "./logistics-service-core";
import { LogisticsDashboardService } from "./logistics-dashboard-service";

export function getLogisticsService() {
  const database = getDatabase();
  const project = new TaskFieldProjectService(database);
  const logistics = new LogisticsService(database);
  const dashboard = new LogisticsDashboardService(database, { mdPerMmEnvironment: process.env.RESOURCE_MD_PER_MM });
  return {
    logistics,
    project,
    dashboard,
    authorize: project.authorize.bind(project),
  };
}
