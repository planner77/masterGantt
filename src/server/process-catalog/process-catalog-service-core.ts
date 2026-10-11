import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ProcessCatalogKind, ProcessCatalogQuery, ProcessCatalogTriple, ProcessCatalogResponse, ProcessContextResponse, ProcessStandardDiff, ProcessStandardDiffResponse, ProjectProcessMappingResponse, } from "../../contracts/process-catalog";
import { ProcessCatalogRepository, type ProcessCatalogRecord, type InternalProcessTriple } from "../repositories/process-catalog-repository-core";
import { ProjectMasterRepository } from "../repositories/project-master-repository-core";
import { ProjectMasterService } from "../project-master/project-master-service-core";
import { ProjectRepository, EditSessionRepository } from "../repositories/project-repository-core";
import { LogisticsRepository } from "../repositories/logistics-repository-core";
import { LogisticsService } from "../logistics/logistics-service-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizedEditSession } from "../projects/project-service-core";
export class ProcessCatalogError extends Error {
  constructor(public readonly status: number, public readonly code: string, message = code) {
    super(message);
    this.name = "ProcessCatalogError";
  }
}
export const PROCESS_CATALOG_LIMIT = 200;
function fail(status: number, code: string): never {
  throw new ProcessCatalogError(status, code);
}
const inputObject = (input: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(400, "INVALID_REQUEST");
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    return fail(400, "INVALID_REQUEST");
  }
  return value;
};
const uuid = (value: unknown): string => typeof value === "string" && isCanonicalUuidV4(value) ? value : fail(400, "INVALID_REQUEST");
const text = (value: unknown, max: number): string => {
  if (typeof value !== "string") {
    return fail(400, "INVALID_REQUEST");
  }
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > max || Array.from(normalized).some((char) => char.length === 1 && /[\ud800-\udfff]/.test(char)) || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return fail(400, "INVALID_REQUEST");
  }
  return normalized;
};
const commonKeys = ["code", "name", "active", "sortOrder"];
const parentKeys: Record<ProcessCatalogKind, string[]> = {
  types: [], standards: ["productId", "processTypeId"], occurrences: ["businessUnitId", "productId", "siteEntityId", "processTypeId", "standardProcessId"], workAreas: ["occurrenceId"]
};
const parentColumns: Record<string, string> = {
  productId: "product_id", processTypeId: "process_type_id", businessUnitId: "business_unit_id", siteEntityId: "site_entity_id", standardProcessId: "standard_process_id", occurrenceId: "occurrence_id"
};
const dtoCommon = (row: ProcessCatalogRecord) => ({
  id: row.public_id, code: row.code, name: row.name, active: row.active === 1, sortOrder: row.sort_order, usageCount: row.usage_count
});
export class ProcessCatalogService {
  private readonly repository: ProcessCatalogRepository;
  private readonly master: ProjectMasterRepository;
  private readonly masterService: ProjectMasterService;
  private readonly projects: ProjectRepository;
  private readonly logistics: LogisticsRepository;
  private readonly sessions: EditSessionRepository;
  private readonly clock: () => Date;
  private readonly generatePublicId: () => string;
  constructor(private readonly database: Database.Database, options: {
    clock?: () => Date;
    generatePublicId?: () => string;
  } = {}) {
    this.repository = new ProcessCatalogRepository(database);
    this.master = new ProjectMasterRepository(database);
    this.masterService = new ProjectMasterService(database, options);
    this.projects = new ProjectRepository(database);
    this.logistics = new LogisticsRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.clock = options.clock ?? (() => new Date());
    this.generatePublicId = options.generatePublicId ?? randomUUID;
  }
  authorizeAdmin(rawToken: string | undefined): void {
    if (!this.masterService.authorizeAdmin(rawToken)) {
      fail(401, "PROJECT_MASTER_ADMIN_SESSION_REQUIRED");
    }
  }
  private write<T>(operation: () => T): T {
    try {
      return this.database.transaction(operation).immediate();
    }
    catch (error) {
      if (error instanceof ProcessCatalogError) {
        throw error;
      }
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code.startsWith("SQLITE_CONSTRAINT_UNIQUE") || code.startsWith("SQLITE_CONSTRAINT_PRIMARYKEY")) {
        fail(409, "PROCESS_CATALOG_CONFLICT");
      }
      if (code.startsWith("SQLITE_CONSTRAINT_FOREIGNKEY")) {
        fail(409, "PROCESS_CATALOG_IN_USE");
      }
      throw error;
    }
  }
  private query(input: ProcessCatalogQuery = {}): Required<Pick<ProcessCatalogQuery, "limit">> & ProcessCatalogQuery {
    inputObject(input, ["search", "limit", "active"]);
    const limit = input.limit ?? PROCESS_CATALOG_LIMIT;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PROCESS_CATALOG_LIMIT || input.active !== undefined && typeof input.active !== "boolean") {
      fail(400, "INVALID_REQUEST");
    }
    const search = input.search === undefined ? undefined : typeof input.search === "string" && Array.from(input.search).length <= 200 ? input.search.trim() : fail(400, "INVALID_REQUEST");
    return {
      limit, search, active: input.active
    };
  }
  private bounded<T>(rows: T[], limit: number): T[] {
    if (rows.length > limit) {
      fail(422, "PROCESS_CATALOG_LIMIT_EXCEEDED");
    }
    return rows;
  }
  private readRows(options: {
    limit: number;
    search?: string;
    active?: boolean;
    productId?: number;
    triple?: InternalProcessTriple;
  }) {
    return {
      types: this.bounded(this.repository.list("types", options), options.limit), standards: this.bounded(this.repository.list("standards", options), options.limit),
      occurrences: this.bounded(this.repository.list("occurrences", options), options.limit), workAreas: this.bounded(this.repository.list("workAreas", options), options.limit),
    };
  }
  private response(rows: ReturnType<ProcessCatalogService["readRows"]>): ProcessCatalogResponse {
    return { data: {
        processCatalogRevision: this.repository.revision(), types: rows.types.map(dtoCommon),
        standards: rows.standards.map((row) => ({
          ...dtoCommon(row), productId: row.product_public_id!, processTypeId: row.type_public_id!
        })),
        occurrences: rows.occurrences.map((row) => ({
          ...dtoCommon(row), businessUnitId: row.business_unit_public_id!, productId: row.product_public_id!, siteEntityId: row.site_public_id!, processTypeId: row.type_public_id!, standardProcessId: row.standard_public_id ?? null, source: row.standard_process_id === null ? "site_addition" : "standard"
        })),
        workAreas: rows.workAreas.map((row) => ({
          ...dtoCommon(row), occurrenceId: row.occurrence_public_id!
        }))
      } };
  }
  getCatalog(rawToken: string | undefined, query: ProcessCatalogQuery = {}): ProcessCatalogResponse {
    return this.database.transaction(() => {
      this.authorizeAdmin(rawToken);
      return this.response(this.readRows(this.query(query)));
    })();
  }
  private requireRevision(expected: number): void {
    if (!Number.isSafeInteger(expected) || expected < 1) {
      fail(400, "INVALID_REQUEST");
    }
    if (this.repository.revision() !== expected) {
      fail(412, "PROCESS_CATALOG_REVISION_MISMATCH");
    }
  }
  private find(kind: ProcessCatalogKind, id: unknown): ProcessCatalogRecord {
    const row = this.repository.find(kind, uuid(id));
    if (!row) {
      return fail(400, "INVALID_SELECTION");
    }
    return row;
  }
  private active(row: {
    active: number | boolean;
  }, retained = false): void {
    if (!row.active && !retained) {
      fail(409, "PROCESS_CATALOG_INACTIVE");
    }
  }
  private activeOccurrenceParents(occurrence: ProcessCatalogRecord, retained = false): void {
    this.active(occurrence, retained);
    this.active(this.find("types", occurrence.type_public_id), retained);
    if (occurrence.standard_public_id) {
      this.active(this.find("standards", occurrence.standard_public_id), retained);
    }
    for (const id of [occurrence.business_unit_id, occurrence.product_id, occurrence.site_entity_id]) {
      const item = this.master.findItemById(id!);
      if (!item) {
        fail(400, "INVALID_SELECTION");
      }
      this.active(item, retained);
    }
  }
  private resolveMaster(id: unknown, category: "PRODUCT" | "BUSINESS_UNIT" | "SITE_ENTITY", retainedId?: number): number {
    const item = this.master.findItemByPublicId(uuid(id));
    if (!item || item.category !== category) {
      return fail(400, "INVALID_SELECTION");
    }
    this.active(item, item.id === retainedId);
    return item.id;
  }
  private triple(input: Record<string, unknown>, allowInactive = false): InternalProcessTriple {
    const resolve = (key: string, category: "PRODUCT" | "BUSINESS_UNIT" | "SITE_ENTITY") => {
      const item = this.master.findItemByPublicId(uuid(input[key]));
      if (!item || item.category !== category) {
        return fail(400, "INVALID_SELECTION");
      }
      this.active(item, allowInactive);
      return item.id;
    };
    const triple = {
      businessUnitId: resolve("businessUnitId", "BUSINESS_UNIT"), productId: resolve("productId", "PRODUCT"), siteEntityId: resolve("siteEntityId", "SITE_ENTITY")
    };
    if (!this.master.relationExists(triple.businessUnitId, triple.productId, triple.siteEntityId)) {
      fail(400, "INVALID_SELECTION");
    }
    return triple;
  }
  private values(kind: ProcessCatalogKind, input: Record<string, unknown>, current?: ProcessCatalogRecord): Record<string, string | number | null> {
    const value: Record<string, string | number | null> = {};
    if (input.code !== undefined || !current) {
      value.code = text(input.code, 64);
    }
    if (input.name !== undefined || !current) {
      value.name = text(input.name, 200);
    }
    if (input.active !== undefined || !current) {
      if (input.active !== undefined && typeof input.active !== "boolean") {
        fail(400, "INVALID_REQUEST");
      }
      value.active = input.active === false ? 0 : 1;
    }
    if (input.sortOrder !== undefined || !current) {
      const order = input.sortOrder ?? 0;
      if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order > 1000000) {
        fail(400, "INVALID_REQUEST");
      }
      value.sort_order = order;
    }
    if (kind === "types" && current && value.code !== undefined && value.code !== current.code) {
      fail(409, "PROCESS_TYPE_CODE_IMMUTABLE");
    }
    for (const key of parentKeys[kind]) {
      if (input[key] === undefined && current) {
        continue;
      }
      const column = parentColumns[key], currentId = current?.[column as keyof ProcessCatalogRecord] as number | undefined;
      if (key === "standardProcessId" && (input[key] === undefined || input[key] === null)) {
        value[column] = null;
        continue;
      }
      if (key === "productId") {
        value[column] = this.resolveMaster(input[key], "PRODUCT", currentId);
      }
      else if (key === "businessUnitId") {
        value[column] = this.resolveMaster(input[key], "BUSINESS_UNIT", currentId);
      }
      else if (key === "siteEntityId") {
        value[column] = this.resolveMaster(input[key], "SITE_ENTITY", currentId);
      }
      else {
        const parent = this.find(key === "processTypeId" ? "types" : key === "standardProcessId" ? "standards" : "occurrences", input[key]);
        this.active(parent, parent.id === currentId);
        if (key === "occurrenceId") {
          this.activeOccurrenceParents(parent, parent.id === currentId);
        }
        value[column] = parent.id;
      }
    }
    const final = {
      ...current, ...value
    };
    if (current && parentKeys[kind].some((key) => value[parentColumns[key]] !== undefined && value[parentColumns[key]] !== current[parentColumns[key] as keyof ProcessCatalogRecord])) {
      if (kind === "workAreas") {
        fail(409, "WORK_AREA_REPARENT_FORBIDDEN");
      }
      if (current.usage_count > 0) {
        fail(409, "PROCESS_CATALOG_IN_USE");
      }
    }
    if (current && value.code !== undefined && value.code !== current.code && current.usage_count > 0) {
      fail(409, "PROCESS_CATALOG_IN_USE");
    }
    if (kind === "occurrences") {
      if (!this.master.relationExists(final.business_unit_id!, final.product_id!, final.site_entity_id!)) {
        fail(400, "INVALID_SELECTION");
      }
      if (final.standard_process_id !== null) {
        const standard = this.repository.standardIdentity(final.standard_process_id!);
        if (!standard || standard.product_id !== final.product_id || standard.process_type_id !== final.process_type_id) {
          fail(400, "STANDARD_PROCESS_MISMATCH");
        }
      }
    }
    return value;
  }
  mutate(rawToken: string | undefined, expected: number, kind: ProcessCatalogKind, action: "create" | "update" | "delete", id: string | null, input: unknown): ProcessCatalogResponse {
    if (!Object.hasOwn(parentKeys, kind) || !["create", "update", "delete"].includes(action)) {
      fail(400, "INVALID_REQUEST");
    }
    return this.write(() => {
      this.authorizeAdmin(rawToken);
      this.requireRevision(expected);
      const current = action === "create" ? undefined : this.find(kind, id);
      if (action === "delete") {
        inputObject(input ?? {}, []);
        if (current!.usage_count > 0) {
          fail(409, "PROCESS_CATALOG_IN_USE");
        }
        this.repository.remove(kind, current!.id);
      }
      else {
        const parsed = inputObject(input, [...commonKeys, ...parentKeys[kind]]);
        if (current && !Object.keys(parsed).length) {
          fail(400, "INVALID_REQUEST");
        }
        const values = this.values(kind, parsed, current);
        if (current && Object.entries(values).every(([key, value]) => current[key as keyof ProcessCatalogRecord] === value)) {
          return this.getCatalog(rawToken);
        }
        if (current) {
          this.repository.update(kind, current.id, values, this.clock().toISOString());
        }
        else {
          this.repository.insert(kind, uuid(this.generatePublicId()), values, this.clock().toISOString());
        }
      }
      if (!this.repository.advance(expected, this.clock().toISOString())) {
        fail(412, "PROCESS_CATALOG_REVISION_MISMATCH");
      }
      return this.getCatalog(rawToken);
    });
  }
  private standardDiff(triple: InternalProcessTriple): ProcessStandardDiff {
    const standards = this.bounded(this.repository.list("standards", {
      limit: PROCESS_CATALOG_LIMIT, productId: triple.productId
    }), PROCESS_CATALOG_LIMIT);
    const occurrences = this.bounded(this.repository.list("occurrences", {
      limit: PROCESS_CATALOG_LIMIT, triple
    }), PROCESS_CATALOG_LIMIT);
    return {
      missingStandardIds: standards.filter((s) => s.active === 1 && !occurrences.some((o) => o.standard_process_id === s.id)).map((s) => s.public_id).sort(),
      retiredOccurrenceIds: occurrences.filter((o) => o.standard_process_id !== null && !standards.some((s) => s.id === o.standard_process_id && s.active === 1)).map((o) => o.public_id).sort(),
      changed: standards.flatMap((s) => occurrences.filter((o) => o.standard_process_id === s.id && (o.name !== s.name || o.sort_order !== s.sort_order)).map((o) => ({
        standardId: s.public_id, occurrenceId: o.public_id, fields: ([...(o.name !== s.name ? ["name" as const] : []), ...(o.sort_order !== s.sort_order ? ["sortOrder" as const] : [])]), canApply: s.active === 1
      })))
    };
  }
  diff(rawToken: string | undefined, input: ProcessCatalogTriple): ProcessStandardDiffResponse {
    return this.database.transaction(() => {
      this.authorizeAdmin(rawToken);
      const triple = this.triple(inputObject(input, ["businessUnitId", "productId", "siteEntityId"]), true);
      return { data: {
          processCatalogRevision: this.repository.revision(), standardDiff: this.standardDiff(triple)
        } };
    })();
  }
  applyStandards(rawToken: string | undefined, expected: number, input: unknown): ProcessCatalogResponse {
    return this.write(() => {
      this.authorizeAdmin(rawToken);
      this.requireRevision(expected);
      const parsed = inputObject(input, ["businessUnitId", "productId", "siteEntityId", "standardIds"]), triple = this.triple(parsed);
      if (!Array.isArray(parsed.standardIds) || !parsed.standardIds.length || parsed.standardIds.length > PROCESS_CATALOG_LIMIT || new Set(parsed.standardIds).size !== parsed.standardIds.length) {
        fail(400, "INVALID_REQUEST");
      }
      let changed = false;
      for (const id of parsed.standardIds as unknown[]) {
        const standard = this.find("standards", id);
        this.active(standard);
        this.active(this.find("types", standard.type_public_id));
        if (standard.product_id !== triple.productId) {
          fail(400, "INVALID_SELECTION");
        }
        const current = this.repository.occurrenceForStandard(triple, standard.id);
        if (current) {
          if (current.name === standard.name && current.sort_order === standard.sort_order) {
            continue;
          }
          this.repository.update("occurrences", current.id, {
            name: standard.name, sort_order: standard.sort_order
          }, this.clock().toISOString());
        }
        else {
          this.repository.insert("occurrences", uuid(this.generatePublicId()), {
            code: standard.code, name: standard.name, active: 1, sort_order: standard.sort_order, business_unit_id: triple.businessUnitId, product_id: triple.productId, site_entity_id: triple.siteEntityId, process_type_id: standard.process_type_id!, standard_process_id: standard.id
          }, this.clock().toISOString());
        }
        changed = true;
      }
      if (changed && !this.repository.advance(expected, this.clock().toISOString())) {
        fail(412, "PROCESS_CATALOG_REVISION_MISMATCH");
      }
      return this.getCatalog(rawToken);
    });
  }
  context(projectPublicId: string, query: ProcessCatalogQuery = {}): ProcessContextResponse {
    return this.database.transaction(() => {
      const project = this.projects.findByPublicId(uuid(projectPublicId));
      if (!project) {
        return fail(404, "PROJECT_NOT_FOUND");
      }
      const selected = this.master.getProjectSelection(project.id), options = this.query(query);
      const mappings = this.bounded(this.repository.mappings(project.id, options.limit), options.limit);
      const identity = {
        projectRevision: project.revision, projectMasterRevision: this.master.getRevision(), selection: {
          businessUnitId: selected.businessUnit?.publicId ?? null, productId: selected.product?.publicId ?? null, siteEntityId: selected.siteEntity?.publicId ?? null
        }
      };
      if (!selected.businessUnit || !selected.product || !selected.siteEntity || !this.master.relationExists(selected.businessUnit.id, selected.product.id, selected.siteEntity.id)) {
        return { data: {
            ...identity, selectionValid: false, processCatalogRevision: this.repository.revision(), types: [], standards: [], occurrences: [], workAreas: [], mappings, standardDiff: {
              missingStandardIds: [], retiredOccurrenceIds: [], changed: []
            }
          } };
      }
      const triple = {
        businessUnitId: selected.businessUnit.id, productId: selected.product.id, siteEntityId: selected.siteEntity.id
      };
      const rows = this.readRows({
        limit: options.limit, productId: triple.productId, triple
      });
      if (options.search || options.active !== undefined) {
        const matches = (r: ProcessCatalogRecord) => (options.active === undefined || Boolean(r.active) === options.active) && (!options.search || `${r.code} ${r.name}`.toLocaleLowerCase().includes(options.search.toLocaleLowerCase()));
        rows.workAreas = rows.workAreas.filter((r) => matches(r) || mappings.some((m) => m.workAreaId === r.public_id));
        rows.occurrences = rows.occurrences.filter((r) => matches(r) || mappings.some((m) => m.occurrenceId === r.public_id) || rows.workAreas.some((w) => w.occurrence_id === r.id));
        rows.standards = rows.standards.filter((r) => matches(r) || rows.occurrences.some((o) => o.standard_process_id === r.id));
        rows.types = rows.types.filter((r) => matches(r) || rows.occurrences.some((o) => o.process_type_id === r.id) || rows.standards.some((s) => s.process_type_id === r.id));
      }
      return { data: {
          ...this.response(rows).data, ...identity, selectionValid: true, mappings, standardDiff: this.standardDiff(triple)
        } };
    })();
  }
  mapProjectProcess(authorization: AuthorizedEditSession, expected: number, processId: string, input: unknown): ProjectProcessMappingResponse {
    return this.write<ProjectProcessMappingResponse>(() => {
      const project = this.projects.findCredentialById(authorization.projectId), session = this.sessions.findById(authorization.sessionId);
      if (!project || !session || project.publicId !== authorization.projectPublicId || session.projectId !== project.id || project.authVersion !== authorization.projectAuthVersion || session.authVersion !== project.authVersion || !session.tokenHash.equals(authorization.tokenHash) || session.revokedAt !== null || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= this.clock().getTime()) {
        fail(401, "EDIT_SESSION_REQUIRED");
      }
      if (project.revision !== expected) {
        fail(412, "REVISION_MISMATCH");
      }
      const parsed = inputObject(input, ["processCatalogRevision", "occurrenceId", "workAreaId"]);
      this.requireRevision(parsed.processCatalogRevision as number);
      const process = this.logistics.findProcessByPublicId(project.id, uuid(processId));
      if (!process) {
        fail(404, "PROCESS_NOT_FOUND");
      }
      const current = this.repository.mapping(project.id, process.id);
      const occurrence = parsed.occurrenceId === null ? null : this.find("occurrences", parsed.occurrenceId);
      const workArea = parsed.workAreaId === undefined || parsed.workAreaId === null ? null : this.find("workAreas", parsed.workAreaId);
      if (!occurrence && workArea) {
        fail(400, "WORK_AREA_OCCURRENCE_MISMATCH");
      }
      if (occurrence) {
        const selected = this.master.getProjectSelection(project.id);
        if (occurrence.business_unit_id !== selected.businessUnit?.id || occurrence.product_id !== selected.product?.id || occurrence.site_entity_id !== selected.siteEntity?.id) {
          fail(409, "PROJECT_PROCESS_MAPPING_TRIPLE_MISMATCH");
        }
        if (workArea && workArea.occurrence_id !== occurrence.id) {
          fail(400, "WORK_AREA_OCCURRENCE_MISMATCH");
        }
        const addsReference = current?.occurrence_id !== occurrence.id || (workArea !== null && current?.work_area_id !== workArea.id);
        this.activeOccurrenceParents(occurrence, !addsReference);
        if (addsReference && !process.active) {
          fail(409, "PROCESS_CATALOG_INACTIVE");
        }
        if (workArea) {
          this.active(workArea, current?.work_area_id === workArea.id);
        }
        if (current?.occurrence_id !== occurrence.id) {
          this.active(selected.businessUnit!);
          this.active(selected.product!);
          this.active(selected.siteEntity!);
        }
      }
      const changed = (current?.occurrence_id ?? null) !== (occurrence?.id ?? null) || (current?.work_area_id ?? null) !== (workArea?.id ?? null);
      if (changed) {
        this.repository.setMapping(project.id, process.id, occurrence, workArea, this.clock().toISOString());
        if (!this.projects.advanceRevision(project.id, expected, this.clock().toISOString())) {
          fail(412, "REVISION_MISMATCH");
        }
      }
      const logistics = new LogisticsService(this.database, { clock: this.clock });
      return { data: {
          project: logistics.getProjectDto(project.id), logistics: logistics.getLogisticsDto(project.id), permission: "edit", processCatalogRevision: this.repository.revision(), mappings: this.bounded(this.repository.mappings(project.id, PROCESS_CATALOG_LIMIT), PROCESS_CATALOG_LIMIT), operation: {
            kind: "processMapping", processId, changed
          }
        } };
    });
  }
}
