import type { ProjectTaskDto, ProjectLinkDto } from "../../contracts/projects";
import type { MilestoneMembershipCommand } from "../../contracts/milestones";
import { previewMilestoneMemberships, stageSnapshotFromProject } from "../../domain/milestones/project-stage-model";
import { projectStageGates } from "../../domain/milestones/stage-gates";

export function matchesMembershipSearch(task: ProjectTaskDto, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  return [task.name, task.externalId, task.taskId].some((value) => value.toLocaleLowerCase().includes(normalized));
}
export function membershipProjection(tasks: readonly ProjectTaskDto[], links: readonly ProjectLinkDto[], changes: MilestoneMembershipCommand["changes"] = []) {
  return changes.length ? previewMilestoneMemberships(tasks, links, { changes }).after : projectStageGates(stageSnapshotFromProject(tasks, links));
}
export function membershipChanges(tasks: readonly ProjectTaskDto[], draft: Readonly<Record<string, string | null>>): MilestoneMembershipCommand["changes"] {
  return Object.entries(draft).filter(([id, target]) => (tasks.find((task) => task.taskId === id)?.membership?.explicitMilestoneTaskId ?? null) !== target).map(([taskId, milestoneTaskId]) => ({ taskId, milestoneTaskId }));
}
export function membershipImpact(tasks: readonly ProjectTaskDto[], links: readonly ProjectLinkDto[], changes: MilestoneMembershipCommand["changes"]): number {
  const before = membershipProjection(tasks, links), after = membershipProjection(tasks, links, changes);
  return tasks.filter((task) => task.type === "task" && before.membership.get(task.taskId)?.effectiveMilestoneTaskId !== after.membership.get(task.taskId)?.effectiveMilestoneTaskId).length;
}
export function membershipDescription(task: ProjectTaskDto, tasks: readonly ProjectTaskDto[], membership = task.membership): string {
  if (!membership?.effectiveMilestoneTaskId) return "미지정";
  const target = tasks.find((row) => row.taskId === membership.effectiveMilestoneTaskId);
  const source = tasks.find((row) => row.taskId === membership.inheritedFromTaskId);
  return `${target?.name ?? membership.effectiveMilestoneTaskId} · ${source ? `${source.name}에서 상속` : "직접 지정"}`;
}
