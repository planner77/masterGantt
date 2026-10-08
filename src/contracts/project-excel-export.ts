import type { ResourceExcelExportOptions } from "./resource-excel-export";
export type ProjectExcelGridColumnId =
  | "text"
  | "externalId"
  | "projectStart"
  | "projectDuration";

export interface ProjectExcelExportRequest {
  /** Adds report sheets; all existing schedule sheets keep their Project-wide basis. */
  resourceDashboard?: ResourceExcelExportOptions;
  includeDependencies: boolean;
  includeLogistics?: boolean;
  /** Issue #415. Adds role/developer planned-effort estimate sheets when true. */
  includeResourceEffort?: boolean;
  scope: "project";
  scale: "day";
  hierarchyDisplay: "expanded";
  layout: {
    columns: Array<{
      id: ProjectExcelGridColumnId;
      widthPx: number;
    }>;
  };
}
