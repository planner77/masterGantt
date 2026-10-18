import type { ProjectDto } from "./projects";
import type { ProjectLogisticsDto } from "./logistics";
export type ProcessCatalogKind = "types" | "standards" | "occurrences" | "workAreas";
export interface ProcessCatalogQuery {
  search?: string;
  limit?: number;
  active?: boolean;
}
export interface ProcessCatalogTriple {
  businessUnitId: string;
  productId: string;
  siteEntityId: string;
}
export interface ProcessCatalogItemDto {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  usageCount: number;
}
export type ProcessTypeDto = ProcessCatalogItemDto;
export interface ProductStandardProcessDto extends ProcessCatalogItemDto {
  productId: string;
  processTypeId: string;
}
export interface ProcessOccurrenceDto extends ProcessCatalogItemDto, ProcessCatalogTriple {
  processTypeId: string;
  standardProcessId: string | null;
  source: "standard" | "site_addition";
}
export interface WorkAreaDto extends ProcessCatalogItemDto {
  occurrenceId: string;
}
export interface ProjectProcessMappingDto {
  processId: string;
  occurrenceId: string;
  workAreaId: string | null;
  active: boolean;
}
export interface ProcessStandardDiff {
  missingStandardIds: string[];
  retiredOccurrenceIds: string[];
  changed: Array<{
    standardId: string;
    occurrenceId: string;
    fields: Array<"name" | "sortOrder">;
    canApply: boolean;
  }>;
}
export interface ProcessCatalogResponse {
  data: {
    processCatalogRevision: number;
    types: ProcessTypeDto[];
    standards: ProductStandardProcessDto[];
    occurrences: ProcessOccurrenceDto[];
    workAreas: WorkAreaDto[];
  };
}
export interface ProcessContextResponse extends ProcessCatalogResponse {
  data: ProcessCatalogResponse["data"] & {
    permission: "readonly" | "edit";
    projectRevision: number;
    projectMasterRevision: number;
    selection: {
      businessUnitId: string | null;
      productId: string | null;
      siteEntityId: string | null;
    };
    selectionValid: boolean;
    mappings: ProjectProcessMappingDto[];
    standardDiff: ProcessStandardDiff;
  };
}
export interface ProcessStandardDiffResponse {
  data: {
    processCatalogRevision: number;
    standardDiff: ProcessStandardDiff;
  };
}
export interface ApplyProcessStandardsRequest extends ProcessCatalogTriple {
  standardIds: string[];
}
export interface SetProjectProcessMappingRequest {
  processCatalogRevision: number;
  occurrenceId: string | null;
  workAreaId?: string | null;
}
export interface ProjectProcessMappingResponse {
  data: {
    project: ProjectDto;
    logistics: ProjectLogisticsDto;
    permission: "edit";
    processCatalogRevision: number;
    mappings: ProjectProcessMappingDto[];
    operation: {
      kind: "processMapping";
      processId: string;
      changed: boolean;
    };
  };
}
