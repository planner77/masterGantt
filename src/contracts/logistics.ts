import type { ProjectDto, ProjectPermission } from "./projects";

export type EquipmentType = string;

export type ManagementUnit = "unit" | "fleet";

export type LogisticsSystemType = string;

export type LogisticsTypeKind = "equipment" | "system";

export interface LogisticsTypeCatalogItemDto {
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  usageCount: number;
}

export interface LogisticsTypeCatalogResponse {
  data: {
    revision: number;
    equipmentTypes: LogisticsTypeCatalogItemDto[];
    systemTypes: LogisticsTypeCatalogItemDto[];
  };
}

export interface LogisticsActiveTypeCatalogResponse {
  data: {
    equipmentTypes: Array<Pick<LogisticsTypeCatalogItemDto, "code" | "name">>;
    systemTypes: Array<Pick<LogisticsTypeCatalogItemDto, "code" | "name">>;
  };
}

export interface CreateLogisticsTypeRequest {
  code: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateLogisticsTypeRequest {
  name?: string;
  active?: boolean;
  sortOrder?: number;
}

export type SystemLayer = "controller" | "coordinator";

export type SystemScope = "project" | "processes";

export type ControlRole = "primary" | "supporting";

export type EquipmentRole = "owner" | "contributor";
export type SystemRole = "pi" | "developer";

export interface EquipmentResourceRoleDto {
  resourceId: string; // resource public_id
  resourceCode: string;
  resourceName: string;
  role: EquipmentRole;
  isPrimary: boolean;
  active: boolean;
}

export interface SystemResourceRoleDto {
  resourceId: string; // resource public_id
  resourceCode: string;
  resourceName: string;
  role: SystemRole;
  isPrimary: boolean;
  active: boolean;
}

export interface ProcessDto {
  id: string; // public_id
  code: string;
  name: string;
  parentProcessId: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentControlSystemDto {
  systemId: string;
  controlRole: ControlRole;
}

export interface EquipmentDto {
  id: string; // public_id
  processId: string; // process public_id
  code: string;
  name: string;
  equipmentType: EquipmentType;
  managementUnit: ManagementUnit;
  quantity: number;
  manufacturer: string;
  model: string;
  description: string;
  active: boolean;
  controlSystems: EquipmentControlSystemDto[];
  resourceRoles: EquipmentResourceRoleDto[];
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsSystemDto {
  id: string; // public_id
  code: string;
  name: string;
  systemType: LogisticsSystemType;
  layer: SystemLayer;
  scope: SystemScope;
  processIds: string[];
  coordinatedSystemIds: string[];
  resourceRoles: SystemResourceRoleDto[];
  vendor: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemLinkDto {
  sourceSystemId: string;
  targetSystemId: string;
  relationType: "coordinates";
}

export type TaskLogisticsLinkScope = "self" | "subtree";

export interface TaskEquipmentLinkItem {
  equipmentId: string;
  scope: TaskLogisticsLinkScope;
  equipmentCode?: string;
  equipmentName?: string;
  equipmentType?: EquipmentType;
  active?: boolean;
}

export interface TaskSystemLinkItem {
  systemId: string;
  scope: TaskLogisticsLinkScope;
  systemCode?: string;
  systemName?: string;
  systemType?: LogisticsSystemType;
  active?: boolean;
}

export interface InheritedEquipmentLinkItem extends TaskEquipmentLinkItem {
  sourceTaskId: string;
  sourceTaskName: string;
}

export interface InheritedSystemLinkItem extends TaskSystemLinkItem {
  sourceTaskId: string;
  sourceTaskName: string;
}

export interface TaskLogisticsLinksDto {
  taskId: string;
  directEquipmentLinks: TaskEquipmentLinkItem[];
  inheritedEquipmentLinks: InheritedEquipmentLinkItem[];
  effectiveEquipmentIds: string[];
  directSystemLinks: TaskSystemLinkItem[];
  inheritedSystemLinks: InheritedSystemLinkItem[];
  effectiveSystemIds: string[];
}

export interface TaskEquipmentLinkSummaryDto {
  taskId: string;
  equipmentId: string;
  scope: TaskLogisticsLinkScope;
}

export interface TaskSystemLinkSummaryDto {
  taskId: string;
  systemId: string;
  scope: TaskLogisticsLinkScope;
}

export interface ProjectLogisticsDto {
  processes: ProcessDto[];
  equipment: EquipmentDto[];
  systems: LogisticsSystemDto[];
  systemLinks: SystemLinkDto[];
  taskEquipmentLinks?: TaskEquipmentLinkSummaryDto[];
  taskSystemLinks?: TaskSystemLinkSummaryDto[];
}

export interface ProjectLogisticsResponse {
  data: {
    project: ProjectDto;
    logistics: ProjectLogisticsDto;
    permission: ProjectPermission;
  };
}

export interface CreateProcessRequest {
  /** Optional legacy/business code. Omit to let the server generate a stable internal code. */
  code?: string;
  name: string;
  parentId?: string | null;
  /** @deprecated Compatibility alias; prefer parentId. */
  parentProcessId?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface UpdateProcessRequest {
  code?: string;
  name?: string;
  parentId?: string | null;
  /** @deprecated Compatibility alias; prefer parentId. */
  parentProcessId?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface CreateEquipmentRequest {
  processId: string;
  code: string;
  name: string;
  equipmentType: EquipmentType;
  managementUnit: ManagementUnit;
  quantity?: number;
  manufacturer?: string;
  model?: string;
  description?: string;
  active?: boolean;
}

export interface UpdateEquipmentRequest {
  processId?: string;
  code?: string;
  name?: string;
  equipmentType?: EquipmentType;
  managementUnit?: ManagementUnit;
  quantity?: number;
  manufacturer?: string;
  model?: string;
  description?: string;
  active?: boolean;
}

export interface SetEquipmentSystemsRequest {
  systems: {
    systemId: string;
    controlRole: ControlRole;
  }[];
}

export interface CreateLogisticsSystemRequest {
  code: string;
  name: string;
  systemType: LogisticsSystemType;
  layer: SystemLayer;
  scope: SystemScope;
  processIds?: string[];
  vendor?: string;
  description?: string;
  active?: boolean;
}

export interface UpdateLogisticsSystemRequest {
  code?: string;
  name?: string;
  systemType?: LogisticsSystemType;
  layer?: SystemLayer;
  scope?: SystemScope;
  processIds?: string[];
  vendor?: string;
  description?: string;
  active?: boolean;
}

export interface SetSystemProcessesRequest {
  processIds: string[];
}

export interface SetSystemChildrenRequest {
  childSystemIds?: string[];
  /** @deprecated Compatibility alias; prefer childSystemIds. */
  targetSystemIds?: string[];
}

export interface SetEquipmentResourceRolesRequest {
  roles: {
    resourceId: string;
    role: EquipmentRole;
    isPrimary?: boolean;
  }[];
}

export interface SetSystemResourceRolesRequest {
  roles: {
    resourceId: string;
    role: SystemRole;
    isPrimary?: boolean;
  }[];
}

export interface ReplaceTaskLogisticsLinksRequest {
  equipmentLinks: {
    equipmentId: string;
    scope: TaskLogisticsLinkScope;
  }[];
  systemLinks: {
    systemId: string;
    scope: TaskLogisticsLinkScope;
  }[];
}

export interface TaskLogisticsLinksResponse {
  data: {
    taskId: string;
    links: TaskLogisticsLinksDto;
    permission: ProjectPermission;
  };
}

export interface LogisticsMutationResponse {
  data: {
    project: ProjectDto;
    logistics: ProjectLogisticsDto;
    permission: "edit";
    operation: {
      kind: "logisticsMutation";
      entity:
        | "process"
        | "equipment"
        | "system"
        | "equipmentSystems"
        | "systemProcesses"
        | "systemChildren"
        | "equipmentResourceRoles"
        | "systemResourceRoles"
        | "taskLogisticsLinks";
      action: "create" | "update" | "delete" | "replace";
      targetPublicId?: string;
    };
  };
}
