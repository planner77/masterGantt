import { randomUUID } from "node:crypto";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import type { ProjectJsonExportService } from "./project-json-export-core";
export interface ProjectJsonExportHandlerDependencies {
  service: Pick<ProjectJsonExportService, "get"> | (() => Pick<ProjectJsonExportService, "get">);
  applicationBaseUrl: string | undefined; allowInsecureHttp?: string; environment: string | undefined; requestId?: () => string;
}
export async function handleProjectJsonExport(request: Request, publicId: string, dependencies: ProjectJsonExportHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    let applicationUrl: URL;
    try { applicationUrl = parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp); }
    catch (error) { if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly."); throw error; }
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    const revision = parseRequiredIfMatch(request), input = await readBoundedJson(request, 8192);
    if (input === null || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || (input as { scope?: unknown }).scope !== "project") throw new PublicApiError(400, "INVALID_REQUEST", "JSON export requires scope=project.");
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const bytes = service.get(publicId, revision);
    if (!bytes) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    const body = new Uint8Array(bytes).buffer;
    return new Response(body, { headers: { "Content-Type": "application/vnd.mastergantt.import+json; charset=utf-8", "Content-Disposition": `attachment; filename="mastergantt-${publicId}-r${revision}.json"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ETag: `"${revision}"` } });
  } catch (error) { const response = apiErrorResponse(error, requestId); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
