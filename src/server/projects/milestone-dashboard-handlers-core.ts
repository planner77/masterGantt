import { randomUUID } from "node:crypto";
import type { MilestoneDashboardFilterInput } from "../../contracts/milestone-dashboard";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { MilestoneDashboardInvalidRangeError } from "./milestone-dashboard-calculation-core";
import type { MilestoneDashboardService } from "./milestone-dashboard-service-core";
import { isCanonicalUuidV4 } from "./project-contract";

const ARRAY_KEYS = ["milestoneIds", "resourceIds", "processIds", "equipmentIds", "systemIds", "roleResourceIds", "assignmentRoles", "developerGrades"] as const;
const SCALAR_KEYS = ["search", "asOfDate", "horizonDays", "from", "to", "systemView", "activeOnly", "includeDescendantProcesses", "mdPerMm"] as const;
const fail = () => { throw new PublicApiError(400, "INVALID_REQUEST", "Invalid milestone dashboard query."); };

export function parseMilestoneDashboardQuery(params: URLSearchParams): MilestoneDashboardFilterInput {
  if (params.toString().length > 16384) fail();
  for (const key of params.keys()) if (![...ARRAY_KEYS, ...SCALAR_KEYS].includes(key as typeof SCALAR_KEYS[number])) fail();
  for (const key of SCALAR_KEYS) if (params.getAll(key).length > 1) fail();
  const result: MilestoneDashboardFilterInput = {};
  const enumArray = (name: "assignmentRoles" | "developerGrades", allowed: readonly string[]) => {
    const values = [...new Set(params.getAll(name).flatMap((value) => value.split(",")).map((value) => value.trim()))].sort();
    if (values.length > 500 || values.some((value) => !allowed.includes(value))) fail();
    return values;
  };
  for (const key of ARRAY_KEYS.filter((key) => key !== "assignmentRoles" && key !== "developerGrades")) {
    const values = [...new Set(params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()))].sort();
    if (values.length > 500 || values.some((value) => !isCanonicalUuidV4(value))) fail();
    if (values.length) result[key] = values;
  }
  if (params.has("assignmentRoles")) result.assignmentRoles = enumArray("assignmentRoles", ["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"]) as NonNullable<MilestoneDashboardFilterInput["assignmentRoles"]>;
  if (params.has("developerGrades")) result.developerGrades = enumArray("developerGrades", ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "UNSPECIFIED"]) as NonNullable<MilestoneDashboardFilterInput["developerGrades"]>;
  if (params.has("search")) { result.search = params.get("search")!.trim(); if (result.search.length > 200) fail(); }
  for (const key of ["asOfDate", "from", "to"] as const) {
    if (params.has(key)) { const value = params.get(key)!; try { parseDateOnly(value, key); } catch { fail(); } result[key] = value; }
  }
  if (result.from && result.to && result.from > result.to) fail();
  if (params.has("horizonDays")) { const value = Number(params.get("horizonDays")); if (!Number.isInteger(value) || value < 1 || value > 90) fail(); result.horizonDays = value; }
  if (params.has("systemView")) { const value = params.get("systemView"); if (value !== "direct" && value !== "coordination") fail(); result.systemView = value as "direct" | "coordination"; }
  for (const key of ["activeOnly", "includeDescendantProcesses"] as const) { if (params.has(key)) { const value = params.get(key); if (value !== "true" && value !== "false") fail(); result[key] = value === "true"; } }
  if (params.has("mdPerMm")) {
    const value = params.get("mdPerMm")!;
    if (value === "null") result.mdPerMm = null;
    else { const number = Number(value); if (!value.trim() || !Number.isFinite(number) || number <= 0) fail(); result.mdPerMm = number; }
  }
  return result;
}

export async function handleGetMilestoneDashboard(request: Request, publicId: string, dependencies: {
  service: Pick<MilestoneDashboardService, "getDashboard"> | (() => Pick<MilestoneDashboardService, "getDashboard">);
  requestId?: () => string;
}): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    const filter = parseMilestoneDashboardQuery(new URL(request.url).searchParams);
    const service = typeof dependencies.service === "function" ? dependencies.service() : dependencies.service;
    const data = service.getDashboard(publicId, filter);
    if (!data) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store", "X-Request-ID": requestId } });
  } catch (error) {
    const response = apiErrorResponse(error instanceof MilestoneDashboardInvalidRangeError ? new PublicApiError(400, "INVALID_REQUEST", "Invalid workload range.") : error, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
