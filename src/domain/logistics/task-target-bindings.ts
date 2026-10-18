import type {
  TaskTargetBindingDto, TaskTargetBindingProvenance, TaskTargetBindingsDto,
  TaskTargetEffectiveMember, TaskTargetLegacySource, TaskTargetUsageCount,
} from "../../contracts/task-target-bindings";
import type { LogisticsTargetMemberKind } from "../../contracts/logistics-targets";

export interface TaskTargetTask {
  id: string;
  parentId: string | null;
  type: "task" | "summary" | "milestone";
}
export interface TaskTargetMember {
  id: string;
  kind: LogisticsTargetMemberKind;
  entityId: string;
  quantity?: number;
  active?: boolean;
}
export interface TaskTargetLegacyLink {
  taskId: string;
  kind: LogisticsTargetMemberKind;
  entityId: string;
  scope: "self" | "subtree";
}
export interface TaskTargetResolutionInput {
  tasks: readonly TaskTargetTask[];
  targets: readonly { id: string; members: readonly TaskTargetMember[] }[];
  bindings: readonly TaskTargetBindingDto[];
  legacy: readonly TaskTargetLegacyLink[];
}

export class TaskTargetResolutionError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "TaskTargetResolutionError"; }
}
function fail(code: string): never { throw new TaskTargetResolutionError(code); }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const key = (kind: LogisticsTargetMemberKind, id: string) => JSON.stringify([kind, id]);
const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort(compare);
const stable = <T,>(rows: Iterable<T>): T[] => [...rows].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));

function prepare(input: TaskTargetResolutionInput) {
  const tasks = new Map(input.tasks.map(task => [task.id, task]));
  if (tasks.size !== input.tasks.length) fail("DUPLICATE_TASK_ID");
  const targets = new Map(input.targets.map(target => [target.id, target]));
  if (targets.size !== input.targets.length) fail("DUPLICATE_TARGET_ID");
  const ancestors = new Map<string, Set<string>>();
  for (const task of tasks.values()) {
    const lineage = new Set<string>();
    let current: TaskTargetTask | undefined = task;
    while (current) {
      if (lineage.has(current.id)) fail("CIRCULAR_PARENT");
      lineage.add(current.id);
      if (current.parentId === null) break;
      current = tasks.get(current.parentId);
      if (!current) fail("MISSING_PARENT");
    }
    ancestors.set(task.id, lineage);
  }
  const bindings = new Map<string, TaskTargetBindingDto>();
  const selected = new Map<string, readonly TaskTargetMember[]>();
  for (const binding of input.bindings) {
    const source = tasks.get(binding.taskId);
    if (!source) fail("SOURCE_TASK_UNAVAILABLE");
    if (binding.scope !== "self" && binding.scope !== "subtree") fail("INVALID_BINDING_SCOPE");
    if (binding.scope === "subtree" && source.type !== "summary") fail("SUBTREE_REQUIRES_SUMMARY");
    const target = targets.get(binding.targetId);
    if (!target) fail("TARGET_UNAVAILABLE");
    if (binding.selection !== "whole" && binding.selection !== "subset") fail("INVALID_BINDING_SELECTION");
    if (binding.selection === "whole" && binding.memberIds.length) fail("WHOLE_MEMBERS_MUST_BE_EMPTY");
    const memberIds = uniqueSorted(binding.memberIds);
    if (binding.selection === "subset" && !memberIds.length) fail("EMPTY_SUBSET");
    const membersById = new Map(target.members.map(member => [member.id, member]));
    if (membersById.size !== target.members.length) fail("DUPLICATE_TARGET_MEMBER_ID");
    if (memberIds.some(id => !membersById.has(id))) fail("SUBSET_MEMBER_UNAVAILABLE");
    const coverage = new Map<string, number | null>();
    for (const row of binding.coverageByMember ?? []) {
      if (binding.selection === "whole") fail("WHOLE_COVERAGE_UNSUPPORTED");
      if (!memberIds.includes(row.memberId)) fail("COVERAGE_MEMBER_UNAVAILABLE");
      const member = membersById.get(row.memberId)!;
      if (coverage.has(row.memberId) && coverage.get(row.memberId) !== row.coverage) fail("CONFLICTING_MEMBER_COVERAGE");
      if (row.coverage !== null && (member.kind !== "equipment" || !Number.isSafeInteger(row.coverage) ||
        row.coverage <= 0 || !Number.isFinite(member.quantity) || row.coverage > member.quantity!)) fail("INVALID_MEMBER_COVERAGE");
      coverage.set(row.memberId, row.coverage);
    }
    const normalized: TaskTargetBindingDto = {
      id: binding.id, taskId: binding.taskId, targetId: binding.targetId,
      scope: binding.scope, selection: binding.selection, memberIds,
      coverageByMember: [...coverage].sort(([a], [b]) => compare(a, b)).map(([memberId, value]) => ({ memberId, coverage: value })),
    };
    const previous = bindings.get(binding.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) fail("CONFLICTING_BINDING_ID");
    bindings.set(binding.id, normalized);
    selected.set(binding.id, binding.selection === "whole" ? target.members : memberIds.map(id => membersById.get(id)!));
  }
  const legacyByTask = new Map<string, TaskTargetLegacyLink[]>();
  for (const link of input.legacy) {
    const source = tasks.get(link.taskId);
    if (!source) fail("LEGACY_SOURCE_TASK_UNAVAILABLE");
    if (link.scope !== "self" && link.scope !== "subtree") fail("INVALID_LEGACY_SCOPE");
    if (link.scope === "subtree" && source.type !== "summary") fail("LEGACY_SUBTREE_REQUIRES_SUMMARY");
    const group = legacyByTask.get(link.taskId) ?? [];
    group.push(link);
    legacyByTask.set(link.taskId, group);
  }
  const bindingsByTask = new Map<string, TaskTargetBindingDto[]>();
  for (const binding of stable(bindings.values())) {
    const group = bindingsByTask.get(binding.taskId) ?? [];
    group.push(binding);
    bindingsByTask.set(binding.taskId, group);
  }
  return { tasks, ancestors, bindingsByTask, legacyByTask, selected };
}

/** One instance union, retaining every explicit Target path and separate legacy path.
 * No reverse lookup from shared instances to Target membership is ever performed. */
function resolve(taskId: string, input: TaskTargetResolutionInput, index: ReturnType<typeof prepare>): TaskTargetBindingsDto {
  const lineage = index.ancestors.get(taskId);
  if (!lineage) fail("TASK_UNAVAILABLE");
  // Visit only the task's own bindings and ancestor subtree bindings.
  // A full-array filter per task would be O(taskCount * bindingCount).
  const applicable = stable([...lineage].flatMap(sourceId =>
    (index.bindingsByTask.get(sourceId) ?? []).filter(binding =>
      sourceId === taskId || binding.scope === "subtree")));
  const memberMap = new Map<string, { kind: LogisticsTargetMemberKind; entityId: string; sources: Map<string, TaskTargetBindingProvenance> }>();
  for (const binding of applicable) {
    for (const member of index.selected.get(binding.id)!) {
      const coverage = binding.coverageByMember?.find(row => row.memberId === member.id)?.coverage ?? null;
      const source: TaskTargetBindingProvenance = {
        bindingId: binding.id, sourceTaskId: binding.taskId, targetId: binding.targetId,
        memberId: member.id, selection: binding.selection, scope: binding.scope,
        inherited: binding.taskId !== taskId, coverage,
        coverageMode: binding.selection === "whole" || coverage !== null && coverage === member.quantity ? "whole" : coverage === null ? "unspecified" : "partial",
      };
      const id = key(member.kind, member.entityId);
      const entry = memberMap.get(id) ?? { kind: member.kind, entityId: member.entityId, sources: new Map() };
      entry.sources.set(JSON.stringify(source), source);
      memberMap.set(id, entry);
    }
  }
  const effectiveMembers: TaskTargetEffectiveMember[] = [...memberMap.values()].map((member): TaskTargetEffectiveMember => {
    const provenance = stable(member.sources.values());
    const states = new Set(provenance.map(row => JSON.stringify([row.coverageMode, row.coverage])));
    return { kind: member.kind, entityId: member.entityId, provenance,
      coverageState: states.size > 1 ? "multiple" : provenance[0].coverageMode === "unspecified" ? "unspecified" : "single" };
  }).sort((a, b) => compare(key(a.kind, a.entityId), key(b.kind, b.entityId)));
  const legacy = new Map<string, TaskTargetLegacySource>();
  for (const sourceId of lineage) {
    for (const link of index.legacyByTask.get(sourceId) ?? []) {
      if (sourceId !== taskId && link.scope !== "subtree") continue;
      const source: TaskTargetLegacySource = { sourceKind: "legacy_direct", sourceTaskId: link.taskId,
        kind: link.kind, entityId: link.entityId, scope: link.scope, inherited: link.taskId !== taskId };
      legacy.set(JSON.stringify(source), source);
    }
  }
  const legacySources = stable(legacy.values());
  const union = [...effectiveMembers, ...legacySources];
  return {
    taskId, bindings: applicable.filter(binding => binding.taskId === taskId),
    inheritedBindings: applicable.filter(binding => binding.taskId !== taskId), effectiveMembers, legacySources,
    effectiveEquipmentIds: uniqueSorted(union.filter(member => member.kind === "equipment").map(member => member.entityId)),
    effectiveSystemIds: uniqueSorted(union.filter(member => member.kind === "system").map(member => member.entityId)),
    effectiveTargetIds: uniqueSorted(applicable.map(binding => binding.targetId)),
  };
}

export function resolveTaskTargetBindings(taskId: string, input: TaskTargetResolutionInput): TaskTargetBindingsDto {
  return resolve(taskId, input, prepare(input));
}

export function resolveAllTaskTargetBindings(input: TaskTargetResolutionInput): Map<string, TaskTargetBindingsDto> {
  const index = prepare(input);
  return new Map(uniqueSorted([...index.tasks.keys()]).map(id => [id, resolve(id, input, index)]));
}

function countTasks(tasks: readonly TaskTargetTask[], ids: ReadonlySet<string>): TaskTargetUsageCount {
  const ofType = (type: TaskTargetTask["type"]) => uniqueSorted(tasks.filter(task => ids.has(task.id) && task.type === type).map(task => task.id));
  const taskIds = ofType("task"), summaryTaskIds = ofType("summary"), milestoneTaskIds = ofType("milestone");
  return { taskIds, summaryTaskIds, milestoneTaskIds, taskCount: taskIds.length, summaryCount: summaryTaskIds.length, milestoneCount: milestoneTaskIds.length };
}

/** Only explicit/effectively inherited Target bindings establish Target usage. */
export function countTaskTargetUsage(input: TaskTargetResolutionInput, targetId: string, memberId?: string): TaskTargetUsageCount {
  const resolved = resolveAllTaskTargetBindings(input);
  const ids = new Set([...resolved].filter(([, result]) => memberId === undefined
    ? result.effectiveTargetIds.includes(targetId)
    : result.effectiveMembers.some(member => member.provenance.some(source => source.targetId === targetId && source.memberId === memberId)))
    .map(([id]) => id));
  return countTasks(input.tasks, ids);
}

/** Reparenting previews compare actual identities and source paths, not labels. */
export function compareTaskTargetImpact(before: TaskTargetResolutionInput, after: TaskTargetResolutionInput): {
  changedTaskIds: string[]; before: TaskTargetUsageCount; after: TaskTargetUsageCount;
} {
  const previous = resolveAllTaskTargetBindings(before), next = resolveAllTaskTargetBindings(after);
  const changedTaskIds = uniqueSorted([...previous.keys(), ...next.keys()]).filter(id => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id)));
  const ids = new Set(changedTaskIds);
  return { changedTaskIds, before: countTasks(before.tasks, ids), after: countTasks(after.tasks, ids) };
}
