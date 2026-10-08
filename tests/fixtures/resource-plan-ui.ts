import type {
  ResourceDashboardDto,
  ResourcePlanDetailsDto,
  ResourcePlanDetailKind,
} from "../../src/contracts/resource-dashboard";
import { RESOURCE_PLAN_LIMITS } from "../../src/contracts/resource-dashboard";
import {
  calculateResourcePlan,
  getResourcePlanDailyPage,
  getResourcePlanDayResources,
  getResourcePlanDayAssignments,
  type ResourcePlanInput,
} from "../../src/domain/resources/resource-plan";
import { createWorkingCalendar } from "../../src/domain/scheduling/calendar";
import { parseResourcePlanDetails } from "../../src/server/resources/resource-dashboard-query-core";
import { resourceDashboardUiFixture } from "./resource-dashboard-ui";
import type { StatefulProjectFixture } from "./stateful-project";
export const planId = (kind: number, n: number) =>
  `00005270-0000-4000-8${kind}00-${String(n).padStart(12, "0")}`;
export function planUiFixture(
  state: StatefulProjectFixture,
  query: URLSearchParams,
): { data: ResourceDashboardDto; input: ResourcePlanInput } {
  const data = resourceDashboardUiFixture(state, query),
    from = data.filters.from ?? "2023-12-31",
    to = data.filters.to ?? "2024-12-30",
    granularity = data.filters.granularity ?? "week",
    asOfDate = data.filters.asOfDate ?? "2024-12-30";
  data.range = { from, to };
  data.asOfDate = asOfDate;
  const resourceCount = granularity === "week" ? 8 : 24,
    groupCount = granularity === "week" ? 4 : 12;
  const resources = Array.from({ length: resourceCount }, (_, i) => ({
    resourceId: planId(1, i),
    name: `개인 ${i} 긴 한국어 English resource identity `
      .repeat(8)
      .slice(0, 200),
    code: `RESOURCE-${i}`,
    groupIds:
      i === 0 || granularity === "week"
        ? Array.from({ length: groupCount }, (_, g) => planId(2, g))
        : [planId(2, 0)],
    roles: ["DEVELOPER"],
    developerGrade: "ADVANCED",
  }));
  const assignments = resources.slice(0, resourceCount - 1).flatMap((r, i) =>
    [80, 60].map((percent, j) => ({
      projectPublicId: state.project.publicId,
      assignmentId: planId(3, i * 2 + j),
      taskId: j === 0 ? state.tasks[2].taskId : planId(5, 1),
      resourceId: r.resourceId,
      milestoneTaskId: planId(4, j),
      groupIds: r.groupIds,
      roles: r.roles,
      from,
      to,
      allocationPercent:
        i === 3 ? null : i > 0 ? (j === 0 ? 50 : null) : percent,
      effectiveWorkingDays: 0,
      plannedMd: null,
      plannedMm: null,
    })),
  );
  const eligible = resources.filter(
    (r) =>
      (!data.filters.roles.length ||
        data.filters.roles.some((role) => r.roles.includes(role))) &&
      (!data.filters.developerGrades.length ||
        data.filters.developerGrades.includes("ADVANCED")) &&
      data.filters.resourceActivity !== "inactive",
  );
  const eligibleIds = new Set(eligible.map((r) => r.resourceId));
  const fullAssignments = assignments.filter((a) =>
    eligibleIds.has(a.resourceId),
  );
  const input: ResourcePlanInput = {
    projectPublicId: state.project.publicId,
    from,
    to,
    asOfDate,
    granularity,
    mdPerMm: data.mdPerMm,
    projectCalendar: createWorkingCalendar({
      timezone: "Asia/Seoul",
      weekendDays: [6, 0],
      holidays: [],
    }),
    resources,
    capacityResourceIds: eligible.map((r) => r.resourceId),
    fullProjectAssignments: fullAssignments,
    selectedAssignments: fullAssignments.filter(
      (a) =>
        !data.filters.milestoneIds.length ||
        data.filters.milestoneIds.includes(a.milestoneTaskId),
    ),
    limits: RESOURCE_PLAN_LIMITS,
  };
  const plan = calculateResourcePlan(input);
  data.plan = {
    ...plan,
    resources: plan.resources.map((r) => ({
      ...r,
      ...resources.find((p) => p.resourceId === r.resourceId)!,
      active: true,
      roles: ["DEVELOPER"],
      developerGrade: "ADVANCED",
      milestones: r.milestones.map((m) => ({
        ...m,
        name: `${m.milestoneTaskId === planId(4, 0) ? "선택 단계" : "다른 단계"} 긴 Milestone identity `.repeat(
          5,
        ),
        scheduledDate: "2024-12-01",
      })),
    })),
    groups: plan.groups.map((g, i) => ({
      ...g,
      name: `그룹 ${i} 긴 한국어 English group identity `
        .repeat(8)
        .slice(0, 200),
      code: `GROUP-${i}`,
      active: true,
    })),
    metadata: {
      ...plan.metadata,
      limits: RESOURCE_PLAN_LIMITS,
      populationScope:
        "ordinary-task-personal-assignment-history-classification-only",
      groupDisplayScope: "selected-group-and-activity",
    },
  };
  const m = plan.totals.summary.selected;
  const selectedTaskIds = new Set(
    input.selectedAssignments.map((a) => a.taskId),
  );
  data.summary = {
    ...data.summary,
    taskCount: selectedTaskIds.size,
    resourceCount: new Set(input.selectedAssignments.map((a) => a.resourceId))
      .size,
    assignmentCount: m.assignmentCount,
    notStarted: 0,
    inProgress: selectedTaskIds.size,
    completed: 0,
    delayed: 0,
    completion: {
      numerator: 0,
      denominator: selectedTaskIds.size,
      percent: selectedTaskIds.size ? 0 : null,
    },
    assignedTaskProgress: {
      numerator: selectedTaskIds.size * 25,
      denominator: selectedTaskIds.size,
      percent: selectedTaskIds.size ? 25 : null,
    },
    effort: {
      knownMd: m.knownMd,
      plannedMd: m.plannedMd,
      plannedMm: m.plannedMm,
      state: m.state,
      partial: m.partial,
      unsetCount: m.unknownAssignmentCount,
    },
  };
  data.catalog.resources = data.plan.resources.map((r) => ({
    id: r.resourceId,
    name: r.name,
    code: r.code,
    active: r.active,
    groupIds: r.groupIds,
    roles: r.roles,
    developerGrade: r.developerGrade,
  }));
  data.catalog.groups = data.plan.groups.map((g) => ({
    id: g.groupId!,
    name: g.name,
    code: g.code,
    active: g.active,
  }));
  data.catalog.milestones = [0, 1].map((i) => ({
    id: planId(4, i),
    name: i === 0 ? "선택 단계" : "다른 단계",
  }));
  return { data, input };
}
export function planDetailsUiFixture(
  state: StatefulProjectFixture,
  query: URLSearchParams,
  kind: ResourcePlanDetailKind,
): ResourcePlanDetailsDto {
  const { filter, detail } = parseResourcePlanDetails(query, kind),
    filters = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined)
      filters.set(
        k,
        Array.isArray(v) ? v.join(",") : v === null ? "null" : String(v),
      );
  }
  const { data, input } = planUiFixture(state, filters),
    context = {
      ...detail,
      schema: data.schema,
      projectPublicId: data.projectPublicId,
      projectRevision: data.projectRevision,
      catalogRevision: data.catalogRevision,
      calendarRevision: data.calendarRevision,
      filters: data.filters,
      range: data.range,
      asOfDate: data.asOfDate,
      mdPerMm: data.mdPerMm,
      mdPerMmSource: data.mdPerMmSource,
    };
  if (kind === "daily")
    return {
      ...context,
      view: kind,
      ...getResourcePlanDailyPage(
        input,
        {
          row: detail.selector,
          periodKey: detail.periodId,
          demandScope: detail.demandScope,
        },
        detail,
      ),
    };
  if (kind === "day-resources") {
    if (detail.selector.kind !== "group" && detail.selector.kind !== "total")
      throw Error("Invalid group fixture selector");
    const page = getResourcePlanDayResources(
      input,
      {
        row: detail.selector,
        date: detail.date!,
        demandScope: detail.demandScope,
      },
      detail,
    );
    return {
      ...context,
      view: kind,
      ...page,
      rows: page.rows.map((r) => ({
        ...r,
        ...data.plan!.resources.find((p) => p.resourceId === r.resourceId)!,
      })),
    };
  }
  const page = getResourcePlanDayAssignments(
    input,
    {
      row: detail.selector,
      date: detail.date!,
      demandScope: detail.demandScope,
    },
    detail,
  );
  return {
    ...context,
    view: kind,
    ...page,
    rows: page.rows.map((r) => ({
      ...r,
      taskName:
        r.milestoneTaskId === planId(4, 0)
          ? state.tasks[2].name
          : "다른 단계 작업",
      externalId:
        r.milestoneTaskId === planId(4, 0)
          ? state.tasks[2].externalId
          : "PLAN-M2",
      taskStart: fromDate(input),
      taskEnd: input.to,
      assignmentStart: null,
      assignmentEnd: null,
      milestoneName:
        r.milestoneTaskId === planId(4, 0) ? "선택 단계" : "다른 단계",
      wbsPath: [{ taskId: state.tasks[2].taskId, name: state.tasks[2].name }],
    })),
  };
}
const fromDate = (input: ResourcePlanInput) => input.from;
