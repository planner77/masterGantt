import type { LogisticsTargetMemberKind } from "./logistics-targets";

export type TaskTargetBindingScope = "self" | "subtree";
export type TaskTargetBindingSelection = "whole" | "subset";

/** Coverage is work scope, never physical quantity or Resource allocation. */
export interface TaskTargetMemberCoverage {
  memberId: string;
  coverage: number | null;
}

export interface TaskTargetBindingInput {
  id?: string;
  targetId: string;
  scope: TaskTargetBindingScope;
  selection: TaskTargetBindingSelection;
  /** Explicit typed Target member IDs; whole always uses an empty array. */
  memberIds: string[];
  coverageByMember?: TaskTargetMemberCoverage[];
}

export interface TaskTargetBindingDto extends TaskTargetBindingInput {
  id: string;
  taskId: string;
}

export interface ReplaceTaskTargetBindingsRequest {
  bindings: TaskTargetBindingInput[];
}

export interface TaskTargetBindingProvenance {
  bindingId: string;
  sourceTaskId: string;
  targetId: string;
  memberId: string;
  selection: TaskTargetBindingSelection;
  scope: TaskTargetBindingScope;
  inherited: boolean;
  coverage: number | null;
  coverageMode: "whole" | "partial" | "unspecified";
}

export interface TaskTargetLegacySource {
  sourceKind: "legacy_direct";
  sourceTaskId: string;
  kind: LogisticsTargetMemberKind;
  entityId: string;
  scope: TaskTargetBindingScope;
  inherited: boolean;
}

export interface TaskTargetEffectiveMember {
  kind: LogisticsTargetMemberKind;
  entityId: string;
  /** All Target paths survive instance-ID deduplication. Legacy remains separate. */
  provenance: TaskTargetBindingProvenance[];
  coverageState: "unspecified" | "single" | "multiple";
}

export interface TaskTargetBindingsDto {
  taskId: string;
  bindings: TaskTargetBindingDto[];
  inheritedBindings: TaskTargetBindingDto[];
  effectiveMembers: TaskTargetEffectiveMember[];
  legacySources: TaskTargetLegacySource[];
  effectiveEquipmentIds: string[];
  effectiveSystemIds: string[];
  effectiveTargetIds: string[];
}

export interface TaskTargetBindingsResponse {
  data: {
    projectRevision: number;
    taskId: string;
    bindings: TaskTargetBindingDto[];
    effective: TaskTargetBindingsDto;
    permission?: "edit" | "readonly";
  };
}

/** Summary and Milestone context never inflate the regular Task count. */
export interface TaskTargetUsageCount {
  taskIds: string[];
  summaryTaskIds: string[];
  milestoneTaskIds: string[];
  taskCount: number;
  summaryCount: number;
  milestoneCount: number;
}
