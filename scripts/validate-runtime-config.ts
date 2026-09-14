import { readApplicationConfiguration } from "../src/server/security/origin-core";
import { validateDatabasePath } from "../src/server/db/config";
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

function main(): void {
  validateRuntimeConfiguration({
    databasePath: process.env.DATABASE_PATH,
    ...readApplicationConfiguration(process.env),
  });
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    main();
  } catch {
    // Never echo a supplied URL, filesystem path, credential, or parser detail.
    console.error(
      "Runtime configuration is invalid. Check DATABASE_PATH, APP_BASE_URL and ALLOW_INSECURE_HTTP. No migration or server was started.",
    );
    process.exitCode = 1;
  }
}
