import { describe, expect, it } from "vitest";
import { planMembershipCopy, previewMembershipCopy, simulateMembershipCopy } from "../../src/domain/milestones/membership-copy-plan";
import type { StageSnapshot, StageTask } from "../../src/domain/milestones/stage-gates";
import type { ProjectTaskDto } from "../../src/contracts/projects";

const task = (taskId: string, type: StageTask["type"] = "task", parentTaskId: string | null = null): StageTask => ({ taskId, type, parentTaskId, duration: type === "task" ? 2 : type === "milestone" ? 0 : null, progress: 0, status: "not_started" });
function fixture() {
  const snapshot: StageSnapshot = { tasks: [task("S", "summary"), task("N", "summary", "S"), task("T", "task", "N"), task("Empty", "summary", "S"), task("M", "milestone"), task("M2", "milestone"), task("D", "summary")], memberships: [{ taskId: "S", milestoneTaskId: "M" }], links: [] };
  const input = { snapshot, order: snapshot.tasks.map((t, i) => ({ taskId: t.taskId, siblingOrder: i })), taskIds: ["S", "M"], anchorTaskId: "D", placement: "child" as const };
  return { snapshot, input };
}
describe("shared exact membership Copy plan", () => {
  it("normalizes ancestor overlap/canonical roots and preserves internal default inheritance without acknowledgement", () => {
    const { input } = fixture(); input.taskIds = ["T", "M", "S", "N"];
    const plan = planMembershipCopy(input);
    expect(plan.rootTaskIds).toEqual(["S", "M"]);
    expect(plan.copiedTaskIds).toEqual(["S", "N", "T", "Empty", "M"]);
    expect(plan.preservedExplicitMemberships).toEqual([{ taskId: "S", milestoneTaskId: "M" }]);
    expect(plan.requiresAcknowledgement).toBe(false); expect(plan.impacts).toEqual([]);
  });
  it("counts excluded rows separately from inherited descendant impacts and projects destination M", () => {
    const { input, snapshot } = fixture(); input.taskIds = ["S"];
    snapshot.memberships.push({ taskId: "D", milestoneTaskId: "M2" });
    const plan = planMembershipCopy(input);
    expect(plan.excludedExplicitMemberships).toHaveLength(1); expect(plan.impacts).toHaveLength(4);
    expect(plan.impacts.find((row) => row.sourceTaskId === "T")).toMatchObject({ beforeEffectiveMilestoneTaskId: "M", beforeInheritedFromTaskId: "S", afterEffective: { kind: "existing", existingMilestoneTaskId: "M2" }, afterInheritedFrom: { kind: "existing", existingSummaryTaskId: "D" } });
    expect(plan.requiresAcknowledgement).toBe(true);
  });
  it("reports outside inheritance source change even when the effective M is the same", () => {
    const { input, snapshot } = fixture(); input.taskIds = ["T"];
    snapshot.memberships.push({ taskId: "D", milestoneTaskId: "M" });
    const impact = planMembershipCopy(input).impacts[0];
    expect(impact.reasons).toEqual(["EXTERNAL_INHERITANCE_CHANGED"]);
    expect(impact.beforeEffectiveMilestoneTaskId).toBe("M");
    expect(impact.afterEffective).toEqual({ kind: "existing", existingMilestoneTaskId: "M" });
  });
  it("requires review for unassigned→destination inheritance and keeps copied targets distinct", () => {
    const { input, snapshot } = fixture(); snapshot.memberships = [{ taskId: "D", milestoneTaskId: "M2" }]; input.taskIds = ["T"];
    expect(planMembershipCopy(input).impacts[0].reasons).toEqual(["DESTINATION_INHERITANCE_CHANGED"]);
    snapshot.memberships.push({ taskId: "T", milestoneTaskId: "M" }); input.taskIds = ["T", "M"];
    const result = simulateMembershipCopy(input), copy = result.copiedBySource.get("T")!;
    expect(result.snapshot.memberships.find((row) => row.taskId === copy)?.milestoneTaskId).toBe(result.copiedBySource.get("M"));
    expect(result.plan.requiresAcknowledgement).toBe(false);
  });
  it("reports a copied target distinctly when excluding a direct external override", () => {
    const { input, snapshot } = fixture(); snapshot.memberships.push({ taskId: "T", milestoneTaskId: "M2" });
    const plan = planMembershipCopy(input), impact = plan.impacts.find((row) => row.sourceTaskId === "T")!;
    expect(impact.excludedExplicitMilestoneTaskId).toBe("M2");
    expect(impact.afterEffective).toEqual({ kind: "copied", copiedFromMilestoneTaskId: "M" });
    expect(impact.afterInheritedFrom).toEqual({ kind: "copied", copiedFromSummaryTaskId: "S" });
  });
  it("does not materialize outside Summary inheritance when copying a nested Summary", () => {
    const { input } = fixture(); input.taskIds = ["N"];
    const plan = planMembershipCopy(input);
    expect(plan.preservedExplicitMemberships).toEqual([]); expect(plan.excludedExplicitMemberships).toEqual([]);
    expect(plan.impacts).toHaveLength(2); expect(plan.impacts.every((row) => row.afterEffective === null)).toBe(true);
  });
  it("does not attach outside members to a copied incomplete M", () => {
    const { input } = fixture(); input.taskIds = ["M"];
    expect(planMembershipCopy(input)).toMatchObject({ preservedExplicitMemberships: [], excludedExplicitMemberships: [], requiresAcknowledgement: false });
  });
  it.each(["member", "default", "incoming", "outgoing", "mixed"])("rejects completed stage %s boundary loss", (kind) => {
    const { input, snapshot } = fixture(); input.taskIds = ["M"]; snapshot.tasks.find((t) => t.taskId === "M")!.status = "completed";
    if (kind !== "member" && kind !== "default") snapshot.memberships = [];
    if (kind === "default") snapshot.tasks = snapshot.tasks.filter((t) => t.taskId !== "T");
    if (kind === "incoming") snapshot.links.push({ id: "L", predecessorTaskId: "M2", successorTaskId: "M", type: "SS", lag: -1 });
    if (kind === "outgoing") snapshot.links.push({ id: "L", predecessorTaskId: "M", successorTaskId: "M2", type: "FF", lag: 1 });
    if (kind === "mixed") snapshot.links.push({ id: "L", predecessorTaskId: "M", successorTaskId: "T", type: "FS", lag: 0 });
    input.order = snapshot.tasks.map((t, i) => ({ taskId: t.taskId, siblingOrder: i }));
    expect(() => planMembershipCopy(input)).toThrow("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED");
  });
  it("retains internally complete historical inconsistency without resetting source or copies", () => {
    const { input, snapshot } = fixture(); snapshot.tasks.find((t) => t.taskId === "M")!.status = "completed";
    const before = structuredClone(snapshot), result = simulateMembershipCopy(input);
    expect(result.snapshot.tasks.find((t) => t.taskId === result.copiedBySource.get("M"))?.status).toBe("completed");
    expect(snapshot).toEqual(before);
  });
  it("rejects ordinary Task addition but allows inherited-only empty Summary at completed destination", () => {
    const { input, snapshot } = fixture(); snapshot.memberships = [{ taskId: "D", milestoneTaskId: "M2" }]; snapshot.tasks.find((t) => t.taskId === "M2")!.status = "completed";
    input.taskIds = ["T"]; expect(() => planMembershipCopy(input)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    input.taskIds = ["Empty"]; expect(planMembershipCopy(input).requiresAcknowledgement).toBe(true);
  });
  it("models Task child-anchor conversion before detecting its inherited membership effect", () => {
    const { input, snapshot } = fixture(); input.anchorTaskId = "T"; input.taskIds = ["Empty"]; snapshot.tasks.find((t) => t.taskId === "Empty")!.parentTaskId = null;
    const result = simulateMembershipCopy(input);
    expect(result.snapshot.tasks.find((t) => t.taskId === "T")?.type).toBe("summary");
    expect(result.plan.impacts[0].afterEffective).toEqual({ kind: "existing", existingMilestoneTaskId: "M" });
  });
  it.each(["duplicate-source", "missing-source", "missing-anchor", "tie", "dangling-link"])("fails closed for %s", (kind) => {
    const { input, snapshot } = fixture();
    if (kind === "duplicate-source") input.taskIds = ["S", "S"];
    if (kind === "missing-source") input.taskIds = ["unknown"];
    if (kind === "missing-anchor") input.anchorTaskId = "unknown";
    if (kind === "tie") input.order.find((t) => t.taskId === "M")!.siblingOrder = 0;
    if (kind === "dangling-link") snapshot.links.push({ id: "L", predecessorTaskId: "missing", successorTaskId: "T", type: "FS", lag: 0 });
    expect(() => planMembershipCopy(input)).toThrow("INVALID_COPY_MEMBERSHIP_SNAPSHOT");
  });
  it.each([4998, 4999])("checks normalized total budget before creating a candidate at %i existing tasks", (count) => {
    const tasks = [task("Source", "summary"), task("Child", "task", "Source"), task("Destination", "summary"),
      ...Array.from({ length: count - 3 }, (_, i) => task(`Other${i}`))];
    const snapshot: StageSnapshot = { tasks, memberships: [], links: [] };
    const input = { snapshot, order: tasks.map((row, i) => ({ taskId: row.taskId, siblingOrder: i })),
      taskIds: ["Source", "Child"], anchorTaskId: "Destination", placement: "child" as const };
    if (count === 4998) {
      const result = simulateMembershipCopy(input);
      expect(result.plan.rootTaskIds).toEqual(["Source"]); expect(result.plan.copiedTaskIds).toEqual(["Source", "Child"]);
      expect(result.snapshot.tasks).toHaveLength(5000);
    } else {
      expect(() => simulateMembershipCopy(input)).toThrow("TASK_COPY_TASK_LIMIT_EXCEEDED");
      expect(snapshot.tasks).toHaveLength(4999);
    }
  });
  it("refuses absent canonical membership projection in browser input", () => {
    const tasks = [{ taskId: "T" }] as ProjectTaskDto[];
    expect(() => previewMembershipCopy(tasks, [], { kind: "copy", taskId: "T", anchorTaskId: "T", placement: "after" })).toThrow("INVALID_COPY_MEMBERSHIP_SNAPSHOT");
    tasks[0].membership = {} as NonNullable<ProjectTaskDto["membership"]>;
    expect(() => previewMembershipCopy(tasks, [], { kind: "copy", taskId: "T", anchorTaskId: "T", placement: "after" })).toThrow("INVALID_COPY_MEMBERSHIP_SNAPSHOT");
  });
});
