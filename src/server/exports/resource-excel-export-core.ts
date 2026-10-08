import type { ProjectSnapshotResponse } from "@/contracts/projects";
import { RESOURCE_EXCEL_EXPORT_LIMITS as LIMITS, type ResourceExcelExportOptions, type ResourceExcelReportBundle } from "../../contracts/resource-excel-export";
import type { ResourceDashboardSummary } from "@/contracts/resource-dashboard";
import type { ResourcePlanMetrics, ResourcePlanSeries } from "@/domain/resources/resource-plan";
import { normalizeResourceDashboardFilters } from "../resources/resource-dashboard-query-core";
import { ProjectExcelExportError } from "./project-excel-export-core";

export type ResourceExcelValue = string | number | boolean | null | undefined;
export type ResourceExcelRowRenderer = (row: number, values: readonly ResourceExcelValue[], header: boolean) => string;
const unsupported = (message: string): never => { throw new ProjectExcelExportError("EXPORT_UNSUPPORTED", message); };
export function assertResourceExcelBudget(dimension: string, actual: number, limit: number): void {
  if (!Number.isSafeInteger(actual) || actual < 0) unsupported("Invalid Resource Excel budget count.");
  if (actual > limit) limited(dimension);
}
export function assertResourceExcelXmlBytes(entries: readonly (string | Uint8Array)[]): void { assertResourceExcelBudget("workbook XML bytes", entries.reduce((n, entry) => n + Buffer.byteLength(entry), 0), LIMITS.workbookXmlBytes); }
export function assertResourceExcelZipBytes(bytes: Uint8Array): void { assertResourceExcelBudget("workbook ZIP bytes", bytes.byteLength, LIMITS.workbookZipBytes); }
const limited = (dimension: string): never => { throw new ProjectExcelExportError("EXPORT_LIMIT_EXCEEDED", `Resource Excel ${dimension} limit exceeded.`); };
const equalNumber = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
const summaryKeys = ["taskCount", "resourceCount", "assignmentCount", "notStarted", "inProgress", "completed", "delayed", "completionNumerator", "completionDenominator", "completionPercent (0-100)", "progressNumerator", "progressDenominator", "progressPercent (0-100)", "knownMd", "plannedMd", "plannedMm", "state", "partial", "unsetCount"];
function summary(s: ResourceDashboardSummary): ResourceExcelValue[] { return [s.taskCount, s.resourceCount, s.assignmentCount, s.notStarted, s.inProgress, s.completed, s.delayed, s.completion.numerator, s.completion.denominator, s.completion.percent, s.assignedTaskProgress.numerator, s.assignedTaskProgress.denominator, s.assignedTaskProgress.percent, s.effort.knownMd, s.effort.plannedMd, s.effort.plannedMm, s.effort.state, s.effort.partial, s.effort.unsetCount]; }
const metricKeys: (keyof ResourcePlanMetrics)[] = ["capacityMd", "knownMd", "plannedMd", "plannedMm", "state", "partial", "assignmentCount", "unknownAssignmentCount", "unknownResourceDayCount", "loadPercent", "knownLoadPercent", "peakDailyLoadPercent", "peakResourceDailyLoadPercent", "knownPeakDailyLoadPercent", "knownPeakResourceDailyLoadPercent", "overAllocatedDayCount", "overAllocatedResourceDayCount", "overAllocatedResourceCount", "excessMd"];
export function validateResourceExcelValues(value: unknown): void {
  if (typeof value === "string") for (const char of value) { const code = char.codePointAt(0)!;
    if (!(code === 9 || code === 10 || code === 13 || code >= 0x20 && code <= 0xD7FF || code >= 0xE000 && code <= 0xFFFD || code >= 0x10000 && code <= 0x10FFFF)) unsupported("Resource report contains an XML 1.0 forbidden character.");
  }
  if (typeof value === "number" && !Number.isFinite(value)) unsupported("Non-finite Resource report value.");
  if (value && typeof value === "object") for (const item of Object.values(value)) validateResourceExcelValues(item);
}
function validateSeries(series: ResourcePlanSeries) {
  for (const scope of ["selected", "project"] as const) for (const key of ["capacityMd", "knownMd", "excessMd"] as const) {
    if (!equalNumber(series.cells.reduce((n, cell) => n + cell[scope][key], 0), series.summary[scope][key])) unsupported(`Resource Plan ${scope}/${key} period parity mismatch.`);
  }
}
export function validateResourceExcelReport(snapshot: ProjectSnapshotResponse, options: ResourceExcelExportOptions, bundle: ResourceExcelReportBundle): void {
  if (!bundle || !bundle.report || !bundle.sourceContext || !bundle.quality || !bundle.assignments || !bundle.plans) unsupported("Missing Resource export DTO.");
  validateResourceExcelValues(bundle);
  let link: URL;
  try { link = new URL(bundle.canonicalProjectUrl ?? ""); } catch { return unsupported("Missing validated Project direct link."); }
  if (!["https:", "http:"].includes(link.protocol) || link.username || link.password || link.search || link.hash || link.pathname !== `/projects/${snapshot.data.project.publicId}`) unsupported("Unsafe Project direct link.");
  const report = bundle.report, context = bundle.sourceContext, expected = options.expectedReport.context;
  if (bundle.basis !== options.basis || report.projectPublicId !== snapshot.data.project.publicId || report.projectRevision !== snapshot.data.project.revision || context.sourceProjection.kind !== "report" || !report.resourceScopeContext || JSON.stringify(context) !== JSON.stringify(report.resourceScopeContext)) unsupported("Resource report identity mismatch.");
  for (const key of ["projectPublicId", "projectRevision", "catalogRevision", "calendarRevision", "dataSnapshotId", "asOfDate", "mdPerMm", "mdPerMmSource", "mdPerMmProvided"] as const) if (context[key] !== expected[key]) unsupported(`Resource report context ${key} mismatch.`);
  if (JSON.stringify(context.range) !== JSON.stringify(expected.range)) unsupported("Resource report range mismatch.");
  if (options.basis === "current" && report.snapshotId !== options.expectedReport.snapshotId) unsupported("Resource report snapshot mismatch.");
  if (options.basis === "current" && JSON.stringify(report.filters) !== JSON.stringify(normalizeResourceDashboardFilters(options.expectedReport.filters))) unsupported("Resource report filter mismatch.");
  const canonicalAssignments = new Map(snapshot.data.assignments?.map(a => [a.id, a]) ?? []);
  const taskIds = new Set(snapshot.data.tasks.filter(t => t.type === "task").map(t => t.taskId)), ids = new Set<string>();
  for (const row of bundle.assignments) {
    if (!row.assignment || !taskIds.has(row.taskId) || ids.has(row.assignment.assignmentId)) unsupported("Invalid or duplicate Resource Assignment row.");
    const canonical = canonicalAssignments.get(row.assignment.assignmentId);
    if (!canonical || canonical.taskId !== row.taskId || canonical.target.kind !== "resource" || canonical.target.id !== row.assignment.resourceId) unsupported("Resource Assignment canonical identity mismatch.");
    ids.add(row.assignment.assignmentId);
    if (row.assignment.allocationPercent === null && (row.assignment.plannedMd !== null || row.assignment.plannedMm !== null)) unsupported("Unset Assignment must preserve null effort.");
  }
  if (ids.size !== report.summary.assignmentCount || !equalNumber(bundle.assignments.reduce((n, row) => n + (row.assignment.plannedMd ?? 0), 0), report.summary.effort.knownMd)) unsupported("Resource Assignment count/effort parity mismatch.");
  for (const row of [...report.resources, ...report.groups]) if (!equalNumber(row.milestones.reduce((n, cell) => n + cell.summary.effort.knownMd, 0), row.summary.effort.knownMd)) unsupported("Resource Milestone partition mismatch.");
  if (bundle.quality.scope !== "T0-before-personal-filters" || bundle.quality.unsetAssignments.length !== report.diagnostics.unsetAssignmentCount) unsupported("Resource diagnostic grain mismatch.");
  const qualityIds = new Set<string>();
  for (const row of bundle.quality.unsetAssignments) { if (!canonicalAssignments.has(row.assignmentId) || !taskIds.has(row.taskId) || qualityIds.has(row.assignmentId) || row.allocationPercent !== null) unsupported("Invalid raw quality Assignment."); qualityIds.add(row.assignmentId); }
  for (const granularity of options.granularities) {
    const plan = bundle.plans[granularity];
    if (!plan) return unsupported("Missing Resource Plan DTO.");
    if ( plan.granularity !== granularity || plan.from !== report.range.from || plan.to !== report.range.to || plan.asOfDate !== report.asOfDate || plan.mdPerMm !== report.mdPerMm || !equalNumber(plan.totals.summary.selected.knownMd, report.summary.effort.knownMd)) unsupported("Missing or mismatched Resource Plan DTO.");
    if (new Set(plan.population.resourceIds).size !== plan.resources.length || plan.resources.some(row => !plan.population.resourceIds.includes(row.resourceId))) unsupported("Invalid Capacity R identity.");
    for (const row of [plan.totals, ...plan.resources, ...plan.groups]) validateSeries(row);
    for (const resource of plan.resources) for (const milestone of resource.milestones) {
      if (!milestone.capacityReferenceOnly || !milestone.projectReferenceOnly || milestone.projectReferenceRow.resourceId !== resource.resourceId || JSON.stringify(milestone.summary.project) !== JSON.stringify(resource.summary.project)) unsupported("Invalid non-additive Milestone reference.");
      validateSeries(milestone);
    }
  }
}
/** Receives server DTOs only; no calendar, allocation or state recalculation occurs here. */
export function buildResourceExcelSheets(snapshot: ProjectSnapshotResponse, options: ResourceExcelExportOptions, bundle: ResourceExcelReportBundle, render: ResourceExcelRowRenderer): { name: string; xml: string; relationship?: string }[] {
  validateResourceExcelReport(snapshot, options, bundle);
  let totalRows = 0, totalCells = 0, renderedBytes = 0;
  const sheets: { name: string; xml: string; relationship?: string }[] = [];
  const sheet = (name: string, build: (append: (values: ResourceExcelValue[], header?: boolean) => void) => void) => {
    const rows: string[] = [];
    const append = (values: ResourceExcelValue[], header = false) => {
      assertResourceExcelBudget("sheet rows", rows.length + 1, LIMITS.sheetRows);
      assertResourceExcelBudget("report rows", ++totalRows, LIMITS.reportRows);
      assertResourceExcelBudget("report cells", totalCells += values.length, LIMITS.reportCells);
      const row = render(rows.length + 1, values, header);
      assertResourceExcelBudget("report XML bytes", renderedBytes += Buffer.byteLength(row), LIMITS.workbookXmlBytes);
      rows.push(row);
    };
    build(append);
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${rows.join("")}</sheetData></worksheet>`;
    if (name.length > 31) unsupported("Resource sheet name exceeds Excel limit.");
    assertResourceExcelBudget("worksheet XML bytes", Buffer.byteLength(xml), LIMITS.workbookXmlBytes);
    if (name === "Resource Report") {
      const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      sheets.push({ name, xml: xml.replace("</worksheet>", '<hyperlinks><hyperlink ref="B2" r:id="rIdProjectDirect" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></hyperlinks></worksheet>'), relationship: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdProjectDirect" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escape(bundle.canonicalProjectUrl!)}" TargetMode="External"/></Relationships>` });
    } else sheets.push({ name, xml });
  };
  const report = bundle.report, catalog = report.catalog, milestoneDate = (id: string | null) => id === null ? null : snapshot.data.tasks.find(task => task.taskId === id && task.type === "milestone")?.start ?? null, milestoneName = (id: string | null) => id === null ? "Milestone 미지정" : catalog.milestones.find(m => m.id === id)?.name ?? id;
  sheet("Resource Report", append => {
    append(["Resource report basis", bundle.basis, "Legacy Gantt/Stages/Resource Effort basis", "Project 전체"], true);
    append(["Direct Project Link", bundle.canonicalProjectUrl]);
    append(["Project name", snapshot.data.project.name]);
    for (const [key, value] of Object.entries({ projectPublicId: report.projectPublicId, projectRevision: report.projectRevision, catalogRevision: report.catalogRevision, calendarRevision: report.calendarRevision, snapshotId: report.snapshotId, dataSnapshotId: bundle.sourceContext.dataSnapshotId, from: report.range.from, to: report.range.to, asOfDate: report.asOfDate, mdPerMm: report.mdPerMm, mdPerMmSource: report.mdPerMmSource, mdPerMmProvided: bundle.sourceContext.mdPerMmProvided, calculatedAt: report.calculatedAt, timezone: report.timezone, precision: "raw", groupRoleSubtotalsAdditive: false, taskSubtotalsAdditive: false, milestoneCapacityAdditive: false, diagnosticsScope: bundle.quality.scope })) append([key, value]);
    append(["Actual target context", JSON.stringify(bundle.sourceContext)]);
    if (bundle.originalSourceContext) append(["Original source provenance (not current totals)", JSON.stringify(bundle.originalSourceContext)]);
    append(["Normalized filters", JSON.stringify(report.filters)]);
    append(["dimension", "id", "name", ...summaryKeys], true);
    append(["total", null, "전체 선택 A", ...summary(report.summary)]);
    if (report.reference) append(["milestoneReference", null, "Milestone 조건 제거 참고 A", ...summary(report.reference)]);
    if (report.excluded) append(["milestoneExcluded", null, "Milestone 제외 A", ...summary(report.excluded)]);
    for (const row of report.resources) append(["resource", row.id, row.name, ...summary(row.summary)]);
    for (const row of report.groups) append(["group (non-additive)", row.id, row.name, ...summary(row.summary)]);
    for (const row of report.roleTotals) append(["role (non-additive)", row.role, row.role, ...summary(row.summary)]);
    append(["T0 denominator", report.diagnostics.denominator]);
    for (const key of ["completelyUnassigned", "groupOnly", "personallyUnassigned", "unsetTasks"] as const) append([key, report.diagnostics[key].count]);
    append(["raw unset Assignment count", report.diagnostics.unsetAssignmentCount]);
  });
  for (const [name, rows] of [["Resource Milestones", report.resources], ["Group Milestones", report.groups]] as const) sheet(name, append => {
    append(["dimensionId", "name", "milestoneTaskId", "Milestone", "scheduledDate", "assignmentEffortAdditiveAcrossResources", ...summaryKeys], true);
    for (const row of rows) for (const cell of row.milestones) append([row.id, row.name, cell.milestoneTaskId, milestoneName(cell.milestoneTaskId), milestoneDate(cell.milestoneTaskId), name === "Resource Milestones", ...summary(cell.summary)]);
  });
  sheet("Resource Plan", append => {
    append(["granularity", "dimension", "id", "name", "milestoneTaskId", "Milestone", "periodId", "from", "to", "periodLabel", "year", "week", "month", "partial", "demandScope", "capacityReferenceOnly", "projectReferenceOnly", "projectReferenceResourceId", ...metricKeys.map(key => key.includes("Percent") ? `${key} (0-100)` : key)], true);
    for (const granularity of options.granularities) {
      const plan = bundle.plans[granularity]!;
      const series = (dimension: string, id: string | null, name: string, value: ResourcePlanSeries, milestoneId?: string | null) => {
        for (const cell of [{ periodKey: "all", ...value.summary }, ...value.cells]) for (const scope of ["selected", "project"] as const) {
          const period = plan.periods.find(p => p.key === cell.periodKey);
          append([granularity, dimension, id, name, milestoneId, milestoneId === undefined ? undefined : milestoneName(milestoneId), cell.periodKey, period?.from ?? plan.from, period?.to ?? plan.to, period?.label, period?.year, period?.week, period?.month, period?.partial, scope, milestoneId !== undefined, milestoneId !== undefined && scope === "project", milestoneId !== undefined && scope === "project" ? id : undefined, ...metricKeys.map(key => cell[scope][key])]);
        }
      };
      series("total", null, "전체 Capacity R", plan.totals);
      for (const row of plan.groups) series("group (non-additive)", row.groupId, row.name, row);
      for (const row of plan.resources) { series("resource", row.resourceId, row.name, row); for (const m of row.milestones) series("resourceMilestone (non-additive capacity)", row.resourceId, row.name, m, m.milestoneTaskId); }
    }
  });
  sheet("Resource Assignments", append => {
    append(["assignmentId", "taskId", "externalId", "task", "status", "progress (0-100)", "taskStart", "taskEnd", "duration", "delayed", "effectiveMilestoneTaskId", "explicitMilestoneTaskId", "inheritedFromTaskId", "resourceId", "resource", "code", "active", "developerGrade", "assignmentStart", "assignmentEnd", "overlapFrom", "overlapTo", "allocationPercent (0-100)", "effectiveWorkingDays", "plannedMd", "plannedMm", "unset"], true);
    for (const row of bundle.assignments) { const a = row.assignment; append([a.assignmentId, row.taskId, row.externalId, row.taskName, row.status, row.progress, row.taskStart, row.taskEnd, row.duration, row.delayed, row.effectiveMilestoneTaskId, row.explicitMilestoneTaskId, row.inheritedFromTaskId, a.resourceId, a.resourceName, a.resourceCode, a.active, a.developerGrade, a.assignmentStart, a.assignmentEnd, a.from, a.to, a.allocationPercent, a.effectiveWorkingDays, a.plannedMd, a.plannedMm, a.allocationPercent === null]); }
  });
  sheet("Resource Quality", append => {
    append(["grain", "scope", "category", "taskId", "task", "assignmentId", "resourceId", "resource", "originalFrom", "originalTo", "overlapsReport", "allocationPercent", "plannedMd", "plannedMm"], true);
    for (const task of bundle.quality.tasks) for (const category of task.categories) append(["Task", bundle.quality.scope, category, task.taskId, task.name]);
    for (const row of bundle.quality.unsetAssignments) append(["raw Assignment", bundle.quality.scope, "unset", row.taskId, row.taskName, row.assignmentId, row.resourceId, row.resourceName, row.effectiveFrom, row.effectiveTo, row.overlapsRange, null, null, null]);
    for (const row of bundle.assignments.filter(row => row.effectiveMilestoneTaskId === null)) append(["selected Assignment", "A", "Milestone 미지정", row.taskId, row.taskName, row.assignment.assignmentId, row.assignment.resourceId, row.assignment.resourceName, row.assignment.from, row.assignment.to, true, row.assignment.allocationPercent, row.assignment.plannedMd, row.assignment.plannedMm]);
  });
  sheet("Resource Relations", append => {
    append(["relation", "sourceId", "targetId", "name", "position"], true);
    for (const milestone of catalog.milestones) append(["MilestoneMetadata", milestone.id, milestoneDate(milestone.id), milestone.name]);
    for (const resource of catalog.resources) { for (const group of resource.groupIds) append(["ResourceGroup (non-additive)", resource.id, group, catalog.groups.find(g => g.id === group)?.name]); for (const role of resource.roles) append(["ResourceRole (non-additive)", resource.id, role]); }
    for (const row of bundle.assignments) { for (const group of row.assignment.groupIds) append(["AssignmentGroup", row.assignment.assignmentId, group]); for (const role of row.assignment.roles) append(["AssignmentRole", row.assignment.assignmentId, role]); row.wbsPath.forEach((part, index) => append(["AssignmentWbs", row.assignment.assignmentId, part.taskId, part.name, index])); }
    for (const row of bundle.quality.unsetAssignments) { for (const group of row.groupIds) append(["RawUnsetGroup", row.assignmentId, group]); for (const role of row.roles) append(["RawUnsetRole", row.assignmentId, role]); }
    for (const task of bundle.quality.tasks) task.wbsPath.forEach((part, index) => append(["QualityTaskWbs", task.taskId, part.taskId, part.name, index]));
    for (const [key, values] of Object.entries(report.filters)) if (Array.isArray(values)) for (const value of values) append([`Filter:${key}`, "report", value]);
    if (bundle.scope) append(["Original exact scope", "report", JSON.stringify(bundle.scope)]);
  });
  return sheets;
}
