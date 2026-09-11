import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  CreateProjectResponse,
  CurrentEditSessionResponse,
  ProjectDto,
  ProjectLinkDto,
  ProjectMetadataMutationResponse,
  ProjectSnapshotResponse,
  ProjectTaskDto,
  UpdateProjectRequest,
} from "../../contracts/projects";
import {
  EditSessionRepository,
  ProjectRepository,
  type EditSessionRecord,
  type ProjectCredentialRecord,
  type ProjectRecord,
} from "../repositories/project-repository-core";
import {
  ScheduleRepository,
  type LinkRecord,
  type TaskRecord,
} from "../repositories/schedule-repository-core";
import {
  hashEditPassword,
  isSupportedPasswordRecord,
  type PasswordHashRecord,
  type PersistedPasswordRecord,
  verifyEditPassword,
} from "../security/password-core";
import type { ParsedEditSessionCookie } from "../security/cookie-core";
import {
  createSessionToken,
  hashSessionToken,
  sessionExpiry,
  type NewSessionToken,
} from "../security/session-core";
import {
  isCanonicalUuidV4,
  type CreateProjectInput,
} from "./project-contract";

const PUBLIC_ID_ATTEMPTS = 3;

export interface ProjectServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  hashPassword?: (password: string) => Promise<PasswordHashRecord>;
  generateSessionToken?: () => NewSessionToken;
  verifyPassword?: (
    candidate: string,
    persisted: PersistedPasswordRecord | undefined,
  ) => Promise<boolean>;
}

export interface CreatedProject {
  response: CreateProjectResponse;
  rawSessionToken: string;
}

export interface UnlockedProject {
  rawSessionToken: string;
}

export interface AuthorizedEditSession {
  projectId: number;
  projectPublicId: string;
  projectRevision: number;
  projectAuthVersion: number;
  sessionId: number;
  tokenHash: Buffer;
  expiresAt: string;
}

export type AuthorizationResult =
  | { kind: "authorized"; authorization: AuthorizedEditSession }
  | { kind: "projectNotFound" }
  | { kind: "unauthorized" };

export type LogoutResult =
  | { kind: "projectNotFound" }
  | { kind: "preserveCookie" }
  | { kind: "clearCookie" }
  | { kind: "noCookie" };

export class EditSessionInvalidError extends Error {
  constructor() {
    super("The edit session is no longer valid.");
    this.name = "EditSessionInvalidError";
  }
}

export class RevisionMismatchError extends Error {
  constructor() {
    super("The project revision does not match.");
    this.name = "RevisionMismatchError";
  }
}

function projectDto(
  project: {
    publicId: string;
    name: string;
    description: string;
    revision: number;
    calendarTimezone: string;
  },
  holidays: { holidayDate: string; name: string | null }[] = [],
): ProjectDto {
  if (project.calendarTimezone !== "Asia/Seoul") {
    throw new Error("Unsupported persisted project timezone.");
  }

  return {
    publicId: project.publicId,
    name: project.name,
    description: project.description,
    revision: project.revision,
    calendar: {
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: holidays.map((holiday) => ({
        date: holiday.holidayDate,
        name: holiday.name,
      })),
    },
  };
}

function taskDtos(tasks: TaskRecord[]): ProjectTaskDto[] {
  const externalIdsByInternalId = new Map(
    tasks.map((task) => [task.id, task.externalId]),
  );

  return tasks.map((task) => {
    const parentExternalId = task.parentId === null
      ? null
      : externalIdsByInternalId.get(task.parentId);
    if (task.parentId !== null && parentExternalId === undefined) {
      throw new Error("Persisted task parent is outside the project snapshot.");
    }

    return {
      taskId: task.publicId,
      externalId: task.externalId,
      name: task.name,
      type: task.type,
      scheduleMode: task.scheduleMode,
      requestedStart: task.requestedStart,
      start: task.startDate,
      end: task.endDate,
      duration: task.duration,
      progress: task.progress,
      parentExternalId: parentExternalId ?? null,
      siblingOrder: task.sortOrder,
    };
  });
}

function linkDtos(
  links: LinkRecord[],
  tasks: TaskRecord[],
): ProjectLinkDto[] {
  const externalIdsByInternalId = new Map(
    tasks.map((task) => [task.id, task.externalId]),
  );

  return links.map((link) => {
    const predecessorExternalId = externalIdsByInternalId.get(
      link.predecessorTaskId,
    );
    const successorExternalId = externalIdsByInternalId.get(
      link.successorTaskId,
    );
    if (!predecessorExternalId || !successorExternalId) {
      throw new Error("Persisted dependency is outside the project snapshot.");
    }

    return {
      id: link.publicId,
      predecessorExternalId,
      successorExternalId,
      type: link.type,
      lag: link.lag,
    };
  });
}

function persistedPassword(
  project: ProjectCredentialRecord | undefined,
): PersistedPasswordRecord | undefined {
  if (!project) {
    return undefined;
  }
  return {
    algorithm: project.passwordKdf,
    salt: project.passwordSalt,
    hash: project.passwordHash,
    n: project.scryptN,
    r: project.scryptR,
    p: project.scryptP,
    keyLength: project.scryptKeyLength,
  };
}

function hasSupportedCredentials(project: ProjectCredentialRecord | undefined): boolean {
  return isSupportedPasswordRecord(persistedPassword(project));
}

function credentialsUnchanged(
  current: ProjectCredentialRecord | undefined,
  expected: ProjectCredentialRecord,
): current is ProjectCredentialRecord {
  return Boolean(
    current &&
    current.authVersion === expected.authVersion &&
    current.passwordKdf === expected.passwordKdf &&
    current.scryptN === expected.scryptN &&
    current.scryptR === expected.scryptR &&
    current.scryptP === expected.scryptP &&
    current.scryptKeyLength === expected.scryptKeyLength &&
    Buffer.isBuffer(current.passwordSalt) &&
    Buffer.isBuffer(expected.passwordSalt) &&
    current.passwordSalt.equals(expected.passwordSalt) &&
    Buffer.isBuffer(current.passwordHash) &&
    Buffer.isBuffer(expected.passwordHash) &&
    current.passwordHash.equals(expected.passwordHash),
  );
}

function validIsoTimestamp(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return undefined;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return undefined;
  }
  return milliseconds;
}

function isSessionValid(
  session: EditSessionRecord | undefined,
  project: Pick<ProjectRecord, "id" | "authVersion"> | undefined,
  now: Date,
): session is EditSessionRecord {
  if (!session || !project || session.revokedAt !== null) {
    return false;
  }
  const expiry = validIsoTimestamp(session.expiresAt);
  return session.projectId === project.id &&
    session.authVersion === project.authVersion &&
    expiry !== undefined && expiry > now.getTime();
}

export class ProjectService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly hashPassword: (
    password: string,
  ) => Promise<PasswordHashRecord>;
  private readonly generateSessionToken: () => NewSessionToken;
  private readonly verifyPassword: NonNullable<ProjectServiceOptions["verifyPassword"]>;

  constructor(
    private readonly database: Database.Database,
    options: ProjectServiceOptions = {},
  ) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.schedules = new ScheduleRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.hashPassword = options.hashPassword ?? hashEditPassword;
    this.generateSessionToken =
      options.generateSessionToken ?? createSessionToken;
    this.verifyPassword = options.verifyPassword ?? verifyEditPassword;
  }

  async create(input: CreateProjectInput): Promise<CreatedProject> {
    const password = await this.hashPassword(input.editPassword);
    const sessionToken = this.generateSessionToken();
    const createdAt = this.clock();
    const createdAtText = createdAt.toISOString();
    const expiresAtText = sessionExpiry(createdAt).toISOString();

    for (let attempt = 0; attempt < PUBLIC_ID_ATTEMPTS; attempt += 1) {
      const publicId = this.generatePublicId();
      if (!isCanonicalUuidV4(publicId)) {
        continue;
      }

      const createAggregate = this.database.transaction(() => {
        const project = this.projects.insert({
          publicId,
          name: input.name,
          description: input.description,
          passwordKdf: password.algorithm,
          passwordSalt: password.salt,
          passwordHash: password.hash,
          scryptN: password.n,
          scryptR: password.r,
          scryptP: password.p,
          scryptKeyLength: password.keyLength,
          calendarTimezone: "Asia/Seoul",
          createdAt: createdAtText,
          updatedAt: createdAtText,
        });
        this.sessions.insert({
          projectId: project.id,
          tokenHash: sessionToken.tokenHash,
          authVersion: project.authVersion,
          createdAt: createdAtText,
          expiresAt: expiresAtText,
        });
        return project;
      });

      try {
        const project = createAggregate.immediate();
        return {
          response: {
            data: {
              project: projectDto(project),
              permission: "edit",
            },
          },
          rawSessionToken: sessionToken.rawToken,
        };
      } catch (error) {
        if (this.projects.findByPublicId(publicId)) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("A unique project identifier could not be generated.");
  }

  getReadonlySnapshot(publicId: string): ProjectSnapshotResponse | undefined {
    const readSnapshot = this.database.transaction(() => {
      const project = this.projects.findByPublicId(publicId);
      if (!project) {
        return undefined;
      }

      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const holidays = this.schedules.listHolidays(project.id);

      return {
        data: {
          project: projectDto(project, holidays),
          tasks: taskDtos(tasks),
          links: linkDtos(links, tasks),
          permission: "readonly" as const,
        },
      };
    });

    return readSnapshot.deferred();
  }

  async unlock(
    publicId: string,
    editPassword: string,
  ): Promise<UnlockedProject | undefined> {
    const credential = isCanonicalUuidV4(publicId)
      ? this.projects.findCredentialByPublicId(publicId)
      : undefined;
    const verified = await this.verifyPassword(
      editPassword,
      persistedPassword(credential),
    );
    if (!verified || !credential) {
      return undefined;
    }

    const token = this.generateSessionToken();
    const issue = this.database.transaction(() => {
      const createdAt = this.clock();
      const createdAtText = createdAt.toISOString();
      const expiresAtText = sessionExpiry(createdAt).toISOString();
      const current = this.projects.findCredentialById(credential.id);
      if (!credentialsUnchanged(current, credential)) {
        return false;
      }
      this.sessions.deleteExpiredOrRevoked(createdAtText, 100);
      this.sessions.insert({
        projectId: current.id,
        tokenHash: token.tokenHash,
        authVersion: current.authVersion,
        createdAt: createdAtText,
        expiresAt: expiresAtText,
      });
      return true;
    });
    return issue.immediate() ? { rawSessionToken: token.rawToken } : undefined;
  }

  getCurrentEditSession(
    publicId: string,
    rawToken: string | undefined,
  ): CurrentEditSessionResponse | undefined {
    const read = this.database.transaction(() => {
      const project = this.projects.findCredentialByPublicId(publicId);
      if (!project) {
        return undefined;
      }
      if (!rawToken) {
        return { data: { permission: "readonly" as const } };
      }
      const session = this.sessions.findByTokenHash(hashSessionToken(rawToken));
      if (!hasSupportedCredentials(project) || !isSessionValid(session, project, this.clock())) {
        return { data: { permission: "readonly" as const } };
      }
      return {
        data: {
          permission: "edit" as const,
          expiresAt: session.expiresAt,
        },
      };
    });
    return read.deferred();
  }

  authorize(
    publicId: string,
    rawToken: string | undefined,
  ): AuthorizationResult {
    if (!isCanonicalUuidV4(publicId)) {
      return { kind: "projectNotFound" };
    }
    const read = this.database.transaction((): AuthorizationResult => {
      const project = this.projects.findCredentialByPublicId(publicId);
      if (!project) {
        return { kind: "projectNotFound" };
      }
      if (!rawToken) {
        return { kind: "unauthorized" };
      }
      const tokenHash = hashSessionToken(rawToken);
      const session = this.sessions.findByTokenHash(tokenHash);
      if (!hasSupportedCredentials(project) || !isSessionValid(session, project, this.clock())) {
        return { kind: "unauthorized" };
      }
      return {
        kind: "authorized",
        authorization: {
          projectId: project.id,
          projectPublicId: project.publicId,
          projectRevision: project.revision,
          projectAuthVersion: project.authVersion,
          sessionId: session.id,
          tokenHash,
          expiresAt: session.expiresAt,
        },
      };
    });
    return read.deferred();
  }

  updateMetadata(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: UpdateProjectRequest,
  ): ProjectMetadataMutationResponse {
    const mutate = this.database.transaction(() => {
      const now = this.clock();
      const session = this.sessions.findById(authorization.sessionId);
      const project = this.projects.findCredentialById(authorization.projectId);
      if (
        !session ||
        !session.tokenHash.equals(authorization.tokenHash) ||
        !hasSupportedCredentials(project) ||
        !isSessionValid(session, project, now)
      ) {
        throw new EditSessionInvalidError();
      }
      if (!project || project.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }

      const updated = this.projects.updateMetadata(
        project.id,
        input,
        now.toISOString(),
      );
      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const holidays = this.schedules.listHolidays(project.id);
      const changedFields: ("name" | "description")[] = [];
      if (input.name !== undefined) changedFields.push("name");
      if (input.description !== undefined) changedFields.push("description");
      return {
        data: {
          project: projectDto(updated, holidays),
          tasks: taskDtos(tasks),
          links: linkDtos(links, tasks),
          warnings: [] as [],
          operation: { kind: "projectMetadata" as const, changedFields },
        },
      };
    });
    return mutate.immediate();
  }

  async rotatePassword(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    newEditPassword: string,
  ): Promise<{ rawSessionToken: string; revision: number }> {
    if (authorization.projectRevision !== expectedRevision) {
      throw new RevisionMismatchError();
    }

    const password = await this.hashPassword(newEditPassword);
    const token = this.generateSessionToken();
    const rotate = this.database.transaction(() => {
      const now = this.clock();
      const nowText = now.toISOString();
      const expiresAt = sessionExpiry(now).toISOString();
      const session = this.sessions.findById(authorization.sessionId);
      const project = this.projects.findCredentialById(authorization.projectId);
      if (
        !session ||
        !session.tokenHash.equals(authorization.tokenHash) ||
        !hasSupportedCredentials(project) ||
        !isSessionValid(session, project, now)
      ) {
        throw new EditSessionInvalidError();
      }
      if (!project || project.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }

      const updated = this.projects.rotatePassword(project.id, {
        passwordKdf: password.algorithm,
        passwordSalt: password.salt,
        passwordHash: password.hash,
        scryptN: password.n,
        scryptR: password.r,
        scryptP: password.p,
        scryptKeyLength: password.keyLength,
      }, nowText);
      this.sessions.revokeAllForProject(project.id, nowText);
      this.sessions.deleteExpiredOrRevoked(nowText, 100);
      this.sessions.insert({
        projectId: project.id,
        tokenHash: token.tokenHash,
        authVersion: updated.authVersion,
        createdAt: nowText,
        expiresAt,
      });
      return updated.revision;
    });
    return {
      rawSessionToken: token.rawToken,
      revision: rotate.immediate(),
    };
  }

  logout(
    publicId: string,
    cookie: ParsedEditSessionCookie,
  ): LogoutResult {
    const project = this.projects.findByPublicId(publicId);
    if (!project) {
      return { kind: "projectNotFound" };
    }
    if (cookie.state === "absent") {
      return { kind: "noCookie" };
    }
    if (cookie.state === "malformed") {
      return { kind: "clearCookie" };
    }

    const tokenHash = hashSessionToken(cookie.rawToken);
    const logout = this.database.transaction((): LogoutResult => {
      const currentTarget = this.projects.findById(project.id);
      if (!currentTarget) {
        return { kind: "projectNotFound" };
      }
      const session = this.sessions.findByTokenHash(tokenHash);
      if (!session) {
        return { kind: "clearCookie" };
      }
      const now = this.clock();
      if (session.projectId !== currentTarget.id) {
        const owner = this.projects.findCredentialById(session.projectId);
        return hasSupportedCredentials(owner) && isSessionValid(session, owner, now)
          ? { kind: "preserveCookie" }
          : { kind: "clearCookie" };
      }
      this.sessions.revokeById(session.id, currentTarget.id, now.toISOString());
      return { kind: "clearCookie" };
    });
    return logout.immediate();
  }
}
