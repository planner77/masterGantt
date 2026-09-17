import { readApplicationConfiguration } from "../src/server/security/origin-core";
import { validateDatabasePath } from "../src/server/db/config";
import { createStructuredLogger, type StructuredLogSink } from "../src/server/logging/logger-core";
import { parseApplicationBaseUrl } from "../src/server/security/origin-core";

export interface RuntimeConfiguration {
  databasePath: string | undefined;
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
}

export function validateRuntimeConfiguration(
  configuration: RuntimeConfiguration,
): void {
  if (!configuration.databasePath) {
    throw new Error("DATABASE_PATH is required.");
  }

  validateDatabasePath(
    configuration.databasePath,
    configuration.environment,
  );
  parseApplicationBaseUrl(
    configuration.applicationBaseUrl,
    configuration.environment,
    configuration.allowInsecureHttp,
  );
}

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
    validateRuntimeConfiguration(configuration);
    logger.info("runtime_configuration_validated", {
      databaseConfigured: Boolean(configuration.databasePath),
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

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main();
}
