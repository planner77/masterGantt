import type { DependencyType, ProjectLinkDto, ProjectTaskDto } from "@/contracts/projects";

export interface RelatedLinkItem {
  readonly link: ProjectLinkDto;
  readonly direction: "incoming" | "outgoing";
  readonly targetTask: ProjectTaskDto | undefined;
}

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: "FS (Finish-to-Start, 완료 후 시작)",
  SS: "SS (Start-to-Start, 동시 시작)",
  FF: "FF (Finish-to-Finish, 동시 완료)",
  SF: "SF (Start-to-Finish, 시작 후 완료)",
};

/**
 * Anchor 작업 기준으로 연결된 모든 선행(incoming) 및 후행(outgoing) 링크 항목을 반환한다.
 */
export function getRelatedLinksForAnchor(
  anchorExternalId: string,
  links: readonly ProjectLinkDto[],
  tasks: readonly ProjectTaskDto[],
): {
  readonly predecessors: readonly RelatedLinkItem[];
  readonly successors: readonly RelatedLinkItem[];
} {
  const tasksByExternalId = new Map(tasks.map((t) => [t.externalId, t]));
  const predecessors: RelatedLinkItem[] = [];
  const successors: RelatedLinkItem[] = [];

  for (const link of links) {
    if (link.successorExternalId === anchorExternalId) {
      predecessors.push({
        link,
        direction: "incoming",
        targetTask: tasksByExternalId.get(link.predecessorExternalId),
      });
    }
    if (link.predecessorExternalId === anchorExternalId) {
      successors.push({
        link,
        direction: "outgoing",
        targetTask: tasksByExternalId.get(link.successorExternalId),
      });
    }
  }

  return { predecessors, successors };
}

export function findNextRelatedLink(
  deletedLinkId: string,
  anchorExternalId: string,
  links: readonly ProjectLinkDto[],
): ProjectLinkDto | undefined {
  return links.find(
    (link) =>
      link.id !== deletedLinkId &&
      (link.predecessorExternalId === anchorExternalId || link.successorExternalId === anchorExternalId),
  );
}

/**
 * 새 관계 연결을 위한 검색 후보 작업을 필터링한다.
 * 규칙:
 * 1. type === 'summary' 제외 (Summary는 링크 연결 대상이 아님)
 * 2. anchorExternalId 제외 (자기 자신 연결 불가)
 * 3. 이미 해당 방향으로 anchor와 연결되어 있는 작업 제외
 * 4. query가 주어지면 작업명, externalId 또는 canonical taskId에 query가 포함되는 작업만 검색 (대소문자 무시)
 */
export function searchCandidateTasks(options: {
  readonly anchorExternalId: string;
  readonly direction: "predecessor" | "successor";
  readonly query: string;
  readonly tasks: readonly ProjectTaskDto[];
  readonly links: readonly ProjectLinkDto[];
}): readonly ProjectTaskDto[] {
  const { anchorExternalId, direction, query, tasks, links } = options;

  const alreadyConnectedExternalIds = new Set<string>();
  for (const link of links) {
    if (direction === "predecessor") {
      // 후보 -> Anchor: link.successorExternalId === anchorExternalId일 때 link.predecessorExternalId는 이미 연결됨
      if (link.successorExternalId === anchorExternalId) {
        alreadyConnectedExternalIds.add(link.predecessorExternalId);
      }
    } else {
      // Anchor -> 후보: link.predecessorExternalId === anchorExternalId일 때 link.successorExternalId는 이미 연결됨
      if (link.predecessorExternalId === anchorExternalId) {
        alreadyConnectedExternalIds.add(link.successorExternalId);
      }
    }
  }

  const anchor = tasks.find((task) => task.externalId === anchorExternalId);
  const normalizedQuery = query.trim().toLowerCase();

  return tasks.filter((task) => {
    // Summary 작업 제외
    if (!canCreateSchedulingLink(anchor, task)) return false;
    // 자기 자신 제외
    if (task.externalId === anchorExternalId) return false;
    // 이미 연결된 작업 제외
    if (alreadyConnectedExternalIds.has(task.externalId)) return false;

    // 쿼리 매칭 (비어 있으면 모두 통과)
    if (!normalizedQuery) return true;

    const nameMatch = task.name.toLowerCase().includes(normalizedQuery);
    const externalIdMatch = task.externalId.toLowerCase().includes(normalizedQuery);
    const taskIdMatch = task.taskId.toLowerCase().includes(normalizedQuery);

    return nameMatch || externalIdMatch || taskIdMatch;
  });
}

export const MIXED_LINK_EXPLANATION = "새 일정 관계는 Task → Task 또는 Milestone → Milestone만 연결할 수 있습니다. 완료 단계 소속은 완료 단계 연결에서 관리합니다. 기존 혼합 관계는 조회·편집할 수 있습니다.";
export function canCreateSchedulingLink(source: ProjectTaskDto | undefined, target: ProjectTaskDto | undefined): boolean {
  return Boolean(source && target && source.taskId !== target.taskId && source.type !== "summary" && source.type === target.type && !completedMilestoneEndpoint(source, target));
}

export const COMPLETED_LINK_EXPLANATION = "완료된 Milestone에 연결된 일정 관계는 잠겨 있습니다. 해당 단계를 명시적으로 재개한 뒤 변경할 수 있습니다.";
export function completedMilestoneEndpoint(...tasks: readonly (ProjectTaskDto | undefined)[]): boolean {
  return tasks.some((task) => task?.type === "milestone" && task.status === "completed");
}
export function linkStructureLocked(link: ProjectLinkDto | undefined, tasks: readonly ProjectTaskDto[]): boolean {
  return Boolean(link && completedMilestoneEndpoint(tasks.find((task) => task.externalId === link.predecessorExternalId), tasks.find((task) => task.externalId === link.successorExternalId)));
}
