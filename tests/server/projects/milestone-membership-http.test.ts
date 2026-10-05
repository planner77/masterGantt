import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CreateTaskRequest, TaskMutationResponse } from "../../../src/contracts/projects";
import { openDatabase } from "../../../src/server/db/core";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import {
  handleMilestoneMembershipCommand,
  handleUpdateTask,
} from "../../../src/server/projects/task-handlers-core";
import { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";

const origin = "https://gantt.example.com";
const clock = () => new Date("2026-10-05T01:00:00.000Z");
const dependencies = {
  applicationBaseUrl: origin,
  environment: "production",
  requestId: () => "membership-http-request",
};

async function createFixture() {
  const { database } = openDatabase({
    filename: ":memory:",
    migrationsDirectory: join(process.cwd(), "db", "migrations"),
  });
  const service = new TaskFieldProjectService(database, {
    clock,
    hashPassword: async () => ({
      algorithm: "scrypt" as const,
      salt: Buffer.alloc(16, 1),
      hash: Buffer.alloc(32, 2),
      n: 32_768,
      r: 8,
      p: 3,
      keyLength: 32,
    }),
  });
  const created = await service.create({
    name: "Stage membership HTTP fixture",
    description: "",
    editPassword: "Pass123456!",
  });
  const publicId = created.response.data.project.publicId;
  const rawToken = created.rawSessionToken;
  const revision = () => service.getReadonlySnapshot(publicId)!.data.project.revision;
  const authorization = () => {
    const result = service.authorize(publicId, rawToken);
    if (result.kind !== "authorized") throw new Error("Expected valid fixture session");
    return result.authorization;
  };
  const createTask = (input: CreateTaskRequest) => {
    const response = service.createTask(authorization(), revision(), input);
    return response.data.tasks.find((task) => task.externalId === input.externalId)!;
  };
  const summary = createTask({ externalId: "SUMMARY", name: "Phase", type: "summary" });
  const child = createTask({
    externalId: "CHILD", name: "Child", type: "task", parentTaskId: summary.taskId,
    start: "2026-10-06", duration: 3, progress: 25,
  });
  const peer = createTask({
    externalId: "PEER", name: "Peer", type: "task",
    start: "2026-10-06", duration: 2, progress: 50,
  });
  const firstGate = createTask({
    externalId: "GATE-1", name: "First gate", type: "milestone",
    parentTaskId: summary.taskId, start: "2026-10-09", duration: 0, progress: 0,
  });
  const secondGate = createTask({
    externalId: "GATE-2", name: "Second gate", type: "milestone",
    start: "2026-10-12", duration: 0, progress: 0,
  });
  return { database, service, publicId, rawToken, revision, authorization, summary, child, peer, firstGate, secondGate };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;
type RequestOptions = { cookie?: string | null; origin?: string | null; ifMatch?: string | null };

function makeRequest(value: Fixture, body: unknown, options: RequestOptions = {}, taskId?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.origin !== null) headers.set("Origin", options.origin ?? origin);
  if (options.cookie !== null) {
    headers.set("Cookie", options.cookie ?? `__Host-mastergantt_edit=${value.rawToken}`);
  }
  if (options.ifMatch !== null) headers.set("If-Match", options.ifMatch ?? `"${value.revision()}"`);
  const path = taskId ? `tasks/${taskId}` : "milestone-memberships";
  return new Request(`${origin}/api/projects/${value.publicId}/${path}`, {
    method: taskId ? "PATCH" : "POST", headers, body: JSON.stringify(body),
  });
}

function command(value: Fixture, changes: { taskId: string; milestoneTaskId: string | null }[], options?: RequestOptions) {
  return handleMilestoneMembershipCommand(makeRequest(value, { changes }, options), value.publicId, {
    ...dependencies, service: value.service,
  });
}

function storedState(value: Fixture) {
  return {
    tasks: value.database.prepare("SELECT * FROM tasks ORDER BY id").all(),
    links: value.database.prepare("SELECT * FROM links ORDER BY id").all(),
    assignments: value.database.prepare("SELECT * FROM task_assignments ORDER BY id").all(),
    memberships: value.database.prepare("SELECT * FROM task_milestone_memberships ORDER BY project_id, member_task_id").all(),
    projects: value.database.prepare("SELECT id, revision, updated_at FROM projects ORDER BY id").all(),
  };
}

async function expectRejection(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ error: { code, requestId: "membership-http-request" } });
}

describe("Issue #460 milestone membership HTTP-Service-SQLite contract", () => {
  let value: Fixture;
  beforeEach(async () => { value = await createFixture(); });
  afterEach(() => { value?.database.close(); });

  it("saves a multi-member command once and preserves schedules, WBS, Links and assignments", async () => {
    new LinkService(value.database, clock).create(value.authorization(), value.revision(), {
      predecessorExternalId: value.child.externalId,
      successorExternalId: value.peer.externalId,
      type: "SS", lag: 1,
    });
    const resources = new ResourceCatalogService(value.database, { clock });
    const admin = resources.unlockAdmin("Admin123456!", "Admin123456!")!;
    const catalog = resources.createTarget("resource", admin.rawToken, 1, {
      name: "Engineer", code: "R-1", roles: ["DEVELOPER"],
    });
    resources.replaceTaskAssignments(value.authorization(), value.revision(), value.child.taskId, {
      catalogRevision: catalog.data.revision,
      targets: [{
        kind: "resource", id: catalog.data.resources[0].id, role: "DEVELOPER",
        allocation: { start: "2026-10-06", end: "2026-10-07", percent: 50 },
      }],
    });
    const before = storedState(value);
    const beforeSnapshot = value.service.getReadonlySnapshot(value.publicId)!.data;
    const previousRevision = value.revision();

    const response = await command(value, [
      { taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId },
      { taskId: value.peer.taskId, milestoneTaskId: value.secondGate.taskId },
    ]);

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBe(`"${previousRevision + 1}"`);
    const body = await response.json() as TaskMutationResponse;
    expect(body.data.project.revision).toBe(previousRevision + 1);
    expect(body.data.tasks.map((task) => task.taskId)).toEqual(beforeSnapshot.tasks.map((task) => task.taskId));
    expect(body.data.links).toEqual(beforeSnapshot.links);
    expect(body.data.assignments).toEqual(beforeSnapshot.assignments);
    expect(body.data.tasks.find((task) => task.taskId === value.child.taskId)?.membership).toEqual({
      explicitMilestoneTaskId: null,
      effectiveMilestoneTaskId: value.firstGate.taskId,
      inheritedFromTaskId: value.summary.taskId,
    });
    expect(body.data.tasks.find((task) => task.taskId === value.firstGate.taskId)?.membership).toEqual({
      explicitMilestoneTaskId: null, effectiveMilestoneTaskId: null, inheritedFromTaskId: null,
    });
    expect(body.data.tasks.find((task) => task.taskId === value.firstGate.taskId)?.stageGate).toMatchObject({
      memberTaskIds: [value.child.taskId], memberCount: 1, memberProgressPercent: 25, ready: false,
    });
    const after = storedState(value);
    expect(after.tasks).toEqual(before.tasks);
    expect(after.links).toEqual(before.links);
    expect(after.assignments).toEqual(before.assignments);
    expect(after.memberships).toHaveLength(2);
    expect(value.service.getReadonlySnapshot(value.publicId)!.data.tasks).toEqual(body.data.tasks);
  });

  it("stores one explicit row per member, replaces it, and null restores ancestor inheritance", async () => {
    const initial = await command(value, [
      { taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId },
      { taskId: value.child.taskId, milestoneTaskId: value.secondGate.taskId },
    ]);
    expect(initial.status).toBe(200);
    const override = (await initial.json() as TaskMutationResponse).data.tasks.find((task) => task.taskId === value.child.taskId);
    expect(override?.membership).toEqual({
      explicitMilestoneTaskId: value.secondGate.taskId,
      effectiveMilestoneTaskId: value.secondGate.taskId,
      inheritedFromTaskId: null,
    });
    const replacement = await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }]);
    expect(replacement.status).toBe(200);
    expect(storedState(value).memberships).toHaveLength(2);
    const response = await command(value, [{ taskId: value.child.taskId, milestoneTaskId: null }]);
    expect(response.status).toBe(200);
    const tasks = (await response.json() as TaskMutationResponse).data.tasks;
    expect(tasks.find((task) => task.taskId === value.child.taskId)?.membership).toEqual({
      explicitMilestoneTaskId: null,
      effectiveMilestoneTaskId: value.firstGate.taskId,
      inheritedFromTaskId: value.summary.taskId,
    });
    expect(storedState(value).memberships).toHaveLength(1);
    const cleared = await command(value, [{ taskId: value.summary.taskId, milestoneTaskId: null }]);
    expect(cleared.status).toBe(200);
    expect((await cleared.json() as TaskMutationResponse).data.tasks.find((task) => task.taskId === value.child.taskId)?.membership)
      .toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: null, inheritedFromTaskId: null });
    expect(storedState(value).memberships).toHaveLength(0);
  });

  it("Task PATCH omission preserves explicit membership and explicit null restores inheritance", async () => {
    expect((await command(value, [
      { taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId },
      { taskId: value.child.taskId, milestoneTaskId: value.secondGate.taskId },
    ])).status).toBe(200);
    const renamed = await handleUpdateTask(makeRequest(value, { name: "Renamed" }, {}, value.child.taskId),
      value.publicId, value.child.taskId, { ...dependencies, service: value.service });
    expect(renamed.status).toBe(200);
    expect((await renamed.json() as TaskMutationResponse).data.tasks.find((task) => task.taskId === value.child.taskId)?.membership)
      .toMatchObject({ explicitMilestoneTaskId: value.secondGate.taskId, effectiveMilestoneTaskId: value.secondGate.taskId });
    const cleared = await handleUpdateTask(makeRequest(value, { explicitMilestoneTaskId: null }, {}, value.child.taskId),
      value.publicId, value.child.taskId, { ...dependencies, service: value.service });
    expect(cleared.status).toBe(200);
    expect((await cleared.json() as TaskMutationResponse).data.tasks.find((task) => task.taskId === value.child.taskId)?.membership)
      .toEqual({ explicitMilestoneTaskId: null, effectiveMilestoneTaskId: value.firstGate.taskId, inheritedFromTaskId: value.summary.taskId });
  });

  it.each(["missing", "malformed", "expired", "revoked", "auth-version"])(
    "rejects %s edit session before any membership or revision write", async (state) => {
      if (state === "expired") value.database.prepare("UPDATE edit_sessions SET expires_at = ?").run(clock().toISOString());
      if (state === "revoked") value.database.prepare("UPDATE edit_sessions SET revoked_at = ?").run(clock().toISOString());
      if (state === "auth-version") value.database.prepare("UPDATE edit_sessions SET auth_version = auth_version + 1").run();
      const before = storedState(value);
      const response = await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }], {
        cookie: state === "missing" ? null : state === "malformed" ? "__Host-mastergantt_edit=bad" : undefined,
      });
      await expectRejection(response, 401, "EDIT_SESSION_REQUIRED");
      expect(storedState(value)).toEqual(before);
    },
  );

  it("rejects a valid edit session issued for another Project", async () => {
    const other = await value.service.create({ name: "Other", description: "", editPassword: "Pass123456!" });
    const before = storedState(value);
    const response = await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }], {
      cookie: `__Host-mastergantt_edit=${other.rawSessionToken}`,
    });
    await expectRejection(response, 401, "EDIT_SESSION_REQUIRED");
    expect(storedState(value)).toEqual(before);
  });

  it.each([null, "null", "https://attacker.example.com", "http://gantt.example.com", "https://gantt.example.com:444"])(
    "rejects disallowed Origin %s without persisting", async (requestOrigin) => {
      const before = storedState(value);
      await expectRejection(await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }], {
        origin: requestOrigin,
      }), 403, "ORIGIN_NOT_ALLOWED");
      expect(storedState(value)).toEqual(before);
    },
  );

  it("rejects missing If-Match and stale revision with no partial batch writes", async () => {
    const before = storedState(value);
    const changes = [
      { taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId },
      { taskId: value.peer.taskId, milestoneTaskId: value.secondGate.taskId },
    ];
    await expectRejection(await command(value, changes, { ifMatch: null }), 428, "PRECONDITION_REQUIRED");
    expect(storedState(value)).toEqual(before);
    await expectRejection(await command(value, changes, { ifMatch: `"${value.revision() - 1}"` }), 412, "REVISION_MISMATCH");
    expect(storedState(value)).toEqual(before);
  });

  it.each(["milestone source", "task target", "summary target", "self", "missing source", "missing target"])(
    "rejects %s after an earlier valid change and rolls back the entire batch", async (invalid) => {
      const change = {
        taskId: invalid === "milestone source" ? value.firstGate.taskId : invalid === "missing source" ? randomUUID() : value.peer.taskId,
        milestoneTaskId: invalid === "task target" ? value.child.taskId
          : invalid === "summary target" ? value.summary.taskId
          : invalid === "self" ? value.peer.taskId
          : invalid === "missing target" ? randomUUID() : value.secondGate.taskId,
      };
      const before = storedState(value);
      const response = await command(value, [
        { taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId }, change,
      ]);
      await expectRejection(response, 409, "INVALID_MILESTONE_MEMBERSHIP");
      expect(storedState(value)).toEqual(before);
    },
  );

  it.each(["source", "target"])("rejects cross-Project %s and rolls back earlier changes", async (cross) => {
    const other = await value.service.create({ name: "Other", description: "", editPassword: "Pass123456!" });
    const otherPublicId = other.response.data.project.publicId;
    const auth = value.service.authorize(otherPublicId, other.rawSessionToken);
    if (auth.kind !== "authorized") throw new Error("Expected other Project authorization");
    const task = value.service.createTask(auth.authorization, 1, {
      externalId: "OTHER", name: "Other task", type: cross === "source" ? "task" : "milestone",
      start: "2026-10-06", duration: cross === "source" ? 1 : 0, progress: 0,
    }).data.tasks[0];
    const before = storedState(value);
    await expectRejection(await command(value, [
      { taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId },
      { taskId: cross === "source" ? task.taskId : value.peer.taskId,
        milestoneTaskId: cross === "target" ? task.taskId : value.secondGate.taskId },
    ]), 409, "INVALID_MILESTONE_MEMBERSHIP");
    expect(storedState(value)).toEqual(before);
  });

  it.each(["replace", "clear"])("restores an existing explicit row after a %s followed by an invalid batch member", async (operation) => {
    expect((await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }])).status).toBe(200);
    const before = storedState(value);
    await expectRejection(await command(value, [
      { taskId: value.child.taskId, milestoneTaskId: operation === "replace" ? value.secondGate.taskId : null },
      { taskId: value.peer.taskId, milestoneTaskId: randomUUID() },
    ]), 409, "INVALID_MILESTONE_MEMBERSHIP");
    expect(storedState(value)).toEqual(before);
    expect(value.service.getReadonlySnapshot(value.publicId)!.data.tasks.find((task) => task.taskId === value.child.taskId)?.membership)
      .toMatchObject({ explicitMilestoneTaskId: value.firstGate.taskId });
  });

  it.each(["duplicate", "omitted target", "effective spoof", "empty", "malformed UUID"])(
    "rejects invalid command shape %s without writes", async (invalid) => {
      const valid = { taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId };
      const changes = invalid === "duplicate" ? [valid, { ...valid, milestoneTaskId: value.secondGate.taskId }]
        : invalid === "omitted target" ? [{ taskId: value.child.taskId }]
        : invalid === "effective spoof" ? [{ ...valid, effectiveMilestoneTaskId: value.secondGate.taskId }]
        : invalid === "malformed UUID" ? [{ ...valid, taskId: "CHILD" }] : [];
      const before = storedState(value);
      const response = await handleMilestoneMembershipCommand(makeRequest(value, { changes }), value.publicId, {
        ...dependencies, service: value.service,
      });
      await expectRejection(response, 400, "INVALID_REQUEST");
      expect(storedState(value)).toEqual(before);
    },
  );

  it("locks inherited membership of a completed gate and permits changes after explicit reopen", async () => {
    expect((await command(value, [{ taskId: value.summary.taskId, milestoneTaskId: value.firstGate.taskId }])).status).toBe(200);
    value.service.updateTask(value.authorization(), value.revision(), value.child.taskId, { status: "completed" });
    value.service.updateTask(value.authorization(), value.revision(), value.firstGate.taskId, { status: "completed" });
    const before = storedState(value);
    const response = await command(value, [
      { taskId: value.peer.taskId, milestoneTaskId: value.secondGate.taskId },
      { taskId: value.child.taskId, milestoneTaskId: value.secondGate.taskId },
    ]);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: {
      code: "COMPLETED_MILESTONE_STRUCTURE_LOCKED",
      details: [expect.objectContaining({ message: value.firstGate.taskId })],
    } });
    expect(storedState(value)).toEqual(before);
    value.service.updateTask(value.authorization(), value.revision(), value.firstGate.taskId, { status: "in_progress" });
    expect((await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.secondGate.taskId }])).status).toBe(200);
  });

  it.each([{ status: "completed" }, { progress: 100 }])(
    "prevents premature gate completion through Task PATCH %j", async (patch) => {
      expect((await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }])).status).toBe(200);
      const before = storedState(value);
      const response = await handleUpdateTask(makeRequest(value, patch, {}, value.firstGate.taskId),
        value.publicId, value.firstGate.taskId, { ...dependencies, service: value.service });
      await expectRejection(response, 409, "MILESTONE_NOT_READY");
      expect(storedState(value)).toEqual(before);
    },
  );

  it("requires direct predecessor gate completion for a manual event and never completes it automatically", async () => {
    new LinkService(value.database, clock).create(value.authorization(), value.revision(), {
      predecessorExternalId: value.firstGate.externalId,
      successorExternalId: value.secondGate.externalId,
      type: "FF", lag: -1,
    });
    const before = storedState(value);
    await expectRejection(await handleUpdateTask(makeRequest(value, { progress: 100 }, {}, value.secondGate.taskId),
      value.publicId, value.secondGate.taskId, { ...dependencies, service: value.service }), 409, "MILESTONE_NOT_READY");
    expect(storedState(value)).toEqual(before);
    value.service.updateTask(value.authorization(), value.revision(), value.firstGate.taskId, { status: "completed" });
    const successor = value.service.getReadonlySnapshot(value.publicId)!.data.tasks.find((task) => task.taskId === value.secondGate.taskId)!;
    expect(successor.status).toBe("not_started");
    expect(successor.progress).toBe(0);
    expect(successor.stageGate).toMatchObject({
      manualEvent: true, ready: null, blocked: false, predecessorsCompleted: true,
    });
    const completion = await handleUpdateTask(makeRequest(value, { status: "completed" }, {}, value.secondGate.taskId),
      value.publicId, value.secondGate.taskId, { ...dependencies, service: value.service });
    expect(completion.status).toBe(200);
    expect((await completion.json() as TaskMutationResponse).data.tasks.find((task) => task.taskId === value.secondGate.taskId))
      .toMatchObject({ status: "completed", progress: 100 });
  });

  it("exposes Ready separately from completion and diagnoses member reopen without reopening the gate", async () => {
    expect((await command(value, [{ taskId: value.child.taskId, milestoneTaskId: value.firstGate.taskId }])).status).toBe(200);
    const ready = value.service.updateTask(value.authorization(), value.revision(), value.child.taskId, { status: "completed" });
    expect(ready.data.tasks.find((task) => task.taskId === value.firstGate.taskId))
      .toMatchObject({ status: "not_started", progress: 0, stageGate: { ready: true, memberProgressPercent: 100 } });
    value.service.updateTask(value.authorization(), value.revision(), value.firstGate.taskId, { status: "completed" });
    const reopenedMember = await handleUpdateTask(makeRequest(value, { status: "in_progress" }, {}, value.child.taskId),
      value.publicId, value.child.taskId, { ...dependencies, service: value.service });
    expect(reopenedMember.status).toBe(200);
    expect((await reopenedMember.json() as TaskMutationResponse).data.tasks.find((task) => task.taskId === value.firstGate.taskId))
      .toMatchObject({ status: "completed", progress: 100, stageGate: { completionInconsistent: true, ready: false } });
  });
});
