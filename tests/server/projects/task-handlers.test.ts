import { describe, expect, it, vi } from "vitest";

import { SchedulingError } from "../../../src/domain/scheduling";
import type { TaskMutationResponse } from "../../../src/contracts/projects";
import {
  handleCreateTask,
  handleDeleteTask,
  handleUpdateTask,
} from "../../../src/server/projects/task-handlers-core";
import {
  DuplicateExternalIdError,
  EmptySummaryNotAllowedError,
  EditSessionInvalidError,
  InvalidParentTaskError,
  InvalidTaskInputError,
  ParentConversionRequiredError,
  PersistedScheduleInvalidError,
  RevisionMismatchError,
  TaskLimitExceededError,
  TaskNotFoundError,
  SummaryScheduleReadonlyError,
  SummaryTaskDeleteUnsupportedError,
  UnsupportedScheduleStructureError,
  type AuthorizedEditSession,
} from "../../../src/server/projects/project-service-core";

const publicId = "2fd0c93f-cd37-4b68-9f09-412239d99c79";
const taskId = "f6760712-5649-4edc-9781-5df172e27e88";
const rawToken = "A".repeat(43);
const cookie = `__Host-mastergantt_edit=${rawToken}`;
const authorization: AuthorizedEditSession = {
  projectId: 1,
  projectPublicId: publicId,
  projectRevision: 1,
  projectAuthVersion: 1,
  sessionId: 1,
  tokenHash: Buffer.alloc(32, 1),
  expiresAt: "2026-09-12T00:00:00.000Z",
};
const result: TaskMutationResponse = {
  data: {
    project: {
      publicId,
      name: "Project",
      description: "",
      status: "planned",
      revision: 2,
      calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
    },
    tasks: [],
    links: [],
    warnings: [],
    operation: {
      kind: "taskCreate",
      changedTaskExternalIds: ["ACT-100"],
      deletedTaskExternalIds: [],
      deletedLinkIds: [],
    },
  },
};

function api() {
  return {
    authorize: vi.fn(() => ({ kind: "authorized" as const, authorization })),
    createTask: vi.fn(() => result),
    updateTask: vi.fn(() => ({
      ...result,
      data: { ...result.data, operation: { ...result.data.operation, kind: "taskUpdate" as const } },
    })),
    deleteTask: vi.fn(() => ({
      ...result,
      data: { ...result.data, operation: { ...result.data.operation, kind: "taskDelete" as const } },
    })),
  };
}

function jsonRequest(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`https://gantt.example.com${path}`, {
    method,
    headers: {
      Origin: "https://gantt.example.com",
      "Content-Type": "application/json",
      Cookie: cookie,
      "If-Match": '"1"',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const dependencies = {
  applicationBaseUrl: "https://gantt.example.com",
  environment: "production",
  requestId: () => "request-id",
};

describe("W07 task handlers", () => {
  it("returns canonical success status and ETag for create, update, and delete", async () => {
    const service = api();
    const create = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "task", start: "2026-09-11", duration: 1, progress: 0,
      }),
      publicId,
      { ...dependencies, service },
    );
    const update = await handleUpdateTask(
      jsonRequest(`/api/projects/${publicId}/tasks/${taskId}`, "PATCH", { name: "Updated" }),
      publicId,
      taskId,
      { ...dependencies, service },
    );
    const remove = handleDeleteTask(
      new Request(`https://gantt.example.com/api/projects/${publicId}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Origin: "https://gantt.example.com", Cookie: cookie, "If-Match": '"1"' },
      }),
      publicId,
      taskId,
      { ...dependencies, service },
    );
    expect([create.status, update.status, remove.status]).toEqual([201, 200, 200]);
    expect([create.headers.get("etag"), update.headers.get("etag"), remove.headers.get("etag")])
      .toEqual(['"2"', '"2"', '"2"']);
    expect(service.authorize).toHaveBeenCalledWith(publicId, rawToken);
    expect(service.createTask).toHaveBeenCalledWith(authorization, 1, expect.objectContaining({ name: "Task" }));
    expect(service.updateTask).toHaveBeenCalledWith(authorization, 1, taskId, { name: "Updated" });
    expect(service.deleteTask).toHaveBeenCalledWith(authorization, 1, taskId);
  });

  it("checks Origin then strict input before authorization", async () => {
    const service = api();
    const crossOrigin = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "task", start: "2026-09-11", duration: 1, progress: 0,
      }, { Origin: "https://evil.test" }),
      publicId,
      { ...dependencies, service },
    );
    expect(crossOrigin.status).toBe(403);
    expect(service.authorize).not.toHaveBeenCalled();

    const invalid = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "summary", start: "2026-09-11", duration: 1, progress: 0,
      }),
      publicId,
      { ...dependencies, service },
    );
    expect(invalid.status).toBe(400);
    expect(service.authorize).not.toHaveBeenCalled();
  });

  it("requires authorization before If-Match and rejects noncanonical task IDs in scope", async () => {
    const unauthorized = api();
    unauthorized.authorize.mockReturnValue({ kind: "unauthorized" } as never);
    const noRevision = await handleUpdateTask(
      jsonRequest(`/api/projects/${publicId}/tasks/${taskId}`, "PATCH", { name: "Updated" }, { "If-Match": "" }),
      publicId,
      taskId,
      { ...dependencies, service: unauthorized },
    );
    expect(noRevision.status).toBe(401);

    const missingProject = api();
    missingProject.authorize.mockReturnValue({ kind: "projectNotFound" } as never);
    const missingProjectResponse = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "task", start: "2026-09-11", duration: 1, progress: 0,
      }),
      publicId,
      { ...dependencies, service: missingProject },
    );
    expect(missingProjectResponse.status).toBe(404);
    expect(await missingProjectResponse.json()).toMatchObject({ error: { code: "PROJECT_NOT_FOUND" } });

    const service = api();
    const malformed = await handleUpdateTask(
      jsonRequest(`/api/projects/${publicId}/tasks/not-a-uuid`, "PATCH", { name: "Updated" }),
      publicId,
      "not-a-uuid",
      { ...dependencies, service },
    );
    expect(malformed.status).toBe(404);
    expect(service.updateTask).not.toHaveBeenCalled();
  });

  it("maps request scheduling errors safely and hides persisted or unexpected failures", async () => {
    const scheduling = api();
    scheduling.createTask.mockImplementation(() => {
      throw new SchedulingError("NON_WORKING_MANUAL_START", {
        field: "requestedStart",
        date: "2026-09-12",
      });
    });
    const response = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "task", scheduleMode: "manual", start: "2026-09-12", duration: 1, progress: 0,
      }),
      publicId,
      { ...dependencies, service: scheduling },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "NON_WORKING_MANUAL_START",
        message: "The task schedule is invalid.",
        details: [{ path: "start", code: "NON_WORKING_MANUAL_START", message: "Invalid task schedule." }],
        requestId: "request-id",
      },
    });

    for (const failure of [new PersistedScheduleInvalidError(), new Error("SQL secret stack")]) {
      const broken = api();
      broken.createTask.mockImplementation(() => { throw failure; });
      const hidden = await handleCreateTask(
        jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
          name: "Task", type: "task", start: "2026-09-11", duration: 1, progress: 0,
        }),
        publicId,
        { ...dependencies, service: broken },
      );
      expect(hidden.status).toBe(500);
      expect(JSON.stringify(await hidden.json())).not.toContain("secret");
    }
  });

  it("maps stale transaction failures without exposing implementation details", async () => {
    const service = api();
    service.updateTask.mockImplementation(() => { throw new RevisionMismatchError(); });
    const response = await handleUpdateTask(
      jsonRequest(`/api/projects/${publicId}/tasks/${taskId}`, "PATCH", { name: "Updated" }),
      publicId,
      taskId,
      { ...dependencies, service },
    );
    expect(response.status).toBe(412);
    expect(await response.json()).toMatchObject({ error: { code: "REVISION_MISMATCH" } });
  });

  it("maps Service defense-in-depth input rejection to a safe 400", async () => {
    const service = api();
    service.createTask.mockImplementation(() => { throw new InvalidTaskInputError(); });
    const response = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "task", start: "2026-09-11", duration: 1, progress: 0,
      }),
      publicId,
      { ...dependencies, service },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "The task input is invalid.",
        details: [],
        requestId: "request-id",
      },
    });
  });

  it.each([
    [new ParentConversionRequiredError(), "PARENT_CONVERSION_REQUIRED"],
    [new InvalidParentTaskError(), "INVALID_PARENT_TASK"],
    [new EmptySummaryNotAllowedError(), "EMPTY_SUMMARY_NOT_ALLOWED"],
    [new SummaryTaskDeleteUnsupportedError(), "SUMMARY_DELETE_UNSUPPORTED"],
    [new SummaryScheduleReadonlyError(), "SUMMARY_SCHEDULE_READONLY"],
  ])("maps hierarchy conflict %s to stable 409 code %s", async (failure, code) => {
    const service = api();
    service.createTask.mockImplementation(() => { throw failure; });
    const response = await handleCreateTask(
      jsonRequest(`/api/projects/${publicId}/tasks`, "POST", {
        name: "Task", type: "task", start: "2026-09-11", duration: 1, progress: 0,
      }),
      publicId,
      { ...dependencies, service },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it.each([
    [new EditSessionInvalidError(), 401, "EDIT_SESSION_REQUIRED"],
    [new TaskNotFoundError(), 404, "TASK_NOT_FOUND"],
    [new DuplicateExternalIdError(), 409, "DUPLICATE_EXTERNAL_ID"],
    [new UnsupportedScheduleStructureError(), 409, "UNSUPPORTED_SCHEDULE_STRUCTURE"],
    [new TaskLimitExceededError(), 409, "TASK_LIMIT_EXCEEDED"],
  ] as const)("maps %s to the stable public error", async (failure, status, code) => {
    const service = api();
    service.updateTask.mockImplementation(() => { throw failure; });
    const response = await handleUpdateTask(
      jsonRequest(`/api/projects/${publicId}/tasks/${taskId}`, "PATCH", { name: "Updated" }),
      publicId,
      taskId,
      { ...dependencies, service },
    );
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code, requestId: "request-id" } });
    expect(JSON.stringify(body)).not.toMatch(/SQL|stack|\/home\//i);
  });
});
