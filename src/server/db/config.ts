import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

const PRODUCTION_DATA_DIRECTORY = "/data";

export function validateDatabasePath(
  filename: string,
  environment: string | undefined,
): string {
  if (filename.length === 0 || filename.trim() !== filename) {
    throw new Error("DATABASE_PATH must be a non-empty path without surrounding whitespace.");
  }

  if (filename.includes("\0")) {
    throw new Error("DATABASE_PATH contains an invalid null byte.");
  }

  if (environment !== "production") {
    return filename;
  }

  if (filename === ":memory:" || filename.startsWith("file:")) {
    throw new Error("Production DATABASE_PATH must be a filesystem path.");
  }

  if (!isAbsolute(filename) || normalize(filename) !== filename) {
    throw new Error("Production DATABASE_PATH must be an absolute canonical path.");
  }

  const resolvedFilename = resolve(filename);
  const pathFromDataDirectory = relative(
    PRODUCTION_DATA_DIRECTORY,
    resolvedFilename,
  );

  if (
    pathFromDataDirectory.length === 0 ||
    pathFromDataDirectory === ".." ||
    pathFromDataDirectory.startsWith(`..${sep}`) ||
    isAbsolute(pathFromDataDirectory)
  ) {
    throw new Error("Production DATABASE_PATH must be a file beneath /data.");
  }

  return resolvedFilename;
}
