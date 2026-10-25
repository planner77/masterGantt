import type { LogisticsDashboardDto, LogisticsIntegratedKpiDto } from "../../src/contracts/logistics-dashboard";

/** Additive integrated projection for the existing dashboard request-state fixtures. */
export function withIntegratedKpi<T extends Pick<LogisticsDashboardDto, "effort" | "includedTaskIds" | "breakdowns" | "horizonDays" | "systemView" | "activeOnly" | "asOfDate">>(dashboard: T): T & { integrated: LogisticsIntegratedKpiDto } {
  const taskIds = dashboard.includedTaskIds;
  return { ...dashboard, integrated: {
    source: "direct+target:v1", contextSourceVersion: "explicit-task-context:v1",
    effortState: !taskIds.length ? "empty" : dashboard.effort.unsetAllocationCount > 0 ? dashboard.effort.plannedMd > 0 ? "partial" : "unset" : "configured", snapshotId: "integrated-ui-snapshot", dataSnapshotId: "integrated-ui-data",
    filters: { asOfDate: dashboard.asOfDate, horizonDays: dashboard.horizonDays, systemView: dashboard.systemView, activeOnly: dashboard.activeOnly },
    assignmentIds: [], assignmentRows: [], resourceRows: [],
    taskSources: taskIds.map(taskId => ({ taskId, processIds: dashboard.breakdowns.processes.filter(row => row.taskIds.includes(taskId)).map(row => row.id), workAreaIds: [], equipmentIds: [], systemIds: [], targetIds: [], sources: [] })),
    configuration: {
      scope: "registered configuration; independent from related Task/Assignment population",
      processIds: dashboard.breakdowns.processes.map(row => row.id), workAreaIds: [], equipmentIds: dashboard.breakdowns.equipment.map(row => row.id), equipmentQuantity: 0,
      systemIds: dashboard.breakdowns.systems.map(row => row.id), registeredResourceIds: [], participatingResourceIds: [], assignedResourceIds: [], targets: [], workAreas: [],
    },
    diagnostics: {
      scope: "full canonical Project; missing responsibility diagnostics use active masters",
      unlinkedTaskIds: [], unlinkedLeafTaskIds: [], completelyUnassignedTaskIds: [], personallyUnassignedTaskIds: [], groupOnlyTaskIds: [],
      unsetAllocationTaskIds: [], unsetAllocationAssignmentIds: [], equipmentWithoutPrimaryControllerIds: [], equipmentWithoutOwnerIds: [], systemsWithoutPrimaryPIIds: [],
      equipmentWithoutTaskIds: [], systemsWithoutTaskIds: [], targetWithoutTaskIds: [], processWithoutTaskIds: [], workAreaWithoutTaskIds: [], legacyContextTaskIds: [], explicitEmptyProcessTaskIds: [],
    },
  } };
}
