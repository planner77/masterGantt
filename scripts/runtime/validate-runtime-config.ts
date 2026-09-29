import { validateDatabasePath } from "../../src/server/db/config";
import { createStructuredLogger, type StructuredLogSink } from "../../src/server/logging/logger-core";
import {
  parseApplicationBaseUrl,
  readApplicationConfiguration,
} from "../../src/server/security/origin-core";

const stderrSink: StructuredLogSink = {
  debug: (line) => process.stderr.write(`${line}\n`),
  info: (line) => process.stderr.write(`${line}\n`),
  warn: (line) => process.stderr.write(`${line}\n`),
  error: (line) => process.stderr.write(`${line}\n`),
};

function main(): void {
  const configuration = {
    databasePath: process.env.DATABASE_PATH,
    ...readApplicationConfiguration(process.env),
  };
  const logger = createStructuredLogger({
    level: process.env.LOG_LEVEL,
    environment: process.env.NODE_ENV,
    component: "runtime_configuration",
    sink: stderrSink,
  });

  try {
    if (!configuration.databasePath) {
      throw new Error("DATABASE_PATH is required.");
    }
    validateDatabasePath(configuration.databasePath, configuration.environment);
    parseApplicationBaseUrl(
      configuration.applicationBaseUrl,
      configuration.environment,
      configuration.allowInsecureHttp,
    );
    logger.info("runtime_configuration_validated", {
      databaseConfigured: true,
      applicationBaseUrlConfigured: Boolean(configuration.applicationBaseUrl),
    });
  } catch (error) {
    logger.error("runtime_configuration_invalid", {
      errorType: error instanceof Error ? error.name : typeof error,
      databaseConfigured: Boolean(configuration.databasePath),
      applicationBaseUrlConfigured: Boolean(configuration.applicationBaseUrl),
    });
    process.exitCode = 1;
  }
}

main();
