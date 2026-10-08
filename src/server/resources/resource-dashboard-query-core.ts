import type { ResourceDashboardDetailInput, ResourceDashboardFilterInput, ResourceDashboardFilters, ResourceDashboardMetric, ResourceDashboardSelector, ResourceDashboardGroupChildrenInput } from "../../contracts/resource-dashboard";
import { RESOURCE_DASHBOARD_LIMITS as LIMITS } from "../../contracts/resource-dashboard";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";

const ARRAYS = ["resourceIds", "groupIds", "milestoneIds", "taskIds", "wbsRootIds", "roles", "developerGrades", "statuses"] as const;
const SCALARS = ["from", "to", "asOfDate", "search", "taskSearch", "mode", "mdPerMm", "resourceActivity", "groupActivity"] as const;
const DETAILS = ["snapshotId", "dimension", "id", "milestoneTaskId", "metric", "view", "offset", "limit", "resourceId", "assignmentScope"] as const;
const CHILDREN = ["snapshotId", "groupId", "milestoneTaskId", "offset", "limit"] as const;
const ROLES = ["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"];
const GRADES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "UNSPECIFIED"];
const STATUSES = ["not_started", "in_progress", "completed"];
const METRICS: ResourceDashboardMetric[] = ["all", "notStarted", "inProgress", "completed", "delayed", "unset", "completelyUnassigned", "groupOnly", "personallyUnassigned"];
export const invalidDashboardQuery = (): never => { throw new PublicApiError(400, "INVALID_REQUEST", "리소스 대시보드 조회 조건을 확인해 주세요."); };

export function parseResourceDashboardQuery(params: URLSearchParams, details = false, children = false): ResourceDashboardFilterInput {
  if (params.toString().length > 32768) invalidDashboardQuery();
  for (const key of params.keys()) if (![...ARRAYS, ...SCALARS, ...(details ? DETAILS : []), ...(children ? CHILDREN : [])].includes(key as typeof SCALARS[number])) invalidDashboardQuery();
  for (const key of [...SCALARS, ...(details ? DETAILS : []), ...(children ? CHILDREN : [])]) if (params.getAll(key).length > 1) invalidDashboardQuery();
  const output: ResourceDashboardFilterInput = {};
  let total = 0;
  for (const key of ARRAYS) {
    if (!params.has(key)) continue;
    const tokens = params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim());
    total += tokens.length;
    if (tokens.length > LIMITS.idsPerField || total > LIMITS.totalIds) invalidDashboardQuery();
    const allowed = key === "roles" ? ROLES : key === "developerGrades" ? GRADES : key === "statuses" ? STATUSES : null;
    if (tokens.some((value) => allowed ? !allowed.includes(value) : !(isCanonicalUuidV4(value) || (key === "groupIds" && value === "ungrouped") || (key === "milestoneIds" && value === "unassigned")))) invalidDashboardQuery();
    Object.assign(output, { [key]: [...new Set(tokens)].sort() });
  }
  for (const key of ["from", "to", "asOfDate"] as const) if (params.has(key)) {
    const value = params.get(key)!; try { parseDateOnly(value, key); } catch { invalidDashboardQuery(); } output[key] = value;
  }
  if (output.from && output.to && output.from > output.to) invalidDashboardQuery();
  for (const key of ["search", "taskSearch"] as const) if (params.has(key)) {
    output[key] = params.get(key)!.trim(); if (output[key]!.length > 200) invalidDashboardQuery();
  }
  if (params.has("mode")) { const value = params.get("mode"); if (value !== "resource" && value !== "group") invalidDashboardQuery(); output.mode = value as "resource" | "group"; }
  for (const key of ["resourceActivity", "groupActivity"] as const) if (params.has(key)) { const value = params.get(key); if (!["all", "active", "inactive"].includes(value ?? "")) invalidDashboardQuery(); output[key] = value as "all" | "active" | "inactive"; }
  if (params.has("mdPerMm")) {
    const value = params.get("mdPerMm")!;
    if (value === "null") output.mdPerMm = null;
    else { const number = Number(value); if (!value.trim() || !Number.isFinite(number) || number <= 0) invalidDashboardQuery(); output.mdPerMm = number; }
  }
  return output;
}
export function normalizeResourceDashboardFilters(input: ResourceDashboardFilterInput = {}): ResourceDashboardFilters {
  // Reuse the public parser for direct service callers, including enum, UUID and budget checks.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) { if (value.length) params.set(key, value.join(",")); }
    else params.set(key, value === null ? "null" : String(value));
  }
  const checked = parseResourceDashboardQuery(params);
  return { from: checked.from ?? null, to: checked.to ?? null, asOfDate: checked.asOfDate ?? null,
    resourceActivity: checked.resourceActivity ?? "all", groupActivity: checked.groupActivity ?? "all",
    search: checked.search ?? "", taskSearch: checked.taskSearch ?? "", mode: checked.mode ?? "resource", mdPerMm: checked.mdPerMm ?? null, mdPerMmProvided: checked.mdPerMm !== undefined,
    resourceIds: checked.resourceIds ?? [], groupIds: checked.groupIds ?? [], milestoneIds: checked.milestoneIds ?? [], taskIds: checked.taskIds ?? [], wbsRootIds: checked.wbsRootIds ?? [], roles: checked.roles ?? [], developerGrades: checked.developerGrades ?? [], statuses: checked.statuses ?? [] };
}
export function parseResourceDashboardDetails(params: URLSearchParams): ResourceDashboardDetailInput {
  parseResourceDashboardQuery(params, true);
  const snapshotId = params.get("snapshotId") ?? "";
  if (!/^[a-f0-9]{64}$/.test(snapshotId)) invalidDashboardQuery();
  const dimension = params.get("dimension") ?? "all";
  if (!["all", "resource", "group", "role", "milestone", "diagnostic"].includes(dimension)) invalidDashboardQuery();
  const id = params.get("id") ?? null;
  const metric = params.get("metric") ?? "all";
  if (!METRICS.includes(metric as ResourceDashboardMetric)) invalidDashboardQuery();
  if (["all", "diagnostic"].includes(dimension) && id !== null) invalidDashboardQuery();
  if (dimension === "role" && (id === null || !ROLES.includes(id))) invalidDashboardQuery();
  if (dimension === "resource" && (id === null || !isCanonicalUuidV4(id))) invalidDashboardQuery();
  if (dimension === "group" && (id === null || !(id === "ungrouped" || isCanonicalUuidV4(id)))) invalidDashboardQuery();
  if (dimension === "milestone" && (id === null || !(id === "unassigned" || isCanonicalUuidV4(id)))) invalidDashboardQuery();
  const view = params.get("view") ?? (dimension === "diagnostic" ? "tasks" : "assignments");
  if (view !== "tasks" && view !== "assignments") invalidDashboardQuery();
  if (dimension === "diagnostic" && (!["completelyUnassigned", "groupOnly", "personallyUnassigned", "unset"].includes(metric) || (view === "assignments" && metric !== "unset"))) invalidDashboardQuery();
  if (dimension !== "diagnostic" && ["completelyUnassigned", "groupOnly", "personallyUnassigned"].includes(metric)) invalidDashboardQuery();
  const selector: ResourceDashboardSelector = { dimension: dimension as ResourceDashboardSelector["dimension"], id: id === "ungrouped" || id === "unassigned" ? null : id, assignmentScope: "selected", metric: metric as ResourceDashboardMetric };
  if (params.has("milestoneTaskId")) {
    const value = params.get("milestoneTaskId")!;
    if (dimension === "diagnostic" || !(value === "unassigned" || isCanonicalUuidV4(value))) invalidDashboardQuery();
    selector.milestoneTaskId = value === "unassigned" ? null : value;
  }
  if (params.has("resourceId")) {
    const value = params.get("resourceId")!;
    if (dimension !== "group" || !isCanonicalUuidV4(value)) invalidDashboardQuery();
    selector.resourceId = value;
  }
  if (params.has("assignmentScope")) {
    const value = params.get("assignmentScope")!;
    if (!["selected", "milestoneReference", "milestoneExcluded"].includes(value) || (dimension === "diagnostic" && value !== "selected")) invalidDashboardQuery();
    selector.assignmentScope = value as NonNullable<ResourceDashboardSelector["assignmentScope"]>;
  }
  const number = (key: "offset" | "limit", fallback: number, max: number, min: number) => {
    const raw = params.get(key); if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) invalidDashboardQuery();
    const value = Number(raw); if (!Number.isSafeInteger(value) || value < min || value > max) invalidDashboardQuery(); return value;
  };
  return { snapshotId, selector, view: view as "tasks" | "assignments", offset: number("offset", 0, LIMITS.detailOffset, 0), limit: number("limit", 50, LIMITS.detailPage, 1) };
}

export function parseResourceDashboardGroupChildren(params: URLSearchParams): ResourceDashboardGroupChildrenInput {
  parseResourceDashboardQuery(params, false, true);
  const groupId = params.get("groupId");
  if (groupId === null || !(groupId === "ungrouped" || isCanonicalUuidV4(groupId))) invalidDashboardQuery();
  const detailParams = new URLSearchParams({ dimension: "group", id: groupId!, snapshotId: params.get("snapshotId") ?? "" });
  for (const key of ["milestoneTaskId", "offset", "limit"] as const) if (params.has(key)) detailParams.set(key, params.get(key)!);
  const detail = parseResourceDashboardDetails(detailParams);
  return { snapshotId: detail.snapshotId, groupId: detail.selector.id, ...(detail.selector.milestoneTaskId === undefined ? {} : { milestoneTaskId: detail.selector.milestoneTaskId }), offset: detail.offset, limit: detail.limit };
}
