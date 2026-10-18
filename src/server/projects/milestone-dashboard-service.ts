import "server-only";
import { getDatabase } from "../db";
import { MilestoneDashboardService } from "./milestone-dashboard-service-core";

export function getMilestoneDashboardService() {
  return new MilestoneDashboardService(getDatabase(), { mdPerMmEnvironment: process.env.RESOURCE_MD_PER_MM });
}
