import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";

export type TaskRelationDirection = "predecessor" | "successor";

export interface TaskRelationView {
  readonly id: string;
  readonly direction: TaskRelationDirection;
  readonly relatedTaskExternalId: string;
  readonly relatedTaskName: string;
  readonly type: ProjectLinkDto["type"];
  readonly lag: ProjectLinkDto["lag"];
  readonly resolved: boolean;
}

export interface TaskRelationsView {
  readonly predecessors: readonly TaskRelationView[];
  readonly successors: readonly TaskRelationView[];
}

export function formatTaskRelationType(type: string): string {
  switch (type) {
    case "FS": return "FS (종료 → 시작)";
    case "SS": return "SS (시작 → 시작)";
    case "FF": return "FF (종료 → 종료)";
    case "SF": return "SF (시작 → 종료)";
    default: return type;
  }
}

export function buildTaskRelations(
  task: Pick<ProjectTaskDto, "externalId">,
  tasks: readonly Pick<ProjectTaskDto, "externalId" | "name">[],
  links: readonly ProjectLinkDto[],
): TaskRelationsView {
  const tasksByExternalId = new Map(tasks.map((candidate) => [candidate.externalId, candidate]));
  const predecessors: TaskRelationView[] = [];
  const successors: TaskRelationView[] = [];

  const makeRelation = (
    link: ProjectLinkDto,
    direction: TaskRelationDirection,
    relatedTaskExternalId: string,
  ): TaskRelationView => {
    const relatedTask = tasksByExternalId.get(relatedTaskExternalId);
    return {
      id: link.id,
      direction,
      relatedTaskExternalId,
      relatedTaskName: relatedTask?.name ?? "작업 정보 없음",
      type: link.type,
      lag: link.lag,
      resolved: relatedTask !== undefined,
    };
  };

  for (const link of links) {
    if (link.successorExternalId === task.externalId) {
      predecessors.push(makeRelation(link, "predecessor", link.predecessorExternalId));
    }
    if (link.predecessorExternalId === task.externalId) {
      successors.push(makeRelation(link, "successor", link.successorExternalId));
    }
  }

  return { predecessors, successors };
}
