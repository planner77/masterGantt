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

export interface ProjectListRecord {
  publicId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** Private authentication material. Never map this record into an API DTO. */
export interface ProjectCredentialRecord extends ProjectRecord {
  passwordKdf: string;
  passwordSalt: Buffer;
  passwordHash: Buffer;
  scryptN: number;
  scryptR: number;
  scryptP: number;
  scryptKeyLength: number;
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

interface ProjectCredentialRow extends ProjectRow {
  password_kdf: string;
  password_salt: Buffer;
  password_hash: Buffer;
  scrypt_n: number;
  scrypt_r: number;
  scrypt_p: number;
  scrypt_key_length: number;
}

interface ProjectListRow {
  public_id: string;
  name: string;
  description: string;
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

function mapProjectCredential(row: ProjectCredentialRow): ProjectCredentialRecord {
  return {
    ...mapProject(row),
    passwordKdf: row.password_kdf,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    scryptN: row.scrypt_n,
    scryptR: row.scrypt_r,
    scryptP: row.scrypt_p,
    scryptKeyLength: row.scrypt_key_length,
  };
}

function mapProjectListItem(row: ProjectListRow): ProjectListRecord {
  return {
    publicId: row.public_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectRepository {
  constructor(private readonly database: Database.Database) {}

  listPublic(): ProjectListRecord[] {
    const rows = this.database
      .prepare(
        `
          SELECT public_id, name, description, created_at, updated_at
          FROM projects
          ORDER BY updated_at DESC, public_id ASC
        `,
      )
      .all() as ProjectListRow[];

    return rows.map(mapProjectListItem);
  }

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

  findCredentialByPublicId(publicId: string): ProjectCredentialRecord | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            id, public_id, name, description, calendar_timezone,
            auth_version, revision, created_at, updated_at,
            password_kdf, password_salt, password_hash,
            scrypt_n, scrypt_r, scrypt_p, scrypt_key_length
          FROM projects
          WHERE public_id = ?
        `,
      )
      .get(publicId) as ProjectCredentialRow | undefined;
    return row ? mapProjectCredential(row) : undefined;
  }

  findCredentialById(id: number): ProjectCredentialRecord | undefined {
    const row = this.database
      .prepare(
        `
          SELECT
            id, public_id, name, description, calendar_timezone,
            auth_version, revision, created_at, updated_at,
            password_kdf, password_salt, password_hash,
            scrypt_n, scrypt_r, scrypt_p, scrypt_key_length
          FROM projects
          WHERE id = ?
        `,
      )
      .get(id) as ProjectCredentialRow | undefined;
    return row ? mapProjectCredential(row) : undefined;
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

  findById(id: number): ProjectRecord | undefined {
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

  updateMetadata(
    projectId: number,
    input: { name?: string; description?: string },
    updatedAt: string,
  ): ProjectRecord {
    if (input.name !== undefined && input.description !== undefined) {
      this.database.prepare(
        `UPDATE projects
         SET name = ?, description = ?, revision = revision + 1, updated_at = ?
         WHERE id = ?`,
      ).run(input.name, input.description, updatedAt, projectId);
    } else if (input.name !== undefined) {
      this.database.prepare(
        `UPDATE projects
         SET name = ?, revision = revision + 1, updated_at = ?
         WHERE id = ?`,
      ).run(input.name, updatedAt, projectId);
    } else if (input.description !== undefined) {
      this.database.prepare(
        `UPDATE projects
         SET description = ?, revision = revision + 1, updated_at = ?
         WHERE id = ?`,
      ).run(input.description, updatedAt, projectId);
    } else {
      throw new Error("At least one metadata field is required.");
    }

    const project = this.findById(projectId);
    if (!project) {
      throw new Error("Updated project could not be read back.");
    }
    return project;
  }

  advanceRevision(
    projectId: number,
    expectedRevision: number,
    updatedAt: string,
  ): ProjectRecord | undefined {
    const result = this.database.prepare(
      `UPDATE projects
       SET revision = revision + 1, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).run(updatedAt, projectId, expectedRevision);
    return result.changes === 1 ? this.findById(projectId) : undefined;
  }

  rotatePassword(
    projectId: number,
    password: Omit<NewProjectRecord, "publicId" | "name" | "description" | "calendarTimezone" | "createdAt" | "updatedAt">,
    updatedAt: string,
  ): ProjectRecord {
    this.database.prepare(
      `
        UPDATE projects
        SET password_kdf = @passwordKdf,
            password_salt = @passwordSalt,
            password_hash = @passwordHash,
            scrypt_n = @scryptN,
            scrypt_r = @scryptR,
            scrypt_p = @scryptP,
            scrypt_key_length = @scryptKeyLength,
            auth_version = auth_version + 1,
            revision = revision + 1,
            updated_at = @updatedAt
        WHERE id = @projectId
      `,
    ).run({ ...password, updatedAt, projectId });
    const project = this.findById(projectId);
    if (!project) {
      throw new Error("Rotated project could not be read back.");
    }
    return project;
  }
}

export interface EditSessionRecord {
  id: number;
  projectId: number;
  tokenHash: Buffer;
  authVersion: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface EditSessionRow {
  id: number;
  project_id: number;
  token_hash: Buffer;
  auth_version: number;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

function mapEditSession(row: EditSessionRow): EditSessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    tokenHash: row.token_hash,
    authVersion: row.auth_version,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
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

  findByTokenHash(tokenHash: Buffer): EditSessionRecord | undefined {
    const row = this.database.prepare(
      `SELECT id, project_id, token_hash, auth_version, created_at, expires_at, revoked_at
       FROM edit_sessions WHERE token_hash = ?`,
    ).get(tokenHash) as EditSessionRow | undefined;
    return row ? mapEditSession(row) : undefined;
  }

  findById(id: number): EditSessionRecord | undefined {
    const row = this.database.prepare(
      `SELECT id, project_id, token_hash, auth_version, created_at, expires_at, revoked_at
       FROM edit_sessions WHERE id = ?`,
    ).get(id) as EditSessionRow | undefined;
    return row ? mapEditSession(row) : undefined;
  }

  revokeById(id: number, projectId: number, revokedAt: string): void {
    this.database.prepare(
      `UPDATE edit_sessions SET revoked_at = COALESCE(revoked_at, ?)
       WHERE id = ? AND project_id = ?`,
    ).run(revokedAt, id, projectId);
  }

  revokeAllForProject(projectId: number, revokedAt: string): void {
    this.database.prepare(
      `UPDATE edit_sessions SET revoked_at = COALESCE(revoked_at, ?)
       WHERE project_id = ?`,
    ).run(revokedAt, projectId);
  }

  deleteExpiredOrRevoked(now: string, maximumRows = 100): number {
    if (!Number.isInteger(maximumRows) || maximumRows < 1 || maximumRows > 100) {
      throw new Error("Session cleanup bound is invalid.");
    }
    const result = this.database.prepare(
      `DELETE FROM edit_sessions
       WHERE id IN (
         SELECT id FROM edit_sessions
         WHERE revoked_at IS NOT NULL OR expires_at <= ?
         ORDER BY id
         LIMIT ?
       )`,
    ).run(now, maximumRows);
    return result.changes;
  }
}
