import type { MilestoneDashboardDto, MilestoneDashboardFilterInput, MilestoneDashboardFiltersDto, MilestoneDashboardStageDto } from "../../contracts/milestone-dashboard";
import { parseDateOnly } from "../../domain/scheduling/date-only";

const arrayKeys = ["milestoneIds", "resourceIds", "assignmentRoles", "developerGrades", "processIds", "equipmentIds", "systemIds", "roleResourceIds"] as const;
const unique = <T extends string>(values: readonly T[] | undefined): T[] => [...new Set(values ?? [])].sort();

export function normalizeDashboardFilters(input: MilestoneDashboardFilterInput): MilestoneDashboardFiltersDto {
  return {
    search: input.search?.trim() ?? "", milestoneIds: unique(input.milestoneIds),
    asOfDate: input.asOfDate || null, horizonDays: input.horizonDays ?? 14,
    from: input.from || null, to: input.to || null,
    resourceIds: unique(input.resourceIds), assignmentRoles: unique(input.assignmentRoles), developerGrades: unique(input.developerGrades),
    processIds: unique(input.processIds), equipmentIds: unique(input.equipmentIds), systemIds: unique(input.systemIds), roleResourceIds: unique(input.roleResourceIds),
    systemView: input.systemView ?? "direct", activeOnly: input.activeOnly ?? false,
    includeDescendantProcesses: input.includeDescendantProcesses ?? true, mdPerMm: input.mdPerMm ?? null, mdPerMmProvided: input.mdPerMm !== undefined,
  };
}

export function dashboardQuery(input: MilestoneDashboardFilterInput): string {
  const normalized = normalizeDashboardFilters(input);
  const query = new URLSearchParams();
  if (normalized.search) query.set("search", normalized.search);
  for (const key of arrayKeys) for (const value of normalized[key]) query.append(key, value);
  for (const key of ["asOfDate", "from", "to"] as const) if (normalized[key]) query.set(key, normalized[key]);
  query.set("horizonDays", String(normalized.horizonDays));
  query.set("systemView", normalized.systemView);
  query.set("activeOnly", String(normalized.activeOnly));
  query.set("includeDescendantProcesses", String(normalized.includeDescendantProcesses));
  if (input.mdPerMm !== undefined) query.set("mdPerMm", input.mdPerMm === null ? "null" : String(input.mdPerMm));
  return query.toString();
}

export function dashboardFilterError(input: MilestoneDashboardFilterInput): string | null {
  if (input.asOfDate !== undefined && !input.asOfDate) return "수동 기준일을 입력해 주세요.";
  const filters = normalizeDashboardFilters(input);
  if (!Number.isInteger(filters.horizonDays) || filters.horizonDays < 1 || filters.horizonDays > 90) return "임박 기간은 1~90일의 정수로 입력해 주세요.";
  try { for (const date of [filters.asOfDate, filters.from, filters.to]) if (date) parseDateOnly(date); }
  catch { return "올바른 기준일과 공수 기간을 입력해 주세요."; }
  if (filters.from && filters.to && filters.from > filters.to) return "공수 시작일은 종료일보다 늦을 수 없습니다.";
  if (input.mdPerMm !== undefined && input.mdPerMm !== null && (!Number.isFinite(input.mdPerMm) || input.mdPerMm <= 0)) return "M/M 환산 기준은 0보다 큰 숫자로 입력해 주세요.";
  return null;
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const nullableNumber = (value: unknown) => value === null || number(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
function effort(value: unknown): boolean {
  return record(value) && number(value.plannedMd) && nullableNumber(value.plannedMm) && number(value.unsetAllocationCount) && strings(value.assignmentIds) && strings(value.unsetAssignmentIds) && Array.isArray(value.roleTotals);
}
export function dashboardStageValid(value: unknown): value is MilestoneDashboardStageDto {
  if (!record(value) || !["milestoneTaskId", "name", "externalId", "scheduledDate", "status"].every((key) => typeof value[key] === "string") || !number(value.progress) || !strings(value.riskTaskIds) || !Array.isArray(value.risks)) return false;
  const gate = value.stageGate;
  return record(gate) && ["memberTaskIds", "incompleteMemberTaskIds", "predecessorMilestoneTaskIds", "incompletePredecessorMilestoneTaskIds"].every((key) => strings(gate[key])) && number(gate.memberCount) && number(gate.completedMemberCount) && nullableNumber(gate.memberProgressPercent) && ["membersCompleted", "predecessorsCompleted", "blocked", "manualEvent", "completionInconsistent"].every((key) => typeof gate[key] === "boolean") && (gate.ready === null || typeof gate.ready === "boolean") && ["overdue", "upcoming", "atRisk"].every((key) => typeof value[key] === "boolean");
}

/** Shape/identity/echo checks only; KPI, inheritance and effort remain server-owned. */
export function dashboardFrom(body: unknown): MilestoneDashboardDto | null {
  if (!record(body) || !record(body.data)) return null;
  const data = body.data;
  if (typeof data.projectPublicId !== "string" || !number(data.projectRevision) || !number(data.catalogRevision) || typeof data.calculatedAt !== "string" || !Number.isFinite(Date.parse(data.calculatedAt)) || typeof data.timezone !== "string" || typeof data.asOfDate !== "string" || !number(data.horizonDays) || !nullableNumber(data.mdPerMm) || !["query", "environment", "unset"].includes(String(data.mdPerMmSource))) return null;
  try { parseDateOnly(data.asOfDate); } catch { return null; }
  const filters = data.filters, scope = data.scope, catalog = data.catalog;
  if (!record(filters) || !arrayKeys.every((key) => strings(filters[key])) || !record(data.workloadRange) || typeof data.workloadRange.from !== "string" || typeof data.workloadRange.to !== "string" || !record(data.kpi)) return null;
  const kpi = data.kpi;
  if (!["ready", "blocked", "overdue", "upcoming", "atRisk"].every((key) => { const count = kpi[key]; return record(count) && number(count.count) && strings(count.milestoneTaskIds); })) return null;
  if (!record(kpi.completion) || !number(kpi.completion.numerator) || !number(kpi.completion.denominator) || !nullableNumber(kpi.completion.percent) || !strings(kpi.completion.milestoneTaskIds) || !strings(kpi.completion.completedMilestoneTaskIds)) return null;
  if (!record(kpi.coverage) || !number(kpi.coverage.numerator) || !number(kpi.coverage.denominator) || !nullableNumber(kpi.coverage.percent) || !strings(kpi.coverage.taskIds) || !strings(kpi.coverage.assignedTaskIds)) return null;
  if (!Array.isArray(data.rows) || !data.rows.every((row) => dashboardStageValid(row) && record(row) && strings(row.scopedTaskIds) && effort(row.effort)) || !record(scope) || !["taskIds", "assignmentIds", "milestoneTaskIds"].every((key) => strings(scope[key]))) return null;
  if (!effort(data.effort) || !record(data.effort) || !Array.isArray(data.effort.buckets) || !data.effort.buckets.every((bucket) => record(bucket) && (bucket.milestoneTaskId === null || typeof bucket.milestoneTaskId === "string") && strings(bucket.taskIds) && effort(bucket)) || !Array.isArray(data.effort.assignments)) return null;
  if (!record(catalog) || !["milestones", "resources", "processes", "equipment", "systems"].every((key) => Array.isArray(catalog[key]) && (catalog[key] as unknown[]).every((item) => record(item) && typeof item.id === "string" && typeof item.name === "string"))) return null;
  return data as unknown as MilestoneDashboardDto;
}

export function dashboardMatches(data: MilestoneDashboardDto, publicId: string, revision: number, input: MilestoneDashboardFilterInput, minimumCatalogRevision = 0): boolean {
  const expected = normalizeDashboardFilters(input);
  const actual = data.filters;
  return data.projectPublicId === publicId && data.projectRevision === revision && data.catalogRevision >= minimumCatalogRevision && data.horizonDays === expected.horizonDays && Object.keys(expected).every((key) => JSON.stringify(actual[key as keyof typeof actual]) === JSON.stringify(expected[key as keyof typeof expected])) && (!expected.asOfDate || data.asOfDate === expected.asOfDate);
}

export function projectDateAt(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function displayPercent(value: number | null): string { return value === null ? "대상 없음" : `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value)}%`; }
export function displayEffort(value: number | null): string { return value === null ? "—" : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value); }
export function conversionLabel(value: number | null, source: "query" | "environment" | "unset" | undefined): string { return value === null ? "M/M 환산 기준 미설정" : `1 M/M = ${displayEffort(value)} M/D · ${source === "query" ? "명시 기준" : source === "environment" ? "환경 설정 기준" : "환산 기준"}`; }
