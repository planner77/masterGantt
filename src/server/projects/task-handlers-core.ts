import { randomUUID } from "node:crypto";

import type {
  CreateTaskRequest,
  TaskMutationResponse,
  UpdateTaskRequest,
} from "../../contracts/projects";
import { SchedulingError } from "../../domain/scheduling";
import { apiErrorResponse, PublicApiError } from "../http/api-error-core";
import { parseRequiredIfMatch, readBoundedJson } from "../http/request-core";
import { parseEditSessionCookie } from "../security/cookie-core";
import {
  ConfigurationError,
  isExactAllowedOrigin,
  parseApplicationBaseUrl,
} from "../security/origin-core";
import { isCanonicalUuidV4 } from "./project-contract";
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
  type AuthorizationResult,
  type AuthorizedEditSession,
} from "./project-service-core";
import { parseCreateTaskInput, parseUpdateTaskInput } from "./task-contract";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

interface TaskServiceApi {
  authorize(publicId: string, rawToken: string | undefined): AuthorizationResult;
  createTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    input: CreateTaskRequest,
  ): TaskMutationResponse;
  updateTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
    input: UpdateTaskRequest,
  ): TaskMutationResponse;
  deleteTask(
    authorization: AuthorizedEditSession,
    expectedRevision: number,
    taskPublicId: string,
  ): TaskMutationResponse;
}

type ServiceDependency = TaskServiceApi | (() => TaskServiceApi);

export interface TaskHandlerDependencies {
  service: ServiceDependency;
  applicationBaseUrl: string | undefined;
  environment: string | undefined;
  requestId?: () => string;
}

function resolveService(dependency: ServiceDependency): TaskServiceApi {
  return typeof dependency === "function" ? dependency() : dependency;
}

function requireApplicationUrl(dependencies: TaskHandlerDependencies): URL {
  try {
    return parseApplicationBaseUrl(
      dependencies.applicationBaseUrl,
      dependencies.environment,
    );
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw new PublicApiError(
        500,
        "CONFIGURATION_ERROR",
        "The service is not configured correctly.",
      );
    }
    throw error;
  }
}

function requireOrigin(request: Request, applicationUrl: URL): void {
  if (!isExactAllowedOrigin(request.headers.get("origin"), applicationUrl)) {
    throw new PublicApiError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "The request origin is not allowed.",
    );
  }
}

function authorize(
  request: Request,
  publicId: string,
  service: TaskServiceApi,
  environment: string | undefined,
): AuthorizedEditSession {
  const cookie = parseEditSessionCookie(request.headers.get("cookie"), environment);
  const result = service.authorize(
    publicId,
    cookie.state === "present" ? cookie.rawToken : undefined,
  );
  if (result.kind === "projectNotFound") {
    throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }
  if (result.kind === "unauthorized") {
    throw new PublicApiError(
      401,
      "EDIT_SESSION_REQUIRED",
      "A valid edit session is required.",
    );
  }
  return result.authorization;
}

function taskNotFound(): PublicApiError {
  return new PublicApiError(404, "TASK_NOT_FOUND", "Task not found.");
}

function finishError(error: unknown, requestId: string): Response {
  let mapped = error;
  if (error instanceof EditSessionInvalidError) {
    mapped = new PublicApiError(
      401,
      "EDIT_SESSION_REQUIRED",
      "A valid edit session is required.",
    );
  } else if (error instanceof RevisionMismatchError) {
    mapped = new PublicApiError(
      412,
      "REVISION_MISMATCH",
      "Project changed. Reload and retry.",
    );
  } else if (error instanceof TaskNotFoundError) {
    mapped = taskNotFound();
  } else if (error instanceof InvalidTaskInputError) {
    mapped = new PublicApiError(
      400,
      "INVALID_REQUEST",
      "The task input is invalid.",
    );
  } else if (error instanceof DuplicateExternalIdError) {
    mapped = new PublicApiError(
      409,
      "DUPLICATE_EXTERNAL_ID",
      "The external task identifier already exists.",
    );
  } else if (error instanceof UnsupportedScheduleStructureError) {
    mapped = new PublicApiError(
      409,
      "UNSUPPORTED_SCHEDULE_STRUCTURE",
      "This schedule structure is not supported by this operation.",
    );
  } else if (error instanceof TaskLimitExceededError) {
    mapped = new PublicApiError(
      409,
      "TASK_LIMIT_EXCEEDED",
      "The project task limit has been reached.",
    );
  } else if (error instanceof ParentConversionRequiredError) {
    mapped = new PublicApiError(
      409,
      "PARENT_CONVERSION_REQUIRED",
      "Explicit confirmation is required to convert the task to a summary.",
    );
  } else if (error instanceof InvalidParentTaskError) {
    mapped = new PublicApiError(
      409,
      "INVALID_PARENT_TASK",
      "The selected task cannot contain child tasks.",
    );
  } else if (error instanceof EmptySummaryNotAllowedError) {
    mapped = new PublicApiError(
      409,
      "EMPTY_SUMMARY_NOT_ALLOWED",
      "The last child of a summary cannot be deleted.",
    );
  } else if (error instanceof SummaryTaskDeleteUnsupportedError) {
    mapped = new PublicApiError(
      409,
      "SUMMARY_DELETE_UNSUPPORTED",
      "Summary task deletion is not supported.",
    );
  } else if (error instanceof SummaryScheduleReadonlyError) {
    mapped = new PublicApiError(
      409,
      "SUMMARY_SCHEDULE_READONLY",
      "Summary schedule fields are derived from child tasks.",
    );
  } else if (error instanceof SchedulingError) {
    const path = error.context.field === "requestedStart"
      ? "start"
      : error.context.field;
    mapped = new PublicApiError(
      422,
      error.code,
      "The task schedule is invalid.",
      [{
        ...(path ? { path } : {}),
        code: error.code,
        message: "Invalid task schedule.",
      }],
    );
  } else if (error instanceof PersistedScheduleInvalidError) {
    mapped = new PublicApiError(
      500,
      "INTERNAL_ERROR",
      "The request could not be completed.",
    );
  }
  const response = apiErrorResponse(mapped, requestId);
  response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  return response;
}

function success(result: TaskMutationResponse, status: 200 | 201): Response {
  return Response.json(result, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ETag: `"${result.data.project.revision}"`,
    },
  });
}

export async function handleCreateTask(
  request: Request,
  publicId: string,
  dependencies: TaskHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    requireOrigin(request, requireApplicationUrl(dependencies));
    const raw = await readBoundedJson(request);
    const parsed = parseCreateTaskInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The task input is invalid.",
        parsed.details,
      );
    }
    const service = resolveService(dependencies.service);
    const authorization = authorize(
      request,
      publicId,
      service,
      dependencies.environment,
    );
    const expectedRevision = parseRequiredIfMatch(request);
    return success(
      service.createTask(authorization, expectedRevision, parsed.data),
      201,
    );
  } catch (error) {
    return finishError(error, requestId);
  }
}

export async function handleUpdateTask(
  request: Request,
  publicId: string,
  taskPublicId: string,
  dependencies: TaskHandlerDependencies,
): Promise<Response> {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    requireOrigin(request, requireApplicationUrl(dependencies));
    const raw = await readBoundedJson(request);
    const parsed = parseUpdateTaskInput(raw);
    if (!parsed.success) {
      throw new PublicApiError(
        400,
        "INVALID_REQUEST",
        "The task input is invalid.",
        parsed.details,
      );
    }
    const service = resolveService(dependencies.service);
    const authorization = authorize(
      request,
      publicId,
      service,
      dependencies.environment,
    );
    const expectedRevision = parseRequiredIfMatch(request);
    if (!isCanonicalUuidV4(taskPublicId)) throw taskNotFound();
    return success(
      service.updateTask(
        authorization,
        expectedRevision,
        taskPublicId,
        parsed.data,
      ),
      200,
    );
  } catch (error) {
    return finishError(error, requestId);
  }
}

export function handleDeleteTask(
  request: Request,
  publicId: string,
  taskPublicId: string,
  dependencies: TaskHandlerDependencies,
): Response {
  const requestId = (dependencies.requestId ?? randomUUID)();
  try {
    requireOrigin(request, requireApplicationUrl(dependencies));
    const service = resolveService(dependencies.service);
    const authorization = authorize(
      request,
      publicId,
      service,
      dependencies.environment,
    );
    const expectedRevision = parseRequiredIfMatch(request);
    if (!isCanonicalUuidV4(taskPublicId)) throw taskNotFound();
    return success(
      service.deleteTask(authorization, expectedRevision, taskPublicId),
      200,
    );
  } catch (error) {
    return finishError(error, requestId);
  }
}
