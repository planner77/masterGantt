export type ProjectMasterCategory = "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY";

export interface ProjectMasterItemDto {
  id: string;
  category: ProjectMasterCategory;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  usageCount?: number;
}

export interface ProjectMasterSelectionResponse {
  data: {
    revision: number;
    businessUnits: ProjectMasterItemDto[];
    products: ProjectMasterItemDto[];
    siteEntities: ProjectMasterItemDto[];
  };
}

export interface ProjectMasterAdminResponse extends ProjectMasterSelectionResponse {
  data: ProjectMasterSelectionResponse["data"] & {
    items: ProjectMasterItemDto[];
  };
}

export interface CreateProjectMasterItemRequest {
  category: ProjectMasterCategory;
  code: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateProjectMasterItemRequest {
  code?: string;
  name?: string;
  active?: boolean;
  sortOrder?: number;
}
