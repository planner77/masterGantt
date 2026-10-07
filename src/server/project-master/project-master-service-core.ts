import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

import type {
  CreateProjectMasterItemRequest,
  ProjectMasterRelationMutationRequest,
  ProjectMasterAdminResponse,
  ProjectMasterCategory,
  ProjectMasterItemDto,
  ProjectMasterSelectionResponse,
  UpdateProjectMasterItemRequest,
} from "../../contracts/project-master";
import { ProjectMasterRepository, type ProjectMasterRecord } from "../repositories/project-master-repository-core";
import { createSessionToken, hashSessionToken, type NewSessionToken } from "../security/session-core";
import { PROJECT_MASTER_ADMIN_SESSION_TTL_SECONDS } from "../security/project-master-admin-cookie-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";

export class ProjectMasterAuthorizationError extends Error {}
export class ProjectMasterRevisionMismatchError extends Error {}
export class ProjectMasterInvalidInputError extends Error {}
export class ProjectMasterItemNotFoundError extends Error {}
export class ProjectMasterItemInactiveError extends Error {}
export class ProjectMasterItemInUseError extends Error {}
export class ProjectMasterRelationInvalidError extends Error {}
export class ProjectMasterRelationInUseError extends Error {}

export interface ProjectMasterServiceOptions {
  clock?: () => Date;
  generatePublicId?: () => string;
  generateSessionToken?: () => NewSessionToken;
}

function wellFormed(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (i + 1 >= value.length) return false;
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      i += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function normalized(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || !wellFormed(value)) return undefined;
  const text = value.trim();
  const length = Array.from(text).length;
  return length >= 1 && length <= max ? text : undefined;
}

function validCategory(value: unknown): value is ProjectMasterCategory {
  return value === "BUSINESS_UNIT" || value === "PRODUCT" || value === "SITE_ENTITY";
}

function validLoginPassword(value: unknown): value is string {
  return typeof value === "string" && wellFormed(value) &&
    Array.from(value).length >= 1 && Array.from(value).length <= 512 &&
    Buffer.byteLength(value, "utf8") <= 1024;
}

function validBootstrapPassword(value: unknown): value is string {
  if (!validLoginPassword(value)) return false;
  const length = Array.from(value).length;
  return length <= 12 || length >= 16;
}

function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && wellFormed(value) &&
    Array.from(value).length >= 1 && Array.from(value).length <= 12;
}

function derive(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function itemDto(record: ProjectMasterRecord, usageCount?: number): ProjectMasterItemDto {
  return {
    id: record.publicId,
    category: record.category,
    code: record.code,
    name: record.name,
    active: record.active,
    sortOrder: record.sortOrder,
    ...(usageCount === undefined ? {} : { usageCount }),
  };
}

export class ProjectMasterService {
  private readonly repository: ProjectMasterRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  private readonly newSessionToken: () => NewSessionToken;

  constructor(private readonly database: Database.Database, options: ProjectMasterServiceOptions = {}) {
    this.repository = new ProjectMasterRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
    this.newSessionToken = options.generateSessionToken ?? createSessionToken;
  }

  adminCredentialConfigured(): boolean {
    return this.repository.getAdminCredential() !== undefined;
  }

  unlockAdmin(candidate: string, configuredPassword: string | undefined): { rawToken: string; expiresAt: string } | undefined {
    if (!validLoginPassword(candidate)) return undefined;
    let credential = this.repository.getAdminCredential();
    if (!credential) {
      if (!validBootstrapPassword(configuredPassword)) return undefined;
      const salt = randomBytes(16);
      this.repository.seedAdminCredential({
        passwordSalt: salt,
        passwordHash: derive(configuredPassword, salt),
        updatedAt: this.clock().toISOString(),
      });
      credential = this.repository.getAdminCredential();
    }
    if (!credential) return undefined;
    const candidateHash = derive(candidate, credential.passwordSalt);
    if (!timingSafeEqual(candidateHash, credential.passwordHash)) return undefined;
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + PROJECT_MASTER_ADMIN_SESSION_TTL_SECONDS * 1000).toISOString();
    const token = this.newSessionToken();
    this.repository.insertAdminSession({ tokenHash: token.tokenHash, createdAt: now.toISOString(), expiresAt });
    return { rawToken: token.rawToken, expiresAt };
  }

  authorizeAdmin(rawToken: string | undefined): { id: number; expiresAt: string } | undefined {
    if (!rawToken) return undefined;
    const session = this.repository.findAdminSessionByHash(hashSessionToken(rawToken));
    if (!session || session.revokedAt !== null || Date.parse(session.expiresAt) <= this.clock().getTime()) return undefined;
    return { id: session.id, expiresAt: session.expiresAt };
  }

  logoutAdmin(rawToken: string | undefined): void {
    const session = this.authorizeAdmin(rawToken);
    if (session) this.repository.revokeAdminSession(session.id, this.clock().toISOString());
  }

  changeAdminPassword(rawToken: string | undefined, newPassword: string): { rawToken: string; expiresAt: string } {
    if (!this.authorizeAdmin(rawToken)) throw new ProjectMasterAuthorizationError();
    if (!validNewPassword(newPassword)) throw new ProjectMasterInvalidInputError();
    const salt = randomBytes(16);
    const passwordHash = derive(newPassword, salt);
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + PROJECT_MASTER_ADMIN_SESSION_TTL_SECONDS * 1000).toISOString();
    const token = this.newSessionToken();
    const transaction = this.database.transaction(() => {
      if (!this.authorizeAdmin(rawToken)) throw new ProjectMasterAuthorizationError();
      this.repository.replaceAdminCredential({ passwordSalt: salt, passwordHash, updatedAt: now.toISOString() });
      this.repository.revokeAllAdminSessions(now.toISOString());
      this.repository.insertAdminSession({ tokenHash: token.tokenHash, createdAt: now.toISOString(), expiresAt });
    });
    transaction.immediate();
    return { rawToken: token.rawToken, expiresAt };
  }

  getSelectionCatalog(): ProjectMasterSelectionResponse {
    const items = this.repository.listItems(true).map((item) => itemDto(item));
    return {
      data: {
        revision: this.repository.getRevision(),
        businessUnits: items.filter((item) => item.category === "BUSINESS_UNIT"),
        products: items.filter((item) => item.category === "PRODUCT"),
        siteEntities: items.filter((item) => item.category === "SITE_ENTITY"),
        relations: this.repository.listRelations(),
      },
    };
  }

  getAdminCatalog(rawToken: string | undefined): ProjectMasterAdminResponse {
    if (!this.authorizeAdmin(rawToken)) throw new ProjectMasterAuthorizationError();
    const items = this.repository.listItems().map((item) => itemDto(item, this.repository.usageCount(item.id)));
    const active = items.filter((item) => item.active);
    return {
      data: {
        revision: this.repository.getRevision(),
        businessUnits: active.filter((item) => item.category === "BUSINESS_UNIT"),
        products: active.filter((item) => item.category === "PRODUCT"),
        siteEntities: active.filter((item) => item.category === "SITE_ENTITY"),
        relations: this.repository.listRelations(),
        items,
      },
    };
  }

  createItem(rawToken: string | undefined, expectedRevision: number, input: CreateProjectMasterItemRequest): ProjectMasterAdminResponse {
    const category = input && validCategory(input.category) ? input.category : undefined;
    const code = normalized(input?.code, 64);
    const name = normalized(input?.name, 200);
    const active = input?.active === undefined ? true : input.active;
    const sortOrder = input?.sortOrder === undefined ? 0 : input.sortOrder;
    if (!category || !code || !name || typeof active !== "boolean" || !Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 1_000_000) {
      throw new ProjectMasterInvalidInputError();
    }
    const transaction = this.database.transaction(() => {
      if (!this.authorizeAdmin(rawToken)) throw new ProjectMasterAuthorizationError();
      if (this.repository.getRevision() !== expectedRevision) throw new ProjectMasterRevisionMismatchError();
      const publicId = this.generatePublicId();
      if (!isCanonicalUuidV4(publicId)) throw new ProjectMasterInvalidInputError();
      const now = this.clock().toISOString();
      try {
        this.repository.insertItem({ publicId, category, code, name, active, sortOrder, now });
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new ProjectMasterInvalidInputError();
        throw error;
      }
      if (!this.repository.advanceRevision(expectedRevision, now)) throw new ProjectMasterRevisionMismatchError();
      return this.getAdminCatalog(rawToken);
    });
    return transaction.immediate();
  }

  updateItem(itemPublicId: string, rawToken: string | undefined, expectedRevision: number, input: UpdateProjectMasterItemRequest): ProjectMasterAdminResponse {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProjectMasterInvalidInputError();
    const keys = Object.keys(input);
    if (keys.length === 0 || keys.some((key) => !["code", "name", "active", "sortOrder"].includes(key))) throw new ProjectMasterInvalidInputError();
    const update: UpdateProjectMasterItemRequest = {};
    if (input.code !== undefined) { const code = normalized(input.code, 64); if (!code) throw new ProjectMasterInvalidInputError(); update.code = code; }
    if (input.name !== undefined) { const name = normalized(input.name, 200); if (!name) throw new ProjectMasterInvalidInputError(); update.name = name; }
    if (input.active !== undefined) { if (typeof input.active !== "boolean") throw new ProjectMasterInvalidInputError(); update.active = input.active; }
    if (input.sortOrder !== undefined) {
      if (!Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 1_000_000) throw new ProjectMasterInvalidInputError();
      update.sortOrder = input.sortOrder;
    }
    const transaction = this.database.transaction(() => {
      if (!this.authorizeAdmin(rawToken)) throw new ProjectMasterAuthorizationError();
      if (this.repository.getRevision() !== expectedRevision) throw new ProjectMasterRevisionMismatchError();
      const current = this.repository.findItemByPublicId(itemPublicId);
      if (!current) throw new ProjectMasterItemNotFoundError();
      if (update.code !== undefined && update.code !== current.code && this.repository.usageCount(current.id) > 0) {
        throw new ProjectMasterItemInUseError();
      }
      const unchanged = (update.code === undefined || update.code === current.code) &&
        (update.name === undefined || update.name === current.name) &&
        (update.active === undefined || update.active === current.active) &&
        (update.sortOrder === undefined || update.sortOrder === current.sortOrder);
      if (unchanged) return this.getAdminCatalog(rawToken);
      const now = this.clock().toISOString();
      try {
        this.repository.updateItem(current.id, update, now);
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) throw new ProjectMasterInvalidInputError();
        throw error;
      }
      if (!this.repository.advanceRevision(expectedRevision, now)) throw new ProjectMasterRevisionMismatchError();
      return this.getAdminCatalog(rawToken);
    });
    return transaction.immediate();
  }

  mutateRelation(rawToken: string | undefined, expectedRevision: number, input: ProjectMasterRelationMutationRequest, remove: boolean): ProjectMasterAdminResponse {
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some((k) => !["businessUnitId","productId","siteEntityId"].includes(k)) ||
        !isCanonicalUuidV4(input.businessUnitId) || !isCanonicalUuidV4(input.productId) ||
        (input.siteEntityId != null && !isCanonicalUuidV4(input.siteEntityId))) throw new ProjectMasterInvalidInputError();
    const transaction = this.database.transaction(() => {
      if (!this.authorizeAdmin(rawToken)) throw new ProjectMasterAuthorizationError();
      if (this.repository.getRevision() !== expectedRevision) throw new ProjectMasterRevisionMismatchError();
      const b=this.repository.findItemByPublicId(input.businessUnitId);
      const p=this.repository.findItemByPublicId(input.productId);
      const s=input.siteEntityId ? this.repository.findItemByPublicId(input.siteEntityId) : undefined;
      if (!b || b.category!=="BUSINESS_UNIT" || !p || p.category!=="PRODUCT" ||
        (input.siteEntityId && (!s || s.category!=="SITE_ENTITY"))) throw new ProjectMasterRelationInvalidError();
      const siteId=s?.id ?? null;
      const exists=this.repository.relationExists(b.id,p.id,siteId);
      if (remove) {
        if (!exists) throw new ProjectMasterRelationInvalidError();
        if (this.repository.relationProjectUsage(b.id,p.id,siteId)>0 ||
            (siteId===null && this.repository.relationSiteCount(b.id,p.id)>0)) throw new ProjectMasterRelationInUseError();
        this.repository.removeRelation(b.id,p.id,siteId);
      } else {
        if (!b.active || !p.active || (s && !s.active)) throw new ProjectMasterItemInactiveError();
        if (siteId!==null && !this.repository.relationExists(b.id,p.id)) throw new ProjectMasterRelationInvalidError();
        if (exists) return this.getAdminCatalog(rawToken);
        this.repository.addRelation(b.id,p.id,siteId);
      }
      if (!this.repository.advanceRevision(expectedRevision,this.clock().toISOString())) throw new ProjectMasterRevisionMismatchError();
      return this.getAdminCatalog(rawToken);
    });
    return transaction.immediate();
  }

  private requireValidHierarchy(b: number | null | undefined,p: number | null | undefined,s: number | null | undefined): void {
    if (p != null && (b == null || !this.repository.relationExists(b,p))) throw new ProjectMasterRelationInvalidError();
    if (s != null && (b == null || p == null || !this.repository.relationExists(b,p,s))) throw new ProjectMasterRelationInvalidError();
  }

  resolveProjectSelection(input: {
    businessUnitId?: string | null; productId?: string | null; siteEntityId?: string | null;
  }, options: { allowInactive: boolean }): { businessUnitId?: number | null; productId?: number | null; siteEntityId?: number | null } {
    const resolve = (value: string | null | undefined, category: ProjectMasterCategory): number | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (!isCanonicalUuidV4(value)) throw new ProjectMasterInvalidInputError();
      const item = this.repository.findItemByPublicId(value);
      if (!item || item.category !== category) throw new ProjectMasterItemNotFoundError();
      if (!options.allowInactive && !item.active) throw new ProjectMasterItemInactiveError();
      return item.id;
    };
    const selected = {
      businessUnitId: resolve(input.businessUnitId, "BUSINESS_UNIT"),
      productId: resolve(input.productId, "PRODUCT"),
      siteEntityId: resolve(input.siteEntityId, "SITE_ENTITY"),
    };
    this.requireValidHierarchy(selected.businessUnitId,selected.productId,selected.siteEntityId);
    return selected;
  }

  resolveProjectSelectionForUpdate(projectId: number, input: {
    businessUnitId?: string | null; productId?: string | null; siteEntityId?: string | null;
  }): { businessUnitId?: number | null; productId?: number | null; siteEntityId?: number | null } {
    const current = this.repository.getProjectSelection(projectId);
    const resolve = (
      value: string | null | undefined,
      category: ProjectMasterCategory,
      currentItem: ProjectMasterRecord | null,
    ): number | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (!isCanonicalUuidV4(value)) throw new ProjectMasterInvalidInputError();
      const item = this.repository.findItemByPublicId(value);
      if (!item || item.category !== category) throw new ProjectMasterItemNotFoundError();
      if (!item.active && currentItem?.publicId !== item.publicId) throw new ProjectMasterItemInactiveError();
      return item.id;
    };
    const selected = {
      businessUnitId: resolve(input.businessUnitId, "BUSINESS_UNIT", current.businessUnit),
      productId: resolve(input.productId, "PRODUCT", current.product),
      siteEntityId: resolve(input.siteEntityId, "SITE_ENTITY", current.siteEntity),
    };
    const b=selected.businessUnitId === undefined ? current.businessUnit?.id ?? null : selected.businessUnitId;
    const p=selected.productId === undefined ? current.product?.id ?? null : selected.productId;
    const s=selected.siteEntityId === undefined ? current.siteEntity?.id ?? null : selected.siteEntityId;
    // Unchanged legacy/incomplete Project combinations remain readable and editable.
    if (b !== (current.businessUnit?.id ?? null) || p !== (current.product?.id ?? null) ||
        s !== (current.siteEntity?.id ?? null)) this.requireValidHierarchy(b,p,s);
    return selected;
  }

  setProjectSelection(projectId: number, resolved: { businessUnitId?: number | null; productId?: number | null; siteEntityId?: number | null }): void {
    this.repository.setProjectSelection(projectId, resolved);
  }

  projectSelectionDto(projectId: number): {
    businessUnit: ProjectMasterItemDto | null;
    product: ProjectMasterItemDto | null;
    siteEntity: ProjectMasterItemDto | null;
  } {
    const selected = this.repository.getProjectSelection(projectId);
    return {
      businessUnit: selected.businessUnit ? itemDto(selected.businessUnit) : null,
      product: selected.product ? itemDto(selected.product) : null,
      siteEntity: selected.siteEntity ? itemDto(selected.siteEntity) : null,
    };
  }

  copyProjectSelection(sourceProjectId: number, targetProjectId: number): string[] {
    const selected = this.repository.getProjectSelection(sourceProjectId);
    this.repository.setProjectSelection(targetProjectId, {
      businessUnitId: selected.businessUnit?.id ?? null,
      productId: selected.product?.id ?? null,
      siteEntityId: selected.siteEntity?.id ?? null,
    });
    const inactive = [selected.businessUnit, selected.product, selected.siteEntity].filter((item) => item && !item.active);
    return inactive.length > 0 ? ["비활성 프로젝트 기준정보가 원본 참조 그대로 보존되었습니다."] : [];
  }
}
