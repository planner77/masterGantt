import { randomUUID } from "node:crypto";
import { ResourceCalendarExceptionConflictError } from "../../domain/scheduling/resource-calendar";
import { PersistedWorkCalendarConflictError } from "../calendars/calendar-resolution-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { parseResourceDashboardDetails, parseResourceDashboardQuery } from "./resource-dashboard-query-core";
import type { ResourceDashboardService } from "./resource-dashboard-service-core";

export async function handleGetResourceDashboard(request: Request, publicId: string, dependencies: {
  service: Pick<ResourceDashboardService, "getDashboard" | "getDetails"> | (() => Pick<ResourceDashboardService, "getDashboard" | "getDetails">);
  requestId?: () => string;
}, details = false): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    const params = new URL(request.url).searchParams;
    const filter = parseResourceDashboardQuery(params, details);
    const detail = details ? parseResourceDashboardDetails(params) : null;
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const data = detail ? service.getDetails(publicId, filter, detail) : service.getDashboard(publicId, filter);
    if (!data) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": requestId } });
  } catch (error) {
    const normalized = error instanceof ResourceCalendarExceptionConflictError || error instanceof PersistedWorkCalendarConflictError
      ? new PublicApiError(409, "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", "근무 달력의 충돌을 먼저 해결해 주세요.") : error;
    const response = apiErrorResponse(normalized, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
