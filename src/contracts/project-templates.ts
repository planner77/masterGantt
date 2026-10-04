import type { ControlRole, EquipmentRole, EquipmentType, LogisticsSystemType, ManagementUnit, SystemLayer, SystemRole, SystemScope } from "./logistics";
import type { DependencyType, ProjectDto, ProjectLinkDto, ProjectTaskDto } from "./projects";
import type { ProjectAssignmentDto } from "./resources";

export interface ProjectTemplateDto {
  id: string; // public_id
  name: string;
  description: string;
  sourceProjectId: string | null;
  sourceProjectName: string | null;
  active: boolean;
  taskCount: number;
  milestoneCount: number;
  processCount: number;
  equipmentCount: number;
  systemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplatePreviewTask {
  externalId: string;
  name: string;
  type: "task" | "summary" | "milestone";
  scheduleMode: "auto" | "manual";
  offsetDays: number | null;
  duration: number | null;
  parentExternalId: string | null;
  siblingOrder: number;
  description?: string;
  url?: string;
}

export interface ProjectTemplateDetailDto extends ProjectTemplateDto {
  previewTasks: ProjectTemplatePreviewTask[];
  sourceRevision: number;
}

export interface TemplateTaskSnapshotItem {
  externalId: string;
  name: string;
  type: "task" | "summary" | "milestone";
  scheduleMode: "auto" | "manual";
  offsetDays: number | null; // reference start로부터의 working days offset
  duration: number | null; // working days
  parentExternalId: string | null;
  siblingOrder: number;
  description?: string;
  url?: string;
}

export interface TemplateLinkSnapshotItem {
  predecessorExternalId: string;
  successorExternalId: string;
  type: DependencyType;
  lag: number;
}

export interface TemplateAssignmentSnapshotItem {
  taskExternalId: string;
  kind: "resource" | "group";
  targetPublicId: string;
  offsetStartDays?: number | null;
  offsetEndDays?: number | null;
  allocationPercent: number | null;
  assignmentRole?: "PI" | "DEVELOPER" | "EQUIPMENT_OWNER" | null;
}

export interface TemplateProcessSnapshotItem {
  code: string;
  name: string;
  parentCode: string | null;
  sortOrder: number;
  active: boolean;
}

export interface TemplateEquipmentSnapshotItem {
  code: string;
  name: string;
  equipmentType: EquipmentType;
  managementUnit: ManagementUnit;
  quantity: number;
  processCode: string;
  controlSystems: Array<{ systemCode: string; controlRole: ControlRole }>;
  resourceRoles: Array<{ resourcePublicId: string; role: EquipmentRole; isPrimary: boolean }>;
  manufacturer?: string;
  model?: string;
  description?: string;
  active: boolean;
}

export interface TemplateSystemSnapshotItem {
  code: string;
  name: string;
  systemType: LogisticsSystemType;
  layer: SystemLayer;
  scope: SystemScope;
  processCodes: string[];
  coordinatedSystemCodes: string[];
  resourceRoles: Array<{ resourcePublicId: string; role: SystemRole; isPrimary: boolean }>;
  vendor?: string;
  description?: string;
  active: boolean;
}

export interface TemplateTaskEquipmentLinkSnapshotItem {
  taskExternalId: string;
  equipmentCode: string;
  scope: "self" | "subtree";
}

export interface TemplateTaskSystemLinkSnapshotItem {
  taskExternalId: string;
  systemCode: string;
  scope: "self" | "subtree";
}

export interface ProjectTemplateSnapshot {
  sourceRevision: number;
  projectMaster?: {
    businessUnitId: string | null;
    productId: string | null;
    siteEntityId: string | null;
  };
  calendar: {
    timezone: string;
    weekendDays: number[];
    holidays: Array<{ date: string; name?: string }>;
  };
  tasks: TemplateTaskSnapshotItem[];
  links: TemplateLinkSnapshotItem[];
  assignments: TemplateAssignmentSnapshotItem[];
  logistics?: {
    processes: TemplateProcessSnapshotItem[];
    equipment: TemplateEquipmentSnapshotItem[];
    systems: TemplateSystemSnapshotItem[];
    taskEquipmentLinks: TemplateTaskEquipmentLinkSnapshotItem[];
    taskSystemLinks: TemplateTaskSystemLinkSnapshotItem[];
  };
}

export interface CreateProjectTemplateRequest {
  name: string;
  description?: string;
  active?: boolean;
}

export interface CreateTemplateFromProjectRequest {
  sourceProjectPublicId: string;
  name: string;
  description?: string;
}

export interface UpdateProjectTemplateRequest {
  name?: string;
  description?: string;
  active?: boolean;
}

export interface DuplicateProjectTemplateRequest {
  name?: string;
}

export interface InstantiateProjectTemplateRequest {
  name: string;
  ownerName: string;
  description?: string;
  editPassword: string;
  projectStartDate: string; // YYYY-MM-DD
}

export interface ProjectTemplateListResponse {
  data: ProjectTemplateDto[];
}

export interface ProjectTemplateDetailResponse {
  data: ProjectTemplateDetailDto;
}

export interface ProjectTemplateMutationResponse {
  data: ProjectTemplateDto;
}

export interface InstantiateProjectTemplateResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    assignments?: ProjectAssignmentDto[];
    permission: "edit";
    operation: {
      kind: "projectTemplateInstantiation";
      templatePublicId: string;
      templateName: string;
      counts: {
        tasks: number;
        links: number;
        holidays: number;
        assignments?: number;
        processes?: number;
        equipment?: number;
        systems?: number;
      };
    };
    warnings: string[];
  };
}
