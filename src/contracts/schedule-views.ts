import type { EquipmentDto, LogisticsTypeCatalogItemDto, TaskLogisticsLinksDto } from "./logistics";
import type { ProjectAssignmentDto, ResourceDto, ResourceGroupDto } from "./resources";

/** Read-only metadata for schedule presentation, never a replacement Task ledger. */
export interface ScheduleViewSourceDto {
  schema: "schedule-view-source/1";
  projectPublicId: string;
  projectRevision: number;
  catalogRevision: number;
  logisticsTypeCatalogRevision: number;
  assignments: ProjectAssignmentDto[];
  resources: Array<Pick<ResourceDto, "id" | "name" | "active">>;
  groups: Array<Pick<ResourceGroupDto, "id" | "name" | "active" | "memberResourceIds" | "translations">>;
  equipment: Array<Pick<EquipmentDto, "id" | "name" | "active" | "equipmentType" | "model" | "managementUnit" | "quantity" | "translations">>;
  equipmentTypes: Array<Pick<LogisticsTypeCatalogItemDto, "code" | "name" | "active" | "translations">>;
  /** Equipment-only projection of the existing direct/subtree/archive resolver. */
  taskEquipment: TaskLogisticsLinksDto[];
}

export interface ScheduleViewSourceResponse {
  data: ScheduleViewSourceDto;
}
