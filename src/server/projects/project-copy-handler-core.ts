import { randomUUID } from "node:crypto";

import type { CopyProjectResponse } from "../../contracts/projects";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie, serializeEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { PasswordHashCapacityError } from "../security/password-core";
import { isCanonicalUuidV4, parseCopyProjectInput } from "./project-contract";
import type { CopiedProject, ProjectCopyService } from "./project-copy-service-core";
import { EditSessionInvalidError, PersistedScheduleInvalidError, RevisionMismatchError, type AuthorizationResult } from "./project-service-core";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export interface ProjectCopyHandlerDependencies {
  projectService: { authorize(publicId: string, rawToken: string | undefined): AuthorizationResult } | (() => { authorize(publicId: string, rawToken: string | undefined): AuthorizationResult });
  copyService: Pick<ProjectCopyService, "copy"> | (() => Pick<ProjectCopyService, "copy">);
  applicationBaseUrl: string | undefined;
  allowInsecureHttp?: string;
  environment: string | undefined;
  requestId?: () => string;
}

function resolve<T>(value: T | (() => T)): T { return typeof value === "function" ? (value as () => T)() : value; }

export async function handleCopyProject(request: Request, publicId: string, dependencies: ProjectCopyHandlerDependencies): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    let applicationUrl: URL;
    try {
      applicationUrl = parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp);
    } catch (error) {
      if (error instanceof ConfigurationError) throw new PublicApiError(500, "CONFIGURATION_ERROR", "The service is not configured correctly.");
      throw error;
    }
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
    const expectedRevision = parseRequiredIfMatch(request);
    const parsed = parseCopyProjectInput(await readBoundedJson(request));
    if (!parsed.success) throw new PublicApiError(400, "INVALID_REQUEST", "The project copy input is invalid.", parsed.details);

    const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, applicationUrl);
    const authorization = resolve(dependencies.projectService).authorize(publicId, cookie.state === "present" ? cookie.rawToken : undefined);
    if (authorization.kind === "projectNotFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (authorization.kind !== "authorized") throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");

    let copied: CopiedProject;
    try {
      copied = await resolve(dependencies.copyService).copy(authorization.authorization, expectedRevision, parsed.data);
    } catch (error) {
      if (error instanceof PasswordHashCapacityError) throw new PublicApiError(429, "RATE_LIMITED", "The password service is busy. Retry shortly.", [], { "Retry-After": "1" });
      if (error instanceof EditSessionInvalidError) throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "A valid edit session is required.");
      if (error instanceof RevisionMismatchError) throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
      if (error instanceof PersistedScheduleInvalidError) throw new PublicApiError(409, "PERSISTED_SCHEDULE_INVALID", "The source schedule is invalid.");
      throw error;
    }

    const body: CopyProjectResponse = copied.response;
    return Response.json(body, {
      status: 201,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        ETag: `"${body.data.project.revision}"`,
        Location: `/projects/${body.data.project.publicId}`,
        "Set-Cookie": serializeEditSessionCookie(copied.rawSessionToken, applicationUrl, dependencies.environment),
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error, requestId);
    response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return response;
  }
}
