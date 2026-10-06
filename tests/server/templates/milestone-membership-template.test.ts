import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectTemplateSnapshot } from "../../../src/contracts/project-templates";
import type { ProjectTaskDto } from "../../../src/contracts/projects";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { RevisionMismatchError, EditSessionInvalidError } from "../../../src/server/projects/project-service-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { LinkService } from "../../../src/server/projects/link-service-core";

const clock = () => new Date("2026-10-05T01:00:00.000Z");
const hashPassword = async () => ({ algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 });
const connections: ReturnType<typeof openDatabase>["database"][] = [];
afterEach(() => connections.splice(0).forEach((db) => db.close()));
async function fixture() {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database; connections.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword }), templates = new ProjectTemplateService(db, { clock, hashPassword });
  const created = await projects.create({ name: "Template source", description: "", editPassword: "test", ownerName: "owner" });
  const publicId = created.response.data.project.publicId, auth = projects.authorize(publicId, created.rawSessionToken); if (auth.kind !== "authorized") throw new Error("auth");
  const authorization = auth.authorization, snapshot = () => projects.getReadonlySnapshot(publicId)!, revision = () => snapshot().data.project.revision;
  const add = (name: string, type: ProjectTaskDto["type"] = "task", parent?: ProjectTaskDto) => projects.createTask(authorization, revision(), type === "summary" ? { name, externalId: name, type, parentTaskId: parent?.taskId } : { name, externalId: name, type, parentTaskId: parent?.taskId, start: "2026-10-06", duration: type === "milestone" ? 0 : 2, progress: 0 }).data.tasks.find((task) => task.externalId === name)!;
  const patch = (task: ProjectTaskDto, input: Parameters<typeof projects.updateTask>[3]) => projects.updateTask(authorization, revision(), task.taskId, input);
  const m = add("M", "milestone"), root = add("S", "summary"), nested = add("N", "summary", root), t = add("T", "task", nested), m2 = add("M2", "milestone"), override = add("O", "task", nested), empty = add("Empty", "summary", root);
  patch(root, { explicitMilestoneTaskId: m.taskId }); patch(override, { explicitMilestoneTaskId: m2.taskId });
  const create = () => templates.createTemplateFromProject(authorization, revision(), { name: "Saved", description: "" });
  const read = (id: string): ProjectTemplateSnapshot => JSON.parse(db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(id) as string);
  const write = (id: string, value: unknown) => db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(value), id);
  const instantiate = (id: string) => templates.instantiateProject(id, { name: "New", ownerName: "owner", editPassword: "test", projectStartDate: "2026-11-02" });
  return { db, projects, templates, publicId, authorization, snapshot, revision, add, patch, m, root, nested, t, m2, override, empty, create, read, write, instantiate };
}
describe("independent Template membership snapshot", () => {
  it("snapshots dependency-adjusted dates and reinstantiates Links and memberships without editing the source", async () => {
    const f = await fixture(), predecessor = f.add("DAG-P"), links = new LinkService(f.db, clock);
    f.patch(predecessor, { duration: 1 }); f.patch(f.t, { progress: 50, baseline: { start: "2026-10-06", duration: 3 } });
    links.create(f.authorization, f.revision(), { predecessorExternalId: "DAG-P", successorExternalId: "T", type: "FS", lag: 1 });
    links.create(f.authorization, f.revision(), { predecessorExternalId: "M", successorExternalId: "M2", type: "FS", lag: 0 });
    const before = f.snapshot();
    expect(before.data.tasks.find((task) => task.taskId === f.t.taskId)).toMatchObject({ requestedStart: "2026-10-06", start: "2026-10-08", end: "2026-10-12", status: "in_progress", progress: 50 });
    const sourceRows = () => ({ tasks: f.db.prepare("SELECT * FROM tasks WHERE project_id=? ORDER BY id").all(f.authorization.projectId), links: f.db.prepare("SELECT * FROM links WHERE project_id=? ORDER BY id").all(f.authorization.projectId), memberships: f.db.prepare("SELECT * FROM task_milestone_memberships WHERE project_id=? ORDER BY member_task_id").all(f.authorization.projectId) });
    const originalRows = sourceRows(), saved = f.create(), stored = f.read(saved.id);
    expect(stored.tasks.find((task) => task.externalId === "T")?.offsetDays).toBe(2);
    const result = await f.instantiate(saved.id), rows = new Map(result.response.data.tasks.map((task) => [task.externalId, task]));
    expect(rows.get("T")).toMatchObject({ start: "2026-11-04", end: "2026-11-05", duration: 2, progress: 0, status: "not_started", membership: { explicitMilestoneTaskId: null, effectiveMilestoneTaskId: rows.get("M")!.taskId, inheritedFromTaskId: rows.get("S")!.taskId } });
    expect(f.db.prepare("SELECT baseline_start,baseline_end,baseline_duration FROM tasks WHERE public_id=?").get(rows.get("T")!.taskId)).toEqual({ baseline_start: null, baseline_end: null, baseline_duration: null });
    expect(rows.get("O")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M2")!.taskId);
    expect(result.response.data.links.map(({ predecessorExternalId, successorExternalId, type, lag }) => ({ predecessorExternalId, successorExternalId, type, lag }))).toEqual(before.data.links.map(({ predecessorExternalId, successorExternalId, type, lag }) => ({ predecessorExternalId, successorExternalId, type, lag })));
    expect(f.snapshot()).toEqual(before); expect(sourceRows()).toEqual(originalRows); expect(f.read(saved.id)).toEqual(stored); expect(f.db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it("captures explicit only, resolves forward targets and preserves snapshot after source edits/deletion", async () => {
    const f = await fixture(); f.patch(f.t, { progress: 100 }); f.patch(f.m, { progress: 100 }); const source = f.snapshot(), saved = f.create(), snapshot = f.read(saved.id);
    expect(snapshot.memberships).toEqual([{ taskExternalId: "S", milestoneExternalId: "M" }, { taskExternalId: "O", milestoneExternalId: "M2" }]);
    expect(f.snapshot()).toEqual(source);
    snapshot.tasks.reverse(); f.write(saved.id, snapshot);
    f.patch(f.m, { progress: 0 }); f.patch(f.root, { explicitMilestoneTaskId: f.m2.taskId }); f.projects.deleteProject(f.authorization, f.revision());
    const result = await f.instantiate(saved.id), rows = new Map(result.response.data.tasks.map((task) => [task.externalId, task]));
    expect(rows.get("S")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M")?.taskId);
    expect(rows.get("T")?.membership).toMatchObject({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: rows.get("M")!.taskId, inheritedFromTaskId: rows.get("S")!.taskId });
    expect(rows.get("O")?.membership?.explicitMilestoneTaskId).toBe(rows.get("M2")?.taskId);
    expect(rows.get("Empty")?.membership?.effectiveMilestoneTaskId).toBe(rows.get("M")?.taskId);
    expect(rows.get("M")).toMatchObject({ status: "not_started", progress: 0, stageGate: { memberCount: 1, ready: false } });
    expect(result.response.data.project).toMatchObject({ revision: 1, status: "planned" });
    expect(result.response.data.tasks.every((task) => !source.data.tasks.some((old) => old.taskId === task.taskId))).toBe(true);
    expect(f.db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it("legacy snapshot omission creates unassigned membership and duplicate preserves all snapshot rows", async () => {
    const f = await fixture(), saved = f.create(), duplicate = f.templates.duplicateTemplate(saved.id, { name: "Duplicate" });
    expect(f.read(duplicate.id).memberships).toEqual(f.read(saved.id).memberships);
    const snapshot = f.read(saved.id); delete snapshot.memberships; f.write(saved.id, snapshot);
    expect((await f.instantiate(saved.id)).response.data.tasks.every((task) => task.membership?.effectiveMilestoneTaskId === null)).toBe(true);
  });
  it.each(["null", "object", "duplicate", "dangling-source", "dangling-target", "invalid-source", "invalid-target", "foreign-public-id"])("rejects malformed stored membership %s atomically", async (kind) => {
    const f = await fixture(), saved = f.create(), snapshot = f.read(saved.id);
    const values: Record<string, unknown> = {
      null: null, object: {}, duplicate: [snapshot.memberships![0], snapshot.memberships![0]],
      "dangling-source": [{ taskExternalId: "missing", milestoneExternalId: "M" }],
      "dangling-target": [{ taskExternalId: "S", milestoneExternalId: "missing" }],
      "invalid-source": [{ taskExternalId: "M2", milestoneExternalId: "M" }],
      "invalid-target": [{ taskExternalId: "S", milestoneExternalId: "T" }],
      "foreign-public-id": [{ taskExternalId: "S", milestoneExternalId: randomUUID() }],
    };
    f.write(saved.id, { ...snapshot, memberships: values[kind] });
    const before = f.db.prepare("SELECT count(*) FROM projects").pluck().get(), source = f.snapshot();
    await expect(f.instantiate(saved.id)).rejects.toThrow("Template membership");
    expect(f.db.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(before); expect(f.snapshot()).toEqual(source);
  });
  it.each(["wrong-public-id", "wrong-project-id", "expired", "auth-version"])("rejects source session binding %s without changing snapshot/template rows", async (kind) => {
    const f = await fixture(), before = f.snapshot(), count = f.db.prepare("SELECT count(*) FROM project_templates").pluck().get();
    let authorization = f.authorization;
    if (kind === "wrong-public-id") authorization = { ...authorization, projectPublicId: randomUUID() };
    if (kind === "wrong-project-id") authorization = { ...authorization, projectId: authorization.projectId + 1 };
    if (kind === "expired") f.db.prepare("UPDATE edit_sessions SET expires_at=?").run("2026-10-04T00:00:00.000Z");
    if (kind === "auth-version") f.db.prepare("UPDATE edit_sessions SET auth_version=auth_version+1").run();
    expect(() => f.templates.createTemplateFromProject(authorization, f.revision(), { name: "Denied" })).toThrow(EditSessionInvalidError);
    expect(f.snapshot()).toEqual(before); expect(f.db.prepare("SELECT count(*) FROM project_templates").pluck().get()).toBe(count);
  });
  it("preserves trusted legacy mixed scheduling links without converting them to membership", async () => {
    const f = await fixture(), repo = new ScheduleRepository(f.db), t = repo.findTaskByPublicId(f.authorization.projectId, f.t.taskId)!, m = repo.findTaskByPublicId(f.authorization.projectId, f.m.taskId)!;
    repo.insertLink({ projectId: f.authorization.projectId, publicId: randomUUID(), predecessorTaskId: t.id, successorTaskId: m.id, type: "SS", lag: 0, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
    const saved = f.create(), result = await f.instantiate(saved.id); expect(result.response.data.links).toHaveLength(1);
    expect(result.response.data.links[0]).toMatchObject({ predecessorExternalId: "T", successorExternalId: "M", type: "SS", legacyMixed: true }); expect(f.read(saved.id).memberships).toHaveLength(2);
  });
  it("rechecks source session/revision and rolls back new Project on membership insertion failure", async () => {
    const f = await fixture(), saved = f.create();
    expect(() => f.templates.createTemplateFromProject(f.authorization, 1, { name: "Stale" })).toThrow(RevisionMismatchError);
    const count = f.db.prepare("SELECT count(*) FROM projects").pluck().get();
    f.db.exec("CREATE TRIGGER reject_template_row BEFORE INSERT ON task_milestone_memberships BEGIN SELECT RAISE(ABORT,'forced-template-membership'); END;");
    await expect(f.instantiate(saved.id)).rejects.toThrow("forced-template-membership"); expect(f.db.prepare("SELECT count(*) FROM projects").pluck().get()).toBe(count);
    f.db.prepare("UPDATE edit_sessions SET revoked_at=?").run(clock().toISOString());
    expect(() => f.create()).toThrow(EditSessionInvalidError);
  });
});
