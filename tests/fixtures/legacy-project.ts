import type Database from "better-sqlite3";
import type { AuthorizedEditSession } from "../../src/server/projects/project-service-core";
import type { NewProjectRecord, ProjectRecord } from "../../src/server/repositories/project-repository-core";

/** Test-only pre-0031 SQLite writer; historical projects never had private visibility. */
export function insertHistoricalPublicProject(database: Database.Database, input: NewProjectRecord): ProjectRecord {
  if (input.visibility && input.visibility !== "public") throw new Error("Historical schema cannot store a private project");
  const result = database.prepare(`
    INSERT INTO projects (
      public_id, name, description, status, password_kdf, password_salt,
      password_hash, scrypt_n, scrypt_r, scrypt_p, scrypt_key_length,
      calendar_timezone, created_at, updated_at
    ) VALUES (
      @publicId, @name, @description, @status, @passwordKdf, @passwordSalt,
      @passwordHash, @scryptN, @scryptR, @scryptP, @scryptKeyLength,
      @calendarTimezone, @createdAt, @updatedAt
    )
  `).run({ ...input, status: input.status ?? "planned" });
  const row = database.prepare("SELECT id, status, revision, auth_version FROM projects WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as {
      id: number; status: ProjectRecord["status"]; revision: number; auth_version: number;
    } | undefined;
  if (!row) throw new Error("Historical project was not persisted");
  return {
    id: row.id, publicId: input.publicId, name: input.name,
    description: input.description, status: row.status,
    visibility: "public", calendarTimezone: input.calendarTimezone,
    revision: row.revision, authVersion: row.auth_version,
    createdAt: input.createdAt, updatedAt: input.updatedAt,
  };
}

/** Test-only source-compatible session record for a historical DB fixture. */
export function historicalEditAuthorization(
  project: ProjectRecord, sessionId: number, tokenHash: Buffer, expiresAt: string,
): AuthorizedEditSession {
  return {
    projectId: project.id, projectPublicId: project.publicId,
    projectRevision: project.revision, projectAuthVersion: project.authVersion,
    sessionId, tokenHash, expiresAt,
  };
}
