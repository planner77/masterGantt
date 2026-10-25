import { prepareResourceKpiSnapshot, selectResourceKpiAssignments, renderResourceKpi, summarizeResourceKpiAssignments,
  getResourceKpiDiagnostics, matchesResourceKpiResourceFilters, type ResourceKpiInput, type PreparedResourceKpiSnapshot, type ResourceKpiSelection, type ResourceKpiAssignmentRow, type ResourceKpiTotals } from "./resource-kpi";
import { selectResourceKpiTargetPaths, summarizeResourceKpiTargetMembers, hasResourceKpiTargetPathFilters, ResourceKpiTargetInputError,
  type ResourceKpiTargetPath, type ResourceKpiTargetMemberSummary } from "./resource-kpi-targets";

export type ResourceKpiTargetDimension = "target" | "process" | "processType" | "workArea" | "scope" | "equipmentType" | "systemType" | "equipment" | "system" | "group" | "resource";
export interface ResourceKpiTargetProjectionNode {
  dimension: ResourceKpiTargetDimension;
  id: string | null;
  totals: ResourceKpiTotals;
  sourceKinds: Array<"target_binding" | "legacy_direct" | "target_unlinked">;
  targetUnlinkedTaskIds: string[];
  relatedMembers: ResourceKpiTargetMemberSummary;
  children: ResourceKpiTargetProjectionNode[];
}
interface RecordPath {
  assignment: ResourceKpiAssignmentRow;
  path: ResourceKpiTargetPath | null;
  legacyMembers: Array<{ kind: "equipment" | "system"; entityId: string }>;
}

/** Reorder dimensions over the SAME raw Assignment+binding paths. Each node recalculates
 * a distinct Assignment union; overlapping Target/Group children are never added. */
export function projectResourceKpiTargets(prepared: PreparedResourceKpiSnapshot, selection: ResourceKpiSelection, order: readonly ResourceKpiTargetDimension[]) {
  const logistics = prepared.logistics;
  if (!logistics) throw new ResourceKpiTargetInputError("TARGET_SNAPSHOT_REQUIRED");
  const dimensions: ResourceKpiTargetDimension[] = ["target", "process", "processType", "workArea", "scope", "equipmentType", "systemType", "equipment", "system", "group", "resource"];
  if (new Set(order).size !== order.length || order.some(key => !dimensions.includes(key))) throw new ResourceKpiTargetInputError("INVALID_TARGET_PROJECTION_ORDER");
  const pathsByTask = new Map(selection.t0.map(task => [task.taskId, selectResourceKpiTargetPaths(logistics, logistics.resolved.get(task.taskId)!, selection.filters)]));
  const rows: RecordPath[] = [];
  let pathCount = 0;
  for (const assignment of selection.assignments) {
    const paths = pathsByTask.get(assignment.taskId)!;
    pathCount += Math.max(1, paths.length);
    logistics.assertBudget("projectionCells", pathCount);
    for (const path of paths.length ? paths : [null]) rows.push({ assignment, path, legacyMembers: paths.length ? [] : logistics.resolved.get(assignment.taskId)!.legacySources });
    // Independent legacy paths are instance context, never reverse joins into a Target.
    if (paths.length && !hasResourceKpiTargetPathFilters(selection.filters)) {
      const legacyMembers = logistics.resolved.get(assignment.taskId)!.legacySources;
      if (legacyMembers.length) { pathCount += 1; logistics.assertBudget("projectionCells", pathCount); rows.push({ assignment, path: null, legacyMembers }); }
    }
  }
  const values = (row: RecordPath, dimension: ResourceKpiTargetDimension): Array<string | null> => {
    if (dimension === "resource") return [row.assignment.resourceId];
    if (dimension === "group") return row.assignment.groupIds.length ? row.assignment.groupIds : [null];
    const target = row.path ? logistics.byTarget.get(row.path.targetId)! : null;
    if (dimension === "target") return [target?.id ?? null];
    if (dimension === "process") return [target?.occurrenceId ?? null];
    if (dimension === "processType") return [target?.projectProcessId ? logistics.byProcess.get(target.projectProcessId)?.processTypeId ?? null : null];
    if (dimension === "workArea") return [target?.workAreaId ?? null];
    if (dimension === "scope") return [target?.scope ?? null];
    const kind = dimension === "equipment" || dimension === "equipmentType" ? "equipment" : "system";
    // Legacy instances remain visible in the instance axes without fabricating a Target path.
    const members = row.path ? row.path.members.filter(member => member.kind === kind) : row.legacyMembers.filter(member => member.kind === kind);
    const ids = [...new Set(members.map(member => dimension.endsWith("Type")
      ? logistics.byInstance.get(JSON.stringify([member.kind, member.entityId]))!.typeCode : member.entityId))].sort();
    return ids.length ? ids : [null];
  };
  const totals = (records: readonly RecordPath[]) => summarizeResourceKpiAssignments(prepared, records.map(row => row.assignment));
  const members = (records: readonly RecordPath[]) => summarizeResourceKpiTargetMembers(logistics,
    records.flatMap(row => row.path ? [{ taskId: row.assignment.taskId, path: row.path }] : []),
    [], records.flatMap(row => row.legacyMembers));
  // Count every materialized node AND record fan-out before grouping allocations.
  let cells = pathCount + 1;
  logistics.assertBudget("projectionCells", cells);
  const build = (records: RecordPath[], depth: number): ResourceKpiTargetProjectionNode[] => {
    if (depth === order.length) return [];
    const dimension = order[depth], buckets = new Map<string | null, RecordPath[]>();
    for (const row of records) for (const id of values(row, dimension)) {
      cells += 1; logistics.assertBudget("projectionCells", cells);
      if (!buckets.has(id)) { cells += 1; logistics.assertBudget("projectionCells", cells); buckets.set(id, []); }
      const memberDimension = ["equipmentType", "systemType", "equipment", "system"].includes(dimension);
      let narrowed = row;
      if (memberDimension && id !== null) {
        const kind = dimension === "equipment" || dimension === "equipmentType" ? "equipment" : "system";
        const matchMember = (member: { kind: "equipment" | "system"; entityId: string }) => member.kind !== kind ||
          (dimension.endsWith("Type") ? logistics.byInstance.get(JSON.stringify([member.kind, member.entityId]))!.typeCode : member.entityId) === id;
        narrowed = { ...row, path: row.path ? { ...row.path, members: row.path.members.filter(matchMember) } : null, legacyMembers: row.legacyMembers.filter(matchMember) };
      }
      buckets.get(id)!.push(narrowed);
    }
    return [...buckets].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : a < b ? -1 : a > b ? 1 : 0).map(([id, bucket]) => ({
      dimension, id, totals: totals(bucket),
      sourceKinds: [...new Set(bucket.map(row => row.path ? "target_binding" as const : row.legacyMembers.length ? "legacy_direct" as const : "target_unlinked" as const))].sort(),
      targetUnlinkedTaskIds: [...new Set(bucket.filter(row => !logistics.resolved.get(row.assignment.taskId)!.effectiveTargetIds.length).map(row => row.assignment.taskId))].sort(),
      relatedMembers: members(bucket), children: build(bucket, depth + 1),
    }));
  };
  const children = build(rows, 0);
  return { order: [...order], totals: summarizeResourceKpiAssignments(prepared, selection.assignments), relatedMembers: members(rows), children,
    metadata: { taskScope: "A: distinct ordinary taskId" as const, assignmentGrain: "projectPublicId,assignmentId" as const,
      subtotalsAdditive: false as const, targetNullMeaning: "no Target provenance: explicit legacy path or unlinked Task; not a Target inferred from an instance" as const, precision: "raw; round at presentation boundary" as const } };
}

/** Opt-in typed Domain report. No HTTP/Excel/UI surface is implied by this contract. */
export function calculateResourceTargetKpi(input: ResourceKpiInput, order: readonly ResourceKpiTargetDimension[] = ["target", "group", "resource"]) {
  const prepared = prepareResourceKpiSnapshot(input), logistics = prepared.logistics;
  if (!logistics) throw new ResourceKpiTargetInputError("TARGET_SNAPSHOT_REQUIRED");
  const selection = selectResourceKpiAssignments(prepared);
  const projectSelection = selectResourceKpiAssignments(prepared, {});
  const t0Ids = selection.t0.map(task => task.taskId);
  const paths = selection.t0.flatMap(task => selectResourceKpiTargetPaths(logistics, logistics.resolved.get(task.taskId)!, selection.filters).map(path => ({ taskId: task.taskId, path })));
  const allOrdinary = prepared.tasks.filter(task => task.type === "task");
  const usageByTarget = new Map(logistics.targets.map(target => [target.id, {
    targetId: target.id, taskIds: [] as string[], summaryTaskIds: [] as string[], milestoneTaskIds: [] as string[],
  }]));
  for (const task of prepared.tasks) for (const targetId of logistics.resolved.get(task.taskId)!.effectiveTargetIds) {
    const usage = usageByTarget.get(targetId)!;
    const ids = task.type === "task" ? usage.taskIds : task.type === "summary" ? usage.summaryTaskIds : usage.milestoneTaskIds;
    ids.push(task.taskId);
  }
  const usage = [...usageByTarget.values()];
  const unlinked = allOrdinary.filter(task => !logistics.resolved.get(task.taskId)!.effectiveTargetIds.length).map(task => task.taskId);
  const inSelection = (ids: readonly string[]) => ids.filter(id => selection.t0Ids.has(id));
  return {
    projectReference: { total: summarizeResourceKpiAssignments(prepared, projectSelection.assignments), diagnostics: getResourceKpiDiagnostics(prepared, projectSelection),
      metadata: { scope: "full canonical Project, same period/asOf/calendar/M-D policy; all task/personal/Target filters removed" as const,
        capacityScopeDifferent: "ResourcePlan project reference is same R, not the full Project population" as const } },
    kpi: renderResourceKpi(prepared, selection), projection: projectResourceKpiTargets(prepared, selection, order),
    relatedMembers: summarizeResourceKpiTargetMembers(logistics, paths, hasResourceKpiTargetPathFilters(selection.filters) ? t0Ids.filter(id => !logistics.resolved.get(id)!.effectiveTargetIds.length) : t0Ids),
    /** Legacy provenance is preserved separately from Target member provenance. */
    taskSources: t0Ids.map(taskId => logistics.resolved.get(taskId)!),
    diagnostics: {
      ...getResourceKpiDiagnostics(prepared, selection), targetUnlinkedTaskIds: inSelection(unlinked),
      legacyOnlyTaskIds: inSelection(unlinked.filter(id => logistics.resolved.get(id)!.legacySources.length > 0)),
      unusedTargetIds: usage.filter(row => !row.taskIds.length && !row.summaryTaskIds.length && !row.milestoneTaskIds.length).map(row => row.targetId),
      projectCommonTargetIds: logistics.targets.filter(target => target.scope === "project_common").map(target => target.id),
      noWorkAreaTargetIds: logistics.targets.filter(target => target.scope === "process" && target.workAreaId === null).map(target => target.id),
      unmappedProjectProcessIds: logistics.processes.filter(process => process.occurrenceId === null).map(process => process.id),
    },
    targetUsage: usage,
    metadata: { relatedMemberScope: "T0 effective selected Target paths + explicit legacy instances" as const,
      targetUsageScope: "full canonical Project, ordinary/Summary/Milestone separated" as const,
      measure: "related planned effort; overlapping subtotals; no allocation or actual cost" as const,
      capacityPopulation: "R: full Project personal assignment history + personal classification; Target/task filters inapplicable" as const },
  };
}
export type ResourceKpiTargetResult = ReturnType<typeof calculateResourceTargetKpi>;

export const RESOURCE_TARGET_KPI_DICTIONARY = [
  { name: "관련 계획 M/D·M/M", grain: "projectPublicId,assignmentId", scope: "A", numerator: "distinct raw personal Assignment effort", denominator: "M/M only: explicit effective positive mdPerMm", missing: "empty=0; all-unset=null; partial=known sum + unset IDs; configured nonworking=0", additive: false, drillDown: "projection.totals.effort.assignmentIds / taskSources" },
  { name: "대상 Task/Resource·완료/진행/지연/진척", grain: "distinct taskId/resourceId", scope: "A", numerator: "existing canonical KPI definitions", denominator: "completion=unique Task count; progress=canonical duration sum", missing: "empty ratio=null", additive: false, drillDown: "projection.totals / taskSources" },
  { name: "관련 Equipment 수량/System 식수", grain: "distinct kind,instanceId", scope: "T0 for report; A paths for projection", numerator: "Equipment original quantity; System=1", denominator: null, missing: "no selected instance=0; coverage kept per provenance, never summed", additive: false, drillDown: "relatedMembers.members / taskSources.legacySources" },
  { name: "미배정/공수 미설정", grain: "distinct taskId / projectPublicId,assignmentId", scope: "T0", numerator: "raw Assignment diagnostics before personal filters", denominator: "ordinary Tasks in T0", missing: "empty=0; Group/PI/ownership never synthesizes personal Assignment", additive: false, drillDown: "diagnostics" },
] as const;

/** R4 handoff: keep R and same-R full Project demand independent of all Target/task axes.
 * The service enriches public Plan/Excel evidence; this adapter does not duplicate that logic. */
export function selectResourceTargetPlanScope(prepared: PreparedResourceKpiSnapshot, selection: ResourceKpiSelection = selectResourceKpiAssignments(prepared)) {
  const history = new Set(prepared.assignments.filter(row => row.kind === "resource" && prepared.byTask.get(row.taskId)!.type === "task").map(row => row.targetId));
  const capacityResourceIds = prepared.resources.filter(resource => history.has(resource.resourceId) && matchesResourceKpiResourceFilters(resource, selection.filters)).map(resource => resource.resourceId);
  const fullProjectAssignments = selectResourceKpiAssignments(prepared, { eligibleResourceIds: capacityResourceIds }).assignments;
  return { capacityResourceIds, selectedAssignments: selection.assignments, fullProjectAssignments };
}
