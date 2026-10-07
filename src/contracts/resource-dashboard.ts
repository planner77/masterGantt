import type { TaskStatus } from "./projects";
import type { DeveloperGrade, ResourceWorkloadRole } from "./resources";
import type { ResourcePlanResult, ResourcePlanResourceSeries, ResourcePlanGroupSeries, ResourcePlanRowSelector, ResourcePlanDemandScope, ResourcePlanGranularity, ResourcePlanDailyRow, ResourcePlanDayResourceRow, ResourcePlanDayAssignmentRow } from "../domain/resources/resource-plan";

export const RESOURCE_PLAN_LIMITS = Object.freeze({ resourceDays: 200000, assignmentDays: 1000000, matrixCells: 5000 });
export type { ResourcePlanRowSelector, ResourcePlanDemandScope, ResourcePlanGranularity };

export const RESOURCE_DASHBOARD_LIMITS = Object.freeze({ tasks: 5000, assignments: 8000, links: 20000, calendarRules: 20000, calendarDates: 20000, catalogMemberships: 16000,
  rangeDays: 366, idsPerField: 200, totalIds: 400, groupsPerResource: 32, groupAssignmentRows: 16000,
  cells: 5000, wbsPathEntries: 50000, wbsPathChars: 20000, reportBytes: 2 * 1024 * 1024, detailPage: 100, detailOffset: 8000 });
export interface ResourceDashboardFilterInput {
  from?: string; to?: string; asOfDate?: string;
  search?: string; taskSearch?: string;
  mode?: "resource" | "group";
  granularity?: ResourcePlanGranularity;
  resourceActivity?: "all" | "active" | "inactive"; groupActivity?: "all" | "active" | "inactive";
  resourceIds?: string[]; groupIds?: string[]; milestoneIds?: string[]; taskIds?: string[]; wbsRootIds?: string[];
  roles?: ResourceWorkloadRole[]; developerGrades?: (DeveloperGrade | "UNSPECIFIED")[]; statuses?: TaskStatus[];
  mdPerMm?: number | null;
}
export interface ResourceDashboardFilters {
  from: string | null; to: string | null; asOfDate: string | null; search: string; taskSearch: string;
  mode: "resource" | "group";
  granularity?: ResourcePlanGranularity;
  resourceActivity: "all" | "active" | "inactive"; groupActivity: "all" | "active" | "inactive";
  resourceIds: string[]; groupIds: string[]; milestoneIds: string[]; taskIds: string[]; wbsRootIds: string[];
  roles: ResourceWorkloadRole[]; developerGrades: (DeveloperGrade | "UNSPECIFIED")[]; statuses: TaskStatus[];
  mdPerMm: number | null; mdPerMmProvided: boolean;
}
export type ResourceDashboardMetric = "all" | "notStarted" | "inProgress" | "completed" | "delayed" | "unset" | "completelyUnassigned" | "groupOnly" | "personallyUnassigned";
export interface ResourceDashboardSelector {
  dimension: "all" | "resource" | "group" | "role" | "milestone" | "diagnostic";
  id: string | null;
  milestoneTaskId?: string | null;
  metric: ResourceDashboardMetric;
  resourceId?: string;
  assignmentScope?: "selected" | "milestoneReference" | "milestoneExcluded";
}
export interface ResourceDashboardEffort {
  knownMd: number; plannedMd: number | null; plannedMm: number | null;
  state: "empty" | "configured" | "partial" | "unset"; partial: boolean; unsetCount: number;
}
export interface ResourceDashboardSummary {
  taskCount: number; resourceCount: number; assignmentCount: number;
  notStarted: number; inProgress: number; completed: number; delayed: number;
  completion: { numerator: number; denominator: number; percent: number | null };
  assignedTaskProgress: { numerator: number; denominator: number; percent: number | null };
  effort: ResourceDashboardEffort;
  selector: ResourceDashboardSelector;
}
export interface ResourceDashboardCell { milestoneTaskId: string | null; summary: ResourceDashboardSummary }
export interface ResourceDashboardRow {
  id: string | null; name: string; code: string | null; active: boolean;
  summary: ResourceDashboardSummary; milestones: ResourceDashboardCell[];
  /** Project-connected members only. This is not the global Group membership list. */
  resourceIds: string[];
  assignmentRange: { from: string; to: string } | null;
}
export interface ResourceDashboardStage {
  milestoneTaskId: string; name: string; scheduledDate: string | null; status: TaskStatus;
  full: { memberCount: number; completedMemberCount: number; memberProgressPercent: number | null;
    predecessorCount: number; incompletePredecessorCount: number; ready: boolean | null; blocked: boolean;
    manualEvent: boolean; completionInconsistent: boolean };
  selected: ResourceDashboardSummary;
}
export interface ResourceDashboardDto {
  plan?: ResourceDashboardPlanDto;
  schema: "resource-dashboard/1"; projectPublicId: string; projectRevision: number; catalogRevision: number;
  calendarRevision: string; snapshotId: string; calculatedAt: string; asOfDate: string; timezone: "Asia/Seoul";
  filters: ResourceDashboardFilters; range: { from: string; to: string }; rangeFallback: boolean;
  mdPerMm: number | null; mdPerMmSource: "query" | "environment" | "unset";
  scope: { assignment: "A"; diagnostics: "T0"; identity: string };
  reference?: ResourceDashboardSummary; excluded?: ResourceDashboardSummary;
  milestoneSelection?: { applied: boolean; reference: "A without Milestone filter"; excluded: "reference Assignment IDs minus selected Assignment IDs" };
  summary: ResourceDashboardSummary; resources: ResourceDashboardRow[]; groups: ResourceDashboardRow[];
  roleTotals: { role: ResourceWorkloadRole; summary: ResourceDashboardSummary }[];
  milestones: ResourceDashboardCell[]; stages: ResourceDashboardStage[];
  diagnostics: { denominator: number; completelyUnassigned: { count: number; selector: ResourceDashboardSelector };
    groupOnly: { count: number; selector: ResourceDashboardSelector }; personallyUnassigned: { count: number; selector: ResourceDashboardSelector };
    unsetTasks: { count: number; selector: ResourceDashboardSelector }; unsetAssignmentCount: number;
    inapplicableFilters: string[]; personalFiltersAppliedToA: boolean };
  catalog: { resources: { id: string; name: string; code: string | null; active: boolean; roles: ResourceWorkloadRole[]; developerGrade: DeveloperGrade | null; groupIds: string[] }[];
    groups: { id: string; name: string; code: string | null; active: boolean }[];
    milestones: { id: string; name: string }[]; wbsRoots: { id: string; name: string; type: "task" | "summary" | "milestone" }[] };
  metadata: { groupRoleSubtotalsAdditive: false; precision: "raw"; diagnosticsScope: string; searchScope: string;
    historicalStateRestoration: false; totalFrom: "full selected assignment set"; limits: typeof RESOURCE_DASHBOARD_LIMITS };
}
export interface ResourceDashboardDetailInput {
  snapshotId: string; selector: ResourceDashboardSelector; view: "tasks" | "assignments"; offset: number; limit: number;
}
export interface ResourceDashboardDetailRow {
  taskId: string; taskName: string; externalId: string; status: TaskStatus; progress: number | null;
  taskStart: string | null; taskEnd: string | null; duration: number | null;
  wbsPath: { taskId: string; name: string }[];
  effectiveMilestoneTaskId: string | null; explicitMilestoneTaskId: string | null; inheritedFromTaskId: string | null;
  assignment: { assignmentId: string; resourceId: string; resourceName: string; resourceCode: string | null;
    active: boolean; roles: ResourceWorkloadRole[]; developerGrade: DeveloperGrade | null; groupIds: string[];
    assignmentStart: string | null; assignmentEnd: string | null; from: string; to: string; allocationPercent: number | null;
    effectiveWorkingDays: number; plannedMd: number | null; plannedMm: number | null } | null;
}
export interface ResourceDashboardDetailsDto {
  schema: "resource-dashboard/1"; snapshotId: string; projectPublicId: string; projectRevision: number; catalogRevision: number; calendarRevision: string;
  selector: ResourceDashboardSelector; view: "tasks" | "assignments"; offset: number; limit: number; totalCount: number;
  nextOffset: number | null; rows: ResourceDashboardDetailRow[];
}
export interface ResourceDashboardResponse { data: ResourceDashboardDto }
export interface ResourceDashboardDetailsResponse { data: ResourceDashboardDetailsDto }

export interface ResourceDashboardGroupChildrenInput {
  snapshotId: string; groupId: string | null; milestoneTaskId?: string | null; offset: number; limit: number;
}
export interface ResourceDashboardGroupChildrenDto {
  schema: "resource-dashboard/1"; snapshotId: string; projectPublicId: string; projectRevision: number; catalogRevision: number; calendarRevision: string;
  groupId: string | null; milestoneTaskId?: string | null; filters: ResourceDashboardFilters; range: { from: string; to: string }; asOfDate: string; mdPerMm: number | null; mdPerMmSource: "query" | "environment" | "unset"; summary: ResourceDashboardSummary;
  offset: number; limit: number; totalCount: number; nextOffset: number | null; rows: ResourceDashboardRow[];
}
export interface ResourceDashboardGroupChildrenResponse { data: ResourceDashboardGroupChildrenDto }

export interface ResourcePlanPersonMetadata {
  name: string; code: string | null; active: boolean; groupIds: string[];
  roles: ResourceWorkloadRole[]; developerGrade: DeveloperGrade | null;
}
export interface ResourceDashboardPlanDto extends Omit<ResourcePlanResult, "resources" | "groups" | "metadata"> {
  resources: (Omit<ResourcePlanResourceSeries, "milestones"> & ResourcePlanPersonMetadata & { milestones: (ResourcePlanResourceSeries["milestones"][number] & { name: string; scheduledDate: string | null })[] })[];
  groups: (ResourcePlanGroupSeries & { name: string; code: string | null; active: boolean })[];
  metadata: ResourcePlanResult["metadata"] & { limits: typeof RESOURCE_PLAN_LIMITS; populationScope: "ordinary-task-personal-assignment-history-classification-only"; groupDisplayScope: "selected-group-and-activity" };
}
export type ResourcePlanDetailKind = "daily" | "day-resources" | "day-assignments";
export interface ResourcePlanDetailInput {
  snapshotId: string; granularity: ResourcePlanGranularity; periodId: string; selector: ResourcePlanRowSelector;
  demandScope: ResourcePlanDemandScope; date?: string; offset: number; limit: number;
}
export interface ResourcePlanDetailContext extends ResourcePlanDetailInput {
  schema: "resource-dashboard/1"; projectPublicId: string; projectRevision: number; catalogRevision: number; calendarRevision: string;
  filters: ResourceDashboardFilters; range: { from: string; to: string }; asOfDate: string; mdPerMm: number | null; mdPerMmSource: "query" | "environment" | "unset";
  totalCount: number; nextOffset: number | null;
}
export interface ResourcePlanDailyDto extends ResourcePlanDetailContext { view: "daily"; rows: ResourcePlanDailyRow[] }
export interface ResourcePlanDayResourcesDto extends ResourcePlanDetailContext { view: "day-resources"; rows: (ResourcePlanDayResourceRow & ResourcePlanPersonMetadata)[] }
export interface ResourcePlanDayAssignmentsDto extends ResourcePlanDetailContext { view: "day-assignments"; rows: (ResourcePlanDayAssignmentRow & { taskName: string; externalId: string; taskStart: string | null; taskEnd: string | null; assignmentStart: string | null; assignmentEnd: string | null; milestoneName: string; wbsPath: { taskId: string; name: string }[] })[] }
export type ResourcePlanDetailsDto = ResourcePlanDailyDto | ResourcePlanDayResourcesDto | ResourcePlanDayAssignmentsDto;
