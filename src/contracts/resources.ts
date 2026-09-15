import type { ProjectDto, ProjectLinkDto, ProjectTaskDto } from "./projects";

export type AssignmentTargetKind = "resource" | "group";

export interface ResourceDto {
  id: string;
  name: string;
  code: string | null;
  description: string;
  active: boolean;
}

export interface ResourceGroupDto {
  id: string;
  name: string;
  code: string | null;
  description: string;
  active: boolean;
  memberResourceIds: string[];
}

export interface ResourceCatalogResponse {
  data: {
    revision: number;
    resources: ResourceDto[];
    groups: ResourceGroupDto[];
  };
}

export interface ResourceCatalogAdminSessionResponse {
  data: {
    permission: "resource_catalog_admin";
    expiresAt: string;
  };
}

export interface UnlockResourceCatalogRequest {
  password: string;
}

export interface CreateCatalogTargetRequest {
  name: string;
  code?: string | null;
  description?: string;
}

export interface UpdateCatalogTargetRequest {
  name?: string;
  code?: string | null;
  description?: string;
  active?: boolean;
}

export interface ReplaceResourceGroupMembersRequest {
  resourceIds: string[];
}

export interface AssignmentTargetRefDto {
  kind: AssignmentTargetKind;
  id: string;
}

export interface ProjectAssignmentDto {
  id: string;
  taskId: string;
  target: AssignmentTargetRefDto;
}

export interface AssignmentTargetDto {
  kind: AssignmentTargetKind;
  id: string;
  name: string;
  code: string | null;
  active: boolean;
}

export interface AssignmentTargetsResponse {
  data: {
    catalogRevision: number;
    targets: AssignmentTargetDto[];
  };
}

export interface AssignedTargetsResponse {
  data: {
    projectRevision: number;
    catalogRevision: number;
    assignments: ProjectAssignmentDto[];
    targets: AssignmentTargetDto[];
  };
}

export interface ReplaceTaskAssignmentsRequest {
  catalogRevision: number;
  targets: AssignmentTargetRefDto[];
}

/**
 * Assignment mutation follows the same canonical aggregate response rule as the
 * existing Project/Task mutations. Mutable target labels remain outside this
 * response and are resolved through assigned-targets.
 */
export interface ReplaceTaskAssignmentsResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    assignments: ProjectAssignmentDto[];
    catalogRevision: number;
    warnings: [];
    operation: {
      kind: "taskAssignments";
      taskId: string;
      changed: boolean;
    };
  };
}
