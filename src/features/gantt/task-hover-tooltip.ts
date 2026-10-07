import type { ProjectTaskDto } from "../../contracts/projects";
import { formatLocaleDateOnly, type DisplayLocales } from "../../lib/date-display";

export interface ProjectTaskHoverTooltipData {
  readonly name: string;
  readonly start: string;
  readonly end: string;
}

export function buildProjectTaskHoverTooltipData(
  task: Pick<ProjectTaskDto, "name" | "start" | "end">,
  locales: DisplayLocales,
): ProjectTaskHoverTooltipData {
  return {
    name: task.name,
    start: task.start ? formatLocaleDateOnly(task.start, locales) : "—",
    end: task.end ? formatLocaleDateOnly(task.end, locales) : "—",
  };
}
