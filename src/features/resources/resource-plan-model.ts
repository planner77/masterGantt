import { z } from "zod";
import type {
  ResourceDashboardDto,
  ResourcePlanDetailsDto,
  ResourcePlanDetailInput,
  ResourcePlanDetailKind,
} from "@/contracts/resource-dashboard";
import type {
  ResourcePlanMetrics,
  ResourcePlanRowSelector,
  ResourcePlanSeries,
} from "@/domain/resources/resource-plan";
const n = z.number().finite().nonnegative(),
  nullable = n.nullable(),
  id = z.string(),
  date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const planMetricsSchema = z.object({
  capacityMd: n,
  knownMd: n,
  plannedMd: nullable,
  plannedMm: nullable,
  state: z.enum(["empty", "configured", "partial", "unset"]),
  partial: z.boolean(),
  assignmentCount: n,
  unknownAssignmentCount: n,
  unknownResourceDayCount: n,
  loadPercent: nullable,
  knownLoadPercent: nullable,
  peakDailyLoadPercent: nullable,
  peakResourceDailyLoadPercent: nullable,
  knownPeakDailyLoadPercent: nullable,
  knownPeakResourceDailyLoadPercent: nullable,
  overAllocatedDayCount: n,
  overAllocatedResourceDayCount: n,
  overAllocatedResourceCount: n,
  excessMd: n,
});
const pair = z.object({
    selected: planMetricsSchema,
    project: planMetricsSchema,
  }),
  series = z.object({
    summary: pair,
    cells: z.array(pair.extend({ periodKey: id })),
  });
const person = {
  name: id,
  code: id.nullable(),
  active: z.boolean(),
  groupIds: z.array(id),
  roles: z.array(id),
  developerGrade: id.nullable(),
};
export const resourcePlanSchema = z.object({
  granularity: z.enum(["week", "month"]),
  from: date,
  to: date,
  asOfDate: date,
  mdPerMm: nullable,
  periods: z.array(
    z.object({
      key: id,
      label: id,
      from: date,
      to: date,
      year: n,
      week: n.optional(),
      month: n.optional(),
      partial: z.boolean(),
    }),
  ),
  population: z.object({
    resourceIds: z.array(id),
    resourceCount: n,
    capacityBasis: z.literal("effective-working-day-1MD"),
  }),
  totals: series,
  resources: z.array(
    series.extend({
      resourceId: id,
      ...person,
      milestones: z.array(
        series.extend({
          milestoneTaskId: id.nullable(),
          name: id,
          scheduledDate: date.nullable(),
          capacityReferenceOnly: z.literal(true),
          projectReferenceOnly: z.literal(true),
          projectReferenceRow: z.object({
            kind: z.literal("resource"),
            resourceId: id,
          }),
        }),
      ),
    }),
  ),
  groups: z.array(
    series.extend({
      groupId: id.nullable(),
      name: id,
      code: id.nullable(),
      active: z.boolean(),
      resourceIds: z.array(id),
    }),
  ),
  metadata: z.object({
    groupSubtotalsAdditive: z.literal(false),
    milestoneCapacityAdditive: z.literal(false),
    projectScope: z.literal("current-project-same-resources"),
    overloadTolerance: n,
    limits: z.record(id, n),
    populationScope: z.literal(
      "ordinary-task-personal-assignment-history-classification-only",
    ),
    groupDisplayScope: z.literal("selected-group-and-activity"),
  }),
});
export type PlanRow = {
  key: string;
  name: string;
  selector: ResourcePlanRowSelector;
  series: ResourcePlanSeries;
  level: number;
  description?: string;
  context?: string[];
  parentResource?: ResourcePlanSeries;
  expandable: boolean;
};
export function flattenPlanRows(
  plan: NonNullable<ResourceDashboardDto["plan"]>,
  mode: "group" | "resource",
  expanded: Set<string>,
): PlanRow[] {
  const result: PlanRow[] = [],
    byId = new Map(plan.resources.map((r) => [r.resourceId, r]));
  const resource = (
    r: (typeof plan.resources)[number],
    prefix: string,
    level: number,
    context: string[] = [],
  ) => {
    const key = `${prefix}:resource:${r.resourceId}`;
    result.push({
      key,
      name: r.name,
      selector: { kind: "resource", resourceId: r.resourceId },
      series: r,
      level,
      context,
      description: `${r.code ?? "코드 미지정"} · ${r.active ? "활성" : "비활성"} · ${r.roles.join(", ") || "Role 미지정"} · ${r.developerGrade ?? "등급 미지정"}`,
      expandable: r.milestones.length > 0,
    });
    if (expanded.has(key))
      for (const m of [...r.milestones].sort((a, b) =>
        a.milestoneTaskId === null
          ? 1
          : b.milestoneTaskId === null
            ? -1
            : (a.scheduledDate ?? "9999").localeCompare(
                b.scheduledDate ?? "9999",
              ) || a.milestoneTaskId.localeCompare(b.milestoneTaskId),
      ))
        result.push({
          key: `${key}:milestone:${m.milestoneTaskId ?? "unassigned"}`,
          name: m.name,
          selector: {
            kind: "resourceMilestone",
            resourceId: r.resourceId,
            milestoneTaskId: m.milestoneTaskId,
          },
          series: m,
          context: [...context, r.name],
          parentResource: r,
          level: level + 1,
          expandable: false,
        });
  };
  if (mode === "resource")
    plan.resources.forEach((r) => resource(r, "personal", 0));
  else
    for (const g of plan.groups) {
      const key = `group:${g.groupId ?? "ungrouped"}`;
      result.push({
        key,
        name: g.name,
        selector: { kind: "group", groupId: g.groupId },
        series: g,
        level: 0,
        description: `${g.code ?? "코드 미지정"} · ${g.active ? "활성" : "비활성"}`,
        expandable: g.resourceIds.length > 0,
      });
      if (expanded.has(key))
        g.resourceIds.forEach((id) => {
          const r = byId.get(id);
          if (r) resource(r, key, 1, [g.name]);
        });
    }
  return result;
}
export function planMetric(
  m: ResourcePlanMetrics,
  metric: "effort" | "load" | "excess",
  unit: "md" | "mm",
): string {
  const value =
    metric === "effort"
      ? unit === "md"
        ? m.plannedMd
        : m.plannedMm
      : metric === "load"
        ? m.loadPercent
        : m.excessMd;
  const text =
    value === null
      ? "미산정"
      : `${value.toFixed(2)} ${metric === "load" ? "%" : metric === "excess" || unit === "md" ? "M/D" : "M/M"}`;
  return `${text}${m.partial ? " · 미설정 포함" : ""}${m.capacityMd === 0 ? " · 비근무기간" : m.state === "empty" ? " · 기간 배정 없음(0부하)" : ""}`;
}
export function planDetailQuery(
  data: ResourceDashboardDto,
  input: ResourcePlanDetailInput,
): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(data.filters)) {
    if (
      key === "mdPerMmProvided" ||
      key === "granularity" ||
      (!data.filters.mdPerMmProvided && key === "mdPerMm") ||
      value === null ||
      value === "" ||
      value === undefined
    )
      continue;
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(","));
    } else query.set(key, String(value));
  }
  if (data.filters.mdPerMmProvided && data.filters.mdPerMm === null)
    query.set("mdPerMm", "null");
  query.set("snapshotId", data.snapshotId);
  query.set("granularity", input.granularity);
  query.set("periodId", input.periodId);
  query.set("row", input.selector.kind);
  query.set("demandScope", input.demandScope);
  query.set("offset", String(input.offset));
  query.set("limit", String(input.limit));
  const s = input.selector;
  if (s.kind === "group") query.set("groupId", s.groupId ?? "ungrouped");
  if (s.kind === "resource" || s.kind === "resourceMilestone")
    query.set("resourceId", s.resourceId);
  if (s.kind === "resourceMilestone")
    query.set("milestoneTaskId", s.milestoneTaskId ?? "unassigned");
  if (input.date) query.set("date", input.date);
  return query;
}
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );
export function readPlanDetails(
  body: unknown,
  data: ResourceDashboardDto,
  input: ResourcePlanDetailInput,
  kind: ResourcePlanDetailKind,
): ResourcePlanDetailsDto | null {
  const selector = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("total") }),
    z.object({ kind: z.literal("group"), groupId: id.nullable() }),
    z.object({ kind: z.literal("resource"), resourceId: id }),
    z.object({
      kind: z.literal("resourceMilestone"),
      resourceId: id,
      milestoneTaskId: id.nullable(),
    }),
  ]);
  const assignment = z.object({
    assignmentId: id,
    taskId: id,
    resourceId: id,
    milestoneTaskId: id.nullable(),
    date,
    allocationPercent: nullable,
    working: z.boolean(),
    knownMd: n,
    plannedMd: nullable,
    taskName: id,
    externalId: id,
    taskStart: date.nullable(),
    taskEnd: date.nullable(),
    assignmentStart: date.nullable(),
    assignmentEnd: date.nullable(),
    milestoneName: id,
    wbsPath: z.array(z.object({ taskId: id, name: id })),
  });
  const parsed = z
    .object({
      data: z.object({
        schema: z.literal("resource-dashboard/1"),
        projectPublicId: id,
        projectRevision: n,
        catalogRevision: n,
        calendarRevision: id,
        snapshotId: id,
        filters: z.record(id, z.unknown()),
        range: z.object({ from: date, to: date }),
        asOfDate: date,
        mdPerMm: nullable,
        mdPerMmSource: z.enum(["query", "environment", "unset"]),
        granularity: z.enum(["week", "month"]),
        periodId: id,
        selector,
        demandScope: z.enum(["selected", "project"]),
        date: date.optional(),
        offset: n,
        limit: n,
        totalCount: n,
        nextOffset: nullable,
        view: z.literal(kind),
        rows: z.array(
          kind === "daily"
            ? z.object({ date, metrics: planMetricsSchema })
            : kind === "day-resources"
              ? z.object({
                  resourceId: id,
                  date,
                  metrics: planMetricsSchema,
                  ...person,
                })
              : assignment,
        ),
      }),
    })
    .safeParse(body);
  if (!parsed.success) return null;
  const value = parsed.data.data;
  for (const key of [
    "schema",
    "projectPublicId",
    "projectRevision",
    "catalogRevision",
    "calendarRevision",
    "snapshotId",
    "asOfDate",
    "mdPerMm",
    "mdPerMmSource",
  ] as const)
    if (value[key] !== data[key]) return null;
  if (
    canonical(value.filters) !== canonical(data.filters) ||
    canonical(value.range) !== canonical(data.range) ||
    canonical(value.selector) !== canonical(input.selector) ||
    value.granularity !== input.granularity ||
    value.periodId !== input.periodId ||
    value.demandScope !== input.demandScope ||
    value.date !== input.date ||
    value.offset !== input.offset ||
    value.limit !== input.limit ||
    value.rows.length > input.limit ||
    value.offset > value.totalCount ||
    value.nextOffset !==
      (value.offset + value.limit < value.totalCount
        ? value.offset + value.limit
        : null)
  )
    return null;
  const period =
    input.periodId === "all"
      ? data.range
      : data.plan?.periods.find((p) => p.key === input.periodId);
  if (!period) return null;
  if (
    value.rows.some(
      (r) =>
        r.date < period.from ||
        r.date > period.to ||
        (input.date && r.date !== input.date),
    )
  )
    return null;
  if (
    kind === "day-assignments" &&
    value.rows.some(
      (r) =>
        "resourceId" in r &&
        (input.selector.kind === "resource" ||
          input.selector.kind === "resourceMilestone") &&
        r.resourceId !== input.selector.resourceId,
    )
  )
    return null;
  if (
    !data.plan ||
    data.plan.granularity !== input.granularity ||
    value.rows.length !== Math.min(input.limit, value.totalCount - input.offset)
  )
    return null;
  const keys = value.rows.map((r) =>
    "assignmentId" in r
      ? r.assignmentId
      : "resourceId" in r
        ? r.resourceId
        : r.date,
  );
  if (new Set(keys).size !== keys.length) return null;
  const requestedSelector = input.selector;
  if (kind === "day-resources") {
    const allowed =
      requestedSelector.kind === "group"
        ? data.plan.groups.find((g) => g.groupId === requestedSelector.groupId)
            ?.resourceIds
        : data.plan.population.resourceIds;
    if (
      !allowed ||
      value.totalCount !== allowed.length ||
      value.rows.some(
        (r) => "resourceId" in r && !allowed.includes(r.resourceId),
      )
    )
      return null;
  }
  if (
    kind === "day-assignments" &&
    requestedSelector.kind === "resourceMilestone" &&
    value.rows.some(
      (r) =>
        "milestoneTaskId" in r &&
        r.milestoneTaskId !== requestedSelector.milestoneTaskId,
    )
  )
    return null;
  return value as unknown as ResourcePlanDetailsDto;
}
