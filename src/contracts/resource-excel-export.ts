import type { ResourceDashboardDetailRow, ResourceDashboardDto, ResourceDashboardFilterInput, ResourceDashboardPlanDto, ResourcePlanGranularity } from "./resource-dashboard";
import type { ResourceDrillScope, ResourceDrillSourceContext } from "./resource-drill";

export const RESOURCE_EXCEL_EXPORT_LIMITS = Object.freeze({ sheetRows: 50000, reportRows: 150000, reportCells: 1000000, workbookXmlBytes: 32 * 1024 * 1024, workbookZipBytes: 16 * 1024 * 1024 });
export interface ResourceExcelSourceBinding { sourceContext: ResourceDrillSourceContext; scope: ResourceDrillScope }
export type ResourceExcelExportOptions =
  | { basis: "current"; expectedReport: { context: ResourceDrillSourceContext; snapshotId: string; filters: ResourceDashboardFilterInput }; binding?: ResourceExcelSourceBinding; originalSourceContext?: ResourceDrillSourceContext; granularities: ResourcePlanGranularity[] }
  | { basis: "project"; expectedReport: { context: ResourceDrillSourceContext }; originalSourceContext?: ResourceDrillSourceContext; granularities: ResourcePlanGranularity[] };
export interface ResourceExcelAssignmentRow extends Omit<ResourceDashboardDetailRow, "assignment"> {
  assignment: NonNullable<ResourceDashboardDetailRow["assignment"]>; delayed: boolean;
}
export interface ResourceExcelQualityTask {
  taskId: string; name: string; externalId: string; wbsPath: { taskId: string; name: string }[];
  categories: ("completelyUnassigned" | "groupOnly" | "personallyUnassigned" | "unset")[];
}
/** Raw T0 evidence; absence from selected A is not zero planned effort. */
export interface ResourceExcelUnsetAssignment {
  assignmentId: string; taskId: string; taskName: string; resourceId: string; resourceName: string;
  groupIds: string[]; roles: string[]; assignmentStart: string | null; assignmentEnd: string | null;
  effectiveFrom: string; effectiveTo: string; allocationPercent: null; overlapsRange: boolean;
}
export interface ResourceExcelReportBundle {
  /** Server-generated validated external URL, never a request field. */
  canonicalProjectUrl?: string;
  basis: "current" | "project"; sourceContext: ResourceDrillSourceContext; originalSourceContext?: ResourceDrillSourceContext;
  scope?: ResourceDrillScope; report: ResourceDashboardDto; plans: Partial<Record<ResourcePlanGranularity, ResourceDashboardPlanDto>>;
  assignments: ResourceExcelAssignmentRow[];
  quality: { scope: "T0-before-personal-filters"; tasks: ResourceExcelQualityTask[]; unsetAssignments: ResourceExcelUnsetAssignment[] };
}
