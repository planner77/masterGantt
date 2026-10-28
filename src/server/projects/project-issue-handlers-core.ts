import { randomUUID } from "node:crypto";
import type { ProjectIssueService } from "./project-issue-service-core";
import {
  parseIssueCreateRequest, parseIssueUpdateRequest, parseIssueDeleteRequest,
  parseIssueCredentialRequest, parseProjectIssueQuery,
} from "./project-issue-service-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "./project-contract";
import { parseEditSessionCookie } from "../security/cookie-core";
import { projectSessionFromCookie } from "../security/project-read-access-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { PasswordHashCapacityError } from "../security/password-core";
import { issuePasswordGlobalRateLimiter, issuePasswordPerIssueRateLimiter } from "../security/rate-limit-core";
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

function requireProjectEditSession(
  projectService: ReturnType<typeof resolved<Dependencies["projectService"]>>,
  publicId: string, rawToken: string | undefined,
) {
  const authorization = projectService.authorize(publicId, rawToken);
  if (authorization.kind === "projectNotFound")
    throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  if (authorization.kind !== "authorized")
    throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "유효한 프로젝트 편집 세션이 필요합니다.");
  return authorization.authorization;
}

function consumePasswordBudget(publicId: string, issueId: string): void {
  const global = issuePasswordGlobalRateLimiter.consume("all");
  const scoped = issuePasswordPerIssueRateLimiter.consume(publicId + ":" + issueId);
  const wait = Math.max(global.retryAfterSeconds, scoped.retryAfterSeconds);
  if (!global.allowed || !scoped.allowed)
    throw new PublicApiError(429, "ISSUE_PASSWORD_RATE_LIMITED",
      "비밀번호 인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", [],
      { "Retry-After": String(wait) });
}

export async function handleProjectIssues(
  request: Request, publicId: string, dependencies: Dependencies, issueId?: string,
  credentialAction = false,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId))
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    if (issueId && !isCanonicalUuidV4(issueId))
      throw new PublicApiError(404, "ISSUE_NOT_FOUND", "Issue를 찾을 수 없습니다.");

    const projectService = resolved(dependencies.projectService);
    const service = resolved(dependencies.service);
    if (request.method === "GET" && !issueId && !credentialAction) {
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
    const isCreate = request.method === "POST" && !issueId && !credentialAction;
    const isPatch = request.method === "PATCH" && !!issueId && !credentialAction;
    const isDelete = request.method === "DELETE" && !!issueId && !credentialAction;
    const isManage = request.method === "PATCH" && !!issueId && credentialAction;
    if (!isCreate && !isPatch && !isDelete && !isManage)
      throw new PublicApiError(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");

    const applicationUrl = parseApplicationBaseUrl(
      dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp,
    );
    if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl))
      throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "허용된 서비스 주소에서 다시 요청해 주세요.");
    const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, applicationUrl);
    const token = cookie.state === "present" ? cookie.rawToken : undefined;
    // Issue passwords do not grant access to the rest of a private project.
    const readAccess = projectService.projectReadAccess(publicId, token);
    if (readAccess === "locked")
      throw new PublicApiError(401, "PROJECT_LOCKED", "이 프로젝트는 잠겨 있습니다.");
    if (readAccess === "notFound")
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");

    // Creation and credential recovery need project-level authority; normal edits never use it.
    const authorization = isCreate || isManage
      ? requireProjectEditSession(projectService, publicId, token) : null;
    const revision = parseRequiredIfMatch(request);
    const body = await readBoundedJson(request, 16384);
    let result;
    if (isCreate) {
      const { input, password } = parseIssueCreateRequest(body);
      result = await service.create(authorization!, revision, input, password);
    } else if (isManage) {
      const data = parseIssueCredentialRequest(body);
      consumePasswordBudget(publicId, issueId!);
      result = await service.manageCredential(authorization!, issueId!, revision,
        data.operation, data.projectPassword, data.newPassword, requestId);
    } else if (isPatch) {
      const { input, password } = parseIssueUpdateRequest(body);
      consumePasswordBudget(publicId, issueId!);
      result = await service.update(publicId, issueId!, revision, input, password);
    } else {
      const { password } = parseIssueDeleteRequest(body);
      consumePasswordBudget(publicId, issueId!);
      result = await service.softDelete(publicId, issueId!, revision, password);
    }
    return Response.json(result, {
      status: isCreate ? 201 : 200,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        ETag: '"' + result.data.projectRevision + '"', "X-Request-ID": requestId },
    });
  } catch (error) {
    const mapped = error instanceof ConfigurationError
      ? new PublicApiError(500, "CONFIGURATION_ERROR", "서비스 주소 설정이 올바르지 않습니다.")
      : error instanceof PasswordHashCapacityError
        ? new PublicApiError(503, "ISSUE_AUTH_BUSY", "비밀번호 인증이 지연되고 있습니다.", [], { "Retry-After": "5" })
        : error;
    const response = apiErrorResponse(mapped, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
