import { describe, expect, it } from "vitest";
import type { ProjectLinkDto, ProjectTaskDto } from "../../src/contracts/projects";
import {
  matchesMembershipSearch,
  membershipChanges,
  membershipDescription,
  membershipImpact,
  membershipProjection,
} from "../../src/features/gantt/milestone-membership-model";
import {
  createTaskEditorDraft,
  prepareTaskEditorCommand,
  taskEditorIsDirty,
  taskEditorReadOnlyReason,
  updateTaskEditorDraft,
} from "../../src/features/gantt/task-editor-model";
import { taskEditorTabForKey, taskEditorTabs } from "../../src/features/gantt/task-editor-view-model";
import { StageGateError } from "../../src/domain/milestones/stage-gates";

function row(id: number, type: ProjectTaskDto["type"], parentExternalId: string | null = null, target: string | null = null): ProjectTaskDto {
  return {
    taskId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    externalId: `EXT-${id}`, name: `작업 ${id}`, type, parentExternalId, siblingOrder: id,
    scheduleMode: "auto", requestedStart: "2026-10-06", start: "2026-10-06", end: "2026-10-06",
    duration: type === "milestone" ? 0 : type === "summary" ? null : 1,
    progress: type === "summary" ? null : 0, status: "not_started",
    membership: { explicitMilestoneTaskId: target, effectiveMilestoneTaskId: null, inheritedFromTaskId: null },
  };
}

const first = row(1, "milestone"), second = row(2, "milestone"), third = row(3, "milestone");
const root = row(10, "summary", null, first.taskId);
const nested = row(11, "summary", root.externalId, second.taskId);
const deeper = row(12, "summary", nested.externalId);
const inherited = row(20, "task", root.externalId);
const nearest = row(21, "task", deeper.externalId);
const override = row(22, "task", deeper.externalId, third.taskId);
const empty = row(30, "summary", null, first.taskId);
const free = row(31, "task");

function fixture(extra: readonly ProjectTaskDto[] = []): ProjectTaskDto[] {
  const tasks = [first, second, third, root, nested, deeper, inherited, nearest, override, empty, free, ...extra];
  const projection = membershipProjection(tasks, []);
  return tasks.map((task) => ({ ...task, membership: projection.membership.get(task.taskId), stageGate: projection.gates.get(task.taskId) }));
}

function expectLock(action: () => unknown, milestoneId: string) {
  try {
    action();
    expect.fail("완료된 단계의 구조 변경이 허용되었습니다.");
  } catch (error) {
    expect(error).toBeInstanceOf(StageGateError);
    expect(error).toMatchObject({ code: "COMPLETED_MILESTONE_STRUCTURE_LOCKED", taskIds: expect.arrayContaining([milestoneId]) });
  }
}

describe("Issue #461 membership search and canonical inheritance", () => {
  it("resolves trimmed casefold names, external IDs and a pasted canonical UUID", () => {
    const a = { ...first, name: "Release READY", externalId: "Gate-Alpha" };
    const b = { ...second, name: "Release READY", externalId: "Gate-Beta" };
    for (const query of [" release ready ", "RELEASE READY"]) {
      expect([a, b].filter((task) => matchesMembershipSearch(task, query)).map((task) => task.taskId)).toEqual([a.taskId, b.taskId]);
    }
    expect([a, b].filter((task) => matchesMembershipSearch(task, "  GATE-BETA  "))).toEqual([b]);
    expect([a, b].filter((task) => matchesMembershipSearch(task, ` ${a.taskId.toUpperCase()} `))).toEqual([a]);
    expect(matchesMembershipSearch(a, "missing")).toBe(false);
    expect(matchesMembershipSearch(a, "   ")).toBe(true);
  });

  it("uses the nearest Summary default and preserves a deeper direct override", () => {
    const projection = membershipProjection(fixture(), []);
    expect(projection.membership.get(inherited.taskId)).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: first.taskId, inheritedFromTaskId: root.taskId });
    expect(projection.membership.get(nearest.taskId)).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: second.taskId, inheritedFromTaskId: nested.taskId });
    expect(projection.membership.get(override.taskId)).toEqual({ explicitMilestoneTaskId: third.taskId, effectiveMilestoneTaskId: third.taskId, inheritedFromTaskId: null });
    expect(projection.membership.get(free.taskId)?.effectiveMilestoneTaskId).toBeNull();
  });

  it("counts only unique ordinary Tasks, excluding empty Summaries and Milestones", () => {
    const milestoneChild = row(32, "milestone", root.externalId);
    const projection = membershipProjection(fixture([milestoneChild]), []);
    expect(projection.gates.get(first.taskId)?.memberTaskIds).toEqual([inherited.taskId]);
    expect(projection.gates.get(first.taskId)?.memberCount).toBe(1);
    expect(projection.membership.get(milestoneChild.taskId)?.effectiveMilestoneTaskId).toBeNull();
    expect(projection.gates.get(milestoneChild.taskId)).toMatchObject({ memberCount: 0, manualEvent: true, ready: null, memberProgressPercent: null });
  });

  it("calculates full-project effects even when the ancestor is absent from visible search rows", () => {
    const tasks = fixture();
    const visible = tasks.filter((task) => matchesMembershipSearch(task, nearest.taskId));
    expect(visible.map((task) => task.taskId)).toEqual([nearest.taskId]);
    const projection = membershipProjection(tasks, [], [{ taskId: nested.taskId, milestoneTaskId: first.taskId }]);
    expect(projection.membership.get(visible[0].taskId)).toMatchObject({ effectiveMilestoneTaskId: first.taskId, inheritedFromTaskId: nested.taskId });
    expect(projection.membership.get(override.taskId)?.effectiveMilestoneTaskId).toBe(third.taskId);
  });

  it("describes clear as inheritance restoration rather than unassigned", () => {
    const tasks = fixture();
    const projection = membershipProjection(tasks, [], [{ taskId: override.taskId, milestoneTaskId: null }]);
    expect(projection.membership.get(override.taskId)).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: second.taskId, inheritedFromTaskId: nested.taskId });
    expect(membershipDescription(override, tasks, projection.membership.get(override.taskId))).toBe(`${second.name} · ${nested.name}에서 상속`);
    expect(membershipDescription(free, tasks)).toBe("미지정");
    expect(membershipDescription(tasks.find((task) => task.taskId === root.taskId)!, tasks)).toBe(`${first.name} · 직접 지정`);
  });
});

describe("Issue #461 explicit-only batch drafts and completed lock", () => {
  it("sends one Summary default change without expanding inherited children into direct rows", () => {
    const tasks = fixture();
    const changes = membershipChanges(tasks, { [root.taskId]: second.taskId });
    expect(changes).toEqual([{ taskId: root.taskId, milestoneTaskId: second.taskId }]);
    const projection = membershipProjection(tasks, [], changes);
    expect(projection.membership.get(inherited.taskId)).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: second.taskId });
    expect(projection.membership.get(override.taskId)?.explicitMilestoneTaskId).toBe(third.taskId);
    expect(membershipImpact(tasks, [], changes)).toBe(1);
  });

  it("does not pretend that clearing an inherited row deletes an explicit assignment", () => {
    const tasks = fixture();
    expect(membershipChanges(tasks, { [inherited.taskId]: null, [root.taskId]: first.taskId })).toEqual([]);
    expect(membershipImpact(tasks, [], [])).toBe(0);
    expect(membershipProjection(tasks, []).membership.get(inherited.taskId)?.effectiveMilestoneTaskId).toBe(first.taskId);
  });

  it("deduplicates effective impact when a Summary and one descendant move together", () => {
    const tasks = fixture();
    const changes = membershipChanges(tasks, { [nested.taskId]: first.taskId, [nearest.taskId]: first.taskId });
    expect(changes).toHaveLength(2);
    expect(membershipImpact(tasks, [], changes)).toBe(1);
    expect(membershipProjection(tasks, [], changes).membership.get(override.taskId)?.effectiveMilestoneTaskId).toBe(third.taskId);
  });

  it("reads a completed target and diagnostic information without a mutation", () => {
    const tasks = fixture().map((task) => task.taskId === first.taskId ? { ...task, status: "completed" as const, progress: 100 } : task);
    expect(membershipProjection(tasks, []).gates.get(first.taskId)).toMatchObject({ memberCount: 1, completionInconsistent: true, ready: false });
    expect(membershipDescription(tasks.find((task) => task.taskId === inherited.taskId)!, tasks)).toContain("에서 상속");
    expect(taskEditorReadOnlyReason(inherited, false, false)).toContain("편집 권한");
    expect(membershipProjection(tasks, []).membership.get(inherited.taskId)?.effectiveMilestoneTaskId).toBe(first.taskId);
  });

  it.each(["assign", "clear", "move", "inherited override", "empty Summary clear"])("rejects completed target structure change: %s", (operation) => {
    const tasks = fixture().map((task) => task.taskId === first.taskId ? { ...task, status: "completed" as const, progress: 100 } : task);
    const change = operation === "assign" ? { taskId: free.taskId, milestoneTaskId: first.taskId }
      : operation === "clear" ? { taskId: root.taskId, milestoneTaskId: null }
      : operation === "move" ? { taskId: root.taskId, milestoneTaskId: second.taskId }
      : operation === "inherited override" ? { taskId: inherited.taskId, milestoneTaskId: second.taskId }
      : { taskId: empty.taskId, milestoneTaskId: null };
    expectLock(() => membershipProjection(tasks, [], [change]), first.taskId);
    expect(membershipChanges(tasks, { [change.taskId]: change.milestoneTaskId })).toEqual([change]);
  });

  it("rejects Milestone candidates and invalid targets through the shared preview helper", () => {
    expect(() => membershipProjection(fixture(), [], [{ taskId: first.taskId, milestoneTaskId: second.taskId }])).toThrow("INVALID_MILESTONE_MEMBERSHIP");
    expect(() => membershipProjection(fixture(), [], [{ taskId: free.taskId, milestoneTaskId: root.taskId }])).toThrow("INVALID_MILESTONE_MEMBERSHIP");
  });

  it("keeps predecessor readiness separate from 100% member progress", () => {
    const tasks = fixture().map((task) => task.taskId === inherited.taskId ? { ...task, status: "completed" as const, progress: 100 } : task);
    const links: ProjectLinkDto[] = [{ id: "stage-dependency", predecessorExternalId: second.externalId, successorExternalId: first.externalId, type: "FS", lag: 0 }];
    expect(membershipProjection(tasks, links).gates.get(first.taskId)).toMatchObject({ memberProgressPercent: 100, membersCompleted: true, predecessorsCompleted: false, ready: false, incompletePredecessorMilestoneTaskIds: [second.taskId] });
    expect(tasks.find((task) => task.taskId === first.taskId)?.status).toBe("not_started");
  });
});

describe("Issue #461 basic editor atomic payload boundary", () => {
  it("combines Summary editable metadata and Membership while omitting readonly schedule fields", () => {
    const summary = fixture().find((task) => task.taskId === root.taskId)!;
    const draft = { ...createTaskEditorDraft(summary), name: "  새 기본 단계  ", explicitMilestoneTaskId: second.taskId, start: "invalid", requestedEnd: "invalid", duration: "99", progress: "100", status: "completed" as const, scheduleMode: "manual" as const, description: "요약 설명", url: "https://example.test/summary", baselineStart: "invalid", baselineDuration: "99", baselineEnd: "invalid" };
    expect(prepareTaskEditorCommand(summary, draft)).toEqual({ command: { taskId: root.taskId, payload: { name: "새 기본 단계", description: "요약 설명", url: "https://example.test/summary", explicitMilestoneTaskId: second.taskId } }, error: null });
  });

  it("combines Task name/status/progress and Membership in one command", () => {
    const task = fixture().find((item) => item.taskId === inherited.taskId)!;
    const draft = { ...updateTaskEditorDraft(createTaskEditorDraft(task), "progress", "60"), name: "Task moved", explicitMilestoneTaskId: third.taskId };
    expect(prepareTaskEditorCommand(task, draft).command).toEqual({ taskId: task.taskId, payload: { name: "Task moved", progress: 60, status: "in_progress", explicitMilestoneTaskId: third.taskId } });
    expect(taskEditorIsDirty(task, draft)).toBe(true);
  });

  it("omits unchanged explicit membership, preserves null clear and never copies effective inheritance into a draft", () => {
    const tasks = fixture();
    const task = tasks.find((item) => item.taskId === nearest.taskId)!;
    const draft = createTaskEditorDraft(task);
    expect(draft.explicitMilestoneTaskId).toBeNull();
    expect(taskEditorIsDirty(task, draft)).toBe(false);
    expect(prepareTaskEditorCommand(task, { ...draft, name: "Renamed" }).command?.payload).toEqual({ name: "Renamed" });
    const assigned = tasks.find((item) => item.taskId === override.taskId)!;
    const clear = updateTaskEditorDraft(createTaskEditorDraft(assigned), "explicitMilestoneTaskId", null);
    expect(prepareTaskEditorCommand(assigned, clear).command?.payload).toEqual({ explicitMilestoneTaskId: null });
    expect(taskEditorIsDirty(assigned, clear)).toBe(true);
  });
});

describe("Issue #461 exposed editor tab keyboard order", () => {
  it.each(["task", "summary", "milestone"])("cycles only the actual %s tab list and supports Home/End", (type) => {
    const tabs = taskEditorTabs(type);
    expect(tabs).toEqual(type === "milestone" ? ["task", "memberships", "resources", "relations", "logistics"] : ["task", "resources", "relations", "logistics"]);
    for (let index = 0; index < tabs.length; index++) {
      expect(taskEditorTabForKey(tabs[index], "ArrowRight", tabs)).toBe(tabs[(index + 1) % tabs.length]);
      expect(taskEditorTabForKey(tabs[index], "ArrowLeft", tabs)).toBe(tabs[(index - 1 + tabs.length) % tabs.length]);
      expect(taskEditorTabForKey(tabs[index], "Home", tabs)).toBe("task");
      expect(taskEditorTabForKey(tabs[index], "End", tabs)).toBe("logistics");
      expect(taskEditorTabForKey(tabs[index], "Tab", tabs)).toBeNull();
    }
  });
});
