/** Issue #616: Target is a project grouping, not an Equipment/System master. */
export type LogisticsTargetScope = "process" | "project_common";
export type LogisticsTargetMemberKind = "equipment" | "system";

export interface LogisticsTargetMemberDto {
  id: string;
  kind: LogisticsTargetMemberKind;
  entityId: string;
  code: string;
  label: string;
  typeCode: string;
  active: boolean;
  quantity: number; // Equipment original quantity; System = 1 instance
}

export interface LogisticsTargetDto {
  id: string;
  code: string;
  name: string;
  scope: LogisticsTargetScope;
  projectProcessId: string | null;
  occurrenceId: string | null;
  workAreaId: string | null;
  active: boolean;
  description: string;
  members: LogisticsTargetMemberDto[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsTargetMemberInput {
  kind: LogisticsTargetMemberKind;
  /** Existing project-local instance UUID (never a catalog/type/label identifier). */
  entityId: string;
}

/** Inline instances are created only inside the same project mutation transaction.
 * Changing an existing instance is never implied by Target membership changes. */
export interface LogisticsTargetInlineEquipment {
  kind: "equipment";
  create: {
    code: string; name: string; equipmentType: string;
    managementUnit: "unit" | "fleet"; quantity: number;
    manufacturer?: string; model?: string; description?: string;
    confirmDuplicateLabel?: boolean;
  };
}
export interface LogisticsTargetInlineSystem {
  kind: "system";
  create: {
    code: string; name?: string; systemType: string;
    layer: "controller" | "coordinator"; scope: "project" | "processes";
    processIds?: string[]; vendor?: string; description?: string;
    confirmDuplicateLabel?: boolean;
  };
}
export type LogisticsTargetCreateMember =
  | LogisticsTargetMemberInput
  | LogisticsTargetInlineEquipment
  | LogisticsTargetInlineSystem;

export interface CreateLogisticsTargetRequest {
  code: string; name: string; scope: LogisticsTargetScope;
  projectProcessId?: string | null; workAreaId?: string | null;
  active?: boolean; description?: string;
  members: LogisticsTargetCreateMember[];
}
export interface UpdateLogisticsTargetRequest {
  code?: string; name?: string; scope?: LogisticsTargetScope;
  projectProcessId?: string | null; workAreaId?: string | null;
  active?: boolean; description?: string;
  /** Omission preserves members; supplied array atomically replaces membership (nonempty). */
  members?: LogisticsTargetMemberInput[];
  /** Exact read-only impact preview receipt; stale project/member snapshots are rejected. */
  impactToken?: string;
  confirmImpact?: boolean;
}
export interface LogisticsTargetUsageDto {
  /** All usage and identities are from this one read snapshot. */
  projectRevision: number;
  targetId: string;
  memberCount: number;
  /** Unique effective regular Tasks; Summary/Milestone excluded. null means unsupported/not calculated. */
  referencedByTaskCount: number | null;
  referencedBySummaryCount: number | null;
  /** Canonical identities, including effective subtree inheritance; never legacy inference. */
  relatedTasks: Array<{ taskId: string; type: "task" | "summary" | "milestone" }>;
  members: Array<LogisticsTargetMemberDto & { targetCount: number; directTaskCount: number }>;
}
export interface LogisticsTargetListResponse {
  data: {
    projectRevision: number;
    targets: LogisticsTargetDto[];
    limit: number;
    offset: number;
    total: number;
    permission: "edit" | "readonly";
  };
}
export interface LogisticsTargetMutationResponse {
  data: {
    projectRevision: number;
    target: LogisticsTargetDto | null;
    operation: "create" | "update" | "delete";
  };
}
