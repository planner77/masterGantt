import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { ResourceDashboardDetailInput, ResourceDashboardDetailRow, ResourceDashboardDetailsDto, ResourceDashboardDto, ResourceDashboardFilterInput, ResourceDashboardSelector, ResourceDashboardSummary } from "../../contracts/resource-dashboard";
import { RESOURCE_DASHBOARD_LIMITS as LIMITS } from "../../contracts/resource-dashboard";
import type { ResourceWorkloadRole } from "../../contracts/resources";
import { projectStageGates } from "../../domain/milestones/stage-gates";
import { calculateResourceKpi, ResourceKpiProjectionLimitError, type ResourceKpiAssignmentRow, type ResourceKpiTotals } from "../../domain/resources/resource-kpi";
import { dateToOrdinal } from "../../domain/scheduling/date-only";
import { loadResourceCalendarExceptions, resolveProjectWorkingCalendar } from "../calendars/calendar-resolution-core";
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { MilestoneMembershipRepository } from "../repositories/milestone-membership-repository-core";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ResourceDashboardRepository } from "../repositories/resource-dashboard-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";
import { WorkCalendarRepository } from "../repositories/work-calendar-repository-core";
import { normalizeResourceDashboardFilters, parseResourceDashboardDetails } from "./resource-dashboard-query-core";

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function resourceDashboardLimit(kind: string): never {
  const guidance = kind === "range.days" ? "조회 기간을 366일 이하로 줄여 주세요." : kind.startsWith("projection.") ? "개인·Group·Milestone 선택 범위를 줄여 주세요." : kind === "detail.bytes" ? "상세 page 크기를 줄여 주세요." : "프로젝트의 Task·관계·Group 소속 범위를 정리하거나 프로젝트를 분리해 주세요. 전체 snapshot 한도는 조회 필터로 우회할 수 없습니다.";
  throw new PublicApiError(422, "REPORT_LIMIT_EXCEEDED", `${kind} 조회 한도를 초과했습니다. ${guidance}`, [{ path: kind, code: "REPORT_LIMIT_EXCEEDED", message: kind }]);
}
const invalidSelection = (): never => { throw new PublicApiError(400, "INVALID_SELECTION", "현재 프로젝트에 연결된 조회 대상을 다시 선택해 주세요."); };
const stale = (): never => { throw new PublicApiError(409, "REPORT_STALE", "기준 데이터 또는 조회 범위가 변경되었습니다. 대시보드를 다시 조회해 주세요."); };
function compact(value: ResourceKpiTotals, selector: ResourceDashboardSelector): ResourceDashboardSummary {
  return { taskCount: value.taskCount, resourceCount: value.resourceCount, assignmentCount: value.assignmentCount,
    notStarted: value.notStarted.count, inProgress: value.inProgress.count, completed: value.completed.count, delayed: value.delayed.count,
    completion: { numerator: value.completion.numerator, denominator: value.completion.denominator, percent: value.completion.percent },
    assignedTaskProgress: { numerator: value.assignedTaskProgress.numerator, denominator: value.assignedTaskProgress.denominator, percent: value.assignedTaskProgress.percent },
    effort: { knownMd: value.effort.knownMd, plannedMd: value.effort.plannedMd, plannedMm: value.effort.plannedMm, state: value.effort.state, partial: value.effort.partial, unsetCount: value.effort.unsetCount }, selector };
}
function localDate(now: Date): string {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export class ResourceDashboardService {
  constructor(private readonly database: Database.Database, private readonly options: { clock?: () => Date; mdPerMmEnvironment?: string } = {}) {}
  getDashboard(publicId: string, filter: ResourceDashboardFilterInput = {}): ResourceDashboardDto | undefined {
    return this.database.transaction(() => this.calculate(publicId, filter)?.report)();
  }
  getDetails(publicId: string, filter: ResourceDashboardFilterInput, detail: ResourceDashboardDetailInput): ResourceDashboardDetailsDto | undefined {
    // Programmatic callers get the same selector/page validation as HTTP callers.
    const params = new URLSearchParams({ snapshotId: detail.snapshotId, dimension: detail.selector.dimension, metric: detail.selector.metric, view: detail.view, offset: String(detail.offset), limit: String(detail.limit) });
    if (detail.selector.id !== null) params.set("id", detail.selector.id);
    else if (detail.selector.dimension === "group") params.set("id", "ungrouped");
    else if (detail.selector.dimension === "milestone") params.set("id", "unassigned");
    if (detail.selector.milestoneTaskId !== undefined) params.set("milestoneTaskId", detail.selector.milestoneTaskId ?? "unassigned");
    const checked = parseResourceDashboardDetails(params);
    return this.database.transaction(() => {
      let calculated: ReturnType<ResourceDashboardService["calculate"]>;
      try { calculated = this.calculate(publicId, filter); }
      catch (error) { if (error instanceof PublicApiError && error.code === "INVALID_SELECTION") stale(); throw error; }
      if (!calculated) return undefined;
      const { report, raw, taskById, resourceById, assignmentById, paths, projection } = calculated;
      if (report.snapshotId !== checked.snapshotId) stale();
      const selector = checked.selector;
      if (selector.dimension === "resource" && !resourceById.has(selector.id!)) invalidSelection();
      if (selector.dimension === "group" && selector.id !== null && !report.catalog.groups.some((row) => row.id === selector.id)) invalidSelection();
      if (selector.dimension === "milestone" && selector.id !== null && !report.catalog.milestones.some((row) => row.id === selector.id)) invalidSelection();
      if (selector.milestoneTaskId !== undefined && selector.milestoneTaskId !== null && !report.catalog.milestones.some((row) => row.id === selector.milestoneTaskId)) invalidSelection();
      const metricTaskIds = selector.metric === "notStarted" ? raw.total.notStarted.taskIds : selector.metric === "inProgress" ? raw.total.inProgress.taskIds : selector.metric === "completed" ? raw.total.completed.taskIds : selector.metric === "delayed" ? raw.total.delayed.taskIds : null;
      const rows = raw.assignments.filter((row) =>
        (selector.dimension !== "resource" || row.resourceId === selector.id) &&
        (selector.dimension !== "group" || (selector.id === null ? !row.groupIds.length : row.groupIds.includes(selector.id))) &&
        (selector.dimension !== "role" || row.roles.includes(selector.id!)) &&
        (selector.dimension !== "milestone" || row.milestoneTaskId === selector.id) &&
        (selector.milestoneTaskId === undefined || row.milestoneTaskId === selector.milestoneTaskId) &&
        (!metricTaskIds || metricTaskIds.includes(row.taskId)) && (selector.metric !== "unset" || row.plannedMd === null));
      const diagnosticTaskIds = selector.metric === "completelyUnassigned" ? raw.diagnostics.completelyUnassigned.taskIds : selector.metric === "groupOnly" ? raw.diagnostics.groupOnly.taskIds : selector.metric === "personallyUnassigned" ? raw.diagnostics.personallyUnassigned.taskIds : raw.diagnostics.unsetTasks.taskIds;
      const targetTaskIds = selector.dimension === "diagnostic" ? diagnosticTaskIds : [...new Set(rows.map((row) => row.taskId))].sort();
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
      const result: ResourceDashboardDetailsDto = { schema: "resource-dashboard/1", snapshotId: report.snapshotId, projectPublicId: publicId,
        projectRevision: report.projectRevision, catalogRevision: report.catalogRevision, calendarRevision: report.calendarRevision,
        selector, view: checked.view, offset: checked.offset, limit: checked.limit, totalCount: details.length,
        nextOffset: checked.offset + checked.limit < details.length ? checked.offset + checked.limit : null, rows: page };
      if (Buffer.byteLength(JSON.stringify(result)) > LIMITS.reportBytes) resourceDashboardLimit("detail.bytes");
      return result;
    })();
  }
  private calculate(publicId: string, filter: ResourceDashboardFilterInput) {
    if (!isCanonicalUuidV4(publicId)) return undefined;
    const project = new ProjectRepository(this.database).findByPublicId(publicId);
    if (!project) return undefined;
    const now = (this.options.clock ?? (() => new Date()))();
    const filters = normalizeResourceDashboardFilters(filter);
    const repository = new ResourceDashboardRepository(this.database), counts = repository.counts(project.id);
    for (const key of ["tasks", "assignments", "links", "calendarRules", "calendarDates", "catalogMemberships"] as const) if (counts[key] > LIMITS[key]) resourceDashboardLimit(`snapshot.${key}`);
    const schedules = new ScheduleRepository(this.database), catalogRepository = new ResourceCatalogRepository(this.database);
    const storedTasks = schedules.listTasks(project.id), assignments = catalogRepository.listAssignments(project.id);
    const taskById = new Map(storedTasks.map((row) => [row.publicId, row])), internalTasks = new Map(storedTasks.map((row) => [row.id, row]));
    const { resources, groups } = repository.catalog(project.id);
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
    const milestones = storedTasks.filter((row) => row.type === "milestone");
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
    const memberships = new MilestoneMembershipRepository(this.database).list(project.id);
    const links = schedules.listLinks(project.id).map((row) => ({ id: row.publicId, predecessorTaskId: internalTasks.get(row.predecessorTaskId)!.publicId, successorTaskId: internalTasks.get(row.successorTaskId)!.publicId, type: row.type, lag: row.lag }));
    const tasks = storedTasks.map((task) => ({ taskId: task.publicId, parentTaskId: task.parentId === null ? null : internalTasks.get(task.parentId)!.publicId,
      type: task.type, duration: task.duration, progress: task.progress, status: task.status, start: task.startDate, end: task.endDate,
      name: task.name, externalId: task.externalId, wbsPath: paths.get(task.publicId)!.map((row) => row.name).join(" / ") }));
    const calendars = new WorkCalendarRepository(this.database);
    const calendarRules = calendars.listRules(project.id), calendarDates = calendars.listDates(project.id);
    const projectCalendar = resolveProjectWorkingCalendar(this.database, project.id), calendarExceptions = loadResourceCalendarExceptions(this.database, project.id);
    const calendarRevision = fingerprint({ rules: calendarRules, dates: calendarDates });
    const activityMatches = (active: boolean, filter: "all" | "active" | "inactive") => filter === "all" || active === (filter === "active");
    const eligibleResourceIds = filters.resourceActivity === "all" && filters.groupActivity === "all" ? undefined : resources.filter((resource) =>
      activityMatches(resource.active, filters.resourceActivity) && (filters.groupActivity === "all" || groups.some((group) => group.memberResourceIds.includes(resource.publicId) &&
        (!filters.groupIds.length || filters.groupIds.includes(group.publicId)) && activityMatches(group.active, filters.groupActivity))),
    ).map((row) => row.publicId);
    const calculateRaw = () => calculateResourceKpi({ projectPublicId: publicId, timezone: "Asia/Seoul", asOfDate, from, to, tasks, memberships, links,
      resources: resources.map((row) => ({ resourceId: row.publicId, name: row.name, code: row.code, groupSearchText: groups.filter((group) => group.memberResourceIds.includes(row.publicId)).map((group) => `${group.name} ${group.code ?? ""}`).join(" "), groupIds: groupIdsByResource.get(row.publicId) ?? [], roles: row.roles, developerGrade: row.developerGrade })),
      assignments: assignments.map((row) => ({ assignmentId: row.publicId, taskId: row.taskPublicId, kind: row.kind, targetId: row.targetPublicId, start: row.assignmentStart, end: row.assignmentEnd, allocationPercent: row.allocationPercent })),
      projectCalendar, calendarExceptions, maxProjectionCells: LIMITS.cells, mdPerMm: filters.mdPerMmProvided ? filters.mdPerMm : undefined, mdPerMmEnvironment: this.options.mdPerMmEnvironment,
      filters: { eligibleResourceIds, taskIds: filters.taskIds, wbsRootIds: filters.wbsRootIds, milestoneIds: filters.milestoneIds.map((id) => id === "unassigned" ? null : id),
        resourceIds: filters.resourceIds, groupIds: filters.groupIds.filter((id) => id !== "ungrouped"), includeUngrouped: filters.groupIds.includes("ungrouped"),
        roles: filters.roles, developerGrades: filters.developerGrades, statuses: filters.statuses, search: filters.search, taskSearch: filters.taskSearch } });
    let raw: ReturnType<typeof calculateResourceKpi>;
    try { raw = calculateRaw(); } catch (error) { if (error instanceof ResourceKpiProjectionLimitError) resourceDashboardLimit("projection.cells"); throw error; }
    const assignmentRange = (ids: string[]) => { const idSet = new Set(ids), rows = raw.assignments.filter((row) => idSet.has(row.assignmentId)); return rows.length ? { from: rows.map((row) => row.from).sort()[0], to: rows.map((row) => row.to).sort().at(-1)! } : null; };
    const cells = raw.roles.length + raw.resources.reduce((sum, row) => sum + row.milestones.length, 0) + raw.groups.reduce((sum, row) => sum + row.milestones.length, 0) + raw.milestones.length;
    if (cells > LIMITS.cells) resourceDashboardLimit("projection.cells");
    const catalogRevision = catalogRepository.getRevision();
    const snapshotId = fingerprint({ projectPublicId: publicId, projectRevision: project.revision, catalogRevision, calendarRevision, tasks, memberships, links, assignments,
      resources, groups, filters: { ...filters, mode: undefined }, from, to, asOfDate, mdPerMm: raw.mdPerMm });
    const selector = (dimension: ResourceDashboardSelector["dimension"], id: string | null = null): ResourceDashboardSelector => ({ dimension, id, metric: "all" });
    const convertCells = (rows: typeof raw.milestones, dimension: ResourceDashboardSelector["dimension"], id: string | null) => rows.map((row) => ({ milestoneTaskId: row.milestoneTaskId, summary: compact(row, { ...selector(dimension, id), milestoneTaskId: row.milestoneTaskId }) }));
    const diagnostic = (count: number, metric: ResourceDashboardSelector["metric"]) => ({ count, selector: { dimension: "diagnostic" as const, id: null, metric } });
    const report: ResourceDashboardDto = {
      schema: "resource-dashboard/1", projectPublicId: publicId, projectRevision: project.revision, catalogRevision, calendarRevision, snapshotId,
      calculatedAt: now.toISOString(), asOfDate, timezone: "Asia/Seoul", filters, range: { from, to }, rangeFallback: !dates.length && filters.from === null,
      mdPerMm: raw.mdPerMm, mdPerMmSource: raw.mdPerMmSource, scope: { assignment: "A", diagnostics: "T0", identity: snapshotId },
      summary: compact(raw.total, selector("all")),
      resources: raw.resources.map((row) => { const resource = resourceById.get(row.id)!; return { id: row.id, name: resource.name, code: resource.code, active: resource.active, resourceIds: [row.id], assignmentRange: assignmentRange(row.assignmentIds), summary: compact(row, selector("resource", row.id)), milestones: convertCells(row.milestones, "resource", row.id) }; }),
      groups: raw.groups.filter((row) => row.assignmentCount > 0).map((row) => { const group = groups.find((group) => group.publicId === row.id); return { id: row.id, name: group?.name ?? "미분류 리소스", code: group?.code ?? null, active: group?.active ?? true, resourceIds: row.resourceIds, assignmentRange: assignmentRange(row.assignmentIds), summary: compact(row, selector("group", row.id)), milestones: convertCells(row.milestones, "group", row.id) }; }),
      roleTotals: raw.roles.map((row) => ({ role: row.id as ResourceWorkloadRole, summary: compact(row, selector("role", row.id)) })),
      milestones: convertCells(raw.milestones, "all", null),
      stages: raw.fullMilestones.map((row) => { const task = taskById.get(row.milestoneTaskId)!, gate = row.stageGate;
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
    const projection = projectStageGates({ tasks, memberships, links });
    return { report, raw, taskById, resourceById, assignmentById: new Map(assignments.map((row) => [row.publicId, row])), paths, projection };
  }
}
