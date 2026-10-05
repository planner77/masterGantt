import { describe, expect, it } from "vitest";
import { assertMilestoneCompletionTransitions, assertStageStructureChange, projectStageGates, type StageSnapshot, type StageTask } from "../../src/domain/milestones/stage-gates";
import { previewMilestoneMemberships, stageSnapshotFromProject } from "../../src/domain/milestones/project-stage-model";

const task = (taskId: string, type: StageTask["type"] = "task", parentTaskId: string | null = null, duration = 1, progress = 0): StageTask => ({ taskId, type, parentTaskId, duration: type === "summary" ? null : type === "milestone" ? 0 : duration, progress: type === "summary" ? null : progress, status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started" });
function fixture(): StageSnapshot {
  return { tasks: [task("S", "summary"), task("S2", "summary", "S"), task("T", "task", "S2"), task("T2", "task", "S", 9), task("EMPTY", "summary"), task("M1", "milestone"), task("M2", "milestone"), task("M3", "milestone", "S")], memberships: [{ taskId: "S", milestoneTaskId: "M1" }, { taskId: "S2", milestoneTaskId: "M2" }, { taskId: "T", milestoneTaskId: "M3" }], links: [] };
}
describe("stage membership and gates", () => {
  it("resolves direct/nested override/clear/empty Summary and excludes child Milestones", () => {
    const s = fixture();
    let result = projectStageGates(s);
    expect(result.membership.get("T")).toEqual({ explicitMilestoneTaskId: "M3", effectiveMilestoneTaskId: "M3", inheritedFromTaskId: null });
    expect(result.membership.get("T2")).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: "M1", inheritedFromTaskId: "S" });
    expect(result.membership.get("M3")?.effectiveMilestoneTaskId).toBeNull();
    s.memberships = s.memberships.filter((row) => row.taskId !== "T");
    expect(projectStageGates(s).membership.get("T")?.inheritedFromTaskId).toBe("S2");
    s.memberships = s.memberships.filter((row) => row.taskId !== "S2");
    s.memberships.push({ taskId: "EMPTY", milestoneTaskId: "M2" });
    result = projectStageGates(s);
    expect(result.membership.get("T")?.effectiveMilestoneTaskId).toBe("M1");
    expect(result.gates.get("M2")).toMatchObject({ memberCount: 0, memberProgressPercent: null, ready: null, manualEvent: true });
    expect(projectStageGates({ ...s, tasks: [...s.tasks].reverse() }).membership).toEqual(result.membership);
  });
  it("uses duration weights and canonical status rather than rounded display progress", () => {
    const s = fixture(); s.memberships = [{ taskId: "S", milestoneTaskId: "M1" }];
    s.tasks.find((t) => t.taskId === "T")!.progress = 100;
    s.tasks.find((t) => t.taskId === "T")!.status = "completed";
    expect(projectStageGates(s).gates.get("M1")).toMatchObject({ memberCount: 2, completedMemberCount: 1, memberProgressPercent: 10, ready: false });
    const t2 = s.tasks.find((t) => t.taskId === "T2")!; t2.progress = 99.999;
    expect(Math.round(projectStageGates(s).gates.get("M1")!.memberProgressPercent!)).toBe(100);
    expect(projectStageGates(s).gates.get("M1")?.ready).toBe(false);
  });
  it("distinguishes member completion, Ready, explicit Completed, predecessor blockers and manual events", () => {
    const s = fixture(); s.memberships = [{ taskId: "T", milestoneTaskId: "M2" }];
    const t = s.tasks.find((t) => t.taskId === "T")!; t.status = "completed"; t.progress = 100;
    s.links = [{ id: "L", predecessorTaskId: "M1", successorTaskId: "M2", type: "FF", lag: -2 }, { id: "TL", predecessorTaskId: "T2", successorTaskId: "M2", type: "FS", lag: 0 }];
    expect(projectStageGates(s).gates.get("M2")).toMatchObject({ membersCompleted: true, ready: false, blocked: true, predecessorMilestoneTaskIds: ["M1"] });
    const after = structuredClone(s); after.tasks.find((t) => t.taskId === "M2")!.status = "completed";
    expect(() => assertMilestoneCompletionTransitions(s, after)).toThrow("MILESTONE_NOT_READY");
    s.tasks.find((t) => t.taskId === "M1")!.status = "completed";
    expect(projectStageGates(s).gates.get("M2")?.ready).toBe(true);
    after.tasks.find((t) => t.taskId === "M1")!.status = "completed";
    expect(() => assertMilestoneCompletionTransitions(s, after)).not.toThrow();
    after.tasks.find((t) => t.taskId === "T")!.status = "not_started";
    expect(projectStageGates(after).gates.get("M2")?.completionInconsistent).toBe(true);
    expect(() => assertMilestoneCompletionTransitions(after, structuredClone(after))).not.toThrow();
  });
  it("requires every direct Milestone predecessor, independently of type/lag and empty member events", () => {
    const s = fixture(); s.memberships = [];
    s.links = [{ id: "L1", predecessorTaskId: "M1", successorTaskId: "M3", type: "SS", lag: 10 }, { id: "L2", predecessorTaskId: "M2", successorTaskId: "M3", type: "SF", lag: -10 }];
    expect(projectStageGates(s).gates.get("M3")).toMatchObject({ memberCount: 0, ready: null, memberProgressPercent: null, blocked: true, incompletePredecessorMilestoneTaskIds: ["M1", "M2"] });
    s.tasks.find((task) => task.taskId === "M1")!.status = "completed";
    const after = structuredClone(s); after.tasks.find((task) => task.taskId === "M3")!.status = "completed";
    expect(() => assertMilestoneCompletionTransitions(s, after)).toThrow("MILESTONE_NOT_READY");
    after.tasks.find((task) => task.taskId === "M2")!.status = "completed";
    expect(() => assertMilestoneCompletionTransitions(s, after)).not.toThrow();
  });

  it("locks explicit changes even when effective set stays the same and an empty Summary", () => {
    const s = fixture(); s.memberships = [{ taskId: "S", milestoneTaskId: "M1" }];
    s.tasks.find((t) => t.taskId === "M1")!.status = "completed";
    const sameEffective = structuredClone(s); sameEffective.memberships.push({ taskId: "T", milestoneTaskId: "M1" });
    expect(() => assertStageStructureChange(s, sameEffective)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    const empty = structuredClone(s); empty.memberships.push({ taskId: "EMPTY", milestoneTaskId: "M1" });
    expect(() => assertStageStructureChange(s, empty)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    const progress = structuredClone(s); progress.tasks.find((t) => t.taskId === "T")!.progress = 50;
    expect(() => assertStageStructureChange(s, progress)).not.toThrow();
  });
  it.each(["cycle", "missing", "duplicate", "wrong-source", "wrong-target", "duplicate-source"])("rejects malformed %s even with a direct assignment", (kind) => {
    const s = fixture();
    if (kind === "cycle") s.tasks.find((t) => t.taskId === "S")!.parentTaskId = "S";
    if (kind === "missing") s.tasks.find((t) => t.taskId === "S")!.parentTaskId = "missing";
    if (kind === "duplicate") s.tasks.push({ ...s.tasks[0] });
    if (kind === "wrong-source") s.memberships.push({ taskId: "M1", milestoneTaskId: "M2" });
    if (kind === "wrong-target") s.memberships.push({ taskId: "EMPTY", milestoneTaskId: "T" });
    if (kind === "duplicate-source") s.memberships.push({ taskId: "S", milestoneTaskId: "M2" });
    expect(() => projectStageGates(s)).toThrow();
  });
  it("provides the same browser-safe preview from canonical DTOs without inherited row expansion", () => {
    const tasks = [{ taskId: "S", externalId: "S", type: "summary" as const, parentExternalId: null, membership: { explicitMilestoneTaskId: "M", effectiveMilestoneTaskId: "M", inheritedFromTaskId: null }, name: "S", scheduleMode: "auto" as const, requestedStart: null, start: null, end: null, duration: null, progress: null, siblingOrder: 0 }, { taskId: "M", externalId: "M", type: "milestone" as const, parentExternalId: null, name: "M", scheduleMode: "auto" as const, requestedStart: "2026-10-05", start: "2026-10-05", end: "2026-10-05", duration: 0, progress: 0, siblingOrder: 1 }];
    expect(stageSnapshotFromProject(tasks, []).memberships).toEqual([{ taskId: "S", milestoneTaskId: "M" }]);
    expect(previewMilestoneMemberships(tasks, [], { changes: [{ taskId: "S", milestoneTaskId: null }] }).after.membership.get("S")?.effectiveMilestoneTaskId).toBeNull();
  });
});
