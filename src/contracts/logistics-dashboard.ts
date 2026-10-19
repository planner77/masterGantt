import type { MdPerMmSource, MilestoneDashboardStageDto } from "./milestone-dashboard";

export interface LogisticsDashboardFilterInput {
  asOfDate?: string;
  horizonDays?: number;
  systemView?: "direct" | "coordination";
  activeOnly?: boolean;
  processIds?: string[];
  equipmentIds?: string[];
  systemIds?: string[];
  taskAssigneeResourceIds?: string[];
  roleResourceIds?: string[];
  includeDescendantProcesses?: boolean;
  mdPerMm?: number | null;
}

export interface LogisticsDashboardKpiDto {
  progressPercent: number | null;
  totalDuration: number;
  taskCount: number;
  overdueTaskCount: number;
  overdueTaskIds: string[];
  milestoneTotalCount: number;
  milestoneOverdueCount: number;
  milestoneOverdueIds: string[];
  milestoneUpcomingCount: number;
  milestoneUpcomingIds: string[];
}

export interface LogisticsDashboardEffortDto {
  plannedMd: number;
  plannedMm: number | null;
  mdPerMm: number | null;
  mdPerMmSource?: MdPerMmSource;
  unsetAllocationCount: number;
  workloadRange: {
    from: string | null;
    to: string | null;
  };
}

export interface LogisticsDashboardQualityDiagnosticsDto {
  unlinkedLeafTaskCount: number;
  totalLeafTaskCount: number;
  unlinkedLeafTaskPercent: number | null;
  equipmentWithoutPrimaryControllerCount: number;
  equipmentWithoutOwnerCount: number;
  systemsWithoutPrimaryPICount: number;
  totalEquipmentMasterCount: number;
  totalEquipmentQuantity: number;
}

export interface LogisticsDashboardProcessRowDto {
  id: string;
  code: string;
  name: string;
  active: boolean;
  taskCount: number;
  progressPercent: number | null;
  overdueTaskCount: number;
  plannedMd: number;
  taskIds: string[];
}

export interface LogisticsDashboardEquipmentRowDto {
  id: string;
  code: string;
  name: string;
  equipmentType: string;
  quantity: number;
  processId: string;
  processName: string | null;
  primaryControllerName: string | null;
  ownerName: string | null;
  active: boolean;
  taskCount: number;
  progressPercent: number | null;
  overdueTaskCount: number;
  plannedMd: number;
  taskIds: string[];
}

export interface LogisticsDashboardSystemRowDto {
  id: string;
  code: string;
  name: string;
  systemType: string;
  layer: string;
  primaryPIName: string | null;
  active: boolean;
  taskCount: number;
  progressPercent: number | null;
  overdueTaskCount: number;
  plannedMd: number;
  taskIds: string[];
}

export interface LogisticsDashboardDto {
  integrated?: LogisticsIntegratedKpiDto;
  /** Additive full-stage projection; existing KPI/effort/included ID scopes are unchanged. */
  milestoneStages?: { milestoneTaskIds: string[]; rows: MilestoneDashboardStageDto[] };
  projectRevision: number;
  catalogRevision: number;
  asOfDate: string;
  timezone: string;
  calculatedAt: string;
  horizonDays: number;
  systemView: "direct" | "coordination";
  activeOnly: boolean;
  kpi: LogisticsDashboardKpiDto;
  effort: LogisticsDashboardEffortDto;
  quality: LogisticsDashboardQualityDiagnosticsDto;
  breakdowns: {
    processes: LogisticsDashboardProcessRowDto[];
    equipment: LogisticsDashboardEquipmentRowDto[];
    systems: LogisticsDashboardSystemRowDto[];
  };
  includedTaskIds: string[];
  includedMilestoneIds: string[];
}

export interface LogisticsDashboardResponse {
  data: LogisticsDashboardDto;
}

/** Explicit opt-in consumer. The historical /logistics/dashboard response stays unchanged. */
export interface LogisticsIntegratedKpiDto {
  source: "direct+target:v1";
  contextSourceVersion: "explicit-task-context:v1";
  snapshotId: string;
  dataSnapshotId: string;
  filters: LogisticsDashboardFilterInput;
  assignmentIds: string[];
  effortState: "empty" | "configured" | "partial" | "unset";
  assignmentRows: Array<{ id: string; taskId: string; targetKind: "resource" | "group"; targetId: string; targetName: string; allocationPercent: number | null }>;
  resourceRows: Array<{ id: string; name: string; code: string | null }>;
  taskSources: Array<{
    taskId: string;
    processIds: string[];
    workAreaIds: string[];
    equipmentIds: string[];
    systemIds: string[];
    targetIds: string[];
    sources: import("../domain/resources/wbs-task-ledger").WbsTaskLedgerSource[];
  }>;
  configuration: {
    scope: "registered configuration; independent from related Task/Assignment population";
    processIds: string[];
    workAreaIds: string[];
    equipmentIds: string[];
    equipmentQuantity: number;
    systemIds: string[];
    registeredResourceIds: string[];
    participatingResourceIds: string[];
    assignedResourceIds: string[];
    targets: Array<{ id: string; name: string; active: boolean; taskIds: string[] }>;
    workAreas: Array<{ id: string; name: string; active: boolean; processIds: string[]; taskIds: string[]; assignmentIds: string[]; equipmentIds: string[]; equipmentQuantity: number }>;
  };
  diagnostics: {
    scope: "full canonical Project; missing responsibility diagnostics use active masters";
    unlinkedTaskIds: string[];
    unlinkedLeafTaskIds: string[];
    completelyUnassignedTaskIds: string[];
    personallyUnassignedTaskIds: string[];
    groupOnlyTaskIds: string[];
    unsetAllocationTaskIds: string[];
    unsetAllocationAssignmentIds: string[];
    equipmentWithoutPrimaryControllerIds: string[];
    equipmentWithoutOwnerIds: string[];
    systemsWithoutPrimaryPIIds: string[];
    equipmentWithoutTaskIds: string[];
    systemsWithoutTaskIds: string[];
    targetWithoutTaskIds: string[];
    processWithoutTaskIds: string[];
    workAreaWithoutTaskIds: string[];
    legacyContextTaskIds: string[];
    explicitEmptyProcessTaskIds: string[];
  };
}
