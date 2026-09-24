import type { ProjectStatus } from "../../contracts/projects";

export const PROJECT_STATUS_OPTIONS: readonly { value: ProjectStatus; label: string }[] = [
  { value: "planned", label: "예정" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
];

export function projectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}
