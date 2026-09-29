import { randomUUID } from "node:crypto";

import type { CreateProjectMasterItemRequest, UpdateProjectMasterItemRequest } from "../../contracts/project-master";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import {
  parseProjectMasterAdminCookie,
  serializeExpiredProjectMasterAdminCookie,
  serializeProjectMasterAdminCookie,
} from "../security/project-master-admin-cookie-core";
import {
  ProjectMasterAuthorizationError,
  ProjectMasterInvalidInputError,
  ProjectMasterItemInUseError,
  ProjectMasterItemNotFoundError,
  ProjectMasterRevisionMismatchError,
  type ProjectMasterService,
} from "./project-master-service-core";

interface Dependencies {
  service: ProjectMasterService | (() => ProjectMasterService);
  applicationBaseUrl?: string;
  allowInsecureHttp?: string;
  environment?: string;
  adminPassword?: string;
  requestId?: () => string;
}

const NO_STORE = { "Cache-Control": "private, no-store" };

function resolve<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function appUrl(dependencies: Dependencies): URL {
  try {
    return parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp);
  } catch (error) {
    if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
    throw error;
  }
}

function requireOrigin(request: Request, url: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
}

function token(request: Request, dependencies: Dependencies, url: URL): string | undefined {
  return parseProjectMasterAdminCookie(request.headers.get("cookie"), dependencies.environment, url);
}

function mapped(error: unknown): unknown {
  if (error instanceof ProjectMasterAuthorizationError) return new PublicApiError(401, "PROJECT_MASTER_ADMIN_REQUIRED", "Project master administrator authentication is required.");
  if (error instanceof ProjectMasterRevisionMismatchError) return new PublicApiError(412, "PROJECT_MASTER_REVISION_MISMATCH", "Project master catalog changed. Reload and retry.");
  if (error instanceof ProjectMasterItemNotFoundError) return new PublicApiError(400, "PROJECT_MASTER_ITEM_NOT_FOUND", "The selected project master item is invalid.");
  if (error instanceof ProjectMasterItemInUseError) return new PublicApiError(409, "PROJECT_MASTER_ITEM_IN_USE", "A referenced master code cannot be changed.");
  if (error instanceof ProjectMasterInvalidInputError) return new PublicApiError(400, "INVALID_REQUEST", "The project master input is invalid.");
  return error;
}

function response(body: unknown, status = 200, revision?: number): Response {
  return Response.json(body, {
    status,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      ...(revision === undefined ? {} : { ETag: `"${revision}"` }),
    },
  });
}

function fail(error: unknown, requestId: string): Response {
  const result = apiErrorResponse(mapped(error), requestId);
  result.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return result;
}

export function handleGetProjectMasterSelection(dependencies: Pick<Dependencies, "service" | "requestId">): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const result = resolve(dependencies.service).getSelectionCatalog();
    return response(result, 200, result.data.revision);
  } catch (error) {
    return fail(error, requestId);
  }
}

export function handleGetProjectMasterAdmin(request: Request, dependencies: Dependencies): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies);
    const result = resolve(dependencies.service).getAdminCatalog(token(request, dependencies, url));
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleCreateProjectMasterItem(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url);
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request) as CreateProjectMasterItemRequest;
    const result = resolve(dependencies.service).createItem(token(request, dependencies, url), revision, body);
    return response(result, 201, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleUpdateProjectMasterItem(request: Request, itemId: string, dependencies: Dependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url);
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request) as UpdateProjectMasterItemRequest;
    const result = resolve(dependencies.service).updateItem(itemId, token(request, dependencies, url), revision, body);
    return response(result, 200, result.data.revision);
  } catch (error) { return fail(error, requestId); }
}

export async function handleUnlockProjectMasterAdmin(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url);
    const body = await readBoundedJson(request, 4 * 1024) as { password?: unknown };
    if (!body || typeof body.password !== "string") throw new PublicApiError(400, "INVALID_REQUEST", "Administrator password is invalid.");
    const unlocked = resolve(dependencies.service).unlockAdmin(body.password, dependencies.adminPassword);
    if (!unlocked) throw new PublicApiError(401, "PROJECT_MASTER_ADMIN_AUTH_FAILED", "Project master administrator authentication failed.");
    const result = response({ data: { permission: "project_master_admin", expiresAt: unlocked.expiresAt } }, 201);
    result.headers.set("Set-Cookie", serializeProjectMasterAdminCookie(unlocked.rawToken, url, dependencies.environment));
    return result;
  } catch (error) { return fail(error, requestId); }
}

export function handleLogoutProjectMasterAdmin(request: Request, dependencies: Dependencies): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url);
    resolve(dependencies.service).logoutAdmin(token(request, dependencies, url));
    const result = new Response(null, { status: 204, headers: NO_STORE });
    result.headers.set("Set-Cookie", serializeExpiredProjectMasterAdminCookie(url, dependencies.environment));
    return result;
  } catch (error) { return fail(error, requestId); }
}

export async function handleChangeProjectMasterAdminPassword(request: Request, dependencies: Dependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const url = appUrl(dependencies); requireOrigin(request, url);
    const body = await readBoundedJson(request, 4 * 1024) as { newPassword?: unknown; confirmPassword?: unknown };
    if (!body || typeof body.newPassword !== "string" || body.newPassword !== body.confirmPassword) {
      throw new PublicApiError(400, "INVALID_REQUEST", "New administrator password and confirmation must match.");
    }
    const changed = resolve(dependencies.service).changeAdminPassword(token(request, dependencies, url), body.newPassword);
    const result = response({ data: { permission: "project_master_admin", expiresAt: changed.expiresAt } }, 200);
    result.headers.set("Set-Cookie", serializeProjectMasterAdminCookie(changed.rawToken, url, dependencies.environment));
    return result;
  } catch (error) { return fail(error, requestId); }
}
