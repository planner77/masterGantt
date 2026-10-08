import {
  resourceSourceContextSchema,
  resourceDataContextSchema,
} from "./resource-drill-scope-model";
import { z } from "zod";
import { resourcePlanSchema } from "./resource-plan-model";
import type {
  ResourceDashboardDetailsDto,
  ResourceDashboardDto,
  ResourceDashboardFilterInput,
  ResourceDashboardSelector,
  ResourceDashboardGroupChildrenDto,
} from "@/contracts/resource-dashboard";

const count = z.number().int().nonnegative();
const finite = z.number().finite();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const selector = z.object({
  dimension: z.enum([
    "all",
    "resource",
    "group",
    "role",
    "milestone",
    "diagnostic",
  ]),
  id: z.string().nullable(),
  metric: z.enum([
    "all",
    "notStarted",
    "inProgress",
    "completed",
    "delayed",
    "unset",
    "completelyUnassigned",
    "groupOnly",
    "personallyUnassigned",
  ]),
  milestoneTaskId: z.string().nullable().optional(),
  resourceId: z.string().optional(),
  assignmentScope: z
    .enum(["selected", "milestoneReference", "milestoneExcluded"])
    .optional(),
});
const summary = z.object({
  taskCount: count,
  resourceCount: count,
  assignmentCount: count,
  notStarted: count,
  inProgress: count,
  completed: count,
  delayed: count,
  completion: z.object({
    numerator: finite,
    denominator: finite,
    percent: finite.nullable(),
  }),
  assignedTaskProgress: z.object({
    numerator: finite,
    denominator: finite,
    percent: finite.nullable(),
  }),
  effort: z.object({
    knownMd: finite,
    plannedMd: finite.nullable(),
    plannedMm: finite.nullable(),
    state: z.enum(["empty", "configured", "partial", "unset"]),
    partial: z.boolean(),
    unsetCount: count,
  }),
  selector,
});
const row = z.object({
  id: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  active: z.boolean(),
  summary,
  resourceIds: z.array(z.string()),
  assignmentRange: z.object({ from: date, to: date }).nullable(),
  milestones: z.array(
    z.object({ milestoneTaskId: z.string().nullable(), summary }),
  ),
});
const roles = z.array(
  z.enum(["PI", "DEVELOPER", "EQUIPMENT_OWNER", "UNSPECIFIED"]),
);
const grade = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);
const filters = z.object({
  from: date.nullable(),
  to: date.nullable(),
  asOfDate: date.nullable(),
  search: z.string(),
  taskSearch: z.string(),
  mode: z.enum(["resource", "group"]),
  resourceActivity: z.enum(["all", "active", "inactive"]),
  groupActivity: z.enum(["all", "active", "inactive"]),
  resourceIds: z.array(z.string()),
  groupIds: z.array(z.string()),
  milestoneIds: z.array(z.string()),
  taskIds: z.array(z.string()),
  wbsRootIds: z.array(z.string()),
  roles,
  developerGrades: z.array(z.union([grade, z.literal("UNSPECIFIED")])),
  statuses: z.array(z.enum(["not_started", "in_progress", "completed"])),
  mdPerMm: finite.nullable(),
  mdPerMmProvided: z.boolean(),
  granularity: z.enum(["week", "month"]).optional(),
});
const revisions = {
  schema: z.literal("resource-dashboard/1"),
  projectPublicId: z.string(),
  projectRevision: count,
  catalogRevision: count,
  calendarRevision: z.string().regex(/^[a-f0-9]{64}$/),
  snapshotId: z.string().regex(/^[a-f0-9]{64}$/),
};
const diagnostic = z.object({ count, selector });
const report = z.object({
  resourceScopeContext: resourceSourceContextSchema.optional(),
  ...revisions,
  calculatedAt: z.iso.datetime(),
  asOfDate: date,
  timezone: z.literal("Asia/Seoul"),
  filters,
  range: z.object({ from: date, to: date }),
  rangeFallback: z.boolean(),
  mdPerMm: finite.nullable(),
  mdPerMmSource: z.enum(["query", "environment", "unset"]),
  scope: z.object({
    assignment: z.literal("A"),
    diagnostics: z.literal("T0"),
    identity: z.string(),
  }),
  plan: resourcePlanSchema.optional(),
  summary,
  reference: summary.optional(),
  excluded: summary.optional(),
  milestoneSelection: z
    .object({
      applied: z.boolean(),
      reference: z.literal("A without Milestone filter"),
      excluded: z.literal(
        "reference Assignment IDs minus selected Assignment IDs",
      ),
    })
    .optional(),
  resources: z.array(row),
  groups: z.array(row),
  roleTotals: z.array(z.object({ role: z.string(), summary })),
  milestones: z.array(
    z.object({ milestoneTaskId: z.string().nullable(), summary }),
  ),
  stages: z.array(
    z.object({
      milestoneTaskId: z.string(),
      name: z.string(),
      scheduledDate: date.nullable(),
      status: z.enum(["not_started", "in_progress", "completed"]),
      selected: summary,
      full: z.object({
        memberCount: count,
        completedMemberCount: count,
        memberProgressPercent: finite.nullable(),
        predecessorCount: count,
        incompletePredecessorCount: count,
        ready: z.boolean().nullable(),
        blocked: z.boolean(),
        manualEvent: z.boolean(),
        completionInconsistent: z.boolean(),
      }),
    }),
  ),
  diagnostics: z.object({
    denominator: count,
    completelyUnassigned: diagnostic,
    groupOnly: diagnostic,
    personallyUnassigned: diagnostic,
    unsetTasks: diagnostic,
    unsetAssignmentCount: count,
    inapplicableFilters: z.array(z.string()),
    personalFiltersAppliedToA: z.boolean(),
  }),
  catalog: z.object({
    resources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        code: z.string().nullable(),
        active: z.boolean(),
        roles,
        developerGrade: grade.nullable(),
        groupIds: z.array(z.string()),
      }),
    ),
    groups: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        code: z.string().nullable(),
        active: z.boolean(),
      }),
    ),
    milestones: z.array(z.object({ id: z.string(), name: z.string() })),
    wbsRoots: z.array(z.unknown()),
  }),
  metadata: z.object({
    groupRoleSubtotalsAdditive: z.literal(false),
    precision: z.literal("raw"),
    diagnosticsScope: z.string(),
    searchScope: z.string(),
    historicalStateRestoration: z.literal(false),
    totalFrom: z.literal("full selected assignment set"),
    limits: z.object({ detailPage: count }).passthrough(),
  }),
});
const detail = z.object({
  resourceDataContext: resourceDataContextSchema.optional(),
  ...revisions,
  selector,
  view: z.enum(["tasks", "assignments"]),
  offset: count,
  limit: count,
  totalCount: count,
  nextOffset: count.nullable(),
  rows: z.array(
    z.object({
      taskId: z.string(),
      taskName: z.string(),
      externalId: z.string(),
      status: z.enum(["not_started", "in_progress", "completed"]),
      progress: finite.nullable(),
      taskStart: date.nullable(),
      taskEnd: date.nullable(),
      duration: finite.nullable(),
      wbsPath: z.array(z.object({ taskId: z.string(), name: z.string() })),
      effectiveMilestoneTaskId: z.string().nullable(),
      explicitMilestoneTaskId: z.string().nullable(),
      inheritedFromTaskId: z.string().nullable(),
      assignment: z
        .object({
          assignmentId: z.string(),
          resourceId: z.string(),
          resourceName: z.string(),
          resourceCode: z.string().nullable(),
          active: z.boolean(),
          roles,
          developerGrade: grade.nullable(),
          groupIds: z.array(z.string()),
          assignmentStart: date.nullable(),
          assignmentEnd: date.nullable(),
          from: date,
          to: date,
          allocationPercent: finite.nullable(),
          effectiveWorkingDays: finite,
          plannedMd: finite.nullable(),
          plannedMm: finite.nullable(),
        })
        .nullable(),
    }),
  ),
});

export function dashboardQuery(
  input: ResourceDashboardFilterInput,
): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) result.set(key, [...new Set(value)].sort().join(","));
    } else result.set(key, value === null ? "null" : String(value).trim());
  }
  return result;
}
export function readDashboard(
  body: unknown,
  publicId: string,
  query: URLSearchParams,
): ResourceDashboardDto | null {
  const parsed = z.object({ data: report }).safeParse(body);
  if (!parsed.success || parsed.data.data.projectPublicId !== publicId)
    return null;
  const data = parsed.data.data;
  // Every requested condition must be echoed. Unrequested axes must stay at defaults.
  for (const [key, value] of Object.entries(data.filters)) {
    if (key === "mdPerMmProvided") {
      if (value !== query.has("mdPerMm")) return null;
      continue;
    }
    const requested = query.get(key);
    if (key === "granularity") {
      if (value !== (requested ?? undefined)) return null;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.join(",") !== (requested ?? "")) return null;
    } else if (requested !== null) {
      if (String(value) !== requested) return null;
    } else if (key === "mode") {
      if (value !== "resource") return null;
    } else if (key === "resourceActivity" || key === "groupActivity") {
      if (value !== "all") return null;
    } else if (value !== null && value !== "") return null;
  }
  if (
    query.has("granularity") &&
    (!data.plan ||
      data.plan.granularity !== query.get("granularity") ||
      data.plan.from !== data.range.from ||
      data.plan.to !== data.range.to ||
      data.plan.mdPerMm !== data.mdPerMm)
  )
    return null;
  if (data.plan) {
    const plan = data.plan,
      ids = new Set(plan.population.resourceIds),
      periodIds = new Set(plan.periods.map((p) => p.key));
    if (
      !query.has("granularity") ||
      plan.asOfDate !== data.asOfDate ||
      plan.population.resourceCount !== ids.size ||
      ids.size !== plan.resources.length ||
      plan.resources.some((r) => !ids.has(r.resourceId)) ||
      new Set(plan.resources.map((r) => r.resourceId)).size !== ids.size
    )
      return null;
    if (
      !plan.periods.length ||
      periodIds.size !== plan.periods.length ||
      plan.periods[0].from !== data.range.from ||
      plan.periods.at(-1)?.to !== data.range.to ||
      plan.periods.some(
        (p, i) =>
          p.from > p.to ||
          p.from < data.range.from ||
          p.to > data.range.to ||
          (i > 0 && p.from <= plan.periods[i - 1].to) ||
          !(
            plan.granularity === "week" ? /^\d{4}-W\d{2}$/ : /^\d{4}-\d{2}$/
          ).test(p.key),
      )
    )
      return null;
    // Compare raw server projections; capacity population includes zero-load people.
    const sameAmount = (left: number | null, right: number | null) =>
      left === null || right === null
        ? left === right
        : Math.abs(left - right) <=
          1e-8 * Math.max(1, Math.abs(left), Math.abs(right));
    const selected = plan.totals.summary.selected,
      effort = data.summary.effort;
    if (
      selected.assignmentCount !== data.summary.assignmentCount ||
      selected.unknownAssignmentCount !== effort.unsetCount ||
      selected.state !== effort.state ||
      selected.partial !== effort.partial ||
      !sameAmount(selected.knownMd, effort.knownMd) ||
      !sameAmount(selected.plannedMd, effort.plannedMd) ||
      !sameAmount(selected.plannedMm, effort.plannedMm)
    )
      return null;
    const allSeries = [
      plan.totals,
      ...plan.groups,
      ...plan.resources.flatMap((r) => [r, ...r.milestones]),
    ];
    if (
      allSeries.some(
        (s) =>
          s.cells.length !== periodIds.size ||
          new Set(s.cells.map((c) => c.periodKey)).size !== periodIds.size ||
          s.cells.some((c) => !periodIds.has(c.periodKey)),
      ) ||
      allSeries.some((s) =>
        ["selected", "project"].some((scope) => {
          const demand = scope as "selected" | "project";
          return !sameAmount(
            s.summary[demand].knownMd,
            s.cells.reduce((sum, cell) => sum + cell[demand].knownMd, 0),
          );
        }),
      ) ||
      plan.groups.some((g) => g.resourceIds.some((id) => !ids.has(id))) ||
      plan.resources.some((r) =>
        r.milestones.some(
          (m) => m.projectReferenceRow.resourceId !== r.resourceId,
        ),
      )
    )
      return null;
  }
  if (data.mdPerMm !== null && data.mdPerMm <= 0) return null;
  if (
    data.filters.mdPerMmProvided &&
    (data.mdPerMmSource !== "query" || data.mdPerMm !== data.filters.mdPerMm)
  )
    return null;
  if (
    data.scope.identity !== data.snapshotId ||
    (data.filters.asOfDate && data.asOfDate !== data.filters.asOfDate)
  )
    return null;
  if (
    data.range.from > data.range.to ||
    (data.filters.from && data.range.from !== data.filters.from) ||
    (data.filters.to && data.range.to !== data.filters.to)
  )
    return null;
  return parsed.data.data as unknown as ResourceDashboardDto;
}
export function detailsQuery(
  data: ResourceDashboardDto,
  selected: ResourceDashboardSelector,
  view: "tasks" | "assignments",
  offset: number,
): URLSearchParams {
  const { mdPerMmProvided, mdPerMm, from, to, asOfDate, ...rest } =
    data.filters;
  const query = dashboardQuery({
    ...rest,
    from: from ?? undefined,
    to: to ?? undefined,
    asOfDate: asOfDate ?? undefined,
    ...(mdPerMmProvided ? { mdPerMm } : {}),
  });
  query.set("snapshotId", data.snapshotId);
  query.set("dimension", selected.dimension);
  query.set("metric", selected.metric);
  if (selected.id !== null) query.set("id", selected.id);
  else if (selected.dimension === "group") query.set("id", "ungrouped");
  else if (selected.dimension === "milestone") query.set("id", "unassigned");
  if (selected.milestoneTaskId !== undefined)
    query.set("milestoneTaskId", selected.milestoneTaskId ?? "unassigned");
  if (selected.resourceId !== undefined)
    query.set("resourceId", selected.resourceId);
  query.set("assignmentScope", selected.assignmentScope ?? "selected");
  query.set("view", view);
  query.set("offset", String(offset));
  query.set("limit", "50");
  return query;
}
export function readDetails(
  body: unknown,
  data: ResourceDashboardDto,
  selected: ResourceDashboardSelector,
  view: "tasks" | "assignments",
  offset: number,
): ResourceDashboardDetailsDto | null {
  const parsed = z.object({ data: detail }).safeParse(body);
  if (!parsed.success) return null;
  const value = parsed.data.data;
  if (
    [
      "projectPublicId",
      "projectRevision",
      "catalogRevision",
      "calendarRevision",
      "snapshotId",
    ].some(
      (key) =>
        value[key as keyof typeof value] !== data[key as keyof typeof data],
    ) ||
    !sameSelector(value.selector, selected) ||
    value.view !== view ||
    value.offset !== offset ||
    value.limit !== 50 ||
    (view === "assignments" &&
      value.rows.some((row) => row.assignment === null))
  )
    return null;
  return value as ResourceDashboardDetailsDto;
}
export function plannedEffort(
  effort: ResourceDashboardDto["summary"]["effort"],
  unit: "md" | "mm",
): string {
  if (effort.state === "unset") return "산정 불가 · 공수 미설정";
  if (effort.state === "empty") return "할당 없음";
  const amount = unit === "md" ? effort.plannedMd : effort.plannedMm;
  return `${amount === null ? "—" : amount.toFixed(2)} ${unit === "md" ? "M/D" : "M/M"}${effort.partial ? " · 알려진 부분합" : ""}`;
}

export function sameSelector(
  a: ResourceDashboardSelector,
  b: ResourceDashboardSelector,
): boolean {
  return (
    a.dimension === b.dimension &&
    a.id === b.id &&
    a.metric === b.metric &&
    a.milestoneTaskId === b.milestoneTaskId &&
    a.resourceId === b.resourceId &&
    (a.assignmentScope ?? "selected") === (b.assignmentScope ?? "selected")
  );
}
const children = z.object({
  resourceDataContext: resourceDataContextSchema.optional(),
  ...revisions,
  groupId: z.string().nullable(),
  milestoneTaskId: z.string().nullable().optional(),
  filters,
  range: z.object({ from: date, to: date }),
  asOfDate: date,
  mdPerMm: finite.nullable(),
  mdPerMmSource: z.enum(["query", "environment", "unset"]),
  summary,
  offset: count,
  limit: count,
  totalCount: count,
  nextOffset: count.nullable(),
  rows: z.array(row),
});
export function groupChildrenQuery(
  data: ResourceDashboardDto,
  groupId: string | null,
  milestoneTaskId: string | null | undefined,
  offset: number,
): URLSearchParams {
  const query = detailsQuery(
    data,
    { dimension: "group", id: groupId, metric: "all" },
    "assignments",
    offset,
  );
  for (const key of ["dimension", "id", "metric", "view", "assignmentScope"])
    query.delete(key);
  query.set("groupId", groupId ?? "ungrouped");
  if (milestoneTaskId !== undefined)
    query.set("milestoneTaskId", milestoneTaskId ?? "unassigned");
  return query;
}
export function readGroupChildren(
  body: unknown,
  data: ResourceDashboardDto,
  groupId: string | null,
  milestoneTaskId: string | null | undefined,
  offset: number,
): ResourceDashboardGroupChildrenDto | null {
  const parsed = z.object({ data: children }).safeParse(body);
  if (!parsed.success) return null;
  const v = parsed.data.data;
  const sameFilters = Object.keys(data.filters).every(
    (key) =>
      JSON.stringify(v.filters[key as keyof typeof v.filters]) ===
      JSON.stringify(data.filters[key as keyof typeof data.filters]),
  );
  if (
    [
      "projectPublicId",
      "projectRevision",
      "catalogRevision",
      "calendarRevision",
      "snapshotId",
      "asOfDate",
      "mdPerMm",
      "mdPerMmSource",
    ].some(
      (key) => v[key as keyof typeof v] !== data[key as keyof typeof data],
    ) ||
    !sameFilters ||
    v.range.from !== data.range.from ||
    v.range.to !== data.range.to ||
    v.groupId !== groupId ||
    v.milestoneTaskId !== milestoneTaskId ||
    v.offset !== offset ||
    v.limit !== 50 ||
    v.rows.length > 50 ||
    v.rows.some(
      (r) =>
        r.id === null ||
        r.summary.selector.dimension !== "group" ||
        r.summary.selector.id !== groupId ||
        r.summary.selector.resourceId !== r.id,
    )
  )
    return null;
  return v as ResourceDashboardGroupChildrenDto;
}
export function orderedMilestones(
  data: ResourceDashboardDto,
): { id: string | null; name: string; date: string | null }[] {
  const stages: { id: string | null; name: string; date: string | null }[] = [
    ...data.stages,
  ]
    .sort(
      (a, b) =>
        (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999") ||
        a.milestoneTaskId.localeCompare(b.milestoneTaskId),
    )
    .map((s) => ({
      id: s.milestoneTaskId,
      name: s.name,
      date: s.scheduledDate,
    }));
  return [...stages, { id: null, name: "Milestone 미지정", date: null }];
}
