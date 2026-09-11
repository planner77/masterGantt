import { join } from "node:path";

import { validateDatabasePath } from "../src/server/db/config";
import { openDatabase } from "../src/server/db/core";

function main(): void {
  const configuredPath = process.env.DATABASE_PATH;
  if (!configuredPath) {
    throw new Error("DATABASE_PATH is required.");
  }

  const filename = validateDatabasePath(configuredPath, process.env.NODE_ENV);
  const { database, migrations } = openDatabase({
    filename,
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  });

  try {
    console.log(JSON.stringify({ status: "ok", applied: migrations.applied }));
  } finally {
    database.close();
  }
}

try {
  main();
} catch {
  // Do not print driver errors, SQL, paths, or configuration values.
  console.error(
    "Database migration failed. Check DATABASE_PATH, directory permissions, and the migration files and ledger. No server was started.",
  );
  process.exitCode = 1;
}
