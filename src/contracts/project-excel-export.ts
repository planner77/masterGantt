export type ProjectExcelGridColumnId =
  | "text"
  | "externalId"
  | "projectStart"
  | "projectDuration";

export interface ProjectExcelExportRequest {
  includeDependencies: boolean;
  includeLogistics?: boolean;
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
