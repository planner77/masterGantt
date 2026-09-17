import { createStructuredLogger } from "./logger-core";

let logger: ReturnType<typeof createStructuredLogger> | undefined;

export function getServerLogger(): ReturnType<typeof createStructuredLogger> {
  logger ??= createStructuredLogger({
    level: process.env.LOG_LEVEL,
    environment: process.env.NODE_ENV,
    component: "mastergantt",
  });
  return logger;
}

export function resetServerLoggerForTests(): void {
  logger = undefined;
}
