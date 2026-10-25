import type { DeveloperGrade, ResourceRole } from "./resources";
/** Project participation is independent from Task effort and edit authorization. */
export interface ProjectResourceMembershipDto {
  id: string;
  name: string;
  code: string | null;
  description: string;
  active: boolean;
  roles: ResourceRole[];
  developerGrade: DeveloperGrade | null;
  groups: Array<{
    id: string;
    name: string;
    active: boolean;
  }>;
  registered: boolean;
  sources: {
    membership: boolean;
    taskAssignments: boolean;
    responsibilityAssignments: boolean;
    equipmentRoles: boolean;
    systemRoles: boolean;
  };
  usage: {
    taskAssignments: number;
    responsibilityAssignments: number;
    equipmentRoles: number;
    systemRoles: number;
  };
}
export interface ProjectResourceMembershipQuery {
  scope?: "project" | "catalog";
  q?: string;
  role?: ResourceRole;
  grade?: DeveloperGrade;
  groupId?: string;
  registration?: "registered" | "unregistered";
  usage?: "unassigned" | "assigned" | "roleOnly";
  active?: boolean;
  offset?: number;
  limit?: number;
}
export interface ProjectResourceMembershipResponse {
  data: {
    projectRevision: number;
    catalogRevision: number;
    total: number;
    offset: number;
    limit: number;
    /** Counts cover the Project union before search/page filters; people are distinct. */
    counts: {
      registered: number;
      assigned: number;
      roleOnly: number;
      inactive: number;
    };
    resources: ProjectResourceMembershipDto[];
    groups: Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
    operation?: {
      kind: "resourceMembership";
      resourceId: string;
      registered: boolean;
      changed: boolean;
    };
  };
}
export interface RegisterProjectResourceRequest {
  resourceId: string;
  catalogRevision: number;
}
