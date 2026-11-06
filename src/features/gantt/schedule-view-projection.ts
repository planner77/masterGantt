import type { EquipmentDto, TaskLogisticsLinksDto } from "../../contracts/logistics";
import type { ProjectTaskDto } from "../../contracts/projects";
import type { ResourceDto, ResourceGroupDto, ProjectAssignmentDto } from "../../contracts/resources";

export type ScheduleView = "wbs" | "resource" | "equipment";
export interface ScheduleViewLabels {
  personUnspecified: string;
  groupUnassigned: string;
  fullyUnassigned: string;
  modelUnspecified: string;
  equipmentUnlinked: string;
}
const defaultLabels: ScheduleViewLabels = {
  personUnspecified: "개인 미지정", groupUnassigned: "그룹 미소속", fullyUnassigned: "완전 미할당",
  modelUnspecified: "모델 미지정", equipmentUnlinked: "설비 미연결",
};
export interface ScheduleViewProjectionInput {
  view: Exclude<ScheduleView, "wbs">;
  /** Complete current canonical snapshot; visible IDs only narrow ordinary Tasks. */
  tasks: readonly ProjectTaskDto[];
  visibleTaskIds: readonly string[];
  assignments: readonly ProjectAssignmentDto[];
  resources: readonly Pick<ResourceDto, "id" | "name" | "active">[];
  groups: readonly Pick<ResourceGroupDto, "id" | "name" | "active" | "memberResourceIds">[];
  equipment: readonly Pick<EquipmentDto, "id" | "name" | "equipmentType" | "model" | "managementUnit" | "quantity" | "active">[];
  equipmentTypes: readonly { code: string; name: string }[];
  /** Server resolver output from the same Project revision, including archive compatibility. */
  taskEquipment: readonly TaskLogisticsLinksDto[];
  labels?: Partial<ScheduleViewLabels>;
  maxRows?: number;
}
export interface ScheduleViewRow {
  viewRowKey: string;
  parentViewRowKey: string | null;
  kind: "group" | "task";
  groupKind?: "resourceGroup" | "resource" | "unspecifiedPerson" | "ungrouped" | "unassigned" | "equipmentType" | "model" | "equipment" | "unlinked";
  label: string;
  canonicalTaskId: string | null;
  /** Only real Task rows carry a canonical DTO. No virtual row can become a mutation target. */
  task: Readonly<ProjectTaskDto> | null;
  depth: number;
  taskCount: number;
  start: string | null;
  end: string | null;
  progress: number | null;
  active?: boolean;
  entityId?: string;
  managementUnit?: EquipmentDto["managementUnit"];
  quantity?: number;
  /** Multiple direct/inherited/archive origins survive row deduplication. */
  equipmentSources?: TaskLogisticsLinksDto;
}
export class ScheduleViewProjectionError extends Error {
  constructor(readonly code: string) { super(code); this.name = "ScheduleViewProjectionError"; }
}
function fail(code: string): never { throw new ScheduleViewProjectionError(code); }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const key = (...parts: unknown[]) => JSON.stringify(parts);
function index<T>(rows: readonly T[], getId: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const id = getId(row);
    if (!id || result.has(id)) fail("DUPLICATE_OR_EMPTY_SOURCE_ID");
    result.set(id, row);
  }
  return result;
}

/** App-owned display tree only. Neither canonical hierarchy nor writer IDs are changed.
 * Assignment periods/calendars, responsibility and owner relationships never set bar dates. */
export function projectScheduleView(input: ScheduleViewProjectionInput) {
  const labels = { ...defaultLabels, ...input.labels };
  const maxRows = input.maxRows ?? 50_000;
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 50_000) fail("INVALID_ROW_BUDGET");
  const byTask = index(input.tasks, row => row.taskId);
  const resources = index(input.resources, row => row.id), groups = index(input.groups, row => row.id);
  const equipment = index(input.equipment, row => row.id), types = index(input.equipmentTypes, row => row.code);
  const taskEquipment = index(input.taskEquipment, row => row.taskId);
  const visible = new Set(input.visibleTaskIds);
  for (const id of visible) if (!byTask.has(id)) fail("VISIBLE_TASK_UNAVAILABLE");
  const tasks = input.tasks.filter(task => visible.has(task.taskId) && task.type === "task");
  const assignmentByTask = new Map<string, ProjectAssignmentDto[]>();
  const summaryAssignmentIds = new Set<string>();
  for (const assignment of input.assignments) {
    const task = byTask.get(assignment.taskId);
    if (!task) fail("ASSIGNMENT_TASK_UNAVAILABLE");
    if (!(assignment.target.kind === "resource" ? resources : groups).has(assignment.target.id)) fail("ASSIGNMENT_TARGET_UNAVAILABLE");
    if (task.type !== "task") summaryAssignmentIds.add(assignment.id);
    const existing = assignmentByTask.get(assignment.taskId) ?? [];
    existing.push(assignment); assignmentByTask.set(assignment.taskId, existing);
  }
  const groupsByResource = new Map<string, string[]>();
  for (const group of input.groups) for (const id of new Set(group.memberResourceIds)) {
    if (!resources.has(id)) fail("GROUP_MEMBER_UNAVAILABLE");
    const ids = groupsByResource.get(id) ?? []; ids.push(group.id); groupsByResource.set(id, ids);
  }
  const rows = new Map<string, ScheduleViewRow>();
  const children = new Map<string | null, string[]>();
  const branchTasks = new Map<string, Set<string>>();
  function add(row: ScheduleViewRow) {
    if (rows.has(row.viewRowKey)) return;
    if (rows.size >= maxRows) fail("VIEW_ROW_LIMIT_EXCEEDED");
    rows.set(row.viewRowKey, row);
    const siblings = children.get(row.parentViewRowKey) ?? [];
    siblings.push(row.viewRowKey); children.set(row.parentViewRowKey, siblings);
  }
  function group(path: unknown[], parent: ScheduleViewRow | null, label: string, groupKind: NonNullable<ScheduleViewRow["groupKind"]>, metadata: Partial<ScheduleViewRow> = {}) {
    const id = key(input.view, ...path);
    const existing = rows.get(id);
    if (existing) return existing;
    const row: ScheduleViewRow = { ...metadata, viewRowKey: id, parentViewRowKey: parent?.viewRowKey ?? null,
      kind: "group", groupKind, label, canonicalTaskId: null, task: null, depth: parent ? parent.depth + 1 : 0,
      taskCount: 0, start: null, end: null, progress: null };
    add(row); branchTasks.set(id, new Set()); return row;
  }
  function appendTask(task: ProjectTaskDto, parent: ScheduleViewRow, sources?: TaskLogisticsLinksDto) {
    add({ viewRowKey: key(input.view, parent.viewRowKey, "task", task.taskId), parentViewRowKey: parent.viewRowKey,
      kind: "task", label: task.name, canonicalTaskId: task.taskId, task, depth: parent.depth + 1,
      taskCount: 1, start: task.start, end: task.end, progress: task.progress,
      ...(sources ? { equipmentSources: sources } : {}) });
    let branch: ScheduleViewRow | undefined = parent;
    while (branch) {
      branchTasks.get(branch.viewRowKey)!.add(task.taskId);
      branch = branch.parentViewRowKey === null ? undefined : rows.get(branch.parentViewRowKey);
    }
  }
  if (input.view === "resource") {
    const sortedGroups = [...groups.values()].sort((a,b) => compare(a.name,b.name) || compare(a.id,b.id));
    const groupOrder = new Map(sortedGroups.map((value, i) => [value.id,i]));
    for (const task of tasks) {
      const assignments = assignmentByTask.get(task.taskId) ?? [];
      if (!assignments.length) { appendTask(task, group(["unassigned"], null, labels.fullyUnassigned, "unassigned")); continue; }
      for (const assignment of assignments) {
        if (assignment.target.kind === "group") {
          const value = groups.get(assignment.target.id)!;
          const parent = group(["group", value.id], null, value.name, "resourceGroup", { entityId: value.id, active: value.active });
          appendTask(task, group(["group", value.id, "person-unspecified"], parent, labels.personUnspecified, "unspecifiedPerson"));
        } else {
          const value = resources.get(assignment.target.id)!;
          const memberships = [...(groupsByResource.get(value.id) ?? [])].sort((a,b) => groupOrder.get(a)! - groupOrder.get(b)!);
          for (const groupId of memberships.length ? memberships : [null]) {
            const owner = groupId === null ? null : groups.get(groupId)!;
            const parent = owner ? group(["group", owner.id], null, owner.name, "resourceGroup", { entityId: owner.id, active: owner.active })
              : group(["ungrouped"], null, labels.groupUnassigned, "ungrouped");
            appendTask(task, group(["group", groupId, "resource", value.id], parent, value.name, "resource", { entityId: value.id, active: value.active }));
          }
        }
      }
    }
  } else {
    const equipmentRows = new Map<string, ScheduleViewRow>();
    for (const value of [...equipment.values()].sort((a,b) => compare(a.equipmentType,b.equipmentType) || compare(a.model.trim(),b.model.trim()) || compare(a.name,b.name) || compare(a.id,b.id))) {
      const type = types.get(value.equipmentType);
      if (!type) fail("EQUIPMENT_TYPE_UNAVAILABLE");
      const parent = group(["type", value.equipmentType], null, type.name, "equipmentType", { entityId: value.equipmentType });
      const model = value.model.trim();
      const modelRow = group(["type", value.equipmentType, "model", model || null], parent, model || labels.modelUnspecified, "model");
      equipmentRows.set(value.id, group(["type", value.equipmentType, "model", model || null, "equipment", value.id], modelRow, value.name, "equipment", {
        entityId: value.id, active: value.active, managementUnit: value.managementUnit, quantity: value.quantity,
      }));
    }
    for (const task of tasks) {
      const source = taskEquipment.get(task.taskId);
      if (!source) fail("TASK_EQUIPMENT_SOURCE_UNAVAILABLE");
      const linkedIds = new Set(source.effectiveEquipmentIds);
      if (!linkedIds.size) appendTask(task, group(["unlinked"], null, labels.equipmentUnlinked, "unlinked"));
      for (const id of linkedIds) {
        const parent = equipmentRows.get(id);
        if (!parent) fail("EQUIPMENT_REFERENCE_UNAVAILABLE");
        appendTask(task, parent, source);
      }
    }
  }
  for (const [id, ids] of branchTasks) {
    const row = rows.get(id)!;
    row.taskCount = ids.size;
    for (const taskId of ids) {
      const task = byTask.get(taskId)!;
      if (task.start !== null && (row.start === null || task.start < row.start)) row.start = task.start;
      if (task.end !== null && (row.end === null || task.end > row.end)) row.end = task.end;
    }
  }
  const ordered: ScheduleViewRow[] = [];
  const visit = (parent: string | null) => {
    for (const id of children.get(parent) ?? []) { ordered.push(rows.get(id)!); visit(id); }
  };
  visit(null);
  return { rows: ordered, uniqueTaskCount: tasks.length, taskRowCount: ordered.filter(row => row.kind === "task").length,
    diagnostics: { summaryAssignmentIds: [...summaryAssignmentIds].sort(compare), inactiveResourceIds: [...resources.values()].filter(row => !row.active).map(row => row.id),
      inactiveGroupIds: [...groups.values()].filter(row => !row.active).map(row => row.id), inactiveEquipmentIds: [...equipment.values()].filter(row => !row.active).map(row => row.id) } };
}
