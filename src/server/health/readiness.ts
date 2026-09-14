import { readApplicationConfiguration } from "../security/origin-core";
import "server-only";

import { join } from "node:path";

import type { ReadinessResult } from "./readiness-core";
import { checkConfiguredReadiness } from "./readiness-service-core";

export function getReadiness(): ReadinessResult {
  return checkConfiguredReadiness({
    databasePath: process.env.DATABASE_PATH,
    ...readApplicationConfiguration(process.env),
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  });
}
