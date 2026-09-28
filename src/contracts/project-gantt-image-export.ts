export type ProjectGanttImageExportRequest = {
  scope: "project";
  scale: "day" | "week";
  hierarchyDisplay: "expanded";
} | {
  scope: "range";
  startDate: string;
  endDate: string;
  scale: "day" | "week";
  hierarchyDisplay: "expanded";
};
