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
