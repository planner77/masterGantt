import type { LogisticsIntegratedKpiDto } from "@/contracts/logistics-dashboard";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === "string" && id.length > 0) && new Set(value).size === value.length;

/** Fail closed: the opt-in KPI must never consume a historical dashboard payload. */
export function integratedKpiValid(value: unknown): value is LogisticsIntegratedKpiDto {
  if (!record(value) || value.source !== "direct+target:v1" || value.contextSourceVersion !== "explicit-task-context:v1" || typeof value.snapshotId !== "string" || !value.snapshotId || typeof value.dataSnapshotId !== "string" || !value.dataSnapshotId || !record(value.filters) || !ids(value.assignmentIds)) return false;
  if (!["empty", "configured", "partial", "unset"].includes(String(value.effortState))) return false;
  for (const key of ["processIds", "equipmentIds", "systemIds", "taskAssigneeResourceIds", "roleResourceIds"]) {
    if (value.filters[key] !== undefined && !ids(value.filters[key])) return false;
  }
  const configuration = value.configuration, diagnostics = value.diagnostics;
  if (!record(configuration) || !record(diagnostics)) return false;
  if (!["processIds", "workAreaIds", "equipmentIds", "systemIds", "registeredResourceIds", "participatingResourceIds", "assignedResourceIds"].every(key => ids(configuration[key]))) return false;
  if (typeof configuration.equipmentQuantity !== "number" || !Number.isFinite(configuration.equipmentQuantity) || configuration.equipmentQuantity < 0) return false;
  if (!["unlinkedTaskIds", "unlinkedLeafTaskIds", "completelyUnassignedTaskIds", "personallyUnassignedTaskIds", "groupOnlyTaskIds", "unsetAllocationTaskIds", "unsetAllocationAssignmentIds", "equipmentWithoutPrimaryControllerIds", "equipmentWithoutOwnerIds", "systemsWithoutPrimaryPIIds", "equipmentWithoutTaskIds", "systemsWithoutTaskIds", "targetWithoutTaskIds", "processWithoutTaskIds", "workAreaWithoutTaskIds", "legacyContextTaskIds", "explicitEmptyProcessTaskIds"].every(key => ids(diagnostics[key]))) return false;
  if (!Array.isArray(value.taskSources) || !value.taskSources.every(row => record(row) && typeof row.taskId === "string" && ["processIds", "workAreaIds", "equipmentIds", "systemIds", "targetIds"].every(key => ids(row[key])) && Array.isArray(row.sources))) return false;
  if (!Array.isArray(configuration.targets) || !configuration.targets.every(row => record(row) && typeof row.id === "string" && typeof row.name === "string" && typeof row.active === "boolean" && ids(row.taskIds))) return false;
  if (!Array.isArray(configuration.workAreas) || !configuration.workAreas.every(row => record(row) && typeof row.id === "string" && typeof row.name === "string" && typeof row.active === "boolean" && ["taskIds", "assignmentIds", "equipmentIds", "processIds"].every(key => ids(row[key])) && typeof row.equipmentQuantity === "number" && Number.isFinite(row.equipmentQuantity))) return false;
  if (!Array.isArray(value.assignmentRows) || !value.assignmentRows.every(row => record(row) && ["id", "taskId", "targetId", "targetName"].every(key => typeof row[key] === "string") && (row.targetKind === "resource" || row.targetKind === "group") && (row.allocationPercent === null || typeof row.allocationPercent === "number" && Number.isFinite(row.allocationPercent)))) return false;
  if (!Array.isArray(value.resourceRows) || !value.resourceRows.every(row => record(row) && typeof row.id === "string" && typeof row.name === "string" && (row.code === null || typeof row.code === "string"))) return false;
  for (const rows of [value.taskSources, value.assignmentRows, value.resourceRows, configuration.targets, configuration.workAreas]) {
    const keys = rows.map((row: Record<string, unknown>) => row.taskId && !row.id ? row.taskId : row.id);
    if (new Set(keys).size !== keys.length) return false;
  }
  if (!value.taskSources.every(row => row.sources.every((source: unknown) => record(source) && ["relationKind", "sourceKind", "dimension", "entityId"].every(key => typeof source[key] === "string" && source[key].length > 0)))) return false;
  return true;
}
