import type { ProjectLinkDto, ProjectTaskDto } from "../../src/contracts/projects";
import { stageSnapshotFromProject } from "../../src/domain/milestones/project-stage-model";
import { projectStageGates } from "../../src/domain/milestones/stage-gates";

function task(taskId: string, type: ProjectTaskDto["type"], parentExternalId: string | null = null, overrides: Partial<ProjectTaskDto> = {}): ProjectTaskDto {
  return {
    taskId, externalId: taskId, name: taskId, type, parentExternalId, siblingOrder: 0,
    scheduleMode: "auto", requestedStart: "2026-10-05", start: "2026-10-05", end: "2026-10-05",
    duration: type === "milestone" ? 0 : 1, progress: 0, status: "not_started",
    membership: { explicitMilestoneTaskId: null, effectiveMilestoneTaskId: null, inheritedFromTaskId: null },
    ...overrides,
  };
}

/** Synthetic canonical rows include full inheritance, roll-up and historical mixed links. */
export function milestoneTimelineFixture(): { tasks: ProjectTaskDto[]; links: ProjectLinkDto[] } {
  const tasks = [
    task("S1", "summary", null, { start: "2026-10-01", end: "2026-10-12", duration: 8, progress: 25, membership: { explicitMilestoneTaskId: "M1", effectiveMilestoneTaskId: "M1", inheritedFromTaskId: null } }),
    task("T1", "task", "S1", { siblingOrder: 0, duration: 3, progress: 100, status: "completed" }),
    task("T2", "task", "S1", { siblingOrder: 1, duration: 9, progress: 0 }),
    task("M1", "milestone", "S1", { siblingOrder: 2, requestedStart: "2026-09-30", start: "2026-10-12", end: "2026-10-12", name: "동일 이름 아주 긴 단계 이름 Long milestone identity" }),
    task("S2", "summary", null, { siblingOrder: 1, membership: { explicitMilestoneTaskId: "M2", effectiveMilestoneTaskId: "M2", inheritedFromTaskId: null } }),
    task("T3", "task", "S2", { progress: 100, status: "completed" }),
    task("T4", "task", "S2", { siblingOrder: 1, membership: { explicitMilestoneTaskId: "M1", effectiveMilestoneTaskId: "M1", inheritedFromTaskId: null } }),
    task("M2", "milestone", null, { siblingOrder: 2, start: "2026-10-12", end: "2026-10-12", progress: 100, status: "completed", name: "동일 이름 아주 긴 단계 이름 Long milestone identity" }),
    task("T5", "task", null, { siblingOrder: 3 }),
    task("M-ONLY", "summary", null, { siblingOrder: 4, start: "2026-11-02", end: "2026-11-02", duration: 1, progress: 0 }),
    task("M3", "milestone", "M-ONLY", { start: "2026-11-02", end: "2026-11-02", scheduleMode: "manual" }),
    task("EMPTY", "summary", null, { siblingOrder: 5, start: null, end: null, requestedStart: null, duration: null, progress: null }),
    task("M4", "milestone", null, { siblingOrder: 6, start: null, end: null, requestedStart: null }),
    task("M5", "milestone", null, { siblingOrder: 7, start: "2026-02-30", end: "2026-02-30" }),
  ];
  const links: ProjectLinkDto[] = [
    { id: "M-LINK", predecessorExternalId: "M1", successorExternalId: "M2", type: "FF", lag: -2 },
    { id: "T-LINK", predecessorExternalId: "T1", successorExternalId: "T3", type: "FS", lag: 1 },
    { id: "LEGACY", predecessorExternalId: "T2", successorExternalId: "M3", type: "SS", lag: 0, legacyMixed: true },
  ];
  const projection = projectStageGates(stageSnapshotFromProject(tasks, links));
  return { tasks: tasks.map((row) => ({ ...row, membership: projection.membership.get(row.taskId)!, ...(row.type === "milestone" ? { stageGate: projection.gates.get(row.taskId)! } : {}) })), links };
}
