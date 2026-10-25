import { resourceReadVersion, resourceReadOutput, resourceReadHeaders, resourceReadError } from "../resources/resource-public-v2-core";
import { randomUUID } from "node:crypto";
import type { LogisticsDashboardService } from "./logistics-dashboard-service";
import { handleGetLogisticsDashboard } from "./logistics-handlers-core";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";

/** Keep the legacy parser and response envelope, with an explicit source boundary. */
export async function handleGetLogisticsKpi(request: Request, publicId: string, dependencies: Parameters<typeof handleGetLogisticsDashboard>[2] & { dashboardService: LogisticsDashboardService }) {
  const url = new URL(request.url);
  const allowed = new Set(["source", "snapshotId", "asOfDate", "horizonDays", "systemView", "activeOnly", "includeDescendantProcesses", "mdPerMm", "processIds", "equipmentIds", "systemIds", "taskAssigneeResourceIds", "roleResourceIds"]);
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    const version=resourceReadVersion(request);
    if (url.searchParams.getAll("source").length !== 1 || url.searchParams.get("source") !== "integrated" || [...url.searchParams.keys()].some(key => !allowed.has(key))) {
      throw new PublicApiError(400, "INVALID_REQUEST", "물류 KPI의 source=integrated 조건을 명시해 주세요.");
    }
    for (const name of ["snapshotId", "asOfDate", "horizonDays", "systemView", "activeOnly", "includeDescendantProcesses", "mdPerMm"]) {
      if (url.searchParams.getAll(name).length > 1) throw new PublicApiError(400, "INVALID_REQUEST", "KPI 단일 조건은 한 번만 지정해 주세요.");
    }
    for (const name of ["activeOnly", "includeDescendantProcesses"]) {
      if (url.searchParams.has(name) && !["true", "false"].includes(url.searchParams.get(name)!)) throw new PublicApiError(400, "INVALID_REQUEST", "KPI 활성 조건을 확인해 주세요.");
    }
    if (url.searchParams.has("systemView") && !["direct", "coordination"].includes(url.searchParams.get("systemView")!)) throw new PublicApiError(400, "INVALID_REQUEST", "시스템 보기 조건을 확인해 주세요.");
    if (request.url.length > 16384) throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", "물류 KPI 요청 한도를 초과했습니다.");
    for (const name of ["processIds", "equipmentIds", "systemIds", "taskAssigneeResourceIds", "roleResourceIds"]) {
      const raw = url.searchParams.getAll(name);
      if (!raw.length) continue;
      const values = raw.flatMap(value => value.split(",")).map(value => value.trim());
      if (values.some(value => !value.length)) throw new PublicApiError(400, "INVALID_REQUEST", "물류 KPI ID 조건은 빈 값 없이 지정해 주세요.");
      url.searchParams.set(name, [...new Set(values)].sort().join(","));
    }
    if (url.searchParams.has("asOfDate") && !url.searchParams.get("asOfDate")) throw new PublicApiError(400, "INVALID_REQUEST", "KPI 기준일은 빈 값으로 지정할 수 없습니다.");
    const expected = url.searchParams.get("snapshotId");
    if (expected !== null && !/^[a-f0-9]{64}$/.test(expected)) throw new PublicApiError(400, "INVALID_REQUEST", "KPI snapshotId를 확인해 주세요.");
    const response = await handleGetLogisticsDashboard(new Request(url, request), publicId, { ...dependencies, requestId: () => requestId });
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (!response.ok) return response;
    const body = await response.clone().json();
    if (expected !== null && body.data?.integrated?.snapshotId !== expected) throw new PublicApiError(409, "STALE_KPI_SOURCE", "물류 KPI 원본이 변경됐습니다. 최신 결과를 조회해 주세요.");
    return Response.json(resourceReadOutput(body,version),{status:response.status,headers:{...Object.fromEntries(response.headers),...resourceReadHeaders(version)}});
  } catch (error) {
    const response = apiErrorResponse(resourceReadError(error,request), requestId);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
