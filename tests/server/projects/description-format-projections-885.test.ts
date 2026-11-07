import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { TaskFieldSubtreeDeleteService } from "../../../src/server/projects/task-field-companion-services";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const clock = () => new Date("2026-09-14T01:00:00.000Z");
const hash = { algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2),
  n: 32768, r: 8, p: 3, keyLength: 32 };

describe("Issue #885 canonical description format after unrelated Task/Link mutations", () => {
  it("preserves Markdown Task format across Link writes and another Task's subtree delete", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const service = new TaskFieldProjectService(database, { clock, hashPassword: async () => hash });
      const created = await service.create({ name: "format projection", description: "", editPassword: "Pass123456!" });
      const projectId = created.response.data.project.publicId;
      const grant = service.authorize(projectId, created.rawSessionToken);
      if (grant.kind !== "authorized") throw new Error("Edit grant unavailable");
      const auth = grant.authorization;
      const a = service.createTask(auth, 1, { type: "task", name: "A", start: "2026-09-14", duration: 1, progress: 0 })
        .data.tasks.find(task => task.name === "A")!;
      const b = service.createTask(auth, 2, { type: "task", name: "B", start: "2026-09-15", duration: 1, progress: 0 })
        .data.tasks.find(task => task.name === "B")!;
      const c = service.createTask(auth, 3, { type: "task", name: "C", start: "2026-09-16", duration: 1, progress: 0 })
        .data.tasks.find(task => task.name === "C")!;
      const content = "**Important**\n\n- [x] Verified";
      const saved = service.updateTask(auth, 4, a.taskId, { description: content, descriptionFormat: "markdown" });
      const expected = { taskId: a.taskId, description: content, descriptionFormat: "markdown" };
      expect(saved.data.tasks.find(task => task.taskId === a.taskId)).toMatchObject(expected);
      const linked = new LinkService(database, clock).create(auth, 5, {
        predecessorExternalId: a.externalId, successorExternalId: b.externalId,
      });
      expect(linked.data.project.revision).toBe(6);
      expect(linked.data.tasks.find(task => task.taskId === a.taskId)).toMatchObject(expected);
      expect(service.getReadonlySnapshot(projectId)?.data.tasks.find(task => task.taskId === a.taskId))
        .toMatchObject(expected);
      const deleted = new TaskFieldSubtreeDeleteService(database, { clock })
        .deleteTaskSubtree(auth, 6, c.taskId);
      expect(deleted.data.project.revision).toBe(7);
      expect(deleted.data.tasks.some(task => task.taskId === c.taskId)).toBe(false);
      expect(deleted.data.tasks.find(task => task.taskId === a.taskId)).toMatchObject(expected);
      expect(service.getReadonlySnapshot(projectId)?.data.tasks.find(task => task.taskId === a.taskId))
        .toMatchObject(expected);
      expect(database.prepare("SELECT description, description_format FROM tasks WHERE public_id = ?")
        .get(a.taskId)).toMatchObject({ description: content, description_format: "markdown" });
    } finally {
      database.close();
    }
  });
});
