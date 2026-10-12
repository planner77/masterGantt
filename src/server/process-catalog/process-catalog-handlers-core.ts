import { randomUUID } from "node:crypto";
import type { ProcessContextResponse } from "../../contracts/process-catalog";

import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { EditSessionInvalidError, RevisionMismatchError, type AuthorizationResult } from "../projects/project-service-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { parseProjectMasterAdminCookie } from "../security/project-master-admin-cookie-core";
import { ProcessCatalogError, type ProcessCatalogService } from "./process-catalog-service-core";

const NO_STORE = { "Cache-Control": "private, no-store" };
export type ProcessCatalogKind = "types" | "standards" | "occurrences" | "workAreas";

export interface ProcessCatalogHandlerDependencies {
  service: ProcessCatalogService | (() => ProcessCatalogService);
  projectService?: { authorize(publicId: string, rawToken: string | undefined): AuthorizationResult } | (() => { authorize(publicId: string, rawToken: string | undefined): AuthorizationResult });
  applicationBaseUrl?: string;
  allowInsecureHttp?: string;
  environment?: string;
  requestId?: () => string;
}

function resolve<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function invalid(): never {
  throw new PublicApiError(400, "INVALID_REQUEST", "The process catalog request is invalid.");
}

function applicationUrl(d: ProcessCatalogHandlerDependencies): URL {
  try { return parseApplicationBaseUrl(d.applicationBaseUrl, d.environment, d.allowInsecureHttp); }
  catch (error) {
    if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
    throw error;
  }
}

function requireOrigin(request: Request, url: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
}

function adminToken(request: Request, d: ProcessCatalogHandlerDependencies, url: URL): string | undefined {
  return parseProjectMasterAdminCookie(request.headers.get("cookie"), d.environment, url);
}

function json(body: unknown, revision: number, status = 200): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ETag: `"${revision}"` } });
}

function fail(error: unknown, d: ProcessCatalogHandlerDependencies): Response {
  let mapped = error;
  if (error instanceof ProcessCatalogError) mapped = new PublicApiError(error.status, error.code, error.message);
  else if (error instanceof EditSessionInvalidError) mapped = new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  else if (error instanceof RevisionMismatchError) mapped = new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
  const response = apiErrorResponse(mapped, (d.requestId ?? randomUUID)());
  response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return response;
}

function query(request: Request, keys: string[]): URLSearchParams {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) if (!keys.includes(key) || params.getAll(key).length !== 1) invalid();
  return params;
}

function listQuery(request: Request): { search?: string; limit?: number; active?: boolean } {
  const params = query(request, ["search", "limit", "active"]);
  const result: { search?: string; limit?: number; active?: boolean } = {};
  const search = params.get("search");
  if (search !== null) {
    if (search.trim().length === 0 || Array.from(search).length > 100 || /[\u0000-\u001f\u007f]/u.test(search)) invalid();
    result.search = search.trim();
  }
  const limit = params.get("limit");
  if (limit !== null) {
    if (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 200) invalid();
    result.limit = Number(limit);
  }
  const active = params.get("active");
  if (active !== null) {
    if (active !== "true" && active !== "false") invalid();
    result.active = active === "true";
  }
  return result;
}

function projectAuthorization(request: Request, publicId: string, d: ProcessCatalogHandlerDependencies, url: URL): AuthorizationResult {
  if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  if (!d.projectService) throw new Error("Project authorization dependency is required.");
  const cookie = parseEditSessionCookie(request.headers.get("cookie"), d.environment, url);
  const authorization = resolve(d.projectService).authorize(publicId, cookie.state === "present" ? cookie.rawToken : undefined);
  if (authorization.kind === "projectNotFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  return authorization;
}

export function handleGetProcessCatalog(request: Request, d: ProcessCatalogHandlerDependencies): Response {
  try {
    const url = applicationUrl(d);
    const result = resolve(d.service).getCatalog(adminToken(request, d, url), listQuery(request));
    return json(result, result.data.processCatalogRevision);
  } catch (error) { return fail(error, d); }
}

export async function handleMutateProcessCatalog(request: Request, kind: ProcessCatalogKind, action: "create" | "update" | "delete", id: string | null, d: ProcessCatalogHandlerDependencies): Promise<Response> {
  try {
    const url = applicationUrl(d);
    requireOrigin(request, url);
    query(request, []);
    const service = resolve(d.service);
    const token = adminToken(request, d, url);
    service.authorizeAdmin(token);
    const revision = parseRequiredIfMatch(request);
    if (id !== null && !isCanonicalUuidV4(id)) invalid();
    let body: unknown;
    if (action === "delete") {
      if (request.body !== null) invalid();
    } else body = await readBoundedJson(request);
    const result = service.mutate(token, revision, kind, action, id, body);
    return json(result, result.data.processCatalogRevision, action === "create" ? 201 : 200);
  } catch (error) { return fail(error, d); }
}

export function handleGetProcessStandardDiff(request: Request, d: ProcessCatalogHandlerDependencies): Response {
  try {
    const url = applicationUrl(d);
    const params = query(request, ["businessUnitId", "productId", "siteEntityId"]);
    const businessUnitId = params.get("businessUnitId");
    const productId = params.get("productId");
    const siteEntityId = params.get("siteEntityId");
    if (!businessUnitId || !productId || !siteEntityId || ![businessUnitId, productId, siteEntityId].every(isCanonicalUuidV4)) invalid();
    const result = resolve(d.service).diff(adminToken(request, d, url), { businessUnitId, productId, siteEntityId });
    return json(result, result.data.processCatalogRevision);
  } catch (error) { return fail(error, d); }
}

export async function handleApplyProcessStandards(request: Request, d: ProcessCatalogHandlerDependencies): Promise<Response> {
  try {
    const url = applicationUrl(d);
    requireOrigin(request, url);
    query(request, []);
    const service = resolve(d.service);
    const token = adminToken(request, d, url);
    service.authorizeAdmin(token);
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request);
    const result = service.applyStandards(token, revision, body);
    return json(result, result.data.processCatalogRevision);
  } catch (error) { return fail(error, d); }
}

export function handleGetProjectProcessContext(request: Request, publicId: string, d: ProcessCatalogHandlerDependencies): Response {
  try {
    const url = applicationUrl(d);
    const authorization = projectAuthorization(request, publicId, d, url);
    const result = resolve(d.service).context(publicId, listQuery(request));
    const response: ProcessContextResponse = {
      data: { ...result.data, permission: authorization.kind === "authorized" ? "edit" : "readonly" },
    };
    return json(response, result.data.projectRevision);
  } catch (error) { return fail(error, d); }
}

export async function handleMapProjectProcess(request: Request, publicId: string, processId: string, d: ProcessCatalogHandlerDependencies): Promise<Response> {
  try {
    const url = applicationUrl(d);
    requireOrigin(request, url);
    query(request, []);
    const authorization = projectAuthorization(request, publicId, d, url);
    if (authorization.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
    if (!isCanonicalUuidV4(processId)) invalid();
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request);
    const result = resolve(d.service).mapProjectProcess(authorization.authorization, revision, processId, body);
    return json(result, result.data.project.revision);
  } catch (error) { return fail(error, d); }
}
