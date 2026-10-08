import type {
  ResourceDashboardFilterInput,
  ResourceDashboardSelector,
} from "@/contracts/resource-dashboard";
import type {
  ResourceDrillProjection,
  ResourceDrillQueryInput,
  ResourceDrillScope,
  ResourceDrillSourceContext,
} from "@/contracts/resource-drill";

export interface ResourceDrillBinding {
  sourceContext: ResourceDrillSourceContext;
  scope: ResourceDrillScope;
}
const listKeys = [
  "resourceIds",
  "groupIds",
  "milestoneIds",
  "taskIds",
  "wbsRootIds",
  "roles",
  "developerGrades",
  "statuses",
];
const scalarKeys = [
  "from",
  "to",
  "asOfDate",
  "search",
  "taskSearch",
  "mode",
  "resourceActivity",
  "groupActivity",
  "granularity",
];
export function drillFilters(
  query: URLSearchParams,
): ResourceDashboardFilterInput {
  const values: Record<string, unknown> = {};
  for (const key of listKeys)
    if (query.has(key))
      values[key] = query.get(key)!.split(",").filter(Boolean);
  for (const key of scalarKeys)
    if (query.has(key)) values[key] = query.get(key);
  if (query.has("mdPerMm"))
    values.mdPerMm =
      query.get("mdPerMm") === "null" ? null : Number(query.get("mdPerMm"));
  return values as ResourceDashboardFilterInput;
}
function nullableId(value: string | null) {
  return value === "ungrouped" || value === "unassigned" ? null : value;
}
export function dashboardSelector(
  query: URLSearchParams,
): ResourceDashboardSelector {
  return {
    dimension: query.get("dimension") as ResourceDashboardSelector["dimension"],
    id: nullableId(query.get("id")),
    metric: query.get("metric") as ResourceDashboardSelector["metric"],
    assignmentScope: (query.get("assignmentScope") ??
      "selected") as ResourceDashboardSelector["assignmentScope"],
    ...(query.has("milestoneTaskId")
      ? { milestoneTaskId: nullableId(query.get("milestoneTaskId")) }
      : {}),
    ...(query.has("resourceId")
      ? { resourceId: query.get("resourceId")! }
      : {}),
  };
}
export function drillProjection(url: URL): ResourceDrillProjection {
  const q = url.searchParams,
    snapshotId = q.get("snapshotId")!,
    offset = Number(q.get("offset") ?? 0),
    limit = Number(q.get("limit") ?? 50);
  if (url.pathname.endsWith("/details"))
    return {
      kind: "details",
      snapshotId,
      selector: dashboardSelector(q),
      view: q.get("view") as "tasks" | "assignments",
      offset,
      limit,
    };
  if (url.pathname.endsWith("/group-children"))
    return {
      kind: "groupChildren",
      snapshotId,
      groupId: nullableId(q.get("groupId")),
      ...(q.has("milestoneTaskId")
        ? { milestoneTaskId: nullableId(q.get("milestoneTaskId")) }
        : {}),
      offset,
      limit,
    };
  const suffix = url.pathname.split("/").at(-1);
  if (["daily", "day-resources", "day-assignments"].includes(suffix!)) {
    const row = q.get("row"),
      resourceId = q.get("resourceId")!,
      selector =
        row === "group"
          ? { kind: "group" as const, groupId: nullableId(q.get("groupId")) }
          : row === "resourceMilestone"
            ? {
                kind: "resourceMilestone" as const,
                resourceId,
                milestoneTaskId: nullableId(q.get("milestoneTaskId")),
              }
            : row === "resource"
              ? { kind: "resource" as const, resourceId }
              : { kind: "total" as const };
    return {
      kind:
        suffix === "daily"
          ? "planDaily"
          : suffix === "day-resources"
            ? "planDayResources"
            : "planDayAssignments",
      snapshotId,
      granularity: q.get("granularity") as "week" | "month",
      periodId: q.get("periodId")!,
      selector,
      demandScope: q.get("demandScope") as "selected" | "project",
      ...(q.has("date") ? { date: q.get("date")! } : {}),
      offset,
      limit,
    };
  }
  return { kind: "report" };
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function normalizedBinding(
  binding: ResourceDrillBinding,
): ResourceDrillBinding {
  const scope = binding.scope;
  return {
    ...binding,
    scope:
      scope.kind === "summarySubtree"
        ? scope
        : scope.kind === "scheduleSelection"
          ? { ...scope, nodeIds: [...new Set(scope.nodeIds)].sort() }
          : {
              ...scope,
              assignmentIds: [...new Set(scope.assignmentIds)].sort(),
            },
  };
}
export async function queryResourceDrill(
  publicId: string,
  input: ResourceDrillQueryInput,
  init?: RequestInit,
) {
  const request = { ...input, ...normalizedBinding(input) };
  const response = await fetch(
    `/api/projects/${encodeURIComponent(publicId)}/resource-dashboard/query`,
    {
      ...init,
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) return response;
  const body = await response
      .clone()
      .json()
      .catch(() => null),
    echo = body?.drill;
  if (
    !echo ||
    stable(echo.sourceContext) !== stable(request.sourceContext) ||
    stable(echo.scope) !== stable(request.scope) ||
    stable(echo.projection) !== stable(request.projection) ||
    echo.assignmentScope !== "exact-source-intersection" ||
    echo.projectReferenceScope !== "same-resource-population-and-period"
  )
    throw Error("INVALID_RESPONSE");
  if (
    !echo.targetFilters ||
    !body.data ||
    stable(echo.targetFilters) !==
      stable(normalizedDrillFilters(request.filters))
  )
    throw Error("INVALID_RESPONSE");
  return response;
}
export function resourceProjectionFetch(
  binding: ResourceDrillBinding | null,
  path: string,
  init?: RequestInit,
) {
  if (!binding)
    return fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  const url = new URL(path, "http://resource-query.invalid"),
    publicId = decodeURIComponent(url.pathname.split("/")[3]);
  return queryResourceDrill(
    publicId,
    {
      ...binding,
      filters: drillFilters(url.searchParams),
      projection: drillProjection(url),
    },
    init,
  );
}

export function normalizedDrillFilters(input: ResourceDashboardFilterInput) {
  return {
    from: input.from ?? null,
    to: input.to ?? null,
    asOfDate: input.asOfDate ?? null,
    search: input.search?.trim() ?? "",
    taskSearch: input.taskSearch?.trim() ?? "",
    mode: input.mode ?? "resource",
    resourceActivity: input.resourceActivity ?? "all",
    groupActivity: input.groupActivity ?? "all",
    ...Object.fromEntries(
      listKeys.map((key) => [
        key,
        [
          ...new Set(
            ((input as Record<string, unknown>)[key] as string[]) ?? [],
          ),
        ].sort(),
      ]),
    ),
    mdPerMm: input.mdPerMm ?? null,
    mdPerMmProvided: Object.hasOwn(input, "mdPerMm"),
    ...(input.granularity ? { granularity: input.granularity } : {}),
  };
}

export function planScopeProjection(
  input: import("@/contracts/resource-dashboard").ResourcePlanDetailInput,
) {
  const { offset: _offset, limit: _limit, ...projection } = input;
  void _offset;
  void _limit;
  return projection;
}
