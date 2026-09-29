import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { handleUpdateTask } from "../../../src/server/projects/task-handlers-core";
import { createWorkingCalendar, recalculateDependencies, scheduleLeaf } from "../../../src/domain/scheduling";
import type { TaskMutationResponse, UpdateTaskRequest } from "../../../src/contracts/projects";

const migrationsDirectory = join(process.cwd(), "db/migrations");
const clock = () => new Date("2026-09-11T01:00:00.000Z");

async function fixture(options: { manual?: boolean; filename?: string; milestone?: boolean } = {}) {
  const database = openDatabase({ filename: options.filename ?? ":memory:", migrationsDirectory }).database;
  const service = new TaskFieldProjectService(database, { clock, hashPassword: async () => ({ algorithm: "scrypt", salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 }) });
  const created = await service.create({ name: "Dependency fixture", description: "", editPassword: "Pass123456!" });
  const publicId = created.response.data.project.publicId;
  database.prepare("DELETE FROM work_calendar_rules").run();
  const result = service.authorize(publicId, created.rawSessionToken);
  if (result.kind !== "authorized") throw new Error("authorization");
  const authorization = result.authorization;
  const repo = new ScheduleRepository(database);
  const now = clock().toISOString();
  const parent = repo.insertTask({ projectId: authorization.projectId, publicId: randomUUID(), externalId: "S", name: "Summary", type: "summary", scheduleMode: "auto", requestedStart: null, startDate: "2026-09-14", endDate: "2026-09-21", duration: 6, progress: 0, parentId: null, sortOrder: 0, createdAt: now, updatedAt: now });
  const tasks = ["A", "B", "C"].map((id, i) => repo.insertTask({ projectId: authorization.projectId, publicId: randomUUID(), externalId: id, name: id, description: `description ${id}`, url: "https://example.com", type: options.milestone && id === "C" ? "milestone" : "task", scheduleMode: options.manual && id === "C" ? "manual" : "auto", requestedStart: options.manual && id === "C" ? "2026-09-21" : "2026-09-14", startDate: options.manual && id === "C" ? "2026-09-21" : "2026-09-14", endDate: id === "A" ? "2026-09-16" : id === "B" ? "2026-09-15" : options.manual ? "2026-09-21" : "2026-09-14", duration: id === "A" ? 3 : id === "B" ? 2 : options.milestone ? 0 : 1, progress: 0, parentId: parent.id, sortOrder: i, baselineStart: "2026-09-14", baselineEnd: id === "A" ? "2026-09-16" : id === "B" ? "2026-09-15" : "2026-09-14", baselineDuration: id === "A" ? 3 : id === "B" ? 2 : options.milestone ? 0 : 1, createdAt: now, updatedAt: now }));
  const links = new LinkService(database, clock);
  links.create(authorization, 1, { predecessorExternalId: "A", successorExternalId: "B" });
  links.create(authorization, 2, { predecessorExternalId: "B", successorExternalId: "C" });
  const snapshot = () => service.getReadonlySnapshot(publicId)!.data;
  const patch = async (id: string, body: unknown, headers: Record<string, string> = {}) => {
    const task = tasks.find(t => t.externalId === id)!;
    const request = new Request(`https://gantt.example.com/api/projects/${publicId}/tasks/${task.publicId}`, { method: "PATCH", headers: { Origin: "https://gantt.example.com", Cookie: `__Host-mastergantt_edit=${created.rawSessionToken}`, "Content-Type": "application/json", "If-Match": `"${snapshot().project.revision}"`, ...headers }, body: JSON.stringify(body) });
    return handleUpdateTask(request, publicId, task.publicId, { service, applicationBaseUrl: "https://gantt.example.com", environment: "production" });
  };
  return { database, service, repo, tasks, publicId, authorization, links, snapshot, patch };
}

const dates = (tasks: TaskMutationResponse["data"]["tasks"]) => tasks.filter(t => t.type !== "summary").map(t => [t.externalId, t.requestedStart, t.start, t.end]);

describe("Issue #258 real linked Task PATCH", () => {
  it.each([
    { name: "renamed" }, { description: "changed", url: "https://example.org" },
    { progress: 50 }, { baseline: { start: "2026-09-17", duration: 2 } },
    { name: "mixed", baseline: null }, { baselineStart: "2026-09-17", baselineDuration: 2, baselineEnd: "2026-09-18" },
  ] satisfies UpdateTaskRequest[])("preserves effective and requested dates for field-only %j", async (input) => {
    const f = await fixture();
    try {
      const before = f.snapshot();
      expect(dates(before.tasks)).toEqual([["A", "2026-09-14", "2026-09-14", "2026-09-16"], ["B", "2026-09-14", "2026-09-17", "2026-09-18"], ["C", "2026-09-14", "2026-09-21", "2026-09-21"]]);
      const response = await f.patch("B", input);
      expect(response.status).toBe(200);
      const body = await response.json() as TaskMutationResponse;
      expect(dates(body.data.tasks)).toEqual(dates(before.tasks));
      expect(body.data.project.revision).toBe(4);
      expect(body.data.links).toEqual(before.links);
      expect(body.data.assignments).toEqual(before.assignments);
      expect(body.data.logistics).toEqual(before.logistics);
      expect(body.data.tasks).toEqual(f.snapshot().tasks);
      expect(body.data.operation.changedTaskExternalIds).toContain("B");
      if (input.progress) {
        expect(body.data.tasks.find(t => t.externalId === "S")!.progress).toBeCloseTo(100 / 6);
        expect(body.data.operation.changedTaskExternalIds).toContain("S");
      }
    } finally { f.database.close(); }
  });

  it.each([5, 1])("recalculates delayed and advanced successor/Summary schedules after duration %i", async (duration) => {
    const f = await fixture();
    try {
      const before = f.snapshot();
      const response = await f.patch("A", { duration, name: "changed" });
      expect(response.status).toBe(200);
      const body = await response.json() as TaskMutationResponse;
      expect(body.data.tasks.filter(t => t.type !== "summary").map(t => [t.start, t.end])).toEqual(duration === 5
        ? [["2026-09-14", "2026-09-18"], ["2026-09-21", "2026-09-22"], ["2026-09-23", "2026-09-23"]]
        : [["2026-09-14", "2026-09-14"], ["2026-09-15", "2026-09-16"], ["2026-09-17", "2026-09-17"]]);
      expect(new Set(body.data.operation.changedTaskExternalIds)).toEqual(new Set(["A", "B", "C", "S"]));
      expect(body.data.tasks.map(t => [t.baselineStart, t.baselineDuration, t.baselineEnd])).toEqual(before.tasks.map(t => [t.baselineStart, t.baselineDuration, t.baselineEnd]));
      expect(body.data.tasks.filter(t => t.type !== "summary").map(t => t.requestedStart)).toEqual(["2026-09-14", "2026-09-14", "2026-09-14"]);
      expect(f.snapshot().tasks).toEqual(body.data.tasks);
      expect(body.data.project.revision).toBe(4);
    } finally { f.database.close(); }
  });

  it.each(["FS", "SS", "FF", "SF"] as const)("persists %s with lead/lag and a strongest second predecessor", async (type) => {
    for (const lag of [-2, 0, 2]) {
      const f = await fixture();
      try {
        const firstLink = f.snapshot().links.find(l => l.predecessorExternalId === "A")!;
        f.links.update(f.authorization, 3, firstLink.id, { type, lag });
        const d = f.repo.insertTask({ projectId: f.authorization.projectId, publicId: randomUUID(), externalId: "D", name: "D", type: "task", scheduleMode: "auto", requestedStart: "2026-09-18", startDate: "2026-09-18", endDate: "2026-09-18", duration: 1, progress: 0, parentId: null, sortOrder: 1, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
        expect(d).toBeDefined();
        const revision = f.snapshot().project.revision;
        f.links.create(f.authorization, revision, { predecessorExternalId: "D", successorExternalId: "B", type: "FS" });
        const before = f.snapshot();
        const response = await f.patch("A", { duration: 5 });
        expect(response.status).toBe(200);
        const body = await response.json() as TaskMutationResponse;
        const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] });
        const normalized = before.tasks.map(t => t.type === "summary" ? t : { ...t, ...scheduleLeaf({ type: t.type, requestedStart: t.requestedStart!, duration: t.externalId === "A" ? 5 : t.duration, scheduleMode: t.scheduleMode }, calendar) });
        const expected = recalculateDependencies(normalized, before.links, calendar);
        expect(dates(body.data.tasks)).toEqual(dates([...expected.tasks]));
        expect(body.data.links).toEqual(before.links);
      } finally { f.database.close(); }
    }
  });

  it("preserves populated logistics links in field-only and schedule mutation snapshots", async () => {
    const f = await fixture();
    try {
      const now = clock().toISOString();
      const process = f.database.prepare("INSERT INTO project_processes (public_id, project_id, code, name, created_at, updated_at) VALUES (?, ?, 'P', 'Process', ?, ?)").run(randomUUID(), f.authorization.projectId, now, now);
      const equipment = f.database.prepare("INSERT INTO project_equipment (public_id, project_id, process_id, code, name, equipment_type, management_unit, quantity, created_at, updated_at) VALUES (?, ?, ?, 'E', 'Equipment', 'other', 'unit', 1, ?, ?)").run(randomUUID(), f.authorization.projectId, Number(process.lastInsertRowid), now, now);
      f.database.prepare("INSERT INTO task_equipment_links (project_id, task_id, equipment_id, scope, created_at, updated_at) VALUES (?, ?, ?, 'self', ?, ?)").run(f.authorization.projectId, f.tasks[1].id, Number(equipment.lastInsertRowid), now, now);
      const before = f.snapshot();
      for (const [id, input] of [["B", { name: "Renamed" }], ["A", { duration: 5 }]] as const) {
        const response = await f.patch(id, input);
        expect(response.status).toBe(200);
        const body = await response.json() as TaskMutationResponse;
        expect(body.data.logistics).toEqual(before.logistics);
        expect(body.data.links).toEqual(before.links);
      }
      expect(f.database.prepare("SELECT count(*) FROM task_equipment_links").pluck().get()).toBe(1);
    } finally { f.database.close(); }
  });

  it("persists metadata and adjusted schedule identically after SQLite reopen", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mastergantt-258-"));
    const filename = join(directory, "fixture.sqlite3");
    const f = await fixture({ filename });
    try {
      expect((await f.patch("B", { name: "Persisted", description: "details", baseline: { start: "2026-09-17", duration: 2 } })).status).toBe(200);
      expect((await f.patch("A", { duration: 5 })).status).toBe(200);
      const snapshot = f.snapshot();
      f.database.close();
      const reopened = openDatabase({ filename, migrationsDirectory }).database;
      try { expect(new TaskFieldProjectService(reopened, { clock }).getReadonlySnapshot(f.publicId)!.data).toEqual(snapshot); }
      finally { reopened.close(); }
    } finally { if (f.database.open) f.database.close(); rmSync(directory, { recursive: true, force: true }); }
  });

  it("rolls mixed metadata/Baseline and all schedules back on a Manual successor conflict", async () => {
    const f = await fixture({ manual: true });
    try {
      const before = f.snapshot(), rows = f.database.prepare("SELECT * FROM tasks ORDER BY id").all();
      const response = await f.patch("A", { duration: 5, name: "must rollback", description: "no", baseline: null });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: "MANUAL_DEPENDENCY_CONFLICT" } });
      expect(f.snapshot()).toEqual(before);
      expect(f.database.prepare("SELECT * FROM tasks ORDER BY id").all()).toEqual(rows);
    } finally { f.database.close(); }
  });

  it("rejects direct Auto→Manual conflict and permits Manual at the explicit effective date", async () => {
    const f = await fixture();
    try {
      expect((await f.patch("B", { scheduleMode: "manual" })).status).toBe(409);
      expect(f.snapshot().project.revision).toBe(3);
      expect((await f.patch("B", { start: "2026-09-17", scheduleMode: "manual" })).status).toBe(200);
      expect(f.snapshot().tasks.find(t => t.externalId === "B")).toMatchObject({ requestedStart: "2026-09-17", scheduleMode: "manual", start: "2026-09-17" });
      expect((await f.patch("B", { scheduleMode: "auto", start: "2026-09-14" })).status).toBe(200);
      expect(f.snapshot().tasks.find(t => t.externalId === "B")).toMatchObject({ requestedStart: "2026-09-14", scheduleMode: "auto", start: "2026-09-17" });
    } finally { f.database.close(); }
  });

  it.each(["successor", "target", "nullable"])("checks final %s resource allocation atomically", async (kind) => {
    const f = await fixture();
    try {
      const resources = new ResourceCatalogRepository(f.database);
      const resource = resources.insertResource({ publicId: randomUUID(), name: "Assigned", code: null, description: "", now: clock().toISOString() });
      const task = f.tasks[kind === "target" ? 0 : 1];
      f.database.prepare("INSERT INTO task_assignments (public_id, project_id, task_id, resource_id, created_at, updated_at, assignment_start, assignment_end, allocation_percent) VALUES (?,?,?,?,?,?,?,?,?)").run(randomUUID(), f.authorization.projectId, task.id, resource.id, clock().toISOString(), clock().toISOString(), kind === "nullable" ? null : kind === "target" ? "2026-09-16" : "2026-09-17", kind === "nullable" ? null : kind === "target" ? "2026-09-16" : "2026-09-18", 50);
      const before = f.snapshot();
      const response = await f.patch("A", { duration: kind === "target" ? 1 : 5, name: "new name", description: "new details", baseline: null });
      if (kind === "nullable") {
        expect(response.status).toBe(200);
        const body = await response.json() as TaskMutationResponse;
        expect(body.data.assignments).toEqual(before.assignments);
      } else {
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: { code: "RESOURCE_ASSIGNMENT_SCHEDULE_CONFLICT" } });
        expect(f.snapshot()).toEqual(before);
      }
    } finally { f.database.close(); }
  });

  it("preserves strict dependency-preceding end assertions and rejects mixed unknown fields", async () => {
    const f = await fixture();
    try {
      const before = f.snapshot();
      expect((await f.patch("B", { duration: 2, end: "2026-09-18", name: "invalid" })).status).toBe(422);
      expect((await f.patch("B", { end: "2026-09-18", name: "invalid" })).status).toBe(400);
      expect((await f.patch("B", { type: "milestone", name: "invalid" })).status).toBe(400);
      expect(f.snapshot()).toEqual(before);
      expect((await f.patch("B", { duration: 2, end: "2026-09-15" })).status).toBe(200);
      expect(f.snapshot().tasks.find(t => t.externalId === "B")!.end).toBe("2026-09-18");
    } finally { f.database.close(); }
  });

  it("keeps linked Milestone metadata/progress/Baseline editable and reschedules its instant", async () => {
    const f = await fixture({ milestone: true });
    try {
      expect((await f.patch("C", { name: "Milestone", progress: 100, baseline: { start: "2026-09-21", duration: 0 } })).status).toBe(200);
      expect(f.snapshot().tasks.find(t => t.externalId === "C")).toMatchObject({ start: "2026-09-21", end: "2026-09-21", duration: 0 });
      expect((await f.patch("A", { duration: 5 })).status).toBe(200);
      expect(f.snapshot().tasks.find(t => t.externalId === "C")).toMatchObject({ start: "2026-09-23", end: "2026-09-23", duration: 0, baselineStart: "2026-09-21" });
    } finally { f.database.close(); }
  });

  it("keeps Origin/session/revision checks and accepts only one concurrent stale writer", async () => {
    const f = await fixture();
    try {
      expect((await f.patch("B", { name: "bad" }, { Origin: "https://other.example" })).status).toBe(403);
      expect((await f.patch("B", { name: "bad" }, { Cookie: "" })).status).toBe(401);
      expect((await f.patch("B", { name: "bad" }, { "If-Match": "" })).status).toBe(400);
      const responses = await Promise.all([f.patch("A", { duration: 5 }, { "If-Match": '"3"' }), f.patch("B", { name: "stale" }, { "If-Match": '"3"' })]);
      expect(responses.map(r => r.status)).toEqual([200, 412]);
      expect(f.snapshot().project.revision).toBe(4);
      expect(f.snapshot().tasks.find(t => t.externalId === "B")!.name).toBe("B");
      expect(() => f.service.deleteTask(f.authorization, 4, f.tasks[1].publicId)).toThrow(expect.objectContaining({ name: "UnsupportedScheduleStructureError" }));
      expect(f.snapshot().project.revision).toBe(4);
    } finally { f.database.close(); }
  });
});
