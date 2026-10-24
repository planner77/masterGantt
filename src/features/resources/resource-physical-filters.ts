import type { ResourceDashboardFilterInput } from "../../contracts/resource-dashboard";

const PUBLIC_FILTERS = new Set([
  "resourceIds", "groupIds", "milestoneIds", "taskIds", "wbsRootIds", "roles", "developerGrades", "statuses",
  "from", "to", "asOfDate", "search", "taskSearch", "mode", "granularity", "mdPerMm", "resourceActivity", "groupActivity",
  "equipmentIds", "systemIds", "physicalEquipmentTypeCodes", "physicalSystemTypeCodes",
]);

/** Old selection IDs cannot be reinterpreted as instance IDs or hidden constraints. */
export function migrateResourcePhysicalFilters(input: ResourceDashboardFilterInput): { filters: ResourceDashboardFilterInput; changed: boolean } {
  const entries = Object.entries(input);
  return {
    filters: Object.fromEntries(entries.filter(([key]) => PUBLIC_FILTERS.has(key))),
    changed: entries.some(([key, value]) => !PUBLIC_FILTERS.has(key) && value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0)),
  };
}
