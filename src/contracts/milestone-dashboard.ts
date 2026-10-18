import type { ResourceDrillSourceContext, ResourceScopeUnavailableReason } from "./resource-drill";
import type { MilestoneStageGateDto } from "./milestones";
import type { TaskStatus } from "./projects";
import type { DeveloperGrade, ResourceRole, ResourceWorkloadRole } from "./resources";

export type MilestoneDashboardGrade = DeveloperGrade | "UNSPECIFIED";
export type MdPerMmSource = "query" | "environment" | "unset";

export interface MilestoneDashboardFilterInput {
  search?: string;
  milestoneIds?: string[];
  asOfDate?: string;
  horizonDays?: number;
  from?: string;
  to?: string;
  resourceIds?: string[];
  assignmentRoles?: ResourceWorkloadRole[];
  developerGrades?: MilestoneDashboardGrade[];
  processIds?: string[];
  equipmentIds?: string[];
  systemIds?: string[];
  roleResourceIds?: string[];
  systemView?: "direct" | "coordination";
  activeOnly?: boolean;
  includeDescendantProcesses?: boolean;
  mdPerMm?: number | null;
}

/** Request echo retains omitted date inputs; resolved dates are separate DTO fields. */
export interface MilestoneDashboardFiltersDto {
  search: string;
  milestoneIds: string[];
  asOfDate: string | null;
  horizonDays: number;
  from: string | null;
  to: string | null;
  resourceIds: string[];
  assignmentRoles: ResourceWorkloadRole[];
  developerGrades: MilestoneDashboardGrade[];
  processIds: string[];
  equipmentIds: string[];
  systemIds: string[];
  roleResourceIds: string[];
  systemView: "direct" | "coordination";
  activeOnly: boolean;
  includeDescendantProcesses: boolean;
  mdPerMm: number | null;
  mdPerMmProvided: boolean;
}

export interface MilestoneDashboardCountDto {
  count: number;
  milestoneTaskIds: string[];
}

export interface MilestoneDashboardEffortDto {
  plannedMd: number;
  plannedMm: number | null;
  assignmentIds: string[];
  unsetAssignmentIds: string[];
  unsetAllocationCount: number;
  roleTotals: { role: ResourceWorkloadRole; plannedMd: number; plannedMm: number | null; assignmentIds: string[]; unsetAssignmentIds: string[] }[];
}

/** Gate and risk always use complete E(M) and P(M), independently of visible filters. */
export interface MilestoneDashboardStageDto {
  milestoneTaskId: string;
  name: string;
  externalId: string;
  scheduledDate: string;
  status: TaskStatus;
  progress: number;
  stageGate: MilestoneStageGateDto;
  memberDurationSum: number;
  memberWeightedProgressSum: number;
  overdue: boolean;
  upcoming: boolean;
  atRisk: boolean;
  riskTaskIds: string[];
  risks: { taskId: string; name: string; end: string; scheduledDate: string }[];
}

export interface MilestoneDashboardRowDto extends MilestoneDashboardStageDto {
  scopedTaskIds: string[];
  effort: MilestoneDashboardEffortDto;
}

export interface MilestoneDashboardAssignmentDto {
  assignmentId: string;
  taskId: string;
  milestoneTaskId: string | null;
  resourceId: string;
  roles: ResourceWorkloadRole[];
  developerGrade: MilestoneDashboardGrade;
  from: string;
  to: string;
  allocationPercent: number | null;
  effectiveWorkingDays: number;
  plannedMd: number | null;
  plannedMm: number | null;
}

export interface MilestoneDashboardDto {
  resourceScopeContext?: ResourceDrillSourceContext | null;
  resourceScopeUnavailableReason?: ResourceScopeUnavailableReason | null;
  projectPublicId: string;
  projectRevision: number;
  catalogRevision: number;
  calculatedAt: string;
  timezone: "Asia/Seoul";
  asOfDate: string;
  horizonDays: number;
  filters: MilestoneDashboardFiltersDto;
  workloadRange: { from: string; to: string };
  mdPerMm: number | null;
  mdPerMmSource: MdPerMmSource;
  kpi: {
    completion: { numerator: number; denominator: number; percent: number | null; completedMilestoneTaskIds: string[]; milestoneTaskIds: string[] };
    ready: MilestoneDashboardCountDto;
    blocked: MilestoneDashboardCountDto;
    overdue: MilestoneDashboardCountDto;
    upcoming: MilestoneDashboardCountDto;
    atRisk: MilestoneDashboardCountDto;
    coverage: { numerator: number; denominator: number; percent: number | null; assignedTaskIds: string[]; taskIds: string[] };
  };
  rows: MilestoneDashboardRowDto[];
  scope: { taskIds: string[]; assignmentIds: string[]; milestoneTaskIds: string[] };
  /** All F buckets, including hidden stages and the null bucket; rows(S) are not the total's denominator. */
  effort: MilestoneDashboardEffortDto & {
    buckets: (MilestoneDashboardEffortDto & { milestoneTaskId: string | null; taskIds: string[] })[];
    assignments: MilestoneDashboardAssignmentDto[];
  };
  catalog: {
    milestones: { id: string; name: string; externalId: string }[];
    resources: { id: string; name: string; code: string | null; active: boolean; developerGrade: DeveloperGrade | null; roles: ResourceRole[] }[];
    processes: { id: string; code: string; name: string; active: boolean }[];
    equipment: { id: string; code: string; name: string; active: boolean }[];
    systems: { id: string; code: string; name: string; active: boolean }[];
  };
}

export interface MilestoneDashboardResponse { data: MilestoneDashboardDto }
