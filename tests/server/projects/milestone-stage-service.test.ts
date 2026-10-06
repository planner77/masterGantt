import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectExcelExportRequest } from "../../../src/contracts/project-excel-export";
import type { CreateTaskRequest, ProjectTaskDto } from "../../../src/contracts/projects";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { TaskHierarchyService } from "../../../src/server/projects/task-hierarchy-service-core";
import { TaskSubtreeDeleteService } from "../../../src/server/projects/task-subtree-delete-service-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { MilestoneMembershipRepository } from "../../../src/server/repositories/milestone-membership-repository-core";
import { handleMilestoneMembershipCommand, handleUnavailableProjectImport, handleUpdateTask } from "../../../src/server/projects/task-handlers-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { buildProjectExcelWorkbook } from "../../../src/server/exports/project-excel-export-core";
import { RevisionMismatchError, EditSessionInvalidError } from "../../../src/server/projects/project-service-core";

const migrationsDirectory = join(process.cwd(), "db/migrations");
const clock = () => new Date("2026-10-05T01:00:00.000Z");
const hashPassword = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const databases: ReturnType<typeof openDatabase>["database"][] = [];
const directories: string[] = [];
afterEach(() => { databases.splice(0).forEach((db) => { if (db.open) db.close(); }); directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });
async function fixture(filename = ":memory:") {
  const db = openDatabase({ filename, migrationsDirectory }).database; databases.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword });
  const created = await projects.create({ name: "Stages", description: "", editPassword: "test", ownerName: "owner" });
  const publicId = created.response.data.project.publicId, rawToken = created.rawSessionToken;
  const auth = projects.authorize(publicId, rawToken); if (auth.kind !== "authorized") throw new Error("auth");
  const authorization = auth.authorization;
  const snapshot = () => projects.getReadonlySnapshot(publicId)!;
  const revision = () => snapshot().data.project.revision;
  const add = (name: string, type: ProjectTaskDto["type"] = "task", parentTaskId?: string, progress = 0) => {
    const input: CreateTaskRequest = type === "summary" ? { name, externalId: name, type, parentTaskId } : { name, externalId: name, type, start: "2026-10-05", duration: type === "milestone" ? 0 : 2, progress, parentTaskId };
    return projects.createTask(authorization, revision(), input).data.tasks.find((task) => task.externalId === name)!;
  };
  const patch = (task: ProjectTaskDto, input: Parameters<typeof projects.updateTask>[3]) => projects.updateTask(authorization, revision(), task.taskId, input);
  const assign = (task: ProjectTaskDto, milestone: ProjectTaskDto | null) => patch(task, { explicitMilestoneTaskId: milestone?.taskId ?? null });
  const state = () => ({ tasks: db.prepare("SELECT * FROM tasks ORDER BY id").all(), links: db.prepare("SELECT * FROM links ORDER BY id").all(), members: db.prepare("SELECT * FROM task_milestone_memberships ORDER BY member_task_id").all(), assignments: db.prepare("SELECT * FROM task_assignments ORDER BY id").all(), revision: revision() });
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request(`https://gantt.example.com/api/projects/${publicId}/milestone-memberships`, { method: "POST", headers: { Origin: "https://gantt.example.com", Cookie: `__Host-mastergantt_edit=${rawToken}`, "If-Match": `"${revision()}"`, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const deps = { service: projects, applicationBaseUrl: "https://gantt.example.com", environment: "production" };
  return { db, projects, publicId, rawToken, authorization, snapshot, revision, add, patch, assign, state, request, deps, hierarchy: new TaskHierarchyService(db, { clock }), links: new LinkService(db, clock), subtree: new TaskSubtreeDeleteService(db, { clock }) };
}

describe("milestone SQLite/API stage contract", () => {
  it("saves Summary name and explicit default atomically, with nested override and clear inheritance", async () => {
    const f = await fixture(), m1 = f.add("M1", "milestone"), m2 = f.add("M2", "milestone"), s = f.add("S", "summary"), child = f.add("Child", "summary", s.taskId), t = f.add("T", "task", child.taskId);
    const oldRev = f.revision();
    const response = f.patch(s, { name: "renamed", explicitMilestoneTaskId: m1.taskId });
    expect(response.data.project.revision).toBe(oldRev + 1);
    expect(response.data.tasks.find((row) => row.taskId === t.taskId)?.membership).toMatchObject({ effectiveMilestoneTaskId: m1.taskId, inheritedFromTaskId: s.taskId });
    f.assign(child, m2); f.assign(t, m1); f.assign(t, null);
    expect(f.snapshot().data.tasks.find((row) => row.taskId === t.taskId)?.membership).toMatchObject({ effectiveMilestoneTaskId: m2.taskId, inheritedFromTaskId: child.taskId });
    f.assign(child, null);
    expect(f.snapshot().data.tasks.find((row) => row.taskId === t.taskId)?.membership?.effectiveMilestoneTaskId).toBe(m1.taskId);
    expect(f.db.prepare("SELECT count(*) FROM task_milestone_memberships").pluck().get()).toBe(1);
    expect(() => f.patch(s, { duration: 2, explicitMilestoneTaskId: m2.taskId })).toThrow("Summary schedule");
  });
  it("membership-only batch preserves schedule, WBS, Links and assignments exactly; commits once", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), a = f.add("A"), b = f.add("B");
    f.links.create(f.authorization, f.revision(), { predecessorExternalId: a.externalId, successorExternalId: b.externalId, type: "SS", lag: 0 });
    const task = new ScheduleRepository(f.db).findTaskByPublicId(f.authorization.projectId, a.taskId)!;
    const stamp = clock().toISOString();
    const resourceId = f.db.prepare("INSERT INTO resources(public_id,name,created_at,updated_at) VALUES(?,?,?,?)").run(randomUUID(), "R", stamp, stamp).lastInsertRowid;
    f.db.prepare("INSERT INTO task_assignments(public_id,project_id,task_id,resource_id,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), f.authorization.projectId, task.id, resourceId, stamp, stamp);
    const before = f.state();
    const response = await handleMilestoneMembershipCommand(f.request({ changes: [{ taskId: a.taskId, milestoneTaskId: m.taskId }, { taskId: b.taskId, milestoneTaskId: m.taskId }] }), f.publicId, f.deps);
    expect(response.status).toBe(200); expect(response.headers.get("etag")).toBe(`"${before.revision + 1}"`);
    const after = f.state(); expect(after.tasks).toEqual(before.tasks); expect(after.links).toEqual(before.links); expect(after.assignments).toEqual(before.assignments); expect(after.revision).toBe(before.revision + 1);
    expect((await response.json()).data.tasks.find((t: ProjectTaskDto) => t.taskId === m.taskId).stageGate.memberCount).toBe(2);
  });
  it("rolls back composite Task fields and the whole batch if any target is invalid", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), a = f.add("A"), b = f.add("B"), before = f.state();
    expect(() => f.patch(a, { name: "lost", explicitMilestoneTaskId: b.taskId })).toThrow("INVALID_MILESTONE_MEMBERSHIP");
    expect(f.state()).toEqual(before);
    expect(() => f.projects.updateMilestoneMemberships(f.authorization, f.revision(), { changes: [{ taskId: a.taskId, milestoneTaskId: m.taskId }, { taskId: b.taskId, milestoneTaskId: randomUUID() }] })).toThrow();
    expect(f.state()).toEqual(before);
    expect(() => f.projects.updateMilestoneMemberships(f.authorization, f.revision(), { changes: [{ taskId: a.taskId, milestoneTaskId: m.taskId }, { taskId: a.taskId, milestoneTaskId: null }] })).toThrow();
    expect(f.state()).toEqual(before);
    f.db.exec("CREATE TRIGGER fail_stage_revision BEFORE UPDATE OF revision ON projects BEGIN SELECT RAISE(ABORT,'forced'); END;");
    expect(() => f.assign(a, m)).toThrow(); expect(f.state()).toEqual(before);
  });
  it("enforces project-scoped FK/type/unique constraints and rejects cross-project HTTP IDs", async () => {
    const f = await fixture(), other = await f.projects.create({ name: "Other", description: "", ownerName: "owner", editPassword: "test" }), a = f.add("A"), m = f.add("M", "milestone");
    const otherAuth = f.projects.authorize(other.response.data.project.publicId, other.rawSessionToken); if (otherAuth.kind !== "authorized") throw new Error("auth");
    const target = f.projects.createTask(otherAuth.authorization, 1, { type: "milestone", name: "OtherM", start: "2026-10-05", duration: 0, progress: 0 }).data.tasks[0];
    expect(() => f.assign(a, target)).toThrow("INVALID_MILESTONE_MEMBERSHIP");
    const repo = new ScheduleRepository(f.db), row = repo.findTaskByPublicId(f.authorization.projectId, a.taskId)!, milestone = repo.findTaskByPublicId(f.authorization.projectId, m.taskId)!;
    const otherRow = repo.findTaskByPublicId(otherAuth.authorization.projectId, target.taskId)!;
    expect(() => f.db.prepare("INSERT INTO task_milestone_memberships VALUES(?,?,?)").run(f.authorization.projectId, row.id, otherRow.id)).toThrow();
    expect(() => f.db.prepare("INSERT INTO task_milestone_memberships VALUES(?,?,?)").run(f.authorization.projectId, milestone.id, row.id)).toThrow();
    f.assign(a, m);
    expect(() => f.db.prepare("INSERT INTO task_milestone_memberships VALUES(?,?,?)").run(f.authorization.projectId, row.id, milestone.id)).toThrow();
  });
  it.each(["missing-cookie", "bad-origin", "stale", "weak", "unknown-field"])("rejects protected command %s without writes", async (kind) => {
    const f = await fixture(), m = f.add("M", "milestone"), t = f.add("T"), before = f.state();
    const headers: Record<string, string> = kind === "missing-cookie" ? { Cookie: "" } : kind === "bad-origin" ? { Origin: "https://other.example.com" } : kind === "stale" ? { "If-Match": '"1"' } : kind === "weak" ? { "If-Match": `W/"${f.revision()}"` } : {};
    const response = await handleMilestoneMembershipCommand(f.request({ changes: [{ taskId: t.taskId, milestoneTaskId: m.taskId }], ...(kind === "unknown-field" ? { effective: true } : {}) }, headers), f.publicId, f.deps);
    expect(response.status).toBe(kind === "missing-cookie" ? 401 : kind === "bad-origin" ? 403 : kind === "stale" ? 412 : 400); expect(f.state()).toEqual(before);
  });
  it("rechecks revoked sessions and stale revisions inside the mutation transaction", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), t = f.add("T"), command = { changes: [{ taskId: t.taskId, milestoneTaskId: m.taskId }] };
    expect(() => f.projects.updateMilestoneMemberships(f.authorization, 1, command)).toThrow(RevisionMismatchError);
    f.db.prepare("UPDATE edit_sessions SET revoked_at=?").run(clock().toISOString());
    expect(() => f.projects.updateMilestoneMemberships(f.authorization, f.revision(), command)).toThrow(EditSessionInvalidError);
  });
  it("guards status and progress=100, manual events and predecessor gates without automatic completion", async () => {
    const f = await fixture(), p = f.add("P", "milestone"), m = f.add("M", "milestone"), t = f.add("T"); f.assign(t, m);
    f.links.create(f.authorization, f.revision(), { predecessorExternalId: p.externalId, successorExternalId: m.externalId, type: "SS", lag: -1 });
    for (const input of [{ status: "completed" as const }, { progress: 100 }]) expect(() => f.patch(m, input)).toThrow("MILESTONE_NOT_READY");
    f.patch(t, { status: "completed" }); expect(f.snapshot().data.tasks.find((row) => row.taskId === m.taskId)?.stageGate).toMatchObject({ ready: false, membersCompleted: true, blocked: true });
    f.patch(p, { progress: 100 }); expect(f.snapshot().data.tasks.find((row) => row.taskId === m.taskId)?.stageGate?.ready).toBe(true);
    f.patch(m, { status: "completed" }); f.patch(t, { progress: 0 }); f.patch(p, { status: "not_started" });
    expect(f.snapshot().data.tasks.find((row) => row.taskId === m.taskId)).toMatchObject({ status: "completed", progress: 100, stageGate: { completionInconsistent: true } });
    f.patch(m, { name: "preserved", progress: 100 });
    f.patch(m, { status: "not_started" }); expect(() => f.patch(m, { progress: 100 })).toThrow("MILESTONE_NOT_READY");
  });
  it("locks explicit same-effective changes, completed empty Summary defaults, batch and inverse moves", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), m2 = f.add("M2", "milestone"), s = f.add("S", "summary"), t = f.add("T", "task", s.taskId, 100), empty = f.add("Empty", "summary"); f.assign(s, m); f.patch(m, { progress: 100 }); const before = f.state();
    expect(() => f.assign(t, m)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(() => f.assign(s, m2)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(() => f.assign(empty, m)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(f.state()).toEqual(before);
    expect(() => f.projects.updateMilestoneMemberships(f.authorization, f.revision(), { changes: [{ taskId: t.taskId, milestoneTaskId: m2.taskId }] })).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(f.state()).toEqual(before);
  });
  it.each(["child", "hierarchy-child", "first-child", "delete", "subtree-delete", "outdent", "reparent", "convert", "copy-into"])("blocks completed indirect structure %s and rolls back", async (kind) => {
    const f = await fixture(), m = f.add("M", "milestone"), s = f.add("S", "summary"), t = f.add("T", "task", s.taskId, 100), other = f.add("Other", "summary"), outside = f.add("Outside"); f.assign(s, m); f.patch(m, { progress: 100 }); const before = f.state();
    const act = () => {
      if (kind === "child") f.add("New", "task", s.taskId);
      if (kind === "hierarchy-child") f.hierarchy.execute(f.authorization, f.revision(), { kind: "create", anchorTaskId: s.taskId, placement: "child", task: { name: "New", type: "task", start: "2026-10-05", duration: 1, progress: 0 } });
      if (kind === "first-child") f.projects.createTask(f.authorization, f.revision(), { name: "New", type: "task", start: "2026-10-05", duration: 1, progress: 0, parentTaskId: t.taskId, convertParentToSummary: true });
      if (kind === "delete") f.projects.deleteTask(f.authorization, f.revision(), t.taskId);
      if (kind === "subtree-delete") f.subtree.deleteTaskSubtree(f.authorization, f.revision(), s.taskId);
      if (kind === "outdent") f.hierarchy.execute(f.authorization, f.revision(), { kind: "outdent", taskId: t.taskId });
      if (kind === "reparent") f.hierarchy.execute(f.authorization, f.revision(), { kind: "reparent", taskId: t.taskId, anchorTaskId: other.taskId, placement: "child" });
      if (kind === "convert") f.hierarchy.execute(f.authorization, f.revision(), { kind: "convert", taskId: t.taskId, targetType: "milestone" });
      if (kind === "copy-into") f.hierarchy.execute(f.authorization, f.revision(), { kind: "copy", taskId: outside.taskId, anchorTaskId: s.taskId, placement: "child" });
    };
    expect(act).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED"); expect(f.state()).toEqual(before);
  });
  it("allows same-parent reorder, field edits, Milestone child creation and unrelated override moves", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), s = f.add("S", "summary"), t = f.add("T", "task", s.taskId, 100), t2 = f.add("T2", "task", s.taskId, 100); f.assign(s, m); f.patch(m, { progress: 100 });
    const response = f.hierarchy.execute(f.authorization, f.revision(), { kind: "move", taskId: t2.taskId, direction: "up" });
    expect(response.data.tasks.find((row) => row.taskId === t.taskId)?.membership?.effectiveMilestoneTaskId).toBe(m.taskId);
    f.patch(t, { name: "rename", progress: 50 }); f.add("ChildM", "milestone", s.taskId);
    f.patch(m, { status: "not_started" });
    const other = f.add("Other", "milestone"), override = f.add("Override", "task", s.taskId);
    f.assign(override, other); f.patch(t, { progress: 100 }); f.patch(m, { status: "completed" });
    f.hierarchy.execute(f.authorization, f.revision(), { kind: "outdent", taskId: override.taskId });
    expect(f.snapshot().data.tasks.find((row) => row.taskId === override.taskId)?.membership?.effectiveMilestoneTaskId).toBe(other.taskId);
    f.patch(t, { progress: 50 });
    expect(f.snapshot().data.tasks.find((row) => row.taskId === m.taskId)?.stageGate?.completionInconsistent).toBe(true);
  });
  it("locks inherited member additions by indent and completed manual Milestone deletion", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), s = f.add("S", "summary"), t = f.add("T", "task", s.taskId, 100), outside = f.add("Outside");
    f.assign(s, m); f.patch(m, { status: "completed" });
    const before = f.state();
    expect(() => f.hierarchy.execute(f.authorization, f.revision(), { kind: "indent", taskId: outside.taskId })).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(f.state()).toEqual(before);
    f.patch(m, { status: "not_started" }); f.assign(s, null); f.patch(m, { progress: 100 });
    const manualBefore = f.state();
    expect(() => f.projects.deleteTask(f.authorization, f.revision(), m.taskId)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED"); expect(f.state()).toEqual(manualBefore);
    expect(f.snapshot().data.tasks.find((row) => row.taskId === t.taskId)?.membership?.effectiveMilestoneTaskId).toBeNull();
  });

  it("reports completed Link structure locks before an unrelated Manual scheduling conflict", async () => {
    const f = await fixture(), p = f.add("P", "milestone"), m = f.add("ManualM", "milestone");
    f.patch(m, { scheduleMode: "manual", start: f.snapshot().data.tasks.find((task) => task.taskId === m.taskId)!.start! }); f.patch(p, { progress: 100 });
    const before = f.state();
    expect(() => f.links.create(f.authorization, f.revision(), { predecessorExternalId: p.externalId, successorExternalId: m.externalId, type: "FS", lag: 10 })).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(f.state()).toEqual(before);
  });

  it("blocks referenced Milestone deletion/conversion without cascading away explicit settings", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), t = f.add("T"); f.assign(t, m); const before = f.state();
    expect(() => f.projects.deleteTask(f.authorization, f.revision(), m.taskId)).toThrow("MILESTONE_REFERENCED"); expect(f.state()).toEqual(before);
    expect(() => f.hierarchy.execute(f.authorization, f.revision(), { kind: "convert", taskId: m.taskId, targetType: "task" })).toThrow(); expect(f.state()).toEqual(before);
  });
  it("locks completed Link endpoints in both directions and permits explicit reopen then editing", async () => {
    const f = await fixture(), p = f.add("P", "milestone"), m = f.add("M", "milestone"), q = f.add("Q", "milestone");
    const linked = f.links.create(f.authorization, f.revision(), { predecessorExternalId: p.externalId, successorExternalId: m.externalId, type: "SS" }); const id = linked.data.links[0].id;
    f.patch(p, { progress: 100 }); f.patch(m, { progress: 100 }); const before = f.state();
    expect(() => f.links.update(f.authorization, f.revision(), id, { lag: 1 })).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(() => f.links.delete(f.authorization, f.revision(), id)).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED");
    expect(() => f.links.create(f.authorization, f.revision(), { predecessorExternalId: q.externalId, successorExternalId: m.externalId })).toThrow("COMPLETED_MILESTONE_STRUCTURE_LOCKED"); expect(f.state()).toEqual(before);
    f.patch(p, { progress: 0 }); f.patch(m, { progress: 0 }); f.links.update(f.authorization, f.revision(), id, { lag: 1 });
  });
  it("rejects new mixed Links but preserves legacy reads/scheduling/metadata/type-lag edit/delete", async () => {
    const f = await fixture(), t = f.add("T"), m = f.add("M", "milestone"), before = f.state();
    expect(() => f.links.create(f.authorization, f.revision(), { predecessorExternalId: t.externalId, successorExternalId: m.externalId })).toThrow("MIXED_DEPENDENCY_ENDPOINT"); expect(f.state()).toEqual(before);
    const repo = new ScheduleRepository(f.db), pre = repo.findTaskByPublicId(f.authorization.projectId, t.taskId)!, suc = repo.findTaskByPublicId(f.authorization.projectId, m.taskId)!;
    const legacy = repo.insertLink({ projectId: f.authorization.projectId, publicId: randomUUID(), predecessorTaskId: pre.id, successorTaskId: suc.id, type: "SS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    expect(f.snapshot().data.links[0].legacyMixed).toBe(true);
    expect(f.patch(t, { name: "unrelated" }).data.links[0].id).toBe(legacy.publicId);
    expect(f.links.update(f.authorization, f.revision(), legacy.publicId, { type: "FS", lag: 1 }).data.links[0].legacyMixed).toBe(true);
    expect(f.links.delete(f.authorization, f.revision(), legacy.publicId).data.links).toHaveLength(0);
  });
  it("preserves whole Copy/Template memberships and requires review before external subtree exclusions", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), s = f.add("S", "summary"), t = f.add("T", "task", s.taskId), target = f.add("Target", "summary"); f.assign(s, m);
    const source = f.snapshot(), copy = new ProjectCopyService(f.db, { clock, hashPassword });
    const copied = await copy.copy(f.authorization, f.revision(), { name: "Copy", description: "", editPassword: "test" });
    const rows = new Map(copied.response.data.tasks.map((task) => [task.externalId, task]));
    expect(rows.get("S")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M")?.taskId);
    expect(rows.get("T")?.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: rows.get("M")!.taskId, inheritedFromTaskId: rows.get("S")!.taskId });
    expect(f.snapshot()).toEqual(source);
    const templates = new ProjectTemplateService(f.db, { clock, hashPassword });
    const saved = templates.createTemplateFromProject(f.authorization, f.revision(), { name: "Template", description: "" });
    const instantiated = await templates.instantiateProject(saved.id, { name: "Template copy", ownerName: "owner", editPassword: "test", projectStartDate: "2026-11-02" });
    const templateRows = new Map(instantiated.response.data.tasks.map((task) => [task.externalId, task]));
    expect(templateRows.get("S")?.membership?.explicitMilestoneTaskId).toBe(templateRows.get("M")?.taskId);
    expect(templateRows.get("T")?.membership?.effectiveMilestoneTaskId).toBe(templateRows.get("M")?.taskId);
    expect(templateRows.get("M")?.status).toBe("not_started"); expect(f.snapshot()).toEqual(source);
    const before = f.state();
    expect(() => f.hierarchy.execute(f.authorization, f.revision(), { kind: "copy", taskId: t.taskId, anchorTaskId: target.taskId, placement: "child" })).toThrow("TASK_COPY_MEMBERSHIP_REVIEW_REQUIRED");
    expect(f.state()).toEqual(before);
    const response = f.hierarchy.execute(f.authorization, f.revision(), { kind: "copy", taskId: t.taskId, anchorTaskId: target.taskId, placement: "child", acknowledgedMembershipExclusions: true });
    const newTask = response.data.tasks.find((task) => !source.data.tasks.some((original) => original.taskId === task.taskId))!;
    expect(newTask.membership).toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: null, inheritedFromTaskId: null });
    expect(response.data.project.revision).toBe(source.data.project.revision + 1);
  });
  it("Excel preserves the matching typed stage snapshot and fails wholly for missing or stale stage data", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), s = f.add("S", "summary"), t = f.add("T", "task", s.taskId); f.assign(s, m); const before = f.state();
    const bundle = new ProjectExportSnapshotService(f.db, { clock }).get(f.publicId)!;
    const request: ProjectExcelExportRequest = { includeDependencies: false, scope: "project", scale: "day", hierarchyDisplay: "expanded", layout: { columns: [{ id: "text", widthPx: 200 }] } };
    expect(() => buildProjectExcelWorkbook(bundle.snapshot, request)).toThrow("Milestone stage summary must be supplied for this snapshot.");
    const workbook = Buffer.from(buildProjectExcelWorkbook(bundle.snapshot, request, undefined, bundle.stageDashboard));
    const entries = new Map<string, string>(); let offset = 0;
    while (offset + 30 <= workbook.length && workbook.readUInt32LE(offset) === 0x04034b50) {
      const size = workbook.readUInt32LE(offset + 18), nameSize = workbook.readUInt16LE(offset + 26), extraSize = workbook.readUInt16LE(offset + 28);
      const start = offset + 30 + nameSize + extraSize;
      entries.set(workbook.toString("utf8", offset + 30, offset + 30 + nameSize), inflateRawSync(workbook.subarray(start, start + size)).toString("utf8"));
      offset = start + size;
    }
    const metadata = entries.get("xl/workbook.xml")!;
    const sheet = (name: string) => {
      const sheetId = metadata.match(new RegExp(`name="${name}" sheetId="(\\d+)"`))![1];
      return entries.get(`xl/worksheets/sheet${sheetId}.xml`)!;
    };
    expect(metadata).toContain('name="Milestone Stages"'); expect(metadata).not.toContain('name="Dependencies"');
    const tasks = sheet("Tasks"), stages = sheet("Milestone Stages");
    expect(tasks).toContain("명시 단계 외부 ID"); expect(tasks).toContain("유효 단계 외부 ID(파생)"); expect(tasks).toContain("상속 출처 외부 ID(파생)");
    const leafRow = tasks.match(/<row[^>]*>[^]*?<\/row>/g)!.find((row) => row.includes(t.taskId))!;
    expect(leafRow).toContain(m.taskId); expect(leafRow).toContain(s.taskId);
    expect(stages).toContain(m.taskId); expect(stages).toContain(t.taskId); expect(stages).toContain("stage.member");
    expect(bundle.stageDashboard.rows.find((row) => row.milestoneTaskId === m.taskId)?.stageGate).toEqual(bundle.snapshot.data.tasks.find((task) => task.taskId === m.taskId)?.stageGate);
    const stale = structuredClone(bundle.stageDashboard); stale.projectRevision--;
    expect(() => buildProjectExcelWorkbook(bundle.snapshot, request, undefined, stale)).toThrow("Milestone stage report must match the full exported Project snapshot and catalog revision.");
    expect(f.state()).toEqual(before); expect(f.snapshot()).toEqual(bundle.snapshot);
    expect(f.snapshot().data.tasks.find((task) => task.taskId === t.taskId)?.membership?.effectiveMilestoneTaskId).toBe(m.taskId);
  });
  it("disabled Import honors Origin/session/If-Match and never claims success or writes", async () => {
    const f = await fixture(), before = f.state();
    expect(handleUnavailableProjectImport(f.request({}), f.publicId, f.deps).status).toBe(501);
    expect(handleUnavailableProjectImport(f.request({}, { Cookie: "" }), f.publicId, f.deps).status).toBe(401);
    expect(handleUnavailableProjectImport(f.request({}, { Origin: "https://other.example.com" }), f.publicId, f.deps).status).toBe(403);
    expect(handleUnavailableProjectImport(f.request({}, { "If-Match": '"99"' }), f.publicId, f.deps).status).toBe(412);
    expect(f.state()).toEqual(before);
  });
  it("returns structured completion guard through the actual SQLite Task PATCH handler", async () => {
    const f = await fixture(), m = f.add("M", "milestone"), t = f.add("T"); f.assign(t, m); const before = f.state();
    const response = await handleUpdateTask(f.request({ progress: 100 }), f.publicId, m.taskId, f.deps);
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("MILESTONE_NOT_READY"); expect(f.state()).toEqual(before);
  });
  it("persists explicit rows and projection across SQLite restart; normal Project deletion still cascades", async () => {
    const dir = mkdtempSync(join(tmpdir(), "stage-persistence-")); directories.push(dir); const filename = join(dir, "db.sqlite3");
    const f = await fixture(filename), m = f.add("M", "milestone"), t = f.add("T"); f.assign(t, m); const snapshot = f.snapshot(); f.db.close();
    const db = openDatabase({ filename, migrationsDirectory }).database; databases.push(db);
    const projects = new TaskFieldProjectService(db, { clock, hashPassword }); expect(projects.getReadonlySnapshot(f.publicId)).toEqual(snapshot);
    const auth = projects.authorize(f.publicId, f.rawToken); if (auth.kind !== "authorized") throw new Error("auth"); projects.deleteProject(auth.authorization, snapshot.data.project.revision);
    expect(new MilestoneMembershipRepository(db).list(auth.authorization.projectId)).toEqual([]); expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
