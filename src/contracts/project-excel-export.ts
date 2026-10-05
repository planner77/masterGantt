export type ProjectExcelGridColumnId =
  | "text"
  | "externalId"
  | "projectStart"
  | "projectDuration";

export interface ProjectExcelExportRequest {
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
