import { displayName, formatLocaleNumber, translate } from "../../lib/i18n";
import { LOCALE_FORMATS, type AppLocale } from "../../lib/i18n/locales";
import type { ResourceAnalysisCell, ResourceAnalysisDimension, ResourceAnalysisPlanSelector, ResourceAnalysisQuery, ResourceAnalysisResult } from "../../contracts/resource-analysis";
import type { WbsViewQueryInput, WbsViewReportDto } from "../../contracts/wbs-dashboard-views";
import { rankResourceAnalysisCells } from "../../domain/resources/resource-analysis";
import type { ResourcePlanMetrics } from "../../domain/resources/resource-plan";
import { sameResourceDataContext } from "./resource-drill-scope-model";

/** T0 keeps the original task/physical scope while explicitly removing personal filters. */
export function resourceChartDiagnosticQuery(data: WbsViewReportDto): WbsViewQueryInput {
  const filters = { ...data.filters };
  for (const field of ["resourceIds", "groupIds", "roles", "developerGrades", "search", "resourceActivity", "groupActivity"] as const) delete filters[field];
  delete filters.granularity;
  filters.from = data.range.from; filters.to = data.range.to; filters.asOfDate = data.asOfDate;
  if (data.sourceContext.mdPerMmProvided) filters.mdPerMm = data.mdPerMm;
  else delete filters.mdPerMm;
  return { spec: data.spec, filters, ...(data.sourceContext.scope ? { scope: data.sourceContext.scope } : {}), projection: { kind: "report" } };
}
export function resourceChartDiagnosticSelection(origin: WbsViewReportDto, diagnostic: WbsViewReportDto, taskIds: readonly string[]) {
  const allowed = new Set(origin.analysis?.diagnostics.personallyUnassigned.taskIds ?? []);
  if (!sameResourceDataContext(origin.sourceContext, diagnostic.sourceContext) ||
    origin.range.from !== diagnostic.range.from || origin.range.to !== diagnostic.range.to || origin.asOfDate !== diagnostic.asOfDate || origin.mdPerMm !== diagnostic.mdPerMm ||
    origin.sourceContext.mdPerMmProvided !== diagnostic.sourceContext.mdPerMmProvided || origin.sourceContext.mdPerMmSource !== diagnostic.sourceContext.mdPerMmSource ||
    JSON.stringify(origin.sourceContext.scope) !== JSON.stringify(diagnostic.sourceContext.scope) ||
    new Set(taskIds).size !== taskIds.length || taskIds.some(id => !allowed.has(id) || !diagnostic.taskIds.includes(id))) throw Error("REPORT_STALE");
  return { taskIds: [...taskIds], assignmentIds: [] as string[] };
}

/** Plan project-load evidence may legitimately include tasks outside the selected WBS report.
 * Only its separate, validated Resource Plan gateway can navigate that wider evidence.
 * WBS actions remain restricted to their original task subset (except explicit T0).
 */
export function resourceChartCanNavigate(
  selection: { taskIds: readonly string[]; plan?: ResourceAnalysisPlanSelector; diagnosticT0?: boolean },
  selectedTaskIds: readonly string[],
  gateway: { wbs: boolean; resourcePlan: boolean },
): boolean {
  if (!selection.taskIds.length) return false;
  if (selection.plan) return gateway.resourcePlan;
  return gateway.wbs && (selection.diagnosticT0 === true ||
    selection.taskIds.every(id => selectedTaskIds.includes(id)));
}

export type ResourceChartKind = "period" | "concentration" | "contribution";
export type ResourceChartMetric = "effort" | "tasks" | "completed" | "delayed";
export const RESOURCE_CHART_LABELS: Record<ResourceAnalysisDimension, string> = { resource: "개인", group: "Group", role: "Global Role", developerGrade: "개발 등급", milestone: "Milestone", process: "공정", workArea: "WorkArea", equipment: "설비", system: "물류 시스템" };
export const RESOURCE_CHART_PAGE_SIZE = 20;
export const RESOURCE_CHART_PERIOD_SIZE = 4;
export function resourceChartQuery(kind: ResourceChartKind, concentration: ResourceAnalysisDimension, contribution: ResourceAnalysisDimension, granularity: "week" | "month", unit: "M/D" | "M/M"): ResourceAnalysisQuery {
  return { pivot: kind === "period" ? ["resource"] : kind === "concentration" ? [concentration] : ["resource", contribution], granularity, unit };
}
export function resourceChartName(data: WbsViewReportDto, dimension: ResourceAnalysisDimension, id: string | null, locale: AppLocale = "ko"): string {
  if (id === null || id === "UNSPECIFIED") return `${translate(locale,RESOURCE_CHART_LABELS[dimension])} ${translate(locale,"미지정")}`;
  const memberships = data.configuration.resourceMemberships;
  const catalog = dimension === "resource" ? memberships : dimension === "group" ? memberships.flatMap(row => row.groups) : dimension === "process" ? data.configurationCatalog.processes : dimension === "workArea" ? data.configurationCatalog.workAreas : dimension === "milestone" ? data.configurationCatalog.milestones : dimension === "equipment" || dimension === "system" ? data.configurationCatalog.instances.filter(row => row.kind === dimension) : [];
  const item = catalog.find(row => row.id === id);
  if (item) return dimension === "resource" || dimension === "milestone" ? item.name : displayName(item,locale);
  return translate(locale,({ BEGINNER: "초급", INTERMEDIATE: "중급", ADVANCED: "고급", EXPERT: "특급", DEVELOPER: "개발자", PI: "PI", EQUIPMENT_OWNER: "설비 담당" } as Record<string, string>)[id] ?? "원본 이름 확인 필요");
}
export function resourceChartCellName(data: WbsViewReportDto, cell: ResourceAnalysisCell, locale: AppLocale = "ko"): string {
  return cell.values.map(value => resourceChartName(data, value.dimension, value.id, locale)).join(" · ") || translate(locale,"현재 범위 전체");
}
export function resourceChartEffort(effort: ResourceAnalysisCell["assignments"]["effort"], unit: "M/D" | "M/M", mdPerMm: number | null, locale: AppLocale = "ko"): string {
  if (unit === "M/M" && mdPerMm === null) return translate(locale,"환산 기준 미설정");
  const value = unit === "M/M" ? effort.plannedMm : effort.plannedMd;
  const known = unit === "M/M" ? effort.knownMd / mdPerMm! : effort.knownMd;
  if (effort.state === "unset") return translate(locale,"미설정 {value0}건",{value0:effort.unsetCount});
  return `${(value ?? known).toLocaleString(LOCALE_FORMATS[locale], { maximumFractionDigits: 2 })} ${unit}${effort.partial ? translate(locale," (부분합 · 미설정 {value0}건)",{value0:effort.unsetCount}) : ""}`;
}
export function resourceChartMetricValue(cell: ResourceAnalysisCell, metric: ResourceChartMetric, unit: "M/D" | "M/M", mdPerMm: number | null): number | null {
  if (metric === "tasks") return cell.tasks.taskCount;
  if (metric === "completed") return cell.tasks.completed.count;
  if (metric === "delayed") return cell.tasks.delayed.count;
  if (cell.assignments.effort.state === "unset" || unit === "M/M" && mdPerMm === null) return null;
  return unit === "M/M" ? cell.assignments.effort.knownMd / mdPerMm! : cell.assignments.effort.knownMd;
}
/** Display ordering only: every value and exact selector remains the R2 authority. */
export function resourceChartRank(model: ResourceAnalysisResult, metric: ResourceChartMetric, top: number | "all", page: number) {
  const order = metric === "completed" ? [...model.cells].sort((a,b)=>b.tasks.completed.count-a.tasks.completed.count || a.key.localeCompare(b.key)) : rankResourceAnalysisCells(model, metric === "effort" ? "knownMd" : metric === "tasks" ? "taskCount" : "delayedTaskCount", 100).cells;
  // The shared selector has a 100-row Top-N budget. Full view sorts the same canonical cells.
  const all = metric === "completed" || model.cells.length <= 100 ? order : [...model.cells].sort((a,b)=>(resourceChartMetricValue(b,metric,"M/D",model.scope.mdPerMm)??-1)-(resourceChartMetricValue(a,metric,"M/D",model.scope.mdPerMm)??-1)||a.key.localeCompare(b.key));
  const selected = top === "all" ? all : all.slice(0,top);
  const offset = Math.min(Math.max(0,page)*RESOURCE_CHART_PAGE_SIZE,Math.max(0,Math.floor((selected.length-1)/RESOURCE_CHART_PAGE_SIZE)*RESOURCE_CHART_PAGE_SIZE));
  return { rows:selected.slice(offset,offset+RESOURCE_CHART_PAGE_SIZE),offset,total:selected.length,allCount:all.length };
}
export const resourceChartPercent = (value: number | null, locale: AppLocale = "ko") => value === null ? translate(locale,"미산정") : `${value.toLocaleString(LOCALE_FORMATS[locale], { maximumFractionDigits: 2 })}%`;
export function resourceChartPlanText(metrics: ResourcePlanMetrics, unit: "M/D" | "M/M", mdPerMm: number | null, locale: AppLocale = "ko"): string {
  const effort = resourceChartEffort({ knownMd:metrics.knownMd, plannedMd:metrics.plannedMd, plannedMm:metrics.plannedMm, state:metrics.state, partial:metrics.partial, unsetCount:metrics.unknownAssignmentCount, assignmentIds:[], unsetAssignmentIds:[] },unit,mdPerMm,locale);
  return `${effort} · Capacity ${metrics.capacityMd.toLocaleString(LOCALE_FORMATS[locale],{maximumFractionDigits:2})} M/D · Load ${metrics.partial?translate(locale,"알려진 부분 "):""}${resourceChartPercent(metrics.loadPercent,locale)}${metrics.loadPercent===null&&metrics.knownLoadPercent!==null?` (${translate(locale,"알려진 부분 ")}${resourceChartPercent(metrics.knownLoadPercent,locale)})`:""} · Peak day ${metrics.partial?translate(locale,"알려진 부분 "):""}${resourceChartPercent(metrics.peakResourceDailyLoadPercent,locale)} · ${translate(locale,"초과")} ${formatLocaleNumber(metrics.overAllocatedResourceDayCount,locale)} ${translate(locale,"개인·일 /")} ${metrics.excessMd.toLocaleString(LOCALE_FORMATS[locale],{maximumFractionDigits:2})} M/D${metrics.capacityMd===0&&metrics.knownMd>0?translate(locale," · Capacity 0의 계획 투입 경고"):""}`;
}
