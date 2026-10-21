import { WBS_VIEW_DIMENSIONS, WBS_VIEW_LIMITS, type WbsViewDimension, type WbsViewLevel, type WbsViewQueryInput, type WbsViewProjection } from "../../contracts/wbs-dashboard-views";
import { parseResourceDashboardQuery } from "./resource-dashboard-query-core";
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { ResourceDrillScope } from "../../contracts/resource-drill";
const invalid = (): never => { throw new PublicApiError(400, "INVALID_REQUEST", "WBS 조회 명세와 선택 경로를 확인해 주세요."); };
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) return invalid();
  return value as Record<string, unknown>;
}
const dimension = (value: unknown): WbsViewDimension => typeof value === "string" && WBS_VIEW_DIMENSIONS.includes(value as WbsViewDimension) ? value as WbsViewDimension : invalid();
const scalarInteger = (value: unknown, fallback: number, min: number, max: number): number => value === undefined ? fallback : typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : invalid();
export function parseWbsViewQuery(value: unknown): WbsViewQueryInput {
  const input = object(value, ["spec", "filters", "projection", "scope"]), spec = object(input.spec, ["version", "contextSourceVersion", "root", "levels", "systemView", "systemIds"]);
  if (spec.version !== "wbs-view:v1" || spec.contextSourceVersion !== "explicit-task-context:v1") invalid();
  const root = dimension(spec.root), levels: WbsViewLevel[] = [];
  if ((spec.systemView !== undefined || spec.systemIds !== undefined) && root !== "system") invalid();
  if (spec.systemView !== undefined && spec.systemView !== "direct" && spec.systemView !== "coordination") invalid();
  if (spec.systemIds !== undefined && (!Array.isArray(spec.systemIds) || spec.systemIds.length > WBS_VIEW_LIMITS.fanout || spec.systemIds.some(id => typeof id !== "string" || !isCanonicalUuidV4(id)))) invalid();
  const systemIds = spec.systemIds === undefined ? undefined : [...new Set(spec.systemIds as string[])].sort();
  if (spec.levels !== undefined) {
    if (!Array.isArray(spec.levels) || spec.levels.length >= WBS_VIEW_LIMITS.depth) invalid();
    for (const level of spec.levels as unknown[]) {
      if (typeof level === "string") levels.push(dimension(level));
      else {
        const stage = object(level, ["kind", "dimensions"]);
        if (stage.kind !== "siblings" || !Array.isArray(stage.dimensions) || stage.dimensions.length !== 2 || new Set(stage.dimensions).size !== 2 || stage.dimensions.some(id => id !== "equipment" && id !== "system")) invalid();
        levels.push({ kind: "siblings", dimensions: [...stage.dimensions as ["equipment", "system"]] });
      }
    }
  }
  const dimensions = [root, ...levels.flatMap(level => typeof level === "string" ? [level] : level.dimensions)];
  if (new Set(dimensions).size !== dimensions.length) invalid();
  const filters = input.filters === undefined ? {} : object(input.filters, ["from", "to", "asOfDate", "search", "taskSearch", "mode", "granularity", "resourceActivity", "groupActivity", "resourceIds", "groupIds", "milestoneIds", "taskIds", "wbsRootIds", "roles", "developerGrades", "statuses", "mdPerMm", "equipmentTypeCodes"]);
  if (filters.equipmentTypeCodes !== undefined && !Array.isArray(filters.equipmentTypeCodes)) invalid();
  const params = new URLSearchParams();
  for (const [key, field] of Object.entries(filters)) {
    if (Array.isArray(field)) { if (field.length > 8000 || field.some(value => typeof value !== "string")) invalid(); if (field.length) params.set(key, field.join(",")); }
    else if (typeof field === "string" || typeof field === "number" || field === null) params.set(key, field === null ? "null" : String(field));
    else invalid();
  }
  const checked = parseResourceDashboardQuery(params);
  let scope: ResourceDrillScope | undefined;
  if (input.scope !== undefined) {
    const raw = object(input.scope, ["kind", "nodeIds", "rootId", "assignmentIds"]);
    if (raw.kind === "summarySubtree") {
      if (raw.nodeIds !== undefined || raw.assignmentIds !== undefined || typeof raw.rootId !== "string" || !isCanonicalUuidV4(raw.rootId)) invalid();
      scope = { kind: raw.kind, rootId: raw.rootId as string };
    } else if (raw.kind === "scheduleSelection" || raw.kind === "exactAssignments") {
      const key = raw.kind === "scheduleSelection" ? "nodeIds" : "assignmentIds", other = key === "nodeIds" ? "assignmentIds" : "nodeIds", ids = raw[key];
      if (raw.rootId !== undefined || raw[other] !== undefined || !Array.isArray(ids) || ids.length > (key === "nodeIds" ? 5000 : 8000) || ids.some(id => typeof id !== "string" || !isCanonicalUuidV4(id))) invalid();
      const values = [...new Set(ids as string[])].sort();
      scope = raw.kind === "scheduleSelection" ? { kind: raw.kind, nodeIds: values } : { kind: raw.kind, assignmentIds: values };
    } else invalid();
  }
  let projection: WbsViewProjection = { kind: "report" };
  if (input.projection !== undefined) {
    const raw = object(input.projection, ["kind", "snapshotId", "path", "view", "offset", "limit"]);
    if (raw.kind === "report") { if (Object.keys(raw).length !== 1) invalid(); }
    else {
      if ((raw.kind !== "scope" && raw.kind !== "details") || typeof raw.snapshotId !== "string" || !/^[a-f0-9]{64}$/.test(raw.snapshotId) || !Array.isArray(raw.path) || raw.path.length > WBS_VIEW_LIMITS.depth) invalid();
      const stages: WbsViewDimension[][] = [[root], ...levels.map(level => typeof level === "string" ? [level] : level.dimensions)];
      const path = (raw.path as unknown[]).map((value, index) => {
        const entry = object(value, ["dimension", "id"]), dim = dimension(entry.dimension);
        if (!stages[index]?.includes(dim) || entry.id !== null && (typeof entry.id !== "string" || !entry.id.length || entry.id.length > 100)) invalid();
        return { dimension: dim, id: entry.id as string | null };
      });
      if (raw.kind === "scope") {
        if (raw.view !== undefined || raw.offset !== undefined || raw.limit !== undefined) invalid();
        projection = { kind: "scope", snapshotId: raw.snapshotId as string, path };
      } else {
        if (raw.view !== "tasks" && raw.view !== "assignments") invalid();
        projection = { kind: "details", snapshotId: raw.snapshotId as string, path, view: raw.view as "tasks" | "assignments", offset: scalarInteger(raw.offset, 0, 0, 100000), limit: scalarInteger(raw.limit, 50, 1, WBS_VIEW_LIMITS.detailRows) };
      }
    }
  }
  return { spec: { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels, ...(spec.systemView === undefined ? {} : { systemView: spec.systemView as "direct" | "coordination" }), ...(systemIds === undefined ? {} : { systemIds }) }, filters: checked, ...(scope ? { scope } : {}), projection };
}
