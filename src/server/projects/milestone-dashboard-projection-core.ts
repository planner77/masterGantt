import type { MilestoneDashboardStageDto } from "../../contracts/milestone-dashboard";
import type { ProjectTaskDto } from "../../contracts/projects";
import { projectStageGates, type StageSnapshot } from "../../domain/milestones/stage-gates";
import { dateToOrdinal } from "../../domain/scheduling/date-only";
import { hasTaskSchedule } from "./task-schedule-guard";

/** Shared read projection; filters can select rows but never change the gate input. */
export function milestoneDashboardStages(tasks: ProjectTaskDto[], snapshot: StageSnapshot, asOfDate: string, horizonDays: number) {
  const projection = projectStageGates(snapshot);
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const limit = dateToOrdinal(asOfDate) + horizonDays - 1;
  const rows: MilestoneDashboardStageDto[] = tasks.filter((task) => task.type === "milestone").map((task) => {
    if (!hasTaskSchedule(task)) throw new Error("Canonical milestone schedule is missing.");
    const stageGate = projection.gates.get(task.taskId)!;
    const members = stageGate.memberTaskIds.map((id) => byId.get(id)!);
    for (const member of members) if (!hasTaskSchedule(member)) throw new Error("Canonical member schedule is missing.");
    const memberDurationSum = members.reduce((sum, member) => sum + member.duration!, 0);
    const memberWeightedProgressSum = members.reduce((sum, member) => sum + member.duration! * member.progress!, 0);
    const status = snapshot.tasks.find((row) => row.taskId === task.taskId)!.status;
    const incomplete = new Set(stageGate.incompleteMemberTaskIds);
    const risks = status === "completed" ? [] : members.filter((member) => incomplete.has(member.taskId) && member.end! > task.start)
      .map((member) => ({ taskId: member.taskId, name: member.name, end: member.end!, scheduledDate: task.start }));
    return {
      milestoneTaskId: task.taskId, name: task.name, externalId: task.externalId, scheduledDate: task.start,
      status, progress: task.progress, stageGate, memberDurationSum, memberWeightedProgressSum,
      overdue: status !== "completed" && task.start < asOfDate,
      upcoming: status !== "completed" && task.start >= asOfDate && dateToOrdinal(task.start) <= limit,
      atRisk: risks.length > 0, riskTaskIds: risks.map((risk) => risk.taskId), risks,
    };
  }).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.milestoneTaskId.localeCompare(b.milestoneTaskId));
  return { ...projection, rows };
}

export function relatedMilestoneStages(rows: MilestoneDashboardStageDto[], taskIds: readonly string[], milestoneIds: readonly string[]) {
  const matchingTasks = new Set(taskIds), matchingMilestones = new Set(milestoneIds);
  const related = rows.filter((row) => matchingMilestones.has(row.milestoneTaskId) || row.stageGate.memberTaskIds.some((id) => matchingTasks.has(id)));
  return { milestoneTaskIds: related.map((row) => row.milestoneTaskId), rows: related };
}
