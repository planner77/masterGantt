import type { EquipmentDto, LogisticsSystemDto } from "../../contracts/logistics";
import type { EquipmentWorkAreaDto, TaskProcessContextDto } from "../../contracts/process-context";
import type { TaskTargetBindingProvenance } from "../../contracts/task-target-bindings";
import type { ProjectResourceMembershipDto } from "../../contracts/project-resource-memberships";
import { createWorkingCalendar } from "../scheduling/calendar";
import { prepareResourceKpiSnapshot, selectResourceKpiAssignments, summarizeResourceKpiAssignments, getResourceKpiDiagnostics,
  isResourceKpiTaskDelayed, type ResourceKpiInput, type ResourceKpiSelection, type ResourceKpiAssignmentRow } from "./resource-kpi";
import { summarizeResourceKpiTargetMembers, hasResourceKpiTargetPathFilters } from "./resource-kpi-targets";
import { selectResourceKpiTargetPaths } from "./resource-kpi-targets";
import { selectResourceTargetPlanScope } from "./resource-target-kpi";

/** Domain-only boundary. All collections describe ONE complete canonical Project read.
 * #725/#727 DTOs are reused; fetching/authentication belongs to the caller (#729). */
export interface WbsTaskLedgerInput {
  version: "wbs-task-ledger:v1";
  contextSourceVersion: "explicit-task-context:v1" | "legacy-target-context:v0";
  snapshotProjectPublicId: string;
  kpi: ResourceKpiInput & { logistics: NonNullable<ResourceKpiInput["logistics"]> };
  taskContexts: readonly TaskProcessContextDto[];
  equipmentWorkAreas: readonly EquipmentWorkAreaDto[];
  equipment: readonly Pick<EquipmentDto, "id" | "controlSystems" | "resourceRoles">[];
  systems: readonly Pick<LogisticsSystemDto, "id" | "layer" | "scope" | "processIds" | "coordinatedSystemIds" | "resourceRoles">[];
  resourceMemberships: readonly ProjectResourceMembershipDto[];
  /** Optional activity metadata from the #725 catalogs; absent means unknown, not active. */
  processActivity?: readonly { id: string; active: boolean }[];
  workAreaActivity?: readonly { id: string; active: boolean }[];
  maxProjectionCells?: number;
}
export type WbsTaskLedgerDimension = "process" | "processOccurrence" | "workArea" | "equipment" | "equipmentType" | "system" | "systemType" | "systemCoordination" | "target" | "resource" | "group" | "role" | "milestone" | "wbs";
/** process=Project-local process ID; processOccurrence=catalog occurrence ID.
 * null selects a valid unlinked branch, never an unknown/missing reference. */
export interface WbsTaskLedgerSelector { dimension: WbsTaskLedgerDimension; id: string | null }
export interface WbsTaskLedgerSource extends Partial<TaskTargetBindingProvenance> {
  relationKind: "task-association" | "membership" | "controls" | "coordinates" | "assignment";
  sourceKind: "explicit-task-context" | "ancestor-task-context" | "legacy-target-context" | "target-binding" | "legacy-direct" | "equipment-work-area" | "equipment-process" | "system-process" | "system-controls" | "system-coordinates" | "project-registration" | "responsibility" | "personal-assignment" | "group-assignment";
  sourceTaskId?: string;
  assignmentId?: string;
  entityKind?: "equipment" | "system" | "resource" | "group" | "process" | "workArea" | "project";
  relatedEntityKind?: "equipment" | "system" | "resource" | "group" | "process" | "workArea" | "project";
  taskId?: string;
  entityId: string;
  relatedEntityId?: string;
  role?: string;
  dimension: WbsTaskLedgerDimension;
  inherited?: boolean;
  /** Kept even when W2 excludes ancestor context from the NEW process task set. */
  effective?: boolean;
}
export class WbsTaskLedgerInputError extends Error {
  constructor(readonly code: string) { super(code); this.name = "WbsTaskLedgerInputError"; }
}
const fail = (code: string): never => { throw new WbsTaskLedgerInputError(code); };
const ids = (values: readonly string[]) => [...new Set(values)].sort();
const key = (kind: string, id: string) => JSON.stringify([kind, id]);
const dimensions: WbsTaskLedgerDimension[] = ["process", "processOccurrence", "workArea", "equipment", "equipmentType", "system", "systemType", "systemCoordination", "target", "resource", "group", "role", "milestone", "wbs"];
const personal = (dimension: WbsTaskLedgerDimension) => ["resource", "group", "role"].includes(dimension);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return typeof value === "number" && !Number.isFinite(value) ? String(value) : JSON.stringify(value) ?? "undefined";
}
function distinct<T>(rows: readonly T[], identity: (row: T) => string): T[] {
  if (!Array.isArray(rows)) fail("SNAPSHOT_COLLECTION_MISSING");
  const found = new Map<string, T>();
  for (const row of rows) {
    const id = identity(row);
    if (!id) fail("INVALID_ID");
    if (found.has(id) && canonical(found.get(id)) !== canonical(row)) fail("CONFLICTING_SNAPSHOT_ID");
    found.set(id, row);
  }
  return [...found].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, row]) => row);
}
/** Copy public data before freezing; never freeze caller-owned DTOs. Calendar is rebuilt
 * through its authority because its internal symbol indexes are not JSON DTO fields. */
function frozenCopy<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(item => frozenCopy(item))) as T;
  if (value !== null && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, frozenCopy(v)]))) as T;
  return value;
}

export function resolveWbsTaskLedger(source: WbsTaskLedgerInput) {
  if (!source || source.version !== "wbs-task-ledger:v1" || !["explicit-task-context:v1", "legacy-target-context:v0"].includes(source.contextSourceVersion)) fail("INVALID_SOURCE_VERSION");
  if (!source.snapshotProjectPublicId || source.snapshotProjectPublicId !== source.kpi?.projectPublicId) fail("PROJECT_SNAPSHOT_MISMATCH");
  for (const collection of [source.taskContexts, source.equipmentWorkAreas, source.equipment, source.systems, source.resourceMemberships,
    source.kpi.tasks, source.kpi.memberships, source.kpi.links, source.kpi.resources, source.kpi.assignments,
    source.kpi.logistics?.targets, source.kpi.logistics?.instances, source.kpi.logistics?.processes, source.kpi.logistics?.workAreas, source.kpi.logistics?.bindings, source.kpi.logistics?.legacy]) {
    if (!Array.isArray(collection)) fail("SNAPSHOT_COLLECTION_MISSING");
  }
  const maxProjectionCells = source.maxProjectionCells ?? 50_000;
  if (!Number.isSafeInteger(maxProjectionCells) || maxProjectionCells < 1) fail("INVALID_PROJECTION_BUDGET");
  if (source.contextSourceVersion === "explicit-task-context:v1" && [source.kpi.filters?.projectProcessIds, source.kpi.filters?.processOccurrenceIds, source.kpi.filters?.processTypeIds, source.kpi.filters?.workAreaIds].some(values => values?.length)) fail("USE_EXPLICIT_LEDGER_PROCESS_SELECTORS");
  const inputLimit = source.kpi.logistics.limits?.inputRows ?? 100_000;
  if (!Number.isSafeInteger(inputLimit) || inputLimit < 1) fail("INVALID_INPUT_BUDGET");
  let inputRows = 0;
  const count = (rows: readonly unknown[] | null | undefined) => { if (rows) { if (!Array.isArray(rows)) fail("SNAPSHOT_COLLECTION_MISSING"); inputRows += rows.length; if (inputRows > inputLimit) fail("LEDGER_INPUT_LIMIT_EXCEEDED"); } };
  for (const collection of [source.taskContexts, source.equipmentWorkAreas, source.equipment, source.systems, source.resourceMemberships,
    source.kpi.tasks, source.kpi.memberships, source.kpi.links, source.kpi.resources, source.kpi.assignments,
    source.kpi.logistics.targets, source.kpi.logistics.instances, source.kpi.logistics.processes, source.kpi.logistics.workAreas, source.kpi.logistics.bindings, source.kpi.logistics.legacy,
    source.processActivity, source.workAreaActivity, source.kpi.calendarExceptions, source.kpi.projectCalendar.exceptions]) count(collection);
  for (const row of source.taskContexts) { count(row.processLinks); count(row.workAreaLinks); }
  for (const row of source.equipment) { if (!Array.isArray(row.controlSystems) || !Array.isArray(row.resourceRoles)) fail("SNAPSHOT_COLLECTION_MISSING"); count(row.controlSystems); count(row.resourceRoles); }
  for (const row of source.systems) { if (!Array.isArray(row.processIds) || !Array.isArray(row.coordinatedSystemIds) || !Array.isArray(row.resourceRoles)) fail("SNAPSHOT_COLLECTION_MISSING"); count(row.processIds); count(row.coordinatedSystemIds); count(row.resourceRoles); }
  for (const row of source.resourceMemberships) { count(row.roles); count(row.groups); }
  for (const row of source.kpi.resources) { count(row.groupIds); count(row.roles); }
  for (const row of source.kpi.logistics.targets) count(row.members);
  for (const row of source.kpi.logistics.bindings) { count(row.memberIds); count(row.coverageByMember); }
  const copied = frozenCopy(source);
  const input = { ...copied, kpi: { ...copied.kpi, projectCalendar: createWorkingCalendar({ timezone: source.kpi.projectCalendar.timezone, weekendDays: source.kpi.projectCalendar.weekendDays, exceptions: source.kpi.projectCalendar.exceptions }) } };
  // Exact duplicate joins are normalized before the existing hierarchy/Target authorities.
  const kpi = { ...input.kpi, tasks: distinct(input.kpi.tasks, row => row.taskId), memberships: distinct(input.kpi.memberships, row => row.taskId),
    links: distinct(input.kpi.links, row => row.id) };
  const prepared = prepareResourceKpiSnapshot(kpi), logistics = prepared.logistics!;
  logistics.assertBudget("inputRows", inputRows);
  const assertActivity = (values: readonly { id: string; active: boolean }[] | undefined, dimension: "process" | "workArea") => {
    for (const value of distinct(values ?? [], row => row.id)) if (typeof value.active !== "boolean" || !(dimension === "process" ? logistics.byProcess : logistics.byWorkArea).has(value.id)) fail("ACTIVITY_REFERENCE_UNAVAILABLE");
  };
  assertActivity(input.processActivity, "process"); assertActivity(input.workAreaActivity, "workArea");
  const contexts = distinct(input.taskContexts, row => row.taskId);
  const byContext = new Map(contexts.map(row => [row.taskId, row]));
  if (contexts.length !== prepared.tasks.length || prepared.tasks.some(task => !byContext.has(task.taskId)) || contexts.some(row => !prepared.byTask.has(row.taskId))) fail("TASK_CONTEXT_SNAPSHOT_INCOMPLETE");
  const equipment = distinct(input.equipment, row => row.id), systems = distinct(input.systems, row => row.id);
  const byEquipment = new Map(equipment.map(row => [row.id, row])), bySystem = new Map(systems.map(row => [row.id, row]));
  const assertInstance = (kind: "equipment" | "system", id: string) => { if (!logistics.byInstance.has(key(kind, id))) fail("INSTANCE_REFERENCE_UNAVAILABLE"); };
  for (const row of equipment) assertInstance("equipment", row.id);
  for (const row of systems) assertInstance("system", row.id);
  for (const instance of logistics.instances) if (!(instance.kind === "equipment" ? byEquipment : bySystem).has(instance.entityId)) fail("INSTANCE_METADATA_INCOMPLETE");
  const assertProcess = (id: string) => { if (!logistics.byProcess.has(id)) fail("PROCESS_REFERENCE_UNAVAILABLE"); };
  const assertArea = (processId: string, workAreaId: string, occurrenceId?: string) => {
    assertProcess(processId);
    const process = logistics.byProcess.get(processId)!, area = logistics.byWorkArea.get(workAreaId);
    if (!area || area.occurrenceId !== process.occurrenceId || occurrenceId !== undefined && occurrenceId !== area.occurrenceId) fail("WORK_AREA_OWNERSHIP_MISMATCH");
  };
  const configSources: WbsTaskLedgerSource[] = [];
  const addConfigSource = (source: WbsTaskLedgerSource) => { logistics.assertBudget("provenancePaths", configSources.length + 1); configSources.push(source); };
  const equipmentWorkAreas = distinct(input.equipmentWorkAreas, row => key(row.equipmentId, row.workAreaId));
  for (const row of equipmentWorkAreas) {
    assertInstance("equipment", row.equipmentId); assertArea(row.processId, row.workAreaId, row.occurrenceId);
    addConfigSource({ relationKind: "membership", sourceKind: "equipment-work-area", entityKind: "equipment", entityId: row.equipmentId, relatedEntityKind: "workArea", relatedEntityId: row.workAreaId, dimension: "workArea" });
  }
  for (const row of equipment) {
    for (const control of row.controlSystems) {
      assertInstance("system", control.systemId);
      if (bySystem.get(control.systemId)?.layer !== "controller" || !["primary", "supporting"].includes(control.controlRole)) fail("INVALID_CONTROL_RELATION");
      addConfigSource({ relationKind: "controls", sourceKind: "system-controls", entityKind: "equipment", entityId: row.id, relatedEntityKind: "system", relatedEntityId: control.systemId, role: control.controlRole, dimension: "system" });
    }
    const processId = logistics.byInstance.get(key("equipment", row.id))!.projectProcessId!;
    addConfigSource({ relationKind: "membership", sourceKind: "equipment-process", entityKind: "equipment", entityId: row.id, relatedEntityKind: "process", relatedEntityId: processId, dimension: "process" });
    assertProcess(processId);
  }
  // Bottom-up DAG traversal is iterative: long valid graphs cannot overflow the JS stack.
  const descendants = new Map<string, string[]>(), parents = new Map<string, string[]>();
  const pending = new Map<string, number>();
  for (const system of systems) {
    if (!["controller", "coordinator"].includes(system.layer) || !["project", "processes"].includes(system.scope)) fail("INVALID_SYSTEM_METADATA");
    for (const processId of system.processIds) assertProcess(processId);
    if (system.scope === "project" && system.processIds.length || system.scope === "processes" && !system.processIds.length) fail("INVALID_SYSTEM_SCOPE");
    const children = ids(system.coordinatedSystemIds);
    if (children.length && system.layer !== "coordinator") fail("INVALID_COORDINATION_RELATION");
    pending.set(system.id, children.length);
    for (const childId of children) {
      if (!bySystem.has(childId)) fail("SYSTEM_REFERENCE_UNAVAILABLE");
      const list = parents.get(childId) ?? []; list.push(system.id); parents.set(childId, list);
      addConfigSource({ relationKind: "coordinates", sourceKind: "system-coordinates", entityKind: "system", entityId: system.id, relatedEntityKind: "system", relatedEntityId: childId, dimension: "system" });
    }
    for (const processId of ids(system.processIds)) addConfigSource({ relationKind: "membership", sourceKind: "system-process", entityKind: "system", entityId: system.id, relatedEntityKind: "process", relatedEntityId: processId, dimension: "process" });
  }
  const queue = systems.filter(row => !pending.get(row.id)).map(row => row.id);
  let lineageEdges = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor], related = new Set([id]);
    for (const childId of ids(bySystem.get(id)!.coordinatedSystemIds)) for (const descendantId of descendants.get(childId)!) {
      if (!related.has(descendantId)) { related.add(descendantId); logistics.assertBudget("lineageEdges", lineageEdges + related.size); }
    }
    lineageEdges += related.size; logistics.assertBudget("lineageEdges", lineageEdges);
    descendants.set(id, ids([...related]));
    for (const parentId of parents.get(id) ?? []) {
      const remaining = pending.get(parentId)! - 1; pending.set(parentId, remaining); if (!remaining) queue.push(parentId);
    }
  }
  if (descendants.size !== systems.length) fail("CIRCULAR_COORDINATION");
  const memberships = distinct(input.resourceMemberships, row => row.id);
  for (const row of memberships) {
    if (!prepared.byResource.has(row.id)) fail("RESOURCE_REFERENCE_UNAVAILABLE");
    if (row.registered) addConfigSource({ relationKind: "membership", sourceKind: "project-registration", entityKind: "project", entityId: input.snapshotProjectPublicId, relatedEntityKind: "resource", relatedEntityId: row.id, dimension: "resource" });
  }
  for (const [kind, entities] of [["equipment", equipment], ["system", systems]] as const) for (const row of entities) for (const role of row.resourceRoles) {
    if (!prepared.byResource.has(role.resourceId)) fail("RESPONSIBILITY_RESOURCE_UNAVAILABLE");
    addConfigSource({ relationKind: "membership", sourceKind: "responsibility", entityKind: kind, entityId: row.id, relatedEntityKind: "resource", relatedEntityId: role.resourceId, role: role.role, dimension: "resource" });
  }
  const groupIds = ids([...prepared.resources.flatMap(row => row.groupIds), ...prepared.assignments.filter(row => row.kind === "group").map(row => row.targetId), ...memberships.flatMap(row => row.groups.map(group => group.id))]);
  for (const row of contexts) {
    if ((row.processLinks === null) !== (row.workAreaLinks === null) || row.processLinks !== null && !Array.isArray(row.processLinks) || row.workAreaLinks !== null && !Array.isArray(row.workAreaLinks)) fail("INVALID_TASK_CONTEXT_STATE");
    if (prepared.byTask.get(row.taskId)!.type === "milestone" && ((row.processLinks?.length ?? 0) || (row.workAreaLinks?.length ?? 0))) fail("MILESTONE_CONTEXT_UNSUPPORTED");
    if (new Set((row.processLinks ?? []).map(link => link.processId)).size !== (row.processLinks?.length ?? 0)) fail("DUPLICATE_TASK_PROCESS");
    if (new Set((row.workAreaLinks ?? []).map(link => link.workAreaId)).size !== (row.workAreaLinks?.length ?? 0)) fail("DUPLICATE_TASK_WORK_AREA");
    for (const link of row.processLinks ?? []) {
      assertProcess(link.processId);
      if (!["self", "subtree"].includes(link.scope) || link.scope === "subtree" && prepared.byTask.get(row.taskId)!.type !== "summary") fail("INVALID_CONTEXT_SCOPE");
    }
    for (const link of row.workAreaLinks ?? []) {
      assertArea(link.processId, link.workAreaId);
      if (!["self", "subtree"].includes(link.scope) || link.scope === "subtree" && prepared.byTask.get(row.taskId)!.type !== "summary") fail("INVALID_CONTEXT_SCOPE");
      if (!row.processLinks?.some(process => process.processId === link.processId && (link.scope !== "subtree" || process.scope === "subtree"))) fail("WORK_AREA_PROCESS_NOT_EXPLICIT");
    }
  }
  const assignmentsByTask = new Map<string, typeof prepared.assignments>();
  for (const assignment of prepared.assignments) { const rows = assignmentsByTask.get(assignment.taskId) ?? []; rows.push(assignment); assignmentsByTask.set(assignment.taskId, rows); }
  let provenancePaths = configSources.length, taskLineageEdges = 0;
  logistics.assertBudget("provenancePaths", provenancePaths);
  const rows = prepared.tasks.map(task => {
    const context = byContext.get(task.taskId)!, resolved = logistics.resolved.get(task.taskId)!;
    const sources: WbsTaskLedgerSource[] = [];
    const addTaskSource = (source: WbsTaskLedgerSource) => { provenancePaths += 1; logistics.assertBudget("provenancePaths", provenancePaths); sources.push(source); };
    const processIds = new Set<string>(), workAreaIds = new Set<string>();
    if (input.contextSourceVersion === "explicit-task-context:v1") {
      for (const link of context.processLinks ?? []) processIds.add(link.processId);
      for (const link of context.workAreaLinks ?? []) workAreaIds.add(link.workAreaId);
    } else for (const binding of [...resolved.bindings, ...resolved.inheritedBindings]) {
      const target = logistics.byTarget.get(binding.targetId)!;
      const provenance = { sourceTaskId: binding.taskId, taskId: task.taskId, targetId: binding.targetId, bindingId: binding.id, scope: binding.scope, selection: binding.selection, inherited: binding.taskId !== task.taskId, effective: true };
      if (target.projectProcessId) { processIds.add(target.projectProcessId); addTaskSource({ ...provenance, relationKind: "task-association", sourceKind: "legacy-target-context", entityKind: "process", entityId: target.projectProcessId, dimension: "process" }); }
      if (target.workAreaId) { workAreaIds.add(target.workAreaId); addTaskSource({ ...provenance, relationKind: "task-association", sourceKind: "legacy-target-context", entityKind: "workArea", entityId: target.workAreaId, dimension: "workArea" }); }
    }
    let ancestor: typeof task | undefined = task;
    while (ancestor) {
      taskLineageEdges += 1; logistics.assertBudget("lineageEdges", lineageEdges + taskLineageEdges);
      const inherited = ancestor.taskId !== task.taskId;
      const ancestorContext = byContext.get(ancestor.taskId)!;
      for (const link of ancestorContext.processLinks ?? []) if (!inherited || link.scope === "subtree") addTaskSource({ relationKind: "task-association", sourceKind: inherited ? "ancestor-task-context" : "explicit-task-context", entityKind: "process", entityId: link.processId, scope: link.scope, dimension: "process", sourceTaskId: ancestor.taskId, taskId: task.taskId, inherited, effective: !inherited && input.contextSourceVersion === "explicit-task-context:v1" });
      for (const link of ancestorContext.workAreaLinks ?? []) if (!inherited || link.scope === "subtree") addTaskSource({ relationKind: "task-association", sourceKind: inherited ? "ancestor-task-context" : "explicit-task-context", entityKind: "workArea", entityId: link.workAreaId, scope: link.scope, dimension: "workArea", sourceTaskId: ancestor.taskId, taskId: task.taskId, inherited, effective: !inherited && input.contextSourceVersion === "explicit-task-context:v1" });
      ancestor = ancestor.parentTaskId === null ? undefined : prepared.byTask.get(ancestor.parentTaskId);
    }
    for (const member of resolved.effectiveMembers) for (const provenance of member.provenance) addTaskSource({ ...provenance, relationKind: "task-association", sourceKind: "target-binding", entityKind: member.kind, entityId: member.entityId, dimension: member.kind, taskId: task.taskId, sourceTaskId: provenance.sourceTaskId, inherited: provenance.inherited, effective: true });
    for (const link of resolved.legacySources) addTaskSource({ relationKind: "task-association", sourceKind: "legacy-direct", scope: link.scope, entityKind: link.kind, entityId: link.entityId, dimension: link.kind, taskId: task.taskId, sourceTaskId: link.sourceTaskId, inherited: link.inherited, effective: true });
    for (const assignment of assignmentsByTask.get(task.taskId) ?? []) addTaskSource({ relationKind: "assignment", sourceKind: task.type !== "task" ? "responsibility" : assignment.kind === "resource" ? "personal-assignment" : "group-assignment", assignmentId: assignment.assignmentId, entityKind: assignment.kind, entityId: assignment.targetId, dimension: assignment.kind === "resource" ? "resource" : "group", taskId: task.taskId });
    return { taskId: task.taskId, type: task.type, processIds: ids([...processIds]), processOccurrenceIds: ids([...processIds].flatMap(id => logistics.byProcess.get(id)!.occurrenceId ?? [])), workAreaIds: ids([...workAreaIds]),
      equipmentIds: resolved.effectiveEquipmentIds, systemIds: resolved.effectiveSystemIds, targetIds: resolved.effectiveTargetIds,
      milestoneTaskId: prepared.projection.membership.get(task.taskId)!.effectiveMilestoneTaskId,
      contextState: context.processLinks === null ? "legacy-null" as const : !context.processLinks.length ? "explicit-empty" as const : "explicit" as const,
      sources: distinct(sources, canonical), targetSources: resolved };
  });
  return { input, prepared, rows: frozenCopy(rows), configuration: { equipmentWorkAreas, equipment, systems, resourceMemberships: memberships, sources: distinct(configSources, canonical) },
    descendants, groupIds, maxProjectionCells: Math.min(maxProjectionCells, source.kpi.logistics.limits?.projectionCells ?? 50_000),
    diagnostics: { legacyContextTaskIds: rows.filter(row => row.contextState === "legacy-null").map(row => row.taskId), explicitEmptyProcessTaskIds: rows.filter(row => row.contextState === "explicit-empty").map(row => row.taskId),
      inactiveProcessIds: (input.processActivity ?? []).filter(row => !row.active).map(row => row.id),
      inactiveWorkAreaIds: (input.workAreaActivity ?? []).filter(row => !row.active).map(row => row.id),
      inactiveResourceIds: memberships.filter(row => !row.active).map(row => row.id),
      inactiveTargetIds: logistics.targets.filter(row => row.active === false).map(row => row.id),
      inactiveInstanceIds: logistics.instances.filter(row => row.active === false).map(row => ({ kind: row.kind, id: row.entityId })),
      unassignedWorkAreaEquipmentIds: equipment.filter(row => !equipmentWorkAreas.some(link => link.equipmentId === row.id)).map(row => row.id),
      unmappedProcessIds: logistics.processes.filter(row => row.occurrenceId === null).map(row => row.id),
      projectCommonSystemIds: systems.filter(row => row.scope === "project").map(row => row.id) },
    metadata: { activitySource: { process: input.processActivity === undefined ? "not-supplied" : "supplied", workArea: input.workAreaActivity === undefined ? "not-supplied" : "supplied" }, version: input.version, contextSourceVersion: input.contextSourceVersion, taskGrain: "projectPublicId,taskId", assignmentGrain: "projectPublicId,assignmentId", quantityGrain: "projectPublicId,kind,instanceId", subtotalsAdditive: false, processIdentity: "Project-local process ID; catalog occurrence separate", coordination: "opt-in configuration view; never changes Task process selection", personalNullBranch: "raw no-personal-assignment Tasks plus selected unclassified personal Assignments; T0 diagnostics remain separate" } as const };
}
export type WbsTaskLedgerSnapshot = ReturnType<typeof resolveWbsTaskLedger>;
export type WbsTaskLedgerRow = WbsTaskLedgerSnapshot["rows"][number];

function taskValues(snapshot: WbsTaskLedgerSnapshot, row: WbsTaskLedgerRow, dimension: WbsTaskLedgerDimension): string[] {
  const { prepared } = snapshot;
  if (dimension === "process") return row.processIds;
  if (dimension === "processOccurrence") return row.processOccurrenceIds;
  if (dimension === "workArea") return row.workAreaIds;
  if (dimension === "equipment") return row.equipmentIds;
  if (dimension === "system") return row.systemIds;
  if (dimension === "target") return row.targetIds;
  if (dimension === "milestone") return row.milestoneTaskId === null ? [] : [row.milestoneTaskId];
  if (dimension === "equipmentType" || dimension === "systemType") {
    const kind = dimension === "equipmentType" ? "equipment" : "system";
    return ids((kind === "equipment" ? row.equipmentIds : row.systemIds).map(id => prepared.logistics!.byInstance.get(key(kind, id))!.typeCode));
  }
  if (dimension === "systemCoordination") return [...snapshot.descendants].filter(([, descendants]) => row.systemIds.some(id => descendants.includes(id)) || snapshot.configuration.equipment.some(equipment => row.equipmentIds.includes(equipment.id) && equipment.controlSystems.some(control => descendants.includes(control.systemId)))).map(([id]) => id).sort();
  if (dimension === "wbs") {
    const result: string[] = []; let task = prepared.byTask.get(row.taskId);
    while (task) { result.push(task.taskId); task = task.parentTaskId === null ? undefined : prepared.byTask.get(task.parentTaskId); }
    return result;
  }
  return [];
}
/** Restrict same-kind instance/type and explicit Target paths before any axis order.
 * Different kinds may meet through the SAME Task without inventing controls/membership. */
function onlyUnlinkedTargetFilter(snapshot: WbsTaskLedgerSnapshot): boolean {
  const filters = snapshot.input.kpi.filters ?? {};
  return Boolean(filters.targetIds?.includes(null)) && ![filters.projectProcessIds, filters.processOccurrenceIds, filters.processTypeIds, filters.workAreaIds, filters.targetScopes,
    filters.memberEquipmentIds, filters.memberSystemIds, filters.equipmentTypeCodes, filters.systemTypeCodes].some(values => values?.length);
}
function narrowTaskRow(snapshot: WbsTaskLedgerSnapshot, row: WbsTaskLedgerRow, selectors: readonly WbsTaskLedgerSelector[]): WbsTaskLedgerRow | null {
  const logistics = snapshot.prepared.logistics!, filters = snapshot.input.kpi.filters ?? {};
  const targetSelectors = selectors.filter(selector => selector.dimension === "target");
  if (targetSelectors.some(selector => selector.id === null ? row.targetIds.length > 0 : !row.targetIds.includes(selector.id))) return null;
  const paths = selectResourceKpiTargetPaths(logistics, row.targetSources, filters).filter(path => targetSelectors.every(selector => selector.id === path.targetId));
  const legacy = targetSelectors.some(selector => selector.id !== null) || hasResourceKpiTargetPathFilters(filters) && !onlyUnlinkedTargetFilter(snapshot) ? [] : row.targetSources.legacySources;
  let equipmentIds = ids([...paths.flatMap(path => path.members.filter(member => member.kind === "equipment").map(member => member.entityId)), ...legacy.filter(member => member.kind === "equipment").map(member => member.entityId)]);
  let systemIds = ids([...paths.flatMap(path => path.members.filter(member => member.kind === "system").map(member => member.entityId)), ...legacy.filter(member => member.kind === "system").map(member => member.entityId)]);
  for (const kind of ["equipment", "system"] as const) {
    const conditions = selectors.filter(selector => selector.dimension === kind || selector.dimension === `${kind}Type`);
    const current = kind === "equipment" ? equipmentIds : systemIds;
    const narrowed = current.filter(id => conditions.every(selector => selector.id !== null && (selector.dimension === kind ? id === selector.id : logistics.byInstance.get(key(kind, id))!.typeCode === selector.id)));
    if (conditions.some(selector => selector.id === null ? current.length > 0 : !narrowed.length)) return null;
    if (kind === "equipment") equipmentIds = narrowed; else systemIds = narrowed;
  }
  const processConditions = selectors.filter(selector => selector.dimension === "process" || selector.dimension === "processOccurrence");
  const processIds = row.processIds.filter(id => processConditions.every(selector => selector.id !== null && (selector.dimension === "process" ? id === selector.id : logistics.byProcess.get(id)!.occurrenceId === selector.id)));
  if (processConditions.some(selector => selector.id === null ? row.processIds.length > 0 : !processIds.length)) return null;
  return { ...row, equipmentIds, systemIds, targetIds: targetSelectors.length ? ids(paths.map(path => path.targetId)) : row.targetIds,
    processIds, processOccurrenceIds: ids(processIds.flatMap(id => logistics.byProcess.get(id)!.occurrenceId ?? [])) };
}
function assignmentValues(row: ResourceKpiAssignmentRow, dimension: WbsTaskLedgerDimension): string[] {
  return dimension === "resource" ? [row.resourceId] : dimension === "group" ? row.groupIds : row.roles;
}
function validateSelector(snapshot: WbsTaskLedgerSnapshot, selector: WbsTaskLedgerSelector) {
  if (!dimensions.includes(selector.dimension)) fail("INVALID_LEDGER_DIMENSION");
  if (selector.id === null) return;
  const { logistics, byResource, byTask } = snapshot.prepared;
  const valid = selector.dimension === "process" ? logistics!.byProcess.has(selector.id)
    : selector.dimension === "processOccurrence" ? logistics!.processes.some(row => row.occurrenceId === selector.id)
    : selector.dimension === "workArea" ? logistics!.byWorkArea.has(selector.id)
    : selector.dimension === "target" ? logistics!.byTarget.has(selector.id)
    : selector.dimension === "equipment" ? logistics!.byInstance.has(key("equipment", selector.id))
    : selector.dimension === "system" || selector.dimension === "systemCoordination" ? logistics!.byInstance.has(key("system", selector.id))
    : selector.dimension === "equipmentType" || selector.dimension === "systemType" ? logistics!.instances.some(row => row.kind === (selector.dimension === "equipmentType" ? "equipment" : "system") && row.typeCode === selector.id)
    : selector.dimension === "resource" ? byResource.has(selector.id)
    : selector.dimension === "group" ? snapshot.groupIds.includes(selector.id)
    : selector.dimension === "role" ? snapshot.prepared.resources.some(row => row.roles.includes(selector.id!) || selector.id === "UNSPECIFIED" && !row.roles.length)
    : selector.dimension === "milestone" ? byTask.get(selector.id)?.type === "milestone"
    : byTask.has(selector.id);
  if (!valid) fail("LEDGER_SELECTION_UNAVAILABLE");
}

/** Every step INTERSECTS current Task identities and current personal Assignment
 * identities. A shared Milestone/System never reintroduces a sibling Task. */
export function selectWbsTaskLedger(snapshot: WbsTaskLedgerSnapshot, selectors: readonly WbsTaskLedgerSelector[] = []) {
  for (const selector of selectors) validateSelector(snapshot, selector);
  const base = selectResourceKpiAssignments(snapshot.prepared);
  let rows = snapshot.rows.filter(row => row.type === "task" && base.t0Ids.has(row.taskId))
    .flatMap(row => { const narrowed = narrowTaskRow(snapshot, row, selectors); return narrowed ? [narrowed] : []; });
  const rawPersonallyAssigned = new Set(snapshot.prepared.assignments.filter(row => row.kind === "resource" && snapshot.prepared.byTask.get(row.taskId)!.type === "task").map(row => row.taskId));
  let diagnosticRows = [...rows];
  let assignments = base.assignments;
  for (const selector of selectors) {
    validateSelector(snapshot, selector);
    const matches = (values: readonly string[]) => selector.id === null ? !values.length : values.includes(selector.id);
    if (personal(selector.dimension)) {
      assignments = assignments.filter(row => matches(assignmentValues(row, selector.dimension)));
      const taskIds = new Set(assignments.map(row => row.taskId)); rows = rows.filter(row => taskIds.has(row.taskId) || selector.id === null && !rawPersonallyAssigned.has(row.taskId));
    } else {
      rows = rows.filter(row => matches(taskValues(snapshot, row, selector.dimension)));
      diagnosticRows = diagnosticRows.filter(row => matches(taskValues(snapshot, row, selector.dimension)));
    }
    const current = new Set(rows.map(row => row.taskId)); assignments = assignments.filter(row => current.has(row.taskId));
  }
  const taskIds = rows.map(row => row.taskId);
  const diagnosticIds = new Set(diagnosticRows.map(row => row.taskId));
  const selection: ResourceKpiSelection = { ...base, t0: base.t0.filter(row => diagnosticIds.has(row.taskId)), t0Ids: diagnosticIds, assignments };
  return { selectors: selectors.map(row => ({ ...row })), taskIds, assignmentIds: assignments.map(row => row.assignmentId), rows, assignments, selection };
}
export type WbsTaskLedgerSelection = ReturnType<typeof selectWbsTaskLedger>;

/** Configuration is a separate population: idle entities retain original quantities.
 * It never provides a substitute process/WorkArea source for the Task selection. */
export function summarizeWbsTaskLedgerConfiguration(snapshot: WbsTaskLedgerSnapshot, selectors: readonly WbsTaskLedgerSelector[] = []) {
  for (const selector of selectors) validateSelector(snapshot, selector);
  const { logistics } = snapshot.prepared;
  const ignored = selectors.filter(selector => personal(selector.dimension) || selector.dimension === "milestone" || selector.dimension === "wbs");
  const used = selectors.filter(selector => !ignored.includes(selector));
  const matches = (values: readonly string[], id: string | null) => id === null ? !values.length : values.includes(id);
  const members = logistics!.instances.filter(instance => used.every(selector => {
    const kind = instance.kind, id = instance.entityId;
    const equipment = kind === "equipment" ? snapshot.configuration.equipment.filter(row => row.id === id) : snapshot.configuration.equipment.filter(row => row.controlSystems.some(control => control.systemId === id));
    const equipmentIds = equipment.map(row => row.id);
    const systemIds = kind === "system" ? [id] : equipment.flatMap(row => row.controlSystems.map(control => control.systemId));
    const sameInstance = (kind: "equipment" | "system", values: readonly string[]) => {
      const conditions = used.filter(row => row.dimension === kind || row.dimension === `${kind}Type`);
      if (conditions.some(row => row.id === null)) return !values.length && conditions.every(row => row.id === null);
      return values.some(value => conditions.every(row => row.dimension === kind ? row.id === value : row.id === logistics!.byInstance.get(key(kind, value))!.typeCode));
    };
    if (selector.dimension === "equipment" || selector.dimension === "equipmentType") return sameInstance("equipment", equipmentIds);
    if (selector.dimension === "system" || selector.dimension === "systemType") return sameInstance("system", systemIds);
    if (selector.dimension === "systemCoordination") return matches([...snapshot.descendants].filter(([, descendants]) => systemIds.some(systemId => descendants.includes(systemId))).map(([systemId]) => systemId), selector.id);
    if (selector.dimension === "target") return matches(logistics!.targets.filter(target => target.members.some(member => member.kind === kind && member.entityId === id)).map(target => target.id), selector.id);
    const processIds = kind === "equipment" ? instance.projectProcessId ? [instance.projectProcessId] : [] : snapshot.configuration.systems.find(row => row.id === id)!.processIds;
    if (selector.dimension === "process" || selector.dimension === "processOccurrence") {
      const conditions = used.filter(row => row.dimension === "process" || row.dimension === "processOccurrence");
      if (conditions.some(row => row.id === null)) return !processIds.length && conditions.every(row => row.id === null);
      return processIds.some(processId => conditions.every(row => row.dimension === "process" ? row.id === processId : row.id === logistics!.byProcess.get(processId)!.occurrenceId));
    }
    if (selector.dimension === "workArea") return matches(snapshot.configuration.equipmentWorkAreas.filter(row => equipmentIds.includes(row.equipmentId)).map(row => row.workAreaId), selector.id);
    return true;
  }));
  return { scope: "registered configuration; independent from related Task/Assignment population" as const,
    selectors: used, ignoredTaskAndPersonalSelectors: ignored,
    equipmentQuantity: members.filter(row => row.kind === "equipment").reduce((sum, row) => sum + row.quantity, 0),
    systemCount: members.filter(row => row.kind === "system").length,
    equipmentIds: members.filter(row => row.kind === "equipment").map(row => row.entityId), systemIds: members.filter(row => row.kind === "system").map(row => row.entityId), members };
}

export function summarizeWbsTaskLedger(snapshot: WbsTaskLedgerSnapshot, selection: WbsTaskLedgerSelection) {
  const assignmentTotals = summarizeResourceKpiAssignments(snapshot.prepared, selection.assignments);
  const tasks = selection.taskIds.map(id => snapshot.prepared.byTask.get(id)!);
  const count = (predicate: (task: typeof tasks[number]) => boolean) => { const taskIds = tasks.filter(predicate).map(row => row.taskId); return { count: taskIds.length, taskIds }; };
  const denominator = tasks.reduce((sum, task) => sum + (task.duration ?? 0), 0), numerator = tasks.reduce((sum, task) => sum + (task.duration ?? 0) * (task.progress ?? 0), 0);
  const completed = count(task => task.status === "completed");
  const logistics = snapshot.prepared.logistics!;
  const selectedTargets = selection.selectors.filter(row => row.dimension === "target");
  const paths = selection.rows.flatMap(row => selectResourceKpiTargetPaths(logistics, logistics.resolved.get(row.taskId)!, snapshot.input.kpi.filters ?? {})
    .filter(path => selectedTargets.every(selector => selector.id === path.targetId))
    .map(path => ({ taskId: row.taskId, path: { ...path, members: path.members.filter(member => (member.kind === "equipment" ? row.equipmentIds : row.systemIds).includes(member.entityId)) } })));
  const legacy = selectedTargets.some(row => row.id !== null) || hasResourceKpiTargetPathFilters(snapshot.input.kpi.filters ?? {}) && !onlyUnlinkedTargetFilter(snapshot) ? [] : selection.rows.flatMap(row => row.targetSources.legacySources.filter(member => (member.kind === "equipment" ? row.equipmentIds : row.systemIds).includes(member.entityId)));
  const relatedMembers = summarizeResourceKpiTargetMembers(logistics, paths, [], legacy);
  const taskTotals = { taskIds: selection.taskIds, taskCount: tasks.length, notStarted: count(task => task.status === "not_started"), inProgress: count(task => task.status === "in_progress"), completed,
    delayed: count(task => isResourceKpiTaskDelayed(task, snapshot.input.kpi.asOfDate)),
    completion: { numerator: completed.count, denominator: tasks.length, percent: tasks.length ? completed.count / tasks.length * 100 : null },
    progress: { numerator, denominator, percent: denominator ? numerator / denominator : null } };
  const projectAssignedResourceIds = ids(snapshot.prepared.assignments.filter(row => row.kind === "resource" && snapshot.prepared.byTask.get(row.taskId)!.type === "task").map(row => row.targetId));
  return { tasks: taskTotals, assignments: assignmentTotals, relatedMembers, configurationReference: summarizeWbsTaskLedgerConfiguration(snapshot, selection.selectors),
    diagnostics: getResourceKpiDiagnostics(snapshot.prepared, selection.selection),
    participation: { projectAssignedResourceIds, projectAssignedCount: projectAssignedResourceIds.length, registeredResourceIds: snapshot.configuration.resourceMemberships.filter(row => row.registered).map(row => row.id), registeredCount: snapshot.configuration.resourceMemberships.filter(row => row.registered).length,
      assignedResourceIds: assignmentTotals.resourceIds, assignedCount: assignmentTotals.resourceCount },
    fullMilestones: [...snapshot.prepared.projection.gates].map(([milestoneTaskId, stageGate]) => ({ milestoneTaskId, stageGate })) };
}
export interface WbsTaskLedgerProjectionNode {
  selector: WbsTaskLedgerSelector;
  taskIds: string[];
  assignmentIds: string[];
  totals: ReturnType<typeof summarizeWbsTaskLedger>;
  children: WbsTaskLedgerProjectionNode[];
}
/** Parents always recompute a raw distinct union. Child subtotal addition is invalid.
 * Registered/configured entities with no Tasks remain visible as empty roots. */
export function projectWbsTaskLedger(snapshot: WbsTaskLedgerSnapshot, order: readonly WbsTaskLedgerDimension[], selectors: readonly WbsTaskLedgerSelector[] = []) {
  if (new Set(order).size !== order.length || order.some(dimension => !dimensions.includes(dimension))) fail("INVALID_LEDGER_PROJECTION_ORDER");
  let cells = 1;
  const root = selectWbsTaskLedger(snapshot, selectors);
  const addCells = (count: number) => { cells += count; if (cells > snapshot.maxProjectionCells) fail("LEDGER_PROJECTION_LIMIT_EXCEEDED"); snapshot.prepared.logistics!.assertBudget("projectionCells", cells); };
  const build = (current: WbsTaskLedgerSelection, depth: number): WbsTaskLedgerProjectionNode[] => {
    if (depth === order.length) return [];
    const dimension = order[depth];
    const candidates: Array<string | null> = [];
    if (personal(dimension)) {
      for (const row of current.assignments) { const values = assignmentValues(row, dimension); addCells(Math.max(1, values.length)); candidates.push(...(values.length ? values : [null])); }
      const rawAssigned = new Set(snapshot.prepared.assignments.filter(row => row.kind === "resource").map(row => row.taskId));
      if (current.rows.some(row => !rawAssigned.has(row.taskId))) { addCells(1); candidates.push(null); }
    } else for (const row of current.rows) { const values = taskValues(snapshot, row, dimension); addCells(Math.max(1, values.length)); candidates.push(...(values.length ? values : [null])); }
    if (depth === 0 && selectors.length === 0) {
      const logistics = snapshot.prepared.logistics!;
      if (dimension === "process") candidates.push(...logistics.processes.map(row => row.id));
      if (dimension === "processOccurrence") candidates.push(...logistics.processes.flatMap(row => row.occurrenceId ?? []));
      if (dimension === "workArea") candidates.push(...logistics.workAreas.map(row => row.id));
      if (dimension === "equipment" || dimension === "system" || dimension === "systemCoordination") candidates.push(...logistics.instances.filter(row => row.kind === (dimension === "equipment" ? "equipment" : "system")).map(row => row.entityId));
      if (dimension === "target") candidates.push(...logistics.targets.map(row => row.id));
      if (dimension === "resource") candidates.push(...snapshot.configuration.resourceMemberships.map(row => row.id));
      if (dimension === "group") candidates.push(...snapshot.groupIds);
    }
    return [...new Set(candidates)].sort((a, b) => a === null ? 1 : b === null ? -1 : a < b ? -1 : a > b ? 1 : 0).map(id => {
      addCells(1);
      const selector = { dimension, id }, selected = selectWbsTaskLedger(snapshot, [...current.selectors, selector]);
      return { selector, taskIds: selected.taskIds, assignmentIds: selected.assignmentIds, totals: summarizeWbsTaskLedger(snapshot, selected), children: build(selected, depth + 1) };
    });
  };
  return { order: [...order], taskIds: root.taskIds, assignmentIds: root.assignmentIds, totals: summarizeWbsTaskLedger(snapshot, root), children: build(root, 0), metadata: snapshot.metadata };
}

/** Reuses the existing R policy. Task/Target/process selections affect selected demand
 * only; project demand uses the same R across the complete canonical Project. */
export function selectWbsTaskLedgerPlanScope(snapshot: WbsTaskLedgerSnapshot, selection = selectWbsTaskLedger(snapshot)) {
  const resourceSelectors = selection.selectors.filter(row => personal(row.dimension));
  const capacity = selectResourceTargetPlanScope(snapshot.prepared, selectResourceKpiAssignments(snapshot.prepared));
  const permitted = new Set(capacity.capacityResourceIds.filter(id => {
    const resource = snapshot.prepared.byResource.get(id)!;
    return resourceSelectors.every(selector => {
      const values = selector.dimension === "resource" ? [id] : selector.dimension === "group" ? resource.groupIds : resource.roles.length ? resource.roles : ["UNSPECIFIED"];
      return selector.id === null ? !values.length : values.includes(selector.id);
    });
  }));
  return { capacityResourceIds: capacity.capacityResourceIds.filter(id => permitted.has(id)), selectedAssignments: selection.assignments,
    fullProjectAssignments: capacity.fullProjectAssignments.filter(row => permitted.has(row.resourceId)) };
}
export function calculateWbsTaskLedgerKpi(input: WbsTaskLedgerInput, order: readonly WbsTaskLedgerDimension[] = [], selectors: readonly WbsTaskLedgerSelector[] = []) {
  const snapshot = resolveWbsTaskLedger(input), selection = selectWbsTaskLedger(snapshot, selectors);
  return { ...projectWbsTaskLedger(snapshot, order, selectors), taskSources: selection.rows, configuration: snapshot.configuration, diagnostics: snapshot.diagnostics,
    planScope: selectWbsTaskLedgerPlanScope(snapshot, selection) };
}
export const WBS_TASK_LEDGER_KPI_DICTIONARY = [
  { name: "작업 진척·완료·지연", grain: "distinct ordinary taskId", scope: "selected WBS Task union, including unassigned", definition: "progress=sum(duration*progress)/sum(duration), denominator0=null; completion=completed/task count; delay=canonical end<asOf AND progress<100" },
  { name: "관련 계획 M/D·M/M", grain: "projectPublicId,assignmentId", scope: "selected Task AND personal Assignment intersection", definition: "existing Resource KPI effort/calendar/mdPerMm authority; no quantity/WorkArea/Target multiplier or apportionment" },
  { name: "관련 설비 수량·System 식수", grain: "projectPublicId,kind,instanceId", scope: "selected Tasks effective direct+Target union", definition: "original Equipment quantity; System=1; coverage kept per provenance" },
  { name: "Capacity", grain: "resourceId,date", scope: "existing R, independent of Task filters; same-R Project demand", definition: "existing Resource Plan authority; registration/roles never synthesize Assignment or capacity" },
  { name: "Milestone Gate", grain: "full canonical milestone", scope: "full E(M)/P(M)", definition: "existing projectStageGates authority; selected Task subset never shrinks Gate" },
] as const;
