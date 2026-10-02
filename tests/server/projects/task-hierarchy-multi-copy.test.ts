import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskHierarchyCommandRequest, ProjectTaskDto } from "../../../src/contracts/projects";
import { openDatabase } from "../../../src/server/db/core";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { ProjectService, InvalidTaskInputError, RevisionMismatchError, TaskNotFoundError, TaskLimitExceededError, UnsupportedScheduleStructureError } from "../../../src/server/projects/project-service-core";
import { TaskHierarchyService, TaskCopyAssignmentUnsupportedError } from "../../../src/server/projects/task-hierarchy-service-core";
import { handleTaskHierarchyCommand } from "../../../src/server/projects/task-hierarchy-handlers-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const clock = () => new Date("2026-10-02T01:00:00.000Z");
const connections: ReturnType<typeof openDatabase>["database"][] = [];
const directories: string[] = [];
afterEach(() => {
  for (const db of connections.splice(0)) if (db.open) db.close();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
async function fixture(filename = ":memory:") {
  const db = openDatabase({ filename, migrationsDirectory }).database;
  connections.push(db);
  const projects = new ProjectService(db, { clock, hashPassword: async () => ({
    algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2),
    n: 32768, r: 8, p: 3, keyLength: 32,
  }) });
  const created = await projects.create({ name: "Multi Copy", description: "", editPassword: "Pass123456!" });
  const publicId = created.response.data.project.publicId;
  const rawToken = created.rawSessionToken;
  const authorized = projects.authorize(publicId, rawToken);
  if (authorized.kind !== "authorized") throw new Error("expected edit session");
  const authorization = authorized.authorization;
  const hierarchy = new TaskHierarchyService(db, { clock });
  const links = new LinkService(db, clock);
  const f = {
    db, projects, hierarchy, links, authorization, publicId, rawToken, revision: 1,
    add(name: string, parent?: ProjectTaskDto, type: "task" | "summary" = "task") {
      const response = projects.createTask(authorization, f.revision, type === "summary"
        ? { name, externalId: name, type, parentTaskId: parent?.taskId }
        : { name, externalId: name, type, start: "2026-10-05", duration: 2, progress: 25, parentTaskId: parent?.taskId });
      f.revision = response.data.project.revision;
      return response.data.tasks.find((task) => task.externalId === name)!;
    },
    relate(from: ProjectTaskDto, to: ProjectTaskDto, type: "FS" | "SS" | "FF" | "SF" = "FS", lag = 0) {
      const response = links.create(authorization, f.revision, {
        predecessorExternalId: from.externalId, successorExternalId: to.externalId, type, lag,
      });
      f.revision = response.data.project.revision;
    },
    copy(taskIds: readonly string[], anchor: ProjectTaskDto, placement: "before" | "after" | "child" = "child") {
      return hierarchy.execute(authorization, f.revision, { kind: "copy", taskIds, anchorTaskId: anchor.taskId, placement });
    },
    state() {
      return { tasks: db.prepare("SELECT * FROM tasks ORDER BY id").all(), links: db.prepare("SELECT * FROM links ORDER BY id").all(),
        revision: db.prepare("SELECT revision FROM projects WHERE public_id=?").pluck().get(publicId) };
    },
  };
  return f;
}
function children(tasks: readonly ProjectTaskDto[], parentExternalId: string | null) {
  return tasks.filter((task) => task.parentExternalId === parentExternalId).sort((a, b) => a.siblingOrder - b.siblingOrder);
}

describe("atomic multi-root Copy", () => {
  it.each(["child", "before", "after"] as const)("inserts the canonical source block at %s", async (placement) => {
    const f = await fixture();
    const source = f.add("A", undefined, "summary");
    const leaves = Array.from({ length: 12 }, (_, index) => f.add(`A${index + 1}`, source));
    const target = f.add("B", undefined, "summary");
    const existing = placement === "child" ? f.add("B0", target) : null;
    const before = f.state();
    const copied = f.copy([leaves[9].taskId, leaves[1].taskId], target, placement);
    expect(copied.data.project.revision).toBe(f.revision + 1);
    const originalIds = new Set((before.tasks as { public_id: string }[]).map((task) => task.public_id));
    const copies = copied.data.tasks.filter((task) => !originalIds.has(task.taskId));
    expect(copies).toHaveLength(2);
    expect(copies.map((task) => task.name)).toEqual(["A2", "A10"]);
    const family = children(copied.data.tasks, placement === "child" ? target.externalId : null);
    expect(family.map((task) => task.name)).toEqual(placement === "child" ? [existing!.name, "A2", "A10"]
      : placement === "before" ? ["A", "A2", "A10", "B"] : ["A", "B", "A2", "A10"]);
    expect(family.map((task) => task.siblingOrder)).toEqual(family.map((_, index) => index));
    expect(copies.every((task) => !leaves.some((original) => original.taskId === task.taskId || original.externalId === task.externalId))).toBe(true);
  });
  it.each(["FS", "SS", "FF", "SF"] as const)("remaps %s and signed lags across separate roots", async (type) => {
    for (const lag of [-2, 2]) {
      const f = await fixture();
      const a = f.add("A", undefined, "summary"), b = f.add("B", undefined, "summary");
      const first = f.add("A1", a), second = f.add("B1", b);
      const x = f.add("X"), y = f.add("Y"), target = f.add("T", undefined, "summary");
      f.relate(x, first); f.relate(first, second, type, lag); f.relate(second, y);
      const baseline = f.projects.updateTask(f.authorization, f.revision, first.taskId, { baseline: { start: "2026-10-06", duration: 2 } });
      f.revision = baseline.data.project.revision;
      const before = f.state();
      const result = f.copy([second.taskId, first.taskId], target);
      const copies = children(result.data.tasks, target.externalId);
      expect(copies.map((task) => task.name)).toEqual(["A1", "B1"]);
      expect(result.data.links).toHaveLength(4);
      const link = result.data.links.filter((item) => !(before.links as { public_id: string }[]).some((old) => old.public_id === item.id));
      expect(link).toHaveLength(1);
      expect(link[0]).toMatchObject({ predecessorExternalId: copies[0].externalId, successorExternalId: copies[1].externalId, type, lag });
      expect(copies[0]).toMatchObject({ requestedStart: "2026-10-05", start: "2026-10-06", duration: 2, baselineStart: null, baselineEnd: null, baselineDuration: null });
      expect(f.db.prepare("SELECT * FROM links ORDER BY id LIMIT 3").all()).toEqual(before.links);
      expect(f.db.prepare("SELECT * FROM tasks WHERE public_id=?").get(first.taskId)).toEqual((before.tasks as { public_id: string }[]).find((task) => task.public_id === first.taskId));
      expect(result.data.project.revision).toBe(f.revision + 1);
    }
  });
  it("prunes ancestor overlap and includes mixed nested/empty Summary once", async () => {
    const f = await fixture();
    const a = f.add("A", undefined, "summary"), nested = f.add("Nested", a, "summary");
    const leaf = f.add("Leaf", nested), empty = f.add("Empty", a, "summary");
    const independent = f.add("Independent"), target = f.add("Target", undefined, "summary");
    f.relate(leaf, independent, "SS", 1);
    const result = f.copy([independent.taskId, empty.taskId, leaf.taskId, a.taskId, nested.taskId], target);
    const roots = children(result.data.tasks, target.externalId);
    expect(roots.map((task) => task.name)).toEqual(["A", "Independent"]);
    const nestedCopies = children(result.data.tasks, roots[0].externalId);
    expect(nestedCopies.map((task) => task.name)).toEqual(["Nested", "Empty"]);
    expect(nestedCopies[1]).toMatchObject({ type: "summary", requestedStart: null, start: null, end: null, duration: null, progress: null });
    const leafCopy = children(result.data.tasks, nestedCopies[0].externalId)[0];
    expect(result.data.tasks).toHaveLength(11);
    expect(result.data.links).toHaveLength(2);
    expect(result.data.links[1]).toMatchObject({ predecessorExternalId: leafCopy.externalId, successorExternalId: roots[1].externalId });
  });
  it("keeps legacy single-source and descendant-anchor Copy compatibility", async () => {
    const f = await fixture();
    const root = f.add("A", undefined, "summary"), child = f.add("A1", root);
    const result = f.hierarchy.execute(f.authorization, f.revision, { kind: "copy", taskId: root.taskId, anchorTaskId: child.taskId, placement: "after" });
    expect(result.data.tasks).toHaveLength(4);
    expect(children(result.data.tasks, root.externalId).map((task) => task.name)).toEqual(["A1", "A"]);
  });
  it("rejects any assignment in the whole union", async () => {
    const f = await fixture();
    const first = f.add("First"), second = f.add("Second"), target = f.add("T", undefined, "summary");
    const stamp = clock().toISOString();
    const resource = f.db.prepare("INSERT INTO resources(public_id,name,created_at,updated_at) VALUES(?,?,?,?)").run(randomUUID(), "Worker", stamp, stamp).lastInsertRowid;
    const task = f.db.prepare("SELECT id,project_id FROM tasks WHERE public_id=?").get(second.taskId) as { id: number; project_id: number };
    f.db.prepare("INSERT INTO task_assignments(public_id,project_id,task_id,resource_id,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(randomUUID(), task.project_id, task.id, resource, stamp, stamp);
    const before = f.state();
    expect(() => f.copy([first.taskId, second.taskId], target)).toThrow(TaskCopyAssignmentUnsupportedError);
    expect(f.state()).toEqual(before);
  });
  it.each(["link", "revision"])("rolls back all Task/Link/order/type writes when %s fails", async (failure) => {
    const f = await fixture();
    const first = f.add("First"), second = f.add("Second"), target = f.add("Target");
    f.relate(first, second);
    const before = f.state();
    f.db.exec(failure === "link" ? "CREATE TRIGGER reject_copy BEFORE INSERT ON links BEGIN SELECT RAISE(ABORT,'copy link failure'); END"
      : "CREATE TRIGGER reject_copy BEFORE UPDATE OF revision ON projects BEGIN SELECT RAISE(ABORT,'copy revision failure'); END");
    expect(() => f.copy([first.taskId, second.taskId], target)).toThrow(/copy .* failure/);
    expect(f.state()).toEqual(before);
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
  it("checks final project size before identity allocation", async () => {
    const f = await fixture();
    const first = f.add("First"), second = f.add("Second"), target = f.add("Target", undefined, "summary");
    const stamp = clock().toISOString();
    const insert = f.db.prepare(`INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,parent_id,sort_order,created_at,updated_at)
      VALUES(?,?,?,?,'task','auto','2026-10-06','2026-10-06','2026-10-06',1,0,NULL,?,?,?)`);
    f.db.transaction(() => { for (let index = 3; index < 4999; index++) insert.run(f.authorization.projectId, `F${index}`, randomUUID(), `F${index}`, index, stamp, stamp); })();
    const before = f.state(), generator = vi.fn(() => randomUUID());
    const hierarchy = new TaskHierarchyService(f.db, { clock, generateTaskPublicId: generator });
    expect(() => hierarchy.execute(f.authorization, f.revision, { kind: "copy", taskIds: [first.taskId, second.taskId], anchorTaskId: target.taskId, placement: "child" })).toThrow(TaskLimitExceededError);
    expect(generator).not.toHaveBeenCalled(); expect(f.state()).toEqual(before);
  });
  it("rejects unknown/foreign sources and stale revisions without writes", async () => {
    const f = await fixture();
    const first = f.add("First"), second = f.add("Second"), target = f.add("Target", undefined, "summary");
    const other = await f.projects.create({ name: "Other", description: "", editPassword: "Pass123456!" });
    const auth = f.projects.authorize(other.response.data.project.publicId, other.rawSessionToken);
    if (auth.kind !== "authorized") throw new Error("expected session");
    const foreign = f.projects.createTask(auth.authorization, 1, { name: "Foreign", type: "task", start: "2026-10-05", duration: 1, progress: 0 }).data.tasks[0];
    const before = f.state();
    for (const id of [randomUUID(), foreign.taskId]) {
      expect(() => f.copy([first.taskId, id], target)).toThrow(TaskNotFoundError); expect(f.state()).toEqual(before);
    }
    expect(() => f.hierarchy.execute(f.authorization, f.revision - 1, { kind: "copy", taskIds: [first.taskId, second.taskId], anchorTaskId: target.taskId, placement: "child" })).toThrow(RevisionMismatchError);
  });
  it("validates direct service sources while retaining single reparent", async () => {
    const f = await fixture(), first = f.add("First"), target = f.add("Target", undefined, "summary");
    const before = f.state(), base = { kind: "copy", anchorTaskId: target.taskId, placement: "child" };
    for (const sources of [{}, { taskIds: [] }, { taskIds: [first.taskId, first.taskId] }, { taskIds: ["bad"] }, { taskId: first.taskId, taskIds: [first.taskId] }, { taskIds: [first.taskId], links: [] }, { taskIds: Array.from({ length: 501 }, () => randomUUID()) }]) {
      expect(() => f.hierarchy.execute(f.authorization, f.revision, { ...base, ...sources } as TaskHierarchyCommandRequest)).toThrow(InvalidTaskInputError); expect(f.state()).toEqual(before);
    }
    const moved = f.hierarchy.execute(f.authorization, f.revision, { kind: "reparent", taskId: first.taskId, anchorTaskId: target.taskId, placement: "child" });
    expect(moved.data.tasks).toHaveLength(2);
    expect(moved.data.tasks.find((task) => task.taskId === first.taskId)?.parentExternalId).toBe(target.externalId);
  });
  it("keeps linked leaf child conversion guarded for the entire copy", async () => {
    const f = await fixture();
    const first = f.add("First"), second = f.add("Second"), target = f.add("Target"), later = f.add("Later");
    f.relate(target, later); const before = f.state();
    expect(() => f.copy([first.taskId, second.taskId], target)).toThrow(UnsupportedScheduleStructureError); expect(f.state()).toEqual(before);
  });
  it("protects HTTP authorization, Origin, revision, source XOR and body limit", async () => {
    const f = await fixture(), first = f.add("First"), second = f.add("Second"), target = f.add("T", undefined, "summary");
    const body = { kind: "copy", taskIds: [second.taskId, first.taskId], anchorTaskId: target.taskId, placement: "child" };
    const invoke = (headers: Record<string, string>, override: unknown = body) => handleTaskHierarchyCommand(new Request(`https://gantt.example.com/api/projects/${f.publicId}/task-commands`, { method: "POST", headers, body: JSON.stringify(override) }), f.publicId,
      { authorizationService: f.projects, hierarchyService: f.hierarchy, applicationBaseUrl: "https://gantt.example.com", environment: "production" });
    const headers = { Origin: "https://gantt.example.com", "Content-Type": "application/json", Cookie: `__Host-mastergantt_edit=${f.rawToken}`, "If-Match": `"${f.revision}"` };
    const before = f.state();
    for (const [changes, status] of [[{ Origin: "https://evil.example.com" }, 403], [{ Cookie: "" }, 401], [{ "If-Match": '"1"' }, 412], [{ "If-Match": "*" }, 400]] as const) {
      expect((await invoke({ ...headers, ...changes })).status).toBe(status); expect(f.state()).toEqual(before);
    }
    expect((await invoke(headers, { ...body, taskId: first.taskId })).status).toBe(400); expect(f.state()).toEqual(before);
    const response = await invoke(headers); expect(response.status).toBe(200); expect(response.headers.get("ETag")).toBe(`"${f.revision + 1}"`);
    const result = await response.json(); expect(children(result.data.tasks, target.externalId).map((task) => task.name)).toEqual(["First", "Second"]);
    const success = f.state(); expect((await invoke(headers)).status).toBe(412); expect(f.state()).toEqual(success);
    expect((await invoke(headers, { ...body, padding: "x".repeat(33000) })).status).toBe(413); expect(f.state()).toEqual(success);
  });
  it("preserves Manual/Milestone inputs, original Baseline and metadata", async () => {
    const f = await fixture();
    const manualResponse = f.projects.createTask(f.authorization, f.revision, {
      name: "Manual", type: "task", start: "2026-10-06", duration: 2, progress: 50, scheduleMode: "manual",
    });
    f.revision = manualResponse.data.project.revision;
    const manual = manualResponse.data.tasks[0];
    const milestoneResponse = f.projects.createTask(f.authorization, f.revision, {
      name: "Milestone", type: "milestone", start: "2026-10-06", duration: 0, progress: 0,
    });
    f.revision = milestoneResponse.data.project.revision;
    const milestone = milestoneResponse.data.tasks.find((task) => task.name === "Milestone")!;
    const baseline = f.projects.updateTask(f.authorization, f.revision, manual.taskId, {
      baseline: { start: "2026-10-06", duration: 2 },
    });
    f.revision = baseline.data.project.revision;
    const target = f.add("Target", undefined, "summary");
    f.relate(manual, milestone, "SS", 0);
    f.db.prepare("UPDATE tasks SET description='kept', url='https://example.com/manual' WHERE public_id=?").run(manual.taskId);
    const original = f.db.prepare("SELECT * FROM tasks WHERE public_id=?").get(manual.taskId);
    const result = f.copy([milestone.taskId, manual.taskId], target);
    const copies = children(result.data.tasks, target.externalId);
    expect(copies[0]).toMatchObject({ name: "Manual", scheduleMode: "manual", requestedStart: "2026-10-06", start: "2026-10-06",
      duration: 2, progress: 50, description: "kept", url: "https://example.com/manual", baselineStart: null, baselineEnd: null, baselineDuration: null });
    expect(copies[1]).toMatchObject({ name: "Milestone", type: "milestone", requestedStart: "2026-10-06", start: "2026-10-06", duration: 0 });
    expect(f.db.prepare("SELECT * FROM tasks WHERE public_id=?").get(manual.taskId)).toEqual(original);
    expect(result.data.project.revision).toBe(f.revision + 1);
  });

  it("retains original logistics links without implicitly cloning them", async () => {
    const f = await fixture();
    const first = f.add("First"), second = f.add("Second"), target = f.add("Target", undefined, "summary");
    const stamp = clock().toISOString();
    const task = f.db.prepare("SELECT id,project_id FROM tasks WHERE public_id=?").get(first.taskId) as { id: number; project_id: number };
    const system = f.db.prepare(`INSERT INTO project_logistics_systems(public_id,project_id,code,name,system_type,layer,scope,created_at,updated_at)
      VALUES(?,?,?,'Controller','scs','controller','project',?,?)`).run(randomUUID(), task.project_id, "CTRL", stamp, stamp).lastInsertRowid;
    f.db.prepare("INSERT INTO task_system_links(project_id,task_id,system_id,scope,created_at,updated_at) VALUES(?,?,?,'self',?,?)").run(task.project_id, task.id, system, stamp, stamp);
    const before = f.db.prepare("SELECT * FROM task_system_links").all();
    const result = f.copy([first.taskId, second.taskId], target);
    expect(children(result.data.tasks, target.externalId)).toHaveLength(2);
    expect(f.db.prepare("SELECT * FROM task_system_links").all()).toEqual(before);
    expect(result.data.logistics?.systems).toHaveLength(1);
  });

  it("persists multi-root Tasks and internal Links across SQLite reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mastergantt-384-")); directories.push(directory);
    const filename = join(directory, "project.sqlite3"), f = await fixture(filename);
    const first = f.add("First"), second = f.add("Second"), target = f.add("T", undefined, "summary"); f.relate(first, second, "SS", 2);
    const result = f.copy([second.taskId, first.taskId], target), persisted = f.state(); f.db.close();
    const reopened = openDatabase({ filename, migrationsDirectory }).database; connections.push(reopened);
    const snapshot = new ProjectService(reopened, { clock }).getReadonlySnapshot(f.publicId)!;
    expect(snapshot.data.tasks).toEqual(result.data.tasks.map((task) => { const dto = { ...task }; delete dto.description; delete dto.url; return dto; })); expect(snapshot.data.links).toEqual(result.data.links);
    expect(snapshot.data.project.revision).toBe(result.data.project.revision);
    expect(reopened.prepare("SELECT * FROM tasks ORDER BY id").all()).toEqual(persisted.tasks);
    expect(reopened.pragma("foreign_key_check")).toEqual([]);
  });
});
