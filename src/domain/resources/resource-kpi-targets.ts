import type { LogisticsTargetScope, LogisticsTargetMemberKind } from "../../contracts/logistics-targets";
import type { TaskTargetBindingDto, TaskTargetBindingsDto, TaskTargetBindingProvenance } from "../../contracts/task-target-bindings";
import { resolveAllTaskTargetBindings, TaskTargetResolutionError, type TaskTargetLegacyLink, type TaskTargetTask } from "../logistics/task-target-bindings";

/** Snapshot-local identities only. The caller supplies the same canonical Project snapshot as KPI. */
export interface ResourceKpiLogisticsInstance {
  kind: LogisticsTargetMemberKind;
  entityId: string;
  typeCode: string;
  quantity: number;
  /** Equipment's original Project process. System process associations are not Target ownership. */
  projectProcessId?: string | null;
  active?: boolean;
}
export interface ResourceKpiTarget {
  id: string;
  scope: LogisticsTargetScope;
  projectProcessId: string | null;
  occurrenceId: string | null;
  workAreaId: string | null;
  active?: boolean;
  members: readonly { id: string; kind: LogisticsTargetMemberKind; entityId: string }[];
}
export interface ResourceKpiLogisticsInput {
  targets: readonly ResourceKpiTarget[];
  instances: readonly ResourceKpiLogisticsInstance[];
  processes: readonly { id: string; occurrenceId: string | null; processTypeId?: string | null }[];
  workAreas: readonly { id: string; occurrenceId: string }[];
  bindings: readonly TaskTargetBindingDto[];
  legacy: readonly TaskTargetLegacyLink[];
  limits?: Partial<Record<"inputRows" | "lineageEdges" | "provenancePaths" | "projectionCells", number>>;
}
export interface ResourceKpiTargetFilters {
  targetIds?: readonly (string | null)[];
  projectProcessIds?: readonly string[];
  processOccurrenceIds?: readonly string[];
  processTypeIds?: readonly string[];
  workAreaIds?: readonly (string | null)[];
  targetScopes?: readonly LogisticsTargetScope[];
  memberEquipmentIds?: readonly string[];
  memberSystemIds?: readonly string[];
  equipmentTypeCodes?: readonly string[];
  systemTypeCodes?: readonly string[];
  /** Legacy direct/self/subtree paths only; never inferred from Target membership. */
  directEquipmentIds?: readonly string[];
  directSystemIds?: readonly string[];
}
export class ResourceKpiTargetInputError extends Error {
  constructor(readonly code: string) { super(code); this.name = "ResourceKpiTargetInputError"; }
}
export class ResourceKpiTargetLimitError extends Error {
  constructor(readonly dimension: "inputRows" | "lineageEdges" | "provenancePaths" | "projectionCells", readonly actual: number, readonly limit: number) {
    super(`Resource KPI Target ${dimension} limit exceeded`); this.name = "ResourceKpiTargetLimitError";
  }
}
function fail(code: string): never { throw new ResourceKpiTargetInputError(code); }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const unique = (ids: readonly string[]) => [...new Set(ids)].sort(compare);
const instanceKey = (kind: LogisticsTargetMemberKind, entityId: string) => JSON.stringify([kind, entityId]);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => compare(a, b)).map(([key, item]) => [key, canonical(item)])) : value;
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => equal(item, right[index]));
  const a = Object.entries(left).sort(([x], [y]) => compare(x, y)), b = Object.entries(right).sort(([x], [y]) => compare(x, y));
  return a.length === b.length && a.every(([key, value], index) => key === b[index][0] && equal(value, b[index][1]));
}
function distinct<T>(rows: readonly T[], key: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = key(row), old = map.get(id);
    if (old && !equal(old, row)) fail(`CONFLICTING_LOGISTICS_ID:${id}`);
    map.set(id, row);
  }
  return [...map].sort(([a], [b]) => compare(a, b)).map(([, row]) => row);
}
const contains = <T>(values: readonly T[] | undefined, value: T) => !values?.length || values.includes(value);
const defaults = { inputRows: 100_000, lineageEdges: 250_000, provenancePaths: 250_000, projectionCells: 50_000 };

/** Preflight limits precede the canonical resolver, whose ancestor/member output can fan out. */
export function prepareResourceKpiTargets(tasks: readonly TaskTargetTask[], input: ResourceKpiLogisticsInput) {
  const limits = { ...defaults, ...input.limits };
  for (const limit of Object.values(limits)) if (!Number.isSafeInteger(limit) || limit < 1) fail("INVALID_TARGET_BUDGET");
  const assertBudget = (dimension: keyof typeof limits, actual: number) => {
    if (actual > limits[dimension]) throw new ResourceKpiTargetLimitError(dimension, actual, limits[dimension]);
  };
  assertBudget("inputRows", tasks.length + input.targets.length + input.instances.length + input.processes.length + input.workAreas.length + input.legacy.length +
    input.targets.reduce((n, target) => n + target.members.length, 0) + input.bindings.reduce((n, binding) => n + 1 + binding.memberIds.length + (binding.coverageByMember?.length ?? 0), 0));
  const instances = distinct(input.instances, row => instanceKey(row.kind, row.entityId));
  const byInstance = new Map(instances.map(row => [instanceKey(row.kind, row.entityId), row]));
  const processes = distinct(input.processes, row => row.id), workAreas = distinct(input.workAreas, row => row.id);
  const byProcess = new Map(processes.map(row => [row.id, row])), byWorkArea = new Map(workAreas.map(row => [row.id, row]));
  for (const row of instances) {
    if ((row.kind !== "equipment" && row.kind !== "system") || !row.entityId || !row.typeCode || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.kind === "system" && row.quantity !== 1) fail("INVALID_LOGISTICS_INSTANCE");
    if (row.kind === "equipment" && (!row.projectProcessId || !byProcess.has(row.projectProcessId))) fail("INSTANCE_PROCESS_UNAVAILABLE");
  }
  for (const process of processes) if (!process.id || process.occurrenceId === "") fail("INVALID_PROCESS_ID");
  for (const area of workAreas) if (!area.id || !area.occurrenceId) fail("INVALID_WORK_AREA_ID");
  const targets = distinct(input.targets.map(target => ({ ...target,
    members: distinct(target.members, row => row.id),
  })), target => target.id);
  const byTarget = new Map(targets.map(target => [target.id, target]));
  const memberOwners = new Map<string, string>();
  for (const target of targets) {
    if (!target.id || target.members.some(member => !member.id)) fail("INVALID_TARGET_ID");
    if (!target.members.length) fail("EMPTY_TARGET");
    if (target.scope === "process") {
      if (!target.projectProcessId || !target.occurrenceId || byProcess.get(target.projectProcessId)?.occurrenceId !== target.occurrenceId) fail("TARGET_PROCESS_MAPPING_MISMATCH");
      if (target.workAreaId !== null && byWorkArea.get(target.workAreaId)?.occurrenceId !== target.occurrenceId) fail("TARGET_WORK_AREA_MISMATCH");
    } else if (target.scope !== "project_common" || target.projectProcessId !== null || target.occurrenceId !== null || target.workAreaId !== null) fail("INVALID_TARGET_SCOPE");
    const entities = new Set<string>();
    for (const member of target.members) {
      if (memberOwners.has(member.id) && memberOwners.get(member.id) !== target.id) fail("CONFLICTING_TARGET_MEMBER_OWNER");
      memberOwners.set(member.id, target.id);
      const key = instanceKey(member.kind, member.entityId), instance = byInstance.get(key);
      if (!instance) fail("TARGET_INSTANCE_UNAVAILABLE");
      if (entities.has(key)) fail("DUPLICATE_TARGET_INSTANCE");
      entities.add(key);
      if (member.kind === "equipment" && (target.scope === "project_common" || instance.projectProcessId !== target.projectProcessId)) fail("TARGET_EQUIPMENT_PROCESS_MISMATCH");
    }
  }
  const bindings = distinct(input.bindings.map(binding => ({ ...binding, memberIds: unique(binding.memberIds),
    coverageByMember: distinct(binding.coverageByMember ?? [], row => row.memberId),
  })), row => row.id);
  const taskTargets = new Map<string, string>();
  for (const binding of bindings) {
    if (!binding.id || !binding.taskId || !binding.targetId) fail("INVALID_BINDING_ID");
    const key = JSON.stringify([binding.taskId, binding.targetId]);
    if (taskTargets.has(key)) fail("DUPLICATE_TASK_TARGET_BINDING");
    taskTargets.set(key, binding.id);
  }
  const legacy = distinct(input.legacy, row => JSON.stringify([row.taskId, row.kind, row.entityId, row.scope]));
  for (const row of legacy) if (!byInstance.has(instanceKey(row.kind, row.entityId))) fail("LEGACY_INSTANCE_UNAVAILABLE");
  const byTask = new Map(tasks.map(task => [task.id, task]));
  if (byTask.size !== tasks.length) fail("DUPLICATE_TASK_ID");
  const depths = new Map<string, number>(), descendants = new Map(tasks.map(task => [task.id, 1]));
  let lineageEdges = 0;
  for (const task of tasks) {
    const path: string[] = [], seen = new Set<string>();
    let id: string | null = task.id;
    while (id !== null && !depths.has(id)) {
      if (seen.has(id)) fail("CIRCULAR_PARENT");
      seen.add(id); path.push(id);
      const current = byTask.get(id);
      if (!current) fail("MISSING_PARENT");
      id = current.parentId;
    }
    let depth = id === null ? 0 : depths.get(id)!;
    for (const item of path.reverse()) { depth += 1; depths.set(item, depth); }
    lineageEdges += depths.get(task.id)!;
    assertBudget("lineageEdges", lineageEdges);
  }
  for (const task of [...tasks].sort((a, b) => depths.get(b.id)! - depths.get(a.id)!)) {
    if (task.parentId !== null) descendants.set(task.parentId, descendants.get(task.parentId)! + descendants.get(task.id)!);
  }
  let provenancePaths = 0;
  for (const binding of bindings) {
    const target = byTarget.get(binding.targetId);
    if (!target || !byTask.has(binding.taskId)) fail("BINDING_REFERENCE_UNAVAILABLE");
    // Count the binding itself as well as member paths: even malformed empty input is bounded.
    provenancePaths += binding.memberIds.length * (binding.coverageByMember?.length ?? 0);
    provenancePaths += (1 + (binding.selection === "whole" ? target.members.length : binding.memberIds.length)) * (binding.scope === "subtree" ? descendants.get(binding.taskId)! : 1);
    assertBudget("provenancePaths", provenancePaths);
  }
  for (const row of legacy) {
    if (!byTask.has(row.taskId)) fail("LEGACY_SOURCE_TASK_UNAVAILABLE");
    provenancePaths += row.scope === "subtree" ? descendants.get(row.taskId)! : 1;
    assertBudget("provenancePaths", provenancePaths);
  }
  // The F3 resolver owns binding validation; expose a single typed KPI input-error contract.
  const resolved = (() => {
    try {
      return resolveAllTaskTargetBindings({ tasks, targets: targets.map(target => ({ id: target.id,
        members: target.members.map(member => ({ ...member, quantity: byInstance.get(instanceKey(member.kind, member.entityId))!.quantity })),
      })), bindings, legacy });
    } catch (error) {
      if (error instanceof TaskTargetResolutionError) fail(error.code);
      throw error;
    }
  })();
  return { targets, byTarget, instances, byInstance, processes, byProcess, workAreas, byWorkArea, resolved, assertBudget };
}
export type PreparedResourceKpiTargets = ReturnType<typeof prepareResourceKpiTargets>;

const memberFilterKeys = ["memberEquipmentIds", "memberSystemIds", "equipmentTypeCodes", "systemTypeCodes"] as const;
const targetFilterKeys = ["targetIds", "projectProcessIds", "processOccurrenceIds", "processTypeIds", "workAreaIds", "targetScopes", ...memberFilterKeys] as const;
export function hasResourceKpiTargetPathFilters(filters: ResourceKpiTargetFilters): boolean {
  return targetFilterKeys.some(key => Boolean(filters[key]?.length));
}
export function hasResourceKpiTargetFilters(filters: ResourceKpiTargetFilters): boolean {
  return ([...targetFilterKeys, "directEquipmentIds", "directSystemIds"] as const).some(key => Boolean(filters[key]?.length));
}
export function validateResourceKpiTargetFilters(prepared: PreparedResourceKpiTargets, filters: ResourceKpiTargetFilters) {
  if (filters.targetIds?.includes(null) && memberFilterKeys.some(key => filters[key]?.length)) fail("UNLINKED_TARGET_MEMBER_FILTER_CONFLICT");
  const check = <T>(values: readonly T[] | undefined, valid: (value: T) => boolean) => {
    if (values?.some(value => !valid(value))) fail("INVALID_TARGET_SELECTION");
  };
  check(filters.targetIds, id => id === null || prepared.byTarget.has(id));
  check(filters.projectProcessIds, id => prepared.byProcess.has(id));
  check(filters.processOccurrenceIds, id => prepared.processes.some(row => row.occurrenceId === id));
  check(filters.processTypeIds, id => prepared.processes.some(row => row.processTypeId === id));
  check(filters.workAreaIds, id => id === null || prepared.byWorkArea.has(id));
  check(filters.targetScopes, scope => scope === "process" || scope === "project_common");
  for (const kind of ["equipment", "system"] as const) {
    check(kind === "equipment" ? filters.memberEquipmentIds : filters.memberSystemIds, id => prepared.byInstance.has(instanceKey(kind, id)));
    check(kind === "equipment" ? filters.directEquipmentIds : filters.directSystemIds, id => prepared.byInstance.has(instanceKey(kind, id)));
    check(kind === "equipment" ? filters.equipmentTypeCodes : filters.systemTypeCodes, code => prepared.instances.some(row => row.kind === kind && row.typeCode === code));
  }
}
export interface ResourceKpiTargetPath {
  bindingId: string;
  targetId: string;
  members: Array<{ kind: LogisticsTargetMemberKind; entityId: string; provenance: TaskTargetBindingProvenance }>;
}

/** Match all Target axes in one binding, each same-kind ID/type pair on one member.
 * Equipment and System conditions meet at the binding, never across independent bindings. */
export function selectResourceKpiTargetPaths(prepared: PreparedResourceKpiTargets, task: TaskTargetBindingsDto, filters: ResourceKpiTargetFilters): ResourceKpiTargetPath[] {
  const result: ResourceKpiTargetPath[] = [];
  const paths = new Map<string, ResourceKpiTargetPath>();
  for (const binding of [...task.bindings, ...task.inheritedBindings]) paths.set(binding.id, { bindingId: binding.id, targetId: binding.targetId, members: [] });
  for (const member of task.effectiveMembers) for (const source of member.provenance) paths.get(source.bindingId)!.members.push({ kind: member.kind, entityId: member.entityId, provenance: source });
  for (const path of paths.values()) {
    const target = prepared.byTarget.get(path.targetId)!;
    if (!contains(filters.targetIds, target.id) || !contains(filters.projectProcessIds, target.projectProcessId!) || !contains(filters.processOccurrenceIds, target.occurrenceId!) ||
      !contains(filters.processTypeIds, target.projectProcessId === null ? null : prepared.byProcess.get(target.projectProcessId)?.processTypeId ?? null) || !contains(filters.workAreaIds, target.workAreaId) || !contains(filters.targetScopes, target.scope)) continue;
    const memberMatches = (member: ResourceKpiTargetPath["members"][number]) => {
      const instance = prepared.byInstance.get(instanceKey(member.kind, member.entityId))!;
      return member.kind === "equipment"
        ? contains(filters.memberEquipmentIds, member.entityId) && contains(filters.equipmentTypeCodes, instance.typeCode)
        : contains(filters.memberSystemIds, member.entityId) && contains(filters.systemTypeCodes, instance.typeCode);
    };
    if ((filters.memberEquipmentIds?.length || filters.equipmentTypeCodes?.length) && !path.members.some(member => member.kind === "equipment" && memberMatches(member))) continue;
    if ((filters.memberSystemIds?.length || filters.systemTypeCodes?.length) && !path.members.some(member => member.kind === "system" && memberMatches(member))) continue;
    result.push({ ...path, members: path.members.filter(memberMatches).sort((a, b) => compare(JSON.stringify([a.kind, a.entityId, a.provenance.memberId]), JSON.stringify([b.kind, b.entityId, b.provenance.memberId]))) });
  }
  return result.sort((a, b) => compare(a.bindingId, b.bindingId));
}
export function matchesResourceKpiTargetTask(prepared: PreparedResourceKpiTargets, taskId: string, filters: ResourceKpiTargetFilters): boolean {
  const task = prepared.resolved.get(taskId)!;
  if (filters.directEquipmentIds?.length && !task.legacySources.some(source => source.kind === "equipment" && filters.directEquipmentIds!.includes(source.entityId))) return false;
  if (filters.directSystemIds?.length && !task.legacySources.some(source => source.kind === "system" && filters.directSystemIds!.includes(source.entityId))) return false;
  if (!targetFilterKeys.some(key => filters[key]?.length)) return true;
  if (filters.targetIds?.includes(null) && !task.effectiveTargetIds.length && !targetFilterKeys.filter(key => key !== "targetIds").some(key => filters[key]?.length)) return true;
  return selectResourceKpiTargetPaths(prepared, task, filters).length > 0;
}

export interface ResourceKpiTargetMemberSummary {
  equipmentQuantity: number;
  systemCount: number;
  equipmentIds: string[];
  systemIds: string[];
  types: Array<{ kind: LogisticsTargetMemberKind; typeCode: string; instanceIds: string[]; quantity: number }>;
  /** Coverage remains per source. It is never summed or used to multiply Assignment effort. */
  members: Array<ResourceKpiLogisticsInstance & { provenance: Array<TaskTargetBindingProvenance & { taskId: string }>; coverageState: "single" | "multiple" | "unspecified" }>;
}
export function summarizeResourceKpiTargetMembers(prepared: PreparedResourceKpiTargets, paths: readonly { taskId: string; path: ResourceKpiTargetPath }[], legacyTaskIds: readonly string[] = [], legacyInstances: readonly { kind: LogisticsTargetMemberKind; entityId: string }[] = []): ResourceKpiTargetMemberSummary {
  const selected = new Map<string, Array<TaskTargetBindingProvenance & { taskId: string }>>();
  for (const { taskId, path } of paths) for (const member of path.members) {
    const key = instanceKey(member.kind, member.entityId), sources = selected.get(key) ?? [];
    sources.push({ ...member.provenance, taskId }); selected.set(key, sources);
  }
  for (const taskId of legacyTaskIds) for (const source of prepared.resolved.get(taskId)!.legacySources) {
    const key = instanceKey(source.kind, source.entityId);
    if (!selected.has(key)) selected.set(key, []);
  }
  for (const source of legacyInstances) {
    const key = instanceKey(source.kind, source.entityId);
    if (!selected.has(key)) selected.set(key, []);
  }
  const members = [...selected].sort(([a], [b]) => compare(a, b)).map(([key, sources]) => {
    const provenance = distinct(sources, source => JSON.stringify(canonical(source)));
    const modes = new Set(provenance.map(source => JSON.stringify([source.coverageMode, source.coverage])));
    return { ...prepared.byInstance.get(key)!, provenance,
      coverageState: (modes.size > 1 ? "multiple" : !provenance.length || provenance[0].coverageMode === "unspecified" ? "unspecified" : "single") as "single" | "multiple" | "unspecified" };
  });
  const types = new Map<string, { kind: LogisticsTargetMemberKind; typeCode: string; instanceIds: string[]; quantity: number }>();
  for (const member of members) {
    const key = JSON.stringify([member.kind, member.typeCode]), group = types.get(key) ?? { kind: member.kind, typeCode: member.typeCode, instanceIds: [], quantity: 0 };
    group.instanceIds.push(member.entityId); group.quantity += member.quantity; types.set(key, group);
  }
  return { equipmentQuantity: members.filter(row => row.kind === "equipment").reduce((sum, row) => sum + row.quantity, 0),
    systemCount: members.filter(row => row.kind === "system").length,
    equipmentIds: members.filter(row => row.kind === "equipment").map(row => row.entityId), systemIds: members.filter(row => row.kind === "system").map(row => row.entityId),
    types: [...types].sort(([a], [b]) => compare(a, b)).map(([, row]) => row), members };
}
