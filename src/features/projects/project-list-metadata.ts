import type { ProjectMasterItemDto } from "@/contracts/project-master";

export const PROJECT_MASTER_UNASSIGNED_LABEL = "미지정";

export function projectMasterListLabel(item: ProjectMasterItemDto | null | undefined): string {
  const name = item?.name.trim();
  if (!name) return PROJECT_MASTER_UNASSIGNED_LABEL;
  return item.active ? name : `${name} (비활성)`;
}
