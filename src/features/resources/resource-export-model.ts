import type { ResourceDashboardDto, ResourceDashboardFilters, ResourceDashboardFilterInput } from "@/contracts/resource-dashboard";
import type { ResourceDataContext, ResourceDrillSourceContext } from "@/contracts/resource-drill";
import type { ResourceExcelExportOptions } from "@/contracts/resource-excel-export";
import type { ResourceDrillBinding } from "./resource-drill-transport";

/** Human-readable filter evidence keeps the immutable Task/WBS IDs visible. */
export function resourceExportFilterNames(
  ids: readonly string[],
  entries: readonly { id: string; name: string; code?: string | null }[],
): string {
  if (!ids.length) return "전체";
  const byId = new Map(entries.map(entry => [entry.id, entry] as const));
  return ids.map(id => {
    const match = byId.get(id);
    return match ? `${match.name}${match.code ? ` (${match.code})` : ""} · ${id}` : id;
  }).join(" / ");
}

export const RESOURCE_EXPORT_BODY_BYTES = 8 * 1024;
export type ResourceExportBasis = "current" | "project";
export type ResourceExportGranularity = "week" | "month";

/** A confirmed report belongs to one visit and its exact request, not merely a cached DTO. */
export interface ResourceExportLease {
  readonly confirmationId: number;
  readonly visitId: number;
  readonly queryKey: string;
  readonly bindingKey: string;
  readonly report: ResourceDashboardDto;
  readonly binding: ResourceDrillBinding | null;
}
export interface ResourceExportLiveState {
  readonly confirmationId: number;
  readonly visitId: number;
  readonly active: boolean;
  readonly phase: "loading" | "ready" | "error";
  readonly queryKey: string;
  readonly bindingKey: string;
  readonly projectPublicId: string;
  readonly projectRevision: number;
  /** Latest confirmed ledger/policy; the export server still validates actual freshness. */
  readonly context: ResourceDrillSourceContext | null;
  readonly readAllowed: boolean;
}
export type ResourceExportGuard =
  | "missing-report" | "read-denied" | "inactive-visit" | "loading-report"
  | "visit-changed" | "query-changed" | "binding-changed" | "source-unavailable"
  | "stale-context" | "stale-policy" | "report-changed";

function key(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return JSON.stringify(value.map(key));
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => [name, key(item)]));
}
function ledgerMatches(a: ResourceDataContext, b: ResourceDataContext): boolean {
  return a.projectPublicId === b.projectPublicId && a.projectRevision === b.projectRevision &&
    a.catalogRevision === b.catalogRevision && a.calendarRevision === b.calendarRevision &&
    a.dataSnapshotId === b.dataSnapshotId;
}
function reportPolicyMatches(report: ResourceDashboardDto, context: ResourceDrillSourceContext): boolean {
  return report.range.from === context.range.from && report.range.to === context.range.to &&
    report.asOfDate === context.asOfDate && report.mdPerMm === context.mdPerMm &&
    report.mdPerMmSource === context.mdPerMmSource && report.filters.mdPerMmProvided === context.mdPerMmProvided;
}

/** Neither a fresh Project GET nor the original drill's policy can replace the target report proof. */
export function resourceExportGuardReason(lease: ResourceExportLease | null, live: ResourceExportLiveState): ResourceExportGuard | null {
  if (!live.readAllowed) return "read-denied";
  if (!lease) return "missing-report";
  if (!live.active) return "inactive-visit";
  if (live.phase !== "ready") return "loading-report";
  if (lease.visitId !== live.visitId) return "visit-changed";
  if (lease.confirmationId !== live.confirmationId) return "report-changed";
  if (lease.queryKey !== live.queryKey) return "query-changed";
  if (lease.bindingKey !== live.bindingKey || lease.bindingKey !== resourceExportBindingKey(lease.binding)) return "binding-changed";
  const context = lease.report.resourceScopeContext;
  if (!context || !live.context) return "source-unavailable";
  if (live.projectPublicId !== lease.report.projectPublicId || live.projectRevision !== lease.report.projectRevision ||
      !ledgerMatches(context, live.context) || context.projectPublicId !== lease.report.projectPublicId ||
      context.projectRevision !== lease.report.projectRevision || context.catalogRevision !== lease.report.catalogRevision ||
      context.calendarRevision !== lease.report.calendarRevision ||
      (lease.binding && !ledgerMatches(lease.binding.sourceContext, context))) return "stale-context";
  if (!reportPolicyMatches(lease.report, context) || key(context) !== key(live.context)) return "stale-policy";
  return null;
}

export function resourceExportBindingKey(binding: ResourceDrillBinding | null): string {
  return JSON.stringify(binding);
}

/** Freeze dialog evidence without retaining a mutable hook/cache reference. */
export function captureResourceExportLease(lease: ResourceExportLease): ResourceExportLease {
  return structuredClone(lease);
}

/** Serialize the confirmed query input; DTO metadata is never sent as a query option. */
export function resourceExportIntent(lease: ResourceExportLease, basis: ResourceExportBasis,
  granularities: readonly ResourceExportGranularity[]): ResourceExcelExportOptions {
  const context = lease.report.resourceScopeContext;
  if (!context) throw new Error("SOURCE_UNAVAILABLE");
  if (!granularities.length || granularities.length > 2 || new Set(granularities).size !== granularities.length ||
      granularities.some(value => value !== "week" && value !== "month")) throw new Error("INVALID_GRANULARITIES");
  const common = {
    granularities: [...granularities],
    ...(lease.binding ? { originalSourceContext: structuredClone(lease.binding.sourceContext) } : {}),
  };
  if (basis === "project") return { ...common, basis, expectedReport: { context: structuredClone(context) } };
  const filters: ResourceDashboardFilterInput = resourceExportFilterInput(lease.report.filters);
  return { ...common, basis, expectedReport: { context: structuredClone(context),
    snapshotId: lease.report.snapshotId, filters },
    ...(lease.binding ? { binding: structuredClone(lease.binding) } : {}) };
}

export function resourceExportFilterInput(filters: ResourceDashboardFilters): ResourceDashboardFilterInput {
  const { mdPerMmProvided, mdPerMm, from, to, asOfDate, ...query } = structuredClone(filters);
  return { ...query, ...(from ? { from } : {}), ...(to ? { to } : {}),
    ...(asOfDate ? { asOfDate } : {}), ...(mdPerMmProvided ? { mdPerMm } : {}) };
}

/** Count the final complete JSON body in UTF-8, never truncate descriptors to fit. */
export function resourceExportBodyBudget(body: unknown) {
  try {
    const json = JSON.stringify(body);
    if (json === undefined) return { allowed: false, bytes: null, reason: "invalid-json" as const };
    const bytes = new TextEncoder().encode(json).byteLength;
    return { allowed: bytes <= RESOURCE_EXPORT_BODY_BYTES, bytes, reason: bytes <= RESOURCE_EXPORT_BODY_BYTES ? null : "body-limit" as const };
  } catch {
    return { allowed: false, bytes: null, reason: "invalid-json" as const };
  }
}
export interface ResourceExportDownloadToken {
  readonly generation: number;
  readonly visitId: number;
  readonly projectPublicId: string;
  readonly proofKey: string;
  readonly optionsKey: string;
}
export function resourceExportDownloadToken(generation: number, lease: ResourceExportLease, options: ResourceExcelExportOptions): ResourceExportDownloadToken {
  return { generation, visitId: lease.visitId, projectPublicId: lease.report.projectPublicId,
    optionsKey: key(options), proofKey: key({ confirmationId: lease.confirmationId, context: lease.report.resourceScopeContext, snapshotId: lease.report.snapshotId,
      filters: lease.report.filters, queryKey: lease.queryKey, binding: lease.binding }) };
}
export function resourceExportCanDeliver(token: ResourceExportDownloadToken, generation: number, open: boolean, aborted: boolean,
  lease: ResourceExportLease | null, live: ResourceExportLiveState, options: ResourceExcelExportOptions): boolean {
  if (!open || aborted || token.generation !== generation || resourceExportGuardReason(lease, live) !== null || !lease) return false;
  return token.visitId === lease.visitId && token.projectPublicId === live.projectPublicId &&
    token.proofKey === resourceExportDownloadToken(generation, lease, options).proofKey && token.optionsKey === key(options);
}

export interface ResourceExportEvidence { lease: ResourceExportLease | null; live: ResourceExportLiveState; refresh: () => void }

export type ResourceExportRejectedProof = { projectPublicId: string } & Pick<ResourceExportLease, "visitId" | "queryKey" | "bindingKey" | "confirmationId">;
/** Hook receipts are local to a visit; only the same request has an ordered receipt. */
export function resourceExportCanReconfirm(rejected: ResourceExportRejectedProof | null, candidate: ResourceExportLease,
  live: ResourceExportLiveState): boolean {
  if (resourceExportGuardReason(candidate, live) !== null) return false;
  if (!rejected) return true;
  const sameRequest = rejected.projectPublicId === candidate.report.projectPublicId && rejected.visitId === candidate.visitId && rejected.queryKey === candidate.queryKey &&
    rejected.bindingKey === candidate.bindingKey;
  return !sameRequest || candidate.confirmationId > rejected.confirmationId;
}
