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

export interface ReplaceTaskAssignmentsResponse {
  data: {
    projectRevision: number;
    catalogRevision: number;
    assignments: ProjectAssignmentDto[];
    operation: {
      kind: "taskAssignments";
      taskId: string;
      changed: boolean;
    };
  };
}
