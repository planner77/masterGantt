import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";
import { seedDefaultProjectCalendar } from "../calendars/default-calendar-core";

import type {
  CreateTaskRequest,
  CreateProjectResponse,
  CurrentEditSessionResponse,
  ProjectDto,
  ProjectListResponse,
  ProjectLinkDto,
  ProjectMetadataMutationResponse,
  ProjectSnapshotResponse,
  ProjectTaskDto,
  ScheduleWarningDto,
  TaskMutationKind,
  TaskMutationResponse,
  UpdateTaskRequest,
  UpdateProjectRequest,
} from "../../contracts/projects";
import {
  recalculateHierarchy,
  scheduleLeaf,
} from "../../domain/scheduling";
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
import { parseCreateTaskInput, parseUpdateTaskInput } from "./task-contract";

const PUBLIC_ID_ATTEMPTS = 3;
const MAX_PROJECT_TASKS = 5_000;

export interface ProjectServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  generateTaskPublicId?: () => string;
  generateTaskExternalId?: () => string;
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

export class TaskNotFoundError extends Error {
  constructor() {
    super("Task not found.");
    this.name = "TaskNotFoundError";
  }
}

export class DuplicateExternalIdError extends Error {
  constructor() {
    super("The external task identifier already exists.");
    this.name = "DuplicateExternalIdError";
  }
}

export class TaskLimitExceededError extends Error {
  constructor() {
    super("The project task limit has been reached.");
    this.name = "TaskLimitExceededError";
  }
}

export class UnsupportedScheduleStructureError extends Error {
  constructor() {
    super("This schedule structure is not supported by this operation.");
    this.name = "UnsupportedScheduleStructureError";
  }
}

export class PersistedScheduleInvalidError extends Error {
  constructor() {
    super("The persisted schedule is invalid.");
    this.name = "PersistedScheduleInvalidError";
  }
}

export class InvalidTaskInputError extends Error {
  constructor() {
    super("The task input is invalid.");
    this.name = "InvalidTaskInputError";
  }
}

export class ParentConversionRequiredError extends Error {
  constructor() {
    super("Converting a task to a summary requires explicit confirmation.");
    this.name = "ParentConversionRequiredError";
  }
}

export class InvalidParentTaskError extends Error {
  constructor() {
    super("The selected task cannot contain child tasks.");
    this.name = "InvalidParentTaskError";
  }
}

export class EmptySummaryNotAllowedError extends Error {
  constructor() {
    super("Deleting the last child would leave an empty summary.");
    this.name = "EmptySummaryNotAllowedError";
  }
}

export class SummaryTaskDeleteUnsupportedError extends Error {
  constructor() {
    super("Summary task deletion is not supported by this operation.");
    this.name = "SummaryTaskDeleteUnsupportedError";
  }
}

export class SummaryScheduleReadonlyError extends Error {
  constructor() {
    super("Summary schedule fields are derived from child tasks.");
    this.name = "SummaryScheduleReadonlyError";
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

function assertHierarchyMutationCapability(links: readonly LinkRecord[]): void {
  if (links.length > 0) {
    throw new UnsupportedScheduleStructureError();
  }
}

function workingCalendar(
  database: Database.Database,
  project: Pick<ProjectRecord, "calendarTimezone">,
  projectId: number,
) {
  try {
    if (project.calendarTimezone !== "Asia/Seoul") throw new Error("Unsupported timezone.");
    return resolveProjectWorkingCalendar(database, projectId);
  } catch {
    throw new PersistedScheduleInvalidError();
  }
}

function warningDtos(
  warnings: ReturnType<typeof scheduleLeaf>["warnings"],
): ScheduleWarningDto[] {
  return warnings.map((warning) => ({
    code: warning.code,
    path: "start",
    requestedStart: warning.requestedStart,
    start: warning.start,
  }));
}

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function validPersistedName(value: string): boolean {
  const length = Array.from(value).length;
  return isWellFormedUnicode(value) &&
    value === value.trim() && length >= 1 && length <= 200;
}

function validPersistedExternalId(value: string): boolean {
  const length = Array.from(value).length;
  return isWellFormedUnicode(value) &&
    length >= 1 && length <= 128 &&
    !/^\p{White_Space}|\p{White_Space}$/u.test(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value);
}

function validatePersistedLeafSchedules(
  tasks: readonly TaskRecord[],
  calendar: ReturnType<typeof createWorkingCalendar>,
): void {
  try {
    for (const task of tasks) {
      if (
        !isCanonicalUuidV4(task.publicId) ||
        !validPersistedExternalId(task.externalId) ||
        !validPersistedName(task.name) ||
        !Number.isInteger(task.sortOrder) || task.sortOrder < 0 ||
        !Number.isFinite(task.progress) ||
        task.progress < 0 || task.progress > 100
      ) {
        throw new PersistedScheduleInvalidError();
      }
      if (task.type === "summary") {
        if (task.scheduleMode !== "auto" || task.requestedStart !== null) {
          throw new PersistedScheduleInvalidError();
        }
        continue;
      }
      if (
        (task.type !== "task" && task.type !== "milestone") ||
        task.requestedStart === null
      ) {
        throw new PersistedScheduleInvalidError();
      }
      const scheduled = scheduleLeaf({
        type: task.type,
        requestedStart: task.requestedStart,
        duration: task.duration,
        scheduleMode: task.scheduleMode,
        end: task.endDate,
      }, calendar);
      if (scheduled.start !== task.startDate) {
        throw new PersistedScheduleInvalidError();
      }
    }
  } catch (error) {
    if (error instanceof PersistedScheduleInvalidError) throw error;
    throw new PersistedScheduleInvalidError();
  }
}

export function recalculatePersistedHierarchy(
  tasks: readonly TaskRecord[],
  calendar: ReturnType<typeof createWorkingCalendar>,
) {
  try {
    validatePersistedLeafSchedules(tasks, calendar);
    const original = taskDtos([...tasks]);
    const derived = recalculateHierarchy(original, calendar);
    for (let index = 0; index < original.length; index += 1) {
      if (
        original[index].type === "summary" &&
        (
          original[index].start !== derived[index].start ||
          original[index].end !== derived[index].end ||
          original[index].duration !== derived[index].duration ||
          original[index].progress !== derived[index].progress ||
          original[index].scheduleMode !== derived[index].scheduleMode ||
          original[index].requestedStart !== derived[index].requestedStart
        )
      ) {
        throw new PersistedScheduleInvalidError();
      }
    }
    return derived;
  } catch (error) {
    if (error instanceof PersistedScheduleInvalidError) throw error;
    throw new PersistedScheduleInvalidError();
  }
}

function requireCanonicalCreateTaskInput(input: CreateTaskRequest): CreateTaskRequest {
  const parsed = parseCreateTaskInput(input);
  if (
    !parsed.success ||
    input === null || typeof input !== "object" || Array.isArray(input) ||
    parsed.data.name !== input.name
  ) {
    throw new InvalidTaskInputError();
  }
  return parsed.data;
}

function requireCanonicalUpdateTaskInput(input: UpdateTaskRequest): UpdateTaskRequest {
  const parsed = parseUpdateTaskInput(input);
  if (
    !parsed.success ||
    input === null || typeof input !== "object" || Array.isArray(input) ||
    (parsed.data.name !== undefined && parsed.data.name !== input.name)
  ) {
    throw new InvalidTaskInputError();
  }
  return parsed.data;
}

export class ProjectService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly generateTaskPublicId: () => string;
  private readonly generateTaskExternalId: () => string;
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
    this.generateTaskPublicId = options.generateTaskPublicId ?? randomUUID;
    this.generateTaskExternalId = options.generateTaskExternalId ?? randomUUID;
    this.hashPassword = options.hashPassword ?? hashEditPassword;
    this.generateSessionToken =
      options.generateSessionToken ?? createSessionToken;
    this.verifyPassword = options.verifyPassword ?? verifyEditPassword;
  }

  private requireCurrentMutationProject(
    authorization: AuthorizedEditSession,
    now: Date,
  ): ProjectCredentialRecord {
    const session = this.sessions.findById(authorization.sessionId);
    const project = this.projects.findCredentialById(authorization.projectId);
    if (
      !session ||
      !project ||
      !session.tokenHash.equals(authorization.tokenHash) ||
      project.publicId !== authorization.projectPublicId ||
      project.authVersion !== authorization.projectAuthVersion ||
      !hasSupportedCredentials(project) ||
      !isSessionValid(session, project, now)
    ) {
      throw new EditSessionInvalidError();
    }
    return project;
  }

  private taskMutationResponse(
    project: ProjectRecord,
    tasks: TaskRecord[],
    links: LinkRecord[],
    holidays: { holidayDate: string; name: string | null }[],
    warnings: ScheduleWarningDto[],
    operation: {
      kind: TaskMutationKind;
      changedTaskExternalIds: string[];
      deletedTaskExternalIds: string[];
      deletedLinkIds: string[];
    },
  ): TaskMutationResponse {
    return {
      data: {
        project: projectDto(project, holidays),
        tasks: taskDtos(tasks),
        links: linkDtos(links, tasks),
        warnings,
        operation,
      },
    };
  }

  private applySummaryDerivations(
    projectId: number,
    tasks: readonly TaskRecord[],
    calendar: ReturnType<typeof createWorkingCalendar>,
    updatedAt: string,
  ): string[] {
    const derived = recalculateHierarchy(taskDtos([...tasks]), calendar);
    const persistedByPublicId = new Map(tasks.map((task) => [task.publicId, task]));
    const changedExternalIds: string[] = [];
    for (const task of derived) {
      if (task.type !== "summary") continue;
      const persisted = persistedByPublicId.get(task.taskId);
      if (!persisted) throw new PersistedScheduleInvalidError();
      const changed = persisted.startDate !== task.start ||
        persisted.endDate !== task.end ||
        persisted.duration !== task.duration ||
        persisted.progress !== task.progress ||
        persisted.scheduleMode !== "auto" ||
        persisted.requestedStart !== null;
      if (changed) {
        if (!this.schedules.updateSummarySchedule(projectId, task.taskId, {
          startDate: task.start,
          endDate: task.end,
          duration: task.duration,
          progress: task.progress,
          updatedAt,
        })) {
          throw new PersistedScheduleInvalidError();
        }
        changedExternalIds.push(task.externalId);
      }
    }
    return changedExternalIds;
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
        seedDefaultProjectCalendar(
          this.database,
          project.id,
          createdAtText,
          createdAt.getUTCFullYear(),
        );
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
              project: projectDto(project, this.schedules.listHolidays(project.id)),
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

  listProjects(): ProjectListResponse {
    return {
      data: {
        projects: this.projects.listPublic().map((project) => ({
          publicId: project.publicId,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        })),
      },
    };
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

  createTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateTaskRequest,
  ): TaskMutationResponse {
    const validatedInput = requireCanonicalCreateTaskInput(input);
    const mutate = this.database.transaction(() => {
      const now = this.clock();
      const nowText = now.toISOString();
      const project = this.requireCurrentMutationProject(authorization, now);
      if (project.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }

      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const holidays = this.schedules.listHolidays(project.id);
      assertHierarchyMutationCapability(links);
      if (tasks.length >= MAX_PROJECT_TASKS) {
        throw new TaskLimitExceededError();
      }
      if (
        validatedInput.externalId !== undefined &&
        this.schedules.findTaskByExternalId(project.id, validatedInput.externalId)
      ) {
        throw new DuplicateExternalIdError();
      }

      const calendar = workingCalendar(this.database, project, project.id);
      if (tasks.length > 0) recalculatePersistedHierarchy(tasks, calendar);
      const parent = validatedInput.parentTaskId === undefined
        ? undefined
        : this.schedules.findTaskByPublicId(
          project.id,
          validatedInput.parentTaskId,
        );
      if (validatedInput.parentTaskId !== undefined && !parent) {
        throw new TaskNotFoundError();
      }
      if (parent?.type === "milestone") {
        throw new InvalidParentTaskError();
      }
      if (
        parent?.type === "task" &&
        validatedInput.convertParentToSummary !== true
      ) {
        throw new ParentConversionRequiredError();
      }
      const scheduled = scheduleLeaf({
        type: validatedInput.type,
        requestedStart: validatedInput.start,
        duration: validatedInput.duration,
        scheduleMode: validatedInput.scheduleMode,
        end: validatedInput.end,
      }, calendar);

      let inserted: TaskRecord | undefined;
      for (let attempt = 0; attempt < PUBLIC_ID_ATTEMPTS; attempt += 1) {
        const taskPublicId = this.generateTaskPublicId();
        const externalId = validatedInput.externalId ?? this.generateTaskExternalId();
        if (
          !isCanonicalUuidV4(taskPublicId) ||
          (validatedInput.externalId === undefined && !isCanonicalUuidV4(externalId)) ||
          (validatedInput.externalId === undefined && taskPublicId === externalId) ||
          this.schedules.taskPublicIdExists(taskPublicId) ||
          this.schedules.findTaskByExternalId(project.id, externalId)
        ) {
          continue;
        }
        inserted = this.schedules.insertTask({
          projectId: project.id,
          externalId,
          publicId: taskPublicId,
          name: validatedInput.name,
          type: scheduled.type,
          scheduleMode: scheduled.scheduleMode,
          requestedStart: scheduled.requestedStart,
          startDate: scheduled.start,
          endDate: scheduled.end,
          duration: scheduled.duration,
          progress: validatedInput.progress,
          parentId: parent?.id ?? null,
          sortOrder: this.schedules.nextSiblingSortOrder(
            project.id,
            parent?.id ?? null,
          ),
          createdAt: nowText,
          updatedAt: nowText,
        });
        break;
      }
      if (!inserted) {
        throw new Error("Unique task identifiers could not be generated.");
      }

      if (
        parent?.type === "task" &&
        !this.schedules.convertTaskToSummary(
          project.id,
          parent.publicId,
          nowText,
        )
      ) {
        throw new TaskNotFoundError();
      }
      const changedSummaryExternalIds = this.applySummaryDerivations(
        project.id,
        this.schedules.listTasks(project.id),
        calendar,
        nowText,
      );
      if (
        parent?.type === "task" &&
        !changedSummaryExternalIds.includes(parent.externalId)
      ) {
        changedSummaryExternalIds.push(parent.externalId);
      }

      const updatedProject = this.projects.advanceRevision(
        project.id,
        expectedRevision,
        nowText,
      );
      if (!updatedProject) throw new RevisionMismatchError();
      const latestTasks = this.schedules.listTasks(project.id);
      const latestLinks = this.schedules.listLinks(project.id);
      return this.taskMutationResponse(
        updatedProject,
        latestTasks,
        latestLinks,
        holidays,
        warningDtos(scheduled.warnings),
        {
          kind: "taskCreate",
          changedTaskExternalIds: [
            inserted.externalId,
            ...changedSummaryExternalIds.filter(
              (externalId) => externalId !== inserted.externalId,
            ),
          ],
          deletedTaskExternalIds: [],
          deletedLinkIds: [],
        },
      );
    });
    return mutate.immediate();
  }

  updateTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
    input: UpdateTaskRequest,
  ): TaskMutationResponse {
    const validatedInput = requireCanonicalUpdateTaskInput(input);
    const mutate = this.database.transaction(() => {
      const now = this.clock();
      const nowText = now.toISOString();
      const project = this.requireCurrentMutationProject(authorization, now);
      if (project.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }
      const current = this.schedules.findTaskByPublicId(project.id, taskPublicId);
      if (!current) throw new TaskNotFoundError();

      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const holidays = this.schedules.listHolidays(project.id);
      assertHierarchyMutationCapability(links);
      const calendar = workingCalendar(this.database, project, project.id);
      recalculatePersistedHierarchy(tasks, calendar);
      if (current.type === "summary") {
        if (
          validatedInput.name === undefined ||
          Object.keys(validatedInput).some((field) => field !== "name")
        ) {
          throw new SummaryScheduleReadonlyError();
        }
        const renamed = this.schedules.renameTask(
          project.id,
          taskPublicId,
          validatedInput.name,
          nowText,
        );
        if (!renamed) throw new TaskNotFoundError();
        const updatedProject = this.projects.advanceRevision(
          project.id,
          expectedRevision,
          nowText,
        );
        if (!updatedProject) throw new RevisionMismatchError();
        return this.taskMutationResponse(
          updatedProject,
          this.schedules.listTasks(project.id),
          this.schedules.listLinks(project.id),
          holidays,
          [],
          {
            kind: "taskUpdate",
            changedTaskExternalIds: [renamed.externalId],
            deletedTaskExternalIds: [],
            deletedLinkIds: [],
          },
        );
      }
      if (current.requestedStart === null) {
        throw new PersistedScheduleInvalidError();
      }
      const scheduled = scheduleLeaf({
        type: current.type,
        requestedStart: validatedInput.start ?? current.requestedStart,
        duration: validatedInput.duration ?? current.duration,
        scheduleMode: validatedInput.scheduleMode ?? current.scheduleMode,
        end: validatedInput.end,
      }, calendar);
      const updated = this.schedules.updateTask(project.id, taskPublicId, {
        name: validatedInput.name ?? current.name,
        type: scheduled.type,
        scheduleMode: scheduled.scheduleMode,
        requestedStart: scheduled.requestedStart,
        startDate: scheduled.start,
        endDate: scheduled.end,
        duration: scheduled.duration,
        progress: validatedInput.progress ?? current.progress,
        updatedAt: nowText,
      });
      if (!updated) throw new TaskNotFoundError();
      const changedSummaryExternalIds = this.applySummaryDerivations(
        project.id,
        this.schedules.listTasks(project.id),
        calendar,
        nowText,
      );

      const updatedProject = this.projects.advanceRevision(
        project.id,
        expectedRevision,
        nowText,
      );
      if (!updatedProject) throw new RevisionMismatchError();
      const latestTasks = this.schedules.listTasks(project.id);
      const latestLinks = this.schedules.listLinks(project.id);
      return this.taskMutationResponse(
        updatedProject,
        latestTasks,
        latestLinks,
        holidays,
        warningDtos(scheduled.warnings),
        {
          kind: "taskUpdate",
          changedTaskExternalIds: [
            updated.externalId,
            ...changedSummaryExternalIds.filter(
              (externalId) => externalId !== updated.externalId,
            ),
          ],
          deletedTaskExternalIds: [],
          deletedLinkIds: [],
        },
      );
    });
    return mutate.immediate();
  }

  deleteTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
  ): TaskMutationResponse {
    const mutate = this.database.transaction(() => {
      const now = this.clock();
      const nowText = now.toISOString();
      const project = this.requireCurrentMutationProject(authorization, now);
      if (project.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }
      const current = this.schedules.findTaskByPublicId(project.id, taskPublicId);
      if (!current) throw new TaskNotFoundError();

      const tasks = this.schedules.listTasks(project.id);
      const links = this.schedules.listLinks(project.id);
      const holidays = this.schedules.listHolidays(project.id);
      assertHierarchyMutationCapability(links);
      const calendar = workingCalendar(this.database, project, project.id);
      recalculatePersistedHierarchy(tasks, calendar);
      if (current.type === "summary") {
        throw new SummaryTaskDeleteUnsupportedError();
      }
      if (
        current.parentId !== null &&
        tasks.filter((task) => task.parentId === current.parentId).length === 1
      ) {
        throw new EmptySummaryNotAllowedError();
      }
      if (!this.schedules.deleteTask(project.id, taskPublicId)) {
        throw new TaskNotFoundError();
      }
      const changedSummaryExternalIds = this.applySummaryDerivations(
        project.id,
        this.schedules.listTasks(project.id),
        calendar,
        nowText,
      );
      const updatedProject = this.projects.advanceRevision(
        project.id,
        expectedRevision,
        nowText,
      );
      if (!updatedProject) throw new RevisionMismatchError();
      const latestTasks = this.schedules.listTasks(project.id);
      const latestLinks = this.schedules.listLinks(project.id);
      return this.taskMutationResponse(
        updatedProject,
        latestTasks,
        latestLinks,
        holidays,
        [],
        {
          kind: "taskDelete",
          changedTaskExternalIds: changedSummaryExternalIds,
          deletedTaskExternalIds: [current.externalId],
          deletedLinkIds: [],
        },
      );
    });
    return mutate.immediate();
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

  deleteProject(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
  ): void {
    const remove = this.database.transaction(() => {
      const project = this.requireCurrentMutationProject(
        authorization,
        this.clock(),
      );
      if (project.revision !== expectedRevision) {
        throw new RevisionMismatchError();
      }
      if (!this.projects.deleteByIdAtRevision(project.id, expectedRevision)) {
        throw new RevisionMismatchError();
      }
    });
    remove.immediate();
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
