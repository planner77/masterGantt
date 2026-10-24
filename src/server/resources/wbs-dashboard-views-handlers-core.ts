import { resourceReadError, resourceReadVersion, resourceReadOutput, resourceReadHeaders } from "./resource-public-v2-core";
import { randomUUID } from "node:crypto";
import type { ResourceDashboardService } from "./resource-dashboard-service-core";
import { readBoundedJson } from "../http/request-core";
import { WBS_VIEW_LIMITS } from "../../contracts/wbs-dashboard-views";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { isExactAllowedOrigin, parseApplicationBaseUrl } from "../security/origin-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { ResourceCalendarExceptionConflictError } from "../../domain/scheduling/resource-calendar";
import { PersistedWorkCalendarConflictError } from "../calendars/calendar-resolution-core";
export async function handleWbsViewQuery(request: Request, publicId: string, dependencies: {
  service: Pick<ResourceDashboardService, "queryWbsView"> | (() => Pick<ResourceDashboardService, "queryWbsView">);
  applicationBaseUrl?: string; environment?: string; allowInsecureHttp?: string; requestId?: () => string;
}): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    if (!isExactAllowedOrigin(request.headers.get("Origin"), parseApplicationBaseUrl(dependencies.applicationBaseUrl, dependencies.environment, dependencies.allowInsecureHttp))) throw new PublicApiError(403, "ORIGIN_NOT_ALLOWED", "허용된 서비스 주소에서 다시 요청해 주세요.");
    if (new URL(request.url).search) throw new PublicApiError(400, "INVALID_REQUEST", "WBS 조회 조건은 요청 본문에 지정해 주세요.");
    const version=resourceReadVersion(request);
    const input = await readBoundedJson(request, WBS_VIEW_LIMITS.bodyBytes);
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const data = service.queryWbsView(publicId, input);
    if (!data) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    return Response.json(resourceReadOutput({ data },version), { headers: { ...resourceReadHeaders(version), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": requestId } });
  } catch (error) {
    const normalized = error instanceof ResourceCalendarExceptionConflictError || error instanceof PersistedWorkCalendarConflictError ? new PublicApiError(409, "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", "근무 달력의 충돌을 먼저 해결해 주세요.") : error;
    const response = apiErrorResponse(resourceReadError(normalized,request), requestId);
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("X-Content-Type-Options", "nosniff"); return response;
  }
}
