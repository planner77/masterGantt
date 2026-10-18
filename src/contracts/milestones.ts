/** Explicit membership uses immutable public Task IDs, independently of WBS/Dependency IDs. */
export interface TaskMilestoneMembershipDto {
  explicitMilestoneTaskId: string | null;
  effectiveMilestoneTaskId: string | null;
  inheritedFromTaskId: string | null;
}

export interface MilestoneStageGateDto {
  memberTaskIds: string[];
  memberCount: number;
  completedMemberCount: number;
  incompleteMemberTaskIds: string[];
  memberProgressPercent: number | null;
  predecessorMilestoneTaskIds: string[];
  incompletePredecessorMilestoneTaskIds: string[];
  membersCompleted: boolean;
  predecessorsCompleted: boolean;
  /** null for manual events with no effective ordinary Task members. */
  ready: boolean | null;
  blocked: boolean;
  manualEvent: boolean;
  completionInconsistent: boolean;
}

export interface MilestoneMembershipCommand {
  changes: { taskId: string; milestoneTaskId: string | null }[];
}
