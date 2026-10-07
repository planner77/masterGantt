import type {
  CopyInheritanceReference, CopyMilestoneReference, MembershipCopyImpact,
  MembershipCopyPlan, ProjectLinkDto, ProjectTaskDto, TaskHierarchyCommandRequest,
  TaskHierarchyPlacement,
} from "../../contracts/projects";
import { MAX_HIERARCHY_TASKS } from "../scheduling/hierarchy";
import { stageSnapshotFromProject } from "./project-stage-model";
import {
  assertStageStructureChange, projectStageGates, StageGateError,
  type StageSnapshot, type StageTask,
} from "./stage-gates";

export interface MembershipCopyPlanInput {
  snapshot: StageSnapshot;
  order: readonly { taskId: string; siblingOrder: number }[];
  taskIds: readonly string[];
  anchorTaskId: string;
  placement: TaskHierarchyPlacement;
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/** Server-owned copies preserve historical completion only when the entire stage is retained. */
export function trustedCopyCompletionBaseline(
  before: StageSnapshot, after: StageSnapshot, copiedBySource: ReadonlyMap<string, string>,
): StageSnapshot {
  const old = projectStageGates(before), next = projectStageGates(after);
  const inverse = new Map([...copiedBySource].map(([source, copy]) => [copy, source]));
  const trusted: StageTask[] = [];
  for (const source of before.tasks) {
    const copyId = copiedBySource.get(source.taskId);
    if (!copyId || source.type !== "milestone" || source.status !== "completed") continue;
    const oldGate = old.gates.get(source.taskId)!, newGate = next.gates.get(copyId);
    const explicit = before.memberships.filter((row) => row.milestoneTaskId === source.taskId);
    const incident = before.links.filter((link) => link.predecessorTaskId === source.taskId || link.successorTaskId === source.taskId);
    const lost = oldGate.memberTaskIds.some((id) => !copiedBySource.has(id)) ||
      explicit.some((row) => !copiedBySource.has(row.taskId)) ||
      incident.some((link) => !copiedBySource.has(link.predecessorTaskId) || !copiedBySource.has(link.successorTaskId));
    const copied = after.tasks.find((task) => task.taskId === copyId);
    const mappedMembers = newGate?.memberTaskIds.map((id) => inverse.get(id) ?? `existing:${id}`) ?? [];
    const mappedPredecessors = newGate?.predecessorMilestoneTaskIds.map((id) => inverse.get(id) ?? `existing:${id}`) ?? [];
    const mappedExplicit = after.memberships.filter((row) => row.milestoneTaskId === copyId)
      .map((row) => inverse.get(row.taskId) ?? `existing:${row.taskId}`);
    const copiedIncident = after.links.filter((link) => link.predecessorTaskId === copyId || link.successorTaskId === copyId);
    const linkIdentity = (link: StageSnapshot["links"][number], remap: boolean) => JSON.stringify([
      remap ? inverse.get(link.predecessorTaskId) : link.predecessorTaskId,
      remap ? inverse.get(link.successorTaskId) : link.successorTaskId, link.type, link.lag,
    ]);
    if (lost || !copied || copied.type !== "milestone" || copied.status !== source.status ||
        !sameIds(oldGate.memberTaskIds, mappedMembers) ||
        !sameIds(oldGate.predecessorMilestoneTaskIds, mappedPredecessors) ||
        !sameIds(explicit.map((row) => row.taskId), mappedExplicit) ||
        !sameIds(incident.map((link) => linkIdentity(link, false)), copiedIncident.map((link) => linkIdentity(link, true)))) {
      throw new StageGateError("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED", [source.taskId]);
    }
    trusted.push(copied);
  }
  // This baseline is exclusively for transition validation; structural locks use actual before/after.
  return { ...before, tasks: [...before.tasks, ...trusted] };
}

/** Exact pre-mutation candidate shared by the server and the browser; virtual IDs never become FKs. */
export function simulateMembershipCopy(input: MembershipCopyPlanInput) {
  const { snapshot: before } = input;
  const oldProjection = projectStageGates(before);
  const byId = new Map(before.tasks.map((task) => [task.taskId, task]));
  const order = new Map(input.order.map((task) => [task.taskId, task.siblingOrder]));
  if (order.size !== before.tasks.length || input.order.length !== before.tasks.length ||
      input.order.some((task) => !byId.has(task.taskId) || !Number.isSafeInteger(task.siblingOrder) || task.siblingOrder < 0) ||
      !input.taskIds.length || new Set(input.taskIds).size !== input.taskIds.length ||
      input.taskIds.some((id) => !byId.has(id)) ||
      new Set(before.links.map((link) => link.id)).size !== before.links.length ||
      before.links.some((link) => !byId.has(link.predecessorTaskId) || !byId.has(link.successorTaskId))) {
    throw new StageGateError("INVALID_COPY_MEMBERSHIP_SNAPSHOT");
  }
  const anchor = byId.get(input.anchorTaskId);
  if (!anchor) throw new StageGateError("INVALID_COPY_MEMBERSHIP_SNAPSHOT", [input.anchorTaskId]);
  if (input.placement === "child" && anchor.type === "milestone") {
    throw new StageGateError("INVALID_COPY_MEMBERSHIP_SNAPSHOT", [anchor.taskId]);
  }
  const children = new Map<string | null, StageTask[]>();
  for (const task of before.tasks) {
    const family = children.get(task.parentTaskId) ?? [];
    family.push(task); children.set(task.parentTaskId, family);
  }
  for (const family of children.values()) {
    family.sort((a, b) => order.get(a.taskId)! - order.get(b.taskId)!);
    if (new Set(family.map((task) => order.get(task.taskId))).size !== family.length) {
      throw new StageGateError("INVALID_COPY_MEMBERSHIP_SNAPSHOT", family.map((task) => task.taskId));
    }
  }
  const selected = new Set(input.taskIds), roots: string[] = [], branch: StageTask[] = [];
  const pending = [...(children.get(null) ?? [])].reverse().map((task) => ({ task, included: false }));
  while (pending.length) {
    const { task, included } = pending.pop()!;
    const root = !included && selected.has(task.taskId), inCopy = included || root;
    if (root) roots.push(task.taskId);
    if (inCopy) branch.push(task);
    for (const child of [...(children.get(task.taskId) ?? [])].reverse()) pending.push({ task: child, included: inCopy });
  }
  if (before.tasks.length + branch.length > MAX_HIERARCHY_TASKS) {
    throw new StageGateError("TASK_COPY_TASK_LIMIT_EXCEEDED", roots);
  }
  const copiedIds = new Set(branch.map((task) => task.taskId));
  let prefix = "copy-preview:";
  while (before.tasks.some((task) => task.taskId.startsWith(prefix)) || before.links.some((link) => link.id.startsWith(prefix))) prefix = `_${prefix}`;
  const copiedBySource = new Map(branch.map((task) => [task.taskId, `${prefix}${task.taskId}`]));
  const inverse = new Map([...copiedBySource].map(([source, copy]) => [copy, source]));
  const rootSet = new Set(roots);
  const parentId = input.placement === "child" ? anchor.taskId : anchor.parentTaskId;
  const preserved = before.memberships.filter((row) => copiedIds.has(row.taskId) && copiedIds.has(row.milestoneTaskId));
  const excluded = before.memberships.filter((row) => copiedIds.has(row.taskId) && !copiedIds.has(row.milestoneTaskId));
  const after: StageSnapshot = {
    tasks: [
      ...before.tasks.map((task) => input.placement === "child" && task.taskId === anchor.taskId && task.type === "task"
        ? { ...task, type: "summary" as const } : task),
      ...branch.map((task) => ({ ...task, taskId: copiedBySource.get(task.taskId)!,
        parentTaskId: rootSet.has(task.taskId) ? parentId : copiedBySource.get(task.parentTaskId!)! })),
    ],
    memberships: [...before.memberships, ...preserved.map((row) => ({
      taskId: copiedBySource.get(row.taskId)!, milestoneTaskId: copiedBySource.get(row.milestoneTaskId)!,
    }))],
    links: [...before.links, ...before.links.filter((link) => copiedIds.has(link.predecessorTaskId) && copiedIds.has(link.successorTaskId))
      .map((link) => ({ ...link, id: `${prefix}${link.id}`, predecessorTaskId: copiedBySource.get(link.predecessorTaskId)!, successorTaskId: copiedBySource.get(link.successorTaskId)! }))],
  };
  const nextProjection = projectStageGates(after);
  assertStageStructureChange(before, after);
  trustedCopyCompletionBaseline(before, after, copiedBySource);
  const milestoneRef = (id: string | null): CopyMilestoneReference => id === null ? null : inverse.has(id)
    ? { kind: "copied", copiedFromMilestoneTaskId: inverse.get(id)! } : { kind: "existing", existingMilestoneTaskId: id };
  const inheritedRef = (id: string | null): CopyInheritanceReference => id === null ? null : inverse.has(id)
    ? { kind: "copied", copiedFromSummaryTaskId: inverse.get(id)! } : { kind: "existing", existingSummaryTaskId: id };
  const sourceId = (id: string | null) => id === null ? null : inverse.get(id) ?? id;
  const impacts: MembershipCopyImpact[] = [];
  for (const task of branch) {
    if (task.type === "milestone") continue;
    const previous = oldProjection.membership.get(task.taskId)!, next = nextProjection.membership.get(copiedBySource.get(task.taskId)!)!;
    const excludedTarget = excluded.find((row) => row.taskId === task.taskId)?.milestoneTaskId ?? null;
    const changed = previous.effectiveMilestoneTaskId !== sourceId(next.effectiveMilestoneTaskId) ||
      previous.inheritedFromTaskId !== sourceId(next.inheritedFromTaskId);
    const reasons: MembershipCopyImpact["reasons"] = [];
    if (excludedTarget) reasons.push("EXTERNAL_EXPLICIT_EXCLUDED");
    if (changed) reasons.push(previous.inheritedFromTaskId && !copiedIds.has(previous.inheritedFromTaskId)
      ? "EXTERNAL_INHERITANCE_CHANGED" : "DESTINATION_INHERITANCE_CHANGED");
    if (!reasons.length) continue;
    impacts.push({ sourceTaskId: task.taskId, excludedExplicitMilestoneTaskId: excludedTarget,
      beforeEffectiveMilestoneTaskId: previous.effectiveMilestoneTaskId, beforeInheritedFromTaskId: previous.inheritedFromTaskId,
      afterExplicit: milestoneRef(next.explicitMilestoneTaskId), afterEffective: milestoneRef(next.effectiveMilestoneTaskId),
      afterInheritedFrom: inheritedRef(next.inheritedFromTaskId), reasons });
  }
  const plan: MembershipCopyPlan = {
    rootTaskIds: roots, copiedTaskIds: branch.map((task) => task.taskId), preservedExplicitMemberships: preserved,
    excludedExplicitMemberships: excluded, impacts, requiresAcknowledgement: excluded.length > 0 || impacts.length > 0,
  };
  return { plan, snapshot: after, copiedBySource };
}

export function planMembershipCopy(input: MembershipCopyPlanInput): MembershipCopyPlan {
  return simulateMembershipCopy(input).plan;
}

export function previewMembershipCopy(
  tasks: readonly ProjectTaskDto[], links: readonly ProjectLinkDto[],
  command: Extract<TaskHierarchyCommandRequest, { kind: "copy" }>,
): MembershipCopyPlan {
  if (tasks.some((task) => !task.membership ||
      [task.membership.explicitMilestoneTaskId, task.membership.effectiveMilestoneTaskId, task.membership.inheritedFromTaskId]
        .some((id) => id !== null && typeof id !== "string"))) {
    throw new StageGateError("INVALID_COPY_MEMBERSHIP_SNAPSHOT");
  }
  return planMembershipCopy({ snapshot: stageSnapshotFromProject(tasks, links),
    order: tasks.map((task) => ({ taskId: task.taskId, siblingOrder: task.siblingOrder })),
    taskIds: command.taskIds ?? [command.taskId!], anchorTaskId: command.anchorTaskId, placement: command.placement });
}
