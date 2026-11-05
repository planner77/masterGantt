import type { DisplayNameTranslations } from "./display-name-translations";
export type ProjectMasterCategory = "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY";

export interface ProjectMasterItemDto {
  translations?: DisplayNameTranslations;
  id: string;
  category: ProjectMasterCategory;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  usageCount?: number;
}

export interface ProjectMasterRelationDto {
  businessUnitId: string;
  productId: string;
  siteEntityId: string | null;
}
export interface ProjectMasterRelationMutationRequest {
  businessUnitId: string;
  productId: string;
  siteEntityId?: string | null;
}

export interface ProjectMasterSelectionResponse {
  data: {
    revision: number;
    businessUnits: ProjectMasterItemDto[];
    products: ProjectMasterItemDto[];
    siteEntities: ProjectMasterItemDto[];
    relations: ProjectMasterRelationDto[];
  };
}

export interface ProjectMasterAdminResponse extends ProjectMasterSelectionResponse {
  data: ProjectMasterSelectionResponse["data"] & {
    items: ProjectMasterItemDto[];
  };
}

export interface CreateProjectMasterItemRequest {
  translations?: DisplayNameTranslations;
  category: ProjectMasterCategory;
  code: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateProjectMasterItemRequest {
  translations?: DisplayNameTranslations;
  code?: string;
  name?: string;
  active?: boolean;
  sortOrder?: number;
}
