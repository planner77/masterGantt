import type { MilestoneStageGateDto, TaskMilestoneMembershipDto } from "../../contracts/milestones";
import type { TaskStatus } from "../../contracts/projects";

export interface StageTask {
  taskId: string;
  parentTaskId: string | null;
  type: "task" | "summary" | "milestone";
  duration: number | null;
  progress: number | null;
  status: TaskStatus;
}
export interface StageMembership { taskId: string; milestoneTaskId: string }
export interface StageLink {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: string;
  lag: number;
}
export interface StageSnapshot {
  tasks: StageTask[];
  memberships: StageMembership[];
  links: StageLink[];
}

export class StageGateError extends Error {
  constructor(readonly code: string, readonly taskIds: string[] = []) {
    super(code);
    this.name = "StageGateError";
  }
}

/** Full-project pure projection. Filters, dates and scheduling never enter this calculation. */
export function projectStageGates(snapshot: StageSnapshot) {
  const byId = new Map(snapshot.tasks.map((task) => [task.taskId, task]));
  if (byId.size !== snapshot.tasks.length) throw new StageGateError("INVALID_STAGE_HIERARCHY");
  for (const task of snapshot.tasks) {
    const seen = new Set<string>();
    let current: StageTask | undefined = task;
    while (current) {
      if (seen.has(current.taskId)) throw new StageGateError("INVALID_STAGE_HIERARCHY", [task.taskId]);
      seen.add(current.taskId);
      if (current.parentTaskId === null) break;
      const parent = byId.get(current.parentTaskId);
      if (!parent || parent.type !== "summary") throw new StageGateError("INVALID_STAGE_HIERARCHY", [task.taskId]);
      current = parent;
    }
  }
  const explicit = new Map<string, string>();
  for (const row of snapshot.memberships) {
    const source = byId.get(row.taskId), target = byId.get(row.milestoneTaskId);
    if (!source || !target || source.type === "milestone" || target.type !== "milestone" || source === target) {
      throw new StageGateError("INVALID_MILESTONE_MEMBERSHIP", [row.taskId, row.milestoneTaskId]);
    }
    if (explicit.has(row.taskId)) throw new StageGateError("DUPLICATE_MILESTONE_MEMBERSHIP", [row.taskId]);
    explicit.set(row.taskId, row.milestoneTaskId);
  }
  const membership = new Map<string, TaskMilestoneMembershipDto>();
  for (const task of snapshot.tasks) {
    let effective: string | null = null, inheritedFrom: string | null = null;
    if (task.type !== "milestone") {
      let current: StageTask | undefined = task;
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current.taskId)) throw new StageGateError("INVALID_STAGE_HIERARCHY", [task.taskId]);
        seen.add(current.taskId);
        const target = explicit.get(current.taskId);
        if (target) {
          effective = target;
          inheritedFrom = current.taskId === task.taskId ? null : current.taskId;
          break;
        }
        if (current.parentTaskId === null) break;
        const parent = byId.get(current.parentTaskId);
        if (!parent || parent.type !== "summary") throw new StageGateError("INVALID_STAGE_HIERARCHY", [task.taskId]);
        current = parent;
      }
    }
    membership.set(task.taskId, {
      explicitMilestoneTaskId: explicit.get(task.taskId) ?? null,
      effectiveMilestoneTaskId: effective,
      inheritedFromTaskId: inheritedFrom,
    });
  }
  const gates = new Map<string, MilestoneStageGateDto>();
  for (const milestone of snapshot.tasks.filter((task) => task.type === "milestone")) {
    const members = snapshot.tasks.filter((task) => task.type === "task" &&
      membership.get(task.taskId)?.effectiveMilestoneTaskId === milestone.taskId);
    const predecessors = [...new Set(snapshot.links.filter((link) => link.successorTaskId === milestone.taskId &&
      byId.get(link.predecessorTaskId)?.type === "milestone").map((link) => link.predecessorTaskId))];
    const incomplete = members.filter((task) => task.status !== "completed");
    const incompletePredecessors = predecessors.filter((id) => byId.get(id)?.status !== "completed");
    const duration = members.reduce((sum, task) => sum + (task.duration ?? 0), 0);
    const progress = duration > 0 ? members.reduce((sum, task) =>
      sum + (task.duration ?? 0) * (task.progress ?? 0), 0) / duration : null;
    const manualEvent = members.length === 0;
    gates.set(milestone.taskId, {
      memberTaskIds: members.map((task) => task.taskId), memberCount: members.length,
      completedMemberCount: members.length - incomplete.length,
      incompleteMemberTaskIds: incomplete.map((task) => task.taskId), memberProgressPercent: progress,
      predecessorMilestoneTaskIds: predecessors, incompletePredecessorMilestoneTaskIds: incompletePredecessors,
      membersCompleted: !manualEvent && incomplete.length === 0,
      predecessorsCompleted: incompletePredecessors.length === 0,
      ready: manualEvent ? null : milestone.status !== "completed" && incomplete.length === 0 && incompletePredecessors.length === 0,
      blocked: milestone.status !== "completed" && incompletePredecessors.length > 0,
      manualEvent,
      completionInconsistent: milestone.status === "completed" && (incomplete.length > 0 || incompletePredecessors.length > 0),
    });
  }
  return { membership, gates };
}

/** Explicit defaults and effective ordinary members are separate structural invariants. */
export function assertStageStructureChange(before: StageSnapshot, after: StageSnapshot): void {
  const oldProjection = projectStageGates(before), newProjection = projectStageGates(after);
  const oldTasks = new Map(before.tasks.map((task) => [task.taskId, task]));
  const newTasks = new Map(after.tasks.map((task) => [task.taskId, task]));
  const completed = new Set(before.tasks.filter((task) => task.type === "milestone" && task.status === "completed").map((task) => task.taskId));
  const affected = new Set<string>();
  const oldExplicit = new Map(before.memberships.map((row) => [row.taskId, row.milestoneTaskId]));
  const newExplicit = new Map(after.memberships.map((row) => [row.taskId, row.milestoneTaskId]));
  for (const id of new Set([...oldExplicit.keys(), ...newExplicit.keys()])) {
    const oldTarget = oldExplicit.get(id), newTarget = newExplicit.get(id);
    if (oldTarget === newTarget) continue;
    if (oldTarget && completed.has(oldTarget)) affected.add(oldTarget);
    if (newTarget && completed.has(newTarget)) affected.add(newTarget);
  }
  for (const id of new Set([...oldTasks.keys(), ...newTasks.keys()])) {
    const oldTask = oldTasks.get(id), newTask = newTasks.get(id);
    const oldTarget = oldTask?.type === "task" ? oldProjection.membership.get(id)?.effectiveMilestoneTaskId : null;
    const newTarget = newTask?.type === "task" ? newProjection.membership.get(id)?.effectiveMilestoneTaskId : null;
    if (oldTarget !== newTarget) {
      if (oldTarget && completed.has(oldTarget)) affected.add(oldTarget);
      if (newTarget && completed.has(newTarget)) affected.add(newTarget);
    }
    if (completed.has(id) && newTask?.type !== "milestone") affected.add(id);
    if (oldTask?.type === "milestone" && newTask?.type !== "milestone" &&
        before.memberships.some((row) => row.milestoneTaskId === id)) {
      throw new StageGateError("MILESTONE_REFERENCED", [id]);
    }
  }
  const oldLinks = new Map(before.links.map((link) => [link.id, link]));
  const newLinks = new Map(after.links.map((link) => [link.id, link]));
  for (const id of new Set([...oldLinks.keys(), ...newLinks.keys()])) {
    const oldLink = oldLinks.get(id), newLink = newLinks.get(id);
    if (JSON.stringify(oldLink) === JSON.stringify(newLink)) continue;
    for (const endpoint of [oldLink?.predecessorTaskId, oldLink?.successorTaskId, newLink?.predecessorTaskId, newLink?.successorTaskId]) {
      if (endpoint && completed.has(endpoint)) affected.add(endpoint);
    }
  }
  if (affected.size) throw new StageGateError("COMPLETED_MILESTONE_STRUCTURE_LOCKED", [...affected]);
}

/** Only new transitions are guarded; historical completion is preserved and diagnosed. */
export function assertMilestoneCompletionTransitions(before: StageSnapshot, after: StageSnapshot): void {
  const old = new Map(before.tasks.map((task) => [task.taskId, task]));
  const { gates } = projectStageGates(after);
  for (const task of after.tasks) {
    if (task.type !== "milestone" || task.status !== "completed" ||
        (old.get(task.taskId)?.type === "milestone" && old.get(task.taskId)?.status === "completed")) continue;
    const gate = gates.get(task.taskId)!;
    if ((!gate.manualEvent && !gate.membersCompleted) || !gate.predecessorsCompleted) {
      throw new StageGateError("MILESTONE_NOT_READY", [task.taskId, ...gate.incompleteMemberTaskIds, ...gate.incompletePredecessorMilestoneTaskIds]);
    }
  }
}
