import type Database from "better-sqlite3";
import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";
import { assertMilestoneCompletionTransitions, assertStageStructureChange, projectStageGates, StageGateError, type StageSnapshot } from "../../domain/milestones/stage-gates";
import { MilestoneMembershipRepository } from "../repositories/milestone-membership-repository-core";
import { ScheduleRepository } from "../repositories/schedule-repository-core";

export function readStageSnapshot(database: Database.Database, projectId: number): StageSnapshot {
  const schedules = new ScheduleRepository(database), tasks = schedules.listTasks(projectId);
  const publicIds = new Map(tasks.map((task) => [task.id, task.publicId]));
  return {
    tasks: tasks.map((task) => ({ taskId: task.publicId, type: task.type, parentTaskId: task.parentId === null ? null : publicIds.get(task.parentId)!, duration: task.duration, progress: task.progress, status: task.status })),
    memberships: new MilestoneMembershipRepository(database).list(projectId),
    links: schedules.listLinks(projectId).map((link) => ({ id: link.publicId, predecessorTaskId: publicIds.get(link.predecessorTaskId)!, successorTaskId: publicIds.get(link.successorTaskId)!, type: link.type, lag: link.lag })),
  };
}

export function assertStageMutation(database: Database.Database, projectId: number, before: StageSnapshot): void {
  const after = readStageSnapshot(database, projectId);
  assertStageStructureChange(before, after);
  assertMilestoneCompletionTransitions(before, after);
}

export function applyExplicitMembership(database: Database.Database, projectId: number, taskId: string, milestoneTaskId: string | null): void {
  const schedules = new ScheduleRepository(database), source = schedules.findTaskByPublicId(projectId, taskId);
  const target = milestoneTaskId === null ? null : schedules.findTaskByPublicId(projectId, milestoneTaskId);
  if (!source || source.type === "milestone" || (milestoneTaskId !== null && (!target || target.type !== "milestone"))) {
    throw new StageGateError("INVALID_MILESTONE_MEMBERSHIP", [taskId, ...(milestoneTaskId ? [milestoneTaskId] : [])]);
  }
  new MilestoneMembershipRepository(database).set(projectId, source.id, target?.id ?? null);
}

/** Shared additive projector for every canonical response adapter, not only GET. */
export function withStageProjection<T extends { data: { tasks: ProjectTaskDto[]; links: ProjectLinkDto[] } }>(database: Database.Database, projectId: number, response: T): T {
  const { membership, gates } = projectStageGates(readStageSnapshot(database, projectId));
  const byExternalId = new Map(response.data.tasks.map((task) => [task.externalId, task]));
  return { ...response, data: { ...response.data,
    tasks: response.data.tasks.map((task) => ({ ...task, membership: membership.get(task.taskId)!, ...(task.type === "milestone" ? { stageGate: gates.get(task.taskId)! } : {}) })),
    links: response.data.links.map((link) => ({ ...link, legacyMixed: byExternalId.get(link.predecessorExternalId)?.type !== byExternalId.get(link.successorExternalId)?.type })),
  } };
}

/** Until preservation ships, reject affected paths instead of returning a lossy success. */
export function assertMembershipPreservationAvailable(database: Database.Database, projectId: number, taskIds?: readonly string[]): void {
  const snapshot = readStageSnapshot(database, projectId);
  const scope = taskIds ? new Set(taskIds) : null;
  const { membership } = projectStageGates(snapshot);
  const affected = snapshot.tasks.filter((task) => (!scope || scope.has(task.taskId)) &&
    (membership.get(task.taskId)?.effectiveMilestoneTaskId || snapshot.memberships.some((row) => row.taskId === task.taskId || row.milestoneTaskId === task.taskId)));
  if (affected.length) throw new StageGateError("MILESTONE_MEMBERSHIP_PRESERVATION_UNAVAILABLE", affected.map((task) => task.taskId));
}

/** Type changes are checked before SQL so integrity triggers never become public SQL errors. */
export function assertMembershipTaskTypeChange(database: Database.Database, projectId: number, taskId: string, targetType: "task" | "summary" | "milestone"): void {
  const before = readStageSnapshot(database, projectId), current = before.tasks.find((task) => task.taskId === taskId);
  if (!current || current.type === targetType) return;
  if (current.type === "milestone" && targetType !== "milestone") {
    if (current.status === "completed") throw new StageGateError("COMPLETED_MILESTONE_STRUCTURE_LOCKED", [taskId]);
    if (before.memberships.some((row) => row.milestoneTaskId === taskId)) throw new StageGateError("MILESTONE_REFERENCED", [taskId]);
  }
  if (targetType === "milestone" && before.memberships.some((row) => row.taskId === taskId)) throw new StageGateError("INVALID_MILESTONE_MEMBERSHIP", [taskId]);
}
