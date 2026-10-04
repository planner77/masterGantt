import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  AssignedTargetsResponse,
  AssignmentTargetDto,
  AssignmentTargetsResponse,
  CreateCatalogTargetRequest,
  ProjectAssignmentDto,
  ReplaceResourceGroupMembersRequest,
  ReplaceTaskAssignmentsRequest,
  ResourceCatalogResponse,
  UpdateCatalogTargetRequest,
  DeveloperGrade,
  ResourceRole,
} from "../../contracts/resources";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import { resolveResourceCalendar } from "../../domain/scheduling/resource-calendar";
import { loadResourceCalendarExceptions, resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";
import { ProjectRepository, EditSessionRepository } from "../repositories/project-repository-core";
import {
  ResourceCatalogRepository,
  type AssignmentRecord,
  type CatalogTargetProjectUsage,
  type CatalogTargetRecord,
} from "../repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import { createSessionToken, hashSessionToken } from "../security/session-core";
import { RESOURCE_CATALOG_ADMIN_SESSION_TTL_SECONDS } from "../security/resource-catalog-cookie-core";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";

const MAX_TARGETS_PER_TASK = 100;
const MAX_SEARCH_RESULTS = 100;

export class ResourceCatalogAuthorizationError extends Error {}
export class ResourceCatalogRevisionMismatchError extends Error {}
export class ResourceCatalogTargetNotFoundError extends Error {}
export class ResourceCatalogTargetInactiveError extends Error {}
export class ResourceCatalogAssignmentRoleInvalidError extends Error {}
export class ResourceCatalogRoleInUseError extends Error {
  constructor(
    readonly role: ResourceRole,
    readonly projectCount: number,
    readonly taskCount: number,
  ) {
    super(`Resource role ${role} is used by task assignments.`);
    this.name = "ResourceCatalogRoleInUseError";
  }
}
export class ResourceCatalogTargetInUseError extends Error {
  constructor(
    readonly kind: "resource" | "group",
    readonly usage: CatalogTargetProjectUsage,
  ) {
    super(`${kind} is referenced by one or more projects.`);
    this.name = "ResourceCatalogTargetInUseError";
  }
}
export class ResourceCatalogInvalidInputError extends Error {}
export class ResourceCatalogProjectRevisionMismatchError extends Error {}
export class ResourceCatalogTaskNotFoundError extends Error {}

export interface ResourceCatalogServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  generateAssignmentPublicId?: () => string;
  generateSessionToken?: typeof createSessionToken;
}

export interface ReplaceTaskAssignmentsMutationResult {
  data: {
    projectRevision: number;
    catalogRevision: number;
    assignments: ProjectAssignmentDto[];
    operation: { kind: "taskAssignments"; taskId: string; changed: boolean };
  };
}

function normalizedText(value: unknown, maximum: number, allowEmpty = false): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value !== value.trim()) return undefined;
  const length = Array.from(value).length;
  if ((!allowEmpty && length < 1) || length > maximum) return undefined;
  return value;
}
function normalizeCode(value: unknown): string | null | undefined {
  if (value === null) return null;
  const text = normalizedText(value, 64);
  return text === undefined ? undefined : text;
}
const DEVELOPER_GRADES = new Set<DeveloperGrade>(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);
const RESOURCE_ROLE_ORDER = ["PI", "DEVELOPER", "EQUIPMENT_OWNER"] as const satisfies readonly ResourceRole[];
const RESOURCE_ROLES = new Set<ResourceRole>(RESOURCE_ROLE_ORDER);
function normalizeDeveloperGrade(value: unknown): DeveloperGrade | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && DEVELOPER_GRADES.has(value as DeveloperGrade) ? value as DeveloperGrade : undefined;
}
function normalizeResourceRoles(value: unknown): ResourceRole[] | undefined {
  if (!Array.isArray(value) || value.length > RESOURCE_ROLE_ORDER.length) return undefined;
  if (value.some((role) => typeof role !== "string" || !RESOURCE_ROLES.has(role as ResourceRole))) return undefined;
  if (new Set(value).size !== value.length) return undefined;
  const requested = new Set(value as ResourceRole[]);
  return RESOURCE_ROLE_ORDER.filter((role) => requested.has(role));
}
function canonicalCreate(input: CreateCatalogTargetRequest): { name: string; code: string | null; description: string; developerGrade: DeveloperGrade | null; roles: ResourceRole[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ResourceCatalogInvalidInputError();
  const name = normalizedText(input.name, 200);
  const code = input.code === undefined ? null : normalizeCode(input.code);
  const description = input.description === undefined ? "" : normalizedText(input.description, 2000, true);
  const developerGrade = input.developerGrade === undefined ? null : normalizeDeveloperGrade(input.developerGrade);
  const roles = input.roles === undefined ? [] : normalizeResourceRoles(input.roles);
  if (name === undefined || code === undefined || description === undefined || developerGrade === undefined || roles === undefined) throw new ResourceCatalogInvalidInputError();
  return { name, code, description, developerGrade, roles };
}
function canonicalUpdate(input: UpdateCatalogTargetRequest): UpdateCatalogTargetRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ResourceCatalogInvalidInputError();
  const allowed = new Set(["name", "code", "description", "active", "developerGrade", "roles"]);
  if (Object.keys(input).some((key) => !allowed.has(key)) || Object.keys(input).length === 0) throw new ResourceCatalogInvalidInputError();
  const result: UpdateCatalogTargetRequest = {};
  if (input.name !== undefined) { const name = normalizedText(input.name, 200); if (name === undefined) throw new ResourceCatalogInvalidInputError(); result.name = name; }
  if (input.code !== undefined) { const code = normalizeCode(input.code); if (code === undefined) throw new ResourceCatalogInvalidInputError(); result.code = code; }
  if (input.description !== undefined) { const description = normalizedText(input.description, 2000, true); if (description === undefined) throw new ResourceCatalogInvalidInputError(); result.description = description; }
  if (input.active !== undefined) { if (typeof input.active !== "boolean") throw new ResourceCatalogInvalidInputError(); result.active = input.active; }
  if (input.developerGrade !== undefined) { const grade = normalizeDeveloperGrade(input.developerGrade); if (grade === undefined) throw new ResourceCatalogInvalidInputError(); result.developerGrade = grade; }
  if (input.roles !== undefined) { const roles = normalizeResourceRoles(input.roles); if (roles === undefined) throw new ResourceCatalogInvalidInputError(); result.roles = roles; }
  return result;
}
function sameTarget(current: CatalogTargetRecord, update: UpdateCatalogTargetRequest): boolean {
  return (update.name === undefined || update.name === current.name) && (update.code === undefined || update.code === current.code) &&
    (update.description === undefined || update.description === current.description) && (update.active === undefined || update.active === current.active) &&
    (update.developerGrade === undefined || update.developerGrade === current.developerGrade) &&
    (update.roles === undefined || (update.roles.length === current.roles.length && update.roles.every((role, index) => role === current.roles[index])));
}
function targetDto(kind: "resource" | "group", target: CatalogTargetRecord): AssignmentTargetDto {
  return {
    kind,
    id: target.publicId,
    name: target.name,
    code: target.code,
    description: target.description,
    active: target.active,
    ...(kind === "resource" ? { roles: target.roles } : {}),
  };
}
function assignmentDtos(records: readonly AssignmentRecord[]): ProjectAssignmentDto[] {
  return records.map((record) => ({
    id: record.publicId,
    taskId: record.taskPublicId,
    target: { kind: record.kind, id: record.targetPublicId },
    role: record.kind === "resource" ? record.assignmentRole : null,
    allocation: record.kind === "resource" ? { start: record.assignmentStart, end: record.assignmentEnd, percent: record.allocationPercent } : null,
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
function validAdminLoginPassword(value: unknown): value is string {
  if (typeof value !== "string" || !isWellFormedUnicode(value)) return false;
  const length = Array.from(value).length;
  return length >= 1 && length <= 512 && Buffer.byteLength(value, "utf8") <= 1_024;
}
function validAdminBootstrapPassword(value: unknown): value is string {
  if (!validAdminLoginPassword(value)) return false;
  const length = Array.from(value).length;
  return length <= 12 || length >= 16;
}
function validNewAdminPassword(value: unknown): value is string {
  if (typeof value !== "string" || !isWellFormedUnicode(value)) return false;
  const length = Array.from(value).length;
  return length >= 1 && length <= 12;
}
function deriveAdminPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function validDateOrNull(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  try { parseDateOnly(value, "allocationDate"); return true; } catch { return false; }
}

export class ResourceCatalogService {
  private readonly catalog: ResourceCatalogRepository;
  private readonly projects: ProjectRepository;
  private readonly editSessions: EditSessionRepository;
  private readonly schedules: ScheduleRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly generateAssignmentPublicId: () => string;
  private readonly newSessionToken: typeof createSessionToken;

  constructor(private readonly database: Database.Database, options: ResourceCatalogServiceOptions = {}) {
    this.catalog = new ResourceCatalogRepository(database); this.projects = new ProjectRepository(database);
    this.editSessions = new EditSessionRepository(database); this.schedules = new ScheduleRepository(database);
    this.clock = options.clock ?? (() => new Date()); this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.generateAssignmentPublicId = options.generateAssignmentPublicId ?? randomUUID; this.newSessionToken = options.generateSessionToken ?? createSessionToken;
  }

  adminCredentialConfigured(): boolean { return this.catalog.getAdminCredential() !== undefined; }

  unlockAdmin(candidate: string, configuredPassword: string | undefined): { rawToken: string; expiresAt: string } | undefined {
    if (!validAdminLoginPassword(candidate)) return undefined;
    let credential = this.catalog.getAdminCredential();
    if (!credential) {
      if (!validAdminBootstrapPassword(configuredPassword)) return undefined;
      const salt = randomBytes(16);
      const passwordHash = deriveAdminPassword(configuredPassword, salt);
      this.catalog.seedAdminCredential({ passwordSalt: salt, passwordHash, updatedAt: this.clock().toISOString() });
      credential = this.catalog.getAdminCredential();
    }
    if (!credential) return undefined;
    const candidateHash = deriveAdminPassword(candidate, credential.passwordSalt);
    if (!timingSafeEqual(candidateHash, credential.passwordHash)) return undefined;
    const now = this.clock(); const expires = new Date(now.getTime() + RESOURCE_CATALOG_ADMIN_SESSION_TTL_SECONDS * 1000); const token = this.newSessionToken();
    this.catalog.insertAdminSession({ tokenHash: token.tokenHash, createdAt: now.toISOString(), expiresAt: expires.toISOString() });
    return { rawToken: token.rawToken, expiresAt: expires.toISOString() };
  }

  changeAdminPassword(rawToken: string | undefined, newPassword: string): { rawToken: string; expiresAt: string } {
    if (!this.authorizeAdmin(rawToken)) throw new ResourceCatalogAuthorizationError();
    if (!validNewAdminPassword(newPassword)) throw new ResourceCatalogInvalidInputError();
    const salt = randomBytes(16); const passwordHash = deriveAdminPassword(newPassword, salt);
    const now = this.clock(); const expires = new Date(now.getTime() + RESOURCE_CATALOG_ADMIN_SESSION_TTL_SECONDS * 1000); const token = this.newSessionToken();
    const rotate = this.database.transaction(() => {
      if (!this.authorizeAdmin(rawToken)) throw new ResourceCatalogAuthorizationError();
      this.catalog.replaceAdminCredential({ passwordSalt: salt, passwordHash, updatedAt: now.toISOString() });
      this.catalog.revokeAllAdminSessions(now.toISOString());
      this.catalog.insertAdminSession({ tokenHash: token.tokenHash, createdAt: now.toISOString(), expiresAt: expires.toISOString() });
    });
    rotate.immediate();
    return { rawToken: token.rawToken, expiresAt: expires.toISOString() };
  }
  authorizeAdmin(rawToken: string | undefined): { id: number; expiresAt: string } | undefined {
    if (!rawToken) return undefined; const session = this.catalog.findAdminSessionByHash(hashSessionToken(rawToken));
    if (!session || session.revokedAt !== null || Date.parse(session.expiresAt) <= this.clock().getTime()) return undefined;
    return { id: session.id, expiresAt: session.expiresAt };
  }
  logoutAdmin(rawToken: string | undefined): void { const authorized = this.authorizeAdmin(rawToken); if (authorized) this.catalog.revokeAdminSession(authorized.id, this.clock().toISOString()); }
  private requireAdmin(rawToken: string | undefined): void { if (!this.authorizeAdmin(rawToken)) throw new ResourceCatalogAuthorizationError(); }
  private requireProjectAuthorization(authorization: AuthorizedEditSession): { id: number; revision: number } {
    const project = this.projects.findCredentialById(authorization.projectId); const session = this.editSessions.findById(authorization.sessionId);
    if (!project || !session || project.publicId !== authorization.projectPublicId || project.authVersion !== authorization.projectAuthVersion ||
      session.projectId !== project.id || session.authVersion !== project.authVersion || session.revokedAt !== null ||
      !session.tokenHash.equals(authorization.tokenHash) || Date.parse(session.expiresAt) <= this.clock().getTime()) throw new ResourceCatalogAuthorizationError();
    return { id: project.id, revision: project.revision };
  }

  getCatalog(rawAdminToken: string | undefined): ResourceCatalogResponse {
    this.requireAdmin(rawAdminToken);
    const resourceUsage = this.catalog.listResourceProjectUsage();
    const groupUsage = this.catalog.listGroupProjectUsage();
    return {
      data: {
        revision: this.catalog.getRevision(),
        resources: this.catalog.listResources().map((resource) => {
          const projectUsageCount = resourceUsage.get(resource.id)?.projectCount ?? 0;
          return {
            id: resource.publicId,
            name: resource.name,
            code: resource.code,
            description: resource.description,
            active: resource.active,
            developerGrade: resource.developerGrade,
            roles: resource.roles,
            projectUsageCount,
            deletable: projectUsageCount === 0,
          };
        }),
        groups: this.catalog.listGroups().map((group) => {
          const projectUsageCount = groupUsage.get(group.id)?.projectCount ?? 0;
          return {
            id: group.publicId,
            name: group.name,
            code: group.code,
            description: group.description,
            active: group.active,
            memberResourceIds: group.memberResourceIds,
            projectUsageCount,
            deletable: projectUsageCount === 0,
          };
        }),
      },
    };
  }
  createTarget(kind: "resource" | "group", rawAdminToken: string | undefined, expectedRevision: number, input: CreateCatalogTargetRequest): ResourceCatalogResponse {
    if (kind === "group" && (input?.developerGrade !== undefined || input?.roles !== undefined)) throw new ResourceCatalogInvalidInputError();
    const canonical = canonicalCreate(input); const mutate = this.database.transaction(() => {
      this.requireAdmin(rawAdminToken); if (this.catalog.getRevision() !== expectedRevision) throw new ResourceCatalogRevisionMismatchError();
      const publicId = this.generatePublicId(); if (!isCanonicalUuidV4(publicId)) throw new ResourceCatalogInvalidInputError(); const now = this.clock().toISOString();
      if (kind === "resource") {
        const resource = this.catalog.insertResource({ publicId, name: canonical.name, code: canonical.code, description: canonical.description, developerGrade: canonical.developerGrade, now });
        this.catalog.replaceResourceRoles(resource.id, canonical.roles, now);
      } else {
        this.catalog.insertGroup({ publicId, name: canonical.name, code: canonical.code, description: canonical.description, now });
      }
      if (!this.catalog.advanceRevision(expectedRevision, now)) throw new ResourceCatalogRevisionMismatchError(); return this.getCatalog(rawAdminToken);
    }); return mutate.immediate();
  }
  updateTarget(kind: "resource" | "group", publicId: string, rawAdminToken: string | undefined, expectedRevision: number, input: UpdateCatalogTargetRequest): ResourceCatalogResponse {
    if (kind === "group" && (input?.developerGrade !== undefined || input?.roles !== undefined)) throw new ResourceCatalogInvalidInputError();
    const canonical = canonicalUpdate(input); const mutate = this.database.transaction(() => {
      this.requireAdmin(rawAdminToken); if (this.catalog.getRevision() !== expectedRevision) throw new ResourceCatalogRevisionMismatchError();
      const current = kind === "resource" ? this.catalog.findResourceByPublicId(publicId) : this.catalog.findGroupByPublicId(publicId);
      if (!current) throw new ResourceCatalogTargetNotFoundError(); if (sameTarget(current, canonical)) return this.getCatalog(rawAdminToken); const now = this.clock().toISOString();
      if (kind === "resource") {
        if (canonical.roles !== undefined) {
          const removedRoles = current.roles.filter((role) => !canonical.roles!.includes(role));
          for (const role of removedRoles) {
            const usage = this.catalog.getResourceRoleAssignmentUsage(current.id, role);
            if (usage.taskCount > 0) throw new ResourceCatalogRoleInUseError(role, usage.projectCount, usage.taskCount);
          }
        }
        this.catalog.updateResource(current.id, canonical, now);
        if (canonical.roles !== undefined) this.catalog.replaceResourceRoles(current.id, canonical.roles, now);
      } else {
        this.catalog.updateGroup(current.id, canonical, now);
      }
      if (!this.catalog.advanceRevision(expectedRevision, now)) throw new ResourceCatalogRevisionMismatchError(); return this.getCatalog(rawAdminToken);
    }); return mutate.immediate();
  }
  deleteTarget(kind: "resource" | "group", publicId: string, rawAdminToken: string | undefined, expectedRevision: number): ResourceCatalogResponse {
    const mutate = this.database.transaction(() => {
      this.requireAdmin(rawAdminToken);
      if (this.catalog.getRevision() !== expectedRevision) throw new ResourceCatalogRevisionMismatchError();
      const current = kind === "resource"
        ? this.catalog.findResourceByPublicId(publicId)
        : this.catalog.findGroupByPublicId(publicId);
      if (!current) throw new ResourceCatalogTargetNotFoundError();

      const usage = (kind === "resource"
        ? this.catalog.listResourceProjectUsage()
        : this.catalog.listGroupProjectUsage()).get(current.id) ?? {
        projectCount: 0,
        taskAssignmentProjectCount: 0,
        equipmentRoleProjectCount: 0,
        systemRoleProjectCount: 0,
        calendarProjectCount: 0,
      };
      if (usage.projectCount > 0) throw new ResourceCatalogTargetInUseError(kind, usage);

      if (kind === "resource") {
        this.catalog.removeResourceMemberships(current.id);
        if (!this.catalog.deleteResource(current.id)) throw new ResourceCatalogTargetNotFoundError();
      } else {
        this.catalog.removeGroupMemberships(current.id);
        if (!this.catalog.deleteGroup(current.id)) throw new ResourceCatalogTargetNotFoundError();
      }

      const now = this.clock().toISOString();
      if (!this.catalog.advanceRevision(expectedRevision, now)) throw new ResourceCatalogRevisionMismatchError();
      return this.getCatalog(rawAdminToken);
    });
    return mutate.immediate();
  }

  replaceGroupMembers(groupPublicId: string, rawAdminToken: string | undefined, expectedRevision: number, input: ReplaceResourceGroupMembersRequest): ResourceCatalogResponse {
    if (!input || !Array.isArray(input.resourceIds) || input.resourceIds.length > 1000 || new Set(input.resourceIds).size !== input.resourceIds.length) throw new ResourceCatalogInvalidInputError();
    const mutate = this.database.transaction(() => {
      this.requireAdmin(rawAdminToken); if (this.catalog.getRevision() !== expectedRevision) throw new ResourceCatalogRevisionMismatchError();
      const group = this.catalog.findGroupByPublicId(groupPublicId); if (!group) throw new ResourceCatalogTargetNotFoundError();
      const resources = input.resourceIds.map((id) => this.catalog.findResourceByPublicId(id)); if (resources.some((resource) => !resource)) throw new ResourceCatalogTargetNotFoundError();
      const nextIds = [...input.resourceIds].sort(); const currentIds = [...group.memberResourceIds].sort();
      if (nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])) return this.getCatalog(rawAdminToken);
      const now = this.clock().toISOString(); this.catalog.replaceGroupMembers(group.id, resources.map((resource) => resource!.id), now);
      // Membership is global: validate every project, including calendars without
      // task assignments. Throwing here rolls membership and revision back.
      for(const project of this.projects.listPublic()) {
        const record=this.projects.findByPublicId(project.publicId)!;
        const exceptions=loadResourceCalendarExceptions(this.database,record.id);
        if(exceptions.length===0) continue;
        const projectCalendar=resolveProjectWorkingCalendar(this.database,record.id);
        const groups=this.catalog.listGroups();
        for(const resourceId of nextIds) {
          resolveResourceCalendar({projectCalendar,resourceId,
            groupIds:groups.filter((entry)=>entry.memberResourceIds.includes(resourceId)).map((entry)=>entry.publicId),exceptions});
        }
      }
      if (!this.catalog.advanceRevision(expectedRevision, now)) throw new ResourceCatalogRevisionMismatchError(); return this.getCatalog(rawAdminToken);
    }); return mutate.immediate();
  }
  searchTargets(
    authorization: AuthorizedEditSession,
    kind: "resource" | "group" | undefined,
    query: string | undefined,
    role?: ResourceRole,
  ): AssignmentTargetsResponse {
    this.requireProjectAuthorization(authorization);
    const q = (query ?? "").trim().toLocaleLowerCase();
    if (q.length > 100) throw new ResourceCatalogInvalidInputError();
    const resources = kind === "group"
      ? []
      : this.catalog.listResources(true)
          .filter((target) => role === undefined || target.roles.includes(role))
          .map((target) => targetDto("resource", target));
    const groups = kind === "resource" || role !== undefined
      ? []
      : this.catalog.listGroups(true).map((target) => targetDto("group", target));
    const targets = [...resources, ...groups]
      .filter((target) => !q || target.name.toLocaleLowerCase().includes(q) || (target.code ?? "").toLocaleLowerCase().includes(q))
      .slice(0, MAX_SEARCH_RESULTS);
    return { data: { catalogRevision: this.catalog.getRevision(), targets } };
  }
  getAssignedTargets(projectPublicId: string): AssignedTargetsResponse | undefined {
    const project = this.projects.findByPublicId(projectPublicId); if (!project) return undefined; const assignments = this.catalog.listAssignments(project.id);
    const seen = new Set<string>(); const targets: AssignmentTargetDto[] = [];
    for (const assignment of assignments) { const key = `${assignment.kind}:${assignment.targetPublicId}`; if (seen.has(key)) continue; seen.add(key); const target = assignment.kind === "resource" ? this.catalog.findResourceByPublicId(assignment.targetPublicId) : this.catalog.findGroupByPublicId(assignment.targetPublicId); if (target) targets.push(targetDto(assignment.kind, target)); }
    return { data: { projectRevision: project.revision, catalogRevision: this.catalog.getRevision(), assignments: assignmentDtos(assignments), targets } };
  }

  replaceTaskAssignments(authorization: AuthorizedEditSession, expectedProjectRevision: number, taskPublicId: string, input: ReplaceTaskAssignmentsRequest): ReplaceTaskAssignmentsMutationResult {
    if (!input || !Number.isSafeInteger(input.catalogRevision) || input.catalogRevision < 1 || !Array.isArray(input.targets) || input.targets.length > MAX_TARGETS_PER_TASK) throw new ResourceCatalogInvalidInputError();
    const keys = input.targets.map((target) => `${target?.kind}:${target?.id}`);
    if (new Set(keys).size !== keys.length || input.targets.some((target) => !target || (target.kind !== "resource" && target.kind !== "group") || !isCanonicalUuidV4(target.id))) throw new ResourceCatalogInvalidInputError();
    for (const target of input.targets) {
      if (target.kind === "group" && (target.allocation !== undefined || target.role !== undefined)) throw new ResourceCatalogInvalidInputError();
      if (target.kind === "resource" && target.role !== undefined && target.role !== null && !RESOURCE_ROLES.has(target.role)) throw new ResourceCatalogInvalidInputError();
      if (target.kind === "resource" && target.allocation !== undefined) {
        const allocation = target.allocation;
        if (!allocation || !Number.isFinite(allocation.percent) || allocation.percent <= 0 || allocation.percent > 100 || !validDateOrNull(allocation.start) || !validDateOrNull(allocation.end)) throw new ResourceCatalogInvalidInputError();
        if (allocation.start && allocation.end && allocation.start > allocation.end) throw new ResourceCatalogInvalidInputError();
      }
    }
    const mutate = this.database.transaction(() => {
      const currentProject = this.requireProjectAuthorization(authorization); if (currentProject.revision !== expectedProjectRevision) throw new ResourceCatalogProjectRevisionMismatchError();
      const catalogRevision = this.catalog.getRevision(); if (catalogRevision !== input.catalogRevision) throw new ResourceCatalogRevisionMismatchError();
      const task = this.schedules.findTaskByPublicId(currentProject.id, taskPublicId); if (!task) throw new ResourceCatalogTaskNotFoundError();
      const resolved = input.targets.map((target) => {
        const record = target.kind === "resource" ? this.catalog.findResourceByPublicId(target.id) : this.catalog.findGroupByPublicId(target.id);
        if (!record) throw new ResourceCatalogTargetNotFoundError(); if (!record.active) throw new ResourceCatalogTargetInactiveError();
        const role = target.kind === "resource" ? target.role ?? null : null;
        if (target.kind === "resource" && role !== null && !record.roles.includes(role)) throw new ResourceCatalogAssignmentRoleInvalidError();
        const start = target.kind === "resource" ? target.allocation?.start ?? null : null;
        const end = target.kind === "resource" ? target.allocation?.end ?? null : null;
        if (task.type === "task" && ((start && (start < task.startDate || start > task.endDate)) || (end && (end < task.startDate || end > task.endDate)))) throw new ResourceCatalogInvalidInputError();
        return { kind: target.kind, publicId: target.id, internalId: record.id, assignmentStart: start, assignmentEnd: end, allocationPercent: target.kind === "resource" ? target.allocation?.percent ?? null : null, assignmentRole: role };
      });
      const current = this.catalog.listAssignments(currentProject.id).filter((assignment) => assignment.taskPublicId === taskPublicId);
      const currentKeys = current.map((assignment) => `${assignment.kind}:${assignment.targetPublicId}:${assignment.assignmentStart ?? ""}:${assignment.assignmentEnd ?? ""}:${assignment.allocationPercent ?? ""}:${assignment.assignmentRole ?? ""}`).sort();
      const requestedKeys = resolved.map((assignment) => `${assignment.kind}:${assignment.publicId}:${assignment.assignmentStart ?? ""}:${assignment.assignmentEnd ?? ""}:${assignment.allocationPercent ?? ""}:${assignment.assignmentRole ?? ""}`).sort();
      if (currentKeys.length === requestedKeys.length && currentKeys.every((key, index) => key === requestedKeys[index])) return { data: { projectRevision: currentProject.revision, catalogRevision, assignments: assignmentDtos(this.catalog.listAssignments(currentProject.id)), operation: { kind: "taskAssignments" as const, taskId: taskPublicId, changed: false } } };
      const now = this.clock().toISOString();
      this.catalog.replaceTaskAssignments({ projectId: currentProject.id, taskId: task.id, targets: resolved.map((target) => { const assignmentPublicId = this.generateAssignmentPublicId(); if (!isCanonicalUuidV4(assignmentPublicId)) throw new ResourceCatalogInvalidInputError(); return { ...target, assignmentPublicId }; }), now });
      const updatedProject = this.projects.advanceRevision(currentProject.id, expectedProjectRevision, now); if (!updatedProject) throw new ResourceCatalogProjectRevisionMismatchError();
      return { data: { projectRevision: updatedProject.revision, catalogRevision, assignments: assignmentDtos(this.catalog.listAssignments(currentProject.id)), operation: { kind: "taskAssignments" as const, taskId: taskPublicId, changed: true } } };
    });
    return mutate.immediate();
  }
}
