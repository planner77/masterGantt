import { RESOURCE_ANALYSIS_DIMENSIONS, type ResourceAnalysisCell, type ResourceAnalysisConditions, type ResourceAnalysisDimension, type ResourceAnalysisQuery, type ResourceAnalysisResult, type ResourceAnalysisSelector, type ResourceAnalysisSource, type ResourceAnalysisSourceScope, type ResourceAnalysisExpectedResponse, type ResourceAnalysisPlanSelector } from "../../contracts/resource-analysis";
import { resolveWbsTaskLedger, selectWbsTaskLedger, selectWbsTaskLedgerPlanScope, summarizeWbsTaskLedger, type WbsTaskLedgerInput, type WbsTaskLedgerSelection, type WbsTaskLedgerSnapshot, type WbsTaskLedgerRow } from "./wbs-task-ledger";
import { mdPerMmSource } from "./md-per-mm";
import { calculateResourcePlan } from "./resource-plan";
import { getResourceKpiDiagnostics, type ResourceKpiFilters } from "./resource-kpi";
import { RESOURCE_PLAN_LIMITS, RESOURCE_DASHBOARD_LIMITS } from "../../contracts/resource-dashboard";

export const RESOURCE_ANALYSIS_LIMITS = Object.freeze({ cells: 5000, variants: 256, selectionRows: 500_000, ...RESOURCE_PLAN_LIMITS, RESOURCE_DASHBOARD_LIMITS });
export class ResourceAnalysisInputError extends Error {
  constructor(readonly code: "SOURCE_MISMATCH" | "INVALID_SELECTION" | "INVALID_QUERY" | "ANALYSIS_LIMIT_EXCEEDED") { super(code); this.name = "ResourceAnalysisInputError"; }
}
const fail = (code: ResourceAnalysisInputError["code"]): never => { throw new ResourceAnalysisInputError(code); };
const unique = <T extends string | null>(values: readonly T[]): T[] => [...new Set(values)].sort((a, b) => a === null ? 1 : b === null ? -1 : a < b ? -1 : a > b ? 1 : 0);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function validSource(source: ResourceAnalysisSource): boolean {
  const context = source?.sourceContext;
  return !!context && context.schema === "wbs-view-source/1" && context.contextSourceVersion === "explicit-task-context:v1" &&
    [context.projectPublicId, context.snapshotId, context.dataSnapshotId, context.calendarRevision].every(value => typeof value === "string" && value.length > 0) &&
    [context.projectRevision, context.catalogRevision].every(value => Number.isSafeInteger(value) && value >= 0) &&
    !!context.spec && context.spec.version === "wbs-view:v1" && context.spec.contextSourceVersion === "explicit-task-context:v1" && Array.isArray(context.path) &&
    !!source.filters && typeof source.filters === "object" && !Array.isArray(source.filters) &&
    Number.isSafeInteger(source.fetchGeneration) && source.fetchGeneration > 0;
}
/** Compare to the CURRENT request, including generation. Future and reversed replies fail equally. */
export function assertResourceAnalysisSource(actual: ResourceAnalysisSource, expected: ResourceAnalysisSource): void {
  if (!validSource(actual) || !validSource(expected) || canonical(actual) !== canonical(expected)) fail("SOURCE_MISMATCH");
}
/** On a read error the consumer clears the model; it must not retain an older successful chart. */
export function acceptResourceAnalysisResponse(expected: ResourceAnalysisExpectedResponse, response: { status: number; source?: ResourceAnalysisSource; data?: ResourceAnalysisResult }): ResourceAnalysisResult | null {
  if (response.status !== 200 || !response.source || !response.data || response.data.schema !== "resource-analysis/1") return null;
  try {
    assertResourceAnalysisSource(response.source, expected.source);
    assertResourceAnalysisSource(response.data.scope.source, expected.source);
    if (response.data.scope.scopeKey !== expected.scopeKey) return null;
    return response.data;
  } catch { return null; }
}
function normalize(conditions: ResourceAnalysisConditions = {}): ResourceAnalysisConditions {
  const result: ResourceAnalysisConditions = {};
  let totalIds = 0;
  for (const [dimension, values] of Object.entries(conditions)) {
    if (!RESOURCE_ANALYSIS_DIMENSIONS.includes(dimension as ResourceAnalysisDimension) || !Array.isArray(values)) fail("INVALID_QUERY");
    totalIds += values.length;
    if (values.length > RESOURCE_DASHBOARD_LIMITS.idsPerField || totalIds > RESOURCE_DASHBOARD_LIMITS.totalIds) fail("ANALYSIS_LIMIT_EXCEEDED");
    if (values.some(value => value !== null && (typeof value !== "string" || !value))) fail("INVALID_QUERY");
    if (values.length) result[dimension as ResourceAnalysisDimension] = unique(values);
  }
  return result;
}
function resourceMatches(snapshot: WbsTaskLedgerSnapshot, resourceId: string, conditions: ResourceAnalysisConditions): boolean {
  const resource = snapshot.prepared.byResource.get(resourceId)!;
  const values: Partial<Record<ResourceAnalysisDimension, readonly (string | null)[]>> = { resource: [resourceId], group: resource.groupIds.length ? resource.groupIds : [null], role: resource.roles.length ? resource.roles : [null, "UNSPECIFIED"], developerGrade: [resource.developerGrade] };
  return (["resource", "group", "role", "developerGrade"] as const).every(dimension => !conditions[dimension]?.length || conditions[dimension]!.some(id => values[dimension]!.includes(id)));
}
function validateConditions(snapshot: WbsTaskLedgerSnapshot, conditions: ResourceAnalysisConditions, spend: (rows: number) => void) {
  for (const [axis, values] of Object.entries(conditions)) for (const id of values ?? []) {
    spend(snapshot.rows.length + snapshot.prepared.assignments.length);
    if (axis === "developerGrade") {
      if (id !== null && !snapshot.prepared.resources.some(resource => resource.developerGrade === id)) fail("INVALID_SELECTION");
    } else {
      // The existing selector owns known-ID and physical-reference validation, even for empty intersections.
      selectWbsTaskLedger(snapshot, [{ dimension: axis as Exclude<ResourceAnalysisDimension, "developerGrade">, id }]);
    }
  }
}
function union(snapshot: WbsTaskLedgerSnapshot, conditions: ResourceAnalysisConditions, spend: (rows: number) => void): WbsTaskLedgerSelection {
  const entries = Object.entries(conditions).filter(([axis]) => axis !== "developerGrade") as Array<[Exclude<ResourceAnalysisDimension, "developerGrade">, readonly (string | null)[]]>;
  let variants: Array<Array<{ dimension: Exclude<ResourceAnalysisDimension, "developerGrade">; id: string | null }>> = [[]];
  for (const [dimension, values] of entries) {
    if (variants.length * values.length > RESOURCE_ANALYSIS_LIMITS.variants) fail("ANALYSIS_LIMIT_EXCEEDED");
    variants = variants.flatMap(variant => values.map(id => [...variant, { dimension, id }]));
  }
  const selections = variants.map(selectors => { spend(snapshot.rows.length + snapshot.prepared.assignments.length); return selectWbsTaskLedger(snapshot, selectors); });
  const base = selections[0];
  const grade = conditions.developerGrade;
  const assignments = snapshot.prepared.assignments.length ? [...new Map(selections.flatMap(selection => selection.assignments).map(row => [row.assignmentId, row])).values()]
    .filter(row => !grade?.length || grade.includes(snapshot.prepared.byResource.get(row.resourceId)!.developerGrade)).sort((a, b) => a.assignmentId.localeCompare(b.assignmentId)) : [];
  const taskIds = new Set(selections.flatMap(selection => selection.taskIds));
  if (grade?.length) { taskIds.clear(); for (const row of assignments) taskIds.add(row.taskId); }
  const byTask = new Map<string, WbsTaskLedgerRow>();
  for (const selected of selections) for (const row of selected.rows) {
    if (!taskIds.has(row.taskId)) continue;
    const previous = byTask.get(row.taskId);
    byTask.set(row.taskId, previous ? { ...row,
      processIds: unique([...previous.processIds, ...row.processIds]), processOccurrenceIds: unique([...previous.processOccurrenceIds, ...row.processOccurrenceIds]),
      workAreaIds: unique([...previous.workAreaIds, ...row.workAreaIds]), equipmentIds: unique([...previous.equipmentIds, ...row.equipmentIds]), systemIds: unique([...previous.systemIds, ...row.systemIds]) } : row);
  }
  const rows = [...byTask.values()].sort((a, b) => a.taskId.localeCompare(b.taskId));
  const t0Ids = new Set(selections.flatMap(selection => selection.selection.t0.map(row => row.taskId)));
  const t0 = snapshot.prepared.tasks.filter(row => t0Ids.has(row.taskId));
  return { ...base, selectors: [], rows, taskIds: rows.map(row => row.taskId), assignmentIds: assignments.map(row => row.assignmentId), assignments,
    selection: { ...base.selection, assignments, t0, t0Ids } };
}
function mergeConditions(base: ResourceAnalysisConditions, added: ResourceAnalysisConditions): ResourceAnalysisConditions | null {
  const result = { ...base };
  for (const [axis, values] of Object.entries(added)) {
    const key = axis as ResourceAnalysisDimension, current = base[key];
    const intersection = current?.length ? values!.filter(id => current.includes(id)) : [...values!];
    if (!intersection.length) return null;
    result[key] = intersection;
  }
  return result;
}
function candidates(snapshot: WbsTaskLedgerSnapshot, dimension: ResourceAnalysisDimension, current: WbsTaskLedgerSelection): Array<string | null> {
  const resources = snapshot.prepared.resources;
  if (["resource", "group", "role"].includes(dimension)) {
    // Match the WBS projector's null branch: direct Group references and registration
    // are not personal Assignments, even when every catalog Resource is classified.
    const rawAssigned = new Set(snapshot.prepared.assignments.filter(row => row.kind === "resource").map(row => row.taskId));
    const unassigned = current.rows.some(row => !rawAssigned.has(row.taskId));
    const values = dimension === "resource" ? resources.map(row => row.resourceId)
      : dimension === "group" ? resources.flatMap(row => row.groupIds.length ? row.groupIds : [null])
      : resources.flatMap(row => row.roles.length ? row.roles : [null]);
    return unique([...values, ...(unassigned ? [null] : [])]);
  }
  if (dimension === "developerGrade") return unique(resources.map(row => row.developerGrade));
  if (dimension === "milestone") return [...unique(snapshot.prepared.tasks.filter(row => row.type === "milestone").map(row => row.taskId)), null];
  if (dimension === "process") return [...unique(snapshot.prepared.logistics!.processes.map(row => row.id)), null];
  if (dimension === "workArea") return [...unique(snapshot.prepared.logistics!.workAreas.map(row => row.id)), null];
  return [...unique(snapshot.prepared.logistics!.instances.filter(row => row.kind === dimension).map(row => row.entityId)), null];
}
/** Server-transaction seam: use its canonical ledger plus its original WBS source context.
 * No HTTP, persistence, independent effort formula or inferred personal assignments. */
export function buildResourceAnalysis(input: { ledger: WbsTaskLedgerInput; source: ResourceAnalysisSource; expectedSource: ResourceAnalysisSource; sourceScope?: ResourceAnalysisSourceScope; query?: ResourceAnalysisQuery }): ResourceAnalysisResult {
  assertResourceAnalysisSource(input.source, input.expectedSource);
  const context = input.source.sourceContext, kpi = input.ledger.kpi, query = input.query ?? {};
  if (kpi.tasks.length > RESOURCE_DASHBOARD_LIMITS.tasks || kpi.assignments.length > RESOURCE_DASHBOARD_LIMITS.assignments || kpi.links.length > RESOURCE_DASHBOARD_LIMITS.links) fail("ANALYSIS_LIMIT_EXCEEDED");
  if (canonical(input.source.filters) !== canonical(kpi.filters ?? {}) || context.projectPublicId !== input.ledger.snapshotProjectPublicId || context.range.from !== kpi.from || context.range.to !== kpi.to || context.asOfDate !== kpi.asOfDate || context.contextSourceVersion !== input.ledger.contextSourceVersion) fail("SOURCE_MISMATCH");
  if (query.unit !== undefined && query.unit !== "M/D" && query.unit !== "M/M" || query.granularity !== undefined && query.granularity !== "week" && query.granularity !== "month") fail("INVALID_QUERY");
  const pivot = query.pivot ?? [];
  if (pivot.length > 2 || new Set(pivot).size !== pivot.length || pivot.some(axis => !RESOURCE_ANALYSIS_DIMENSIONS.includes(axis))) fail("INVALID_QUERY");
  const supportedFilters = ["eligibleResourceIds", "statuses", "search", "taskSearch", "includeUngrouped", "taskIds", "wbsRootIds", "milestoneIds", "resourceIds", "groupIds", "roles", "developerGrades", "equipmentIds", "systemIds", "physicalEquipmentTypeCodes", "physicalSystemTypeCodes", "directEquipmentIds", "directSystemIds"];
  if (Object.keys(kpi.filters ?? {}).some(key => !supportedFilters.includes(key))) fail("INVALID_QUERY");
  const snapshot = resolveWbsTaskLedger(input.ledger), conditions = normalize(query.conditions);
  if (snapshot.prepared.mdPerMm !== context.mdPerMm || context.mdPerMmSource !== mdPerMmSource(kpi.mdPerMm, kpi.mdPerMmEnvironment) || context.mdPerMmProvided !== (kpi.mdPerMm !== undefined)) fail("SOURCE_MISMATCH");
  let work = 0;
  const spend = (rows: number) => { work += Math.max(1, rows); if (work > RESOURCE_ANALYSIS_LIMITS.selectionRows) fail("ANALYSIS_LIMIT_EXCEEDED"); };
  validateConditions(snapshot, conditions, spend);
  const scope = input.sourceScope;
  const narrowedSource = context.path.length > 0 || context.scope !== undefined || context.spec.systemView !== undefined || context.spec.systemIds !== undefined;
  if (narrowedSource && !scope) fail("SOURCE_MISMATCH");
  if (scope) {
    assertResourceAnalysisSource(scope.source, input.source);
    if (!Array.isArray(scope.taskIds) || !Array.isArray(scope.assignmentIds) || !Array.isArray(scope.taskRows) || !Array.isArray(scope.diagnosticTaskIds) || scope.diagnosticTaskIds.length > kpi.tasks.length || scope.taskIds.length > kpi.tasks.length || scope.taskRows.length > kpi.tasks.length || scope.assignmentIds.length > kpi.assignments.length) fail("ANALYSIS_LIMIT_EXCEEDED");
    if (new Set(scope.diagnosticTaskIds).size !== scope.diagnosticTaskIds.length || scope.diagnosticTaskIds.some(id => snapshot.prepared.byTask.get(id)?.type !== "task") || new Set(scope.taskIds).size !== scope.taskIds.length || new Set(scope.assignmentIds).size !== scope.assignmentIds.length ||
      scope.taskIds.some(id => snapshot.prepared.byTask.get(id)?.type !== "task") ||
      !Array.isArray(scope.taskRows) || new Set(scope.taskRows.map(row => row.taskId)).size !== scope.taskIds.length ||
      scope.taskRows.some(row => !scope.taskIds.includes(row.taskId) || ["processIds", "workAreaIds", "equipmentIds", "systemIds"].some(field => {
        const key = field as "processIds" | "workAreaIds" | "equipmentIds" | "systemIds", original = snapshot.rows.find(task => task.taskId === row.taskId);
        return !Array.isArray(row[key]) || row[key].some(id => !original?.[key].includes(id));
      }) || row.milestoneTaskId !== snapshot.rows.find(task => task.taskId === row.taskId)?.milestoneTaskId) ||
      scope.assignmentIds.some(id => !snapshot.prepared.assignments.some(row => row.assignmentId === id && row.kind === "resource" && scope.taskIds.includes(row.taskId)))) fail("INVALID_SELECTION");
  }
  const restricted = (selected: WbsTaskLedgerSelection, activeConditions: ResourceAnalysisConditions): WbsTaskLedgerSelection => {
    if (!scope) return selected;
    const tasks = new Set(scope.taskIds), permitted = new Set(scope.assignmentIds);
    let rows = selected.rows.filter(row => tasks.has(row.taskId)).map(row => {
      const sourceRow = scope.taskRows.find(source => source.taskId === row.taskId)!;
      const narrowed = { ...row };
      for (const axis of ["process", "workArea", "equipment", "system"] as const) {
        const field = `${axis}Ids` as "processIds" | "workAreaIds" | "equipmentIds" | "systemIds";
        const path = context.path.filter(entry => entry.dimension === axis && !(axis === "system" && context.spec.systemView === "coordination"));
        narrowed[field] = row[field].filter(id => sourceRow[field].includes(id) && path.every(entry => entry.id === id));
      }
      return narrowed;
    }).filter(row => (["process", "workArea", "equipment", "system"] as const).every(axis => {
      const values = row[`${axis === "process" ? "process" : axis}Ids` as "processIds" | "workAreaIds" | "equipmentIds" | "systemIds"];
      return !activeConditions[axis]?.length || activeConditions[axis]!.some(id => id === null ? values.length === 0 : values.includes(id));
    }));
    const retainedTasks = new Set(rows.map(row => row.taskId));
    const assignments = selected.assignments.filter(row => permitted.has(row.assignmentId) && retainedTasks.has(row.taskId));
    const personalFilters = kpi.filters;
    const hasPersonalCondition = context.path.some(entry => ["resource", "group", "role"].includes(entry.dimension)) ||
      ["resource", "group", "role", "developerGrade"].some(axis => activeConditions[axis as ResourceAnalysisDimension]?.length) ||
      Boolean(personalFilters && (personalFilters.eligibleResourceIds !== undefined || personalFilters.resourceIds?.length || personalFilters.groupIds?.length || personalFilters.includeUngrouped || personalFilters.roles?.length || personalFilters.developerGrades?.length || personalFilters.search?.trim()));
    if (hasPersonalCondition) {
      const assignedTaskIds = new Set(assignments.map(row => row.taskId));
      const rawAssigned = new Set(snapshot.prepared.assignments.filter(row => row.kind === "resource").map(row => row.taskId));
      // Intersect personal Assignment grains before deriving A's Task denominator.
      // A raw no-personal Task already admitted by an explicit null branch survives.
      rows = rows.filter(row => assignedTaskIds.has(row.taskId) || !rawAssigned.has(row.taskId));
    }
    const diagnosticIds = new Set(scope.diagnosticTaskIds);
    const disjointPhysicalPath = context.path.some(entry => ["process", "workArea", "equipment", "system"].includes(entry.dimension) && !(entry.dimension === "system" && context.spec.systemView === "coordination") && activeConditions[entry.dimension]?.length && !activeConditions[entry.dimension]!.includes(entry.id));
    const t0 = disjointPhysicalPath ? [] : selected.selection.t0.filter(row => diagnosticIds.has(row.taskId));
    return { ...selected, rows, taskIds: rows.map(row => row.taskId), assignments, assignmentIds: assignments.map(row => row.assignmentId),
      selection: { ...selected.selection, assignments, t0, t0Ids: new Set(t0.map(row => row.taskId)) } };
  };
  const selection = restricted(union(snapshot, conditions, spend), conditions), totals = summarizeWbsTaskLedger(snapshot, selection);
  if (scope && context.scope?.kind === "exactAssignments") totals.diagnostics = getResourceKpiDiagnostics({ ...snapshot.prepared, assignments: snapshot.prepared.assignments.filter(row => scope.assignmentIds.includes(row.assignmentId)) }, selection.selection);
  if (context.path.some(entry => ["resource", "group", "role"].includes(entry.dimension)) || ["resource", "group", "role", "developerGrade"].some(axis => conditions[axis as ResourceAnalysisDimension]?.length)) totals.diagnostics.personalFiltersAppliedToA = true;
  const baseFilters: ResourceKpiFilters = clone(kpi.filters ?? {});
  const scopeBody = { source: clone(input.source), conditions, baseFilters, range: { from: kpi.from, to: kpi.to }, asOfDate: kpi.asOfDate, timezone: kpi.timezone, mdPerMm: snapshot.prepared.mdPerMm, unit: query.unit ?? "M/D", pivot: [...pivot], granularity: query.granularity ?? "week", sourceScope: scope ? { taskIds: unique(scope.taskIds), assignmentIds: unique(scope.assignmentIds), diagnosticTaskIds: unique(scope.diagnosticTaskIds), taskRows: scope.taskRows.map(row => ({ taskId: row.taskId, processIds: unique(row.processIds), workAreaIds: unique(row.workAreaIds), equipmentIds: unique(row.equipmentIds), systemIds: unique(row.systemIds), milestoneTaskId: row.milestoneTaskId })) } : null };
  // A canonical descriptor is inspectable and cannot alias IDs containing separators.
  const scopeKey = canonical(scopeBody);
  const cell = (values: ResourceAnalysisCell["values"], selected: WbsTaskLedgerSelection): ResourceAnalysisCell => {
    const summary = summarizeWbsTaskLedger(snapshot, selected);
    const exact = Object.fromEntries(values.map(value => [value.dimension, [value.id]]));
    return { key: canonical(values), values, selector: { scopeKey, conditions: exact }, taskIds: [...selected.taskIds], assignmentIds: [...selected.assignmentIds], tasks: summary.tasks, assignments: summary.assignments };
  };
  const cells: ResourceAnalysisCell[] = [];
  const walk = (values: ResourceAnalysisCell["values"], depth: number, current: WbsTaskLedgerSelection) => {
    spend(1);
    if (depth === pivot.length) {
      if (!depth) return;
      if (cells.length >= RESOURCE_ANALYSIS_LIMITS.cells) fail("ANALYSIS_LIMIT_EXCEEDED");
      cells.push(cell(values, current));
      return;
    }
    for (const id of candidates(snapshot, pivot[depth], current)) {
      const nextValues = [...values, { dimension: pivot[depth], id }];
      const combined = mergeConditions(conditions, Object.fromEntries(nextValues.map(value => [value.dimension, [value.id]])));
      if (combined) walk(nextValues, depth + 1, restricted(union(snapshot, combined, spend), combined));
    }
  };
  walk([], 0, selection);
  const capacity = selectWbsTaskLedgerPlanScope(snapshot);
  const sourcePersonalConditions: ResourceAnalysisConditions = {};
  for (const entry of context.path) if (["resource", "group", "role"].includes(entry.dimension)) {
    const axis = entry.dimension as ResourceAnalysisDimension;
    if (sourcePersonalConditions[axis] && !sourcePersonalConditions[axis]!.includes(entry.id)) fail("INVALID_SELECTION");
    sourcePersonalConditions[axis] = [entry.id];
  }
  const capacityResourceIds = capacity.capacityResourceIds.filter(id => resourceMatches(snapshot, id, conditions) && resourceMatches(snapshot, id, sourcePersonalConditions));
  const permitted = new Set(capacityResourceIds);
  let projectionGroupIds: Array<string | null> | undefined;
  const groupConditions: Array<readonly (string | null)[]> = [];
  if (kpi.filters?.groupIds?.length || kpi.filters?.includeUngrouped) groupConditions.push([...(kpi.filters.groupIds ?? []), ...(kpi.filters.includeUngrouped ? [null] : [])]);
  if (conditions.group?.length) groupConditions.push(conditions.group);
  if (sourcePersonalConditions.group?.length) groupConditions.push(sourcePersonalConditions.group);
  for (const groupIds of groupConditions) projectionGroupIds = projectionGroupIds === undefined ? [...groupIds] : projectionGroupIds.filter(id => groupIds.includes(id));
  const plan = calculateResourcePlan({ projectPublicId: kpi.projectPublicId, from: kpi.from, to: kpi.to, asOfDate: kpi.asOfDate,
    mdPerMm: snapshot.prepared.mdPerMm, granularity: query.granularity ?? "week", projectCalendar: kpi.projectCalendar, calendarExceptions: kpi.calendarExceptions,
    resources: snapshot.prepared.resources, capacityResourceIds, projectionGroupIds, selectedAssignments: selection.assignments,
    fullProjectAssignments: capacity.fullProjectAssignments.filter(row => permitted.has(row.resourceId)),
    limits: RESOURCE_PLAN_LIMITS });
  const model: ResourceAnalysisResult = { schema: "resource-analysis/1", scope: { ...scopeBody, scopeKey }, total: cell([], selection), cells, taskSources: selection.rows.map(row => {
      const task = snapshot.prepared.byTask.get(row.taskId)!;
      const physical = (axis: "process" | "workArea" | "equipment" | "system", ids: string[]) => conditions[axis]?.length ? ids.filter(id => conditions[axis]!.includes(id)) : [...ids];
      return { taskId: row.taskId, processIds: physical("process", row.processIds), workAreaIds: physical("workArea", row.workAreaIds), equipmentIds: physical("equipment", row.equipmentIds), systemIds: physical("system", row.systemIds), milestoneTaskId: row.milestoneTaskId,
        name: task.name ?? "", status: task.status, start: task.start, end: task.end, duration: task.duration, progress: task.progress, assignmentIds: selection.assignments.filter(assignment => assignment.taskId === row.taskId).map(assignment => assignment.assignmentId) };
    }), assignmentRows: clone(selection.assignments), projectAssignmentRows: clone(capacity.fullProjectAssignments.filter(row => permitted.has(row.resourceId))),
    diagnostics: totals.diagnostics, participation: totals.participation, fullMilestones: totals.fullMilestones, plan,
    metadata: { subtotalsAdditive: false, composition: "overlapping-related-work", taskGrain: "distinct-taskId", assignmentGrain: "projectPublicId,assignmentId", capacityGrain: "resource-working-day", projectReference: "same-resources-full-project-same-period", diagnosticsScope: "T0-before-personal-filters", primaryKpis: ["assignedResources", "plannedEffort", "completedAndDelayedTasks", "capacityAndLoad", "peakAndExcess", "unsetEffort"] } };
  if (new TextEncoder().encode(JSON.stringify(model)).byteLength > RESOURCE_DASHBOARD_LIMITS.reportBytes) fail("ANALYSIS_LIMIT_EXCEEDED");
  return model;
}
/** The selector is a member of this exact model, never a fresh query against changed data. */
export function selectResourceAnalysisDetails(model: ResourceAnalysisResult, selector: ResourceAnalysisSelector, expectedSource: ResourceAnalysisSource) {
  assertResourceAnalysisSource(model.scope.source, expectedSource);
  if (selector.scopeKey !== model.scope.scopeKey) fail("SOURCE_MISMATCH");
  const target = [model.total, ...model.cells].find(cell => canonical(cell.selector) === canonical(selector));
  if (!target) return fail("INVALID_SELECTION");
  const tasks = new Set(target.taskIds), assignments = new Set(target.assignmentIds);
  const conditions = mergeConditions(model.scope.conditions, selector.conditions) ?? {};
  const taskRows = model.taskSources.filter(row => tasks.has(row.taskId)).map(row => {
    const narrowed = { ...row, assignmentIds: row.assignmentIds.filter(id => assignments.has(id)) };
    for (const axis of ["process", "workArea", "equipment", "system"] as const) {
      const selected = conditions[axis];
      const field = `${axis}Ids` as "processIds" | "workAreaIds" | "equipmentIds" | "systemIds";
      narrowed[field] = selected?.length ? row[field].filter(id => selected.includes(id)) : [...row[field]];
    }
    return narrowed;
  });
  return { taskIds: [...target.taskIds], assignmentIds: [...target.assignmentIds], tasks: taskRows, assignments: model.assignmentRows.filter(row => assignments.has(row.assignmentId)) };
}
export function rankResourceAnalysisCells(model: ResourceAnalysisResult, metric: "knownMd" | "taskCount" | "delayedTaskCount", topN: number) {
  if (!Number.isSafeInteger(topN) || topN < 1 || topN > 100) fail("INVALID_QUERY");
  const value = (cell: ResourceAnalysisCell) => metric === "knownMd" ? cell.assignments.effort.knownMd : metric === "taskCount" ? cell.tasks.taskCount : cell.tasks.delayed.count;
  if (!["knownMd", "taskCount", "delayedTaskCount"].includes(metric)) fail("INVALID_QUERY");
  const ranked = [...model.cells].sort((a, b) => value(b) - value(a) || a.key.localeCompare(b.key));
  return { source: model.scope.source, scopeKey: model.scope.scopeKey, metric, cells: ranked.slice(0, topN), totalCellCount: ranked.length, omittedCellCount: Math.max(0, ranked.length - topN), total: model.total, subtotalsAdditive: false as const };
}
export function rankResourceAnalysisOverload(model: ResourceAnalysisResult, topN: number, demandScope: "selected" | "project" = "project") {
  if (!Number.isSafeInteger(topN) || topN < 1 || topN > 100 || !["selected", "project"].includes(demandScope)) fail("INVALID_QUERY");
  const rows = [...model.plan.resources].sort((a, b) => b.summary[demandScope].excessMd - a.summary[demandScope].excessMd || a.resourceId.localeCompare(b.resourceId));
  return { source: model.scope.source, scopeKey: model.scope.scopeKey, metric: "excessMd" as const, demandScope, periodKey: "all" as const,
    rows: rows.slice(0, topN).map(row => ({ ...row, selector: { scopeKey: model.scope.scopeKey, row: { kind: "resource" as const, resourceId: row.resourceId }, demandScope, periodKey: "all", granularity: model.plan.granularity } satisfies ResourceAnalysisPlanSelector })), totalResourceCount: rows.length, omittedResourceCount: Math.max(0, rows.length - topN), projectReference: model.metadata.projectReference };
}

/** Exact raw demand identities for the ranked scope, including full-project assignments
 * outside the selected Task/Milestone scope. Daily drill uses existing ResourcePlan APIs. */
export function selectResourceAnalysisPlanDetails(model: ResourceAnalysisResult, selector: ResourceAnalysisPlanSelector, expectedSource: ResourceAnalysisSource) {
  assertResourceAnalysisSource(model.scope.source, expectedSource);
  if (selector.scopeKey !== model.scope.scopeKey) fail("SOURCE_MISMATCH");
  const period = selector.periodKey === "all" ? model.scope.range : model.plan.periods.find(row => row.key === selector.periodKey);
  if (!period || selector.granularity !== model.plan.granularity || selector.row.kind !== "resource" || !model.plan.population.resourceIds.includes(selector.row.resourceId) || !["selected", "project"].includes(selector.demandScope)) return fail("INVALID_SELECTION");
  const rows = (selector.demandScope === "project" ? model.projectAssignmentRows : model.assignmentRows)
    .filter(row => row.resourceId === selector.row.resourceId && row.from <= period.to && row.to >= period.from);
  return { demandScope: selector.demandScope, resourceId: selector.row.resourceId, periodKey: selector.periodKey,
    assignmentIds: rows.map(row => row.assignmentId), taskIds: unique(rows.map(row => row.taskId)), assignments: rows };
}
