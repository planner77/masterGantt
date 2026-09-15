import { randomUUID } from "node:crypto";

import type {
  CreateCatalogTargetRequest,
  ReplaceResourceGroupMembersRequest,
  ReplaceTaskAssignmentsRequest,
  UpdateCatalogTargetRequest,
} from "../../contracts/resources";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import {
  parseResourceCatalogAdminCookie,
  serializeExpiredResourceCatalogAdminCookie,
  serializeResourceCatalogAdminCookie,
} from "../security/resource-catalog-cookie-core";
import type { AuthorizationResult, AuthorizedEditSession } from "../projects/project-service-core";
import {
  ResourceCatalogAuthorizationError,
  ResourceCatalogInvalidInputError,
  ResourceCatalogProjectRevisionMismatchError,
  ResourceCatalogRevisionMismatchError,
  ResourceCatalogTargetInactiveError,
  ResourceCatalogTargetNotFoundError,
  ResourceCatalogTaskNotFoundError,
  type ResourceCatalogService,
} from "./resource-catalog-service-core";

const NO_STORE = { "Cache-Control": "private, no-store" };

interface ProjectAuthorizationService {
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
}

export interface ResourceHandlerDependencies {
  resourceService: ResourceCatalogService | (() => ResourceCatalogService);
  projectService?: ProjectAuthorizationService | (() => ProjectAuthorizationService);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  adminPassword?: string;
  requestId?: () => string;
}

function resourceService(dependencies: ResourceHandlerDependencies): ResourceCatalogService {
  return typeof dependencies.resourceService === "function"
    ? dependencies.resourceService()
    : dependencies.resourceService;
}

function projectService(dependencies: ResourceHandlerDependencies): ProjectAuthorizationService {
  if (!dependencies.projectService) throw new Error("Project service dependency is missing.");
  return typeof dependencies.projectService === "function"
    ? dependencies.projectService()
    : dependencies.projectService;
}

function applicationUrl(dependencies: ResourceHandlerDependencies): URL {
  try {
    return parseApplicationBaseUrl(
      dependencies.applicationBaseUrl,
      dependencies.environment,
      dependencies.allowInsecureHttp,
    );
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
    }
    throw error;
  }
}

function requireOrigin(request: Request, url: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
}

function adminToken(request: Request, dependencies: ResourceHandlerDependencies, url: URL): string | undefined {
  return parseResourceCatalogAdminCookie(
    request.headers.get("cookie"),
    dependencies.environment,
    url,
  );
}

function authorizeProject(
  request: Request,
  publicId: string,
  dependencies: ResourceHandlerDependencies,
  url: URL,
): AuthorizedEditSession {
  const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, url);
  const result = projectService(dependencies).authorize(
    publicId,
    cookie.state === "present" ? cookie.rawToken : undefined,
  );
  if (result.kind === "projectNotFound") {
    throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }
  if (result.kind !== "authorized") {
    throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
  }
  return result.authorization;
}

function mapError(error: unknown): unknown {
  if (error instanceof ResourceCatalogAuthorizationError) {
    return new PublicApiError(401, "RESOURCE_ADMIN_SESSION_REQUIRED", "A valid resource catalog administrator session is required.");
  }
  if (error instanceof ResourceCatalogRevisionMismatchError) {
    return new PublicApiError(412, "CATALOG_REVISION_MISMATCH", "Resource catalog changed. Reload and retry.");
  }
  if (error instanceof ResourceCatalogProjectRevisionMismatchError) {
    return new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
  }
  if (error instanceof ResourceCatalogTargetNotFoundError) {
    return new PublicApiError(404, "ASSIGNMENT_TARGET_NOT_FOUND", "Resource or resource group not found.");
  }
  if (error instanceof ResourceCatalogTargetInactiveError) {
    return new PublicApiError(409, "ASSIGNMENT_TARGET_INACTIVE", "Inactive resources or groups cannot be newly assigned.");
  }
  if (error instanceof ResourceCatalogTaskNotFoundError) {
    return new PublicApiError(404, "TASK_NOT_FOUND", "Task not found.");
  }
  if (error instanceof ResourceCatalogInvalidInputError) {
    return new PublicApiError(400, "INVALID_REQUEST", "The resource catalog request is invalid.");
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")) {
    return new PublicApiError(409, "RESOURCE_CATALOG_CONFLICT", "The resource catalog change conflicts with existing data.");
  }
  return error;
}

function fail(error: unknown, requestId: string): Response {
  const response = apiErrorResponse(mapError(error), requestId);
  response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return response;
}

function json(data: unknown, status = 200, etag?: number): Response {
  return Response.json(data, {
    status,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      ...(etag ? { ETag: `"${etag}"` } : {}),
    },
  });
}

export async function handleUnlockResourceCatalogAdmin(request: Request, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    requireOrigin(request, url);
    const body = await readBoundedJson(request, 4 * 1024) as { password?: unknown };
    if (!body || typeof body.password !== "string" || body.password.length > 512) {
      throw new PublicApiError(400, "INVALID_REQUEST", "Administrator password is invalid.");
    }
    const unlocked = resourceService(dependencies).unlockAdmin(body.password, dependencies.adminPassword);
    if (!unlocked) {
      throw new PublicApiError(401, "RESOURCE_ADMIN_AUTH_FAILED", "Resource catalog administrator authentication failed.");
    }
    const response = json({ data: { permission: "resource_catalog_admin", expiresAt: unlocked.expiresAt } }, 201);
    response.headers.set("Set-Cookie", serializeResourceCatalogAdminCookie(unlocked.rawToken, url, dependencies.environment));
    return response;
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleLogoutResourceCatalogAdmin(request: Request, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    requireOrigin(request, url);
    resourceService(dependencies).logoutAdmin(adminToken(request, dependencies, url));
    const response = new Response(null, { status: 204, headers: NO_STORE });
    response.headers.set("Set-Cookie", serializeExpiredResourceCatalogAdminCookie(url, dependencies.environment));
    return response;
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleGetResourceCatalog(request: Request, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    const result = resourceService(dependencies).getCatalog(adminToken(request, dependencies, url));
    return json(result, 200, result.data.revision);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleCreateCatalogTarget(request: Request, kind: "resource" | "group", dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    requireOrigin(request, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request) as CreateCatalogTargetRequest;
    const result = resourceService(dependencies).createTarget(kind, adminToken(request, dependencies, url), expectedRevision, body);
    return json(result, 201, result.data.revision);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleUpdateCatalogTarget(request: Request, kind: "resource" | "group", targetId: string, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    requireOrigin(request, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request) as UpdateCatalogTargetRequest;
    const result = resourceService(dependencies).updateTarget(kind, targetId, adminToken(request, dependencies, url), expectedRevision, body);
    return json(result, 200, result.data.revision);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleReplaceResourceGroupMembers(request: Request, groupId: string, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    requireOrigin(request, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request) as ReplaceResourceGroupMembersRequest;
    const result = resourceService(dependencies).replaceGroupMembers(groupId, adminToken(request, dependencies, url), expectedRevision, body);
    return json(result, 200, result.data.revision);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleSearchAssignmentTargets(request: Request, publicId: string, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    const authorization = authorizeProject(request, publicId, dependencies, url);
    const params = new URL(request.url).searchParams;
    const rawKind = params.get("kind");
    const kind = rawKind === null ? undefined : rawKind === "resource" || rawKind === "group" ? rawKind : (() => { throw new PublicApiError(400, "INVALID_REQUEST", "kind is invalid."); })();
    const result = resourceService(dependencies).searchTargets(authorization, kind, params.get("q") ?? undefined);
    return json(result, 200, result.data.catalogRevision);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleGetAssignedTargets(request: Request, publicId: string, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    applicationUrl(dependencies);
    const result = resourceService(dependencies).getAssignedTargets(publicId);
    if (!result) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    return json(result, 200);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function handleReplaceTaskAssignments(request: Request, publicId: string, taskId: string, dependencies: ResourceHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = applicationUrl(dependencies);
    requireOrigin(request, url);
    const expectedRevision = parseRequiredIfMatch(request);
    const authorization = authorizeProject(request, publicId, dependencies, url);
    const body = await readBoundedJson(request) as ReplaceTaskAssignmentsRequest;
    const result = resourceService(dependencies).replaceTaskAssignments(authorization, expectedRevision, taskId, body);
    return json(result, 200, result.data.projectRevision);
  } catch (error) {
    return fail(error, requestId);
  }
}
