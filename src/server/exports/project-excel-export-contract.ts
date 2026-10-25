import { PublicApiError } from "../http/api-error-core";
import { z } from "zod";

import { parseResourceDrillQuery, parseResourceDrillSourceContext } from "../resources/resource-drill-query-core";
import { parseWbsViewQuery } from "../resources/wbs-dashboard-views-query-core";
import type { WbsViewSourceContext } from "../../contracts/wbs-dashboard-views";
import { RESOURCE_PHYSICAL_FILTER_KEYS, RESOURCE_TARGET_FILTER_KEYS } from "../../contracts/resource-dashboard";
import { parseResourceDashboardQuery } from "../resources/resource-dashboard-query-core";
import type { ResourceExcelExportInput, ResourceExcelSourceBinding, WbsResourceExcelExportOptions } from "../../contracts/resource-excel-export";
import type { ApiErrorDetail } from "@/contracts/projects";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";

const gridColumnId = z.enum(["text", "externalId", "projectStart", "projectDuration"]);
const exportSchema = z.object({
  includeDependencies: z.boolean(),
  resourceDashboard: z.unknown().optional(),
  includeLogistics: z.boolean().optional(),
  includeResourceEffort: z.boolean().optional(),
  scope: z.literal("project"),
  scale: z.literal("day"),
  hierarchyDisplay: z.literal("expanded"),
  layout: z.object({
    columns: z.array(z.object({
      id: gridColumnId,
      widthPx: z.number().finite().int().min(40).max(800),
    }).strict()).max(4),
  }).strict(),
}).strict().superRefine((value, context) => {
  const ids = value.layout.columns.map((column) => column.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: "custom",
      path: ["layout", "columns"],
      message: "Column identifiers must be unique.",
    });
  }
});

type ParseResult =
  | { success: true; data: ProjectExcelExportRequest }
  | { success: false; details: ApiErrorDetail[] };

export function parseProjectExcelExportInput(input: unknown): ParseResult {
  const result = exportSchema.safeParse(input);
  if (result.success) {
    try {
      const resourceDashboard = result.data.resourceDashboard === undefined ? undefined : parseResourceExcelOptions(result.data.resourceDashboard);
      return { success: true, data: { ...result.data, ...(resourceDashboard === undefined ? {} : { resourceDashboard }) } as ProjectExcelExportRequest };
    } catch (error) { if (error instanceof PublicApiError && error.code === "WBS_VIEW_EXPORT_UNSUPPORTED") throw error; return { success: false, details: [{ path: "resourceDashboard", code: "INVALID_FIELD", message: "Invalid Resource report export options." }] }; }
  }
  return {
    success: false,
    details: result.error.issues.map((issue) => ({
      path: issue.code === "unrecognized_keys"
        ? "$"
        : issue.path.length > 0 ? issue.path.join(".") : "$",
      code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
      message: issue.code === "unrecognized_keys"
        ? "The request contains an unknown field."
        : "Invalid field value.",
    })),
  };
}

function strictObject(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Invalid export object");
  return value as Record<string, unknown>;
}
function parseWbsExcelContext(value: unknown): WbsViewSourceContext {
  const input = strictObject(value, ["projectPublicId", "projectRevision", "catalogRevision", "calendarRevision", "dataSnapshotId", "range", "asOfDate", "mdPerMm", "mdPerMmSource", "mdPerMmProvided", "schema", "contextSourceVersion", "snapshotId", "spec", "path", "scope"]);
  const { schema, contextSourceVersion, snapshotId, spec, path, scope, ...policy } = input;
  if (schema !== "wbs-view-source/1" || contextSourceVersion !== "explicit-task-context:v1") throw new Error("Invalid WBS source");
  const checked = parseWbsViewQuery({ spec, ...(scope === undefined ? {} : { scope }), projection: { kind: "scope", snapshotId, path } });
  if (checked.spec.root !== "resource") throw new PublicApiError(409, "WBS_VIEW_EXPORT_UNSUPPORTED", "이 관점의 동적 Excel은 아직 지원하지 않습니다. 리소스 관점 또는 기존 호환 보고서를 이용해 주세요.");
  const projection = checked.projection!;
  if (projection.kind !== "scope") throw new Error("Invalid WBS selection");
  const context = parseResourceDrillSourceContext({ ...policy, sourceProjection: { kind: "report" } });
  const base = Object.fromEntries(Object.entries(context).filter(([key]) => key !== "sourceProjection")) as Omit<typeof context, "sourceProjection">;
  return { ...base, schema, contextSourceVersion, snapshotId: projection.snapshotId, spec: checked.spec, path: projection.path, ...(checked.scope ? { scope: checked.scope } : {}) };
}
export function parseResourceExcelOptions(value: unknown): ResourceExcelExportInput {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    const expected = candidate.expectedReport as { context?: { schema?: string; spec?: unknown } } | undefined;
    if (expected?.context?.schema === "wbs-view-source/1") {
      const input = strictObject(value, ["basis", "expectedReport", "granularities"]);
      if (!Array.isArray(input.granularities) || input.granularities.length < 1 || input.granularities.length > 2 || new Set(input.granularities).size !== input.granularities.length || input.granularities.some(item => item !== "week" && item !== "month")) throw new Error("Invalid granularities");
      const granularities = input.granularities as ("week" | "month")[];
      const report = strictObject(input.expectedReport, input.basis === "current" ? ["context", "snapshotId", "filters"] : ["context", "filters"]);
      const context = parseWbsExcelContext(report.context);
      if (report.filters === undefined) throw new Error("Missing original WBS filters");
      const query = parseWbsViewQuery({ spec: context.spec, filters: report.filters, scope: context.scope });
      if (input.basis === "project") return { basis: "project", expectedReport: { context, filters: query.filters! }, granularities };
      if (input.basis !== "current" || report.snapshotId !== context.snapshotId) throw new Error("Invalid WBS snapshot");
      return { basis: "current", expectedReport: { context, snapshotId: context.snapshotId, filters: query.filters! }, granularities } satisfies WbsResourceExcelExportOptions;
    }
    if (candidate.spec !== undefined || candidate.viewSpec !== undefined || candidate.contextSourceVersion === "explicit-task-context:v1" || expected?.context?.spec !== undefined) {
      throw new PublicApiError(409, "WBS_VIEW_EXPORT_UNSUPPORTED", "새 WBS 조회 명세는 정확한 리소스 출처가 필요합니다. 조회를 갱신하거나 기존 호환 보고서를 이용해 주세요.");
    }
  }
  const input = strictObject(value, ["basis", "expectedReport", "binding", "originalSourceContext", "granularities"]);
  if (!Array.isArray(input.granularities) || input.granularities.length < 1 || input.granularities.length > 2 || new Set(input.granularities).size !== input.granularities.length || input.granularities.some(item => item !== "week" && item !== "month")) throw new Error("Invalid granularities");
  const granularities = input.granularities as ("week" | "month")[];
  const originalSourceContext = input.originalSourceContext === undefined ? undefined : parseResourceDrillSourceContext(input.originalSourceContext);
  if (input.basis === "project") {
    if (input.binding !== undefined) throw new Error("Whole-project scope cannot carry an exact restriction");
    const expected = strictObject(input.expectedReport, ["context"]);
    return { basis: "project", expectedReport: { context: parseResourceDrillSourceContext(expected.context) }, ...(originalSourceContext === undefined ? {} : { originalSourceContext }), granularities };
  }
  if (input.basis !== "current") throw new Error("Invalid report basis");
  const expected = strictObject(input.expectedReport, ["context", "snapshotId", "filters"]);
  if (typeof expected.snapshotId !== "string" || !/^[a-f0-9]{64}$/.test(expected.snapshotId)) throw new Error("Invalid snapshot");
  const context = parseResourceDrillSourceContext(expected.context);
  let binding: ResourceExcelSourceBinding | undefined;
  let filters;
  if (input.binding !== undefined) {
    const original = strictObject(input.binding, ["sourceContext", "scope"]);
    const checked = parseResourceDrillQuery({ sourceContext: original.sourceContext, scope: original.scope, filters: expected.filters, projection: { kind: "report" } });
    binding = { sourceContext: checked.sourceContext, scope: checked.scope }; filters = checked.filters;
  } else {
    const filter = strictObject(expected.filters, ["from", "to", "asOfDate", "search", "taskSearch", "mode", "granularity", "resourceActivity", "groupActivity", "resourceIds", "groupIds", "milestoneIds", "taskIds", "wbsRootIds", "roles", "developerGrades", "statuses", "mdPerMm", ...RESOURCE_TARGET_FILTER_KEYS, ...RESOURCE_PHYSICAL_FILTER_KEYS, "projectionOrder"]);
    const params = new URLSearchParams();
    for (const [key, field] of Object.entries(filter)) {
      if (Array.isArray(field)) { if (field.some(item => typeof item !== "string")) throw new Error("Invalid filters"); if (field.length) params.set(key, field.join(",")); }
      else if (typeof field === "string" || typeof field === "number" || field === null) params.set(key, field === null ? "null" : String(field));
      else throw new Error("Invalid filter");
    }
    filters = parseResourceDashboardQuery(params);
  }
  return { basis: "current", expectedReport: { context, snapshotId: expected.snapshotId, filters }, ...(binding === undefined ? {} : { binding }), ...(originalSourceContext === undefined ? {} : { originalSourceContext }), granularities };
}
