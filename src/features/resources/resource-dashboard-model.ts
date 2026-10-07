import { z } from "zod";
import type { ResourceDashboardDetailsDto, ResourceDashboardDto, ResourceDashboardFilterInput, ResourceDashboardSelector } from "@/contracts/resource-dashboard";

const count = z.number().int().nonnegative();
const finite = z.number().finite();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const selector = z.object({ dimension: z.enum(["all", "resource", "group", "role", "milestone", "diagnostic"]), id: z.string().nullable(), metric: z.enum(["all", "notStarted", "inProgress", "completed", "delayed", "unset", "completelyUnassigned", "groupOnly", "personallyUnassigned"]), milestoneTaskId: z.string().nullable().optional() });
const summary = z.object({ taskCount: count, resourceCount: count, assignmentCount: count, notStarted: count, inProgress: count, completed: count, delayed: count,
  completion: z.object({ numerator: finite, denominator: finite, percent: finite.nullable() }),
  assignedTaskProgress: z.object({ numerator: finite, denominator: finite, percent: finite.nullable() }),
  effort: z.object({ knownMd: finite, plannedMd: finite.nullable(), plannedMm: finite.nullable(), state: z.enum(["empty", "configured", "partial", "unset"]), partial: z.boolean(), unsetCount: count }), selector });
const row = z.object({ id: z.string().nullable(), name: z.string(), code: z.string().nullable(), active: z.boolean(), summary, resourceIds: z.array(z.string()), assignmentRange: z.object({ from: date, to: date }).nullable(), milestones: z.array(z.object({ milestoneTaskId: z.string().nullable(), summary })) });
const roles = z.array(z.enum(["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"]));
const grade = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);
const filters = z.object({ from: date.nullable(), to: date.nullable(), asOfDate: date.nullable(), search: z.string(), taskSearch: z.string(), mode: z.enum(["resource", "group"]), resourceActivity: z.enum(["all", "active", "inactive"]), groupActivity: z.enum(["all", "active", "inactive"]), resourceIds: z.array(z.string()), groupIds: z.array(z.string()), milestoneIds: z.array(z.string()), taskIds: z.array(z.string()), wbsRootIds: z.array(z.string()), roles, developerGrades: z.array(z.union([grade, z.literal("UNSPECIFIED")])), statuses: z.array(z.enum(["not_started", "in_progress", "completed"])), mdPerMm: finite.nullable(), mdPerMmProvided: z.boolean() });
const revisions = { schema: z.literal("resource-dashboard/1"), projectPublicId: z.string(), projectRevision: count, catalogRevision: count, calendarRevision: z.string().regex(/^[a-f0-9]{64}$/), snapshotId: z.string().regex(/^[a-f0-9]{64}$/) };
const diagnostic = z.object({ count, selector });
const report = z.object({ ...revisions, calculatedAt: z.iso.datetime(), asOfDate: date, timezone: z.literal("Asia/Seoul"), filters, range: z.object({ from: date, to: date }), rangeFallback: z.boolean(), mdPerMm: finite.nullable(), mdPerMmSource: z.enum(["query", "environment", "unset"]), scope: z.object({ assignment: z.literal("A"), diagnostics: z.literal("T0"), identity: z.string() }), summary, resources: z.array(row), groups: z.array(row), roleTotals: z.array(z.object({ role: z.string(), summary })), milestones: z.array(z.object({ milestoneTaskId: z.string().nullable(), summary })), stages: z.array(z.unknown()), diagnostics: z.object({ denominator: count, completelyUnassigned: diagnostic, groupOnly: diagnostic, personallyUnassigned: diagnostic, unsetTasks: diagnostic, unsetAssignmentCount: count, inapplicableFilters: z.array(z.string()), personalFiltersAppliedToA: z.boolean() }), catalog: z.object({ resources: z.array(z.object({ id: z.string(), name: z.string(), code: z.string().nullable(), active: z.boolean(), roles, developerGrade: grade.nullable(), groupIds: z.array(z.string()) })), groups: z.array(z.object({ id: z.string(), name: z.string(), code: z.string().nullable(), active: z.boolean() })), milestones: z.array(z.object({ id: z.string(), name: z.string() })), wbsRoots: z.array(z.unknown()) }), metadata: z.object({ groupRoleSubtotalsAdditive: z.literal(false), precision: z.literal("raw"), diagnosticsScope: z.string(), searchScope: z.string(), historicalStateRestoration: z.literal(false), totalFrom: z.literal("full selected assignment set"), limits: z.object({ detailPage: count }).passthrough() }) });
const detail = z.object({ ...revisions, selector, view: z.enum(["tasks", "assignments"]), offset: count, limit: count, totalCount: count, nextOffset: count.nullable(), rows: z.array(z.object({ taskId: z.string(), taskName: z.string(), externalId: z.string(), status: z.enum(["not_started", "in_progress", "completed"]), progress: finite.nullable(), taskStart: date.nullable(), taskEnd: date.nullable(), duration: finite.nullable(), wbsPath: z.array(z.object({ taskId: z.string(), name: z.string() })), effectiveMilestoneTaskId: z.string().nullable(), explicitMilestoneTaskId: z.string().nullable(), inheritedFromTaskId: z.string().nullable(), assignment: z.object({ assignmentId: z.string(), resourceId: z.string(), resourceName: z.string(), resourceCode: z.string().nullable(), active: z.boolean(), roles, developerGrade: grade.nullable(), groupIds: z.array(z.string()), assignmentStart: date.nullable(), assignmentEnd: date.nullable(), from: date, to: date, allocationPercent: finite.nullable(), effectiveWorkingDays: finite, plannedMd: finite.nullable(), plannedMm: finite.nullable() }).nullable() })) });

export function dashboardQuery(input: ResourceDashboardFilterInput): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) { if (value.length) result.set(key, [...new Set(value)].sort().join(",")); }
    else result.set(key, value === null ? "null" : String(value).trim());
  }
  return result;
}
export function readDashboard(body: unknown, publicId: string, query: URLSearchParams): ResourceDashboardDto | null {
  const parsed = z.object({ data: report }).safeParse(body);
  if (!parsed.success || parsed.data.data.projectPublicId !== publicId) return null;
  const data = parsed.data.data;
  // Every requested condition must be echoed. Unrequested axes must stay at defaults.
  for (const [key, value] of Object.entries(data.filters)) {
    if (key === "mdPerMmProvided") { if (value !== query.has("mdPerMm")) return null; continue; }
    const requested = query.get(key);
    if (Array.isArray(value)) { if (value.join(",") !== (requested ?? "")) return null; }
    else if (requested !== null) { if (String(value) !== requested) return null; }
    else if (key === "mode") { if (value !== "resource") return null; }
    else if (key === "resourceActivity" || key === "groupActivity") { if (value !== "all") return null; }
    else if (value !== null && value !== "") return null;
  }
  if (data.mdPerMm !== null && data.mdPerMm <= 0) return null;
  if (data.filters.mdPerMmProvided && (data.mdPerMmSource !== "query" || data.mdPerMm !== data.filters.mdPerMm)) return null;
  if (data.scope.identity !== data.snapshotId || (data.filters.asOfDate && data.asOfDate !== data.filters.asOfDate)) return null;
  if (data.range.from > data.range.to || (data.filters.from && data.range.from !== data.filters.from) || (data.filters.to && data.range.to !== data.filters.to)) return null;
  return parsed.data.data as unknown as ResourceDashboardDto;
}
export function detailsQuery(data: ResourceDashboardDto, selected: ResourceDashboardSelector, view: "tasks" | "assignments", offset: number): URLSearchParams {
  const { mdPerMmProvided, mdPerMm, from, to, asOfDate, ...rest } = data.filters;
  const query = dashboardQuery({ ...rest, from: from ?? undefined, to: to ?? undefined, asOfDate: asOfDate ?? undefined, ...(mdPerMmProvided ? { mdPerMm } : {}) });
  query.set("snapshotId", data.snapshotId); query.set("dimension", selected.dimension); query.set("metric", selected.metric);
  if (selected.id !== null) query.set("id", selected.id);
  else if (selected.dimension === "group") query.set("id", "ungrouped");
  else if (selected.dimension === "milestone") query.set("id", "unassigned");
  if (selected.milestoneTaskId !== undefined) query.set("milestoneTaskId", selected.milestoneTaskId ?? "unassigned");
  query.set("view", view); query.set("offset", String(offset)); query.set("limit", "50");
  return query;
}
export function readDetails(body: unknown, data: ResourceDashboardDto, selected: ResourceDashboardSelector, view: "tasks" | "assignments", offset: number): ResourceDashboardDetailsDto | null {
  const parsed = z.object({ data: detail }).safeParse(body);
  if (!parsed.success) return null;
  const value = parsed.data.data;
  if (["projectPublicId", "projectRevision", "catalogRevision", "calendarRevision", "snapshotId"].some((key) => value[key as keyof typeof value] !== data[key as keyof typeof data]) || JSON.stringify(value.selector) !== JSON.stringify(selected) || value.view !== view || value.offset !== offset || value.limit !== 50 || (view === "assignments" && value.rows.some((row) => row.assignment === null))) return null;
  return value as ResourceDashboardDetailsDto;
}
export function plannedEffort(effort: ResourceDashboardDto["summary"]["effort"], unit: "md" | "mm"): string {
  if (effort.state === "unset") return "산정 불가 · 공수 미설정";
  const amount = unit === "md" ? effort.plannedMd : effort.plannedMm;
  return `${amount === null ? "—" : amount.toFixed(2)} ${unit === "md" ? "M/D" : "M/M"}${effort.partial ? " · 알려진 부분합" : ""}`;
}
