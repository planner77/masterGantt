import "server-only";

import { join } from "node:path";

import { getServerLogger } from "../logging/logger";
import { readApplicationConfiguration } from "../security/origin-core";
import type { ReadinessResult } from "./readiness-core";
import {
  diagnoseConfiguredReadiness,
  type ConfiguredReadinessFailureReason,
} from "./readiness-service-core";

interface PreviousReadinessState {
  status: ReadinessResult["status"];
  reason?: ConfiguredReadinessFailureReason;
}

let previousState: PreviousReadinessState | undefined;

export function getReadiness(): ReadinessResult {
  const diagnostic = diagnoseConfiguredReadiness({
    databasePath: process.env.DATABASE_PATH,
    ...readApplicationConfiguration(process.env),
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  });
  const logger = getServerLogger();

  if (diagnostic.result.status === "unavailable") {
    if (previousState?.status !== "unavailable" || previousState.reason !== diagnostic.reason) {
      logger.error("readiness_unavailable", {
        component: "readiness",
        reasonCode: diagnostic.reason,
      });
    }
    previousState = { status: "unavailable", reason: diagnostic.reason };
    return diagnostic.result;
  }

  if (previousState?.status === "unavailable") {
    logger.info("readiness_recovered", {
      component: "readiness",
      previousReasonCode: previousState.reason,
    });
  }
  previousState = { status: "ok" };
  return diagnostic.result;
}

export function resetReadinessLoggingStateForTests(): void {
  previousState = undefined;
}
