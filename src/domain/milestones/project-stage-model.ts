import type { ProjectLinkDto, ProjectTaskDto } from "../../contracts/projects";
import type { MilestoneMembershipCommand } from "../../contracts/milestones";
import { assertStageStructureChange, projectStageGates, StageGateError, type StageSnapshot } from "./stage-gates";

/** Browser-safe adapter; only explicit settings are authoritative draft inputs. */
export function stageSnapshotFromProject(tasks: readonly ProjectTaskDto[], links: readonly ProjectLinkDto[]): StageSnapshot {
  const byExternalId = new Map(tasks.map((task) => [task.externalId, task.taskId]));
  return {
    tasks: tasks.map((task) => ({ taskId: task.taskId, parentTaskId: task.parentExternalId === null ? null : byExternalId.get(task.parentExternalId)!, type: task.type, duration: task.duration, progress: task.progress, status: task.status ?? (task.progress === 100 ? "completed" : task.progress ? "in_progress" : "not_started") })),
    memberships: tasks.flatMap((task) => task.membership?.explicitMilestoneTaskId ? [{ taskId: task.taskId, milestoneTaskId: task.membership.explicitMilestoneTaskId }] : []),
    links: links.map((link) => ({ id: link.id, predecessorTaskId: byExternalId.get(link.predecessorExternalId)!, successorTaskId: byExternalId.get(link.successorExternalId)!, type: link.type, lag: link.lag })),
  };
}

export function previewMilestoneMemberships(tasks: readonly ProjectTaskDto[], links: readonly ProjectLinkDto[], command: MilestoneMembershipCommand) {
  const before = stageSnapshotFromProject(tasks, links), explicit = new Map(before.memberships.map((row) => [row.taskId, row.milestoneTaskId]));
  const changed = new Set<string>();
  for (const change of command.changes) {
    if (changed.has(change.taskId)) throw new StageGateError("DUPLICATE_MILESTONE_MEMBERSHIP", [change.taskId]);
    changed.add(change.taskId);
    const source = before.tasks.find((task) => task.taskId === change.taskId);
    if (!source || source.type === "milestone") throw new StageGateError("INVALID_MILESTONE_MEMBERSHIP", [change.taskId]);
    if (change.milestoneTaskId === null) explicit.delete(change.taskId);
    else explicit.set(change.taskId, change.milestoneTaskId);
  }
  const after: StageSnapshot = { ...before, memberships: [...explicit].map(([taskId, milestoneTaskId]) => ({ taskId, milestoneTaskId })) };
  // The server repeats this check inside its transaction; this is only a UI preview.
  assertStageStructureChange(before, after);
  return { before: projectStageGates(before), after: projectStageGates(after), snapshot: after };
}
