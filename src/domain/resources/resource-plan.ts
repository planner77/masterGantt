import type { ResourceKpiAssignmentRow, ResourceKpiResource } from "./resource-kpi";
import { isWorkingDay, type WorkingCalendar } from "../scheduling/calendar";
import { dateToOrdinal, ordinalToDate, parseDateOnly } from "../scheduling/date-only";
import { resolveResourceCalendar, type ResourceCalendarException } from "../scheduling/resource-calendar";
import { buildResourcePlanPeriods, type ResourcePlanGranularity, type ResourcePlanPeriod } from "./resource-plan-periods";
export { buildResourcePlanPeriods } from "./resource-plan-periods";
export type { ResourcePlanGranularity, ResourcePlanPeriod } from "./resource-plan-periods";

export interface ResourcePlanInput {
  projectPublicId: string; from: string; to: string; asOfDate: string;
  granularity: ResourcePlanGranularity; mdPerMm: number | null;
  projectCalendar: WorkingCalendar; calendarExceptions?: readonly ResourceCalendarException[];
  /** Authoritative backend population; contribution filters must not shrink it. */
  capacityResourceIds: readonly string[];
  /** Display projection only; never remove Group calendar layers. Empty means none. */
  projectionGroupIds?: readonly (string | null)[];
  resources: readonly ResourceKpiResource[];
  selectedAssignments: readonly ResourceKpiAssignmentRow[];
  fullProjectAssignments: readonly ResourceKpiAssignmentRow[];
  limits: { resourceDays: number; assignmentDays: number; matrixCells: number };
}
export type ResourcePlanDemandScope = "selected" | "project";
export type ResourcePlanRowSelector = { kind: "total" } | { kind: "group"; groupId: string | null } | { kind: "resource"; resourceId: string } | { kind: "resourceMilestone"; resourceId: string; milestoneTaskId: string | null };
export interface ResourcePlanMetrics {
  capacityMd: number; knownMd: number; plannedMd: number | null; plannedMm: number | null;
  state: "empty" | "configured" | "partial" | "unset"; partial: boolean;
  assignmentCount: number; unknownAssignmentCount: number; unknownResourceDayCount: number;
  loadPercent: number | null; knownLoadPercent: number | null;
  peakDailyLoadPercent: number | null; peakResourceDailyLoadPercent: number | null;
  knownPeakDailyLoadPercent: number | null; knownPeakResourceDailyLoadPercent: number | null;
  overAllocatedDayCount: number; overAllocatedResourceDayCount: number; overAllocatedResourceCount: number;
  excessMd: number;
}
export interface ResourcePlanPair { selected: ResourcePlanMetrics; project: ResourcePlanMetrics }
export interface ResourcePlanCell extends ResourcePlanPair { periodKey: string }
export interface ResourcePlanSeries { summary: ResourcePlanPair; cells: ResourcePlanCell[] }
export interface ResourcePlanMilestoneSeries extends ResourcePlanSeries { milestoneTaskId: string | null; capacityReferenceOnly: true; projectReferenceOnly: true; projectReferenceRow: { kind: "resource"; resourceId: string } }
export interface ResourcePlanResourceSeries extends ResourcePlanSeries { resourceId: string; milestones: ResourcePlanMilestoneSeries[] }
export interface ResourcePlanGroupSeries extends ResourcePlanSeries { groupId: string | null; resourceIds: string[] }
export interface ResourcePlanResult {
  granularity: ResourcePlanGranularity; from: string; to: string; asOfDate: string; mdPerMm: number | null;
  periods: ResourcePlanPeriod[]; population: { resourceIds: string[]; resourceCount: number; capacityBasis: "effective-working-day-1MD" };
  totals: ResourcePlanSeries; resources: ResourcePlanResourceSeries[]; groups: ResourcePlanGroupSeries[];
  metadata: { groupSubtotalsAdditive: false; milestoneCapacityAdditive: false; projectScope: "current-project-same-resources"; overloadTolerance: number };
}
export interface ResourcePlanPage { offset: number; limit: number }
export interface ResourcePlanPaged<T> { offset: number; limit: number; totalCount: number; nextOffset: number | null; rows: T[] }
export interface ResourcePlanDailyRow { date: string; metrics: ResourcePlanMetrics }
export interface ResourcePlanDayResourceRow { resourceId: string; date: string; metrics: ResourcePlanMetrics }
export interface ResourcePlanDayAssignmentRow { assignmentId: string; taskId: string; resourceId: string; milestoneTaskId: string | null; date: string; allocationPercent: number | null; working: boolean; knownMd: number; plannedMd: number | null }
export class ResourcePlanLimitError extends Error {
  readonly code = "RESOURCE_PLAN_LIMIT_EXCEEDED";
  constructor(readonly dimension: "resourceDays" | "assignmentDays" | "matrixCells", readonly actual: number, readonly limit: number) { super(`Resource Plan ${dimension} limit exceeded`); this.name = "ResourcePlanLimitError"; }
}
const TOLERANCE = 1e-12;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const excess = (demand: number, capacity: number) => demand > capacity + TOLERANCE * Math.max(1, demand, capacity) ? demand - capacity : 0;
type Buffer = { known: Float64Array; unknown: Uint32Array; rows: ResourceKpiAssignmentRow[] };
type Prepared = ReturnType<typeof prepare>;
function sameAssignment(a: ResourceKpiAssignmentRow, b: ResourceKpiAssignmentRow): boolean {
  return (Object.keys(a) as (keyof ResourceKpiAssignmentRow)[]).every((key) => {
    const left = a[key], right = b[key];
    return Array.isArray(left) && Array.isArray(right) ? [...left].sort(compare).join("\0") === [...right].sort(compare).join("\0") : left === right;
  });
}
function prepare(input: ResourcePlanInput) {
  const periods = buildResourcePlanPeriods(input.from, input.to, input.granularity);
  parseDateOnly(input.asOfDate);
  if (input.mdPerMm !== null && (!Number.isFinite(input.mdPerMm) || input.mdPerMm <= 0)) throw new Error("Invalid Resource Plan M/M basis");
  for (const value of Object.values(input.limits)) if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid Resource Plan budget");
  const first = dateToOrdinal(input.from), last = dateToOrdinal(input.to), days = last - first + 1;
  const ids = [...new Set(input.capacityResourceIds)].sort(compare);
  if (ids.length !== input.capacityResourceIds.length) throw new Error("Duplicate Resource Plan population ID");
  const resourceDays = ids.length * days;
  if (resourceDays > input.limits.resourceDays) throw new ResourcePlanLimitError("resourceDays", resourceDays, input.limits.resourceDays);
  const byResource = new Map<string, ResourceKpiResource>();
  for (const resource of input.resources) {
    if (!resource.resourceId || byResource.has(resource.resourceId)) throw new Error("Duplicate or invalid Resource Plan Resource metadata");
    byResource.set(resource.resourceId, resource);
  }
  const population = ids.map((id) => { const r = byResource.get(id); if (!r) throw new Error("Missing Resource Plan Resource"); return r; });
  const fullById = new Map<string, ResourceKpiAssignmentRow>();
  let assignmentDays = 0;
  const populationIds = new Set(ids);
  const validate = (row: ResourceKpiAssignmentRow) => {
    if (row.projectPublicId !== input.projectPublicId || !populationIds.has(row.resourceId)) throw new Error("Invalid Resource Plan Assignment scope");
    const start = dateToOrdinal(row.from), end = dateToOrdinal(row.to);
    if (start > end || start < first || end > last) throw new Error("Invalid prepared Resource Plan Assignment range");
    if (row.allocationPercent !== null && (!Number.isFinite(row.allocationPercent) || row.allocationPercent <= 0 || row.allocationPercent > 100)) throw new Error("Invalid Resource Plan allocation");
    return end - start + 1;
  };
  for (const row of input.fullProjectAssignments) {
    assignmentDays += validate(row);
    if (fullById.has(row.assignmentId)) throw new Error("Duplicate Resource Plan Assignment ID");
    fullById.set(row.assignmentId, row);
  }
  if (assignmentDays > input.limits.assignmentDays) throw new ResourcePlanLimitError("assignmentDays", assignmentDays, input.limits.assignmentDays);
  const selectedIds = new Set<string>();
  for (const row of input.selectedAssignments) {
    validate(row);
    const full = fullById.get(row.assignmentId);
    if (!full || !sameAssignment(full, row) || selectedIds.has(row.assignmentId)) throw new Error("Resource Plan selected rows must be a matching subset of Project rows");
    selectedIds.add(row.assignmentId);
  }
  const groups = new Map<string | null, string[]>();
  const milestones = new Map<string, Map<string | null, ResourceKpiAssignmentRow[]>>();
  for (const resource of population) for (const groupId of new Set(resource.groupIds.length ? resource.groupIds : [null])) {
    const members = groups.get(groupId) ?? []; members.push(resource.resourceId); groups.set(groupId, members);
  }
  if (input.projectionGroupIds !== undefined) {
    const projected = new Set(input.projectionGroupIds);
    if (projected.size !== input.projectionGroupIds.length) throw new Error("Duplicate Resource Plan Group projection ID");
    const knownGroups = new Set(input.resources.flatMap((resource) => [...resource.groupIds]));
    for (const id of projected) if (id !== null && !knownGroups.has(id)) throw new Error("Unknown Resource Plan Group projection ID");
    for (const id of groups.keys()) if (!projected.has(id)) groups.delete(id);
  }
  for (const row of input.selectedAssignments) {
    const stages = milestones.get(row.resourceId) ?? new Map<string | null, ResourceKpiAssignmentRow[]>();
    const rows = stages.get(row.milestoneTaskId) ?? []; rows.push(row); stages.set(row.milestoneTaskId, rows); milestones.set(row.resourceId, stages);
  }
  const matrixCells = (1 + ids.length + groups.size + [...milestones.values()].reduce((n, map) => n + map.size, 0)) * periods.length;
  if (matrixCells > input.limits.matrixCells) throw new ResourcePlanLimitError("matrixCells", matrixCells, input.limits.matrixCells);
  const dates = Array.from({ length: days }, (_, index) => ordinalToDate(first + index));
  const capacity = new Map<string, Uint8Array>();
  for (const resource of population) {
    const calendar = resolveResourceCalendar({ projectCalendar: input.projectCalendar, resourceId: resource.resourceId, groupIds: resource.groupIds, exceptions: input.calendarExceptions ?? [] }).calendar;
    capacity.set(resource.resourceId, Uint8Array.from(dates.map((date) => isWorkingDay(date, calendar) ? 1 : 0)));
  }
  const makeBuffer = (): Buffer => ({ known: new Float64Array(days), unknown: new Uint32Array(days), rows: [] });
  const full = new Map(ids.map((id) => [id, makeBuffer()])), selected = new Map(ids.map((id) => [id, makeBuffer()]));
  const stageBuffers = new Map<string, Map<string | null, Buffer>>();
  const add = (buffer: Buffer, row: ResourceKpiAssignmentRow) => {
    buffer.rows.push(row);
    const end = dateToOrdinal(row.to) - first;
    for (let day = dateToOrdinal(row.from) - first; day <= end; day += 1) {
      if (!capacity.get(row.resourceId)![day]) continue;
      if (row.allocationPercent === null) buffer.unknown[day] += 1;
      else buffer.known[day] += row.allocationPercent / 100;
    }
  };
  for (const row of input.fullProjectAssignments) {
    add(full.get(row.resourceId)!, row);
    if (!selectedIds.has(row.assignmentId)) continue;
    add(selected.get(row.resourceId)!, row);
    const stages = stageBuffers.get(row.resourceId) ?? new Map<string | null, Buffer>();
    const buffer = stages.get(row.milestoneTaskId) ?? makeBuffer(); add(buffer, row);
    stages.set(row.milestoneTaskId, buffer); stageBuffers.set(row.resourceId, stages);
  }
  return { input, periods, first, last, days, dates, ids, population, groups, capacity, full, selected, stageBuffers };
}
function metrics(p: Prepared, ids: readonly string[], buffers: Map<string, Buffer>, start: number, end: number): ResourcePlanMetrics {
  let capacityMd = 0, knownMd = 0, unknownResourceDayCount = 0, excessMd = 0, overAllocatedResourceDayCount = 0;
  let knownPeakDailyLoadPercent: number | null = null, knownPeakResourceDailyLoadPercent: number | null = null;
  const assignments = new Set<string>(), unknownAssignments = new Set<string>(), overResources = new Set<string>(), overDays = new Set<number>();
  const dailyCapacity = new Float64Array(end - start + 1), dailyKnown = new Float64Array(end - start + 1);
  for (const id of ids) {
    const buffer = buffers.get(id), capacity = p.capacity.get(id)!;
    if (buffer) for (const row of buffer.rows) {
      if (dateToOrdinal(row.from) > p.first + end || dateToOrdinal(row.to) < p.first + start) continue;
      assignments.add(row.assignmentId); if (row.allocationPercent === null) unknownAssignments.add(row.assignmentId);
    }
    for (let day = start; day <= end; day += 1) {
      const c = capacity[day], known = buffer?.known[day] ?? 0;
      capacityMd += c; knownMd += known; dailyCapacity[day - start] += c; dailyKnown[day - start] += known;
      if ((buffer?.unknown[day] ?? 0) > 0) unknownResourceDayCount += 1;
      if (c > 0) knownPeakResourceDailyLoadPercent = Math.max(knownPeakResourceDailyLoadPercent ?? 0, known / c * 100);
      const over = excess(known, c); excessMd += over;
      if (over > 0) { overAllocatedResourceDayCount += 1; overResources.add(id); overDays.add(day); }
    }
  }
  for (let index = 0; index < dailyCapacity.length; index += 1) if (dailyCapacity[index] > 0) knownPeakDailyLoadPercent = Math.max(knownPeakDailyLoadPercent ?? 0, dailyKnown[index] / dailyCapacity[index] * 100);
  const state = assignments.size === 0 ? "empty" : unknownAssignments.size === assignments.size ? "unset" : unknownAssignments.size > 0 ? "partial" : "configured";
  const plannedMd = state === "unset" ? null : knownMd;
  const knownLoadPercent = capacityMd > 0 ? knownMd / capacityMd * 100 : null;
  return { capacityMd, knownMd, plannedMd, plannedMm: plannedMd === null || p.input.mdPerMm === null ? null : plannedMd / p.input.mdPerMm,
    state, partial: unknownAssignments.size > 0, assignmentCount: assignments.size, unknownAssignmentCount: unknownAssignments.size, unknownResourceDayCount,
    knownLoadPercent, loadPercent: state === "unset" ? null : knownLoadPercent,
    knownPeakDailyLoadPercent, knownPeakResourceDailyLoadPercent,
    peakDailyLoadPercent: state === "unset" ? null : knownPeakDailyLoadPercent, peakResourceDailyLoadPercent: state === "unset" ? null : knownPeakResourceDailyLoadPercent,
    overAllocatedDayCount: overDays.size, overAllocatedResourceDayCount, overAllocatedResourceCount: overResources.size, excessMd };
}
function series(p: Prepared, ids: readonly string[], selected = p.selected): ResourcePlanSeries {
  const pair = (start: number, end: number): ResourcePlanPair => ({ selected: metrics(p, ids, selected, start, end), project: metrics(p, ids, p.full, start, end) });
  return { summary: pair(0, p.days - 1), cells: p.periods.map((period) => ({ periodKey: period.key, ...pair(dateToOrdinal(period.from) - p.first, dateToOrdinal(period.to) - p.first) })) };
}
export function calculateResourcePlan(input: ResourcePlanInput): ResourcePlanResult {
  const p = prepare(input);
  return { granularity: input.granularity, from: input.from, to: input.to, asOfDate: input.asOfDate, mdPerMm: input.mdPerMm, periods: p.periods,
    population: { resourceIds: p.ids, resourceCount: p.ids.length, capacityBasis: "effective-working-day-1MD" }, totals: series(p, p.ids),
    resources: p.ids.map((resourceId) => ({ resourceId, ...series(p, [resourceId]), milestones: [...(p.stageBuffers.get(resourceId)?.entries() ?? [])].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : compare(a, b)).map(([milestoneTaskId, buffer]) => ({ milestoneTaskId, capacityReferenceOnly: true, projectReferenceOnly: true, projectReferenceRow: { kind: "resource", resourceId }, ...series(p, [resourceId], new Map([[resourceId, buffer]])) })) })),
    groups: [...p.groups.entries()].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : compare(a, b)).map(([groupId, resourceIds]) => ({ groupId, resourceIds, ...series(p, resourceIds) })),
    metadata: { groupSubtotalsAdditive: false, milestoneCapacityAdditive: false, projectScope: "current-project-same-resources", overloadTolerance: TOLERANCE } };
}
function selectRow(p: Prepared, row: ResourcePlanRowSelector, scope: ResourcePlanDemandScope) {
  if (scope !== "selected" && scope !== "project") throw new Error("Invalid Resource Plan demand scope");
  if (!["total", "group", "resource", "resourceMilestone"].includes(row.kind)) throw new Error("Invalid Resource Plan row selector");
  let ids: string[];
  if (row.kind === "total") ids = p.ids;
  else if (row.kind === "group") { const group = p.groups.get(row.groupId); if (!group) throw new Error("Invalid Resource Plan Group selector"); ids = group; }
  else { if (!p.ids.includes(row.resourceId)) throw new Error("Invalid Resource Plan Resource selector"); ids = [row.resourceId]; }
  let buffers = scope === "project" ? p.full : p.selected;
  if (row.kind === "resourceMilestone") {
    const source = buffers.get(row.resourceId)!;
    const stage: Buffer = { known: new Float64Array(p.days), unknown: new Uint32Array(p.days), rows: source.rows.filter((assignment) => assignment.milestoneTaskId === row.milestoneTaskId) };
    for (const assignment of stage.rows) {
      const end = dateToOrdinal(assignment.to) - p.first;
      for (let day = dateToOrdinal(assignment.from) - p.first; day <= end; day += 1) {
      if (!p.capacity.get(row.resourceId)![day]) continue;
      if (assignment.allocationPercent === null) stage.unknown[day] += 1;
      else stage.known[day] += assignment.allocationPercent / 100;
      }
    }
    buffers = new Map([[row.resourceId, stage]]);
  }
  return { ids, buffers };
}
function validatePage(page: ResourcePlanPage) {
  if (!Number.isSafeInteger(page.offset) || page.offset < 0 || page.offset > 8000 || !Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100) throw new Error("Invalid Resource Plan page");
}
function paged<T>(rows: T[], page: ResourcePlanPage): ResourcePlanPaged<T> {
  validatePage(page);
  return { ...page, totalCount: rows.length, nextOffset: page.offset + page.limit < rows.length ? page.offset + page.limit : null, rows: rows.slice(page.offset, page.offset + page.limit) };
}
export function getResourcePlanDailyPage(input: ResourcePlanInput, selector: { row: ResourcePlanRowSelector; periodKey: string; demandScope: ResourcePlanDemandScope }, page: ResourcePlanPage): ResourcePlanPaged<ResourcePlanDailyRow> {
  const p = prepare(input), period = selector.periodKey === "all" ? { from: input.from, to: input.to } : p.periods.find((period) => period.key === selector.periodKey);
  if (!period) throw new Error("Invalid Resource Plan period selector");
  const { ids, buffers } = selectRow(p, selector.row, selector.demandScope);
  return paged(p.dates.map((date, index) => ({ date, index })).filter(({ date }) => date >= period.from && date <= period.to).map(({ date, index }) => ({ date, metrics: metrics(p, ids, buffers, index, index) })), page);
}
export function getResourcePlanDayResources(input: ResourcePlanInput, selector: { row: { kind: "total" } | { kind: "group"; groupId: string | null }; date: string; demandScope: ResourcePlanDemandScope }, page: ResourcePlanPage): ResourcePlanPaged<ResourcePlanDayResourceRow> {
  const p = prepare(input), index = dateToOrdinal(selector.date) - p.first;
  if (index < 0 || index >= p.days) throw new Error("Invalid Resource Plan day selector");
  if (selector.row.kind !== "total" && selector.row.kind !== "group") throw new Error("Invalid Resource Plan day Resource selector");
  const { ids, buffers } = selectRow(p, selector.row, selector.demandScope);
  validatePage(page);
  return { ...page, totalCount: ids.length, nextOffset: page.offset + page.limit < ids.length ? page.offset + page.limit : null,
    rows: ids.slice(page.offset, page.offset + page.limit).map((resourceId) => ({ resourceId, date: selector.date, metrics: metrics(p, [resourceId], buffers, index, index) })) };
}
export function getResourcePlanDayAssignments(input: ResourcePlanInput, selector: { row: ResourcePlanRowSelector; date: string; demandScope: ResourcePlanDemandScope }, page: ResourcePlanPage): ResourcePlanPaged<ResourcePlanDayAssignmentRow> {
  const p = prepare(input), index = dateToOrdinal(selector.date) - p.first;
  if (index < 0 || index >= p.days) throw new Error("Invalid Resource Plan day selector");
  const { ids, buffers } = selectRow(p, selector.row, selector.demandScope);
  const rows = ids.flatMap((id) => (buffers.get(id)?.rows ?? []).filter((row) => row.from <= selector.date && row.to >= selector.date).map((row) => {
    const working = p.capacity.get(id)![index] === 1, knownMd = working && row.allocationPercent !== null ? row.allocationPercent / 100 : 0;
    return { assignmentId: row.assignmentId, taskId: row.taskId, resourceId: id, milestoneTaskId: row.milestoneTaskId, date: selector.date, allocationPercent: row.allocationPercent, working, knownMd, plannedMd: row.allocationPercent === null ? null : knownMd };
  })).sort((a, b) => compare(a.resourceId, b.resourceId) || compare(a.taskId, b.taskId) || compare(a.assignmentId, b.assignmentId));
  return paged(rows, page);
}
