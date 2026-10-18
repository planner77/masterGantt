import { randomUUID } from "node:crypto";
import { IMPORT_PREVIEW_DIGEST_HEADER } from "../../contracts/project-import";
import { PublicApiError, apiErrorResponse } from "../http/api-error-core";
import { parseRequiredIfMatch } from "../http/request-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import type { ProjectImportService } from "./project-import-service-core";
import { readProjectImportFile } from "./project-import-parser-core";

export interface ProjectImportHandlerDependencies {
  service: ProjectImportService | (() => ProjectImportService);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

export async function handleProjectImport(request: Request, publicId: string, dependencies: ProjectImportHandlerDependencies, preview = false): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    let applicationUrl: URL;
    try { applicationUrl = parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp); }
    catch (error) { if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly."); throw error; }
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, applicationUrl);
    const token = cookie.state === "present" ? cookie.rawToken : undefined;
    const authorization = service.authorize(publicId, token);
    if (authorization.kind === "projectNotFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (authorization.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
    const revision = preview ? null : parseRequiredIfMatch(request);
    const digest = request.headers.get(IMPORT_PREVIEW_DIGEST_HEADER);
    if (!preview && digest === null) throw new PublicApiError(428, "IMPORT_PREVIEW_REQUIRED", "Preview the file before committing.");
    if (!preview && !/^[a-f0-9]{64}$/.test(digest!)) throw new PublicApiError(400, "INVALID_REQUEST", "Invalid import preview digest.");
    const bytes = await readProjectImportFile(request);
    const result = preview ? { data: service.preview(publicId, token, bytes) } : service.commit(publicId, token, revision!, digest!, bytes);
    const resultingRevision = preview ? (result as { data: { baseRevision: number } }).data.baseRevision : (result as { data: { project: { revision: number } } }).data.project.revision;
    return Response.json(result, { status: preview ? 200 : 201, headers: { "Cache-Control": "private, no-store", ETag: `"${resultingRevision}"`, "X-Request-ID": requestId } });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
