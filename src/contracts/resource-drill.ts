import type { ResourceDashboardDetailInput, ResourceDashboardDto, ResourceDashboardDetailsDto, ResourceDashboardFilterInput, ResourceDashboardFilters, ResourceDashboardGroupChildrenDto, ResourceDashboardGroupChildrenInput, ResourceDashboardSelector, ResourcePlanDetailInput, ResourcePlanDetailsDto } from "./resource-dashboard";

export const RESOURCE_DRILL_LIMITS = Object.freeze({ bodyBytes: 1024 * 1024, nodes: 5000, assignments: 8000 });
export interface ResourceDataContext {
  projectPublicId: string; projectRevision: number; catalogRevision: number; calendarRevision: string; dataSnapshotId: string;
}
export type ResourceDrillSourceProjection =
  | { kind: "schedule" }
  | { kind: "milestoneReport" }
  | { kind: "report" }
  | { kind: "details"; selector: ResourceDashboardSelector; view: "tasks" | "assignments" }
  | { kind: "groupChildren"; groupId: string | null; milestoneTaskId?: string | null }
  | { kind: "plan"; granularity: "week" | "month"; periodId: string; selector: ResourcePlanDetailInput["selector"]; demandScope: "selected" | "project"; date?: string };
export interface ResourceDrillSourceContext extends ResourceDataContext {
  range: { from: string; to: string }; asOfDate: string; mdPerMm: number | null;
  mdPerMmSource: "query" | "environment" | "unset"; mdPerMmProvided: boolean;
  sourceProjection: ResourceDrillSourceProjection;
}
export type ResourceDrillScope =
  | { kind: "scheduleSelection"; nodeIds: string[] }
  | { kind: "summarySubtree"; rootId: string }
  | { kind: "exactAssignments"; assignmentIds: string[] };
export type ResourceDrillProjection =
  | { kind: "report" }
  | ({ kind: "details" } & ResourceDashboardDetailInput)
  | ({ kind: "groupChildren" } & ResourceDashboardGroupChildrenInput)
  | ({ kind: "planDaily" | "planDayResources" | "planDayAssignments" } & ResourcePlanDetailInput)
  | { kind: "scope"; target: "dashboard"; snapshotId: string; selector: ResourceDashboardSelector }
  | { kind: "scope"; target: "plan"; snapshotId: string; granularity: "week" | "month"; periodId: string; selector: ResourcePlanDetailInput["selector"]; demandScope: "selected" | "project"; date?: string };
export interface ResourceDrillQueryInput {
  sourceContext: ResourceDrillSourceContext; scope: ResourceDrillScope;
  filters: ResourceDashboardFilterInput; projection: ResourceDrillProjection;
}
export interface ResourceDrillEcho {
  sourceContext: ResourceDrillSourceContext; scope: ResourceDrillScope;
  targetFilters: ResourceDashboardFilters; projection: ResourceDrillProjection;
  /** Selected A/T0 restrictions never narrow the Plan's explicitly labelled Project reference. */
  assignmentScope: "exact-source-intersection"; projectReferenceScope: "same-resource-population-and-period";
}
export interface ResourceDrillScopeDto {
  schema: "resource-dashboard/1"; snapshotId: string; sourceContext: ResourceDrillSourceContext;
  taskIds: string[]; assignmentIds: string[]; taskCount: number; assignmentCount: number;
  /** Ancestor summaries are context only, never part of taskCount. */
  ancestorSummaryIds: string[];
}
export type ResourceDrillQueryData = ResourceDashboardDto | ResourceDashboardDetailsDto | ResourceDashboardGroupChildrenDto | ResourcePlanDetailsDto | ResourceDrillScopeDto;
export interface ResourceDrillQueryResponse { data: ResourceDrillQueryData; drill: ResourceDrillEcho }
export type ResourceDrillScopeRequest =
  | { view: "context" }
  | { view: "dashboard"; filters: ResourceDashboardFilterInput; snapshotId: string; selector: ResourceDashboardSelector }
  | { view: "plan"; filters: ResourceDashboardFilterInput; detail: ResourcePlanDetailInput };
export type ResourceScopeUnavailableReason = "limit-exceeded";
