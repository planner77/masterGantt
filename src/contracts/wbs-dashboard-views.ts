import type { ResourceDashboardFilterInput } from "./resource-dashboard";
import type { ResourceDrillScope } from "./resource-drill";
export const WBS_VIEW_DIMENSIONS = ["process", "workArea", "equipment", "system", "resource", "milestone", "group", "role"] as const;
export type WbsViewDimension = typeof WBS_VIEW_DIMENSIONS[number];
export interface WbsViewPathEntry { dimension: WbsViewDimension; id: string | null }
export type WbsViewLevel = WbsViewDimension | { kind: "siblings"; dimensions: ["equipment", "system"] | ["system", "equipment"] };
export interface WbsViewSpec {
  version: "wbs-view:v1";
  contextSourceVersion: "explicit-task-context:v1";
  root: WbsViewDimension;
  levels?: WbsViewLevel[];
}
export const WBS_VIEW_LIMITS = Object.freeze({ bodyBytes: 1024 * 1024, depth: 8, cells: 5000, fanout: 1000, detailRows: 100, responseBytes: 2 * 1024 * 1024, sourceRows: 50000 });
export type WbsViewProjection = { kind: "report" } | { kind: "details"; snapshotId: string; path: WbsViewPathEntry[]; view: "tasks" | "assignments"; offset: number; limit: number } | { kind: "scope"; snapshotId: string; path: WbsViewPathEntry[] };
export interface WbsViewQueryInput {
  spec: WbsViewSpec;
  filters?: ResourceDashboardFilterInput;
  scope?: ResourceDrillScope;
  projection?: WbsViewProjection;
}

import type { ResourceDataContext } from "./resource-drill";
import type { ResourceDashboardDetailRow, ResourceDashboardPlanDto } from "./resource-dashboard";
import type { WbsTaskLedgerSnapshot, WbsTaskLedgerRow, WbsTaskLedgerSource, summarizeWbsTaskLedger } from "../domain/resources/wbs-task-ledger";
export type WbsViewTotals = Omit<ReturnType<typeof summarizeWbsTaskLedger>, "fullMilestones">;
export interface WbsViewNode {
  selector: WbsViewPathEntry; path: WbsViewPathEntry[]; viewRowKey: string; name: string | null;
  taskIds: string[]; assignmentIds: string[]; totals: WbsViewTotals;
  provenance: Array<{ taskId: string; sources: WbsTaskLedgerSource[] }>;
  children: WbsViewNode[];
}
export interface WbsViewSourceContext extends ResourceDataContext {
  schema: "wbs-view-source/1"; contextSourceVersion: "explicit-task-context:v1";
  snapshotId: string; spec: WbsViewSpec; path: WbsViewPathEntry[]; scope?: ResourceDrillScope;
  range: { from: string; to: string }; asOfDate: string; mdPerMm: number | null;
  mdPerMmSource: "query" | "environment" | "unset"; mdPerMmProvided: boolean;
}
export interface WbsViewInstancePath {
  taskId: string; kind: "equipment" | "system"; instanceId: string;
  sources: WbsTaskLedgerSource[];
  targetMembers: WbsTaskLedgerRow["targetSources"]["effectiveMembers"];
  legacySources: WbsTaskLedgerRow["targetSources"]["legacySources"];
}
export interface WbsViewIdentityScope {
  taskIds: string[]; assignmentIds: string[]; taskCount: number; assignmentCount: number; ancestorSummaryIds: string[];
  selectedSources: Array<{ taskId: string; sources: WbsTaskLedgerSource[] }>;
  instanceIds: Array<{ kind: "equipment" | "system"; instanceId: string }>;
  instancePaths: WbsViewInstancePath[];
}
export interface WbsViewResponseContext {
  schema: "wbs-view-report/1"; snapshotId: string; projectPublicId: string; projectRevision: number;
  sourceContext: WbsViewSourceContext; spec: WbsViewSpec; filters: ResourceDashboardFilterInput;
  range: { from: string; to: string }; asOfDate: string; mdPerMm: number | null;
  metadata: WbsTaskLedgerSnapshot["metadata"] & { limits: typeof WBS_VIEW_LIMITS; excel: { supported: false; code: "WBS_VIEW_EXPORT_UNSUPPORTED"; reason: string } };
}
export interface WbsViewReportDto extends WbsViewResponseContext, WbsViewIdentityScope {
  projection: "report"; totals: WbsViewTotals; children: WbsViewNode[];
  taskSources: WbsTaskLedgerRow[]; configuration: WbsTaskLedgerSnapshot["configuration"]; diagnostics: WbsTaskLedgerSnapshot["diagnostics"];
  fullMilestones: ReturnType<typeof summarizeWbsTaskLedger>["fullMilestones"]; plan?: ResourceDashboardPlanDto;
}
export interface WbsViewDetailsDto extends WbsViewResponseContext {
  projection: "details"; path: WbsViewPathEntry[]; view: "tasks" | "assignments";
  offset: number; limit: number; totalCount: number; nextOffset: number | null;
  rows: Array<ResourceDashboardDetailRow & { taskSources: WbsTaskLedgerRow; selectedSources: WbsTaskLedgerSource[]; instancePaths: WbsViewInstancePath[] }>;
}
export interface WbsViewScopeDto extends WbsViewResponseContext, WbsViewIdentityScope {
  projection: "scope"; path: WbsViewPathEntry[]; taskSources: WbsTaskLedgerRow[];
}
export type WbsViewResponseDto = WbsViewReportDto | WbsViewDetailsDto | WbsViewScopeDto;
