import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { createWorkingCalendar, recalculateDependencies, type DependencyLinkInput } from "../../../src/domain/scheduling";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { recalculateTaskCandidate } from "../../../src/domain/scheduling/task-candidate";
import { recalculatePersistedHierarchy } from "../../../src/server/projects/project-service-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { handleUpdateTask } from "../../../src/server/projects/task-handlers-core";

// Explicit benchmark only: correctness fixtures run in task-dependency-edit.test.ts.
describe.runIf(process.env.RUN_TASK_DEPENDENCY_BENCHMARK === "1")("5,000 Task dependency benchmark", () => {
  it.each(["chain", "branch", "join"] as const)("measures %s engine and real PATCH separately", async (shape) => {
    const database = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
    try {
      const clock = () => new Date("2026-09-11T01:00:00.000Z");
      const service = new TaskFieldProjectService(database, { clock, hashPassword: async () => ({ algorithm: "scrypt", salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2), n: 32768, r: 8, p: 3, keyLength: 32 }) });
      const created = await service.create({ name: "Benchmark", description: "", editPassword: "Pass123456!" });
      database.prepare("DELETE FROM work_calendar_rules").run();
      const auth = service.authorize(created.response.data.project.publicId, created.rawSessionToken);
      if (auth.kind !== "authorized") throw new Error("auth");
      const calendar = createWorkingCalendar({ timezone: "Asia/Seoul", weekendDays: [6, 0] });
      const tasks = Array.from({ length: 5000 }, (_, i) => ({ taskId: randomUUID(), externalId: `T${i}`, name: `Task ${i}`, type: "task" as const, scheduleMode: "auto" as const, requestedStart: "2026-09-14", start: "2026-09-14", end: "2026-09-14", duration: 1, progress: 0, parentExternalId: null, siblingOrder: i }));
      const links: DependencyLinkInput[] = [];
      for (let i = 1; i < tasks.length; i++) links.push({ id: randomUUID(), predecessorExternalId: shape === "chain" ? `T${i - 1}` : "T0", successorExternalId: `T${i}`, type: "FS", lag: 0 });
      if (shape === "join") for (let i = 1; i < 4999; i++) links.push({ id: randomUUID(), predecessorExternalId: `T${i}`, successorExternalId: "T4999", type: "FS", lag: 0 });
      const scheduled = recalculateDependencies(tasks, links, calendar).tasks;
      const repo = new ScheduleRepository(database);
      database.transaction(() => {
        const ids = new Map<string, number>();
        for (const t of scheduled) ids.set(t.externalId, repo.insertTask({ projectId: auth.authorization.projectId, publicId: t.taskId, externalId: t.externalId, name: t.name, type: t.type, scheduleMode: t.scheduleMode, requestedStart: t.requestedStart, startDate: t.start, endDate: t.end, duration: t.duration, progress: 0, parentId: null, sortOrder: t.siblingOrder, createdAt: clock().toISOString(), updatedAt: clock().toISOString() }).id);
        for (const l of links) repo.insertLink({ publicId: l.id, projectId: auth.authorization.projectId, predecessorTaskId: ids.get(l.predecessorExternalId)!, successorTaskId: ids.get(l.successorExternalId)!, type: l.type, lag: l.lag, createdAt: clock().toISOString(), updatedAt: clock().toISOString() });
      })();
      const records = repo.listTasks(auth.authorization.projectId), storedLinks = repo.listLinks(auth.authorization.projectId);
      recalculatePersistedHierarchy(records, calendar, storedLinks);
      const candidateTasks = service.getReadonlySnapshot(created.response.data.project.publicId)!.data.tasks;
      const engine: number[] = [], candidateEngine: number[] = [], patch: number[] = [], statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        let start = performance.now();
        recalculatePersistedHierarchy(records, calendar, storedLinks);
        if (i) engine.push(performance.now() - start);
        start = performance.now();
        recalculateTaskCandidate(candidateTasks.map((t, index) => index === 0 ? { ...t, duration: i % 2 ? 2 : 1 } : t), links, calendar);
        if (i) candidateEngine.push(performance.now() - start);
        const revision = service.getReadonlySnapshot(created.response.data.project.publicId)!.data.project.revision;
        const request = new Request(`https://gantt.example.com/api/projects/${created.response.data.project.publicId}/tasks/${tasks[0].taskId}`, { method: "PATCH", headers: { Origin: "https://gantt.example.com", Cookie: `__Host-mastergantt_edit=${created.rawSessionToken}`, "If-Match": `"${revision}"`, "Content-Type": "application/json" }, body: JSON.stringify({ duration: i % 2 ? 2 : 1 }) });
        start = performance.now();
        const response = await handleUpdateTask(request, created.response.data.project.publicId, tasks[0].taskId, { service, applicationBaseUrl: "https://gantt.example.com", environment: "production" });
        await response.json();
        if (i) { patch.push(performance.now() - start); statuses.push(response.status); }
      }
      expect(statuses).toEqual([200, 200, 200]);
      expect(Math.max(...candidateEngine)).toBeLessThanOrEqual(2000);
      expect(Math.max(...patch)).toBeLessThanOrEqual(5000);
      appendFileSync(process.env.TASK_BENCHMARK_REPORT ?? "/tmp/mastergantt-issue258-benchmark.jsonl", JSON.stringify({ shape, tasks: 5000, links: links.length, engineMs: engine.map(Math.round), candidateEngineMs: candidateEngine.map(Math.round), patchMs: patch.map(Math.round), statuses }) + "\n");
    } finally { database.close(); }
  }, 120000);
});
