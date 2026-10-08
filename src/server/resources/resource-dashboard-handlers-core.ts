import { randomUUID } from "node:crypto";
import { ResourceCalendarExceptionConflictError } from "../../domain/scheduling/resource-calendar";
import { PersistedWorkCalendarConflictError } from "../calendars/calendar-resolution-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { parseResourceDashboardDetails, parseResourceDashboardQuery, parseResourceDashboardGroupChildren } from "./resource-dashboard-query-core";
import type { ResourceDashboardService } from "./resource-dashboard-service-core";
import { parseResourcePlanDetails } from "./resource-dashboard-query-core";
import type { ResourcePlanDetailKind } from "../../contracts/resource-dashboard";

export async function handleGetResourceDashboard(request: Request, publicId: string, dependencies: {
  service: Pick<ResourceDashboardService, "getDashboard" | "getDetails"> & Partial<Pick<ResourceDashboardService, "getGroupChildren">> | (() => Pick<ResourceDashboardService, "getDashboard" | "getDetails"> & Partial<Pick<ResourceDashboardService, "getGroupChildren">>);
  requestId?: () => string;
}, details: boolean | "group-children" = false): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    const params = new URL(request.url).searchParams;
    const filter = parseResourceDashboardQuery(params, details === true, details === "group-children");
    const children = details === "group-children" ? parseResourceDashboardGroupChildren(params) : null;
    const detail = details === true ? parseResourceDashboardDetails(params) : null;
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const data = children ? service.getGroupChildren!(publicId, filter, children) : detail ? service.getDetails(publicId, filter, detail) : service.getDashboard(publicId, filter);
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

export async function handleGetResourcePlan(request: Request, publicId: string, dependencies: {
  service: Pick<ResourceDashboardService, "getPlanDetails"> | (() => Pick<ResourceDashboardService, "getPlanDetails">); requestId?: () => string;
}, kind: ResourcePlanDetailKind): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    const { filter, detail } = parseResourcePlanDetails(new URL(request.url).searchParams, kind);
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const data = service.getPlanDetails(publicId, filter, detail, kind);
    if (!data) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": requestId } });
  } catch (error) {
    const normalized = error instanceof ResourceCalendarExceptionConflictError || error instanceof PersistedWorkCalendarConflictError
      ? new PublicApiError(409, "RESOURCE_CALENDAR_EXCEPTION_CONFLICT", "근무 달력의 충돌을 먼저 해결해 주세요.") : error;
    const response = apiErrorResponse(normalized, requestId);
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("X-Content-Type-Options", "nosniff"); return response;
  }
}
