import { randomUUID } from "node:crypto";
import type { ProjectIssueService } from "./project-issue-service-core";
import { parseProjectIssueInput, parseProjectIssueQuery } from "./project-issue-service-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "./project-contract";
import { parseEditSessionCookie } from "../security/cookie-core";
import { projectSessionFromCookie } from "../security/project-read-access-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import type { AuthorizationResult } from "./project-service-core";

interface Dependencies {
  service: ProjectIssueService | (() => ProjectIssueService);
  projectService: {
    authorize(publicId: string, token: string | undefined): AuthorizationResult;
    projectReadAccess(publicId: string, token?: string): "allowed" | "locked" | "notFound";
  } | (() => {
    authorize(publicId: string, token: string | undefined): AuthorizationResult;
    projectReadAccess(publicId: string, token?: string): "allowed" | "locked" | "notFound";
  });
  applicationBaseUrl?: string;
  environment?: string;
  allowInsecureHttp?: string;
  requestId?: () => string;
}

function resolved<T>(service: T | (() => T)): T {
  return typeof service === "function" ? (service as () => T)() : service;
}

export async function handleProjectIssues(
  request: Request, publicId: string, dependencies: Dependencies, issueId?: string,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId))
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    if (issueId && !isCanonicalUuidV4(issueId))
      throw new PublicApiError(404, "ISSUE_NOT_FOUND", "Issue를 찾을 수 없습니다.");

    const projectService = resolved(dependencies.projectService);
    const service = resolved(dependencies.service);
    if (request.method === "GET" && !issueId) {
      const access = projectService.projectReadAccess(publicId,
        projectSessionFromCookie(request.headers.get("cookie")));
      if (access === "locked")
        throw new PublicApiError(401, "PROJECT_LOCKED", "이 프로젝트는 잠겨 있습니다.");
      if (access === "notFound")
        throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
      const query = parseProjectIssueQuery(new URL(request.url).searchParams);
      const result = service.list(publicId, query);
      return Response.json(result, {
        headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
          ETag: '"' + result.data.projectRevision + '"', "X-Request-ID": requestId },
      });
    }
    if (!(request.method === "POST" && !issueId) && !(request.method === "PATCH" && issueId))
      throw new PublicApiError(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");

    const applicationUrl = parseApplicationBaseUrl(
      dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp,
    );
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl))
      throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "허용된 서비스 주소에서 다시 요청해 주세요.");
    const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, applicationUrl);
    const authorization = projectService.authorize(publicId,
      cookie.state === "present" ? cookie.rawToken : undefined);
    if (authorization.kind === "projectNotFound")
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    if (authorization.kind !== "authorized")
      throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "유효한 프로젝트 편집 세션이 필요합니다.");
    const revision = parseRequiredIfMatch(request);
    const input = parseProjectIssueInput(await readBoundedJson(request, 16384));
    const result = service.mutate(authorization.authorization, revision, input, issueId);
    return Response.json(result, {
      status: issueId ? 200 : 201,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        ETag: '"' + result.data.projectRevision + '"', "X-Request-ID": requestId },
    });
  } catch (error) {
    const mapped = error instanceof ConfigurationError
      ? new PublicApiError(500, "CONFIGURATION_ERROR", "서비스 주소 설정이 올바르지 않습니다.") : error;
    const response = apiErrorResponse(mapped, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
