import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ProjectSnapshotResponse, TaskMutationResponse } from "../../../src/contracts/projects";
import { openDatabase } from "../../../src/server/db/core";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { handleReadProject } from "../../../src/server/projects/project-handlers-core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { handleDeleteTask } from "../../../src/server/projects/task-handlers-core";
import { TaskSubtreeDeleteService } from "../../../src/server/projects/task-subtree-delete-service-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const clock = () => new Date("2026-09-30T01:00:00.000Z");
const dependencies = {
  applicationBaseUrl: "https://gantt.example.com",
  environment: "production",
  requestId: () => "delete-recovery-request",
};

async function fixture(includeDescendants: boolean) {
  const directory = mkdtempSync(join(tmpdir(), "mastergantt-delete-recovery-"));
  const filename = join(directory, "project.sqlite3");
  const database = openDatabase({ filename, migrationsDirectory }).database;
  const service = new ProjectService(database, {
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
  try {
    const created = await service.create({
      name: "Deletion recovery", description: "", editPassword: "Pass123456!",
    });
    const publicId = created.response.data.project.publicId;
    const authorization = service.authorize(publicId, created.rawSessionToken);
    if (authorization.kind !== "authorized") throw new Error("Expected authorization.");
    let revision = created.response.data.project.revision;
    const addTask = (externalId: string, parentTaskId?: string, convertParentToSummary = false) => {
      const result = service.createTask(authorization.authorization, revision, {
        externalId, name: externalId, type: "task", start: "2026-09-30", duration: 1, progress: 0,
        ...(parentTaskId ? { parentTaskId } : {}),
        ...(convertParentToSummary ? { convertParentToSummary: true } : {}),
      });
      revision = result.data.project.revision;
      return result.data.tasks.find((task) => task.externalId === externalId)!;
    };
    const summary = addTask("S");
    const lastChild = addTask("A", summary.taskId, true);
    if (includeDescendants) addTask("A-CHILD", lastChild.taskId, true);
    const first = addTask("C");
    const second = addTask("D");
    const root = addTask("ROOT");
    const nested = addTask("NESTED", root.taskId, true);
    addTask("GRANDCHILD", nested.taskId, true);
    addTask("X");
    addTask("Y");
    const linked = new LinkService(database, clock).create(authorization.authorization, revision, {
      predecessorExternalId: "X", successorExternalId: "Y", type: "FS", lag: 0,
    });
    const subtree = new TaskSubtreeDeleteService(database, { clock });
    // Match the route's includeDescendants service dispatch without mocking its transaction.
    const subtreeApi = {
      authorize: service.authorize.bind(service),
      createTask: service.createTask.bind(service),
      updateTask: service.updateTask.bind(service),
      deleteTask: subtree.deleteTaskSubtree.bind(subtree),
    };
    const remove = (
      taskId: string,
      expectedRevision: number,
      options: { subtree?: boolean; headers?: Record<string, string> } = {},
    ) => handleDeleteTask(new Request(
      `${dependencies.applicationBaseUrl}/api/projects/${publicId}/tasks/${taskId}${options.subtree ? "?includeDescendants=true" : ""}`,
      {
        method: "DELETE",
        headers: {
          Origin: dependencies.applicationBaseUrl,
          Cookie: `__Host-mastergantt_edit=${created.rawSessionToken}`,
          "If-Match": `"${expectedRevision}"`,
          ...options.headers,
        },
      },
    ), publicId, taskId, {
      ...dependencies,
      service: options.subtree ? subtreeApi : service,
    });
    return {
      database, directory, filename, service, publicId, first, second, root, lastChild, remove,
      revision: linked.data.project.revision,
      links: linked.data.links,
    };
  } catch (error) {
    database.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function storedAggregate(value: Awaited<ReturnType<typeof fixture>>) {
  return {
    projects: value.database.prepare("SELECT * FROM projects ORDER BY id").all(),
    tasks: value.database.prepare("SELECT * FROM tasks ORDER BY id").all(),
    links: value.database.prepare("SELECT * FROM links ORDER BY id").all(),
  };
}

async function canonicalGet(service: ProjectService, publicId: string, revision: number) {
  const response = handleReadProject(publicId, { service });
  expect(response.status).toBe(200);
  expect(response.headers.get("etag")).toBe(`"${revision}"`);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = await response.json() as ProjectSnapshotResponse;
  expect(body.data.project.revision).toBe(revision);
  return body.data;
}

describe("Issue #344 deletion recovery through Handler-Service-SQLite", () => {
  it.each([false, true])(
    "preserves committed deletes across repeated empty-summary failures (subtree=%s) and reopen",
    async (includeDescendants) => {
      const value = await fixture(includeDescendants);
      try {
        let revision = value.revision;
        const deletedExternalIds: string[] = [];
        for (const task of [value.first, value.second]) {
          const removed = value.remove(task.taskId, revision);
          expect(removed.status).toBe(200);
          const committed = await removed.json() as TaskMutationResponse;
          revision += 1;
          deletedExternalIds.push(task.externalId);
          expect(removed.headers.get("etag")).toBe(`"${revision}"`);
          expect(committed.data.project.revision).toBe(revision);
          expect(committed.data.operation.deletedTaskExternalIds).toEqual([task.externalId]);
          expect(committed.data.links).toEqual(value.links);
          const beforeFailure = await canonicalGet(value.service, value.publicId, revision);
          expect(beforeFailure.tasks).toEqual(committed.data.tasks);
          expect(beforeFailure.links).toEqual(committed.data.links);
          const rows = storedAggregate(value);

          const rejected = value.remove(value.lastChild.taskId, revision, { subtree: includeDescendants });
          expect(rejected.status).toBe(409);
          expect(await rejected.json()).toMatchObject({ error: { code: "EMPTY_SUMMARY_NOT_ALLOWED" } });
          expect(storedAggregate(value)).toEqual(rows);
          const recovered = await canonicalGet(value.service, value.publicId, revision);
          expect(recovered).toEqual(beforeFailure);
          for (const externalId of deletedExternalIds) {
            expect(recovered.tasks.some((remaining) => remaining.externalId === externalId)).toBe(false);
          }
          expect(recovered.tasks.find((remaining) => remaining.taskId === value.lastChild.taskId))
            .toMatchObject({ parentExternalId: "S", type: includeDescendants ? "summary" : "task" });

          const errorCases: { headers: Record<string, string>; status: number; code: string }[] = [
            { headers: { Cookie: "" }, status: 401, code: "EDIT_SESSION_REQUIRED" },
            { headers: { "If-Match": `"${revision - 1}"` }, status: 412, code: "REVISION_MISMATCH" },
            { headers: { Origin: "https://other.example.com" }, status: 403, code: "ORIGIN_NOT_ALLOWED" },
          ];
          for (const errorCase of errorCases) {
            const failure = value.remove(value.lastChild.taskId, revision, {
              subtree: includeDescendants, headers: errorCase.headers,
            });
            expect(failure.status).toBe(errorCase.status);
            expect(await failure.json()).toMatchObject({ error: { code: errorCase.code } });
            expect(storedAggregate(value)).toEqual(rows);
          }
        }

        const deletedSubtree = value.remove(value.root.taskId, revision, { subtree: true });
        expect(deletedSubtree.status).toBe(200);
        const result = await deletedSubtree.json() as TaskMutationResponse;
        revision += 1;
        expect(result.data.project.revision).toBe(revision);
        expect(result.data.operation.deletedTaskExternalIds).toEqual(["GRANDCHILD", "NESTED", "ROOT"]);
        expect(result.data.links).toEqual(value.links);
        const finalState = await canonicalGet(value.service, value.publicId, revision);
        expect(finalState.tasks.some((task) => ["C", "D", "ROOT", "NESTED", "GRANDCHILD"].includes(task.externalId)))
          .toBe(false);
        value.database.close();
        const reopened = openDatabase({ filename: value.filename, migrationsDirectory }).database;
        try {
          expect(await canonicalGet(new ProjectService(reopened, { clock }), value.publicId, revision))
            .toEqual(finalState);
        } finally {
          reopened.close();
        }
      } finally {
        if (value.database.open) value.database.close();
        rmSync(value.directory, { recursive: true, force: true });
      }
    },
  );
});
