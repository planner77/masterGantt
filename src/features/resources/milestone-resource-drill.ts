import type { ResourceDrillSourceContext } from "@/contracts/resource-drill";
import type { ResourceWorkloadTaskDto } from "../../contracts/resources";

/** A display drill from a confirmed dashboard, never a second effort engine. */
export interface MilestoneResourceDrill {
  sourceContext?: ResourceDrillSourceContext | null;
  projectRevision: number;
  catalogRevision: number;
  resourceIds: readonly string[];
  taskIds: readonly string[];
  assignmentIds: readonly string[];
  from: string;
  to: string;
  plannedMd: number;
  plannedMm: number | null;
}

export function resourceDrillMatches(scope: MilestoneResourceDrill, resourceId: string, task: ResourceWorkloadTaskDto): boolean {
  return scope.resourceIds.includes(resourceId) && scope.taskIds.includes(task.taskId) && scope.assignmentIds.includes(task.assignmentId) && task.start <= scope.to && task.end >= scope.from;
}

export function resourceDrillRevisionMatches(scope: MilestoneResourceDrill, snapshot: { projectRevision: number; catalogRevision: number }): boolean {
  return snapshot.projectRevision === scope.projectRevision && snapshot.catalogRevision === scope.catalogRevision;
}
