import { randomUUID } from "node:crypto";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizationResult } from "../projects/project-service-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { LogisticsTargetError, type LogisticsTargetService } from "./logistics-targets-service-core";
import type { TaskTargetBindingService } from "./task-target-bindings-service-core";

type ProjectAccess = { authorize(id: string, token: string | undefined): AuthorizationResult };
interface Dependencies {
  service: Pick<TaskTargetBindingService, "get" | "replace"> | (() => Pick<TaskTargetBindingService, "get" | "replace">);
  projectService: ProjectAccess | (() => ProjectAccess);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}
export type TargetImpactDependencies = Omit<Dependencies, "service"> & {
  service: Pick<LogisticsTargetService, "previewUpdate"> | (() => Pick<LogisticsTargetService, "previewUpdate">);
};
const resolve = <T,>(value: T | (() => T)): T => typeof value === "function" ? (value as () => T)() : value;

function access(request: Request, projectId: string, d: Omit<Dependencies, "service">, edit: boolean) {
  if (!isCanonicalUuidV4(projectId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  let url: URL;
  try { url = parseApplicationBaseUrl(d.applicationBaseUrl, d.environment, d.allowInsecureHttp); }
  catch (error) {
    if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "Service configuration invalid.");
    throw error;
  }
  if (edit && !isExactAllowedOrigin(request.headers.get("origin"), url))
    throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed.");
  const cookie = parseEditSessionCookie(request.headers.get("cookie"), d.environment, url);
  const auth = resolve(d.projectService).authorize(projectId, cookie.state === "present" ? cookie.rawToken : undefined);
  if (auth.kind === "projectNotFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  if (edit && auth.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "Valid edit session required.");
  if (new URL(request.url).search) throw new PublicApiError(400, "INVALID_REQUEST", "Unknown parameters.");
  return auth;
}
function fail(error: unknown, d: Omit<Dependencies, "service">): Response {
  const mapped = error instanceof LogisticsTargetError ? new PublicApiError(error.status, error.code, error.message) : error;
  const response = apiErrorResponse(mapped, (d.requestId ?? randomUUID)());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
const headers = (revision: number) => ({ "Cache-Control": "private, no-store", ETag: `"${revision}"` });

export function handleGetTaskTargetBindings(request: Request, projectId: string, taskId: string, d: Dependencies): Response {
  try {
    const auth = access(request, projectId, d, false);
    const result = resolve(d.service).get(projectId, taskId);
    return Response.json({ data: { ...result, taskId, permission: auth.kind === "authorized" ? "edit" : "readonly" } },
      { headers: headers(result.projectRevision) });
  } catch (error) { return fail(error, d); }
}

export async function handleReplaceTaskTargetBindings(request: Request, projectId: string, taskId: string, d: Dependencies): Promise<Response> {
  try {
    const auth = access(request, projectId, d, true);
    if (auth.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "Valid edit session required.");
    const revision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const result = resolve(d.service).replace(auth.authorization, revision, taskId, raw);
    return Response.json(result, { headers: headers(result.data.projectRevision) });
  } catch (error) { return fail(error, d); }
}

/** A preview requires edit authorization but never writes or increments project revision. */
export async function handlePreviewTargetUpdate(request: Request, projectId: string, targetId: string, d: TargetImpactDependencies): Promise<Response> {
  try {
    const auth = access(request, projectId, d, true);
    if (auth.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "Valid edit session required.");
    const revision = parseRequiredIfMatch(request);
    const raw = await readBoundedJson(request);
    const result = resolve(d.service).previewUpdate(auth.authorization, revision, targetId, raw);
    return Response.json(result, { headers: headers(result.data.projectRevision) });
  } catch (error) { return fail(error, d); }
}
