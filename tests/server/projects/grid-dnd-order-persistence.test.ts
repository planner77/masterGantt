import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  ProjectTaskDto,
  TaskHierarchyCommandRequest,
  TaskMutationResponse,
} from "../../../src/contracts/projects";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { handleTaskHierarchyCommand } from "../../../src/server/projects/task-hierarchy-handlers-core";
import { TaskHierarchyService } from "../../../src/server/projects/task-hierarchy-service-core";
import { handleUpdateTask } from "../../../src/server/projects/task-handlers-core";

const BASE = "https://gantt.example.com";
const clock = () => new Date("2026-09-21T01:00:00.000Z");

async function fixture() {
  const database = openDatabase({
    filename: ":memory:",
    migrationsDirectory: join(process.cwd(), "db/migrations")
  }).database;
  const projects = new TaskFieldProjectService(database, {
    clock,
    hashPassword: async () => ({
      algorithm: "scrypt",
      salt: Buffer.alloc(16, 1),
      hash: Buffer.alloc(32, 2),
      n: 32768,
      r: 8,
      p: 3,
      keyLength: 32
    })
  });
  const hierarchy = new TaskHierarchyService(database, {
    clock
  });
  const created = await projects.create({
    name: "Grid order",
    description: "",
    editPassword: "Pass123!"
  });
  const publicId = created.response.data.project.publicId;
  const authorized = projects.authorize(publicId, created.rawSessionToken);
  if (authorized.kind !== "authorized")
    throw new Error("Missing edit authorization");
  const authorization = authorized.authorization;
  let snapshot: TaskMutationResponse | undefined;
  for (const [index, externalId] of ["A", "B", "C"].entries()) {
    snapshot = projects.createTask(authorization, index + 1, {
      externalId,
      name: externalId,
      type: externalId === "C" ? "milestone" : "task",
      start: "2026-09-21",
      duration: externalId === "C" ? 0 : 1,
      progress: 0
    });
  }
  const tasks = snapshot!.data.tasks;
  const ids = Object.fromEntries(tasks.map((task) => [task.externalId, task.taskId]));
  const dependencies = {
    applicationBaseUrl: BASE,
    environment: "production",
    requestId: () => "grid-order-regression"
  };
  const request = (
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    revision: number,
    headers: Record<string, string> = {},
  ) => new Request(`${BASE}/api/projects/${publicId}/${path}`, {
    method,
    headers: {
      Origin: BASE,
      "Content-Type": "application/json",
      Cookie: `__Host-mastergantt_edit=${created.rawSessionToken}`,
      "If-Match": `"${revision}"`,
      ...headers
    },
    body: JSON.stringify(body)
  });
  const command = (
    body: TaskHierarchyCommandRequest,
    revision: number,
    headers: Record<string, string> = {},
  ) => handleTaskHierarchyCommand(
    request("task-commands", "POST", body, revision, headers),
    publicId,
    {
      ...dependencies,
      authorizationService: projects,
      hierarchyService: hierarchy,
    },
  );
  const patch = (taskId: string, body: unknown, revision: number) => handleUpdateTask(
    request(`tasks/${taskId}`, "PATCH", body, revision),
    publicId,
    taskId,
    { ...dependencies, service: projects },
  );
  const rows = () => database.prepare(
    "SELECT external_id,name,type,parent_id,sort_order,requested_start,start_date,end_date,duration,progress FROM tasks ORDER BY id",
  ).all();
  return {
    database,
    projects,
    hierarchy,
    authorization,
    publicId,
    ids,
    tasks,
    command,
    patch,
    rows
  };
}

function siblings(
  tasks: readonly ProjectTaskDto[],
  parent: string | null = null,
): ProjectTaskDto[] {
  return tasks
    .filter((task) => task.parentExternalId === parent)
    .sort((left, right) => left.siblingOrder - right.siblingOrder);
}

describe("Issue #300 hierarchy persistence after Grid move and non-structural edits", () => {
  it.each(["before", "after"] as const)("persists same-parent %s reorder through rename, details, progress and canonical reread", async (placement) => {
    const f = await fixture();
    try {
      // Existing non-contiguous sort keys must become one normalized sibling order.
      f.database.prepare("UPDATE tasks SET sort_order=sort_order*10").run();
      const moved = await f.command({
        kind: "reparent",
        taskId: f.ids.B,
        anchorTaskId: placement === "before" ? f.ids.A : f.ids.C,
        placement
      }, 4);
      expect(moved.status).toBe(200);
      expect(moved.headers.get("etag")).toBe('"5"');
      const movedBody = await moved.json() as TaskMutationResponse;
      const expected = placement === "before" ? ["B", "A", "C"] : ["A", "C", "B"];
      expect(siblings(movedBody.data.tasks).map((task) => task.externalId)).toEqual(expected);
      expect(siblings(movedBody.data.tasks).map((task) => task.siblingOrder)).toEqual([0, 1, 2]);
      const placementBefore = f.database.prepare(
        "SELECT external_id,parent_id,sort_order,type,requested_start,start_date,end_date,duration FROM tasks ORDER BY id",
      ).all();

      const renamed = await f.patch(f.ids.B, {
        name: "B 수정"
      }, 5);
      expect(renamed.status).toBe(200);
      expect(renamed.headers.get("etag")).toBe('"6"');
      const renamedBody = await renamed.json() as TaskMutationResponse;
      expect(siblings(renamedBody.data.tasks).map((task) => task.name))
        .toEqual(expected.map((id) => id === "B" ? "B 수정" : id));
      expect(f.database.prepare(
        "SELECT external_id,parent_id,sort_order,type,requested_start,start_date,end_date,duration FROM tasks ORDER BY id",
      ).all()).toEqual(placementBefore);

      const edited = await f.patch(f.ids.B, {
        description: "Updated details",
        progress: 25
      }, 6);
      expect(edited.status).toBe(200);
      expect(edited.headers.get("etag")).toBe('"7"');
      expect(siblings(f.projects.getReadonlySnapshot(f.publicId)!.data.tasks)
        .map((task) => task.externalId)).toEqual(expected);
      expect(f.projects.getReadonlySnapshot(f.publicId)!.data.tasks
        .find((task) => task.taskId === f.ids.B)).toMatchObject({
        name: "B 수정",
        description: "Updated details",
        progress: 25,
        parentExternalId: null
      });
      expect(f.database.prepare(
        "SELECT external_id,parent_id,sort_order,type,requested_start,start_date,end_date,duration FROM tasks ORDER BY id",
      ).all()).toEqual(placementBefore);

    } finally {
      f.database.close();
    }
  });

  it("persists child placement, preserves parent during rename and enforces type/empty-summary/cycle restrictions", async () => {
    const f = await fixture();
    try {
      const moved = await f.command({
        kind: "reparent",
        taskId: f.ids.B,
        anchorTaskId: f.ids.A,
        placement: "child"
      }, 4);
      expect(moved.status).toBe(200);
      const movedBody = await moved.json() as TaskMutationResponse;
      expect(movedBody.data.tasks.find((task) => task.taskId === f.ids.A)?.type).toBe("summary");
      expect(movedBody.data.tasks.find((task) => task.taskId === f.ids.B)).toMatchObject({
        parentExternalId: "A",
        siblingOrder: 0
      });
      expect((await f.patch(f.ids.B, {
        name: "Child renamed"
      }, 5)).status).toBe(200);
      expect((await f.patch(f.ids.A, {
        name: "Summary renamed"
      }, 6)).status).toBe(200);
      const canonical = f.projects.getReadonlySnapshot(f.publicId)!.data;
      expect(canonical.project.revision).toBe(7);
      expect(canonical.tasks.find((task) => task.taskId === f.ids.B)).toMatchObject({
        parentExternalId: "A",
        siblingOrder: 0,
        name: "Child renamed"
      });
      const before = f.rows();
      for (const [command, status, code] of [
        [
          {
            kind: "reparent",
            taskId: f.ids.A,
            anchorTaskId: f.ids.B,
            placement: "child"
          },
          400, "INVALID_REQUEST"
        ],
        [
          {
            kind: "reparent",
            taskId: f.ids.A,
            anchorTaskId: f.ids.C,
            placement: "child"
          },
          409, "INVALID_PARENT_TASK"
        ]
      ] as const) {
        const rejected = await f.command(command, 7);
        expect(rejected.status).toBe(status);
        expect((await rejected.json()).error.code).toBe(code);
        expect(f.rows()).toEqual(before);
        expect(f.projects.getReadonlySnapshot(f.publicId)!.data.project.revision).toBe(7);
      }
    } finally {
      f.database.close();
    }
  });

  it.each(["up", "down"] as const)("Context Menu move %s and rename keep the same authoritative sibling contract", async (direction) => {
    const f = await fixture();
    try {
      const moved = await f.command({
        kind: "move",
        taskId: f.ids.B,
        direction
      }, 4);
      expect(moved.status).toBe(200);
      const movedBody = await moved.json() as TaskMutationResponse;
      const expected = siblings(movedBody.data.tasks).map((task) => task.externalId);
      expect((await f.patch(f.ids.B, {
        name: "Menu renamed"
      }, 5)).status).toBe(200);
      expect(siblings(f.projects.getReadonlySnapshot(f.publicId)!.data.tasks)
        .map((task) => task.externalId)).toEqual(expected);
      expect(siblings(f.projects.getReadonlySnapshot(f.publicId)!.data.tasks)
        .map((task) => task.siblingOrder)).toEqual([0, 1, 2]);
    } finally {
      f.database.close();
    }
  });

  it("rejects unauthorized, cross-origin, stale and invalid-target moves with aggregate rollback", async () => {
    const f = await fixture();
    try {
      const command = {
        kind: "reparent",
        taskId: f.ids.B,
        anchorTaskId: f.ids.C,
        placement: "after"
      } as const;
      const before = f.rows();
      for (const [body, revision, headers, status, code] of [
        [
          command, 4,
          {
            Cookie: ""
          },
          401, "EDIT_SESSION_REQUIRED"
        ],
        [
          command, 4,
          {
            Origin: "https://other.example.com"
          },
          403, "ORIGIN_NOT_ALLOWED"
        ],
        [
          command, 3,
          {},
          412, "REVISION_MISMATCH"
        ],
        [
          {
            ...command,
            anchorTaskId: randomUUID()
          },
          4,
          {},
          404, "TASK_NOT_FOUND"
        ]
      ] as const) {
        const response = await f.command(body, revision, headers);
        expect(response.status).toBe(status);
        expect((await response.json()).error.code).toBe(code);
        expect(f.rows()).toEqual(before);
        expect(f.projects.getReadonlySnapshot(f.publicId)!.data.project.revision).toBe(4);
      }
      expect((await f.command(command, 4)).status).toBe(200);
      const afterMove = f.rows();
      const staleRename = await f.patch(f.ids.B, {
        name: "Stale name"
      }, 4);
      expect(staleRename.status).toBe(412);
      expect((await staleRename.json()).error.code).toBe("REVISION_MISMATCH");
      expect(f.rows()).toEqual(afterMove);
      expect(f.projects.getReadonlySnapshot(f.publicId)!.data.project.revision).toBe(5);
      const unknownStructure = await f.patch(f.ids.B, {
        name: "Old structure",
        siblingOrder: 1,
        parentTaskId: f.ids.A
      }, 5);
      expect(unknownStructure.status).toBe(400);
      expect(f.rows()).toEqual(afterMove);
    } finally {
      f.database.close();
    }
  });
});
