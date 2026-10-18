import { randomUUID } from "node:crypto";
import type { ProjectResourceMembershipQuery } from "../../contracts/project-resource-memberships";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizationResult, AuthorizedEditSession } from "../projects/project-service-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import { ConfigurationError, isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import type { ProjectResourceMembershipService } from "./project-resource-membership-service-core";
interface ProjectAuthorizationService {
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
}
interface Dependencies {
  service: ProjectResourceMembershipService | (() => ProjectResourceMembershipService);
  projectService: ProjectAuthorizationService | (() => ProjectAuthorizationService);
  applicationBaseUrl?: string;
  environment?: string;
  allowInsecureHttp?: string;
  requestId?: () => string;
}
function invalid(): never {
  throw new PublicApiError(400, "INVALID_REQUEST", "조회 조건 또는 리소스 등록 요청을 확인해 주세요.");
}
export function parseProjectResourceMembershipQuery(params: URLSearchParams): ProjectResourceMembershipQuery {
  const allowed = new Set(["scope", "q", "role", "grade", "groupId", "registration", "usage", "active", "offset", "limit"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      invalid();
  }
  const result: Record<string, unknown> = {};
  const choices: Record<string, string[]> = {
    scope: ["project", "catalog"],
    role: ["PI", "DEVELOPER", "EQUIPMENT_OWNER"],
    grade: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"],
    registration: ["registered", "unregistered"],
    usage: ["unassigned", "assigned", "roleOnly"],
  };
  for (const [key, values] of Object.entries(choices)) {
    const value = params.get(key);
    if (value !== null) {
      if (!values.includes(value))
        invalid();
      result[key] = value;
    }
  }
  const q = params.get("q");
  if (q !== null) {
    if (Array.from(q).length > 200)
      invalid();
    result.q = q.trim();
  }
  const groupId = params.get("groupId");
  if (groupId !== null) {
    if (!isCanonicalUuidV4(groupId))
      invalid();
    result.groupId = groupId;
  }
  const active = params.get("active");
  if (active !== null) {
    if (active !== "true" && active !== "false")
      invalid();
    result.active = active === "true";
  }
  for (const key of ["offset", "limit"]) {
    const raw = params.get(key);
    if (raw !== null) {
      if (!/^(0|[1-9]\d*)$/.test(raw))
        invalid();
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value > (key === "limit" ? 100 : 100000) || (key === "limit" && value < 1))
        invalid();
      result[key] = value;
    }
  }
  return result as ProjectResourceMembershipQuery;
}
function authorize(request: Request, publicId: string, dependencies: Dependencies, url: URL): AuthorizedEditSession {
  const cookie = parseEditSessionCookie(request.headers.get("cookie"), dependencies.environment, url);
  const service = typeof dependencies.projectService === "function" ? dependencies.projectService() : dependencies.projectService;
  const result = service.authorize(publicId, cookie.state === "present" ? cookie.rawToken : undefined);
  if (result.kind === "projectNotFound")
    throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
  if (result.kind !== "authorized")
    throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "유효한 프로젝트 편집 세션이 필요합니다.");
  return result.authorization;
}
export async function handleProjectResourceMembership(request: Request, publicId: string, dependencies: Dependencies, resourceId?: string): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId))
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    let result;
    if (request.method === "GET") {
      const query = parseProjectResourceMembershipQuery(new URL(request.url).searchParams);
      if (query.scope === "catalog") {
        authorize(request, publicId, dependencies, parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp));
      }
      result = service.get(publicId, query);
    }
    else {
      const url = parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp);
      if (!isExactAllowedOrigin(request.headers.get("origin"), url)) {
        throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "허용된 서비스 주소에서 다시 요청해 주세요.");
      }
      const authorization = authorize(request, publicId, dependencies, url);
      const revision = parseRequiredIfMatch(request);
      if (request.method === "POST") {
        const body = await readBoundedJson(request, 4096) as Record<string, unknown>;
        if (!body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).some(key => key !== "resourceId" && key !== "catalogRevision") ||
          typeof body.resourceId !== "string" || typeof body.catalogRevision !== "number")
          invalid();
        result = service.mutate(authorization, revision, body.resourceId, true, body.catalogRevision);
      }
      else if (request.method === "DELETE" && resourceId) {
        if (request.body !== null)
          invalid();
        result = service.mutate(authorization, revision, resourceId, false);
      }
      else
        invalid();
    }
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ETag: `"${result.data.projectRevision}"`,
        "X-Request-ID": requestId,
      },
    });
  }
  catch (error) {
    const normalized = error instanceof ConfigurationError
      ? new PublicApiError(500, "CONFIGURATION_ERROR", "서비스 주소 설정을 확인해 주세요.") : error;
    const response = apiErrorResponse(normalized, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
