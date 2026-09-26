import type { ProjectDto, ProjectPermission } from "./projects";

export type EquipmentType =
  | "stocker"
  | "agv"
  | "amr"
  | "oht"
  | "conveyor"
  | "other";

export type ManagementUnit = "unit" | "fleet";

export type LogisticsSystemType =
  | "scs"
  | "acs"
  | "ocs"
  | "lcs"
  | "mcs"
  | "other";

export type SystemLayer = "controller" | "coordinator";

export type SystemScope = "project" | "processes";

export type ControlRole = "primary" | "supporting";

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

export interface ProjectLogisticsDto {
  processes: ProcessDto[];
  equipment: EquipmentDto[];
  systems: LogisticsSystemDto[];
  systemLinks: SystemLinkDto[];
}

export interface ProjectLogisticsResponse {
  data: {
    project: ProjectDto;
    logistics: ProjectLogisticsDto;
    permission: ProjectPermission;
  };
}

export interface CreateProcessRequest {
  code: string;
  name: string;
  parentProcessId?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface UpdateProcessRequest {
  code?: string;
  name?: string;
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
  vendor?: string;
  description?: string;
  active?: boolean;
}

export interface SetSystemProcessesRequest {
  processIds: string[];
}

export interface SetSystemChildrenRequest {
  targetSystemIds: string[];
}

export interface LogisticsMutationResponse {
  data: {
    project: ProjectDto;
    logistics: ProjectLogisticsDto;
    permission: "edit";
    operation: {
      kind: "logisticsMutation";
      entity: "process" | "equipment" | "system" | "equipmentSystems" | "systemProcesses" | "systemChildren";
      action: "create" | "update" | "delete" | "replace";
      targetPublicId?: string;
    };
  };
}
