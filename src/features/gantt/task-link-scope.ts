import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";

export function taskHasDependencyLinks(
  tasks: readonly ProjectTaskDto[],
  taskId: string,
  links: readonly ProjectLinkDto[],
): boolean {
  const task = tasks.find((candidate) => candidate.taskId === taskId);
  if (!task) return false;
  return links.some((link) =>
    link.predecessorExternalId === task.externalId ||
    link.successorExternalId === task.externalId
  );
}
