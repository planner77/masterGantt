import "server-only";
import { getDatabase } from "../db";
import { ResourceDashboardService } from "./resource-dashboard-service-core";

export function getResourceDashboardService() {
  return new ResourceDashboardService(getDatabase(), { mdPerMmEnvironment: process.env.RESOURCE_MD_PER_MM });
}
