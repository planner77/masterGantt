import type { CopyMilestoneReference, CopyInheritanceReference, MembershipCopyPlan, ProjectTaskDto, TaskHierarchyCommandRequest } from "@/contracts/projects";

export type CopyCommand = Extract<TaskHierarchyCommandRequest, { kind: "copy" }>;
export type CopyReview = Readonly<{ publicId: string; revision: number; command: CopyCommand; plan: MembershipCopyPlan }>;
export function copyReviewKey(publicId: string, revision: number, command: CopyCommand, plan: MembershipCopyPlan): string {
  return JSON.stringify([publicId, revision, plan.rootTaskIds, plan.copiedTaskIds, command.anchorTaskId, command.placement]);
}
export function copyReviewMatches(review: CopyReview, publicId: string, revision: number, command: CopyCommand, plan: MembershipCopyPlan): boolean {
  return copyReviewKey(review.publicId, review.revision, review.command, review.plan) === copyReviewKey(publicId, revision, command, plan) && JSON.stringify(review.plan.impacts) === JSON.stringify(plan.impacts) && JSON.stringify(review.plan.excludedExplicitMemberships) === JSON.stringify(plan.excludedExplicitMemberships);
}
export function taskIdentity(tasks: readonly ProjectTaskDto[], id: string, t: (key: string) => string = key => key): string {
  const task = tasks.find((candidate) => candidate.taskId === id);
  return task ? `${task.name} · ${t("외부 ID")}: ${task.externalId} · ${t("작업 ID")}: ${task.taskId}` : `${t("확인할 수 없는 작업 ID")}: ${id}`;
}
export function copyMilestoneLabel(reference: CopyMilestoneReference, tasks: readonly ProjectTaskDto[], t: (key: string) => string = key => key): string {
  if (!reference) return t("미지정");
  return reference.kind === "existing" ? `${t("기존 Milestone")} · ${taskIdentity(tasks, reference.existingMilestoneTaskId, t)}` : `${t("복제될 Milestone")} · ${t("원본")} ${taskIdentity(tasks, reference.copiedFromMilestoneTaskId, t)}`;
}
export function copyInheritanceLabel(reference: CopyInheritanceReference, tasks: readonly ProjectTaskDto[], t: (key: string) => string = key => key): string {
  if (!reference) return t("직접 지정 또는 미지정");
  return reference.kind === "existing" ? `${t("기존 Summary 상속")} · ${taskIdentity(tasks, reference.existingSummaryTaskId, t)}` : `${t("복제될 Summary 상속")} · ${t("원본")} ${taskIdentity(tasks, reference.copiedFromSummaryTaskId, t)}`;
}
export const COPY_REASON_LABELS = {
  EXTERNAL_EXPLICIT_EXCLUDED: "복사 범위 밖 명시 Milestone 연결 제외",
  EXTERNAL_INHERITANCE_CHANGED: "복사 범위 밖 Summary 상속 변경",
  DESTINATION_INHERITANCE_CHANGED: "붙여넣기 대상의 Milestone 상속 적용",
} as const;
