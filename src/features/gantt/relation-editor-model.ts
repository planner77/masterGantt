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

/**
 * 새 관계 연결을 위한 검색 후보 작업을 필터링한다.
 * 규칙:
 * 1. type === 'summary' 제외 (Summary는 링크 연결 대상이 아님)
 * 2. anchorExternalId 제외 (자기 자신 연결 불가)
 * 3. 이미 해당 방향으로 anchor와 연결되어 있는 작업 제외
 * 4. query가 주어지면 작업명 또는 externalId에 query가 포함되는 작업만 검색 (대소문자 무시)
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

  const normalizedQuery = query.trim().toLowerCase();

  return tasks.filter((task) => {
    // Summary 작업 제외
    if (task.type === "summary") return false;
    // 자기 자신 제외
    if (task.externalId === anchorExternalId) return false;
    // 이미 연결된 작업 제외
    if (alreadyConnectedExternalIds.has(task.externalId)) return false;

    // 쿼리 매칭 (비어 있으면 모두 통과)
    if (!normalizedQuery) return true;

    const nameMatch = task.name.toLowerCase().includes(normalizedQuery);
    const externalIdMatch = task.externalId.toLowerCase().includes(normalizedQuery);

    return nameMatch || externalIdMatch;
  });
}
