import type Database from "better-sqlite3";

export interface ProjectRecord {
  id: number;
  publicId: string;
  name: string;
  description: string;
  calendarTimezone: string;
  authVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewProjectRecord {
  publicId: string;
  name: string;
  description: string;
  passwordKdf: "scrypt";
  passwordSalt: Buffer;
  passwordHash: Buffer;
  scryptN: number;
  scryptR: number;
  scryptP: number;
  scryptKeyLength: number;
  calendarTimezone: "Asia/Seoul";
  createdAt: string;
  updatedAt: string;
}

export interface NewEditSessionRecord {
  projectId: number;
  tokenHash: Buffer;
  authVersion: number;
  createdAt: string;
  expiresAt: string;
}

interface ProjectRow {
  id: number;
  public_id: string;
  name: string;
  description: string;
  calendar_timezone: string;
  auth_version: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    description: row.description,
    calendarTimezone: row.calendar_timezone,
    authVersion: row.auth_version,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectRepository {
  constructor(private readonly database: Database.Database) {}

  findByPublicId(publicId: string): ProjectRecord | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            public_id,
            name,
            description,
            calendar_timezone,
            auth_version,
            revision,
            created_at,
            updated_at
          FROM projects
          WHERE public_id = ?
        `,
      )
      .get(publicId) as ProjectRow | undefined;

    return row ? mapProject(row) : undefined;
  }

  insert(project: NewProjectRecord): ProjectRecord {
    const result = this.database
      .prepare(
        `
          INSERT INTO projects (
            public_id,
            name,
            description,
            password_kdf,
            password_salt,
            password_hash,
            scrypt_n,
            scrypt_r,
            scrypt_p,
            scrypt_key_length,
            calendar_timezone,
            created_at,
            updated_at
          ) VALUES (
            @publicId,
            @name,
            @description,
            @passwordKdf,
            @passwordSalt,
            @passwordHash,
            @scryptN,
            @scryptR,
            @scryptP,
            @scryptKeyLength,
            @calendarTimezone,
            @createdAt,
            @updatedAt
          )
        `,
      )
      .run(project);

    const inserted = this.findById(Number(result.lastInsertRowid));
    if (!inserted) {
      throw new Error("Inserted project could not be read back.");
    }

    return inserted;
  }

  private findById(id: number): ProjectRecord | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            public_id,
            name,
            description,
            calendar_timezone,
            auth_version,
            revision,
            created_at,
            updated_at
          FROM projects
          WHERE id = ?
        `,
      )
      .get(id) as ProjectRow | undefined;

    return row ? mapProject(row) : undefined;
  }
}

export class EditSessionRepository {
  constructor(private readonly database: Database.Database) {}

  insert(session: NewEditSessionRecord): number {
    const result = this.database
      .prepare(
        `
          INSERT INTO edit_sessions (
            project_id,
            token_hash,
            auth_version,
            created_at,
            expires_at
          ) VALUES (
            @projectId,
            @tokenHash,
            @authVersion,
            @createdAt,
            @expiresAt
          )
        `,
      )
      .run(session);

    return Number(result.lastInsertRowid);
  }
}
