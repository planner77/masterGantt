import type { ResourceDashboardSelector, ResourcePlanDetailInput } from "../../contracts/resource-dashboard";
import { RESOURCE_DRILL_LIMITS, type ResourceDataContext, type ResourceDrillProjection, type ResourceDrillQueryInput, type ResourceDrillScope, type ResourceDrillScopeRequest, type ResourceDrillSourceContext, type ResourceDrillSourceProjection } from "../../contracts/resource-drill";
import { parseDateOnly } from "../../domain/scheduling/date-only";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { invalidDashboardQuery, parseResourceDashboardDetails, parseResourceDashboardGroupChildren, parseResourceDashboardQuery, parseResourcePlanDetails } from "./resource-dashboard-query-core";

const HASH = /^[a-f0-9]{64}$/;
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) invalidDashboardQuery();
  return value as Record<string, unknown>;
}
function date(value: unknown): string { if (typeof value !== "string") invalidDashboardQuery(); try { parseDateOnly(value); } catch { invalidDashboardQuery(); } return value; }
function uuid(value: unknown): string { if (typeof value !== "string" || !isCanonicalUuidV4(value)) invalidDashboardQuery(); return value; }
function hash(value: unknown): string { if (typeof value !== "string" || !HASH.test(value)) invalidDashboardQuery(); return value; }
function revision(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalidDashboardQuery(); return value; }
function ids(value: unknown, maximum: number): string[] { if (!Array.isArray(value) || value.length > maximum) invalidDashboardQuery(); return [...new Set(value.map(uuid))].sort(); }
export function parseResourceDataContext(value: unknown): ResourceDataContext {
  const input = object(value, ["projectPublicId", "projectRevision", "catalogRevision", "calendarRevision", "dataSnapshotId"]);
  return { projectPublicId: uuid(input.projectPublicId), projectRevision: revision(input.projectRevision), catalogRevision: revision(input.catalogRevision), calendarRevision: hash(input.calendarRevision), dataSnapshotId: hash(input.dataSnapshotId) };
}
function paramsOf(value: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined) continue;
    if (Array.isArray(field)) { if (field.some((item) => typeof item !== "string")) invalidDashboardQuery(); if (field.length) params.set(key, field.join(",")); }
    else if (typeof field === "string" || typeof field === "number" || field === null) params.set(key, field === null ? "null" : String(field));
    else invalidDashboardQuery();
  }
  return params;
}
function selectorParams(value: unknown): URLSearchParams {
  const row = object(value, ["dimension", "id", "metric", "milestoneTaskId", "resourceId", "assignmentScope"]);
  const params = paramsOf(row);
  if (row.id === null) { if (row.dimension === "group") params.set("id", "ungrouped"); else if (row.dimension === "milestone") params.set("id", "unassigned"); else params.delete("id"); }
  if (row.milestoneTaskId === null) params.set("milestoneTaskId", "unassigned");
  return params;
}
function checkedSelector(value: unknown): ResourceDashboardSelector {
  const params = selectorParams(value); params.set("snapshotId", "0".repeat(64));
  return parseResourceDashboardDetails(params).selector;
}
function planParams(value: Record<string, unknown>): URLSearchParams {
  const row = object(value.selector, ["kind", "groupId", "resourceId", "milestoneTaskId"]);
  const params = paramsOf(Object.fromEntries(Object.entries(value).filter(([key]) => !["kind", "selector", "target"].includes(key))));
  params.set("row", String(row.kind));
  for (const key of ["groupId", "resourceId", "milestoneTaskId"] as const) if (row[key] !== undefined) params.set(key, row[key] === null ? key === "groupId" ? "ungrouped" : "unassigned" : String(row[key]));
  return params;
}
function checkedPlan(value: Record<string, unknown>, kind: "daily" | "day-resources" | "day-assignments", source = false): ResourcePlanDetailInput {
  const params = planParams(value); if (source) params.set("snapshotId", "0".repeat(64));
  return parseResourcePlanDetails(params, kind).detail;
}
export function parseResourceDrillSourceProjection(value: unknown): ResourceDrillSourceProjection {
  const input = object(value, ["kind", "selector", "view", "groupId", "milestoneTaskId", "granularity", "periodId", "demandScope", "date"]);
  if (["schedule", "milestoneReport", "report"].includes(String(input.kind))) { object(input, ["kind"]); return { kind: input.kind as "schedule" | "milestoneReport" | "report" }; }
  if (input.kind === "details") { object(input, ["kind", "selector", "view"]); if (input.view !== "tasks" && input.view !== "assignments") invalidDashboardQuery(); return { kind: "details", selector: checkedSelector(input.selector), view: input.view }; }
  if (input.kind === "groupChildren") {
    object(input, ["kind", "groupId", "milestoneTaskId"]);
    const groupId = input.groupId === null ? null : uuid(input.groupId);
    const milestoneTaskId = input.milestoneTaskId === undefined ? undefined : input.milestoneTaskId === null ? null : uuid(input.milestoneTaskId);
    return { kind: "groupChildren", groupId, ...(milestoneTaskId === undefined ? {} : { milestoneTaskId }) };
  }
  if (input.kind === "plan") {
    object(input, ["kind", "selector", "granularity", "periodId", "demandScope", "date"]);
    const detail = checkedPlan({ ...input, date: undefined }, "daily", true);
    return { kind: "plan", granularity: detail.granularity, periodId: detail.periodId, selector: detail.selector, demandScope: detail.demandScope, ...(input.date === undefined ? {} : { date: date(input.date) }) };
  }
  return invalidDashboardQuery();
}
export function parseResourceDrillSourceContext(value: unknown): ResourceDrillSourceContext {
  const input = object(value, ["projectPublicId", "projectRevision", "catalogRevision", "calendarRevision", "dataSnapshotId", "range", "asOfDate", "mdPerMm", "mdPerMmSource", "mdPerMmProvided", "sourceProjection"]);
  const base = parseResourceDataContext(Object.fromEntries(Object.entries(input).filter(([key]) => ["projectPublicId", "projectRevision", "catalogRevision", "calendarRevision", "dataSnapshotId"].includes(key))));
  const range = object(input.range, ["from", "to"]), from = date(range.from), to = date(range.to);
  if (from > to || typeof input.mdPerMmProvided !== "boolean" || !["query", "environment", "unset"].includes(String(input.mdPerMmSource)) || !(input.mdPerMm === null || (typeof input.mdPerMm === "number" && Number.isFinite(input.mdPerMm) && input.mdPerMm > 0))) invalidDashboardQuery();
  if ((input.mdPerMmSource === "query") !== input.mdPerMmProvided || (input.mdPerMmSource === "unset" && input.mdPerMm !== null) || (input.mdPerMmSource === "environment" && input.mdPerMm === null)) invalidDashboardQuery();
  return { ...base, range: { from, to }, asOfDate: date(input.asOfDate), mdPerMm: input.mdPerMm as number | null, mdPerMmSource: input.mdPerMmSource as ResourceDrillSourceContext["mdPerMmSource"], mdPerMmProvided: input.mdPerMmProvided, sourceProjection: parseResourceDrillSourceProjection(input.sourceProjection) };
}
export function parseResourceDrillProjection(value: unknown): ResourceDrillProjection {
  const input = object(value, ["kind", "snapshotId", "selector", "view", "offset", "limit", "groupId", "milestoneTaskId", "granularity", "periodId", "demandScope", "date", "target"]);
  if (input.kind === "report") { object(input, ["kind"]); return { kind: "report" }; }
  if (input.kind === "details") {
    object(input, ["kind", "snapshotId", "selector", "view", "offset", "limit"]);
    const params = selectorParams(input.selector); for (const key of ["snapshotId", "view", "offset", "limit"] as const) if (input[key] !== undefined) params.set(key, String(input[key]));
    return { kind: "details", ...parseResourceDashboardDetails(params) };
  }
  if (input.kind === "groupChildren") {
    object(input, ["kind", "snapshotId", "groupId", "milestoneTaskId", "offset", "limit"]);
    const params = paramsOf(Object.fromEntries(Object.entries(input).filter(([key]) => key !== "kind")));
    if (input.groupId === null) params.set("groupId", "ungrouped"); if (input.milestoneTaskId === null) params.set("milestoneTaskId", "unassigned");
    return { kind: "groupChildren", ...parseResourceDashboardGroupChildren(params) };
  }
  if (["planDaily", "planDayResources", "planDayAssignments"].includes(String(input.kind))) {
    object(input, ["kind", "snapshotId", "selector", "granularity", "periodId", "demandScope", "date", "offset", "limit"]);
    const kind = input.kind as "planDaily" | "planDayResources" | "planDayAssignments";
    return { kind, ...checkedPlan(input, kind === "planDaily" ? "daily" : kind === "planDayResources" ? "day-resources" : "day-assignments") };
  }
  if (input.kind === "scope") {
    if (input.target === "dashboard") { object(input, ["kind", "target", "snapshotId", "selector"]); return { kind: "scope", target: "dashboard", snapshotId: hash(input.snapshotId), selector: checkedSelector(input.selector) }; }
    if (input.target === "plan") {
      object(input, ["kind", "target", "snapshotId", "selector", "granularity", "periodId", "demandScope", "date"]);
      const detail = checkedPlan({ ...input, date: undefined }, "daily");
      return { kind: "scope", target: "plan", snapshotId: detail.snapshotId, selector: detail.selector, granularity: detail.granularity, periodId: detail.periodId, demandScope: detail.demandScope, ...(input.date === undefined ? {} : { date: date(input.date) }) };
    }
  }
  return invalidDashboardQuery();
}
export function parseResourceDrillQuery(value: unknown): ResourceDrillQueryInput {
  const input = object(value, ["sourceContext", "scope", "filters", "projection"]), scope = object(input.scope, ["kind", "nodeIds", "rootId", "assignmentIds"]);
  let normalizedScope: ResourceDrillScope;
  if (scope.kind === "scheduleSelection") { object(scope, ["kind", "nodeIds"]); normalizedScope = { kind: scope.kind, nodeIds: ids(scope.nodeIds, RESOURCE_DRILL_LIMITS.nodes) }; }
  else if (scope.kind === "summarySubtree") { object(scope, ["kind", "rootId"]); normalizedScope = { kind: scope.kind, rootId: uuid(scope.rootId) }; }
  else if (scope.kind === "exactAssignments") { object(scope, ["kind", "assignmentIds"]); normalizedScope = { kind: scope.kind, assignmentIds: ids(scope.assignmentIds, RESOURCE_DRILL_LIMITS.assignments) }; }
  else return invalidDashboardQuery();
  const filters = object(input.filters, ["from", "to", "asOfDate", "search", "taskSearch", "mode", "granularity", "mdPerMm", "resourceActivity", "groupActivity", "resourceIds", "groupIds", "milestoneIds", "taskIds", "wbsRootIds", "roles", "developerGrades", "statuses"]);
  return { sourceContext: parseResourceDrillSourceContext(input.sourceContext), scope: normalizedScope, filters: parseResourceDashboardQuery(paramsOf(filters)), projection: parseResourceDrillProjection(input.projection) };
}
export function parseResourceDrillScopeRequest(params: URLSearchParams): ResourceDrillScopeRequest {
  if (params.getAll("view").length !== 1) invalidDashboardQuery();
  const view = params.get("view"), rest = new URLSearchParams(params); rest.delete("view");
  if (view === "context") { if (rest.size) invalidDashboardQuery(); return { view }; }
  if (view === "dashboard") { if (rest.has("offset") || rest.has("limit")) invalidDashboardQuery(); const detail = parseResourceDashboardDetails(rest); return { view, filters: parseResourceDashboardQuery(rest, true), snapshotId: detail.snapshotId, selector: detail.selector }; }
  if (view === "plan") { if (rest.has("offset") || rest.has("limit")) invalidDashboardQuery(); const day = rest.get("date"); rest.delete("date"); const parsed = parseResourcePlanDetails(rest, "daily"); return { view, filters: parsed.filter, detail: { ...parsed.detail, ...(day === null ? {} : { date: date(day) }) } }; }
  return invalidDashboardQuery();
}
