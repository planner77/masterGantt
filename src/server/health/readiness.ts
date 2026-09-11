import "server-only";

import { join } from "node:path";

import type { ReadinessResult } from "./readiness-core";
import { checkConfiguredReadiness } from "./readiness-service-core";

export function getReadiness(): ReadinessResult {
  return checkConfiguredReadiness({
    databasePath: process.env.DATABASE_PATH,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  });
}
