import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { TaskHierarchyService, TaskCopyAssignmentUnsupportedError } from "../../../src/server/projects/task-hierarchy-service-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { handleTaskHierarchyCommand } from "../../../src/server/projects/task-hierarchy-handlers-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { EditSessionInvalidError, RevisionMismatchError, PersistedScheduleInvalidError, recalculatePersistedHierarchy } from "../../../src/server/projects/project-service-core";
import { resolveProjectWorkingCalendar } from "../../../src/server/calendars/calendar-resolution-core";
import type { ProjectTaskDto, TaskHierarchyCommandRequest } from "../../../src/contracts/projects";

const clock = () => new Date("2026-10-05T01:00:00.000Z");
const hashPassword = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const connections: ReturnType<typeof openDatabase>["database"][] = [];
afterEach(() => connections.splice(0).forEach((db) => db.close()));
async function fixture() {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database; connections.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword });
  const created = await projects.create({ name: "Copy stages", description: "", ownerName: "owner", editPassword: "test" });
  const publicId = created.response.data.project.publicId, token = created.rawSessionToken;
  const authorized = projects.authorize(publicId, token); if (authorized.kind !== "authorized") throw new Error("auth");
  const authorization = authorized.authorization, hierarchy = new TaskHierarchyService(db, { clock }), links = new LinkService(db, clock);
  const snapshot = () => projects.getReadonlySnapshot(publicId)!, revision = () => snapshot().data.project.revision;
  const add = (name: string, type: ProjectTaskDto["type"] = "task", parent?: ProjectTaskDto, progress = 0) => {
    const response = projects.createTask(authorization, revision(), type === "summary"
      ? { name, externalId: name, type, parentTaskId: parent?.taskId }
      : { name, externalId: name, type, parentTaskId: parent?.taskId, start: "2026-10-06", duration: type === "milestone" ? 0 : 2, progress });
    return response.data.tasks.find((task) => task.externalId === name)!;
  };
  const patch = (task: ProjectTaskDto, input: Parameters<typeof projects.updateTask>[3]) => projects.updateTask(authorization, revision(), task.taskId, input);
  const assign = (task: ProjectTaskDto, milestone: ProjectTaskDto | null) => patch(task, { explicitMilestoneTaskId: milestone?.taskId ?? null });
  const state = () => ({ tasks: db.prepare("SELECT * FROM tasks WHERE project_id=? ORDER BY id").all(authorization.projectId), links: db.prepare("SELECT * FROM links WHERE project_id=? ORDER BY id").all(authorization.projectId), members: db.prepare("SELECT * FROM task_milestone_memberships WHERE project_id=? ORDER BY member_task_id").all(authorization.projectId), assignments: db.prepare("SELECT * FROM task_assignments WHERE project_id=? ORDER BY id").all(authorization.projectId), revision: revision() });
  const copy = (ids: readonly string[], anchor: ProjectTaskDto, acknowledgedMembershipExclusions?: boolean) => hierarchy.execute(authorization, revision(), { kind: "copy", taskIds: ids, anchorTaskId: anchor.taskId, placement: "child", ...(acknowledgedMembershipExclusions !== undefined ? { acknowledgedMembershipExclusions } : {}) });
  const root = add("Source", "summary"), nested = add("Nested", "summary", root), leaf = add("Leaf", "task", nested), empty = add("Empty", "summary", root);
  const m = add("M", "milestone"), m2 = add("M2", "milestone"), target = add("Target", "summary"); assign(root, m);
  return { db, projects, publicId, token, authorization, hierarchy, links, snapshot, revision, add, patch, assign, state, copy, root, nested, leaf, empty, m, m2, target };
}
function copiedTasks(before: { data: { tasks: ProjectTaskDto[] } }, after: { data: { tasks: ProjectTaskDto[] } }) {
  const ids = new Set(before.data.tasks.map((task) => task.taskId)); return after.data.tasks.filter((task) => !ids.has(task.taskId));
}
describe("Milestone membership server-owned preservation", () => {
  it("rejects a persisted Summary Dependency endpoint without leaving a partial Copy", async () => {
    const f = await fixture(), revision = f.revision(), repo = new ScheduleRepository(f.db), parent = repo.findTaskByPublicId(f.authorization.projectId, f.root.taskId)!, leaf = repo.findTaskByPublicId(f.authorization.projectId, f.leaf.taskId)!;
    repo.insertLink({ projectId: f.authorization.projectId, publicId: randomUUID(), predecessorTaskId: parent.id, successorTaskId: leaf.id, type: "FS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    const rows = () => ({ tasks: repo.listTasks(f.authorization.projectId), links: repo.listLinks(f.authorization.projectId), projects: f.db.prepare("SELECT * FROM projects ORDER BY id").all(), memberships: f.db.prepare("SELECT * FROM task_milestone_memberships ORDER BY project_id,member_task_id").all() });
    const before = rows();
    await expect(new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.authorization, revision, { name: "Invalid copy", description: "", editPassword: "test" })).rejects.toThrow(PersistedScheduleInvalidError);
    expect(rows()).toEqual(before);
  });
  it.each([false, true])("whole Copy validates dependency-adjusted effective dates with all source Links (reset=%s)", async (resetProgress) => {
    const f = await fixture(), predecessor = f.add("DAG-P");
    f.patch(predecessor, { duration: 1 });
    f.patch(f.leaf, { progress: 50, baseline: { start: "2026-10-06", duration: 3 } });
    f.links.create(f.authorization, f.revision(), { predecessorExternalId: "DAG-P", successorExternalId: "Leaf", type: "FS", lag: 1 });
    f.links.create(f.authorization, f.revision(), { predecessorExternalId: "M", successorExternalId: "M2", type: "FS", lag: 0 });
    const before = f.snapshot(), state = f.state(), leaf = before.data.tasks.find((task) => task.taskId === f.leaf.taskId)!;
    expect(leaf).toMatchObject({ requestedStart: "2026-10-06", start: "2026-10-08", end: "2026-10-12", progress: 50, status: "in_progress" });
    const repo = new ScheduleRepository(f.db), tasks = repo.listTasks(f.authorization.projectId), links = repo.listLinks(f.authorization.projectId), calendar = resolveProjectWorkingCalendar(f.db, f.authorization.projectId);
    expect(() => recalculatePersistedHierarchy(tasks, calendar, links)).not.toThrow();
    expect(() => recalculatePersistedHierarchy(tasks, calendar)).toThrow(PersistedScheduleInvalidError);
    const result = await new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.authorization, f.revision(), { name: "Dependency copy", description: "", editPassword: "test", resetProgress });
    const rows = new Map(result.response.data.tasks.map((task) => [task.externalId, task]));
    expect(rows.get("Leaf")).toMatchObject({ requestedStart: leaf.requestedStart, start: leaf.start, end: leaf.end, duration: leaf.duration, status: resetProgress ? "not_started" : leaf.status, progress: resetProgress ? 0 : leaf.progress, baselineStart: leaf.baselineStart, baselineEnd: leaf.baselineEnd, baselineDuration: leaf.baselineDuration, membership: { effectiveMilestoneTaskId: rows.get("M")!.taskId, inheritedFromTaskId: rows.get("Source")!.taskId } });
    expect(result.response.data.links.map(({ predecessorExternalId, successorExternalId, type, lag }) => ({ predecessorExternalId, successorExternalId, type, lag }))).toEqual(before.data.links.map(({ predecessorExternalId, successorExternalId, type, lag }) => ({ predecessorExternalId, successorExternalId, type, lag })));
    expect(rows.get("M2")?.start).toBe(before.data.tasks.find((task) => task.taskId === f.m2.taskId)?.start);
    expect(result.response.data.project.revision).toBe(1);
    expect(f.state()).toEqual(state); expect(f.snapshot()).toEqual(before); expect(f.db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it.each([false, true])("whole Project copy remaps all FKs, preserves source and honors reset=%s", async (resetProgress) => {
    const f = await fixture(); const other = f.add("Override", "task", f.nested); f.assign(other, f.m2);
    f.patch(f.leaf, { progress: 100 }); f.patch(f.m, { status: "completed" }); f.patch(f.leaf, { progress: 25 });
    const before = f.state();
    const result = await new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.authorization, f.revision(), { name: "Copy", description: "", editPassword: "test", resetProgress });
    const rows = new Map(result.response.data.tasks.map((task) => [task.externalId, task]));
    expect(rows.get("Source")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M")?.taskId);
    expect(rows.get("Leaf")?.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: rows.get("M")!.taskId, inheritedFromTaskId: rows.get("Source")!.taskId });
    expect(rows.get("Override")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M2")?.taskId);
    expect(rows.get("M")?.status).toBe(resetProgress ? "not_started" : "completed");
    expect(rows.get("M")?.stageGate?.completionInconsistent).toBe(!resetProgress);
    expect(result.response.data.project.revision).toBe(1); expect(f.state()).toEqual(before);
    expect(result.response.data.tasks.every((task) => !f.snapshot().data.tasks.some((source) => source.taskId === task.taskId))).toBe(true);
  });
  it("whole Project copy retains legacy mixed links and historical diagnosis", async () => {
    const f = await fixture(), repo = new ScheduleRepository(f.db), leaf = repo.findTaskByPublicId(f.authorization.projectId, f.leaf.taskId)!, m = repo.findTaskByPublicId(f.authorization.projectId, f.m.taskId)!;
    repo.insertLink({ publicId: randomUUID(), projectId: f.authorization.projectId, predecessorTaskId: leaf.id, successorTaskId: m.id, type: "SS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    const before = f.state(); const copied = await new ProjectCopyService(f.db, { clock, hashPassword }).copy(f.authorization, f.revision(), { name: "Copy", description: "", editPassword: "test" });
    expect(copied.response.data.links).toHaveLength(1); expect(copied.response.data.links[0]).toMatchObject({ predecessorExternalId: "Leaf", successorExternalId: "M", legacyMixed: true, type: "SS", lag: 0 }); expect(f.state()).toEqual(before);
  });
  it("whole Copy rechecks stale/revoked session and rolls back all inserted Project rows on membership write failure", async () => {
    const f = await fixture(), service = new ProjectCopyService(f.db, { clock, hashPassword });
    const count = f.db.prepare("SELECT count(*) FROM projects").pluck().get(), before = f.state();
    await expect(service.copy(f.authorization, 1, { name: "C", description: "", editPassword: "test" })).rejects.toThrow(RevisionMismatchError);
    f.db.exec("CREATE TRIGGER reject_copy_membership BEFORE INSERT ON task_milestone_memberships BEGIN SELECT RAISE(ABORT,'forced-copy-membership'); END;");
    await expect(service.copy(f.authorization, f.revision(), { name: "C", description: "", editPassword: "test" })).rejects.toThrow("forced-copy-membership");
    expect(f.db.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(count); expect(f.state()).toEqual(before);
    f.db.prepare("UPDATE edit_sessions SET revoked_at=?").run(clock().toISOString());
    await expect(service.copy(f.authorization, f.revision(), { name: "C", description: "", editPassword: "test" })).rejects.toThrow(EditSessionInvalidError);
  });
  it("multi-root union remaps internal default/override and all internal M dependencies once", async () => {
    const f = await fixture(); f.assign(f.leaf, f.m2); f.links.create(f.authorization, f.revision(), { predecessorExternalId: "M", successorExternalId: "M2", type: "FF", lag: -1 });
    const before = f.snapshot(), result = f.copy([f.leaf.taskId, f.m2.taskId, f.root.taskId, f.m.taskId], f.target);
    const rows = new Map(copiedTasks(before, result).map((task) => [task.name, task])); expect(rows.size).toBe(6);
    expect(rows.get("Source")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M")?.taskId);
    expect(rows.get("Leaf")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M2")?.taskId);
    expect(result.data.links).toHaveLength(2); expect(f.state().members).toHaveLength(4);
    expect(result.data.project.revision).toBe(before.data.project.revision + 1);
  });
  it.each([undefined, false])("requires acknowledgement for exact external exclusions (%s) before writes", async (ack) => {
    const f = await fixture(), before = f.state();
    expect(() => f.copy([f.root.taskId], f.target, ack)).toThrow("TASK_COPY_MEMBERSHIP_REVIEW_REQUIRED"); expect(f.state()).toEqual(before);
  });
  it("acknowledged external default exclusion projects destination inheritance without flattening", async () => {
    const f = await fixture(); f.assign(f.target, f.m2); const before = f.snapshot(), sourceBefore = f.state();
    const result = f.copy([f.root.taskId], f.target, true), copies = copiedTasks(before, result), root = copies.find((task) => task.name === "Source")!;
    expect(copies.find((task) => task.name === "Leaf")?.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: f.m2.taskId, inheritedFromTaskId: f.target.taskId });
    expect(root.membership?.explicitMilestoneTaskId).toBeNull(); expect(f.state().members).toEqual(sourceBefore.members);
    expect(f.db.prepare("SELECT * FROM tasks WHERE public_id=?").get(f.leaf.taskId)).toEqual((sourceBefore.tasks as {public_id:string}[]).find((task) => task.public_id === f.leaf.taskId));
  });
  it("outside inheritance alone and unassigned→new destination both require review", async () => {
    const f = await fixture(), before = f.state(); expect(() => f.copy([f.nested.taskId], f.target)).toThrow("TASK_COPY_MEMBERSHIP_REVIEW_REQUIRED"); expect(f.state()).toEqual(before);
    f.copy([f.nested.taskId], f.target, true); f.assign(f.target, f.m2); const free = f.add("Free"); const next = f.state();
    expect(() => f.copy([free.taskId], f.target)).toThrow("TASK_COPY_MEMBERSHIP_REVIEW_REQUIRED"); expect(f.state()).toEqual(next);
    const response = f.copy([free.taskId], f.target, true); expect(response.data.tasks.filter((task) => task.name === "Free").at(-1)?.membership?.effectiveMilestoneTaskId).toBe(f.m2.taskId);
  });
  it("copying only an incomplete M does not clone its outside members", async () => {
    const f = await fixture(), before = f.snapshot(), result = f.copy([f.m.taskId], f.target);
    expect(copiedTasks(before, result)[0].stageGate?.memberCount).toBe(0);
  });
  it("complete internal stage preserves historical completed diagnosis; partial E/default cannot bypass by ack", async () => {
    const f = await fixture(); f.patch(f.leaf, { progress: 100 }); f.patch(f.m, { status: "completed" }); f.patch(f.leaf, { progress: 50 });
    const before = f.state(); expect(() => f.copy([f.m.taskId], f.target, true)).toThrow("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED"); expect(f.state()).toEqual(before);
    const snap = f.snapshot(), result = f.copy([f.root.taskId, f.m.taskId], f.target), m = copiedTasks(snap, result).find((task) => task.name === "M")!;
    expect(m).toMatchObject({ status: "completed", progress: 100, stageGate: { memberCount: 1, completionInconsistent: true } });
  });
  it("preserves all internal predecessor links and historical reopened predecessor diagnosis", async () => {
    const f = await fixture();
    f.links.create(f.authorization, f.revision(), { predecessorExternalId: "M2", successorExternalId: "M", type: "SS", lag: 0 });
    f.patch(f.leaf, { progress: 100 }); f.patch(f.m2, { progress: 100 }); f.patch(f.m, { progress: 100 }); f.patch(f.m2, { progress: 0 });
    const before = f.snapshot(), result = f.copy([f.root.taskId, f.m.taskId, f.m2.taskId], f.target);
    const copies = new Map(copiedTasks(before, result).map((task) => [task.name, task]));
    expect(copies.get("M")).toMatchObject({ status: "completed", stageGate: { completionInconsistent: true, incompletePredecessorMilestoneTaskIds: [copies.get("M2")!.taskId] } });
    expect(copies.get("M2")?.status).toBe(before.data.tasks.find((task) => task.taskId === f.m2.taskId)?.status); expect(result.data.links).toHaveLength(2);
  });
  it.each(["incoming", "outgoing", "mixed"])("completed %s edge boundary is rejected even when E is retained", async (kind) => {
    const f = await fixture(), repo = new ScheduleRepository(f.db), m = repo.findTaskByPublicId(f.authorization.projectId, f.m.taskId)!, m2 = repo.findTaskByPublicId(f.authorization.projectId, f.m2.taskId)!, leaf = repo.findTaskByPublicId(f.authorization.projectId, f.leaf.taskId)!;
    repo.insertLink({ publicId: randomUUID(), projectId: f.authorization.projectId, predecessorTaskId: kind === "incoming" ? m2.id : m.id, successorTaskId: kind === "incoming" ? m.id : kind === "mixed" ? leaf.id : m2.id, type: "SS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    f.patch(f.leaf, { progress: 100 });
    if (kind === "incoming") { f.patch(f.m2, { progress: 100 }); f.patch(f.m, { progress: 100 }); }
    else { f.patch(f.m, { progress: 100 }); f.patch(f.m2, { progress: 100 }); }
    const before = f.state(); const ids = kind === "mixed" ? [f.m.taskId] : [f.root.taskId, f.m.taskId];
    expect(() => f.copy(ids, f.target, true)).toThrow("COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED"); expect(f.state()).toEqual(before);
  });
  it("ack does not bypass completed destination structure or Resource Assignment Copy guard", async () => {
    const f = await fixture(); f.assign(f.target, f.m2); f.patch(f.m2, { progress: 100 }); let before = f.state();
    expect(() => f.copy([f.root.taskId], f.target, true)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED"); expect(f.state()).toEqual(before);
    f.patch(f.m2, { progress: 0 }); const repo = new ScheduleRepository(f.db), leaf = repo.findTaskByPublicId(f.authorization.projectId, f.leaf.taskId)!;
    const stamp = clock().toISOString(), resource = f.db.prepare("INSERT INTO resources(public_id,name,created_at,updated_at) VALUES(?,?,?,?)").run(randomUUID(), "R", stamp, stamp).lastInsertRowid;
    f.db.prepare("INSERT INTO task_assignments(public_id,project_id,task_id,resource_id,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), f.authorization.projectId, leaf.id, resource, stamp, stamp); before = f.state();
    expect(() => f.copy([f.root.taskId], f.target, true)).toThrow(TaskCopyAssignmentUnsupportedError); expect(f.state()).toEqual(before);
  });
  it("Cut preserves Task identity and explicit membership; inherited completed changes rollback; unrelated reorder works", async () => {
    const f = await fixture(); f.assign(f.leaf, f.m2);
    const response = f.hierarchy.execute(f.authorization, f.revision(), { kind: "reparent", taskId: f.leaf.taskId, anchorTaskId: f.target.taskId, placement: "child" });
    expect(response.data.tasks.find((task) => task.taskId === f.leaf.taskId)).toMatchObject({ parentExternalId: "Target", membership: { explicitMilestoneTaskId: f.m2.taskId, effectiveMilestoneTaskId: f.m2.taskId } });
    const t = f.add("New", "task", f.root, 100); f.patch(f.m, { progress: 100 }); const before = f.state();
    expect(() => f.hierarchy.execute(f.authorization, f.revision(), { kind: "reparent", taskId: t.taskId, anchorTaskId: f.target.taskId, placement: "child" })).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED"); expect(f.state()).toEqual(before);
    f.hierarchy.execute(f.authorization, f.revision(), { kind: "move", taskId: t.taskId, direction: "up" });
    expect(f.snapshot().data.tasks.find((task) => task.taskId === t.taskId)?.membership?.effectiveMilestoneTaskId).toBe(f.m.taskId);
  });
  it.each(["unauthorized", "stale", "unacknowledged"])("HTTP %s failure does not partially save Copy", async (kind) => {
    const f = await fixture(), before = f.state();
    const command: TaskHierarchyCommandRequest = { kind: "copy", taskIds: [f.root.taskId], anchorTaskId: f.target.taskId, placement: "child", acknowledgedMembershipExclusions: kind !== "unacknowledged" };
    const request = new Request(`https://gantt.example.com/api/projects/${f.publicId}/tasks/hierarchy`, { method: "POST", headers: { Origin: "https://gantt.example.com", Cookie: kind === "unauthorized" ? "" : `__Host-mastergantt_edit=${f.token}`, "If-Match": `"${kind === "stale" ? 1 : f.revision()}"`, "Content-Type": "application/json" }, body: JSON.stringify(command) });
    const response = await handleTaskHierarchyCommand(request, f.publicId, { authorizationService: f.projects, hierarchyService: f.hierarchy, applicationBaseUrl: "https://gantt.example.com", environment: "production" });
    expect(response.status).toBe(kind === "unauthorized" ? 401 : kind === "stale" ? 412 : 409); expect(f.state()).toEqual(before);
  });
  it("membership SQL failure rolls back cloned tasks/links/revision and leaves source baseline unchanged", async () => {
    const f = await fixture(); f.patch(f.leaf, { baseline: { start: "2026-10-06", duration: 2 } }); const before = f.state();
    f.db.exec("CREATE TRIGGER reject_copy_row BEFORE INSERT ON task_milestone_memberships BEGIN SELECT RAISE(ABORT,'forced-subcopy-membership'); END;");
    expect(() => f.copy([f.root.taskId, f.m.taskId], f.target)).toThrow("forced-subcopy-membership"); expect(f.state()).toEqual(before);
    f.db.exec("DROP TRIGGER reject_copy_row"); const snap = f.snapshot(), result = f.copy([f.root.taskId, f.m.taskId], f.target);
    expect(copiedTasks(snap, result).find((task) => task.name === "Leaf")?.baselineStart).toBeNull();
    expect(f.snapshot().data.tasks.find((task) => task.taskId === f.leaf.taskId)?.baselineStart).toBe("2026-10-06");
  });
});
