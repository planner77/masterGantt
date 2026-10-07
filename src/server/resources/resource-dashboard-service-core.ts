import { resourceFingerprint as fingerprint, readResourceDataSnapshot } from "./resource-data-context-core";
import type { ResourceDrillQueryInput, ResourceDrillQueryResponse, ResourceDrillScope, ResourceDrillScopeDto, ResourceDrillScopeRequest, ResourceDrillSourceContext, ResourceDrillSourceProjection } from "../../contracts/resource-drill";
import { parseResourceDrillQuery } from "./resource-drill-query-core";
import { resolveMdPerMm } from "../../domain/resources/md-per-mm";
import type Database from "better-sqlite3";
import type { ResourceDashboardDetailInput, ResourceDashboardDetailRow, ResourceDashboardDetailsDto, ResourceDashboardDto, ResourceDashboardFilterInput, ResourceDashboardSelector, ResourceDashboardSummary, ResourceDashboardGroupChildrenInput, ResourceDashboardGroupChildrenDto } from "../../contracts/resource-dashboard";
import { RESOURCE_DASHBOARD_LIMITS as LIMITS } from "../../contracts/resource-dashboard";
import type { ResourceWorkloadRole } from "../../contracts/resources";
import { prepareResourceKpiSnapshot, selectResourceKpiAssignments, summarizeResourceKpiAssignments, renderResourceKpi, getResourceKpiDiagnostics, assertResourceKpiProjectionBudget, ResourceKpiProjectionLimitError, type ResourceKpiAssignmentRow, type ResourceKpiTotals } from "../../domain/resources/resource-kpi";
import { mdPerMmSource } from "../../domain/resources/md-per-mm";
import { dateToOrdinal } from "../../domain/scheduling/date-only";
import { loadResourceCalendarExceptions } from "../calendars/calendar-resolution-core";
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { normalizeResourceDashboardFilters, parseResourceDashboardDetails, parseResourceDashboardGroupChildren } from "./resource-dashboard-query-core";
import type { ResourcePlanDetailInput, ResourcePlanDetailKind, ResourcePlanDetailsDto, ResourceDashboardPlanDto, ResourcePlanPersonMetadata, ResourcePlanRowSelector } from "../../contracts/resource-dashboard";
import { RESOURCE_PLAN_LIMITS } from "../../contracts/resource-dashboard";
import { calculateResourcePlan, getResourcePlanDailyPage, getResourcePlanDayResources, getResourcePlanDayAssignments, buildResourcePlanPeriods, ResourcePlanLimitError, type ResourcePlanInput } from "../../domain/resources/resource-plan";
import { parseResourcePlanDetails } from "./resource-dashboard-query-core";

export function resourceDashboardLimit(kind: string): never {
  const guidance = kind.startsWith("plan.") ? kind === "plan.bytes" ? "조회 기간·개인 분류 범위를 줄이거나 월별로 조회해 주세요." : kind === "plan.matrixCells" ? "월별로 전환하거나 조회 기간·개인 분류 범위를 줄여 주세요." : "조회 기간 또는 Resource·Group·역할·등급·활성 조건의 개인 범위를 줄여 주세요. Task·Milestone·검색 조건만으로 전체 부하 계산 범위를 줄일 수 없습니다." : kind === "range.days" ? "조회 기간을 366일 이하로 줄여 주세요." : kind.startsWith("projection.") ? "개인·Group·Milestone 선택 범위를 줄여 주세요." : kind === "detail.bytes" ? "상세 page 크기를 줄여 주세요." : "프로젝트의 Task·관계·Group 소속 범위를 정리하거나 프로젝트를 분리해 주세요. 전체 snapshot 한도는 조회 필터로 우회할 수 없습니다.";
  throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", `${kind} 조회 한도를 초과했습니다. ${guidance}`, [{ path: kind, code: "REPORT_LIMIT_EXCEEDED", message: kind }]);
}
export function assertResourcePlanResponseBytes(value: unknown, kind = "plan.bytes", maxBytes = LIMITS.reportBytes): void {
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) resourceDashboardLimit(kind);
}
function planCall<T>(call: () => T): T {
  try { return call(); } catch (error) { if (error instanceof ResourcePlanLimitError) resourceDashboardLimit(`plan.${error.dimension}`); throw error; }
}
const invalidSelection: () => never = () => { throw new PublicApiError(400, "INVALID_SELECTION", "현재 프로젝트에 연결된 조회 대상을 다시 선택해 주세요."); };
const stale = (): never => { throw new PublicApiError(409, "REPORT_STALE", "기준 데이터 또는 조회 범위가 변경되었습니다. 대시보드를 다시 조회해 주세요."); };
function compact(value: ResourceKpiTotals, selector: ResourceDashboardSelector): ResourceDashboardSummary {
  return { taskCount: value.taskCount, resourceCount: value.resourceCount, assignmentCount: value.assignmentCount,
    notStarted: value.notStarted.count, inProgress: value.inProgress.count, completed: value.completed.count, delayed: value.delayed.count,
    completion: { numerator: value.completion.numerator, denominator: value.completion.denominator, percent: value.completion.percent },
    assignedTaskProgress: { numerator: value.assignedTaskProgress.numerator, denominator: value.assignedTaskProgress.denominator, percent: value.assignedTaskProgress.percent },
    effort: { knownMd: value.effort.knownMd, plannedMd: value.effort.plannedMd, plannedMm: value.effort.plannedMm, state: value.effort.state, partial: value.effort.partial, unsetCount: value.effort.unsetCount }, selector: { assignmentScope: "selected", ...selector } };
}
function localDate(now: Date): string {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function assignmentRangeOf(rows: readonly ResourceKpiAssignmentRow[]) {
  return rows.length ? { from: rows.map((row) => row.from).sort()[0], to: rows.map((row) => row.to).sort().at(-1)! } : null;
}
function milestoneOrder(snapshot: { taskById: Map<string, { startDate: string | null }> }, a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (snapshot.taskById.get(a)?.startDate ?? "9999").localeCompare(snapshot.taskById.get(b)?.startDate ?? "9999") || a.localeCompare(b);
}

export class ResourceDashboardService {
  constructor(private readonly database: Database.Database, private readonly options: { clock?: () => Date; mdPerMmEnvironment?: string } = {}) {}
  getDashboard(publicId: string, filter: ResourceDashboardFilterInput = {}, scope?: ResourceDrillScope): ResourceDashboardDto | undefined {
    return this.database.transaction(() => this.calculate(publicId, filter, scope)?.report)();
  }
  getPlanDetails(publicId: string, filter: ResourceDashboardFilterInput, input: ResourcePlanDetailInput, kind: ResourcePlanDetailKind, scope?: ResourceDrillScope): ResourcePlanDetailsDto | undefined {
    // Reparse programmatic requests using the same route allowlist and scalar constraints.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined || (Array.isArray(value) && !value.length)) continue;
      params.set(key, Array.isArray(value) ? value.join(",") : value === null ? "null" : String(value));
    }
    params.set("granularity", input.granularity);
    for (const key of ["snapshotId", "periodId", "demandScope", "offset", "limit"] as const) params.set(key, String(input[key]));
    params.set("row", input.selector.kind);
    if (input.selector.kind === "group") params.set("groupId", input.selector.groupId ?? "ungrouped");
    if (input.selector.kind === "resource" || input.selector.kind === "resourceMilestone") params.set("resourceId", input.selector.resourceId);
    if (input.selector.kind === "resourceMilestone") params.set("milestoneTaskId", input.selector.milestoneTaskId ?? "unassigned");
    if (input.date !== undefined) params.set("date", input.date);
    const checked = parseResourcePlanDetails(params, kind);
    return this.database.transaction(() => {
      let calculated: ReturnType<ResourceDashboardService["prepareAndSelect"]>;
      try { calculated = this.prepareAndSelect(publicId, checked.filter, checked.detail.snapshotId, scope); }
      catch (error) { if (error instanceof PublicApiError && error.code === "INVALID_SELECTION") stale(); throw error; }
      if (!calculated) return undefined;
      const { snapshot } = calculated, detail = checked.detail, plan = this.planInput(calculated);
      const periods = buildResourcePlanPeriods(snapshot.from, snapshot.to, detail.granularity);
      const period = detail.periodId === "all" ? { from: snapshot.from, to: snapshot.to } : periods.find((row) => row.key === detail.periodId);
      if (!period || (detail.date !== undefined && (detail.date < period.from || detail.date > period.to))) invalidSelection();
      this.validatePlanRow(snapshot, plan, detail.selector);
      const page = { offset: detail.offset, limit: detail.limit };
      const context = { resourceDataContext: snapshot.dataContext, schema: "resource-dashboard/1" as const, ...detail, projectPublicId: publicId, projectRevision: snapshot.project.revision,
        catalogRevision: snapshot.catalogRevision, calendarRevision: snapshot.calendarRevision, filters: snapshot.filters, range: { from: snapshot.from, to: snapshot.to },
        asOfDate: snapshot.asOfDate, mdPerMm: snapshot.domain.mdPerMm, mdPerMmSource: snapshot.mdPerMmSource };
      let result: ResourcePlanDetailsDto;
      if (kind === "daily") result = { ...context, view: kind, ...planCall(() => getResourcePlanDailyPage(plan, { row: detail.selector, periodKey: detail.periodId, demandScope: detail.demandScope }, page)) };
      else if (kind === "day-resources") {
        const row = detail.selector;
        if (row.kind !== "total" && row.kind !== "group") invalidSelection();
        const data = planCall(() => getResourcePlanDayResources(plan, { row, date: detail.date!, demandScope: detail.demandScope }, page));
        result = { ...context, view: kind, ...data, rows: data.rows.map((row) => ({ ...row, ...this.planPerson(snapshot, row.resourceId) })) };
      } else {
        const data = planCall(() => getResourcePlanDayAssignments(plan, { row: detail.selector, date: detail.date!, demandScope: detail.demandScope }, page));
        result = { ...context, view: kind, ...data, rows: data.rows.map((row) => {
          const task = snapshot.taskById.get(row.taskId)!, assignment = snapshot.assignmentById.get(row.assignmentId)!;
          return { ...row, taskName: task.name, externalId: task.externalId, taskStart: task.startDate, taskEnd: task.endDate,
            assignmentStart: assignment.assignmentStart, assignmentEnd: assignment.assignmentEnd, milestoneName: row.milestoneTaskId === null ? "Milestone 미지정" : snapshot.taskById.get(row.milestoneTaskId)!.name, wbsPath: snapshot.paths.get(row.taskId)! };
        }) };
      }
      assertResourcePlanResponseBytes({ data: result }, "detail.bytes");
      return result;
    })();
  }
  private sourceContext(snapshot: NonNullable<ReturnType<ResourceDashboardService["prepareSnapshot"]>>, sourceProjection: ResourceDrillSourceProjection): ResourceDrillSourceContext {
    return { ...snapshot.dataContext, range: { from: snapshot.from, to: snapshot.to }, asOfDate: snapshot.asOfDate, mdPerMm: snapshot.domain.mdPerMm,
      mdPerMmSource: snapshot.mdPerMmSource, mdPerMmProvided: snapshot.filters.mdPerMmProvided, sourceProjection };
  }
  private resolveRestriction(snapshot: NonNullable<ReturnType<ResourceDashboardService["prepareSnapshot"]>>, scope: ResourceDrillScope) {
    const tasks = new Set<string>();
    if (scope.kind === "exactAssignments") {
      const assignments = new Set(scope.assignmentIds);
      for (const id of assignments) { const row = snapshot.assignmentById.get(id); if (!row || row.kind !== "resource" || snapshot.taskById.get(row.taskPublicId)?.type !== "task") invalidSelection(); tasks.add(row.taskPublicId); }
      return { tasks, assignments };
    }
    const nodeIds = scope.kind === "summarySubtree" ? [scope.rootId] : scope.nodeIds;
    for (const id of nodeIds) { const row = snapshot.taskById.get(id); if (!row || row.type === "milestone" || (scope.kind === "summarySubtree" && row.type !== "summary")) invalidSelection(); }
    const nodes = new Set(nodeIds);
    for (const task of snapshot.storedTasks) if (task.type === "task" && snapshot.paths.get(task.publicId)!.some((entry) => nodes.has(entry.taskId))) tasks.add(task.publicId);
    return { tasks, assignments: undefined };
  }
  getScope(publicId: string, input: ResourceDrillScopeRequest, scope?: ResourceDrillScope) {
    return this.database.transaction(() => {
      if (input.view === "context") return readResourceDataSnapshot(this.database, publicId)?.context;
      let calculated: ReturnType<ResourceDashboardService["prepareAndSelect"]>;
      try { calculated = this.prepareAndSelect(publicId, input.filters, input.view === "dashboard" ? input.snapshotId : input.detail.snapshotId, scope); }
      catch (error) { if (error instanceof PublicApiError && error.code === "INVALID_SELECTION") stale(); throw error; }
      if (!calculated) return undefined;
      const { snapshot } = calculated;
      let rows: readonly ResourceKpiAssignmentRow[], taskIds: string[], sourceProjection: ResourceDrillSourceProjection;
      if (input.view === "dashboard") {
        const selected = this.detailTargets(calculated, input.selector); taskIds = selected.targetTaskIds; const targets = new Set(taskIds); rows = selected.rows.filter((row) => targets.has(row.taskId));
        sourceProjection = { kind: "details", selector: input.selector, view: input.selector.dimension === "diagnostic" ? "tasks" : "assignments" };
      } else {
        const detail = input.detail, plan = this.planInput(calculated);
        const period = detail.periodId === "all" ? { from: snapshot.from, to: snapshot.to } : buildResourcePlanPeriods(snapshot.from, snapshot.to, detail.granularity).find((period) => period.key === detail.periodId);
        if (!period || (detail.date !== undefined && (detail.date < period.from || detail.date > period.to))) invalidSelection();
        this.validatePlanRow(snapshot, plan, detail.selector);
        planCall(() => calculateResourcePlan(plan));
        const population = new Set(plan.capacityResourceIds), row = detail.selector;
        rows = (detail.demandScope === "project" ? plan.fullProjectAssignments : plan.selectedAssignments).filter((assignment) => population.has(assignment.resourceId) &&
          (row.kind !== "group" || (row.groupId === null ? !assignment.groupIds.length : assignment.groupIds.includes(row.groupId))) &&
          ((row.kind !== "resource" && row.kind !== "resourceMilestone") || assignment.resourceId === row.resourceId) &&
          (row.kind !== "resourceMilestone" || assignment.milestoneTaskId === row.milestoneTaskId) &&
          assignment.from <= (detail.date ?? period.to) && assignment.to >= (detail.date ?? period.from));
        taskIds = [...new Set(rows.map((row) => row.taskId))].sort();
        sourceProjection = { kind: "plan", granularity: detail.granularity, periodId: detail.periodId, selector: row, demandScope: detail.demandScope, ...(detail.date === undefined ? {} : { date: detail.date }) };
      }
      const assignmentIds = [...new Set(rows.map((row) => row.assignmentId))].sort();
      const ancestors = new Set(taskIds.flatMap((id) => snapshot.paths.get(id)!.filter((entry) => snapshot.taskById.get(entry.taskId)?.type === "summary").map((entry) => entry.taskId)));
      const result: ResourceDrillScopeDto = { schema: "resource-dashboard/1", snapshotId: snapshot.snapshotId, sourceContext: this.sourceContext(snapshot, sourceProjection),
        taskIds: [...taskIds].sort(), assignmentIds, taskCount: taskIds.length, assignmentCount: assignmentIds.length, ancestorSummaryIds: [...ancestors].sort() };
      assertResourcePlanResponseBytes({ data: result }, "detail.bytes"); return result;
    })();
  }
  query(publicId: string, raw: ResourceDrillQueryInput): ResourceDrillQueryResponse | undefined {
    const input = parseResourceDrillQuery(raw);
    return this.database.transaction(() => {
      const data = readResourceDataSnapshot(this.database, publicId);
      if (!data) return undefined;
      const source = input.sourceContext;
      if (Object.entries(data.context).some(([key, value]) => source[key as keyof typeof data.context] !== value)) stale();
      if (!source.mdPerMmProvided && (source.mdPerMm !== resolveMdPerMm(undefined, this.options.mdPerMmEnvironment) || source.mdPerMmSource !== mdPerMmSource(undefined, this.options.mdPerMmEnvironment))) stale();
      const origin = source.sourceProjection;
      const validTask = (id: string | null | undefined, type?: string) => { if (id != null && !data.storedTasks.some((task) => task.publicId === id && (!type || task.type === type))) invalidSelection(); };
      const validPerson = (id: string | undefined) => { if (id !== undefined && !data.resources.some((resource) => resource.publicId === id)) invalidSelection(); };
      const validGroup = (id: string | null) => { if (id !== null && !data.groups.some((group) => group.publicId === id)) invalidSelection(); };
      if (origin.kind === "details") {
        const selector = origin.selector;
        if (selector.dimension === "resource") validPerson(selector.id!);
        if (selector.dimension === "group") validGroup(selector.id);
        if (selector.dimension === "milestone") validTask(selector.id, "milestone");
        validPerson(selector.resourceId); validTask(selector.milestoneTaskId, "milestone");
      } else if (origin.kind === "groupChildren") { validGroup(origin.groupId); validTask(origin.milestoneTaskId, "milestone"); }
      else if (origin.kind === "plan") {
        const row = origin.selector;
        if (row.kind === "group") validGroup(row.groupId);
        if (row.kind === "resource" || row.kind === "resourceMilestone") validPerson(row.resourceId);
        if (row.kind === "resourceMilestone") validTask(row.milestoneTaskId, "milestone");
        if (dateToOrdinal(source.range.to) - dateToOrdinal(source.range.from) + 1 > LIMITS.rangeDays) resourceDashboardLimit("range.days");
        const period = origin.periodId === "all" ? source.range : buildResourcePlanPeriods(source.range.from, source.range.to, origin.granularity).find((period) => period.key === origin.periodId);
        if (!period || (origin.date !== undefined && (origin.date < period.from || origin.date > period.to))) invalidSelection();
      }
      // Validate descriptor IDs before legacy detail wrappers translate invalid filters to stale.
      const descriptor = input.scope;
      const sourceTasks = new Map(data.storedTasks.map(task => [task.publicId, task]));
      if (descriptor.kind === "exactAssignments") {
        const sourceAssignments = new Map(data.assignments.map(assignment => [assignment.publicId, assignment]));
        for (const id of descriptor.assignmentIds) { const row = sourceAssignments.get(id); if (!row || row.kind !== "resource" || sourceTasks.get(row.taskPublicId)?.type !== "task") invalidSelection(); }
      } else {
        const ids = descriptor.kind === "summarySubtree" ? [descriptor.rootId] : descriptor.nodeIds;
        for (const id of ids) { const task = sourceTasks.get(id); if (!task || task.type === "milestone" || (descriptor.kind === "summarySubtree" && task.type !== "summary")) invalidSelection(); }
      }
      const validateFilterIds = (ids: readonly string[] | undefined, allowed: Set<string>, sentinel?: string) => { if (ids?.some(id => id !== sentinel && !allowed.has(id))) invalidSelection(); };
      validateFilterIds(input.filters.taskIds, new Set(data.storedTasks.filter(task => task.type === "task").map(task => task.publicId)));
      validateFilterIds(input.filters.wbsRootIds, new Set(data.storedTasks.map(task => task.publicId)));
      validateFilterIds(input.filters.milestoneIds, new Set(data.storedTasks.filter(task => task.type === "milestone").map(task => task.publicId)), "unassigned");
      validateFilterIds(input.filters.resourceIds, new Set(data.resources.map(resource => resource.publicId)));
      validateFilterIds(input.filters.groupIds, new Set(data.groups.map(group => group.publicId)), "ungrouped");
      const projection = input.projection;
      const filter = { ...input.filters, ...( "granularity" in projection ? { granularity: projection.granularity } : {}) };
      // Freeze one clock for all nested projections in this same SQLite read transaction.
      const service = new ResourceDashboardService(this.database, { ...this.options, clock: (() => { const now = (this.options.clock ?? (() => new Date()))(); return () => now; })() });
      let result: ResourceDrillQueryResponse["data"] | undefined;
      if (projection.kind === "report") result = service.getDashboard(publicId, filter, input.scope);
      else if (projection.kind === "details") result = service.getDetails(publicId, filter, projection, input.scope);
      else if (projection.kind === "groupChildren") result = service.getGroupChildren(publicId, filter, projection, input.scope);
      else if (projection.kind === "scope") result = service.getScope(publicId, projection.target === "dashboard" ? { view: "dashboard", filters: filter, snapshotId: projection.snapshotId, selector: projection.selector } : { view: "plan", filters: filter, detail: { ...projection, offset: 0, limit: 100 } }, input.scope) as ResourceDrillScopeDto | undefined;
      else result = service.getPlanDetails(publicId, filter, projection, projection.kind === "planDaily" ? "daily" : projection.kind === "planDayResources" ? "day-resources" : "day-assignments", input.scope);
      if (!result) return undefined;
      const response = { data: result, drill: { sourceContext: source, scope: input.scope, targetFilters: normalizeResourceDashboardFilters(filter), projection, assignmentScope: "exact-source-intersection" as const, projectReferenceScope: "same-resource-population-and-period" as const } };
      assertResourcePlanResponseBytes(response, projection.kind === "report" ? "plan.bytes" : "detail.bytes"); return response;
    })();
  }
  private planPerson(snapshot: NonNullable<ReturnType<ResourceDashboardService["prepareSnapshot"]>>, resourceId: string): ResourcePlanPersonMetadata {
    const resource = snapshot.resourceById.get(resourceId)!;
    return { name: resource.name, code: resource.code, active: resource.active, roles: resource.roles.length ? resource.roles : ["UNSPECIFIED"], developerGrade: resource.developerGrade, groupIds: snapshot.groupIdsByResource.get(resourceId) ?? [] };
  }
  private visiblePlanGroup(snapshot: NonNullable<ReturnType<ResourceDashboardService["prepareSnapshot"]>>, groupId: string | null) {
    const { filters } = snapshot;
    if (filters.groupIds.length && !filters.groupIds.includes(groupId ?? "ungrouped")) return false;
    const group = snapshot.groups.find((group) => group.publicId === groupId);
    return filters.groupActivity === "all" || (!!group && group.active === (filters.groupActivity === "active"));
  }
  private validatePlanRow(snapshot: NonNullable<ReturnType<ResourceDashboardService["prepareSnapshot"]>>, input: ResourcePlanInput, row: ResourcePlanRowSelector) {
    if (row.kind === "total") return;
    if (row.kind === "group") {
      const members = input.resources.filter((resource) => input.capacityResourceIds.includes(resource.resourceId) && (row.groupId === null ? !resource.groupIds.length : resource.groupIds.includes(row.groupId)));
      if (!this.visiblePlanGroup(snapshot, row.groupId) || !members.length) invalidSelection();
    } else {
      if (!input.capacityResourceIds.includes(row.resourceId)) invalidSelection();
      if (row.kind === "resourceMilestone" && row.milestoneTaskId !== null && !snapshot.milestones.some((milestone) => milestone.publicId === row.milestoneTaskId)) invalidSelection();
    }
  }
  private planInput(calculated: NonNullable<ReturnType<ResourceDashboardService["prepareAndSelect"]>>): ResourcePlanInput {
    const { snapshot, selection } = calculated, { domain, filters } = snapshot;
    const history = new Set(domain.assignments.filter((assignment) => assignment.kind === "resource" && domain.byTask.get(assignment.taskId)?.type === "task").map((assignment) => assignment.targetId));
    const eligible = domain.input.filters?.eligibleResourceIds;
    const capacityResourceIds = domain.resources.filter((resource) => history.has(resource.resourceId) && (eligible === undefined || eligible.includes(resource.resourceId)) &&
      (!filters.resourceIds.length || filters.resourceIds.includes(resource.resourceId)) &&
      (!filters.groupIds.length || resource.groupIds.some((id) => filters.groupIds.includes(id)) || (filters.groupIds.includes("ungrouped") && !resource.groupIds.length)) &&
      (!filters.roles.length || (resource.roles.length ? resource.roles : ["UNSPECIFIED"]).some((role) => filters.roles.includes(role as ResourceWorkloadRole))) &&
      (!filters.developerGrades.length || filters.developerGrades.includes((resource.developerGrade ?? "UNSPECIFIED") as typeof filters.developerGrades[number]))).map((resource) => resource.resourceId).sort();
    const population = new Set(capacityResourceIds);
    const projectionGroupIds = [...new Set(domain.resources.filter(resource => population.has(resource.resourceId)).flatMap(resource => resource.groupIds.length ? [...resource.groupIds] : [null]))].filter(groupId => this.visiblePlanGroup(snapshot, groupId));
    const fullProjectAssignments = selectResourceKpiAssignments(domain, { eligibleResourceIds: capacityResourceIds }).assignments;
    return { projectPublicId: snapshot.publicId, from: snapshot.from, to: snapshot.to, asOfDate: snapshot.asOfDate, granularity: filters.granularity!, mdPerMm: domain.mdPerMm,
      projectCalendar: domain.input.projectCalendar, calendarExceptions: domain.input.calendarExceptions, capacityResourceIds, resources: domain.resources,
      selectedAssignments: selection.assignments, fullProjectAssignments, projectionGroupIds, limits: RESOURCE_PLAN_LIMITS };
  }
  private renderPlan(calculated: NonNullable<ReturnType<ResourceDashboardService["prepareAndSelect"]>>): ResourceDashboardPlanDto {
    const { snapshot } = calculated, raw = planCall(() => calculateResourcePlan(this.planInput(calculated)));
    return { ...raw, resources: raw.resources.map((row) => ({ ...row, ...this.planPerson(snapshot, row.resourceId), milestones: row.milestones.slice().sort((a, b) => milestoneOrder(snapshot, a.milestoneTaskId, b.milestoneTaskId)).map((milestone) => ({ ...milestone,
      name: milestone.milestoneTaskId === null ? "Milestone 미지정" : snapshot.taskById.get(milestone.milestoneTaskId)!.name, scheduledDate: milestone.milestoneTaskId === null ? null : snapshot.taskById.get(milestone.milestoneTaskId)!.startDate })) })),
      groups: raw.groups.filter((row) => this.visiblePlanGroup(snapshot, row.groupId)).map((row) => { const group = snapshot.groups.find((group) => group.publicId === row.groupId); return { ...row, name: group?.name ?? "미분류 리소스", code: group?.code ?? null, active: group?.active ?? true }; }),
      metadata: { ...raw.metadata, limits: RESOURCE_PLAN_LIMITS, populationScope: "ordinary-task-personal-assignment-history-classification-only", groupDisplayScope: "selected-group-and-activity" } };
  }
  getDetails(publicId: string, filter: ResourceDashboardFilterInput, detail: ResourceDashboardDetailInput, scope?: ResourceDrillScope): ResourceDashboardDetailsDto | undefined {
    // Programmatic callers get the same selector/page validation as HTTP callers.
    const params = new URLSearchParams({ snapshotId: detail.snapshotId, dimension: detail.selector.dimension, metric: detail.selector.metric, view: detail.view, offset: String(detail.offset), limit: String(detail.limit) });
    if (detail.selector.id !== null) params.set("id", detail.selector.id);
    else if (detail.selector.dimension === "group") params.set("id", "ungrouped");
    else if (detail.selector.dimension === "milestone") params.set("id", "unassigned");
    if (detail.selector.resourceId !== undefined) params.set("resourceId", detail.selector.resourceId);
    if (detail.selector.assignmentScope !== undefined) params.set("assignmentScope", detail.selector.assignmentScope);
    if (detail.selector.milestoneTaskId !== undefined) params.set("milestoneTaskId", detail.selector.milestoneTaskId ?? "unassigned");
    const checked = parseResourceDashboardDetails(params);
    return this.database.transaction(() => {
      let calculated: ReturnType<ResourceDashboardService["prepareAndSelect"]>;
      try { calculated = this.prepareAndSelect(publicId, filter, checked.snapshotId, scope); }
      catch (error) { if (error instanceof PublicApiError && error.code === "INVALID_SELECTION") stale(); throw error; }
      if (!calculated) return undefined;
      const { snapshot } = calculated;
      const { taskById, resourceById, assignmentById, paths, domain } = snapshot;
      const projection = domain.projection;
      const report = snapshot;
      if (report.snapshotId !== checked.snapshotId) stale();
      const selector = checked.selector;
      const { rows, targetTaskIds } = this.detailTargets(calculated, selector);
      const details: { taskId: string; row: ResourceKpiAssignmentRow | null }[] = checked.view === "tasks" ? targetTaskIds.map((taskId) => ({ taskId, row: null })) : rows.map((row) => ({ taskId: row.taskId, row }));
      details.sort((a, b) => a.taskId.localeCompare(b.taskId) || (a.row?.assignmentId ?? "").localeCompare(b.row?.assignmentId ?? ""));
      const page: ResourceDashboardDetailRow[] = details.slice(checked.offset, checked.offset + checked.limit).map(({ taskId, row }) => {
        const task = taskById.get(taskId)!, membership = projection.membership.get(taskId)!;
        const resource = row ? resourceById.get(row.resourceId)! : null;
        const assignment = row ? assignmentById.get(row.assignmentId)! : null;
        return { taskId, taskName: task.name, externalId: task.externalId, status: task.status, progress: task.progress,
          taskStart: task.startDate, taskEnd: task.endDate, duration: task.duration, wbsPath: paths.get(taskId)!, ...membership,
          assignment: row && resource && assignment ? { assignmentId: row.assignmentId, resourceId: row.resourceId, resourceName: resource.name, resourceCode: resource.code, active: resource.active,
            roles: resource.roles.length ? resource.roles : ["UNSPECIFIED"], developerGrade: resource.developerGrade, groupIds: row.groupIds,
            assignmentStart: assignment.assignmentStart, assignmentEnd: assignment.assignmentEnd, from: row.from, to: row.to, allocationPercent: row.allocationPercent,
            effectiveWorkingDays: row.effectiveWorkingDays, plannedMd: row.plannedMd, plannedMm: row.plannedMm } : null };
      });
      const result: ResourceDashboardDetailsDto = { resourceDataContext: snapshot.dataContext, schema: "resource-dashboard/1", snapshotId: report.snapshotId, projectPublicId: publicId,
        projectRevision: report.project.revision, catalogRevision: report.catalogRevision, calendarRevision: report.calendarRevision,
        selector, view: checked.view, offset: checked.offset, limit: checked.limit, totalCount: details.length,
        nextOffset: checked.offset + checked.limit < details.length ? checked.offset + checked.limit : null, rows: page };
      if (Buffer.byteLength(JSON.stringify(result)) > LIMITS.reportBytes) resourceDashboardLimit("detail.bytes");
      return result;
    })();
  }
  private detailTargets(calculated: NonNullable<ReturnType<ResourceDashboardService["prepareAndSelect"]>>, selector: ResourceDashboardSelector) {
    const { snapshot, selection, referenceRows, excludedRows } = calculated;
    const { domain, resourceById } = snapshot;
    const diagnostics = getResourceKpiDiagnostics(domain, selection);
    if (selector.dimension === "resource" && !resourceById.has(selector.id!)) invalidSelection();
    if (selector.dimension === "group" && selector.id !== null && !snapshot.groups.some((row) => row.publicId === selector.id)) invalidSelection();
    if (selector.dimension === "milestone" && selector.id !== null && !snapshot.milestones.some((row) => row.publicId === selector.id)) invalidSelection();
    if (selector.milestoneTaskId !== undefined && selector.milestoneTaskId !== null && !snapshot.milestones.some((row) => row.publicId === selector.milestoneTaskId)) invalidSelection();
    if (selector.resourceId !== undefined) this.validateGroupResource(snapshot, selector.id, selector.resourceId);
    const scopeRows = selector.assignmentScope === "milestoneReference" ? referenceRows : selector.assignmentScope === "milestoneExcluded" ? excludedRows : selection.assignments;
    const scopeTotals = summarizeResourceKpiAssignments(domain, scopeRows);
    const metricTaskIds = selector.metric === "notStarted" ? scopeTotals.notStarted.taskIds : selector.metric === "inProgress" ? scopeTotals.inProgress.taskIds : selector.metric === "completed" ? scopeTotals.completed.taskIds : selector.metric === "delayed" ? scopeTotals.delayed.taskIds : null;
    const rows = scopeRows.filter((row) =>
      (selector.resourceId === undefined || row.resourceId === selector.resourceId) &&
      (selector.dimension !== "resource" || row.resourceId === selector.id) &&
      (selector.dimension !== "group" || (selector.id === null ? !row.groupIds.length : row.groupIds.includes(selector.id))) &&
      (selector.dimension !== "role" || row.roles.includes(selector.id!)) &&
      (selector.dimension !== "milestone" || row.milestoneTaskId === selector.id) &&
      (selector.milestoneTaskId === undefined || row.milestoneTaskId === selector.milestoneTaskId) &&
      (!metricTaskIds || metricTaskIds.includes(row.taskId)) && (selector.metric !== "unset" || row.plannedMd === null));
    const diagnosticTaskIds = selector.metric === "completelyUnassigned" ? diagnostics.completelyUnassigned.taskIds : selector.metric === "groupOnly" ? diagnostics.groupOnly.taskIds : selector.metric === "personallyUnassigned" ? diagnostics.personallyUnassigned.taskIds : diagnostics.unsetTasks.taskIds;
    const targetTaskIds = selector.dimension === "diagnostic" ? diagnosticTaskIds : [...new Set(rows.map((row) => row.taskId))].sort();
    return { rows, targetTaskIds };
  }
  getGroupChildren(publicId: string, filter: ResourceDashboardFilterInput, input: ResourceDashboardGroupChildrenInput, scope?: ResourceDrillScope): ResourceDashboardGroupChildrenDto | undefined {
    const params = new URLSearchParams({ snapshotId: input.snapshotId, groupId: input.groupId ?? "ungrouped", offset: String(input.offset), limit: String(input.limit) });
    if (input.milestoneTaskId !== undefined) params.set("milestoneTaskId", input.milestoneTaskId ?? "unassigned");
    const checked = parseResourceDashboardGroupChildren(params);
    return this.database.transaction(() => {
      let calculated: ReturnType<ResourceDashboardService["prepareAndSelect"]>;
      try { calculated = this.prepareAndSelect(publicId, filter, checked.snapshotId, scope); }
      catch (error) { if (error instanceof PublicApiError && error.code === "INVALID_SELECTION") stale(); throw error; }
      if (!calculated) return undefined;
      const { snapshot, selection } = calculated;
      if (snapshot.snapshotId !== checked.snapshotId) stale();
      if (checked.groupId !== null && !snapshot.groups.some((row) => row.publicId === checked.groupId)) invalidSelection();
      if (checked.milestoneTaskId !== undefined && checked.milestoneTaskId !== null && !snapshot.milestones.some((row) => row.publicId === checked.milestoneTaskId)) invalidSelection();
      const rows = selection.assignments.filter((row) => (checked.groupId === null ? !row.groupIds.length : row.groupIds.includes(checked.groupId)) && (checked.milestoneTaskId === undefined || row.milestoneTaskId === checked.milestoneTaskId));
      const resourceIds = [...new Set(rows.map((row) => row.resourceId))].sort();
      const pageIds = resourceIds.slice(checked.offset, checked.offset + checked.limit);
      const selector: ResourceDashboardSelector = { dimension: "group", id: checked.groupId, metric: "all", ...(checked.milestoneTaskId === undefined ? {} : { milestoneTaskId: checked.milestoneTaskId }) };
      const pageCellCount = pageIds.reduce((sum, resourceId) => sum + new Set<string | null>([null, ...rows.filter((row) => row.resourceId === resourceId).map((row) => row.milestoneTaskId)]).size, 0);
      if (pageCellCount > LIMITS.cells) resourceDashboardLimit("projection.groupChildrenCells");
      const pageRows = pageIds.map((resourceId) => {
        const assignments = rows.filter((row) => row.resourceId === resourceId), resource = snapshot.resourceById.get(resourceId)!;
        const memberSelector = { ...selector, resourceId };
        const milestoneIds = [...new Set(assignments.map((row) => row.milestoneTaskId))];
        if (!milestoneIds.includes(null)) milestoneIds.push(null);
        return { id: resourceId, name: resource.name, code: resource.code, active: resource.active, resourceIds: [resourceId], assignmentRange: assignmentRangeOf(assignments),
          summary: compact(summarizeResourceKpiAssignments(snapshot.domain, assignments), memberSelector),
          milestones: milestoneIds.sort((a, b) => milestoneOrder(snapshot, a, b)).map((milestoneTaskId) => ({ milestoneTaskId, summary: compact(summarizeResourceKpiAssignments(snapshot.domain, assignments.filter((row) => row.milestoneTaskId === milestoneTaskId)), { ...memberSelector, milestoneTaskId }) })) };
      });
      const result: ResourceDashboardGroupChildrenDto = { resourceDataContext: snapshot.dataContext, schema: "resource-dashboard/1", projectPublicId: publicId, snapshotId: snapshot.snapshotId, projectRevision: snapshot.project.revision,
        catalogRevision: snapshot.catalogRevision, calendarRevision: snapshot.calendarRevision, filters: snapshot.filters, range: { from: snapshot.from, to: snapshot.to }, asOfDate: snapshot.asOfDate, mdPerMm: snapshot.domain.mdPerMm, mdPerMmSource: snapshot.mdPerMmSource, groupId: checked.groupId,
        ...(checked.milestoneTaskId === undefined ? {} : { milestoneTaskId: checked.milestoneTaskId }), summary: compact(summarizeResourceKpiAssignments(snapshot.domain, rows), selector),
        offset: checked.offset, limit: checked.limit, totalCount: resourceIds.length, nextOffset: checked.offset + checked.limit < resourceIds.length ? checked.offset + checked.limit : null, rows: pageRows };
      if (Buffer.byteLength(JSON.stringify(result)) > LIMITS.reportBytes) resourceDashboardLimit("detail.bytes");
      return result;
    })();
  }
  private validateGroupResource(snapshot: NonNullable<ReturnType<ResourceDashboardService["prepareSnapshot"]>>, groupId: string | null, resourceId: string) {
    if (!snapshot.resourceById.has(resourceId)) invalidSelection();
    const groupIds = snapshot.groupIdsByResource.get(resourceId) ?? [];
    if (groupId === null ? groupIds.length > 0 : !groupIds.includes(groupId)) invalidSelection();
  }
  private prepareSnapshot(publicId: string, filter: ResourceDashboardFilterInput) {
    if (!isCanonicalUuidV4(publicId)) return undefined;
    const rawData = readResourceDataSnapshot(this.database, publicId);
    if (!rawData) return undefined;
    const { project, storedTasks, assignments, resources, groups, memberships, projectCalendar } = rawData;
    const now = (this.options.clock ?? (() => new Date()))();
    const filters = normalizeResourceDashboardFilters(filter);
    const taskById = new Map(storedTasks.map((row) => [row.publicId, row])), internalTasks = new Map(storedTasks.map((row) => [row.id, row]));
    const resourceById = new Map(resources.map((row) => [row.publicId, row]));
    const groupIdsByResource = new Map<string, string[]>();
    for (const group of groups) for (const id of group.memberResourceIds) { const values = groupIdsByResource.get(id) ?? []; values.push(group.publicId); groupIdsByResource.set(id, values); }
    for (const values of groupIdsByResource.values()) if (values.length > LIMITS.groupsPerResource) resourceDashboardLimit("snapshot.groupsPerResource");
    const repeatedRows = assignments.reduce((sum, assignment) => sum + (assignment.kind === "resource" && taskById.get(assignment.taskPublicId)?.type === "task" ? Math.max(1, groupIdsByResource.get(assignment.targetPublicId)?.length ?? 0) : 0), 0);
    if (repeatedRows > LIMITS.groupAssignmentRows) resourceDashboardLimit("snapshot.groupAssignmentRows");
    const paths = new Map<string, { taskId: string; name: string }[]>();
    let pathEntries = 0;
    for (const task of storedTasks) {
      const path: { taskId: string; name: string }[] = [], seen = new Set<string>(); let current: typeof task | undefined = task;
      while (current) { if (seen.has(current.publicId)) throw new Error("Invalid hierarchy"); seen.add(current.publicId); path.unshift({ taskId: current.publicId, name: current.name }); current = current.parentId === null ? undefined : internalTasks.get(current.parentId); }
      pathEntries += path.length;
      if (pathEntries > LIMITS.wbsPathEntries) resourceDashboardLimit("snapshot.wbsPathEntries");
      if (path.reduce((sum, row) => sum + row.name.length, 0) > LIMITS.wbsPathChars) resourceDashboardLimit("snapshot.wbsPathChars");
      paths.set(task.publicId, path);
    }
    const milestones = storedTasks.filter((row) => row.type === "milestone").sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") || a.publicId.localeCompare(b.publicId));
    const validateIds = (ids: string[], allowed: Set<string>, sentinel?: string) => { if (ids.some((id) => id !== sentinel && !allowed.has(id))) invalidSelection(); };
    validateIds(filters.taskIds, new Set(storedTasks.filter((row) => row.type === "task").map((row) => row.publicId)));
    validateIds(filters.wbsRootIds, new Set(storedTasks.map((row) => row.publicId)));
    validateIds(filters.milestoneIds, new Set(milestones.map((row) => row.publicId)), "unassigned");
    validateIds(filters.resourceIds, new Set(resources.map((row) => row.publicId)));
    validateIds(filters.groupIds, new Set(groups.map((row) => row.publicId)), "ungrouped");
    const dates = storedTasks.filter((row) => row.type === "task").flatMap((row) => [row.startDate, row.endDate]).filter((value): value is string => value !== null).sort();
    const asOfDate = filters.asOfDate ?? localDate(now), from = filters.from ?? dates[0] ?? asOfDate, to = filters.to ?? dates.at(-1) ?? from;
    if (from > to) throw new PublicApiError(400, "INVALID_REQUEST", "조회 시작일과 종료일을 확인해 주세요.");
    if (dateToOrdinal(to) - dateToOrdinal(from) + 1 > LIMITS.rangeDays) resourceDashboardLimit("range.days");
    const links = rawData.links.map((row) => ({ id: row.publicId, predecessorTaskId: internalTasks.get(row.predecessorTaskId)!.publicId, successorTaskId: internalTasks.get(row.successorTaskId)!.publicId, type: row.type, lag: row.lag }));
    const tasks = storedTasks.map((task) => ({ taskId: task.publicId, parentTaskId: task.parentId === null ? null : internalTasks.get(task.parentId)!.publicId,
      type: task.type, duration: task.duration, progress: task.progress, status: task.status, start: task.startDate, end: task.endDate,
      name: task.name, externalId: task.externalId, wbsPath: paths.get(task.publicId)!.map((row) => row.name).join(" / ") }));
    const calendarExceptions = loadResourceCalendarExceptions(this.database, project.id);
    const { catalogRevision, calendarRevision } = rawData.context;
    const activityMatches = (active: boolean, filter: "all" | "active" | "inactive") => filter === "all" || active === (filter === "active");
    const eligibleResourceIds = filters.resourceActivity === "all" && filters.groupActivity === "all" ? undefined : resources.filter((resource) =>
      activityMatches(resource.active, filters.resourceActivity) && (filters.groupActivity === "all" || groups.some((group) => group.memberResourceIds.includes(resource.publicId) &&
        (!filters.groupIds.length || filters.groupIds.includes(group.publicId)) && activityMatches(group.active, filters.groupActivity))),
    ).map((row) => row.publicId);
    const domain = prepareResourceKpiSnapshot({ projectPublicId: publicId, timezone: "Asia/Seoul", asOfDate, from, to, tasks, memberships, links,
      resources: resources.map((row) => ({ resourceId: row.publicId, name: row.name, code: row.code, groupSearchText: groups.filter((group) => group.memberResourceIds.includes(row.publicId)).map((group) => `${group.name} ${group.code ?? ""}`).join(" "), groupIds: groupIdsByResource.get(row.publicId) ?? [], roles: row.roles, developerGrade: row.developerGrade })),
      assignments: assignments.map((row) => ({ assignmentId: row.publicId, taskId: row.taskPublicId, kind: row.kind, targetId: row.targetPublicId, start: row.assignmentStart, end: row.assignmentEnd, allocationPercent: row.allocationPercent })),
      projectCalendar, calendarExceptions, maxProjectionCells: LIMITS.cells, mdPerMm: filters.mdPerMmProvided ? filters.mdPerMm : undefined, mdPerMmEnvironment: this.options.mdPerMmEnvironment,
      filters: { eligibleResourceIds, taskIds: filters.taskIds, wbsRootIds: filters.wbsRootIds, milestoneIds: filters.milestoneIds.map((id) => id === "unassigned" ? null : id),
        resourceIds: filters.resourceIds, groupIds: filters.groupIds.filter((id) => id !== "ungrouped"), includeUngrouped: filters.groupIds.includes("ungrouped"),
        roles: filters.roles, developerGrades: filters.developerGrades, statuses: filters.statuses, search: filters.search, taskSearch: filters.taskSearch } });
    const snapshotId = fingerprint({ dataSnapshotId: rawData.context.dataSnapshotId, filters: { ...filters, mode: undefined, granularity: undefined }, from, to, asOfDate, mdPerMm: domain.mdPerMm });
    return { dataContext: rawData.context, project, publicId, now, filters, from, to, asOfDate, dates, tasks, storedTasks, resources, groups, milestones, groupIdsByResource,
      taskById, resourceById, assignmentById: new Map(assignments.map((row) => [row.publicId, row])), paths, domain, mdPerMmSource: mdPerMmSource(filters.mdPerMmProvided ? filters.mdPerMm : undefined, this.options.mdPerMmEnvironment), catalogRevision, calendarRevision, snapshotId };
  }
  private prepareAndSelect(publicId: string, filter: ResourceDashboardFilterInput, expectedSnapshotId?: string, scope?: ResourceDrillScope) {
    const snapshot = this.prepareSnapshot(publicId, filter);
    if (!snapshot) return undefined;
    const restriction = scope ? this.resolveRestriction(snapshot, scope) : undefined;
    if (restriction) snapshot.snapshotId = fingerprint({ snapshotId: snapshot.snapshotId, taskIds: [...restriction.tasks].sort(), assignmentIds: restriction.assignments ? [...restriction.assignments].sort() : null });
    if (expectedSnapshotId !== undefined && snapshot.snapshotId !== expectedSnapshotId) stale();
    const restrict = (value: ReturnType<typeof selectResourceKpiAssignments>) => restriction ? { ...value, assignments: value.assignments.filter((row) => restriction.tasks.has(row.taskId) && (!restriction.assignments || restriction.assignments.has(row.assignmentId))), t0: value.t0.filter((task) => restriction.tasks.has(task.taskId)), t0Ids: new Set([...value.t0Ids].filter((id) => restriction.tasks.has(id))) } : value;
    const reference = restrict(selectResourceKpiAssignments(snapshot.domain, { ...snapshot.domain.input.filters, milestoneIds: [] }));
    const selection = snapshot.filters.milestoneIds.length ? restrict(selectResourceKpiAssignments(snapshot.domain)) : reference;
    try { assertResourceKpiProjectionBudget(snapshot.domain, selection); } catch (error) { if (error instanceof ResourceKpiProjectionLimitError) resourceDashboardLimit("projection.cells"); throw error; }
    const selectedIds = new Set(selection.assignments.map((row) => row.assignmentId));
    const excludedRows = reference.assignments.filter((row) => !selectedIds.has(row.assignmentId));
    return { snapshot, selection, referenceRows: reference.assignments, excludedRows };
  }
  private calculate(publicId: string, filter: ResourceDashboardFilterInput, scope?: ResourceDrillScope) {
    const calculated = this.prepareAndSelect(publicId, filter, undefined, scope);
    if (!calculated) return undefined;
    const report = this.renderReport(calculated);
    if (calculated.snapshot.filters.granularity) { report.plan = this.renderPlan(calculated); assertResourcePlanResponseBytes({ data: report }); }
    return { report };
  }
  private renderReport(calculated: NonNullable<ReturnType<ResourceDashboardService["prepareAndSelect"]>>) {
    const { snapshot, selection, referenceRows, excludedRows } = calculated;
    const { project, publicId, now, filters, from, to, asOfDate, dates, resources, groups, milestones, groupIdsByResource, taskById, resourceById, storedTasks, catalogRevision, calendarRevision, snapshotId, domain } = snapshot;
    let raw: ReturnType<typeof renderResourceKpi>;
    try { raw = renderResourceKpi(domain, selection); } catch (error) { if (error instanceof ResourceKpiProjectionLimitError) resourceDashboardLimit("projection.cells"); throw error; }
    const assignmentRange = (ids: string[]) => { const idSet = new Set(ids); return assignmentRangeOf(raw.assignments.filter((row) => idSet.has(row.assignmentId))); };
    const selector = (dimension: ResourceDashboardSelector["dimension"], id: string | null = null): ResourceDashboardSelector => ({ dimension, id, metric: "all" });
    const convertCells = (rows: typeof raw.milestones, dimension: ResourceDashboardSelector["dimension"], id: string | null) => rows.slice().sort((a, b) => milestoneOrder(snapshot, a.milestoneTaskId, b.milestoneTaskId)).map((row) => ({ milestoneTaskId: row.milestoneTaskId, summary: compact(row, { ...selector(dimension, id), milestoneTaskId: row.milestoneTaskId }) }));
    const diagnostic = (count: number, metric: ResourceDashboardSelector["metric"]) => ({ count, selector: { dimension: "diagnostic" as const, id: null, metric, assignmentScope: "selected" as const } });
    const report: ResourceDashboardDto = {
      resourceScopeContext: this.sourceContext(snapshot, { kind: "report" }),
      schema: "resource-dashboard/1", projectPublicId: publicId, projectRevision: project.revision, catalogRevision, calendarRevision, snapshotId,
      calculatedAt: now.toISOString(), asOfDate, timezone: "Asia/Seoul", filters, range: { from, to }, rangeFallback: !dates.length && filters.from === null,
      mdPerMm: raw.mdPerMm, mdPerMmSource: raw.mdPerMmSource, scope: { assignment: "A", diagnostics: "T0", identity: snapshotId },
      summary: compact(raw.total, selector("all")),
      reference: compact(summarizeResourceKpiAssignments(domain, referenceRows), { ...selector("all"), assignmentScope: "milestoneReference" }),
      excluded: compact(summarizeResourceKpiAssignments(domain, excludedRows), { ...selector("all"), assignmentScope: "milestoneExcluded" }),
      milestoneSelection: { applied: filters.milestoneIds.length > 0, reference: "A without Milestone filter", excluded: "reference Assignment IDs minus selected Assignment IDs" },
      resources: raw.resources.map((row) => { const resource = resourceById.get(row.id)!; return { id: row.id, name: resource.name, code: resource.code, active: resource.active, resourceIds: [row.id], assignmentRange: assignmentRange(row.assignmentIds), summary: compact(row, selector("resource", row.id)), milestones: convertCells(row.milestones, "resource", row.id) }; }),
      groups: raw.groups.filter((row) => row.assignmentCount > 0).map((row) => { const group = groups.find((group) => group.publicId === row.id); return { id: row.id, name: group?.name ?? "미분류 리소스", code: group?.code ?? null, active: group?.active ?? true, resourceIds: row.resourceIds, assignmentRange: assignmentRange(row.assignmentIds), summary: compact(row, selector("group", row.id)), milestones: convertCells(row.milestones, "group", row.id) }; }),
      roleTotals: raw.roles.map((row) => ({ role: row.id as ResourceWorkloadRole, summary: compact(row, selector("role", row.id)) })),
      milestones: convertCells(raw.milestones, "all", null),
      stages: raw.fullMilestones.slice().sort((a, b) => milestoneOrder(snapshot, a.milestoneTaskId, b.milestoneTaskId)).map((row) => { const task = taskById.get(row.milestoneTaskId)!, gate = row.stageGate;
        const bucket = raw.milestones.find((value) => value.milestoneTaskId === row.milestoneTaskId);
        return { milestoneTaskId: row.milestoneTaskId, name: task.name, scheduledDate: task.startDate, status: task.status,
          full: { memberCount: gate.memberCount, completedMemberCount: gate.completedMemberCount, memberProgressPercent: gate.memberProgressPercent,
            predecessorCount: gate.predecessorMilestoneTaskIds.length, incompletePredecessorCount: gate.incompletePredecessorMilestoneTaskIds.length,
            ready: gate.ready, blocked: gate.blocked, manualEvent: gate.manualEvent, completionInconsistent: gate.completionInconsistent },
          selected: compact(bucket ?? raw.milestones.find((value) => value.taskCount === 0) ?? { ...raw.total, taskCount: 0, resourceCount: 0, assignmentCount: 0, notStarted: { count: 0, taskIds: [] }, inProgress: { count: 0, taskIds: [] }, completed: { count: 0, taskIds: [] }, delayed: { count: 0, taskIds: [] }, completion: { numerator: 0, denominator: 0, percent: null, taskIds: [], completedTaskIds: [] }, assignedTaskProgress: { numerator: 0, denominator: 0, percent: null, taskIds: [] }, effort: { knownMd: 0, plannedMd: 0, plannedMm: raw.mdPerMm === null ? null : 0, state: "empty", partial: false, unsetCount: 0, assignmentIds: [], unsetAssignmentIds: [] } }, selector("milestone", row.milestoneTaskId)) };
      }),
      diagnostics: { denominator: raw.diagnostics.denominator, completelyUnassigned: diagnostic(raw.diagnostics.completelyUnassigned.count, "completelyUnassigned"),
        groupOnly: diagnostic(raw.diagnostics.groupOnly.count, "groupOnly"), personallyUnassigned: diagnostic(raw.diagnostics.personallyUnassigned.count, "personallyUnassigned"),
        unsetTasks: diagnostic(raw.diagnostics.unsetTasks.count, "unset"), unsetAssignmentCount: raw.diagnostics.unsetAssignmentCount,
        inapplicableFilters: [...raw.diagnostics.inapplicableFilters], personalFiltersAppliedToA: raw.diagnostics.personalFiltersAppliedToA },
      catalog: { resources: resources.map((row) => ({ id: row.publicId, name: row.name, code: row.code, active: row.active, roles: row.roles, developerGrade: row.developerGrade, groupIds: groupIdsByResource.get(row.publicId) ?? [] })),
        groups: groups.map((row) => ({ id: row.publicId, name: row.name, code: row.code, active: row.active })), milestones: milestones.map((row) => ({ id: row.publicId, name: row.name })),
        wbsRoots: storedTasks.map((row) => ({ id: row.publicId, name: row.name, type: row.type })) },
      metadata: { groupRoleSubtotalsAdditive: false, precision: "raw", diagnosticsScope: "T0: Task/WBS/Milestone/status/taskSearch/canonical task dates; no personal/activity filters or search",
        searchScope: "A: Resource name/code OR its connected Group name/code OR assigned Task name/externalId/WBS path; taskSearch applies to T0 and A", historicalStateRestoration: false, totalFrom: "full selected assignment set", limits: LIMITS },
    };
    if (Buffer.byteLength(JSON.stringify(report)) > LIMITS.reportBytes) resourceDashboardLimit("projection.reportBytes");
    return report;
  }
}
