import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ReplaceTaskAssignmentsRequest } from "../../../src/contracts/resources";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { handleReplaceTaskAssignments } from "../../../src/server/resources/resource-catalog-handlers-core";
import { ResourceCatalogInvalidInputError, ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const NOW = "2026-10-14T00:00:00.000Z";
const LATER = "2026-10-14T01:00:00.000Z";
const databases: ReturnType<typeof openDatabase>["database"][] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

function fixture() {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") });
  databases.push(database);
  const projects = new ProjectRepository(database), schedules = new ScheduleRepository(database);
  const sessions = new EditSessionRepository(database), catalog = new ResourceCatalogRepository(database);
  const project = projects.insert({ publicId: randomUUID(), name: "Exact assignment", description: "", passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2), scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32, calendarTimezone: "Asia/Seoul", createdAt: NOW, updatedAt: NOW });
  const token = createSessionToken(), expiresAt = "2026-10-15T00:00:00.000Z";
  const sessionId = sessions.insert({ projectId: project.id, tokenHash: token.tokenHash, authVersion: project.authVersion, createdAt: NOW, expiresAt });
  const authorization = { projectId: project.id, projectPublicId: project.publicId, projectRevision: 1, projectAuthVersion: project.authVersion, sessionId, tokenHash: token.tokenHash, expiresAt };
  const addTask = (type: "task" | "summary" = "task") => schedules.insertTask({ projectId: project.id, externalId: randomUUID(), publicId: randomUUID(), name: "Shared Task", type, scheduleMode: "auto", requestedStart: type === "summary" ? null : "2026-10-01", startDate: "2026-10-01", endDate: "2026-10-30", duration: 22, progress: 0, parentId: null, sortOrder: 0, createdAt: NOW, updatedAt: NOW });
  const task = addTask(), otherTask = addTask();
  const people = ["Edited", "Null with dates", "Inactive"].map(name => catalog.insertResource({ publicId: randomUUID(), name, code: null, description: "", now: NOW }));
  const group = catalog.insertGroup({ publicId: randomUUID(), name: "Group", code: null, description: "", now: NOW });
  const targets = people.map((resource, index) => ({ kind: "resource" as const, publicId: resource.publicId, internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: index === 1 ? "2026-10-05" : null, assignmentEnd: index === 1 ? "2026-10-20" : null, allocationPercent: index === 0 ? 50 : null }));
  catalog.replaceTaskAssignments({ projectId: project.id, taskId: task.id, now: NOW, targets: [...targets, { kind: "group", publicId: group.publicId, internalId: group.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: null }] });
  catalog.replaceTaskAssignments({ projectId: project.id, taskId: otherTask.id, now: NOW, targets: [{ ...targets[0], assignmentPublicId: randomUUID() }] });
  database.prepare("UPDATE resources SET active=0 WHERE id=?").run(people[2].id);
  const service = new ResourceCatalogService(database, { clock: () => new Date(LATER) });
  const projectService = new TaskFieldProjectService(database, { clock: () => new Date(LATER) });
  const request: ReplaceTaskAssignmentsRequest = { catalogRevision: catalog.getRevision(), editAssignmentId: targets[0].assignmentPublicId, targets: [{ kind: "resource", id: people[0].publicId, allocation: { start: "2026-10-06", end: "2026-10-15", percent: 75 } }] };
  const state = () => ({ project: projects.findById(project.id), tasks: schedules.listTasks(project.id), assignments: database.prepare("SELECT * FROM task_assignments ORDER BY id").all() });
  const http = (body: unknown = request, overrides: Record<string, string | null> = {}, targetTask = task.publicId) => {
    const headers = new Headers({ origin: "https://gantt.example", "if-match": '"1"', "content-type": "application/json", cookie: `__Host-mastergantt_edit=${token.rawToken}` });
    for (const [key, value] of Object.entries(overrides)) { if (value === null) headers.delete(key); else headers.set(key, value); }
    return handleReplaceTaskAssignments(new Request(`https://gantt.example/api/projects/${project.publicId}/tasks/${targetTask}/assignments`, { method: "PUT", headers, body: JSON.stringify(body) }), project.publicId, targetTask, { resourceService: service, projectService, applicationBaseUrl: "https://gantt.example", environment: "production" });
  };
  return { database, projects, catalog, service, task, otherTask, addTask, people, group, authorization, request, state, http };
}

describe("Issue #621 exact canonical Assignment allocation", () => {
  it("updates only one existing row and preserves IDs, nullable dates+percent, inactive coassignees and Task bytes", async () => {
    const f = fixture(), before = f.state();
    const response = await f.http();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.operation.changed).toBe(true);
    expect(result.data.projectRevision).toBe(2);
    expect(response.headers.get("etag")).toBe('"2"');
    const after = f.state();
    expect(after.tasks).toEqual(before.tasks);
    expect(after.assignments.slice(1)).toEqual(before.assignments.slice(1));
    expect(after.assignments[0]).toEqual({ ...before.assignments[0] as object, assignment_start: "2026-10-06", assignment_end: "2026-10-15", allocation_percent: 75, updated_at: LATER });
    expect(result.data.assignments.map((row: { id: string }) => row.id)).toEqual(f.catalog.listAssignments(f.authorization.projectId).map(row => row.publicId));
    const noOpBefore = f.state();
    const noOp = await f.http(f.request, { "if-match": '"2"' });
    expect(noOp.status).toBe(200);
    expect((await noOp.json()).data.operation.changed).toBe(false);
    expect(f.state()).toEqual(noOpBefore);
    const cleared = f.service.replaceTaskAssignments(f.authorization, 2, f.task.publicId, { ...f.request, targets: [{ kind: "resource", id: f.people[0].publicId }] });
    expect(cleared.data.assignments[0]).toMatchObject({ id: f.request.editAssignmentId, allocation: { start: null, end: null, percent: null } });
    expect(f.state().assignments.slice(1)).toEqual(before.assignments.slice(1));
  });

  it.each([
    ["missing ID", (f: ReturnType<typeof fixture>) => ({ ...f.request, editAssignmentId: randomUUID() })],
    ["noncanonical ID", (f: ReturnType<typeof fixture>) => ({ ...f.request, editAssignmentId: "wrong" })],
    ["null ID", (f: ReturnType<typeof fixture>) => ({ ...f.request, editAssignmentId: null })],
    ["wrong Resource", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ kind: "resource", id: f.people[1].publicId }] })],
    ["Group", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ kind: "group", id: f.group.publicId }] })],
    ["empty", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [] })],
    ["duplicate", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [f.request.targets[0], f.request.targets[0]] })],
    ["impossible date", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], allocation: { start: "2026-02-30", percent: 70 } }] })],
    ["date outside Task", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], allocation: { start: "2026-09-30", percent: 70 } }] })],
    ["reversed dates", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], allocation: { start: "2026-10-20", end: "2026-10-05", percent: 70 } }] })],
    ["null percent", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], allocation: { percent: null } }] })],
    ["zero percent", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], allocation: { percent: 0 } }] })],
    ["over percent", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], allocation: { percent: 101 } }] })],
    ["non-authoritative role", (f: ReturnType<typeof fixture>) => ({ ...f.request, targets: [{ ...f.request.targets[0], role: "PI" }] })],
    ["unknown scope", (f: ReturnType<typeof fixture>) => ({ ...f.request, scope: "all" })],
  ])("atomically rejects %s", async (_label, build) => {
    const f = fixture(), before = f.state();
    expect((await f.http(build(f))).status).toBe(400);
    expect(f.state()).toEqual(before);
  });

  it("rejects assignment IDs from another Task/Project and non-task headers", async () => {
    const f = fixture(), foreign = fixture(), before = f.state();
    expect((await f.http(f.request, {}, f.otherTask.publicId)).status).toBe(400);
    expect((await f.http({ ...f.request, editAssignmentId: foreign.request.editAssignmentId })).status).toBe(400);
    const summary = f.addTask("summary");
    f.database.prepare("UPDATE task_assignments SET task_id=? WHERE public_id=?").run(summary.id, f.request.editAssignmentId);
    const withSummary = f.state();
    expect((await f.http(f.request, {}, summary.publicId)).status).toBe(400);
    expect(f.state()).toEqual(withSummary);
    expect(before.project?.revision).toBe(f.projects.findById(f.authorization.projectId)?.revision);
  });

  it.each([
    ["readonly", { cookie: null }, 401],
    ["foreign Origin", { origin: "https://evil.example" }, 403],
    ["missing Origin", { origin: null }, 403],
    ["missing revision", { "if-match": null }, 428],
    ["weak revision", { "if-match": 'W/"1"' }, 400],
    ["stale revision", { "if-match": '"2"' }, 412],
  ] as const)("retains %s protection", async (_label, headers, status) => {
    const f = fixture(), before = f.state();
    expect((await f.http(f.request, headers)).status).toBe(status);
    expect(f.state()).toEqual(before);
  });

  it("retains catalog revision, inactive-target and revoked/expired session protection", async () => {
    const f = fixture(), before = f.state();
    expect((await f.http({ ...f.request, catalogRevision: f.request.catalogRevision + 1 })).status).toBe(412);
    f.database.prepare("UPDATE resources SET active=0 WHERE public_id=?").run(f.people[0].publicId);
    expect((await f.http()).status).toBe(409);
    f.database.prepare("UPDATE resources SET active=1 WHERE public_id=?").run(f.people[0].publicId);
    f.database.prepare("UPDATE edit_sessions SET expires_at=? WHERE id=?").run(NOW, f.authorization.sessionId);
    expect((await f.http()).status).toBe(401);
    f.database.prepare("UPDATE edit_sessions SET expires_at=?, revoked_at=? WHERE id=?").run("2026-10-15T00:00:00.000Z", NOW, f.authorization.sessionId);
    expect((await f.http()).status).toBe(401);
    expect(f.state()).toEqual(before);
  });

  it("rolls back the row update when revision advancement fails", () => {
    const f = fixture(), before = f.state();
    f.database.exec("CREATE TRIGGER reject_revision BEFORE UPDATE OF revision ON projects BEGIN SELECT RAISE(ABORT, 'injected revision failure'); END");
    expect(() => f.service.replaceTaskAssignments(f.authorization, 1, f.task.publicId, f.request)).toThrow("injected revision failure");
    expect(f.state()).toEqual(before);
    expect(() => f.service.replaceTaskAssignments(f.authorization, 1, f.task.publicId, { ...f.request, editAssignmentId: "wrong" })).toThrow(ResourceCatalogInvalidInputError);
  });
});
