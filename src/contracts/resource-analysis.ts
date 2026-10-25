import type { WbsViewSourceContext } from "./wbs-dashboard-views";
import type { ResourceKpiTotals, ResourceKpiFilters } from "../domain/resources/resource-kpi";
import type { ResourcePlanResult } from "../domain/resources/resource-plan";
import type { WbsTaskLedgerRow, summarizeWbsTaskLedger } from "../domain/resources/wbs-task-ledger";

export const RESOURCE_ANALYSIS_DIMENSIONS = ["resource", "group", "role", "developerGrade", "milestone", "process", "workArea", "equipment", "system"] as const;
export type ResourceAnalysisDimension = typeof RESOURCE_ANALYSIS_DIMENSIONS[number];
export type ResourceAnalysisConditions = Partial<Record<ResourceAnalysisDimension, readonly (string | null)[]>>;
export type ResourceAnalysisFilters = Pick<ResourceKpiFilters, "eligibleResourceIds" | "statuses" | "search" | "taskSearch" | "includeUngrouped" | "taskIds" | "wbsRootIds" | "milestoneIds" | "resourceIds" | "groupIds" | "roles" | "developerGrades" | "equipmentIds" | "systemIds" | "physicalEquipmentTypeCodes" | "physicalSystemTypeCodes" | "directEquipmentIds" | "directSystemIds">;
/** Keep WBS identity intact. A legacy ResourceDashboard snapshot is not a WBS snapshot. */
export interface ResourceAnalysisSource { sourceContext: WbsViewSourceContext; fetchGeneration: number; filters: ResourceAnalysisFilters }
/** IDs from createWbsViewProjection(...).selected in the same authenticated read transaction.
 * This is a caller assertion, not independent snapshot authentication. The transaction owns
 * authorization, snapshot hashing, normalized filters and the exact projection ID sets. */
export type ResourceAnalysisTaskIdentity = Pick<WbsTaskLedgerRow, "taskId" | "processIds" | "workAreaIds" | "equipmentIds" | "systemIds" | "milestoneTaskId">;
export interface ResourceAnalysisSourceScope { source: ResourceAnalysisSource; taskIds: readonly string[]; assignmentIds: readonly string[]; diagnosticTaskIds: readonly string[]; taskRows: readonly ResourceAnalysisTaskIdentity[] }
export interface ResourceAnalysisTaskSource extends ResourceAnalysisTaskIdentity {
  name: string;
  status: import("../domain/resources/resource-kpi").ResourceKpiTask["status"];
  start: string | null;
  end: string | null;
  duration: number | null;
  progress: number | null;
  assignmentIds: string[];
}
export interface ResourceAnalysisExpectedResponse { source: ResourceAnalysisSource; scopeKey: string }
export interface ResourceAnalysisQuery {
  conditions?: ResourceAnalysisConditions;
  pivot?: readonly ResourceAnalysisDimension[];
  granularity?: "week" | "month";
  unit?: "M/D" | "M/M";
}
export interface ResourceAnalysisScope {
  source: ResourceAnalysisSource;
  scopeKey: string;
  conditions: ResourceAnalysisConditions;
  baseFilters: ResourceAnalysisFilters;
  range: { from: string; to: string };
  asOfDate: string;
  timezone: "Asia/Seoul";
  mdPerMm: number | null;
  unit: "M/D" | "M/M";
  pivot: readonly ResourceAnalysisDimension[];
  granularity: "week" | "month";
  sourceScope: { taskIds: string[]; assignmentIds: string[]; diagnosticTaskIds: string[]; taskRows: ResourceAnalysisTaskIdentity[] } | null;
}
export interface ResourceAnalysisSelector {
  scopeKey: string;
  conditions: ResourceAnalysisConditions;
}
export interface ResourceAnalysisCell {
  key: string;
  values: Array<{ dimension: ResourceAnalysisDimension; id: string | null }>;
  selector: ResourceAnalysisSelector;
  taskIds: string[];
  assignmentIds: string[];
  tasks: ReturnType<typeof summarizeWbsTaskLedger>["tasks"];
  assignments: ResourceKpiTotals;
}
export interface ResourceAnalysisResult {
  schema: "resource-analysis/1";
  scope: ResourceAnalysisScope;
  total: ResourceAnalysisCell;
  cells: ResourceAnalysisCell[];
  taskSources: ResourceAnalysisTaskSource[];
  projectAssignmentRows: import("../domain/resources/resource-kpi").ResourceKpiAssignmentRow[];
  assignmentRows: import("../domain/resources/resource-kpi").ResourceKpiAssignmentRow[];
  diagnostics: ReturnType<typeof summarizeWbsTaskLedger>["diagnostics"];
  participation: ReturnType<typeof summarizeWbsTaskLedger>["participation"];
  fullMilestones: ReturnType<typeof summarizeWbsTaskLedger>["fullMilestones"];
  plan: ResourcePlanResult;
  metadata: {
    subtotalsAdditive: false;
    composition: "overlapping-related-work";
    taskGrain: "distinct-taskId";
    assignmentGrain: "projectPublicId,assignmentId";
    capacityGrain: "resource-working-day";
    projectReference: "same-resources-full-project-same-period";
    diagnosticsScope: "T0-before-personal-filters";
    primaryKpis: readonly ["assignedResources", "plannedEffort", "completedAndDelayedTasks", "capacityAndLoad", "peakAndExcess", "unsetEffort"];
  };
}

/** Reuses the ResourcePlan row/demand selectors; WBS snapshot IDs stay WBS identities. */
export interface ResourceAnalysisPlanSelector {
  scopeKey: string;
  row: { kind: "resource"; resourceId: string };
  demandScope: "selected" | "project";
  periodKey: string;
  granularity: "week" | "month";
}
