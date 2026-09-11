import { validateDatabasePath } from "../src/server/db/config";
import { parseApplicationBaseUrl } from "../src/server/security/origin-core";

export interface RuntimeConfiguration {
  databasePath: string | undefined;
  applicationBaseUrl: string | undefined;
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
  );
}

function main(): void {
  validateRuntimeConfiguration({
    databasePath: process.env.DATABASE_PATH,
    applicationBaseUrl: process.env.APP_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    main();
  } catch {
    // Never echo a supplied URL, filesystem path, credential, or parser detail.
    console.error(
      "Runtime configuration is invalid. Check DATABASE_PATH and APP_BASE_URL. No migration or server was started.",
    );
    process.exitCode = 1;
  }
}
